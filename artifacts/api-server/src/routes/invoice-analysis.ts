import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AnalyzeInvoiceBody, AnalyzeInvoiceResponse } from "@workspace/api-zod";
import { extractInvoice, InvoiceInputError } from "../lib/invoice-extraction";
import { verifyInvoice } from "../lib/invoice-arithmetic";

export function createInvoiceAnalysisRouter(
  extract = extractInvoice,
  requestLimit = 12,
  isConfigured = () => Boolean(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
) {
const router = Router();
// Global process budget is deliberately not based on spoofable forwarded IP headers.
const budget = rateLimit({
  windowMs: 60_000,
  limit: requestLimit,
  keyGenerator: () => "invoice-analysis-global",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "وصل التحليل إلى حد الطلبات. انتظر دقيقة ثم حاول مجددًا." },
});
let active = 0;
router.post("/openai/invoice-analysis", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
}, budget, async (req, res): Promise<void> => {
  const parsed = AnalyzeInvoiceBody.strict().safeParse(req.body);
  if (!parsed.success || parsed.data.text.trim().length < 10) {
    res.status(400).json({ error: "الصق نص فاتورة من ١٠ إلى ١٢٠٠٠ حرف، ووافق على إرساله للتحليل." });
    return;
  }
  if (active >= 2) {
    res.status(429).json({ error: "التحليل مشغول الآن. انتظر قليلًا ثم أعد المحاولة." });
    return;
  }
  if (!isConfigured()) {
    res.status(503).json({ error: "خدمة التحليل غير مهيأة على الخادم. لم يُحفظ النص؛ حاول لاحقًا." });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const onClose = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", onClose);
  active++;
  try {
    const invoice = await extract(parsed.data.text.trim(), controller.signal);
    const result = AnalyzeInvoiceResponse.parse(verifyInvoice(invoice));
    if (!res.destroyed) res.json(result);
  } catch (error) {
    if (res.destroyed) return;
    if (error instanceof InvoiceInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    const timedOut = controller.signal.aborted || (error instanceof Error && /timeout|timedout/i.test(error.name));
    // Never log input, result, provider errors, payloads or request objects.
    req.log.warn({ category: timedOut ? "timeout" : "provider_or_schema" }, "Invoice analysis failed");
    res.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? "استغرق التحليل وقتًا طويلًا. النص لم يُحفظ؛ جرّب فاتورة أقصر أو أعد المحاولة."
        : "تعذّر استخراج نتيجة موثوقة من خدمة التحليل. راجع النص ثم أعد المحاولة.",
    });
  } finally {
    active--;
    clearTimeout(timeout);
    res.off("close", onClose);
  }
});
return router;
}
export default createInvoiceAnalysisRouter();
