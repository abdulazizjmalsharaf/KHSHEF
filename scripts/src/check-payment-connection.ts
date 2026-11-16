import { createPaymentPool, getUncachableStripeClient, requireTestObject } from "@workspace/stripe-test";

// Safe health check: no credentials, server messages or connection strings in output.
let stage = "supabase";
let pool: ReturnType<typeof createPaymentPool> | undefined;
try {
  pool = createPaymentPool();
  await pool.query("select 1");
  stage = "stripe";
  const stripe = await getUncachableStripeClient();
  requireTestObject(await stripe.balance.retrieve());
  console.info(JSON.stringify({ stripeTest: true, supabaseConnected: true }));
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  const ownMessage = error instanceof Error && /^(STRIPE_CONNECTION_UNAVAILABLE|STRIPE_TEST_MODE_REQUIRED|STRIPE_LIVE_OBJECT_REFUSED|SUPABASE_CONNECTION_MISSING|SUPABASE_CONNECTION_INVALID)$/.test(error.message) ? error.message : null;
  const safeCode = ownMessage ?? (code && /^[A-Z0-9_]{2,40}$/.test(code) ? code : "CONNECTION_FAILED");
  console.error(JSON.stringify({ ok: false, stage, code: safeCode }));
  process.exitCode = 1;
} finally { await pool?.end(); }
