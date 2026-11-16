import express, { Router } from "express";
import { WebhookHandlers } from "../webhookHandlers";

const router = Router();
router.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res): Promise<void> => {
  const signature = req.get("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) { res.status(400).json({ error: "Invalid webhook" }); return; }
  try {
    // Reject live payloads before processing. Signature verification still occurs in sync.
    if (JSON.parse(req.body.toString("utf8")).livemode !== false) throw new Error("LIVE_WEBHOOK_REFUSED");
    await WebhookHandlers.processWebhook(req.body, signature);
    res.json({ received: true });
  } catch { res.status(400).json({ error: "Webhook verification failed" }); }
});
export default router;
