import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { AnalyzeInvoiceBody, AnalyzeInvoiceResponse } from "@workspace/api-zod";
import { extractInvoice, InvoiceInputError, type ExtractedInvoice } from "../lib/invoice-extraction";
import { InvoiceUploadError, processUploadedInvoice } from "../lib/invoice-file-processing";
import { verifyInvoice } from "../lib/invoice-arithmetic";

export function createInvoiceAnalysisRouter(
  extract = extractInvoice,
  requestLimit = 12,
  isConfigured = () => Boolean(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
  extractFile = processUploadedInvoice,
) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 1, parts: 2 } });
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

  const analyze = async (
    req: Request,
    res: Response,
    run: (signal: AbortSignal) => Promise<ExtractedInvoice>,
  ): Promise<void> => {
    if (active >= 2) {
      res.status(429).json({ error: "التحليل مشغول الآن. انتظر قليلًا ثم أعد المحاولة." });
      return;
    }
    if (!isConfigured()) {
      res.status(503).json({ error: "خدمة التحليل غير مهيأة على الخادم. لم يُحفظ الملف أو النص؛ حاول لاحقًا." });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", onClose);
    active++;
    try {
      const invoice = await run(controller.signal);
      const result = AnalyzeInvoiceResponse.parse(verifyInvoice(invoice));
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (res.destroyed) return;
      if (error instanceof InvoiceInputError || error instanceof InvoiceUploadError) {
        res.status(error instanceof InvoiceUploadError ? error.statusCode : 400).json({ error: error.message });
        return;
      }
      const timedOut = controller.signal.aborted || (error instanceof Error && /timeout|timedout/i.test(error.name));
      // Never log invoice text, file contents, provider errors, payloads or request objects.
      req.log.warn({ category: timedOut ? "timeout" : "provider_or_schema" }, "Invoice analysis failed");
      res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? "استغرق التحليل وقتًا طويلًا. لم يُحفظ الملف أو النص؛ جرّب فاتورة أقصر أو أعد المحاولة."
          : "تعذّر استخراج نتيجة موثوقة. راجع النص أو جرّب صورة أوضح ثم أعد المحاولة.",
      });
    } finally {
      active--;
      clearTimeout(timeout);
      res.off("close", onClose);
    }
  };

  router.post("/openai/invoice-analysis", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  }, budget, async (req, res): Promise<void> => {
    const parsed = AnalyzeInvoiceBody.strict().safeParse(req.body);
    if (!parsed.success || parsed.data.text.trim().length < 10) {
      res.status(400).json({ error: "الصق نص الفاتورة بأي صيغة، أو اختر ملفًا. يكفي وجود أصناف ومبالغها؛ لا يلزم ذكر الكميات والإجمالي." });
      return;
    }
    await analyze(req, res, (signal) => extract(parsed.data.text.trim(), signal));
  });

  router.post("/openai/invoice-file-analysis", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  }, budget, (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (error) {
        const tooLarge = error instanceof Error && error.message === "File too large";
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? "الحد الأقصى لحجم الملف ٨ ميغابايت." : "ارفع ملف صورة أو PDF واحدًا فقط.",
        });
        return;
      }
      next();
    });
  }, async (req, res): Promise<void> => {
    if (req.body?.consent !== "true") {
      res.status(400).json({ error: "وافق على إرسال الفاتورة إلى خدمة التحليل قبل رفع الملف." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "اختر صورة فاتورة أو ملف PDF." });
      return;
    }
    await analyze(req, res, (signal) => extractFile(req.file!, signal));
  });
  return router;
}
export default createInvoiceAnalysisRouter();
