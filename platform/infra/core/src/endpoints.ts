import {
  InterfaceVpcEndpointAwsService,
  Peer,
  Port,
  SecurityGroup,
  Vpc,
} from "aws-cdk-lib/aws-ec2";

function addVpcEndpoint({
  name,
  vpc,
  service,
  securityGroup,
}: {
  name: string;
  vpc: Vpc;
  service: InterfaceVpcEndpointAwsService;
  securityGroup: SecurityGroup;
}) {
  const endpoint = vpc.addInterfaceEndpoint(name, {
    service,
    privateDnsEnabled: true,
  });

  for (const { securityGroupId } of endpoint.connections.securityGroups) {
    securityGroup.addEgressRule(
      Peer.securityGroupId(securityGroupId),
      Port.tcp(443),
      "Allow HTTPS to VPC endpoint",
    );
  }

  return endpoint;
}

export function addVpcEndpoints({
  vpc,
  securityGroup,
}: {
  vpc: Vpc;
  securityGroup: SecurityGroup;
}) {
  const apiGatewayEndpoint = addVpcEndpoint({
    vpc,
    name: "ApiGateway",
    service: InterfaceVpcEndpointAwsService.APIGATEWAY,
    securityGroup,
  });

  const cloudwatchEndpoint = addVpcEndpoint({
    vpc,
    name: "CloudWatchLogs",
    service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    securityGroup,
  });

  const secretsManagerEndpoint = addVpcEndpoint({
    vpc,
    name: "SecretsManager",
    service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    securityGroup,
  });

  const ssmEndpoint = addVpcEndpoint({
    vpc,
    name: "SSM",
    service: InterfaceVpcEndpointAwsService.SSM,
    securityGroup,
  });

  const stsEndpoint = addVpcEndpoint({
    vpc,
    name: "STS",
    service: InterfaceVpcEndpointAwsService.STS,
    securityGroup,
  });

  return {
    apiGatewayEndpoint,
    cloudwatchEndpoint,
    secretsManagerEndpoint,
    ssmEndpoint,
    stsEndpoint,
  };
}
