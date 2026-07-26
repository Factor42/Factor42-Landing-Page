/**
 * CMS login handshake (Decap/Sveltia OAuth popup protocol).
 *
 * We skip real GitHub OAuth entirely: the editor has already passed Cloudflare
 * Access, so we just complete the CMS's popup handshake with a placeholder token.
 * The real GitHub credential is the App installation token injected by the
 * `/api/cms/github/*` proxy — the placeholder here is never used against GitHub.
 */
import { verifyAccess } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;

  const access = await verifyAccess(request, env);
  if (!access.ok) return new Response(`Unauthorized: ${access.reason}`, { status: 401 });

  const provider = 'github';
  const payload = JSON.stringify({ token: 'cms-proxy', provider });
  const message = `authorization:${provider}:success:${payload}`;

  const html = `<!doctype html><html><body><p>Signing you in…</p><script>
  (function () {
    function receive(e) {
      window.opener && window.opener.postMessage(${JSON.stringify(message)}, e.origin);
      window.removeEventListener('message', receive, false);
    }
    window.addEventListener('message', receive, false);
    window.opener && window.opener.postMessage('authorizing:${provider}', '*');
  })();
  </script></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
