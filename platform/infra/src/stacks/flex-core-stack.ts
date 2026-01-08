import type { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';

import { getEnvConfig, GovUkOnceStack } from './gov-uk-once-stack';
import * as nf from 'aws-cdk-lib/aws-networkfirewall';

const envConfig = getEnvConfig();

function applyEgressRuleForVpcEndpoint(
  securityGroup: ec2.SecurityGroup,
  endpoint: ec2.InterfaceVpcEndpoint,
) {
  for (const { securityGroupId } of endpoint.connections.securityGroups) {
    securityGroup.addEgressRule(
      ec2.Peer.securityGroupId(securityGroupId),
      ec2.Port.tcp(443),
      'Allow HTTPS to VPC endpoint',
    );
  }
}

function generateParamName(name: string) {
  return `/${envConfig.environment}/flex${name}`;
}

function getSubnetIds(vpc: ec2.Vpc, subnetType: ec2.SubnetType) {
  return vpc.selectSubnets({ subnetType }).subnetIds;
}

export class FlexCoreStack extends GovUkOnceStack {
  private createVpc({ enableNat }: { enableNat: boolean }) {
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: enableNat ? 3 : 0,
      availabilityZones: ['eu-west-2a', 'eu-west-2b', 'eu-west-2c'],
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'PrivateEgress',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 19,
        },
        {
          name: 'PrivateIsolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 19,
        },
      ],
    });

    return vpc;
  }

  private createSecurityGroups(vpc: ec2.Vpc) {
    const privateEgress = new ec2.SecurityGroup(this, 'PrivateEgress', {
      vpc,
      description: 'SecurityGroup with allow outbound',
      allowAllOutbound: true,
    });

    const privateIsolated = new ec2.SecurityGroup(this, 'PrivateIsolated', {
      vpc,
      description: 'SecurityGroup with deny outbound',
      allowAllOutbound: false,
    });

    return {
      privateEgress,
      privateIsolated,
    };
  }

  private addVpcEndpoints(vpc: ec2.Vpc, sg: ec2.SecurityGroup) {
    const cloudwatchEndpoint = vpc.addInterfaceEndpoint('CloudWatchLogs', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      privateDnsEnabled: true,
    });
    applyEgressRuleForVpcEndpoint(sg, cloudwatchEndpoint);
  }

  private exportOutputsToSsm(
    vpc: ec2.Vpc,
    sgs: ReturnType<typeof this.createSecurityGroups>,
  ) {
    new ssm.StringParameter(this, 'VpcId', {
      parameterName: generateParamName('/vpc/id'),
      stringValue: vpc.vpcId,
    });

    new ssm.StringParameter(this, 'PrivateEgressSubnets', {
      parameterName: generateParamName('/network/subnets/private-egress'),
      stringValue: getSubnetIds(vpc, ec2.SubnetType.PRIVATE_WITH_EGRESS).join(
        ',',
      ),
    });

    new ssm.StringParameter(this, 'PrivateIsolatedSubnets', {
      parameterName: generateParamName('/network/subnets/private-isolated'),
      stringValue: getSubnetIds(vpc, ec2.SubnetType.PRIVATE_ISOLATED).join(','),
    });

    new ssm.StringParameter(this, 'PrivateEgressSg', {
      parameterName: generateParamName('/network/sg/private-egress'),
      stringValue: sgs.privateEgress.securityGroupId,
    });

    new ssm.StringParameter(this, 'PrivateIsolatedSg', {
      parameterName: generateParamName('/network/sg/private-isolated'),
      stringValue: sgs.privateIsolated.securityGroupId,
    });
  }

  constructor(
    scope: Construct,
    { id, enableNat }: { id: string; enableNat: boolean },
  ) {
    super(scope, id, {
      env: {
        region: 'eu-west-2',
      },
      tags: {
        Product: 'GOV.UK',
        System: 'FLEX',
        Owner: '',
        Source: 'https://github.com/govuk-once/flex',
      },
    });

    this.terminationProtection = true;

    const vpc = this.createVpc({ enableNat });
    const sgs = this.createSecurityGroups(vpc);
    this.addVpcEndpoints(vpc, sgs.privateIsolated);
    this.exportOutputsToSsm(vpc, sgs);
  }
}
