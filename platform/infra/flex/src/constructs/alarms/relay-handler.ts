export const RELAY_HANDLER_CODE = `
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const client = new SNSClient({ region: "eu-west-2" });
exports.handler = async (event) => {
  await Promise.all(
    (event.Records ?? []).map((record) =>
      client.send(new PublishCommand({
        TopicArn: process.env.TARGET_TOPIC_ARN,
        Subject: record.Sns.Subject?.slice(0, 100),
        Message: record.Sns.Message,
      })),
    ),
  );
};
`;
