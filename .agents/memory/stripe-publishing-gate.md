---
name: Stripe test checkout and publishing restriction
description: Direct test-key checkout is independent of the Replit Stripe connector and its publishing warning.
---

The embedded demo checkout uses only `TEST_STRIPE_PUBLISHABLE_KEY` and `TEST_STRIPE_SECRET_KEY`, and must reject live keys and live PaymentIntents. This direct-key integration is separate from the Replit Stripe connector. Replacing connector code does not detach the project connector or clear its publishing warning.

**Why:** The user explicitly requested an embedded test-only Payment Element instead of the sandbox integration. The publishing warning remains attached to project integration settings, independently of whether app code uses that connector.

**How to apply:** Keep all direct payment requests in test mode; never expose secret values or switch to live keys to clear the warning. If the user wants the unused Replit connector removed, guide them to Integrations → Stripe → Manage → Edit → Delete. This detaches the project connector, not the Stripe account.
