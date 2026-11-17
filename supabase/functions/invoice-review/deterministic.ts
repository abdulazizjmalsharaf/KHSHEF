export type CheckSeverity = "difference" | "warning";

export type ReceiptRow = {
  itemKey?: string;
  name: string | null;
  unit: string | null;
  quantity: string | null;
  lineTotal?: string | null;
  unitPrice?: string | null;
};

export type ReceiptCheck = {
  code: string;
  severity: CheckSeverity;
  itemKey?: string;
  itemName?: string | null;
  unit?: string | null;
  billed?: bigint;
  received?: bigint;
  amountAffected?: bigint | null;
  otherUnits?: Array<string | null>;
};

export function toMicros(value: string | null | undefined): bigint | null {
  if (!value) return null;
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/(?:KWD|KD|USD|SAR|BHD|AED|QAR|EUR|د\.?\s*ك\.?|دينار(?:\s*كويتي)?|ريال(?:\s*سعودي)?|دولار|درهم)/giu, "")
    .replace(/[$€£¥]/g, "")
    .replace(/[٬,\s]/g, "")
    .trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const micros = BigInt(match[2]) * 1_000_000n + BigInt((match[3] ?? "").padEnd(6, "0") || "0");
  return match[1] === "-" ? -micros : micros;
}

export function fromMicrosExact(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = String(absolute % 1_000_000n).padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function fromMicros(value: bigint): string {
  const rounded = value < 0n ? -((-value + 500n) / 1_000n) : (value + 500n) / 1_000n;
  const negative = rounded < 0n;
  const absolute = negative ? -rounded : rounded;
  const whole = absolute / 1_000n;
  const fraction = String(absolute % 1_000n).padStart(3, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function lineMathDifference(
  quantity: string | null | undefined,
  unitPrice: string | null | undefined,
  lineTotal: string | null | undefined,
): bigint | null {
  const q = toMicros(quantity);
  const p = toMicros(unitPrice);
  const line = toMicros(lineTotal);
  if (q === null || p === null || line === null) return null;
  const expected = (q * p) / 1_000_000n;
  const difference = expected > line ? expected - line : line - expected;
  return difference > 1_000n ? difference : null;
}

export function invoiceMathDifference(
  lineTotals: Array<string | null | undefined>,
  feeAmounts: Array<string | null | undefined>,
  invoiceTotal: string | null | undefined,
): { calculated: bigint; difference: bigint } | null {
  if (lineTotals.length === 0) return null;
  const lines = lineTotals.map(toMicros);
  const fees = feeAmounts.map(toMicros);
  const total = toMicros(invoiceTotal);
  if (total === null) return null;
  let calculated = 0n;
  for (const value of [...lines, ...fees]) {
    if (value === null) return null;
    calculated += value;
  }
  const difference = calculated > total ? calculated - total : total - calculated;
  return difference > 1_000n ? { calculated, difference } : null;
}

type QuantityGroup = {
  key: string;
  itemKey: string;
  itemName: string | null;
  unit: string | null;
  unitKey: string;
  quantity: bigint;
  lineTotal: bigint | null;
  unitPrice: bigint | null;
  hasLineTotal: boolean;
  hasUnitPrice: boolean;
};

function aggregate(rows: ReceiptRow[], normalizeUnit: (value: string | null) => string, includeAmounts: boolean) {
  const groups = new Map<string, QuantityGroup>();
  for (const row of rows) {
    if (!row.itemKey) continue;
    const quantity = toMicros(row.quantity);
    if (quantity === null) continue;
    const unitKey = normalizeUnit(row.unit);
    const key = `${row.itemKey}|${unitKey}`;
    const current = groups.get(key);
    const lineTotal = includeAmounts ? toMicros(row.lineTotal) : null;
    const unitPrice = includeAmounts ? toMicros(row.unitPrice) : null;
    if (!current) {
      groups.set(key, {
        key,
        itemKey: row.itemKey,
        itemName: row.name,
        unit: row.unit,
        unitKey,
        quantity,
        lineTotal,
        unitPrice,
        hasLineTotal: lineTotal !== null,
        hasUnitPrice: unitPrice !== null,
      });
      continue;
    }
    current.quantity += quantity;
    if (includeAmounts) {
      current.hasLineTotal = current.hasLineTotal && lineTotal !== null;
      current.hasUnitPrice = current.hasUnitPrice && unitPrice !== null && current.unitPrice === unitPrice;
      current.lineTotal = current.hasLineTotal && lineTotal !== null && current.lineTotal !== null
        ? current.lineTotal + lineTotal
        : null;
      if (!current.hasUnitPrice) current.unitPrice = null;
    }
  }
  return groups;
}

export function compareReceiptQuantities(
  invoiceItems: ReceiptRow[],
  receiptItems: ReceiptRow[],
  normalizeUnit: (value: string | null) => string,
): ReceiptCheck[] {
  const checks: ReceiptCheck[] = [];
  const billedByKey = aggregate(invoiceItems, normalizeUnit, true);
  const receivedByKey = aggregate(receiptItems, normalizeUnit, false);
  if (receivedByKey.size === 0) return [{ code: "receipt_unreadable", severity: "warning" }];

  for (const item of invoiceItems) {
    if (item.itemKey && toMicros(item.quantity) === null) {
      checks.push({
        code: "invoice_quantity_unreadable",
        severity: "warning",
        itemKey: item.itemKey,
        itemName: item.name,
        unit: item.unit,
      });
    }
  }

  const billedItemKeys = new Set([...billedByKey.values()].map((item) => item.itemKey));
  const unreadableKeys = new Set(
    invoiceItems
      .filter((item) => item.itemKey && toMicros(item.quantity) === null)
      .map((item) => `${item.itemKey}|${normalizeUnit(item.unit)}`),
  );
  for (const billed of billedByKey.values()) {
    if (unreadableKeys.has(billed.key)) continue;
    const received = receivedByKey.get(billed.key);
    if (!received) {
      const sameName = [...receivedByKey.values()].filter((item) => item.itemKey === billed.itemKey);
      if (sameName.length) {
        checks.push({
          code: "receipt_unit_mismatch",
          severity: "warning",
          itemKey: billed.itemKey,
          itemName: billed.itemName,
          unit: billed.unit,
          otherUnits: sameName.map((item) => item.unit),
        });
      } else {
        checks.push({
          code: "receipt_item_missing",
          severity: "difference",
          itemKey: billed.itemKey,
          itemName: billed.itemName,
          unit: billed.unit,
          amountAffected: billed.lineTotal,
        });
      }
      continue;
    }
    if (received.quantity < billed.quantity) {
      const shortage = billed.quantity - received.quantity;
      const amountAffected = billed.unitPrice === null ? null : (shortage * billed.unitPrice) / 1_000_000n;
      checks.push({
        code: "receipt_quantity",
        severity: "difference",
        itemKey: billed.itemKey,
        itemName: billed.itemName,
        unit: billed.unit,
        billed: billed.quantity,
        received: received.quantity,
        amountAffected,
      });
    } else if (received.quantity > billed.quantity) {
      checks.push({
        code: "receipt_quantity_excess",
        severity: "warning",
        itemKey: billed.itemKey,
        itemName: billed.itemName,
        unit: billed.unit,
        billed: billed.quantity,
        received: received.quantity,
      });
    }
  }

  for (const received of receivedByKey.values()) {
    if (billedItemKeys.has(received.itemKey)) continue;
    checks.push({
      code: "receipt_extra_item",
      severity: "warning",
      itemKey: received.itemKey,
      itemName: received.itemName,
      unit: received.unit,
      received: received.quantity,
    });
  }
  return checks;
}
