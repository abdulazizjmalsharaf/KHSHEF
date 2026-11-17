import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai";
import {
  compareReceiptQuantities,
  fromMicros,
  fromMicrosExact,
  invoiceMathDifference,
  lineMathDifference,
  toMicros,
} from "./deterministic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type ScoredText = { value: string | null; confidence: number };
type ScoredNumber = { value: string | null; confidence: number };
type ExtractedItem = {
  name: string | null;
  nameConfidence: number;
  quantity: string | null;
  quantityConfidence: number;
  unit: string | null;
  unitConfidence: number;
  unitPrice: string | null;
  unitPriceConfidence: number;
  lineTotal: string | null;
  lineTotalConfidence: number;
  itemKey?: string;
};
type ExtractedFee = {
  name: string | null;
  nameConfidence: number;
  amount: string | null;
  amountConfidence: number;
  feeKey?: string;
};
type ReceiptItem = {
  name: string | null;
  nameConfidence: number;
  quantity: string | null;
  quantityConfidence: number;
  unit: string | null;
  unitConfidence: number;
  itemKey?: string;
};
type Extraction = {
  supplierName: string | null;
  supplierNameConfidence: number;
  invoiceNumber: string | null;
  invoiceNumberConfidence: number;
  invoiceNumberKey?: string | null;
  invoiceDate: string | null;
  invoiceDateConfidence: number;
  currency: string | null;
  currencyConfidence: number;
  items: ExtractedItem[];
  additionalFees: ExtractedFee[];
  total: string | null;
  totalConfidence: number;
  receiptItems: ReceiptItem[];
  supplierKey?: string;
  supplierId?: string | null;
  selectedSupplierName?: string | null;
};
type Check = {
  code: string;
  severity: "difference" | "warning";
  title: string;
  detail: string;
  amountAffected: string | null;
  currency: string;
  itemKey?: string;
  itemName?: string | null;
  unit?: string | null;
  suggestedUnitPrice?: string | null;
};

const invoiceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: { type: ["string", "null"] },
    supplierNameConfidence: { type: "number", minimum: 0, maximum: 1 },
    invoiceNumber: { type: ["string", "null"] },
    invoiceNumberConfidence: { type: "number", minimum: 0, maximum: 1 },
    invoiceDate: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
    invoiceDateConfidence: { type: "number", minimum: 0, maximum: 1 },
    currency: { type: ["string", "null"], description: "ISO 4217 currency code or null" },
    currencyConfidence: { type: "number", minimum: 0, maximum: 1 },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: ["string", "null"] },
          nameConfidence: { type: "number", minimum: 0, maximum: 1 },
          quantity: { type: ["string", "null"] },
          quantityConfidence: { type: "number", minimum: 0, maximum: 1 },
          unit: { type: ["string", "null"] },
          unitConfidence: { type: "number", minimum: 0, maximum: 1 },
          unitPrice: { type: ["string", "null"] },
          unitPriceConfidence: { type: "number", minimum: 0, maximum: 1 },
          lineTotal: { type: ["string", "null"] },
          lineTotalConfidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "name", "nameConfidence", "quantity", "quantityConfidence", "unit",
          "unitConfidence", "unitPrice", "unitPriceConfidence", "lineTotal",
          "lineTotalConfidence",
        ],
      },
    },
    additionalFees: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: ["string", "null"] },
          nameConfidence: { type: "number", minimum: 0, maximum: 1 },
          amount: { type: ["string", "null"] },
          amountConfidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["name", "nameConfidence", "amount", "amountConfidence"],
      },
    },
    total: { type: ["string", "null"] },
    totalConfidence: { type: "number", minimum: 0, maximum: 1 },
    receiptItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: ["string", "null"] },
          nameConfidence: { type: "number", minimum: 0, maximum: 1 },
          quantity: { type: ["string", "null"] },
          quantityConfidence: { type: "number", minimum: 0, maximum: 1 },
          unit: { type: ["string", "null"] },
          unitConfidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "name", "nameConfidence", "quantity", "quantityConfidence",
          "unit", "unitConfidence",
        ],
      },
    },
  },
  required: [
    "supplierName", "supplierNameConfidence", "invoiceNumber", "invoiceNumberConfidence",
    "invoiceDate", "invoiceDateConfidence", "currency", "currencyConfidence", "items",
    "additionalFees", "total", "totalConfidence", "receiptItems",
  ],
};

const SYSTEM_PROMPT = `أنت قارئ مستندات فواتير للمراجعة المحاسبية. اقرأ جميع صفحات الملف كما هي، وادعم الفواتير العربية والإنجليزية واختلاف التخطيطات. استخرج فقط ما يظهر بوضوح، ولا تخمّن أي قيمة. أعد الأرقام كسلاسل عشرية عادية بأرقام لاتينية ونقطة عشرية، دون فواصل آلاف أو رموز عملة. استخرج الرسوم والضرائب والخصومات كسطور منفصلة ولا تكررها. إذا كانت القيمة غير مقروءة فأعد null وثقة أقل من 0.5. confidence تقدير وضوح القراءة من 0 إلى 1، وليس صحة الحساب. إذا أُرفق سند استلام، اقرأ كمياته وحدها في receiptItems ولا تخلطها مع أصناف الفاتورة. إذا لم يوجد سند، أعد receiptItems فارغة. تاريخ الفاتورة بصيغة YYYY-MM-DD فقط عندما يكون واضحاً.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeKey(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeInvoiceNumber(input: string | null | undefined): string {
  return (input ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeNumber(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const micros = toMicros(String(value));
  return micros === null ? null : fromMicrosExact(micros);
}

function validIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? value
    : null;
}

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = normalizeKey(raw);
  if (normalized.includes("kwd") || normalized.includes("kuwaiti dinar") || normalized.includes("دينار كويتي") || normalized === "د ك") return "KWD";
  if (normalized.includes("usd") || normalized.includes("us dollar")) return "USD";
  if (normalized.includes("sar") || normalized.includes("saudi riyal")) return "SAR";
  if (normalized.includes("bhd") || normalized.includes("bahraini dinar")) return "BHD";
  if (normalized.includes("aed") || normalized.includes("uae dirham")) return "AED";
  if (normalized.includes("qar") || normalized.includes("qatari riyal")) return "QAR";
  if (normalized.includes("eur") || normalized.includes("euro")) return "EUR";
  return /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : null;
}

function validConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

function enrichExtraction(raw: Extraction): Extraction {
  const recognizedCurrency = normalizeCurrency(raw.currency);
  const rawCurrency = typeof raw.currency === "string" ? raw.currency.trim().slice(0, 12) : "";
  const currency = recognizedCurrency || rawCurrency || "KWD";
  const supplierName = typeof raw.supplierName === "string" ? raw.supplierName.trim().slice(0, 160) || null : null;
  const invoiceNumber = typeof raw.invoiceNumber === "string" ? raw.invoiceNumber.trim().slice(0, 120) || null : null;
  const invoiceDate = validIsoDate(raw.invoiceDate);
  const items = Array.isArray(raw.items) ? raw.items : [];
  const additionalFees = Array.isArray(raw.additionalFees) ? raw.additionalFees : [];
  const receiptItems = Array.isArray(raw.receiptItems) ? raw.receiptItems : [];
  return {
    ...raw,
    supplierName,
    supplierKey: normalizeKey(supplierName),
    invoiceNumber,
    invoiceNumberKey: normalizeInvoiceNumber(invoiceNumber),
    invoiceDate,
    currency,
    supplierNameConfidence: validConfidence(raw.supplierNameConfidence),
    invoiceNumberConfidence: invoiceNumber ? validConfidence(raw.invoiceNumberConfidence) : 0.2,
    invoiceDateConfidence: invoiceDate ? validConfidence(raw.invoiceDateConfidence) : 0.2,
    currencyConfidence: recognizedCurrency ? validConfidence(raw.currencyConfidence) : 0.2,
    total: normalizeNumber(raw.total),
    totalConfidence: normalizeNumber(raw.total) === null ? 0.2 : validConfidence(raw.totalConfidence),
    items: items.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as ExtractedItem;
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 160) || null : null;
      const quantity = normalizeNumber(item.quantity);
      const unitPrice = normalizeNumber(item.unitPrice);
      const lineTotal = normalizeNumber(item.lineTotal);
      return [{
        ...item,
        name,
        itemKey: normalizeKey(name),
        quantity,
        unit: typeof item.unit === "string" ? item.unit.trim().slice(0, 80) || null : null,
        unitPrice,
        lineTotal,
        nameConfidence: name ? validConfidence(item.nameConfidence) : 0.1,
        quantityConfidence: quantity === null ? 0.1 : validConfidence(item.quantityConfidence),
        unitConfidence: validConfidence(item.unitConfidence),
        unitPriceConfidence: unitPrice === null ? 0.1 : validConfidence(item.unitPriceConfidence),
        lineTotalConfidence: lineTotal === null ? 0.1 : validConfidence(item.lineTotalConfidence),
      }];
    }),
    additionalFees: additionalFees.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const fee = entry as ExtractedFee;
      const name = typeof fee.name === "string" ? fee.name.trim().slice(0, 100) || null : null;
      const amount = normalizeNumber(fee.amount);
      return [{
        ...fee,
        name,
        feeKey: normalizeKey(name),
        amount,
        nameConfidence: name ? validConfidence(fee.nameConfidence) : 0.1,
        amountConfidence: amount === null ? 0.1 : validConfidence(fee.amountConfidence),
      }];
    }),
    receiptItems: receiptItems.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as ReceiptItem;
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 160) || null : null;
      const quantity = normalizeNumber(item.quantity);
      return [{
        ...item,
        name,
        itemKey: normalizeKey(name),
        quantity,
        unit: typeof item.unit === "string" ? item.unit.trim().slice(0, 80) || null : null,
        nameConfidence: name ? validConfidence(item.nameConfidence) : 0.1,
        quantityConfidence: quantity === null ? 0.1 : validConfidence(item.quantityConfidence),
        unitConfidence: validConfidence(item.unitConfidence),
      }];
    }),
  };
}

async function applySelectedSupplier(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string,
  supplierId: string | null,
  extraction: Extraction,
): Promise<Extraction | null> {
  if (!supplierId && !extraction.supplierKey) {
    return { ...extraction, supplierId: null, selectedSupplierName: null };
  }
  let supplierQuery = supabase
    .from("suppliers")
    .select("id, name, supplier_key")
  if (supplierId) supplierQuery = supplierQuery.eq("id", supplierId);
  const { data: suppliers, error } = await supplierQuery;
  if (error) return null;
  const supplier = supplierId
    ? suppliers?.[0]
    : suppliers?.find((entry) =>
      normalizeKey(entry.supplier_key || "") === extraction.supplierKey
      || normalizeKey(entry.name) === extraction.supplierKey
    );
  if (!supplier) {
    return supplierId ? null : { ...extraction, supplierId: null, selectedSupplierName: null };
  }
  if (!supplierId) {
    const { error: linkError } = await supabase
      .from("invoices")
      .update({ supplier_id: supplier.id })
      .eq("id", invoiceId);
    if (linkError) return null;
  }
  return {
    ...extraction,
    supplierId: supplier.id,
    selectedSupplierName: supplier.name,
    supplierKey: supplier.supplier_key || normalizeKey(supplier.name),
  };
}

function hasLowConfidence(extraction: Extraction): boolean {
  const required = [
    extraction.supplierNameConfidence,
    extraction.invoiceNumberConfidence,
    extraction.invoiceDateConfidence,
    extraction.currencyConfidence,
    extraction.totalConfidence,
    ...extraction.items.flatMap((item) => [
      item.nameConfidence,
      item.quantityConfidence,
      item.unitConfidence,
      item.unitPriceConfidence,
      item.lineTotalConfidence,
    ]),
    ...extraction.additionalFees.flatMap((fee) => [
      fee.nameConfidence,
      fee.amountConfidence,
    ]),
    ...extraction.receiptItems.flatMap((item) => [
      item.nameConfidence,
      item.quantityConfidence,
      item.unitConfidence,
    ]),
  ];
  return !extraction.supplierName
    || !extraction.total
    || extraction.items.length === 0
    || required.some((confidence) => confidence < 0.8);
}

async function runChecks(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string | null,
  extraction: Extraction,
  hasReceipt: boolean,
) {
  const checks: Check[] = [];
  const currency = extraction.currency || "KWD";
  const supplierKey = extraction.supplierKey || "";
  const supplierId = extraction.supplierId || null;
  const add = (
    code: string,
    severity: Check["severity"],
    title: string,
    detail: string,
    amountAffected: bigint | null = null,
    itemDetails: Pick<Check, "itemKey" | "itemName" | "unit" | "suggestedUnitPrice"> = {},
  ) => checks.push({
    code,
    severity,
    title,
    detail,
    amountAffected: amountAffected === null ? null : fromMicros(amountAffected),
    currency,
    ...itemDetails,
  });

  if (
    extraction.selectedSupplierName
    && extraction.supplierName
    && normalizeKey(extraction.selectedSupplierName) !== normalizeKey(extraction.supplierName)
  ) {
    add(
      "supplier_name_mismatch",
      "warning",
      "اسم المورد المقروء مختلف عن اختيارك",
      `اخترت ${extraction.selectedSupplierName}، بينما ظهرت قراءة المستند باسم ${extraction.supplierName}. تحقق من الفاتورة.`,
    );
  }

  for (const item of extraction.items) {
    const difference = lineMathDifference(item.quantity, item.unitPrice, item.lineTotal);
    if (difference !== null) {
      add(
        "line_math",
        "difference",
        "مجموع السطر لا يطابق الكمية × السعر",
        `الصنف: ${item.name ?? "غير معروف"}. الفرق المحسوب ${fromMicros(difference)} ${currency}.`,
        difference,
      );
    }
  }

  const invoiceTotal = toMicros(extraction.total);
  const invoiceDifference = invoiceMathDifference(
    extraction.items.map((item) => item.lineTotal),
    extraction.additionalFees.map((fee) => fee.amount),
    extraction.total,
  );
  if (invoiceDifference) {
    add(
      "invoice_math",
      "difference",
      "الإجمالي لا يطابق مجموع الأصناف والرسوم",
      `المجموع المحسوب ${fromMicros(invoiceDifference.calculated)} ${currency} مقابل إجمالي الفاتورة ${fromMicros(invoiceTotal!)} ${currency}.`,
      invoiceDifference.difference,
    );
  }

  if (supplierKey && extraction.invoiceNumberKey) {
    let duplicateQuery = supabase.from("invoices").select("id")
      .eq("supplier_key", supplierKey)
      .eq("invoice_number_key", extraction.invoiceNumberKey)
      .limit(1);
    if (invoiceId) duplicateQuery = duplicateQuery.neq("id", invoiceId);
    const { data: duplicate } = await duplicateQuery;
    if (duplicate?.length) {
      add(
        "duplicate_number",
        "difference",
        "رقم الفاتورة موجود مسبقاً",
        "لدى هذا المورد فاتورة محفوظة بنفس الرقم.",
        invoiceTotal,
      );
    }
  }

  if (extraction.invoiceDate && invoiceTotal !== null) {
    let duplicateTotalQuery = supabase.from("invoices").select("id")
      .eq("invoice_date", extraction.invoiceDate)
      .eq("currency", currency)
      .eq("total_amount", extraction.total!)
      .limit(1);
    if (invoiceId) duplicateTotalQuery = duplicateTotalQuery.neq("id", invoiceId);
    const { data: duplicateByTotal } = await duplicateTotalQuery;
    if (duplicateByTotal?.length && !checks.some((check) => check.code === "duplicate_number")) {
      add(
        "duplicate_total_date",
        "warning",
        "فاتورة محتملة التكرار",
        "توجد فاتورة بنفس التاريخ والإجمالي؛ راجع المورد ورقم الفاتورة.",
        invoiceTotal,
      );
    }
  }

  let history: Array<{ id: string; extracted_data: { extraction?: Extraction } | null }> = [];
  if (supplierKey) {
    let historyQuery = supabase.from("invoices")
      .select("id, extracted_data")
      .eq("supplier_key", supplierKey)
      .in("status", ["matched", "approved"])
      .order("created_at", { ascending: false })
      .limit(12);
    if (invoiceId) historyQuery = historyQuery.neq("id", invoiceId);
    const { data } = await historyQuery;
    history = data ?? [];
  }

  const historyIds = history.map((invoice) => invoice.id);
  const productKeys = [...new Set(extraction.items.map((item) => item.itemKey).filter(Boolean))];
  const latestPrice = new Map<string, string>();
  if (historyIds.length && productKeys.length) {
    const { data: oldItems } = await supabase.from("invoice_items")
      .select("invoice_id, item_key, unit, unit_price, currency, created_at")
      .in("invoice_id", historyIds)
      .in("item_key", productKeys)
      .eq("supplier_key", supplierKey)
      .eq("currency", currency)
      .order("created_at", { ascending: false });
    for (const oldItem of oldItems ?? []) {
      const historyKey = `${oldItem.item_key}|${normalizeKey(oldItem.unit)}`;
      if (!latestPrice.has(historyKey) && oldItem.unit_price !== null) {
        latestPrice.set(historyKey, String(oldItem.unit_price));
      }
    }
  }
  const agreedPrices = new Map<string, string>();
  if (supplierKey && productKeys.length) {
    let agreedQuery = supabase.from("supplier_price_agreements")
      .select("item_key, unit_key, unit_price")
      .eq("currency", currency)
      .in("item_key", productKeys);
    agreedQuery = supplierId
      ? agreedQuery.eq("supplier_id", supplierId)
      : agreedQuery.eq("supplier_key", supplierKey);
    const { data: agreed } = await agreedQuery;
    for (const price of agreed ?? []) {
      agreedPrices.set(`${price.item_key}|${price.unit_key}`, String(price.unit_price));
    }
  }
  for (const item of extraction.items) {
    const unitKey = normalizeKey(item.unit);
    const itemUnitKey = `${item.itemKey ?? ""}|${unitKey}`;
    const agreedPrice = agreedPrices.get(itemUnitKey);
    const referencePrice = agreedPrice ?? latestPrice.get(itemUnitKey);
    const currentPrice = toMicros(item.unitPrice);
    const oldPrice = toMicros(referencePrice);
    const quantity = toMicros(item.quantity);
    if (supplierKey && item.itemKey && !agreedPrice) {
      add(
        "missing_agreed_price",
        "warning",
        "لا يوجد سعر متفق عليه لهذا الصنف",
        `أضف سعر ${item.name ?? "الصنف"} لدى ${extraction.selectedSupplierName || extraction.supplierName || "المورد"} حتى تتمكن من مقارنته بالفواتير القادمة.`,
        toMicros(item.lineTotal),
        {
          itemKey: item.itemKey,
          itemName: item.name,
          unit: item.unit,
          suggestedUnitPrice: item.unitPrice,
        },
      );
    }
    if (currentPrice !== null && oldPrice !== null && quantity !== null && currentPrice > oldPrice) {
      const unitIncrease = currentPrice - oldPrice;
      const reference = agreedPrice ? "السعر المتفق عليه" : "آخر فاتورة معتمدة";
      add(
        agreedPrice ? "agreed_price_increase" : "price_increase",
        "warning",
        `ارتفاع سعر صنف عن ${reference}`,
        `${item.name ?? "الصنف"}${item.unit ? ` (${item.unit})` : ""}: المرجع ${fromMicros(oldPrice)} وأصبح ${fromMicros(currentPrice)} ${currency} للوحدة.`,
        (unitIncrease * quantity) / 1_000_000n,
      );
    }
  }

  const previousFees = new Map<string, bigint[]>();
  for (const invoice of history) {
    const prior = invoice.extracted_data?.extraction;
    for (const fee of prior?.additionalFees ?? []) {
      const key = normalizeKey(fee.name);
      const amount = toMicros(fee.amount);
      if (!key || amount === null) continue;
      previousFees.set(key, [...(previousFees.get(key) ?? []), amount]);
    }
  }
  for (const fee of extraction.additionalFees) {
    const current = toMicros(fee.amount);
    const key = fee.feeKey || normalizeKey(fee.name);
    if (current === null || !key) continue;
    const historyForFee = previousFees.get(key) ?? [];
    if (historyForFee.length === 0) {
      add(
        "new_fee",
        "warning",
        "رسوم إضافية جديدة على هذا المورد",
        `ظهرت رسوم "${fee.name ?? "غير مسماة"}" لأول مرة في الفواتير المعتمدة لهذا المورد.`,
        current,
      );
    } else {
      const sorted = [...historyForFee].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (current > median + median / 5n && current - median > 1_000n) {
        add(
          "fee_increase",
          "warning",
          "رسوم إضافية أعلى من المعتاد",
          `رسوم "${fee.name ?? "غير مسماة"}" أعلى بأكثر من 20٪ من وسيط الفواتير السابقة.`,
          current - median,
        );
      }
    }
  }

  if (hasReceipt) {
    const receiptChecks = compareReceiptQuantities(
      extraction.items,
      extraction.receiptItems,
      normalizeKey,
    );
    for (const check of receiptChecks) {
      const itemDetails = {
        itemKey: check.itemKey,
        itemName: check.itemName,
        unit: check.unit,
      };
      if (check.code === "receipt_unreadable") {
        add("receipt_unreadable", "warning", "تعذر قراءة كميات سند الاستلام", "راجع صورة سند الاستلام أو أعد رفع صورة أوضح.");
      } else if (check.code === "invoice_quantity_unreadable") {
        add("invoice_quantity_unreadable", "warning", "تعذر قراءة كمية صنف في الفاتورة", `راجع كمية ${check.itemName || "الصنف"} قبل المقارنة.`, null, itemDetails);
      } else if (check.code === "receipt_unit_mismatch") {
        add(
          "receipt_unit_mismatch",
          "warning",
          "وحدة الصنف مختلفة في سند الاستلام",
          `${check.itemName || "الصنف"}: الفاتورة بوحدة ${check.unit || "غير محددة"}، وسند الاستلام بوحدة ${(check.otherUnits || []).map((unit) => unit || "غير محددة").join(" أو ")}. لا يمكن مقارنة الكميتين بدقة.`,
          null,
          itemDetails,
        );
      } else if (check.code === "receipt_item_missing") {
        add(
          "receipt_item_missing",
          "difference",
          "صنف الفاتورة غير ظاهر في سند الاستلام",
          `لم نجد "${check.itemName || "الصنف"}" في أصناف سند الاستلام.`,
          check.amountAffected ?? null,
          itemDetails,
        );
      } else if (check.code === "receipt_quantity") {
        add(
          "receipt_quantity",
          "difference",
          "الكمية المستلمة أقل من المفوترة",
          `${check.itemName || "الصنف"}: المفوتر ${fromMicros(check.billed!)} والمستلم ${fromMicros(check.received!)} ${check.unit || ""}.`,
          check.amountAffected ?? null,
          itemDetails,
        );
      } else if (check.code === "receipt_quantity_excess") {
        add(
          "receipt_quantity_excess",
          "warning",
          "الكمية المستلمة أكثر من المفوترة",
          `${check.itemName || "الصنف"}: المفوتر ${fromMicros(check.billed!)} والمستلم ${fromMicros(check.received!)} ${check.unit || ""}.`,
          null,
          itemDetails,
        );
      } else if (check.code === "receipt_extra_item") {
        add(
          "receipt_extra_item",
          "warning",
          "صنف زائد في سند الاستلام",
          `${check.itemName || "صنف غير معروف"}: الكمية ${fromMicros(check.received!)} ${check.unit || ""} ولا يظهر في الفاتورة.`,
          null,
          itemDetails,
        );
      }
    }
  }

  const status = checks.some((check) => check.severity === "difference")
    ? "discrepancy"
    : hasLowConfidence(extraction)
    ? "under_review"
    : "matched";
  return { checks, status };
}

function fileData(blob: Blob, name: string, mimeType: string) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    const base64 = btoa(binary);
    return { name, mimeType, base64, dataUrl: `data:${mimeType};base64,${base64}` };
  });
}

function safeFileName(path: string) {
  return path.split("/").pop()?.slice(0, 160) || "invoice";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "authentication_required" }, 401);
    }

    const projectUrl = Deno.env.get("SUPABASE_URL");
    const keySet = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const defaultKeyName = typeof keySet.default === "string" ? keySet.default : null;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")
      || (defaultKeyName ? Deno.env.get(defaultKeyName) : null)
      || (defaultKeyName?.startsWith("sb_publishable_") ? defaultKeyName : null);
    if (!projectUrl || !supabaseKey) {
      return jsonResponse({ error: "supabase_function_config_missing" }, 503);
    }

    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(projectUrl, supabaseKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: "invalid_session" }, 401);

    const supabase = createClient(projectUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json();
    const action = body?.action === "verify" ? "verify" : "analyze";
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : null;
    const hasReceipt = typeof body?.receiptPath === "string" && body.receiptPath.length > 0;
    let extraction: Extraction;

    if (action === "verify") {
      if (!invoiceId || !body?.extraction || typeof body.extraction !== "object") {
        return jsonResponse({ error: "invalid_review_payload" }, 400);
      }
      const { data: ownedInvoice, error: invoiceError } = await supabase
        .from("invoices").select("id, receipt_path, supplier_id").eq("id", invoiceId).maybeSingle();
      if (invoiceError || !ownedInvoice) return jsonResponse({ error: "invoice_not_found" }, 404);
      const enriched = await applySelectedSupplier(
        supabase,
        invoiceId,
        ownedInvoice.supplier_id,
        enrichExtraction(body.extraction as Extraction),
      );
      if (!enriched) return jsonResponse({ error: "invoice_supplier_unavailable" }, 409);
      extraction = enriched;
      const result = await runChecks(supabase, invoiceId, extraction, Boolean(ownedInvoice.receipt_path));
      return jsonResponse({ extraction, ...result });
    }

    if (!invoiceId) return jsonResponse({ error: "invalid_document_path" }, 400);
    const { data: ownedInvoice, error: ownedInvoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_path, receipt_path, supplier_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (ownedInvoiceError || !ownedInvoice) return jsonResponse({ error: "invoice_not_found" }, 404);
    const invoicePath = ownedInvoice.invoice_path;
    const receiptPath = ownedInvoice.receipt_path;
    if (
      !invoicePath.startsWith(`${authData.user.id}/${invoiceId}/`)
      || (receiptPath && !receiptPath.startsWith(`${authData.user.id}/${invoiceId}/`))
    ) return jsonResponse({ error: "invalid_document_path" }, 400);

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) return jsonResponse({ error: "ai_not_configured" }, 503);

    const { data: invoiceBlob, error: invoiceDownloadError } = await supabase
      .storage.from("invoice-documents").download(invoicePath);
    if (invoiceDownloadError || !invoiceBlob) return jsonResponse({ error: "invoice_image_unavailable" }, 400);
    if (invoiceBlob.size === 0 || invoiceBlob.size > 10 * 1024 * 1024) return jsonResponse({ error: "file_too_large" }, 413);
    const mimeType = invoiceBlob.type.toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mimeType)) {
      return jsonResponse({ error: "unsupported_file_type" }, 415);
    }

    const invoiceData = await fileData(invoiceBlob, safeFileName(invoicePath), mimeType);
    const content: Array<Record<string, unknown>> = [{
      type: "input_text",
      text: "حلل المستند المرفق كفاتورة. لا تخمّن أي قيمة غير واضحة.",
    }];
    if (mimeType === "application/pdf") {
      content.push({
        type: "input_file",
        filename: invoiceData.name,
        file_data: invoiceData.dataUrl,
      });
    } else {
      content.push({ type: "input_image", image_url: invoiceData.dataUrl, detail: "high" });
    }

    if (receiptPath) {
      const { data: receiptBlob, error: receiptDownloadError } = await supabase
        .storage.from("invoice-documents").download(receiptPath);
      if (receiptDownloadError || !receiptBlob) return jsonResponse({ error: "receipt_image_unavailable" }, 400);
      if (receiptBlob.size === 0 || receiptBlob.size > 10 * 1024 * 1024) return jsonResponse({ error: "file_too_large" }, 413);
      const receiptType = receiptBlob.type.toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(receiptType)) {
        return jsonResponse({ error: "unsupported_file_type" }, 415);
      }
      const receiptData = await fileData(receiptBlob, safeFileName(receiptPath), receiptType);
      content.push({ type: "input_text", text: "هذا مستند سند استلام أو ورقة طلب للمقارنة فقط." });
      if (receiptType === "application/pdf") {
        content.push({
          type: "input_file",
          filename: receiptData.name,
          file_data: receiptData.dataUrl,
        });
      } else {
        content.push({ type: "input_image", image_url: receiptData.dataUrl, detail: "high" });
      }
    }

    const openai = new OpenAI({ apiKey: openAiKey, timeout: 90_000, maxRetries: 0 });
    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
        { role: "user", content },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "invoice_extraction",
          strict: true,
          schema: invoiceSchema,
        },
      },
    });

    if (!response.output_text) return jsonResponse({ error: "unreadable_invoice" }, 422);
    try {
      const extracted = enrichExtraction(JSON.parse(response.output_text) as Extraction);
      const withSupplier = await applySelectedSupplier(supabase, invoiceId, ownedInvoice.supplier_id, extracted);
      if (!withSupplier) return jsonResponse({ error: "invoice_supplier_unavailable" }, 409);
      extraction = withSupplier;
    } catch {
      return jsonResponse({ error: "unreadable_invoice" }, 422);
    }
    if (extraction.items.length === 0 || (!extraction.supplierName && !extraction.total)) {
      return jsonResponse({ error: "unreadable_invoice" }, 422);
    }

    const result = await runChecks(supabase, null, extraction, Boolean(receiptPath));
    return jsonResponse({ extraction, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("timeout")) {
      return jsonResponse({ error: "analysis_timeout" }, 504);
    }
    return jsonResponse({ error: "invoice_analysis_failed" }, 500);
  }
});
