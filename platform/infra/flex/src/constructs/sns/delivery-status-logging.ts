import { getEnvConfig } from "@flex/utils";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { type LoggingProtocol, Topic } from "aws-cdk-lib/aws-sns";

const { persistent } = getEnvConfig();

const SUCCESS_SAMPLE_PERCENTAGE = 100;

export function enableDeliveryStatusLogging(
  topic: Topic,
  protocol: LoggingProtocol,
) {
  const { region, account } = Stack.of(topic);
  const successLogGroupName = `sns/${region}/${account}/${topic.topicName}`;

  const feedbackRole = new Role(topic, "DeliveryStatusLoggingRole", {
    assumedBy: new ServicePrincipal("sns.amazonaws.com"),
    description: "Lets SNS write delivery status logs for one topic",
  });

  [
    { id: "DeliverySuccessLogGroup", logGroupName: successLogGroupName },
    {
      id: "DeliveryFailureLogGroup",
      logGroupName: `${successLogGroupName}/Failure`,
    },
  ].forEach(({ id, logGroupName }) => {
    new LogGroup(topic, id, {
      logGroupName,
      retention: RetentionDays.ONE_YEAR,
      removalPolicy: persistent ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    }).grantWrite(feedbackRole);
  });

  topic.addLoggingConfig({
    protocol,
    failureFeedbackRole: feedbackRole,
    successFeedbackRole: feedbackRole,
    successFeedbackSampleRate: SUCCESS_SAMPLE_PERCENTAGE,
  });
}
