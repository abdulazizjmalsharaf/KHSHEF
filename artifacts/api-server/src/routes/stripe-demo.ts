import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { CreateTestCheckoutBody, CreateTestCheckoutResponse, VerifyTestCheckoutBody, VerifyTestCheckoutResponse } from "@workspace/api-zod";
import { SandboxStripe } from "@workspace/stripe-test/sandbox";
import { isTestCheckoutUrl, ownsCheckout, signCheckout, validateCart } from "../lib/stripe-test-security";
import { paymentOrigin } from "../lib/stripe-test-state";

const router = Router();
const unavailable = "تعذّر الاتصال بدفع Stripe التجريبي الآن. لا توجد مبالغ حقيقية أو صلاحيات مدفوعة؛ حاول مجددًا.";
const secret = () => {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("COOKIE_CONFIGURATION_REQUIRED");
  return value;
};
router.use("/stripe", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); },
  rateLimit({ windowMs: 60_000, limit: 40, keyGenerator: () => "stripe-demo", standardHeaders: "draft-7", legacyHeaders: false, message: { error: "انتظر دقيقة قبل إعادة محاولة الدفع التجريبي." } }));
router.get("/stripe/test-status", async (_req, res) => {
  try {
    secret();
    const quote = await new SandboxStripe().quote();
    res.json({
      ready: true, testMode: true, checkoutCurrency: quote.currency,
      ...(quote.currency === "usd" ? { exchangeRateUpdatedAt: new Date(quote.updated * 1000).toISOString(), exchangeRateSource: quote.source } : {}),
      message: quote.currency === "kwd"
        ? "التجربة جاهزة بالدينار الكويتي. استخدم بطاقة الاختبار فقط؛ لا يوجد خصم حقيقي."
        : "أسعار الموقع بالدينار الكويتي. Stripe سيعرض المقابل التجريبي بالدولار بسعر صرف منشور ومحدّث، مع تقريب كل باقة لأقرب سنت. لا يوجد خصم حقيقي.",
    });
  } catch { res.json({ ready: false, testMode: true, message: unavailable }); }
});
router.post("/stripe/test-checkout", async (req, res): Promise<void> => {
  const input = CreateTestCheckoutBody.strict().safeParse(req.body);
  if (!input.success || !validateCart(input.data.planIds)) { res.status(400).json({ error: "اختر باقات مختلفة من القائمة فقط." }); return; }
  if (req.get("sec-fetch-site") === "cross-site") { res.status(403).json({ error: "ابدأ الدفع من سلة كاشف." }); return; }
  try {
    const signingSecret = secret();
    const session = await new SandboxStripe().createSession([...input.data.planIds].sort(), input.data.requestId, paymentOrigin());
    if (!isTestCheckoutUrl(session.url)) throw new Error("UNTRUSTED_REDIRECT");
    res.cookie("kashef_checkout_proof", signCheckout(session.id, signingSecret), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/api/stripe", maxAge: 86_400_000,
    });
    res.json(CreateTestCheckoutResponse.parse({ url: session.url, testMode: true }));
  } catch { req.log.warn("Stripe demo checkout unavailable"); res.status(503).json({ error: unavailable }); }
});
router.post("/stripe/test-verification", async (req, res): Promise<void> => {
  const input = VerifyTestCheckoutBody.strict().safeParse(req.body);
  try {
    if (!input.success || !ownsCheckout(input.data.sessionId, req.cookies?.kashef_checkout_proof, secret())) {
      res.status(403).json({ error: "هذه الجلسة لا تخص المتصفح الحالي. ارجع للسلة لبدء تجربة جديدة." }); return;
    }
    const { session, ids } = await new SandboxStripe().verifySession(input.data.sessionId);
    const paid = session.status === "complete" && session.payment_status === "paid";
    res.json(VerifyTestCheckoutResponse.parse({
      status: paid ? "paid" : session.status === "expired" ? "expired" : "pending",
      testMode: true, planIds: paid ? ids : [],
      message: paid ? "نجحت تجربة الدفع وأكدها Stripe. لم يُخصم مبلغ حقيقي ولم يُفعّل اشتراك مدفوع." : "لم يؤكد Stripe اكتمال التجربة بعد. السلة محفوظة ويمكنك إعادة التحقق.",
    }));
  } catch { res.status(503).json({ error: unavailable }); }
});
export default router;
