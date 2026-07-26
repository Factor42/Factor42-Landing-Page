import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Astro 5 Content Layer API: blog posts are Markdown files in src/content/blog.
// The entry `id` is derived from the filename (e.g. retainer-math.md -> "retainer-math").
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    // SEO meta description (may differ from the hero subtitle).
    description: z.string(),
    // Hero subtitle shown on the post page; falls back to `description`.
    subtitle: z.string().optional(),
    category: z.string(),
    date: z.coerce.date(),
    readMinutes: z.number().default(5),
    author: z.string().default('Factor42 Research'),
    heroGradient: z
      .string()
      .default('linear-gradient(135deg,#1e1b4b,#4338ca 50%,#0066FF)'),
    // The stat-strip: 0–3 items.
    stats: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .default([]),
    draft: z.boolean().default(false),

    // Blog-index card presentation (from the original blog.html design).
    theme: z.string().optional(), // color theme name (blue|red|purple|sky|indigo|teal|orange)
    group: z.string().optional(), // filter group: smb | industry | ad-ops | ai | programmatic | media
    cardGradient: z.string().optional(), // article-img gradient background
    tagColor: z.string().optional(), // category-pill text color
    tagBg: z.string().optional(), // category-pill background
    cardStat: z.string().optional(), // big stat shown on the card header
    cardStatLabel: z.string().optional(),
    featured: z.boolean().default(false),
    featuredStat: z.string().optional(), // larger stat for the featured card
    featuredStatLabel: z.string().optional(),
  }),
});

// Legal pages (privacy-policy, terms-of-service, security, sla) as editable Markdown.
const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    lastUpdated: z.string().optional(),
  }),
});

// Careers job listings — editors add/remove postings in the CMS.
const jobs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/jobs' }),
  schema: z.object({
    title: z.string(),
    department: z.enum(['ad-ops', 'sales', 'engineering', 'finance', 'people', 'client-success']),
    location: z.string().default('Remote'),
    type: z.string().default('Full-time'),
    applyEmail: z.string().default('careers@factor42media.com'),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, legal, jobs };
