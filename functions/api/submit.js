/**
 * Form handler (replaces the AWS Lambda). On POST it:
 *   1. sends a confirmation email to the submitter (rendered from the HTML template)
 *   2. sends a notification email to the team
 *   3. stores the submission as a row in D1
 * via Mailjet's Send API v3.1. Same-origin, so no CORS needed.
 *
 * Env (Pages settings):
 *   MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE  - Mailjet API key pair (secrets)
 *   MJ_FROM_EMAIL, MJ_FROM_NAME          - verified Mailjet sender
 *   TEAM_EMAIL                           - where notifications go
 *   DB                                   - D1 binding (optional; write is best-effort)
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

  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  const from = { Email: env.MJ_FROM_EMAIL, Name: env.MJ_FROM_NAME || 'Factor42' };

  const messages = [
    {
      From: from,
      To: [{ Email: data.email, Name: name || data.email }],
      Subject: isConsultation
        ? 'Your Factor42 consultation request'
        : 'We received your message — Factor42',
      HTMLPart: render(template, data),
    },
    {
      From: from,
      To: [{ Email: env.TEAM_EMAIL, Name: 'Factor42 Team' }],
      ReplyTo: { Email: data.email, Name: name || data.email },
      Subject: `New ${kind} submission${data.company ? ` — ${data.company}` : ''}`,
      HTMLPart: notificationHtml(kind, data),
    },
  ];

  // Send via Mailjet
  const mjRes = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${env.MJ_APIKEY_PUBLIC}:${env.MJ_APIKEY_PRIVATE}`),
    },
    body: JSON.stringify({ Messages: messages }),
  });

  if (!mjRes.ok) {
    const detail = await mjRes.text();
    console.error('Mailjet error', mjRes.status, detail);
    // TEMP DEBUG — remove after diagnosing deploy. Surfaces the real cause.
    return json(
      {
        error: 'Email delivery failed',
        _debug: {
          mjStatus: mjRes.status,
          mjDetail: detail.slice(0, 400),
          env: {
            MJ_APIKEY_PUBLIC: !!env.MJ_APIKEY_PUBLIC,
            MJ_APIKEY_PRIVATE: !!env.MJ_APIKEY_PRIVATE,
            MJ_FROM_EMAIL: env.MJ_FROM_EMAIL || null,
            MJ_FROM_NAME: env.MJ_FROM_NAME || null,
            TEAM_EMAIL: !!env.TEAM_EMAIL,
          },
        },
      },
      502
    );
  }

  // Store in D1 (best-effort — never fail the request on a logging error)
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
    } catch (e) {
      console.error('D1 insert failed', e);
    }
  }

  return json({ ok: true });
}
