from checkov.common.models.enums import CheckResult, CheckCategories
from checkov.cloudformation.checks.resource.base_resource_check import BaseResourceCheck

class RequireTags(BaseResourceCheck):
    def __init__(self):
        name = "Ensure all resources have required tags: Environment,  Project"
        id = "CKV_AWS_CUSTOM_TAGS"

        # Resources that DON'T support tags - we'll skip these
        self.skip_resources = [
            'AWS::IAM::Role',
            'AWS::IAM::Policy',
            'AWS::IAM::User',
            'AWS::IAM::Group',
            'AWS::IAM::InstanceProfile',
            'AWS::Lambda::Permission',
            'AWS::Logs::LogGroup',
            'AWS::Logs::LogStream',
            'AWS::CloudFormation::Stack',
            'AWS::Route53::HostedZone',
            'AWS::Route53::RecordSet',
            'AWS::CloudWatch::Alarm',
            'AWS::SNS::Subscription',
            'AWS::SQS::QueuePolicy',
            'AWS::S3::BucketPolicy',
            'AWS::Lambda::EventSourceMapping',
            'AWS::Events::Rule',
            'AWS::CloudWatch::LogGroup',
        ]

        # Check all AWS resources by default
        supported_resources = ['AWS::*']
        categories = [CheckCategories.CONVENTION]
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf, entity_type=None):
        # Skip resources that don't support tags
        if entity_type and entity_type in self.skip_resources:
            return CheckResult.PASSED

        required_tags = ['Environment', 'Project']

        # Get tags from Properties
        properties = conf.get('Properties', {})
        tags = properties.get('Tags', [])

        # Handle empty tags
        if not tags:
            return CheckResult.FAILED

        # Extract tag keys
        tag_keys = [tag.get('Key') for tag in tags if isinstance(tag, dict)]

        # Check for missing required tags
        missing = [tag for tag in required_tags if tag not in tag_keys]

        if missing:
            return CheckResult.FAILED

        return CheckResult.PASSED

check = RequireTags()
