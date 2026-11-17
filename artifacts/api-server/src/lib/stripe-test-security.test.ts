import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePaymentAmount,
  PAYMENT_PLANS,
  validateTestKeys,
} from "./stripe-payment";
import {
  ownsPaymentIntent,
  signPaymentIntent,
  validateCart,
} from "./stripe-test-security";

test("cart allows only distinct approved monthly plans", () => {
  assert.equal(validateCart(["small-restaurant", "growth", "chain"]), true);
  for (const ids of [
    [],
    ["growth", "growth"],
    ["unknown"],
    ["small-restaurant", "growth", "chain", "extra"],
    null,
  ]) {
    assert.equal(validateCart(ids), false);
  }
});

test("approved monthly totals remain integer KWD fils", () => {
  assert.deepEqual(PAYMENT_PLANS.map((plan) => plan.amountFils), [9_000, 24_000, 59_000]);
  assert.equal(PAYMENT_PLANS.reduce((total, plan) => total + plan.amountFils, 0), 92_000);
});

test("test credentials must both have test-mode prefixes", () => {
  assert.equal(validateTestKeys("sk_test_synthetic", "pk_test_synthetic"), true);
  assert.equal(validateTestKeys("sk_live_synthetic", "pk_test_synthetic"), false);
  assert.equal(validateTestKeys("sk_test_synthetic", "pk_live_synthetic"), false);
  assert.equal(validateTestKeys(undefined, "pk_test_synthetic"), false);
});

test("KWD amounts convert to USD cents using exact half-up rounding", () => {
  const quote = { currency: "usd" as const, rate: "3.25", updated: 1_800_000_000, source: "https://www.exchangerate-api.com" };
  assert.deepEqual(calculatePaymentAmount(["small-restaurant", "growth"], quote), {
    amountKwdFils: 33_000,
    stripeAmount: 10_725,
  });
});

test("payment proof is bound to one intent and rejects forged values", () => {
  const secret = "synthetic-signing-secret-only";
  const proof = signPaymentIntent("pi_synthetic", secret);
  assert.equal(ownsPaymentIntent("pi_synthetic", proof, secret), true);
  assert.equal(ownsPaymentIntent("pi_other", proof, secret), false);
  assert.equal(ownsPaymentIntent("pi_synthetic", undefined, secret), false);
  assert.equal(ownsPaymentIntent("pi_synthetic", "forged", secret), false);
});
