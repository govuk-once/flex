export const SUPPORTED_NAMESPACES = [
  "AWS/AIDevOps",
  "AWS/AOSS",
  "AWS/ApiGateway",
  "AWS/AppFlow",
  "AWS/AppStream",
  "AWS/AppSync",
  "AWS/ApplicationELB",
  "AWS/Athena",
  "AWS/AutoScaling",
  "AWS/Backup",
  "AWS/Bedrock",
  "AWS/BedrockMantle",
  "AWS/ClientVPN",
  "AWS/CloudFront",
  "AWS/CloudWatch/MetricStreams",
  "AWS/CodeGuruProfiler",
  "AWS/Cognito",
  "AWS/Connect",
  "AWS/DAX",
  "AWS/DX",
  "AWS/DataSync",
  "AWS/DocDB",
  "AWS/DocDB-Elastic",
  "AWS/DynamoDB",
  "AWS/EBS",
  "AWS/EC2",
  "AWS/EC2CapacityReservations",
  "AWS/EFS",
  "AWS/EKS",
  "AWS/ELB",
  "AWS/EMRServerless",
  "AWS/ES",
  "AWS/ElastiCache",
  "AWS/ElasticBeanstalk",
  "AWS/ElasticMapReduce",
  "AWS/EventBridge/Pipes",
  "AWS/Events",
  "AWS/FSx",
  "AWS/Firehose",
  "AWS/FraudDetector",
  "AWS/GameLift",
  "AWS/GatewayELB",
  "AWS/IVSChat",
  "AWS/IoT",
  "AWS/KMS",
  "AWS/Kafka",
  "AWS/Kendra",
  "AWS/Kinesis",
  "AWS/KinesisAnalytics",
  "AWS/Lambda",
  "AWS/M2",
  "AWS/MWAA",
  "AWS/MediaTailor",
  "AWS/MemoryDB",
  "AWS/NATGateway",
  "AWS/NetworkELB",
  "AWS/NetworkFirewall",
  "AWS/Pinpoint",
  "AWS/Prometheus",
  "AWS/RDS",
  "AWS/RUM",
  "AWS/Redshift",
  "AWS/Redshift-Serverless",
  "AWS/Route53",
  "AWS/Route53Resolver",
  "AWS/S3",
  "AWS/SNS",
  "AWS/SQS",
  "AWS/SWF",
  "AWS/SageMaker",
  "AWS/Scheduler",
  "AWS/Transfer",
  "AWS/TransitGateway",
  "AWS/VPN",
  "AWS/VpcLattice",
  "AWS/WorkSpaces",
];

export const SCOPED_NAMESPACES = ["AWS/Lambda", "AWS/ApiGateway"];

export const ENRICHMENT_MODES = ["all", "scoped"] as const;

export type EnrichmentMode = (typeof ENRICHMENT_MODES)[number];

export interface MetricSelector {
  Namespace: string;
  MetricNames?: string[];
}

export function includeFiltersFor(mode: EnrichmentMode): MetricSelector[] {
  return mode === "scoped"
    ? SCOPED_NAMESPACES.map((namespace) => ({ Namespace: namespace }))
    : [];
}

export function namespacesFor(mode: EnrichmentMode): string[] {
  return mode === "scoped" ? SCOPED_NAMESPACES : SUPPORTED_NAMESPACES;
}
