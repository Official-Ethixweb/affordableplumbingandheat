import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { leadApiSchema } from '../../lib/contactSchema';
import { business } from '../../data/business';
import { verifyTurnstile } from '../../lib/turnstile';
import { RESEND_API_KEY, LEAD_TO_EMAIL, LEAD_FROM_EMAIL } from 'astro:env/server';

// Server-rendered: everything else on the site is prerendered static HTML,
// this single route needs a real request/response cycle to keep the Resend
// API key server-side and to rate-limit abuse.
export const prerender = false;

// Simple in-memory fixed-window rate limit, keyed by client IP. Resets on
// deploy/restart, which is fine here: the goal is blunting basic scripted
// abuse, not a durable distributed limiter. A serverless/edge deployment
// with multiple concurrent instances would need a shared store (e.g.
// Upstash) instead — noted for production scaling, not required at this
// traffic volume.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Honeypot, checked on the raw body BEFORE schema validation: a real
  // visitor never sees or fills this hidden field, but a bot that blindly
  // fills every input populates it. The schema itself rejects a non-empty
  // company field (max length 0), so checking post-validation would never
  // run — this has to happen first, silently accepting (200, so the bot
  // doesn't learn to retry with a different pattern) and dropping the
  // submission before it reaches strict validation.
  if (typeof body === 'object' && body !== null && 'company' in body && (body as { company?: unknown }).company) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const parsed = leadApiSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid submission.' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const lead = parsed.data;

  const rateLimitKey = clientAddress ?? 'unknown';
  if (isRateLimited(rateLimitKey)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please call us instead.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // The chatbot is exempt: it's a multi-turn conversational flow with no
  // natural place for a checkbox widget, and it's already covered by the
  // honeypot and rate-limit checks above. The contact form and quick-lead
  // form both still require a verified token.
  if (lead.source !== 'chatbot') {
    const turnstile = await verifyTurnstile(lead.turnstileToken, clientAddress);
    if (!turnstile.ok) {
      if (turnstile.reason === 'not_configured') {
        return new Response(
          JSON.stringify({ error: 'Submissions are temporarily unavailable. Please try again later.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  const subjectPrefix = lead.urgent ? 'URGENT - ' : '';
  const subject = `${subjectPrefix}New ${lead.source === 'chatbot' ? 'chatbot' : 'website'} lead: ${lead.name}${lead.service ? ` (${lead.service})` : ''}`;

  const rows: [string, string][] = [
    ['Source', lead.source === 'chatbot' ? 'Chatbot' : 'Contact form'],
    ['Name', lead.name],
    ['Phone', lead.phone],
    ['Email', lead.email || ' - '],
    ['City', lead.city || ' - '],
    ['Service', lead.service || ' - '],
    ['Property type', lead.propertyType || ' - '],
    ['Urgent', lead.urgent ? 'Yes' : 'No']
  ];
  const html = `
    <h2>${escapeHtml(subject)}</h2>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="font-weight:600;border:1px solid #ddd">${escapeHtml(label)}</td><td style="border:1px solid #ddd">${escapeHtml(value)}</td></tr>`
        )
        .join('')}
    </table>
    ${lead.message ? `<p><strong>Message:</strong><br>${escapeHtml(lead.message).replace(/\n/g, '<br>')}</p>` : ''}
    ${lead.topicsDiscussed ? `<p><strong>Topics discussed:</strong> ${escapeHtml(lead.topicsDiscussed)}</p>` : ''}
    ${lead.transcript ? `<p><strong>Chat transcript:</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(lead.transcript)}</pre>` : ''}
  `;

  const toEmail = LEAD_TO_EMAIL || business.email;
  const fromEmail = LEAD_FROM_EMAIL || 'leads@notifications.affordableplumbingandheat.com';

  // RESEND_API_KEY is an optional, documented configuration point (see
  // README): without it the endpoint still validates and rate-limits
  // correctly, it just can't dispatch email yet, so local development and a
  // fresh deploy never hard-fail on a missing secret.
  if (!RESEND_API_KEY) {
    // Deliberately includes name/phone (not redacted): this fallback exists
    // so a lead is never silently lost while RESEND_API_KEY is unset — an
    // operator tailing server logs needs enough to call the person back.
    // This never reaches the client or a third party, only server-side
    // stdout/log storage, but whoever has access to that hosting platform's
    // log viewer can read it — treat server log access as PII-sensitive.
    console.warn('[api/lead] RESEND_API_KEY not configured - lead captured but not emailed:', {
      name: lead.name,
      phone: lead.phone,
      source: lead.source
    });
    return new Response(JSON.stringify({ ok: true, delivered: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: lead.email || undefined,
      subject,
      html
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[api/lead] Resend send failed:', err);
    return new Response(JSON.stringify({ error: 'Could not send right now. Please call us instead.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true, delivered: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
