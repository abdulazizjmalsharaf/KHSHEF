export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const homeHref = (hash = '') => `${BASE}/${hash}`;

export const SESSION_RE = /^cs_test_[A-Za-z0-9]+$/;

/** Only allow redirects to Stripe-hosted checkout over https. */
export function isSafeStripeUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com' && !u.username && !u.password && (u.port === '' || u.port === '443');
  } catch {
    return false;
  }
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const d = (err as { data: unknown }).data;
    if (d && typeof d === 'object' && 'error' in d && typeof (d as { error: unknown }).error === 'string') {
      const m = (d as { error: string }).error.trim();
      if (m) return m;
    }
  }
  return fallback;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
