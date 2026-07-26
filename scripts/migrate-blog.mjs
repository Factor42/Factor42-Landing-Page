#!/usr/bin/env node
/**
 * One-shot migration: convert the hand-authored blog-*.html posts into
 * Markdown + frontmatter under src/content/blog/.
 *
 * Handles both template variants found in the repo:
 *   A) centered hero + <article><div class="prose"> body + in-body CTA box
 *   B) left hero + <main class="prose"> body + pull-quotes + external themed CTA
 *
 * Content is normalized to the unified Astro component design (BlogHero /
 * StatStrip / BlogPostLayout), so per-post markup differences are discarded —
 * only the content (title, meta, category, date, read time, hero gradient,
 * stats, body) is carried over. The repeated CTA chrome is intentionally
 * dropped; it now lives once in BlogPostLayout.
 *
 * Usage: node scripts/migrate-blog.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'content', 'blog');
const DRY = process.argv.includes('--dry');

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04', may: '05',
  june: '06', july: '07', august: '08', september: '09', october: '10',
  november: '11', december: '12',
};

// Map old flat .html links to new routes.
function rewriteLink(href) {
  if (!href) return href;
  const [pathPart, hash = ''] = href.split('#');
  const suffix = hash ? `#${hash}` : '';
  if (pathPart === 'index.html' || pathPart === '') return `/${suffix}`;
  const m = pathPart.match(/^blog-(.+)\.html$/);
  if (m) return `/blog/${m[1]}${suffix}`;
  if (pathPart === 'blog.html') return `/blog${suffix}`;
  const page = pathPart.match(/^([a-z0-9-]+)\.html$/);
  if (page) return `/${page[1]}${suffix}`;
  return href; // external or already-absolute
}

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    hr: '---',
  });
  // Pull-quotes -> Markdown blockquotes (styled via .prose blockquote).
  td.addRule('pullquote', {
    filter: (node) =>
      node.nodeName === 'DIV' && (node.getAttribute('class') || '').includes('pull-quote'),
    replacement: (content) =>
      '\n\n' + content.trim().split('\n').map((l) => `> ${l}`.trimEnd()).join('\n') + '\n\n',
  });
  // Rewrite anchor hrefs to new routes.
  td.addRule('links', {
    filter: (node) => node.nodeName === 'A' && node.getAttribute('href'),
    replacement: (content, node) => {
      const href = rewriteLink(node.getAttribute('href'));
      return content ? `[${content}](${href})` : '';
    },
  });
  return td;
}

function slugFor(file) {
  return file.replace(/^blog-/, '').replace(/\.html$/, '');
}

function y(v) {
  // YAML double-quoted scalar via JSON (handles quotes, colons, apostrophes).
  return JSON.stringify(v ?? '');
}

function parse(file, html) {
  const $ = cheerio.load(html);
  const warnings = [];

  // --- title / description ---
  const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
  if (!title) warnings.push('no <h1> title');
  const description = ($('meta[name="description"]').attr('content') || '').trim();
  if (!description) warnings.push('no meta description');

  // --- hero band: the gradient div that contains the h1 ---
  const h1 = $('h1').first();
  let hero = h1;
  while (hero.length && !/gradient/i.test(hero.attr('style') || '')) hero = hero.parent();
  const heroBand = hero.length ? hero : h1.closest('div');

  // hero gradient
  const heroStyle = heroBand.attr('style') || '';
  const gMatch = heroStyle.match(/linear-gradient\([^;"]*\)/i);
  const heroGradient = gMatch ? gMatch[0].replace(/\s+/g, ' ').trim() : null;
  if (!heroGradient) warnings.push('no hero gradient');

  // category: first pill span in the hero
  let category = '';
  heroBand.find('span').each((_, el) => {
    const cls = $(el).attr('class') || '';
    if (!category && /rounded-full/.test(cls)) category = $(el).text().replace(/\s+/g, ' ').trim();
  });
  if (!category) warnings.push('no category');

  // subtitle: first <p> in the hero (variant A only; variant B has none)
  const subtitle = heroBand.find('p').first().text().replace(/\s+/g, ' ').trim();

  // date + read time: from the hero's text
  const heroText = heroBand.text().replace(/\s+/g, ' ');
  const dMatch = heroText.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  let date = null;
  if (dMatch) {
    const mm = MONTHS[dMatch[1].toLowerCase()];
    if (mm) date = `${dMatch[3]}-${mm}-${String(dMatch[2]).padStart(2, '0')}`;
  }
  if (!date) warnings.push('no date');
  const rMatch = heroText.match(/(\d+)\s*min read/i);
  const readMinutes = rMatch ? parseInt(rMatch[1], 10) : 5;
  if (!rMatch) warnings.push('no read time (defaulted 5)');

  // author: look for "Factor42 Research" or a trailing hero name; default fixed
  const author = /Factor42 Research/i.test(heroText) ? 'Factor42 Research' : 'Factor42 Research';

  // --- stats: each .stat-box has a value element then a label element ---
  const stats = [];
  $('.stat-box').each((_, el) => {
    const kids = $(el).children().toArray();
    if (kids.length >= 2) {
      const value = $(kids[0]).text().replace(/\s+/g, ' ').trim();
      const label = $(kids[kids.length - 1]).text().replace(/\s+/g, ' ').trim();
      if (value) stats.push({ value, label });
    }
  });
  if (stats.length !== 3) warnings.push(`expected 3 stats, got ${stats.length}`);

  // --- body: the .prose container (article inner div OR main.prose) ---
  const body = $('.prose').first();
  if (!body.length) warnings.push('no .prose body');
  // strip in-body CTA action boxes (variant A) — now provided by the layout
  body.find('div.rounded-2xl, div.rounded-xl').each((_, el) => {
    if (/Book a Free Consultation|Explore Factor42/i.test($(el).text())) $(el).remove();
  });

  const td = makeTurndown();
  let md = td.turndown(body.html() || '').trim();
  md = md.replace(/\n{3,}/g, '\n\n');
  // Normalize turndown's padded list markers ("-   x" -> "- x", "1.  x" -> "1. x").
  md = md.replace(/^(\s*[-*]) {2,}/gm, '$1 ').replace(/^(\s*\d+\.) {2,}/gm, '$1 ');

  // Build frontmatter
  const fm = ['---'];
  fm.push(`title: ${y(title)}`);
  fm.push(`description: ${y(description)}`);
  if (subtitle && subtitle !== description) fm.push(`subtitle: ${y(subtitle)}`);
  fm.push(`category: ${y(category)}`);
  if (date) fm.push(`date: ${date}`);
  fm.push(`readMinutes: ${readMinutes}`);
  fm.push(`author: ${y(author)}`);
  if (heroGradient) fm.push(`heroGradient: ${y(heroGradient)}`);
  fm.push('stats:');
  for (const s of stats) {
    fm.push(`  - value: ${y(s.value)}`);
    fm.push(`    label: ${y(s.label)}`);
  }
  fm.push('draft: false');
  fm.push('---');

  return { content: fm.join('\n') + '\n\n' + md + '\n', warnings };
}

// --- run ---
mkdirSync(OUT_DIR, { recursive: true });
const files = readdirSync(ROOT).filter((f) => /^blog-.+\.html$/.test(f) && f !== 'blog.html');
files.sort();

let ok = 0;
const report = [];
for (const file of files) {
  const slug = slugFor(file);
  const html = readFileSync(join(ROOT, file), 'utf8');
  const { content, warnings } = parse(file, html);
  if (!DRY) writeFileSync(join(OUT_DIR, `${slug}.md`), content, 'utf8');
  ok++;
  report.push({ slug, warnings });
}

console.log(`\nConverted ${ok}/${files.length} posts${DRY ? ' (dry run — nothing written)' : ` -> ${OUT_DIR}`}\n`);
const flagged = report.filter((r) => r.warnings.length);
if (flagged.length) {
  console.log('⚠  Posts with warnings (review these):');
  for (const r of flagged) console.log(`   ${r.slug}: ${r.warnings.join('; ')}`);
} else {
  console.log('✓ No warnings — all fields extracted on every post.');
}
