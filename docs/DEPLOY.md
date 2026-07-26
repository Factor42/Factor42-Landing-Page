# Deploy — Cloudflare Pages

Static Astro build + Pages Functions (form handler, CMS auth proxy), D1 for form
submissions, and 301s off the old `.html` URLs. All free-tier.

## Build settings
| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist-astro` |
| Functions | auto-detected from `functions/` |
| Redirects | `public/_redirects` (copied to output root) |

## 1. Connect the repo
Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** →
pick `Factor42-Landing-Page`, set the build command/output above, deploy.

Then add the custom domain `factor42media.com` (Pages → Custom domains). Since the
domain's DNS is already on Cloudflare, this is a couple of clicks.

## 2. Create the D1 database (form submissions)
```bash
wrangler d1 create factor42-submissions          # copy the database_id it prints
# paste it into wrangler.toml -> [[d1_databases]].database_id
wrangler d1 execute factor42-submissions --remote --file=migrations/0001_submissions.sql
```
In **Pages → Settings → Functions → D1 database bindings**, bind
`factor42-submissions` as **`DB`**.

## 3. Environment variables (Pages → Settings → Environment variables)
Mark keys/secrets as **encrypted**.

**Form handler (Mailjet):**
| Name | Value |
|---|---|
| `MJ_APIKEY_PUBLIC` | Mailjet API key (public) |
| `MJ_APIKEY_PRIVATE` | Mailjet secret key |
| `MJ_FROM_EMAIL` | a **verified** Mailjet sender address |
| `MJ_FROM_NAME` | e.g. `Factor42` |
| `TEAM_EMAIL` | where submission notifications go |

**CMS auth (GitHub App bot)** — see [CMS-AUTH.md](CMS-AUTH.md) for the full list:
`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `ALLOWED_REPO`, `CF_ACCESS_TEAM_DOMAIN`,
`CF_ACCESS_AUD` (+ optional `GITHUB_INSTALLATION_ID`).

## 4. Cloudflare Access for the CMS
Protect `factor42media.com/admin` and `factor42media.com/api/cms` with email OTP —
steps in [CMS-AUTH.md](CMS-AUTH.md). (The `/api/submit` form endpoint stays public.)

## 5. Verify after deploy
- **Redirects:** `curl -I https://factor42media.com/blog-retainer-math.html` → `301`
  to `/blog/retainer-math`.
- **Forms:** submit a test on `/contact` and `/consultation` → confirmation email
  arrives, team notification arrives, and a row appears:
  `wrangler d1 execute factor42-submissions --remote --command "SELECT id,type,email,created_at FROM submissions ORDER BY id DESC LIMIT 5"`
- **CMS:** `/admin` → email-PIN → create a test post → commits → rebuild → live.
- **Sitemap/canonical:** spot-check a few pages; submit `sitemap-index.xml` in Google
  Search Console.

## 6. Decommission
Once forms + redirects are confirmed in production, retire the AWS Lambda and its S3
bucket. Keep Mailjet (unchanged).

## Local development
```bash
npm run dev                       # Astro only (no Functions)
npx wrangler pages dev            # full stack: static + Functions + D1 (needs wrangler.toml bindings)
```
Regenerate derived files if sources change:
```bash
node scripts/gen-redirects.mjs           # after adding/renaming posts or pages
node scripts/build-email-templates.mjs   # after editing email-templates/*.html
```
