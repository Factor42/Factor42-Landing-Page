/**
 * Form handler (replaces the AWS Lambda). On POST it:
 *   1. sends a confirmation email to the submitter (rendered from the HTML template)
 *   2. sends a notification email to the team
 *   3. stores the submission as a row in D1 (done first, so a mail outage
 *      never loses the lead)
 * via Postmark (https://postmarkapp.com). Same-origin, so no CORS needed.
 *
 * Env (Pages settings):
 *   POSTMARK_SERVER_TOKEN   - Postmark Server API token (secret)
 *   FROM_EMAIL              - sender on a domain/signature verified in Postmark
 *   FROM_NAME               - sender display name (defaults to "Factor42")
 *   POSTMARK_MESSAGE_STREAM - optional; defaults to "outbound" (transactional)
 *   TEAM_EMAIL              - where notifications go
 *   DB                      - D1 binding (optional; write is best-effort)
 */
import { contactConfirmation, consultationConfirmation } from './_email-templates.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Minimal Handlebars-subset renderer: {{#each x}}..{{this}}..{{/each}}, {{#if x}}..{{/if}}, {{var}}.
function render(tpl, data) {
  return tpl
    .replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, inner) => {
      const arr = data[key];
      return Array.isArray(arr) ? arr.map((it) => inner.replace(/\{\{this\}\}/g, esc(it))).join('') : '';
    })
    .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
      const v = data[key];
      return v && !(Array.isArray(v) && v.length === 0) ? inner : '';
    })
    .replace(/\{\{(\w+)\}\}/g, (_, key) => esc(data[key]));
}

const isEmail = (s) => typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

function notificationHtml(kind, d) {
  const rows = Object.entries(d)
    .filter(([k]) => k !== '_template')
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${esc(k)}</td><td style="padding:4px 0"><strong>${esc(Array.isArray(v) ? v.join(', ') : v)}</strong></td></tr>`)
    .join('');
  return `<div style="font-family:Inter,Arial,sans-serif"><h2>New ${esc(kind)} submission</h2><table>${rows}</table></div>`;
}

// Send one email via Postmark (https://postmarkapp.com).
// Postmark can return HTTP 200 with a non-zero ErrorCode, so success requires
// both a 2xx status and ErrorCode 0. Returns { ok, status, detail }.
async function sendPostmark(env, { to, subject, html, replyTo }) {
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
    },
    body: JSON.stringify({
      From: `${env.FROM_NAME || 'Factor42'} <${env.FROM_EMAIL}>`,
      To: to,
      Subject: subject,
      HtmlBody: html,
      MessageStream: env.POSTMARK_MESSAGE_STREAM || 'outbound',
      ...(replyTo ? { ReplyTo: replyTo } : {}),
    }),
  });
  let detail = null;
  try {
    detail = await res.json();
  } catch {
    /* non-JSON error body */
  }
  return { ok: res.ok && detail?.ErrorCode === 0, status: res.status, detail };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!isEmail(data.email) || !(data.message || data.challenge)) {
    return json({ error: 'Missing required fields' }, 422);
  }

  const isConsultation =
    data._template === 'email-consultation-confirmation.html' || 'challenge' in data || 'role' in data;
  const kind = isConsultation ? 'consultation' : 'contact';
  const template = isConsultation ? consultationConfirmation : contactConfirmation;

  // Capture the lead in D1 FIRST, so an email outage never loses it.
  let stored = false;
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO submissions
           (type, first_name, last_name, email, company, subject, message,
            phone, role, company_type, monthly_ad_spend, platforms, challenge, payload)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
        .bind(
          kind,
          data.first_name ?? null,
          data.last_name ?? null,
          data.email ?? null,
          data.company ?? null,
          data.subject ?? null,
          data.message ?? null,
          data.phone ?? null,
          data.role ?? null,
          data.company_type ?? null,
          data.monthly_ad_spend ?? null,
          Array.isArray(data.platforms) ? data.platforms.join(', ') : (data.platforms ?? null),
          data.challenge ?? null,
          JSON.stringify(data)
        )
        .run();
      stored = true;
    } catch (e) {
      console.error('D1 insert failed', e);
    }
  }

  // Send confirmation (to submitter) + notification (to team) via Postmark.
  let emailed = false;
  try {
    const [confirmation, notification] = await Promise.all([
      sendPostmark(env, {
        to: data.email,
        subject: isConsultation
          ? 'Your Factor42 consultation request'
          : 'We received your message — Factor42',
        html: render(template, data),
      }),
      sendPostmark(env, {
        to: env.TEAM_EMAIL,
        subject: `New ${kind} submission${data.company ? ` — ${data.company}` : ''}`,
        html: notificationHtml(kind, data),
        replyTo: data.email,
      }),
    ]);
    emailed = confirmation.ok && notification.ok;
    if (!emailed) {
      console.error(
        'Postmark error',
        confirmation.status,
        JSON.stringify(confirmation.detail),
        '|',
        notification.status,
        JSON.stringify(notification.detail)
      );
    }
  } catch (e) {
    console.error('Postmark request failed', e);
  }

  // Succeed if the lead was captured or emailed; fail only if both failed.
  if (!stored && !emailed) return json({ error: 'Submission failed' }, 502);
  return json({ ok: true, emailed, stored });
}
