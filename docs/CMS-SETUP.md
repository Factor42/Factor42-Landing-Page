# CMS Setup — Sveltia CMS + Editor Login

The CMS is already in the repo:

- `public/admin/index.html` — loads Sveltia CMS
- `public/admin/config.yml` — the blog collection form (maps 1:1 to post frontmatter)

Once deployed it lives at **`https://<your-site>/admin/`**. Editors write posts in
a friendly form; saving commits Markdown to `src/content/blog/` on `main`, which
triggers a Cloudflare Pages rebuild. No database, no server.

What's left is **authentication** — the steps below require your GitHub and
Cloudflare accounts, so they're done in those dashboards (not in code).

---

## Quickest test right now — local editing (no accounts needed)

You can try the whole editing experience against your local files before wiring any auth:

1. In `public/admin/config.yml`, uncomment `local_backend: true`.
2. Run the dev server (`npm run dev`) and open <http://localhost:4321/admin/> in
   **Chrome or Edge** (needs the File System Access API).
3. Click **"Work with Local Repository"** and pick this project folder.
4. Edit/create a post, hit publish → it writes the `.md` file locally. Re-comment
   `local_backend` when done.

This proves the form/schema; the steps below make it work for remote editors.

---

## Production auth — two paths, pick one

The tension we discussed: a git-backed CMS authenticates the editor to **GitHub**.
There are two realistic ways to handle non-technical editors.

### Path A — GitHub OAuth (fastest; editors sign in with GitHub)

Editors need a GitHub account added as a repo collaborator. ~15 minutes total.

**1. Create a GitHub OAuth App**
- GitHub → *Settings → Developer settings → OAuth Apps → New OAuth App*
- Homepage URL: `https://<your-site>`
- Authorization callback URL: `https://factor42-cms-auth.<your-subdomain>.workers.dev/callback`
  (the Worker URL from step 2 — you can come back and edit this)
- Save the **Client ID** and generate a **Client Secret**.

**2. Deploy the OAuth handler as a Cloudflare Worker**
Sveltia's maintained handler: <https://github.com/sveltia/sveltia-cms-auth>
```bash
git clone https://github.com/sveltia/sveltia-cms-auth
cd sveltia-cms-auth
npm install
npx wrangler deploy
# then set the secrets:
npx wrangler secret put GITHUB_CLIENT_ID       # paste Client ID
npx wrangler secret put GITHUB_CLIENT_SECRET    # paste Client Secret
# and set ALLOWED_DOMAINS = your-site.com (var) so only your site can use it
```
Note the deployed Worker URL.

**3. Point the CMS at the handler**
In `public/admin/config.yml`, under `backend:`, uncomment and set:
```yaml
    base_url: https://factor42-cms-auth.<your-subdomain>.workers.dev
```

**4. Add editors**
Add each editor as a **collaborator** on the GitHub repo (Settings → Collaborators).
They visit `/admin/`, click "Sign in with GitHub", and they're in.

### Path B — Email login, no GitHub (built) ✅

Editors log in with a plain email one-time-PIN via **Cloudflare Access** and never
touch GitHub; all commits are made by a **GitHub App** bot. The Cloudflare Pages
Functions that make this work are already in the repo (`functions/api/cms/`), and
`config.yml` already points at them.

**Full step-by-step (GitHub App, Pages env vars, Cloudflare Access): [CMS-AUTH.md](CMS-AUTH.md).**

This path skips the separate OAuth Worker in Path A entirely — the proxy under
`/api/cms/*` handles both login and all GitHub API calls, same-origin.

### Path C — If email/password must be zero-friction: TinaCloud

If Paths A/B feel too fiddly, **TinaCloud** (free tier) gives editors an
email/password login out of the box and still commits Markdown to this repo — at
the cost of a light SaaS dependency. Swap `public/admin/` for Tina's setup; the
content files don't change. Say the word and I'll wire it instead.

---

## After auth works

- Editors go to `/admin/`, create a post, pick a **colour theme** + **filter group**,
  write the body, and publish.
- The commit triggers a Cloudflare Pages build; the post is live in ~1 minute at
  `/blog/<slug>` and appears on `/blog` automatically.
- Deleting/renaming is handled in the CMS too.

## Notes
- Pin the Sveltia version in `public/admin/index.html` (currently `@0.107.0`) and
  bump deliberately.
- `media_folder` is `public/images/blog` — images added in post bodies land there.
- The `preview_path` (`blog/{{slug}}`) powers the CMS's live preview link.
