import Stripe from "stripe";
import { StripeSync, runMigrations } from "stripe-replit-sync";
import pg from "pg";

export const TEST_PLANS = [
  { id: "small-restaurant", name: "مطعم صغير", amount: 9000 },
  { id: "growth", name: "نمو", amount: 24000 },
  { id: "chain", name: "سلسلة", amount: 59000 },
] as const;
export type TestPlanId = typeof TEST_PLANS[number]["id"];
export const validPlanId = (id: unknown): id is TestPlanId => TEST_PLANS.some((p) => p.id === id);
export function requireTestKey(key: string) {
  if (!/^(sk|rk)_test_/.test(key)) throw new Error("STRIPE_TEST_MODE_REQUIRED");
}
export function requireTestObject(object: { livemode?: boolean }) {
  if (object.livemode !== false) throw new Error("STRIPE_LIVE_OBJECT_REFUSED");
}

async function credentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  // Explicit Secrets configuration also supports external PostgreSQL/Stripe setups.
  if (process.env.STRIPE_SECRET_KEY) {
    requireTestKey(process.env.STRIPE_SECRET_KEY);
    return { secretKey: process.env.STRIPE_SECRET_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY ? `repl ${process.env.REPL_IDENTITY}` :
    process.env.WEB_REPL_RENEWAL ? `depl ${process.env.WEB_REPL_RENEWAL}` : null;
  if (!hostname || !token) throw new Error("STRIPE_CONNECTION_UNAVAILABLE");
  const res = await fetch(`https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`, {
    headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("STRIPE_CONNECTION_UNAVAILABLE");
  const data = await res.json() as { items?: { settings?: { secret_key?: string; webhook_secret?: string } }[] };
  const settings = data.items?.[0]?.settings;
  if (!settings?.secret_key) throw new Error("STRIPE_CONNECTION_UNAVAILABLE");
  requireTestKey(settings.secret_key);
  return { secretKey: settings.secret_key, webhookSecret: settings.webhook_secret };
}
export async function getUncachableStripeClient() {
  const { secretKey } = await credentials();
  return new Stripe(secretKey, { timeout: 15_000, maxNetworkRetries: 1 });
}

export function supabaseConnectionString(): string {
  const value = process.env.SUPABASE_DATABASE_URL;
  if (!value) throw new Error("SUPABASE_CONNECTION_MISSING");
  let valid = false;
  try {
    const parsed = new URL(value);
    const projectRef = new URL(process.env.VITE_SUPABASE_URL ?? "").hostname.split(".")[0];
    valid = ["postgres:", "postgresql:"].includes(parsed.protocol) && Boolean(parsed.password) &&
      !parsed.password.includes("[") &&
      (parsed.hostname === `db.${projectRef}.supabase.co` ||
        (parsed.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(parsed.username) === `postgres.${projectRef}`));
  } catch { /* Do not expose URL parsing errors, which can contain credentials. */ }
  if (!valid) throw new Error("SUPABASE_CONNECTION_INVALID");
  return value;
}
export function createPaymentPool() {
  return new pg.Pool({
    connectionString: supabaseConnectionString(),
    ssl: { rejectUnauthorized: true },
    max: 3, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000,
  });
}
const quietLogger = { info() {}, warn() {}, error() {} };
export async function getStripeSync() {
  const { secretKey, webhookSecret } = await credentials();
  return new StripeSync({
    poolConfig: { connectionString: supabaseConnectionString(), ssl: { rejectUnauthorized: true }, max: 3, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 },
    stripeSecretKey: secretKey, stripeWebhookSecret: webhookSecret ?? "",
    logger: quietLogger,
  });
}
export async function migrateStripeTestSchema() {
  // Check mode before any writes. Do not touch the existing suppliers table.
  const stripe = await getUncachableStripeClient();
  requireTestObject(await stripe.balance.retrieve());
  await runMigrations({ databaseUrl: supabaseConnectionString(), ssl: { rejectUnauthorized: true }, logger: quietLogger });
  const pool = createPaymentPool();
  try {
    await pool.query(`REVOKE ALL ON SCHEMA stripe FROM anon, authenticated;
      REVOKE ALL ON ALL TABLES IN SCHEMA stripe FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA stripe REVOKE ALL ON TABLES FROM anon, authenticated;`);
  } finally { await pool.end(); }
}
