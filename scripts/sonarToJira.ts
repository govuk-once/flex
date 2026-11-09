import { createHash } from "node:crypto";

type SonarLocation = {
  component?: string;
  textRange?: { startLine?: number };
  msg?: string;
};
type SonarFlow = { locations?: SonarLocation[] };
type SonarIssue = {
  key: string;
  message: string;
  component: string;
  line?: number;
  rule?: string;
  impacts?: { softwareQuality: string; severity: string }[];
  flows?: SonarFlow[];
};
type SonarSearch = { total: number; issues: SonarIssue[] };
type RuleSection = { key?: string; content?: string; htmlContent?: string };
type RuleDetails = {
  rule?: {
    name?: string;
    htmlDesc?: string;
    mdDesc?: string;
    descriptionSections?: RuleSection[];
  };
};
type JiraSearch = { issues: { key: string; fields?: { labels?: string[] } }[] };
type JiraCreated = { key: string };
type AdfNode = Record<string, unknown>;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const sonarUrl = required("SONAR_URL").replace(/\/$/, "");
const sonarToken = required("SONAR_TOKEN_FLEX");
const jiraUrl = required("JIRA_URL").replace(/\/$/, "");
const jiraEmail = required("JIRA_EMAIL");
const jiraToken = required("JIRA_API_TOKEN");
const organization = "govuk-once";
const sonarProject = "govuk-once_flex";
const jiraProject = "GUV";
const testMode = process.env.TEST_TICKET === "true";
const dryRun = process.env.DRY_RUN !== "false";
const maxTickets = 5;
const jiraAuth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString("base64");

function validateExecution(): void {
  if (process.env.GITHUB_ACTIONS !== "true") return;

  if (testMode) {
    const isApprovedPrTest =
      process.env.GITHUB_EVENT_NAME === "pull_request" &&
      process.env.GITHUB_HEAD_REF === "GUOIT-202" &&
      process.env.GITHUB_BASE_REF === "main";

    if (!isApprovedPrTest) {
      throw new Error(
        "GitHub test mode is restricted to the GUOIT-202 PR targeting main",
      );
    }
    return;
  }

  if (
    process.env.GITHUB_EVENT_NAME !== "push" ||
    process.env.GITHUB_REF !== "refs/heads/main"
  ) {
    throw new Error("Production Jira integration must run from a push to main");
  }
}

async function sonarGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(path, `${sonarUrl}/`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sonarToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `SonarCloud ${path} HTTP ${String(response.status)}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

async function jiraRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Basic ${jiraAuth}`);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${jiraUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Jira HTTP ${String(response.status)}: ${await response.text()}`,
    );
  }

  return response;
}

async function getFindings(): Promise<SonarIssue[]> {
  const findings: SonarIssue[] = [];
  let page = 1;
  let more = true;

  while (more) {
    const data = await sonarGet<SonarSearch>("/api/issues/search", {
      organization,
      componentKeys: sonarProject,
      impactSoftwareQualities: "SECURITY",
      impactSeverities: "HIGH,BLOCKER",
      branch: "main",
      ps: "100",
      p: String(page),
    });

    findings.push(...data.issues);
    more = findings.length < data.total && data.issues.length > 0;
    page += 1;
  }

  return findings;
}

function plainText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

async function getRuleDetails(
  ruleKey: string,
): Promise<{ name: string; remediation: string }> {
  const data = await sonarGet<RuleDetails>("/api/rules/show", {
    key: ruleKey,
    organization,
  });

  if (!data.rule) {
    throw new Error(`SonarCloud did not return rule ${ruleKey}`);
  }

  const sections = data.rule.descriptionSections ?? [];
  const fixSections = sections.filter((section) =>
    /fix|solution|remediat/i.test(section.key ?? ""),
  );

  const remediation = fixSections
    .map((section) => plainText(section.content ?? section.htmlContent ?? ""))
    .filter((value) => value.length > 0)
    .join("\n\n");

  return {
    name: data.rule.name ?? ruleKey,
    remediation:
      remediation ||
      "Rule-specific remediation was not available from the API. Review the linked SonarCloud rule's 'How can I fix it?' guidance.",
  };
}

function locationText(location: SonarLocation): string {
  const file = location.component ?? "Unknown file";
  const line = location.textRange?.startLine;

  return [
    file,
    line === undefined ? "" : `:${String(line)}`,
    location.msg ? ` - ${location.msg}` : "",
  ].join("");
}

function trace(issue: SonarIssue): {
  source: string;
  sink: string;
  flow: string[];
} {
  const locations = issue.flows?.find(
    (flow) => (flow.locations?.length ?? 0) >= 2,
  )?.locations;

  const firstLocation = locations?.[0];
  const lastLocation = locations?.at(-1);

  if (locations && firstLocation && lastLocation) {
    return {
      source: locationText(firstLocation),
      sink: locationText(lastLocation),
      flow: locations.map(locationText),
    };
  }

  const primary = [
    issue.component,
    issue.line === undefined ? "" : `:${String(issue.line)}`,
  ].join("");

  return {
    source: "Source-to-sink trace not supplied for this finding",
    sink: `Primary finding location (not a verified sink): ${primary}`,
    flow: [],
  };
}

function issueLabel(key: string): string {
  const identifier = [sonarProject, key].join(":");
  const hash = createHash("sha256")
    .update(identifier)
    .digest("hex")
    .slice(0, 24);

  return `sonar-${hash}`;
}

async function existingTicket(label: string): Promise<string | undefined> {
  const url = new URL("/rest/api/3/search/jql", `${jiraUrl}/`);

  url.searchParams.set(
    "jql",
    `project = ${jiraProject} AND labels = "${label}"`,
  );
  url.searchParams.set("fields", "labels");
  url.searchParams.set("maxResults", "100");

  const response = await jiraRequest(`${url.pathname}${url.search}`);
  const data = (await response.json()) as JiraSearch;

  return data.issues.find((item) => item.fields?.labels?.includes(label))?.key;
}

const paragraph = (value: string): AdfNode => ({
  type: "paragraph",
  content: [
    {
      type: "text",
      text: value.slice(0, 12000) || " ",
    },
  ],
});

const heading = (value: string): AdfNode => ({
  type: "heading",
  attrs: { level: 3 },
  content: [{ type: "text", text: value }],
});

const bullet = (value: string): AdfNode => ({
  type: "bulletList",
  content: [
    {
      type: "listItem",
      content: [paragraph(value)],
    },
  ],
});

const divider = (): AdfNode => ({ type: "rule" });

function getSeverity(issue: SonarIssue): string {
  return (
    issue.impacts
      ?.filter((impact) => impact.softwareQuality === "SECURITY")
      .map((impact) => impact.severity)
      .join(", ") || "HIGH"
  );
}

function requiredRule(issue: SonarIssue): string {
  if (!issue.rule) {
    throw new Error(`Finding ${issue.key} has no rule key`);
  }
  return issue.rule;
}

async function createTicket(
  issue: SonarIssue,
  isTest: boolean,
): Promise<string> {
  const ruleKey = requiredRule(issue);
  const rule = await getRuleDetails(ruleKey);
  const traced = trace(issue);
  const severity = getSeverity(issue);

  const link = new URL("/project/issues", `${sonarUrl}/`);
  link.searchParams.set("id", sonarProject);
  link.searchParams.set("issues", issue.key);

  const content: AdfNode[] = [
    heading("SOURCE"),
    bullet(traced.source),
    paragraph(`Scanner: SonarCloud SAST | Project: ${sonarProject}`),
    divider(),

    heading("SINK"),
    bullet(traced.sink),
    ...(traced.flow.length > 0
      ? [paragraph(`Reported execution flow: ${traced.flow.join(" -> ")}`)]
      : []),
    divider(),

    heading("Vulnerability Summary"),
    paragraph(`Severity: ${severity} | Type: ${rule.name} (${ruleKey})`),
    paragraph(issue.message),
    divider(),

    heading("Details"),
    paragraph(`SonarCloud issue: ${issue.key}`),
    paragraph(`Branch: main | Component: ${issue.component}`),
    paragraph(`Finding URL: ${link.toString()}`),
    ...(isTest
      ? [
          paragraph(
            "TEST ONLY - simulated finding, not an actual vulnerability",
          ),
        ]
      : []),
    divider(),

    heading("Proposed Remediation"),
    paragraph(rule.remediation),
    paragraph(
      `Review the complete rule guidance in SonarCloud: ${sonarUrl}/coding_rules?open=${encodeURIComponent(ruleKey)}&rule_key=${encodeURIComponent(ruleKey)}`,
    ),
    divider(),

    heading("DEFINITION OF DONE"),
    paragraph(
      "☐ Finding resolved according to the vulnerability management process",
    ),
  ];

  const labels = [
    "sonarcloud",
    "security",
    "sast",
    "automated",
    issueLabel(issue.key),
  ];

  if (isTest) {
    labels.push("guoit-202-sast-template-test-v2");
  }

  const payload = {
    fields: {
      project: { key: jiraProject },
      issuetype: { name: "Task" },
      summary: [
        isTest ? "[TEST] " : "",
        `[SonarCloud][${severity}] ${issue.message}`,
      ]
        .join("")
        .slice(0, 255),
      labels,
      description: {
        type: "doc",
        version: 1,
        content,
      },
    },
  };

  const response = await jiraRequest("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return ((await response.json()) as JiraCreated).key;
}

async function main(): Promise<void> {
  validateExecution();

  console.log(
    `Mode: ${testMode ? "TEMPLATE TEST" : "MAIN FINDINGS"}; dry run: ${String(dryRun)}`,
  );

  if (testMode) {
    const ruleKey = required("TEST_SONAR_RULE_KEY");

    const issue: SonarIssue = {
      key: "GUOIT-202-SAST-TEMPLATE-V2",
      message: "Template verification - simulated security finding",
      component: "govuk-once_flex:libs/testing/src/mock-security.ts",
      line: 42,
      rule: ruleKey,
      impacts: [
        {
          softwareQuality: "SECURITY",
          severity: "HIGH",
        },
      ],
    };

    const label = issueLabel(issue.key);
    const existing = await existingTicket(label);

    if (existing) {
      console.log(`Test ticket already exists: ${jiraUrl}/browse/${existing}`);
      return;
    }

    const rule = await getRuleDetails(ruleKey);
    console.log(`Rule: ${rule.name}`);
    console.log(`Remediation preview: ${rule.remediation.slice(0, 400)}`);

    if (dryRun) {
      console.log("[DRY RUN] Would create one SAST template test ticket");
      return;
    }

    const key = await createTicket(issue, true);
    console.log(`Created test ticket: ${jiraUrl}/browse/${key}`);
    return;
  }

  const findings = await getFindings();

  console.log(
    `Found ${String(findings.length)} HIGH/BLOCKER security findings on main`,
  );

  let created = 0;

  for (const issue of findings) {
    const label = issueLabel(issue.key);
    const existing = await existingTicket(label);

    if (existing) {
      console.log(`Already tracked: ${issue.key} -> ${existing}`);
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would create ticket for ${issue.key}`);
      continue;
    }

    if (created >= maxTickets) break;

    const key = await createTicket(issue, false);

    console.log(`Created ${jiraUrl}/browse/${key} for ${issue.key}`);

    created += 1;
  }

  console.log(`Created ${String(created)} Jira tickets`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
