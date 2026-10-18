import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // A short label above the hero title, rendered by `components/Hero.astro`.
        eyebrow: z.string().optional(),
      }),
    }),
  }),
  // Overrides for Starlight's built-in UI strings (`src/content/i18n/<lang>.json`).
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
