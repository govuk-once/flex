import { CustomResource, Duration } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Provider } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

const createTimeoutFn = (seconds: number) => `
exports.handler = async (event) => {
  if (event.RequestType === "Delete") {
    return { PhysicalResourceId: event.PhysicalResourceId };
  }
  await new Promise((r) => setTimeout(r, ${String(seconds * 1000)}));
  return { PhysicalResourceId: "pause" };
};
`;

export class CfnPause extends Construct {
  public readonly resource: CustomResource;

  constructor(scope: Construct, id: string, seconds: number) {
    super(scope, id);

    const fn = new Function(this, "Fn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      timeout: Duration.seconds(seconds + 10),
      code: Code.fromInline(createTimeoutFn(seconds)),
    });

    const provider = new Provider(this, "Provider", {
      onEventHandler: fn,
    });

    this.resource = new CustomResource(this, "Wait", {
      serviceToken: provider.serviceToken,
      properties: { timestamp: Date.now().toString() },
    });
  }
}
