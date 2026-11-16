import { getUncachableStripeClient, getStripeSync, migrateStripeTestSchema, TEST_PLANS, requireTestObject } from "@workspace/stripe-test";

try {
  await migrateStripeTestSchema();
  const stripe = await getUncachableStripeClient();
  requireTestObject(await stripe.balance.retrieve());
  for (const plan of TEST_PLANS) {
    const lookup = `kashef_test_${plan.id}_monthly_kwd`;
    const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
    if (existing.data.length) {
      const price = existing.data[0];
      requireTestObject(price);
      if (price.unit_amount !== plan.amount || price.currency !== "kwd" || price.recurring?.interval !== "month") throw new Error("CATALOG_MISMATCH");
      continue;
    }
    const matches = await stripe.products.search({ query: `metadata['kashef_plan_id']:'${plan.id}' AND active:'true'` });
    const product = matches.data[0] ?? await stripe.products.create({
      name: `كاشف — ${plan.name} (اختبار)`,
      metadata: { kashef_plan_id: plan.id, kashef_test_checkout: "true" },
    }, { idempotencyKey: `kashef-test-product-${plan.id}` });
    requireTestObject(product);
    const price = await stripe.prices.create({
      product: product.id, unit_amount: plan.amount, currency: "kwd",
      recurring: { interval: "month" }, lookup_key: lookup,
      metadata: { kashef_plan_id: plan.id, kashef_test_checkout: "true" },
    }, { idempotencyKey: `kashef-test-price-${plan.id}-kwd-${plan.amount}` });
    requireTestObject(price);
  }
  const sync = await getStripeSync();
  try { await sync.syncBackfill({ object: "all" }); }
  finally { await sync.postgresClient.pool.end(); }
  console.info("Stripe test plan catalog created and synced.");
} catch {
  console.error("Stripe test catalog was not prepared. Check secure configuration and retry.");
  process.exitCode = 1;
}
