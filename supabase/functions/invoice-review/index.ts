import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai";

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
};
type Check = {
  code: string;
  severity: "difference" | "warning";
  title: string;
  detail: string;
  amountAffected: string | null;
  currency: string;
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

function toMicros(value: string | null | undefined): bigint | null {
  if (!value) return null;
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/[٬,\s]/g, "")
    .replace(/[^\d.-]/g, "");
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const fraction = (match[3] ?? "").padEnd(6, "0");
  const micros = BigInt(match[2]) * 1_000_000n + BigInt(fraction || "0");
  return match[1] === "-" ? -micros : micros;
}

function fromMicros(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const thousandths = (absolute + 500n) / 1000n;
  const whole = thousandths / 1000n;
  const fraction = String(thousandths % 1000n).padStart(3, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function validConfidence(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

function enrichExtraction(raw: Extraction): Extraction {
  const currency = (raw.currency || "KWD").trim().toUpperCase();
  const supplierName = raw.supplierName?.trim() || null;
  return {
    ...raw,
    supplierName,
    supplierKey: normalizeKey(supplierName),
    invoiceNumber: raw.invoiceNumber?.trim() || null,
    invoiceNumberKey: normalizeInvoiceNumber(raw.invoiceNumber),
    invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.invoiceDate ?? "") ? raw.invoiceDate : null,
    currency,
    supplierNameConfidence: validConfidence(raw.supplierNameConfidence),
    invoiceNumberConfidence: validConfidence(raw.invoiceNumberConfidence),
    invoiceDateConfidence: validConfidence(raw.invoiceDateConfidence),
    currencyConfidence: raw.currency ? validConfidence(raw.currencyConfidence) : 0.2,
    totalConfidence: validConfidence(raw.totalConfidence),
    items: (raw.items ?? []).map((item) => ({
      ...item,
      name: item.name?.trim() || null,
      itemKey: normalizeKey(item.name),
      nameConfidence: validConfidence(item.nameConfidence),
      quantityConfidence: validConfidence(item.quantityConfidence),
      unitConfidence: validConfidence(item.unitConfidence),
      unitPriceConfidence: validConfidence(item.unitPriceConfidence),
      lineTotalConfidence: validConfidence(item.lineTotalConfidence),
    })),
    additionalFees: (raw.additionalFees ?? []).map((fee) => ({
      ...fee,
      name: fee.name?.trim() || null,
      feeKey: normalizeKey(fee.name),
      nameConfidence: validConfidence(fee.nameConfidence),
      amountConfidence: validConfidence(fee.amountConfidence),
    })),
    receiptItems: (raw.receiptItems ?? []).map((item) => ({
      ...item,
      itemKey: normalizeKey(item.name),
      nameConfidence: validConfidence(item.nameConfidence),
      quantityConfidence: validConfidence(item.quantityConfidence),
      unitConfidence: validConfidence(item.unitConfidence),
    })),
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
  const add = (
    code: string,
    severity: Check["severity"],
    title: string,
    detail: string,
    amountAffected: bigint | null = null,
  ) => checks.push({
    code,
    severity,
    title,
    detail,
    amountAffected: amountAffected === null ? null : fromMicros(amountAffected),
    currency,
  });

  let lineSum = 0n;
  let canCheckTotal = extraction.items.length > 0;
  for (const item of extraction.items) {
    const quantity = toMicros(item.quantity);
    const unitPrice = toMicros(item.unitPrice);
    const lineTotal = toMicros(item.lineTotal);
    if (quantity === null || unitPrice === null || lineTotal === null) {
      canCheckTotal = false;
      continue;
    }
    lineSum += lineTotal;
    const expected = (quantity * unitPrice) / 1_000_000n;
    const difference = expected > lineTotal ? expected - lineTotal : lineTotal - expected;
    if (difference > 1_000n) {
      add(
        "line_math",
        "difference",
        "مجموع السطر لا يطابق الكمية × السعر",
        `الصنف: ${item.name ?? "غير معروف"}. الفرق المحسوب ${fromMicros(difference)} ${currency}.`,
        difference,
      );
    }
  }

  let feeSum = 0n;
  for (const fee of extraction.additionalFees) {
    const amount = toMicros(fee.amount);
    if (amount === null) {
      canCheckTotal = false;
      continue;
    }
    feeSum += amount;
  }

  const invoiceTotal = toMicros(extraction.total);
  if (invoiceTotal === null) canCheckTotal = false;
  if (canCheckTotal && invoiceTotal !== null) {
    const calculated = lineSum + feeSum;
    const difference = calculated > invoiceTotal ? calculated - invoiceTotal : invoiceTotal - calculated;
    if (difference > 1_000n) {
      add(
        "invoice_math",
        "difference",
        "الإجمالي لا يطابق مجموع الأصناف والرسوم",
        `المجموع المحسوب ${fromMicros(calculated)} ${currency} مقابل إجمالي الفاتورة ${fromMicros(invoiceTotal)} ${currency}.`,
        difference,
      );
    }
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
    const { data } = await supabase.from("invoices")
      .select("id, extracted_data")
      .eq("supplier_key", supplierKey)
      .in("status", ["matched", "approved"])
      .order("created_at", { ascending: false })
      .limit(12);
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
    const { data: agreed } = await supabase.from("supplier_price_agreements")
      .select("item_key, unit_key, unit_price")
      .eq("supplier_key", supplierKey)
      .eq("currency", currency)
      .in("item_key", productKeys);
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
    const receiptByKey = new Map(
      extraction.receiptItems
        .filter((item) => item.itemKey && item.quantity)
        .map((item) => [item.itemKey!, item]),
    );
    if (receiptByKey.size === 0) {
      add("receipt_unreadable", "warning", "تعذر قراءة كميات سند الاستلام", "راجع صورة سند الاستلام أو أعد رفع صورة أوضح.");
    } else {
      for (const item of extraction.items) {
        const billed = toMicros(item.quantity);
        if (!item.itemKey || billed === null) continue;
        const receivedItem = receiptByKey.get(item.itemKey);
        if (!receivedItem) {
          const lineTotal = toMicros(item.lineTotal);
          add(
            "receipt_item_missing",
            "difference",
            "صنف الفاتورة غير ظاهر في سند الاستلام",
            `لم نجد "${item.name ?? "الصنف"}" في أصناف سند الاستلام.`,
            lineTotal,
          );
          continue;
        }
        const received = toMicros(receivedItem.quantity);
        const unitPrice = toMicros(item.unitPrice);
        if (received !== null && received < billed) {
          const shortage = billed - received;
          const amount = unitPrice === null ? null : (shortage * unitPrice) / 1_000_000n;
          add(
            "receipt_quantity",
            "difference",
            "الكمية المستلمة أقل من المفوترة",
            `${item.name ?? "الصنف"}: المفوتر ${fromMicros(billed)} والمستلم ${fromMicros(received)}.`,
            amount,
          );
        }
      }
    }
  }

  const status = checks.length > 0
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
        .from("invoices").select("id, receipt_path").eq("id", invoiceId).maybeSingle();
      if (invoiceError || !ownedInvoice) return jsonResponse({ error: "invoice_not_found" }, 404);
      extraction = enrichExtraction(body.extraction as Extraction);
      const result = await runChecks(supabase, invoiceId, extraction, Boolean(ownedInvoice.receipt_path));
      return jsonResponse({ extraction, ...result });
    }

    const invoicePath = typeof body?.invoicePath === "string" ? body.invoicePath : "";
    const receiptPath = typeof body?.receiptPath === "string" ? body.receiptPath : null;
    if (
      !invoiceId
      || !invoicePath.startsWith(`${authData.user.id}/${invoiceId}/`)
      || (receiptPath && !receiptPath.startsWith(`${authData.user.id}/${invoiceId}/`))
    ) {
      return jsonResponse({ error: "invalid_document_path" }, 400);
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) return jsonResponse({ error: "ai_not_configured" }, 503);

    const { data: invoiceBlob, error: invoiceDownloadError } = await supabase
      .storage.from("invoice-documents").download(invoicePath);
    if (invoiceDownloadError || !invoiceBlob) return jsonResponse({ error: "invoice_image_unavailable" }, 400);
    if (invoiceBlob.size > 10 * 1024 * 1024) return jsonResponse({ error: "file_too_large" }, 413);
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
      if (!receiptPath.startsWith(`${authData.user.id}/${invoiceId}/`)) {
        return jsonResponse({ error: "invalid_document_path" }, 400);
      }
      const { data: receiptBlob, error: receiptDownloadError } = await supabase
        .storage.from("invoice-documents").download(receiptPath);
      if (receiptDownloadError || !receiptBlob) return jsonResponse({ error: "receipt_image_unavailable" }, 400);
      if (receiptBlob.size > 10 * 1024 * 1024) return jsonResponse({ error: "file_too_large" }, 413);
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
      extraction = enrichExtraction(JSON.parse(response.output_text) as Extraction);
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
