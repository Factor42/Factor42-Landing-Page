# Factor42 Site Migration Plan

Moving the Factor42 marketing site from hand-authored HTML to a maintainable,
SEO-first stack — with a headless-style content workflow that non-technical
teammates can use, no recurring license costs, and minimal vendor lock-in.

**Status:** All phases built. Site is component-based (Astro), content is Markdown,
CMS + GitHub-App bot auth in place, and Phase 5 is code-complete — form handler
([functions/api/submit.js](functions/api/submit.js)), D1 schema, 301 redirects, and
[docs/DEPLOY.md](docs/DEPLOY.md). Remaining work is **execution in the user's
Cloudflare/GitHub accounts**: create the GitHub App + Cloudflare Access, set secrets,
create/bind D1, connect the repo to Pages, then verify forms/redirects/CMS live.
**Last updated:** 2026-07-19

---

## 1. Why we're doing this

The current site is 45 hand-authored HTML files, of which 31 are blog posts.
Each post duplicates the same chrome (header, hero, stat-strip, footer) inline,
and publishing a post is a **four-place manual edit**:

1. Author the post HTML.
2. Add a card to `blog.html` (hand-maintained index of all 31 posts).
3. Add a URL to `sitemap.xml`.
4. Set the post's `canonical` link.

On top of that, **Tailwind is loaded from `cdn.tailwindcss.com` on all 43 pages**
— the prototype build, not meant for production (unpurged, render-blocking, FOUC).

### Goals

- **Easy maintenance** — publishing a post is one action, not four; no drifting copy-pasted chrome.
- **SEO-first** — static prerendered HTML, auto-generated sitemap/RSS/canonical/OG tags.
- **Professional look & feel** — preserve the existing visual design.
- **Performance** — compiled Tailwind, near-zero JS.
- **No recurring license cost, minimal lock-in** — content stays as portable Markdown in our own git repo.
- **Non-technical editors** — a clean web editor with a plain email/password login (no raw git, no GitHub screen).

### Non-goals / constraints

- No WordPress.
- No commercial CMS with monthly/annual license or heavy vendor lock-in.
- No self-hosted server or database to patch and back up (this is why we're **not** using Strapi).

---

## 2. Chosen stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **Astro** (static output / SSG) | Content-first; zero-JS by default → best-in-class SEO & Core Web Vitals; built-in content collections, sitemap, RSS. |
| **Styling** | **Tailwind, compiled** (via `@astrojs/tailwind`) | Kills the CDN anti-pattern; purged production CSS. Reuses the existing design tokens from `styles.css`. |
| **Content** | **Markdown/MDX** in the repo (Astro content collections) | Type-checked frontmatter; the most portable, lock-in-free format there is. |
| **CMS (editor UI)** | **Sveltia CMS**, git-backed | Clean web editor; commits Markdown for you; no server, no database. Modern, actively-maintained successor to Decap/Netlify CMS. |
| **Editor login** | **Cloudflare Access** (email one-time-PIN) in front of the admin route + a **GitHub App** for the commits | Editors get a plain email login — no GitHub screen — while content still lands as Markdown in git. Free. |
| **Host** | **Cloudflare Pages** | git push → build → deploy; preview URLs per branch; free tier; no server. |
| **Form handler** | **Cloudflare Pages Function** (`/api/submit`) → 2 Mailjet emails + 1 D1 row | Replaces the AWS Lambda; consolidates everything on Cloudflare (see Phase 5). |

### Why not the originally-considered Strapi + SvelteKit

- **Strapi** is open-source and license-free, but it's a **stateful Node server + Postgres** we'd have to host, patch, back up, and secure 24/7 — new ops burden that works *against* the "easy maintenance" goal. Its major-version upgrades (v4→v5) have historically been painful. It only earns its keep with a real content team, multi-frontend delivery, or complex relational content — none of which apply to a founder-run marketing blog.
- **SvelteKit** is an excellent *app* framework, but for a brochure site + blog its content story is more assembly than Astro's turnkey content collections, and SSR mode implies a runtime to host vs. plain static files.

Astro + a git-based CMS hits **every** stated goal while adding **zero servers**.

### Alternatives kept in our back pocket

- **TinaCloud (free tier)** — if the Cloudflare Access + GitHub App glue proves annoying, Tina gives editors an email/password login out of the box and still commits to our git repo. Cost: a light SaaS dependency.
- **Sanity (free hosted Studio)** — if editors ever need a fully hosted, Word-like CMS with no accounts to manage and we publish frequently. Cost: content lives in Sanity (exportable JSON) rather than Markdown, i.e. more coupling.

---

## 3. Target repository layout

```
/
├─ astro.config.mjs
├─ package.json
├─ tailwind.config.mjs
├─ tsconfig.json
├─ public/                     # static assets copied as-is
│  ├─ favicon.png
│  ├─ logo.svg, logo-white.svg, logo-icon.svg
│  └─ robots.txt
├─ src/
│  ├─ styles/global.css        # ported from styles.css (custom component classes)
│  ├─ components/              # extracted shared chrome
│  │  ├─ Header.astro
│  │  ├─ Footer.astro
│  │  ├─ BlogHero.astro
│  │  ├─ StatStrip.astro
│  │  ├─ ArticleCard.astro
│  │  └─ ...
│  ├─ layouts/
│  │  ├─ BaseLayout.astro      # <head>, fonts, global CSS, header/footer, SEO/OG/canonical
│  │  └─ BlogPostLayout.astro  # hero + stat-strip + prose wrapper
│  ├─ content/
│  │  ├─ config.ts             # blog collection schema (typed frontmatter)
│  │  └─ blog/                 # ← the 31 posts as Markdown live here
│  │     ├─ retainer-math.md
│  │     └─ ...
│  └─ pages/
│     ├─ index.astro
│     ├─ about.astro
│     ├─ careers.astro
│     ├─ consultation.astro
│     ├─ contact.astro
│     ├─ white-label-ppc.astro
│     ├─ library.astro
│     ├─ blog/
│     │  ├─ index.astro        # auto-generated listing (replaces blog.html)
│     │  └─ [slug].astro       # renders each post from the collection
│     ├─ legal pages (privacy-policy, terms-of-service, security, sla)
│     └─ api/
│        └─ submit.ts          # Pages Function: Mailjet + D1
├─ public/admin/               # Sveltia CMS (index.html + config.yml)
└─ MIGRATION-PLAN.md
```

### Blog frontmatter schema (draft)

Derived from the existing post template (title, description, date, category,
read-time, canonical, hero gradient, stat-strip):

```yaml
---
title: "The Hidden Math of Agency Retainers: Where Your $3,500 a Month Really Goes"
description: "Where does a $3,500-a-month agency retainer really go? ..."
category: "Cost & Pricing"
date: 2026-07-04
readMinutes: 5
author: "Factor42 Research"
heroGradient: "linear-gradient(135deg,#1e1b4b,#4338ca 50%,#0066FF)"
stats:                      # the stat-strip; optional, 0–3 items
  - value: "$3,500"
    label: "Typical monthly retainer"
  - value: "$42,000"
    label: "That retainer, per year"
  - value: "70%+"
    label: "Potential savings, consolidated"
draft: false
---

Body content in Markdown…
```

Everything that's currently manual — the blog index, `sitemap.xml`, RSS,
`canonical`, and OG/meta tags — is **generated from this frontmatter** at build time.

---

## 4. SEO preservation (must-do at cutover)

Current live URLs and canonicals use the `.html` extension, e.g.
`https://factor42media.com/blog-retainer-math.html`. Astro will naturally produce
`/blog/retainer-math`. To protect existing rankings and backlinks we will **either**:

- **(A)** configure `301 redirects` from every old `*.html` path to its new path
  (via Cloudflare Pages `_redirects` / `[[redirects]]`), **or**
- **(B)** keep the existing `.html` URLs by configuring Astro output paths.

**Decision: (A) 301 redirects** — cleaner long-term URLs, and 301s pass link equity.
A redirect map will be generated alongside the content migration so every one of the
31 old post URLs (plus any renamed static pages) resolves.

Also at cutover: regenerate `sitemap.xml` (now automatic), confirm `robots.txt`,
verify canonical + OG tags on a sample of pages, and submit the new sitemap in
Google Search Console.

---

## 5. Phased plan

Rough total: **~1.5–2.5 weeks part-time**, front-loaded on the design-system port.

### Phase 0 — Scaffold  (½–1 day)
- Initialize Astro + `@astrojs/tailwind` + `@astrojs/sitemap` + MDX.
- Port `styles.css` custom classes into `src/styles/global.css`; build a `tailwind.config.mjs` capturing the existing colors/fonts (Inter, Plus Jakarta Sans) and the gradient/brand tokens.
- Wire the Cloudflare Pages adapter and a build command; connect the GitHub repo to Cloudflare Pages (preview deploys on branches).

### Phase 1 — Design-system port  (2–4 days, the bulk of the work)
- Extract shared chrome into components: `Header`, `Footer`, `BlogHero`, `StatStrip`, `ArticleCard`, buttons (`btn-primary`/`btn-outline`), cards, `prose` wrapper.
- Build `BaseLayout` (head/SEO/fonts/global CSS) and `BlogPostLayout`.
- Port the static marketing pages: `index`, `about`, `careers`, `consultation`, `contact`, `white-label-ppc`, `library`, and the legal pages (`privacy-policy`, `terms-of-service`, `security`, `sla`).

### Phase 2 — Blog pipeline  (1–2 days)
- Define the `blog` content collection + typed schema (Section 3).
- Build `blog/[slug].astro` (post template) and `blog/index.astro` (auto-generated listing, preserving the category-filter UX from today's `blog.html`).
- Add auto-generated `sitemap.xml` and an RSS feed.

### Phase 3 — Content migration  (1–2 days)
- Write a Node script to parse the 31 existing post HTML files (they share one template) and emit Markdown + frontmatter: title, description, date, category, read-time, canonical, hero gradient, stat-strip, and body.
- Spot-check each converted post; clean up any inline-HTML edge cases.
- Emit the old→new redirect map (Section 4).

### Phase 4 — CMS wiring  (½–1½ days)
- Add Sveltia CMS at `/admin` with a `config.yml` whose collection fields map 1:1 to the frontmatter schema.
- Stand up editor auth: **Cloudflare Access** (email OTP) gating `/admin`, plus a **GitHub App** so commits happen under an app identity (editors never see GitHub).
- Test a full non-technical publish end-to-end: log in with email → write a post → publish → auto-build → live.

### Phase 5 — Cutover + Lambda → Cloudflare consolidation  (1 day)  *(not optional)*
Two parts:

**5a. Form handler migration (AWS Lambda → Cloudflare Pages Function).**
The current Lambda: accepts the form POST, sends **two** Mailjet emails (a
confirmation to the submitter and a notification to the team), and saves a copy of
the submission to S3. We replace it with a single Pages Function at `/api/submit`:
- Validate the JSON payload (same fields as today).
- Send both Mailjet emails via the Mailjet Send API (HTTPS REST, Basic auth with API key + secret stored as Cloudflare secrets). Mailjet is already an HTTP API, so this ports directly — no SMTP, no SigV4.
- Replace the S3 copy with a **D1** row per submission (native binding, no keys) — a queryable lead log. (R2 is the alternative if we'd rather store an opaque JSON blob; D1 chosen because leads are inherently tabular and worth being able to query/export.)
- Update `contact.html`/`consultation.html` fetch calls to the new **same-origin** `/api/submit` endpoint (eliminates the current cross-origin CORS).
- Optional hardening: add Cloudflare **Turnstile** (free CAPTCHA) to cut form spam.
- *Needed to replicate exactly:* the current Lambda source (to mirror the Mailjet message construction — whether HTML is rendered in-code from `email-templates/*.html` or via Mailjet-hosted `TemplateID`).

**5b. Go live.**
- Point DNS / custom domain at Cloudflare Pages.
- Deploy the 301 redirect map.
- Verify sitemap, canonical/OG on sample pages, forms end-to-end, and submit the sitemap to Search Console.
- Decommission the Lambda (and its S3 bucket) once the Worker path is confirmed in production.

---

## 6. Open items to confirm along the way

- **Lambda source** for exact Mailjet message construction (Phase 5a).
- **Mailjet templating pattern**: in-code HTML from `email-templates/` vs. Mailjet-hosted `TemplateID`.
- **Final editor-auth path**: Sveltia + Cloudflare Access + GitHub App (default) vs. TinaCloud (if the glue is annoying).
- **`library.html`** (154 KB) — confirm whether it's static content or a data-driven resource index that should also become a content collection.

---

## 7. Prototype slice (doing now)

Before committing to the full port, build a working vertical slice — **Phase 0–2 with
one real migrated post** — so the whole approach can be seen and felt at low sunk cost:

1. Scaffold Astro + compiled Tailwind (Phase 0).
2. Port the shared chrome: `Header`, `Footer`, `BlogHero`, `StatStrip`, layouts (Phase 1).
3. Define the blog collection + post template + listing, and migrate **one** post
   (`blog-retainer-math.html`) to Markdown so it renders through the new pipeline (Phase 2).

If the slice looks right, we proceed to the full design-system port and the scripted
migration of the remaining 30 posts.
