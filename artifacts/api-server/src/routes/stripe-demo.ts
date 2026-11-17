import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  CreateTestPaymentIntentBody,
  CreateTestPaymentIntentResponse,
  GetStripeTestStatusResponse,
  VerifyTestPaymentBody,
  VerifyTestPaymentResponse,
} from "@workspace/api-zod";
import {
  calculatePaymentAmount,
  createTestStripeClient,
  getDemoQuote,
  quoteFromPaymentMetadata,
} from "../lib/stripe-payment";
import {
  ownsPaymentIntent,
  signPaymentIntent,
  validateCart,
} from "../lib/stripe-test-security";

const router = Router();
const unavailable = "الدفع التجريبي غير متاح الآن. تأكد من إعداد مفاتيح الاختبار ثم حاول مجددًا.";

function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("PAYMENT_COOKIE_CONFIGURATION_REQUIRED");
  return value;
}

router.use(
  "/stripe",
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
  rateLimit({
    windowMs: 60_000,
    limit: 40,
    keyGenerator: () => "embedded-stripe-test",
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "انتظر دقيقة قبل إعادة محاولة الدفع التجريبي." },
  }),
);

router.get("/stripe/test-status", async (req, res): Promise<void> => {
  try {
    sessionSecret();
    const publishableKey = process.env.TEST_STRIPE_PUBLISHABLE_KEY;
    const stripe = createTestStripeClient();
    await stripe.balance.retrieve();
    const quote = await getDemoQuote();
    res.json(
      GetStripeTestStatusResponse.parse({
        ready: true,
        testMode: true,
        message: quote.currency === "kwd"
          ? "الدفع التجريبي جاهز بالدينار الكويتي."
          : "الدفع التجريبي جاهز؛ المبلغ المعروض في كاشف يبقى بالدينار الكويتي.",
        publishableKey,
        checkoutCurrency: quote.currency,
        exchangeRateUpdatedAt: quote.updated
          ? new Date(quote.updated * 1000).toISOString()
          : null,
        exchangeRateSource: quote.updated ? quote.source : null,
      }),
    );
  } catch {
    req.log.warn("Stripe test payment configuration is unavailable");
    res.json(
      GetStripeTestStatusResponse.parse({
        ready: false,
        testMode: true,
        message: unavailable,
        publishableKey: null,
        checkoutCurrency: null,
        exchangeRateUpdatedAt: null,
        exchangeRateSource: null,
      }),
    );
  }
});

router.post("/stripe/payment-intent", async (req, res): Promise<void> => {
  const input = CreateTestPaymentIntentBody.strict().safeParse(req.body);
  if (!input.success || !validateCart(input.data.planIds)) {
    res.status(400).json({ error: "اختر باقات مختلفة من القائمة فقط." });
    return;
  }
  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "ابدأ الدفع من سلة كاشف." });
    return;
  }

  try {
    const signingSecret = sessionSecret();
    const stripe = createTestStripeClient();
    const quote = await getDemoQuote();
    const planIds = [...input.data.planIds].sort();
    const amount = calculatePaymentAmount(planIds, quote);
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amount.stripeAmount,
        currency: quote.currency,
        allowed_payment_method_types: ["card"],
        description: "Kashef monthly plans — test payment",
        metadata: {
          kashef_test_payment: "true",
          kashef_plan_ids: planIds.join(","),
          kashef_kwd_fils: String(amount.amountKwdFils),
          kashef_fx_rate: quote.rate,
          kashef_fx_updated: String(quote.updated),
          kashef_fx_source: quote.source,
          kashef_checkout_currency: quote.currency,
          kashef_request_id: input.data.requestId,
        },
      },
      {
        idempotencyKey: `kashef-demo-${input.data.requestId}-${planIds.join("-")}-${quote.updated}`,
      },
    );
    if (
      paymentIntent.livemode ||
      !paymentIntent.client_secret ||
      paymentIntent.currency !== quote.currency ||
      paymentIntent.amount !== amount.stripeAmount
    ) {
      throw new Error("PAYMENT_INTENT_TEST_VALIDATION_FAILED");
    }

    res.cookie(
      "kashef_payment_intent_proof",
      signPaymentIntent(paymentIntent.id, signingSecret),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/stripe",
        maxAge: 86_400_000,
      },
    );
    res.status(201).json(
      CreateTestPaymentIntentResponse.parse({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountKwdFils: amount.amountKwdFils,
        checkoutCurrency: quote.currency,
        exchangeRateUpdatedAt: quote.updated
          ? new Date(quote.updated * 1000).toISOString()
          : null,
        testMode: true,
      }),
    );
  } catch {
    req.log.warn("Stripe test PaymentIntent creation failed");
    res.status(503).json({ error: unavailable });
  }
});

router.post("/stripe/payment-verification", async (req, res): Promise<void> => {
  const input = VerifyTestPaymentBody.strict().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "تعذّر قراءة نتيجة تجربة الدفع." });
    return;
  }
  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "تحقق من نتيجة الدفع من صفحة كاشف." });
    return;
  }

  try {
    const signingSecret = sessionSecret();
    if (
      !ownsPaymentIntent(
        input.data.paymentIntentId,
        req.cookies?.kashef_payment_intent_proof,
        signingSecret,
      )
    ) {
      res.status(403).json({ error: "جلسة الدفع لا تخص هذا المتصفح." });
      return;
    }

    const stripe = createTestStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(input.data.paymentIntentId);
    const ids = paymentIntent.metadata.kashef_plan_ids?.split(",") ?? [];
    if (
      paymentIntent.livemode ||
      paymentIntent.metadata.kashef_test_payment !== "true" ||
      !validateCart(ids)
    ) {
      res.status(403).json({ error: "تعذّر التحقق من دفعة الاختبار هذه." });
      return;
    }

    const quote = quoteFromPaymentMetadata(paymentIntent.metadata);
    const amount = calculatePaymentAmount(ids, quote);
    if (
      paymentIntent.currency !== quote.currency ||
      paymentIntent.amount !== amount.stripeAmount ||
      paymentIntent.metadata.kashef_kwd_fils !== String(amount.amountKwdFils)
    ) {
      res.status(403).json({ error: "مبلغ تجربة الدفع لا يطابق الباقات المختارة." });
      return;
    }

    const paid = paymentIntent.status === "succeeded";
    const failed = paymentIntent.status === "canceled";
    if (paid || failed) res.clearCookie("kashef_payment_intent_proof", { path: "/api/stripe" });
    res.json(
      VerifyTestPaymentResponse.parse({
        status: paid ? "paid" : failed ? "failed" : "pending",
        testMode: true,
        planIds: paid ? ids : [],
        message: paid
          ? "تم تأكيد الدفع التجريبي. لم يُخصم مبلغ حقيقي ولم يُفعّل اشتراك مدفوع."
          : failed
            ? "أُلغيت تجربة الدفع. لم يُخصم أي مبلغ."
            : "الدفع التجريبي لم يكتمل بعد؛ يمكنك المحاولة مجددًا.",
      }),
    );
  } catch {
    req.log.warn("Stripe test PaymentIntent verification failed");
    res.status(503).json({ error: unavailable });
  }
});

export default router;
