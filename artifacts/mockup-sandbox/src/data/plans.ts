export type PlanId = 'small-restaurant' | 'growth' | 'chain';

export type Plan = {
  id: PlanId;
  name: string;
  priceFils: number;
  interval: 'month';
  audience: string;
};

/** Approved names and prices only. No quotas or entitlements are defined yet. */
export const PLANS: readonly Plan[] = [
  { id: 'small-restaurant', name: 'مطعم صغير', priceFils: 9000, interval: 'month', audience: 'لمطعم أو مقهى بفرع واحد يبدأ بمراجعة فواتيره.' },
  { id: 'growth', name: 'نمو', priceFils: 24000, interval: 'month', audience: 'لمطعم يتعامل مع موردين أكثر ويريد ترتيبًا أوضح.' },
  { id: 'chain', name: 'سلسلة', priceFils: 59000, interval: 'month', audience: 'لعدة فروع تُراجع فواتيرها في مكان واحد.' },
] as const;

const IDS = new Set<string>(PLANS.map((p) => p.id));
export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && IDS.has(v);
export const getPlan = (id: PlanId) => PLANS.find((p) => p.id === id)!;
