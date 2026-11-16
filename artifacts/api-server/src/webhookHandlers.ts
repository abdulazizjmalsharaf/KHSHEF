import { getStripeSync } from "./stripeClient";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) throw new Error("RAW_WEBHOOK_REQUIRED");
    const sync = await getStripeSync();
    try { await sync.processWebhook(payload, signature); }
    finally { await sync.postgresClient.pool.end(); }
  }
}
