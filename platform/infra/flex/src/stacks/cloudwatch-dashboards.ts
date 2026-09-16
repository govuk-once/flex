import fs from "node:fs";
import path from "node:path";

import { getEnvConfig } from "@flex/utils";
import { CfnDashboard } from "aws-cdk-lib/aws-cloudwatch";
import type { Construct } from "constructs";

import { BaseStack } from "../base";

const { env } = getEnvConfig();

export class FlexCloudWatchDashboardsStack extends BaseStack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: { region: "eu-west-2" },
    });

    const dashboardsDir = path.join(import.meta.dirname, "../dashboards");

    const drivingDashboard: unknown = JSON.parse(
      fs.readFileSync(
        path.join(dashboardsDir, "drivingDashboard.json"),
        "utf-8",
      ),
    );

    new CfnDashboard(this, "DrivingDashboard", {
      dashboardName: `${env}-flex-driving-dashboard`,
      dashboardBody: JSON.stringify(drivingDashboard),
    });
  }
}
