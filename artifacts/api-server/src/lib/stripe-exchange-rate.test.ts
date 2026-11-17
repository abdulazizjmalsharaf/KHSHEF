import { test } from "node:test";
import assert from "node:assert/strict";
import { settlementAmount, validateExchangeResponse } from "./stripe-exchange-rate";

const now = 1_800_000_000_000;

test("accepts only a fresh KWD-based USD quote", () => {
  const quote = validateExchangeResponse({
    result: "success",
    base_code: "KWD",
    rates: { KWD: 1, USD: 3.25 },
    time_last_update_unix: now / 1000,
  }, now);
  assert.deepEqual(quote, {
    currency: "usd",
    rate: "3.25",
    updated: now / 1000,
    source: "https://www.exchangerate-api.com",
  });
});

test("rejects invalid, stale, and future currency rates", () => {
  const base = {
    result: "success",
    base_code: "KWD",
    rates: { KWD: 1, USD: 3.25 },
    time_last_update_unix: now / 1000,
  };
  assert.throws(() => validateExchangeResponse({ ...base, base_code: "USD" }, now));
  assert.throws(() => validateExchangeResponse({ ...base, rates: { KWD: 1, USD: 0 } }, now));
  assert.throws(() => validateExchangeResponse({
    ...base,
    time_last_update_unix: now / 1000 - 48 * 60 * 60 - 1,
  }, now));
  assert.throws(() => validateExchangeResponse({
    ...base,
    time_last_update_unix: now / 1000 + 301,
  }, now));
});

test("converts each approved KWD plan to USD cents with half-up rounding", () => {
  const quote = {
    currency: "usd" as const,
    rate: "3.25",
    updated: now / 1000,
    source: "https://www.exchangerate-api.com",
  };
  assert.equal(settlementAmount(9_000, quote), 2_925);
  assert.equal(settlementAmount(24_000, quote), 7_800);
  assert.equal(settlementAmount(59_000, quote), 19_175);
});
