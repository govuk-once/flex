import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

const REPOSITORY = "https://github.com/govuk-once/flex";

// Published to GitHub Pages as a project site, so every page is served under the repository's
// name. Links validator fails build on an internal link that points nowhere
export default defineConfig({
  site: "https://govuk-once.github.io",
  base: "/flex",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "FLEX",
      description:
        "Flex is the platform behind the GOV.UK app. It connects what GOV.UK knows about a user with the government services the app is built to work with.",
      social: [{ icon: "github", label: "GitHub", href: REPOSITORY }],
      editLink: { baseUrl: `${REPOSITORY}/edit/main/docs/` },
      lastUpdated: true,
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "" },
            { autogenerate: { directory: "start-here" } },
          ],
        },
        { label: "Getting started", items: [{ autogenerate: { directory: "getting-started" } }] },
        { label: "Domains", items: [{ autogenerate: { directory: "domains" } }] },
        { label: "Platform", items: [{ autogenerate: { directory: "platform" } }] },
        { label: "Delivery", items: [{ autogenerate: { directory: "delivery" } }] },
        { label: "Operations", items: [{ autogenerate: { directory: "operations" } }] },
        { label: "Observability", items: [{ autogenerate: { directory: "observability" } }] },
        { label: "Security", items: [{ autogenerate: { directory: "security" } }] },
        { label: "Reference", items: [{ autogenerate: { directory: "reference" } }] },
      ],
    }),
  ],
});
