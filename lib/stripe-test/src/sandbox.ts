import { ReplitConnectors } from "@replit/connectors-sdk";
import type Stripe from "stripe";
import { requireTestObject, TEST_PLANS } from "./index";
import { getKwdUsdQuote, settlementAmount, type DemoQuote } from "./exchange-rate";

let capabilities: { kwd: boolean; usd: boolean; expires: number } | undefined;

/**
 * Native sandbox transport. No customer data is kept in process memory or copied
 * to another database. Stripe is the source of truth for this demo-only flow.
 */
export class SandboxStripe {
  private connectors = new ReplitConnectors();
  async request<T>(path: string, form?: URLSearchParams, key?: string): Promise<T> {
    const response = await this.connectors.proxy("stripe", `/v1${path}`, {
      method: form ? "POST" : "GET",
      signal: AbortSignal.timeout(20_000),
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
  async quote(): Promise<DemoQuote> {
    await this.assertSandbox();
    if (!capabilities || capabilities.expires <= Date.now()) {
      const account = await this.request<Stripe.Account>("/account");
      if (!account.country || !/^[A-Z]{2}$/.test(account.country)) throw new Error("CURRENCY_CAPABILITIES_UNAVAILABLE");
      const spec = await this.request<Stripe.CountrySpec>(`/country_specs/${account.country}`);
      if (!Array.isArray(spec.supported_payment_currencies)) throw new Error("CURRENCY_CAPABILITIES_UNAVAILABLE");
      capabilities = { kwd: spec.supported_payment_currencies.includes("kwd"), usd: spec.supported_payment_currencies.includes("usd"), expires: Date.now() + 3_600_000 };
    }
    if (capabilities.kwd) return { currency: "kwd", rate: "1", updated: 0, source: "native" };
    if (!capabilities.usd) throw new Error("SUPPORTED_CHECKOUT_CURRENCY_UNAVAILABLE");
    return getKwdUsdQuote();
  }
  async catalog(quote: DemoQuote) {
    const map = new Map<string, string>();
    for (const plan of TEST_PLANS) {
      const amount = settlementAmount(plan.amount, quote);
      const lookup = `kashef_demo_${plan.id}_${quote.currency}_${amount}_fx${quote.updated}`;
      const found = await this.request<Stripe.ApiList<Stripe.Price>>(`/prices?active=true&lookup_keys[]=${encodeURIComponent(lookup)}`);
      if (found.data.length) {
        const existing = found.data[0];
        requireTestObject(existing);
        if (existing.currency !== quote.currency || existing.unit_amount !== amount || existing.recurring?.interval !== "month" ||
          existing.recurring.interval_count !== 1 || existing.metadata.kashef_plan_id !== plan.id ||
          existing.metadata.kashef_kwd_fils !== String(plan.amount) || existing.metadata.kashef_fx_rate !== quote.rate) throw new Error("CATALOG_MISMATCH");
        map.set(plan.id, existing.id);
        continue;
      }
      const product = await this.request<Stripe.Product>("/products", new URLSearchParams({
        name: `كاشف — ${plan.name} (اختبار)`,
        "metadata[kashef_plan_id]": plan.id, "metadata[kashef_test_checkout]": "true",
      }), `kashef-native-demo-product-${plan.id}`);
      requireTestObject(product);
      const price = await this.request<Stripe.Price>("/prices", new URLSearchParams({
        product: product.id, currency: quote.currency, unit_amount: String(amount),
        "recurring[interval]": "month", lookup_key: lookup,
        "metadata[kashef_plan_id]": plan.id, "metadata[kashef_test_checkout]": "true",
        "metadata[kashef_kwd_fils]": String(plan.amount), "metadata[kashef_fx_rate]": quote.rate,
        "metadata[kashef_fx_updated]": String(quote.updated),
      }), lookup);
      requireTestObject(price);
      map.set(plan.id, price.id);
    }
    return map;
  }
  async seedCatalog() {
    const quote = await this.quote();
    await this.catalog(quote);
    return quote;
  }
  async createSession(ids: string[], requestId: string, origin: string) {
    const quote = await this.quote();
    const catalog = await this.catalog(quote);
    const form = new URLSearchParams({
      mode: "subscription", "payment_method_types[0]": "card",
      // Prevent Stripe from substituting the customer's geolocated currency.
      // Site prices remain KWD; Stripe's hosted form must show our quoted USD amount.
      "adaptive_pricing[enabled]": "false",
      success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      "metadata[kashef_test_checkout]": "true",
      "metadata[kashef_plan_ids]": ids.join(","),
      "metadata[kashef_fx_rate]": quote.rate,
      "metadata[kashef_fx_updated]": String(quote.updated),
      "metadata[kashef_fx_source]": quote.source,
      "metadata[kashef_checkout_currency]": quote.currency,
      "subscription_data[metadata][kashef_test_checkout]": "true",
    });
    ids.forEach((id, i) => {
      const price = catalog.get(id);
      if (!price) throw new Error("INVALID_PLAN");
      form.set(`line_items[${i}][price]`, price);
      form.set(`line_items[${i}][quantity]`, "1");
    });
    const session = await this.request<Stripe.Checkout.Session>("/checkout/sessions", form, `kashef-demo-${requestId}-${quote.currency}-${quote.updated}`);
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
    // Validate the frozen Stripe quote, never today's potentially changed rate.
    const currency = session.metadata?.kashef_checkout_currency;
    if (currency !== "usd" && currency !== "kwd") throw new Error("INVALID_TEST_SESSION");
    const quote: DemoQuote = { currency, rate: session.metadata?.kashef_fx_rate ?? "", updated: Number(session.metadata?.kashef_fx_updated), source: session.metadata?.kashef_fx_source ?? "" };
    if (lines.has_more || lines.data.length !== ids.length) throw new Error("INVALID_TEST_SESSION");
    let total = 0;
    for (const planId of ids) {
      const plan = TEST_PLANS.find((p) => p.id === planId);
      const line = lines.data.find((l) => l.price?.metadata?.kashef_plan_id === planId);
      if (!plan || !line?.price || line.quantity !== 1 || line.price.unit_amount !== settlementAmount(plan.amount, quote) || line.price.currency !== currency ||
        line.price.metadata.kashef_kwd_fils !== String(plan.amount) || line.price.metadata.kashef_fx_rate !== quote.rate) throw new Error("INVALID_TEST_SESSION");
      requireTestObject(line.price);
      total += settlementAmount(plan.amount, quote);
    }
    if (session.currency !== currency || session.amount_total !== total) throw new Error("INVALID_TEST_SESSION");
    return { session, ids };
  }
}
