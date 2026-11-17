import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai";
import * as XLSX from "npm:xlsx@0.18.5";

const BUCKET = "supplier-price-imports";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;
const MAX_WORKSHEETS = 5;
const MAX_WORKSHEET_ROWS = 2_000;
const MAX_WORKSHEET_COLUMNS = 40;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type PriceItem = {
  itemName: string;
  unit: string | null;
  unitPrice: string | null;
  confidence: number;
};

type PriceList = {
  supplierName: string | null;
  currency: string | null;
  items: PriceItem[];
  skippedRows: number;
  truncated: boolean;
  sourceType: "image" | "excel";
};

const imageSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          itemName: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          unitPrice: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["itemName", "unit", "unitPrice", "confidence"],
      },
    },
  },
  required: ["supplierName", "currency", "items"],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  return String(value).trim();
}

function parseAmount(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000
      ? String(value)
      : null;
  }

  let amount = textValue(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/[٬\s]/g, "")
    .replace(/[^\d.,+-]/g, "");

  if (!amount) return null;
  const comma = amount.lastIndexOf(",");
  const dot = amount.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    amount =
      comma > dot
        ? amount.replace(/\./g, "").replace(",", ".")
        : amount.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = amount.length - comma - 1;
    amount =
      decimals > 0 && decimals <= 2
        ? amount.replace(",", ".")
        : amount.replace(/,/g, "");
  }
  if (!/^\+?\d+(?:\.\d+)?$/.test(amount)) return null;
  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000_000
    ? String(parsed)
    : null;
}

function hasAmbiguousCommaDecimal(value: unknown): boolean {
  if (typeof value === "number") return false;
  const normalized = textValue(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^\d,]/g, "");
  return /^\d+,\d{3}$/.test(normalized);
}

function normalizeCurrency(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizeKey(value);
  if (
    /\bkwd\b/.test(normalized) ||
    normalized.includes("دينار كويتي") ||
    normalized === "د ك"
  ) {
    return "KWD";
  }
  if (/\busd\b/.test(normalized)) return "USD";
  if (/\bsar\b/.test(normalized)) return "SAR";
  if (/\bbhd\b/.test(normalized)) return "BHD";
  return value.trim().slice(0, 16).toUpperCase();
}

function fileKind(bytes: Uint8Array): "image" | "excel" | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return "image";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
    return "excel";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  )
    return "excel";
  return null;
}

function safeExcelName(path: string) {
  return path.split("/").pop()?.slice(0, 160) || "price-list.xlsx";
}

function headerKey(value: unknown) {
  return normalizeKey(textValue(value));
}

function findHeader(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

const itemHeaders = [
  "item",
  "item name",
  "product",
  "product name",
  "description",
  "material",
  "اسم الصنف",
  "الصنف",
  "المنتج",
  "اسم المنتج",
  "اسم المادة",
  "المادة",
  "الوصف",
  "البيان",
];
const unitHeaders = [
  "unit",
  "uom",
  "unit of measure",
  "الوحدة",
  "وحدة",
  "وحدة القياس",
];
const priceHeaders = [
  "unit price",
  "price per unit",
  "price",
  "rate",
  "cost",
  "السعر",
  "سعر",
  "سعر الوحدة",
  "السعر للوحدة",
  "سعر الحبة",
  "سعر القطعة",
];
const supplierHeaders = [
  "supplier",
  "vendor",
  "supplier name",
  "vendor name",
  "المورد",
  "اسم المورد",
];
const currencyHeaders = ["currency", "العملة", "العملة المستخدمة"];

function extractExcel(bytes: Uint8Array): PriceList | null {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: false,
      sheetRows: MAX_WORKSHEET_ROWS,
      bookVBA: false,
    });
  } catch {
    return null;
  }
  const items: PriceItem[] = [];
  let supplierName: string | null = null;
  let currency: string | null = null;
  let skippedRows = 0;
  let truncated = false;

  for (const sheetName of workbook.SheetNames.slice(0, MAX_WORKSHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
      sheetRows: MAX_WORKSHEET_ROWS,
    });
    let columns: {
      headerRow: number;
      item: number;
      unit: number;
      price: number;
      supplier: number;
      currency: number;
    } | null = null;

    for (
      let rowIndex = 0;
      rowIndex < Math.min(rows.length, 25);
      rowIndex += 1
    ) {
      const headerCells = (rows[rowIndex] ?? []).slice(
        0,
        MAX_WORKSHEET_COLUMNS,
      );
      const headers = headerCells.map(headerKey);
      const item = findHeader(headers, itemHeaders);
      const price = findHeader(headers, priceHeaders);
      if (item >= 0 && price >= 0) {
        columns = {
          headerRow: rowIndex,
          item,
          unit: findHeader(headers, unitHeaders),
          price,
          supplier: findHeader(headers, supplierHeaders),
          currency: findHeader(headers, currencyHeaders),
        };
        break;
      }
    }

    if (!columns) continue;
    for (const row of rows.slice(columns.headerRow + 1)) {
      if (items.length >= MAX_IMPORT_ROWS) {
        truncated = true;
        break;
      }
      const itemName = textValue(row[columns.item]).slice(0, 160);
      if (!itemName) {
        if ((row ?? []).some((cell) => textValue(cell))) skippedRows += 1;
        continue;
      }
      const unit =
        columns.unit >= 0
          ? textValue(row[columns.unit]).slice(0, 80) || null
          : null;
      const unitPrice = parseAmount(row[columns.price]);
      if (columns.supplier >= 0 && !supplierName) {
        supplierName = textValue(row[columns.supplier]).slice(0, 160) || null;
      }
      if (columns.currency >= 0 && !currency) {
        currency = normalizeCurrency(textValue(row[columns.currency]) || null);
      }
      items.push({
        itemName,
        unit,
        unitPrice,
        confidence:
          unitPrice === null
            ? 0.35
            : hasAmbiguousCommaDecimal(row[columns.price])
              ? 0.55
              : 1,
      });
    }
    if (truncated) break;
  }

  if (!items.length) return null;
  return {
    supplierName,
    currency,
    items,
    skippedRows,
    truncated,
    sourceType: "excel",
  };
}

function base64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function normalizeImageList(value: unknown): PriceList | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.items)) return null;
  const items = raw.items
    .slice(0, MAX_IMPORT_ROWS)
    .flatMap((entry): PriceItem[] => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const itemName = textValue(row.itemName).slice(0, 160);
      if (!itemName) return [];
      const confidence =
        typeof row.confidence === "number" && Number.isFinite(row.confidence)
          ? Math.max(0, Math.min(1, row.confidence))
          : 0;
      return [
        {
          itemName,
          unit: textValue(row.unit).slice(0, 80) || null,
          unitPrice: parseAmount(row.unitPrice),
          confidence,
        },
      ];
    });
  if (!items.length) return null;
  return {
    supplierName: textValue(raw.supplierName).slice(0, 160) || null,
    currency: normalizeCurrency(textValue(raw.currency) || null),
    items,
    skippedRows: raw.items.length - items.length,
    truncated: raw.items.length > MAX_IMPORT_ROWS,
    sourceType: "image",
  };
}

async function extractImage(
  bytes: Uint8Array,
  mimeType: string,
  openAiKey: string,
) {
  const openai = new OpenAI({
    apiKey: openAiKey,
    timeout: 60_000,
    maxRetries: 0,
  });
  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "اقرأ قائمة الأسعار المرفقة. استخرج اسم المورد والعملة إن ظهرا بوضوح، ثم كل صنف ووحدته وسعر الوحدة. لا تخمّن. أعد السعر كسلسلة رقمية عشرية بأرقام لاتينية ونقطة عشرية دون فواصل أو رموز عملة. اجعل الثقة بين 0 و1 بحسب وضوح الاسم والسعر. إذا كان السعر غير واضح أعد null وثقة أقل من 0.5. لا تضف أصنافاً غير موجودة في الصورة.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "استخرج جدول الأصناف والأسعار فقط لمراجعته قبل الحفظ.",
          },
          {
            type: "input_image",
            image_url: `data:${mimeType};base64,${base64(bytes)}`,
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "supplier_price_list",
        strict: true,
        schema: imageSchema,
      },
    },
  });
  if (!response.output_text) return null;
  try {
    return normalizeImageList(JSON.parse(response.output_text));
  } catch {
    return null;
  }
}

function validPath(path: string, userId: string) {
  if (path.length > 500) return false;
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    parts.every((part) => part.length > 0 && part !== "." && part !== "..")
  );
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return jsonResponse({ error: "method_not_allowed" }, 405);

  let supabase: ReturnType<typeof createClient> | null = null;
  let uploadedPath: string | null = null;
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "authentication_required" }, 401);
    }

    const projectUrl = Deno.env.get("SUPABASE_URL");
    let keySet: Record<string, unknown> = {};
    try {
      keySet = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    } catch {
      keySet = {};
    }
    const defaultKeyName =
      typeof keySet.default === "string" ? keySet.default : null;
    const supabaseKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      (defaultKeyName ? Deno.env.get(defaultKeyName) : null) ||
      (defaultKeyName?.startsWith("sb_publishable_") ? defaultKeyName : null);
    if (!projectUrl || !supabaseKey) {
      return jsonResponse({ error: "supabase_function_config_missing" }, 503);
    }

    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(projectUrl, supabaseKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);
    if (authError || !authData.user)
      return jsonResponse({ error: "invalid_session" }, 401);

    supabase = createClient(projectUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const filePath =
      body &&
      typeof body === "object" &&
      "filePath" in body &&
      typeof body.filePath === "string"
        ? body.filePath
        : "";
    if (!validPath(filePath, authData.user.id))
      return jsonResponse({ error: "invalid_document_path" }, 400);
    uploadedPath = filePath;

    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(filePath);
    if (downloadError || !file)
      return jsonResponse({ error: "price_list_unavailable" }, 400);
    if (file.size === 0 || file.size > MAX_FILE_BYTES)
      return jsonResponse({ error: "file_too_large" }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = fileKind(bytes);
    const extension =
      safeExcelName(filePath).split(".").pop()?.toLocaleLowerCase() ?? "";
    if (!kind) return jsonResponse({ error: "unsupported_file_type" }, 415);
    if (
      (kind === "image" &&
        !["jpg", "jpeg", "png", "webp"].includes(extension)) ||
      (kind === "excel" && !["xls", "xlsx"].includes(extension))
    ) {
      return jsonResponse({ error: "file_extension_mismatch" }, 415);
    }

    let result: PriceList | null = null;
    if (kind === "excel") {
      result = extractExcel(bytes);
      if (!result) return jsonResponse({ error: "unreadable_price_list" }, 422);
    } else {
      const openAiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openAiKey) return jsonResponse({ error: "ai_not_configured" }, 503);
      const mimeType =
        extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "";
      if (!mimeType)
        return jsonResponse({ error: "unsupported_file_type" }, 415);
      try {
        result = await extractImage(bytes, mimeType, openAiKey);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.toLowerCase().includes("timeout")
        ) {
          return jsonResponse({ error: "analysis_timeout" }, 504);
        }
        return jsonResponse({ error: "price_list_analysis_failed" }, 502);
      }
      if (!result) return jsonResponse({ error: "unreadable_price_list" }, 422);
    }

    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "price_list_analysis_failed" }, 500);
  } finally {
    if (supabase && uploadedPath) {
      try {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
      } catch {
        // The client also removes its temporary upload. Never include file paths in errors.
      }
    }
  }
});
