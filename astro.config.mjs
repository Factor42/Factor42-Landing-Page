// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://factor42media.com',
  // Build to dist-astro/ so we never clobber the existing dist/ deploy-artifact folder.
  outDir: './dist-astro',
  integrations: [
    // applyBaseStyles keeps Tailwind's preflight (matches the old CDN behavior);
    // our custom component classes live in src/styles/global.css.
    tailwind(),
    mdx(),
    sitemap(),
  ],
});
