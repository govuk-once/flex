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

type AnalysisTarget = {
  parameter: string;
  value: string;
  label: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const sonarUrl = requiredEnv("SONAR_URL").replace(/\/$/, "");
const sonarToken = requiredEnv("SONAR_TOKEN_FLEX");
const projectKey = "govuk-once_flex";

function getAnalysisTarget(): AnalysisTarget {
  const eventType = process.env.GITHUB_EVENT_NAME ?? "push";

  if (eventType === "pull_request") {
    const prNumber = requiredEnv("PR_NUMBER");

    return {
      parameter: "pullRequest",
      value: prNumber,
      label: `PR #${prNumber}`,
    };
  }

  return {
    parameter: "branch",
    value: "main",
    label: "main",
  };
}

async function getFindings(target: AnalysisTarget): Promise<SonarIssue[]> {
  const findings: SonarIssue[] = [];

  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = new URL("/api/issues/search", `${sonarUrl}/`);

    url.searchParams.set("componentKeys", projectKey);
    url.searchParams.set("impactSoftwareQualities", "SECURITY");
    url.searchParams.set("impactSeverities", "HIGH,BLOCKER");
    url.searchParams.set("ps", "100");
    url.searchParams.set("p", String(page));
    url.searchParams.set(target.parameter, target.value);

    console.log(`Requesting SonarCloud findings - page ${String(page)}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sonarToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `SonarCloud API returned HTTP ${String(response.status)}: ${errorBody}`,
      );
    }

    const data = (await response.json()) as SonarResponse;

    findings.push(...data.issues);

    console.log(
      `Page ${String(page)}: retrieved ${String(data.issues.length)} issues`,
    );

    hasMorePages = findings.length < data.total && data.issues.length > 0;

    page += 1;
  }

  return findings;
}

async function main(): Promise<void> {
  const target = getAnalysisTarget();

  console.log(`Project: ${projectKey}`);
  console.log(`Analysis: ${target.label}`);

  const findings = await getFindings(target);

  console.log(
    `Total High/Blocker security findings: ${String(findings.length)}`,
  );

  for (const issue of findings) {
    const severity =
      issue.impacts
        ?.filter((impact) => impact.softwareQuality === "SECURITY")
        .map((impact) => impact.severity)
        .join(", ") || "UNKNOWN";

    console.log(
      JSON.stringify(
        {
          sonarIssueKey: issue.key,
          summary: issue.message,
          severity,
          component: issue.component,
          line: issue.line ?? null,
          rule: issue.rule ?? null,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
