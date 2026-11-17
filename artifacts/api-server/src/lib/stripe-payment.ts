import Stripe from "stripe";
import { getKwdUsdQuote, settlementAmount, type DemoQuote } from "./stripe-exchange-rate";

export const PAYMENT_PLANS = [
  { id: "small-restaurant", name: "مطعم صغير", amountFils: 9_000 },
  { id: "growth", name: "نمو", amountFils: 24_000 },
  { id: "chain", name: "سلسلة", amountFils: 59_000 },
] as const;

export type PaymentPlanId = (typeof PAYMENT_PLANS)[number]["id"];

export function isPaymentPlanId(value: unknown): value is PaymentPlanId {
  return PAYMENT_PLANS.some((plan) => plan.id === value);
}

export function validatePaymentCart(value: unknown): value is PaymentPlanId[] {
  return Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= PAYMENT_PLANS.length &&
    new Set(value).size === value.length &&
    value.every(isPaymentPlanId);
}

export function validateTestKeys(secret: unknown, publishable: unknown): secret is string {
  return typeof secret === "string" &&
    secret.startsWith("sk_test_") &&
    typeof publishable === "string" &&
    publishable.startsWith("pk_test_");
}

export function createTestStripeClient(): Stripe {
  const secret = process.env.TEST_STRIPE_SECRET_KEY;
  const publishable = process.env.TEST_STRIPE_PUBLISHABLE_KEY;
  if (!validateTestKeys(secret, publishable)) throw new Error("TEST_STRIPE_KEYS_REQUIRED");
  return new Stripe(secret, { maxNetworkRetries: 1, timeout: 15_000 });
}

export async function getDemoQuote(): Promise<DemoQuote> {
  // The configured Stripe test account does not accept KWD; keep user-facing
  // totals in KWD and charge the accurately converted USD test amount.
  return getKwdUsdQuote();
}

export function calculatePaymentAmount(planIds: PaymentPlanId[], quote: DemoQuote) {
  const plans = planIds.map((id) => PAYMENT_PLANS.find((plan) => plan.id === id)!);
  return {
    amountKwdFils: plans.reduce((total, plan) => total + plan.amountFils, 0),
    stripeAmount: plans.reduce((total, plan) => total + settlementAmount(plan.amountFils, quote), 0),
  };
}

export function quoteFromPaymentMetadata(metadata: Stripe.Metadata): DemoQuote {
  const currency = metadata.kashef_checkout_currency;
  const rate = metadata.kashef_fx_rate;
  const updated = Number(metadata.kashef_fx_updated);
  const source = metadata.kashef_fx_source;
  if (currency === "kwd" && rate === "1" && updated === 0 && source === "native") {
    return { currency, rate, updated, source };
  }
  if (
    currency !== "usd" ||
    !rate ||
    !/^\d+(\.\d+)?$/.test(rate) ||
    !Number.isInteger(updated) ||
    updated <= 0 ||
    source !== "https://www.exchangerate-api.com"
  ) {
    throw new Error("INVALID_PAYMENT_QUOTE");
  }
  return { currency, rate, updated, source };
}
