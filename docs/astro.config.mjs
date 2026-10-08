import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

const REPOSITORY = "https://github.com/govuk-once/flex";

// Published to GitHub Pages as a project site, so every page is served under the repository's
// name. Links written in content include the base; the links validator fails the build on one
// that points nowhere.
export default defineConfig({
  site: "https://govuk-once.github.io",
  base: "/flex",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Flex",
      description:
        "Flex (Federated Logic and Events eXchange) is the serverless platform behind the GOV.UK app, built on AWS with CDK and TypeScript.",
      social: [{ icon: "github", label: "GitHub", href: REPOSITORY }],
      editLink: { baseUrl: `${REPOSITORY}/edit/main/docs/` },
      lastUpdated: true,
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", slug: "" },
            "start/platform",
            "start/environment-setup",
            "start/working-in-the-repo",
            "start/conventions",
          ],
        },
        {
          label: "Domains",
          items: [
            "domains/overview",
            "domains/creating-a-domain",
            "domains/configuration",
            "domains/handlers",
            "domains/resources",
            "domains/integrations",
            "domains/testing",
            "domains/openapi",
            "domains/catalogue",
          ],
        },
        {
          label: "Service gateways",
          items: [
            "gateways/overview",
            "gateways/creating-a-gateway",
            "gateways/configuration",
            "gateways/clients",
            "gateways/testing",
            "gateways/catalogue",
          ],
        },
        {
          label: "Edge and authentication",
          items: [
            "edge/cloudfront-functions",
            "edge/authorizer",
            "edge/platform-handlers",
          ],
        },
        {
          label: "Infrastructure",
          items: [
            "infrastructure/overview",
            "infrastructure/lambda-constructs",
            "infrastructure/data-and-encryption",
          ],
        },
        {
          label: "Observability",
          items: [
            "observability/logging",
            "observability/telemetry",
            "observability/alarms",
          ],
        },
        {
          label: "Delivery",
          items: [
            "delivery/environments",
            "delivery/pipeline",
            "delivery/releases",
            "delivery/e2e-tests",
            "delivery/performance-tests",
            "delivery/security-scanning",
          ],
        },
        {
          label: "Runbooks",
          items: [
            "runbooks/overview",
            "runbooks/verify-environment-health",
            "runbooks/lambda-errors-throttling",
            "runbooks/api-gateway-5xx",
            "runbooks/external-service-outage",
            "runbooks/alarm-relay-failures",
            "runbooks/fix-forward",
            "runbooks/leaked-secret",
          ],
        },
        {
          label: "Reference",
          items: [
            "reference/packages",
            "reference/flex-config",
            "reference/flex-utils",
            "reference/flex-testing",
            "reference/environment-variables",
            "reference/glossary",
          ],
        },
      ],
    }),
  ],
});
