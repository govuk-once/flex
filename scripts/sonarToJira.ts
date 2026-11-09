import { createHash } from "node:crypto";

type SonarImpact = {
  softwareQuality: string;
  severity: string;
};

type SonarIssue = {
  key: string;
  message: string;
  component: string;
  line?: number;
  rule?: string;
  impacts?: SonarImpact[];
};

type SonarResponse = {
  total: number;
  issues: SonarIssue[];
};

type JiraIssue = {
  key: string;
  fields: {
    labels?: string[];
  };
};

type JiraSearchResponse = {
  issues: JiraIssue[];
};

type JiraCreateResponse = {
  key: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const sonarUrl = requiredEnv("SONAR_URL").replace(/\/$/, "");
const sonarToken = requiredEnv("SONAR_TOKEN_FLEX");

const jiraUrl = requiredEnv("JIRA_URL").replace(/\/$/, "");
const jiraEmail = requiredEnv("JIRA_EMAIL");
const jiraToken = requiredEnv("JIRA_API_TOKEN");

const organization = "govuk-once";
const sonarProject = "govuk-once_flex";
const jiraProject = "GUV";

const maxTicketsPerRun = 5;
const dryRun = process.env.DRY_RUN === "false";

const jiraAuth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString("base64");

function validateExecution(): void {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const ref = process.env.GITHUB_REF;

  if (process.env.GITHUB_ACTIONS === "true") {
    if (eventName !== "push" || ref !== "refs/heads/main") {
      throw new Error("Jira ticket creation is only permitted on push to main");
    }
  }
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
    const body = await response.text();

    throw new Error(`Jira API HTTP ${String(response.status)}: ${body}`);
  }

  return response;
}

async function getFindings(): Promise<SonarIssue[]> {
  const findings: SonarIssue[] = [];

  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = new URL("/api/issues/search", `${sonarUrl}/`);

    url.searchParams.set("organization", organization);
    url.searchParams.set("componentKeys", sonarProject);
    url.searchParams.set("impactSoftwareQualities", "SECURITY");
    url.searchParams.set("impactSeverities", "HIGH,BLOCKER");
    url.searchParams.set("branch", "main");
    url.searchParams.set("ps", "100");
    url.searchParams.set("p", String(page));

    console.log(`Fetching SonarCloud findings - page ${String(page)}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sonarToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `SonarCloud API HTTP ${String(response.status)}: ${body}`,
      );
    }

    const data = (await response.json()) as SonarResponse;

    findings.push(...data.issues);

    console.log(
      `Page ${String(page)}: retrieved ${String(data.issues.length)} findings`,
    );

    hasMorePages = findings.length < data.total && data.issues.length > 0;

    page += 1;
  }

  return findings;
}

function issueLabel(issueKey: string): string {
  const hash = createHash("sha256")
    .update(`${sonarProject}:${issueKey}`)
    .digest("hex")
    .slice(0, 24);

  return `sonar-${hash}`;
}

async function findExistingTicket(label: string): Promise<string | undefined> {
  const jql = `project = ${jiraProject} AND labels = "${label}"`;

  const url = new URL("/rest/api/3/search/jql", `${jiraUrl}/`);

  url.searchParams.set("jql", jql);
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("fields", "labels");

  const response = await jiraRequest(`${url.pathname}${url.search}`);

  const data = (await response.json()) as JiraSearchResponse;

  const existing = data.issues.find((issue) =>
    issue.fields.labels?.includes(label),
  );

  return existing?.key;
}

function getSeverity(issue: SonarIssue): string {
  return (
    issue.impacts
      ?.filter((impact) => impact.softwareQuality === "SECURITY")
      .map((impact) => impact.severity)
      .join(", ") || "UNKNOWN"
  );
}

async function createTicket(issue: SonarIssue): Promise<string> {
  const severity = getSeverity(issue);
  const label = issueLabel(issue.key);

  const description = [
    "SonarCloud security finding",
    "",
    `SonarCloud issue key: ${issue.key}`,
    `Organization: ${organization}`,
    `Project: ${sonarProject}`,
    "Branch: main",
    `Severity: ${severity}`,
    `Component: ${issue.component}`,
    `Line: ${String(issue.line ?? "N/A")}`,
    `Rule: ${issue.rule ?? "N/A"}`,
    "",
    `Finding: ${issue.message}`,
    "",
    "Review and remediate this finding in SonarCloud.",
  ].join("\n");

  const payload = {
    fields: {
      project: {
        key: jiraProject,
      },
      issuetype: {
        name: "Task",
      },
      summary: `[SonarCloud][${severity}] ${issue.message}`.slice(0, 255),
      labels: ["sonarcloud", "security", "automated", label],
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: description,
              },
            ],
          },
        ],
      },
    },
  };

  const response = await jiraRequest("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as JiraCreateResponse;

  return result.key;
}

async function main(): Promise<void> {
  validateExecution();

  console.log("SonarCloud to Jira integration");
  console.log(`SonarCloud project: ${sonarProject}`);
  console.log(`Jira project: ${jiraProject}`);
  console.log("Branch: main");
  console.log(`Dry run: ${String(dryRun)}`);

  const findings = await getFindings();

  console.log(`HIGH/BLOCKER security findings: ${String(findings.length)}`);

  let created = 0;
  let existing = 0;
  let wouldCreate = 0;

  for (const issue of findings) {
    const label = issueLabel(issue.key);
    const existingTicket = await findExistingTicket(label);

    if (existingTicket) {
      console.log(`Existing ticket ${existingTicket} for ${issue.key}`);
      existing += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would create ticket for ${issue.key}`);
      wouldCreate += 1;
      continue;
    }

    if (created >= maxTicketsPerRun) {
      console.log(
        `Ticket creation limit reached (${String(maxTicketsPerRun)})`,
      );
      break;
    }

    const ticketKey = await createTicket(issue);

    console.log(`Created Jira ticket: ${jiraUrl}/browse/${ticketKey}`);

    created += 1;
  }

  console.log(
    `Completed. Created: ${String(created)}, existing: ${String(existing)}, would create: ${String(wouldCreate)}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
