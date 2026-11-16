import { test } from "node:test";
import assert from "node:assert/strict";
import { requireTestKey, requireTestObject, TEST_PLANS } from "@workspace/stripe-test";
import { isTestCheckoutUrl, ownsCheckout, signCheckout, validateCart } from "./stripe-test-security";

test("cart allows multiple distinct approved plans only", () => {
  assert.equal(validateCart(["small-restaurant", "growth", "chain"]), true);
  for (const ids of [[], ["growth", "growth"], ["unknown"], ["small-restaurant", "growth", "chain", "extra"]]) assert.equal(validateCart(ids), false);
});
test("approved KWD monthly amounts remain authoritative integer fils", () => {
  assert.deepEqual(TEST_PLANS.map((p) => p.amount), [9000, 24000, 59000]);
  assert.equal(TEST_PLANS.reduce((s, p) => s + p.amount, 0), 92000);
});
test("rejects live and publishable keys and non-test Stripe objects", () => {
  for (const prefix of ["sk_live_", "pk_test_", "pk_live_", ""]) assert.throws(() => requireTestKey(prefix));
  assert.doesNotThrow(() => requireTestKey("sk_test_" + "synthetic"));
  assert.throws(() => requireTestObject({ livemode: true }));
  assert.throws(() => requireTestObject({}));
  assert.doesNotThrow(() => requireTestObject({ livemode: false }));
});
test("session id or forged proof alone never verifies payment ownership", () => {
  const secret = "synthetic-signing-secret-only";
  const proof = signCheckout("cs_test_synthetic", secret);
  assert.equal(ownsCheckout("cs_test_synthetic", proof, secret), true);
  assert.equal(ownsCheckout("cs_test_other", proof, secret), false);
  assert.equal(ownsCheckout("cs_test_synthetic", undefined, secret), false);
  assert.equal(ownsCheckout("cs_test_synthetic", "forged", secret), false);
});
test("redirects only to HTTPS Stripe Checkout without credentials", () => {
  assert.equal(isTestCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_synthetic"), true);
  for (const url of ["https://checkout.stripe.com.evil.test", "http://checkout.stripe.com", "javascript:alert(1)", "https://user:pass@checkout.stripe.com", "", null]) assert.equal(isTestCheckoutUrl(url), false);
});
