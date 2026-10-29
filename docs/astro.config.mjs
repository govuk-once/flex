import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import mermaid from "astro-mermaid";
import starlightLinksValidator from "starlight-links-validator";

const REPOSITORY = "https://github.com/govuk-once/flex";

// Published to GitHub Pages as a project site, so every page is served under the repository's
// name. Links validator fails build on an internal link that points nowhere
export default defineConfig({
  site: "https://govuk-once.github.io",
  base: "/flex",
  trailingSlash: "always",
  integrations: [
    // Must come before starlight so mermaid fences are transformed first
    mermaid(),
    starlight({
      title: "Flex",
      description:
        "Flex is the platform behind the GOV.UK app. It connects what GOV.UK knows about a user with the government services the app is built to work with.",
      social: [{ icon: "github", label: "GitHub", href: REPOSITORY }],
      editLink: { baseUrl: `${REPOSITORY}/edit/main/docs/` },
      lastUpdated: true,
      plugins: [starlightLinksValidator()],
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
      sidebar: [
        {
          label: "Introduction",
          items: [
            { label: "Overview", slug: "" },
            { autogenerate: { directory: "introduction" } },
          ],
        },
        {
          label: "Getting started",
          items: [{ autogenerate: { directory: "getting-started" } }],
          collapsed: true,
        },
        {
          label: "Domains",
          items: [{ autogenerate: { directory: "domains" } }],
          collapsed: true,
        },
        {
          label: "Platform",
          items: [{ autogenerate: { directory: "platform" } }],
          collapsed: true,
        },
        {
          label: "Delivery",
          items: [{ autogenerate: { directory: "delivery" } }],
          collapsed: true,
        },
        {
          label: "Operations",
          items: [{ autogenerate: { directory: "operations" } }],
          collapsed: true,
        },
        {
          label: "Observability",
          items: [{ autogenerate: { directory: "observability" } }],
          collapsed: true,
        },
        {
          label: "Security",
          items: [{ autogenerate: { directory: "security" } }],
          collapsed: true,
        },
        {
          label: "Reference",
          items: [{ autogenerate: { directory: "reference" } }],
          collapsed: true,
        },
      ],
    }),
  ],
});
