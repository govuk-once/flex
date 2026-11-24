import { CfnOutput } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import type { Construct } from "constructs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInfra } from "../__tests__/load-infra";

const TAGS = {
  Product: "GOV.UK",
  System: "FLEX",
  Owner: "N/A",
  ResourceOwner: "flex-platform",
};

async function synthesise() {
  const { SsmApp } = await loadInfra("staging");
  const { BaseStack } = await import(".");

  class ExportingStack extends BaseStack {
    constructor(scope: Construct, id: string) {
      super(scope, id, { env: { region: "eu-west-2" }, tags: TAGS });
      this.exports({ "/test/used": "a", "/test/unused": "b" });
    }
  }

  class ImportingStack extends BaseStack {
    constructor(scope: Construct, id: string) {
      super(scope, id, { env: { region: "eu-west-2" }, tags: TAGS });
      new CfnOutput(this, "Used", { value: this.import("/test/used") });
      this.import("/test/unused");
    }
  }

  const app = new SsmApp();
  const exporting = new ExportingStack(app, "staging-Exporting");
  const importing = new ImportingStack(app, "staging-Importing");

  return { exporting, importing, template: Template.fromStack(importing) };
}

describe("BaseStack.import", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only creates SSM parameters for imports the template uses", async () => {
    const { template } = await synthesise();
    const parameters = Object.entries(
      template.toJSON().Parameters as Record<string, { Default?: string }>,
    )
      .map(([, { Default }]) => Default)
      .filter((name) => name?.startsWith("/test/"));

    expect(parameters).toEqual(["/test/used"]);
    template.hasOutput("Used", {
      Value: { Ref: Match.stringLikeRegexp("^SsmParameterValuetestused") },
    });
  });

  it("still makes the importing stack depend on the exporting stack", async () => {
    const { exporting, importing } = await synthesise();

    expect(importing.dependencies).toContain(exporting);
  });
});
