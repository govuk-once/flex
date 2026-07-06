import { describe, expect, it } from "vitest";

import {
  buildReleaseMessage,
  githubMarkdownToSlackMarkdown,
} from "./buildReleaseNotification";

describe("markdownToSlack", () => {
  it("drops the leading version header", () => {
    const input =
      "## [1.3.0](https://github.com/govuk-once/flex/compare/v1.2.4...v1.3.0) (2026-06-29)\n\n### Features";

    expect(githubMarkdownToSlackMarkdown(input)).toBe("*Features*");
  });

  it("converts headings to Slack bold", () => {
    expect(githubMarkdownToSlackMarkdown("### Bug Fixes")).toBe("*Bug Fixes*");
  });

  it("encodes inline links as Slack links", () => {
    expect(
      githubMarkdownToSlackMarkdown("see [#383](https://example.com/383)"),
    ).toBe("see <https://example.com/383|#383>");
  });

  it("converts GitHub bold to Slack bold", () => {
    expect(githubMarkdownToSlackMarkdown("a **breaking** change")).toBe(
      "a *breaking* change",
    );
  });

  it("converts list markers to bullet points", () => {
    expect(githubMarkdownToSlackMarkdown("* one\n* two")).toBe("• one\n• two");
    expect(githubMarkdownToSlackMarkdown("- one\n- two")).toBe("• one\n• two");
  });

  it("collapses runs of blank lines and trims", () => {
    expect(githubMarkdownToSlackMarkdown("a\n\n\n\nb\n\n")).toBe("a\n\nb");
  });

  it("converts a full semantic-release note into clean Slack mrkdwn", () => {
    const input = [
      "## [1.3.0](https://github.com/govuk-once/flex/compare/v1.2.4...v1.3.0) (2026-06-29)",
      "",
      "### Features",
      "",
      "* playground scripts ([#383](https://github.com/govuk-once/flex/issues/383)) ([c2da293](https://github.com/govuk-once/flex/commit/c2da293a))",
      "",
      "",
    ].join("\n");

    expect(githubMarkdownToSlackMarkdown(input)).toBe(
      "*Features*\n• playground scripts (<https://github.com/govuk-once/flex/issues/383|#383>) (<https://github.com/govuk-once/flex/commit/c2da293a|c2da293>)",
    );
  });
});

describe("buildReleaseMessage", () => {
  const url = "https://github.com/govuk-once/flex/releases/tag/v1.3.0";

  it("builds the Chatbot custom-notification envelope", () => {
    const message = buildReleaseMessage({
      title: "Flex minor release: v1.3.0",
      notesMarkdown: "### Features\n\n* a thing",
      url,
    });

    expect(message).toEqual({
      version: "1.0",
      source: "custom",
      content: {
        textType: "client-markdown",
        title: "Flex minor release: v1.3.0",
        description: `*Features*\n• a thing\n\n<${url}|View release>`,
      },
    });
  });

  it("includes only the link when there are no notes", () => {
    const message = buildReleaseMessage({
      title: "Flex patch release: v1.3.1",
      notesMarkdown: "",
      url,
    });

    expect(message.content.description).toBe(`<${url}|View release>`);
  });

  it("truncates long notes", () => {
    const message = buildReleaseMessage({
      title: "Flex minor release: v2.0.0",
      notesMarkdown: "x".repeat(5000),
      url,
    });

    expect(message.content.description).toBe(
      `${"x".repeat(1500)}\n\n<${url}|View release>`,
    );
  });
});
