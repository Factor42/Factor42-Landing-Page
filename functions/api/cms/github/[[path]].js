/**
 * GitHub API proxy for the CMS (api_root target).
 *
 * Every request:
 *   1. must carry a valid Cloudflare Access assertion (editor passed email OTP)
 *   2. is re-authorized with a fresh GitHub App installation token (bot identity)
 *   3. is restricted to the one allowed repo (+ /user, /rate_limit)
 *
 * GET /user is synthesized because installation tokens cannot call it, and the
 * CMS needs a "current user" to log in.
 */
import { verifyAccess, installationToken, GH, UA } from '../_lib.js';

const PROXY_BASE = '/api/cms/github';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;

  const access = await verifyAccess(request, env);
  if (!access.ok) return json({ message: `Unauthorized: ${access.reason}` }, 401);

  let sub = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  // Sveltia/Decap address a custom api_root as if it were a GitHub Enterprise
  // host: REST calls come in under `api/v3/...` and GraphQL under `api/graphql`.
  // Normalize back to github.com-style paths before routing.
  if (sub.startsWith('api/v3/')) sub = sub.slice(7);
  else if (sub === 'api/graphql') sub = 'graphql';
  const url = new URL(request.url);

  // Synthetic current user (app tokens can't hit /user).
  if (sub === 'user') {
    return json({
      login: 'factor42-cms[bot]',
      name: 'Factor42 CMS',
      avatar_url: '',
      html_url: `https://github.com/${env.ALLOWED_REPO}`,
    });
  }

  // Synthesize the repo-access check: the CMS verifies the current user is a
  // collaborator with push access. The App bot has write via its installation,
  // so report write access without calling GitHub.
  if (sub.startsWith(`repos/${env.ALLOWED_REPO}/collaborators/`)) {
    return sub.endsWith('/permission')
      ? json({ permission: 'write', role_name: 'write', user: { login: 'factor42-cms[bot]' } })
      : new Response(null, { status: 204 });
  }

  // Restrict surface to this repo (+ rate_limit, graphql). Token is repo-scoped
  // anyway; this is defense-in-depth.
  const allowed =
    sub === 'rate_limit' ||
    sub === 'graphql' ||
    sub === `repos/${env.ALLOWED_REPO}` ||
    sub.startsWith(`repos/${env.ALLOWED_REPO}/`);
  if (!allowed) return json({ message: `Forbidden path: ${sub}` }, 403);

  try {
    const token = await installationToken(env);
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', request.headers.get('Accept') || 'application/vnd.github+json');
    headers.set('User-Agent', UA);
    const ct = request.headers.get('Content-Type');
    if (ct) headers.set('Content-Type', ct);

    const init = { method: request.method, headers };
    if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text();

    const upstream = await fetch(`${GH}/${sub}${url.search}`, init);

    const out = new Headers();
    out.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    out.set('Cache-Control', 'no-store');
    // Rewrite pagination links back through the proxy.
    const link = upstream.headers.get('Link');
    if (link) out.set('Link', link.split(GH).join(`${url.origin}${PROXY_BASE}`));
    const scopes = upstream.headers.get('X-OAuth-Scopes');
    if (scopes) out.set('X-OAuth-Scopes', scopes);

    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (e) {
    // TEMP (while wiring up): surface the real mint/proxy error instead of a bare 500.
    console.error('CMS proxy error', e);
    return json({ message: 'proxy error', error: String(e), sub }, 500);
  }
}
