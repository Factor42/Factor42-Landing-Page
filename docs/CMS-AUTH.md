# CMS Auth — GitHub-free editor login (GitHub App bot + Cloudflare Access)

This is **Path B** from [CMS-SETUP.md](CMS-SETUP.md), fully built. Editors log in
with a plain **email one-time-PIN** (Cloudflare Access) and never touch GitHub. All
commits are made by a **GitHub App** bot identity.

## How it works

```
Editor → /admin  ──Cloudflare Access (email OTP)──►  Sveltia CMS loads
CMS  → /api/cms/auth            (Pages Function)  →  completes login handshake
CMS  → /api/cms/github/*        (Pages Function)  →  verifies Access assertion,
                                                     injects a GitHub App
                                                     installation token,
                                                     proxies to api.github.com
```

Everything is **same-origin** (`factor42media.com`), so the Access cookie flows to
the proxy automatically — no CORS, no OAuth redirect, no per-editor GitHub account.

Code already in the repo:
- `functions/api/cms/_lib.js` — App JWT, installation token, Access verification
- `functions/api/cms/auth.js` — login handshake
- `functions/api/cms/github/[[path]].js` — the GitHub API proxy
- `public/admin/config.yml` — `base_url` / `auth_endpoint` / `api_root` point at the proxy

## One-time setup

### 1. Create a GitHub App
GitHub → *Settings → Developer settings → GitHub Apps → New GitHub App*
- **Name:** Factor42 CMS (anything)
- **Homepage URL:** `https://factor42media.com`
- **Webhook:** uncheck *Active* (not needed)
- **Repository permissions → Contents: Read and write** (this is the only one required)
- **Where can this be installed:** Only on this account
- Create, then **Install** it → select **only** the `Factor42-Landing-Page` repo.
- On the app page note the **App ID**. Under *Private keys* → **Generate a private key**
  (downloads a `.pem`).

Convert the key to PKCS#8 (WebCrypto can't read GitHub's default PKCS#1):
```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
  -in your-app.private-key.pem -out app.pkcs8.pem
```

### 2. Deploy the site to Cloudflare Pages
Connect the GitHub repo to Cloudflare Pages (see [DEPLOY.md](DEPLOY.md) when Phase 5
lands). Build command `npm run build`, output dir `dist-astro`. Pages auto-detects
the `functions/` directory.

### 3. Set Pages environment variables (Settings → Environment variables → Production)
Mark the private key as a **Secret**.

| Name | Value |
|---|---|
| `GITHUB_APP_ID` | the App ID from step 1 |
| `GITHUB_PRIVATE_KEY` | full contents of `app.pkcs8.pem` (with BEGIN/END lines) |
| `GITHUB_INSTALLATION_ID` | *(optional)* the installation id; auto-looked-up if omitted |
| `ALLOWED_REPO` | `nhattran72822-del/Factor42-Landing-Page` |
| `CF_ACCESS_TEAM_DOMAIN` | `yourteam.cloudflareaccess.com` (from step 4) |
| `CF_ACCESS_AUD` | the Access application AUD tag (from step 4) |

### 4. Protect the admin + proxy with Cloudflare Access
Cloudflare Dashboard → **Zero Trust → Access → Applications → Add → Self-hosted**.
Create an application covering **both** paths (add two, or one per path):
- `factor42media.com/admin`
- `factor42media.com/api/cms`

For each:
- **Policy:** *Allow* → Include → **Emails** → list your editors' addresses
- **Login method:** enable **One-time PIN** (email) in Zero Trust → Settings →
  Authentication, so editors need no account.
- After creating, open the application's **Overview** and copy its **Application
  Audience (AUD) Tag** → that's `CF_ACCESS_AUD`. Your team domain
  (`yourteam.cloudflareaccess.com`) is `CF_ACCESS_TEAM_DOMAIN`.

> Both paths must be behind Access so the proxy can trust the `Cf-Access-Jwt-Assertion`.
> The proxy independently verifies that assertion (signature + `aud` + expiry), so a
> direct hit to `/api/cms/github/*` without a valid Access token is rejected.

### 5. Redeploy and test
Redeploy so the functions pick up the env vars. Visit `https://factor42media.com/admin/`:
you should get the Cloudflare email-PIN screen, then the CMS. Create a test post →
it commits as the bot → Pages rebuilds → live in ~1 min.

## Onboarding an editor
Add their email to the Access policy (step 4). That's it — no GitHub account, no repo
access. Remove the email to offboard.

## Notes & limits
- Installation tokens last ~1 hour. The proxy caches and refreshes them; an editing
  session longer than an hour just re-mints transparently. If a commit ever fails with
  401, reloading `/admin/` fixes it.
- The proxy restricts calls to `repos/<ALLOWED_REPO>` (+ `user`, `rate_limit`,
  `graphql`), so the bot can't touch anything else even if the token were broader.
- **Sveltia vs Decap:** this uses Decap-compatible `api_root`. If a future Sveltia
  version ignores `api_root`, switch `public/admin/index.html` to Decap CMS — the
  `config.yml` is already Decap-compatible:
  ```html
  <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
  ```
- Local editing (`local_backend: true`) still works on localhost and bypasses all of
  the above — handy for content work without deploying.
