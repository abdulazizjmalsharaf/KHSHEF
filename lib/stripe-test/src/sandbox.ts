import { ReplitConnectors } from "@replit/connectors-sdk";
import type Stripe from "stripe";
import { requireTestObject, TEST_PLANS } from "./index";

/**
 * Native sandbox transport. No customer data is kept in process memory or copied
 * to another database. Stripe is the source of truth for this demo-only flow.
 */
export class SandboxStripe {
  private connectors = new ReplitConnectors();
  async request<T>(path: string, form?: URLSearchParams, key?: string): Promise<T> {
    const response = await this.connectors.proxy("stripe", `/v1${path}`, {
      method: form ? "POST" : "GET",
      headers: {
        "Stripe-Version": "2024-06-20",
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(form ? { body: form.toString() } : {}),
    });
    if (!response.ok) {
      // Return provider error codes/parameter names only, never messages or bodies.
      const detail = await response.json().catch(() => ({})) as { error?: { code?: string; param?: string } };
      const safe = (v: unknown) => typeof v === "string" && /^[a-z0-9_[\]]{1,80}$/i.test(v) ? v : "unknown";
      throw new Error(`STRIPE_SANDBOX_HTTP_${response.status}:${safe(detail.error?.code)}:${safe(detail.error?.param)}`);
    }
    return await response.json() as T;
  }
  async assertSandbox() {
    requireTestObject(await this.request<Stripe.Balance>("/balance"));
  }
  async catalog() {
    await this.assertSandbox();
    const query = new URLSearchParams({ active: "true", limit: "10" });
    TEST_PLANS.forEach((p, i) => query.set(`lookup_keys[${i}]`, `kashef_test_${p.id}_monthly_kwd`));
    const prices = await this.request<Stripe.ApiList<Stripe.Price>>(`/prices?${query}`);
    const map = new Map<string, string>();
    for (const plan of TEST_PLANS) {
      const price = prices.data.find((p) => p.lookup_key === `kashef_test_${plan.id}_monthly_kwd`);
      if (!price || !price.active || price.currency !== "kwd" || price.unit_amount !== plan.amount ||
        price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 ||
        price.metadata?.kashef_plan_id !== plan.id) throw new Error("TEST_CATALOG_NOT_PREPARED");
      requireTestObject(price);
      map.set(plan.id, price.id);
    }
    return map;
  }
  async seedCatalog() {
    await this.assertSandbox();
    for (const plan of TEST_PLANS) {
      const lookup = `kashef_test_${plan.id}_monthly_kwd`;
      const found = await this.request<Stripe.ApiList<Stripe.Price>>(`/prices?active=true&lookup_keys[]=${encodeURIComponent(lookup)}`);
      if (found.data.length) {
        requireTestObject(found.data[0]);
        continue;
      }
      // Stable idempotency keys make retries safe, with no placeholder prices.
      const product = await this.request<Stripe.Product>("/products", new URLSearchParams({
        name: `كاشف — ${plan.name} (اختبار)`,
        "metadata[kashef_plan_id]": plan.id,
        "metadata[kashef_test_checkout]": "true",
      }), `kashef-native-demo-product-${plan.id}`);
      requireTestObject(product);
      const price = await this.request<Stripe.Price>("/prices", new URLSearchParams({
        product: product.id, currency: "kwd", unit_amount: String(plan.amount),
        "recurring[interval]": "month", lookup_key: lookup,
        "metadata[kashef_plan_id]": plan.id, "metadata[kashef_test_checkout]": "true",
      }), `kashef-native-demo-price-${plan.id}-${plan.amount}`);
      requireTestObject(price);
    }
    await this.catalog();
  }
  async createSession(ids: string[], requestId: string, origin: string) {
    const catalog = await this.catalog();
    const form = new URLSearchParams({
      mode: "subscription", "payment_method_types[0]": "card",
      success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      "metadata[kashef_test_checkout]": "true",
      "metadata[kashef_plan_ids]": ids.join(","),
      "subscription_data[metadata][kashef_test_checkout]": "true",
    });
    ids.forEach((id, i) => {
      const price = catalog.get(id);
      if (!price) throw new Error("INVALID_PLAN");
      form.set(`line_items[${i}][price]`, price);
      form.set(`line_items[${i}][quantity]`, "1");
    });
    const session = await this.request<Stripe.Checkout.Session>("/checkout/sessions", form, `kashef-demo-${requestId}`);
    requireTestObject(session);
    if (!session.id.startsWith("cs_test_")) throw new Error("LIVE_SESSION_REFUSED");
    return session;
  }
  async verifySession(id: string) {
    await this.assertSandbox();
    const session = await this.request<Stripe.Checkout.Session>(`/checkout/sessions/${encodeURIComponent(id)}`);
    requireTestObject(session);
    const ids = session.metadata?.kashef_plan_ids?.split(",") ?? [];
    if (session.mode !== "subscription" || session.metadata?.kashef_test_checkout !== "true" ||
      ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) throw new Error("INVALID_TEST_SESSION");
    const lines = await this.request<Stripe.ApiList<Stripe.LineItem>>(`/checkout/sessions/${encodeURIComponent(id)}/line_items?limit=10`);
    const catalog = await this.catalog();
    if (lines.has_more || lines.data.length !== ids.length) throw new Error("INVALID_TEST_SESSION");
    let total = 0;
    for (const planId of ids) {
      const plan = TEST_PLANS.find((p) => p.id === planId);
      const line = lines.data.find((l) => l.price?.id === catalog.get(planId));
      if (!plan || !line?.price || line.quantity !== 1 || line.price.unit_amount !== plan.amount || line.price.currency !== "kwd") throw new Error("INVALID_TEST_SESSION");
      requireTestObject(line.price);
      total += plan.amount;
    }
    if (session.currency !== "kwd" || session.amount_total !== total) throw new Error("INVALID_TEST_SESSION");
    return { session, ids };
  }
}
