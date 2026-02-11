import {
  InterfaceVpcEndpointAwsService,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";

function addVpcEndpoint({
  name,
  vpc,
  service,
  securityGroup,
  subnetType,
  allowIngressFromIsolatedSubnets = false,
}: {
  name: string;
  vpc: Vpc;
  service: InterfaceVpcEndpointAwsService;
  securityGroup: SecurityGroup;
  subnetType?: SubnetType;
  allowIngressFromIsolatedSubnets?: boolean;
}) {
  const endpoint = vpc.addInterfaceEndpoint(name, {
    service,
    privateDnsEnabled: true,
    subnets: { subnetType },
  });

  for (const { securityGroupId } of endpoint.connections.securityGroups) {
    securityGroup.addEgressRule(
      Peer.securityGroupId(securityGroupId),
      Port.tcp(443),
      "Allow HTTPS to VPC endpoint",
    );
  }

  if (allowIngressFromIsolatedSubnets) {
    for (const endpointSg of endpoint.connections.securityGroups) {
      for (const subnet of vpc.isolatedSubnets) {
        endpointSg.addIngressRule(
          Peer.ipv4(subnet.ipv4CidrBlock),
          Port.tcp(443),
          "Allow HTTPS from isolated subnet",
        );
      }
    }
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
    subnetType: SubnetType.PRIVATE_ISOLATED,
    allowIngressFromIsolatedSubnets: true,  // only ApiGateway needs this
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
    subnetType: SubnetType.PRIVATE_ISOLATED,
  });

  return {
    apiGatewayEndpoint,
    cloudwatchEndpoint,
    secretsManagerEndpoint,
    ssmEndpoint,
    stsEndpoint
  };
}
