import { createHash } from "node:crypto";

type SonarSeverity = "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

type SonarLocation = {
  component?: string;
  textRange?: {
    startLine?: number;
  };
  msg?: string;
};

type SonarFlow = {
  locations?: SonarLocation[];
};

type SonarIssue = {
  key: string;
  message: string;
  component: string;
  line?: number;
  rule?: string;
  impacts?: {
    softwareQuality: string;
    severity: string;
  }[];
  flows?: SonarFlow[];
};

type SonarSearch = {
  total: number;
  issues: SonarIssue[];
};

type RuleSection = {
  key?: string;
  content?: string;
  htmlContent?: string;
};

type RuleDetails = {
  rule?: {
    name?: string;
    htmlDesc?: string;
    mdDesc?: string;
    descriptionSections?: RuleSection[];
  };
};

type JiraSearch = {
  issues: {
    key: string;
    fields?: {
      labels?: string[];
    };
  }[];
};

type JiraCreated = {
  key: string;
};

type AdfNode = Record<string, unknown>;

type SeverityMapping = {
  label: string;
  optionId: string;
  priority: string;
};

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

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

// Confirmed GUV custom fields
const jiraFields = {
  source: "customfield_10545",
  severity: "customfield_10546",
  stakeholders: "customfield_10547",
  impact: "customfield_10004",
  cvss: "customfield_10512",
  epss: "customfield_10479",
  exceptionReviewDate: "customfield_10580",
  environment: "environment",
} as const;

// Confirmed GUV severity option IDs.
// Priority names must still be verified against Jira.
const severityMappings: Record<SonarSeverity, SeverityMapping> = {
  BLOCKER: {
    label: "Critical",
    optionId: "10138",
    priority: "Highest",
  },
  HIGH: {
    label: "High",
    optionId: "10137",
    priority: "High",
  },
  MEDIUM: {
    label: "Medium",
    optionId: "10136",
    priority: "Medium",
  },
  LOW: {
    label: "Low",
    optionId: "10135",
    priority: "Low",
  },
  INFO: {
    label: "Informational",
    optionId: "10134",
    priority: "Lowest",
  },
};

const severityOrder: SonarSeverity[] = [
  "BLOCKER",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
];

const jiraAuth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString("base64");

function validateExecution(): void {
  if (process.env.GITHUB_ACTIONS !== "true") {
    return;
  }

  if (testMode) {
    const allowed =
      process.env.GITHUB_EVENT_NAME === "pull_request" &&
      process.env.GITHUB_HEAD_REF === "GUOIT-202" &&
      process.env.GITHUB_BASE_REF === "main";

    if (!allowed) {
      throw new Error(
        "Test mode is restricted to the GUOIT-202 PR targeting main",
      );
    }

    return;
  }

  const isMainPush =
    process.env.GITHUB_EVENT_NAME === "push" &&
    process.env.GITHUB_REF === "refs/heads/main";

  if (!isMainPush) {
    throw new Error("Production Jira integration must run on a push to main");
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
      "Rule-specific remediation was not returned by the API. Review the SonarCloud rule guidance before remediation.",
  };
}

function getSeverity(issue: SonarIssue): SonarSeverity {
  const securityImpacts = (issue.impacts ?? [])
    .filter((impact) => impact.softwareQuality === "SECURITY")
    .map((impact) => impact.severity);

  for (const severity of severityOrder) {
    if (securityImpacts.includes(severity)) {
      return severity;
    }
  }

  throw new Error(`No supported SECURITY severity found for ${issue.key}`);
}

function jiraSeverity(severity: SonarSeverity): SeverityMapping {
  return severityMappings[severity];
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
  const identifier = `${sonarProject}:${key}`;

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

function paragraph(value: string): AdfNode {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: value.slice(0, 12000) || " ",
      },
    ],
  };
}

function heading(value: string): AdfNode {
  return {
    type: "heading",
    attrs: { level: 3 },
    content: [
      {
        type: "text",
        text: value,
      },
    ],
  };
}

function bullet(value: string): AdfNode {
  return {
    type: "bulletList",
    content: [
      {
        type: "listItem",
        content: [paragraph(value)],
      },
    ],
  };
}

function divider(): AdfNode {
  return { type: "rule" };
}

function requiredRule(issue: SonarIssue): string {
  if (!issue.rule) {
    throw new Error(`Finding ${issue.key} has no rule key`);
  }

  return issue.rule;
}

function findingUrl(issue: SonarIssue): string {
  const url = new URL("/project/issues", `${sonarUrl}/`);

  url.searchParams.set("id", sonarProject);
  url.searchParams.set("issues", issue.key);

  return url.toString();
}

function createDescription(
  issue: SonarIssue,
  rule: {
    name: string;
    remediation: string;
  },
  severity: SeverityMapping,
  isTest: boolean,
): {
  type: string;
  version: number;
  content: AdfNode[];
} {
  const traced = trace(issue);
  const ruleKey = requiredRule(issue);

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
    paragraph(`Severity: ${severity.label} | Type: ${rule.name} (${ruleKey})`),
    paragraph(issue.message),
    divider(),

    heading("Details"),
    paragraph(`SonarCloud issue: ${issue.key}`),
    paragraph(`Branch: main | Component: ${issue.component}`),
    paragraph(`Finding URL: ${findingUrl(issue)}`),

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
      "Review the full rule guidance in SonarCloud before implementing the remediation.",
    ),
    divider(),

    heading("DEFINITION OF DONE"),
    paragraph(
      "Finding remediated and verified according to the vulnerability management process.",
    ),
  ];

  return {
    type: "doc",
    version: 1,
    content,
  };
}

async function createTicket(
  issue: SonarIssue,
  isTest: boolean,
): Promise<string> {
  const ruleKey = requiredRule(issue);

  const severity = getSeverity(issue);
  const mappedSeverity = jiraSeverity(severity);
  const rule = await getRuleDetails(ruleKey);

  const labels = [
    "sonarcloud",
    "security",
    "sast",
    "automated",
    issueLabel(issue.key),
  ];

  if (isTest) {
    labels.push("guoit-202-sast-template-test-v3");
  }

  const summary = [
    isTest ? "[TEST] " : "",
    `[SonarCloud][${mappedSeverity.label}] ${issue.message}`,
  ]
    .join("")
    .slice(0, 255);

  const description = createDescription(issue, rule, mappedSeverity, isTest);

  const fields: Record<string, unknown> = {
    project: {
      key: jiraProject,
    },

    issuetype: {
      name: "Task",
    },

    summary,
    labels,
    description,

    // Actual Jira Source field
    [jiraFields.source]: "SonarCloud SAST",

    // Actual Jira Severity field
    [jiraFields.severity]: {
      id: mappedSeverity.optionId,
    },

    // Jira Priority must match severity.
    // Priority names require verification.
    priority: {
      name: mappedSeverity.priority,
    },
  };

  // Impact is deliberately not derived from severity.
  // CVSS and EPSS are not available for every SAST issue.
  // Stakeholders require an approved ownership mapping.
  // Exception review date is only set for approved exceptions.
  // Environment must reflect a verified deployment environment.
  // These fields remain unset until reliable values exist.

  const payload = {
    fields,
  };

  const response = await jiraRequest("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const created = (await response.json()) as JiraCreated;

  return created.key;
}

async function runTest(): Promise<void> {
  const ruleKey = required("TEST_SONAR_RULE_KEY");

  const issue: SonarIssue = {
    key: "GUOIT-202-SAST-TEMPLATE-V3",
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

  const severity = getSeverity(issue);
  const mappedSeverity = jiraSeverity(severity);

  const rule = await getRuleDetails(ruleKey);

  console.log(`Rule: ${rule.name}`);
  console.log(`Severity: ${mappedSeverity.label}`);
  console.log(`Priority: ${mappedSeverity.priority}`);

  console.log(`Remediation preview: ${rule.remediation.slice(0, 400)}`);

  if (dryRun) {
    console.log("[DRY RUN] Would create one SAST template test ticket");
    return;
  }

  const key = await createTicket(issue, true);

  console.log(`Created test ticket: ${jiraUrl}/browse/${key}`);
}

async function runProduction(): Promise<void> {
  const findings = await getFindings();

  console.log(
    `Found ${String(findings.length)} HIGH/BLOCKER security findings on main`,
  );

  let created = 0;

  for (const issue of findings) {
    if (!dryRun && created >= maxTickets) {
      break;
    }

    const label = issueLabel(issue.key);
    const existing = await existingTicket(label);

    if (existing) {
      console.log(`Already tracked: ${issue.key} -> ${existing}`);
      continue;
    }

    const severity = getSeverity(issue);
    const mappedSeverity = jiraSeverity(severity);

    if (dryRun) {
      console.log(
        `[DRY RUN] Would create ${mappedSeverity.label} ticket for ${issue.key}`,
      );
      continue;
    }

    const key = await createTicket(issue, false);

    console.log(`Created ${jiraUrl}/browse/${key} for ${issue.key}`);

    created += 1;
  }

  console.log(`Created ${String(created)} Jira tickets`);
}

async function main(): Promise<void> {
  validateExecution();

  console.log(`Mode: ${testMode ? "TEMPLATE TEST" : "MAIN FINDINGS"}`);

  console.log(`Dry run: ${String(dryRun)}`);

  if (testMode) {
    await runTest();
    return;
  }

  await runProduction();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
