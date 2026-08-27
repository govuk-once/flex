import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnCustomDataIdentifier, CfnSession } from "aws-cdk-lib/aws-macie";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
  PhysicalResourceIdReference,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

import { BaseStack } from "../base";
import { MacieResultsBucket } from "../constructs/macie/MacieResultsBucket";
import { macieCoverage } from "../macie-coverage";

export interface FlexMacieStackProps {
  readonly accessLogBucketName: string;
}

export class FlexMacieStack extends BaseStack {
  constructor(scope: Construct, id: string, props: FlexMacieStackProps) {
    super(scope, id, {
      tags: {
        Product: "GOV.UK",
        System: "FLEX",
        Owner: "N/A",
        ResourceOwner: "flex-platform",
        Source: "https://github.com/govuk-once/flex",
      },
      env: {
        region: "us-east-1",
      },
    });

    const session = new CfnSession(this, "MacieSession", {
      status: "ENABLED",
      findingPublishingFrequency: "FIFTEEN_MINUTES",
    });

    // Periodic, scoped scanning only. Turn off continuous automated
    // sensitive-data discovery so Macie does not sample the public specs,
    // ephemeral per-PR buckets and logs on a rolling basis (cost and noise,
    // and against AWS guidance for log buckets). The scheduled job below is
    // the single, deliberate scan.
    const disableAutomatedDiscoveryCall = {
      service: "macie2",
      action: "updateAutomatedDiscoveryConfiguration",
      parameters: { status: "DISABLED" },
      physicalResourceId: PhysicalResourceId.of(
        `flex-macie-automated-discovery-${this.account}-${this.region}`,
      ),
    };

    const disableAutomatedDiscovery = new AwsCustomResource(
      this,
      "DisableAutomatedDiscovery",
      {
        onCreate: disableAutomatedDiscoveryCall,
        onUpdate: disableAutomatedDiscoveryCall,
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            actions: ["macie2:UpdateAutomatedDiscoveryConfiguration"],
            resources: ["*"],
          }),
        ]),
      },
    );
    disableAutomatedDiscovery.node.addDependency(session);

    const customDataIdentifierIds = macieCoverage.customDataIdentifiers.map(
      (identifier) => {
        const cdi = new CfnCustomDataIdentifier(
          this,
          `CustomIdentifier-${identifier.name}`,
          {
            name: identifier.name,
            description: identifier.description,
            regex: identifier.regex,
          },
        );
        cdi.node.addDependency(session);
        return cdi.attrId;
      },
    );

    const results = new MacieResultsBucket(this, "Results");

    const exportCall = {
      service: "macie2",
      action: "putClassificationExportConfiguration",
      parameters: {
        configuration: {
          s3Destination: {
            bucketName: results.bucket.bucketName,
            keyPrefix: "macie-results/",
            kmsKeyArn: results.key.keyArn,
          },
        },
      },
      physicalResourceId: PhysicalResourceId.of(
        `flex-macie-export-${this.account}-${this.region}`,
      ),
    };

    const exportConfig = new AwsCustomResource(this, "ExportConfig", {
      onCreate: exportCall,
      onUpdate: exportCall,
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["macie2:PutClassificationExportConfiguration"],
          resources: ["*"],
        }),
      ]),
    });
    exportConfig.node.addDependency(session);
    exportConfig.node.addDependency(results.bucket);

    // Macie classification jobs have no CloudFormation resource, so the
    // scheduled job is created through the Macie API. It is a weekly scoped
    // scan over the CloudFront access-log bucket only, using the recommended
    // managed data identifiers plus any custom identifiers registered above.
    const scanJob = new AwsCustomResource(this, "AccessLogScanJob", {
      onCreate: {
        service: "macie2",
        action: "createClassificationJob",
        parameters: {
          name: `flex-access-log-scan-${this.region}`,
          description:
            "Weekly scoped scan of the CloudFront access-log bucket for sensitive data",
          jobType: "SCHEDULED",
          initialRun: true,
          samplingPercentage: 100,
          managedDataIdentifierSelector: "RECOMMENDED",
          clientToken: `flex-access-log-scan-${this.account}-${this.region}`,
          scheduleFrequency: {
            weeklySchedule: { dayOfWeek: "MONDAY" },
          },
          s3JobDefinition: {
            bucketDefinitions: [
              {
                accountId: this.account,
                buckets: [props.accessLogBucketName],
              },
            ],
          },
          ...(customDataIdentifierIds.length > 0
            ? { customDataIdentifierIds }
            : {}),
        },
        physicalResourceId: PhysicalResourceId.fromResponse("jobId"),
      },
      onDelete: {
        service: "macie2",
        action: "updateClassificationJob",
        parameters: {
          jobId: new PhysicalResourceIdReference(),
          jobStatus: "CANCELLED",
        },
        ignoreErrorCodesMatching:
          "ValidationException|ResourceNotFoundException|ConflictException",
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ["macie2:CreateClassificationJob"],
          resources: ["*"],
        }),
        new PolicyStatement({
          actions: ["macie2:UpdateClassificationJob"],
          resources: [
            `arn:${this.partition}:macie2:${this.region}:${this.account}:classification-job/*`,
          ],
        }),
      ]),
    });
    scanJob.node.addDependency(session);
    scanJob.node.addDependency(disableAutomatedDiscovery);
    scanJob.node.addDependency(exportConfig);
  }
}
