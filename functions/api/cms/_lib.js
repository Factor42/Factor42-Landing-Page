/**
 * Shared helpers for the CMS auth + GitHub App proxy (Cloudflare Pages Functions).
 *
 * Editors reach these functions only after passing Cloudflare Access (email OTP),
 * so no editor ever authenticates to GitHub. Every GitHub API call is signed with
 * a short-lived GitHub App *installation* token minted here from the app private
 * key — a single bot identity, scoped to this one repo.
 *
 * Required env (set as Pages secrets/vars):
 *   GITHUB_APP_ID           - the GitHub App's numeric App ID
 *   GITHUB_PRIVATE_KEY      - the app private key in PKCS#8 PEM (BEGIN PRIVATE KEY)
 *   GITHUB_INSTALLATION_ID  - (optional) installation id; looked up if omitted
 *   ALLOWED_REPO            - "owner/name" this proxy is allowed to touch
 *   CF_ACCESS_TEAM_DOMAIN   - e.g. yourteam.cloudflareaccess.com
 *   CF_ACCESS_AUD           - the Access application's AUD tag
 */

const GH = 'https://api.github.com';
const UA = 'factor42-cms-proxy';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------- base64url ----------
export function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  s += '='.repeat(pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const jsonToB64url = (obj) => bytesToB64url(encoder.encode(JSON.stringify(obj)));

// ---------- GitHub App JWT + installation token ----------
function pemToDer(pem) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  return b64urlToBytes(body);
}

async function appJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const head = jsonToB64url({ alg: 'RS256', typ: 'JWT' });
  const payload = jsonToB64url({ iat: now - 60, exp: now + 540, iss: String(env.GITHUB_APP_ID) });
  const data = `${head}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(env.GITHUB_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(data));
  return `${data}.${bytesToB64url(new Uint8Array(sig))}`;
}

let tokenCache = null; // { token, exp } — reused across requests within an isolate
export async function installationToken(env) {
  if (tokenCache && tokenCache.exp - Date.now() > 5 * 60 * 1000) return tokenCache.token;
  const jwt = await appJwt(env);
  const auth = { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent': UA };

  let instId = env.GITHUB_INSTALLATION_ID;
  if (!instId) {
    const r = await fetch(`${GH}/repos/${env.ALLOWED_REPO}/installation`, { headers: auth });
    if (!r.ok) throw new Error(`installation lookup failed: ${r.status}`);
    instId = (await r.json()).id;
  }
  const r = await fetch(`${GH}/app/installations/${instId}/access_tokens`, { method: 'POST', headers: auth });
  if (!r.ok) throw new Error(`token mint failed: ${r.status}`);
  const j = await r.json();
  tokenCache = { token: j.token, exp: Date.parse(j.expires_at) };
  return j.token;
}

// ---------- Cloudflare Access verification ----------
let jwksCache = null; // { keys: {kid: CryptoKey}, exp }
async function accessKeys(teamDomain) {
  if (jwksCache && jwksCache.exp > Date.now()) return jwksCache.keys;
  const r = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  const { keys } = await r.json();
  const map = {};
  for (const jwk of keys) {
    map[jwk.kid] = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  }
  jwksCache = { keys: map, exp: Date.now() + 60 * 60 * 1000 };
  return map;
}

function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

/** Returns { ok, email? , reason? }. */
export async function verifyAccess(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie(request, 'CF_Authorization');
  if (!token) return { ok: false, reason: 'no Access token' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  const [h, p, s] = parts;

  let header;
  try {
    header = JSON.parse(decoder.decode(b64urlToBytes(h)));
  } catch {
    return { ok: false, reason: 'bad header' };
  }
  const keys = await accessKeys(env.CF_ACCESS_TEAM_DOMAIN);
  const key = keys[header.kid];
  if (!key) return { ok: false, reason: 'unknown key id' };

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), encoder.encode(`${h}.${p}`));
  if (!valid) return { ok: false, reason: 'bad signature' };

  const payload = JSON.parse(decoder.decode(b64urlToBytes(p)));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return { ok: false, reason: 'expired' };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (env.CF_ACCESS_AUD && !auds.includes(env.CF_ACCESS_AUD)) return { ok: false, reason: 'aud mismatch' };
  return { ok: true, email: payload.email };
}

export { GH, UA };
