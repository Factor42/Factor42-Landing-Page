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

  const sub = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
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

  // Restrict surface to this repo (+ rate_limit, graphql). Token is repo-scoped
  // anyway; this is defense-in-depth.
  const allowed =
    sub === 'rate_limit' ||
    sub === 'graphql' ||
    sub === `repos/${env.ALLOWED_REPO}` ||
    sub.startsWith(`repos/${env.ALLOWED_REPO}/`);
  if (!allowed) return json({ message: `Forbidden path: ${sub}` }, 403);

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
}
