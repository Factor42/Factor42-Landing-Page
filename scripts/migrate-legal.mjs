#!/usr/bin/env node
/**
 * Convert the static legal pages (privacy-policy, terms-of-service, security, sla)
 * into a Markdown content collection so they can be edited in the CMS.
 * One-shot; re-runnable.
 *
 * Usage: node scripts/migrate-legal.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'content', 'legal');
const PAGES = ['privacy-policy', 'terms-of-service', 'security', 'sla'];

function rewriteLink(href) {
  if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return href;
  const [p, hash = ''] = href.split('#');
  const suffix = hash ? `#${hash}` : '';
  if (p === 'index.html' || p === '') return `/${suffix}`;
  if (p === 'blog.html') return `/blog${suffix}`;
  const page = p.match(/^([a-z0-9-]+)\.html$/);
  return page ? `/${page[1]}${suffix}` : href;
}

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*' });
td.addRule('links', {
  filter: (n) => n.nodeName === 'A' && n.getAttribute('href'),
  replacement: (content, n) => (content ? `[${content}](${rewriteLink(n.getAttribute('href'))})` : ''),
});

const J = (v) => JSON.stringify(v ?? '');

mkdirSync(OUT, { recursive: true });
for (const slug of PAGES) {
  const html = readFileSync(join(ROOT, `${slug}.html`), 'utf8');
  const headHtml = html.split(/<\/head>/i)[0] || '';
  const title = (headHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').split(/[—|]/)[0].trim();
  const description = (headHtml.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)?.[1] || '').trim();

  const bodyRaw = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  const $ = cheerio.load(bodyRaw, null, false);

  const h1 = $('h1').first();
  const displayTitle = h1.text().trim() || title;
  h1.remove();

  // "Last Updated: ..." line
  let lastUpdated = '';
  $('p').each((_, el) => {
    const t = $(el).text().trim();
    const m = t.match(/Last Updated:\s*(.+)/i);
    if (m && !lastUpdated) {
      lastUpdated = m[1].trim();
      $(el).remove();
    }
  });

  let md = td
    .turndown($.html())
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    // Undo turndown's over-escaping of "1." -> "1\." in numbered headings/text.
    .replace(/(\d)\\\./g, '$1.');

  const fm = [
    '---',
    `title: ${J(displayTitle)}`,
    description ? `description: ${J(description)}` : '',
    `lastUpdated: ${J(lastUpdated)}`,
    '---',
  ].filter(Boolean);
  writeFileSync(join(OUT, `${slug}.md`), `${fm.join('\n')}\n\n${md}\n`, 'utf8');
  console.log(`  ✓ ${slug}.html -> src/content/legal/${slug}.md  (updated: ${lastUpdated || '?'})`);
}
