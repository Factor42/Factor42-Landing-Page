#!/usr/bin/env node
/**
 * Enrich each blog post's frontmatter with the card-presentation metadata from
 * the original hand-designed blog.html index: filter group, card gradient,
 * stat header, and the color-matched category pill. Also marks the featured
 * post. Idempotent — safe to re-run.
 *
 * Usage: node scripts/enrich-cards.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');
const KEYS = [
  'theme', 'group', 'cardGradient', 'tagColor', 'tagBg', 'cardStat', 'cardStatLabel',
  'featured', 'featuredStat', 'featuredStatLabel',
];

// Map the original pill color -> theme name (keeps CMS theme picker accurate).
const THEME_BY_COLOR = {
  '#0066ff': 'blue', '#b91c1c': 'red', '#7c3aed': 'purple',
  '#0284c7': 'sky', '#4338ca': 'indigo', '#0f766e': 'teal', '#ea580c': 'orange',
};

const grad = (s = '') => s.match(/linear-gradient\([^)]*\)/i)?.[0] || '';
const color = (s = '') => s.match(/color:\s*(#[0-9a-f]{3,6})/i)?.[1] || '';
const bg = (s = '') => s.match(/background:\s*(rgba\([^)]*\))/i)?.[1] || '';
const slugOf = (href = '') => href.match(/blog-(.+)\.html/)?.[1] || '';
const J = (v) => JSON.stringify(v ?? '');

const html = readFileSync(join(ROOT, 'blog.html'), 'utf8');
const $ = cheerio.load(html);

const data = {}; // slug -> fields

// Featured card
const feat = $('a.featured-card').first();
if (feat.length) {
  const slug = slugOf(feat.attr('href'));
  const statP = feat.find('.text-5xl').first();
  const catPill = feat.find('.cat-pill').eq(1); // [0]=Featured, [1]=category
  data[slug] = {
    featured: true,
    featuredStat: statP.text().trim(),
    featuredStatLabel: statP.next('p').text().trim(),
    tagColor: color(catPill.attr('style')),
    tagBg: bg(catPill.attr('style')),
  };
}

// Grid cards
$('article.article-card').each((_, el) => {
  const $el = $(el);
  const img = $el.find('.article-img').first();
  const stats = img.find('p');
  const pill = $el.find('.cat-pill').first();
  const slug = slugOf($el.find('a[href^="blog-"]').attr('href'));
  if (!slug) return;
  data[slug] = {
    ...(data[slug] || {}),
    group: $el.attr('data-cat') || '',
    cardGradient: grad(img.attr('style')),
    cardStat: stats.eq(0).text().trim(),
    cardStatLabel: stats.eq(1).text().trim(),
    tagColor: color(pill.attr('style')),
    tagBg: bg(pill.attr('style')),
    featured: false,
  };
});

// Inject into frontmatter
let updated = 0;
const missing = [];
for (const [slug, fields] of Object.entries(data)) {
  const file = join(BLOG_DIR, `${slug}.md`);
  if (!existsSync(file)) {
    missing.push(slug);
    continue;
  }
  const content = readFileSync(file, 'utf8');
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) {
    missing.push(`${slug} (no frontmatter)`);
    continue;
  }
  // strip previously-injected keys, keep everything else
  const block = m[1]
    .split('\n')
    .filter((l) => !KEYS.some((k) => l.startsWith(`${k}:`)))
    .join('\n')
    .trimEnd();

  const add = [];
  const theme = THEME_BY_COLOR[(fields.tagColor || '').toLowerCase()];
  if (theme) add.push(`theme: ${J(theme)}`);
  if (fields.group) add.push(`group: ${J(fields.group)}`);
  if (fields.cardGradient) add.push(`cardGradient: ${J(fields.cardGradient)}`);
  if (fields.tagColor) add.push(`tagColor: ${J(fields.tagColor)}`);
  if (fields.tagBg) add.push(`tagBg: ${J(fields.tagBg)}`);
  if (fields.cardStat) add.push(`cardStat: ${J(fields.cardStat)}`);
  if (fields.cardStatLabel) add.push(`cardStatLabel: ${J(fields.cardStatLabel)}`);
  add.push(`featured: ${fields.featured ? 'true' : 'false'}`);
  if (fields.featuredStat) add.push(`featuredStat: ${J(fields.featuredStat)}`);
  if (fields.featuredStatLabel) add.push(`featuredStatLabel: ${J(fields.featuredStatLabel)}`);

  const out = `---\n${block}\n${add.join('\n')}\n---\n${m[2]}`;
  writeFileSync(file, out, 'utf8');
  updated++;
}

console.log(`\nEnriched ${updated} posts.`);
console.log(`Featured: ${Object.entries(data).find(([, f]) => f.featured)?.[0] || '(none)'}`);
if (missing.length) console.log(`⚠ No matching .md for: ${missing.join(', ')}`);
