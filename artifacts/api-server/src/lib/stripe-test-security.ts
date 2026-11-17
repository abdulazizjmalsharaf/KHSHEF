import { createHmac, timingSafeEqual } from "node:crypto";
import { validatePaymentCart } from "./stripe-payment";

export { validatePaymentCart as validateCart };

export function signPaymentIntent(paymentIntentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kashef-payment:${paymentIntentId}`).digest("hex");
}

export function ownsPaymentIntent(paymentIntentId: string, signature: unknown, secret: string): boolean {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(signPaymentIntent(paymentIntentId, secret)),
  );
}
