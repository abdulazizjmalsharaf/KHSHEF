import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { CreateTestCheckoutBody, CreateTestCheckoutResponse, VerifyTestCheckoutBody, VerifyTestCheckoutResponse } from "@workspace/api-zod";
import { requireTestObject, TEST_PLANS } from "@workspace/stripe-test";
import { ensureTestPaymentsReady, getTestCatalog, getUncachableStripeClient, paymentOrigin, validatePaymentConfiguration, verifySessionCart } from "../lib/stripe-test-state";
import { isTestCheckoutUrl, ownsCheckout, signCheckout, validateCart } from "../lib/stripe-test-security";

const router = Router();
const unavailable = "الدفع التجريبي غير جاهز. يلزم تصحيح مفتاح Stripe الاختباري واتصال Supabase وإعداد الباقات على الخادم؛ باقي الموقع يعمل كالمعتاد.";
const budget = rateLimit({ windowMs: 60000, limit: 30, keyGenerator: () => "stripe-test-global", standardHeaders: "draft-7", legacyHeaders: false, message: { error: "طلبات كثيرة للدفع التجريبي؛ انتظر دقيقة." } });
router.use("/stripe", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); }, budget);
router.get("/stripe/test-status", async (_req, res): Promise<void> => {
  try {
    await ensureTestPaymentsReady();
    res.json({ ready: true, testMode: true, message: "Stripe Test Mode جاهز. استخدم بطاقة اختبار فقط؛ لا يوجد خصم حقيقي أو تفعيل تجاري." });
  } catch { res.json({ ready: false, testMode: true, message: unavailable }); }
});
router.post("/stripe/test-checkout", async (req, res): Promise<void> => {
  const input = CreateTestCheckoutBody.strict().safeParse(req.body);
  if (!input.success || !validateCart(input.data.planIds)) {
    res.status(400).json({ error: "اختر من باقة إلى ثلاث باقات مختلفة، مرة واحدة لكل باقة." }); return;
  }
  if (req.get("sec-fetch-site") === "cross-site") { res.status(403).json({ error: "افتح الدفع من موقع كاشف." }); return; }
  try {
    await ensureTestPaymentsReady();
    const stripe = await getUncachableStripeClient();
    requireTestObject(await stripe.balance.retrieve());
    const ids = [...input.data.planIds].sort();
    const catalog = await getTestCatalog();
    // Validate current remote prices too: a stale sync must never charge a changed price.
    for (const id of ids) {
      const price = await stripe.prices.retrieve(catalog.get(id)!);
      requireTestObject(price);
      const plan = TEST_PLANS.find((p) => p.id === id)!;
      if (!price.active || price.currency !== "kwd" || price.unit_amount !== plan.amount || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1) throw new Error("PRICE_CHANGED");
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", allowed_payment_method_types: ["card"],
      line_items: ids.map((id) => ({ price: catalog.get(id)!, quantity: 1 })),
      success_url: `${paymentOrigin()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${paymentOrigin()}/checkout/cancel`,
      metadata: { kashef_test_checkout: "true", kashef_plan_ids: ids.join(",") },
      subscription_data: { metadata: { kashef_test_checkout: "true", kashef_plan_ids: ids.join(",") } },
    }, { idempotencyKey: `kashef-test-${input.data.requestId}` });
    requireTestObject(session);
    if (!/^cs_test_/.test(session.id) || !isTestCheckoutUrl(session.url)) throw new Error("INVALID_TEST_SESSION");
    res.cookie("kashef_checkout_proof", signCheckout(session.id, process.env.SESSION_SECRET!), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/api/stripe", maxAge: 86_400_000,
    });
    res.json(CreateTestCheckoutResponse.parse({ url: session.url, testMode: true }));
  } catch {
    req.log.warn("Stripe Test Mode checkout unavailable");
    res.status(503).json({ error: unavailable });
  }
});
router.post("/stripe/test-verification", async (req, res): Promise<void> => {
  const input = VerifyTestCheckoutBody.strict().safeParse(req.body);
  try { validatePaymentConfiguration(); } catch { res.status(503).json({ error: unavailable }); return; }
  if (!input.success || !ownsCheckout(input.data.sessionId, req.cookies?.kashef_checkout_proof, process.env.SESSION_SECRET!)) {
    res.status(403).json({ error: "تعذّر إثبات جلسة الدفع لهذا المتصفح. ارجع للسلة وابدأ جلسة اختبار جديدة؛ لن نعلن نجاحًا دون تحقق." }); return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(input.data.sessionId);
    const ids = await verifySessionCart(stripe, session);
    const paid = session.status === "complete" && session.payment_status === "paid";
    res.json(VerifyTestCheckoutResponse.parse({
      status: paid ? "paid" : session.status === "expired" ? "expired" : "pending",
      testMode: true, planIds: paid ? ids : [],
      message: paid ? "تم تأكيد دفع Stripe التجريبي من الخادم. لا يوجد خصم حقيقي ولم تُفعّل صلاحيات مدفوعة."
        : "لم يؤكد Stripe اكتمال الدفع التجريبي. بقيت السلة محفوظة؛ يمكنك التحقق مجددًا.",
    }));
  } catch { res.status(503).json({ error: "تعذّر التحقق من Stripe الآن؛ لا تعتبر الدفع ناجحًا. حاول التحقق مرة أخرى." }); }
});
export default router;
