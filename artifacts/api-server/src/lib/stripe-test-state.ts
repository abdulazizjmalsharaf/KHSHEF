import { createPaymentPool, getUncachableStripeClient, getStripeSync, migrateStripeTestSchema, requireTestKey, requireTestObject, TEST_PLANS } from "@workspace/stripe-test";
import type Stripe from "stripe";
import { logger } from "./logger";

let initialized = false;
let attempt: Promise<void> | null = null;
let failedUntil = 0;
export function paymentOrigin(): string {
  const configured = process.env.PAYMENT_RETURN_ORIGIN;
  const hostname = process.env.REPLIT_DOMAINS?.split(",")[0] ?? process.env.REPLIT_DEV_DOMAIN;
  const url = new URL(configured ?? `https://${hostname}`);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !url.hostname.includes(".")) throw new Error("PAYMENT_ORIGIN_INVALID");
  return url.origin;
}
export function validatePaymentConfiguration() {
  if (process.env.STRIPE_SECRET_KEY) requireTestKey(process.env.STRIPE_SECRET_KEY);
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) throw new Error("PAYMENT_COOKIE_CONFIGURATION_MISSING");
}
export async function ensureTestPaymentsReady() {
  validatePaymentConfiguration();
  if (initialized) return;
  if (Date.now() < failedUntil) throw new Error("PAYMENT_SETUP_UNAVAILABLE");
  if (attempt) return attempt;
  attempt = (async () => {
    await migrateStripeTestSchema();
    const sync = await getStripeSync();
    try {
      const hook = await sync.findOrCreateManagedWebhook(`${paymentOrigin()}/api/stripe/webhook`);
      requireTestObject(hook);
      await sync.syncBackfill({ object: "all" });
      await getTestCatalog();
      initialized = true;
      logger.info("Stripe Test Mode synchronization is ready");
    } finally { await sync.postgresClient.pool.end(); }
  })().catch(() => {
    failedUntil = Date.now() + 60_000;
    logger.warn("Stripe Test Mode setup unavailable; other features remain operational");
    throw new Error("PAYMENT_SETUP_UNAVAILABLE");
  }).finally(() => { attempt = null; });
  return attempt;
}
export async function getTestCatalog(): Promise<Map<string, string>> {
  const pool = createPaymentPool();
  try {
    const result = await pool.query<{ id: string; plan_id: string; unit_amount: number; currency: string; recurring: { interval?: string; interval_count?: number }; livemode: boolean }>(`
      SELECT pr.id, p.metadata->>'kashef_plan_id' AS plan_id, pr.unit_amount, pr.currency, pr.recurring, pr.livemode
      FROM stripe.prices pr JOIN stripe.products p ON pr.product = p.id
      WHERE pr.active = true AND p.active = true AND pr.livemode = false AND p.livemode = false
        AND p.metadata->>'kashef_test_checkout' = 'true'
        AND pr.lookup_key LIKE 'kashef_test_%_monthly_kwd'`);
    const map = new Map<string, string>();
    for (const plan of TEST_PLANS) {
      const row = result.rows.find((r) => r.plan_id === plan.id && Number(r.unit_amount) === plan.amount &&
        r.currency === "kwd" && r.recurring?.interval === "month" && r.recurring.interval_count === 1);
      if (!row) throw new Error("TEST_CATALOG_NOT_SEEDED");
      map.set(plan.id, row.id);
    }
    return map;
  } finally { await pool.end(); }
}
export async function verifySessionCart(stripe: Stripe, session: Stripe.Checkout.Session) {
  requireTestObject(session);
  const ids = session.metadata?.kashef_plan_ids?.split(",") ?? [];
  if (!ids.length || ids.length > 3 || new Set(ids).size !== ids.length || session.metadata?.kashef_test_checkout !== "true" || session.mode !== "subscription") throw new Error("INVALID_TEST_SESSION");
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  const catalog = await getTestCatalog();
  if (lines.has_more || lines.data.length !== ids.length) throw new Error("INVALID_TEST_SESSION");
  let expected = 0;
  for (const id of ids) {
    const plan = TEST_PLANS.find((p) => p.id === id);
    const line = lines.data.find((l) => l.price?.id === catalog.get(id));
    if (!plan || !line || line.quantity !== 1 || !line.price || line.price.livemode || line.price.unit_amount !== plan.amount || line.price.currency !== "kwd") throw new Error("INVALID_TEST_SESSION");
    expected += plan.amount;
  }
  if (session.currency !== "kwd" || session.amount_total !== expected) throw new Error("INVALID_TEST_SESSION");
  return ids;
}
export { getUncachableStripeClient };
