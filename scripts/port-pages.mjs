#!/usr/bin/env node
/**
 * Port the hand-authored static marketing/legal pages into Astro pages that
 * use BaseLayout (compiled Tailwind + shared Header/Footer + site-wide GA).
 *
 * Per page it:
 *   - extracts <title> + meta description
 *   - preserves JSON-LD structured data and page-specific <style> overrides
 *   - drops the old head boilerplate (Tailwind CDN, tailwind.config, gtag,
 *     fonts, styles.css) — BaseLayout provides all of that
 *   - removes the per-page <header>/<footer> (replaced by shared components),
 *     except on the landing page, whose bespoke scroll-navbar + rich footer
 *     are kept inline (header/footer disabled on BaseLayout)
 *   - rewrites old *.html links to the new routes
 *   - keeps interactive scripts (tabs, filters, forms, reveal) as is:inline
 *
 * Usage: node scripts/port-pages.mjs [pageBasename ...]   (default: all)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'pages');

// source .html -> { keepChrome } (keepChrome = keep the page's own header/footer)
const PAGES = {
  'index.html': { keepChrome: true },
  'about.html': {},
  'careers.html': {},
  'consultation.html': {},
  'contact.html': {},
  'white-label-ppc.html': {},
  'library.html': {},
  'privacy-policy.html': {},
  'terms-of-service.html': {},
  'security.html': {},
  'sla.html': {},
};

function rewriteLink(href) {
  if (!href) return href;
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return href; // external / same-page anchor
  const [pathPart, hash = ''] = href.split('#');
  const suffix = hash ? `#${hash}` : '';
  if (pathPart === 'index.html' || pathPart === '') return `/${suffix}`;
  const blog = pathPart.match(/^blog-(.+)\.html$/);
  if (blog) return `/blog/${blog[1]}${suffix}`;
  if (pathPart === 'blog.html') return `/blog${suffix}`;
  const page = pathPart.match(/^([a-z0-9-]+)\.html$/);
  if (page) return `/${page[1]}${suffix}`;
  return href;
}

function port(file, opts) {
  const html = readFileSync(join(ROOT, file), 'utf8');

  // --- head metadata via regex (robust across parser modes) ---
  const headHtml = html.split(/<\/head>/i)[0] || '';
  const title = (headHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
  const description = (
    headHtml.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)?.[1] || ''
  ).trim();
  const pageStyles = [...headHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1].trim())
    .join('\n')
    .trim();
  // JSON-LD structured data (SEO) — preserve (may be in head or body).
  const jsonld = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)]
    .map((m) => m[0])
    .join('\n');

  // --- body as a cheerio fragment (no head/body confusion) ---
  const bodyRaw = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
  const $ = cheerio.load(bodyRaw, null, false);

  // Drop obsolete/relocated scripts.
  $('script').each((_, el) => {
    const src = $(el).attr('src') || '';
    const txt = $(el).html() || '';
    if (
      /cdn\.tailwindcss\.com/.test(src) ||
      /tailwind\.config/.test(txt) ||
      /googletagmanager|gtag\(/.test(src + txt)
    ) {
      $(el).remove();
    }
  });
  // JSON-LD re-added once below, so remove from body.
  $('script[type="application/ld+json"]').remove();

  // Replace per-page chrome unless this page keeps its own.
  if (!opts.keepChrome) {
    $('header').remove();
    $('footer').remove();
  }

  // Rewrite links.
  $('a[href]').each((_, el) => $(el).attr('href', rewriteLink($(el).attr('href'))));

  let body = $.html().trim();

  // Every raw <script> must be is:inline so Astro leaves vanilla JS untouched.
  body = body.replace(/<script\b(?![^>]*\bis:inline\b)/gi, '<script is:inline');
  const jsonldInline = jsonld.replace(/<script\b(?![^>]*\bis:inline\b)/gi, '<script is:inline');

  const props = [`title={${JSON.stringify(title)}}`, `description={${JSON.stringify(description)}}`];
  if (opts.keepChrome) props.push('header={false}', 'footer={false}');

  const out = [
    '---',
    "import BaseLayout from '../layouts/BaseLayout.astro';",
    '---',
    `<BaseLayout ${props.join(' ')}>`,
    body,
    jsonldInline,
    pageStyles ? `<style is:global>\n${pageStyles}\n</style>` : '',
    '</BaseLayout>',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n');

  const outName = file.replace(/\.html$/, '.astro');
  writeFileSync(join(OUT, outName), out, 'utf8');
  return { outName, title, hasJsonld: !!jsonld, hasStyles: !!pageStyles };
}

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const targets = only.length ? only.map((p) => (p.endsWith('.html') ? p : `${p}.html`)) : Object.keys(PAGES);

console.log('');
for (const file of targets) {
  const opts = PAGES[file];
  if (!opts) {
    console.log(`  skip ${file} (not in PAGES)`);
    continue;
  }
  const r = port(file, opts);
  console.log(
    `  ✓ ${file} -> src/pages/${r.outName}` +
      (opts.keepChrome ? '  [own chrome]' : '') +
      (r.hasJsonld ? '  +json-ld' : '') +
      (r.hasStyles ? '  +styles' : '')
  );
}
console.log('');
