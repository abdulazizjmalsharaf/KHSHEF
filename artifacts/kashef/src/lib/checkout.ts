export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const homeHref = (hash = '') => `${BASE}/${hash}`;

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
