import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STDIN_FD = 0;
const MAX_NOTES_LENGTH = 1500;

const VERSION_HEADER = /^#{1,6}\s*\[[^\]]*\]\([^)]*\)[^\n]*\n/m;
const HEADING = /^#{1,6}\s*(.+)$/gm;
const INLINE_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
const GITHUB_BOLD = /\*\*([^*]+)\*\*/g;
const LIST_MARKER = /^\s*[*-]\s+/gm;
const BLANK_LINE_RUN = /\n{3,}/g;

/**
 * Converts the GitHub-flavoured markdown semantic-release produces into the
 * Slack mrkdwn that AWS Chatbot renders for its `client-markdown` text type.
 */
export function githubMarkdownToSlackMarkdown(markdown: string): string {
  return markdown
    .replace(VERSION_HEADER, "") // remove the leading version header; it's redundant with the notification title
    .replace(HEADING, "*$1*")
    .replace(INLINE_LINK, "<$2|$1>")
    .replace(GITHUB_BOLD, "*$1*")
    .replace(LIST_MARKER, "• ")
    .replace(BLANK_LINE_RUN, "\n\n")
    .trim();
}

export interface ReleaseMessageInput {
  title: string;
  notesMarkdown: string;
  url: string;
}

export function buildReleaseMessage({
  title,
  notesMarkdown,
  url,
}: ReleaseMessageInput) {
  const notes = githubMarkdownToSlackMarkdown(notesMarkdown).slice(
    0,
    MAX_NOTES_LENGTH,
  );
  const link = `<${url}|View release>`;

  return {
    version: "1.0",
    source: "custom",
    content: {
      textType: "client-markdown",
      title,
      description: notes ? `${notes}\n\n${link}` : link,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { TITLE: title, URL: url } = process.env;

  if (!title || !url) {
    console.error("TITLE and URL environment variables are required");
    process.exit(1);
  }

  const notesMarkdown = readFileSync(STDIN_FD, "utf8");
  process.stdout.write(
    JSON.stringify(buildReleaseMessage({ title, notesMarkdown, url })),
  );
}
