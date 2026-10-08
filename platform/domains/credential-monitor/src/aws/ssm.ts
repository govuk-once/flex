import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const client = new SSMClient({});

export async function getParameterValue(name: string): Promise<string> {
  const response = await client.send(new GetParameterCommand({ Name: name }));
  const value = response.Parameter?.Value;

  if (value === undefined) {
    throw new Error(`Parameter ${name} has no value`);
  }

  return value;
}
