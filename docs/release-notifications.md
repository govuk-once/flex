# Release Notifications and Alerting

This document describes how release notifications are delivered from the CI pipeline into Slack, and it sets out, in broad strokes, how a comparable arrangement could be built without too many assumptions of the project's set up. It is concerned specifically with the outbound notification path, i.e. the route by which a build announces itself to a chat channel; it is not a guide to the alarms a running service emits, nor to the release and versioning logic itself, which is documented separately. The concrete examples are drawn from the Flex service, but the intention is to explain the shape of the system rather than to reproduce every value specific to Flex, so the examples below should be read as patterns to adapt and not as configuration to copy verbatim.

---

## The Components Involved

The system is best understood as a chain of four parts, each of which hands off to the next, so that the failure or absence of any one of them means the message does not arrive rather than the build breaking:

1. **A CI job** that decides a notification is warranted and composes its contents.
2. **An Amazon SNS topic** that receives the composed message.
3. **Amazon Q** which subscribes to that topic and relays its messages.
4. **A Slack channel** mapped to that relay, in which the message appears.

Note: nothing in this chain is bespoke to Flex beyond the CI job at the front of it. The middle two parts, the topic and the relay, are stock AWS services wired together in the ordinary way. The value of this setup is that it allows easy self service for the team without having to create Slack applications or webhooks.

---

## How the Message Travels

On a qualifying release, the CI job (in Flex, the `Release` job of the Continuous Deployment pipeline) performs the following, in order:

1. It assumes a short lived AWS role by means of OIDC, so that no static credentials are held in the CI system.
2. It gathers the material for the message, which here means reading the generated release notes for the new version.
3. It resolves the address of the SNS topic. In Flex the topic ARN is held in Parameter Store and read at runtime, though that indirection is a convenience and not a requirement (see the note below).
4. It composes a JSON payload in the **custom notification** format that Amazon Q understands, carrying a title and a Markdown description.
5. It publishes that payload to the topic.

The custom format is the part most worth understanding, since it is what distinguishes this kind of message from the alarm notifications a project more usually sends. The payload looks roughly like this:

```json
{
  "version": "1.0",
  "source": "custom",
  "content": {
    "textType": "client-markdown",
    "title": "Service minor release: v1.2.0",
    "description": "...release notes, followed by a link..."
  }
}
```

The `source: "custom"` marker is what tells Amazon Q that the payload is an arbitrary human authored message to be rendered as given, rather than a structured event from an AWS service that it should parse and lay out itself.

---

## Setting Up an Equivalent

The following describes, at a level general enough to suit a project not arranged like this one, what is required to stand up the same path. CDK is used for illustration, though the same resources can be created by any means; a project without infrastructure as code can create them by hand in the console with no loss of function.

### 1. Create the SNS topic

A single standard topic is sufficient. In CDK this is a one line resource:

```ts
const releaseTopic = new sns.Topic(this, "ReleaseNotifications");
```

There is no need for the topic ARN to be stored anywhere special. In Flex it happens to be kept in Parameter Store and read back at deploy time, but that's not mandatory.

### 2. Connect Amazon Q to Slack

In the AWS console, configure Amazon Q Developer in chat applications for the Slack workspace, authorising the integration once at the workspace level. Then create a **channel configuration** that maps a specific Slack channel to the SNS topic created above, granting it an IAM role with permission to read from that topic.

The Slack side requires the Amazon Q app to be present in the target channel before it can post. In Slack this is done by inviting it via `/invite @Amazon Q`. Once the app is in the channel and the channel configuration is in place, anything published to the topic will be relayed into the channel.

### 3. Grant the CI job permission to publish

The publishing job needs credentials that allow `sns:Publish` on the topic and nothing more. The recommended approach is a short lived role assumed through OIDC, so that the CI system holds no long lived keys:

```ts
releaseTopic.grantPublish(ciPublisherRole);
```

The role's trust policy should be scoped to the specific repository and, ideally, the specific branch or environment from which releases are published, so that the ability to post into the channel is not handed out more widely than intended.

### 4. Publish from the pipeline

With the above in place, the pipeline step reduces to composing the custom payload and publishing it. For example:

```bash
MESSAGE=$(jq -n \
  --arg title "Release v1.2.0" \
  --arg body  "$RELEASE_NOTES" \
  '{ version: "1.0", source: "custom",
     content: { textType: "client-markdown", title: $title, description: $body } }')

aws sns publish --topic-arn "$TOPIC_ARN" --message "$MESSAGE"
```

It is advisable to mark this step as non blocking, so that a notification that fails to send, for whatever reason, does not fail the release or hold up a deployment. A missed message is a minor inconvenience; a deployment blocked by a chat outage is not.

---

## A Note on Failure

The credential and notification steps are allowed to fail without stopping the pipeline. This is a good default for any project adopting the pattern, and it is worth preserving when adapting the steps above: it's unlikely that notification delivery failure should intentionally break the pipeline.

---

## Summary

The system is a one directional pipe. A CI job composes a message, publishes it to an SNS topic, and Amazon Q relays it into Slack, with the whole path being failure tolerant. It is a good fit where the requirement is to announce releases plainly and reliably and where self service is important. It is a poor fit where the requirement is to maintain a living, threaded, editable record of a deployment's progress, which the custom notification path cannot provide and which would call for a direct integration with the Slack API instead.
