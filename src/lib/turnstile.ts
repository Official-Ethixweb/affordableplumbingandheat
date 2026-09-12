import { TURNSTILE_SECRET_KEY } from 'astro:env/server';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// VERCEL_ENV is set by Vercel's build/runtime and is not client-influenced;
// NODE_ENV covers non-Vercel environments. Anything that isn't explicitly
// "development" or "preview" is treated as production - fail closed by
// default rather than trusting an absent/unexpected value.
function isProduction(): boolean {
  const env = process.env.VERCEL_ENV ?? import.meta.env.MODE;
  return env !== 'development' && env !== 'preview' && env !== 'test';
}

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'missing_token' | 'invalid_token' | 'verify_error' };

/**
 * Verifies a Cloudflare Turnstile token server-side. Fails CLOSED in
 * production: a missing secret key, missing token, or failed verification
 * all reject the request. The only bypass is for local/preview development
 * without a configured secret, so contributors aren't forced to provision a
 * Turnstile widget just to run the app - that bypass never applies when
 * isProduction() is true.
 */
export async function verifyTurnstile(token: unknown, clientAddress?: string): Promise<TurnstileResult> {
  const secret = TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (isProduction()) {
      console.error('[turnstile] TURNSTILE_SECRET_KEY is not configured in production');
      return { ok: false, reason: 'not_configured' };
    }
    return { ok: true };
  }

  if (typeof token !== 'string' || !token) {
    return { ok: false, reason: 'missing_token' };
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        ...(clientAddress ? { remoteip: clientAddress } : {})
      })
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return data?.success === true ? { ok: true } : { ok: false, reason: 'invalid_token' };
  } catch (err) {
    console.error('[turnstile] verification request failed:', err);
    return { ok: false, reason: 'verify_error' };
  }
}
