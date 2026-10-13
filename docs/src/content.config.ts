import { defineCollection } from "astro:content";
import { docsLoader, i18nLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Starlight reads this collection for its UI strings on every render and Astro warns when it is
  // missing or empty. The one entry, `en.json`, overrides nothing.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
