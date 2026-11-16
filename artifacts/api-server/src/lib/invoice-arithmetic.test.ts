import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyInvoice } from "./invoice-arithmetic";
import { extractionSchema, groundExtraction, normalizeInvoiceText } from "./invoice-extraction";
import { fixture } from "../test-fixtures/invoice";

test("correct explicit zero-tax invoice matches with exact fils", () => {
  const result = verifyInvoice(fixture());
  assert.equal(result.status, "match");
  assert.equal(result.checks.at(-1)?.calculated, "4.750");
});
test("wrong stated total is preserved and difference is stated minus calculated", () => {
  const invoice = fixture();
  invoice.total = "5.750";
  const result = verifyInvoice(invoice);
  assert.equal(result.status, "mismatch");
  assert.equal(result.invoice.total, "5.750");
  assert.equal(result.checks.at(-1)?.difference, "1.000");
});
test("document discount and percentage tax checked after discount", () => {
  const invoice = fixture();
  invoice.discountAmount = "0.750";
  invoice.taxAmount = "0.200";
  invoice.taxRate = "5";
  invoice.total = "4.200";
  assert.equal(verifyInvoice(invoice).status, "match");
});
test("line discount and line tax are applied exactly once", () => {
  const invoice = fixture();
  invoice.items[0].discountAmount = "0.500";
  invoice.items[0].taxAmount = "0.100";
  invoice.items[0].lineTotal = "2.100";
  invoice.subtotal = "4.250";
  invoice.total = "4.350";
  const r = verifyInvoice(invoice);
  assert.equal(r.status, "match");
  assert.equal(r.checks.at(-1)?.calculated, "4.350");
});
test("missing quantity never becomes 1 and missing tax never becomes a confirmed zero", () => {
  const invoice = fixture();
  invoice.items[0].quantity = null;
  invoice.taxAmount = null;
  const r = verifyInvoice(invoice);
  assert.equal(r.status, "unverified");
  assert.equal(r.itemChecks[0].calculated, null);
  assert.equal(r.checks.at(-1)?.calculated, null);
});
test("unknown adjustments keep equality conditional, never confirmed", () => {
  const invoice = fixture();
  invoice.taxAmount = null;
  invoice.discountAmount = null;
  const r = verifyInvoice(invoice);
  assert.equal(r.status, "unverified");
  assert.equal(r.checks.at(-1)?.status, "unverified");
  assert.equal(r.invoice.taxAmount, null);
});
test("Arabic and Persian digits and grouped numbers normalize without losing precision", () => {
  assert.equal(normalizeInvoiceText("٢ × ١٫٢٥٠ = ٢٫٥٠٠ ۱۲۳ ١٬٠٠٠٫٥ 1,000.5"), "2 × 1.250 = 2.500 123 1000.5 1000.5");
});
test("hallucinated numerical values are removed and flagged", () => {
  const r = groundExtraction(fixture(), "فاتورة 2 1.250 2.500 3 0.750 2.250");
  assert.equal(r.total, null);
  assert.equal(r.taxAmount, null);
  assert.equal(r.unsupportedAdjustments, true);
});
test("inclusive tax and unknown currencies cannot become confirmed matches", () => {
  const invoice = fixture();
  invoice.taxIncluded = true;
  const inclusive = verifyInvoice(invoice);
  assert.equal(inclusive.status, "unverified");
  assert.equal(inclusive.checks.at(-1)?.calculated, null);
  invoice.taxIncluded = false;
  invoice.currency = null;
  assert.equal(verifyInvoice(invoice).status, "unverified");
});
test("rounds half-up to currency precision per line, no binary float artifacts", () => {
  const invoice = fixture();
  invoice.items = [{ description: "عينة", quantity: "3", unitPrice: "0.1005", lineTotal: "0.302", discountAmount: null, taxAmount: null }];
  invoice.subtotal = "0.302";
  invoice.total = "0.302";
  assert.equal(verifyInvoice(invoice).status, "match");
  assert.equal(verifyInvoice(invoice).itemChecks[0].calculated, "0.302");
});
test("malformed, negative and oversized provider numbers are rejected", () => {
  for (const bad of ["NaN", "1e9", "-1", "1234567890123", "0.1234567"]) {
    const invoice = fixture();
    invoice.total = bad;
    assert.equal(extractionSchema.safeParse(invoice).success, false);
  }
});
