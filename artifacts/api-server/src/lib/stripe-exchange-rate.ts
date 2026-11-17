import Decimal from "decimal.js";

const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type DemoQuote = { currency: "kwd" | "usd"; rate: string; updated: number; source: string };
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
let cached: { quote: DemoQuote; expires: number } | undefined;
let pending: Promise<DemoQuote> | undefined;

export function validateExchangeResponse(value: unknown, now = Date.now()): DemoQuote {
  const data = value as {
    result?: string;
    base_code?: string;
    rates?: { KWD?: number; USD?: number };
    time_last_update_unix?: number;
  };
  if (
    !data ||
    data.result !== "success" ||
    data.base_code !== "KWD" ||
    data.rates?.KWD !== 1 ||
    typeof data.rates.USD !== "number" ||
    !Number.isFinite(data.rates.USD) ||
    data.rates.USD <= 0 ||
    data.rates.USD > 100 ||
    !Number.isInteger(data.time_last_update_unix)
  ) {
    throw new Error("FX_RESPONSE_INVALID");
  }
  const updated = data.time_last_update_unix!;
  if (now - updated * 1000 > MAX_AGE_MS || updated * 1000 > now + 300_000) {
    throw new Error("FX_RATE_STALE");
  }
  return {
    currency: "usd",
    rate: String(data.rates.USD),
    updated,
    source: "https://www.exchangerate-api.com",
  };
}

export async function getKwdUsdQuote(): Promise<DemoQuote> {
  const now = Date.now();
  if (cached && cached.expires > now && now - cached.quote.updated * 1000 <= MAX_AGE_MS) {
    return cached.quote;
  }
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch("https://open.er-api.com/v6/latest/KWD", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("FX_PROVIDER_UNAVAILABLE");
    const quote = validateExchangeResponse(await response.json());
    cached = {
      quote,
      expires: Math.min(Date.now() + 3_600_000, quote.updated * 1000 + MAX_AGE_MS),
    };
    return quote;
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}

/** KWD uses fils; USD uses cents. Round each approved monthly plan once. */
export function settlementAmount(fils: number, quote: DemoQuote): number {
  if (!Number.isSafeInteger(fils) || fils <= 0 || !/^\d+(\.\d+)?$/.test(quote.rate)) {
    throw new Error("INVALID_FX_AMOUNT");
  }
  const rate = new Money(quote.rate);
  if (!rate.gt(0) || rate.gt(100)) throw new Error("INVALID_FX_RATE");
  if (quote.currency === "kwd") {
    if (!rate.eq(1)) throw new Error("INVALID_NATIVE_CURRENCY_RATE");
    return fils;
  }
  const cents = new Money(fils).div(1000).mul(rate).mul(100).toDecimalPlaces(0).toNumber();
  if (!Number.isSafeInteger(cents) || cents < 1) throw new Error("INVALID_FX_AMOUNT");
  return cents;
}
