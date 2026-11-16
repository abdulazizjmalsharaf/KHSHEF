import { createHmac, timingSafeEqual } from "node:crypto";
import { validPlanId } from "@workspace/stripe-test";

export function validateCart(ids: string[]): boolean {
  return ids.length >= 1 && ids.length <= 3 && new Set(ids).size === ids.length && ids.every(validPlanId);
}
export function signCheckout(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kashef-test:${sessionId}`).digest("hex");
}
export function ownsCheckout(sessionId: string, signature: unknown, secret: string) {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(signCheckout(sessionId, secret)));
}
export function isTestCheckoutUrl(raw: string | null): raw is string {
  if (!raw) return false;
  try { const url = new URL(raw); return url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password; }
  catch { return false; }
}
