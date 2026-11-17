import assert from "node:assert/strict";
import {
  compareReceiptQuantities,
  fromMicrosExact,
  invoiceMathDifference,
  lineMathDifference,
  toMicros,
} from "./deterministic.ts";

const identityUnit = (value: string | null) => (value ?? "").trim().toLowerCase();

assert.equal(toMicros("١٢٣٫٤٥٦"), 123_456_000n, "Arabic-Indic invoice digits parse exactly");
assert.equal(toMicros("۱۲۳٫۴۵۶"), 123_456_000n, "Eastern Arabic-Indic invoice digits parse exactly");
assert.equal(toMicros("1٬234.125"), 1_234_125_000n, "Arabic thousands separator is ignored");
assert.equal(toMicros("1.25 د.ك"), 1_250_000n, "Kuwaiti currency labels are removed safely");
assert.equal(fromMicrosExact(-1_234_567n), "-1.234567", "six-digit precision round-trips");
assert.equal(toMicros("not a number"), null, "invalid amounts are not coerced");
assert.equal(toMicros("1/2"), null, "unknown punctuation is not silently removed");
assert.equal(toMicros("12 apples"), null, "unknown words are not silently removed");

assert.equal(lineMathDifference("3", "2.5", "7.5"), null, "matching line math passes");
assert.equal(lineMathDifference("3", "2.5", "7"), 500_000n, "line math reports the exact difference");
assert.deepEqual(
  invoiceMathDifference(["7.5", "2.5"], ["1"], "11"),
  null,
  "line totals plus fees match the invoice total",
);
assert.deepEqual(
  invoiceMathDifference(["7.5", "2.5"], ["1"], "12"),
  { calculated: 11_000_000n, difference: 1_000_000n },
  "invoice total difference is calculated deterministically",
);
assert.equal(invoiceMathDifference([], [], "0"), null, "an empty invoice is not treated as verified");

const repeatedInvoiceRows = [
  { itemKey: "apples", name: "Apples", unit: "kg", quantity: "2", unitPrice: "2.5", lineTotal: "5" },
  { itemKey: "apples", name: "Apples", unit: "kg", quantity: "3", unitPrice: "2.5", lineTotal: "7.5" },
];
assert.deepEqual(
  compareReceiptQuantities(repeatedInvoiceRows, [
    { itemKey: "apples", name: "Apples", unit: "kg", quantity: "5" },
  ], identityUnit),
  [],
  "repeated invoice rows aggregate before receipt comparison",
);
const shortReceipt = compareReceiptQuantities(repeatedInvoiceRows, [
  { itemKey: "apples", name: "Apples", unit: "kg", quantity: "4" },
], identityUnit);
assert.equal(shortReceipt.length, 1);
assert.equal(shortReceipt[0].code, "receipt_quantity");
assert.equal(shortReceipt[0].amountAffected, 2_500_000n, "shortage value uses the billed unit price");

const unreadableQuantity = compareReceiptQuantities(
  [
    { itemKey: "apples", name: "Apples", unit: "kg", quantity: "2", unitPrice: "2.5", lineTotal: "5" },
    { itemKey: "apples", name: "Apples", unit: "kg", quantity: null, unitPrice: "2.5", lineTotal: null },
  ],
  [{ itemKey: "apples", name: "Apples", unit: "kg", quantity: "2" }],
  identityUnit,
);
assert.deepEqual(
  unreadableQuantity.map((check) => check.code),
  ["invoice_quantity_unreadable"],
  "an unreadable duplicate line does not cause a false shortage",
);

const unitMismatch = compareReceiptQuantities(
  [{ itemKey: "rice", name: "Rice", unit: "bag", quantity: "4", lineTotal: "20", unitPrice: "5" }],
  [{ itemKey: "rice", name: "Rice", unit: "kg", quantity: "4" }],
  identityUnit,
);
assert.equal(unitMismatch[0].code, "receipt_unit_mismatch", "different units are not compared as equal quantities");
assert.equal(unitMismatch[0].severity, "warning");

const extraReceiptItem = compareReceiptQuantities(
  [{ itemKey: "rice", name: "Rice", unit: "bag", quantity: "4", lineTotal: "20", unitPrice: "5" }],
  [
    { itemKey: "rice", name: "Rice", unit: "bag", quantity: "4" },
    { itemKey: "oil", name: "Oil", unit: "bottle", quantity: "2" },
  ],
  identityUnit,
);
assert.equal(extraReceiptItem.find((check) => check.code === "receipt_extra_item")?.severity, "warning");

console.log("Invoice review deterministic checks passed.");
