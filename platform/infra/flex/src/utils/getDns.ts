import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { sanitiseStageName } from "@flex/utils";

export async function getDns(): Promise<{
  prefix: string | undefined;
  domainName: string;
}> {
  let domainName: string;
  let prefix: string | undefined;

  /** Get subdomain prefix for local dev dns names */
  if (!process.env.STAGE) {
    prefix = sanitiseStageName(process.env.USER);
  } else if (process.env.STAGE.startsWith("pr-")) {
    prefix = sanitiseStageName(process.env.STAGE);
  }

  /** Fetch dns name from parameter store */
  try {
    const response = await new SSMClient().send(
      new GetParameterCommand({
        Name: "/infra/dns/hostedzonename",
      }),
    );

    if (!response.Parameter?.Value) {
      throw new Error("Parameter is emtpy");
    }
    domainName = response.Parameter.Value;
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  return {
    prefix,
    domainName,
  };
}
