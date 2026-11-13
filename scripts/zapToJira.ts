import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Severity = "HIGH" | "MEDIUM";

type ZapInstance = {
  uri?: string;
  method?: string;
  param?: string;
  evidence?: string;
  otherinfo?: string;
};

type ZapAlert = {
  pluginid?: string;
  alertRef?: string;
  name?: string;
  alert?: string;
  riskcode?: string;
  riskdesc?: string;
  confidence?: string;
  desc?: string;
  solution?: string;
  reference?: string;
  cweid?: string;
  instances?: ZapInstance[];
};

type ZapReport = {
  site?: {
    "@name"?: string;
    alerts?: ZapAlert[];
  }[];
};

type JiraSearch = {
  issues?: {
    key: string;
    fields?: { labels?: string[] };
  }[];
  nextPageToken?: string;
};

type JiraUser = {
  accountId: string;
  displayName?: string;
  active?: boolean;
  accountType?: string;
};

type JiraCreated = { key: string };
type AdfNode = Record<string, unknown>;

type Finding = {
  fingerprint: string;
  service: string;
  alert: ZapAlert;
  severity: Severity;
  instances: ZapInstance[];
};

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const jiraUrl = required("JIRA_URL").replace(/\/$/, "");
const jiraEmail = required("JIRA_EMAIL");
const jiraToken = required("JIRA_API_TOKEN");

const jiraProject = "GUV";
const jiraEnvironment = "Staging";
const stakeholderName = "Richard Dunn";

const stakeholderAccountIdOverride =
  process.env.JIRA_STAKEHOLDER_ACCOUNT_ID?.trim();

const dryRun = process.env.DRY_RUN !== "false";
const maxTickets = 20;
const runnerTemp = required("RUNNER_TEMP");
const reportPath = process.env.ZAP_REPORT_PATH || "report_json.json";

const jiraAuth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString("base64");

const jiraFields = {
  source: "customfield_10545",
  severity: "customfield_10546",
  stakeholders: "customfield_10547",
  workstream: "customfield_10847",
  environment: "environment",
} as const;

const mappings: Record<
  Severity,
  {
    label: string;
    optionId: string;
    priorityId: string;
    days: number;
  }
> = {
  HIGH: {
    label: "High",
    optionId: "10137",
    priorityId: "2",
    days: 7,
  },
  MEDIUM: {
    label: "Medium",
    optionId: "10136",
    priorityId: "3",
    days: 15,
  },
};

function validateExecution(): void {
  if (process.env.GITHUB_ACTIONS !== "true") return;

  if (process.env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Jira integration must run on main");
  }

  if (
    process.env.GITHUB_EVENT_NAME !== "push" &&
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch"
  ) {
    throw new Error("Unsupported GitHub event for Jira integration");
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
    throw new Error(
      `Jira HTTP ${String(response.status)}: ${await response.text()}`,
    );
  }

  return response;
}

async function resolveStakeholderAccountId(): Promise<string> {
  if (stakeholderAccountIdOverride) {
    return stakeholderAccountIdOverride;
  }

  const url = new URL("/rest/api/3/user/search", `${jiraUrl}/`);

  url.searchParams.set("query", stakeholderName);
  url.searchParams.set("maxResults", "100");

  const response = await jiraRequest(`${url.pathname}${url.search}`);
  const users = (await response.json()) as JiraUser[];

  const matches = users.filter(
    (user) =>
      user.displayName?.trim().toLowerCase() ===
        stakeholderName.toLowerCase() &&
      user.active !== false &&
      user.accountType !== "app",
  );

  if (matches.length !== 1 || !matches[0]?.accountId) {
    throw new Error(
      `Expected one active Jira stakeholder named ${stakeholderName}; ` +
        `found ${String(matches.length)}. Set JIRA_STAKEHOLDER_ACCOUNT_ID.`,
    );
  }

  return matches[0].accountId;
}

function jiraLabel(fingerprint: string): string {
  const hash = createHash("sha256")
    .update(`zap:${fingerprint}`)
    .digest("hex")
    .slice(0, 24);

  return `zap-${hash}`;
}

async function existingTicket(label: string): Promise<string | undefined> {
  let nextPageToken: string | undefined;

  do {
    const url = new URL("/rest/api/3/search/jql", `${jiraUrl}/`);

    url.searchParams.set(
      "jql",
      `project = ${jiraProject} AND labels = "${label}"`,
    );

    url.searchParams.set("fields", "labels");
    url.searchParams.set("maxResults", "100");

    if (nextPageToken) {
      url.searchParams.set("nextPageToken", nextPageToken);
    }

    const response = await jiraRequest(`${url.pathname}${url.search}`);
    const data = (await response.json()) as JiraSearch;

    const found = data.issues?.find((issue) =>
      issue.fields?.labels?.includes(label),
    );

    if (found) return found.key;

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return undefined;
}

function plainText(value: string | undefined): string {
  return (value ?? "")
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
    content: [{ type: "text", text: value }],
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

function environmentAdf(value: string): {
  type: string;
  version: number;
  content: AdfNode[];
} {
  return {
    type: "doc",
    version: 1,
    content: [paragraph(value)],
  };
}

function serviceFromUri(uri: string): string | undefined {
  try {
    const segments = new URL(uri).pathname.split("/").filter(Boolean);

    if (segments[0] !== "app" || !segments[1]) {
      return undefined;
    }

    return segments[1];
  } catch {
    return undefined;
  }
}

function severityOf(alert: ZapAlert): Severity | undefined {
  if (alert.riskcode === "3") return "HIGH";
  if (alert.riskcode === "2") return "MEDIUM";

  return undefined;
}

function collectFindings(
  report: ZapReport,
  newFingerprints: Set<string>,
): Finding[] {
  const findings = new Map<string, Finding>();

  for (const site of report.site ?? []) {
    for (const alert of site.alerts ?? []) {
      const severity = severityOf(alert);

      if (!severity || !alert.pluginid) continue;

      for (const instance of alert.instances ?? []) {
        const service = instance.uri ? serviceFromUri(instance.uri) : undefined;

        if (!service) continue;

        const fingerprint = `${alert.pluginid}|${service}`;

        if (!newFingerprints.has(fingerprint)) continue;

        const existing = findings.get(fingerprint);

        if (existing) {
          existing.instances.push(instance);
        } else {
          findings.set(fingerprint, {
            fingerprint,
            service,
            alert,
            severity,
            instances: [instance],
          });
        }
      }
    }
  }

  return [...findings.values()].sort(
    (a, b) =>
      Number(b.alert.riskcode) - Number(a.alert.riskcode) ||
      a.fingerprint.localeCompare(b.fingerprint),
  );
}

function descriptionFor(finding: Finding): {
  type: string;
  version: number;
  content: AdfNode[];
} {
  const alert = finding.alert;
  const mapping = mappings[finding.severity];

  const endpoints = [
    ...new Set(
      finding.instances.map((instance) => {
        const method = instance.method ?? "UNKNOWN";
        const uri = instance.uri ? new URL(instance.uri) : undefined;

        return (
          `${method} ${uri?.origin ?? ""}${uri?.pathname ?? "unknown"}` +
          ` | Parameter: ${instance.param || "N/A"}`
        );
      }),
    ),
  ];

  const content: AdfNode[] = [
    heading("SOURCE"),
    bullet(
      `Scanner: OWASP ZAP DAST | Service: ${finding.service}` +
        ` | Environment: ${jiraEnvironment}`,
    ),

    divider(),

    heading("SINK"),
    ...endpoints.map(bullet),

    divider(),

    heading("Vulnerability Summary"),
    paragraph(
      `Severity: ${mapping.label} | Type: ` +
        (alert.name ?? alert.alert ?? "Unknown") +
        ` | ZAP plugin: ${alert.pluginid ?? "unknown"}`,
    ),
    paragraph(plainText(alert.desc) || "No description supplied by ZAP."),

    divider(),

    heading("Details"),
    paragraph(`Finding fingerprint: ${finding.fingerprint}`),
    paragraph(
      `Instances: ${String(finding.instances.length)}` +
        ` | Confidence: ${alert.confidence ?? "unknown"}` +
        ` | CWE: ${alert.cweid ?? "unknown"}`,
    ),

    ...finding.instances
      .slice(0, 20)
      .map((instance) =>
        paragraph(
          `Method: ${instance.method ?? "unknown"}` +
            ` | Parameter: ${instance.param ?? "N/A"}` +
            ` | Evidence: ${(instance.evidence || instance.otherinfo || "Not supplied").slice(0, 1500)}`,
        ),
      ),

    ...(finding.instances.length > 20
      ? [
          paragraph(
            `Additional instances omitted: ${String(finding.instances.length - 20)}`,
          ),
        ]
      : []),

    divider(),

    heading("Proposed Remediation"),
    paragraph(
      plainText(alert.solution) ||
        "Review the ZAP alert and determine an appropriate remediation.",
    ),

    ...(alert.reference
      ? [paragraph(`References: ${plainText(alert.reference)}`)]
      : []),

    paragraph(
      "Validate this scanner-reported finding before treating it as a confirmed vulnerability.",
    ),

    divider(),

    heading("DEFINITION OF DONE"),
    paragraph(
      "Finding triaged, remediated where confirmed, and verified with an authenticated DAST rescan.",
    ),
  ];

  return {
    type: "doc",
    version: 1,
    content,
  };
}

async function createTicket(
  finding: Finding,
  stakeholderAccountId: string,
): Promise<string> {
  const mapping = mappings[finding.severity];

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + mapping.days);

  const summary = (
    `[OWASP ZAP][${mapping.label}] ` +
    (finding.alert.name ?? finding.alert.alert ?? "Finding") +
    ` - ${finding.service}`
  ).slice(0, 255);

  const fields: Record<string, unknown> = {
    project: { key: jiraProject },
    issuetype: { name: "Task" },
    summary,
    labels: ["automated", "dast", jiraLabel(finding.fingerprint)],
    description: descriptionFor(finding),

    [jiraFields.source]: "OWASP ZAP DAST",

    [jiraFields.severity]: {
      id: mapping.optionId,
    },

    priority: {
      id: mapping.priorityId,
    },

    [jiraFields.environment]: environmentAdf(jiraEnvironment),

    [jiraFields.stakeholders]: [{ accountId: stakeholderAccountId }],

    [jiraFields.workstream]: {
      id: "10230",
    },

    duedate: due.toISOString().slice(0, 10),
  };

  const response = await jiraRequest("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  return ((await response.json()) as JiraCreated).key;
}

async function main(): Promise<void> {
  validateExecution();

  console.log(
    `ZAP Jira sync | dry run: ${String(dryRun)}` +
      ` | project: ${jiraProject} | workstream: Flex`,
  );

  const raw = await readFile(join(runnerTemp, "zap-findings-new.txt"), "utf8");

  const newFingerprints = new Set(
    raw
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (newFingerprints.size === 0) {
    console.log("No new ZAP fingerprints. No Jira tickets required.");
    return;
  }

  const report = JSON.parse(await readFile(reportPath, "utf8")) as ZapReport;

  const findings = collectFindings(report, newFingerprints);

  console.log(
    `New eligible Medium/High ZAP findings: ${String(findings.length)}`,
  );

  const matched = new Set(findings.map((finding) => finding.fingerprint));

  const unmatched = [...newFingerprints].filter(
    (fingerprint) => !matched.has(fingerprint),
  );

  if (unmatched.length > 0) {
    console.log(
      `Other new fingerprints (low/info or unmatched): ${unmatched.join(", ")}`,
    );
  }

  let created = 0;
  let stakeholderAccountId: string | undefined;

  for (const finding of findings) {
    const label = jiraLabel(finding.fingerprint);
    const existing = await existingTicket(label);

    if (existing) {
      console.log(`Already tracked: ${finding.fingerprint} -> ${existing}`);
      continue;
    }

    if (dryRun) {
      console.log(
        `[DRY RUN] Would create ${finding.severity} ticket: ` +
          `${finding.fingerprint} (${String(finding.instances.length)} instances), ` +
          "Workstream: Flex",
      );
      continue;
    }

    if (created >= maxTickets) {
      throw new Error(
        `Reached maximum ${String(maxTickets)} new tickets. ` +
          "Baseline must not advance until remaining findings are processed.",
      );
    }

    stakeholderAccountId ??= await resolveStakeholderAccountId();

    const key = await createTicket(finding, stakeholderAccountId);

    console.log(`Created ${jiraUrl}/browse/${key} for ${finding.fingerprint}`);

    created += 1;
  }

  console.log(`Created ${String(created)} Jira tickets`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
