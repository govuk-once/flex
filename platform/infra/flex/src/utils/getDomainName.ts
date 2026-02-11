import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { getEnvConfig } from "@platform/gov-uk-once";

const hostedZoneParamName = "/infra/dns/hostedzonename";

export async function getDomainName() {
  const { Parameter } = await new SSMClient().send(
    new GetParameterCommand({ Name: hostedZoneParamName }),
  );

  if (!Parameter?.Value) {
    console.error("Parameter not found:", hostedZoneParamName);
    process.exit(1);
  }

  const { persistent, stage } = getEnvConfig();
  const domainName = Parameter.Value;

  return {
    subdomainName: persistent ? undefined : `${stage}.${domainName}`,
    domainName,
  };
}
