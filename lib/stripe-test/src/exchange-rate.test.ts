import { test } from "node:test";
import assert from "node:assert/strict";
import { settlementAmount, validateExchangeResponse, type DemoQuote } from "./exchange-rate";

const now = Date.UTC(2026, 10, 16, 15);
const response = { result: "success", base_code: "KWD", rates: { KWD: 1, USD: 3.21776 }, time_last_update_unix: now / 1000 - 3600 };
const quote: DemoQuote = { currency: "usd", rate: "3.21776", updated: response.time_last_update_unix, source: "fixture" };
test("converts KWD fils to USD cents rather than reusing fils or numeric labels", () => {
  assert.deepEqual([9000, 24000, 59000].map(fils => settlementAmount(fils, quote)), [2896, 7723, 18985]);
  assert.equal([9000, 24000, 59000].reduce((sum, fils) => sum + settlementAmount(fils, quote), 0), 29604);
});
test("native KWD keeps fils unchanged", () => {
  assert.equal(settlementAmount(9000, { ...quote, currency: "kwd", rate: "1" }), 9000);
  assert.throws(() => settlementAmount(9000, { ...quote, currency: "kwd" }));
});
test("rounds converted monthly prices half-up once", () => {
  assert.equal(settlementAmount(1000, { ...quote, rate: "3.215" }), 322);
});
test("validates the actual KWD base and current timestamp", () => {
  assert.equal(validateExchangeResponse(response, now).rate, "3.21776");
  for (const value of [
    { ...response, base_code: "USD" },
    { ...response, result: "error" },
    { ...response, rates: { KWD: 1, USD: 0 } },
    { ...response, rates: { KWD: 1, USD: Infinity } },
    { ...response, time_last_update_unix: now / 1000 - 49 * 3600 },
    { ...response, time_last_update_unix: now / 1000 + 3600 },
  ]) assert.throws(() => validateExchangeResponse(value, now));
});
test("frozen rates still verify earlier sessions after provider quote ages", () => {
  assert.equal(settlementAmount(9000, { ...quote, updated: 1 }), 2896);
});
test("rejects invalid currency amounts and malformed rates", () => {
  for (const rate of ["0", "-1", "NaN", "1000", "", "3e2"]) assert.throws(() => settlementAmount(9000, { ...quote, rate }));
  for (const fils of [-1, 0, 1.5, Infinity]) assert.throws(() => settlementAmount(fils, quote));
});
