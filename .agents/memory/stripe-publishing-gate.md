---
name: Stripe sandbox publishing restriction
description: A connected Stripe sandbox can block republishing even when payment code is disabled.
---

Disabling payment routes and startup code does not detach the project's Stripe sandbox connection. The publishing interface may still disable Republish with “This app uses a Stripe sandbox connection. Complete the setup in the Publishing pane before publishing.”

**Why:** The publishing restriction is attached to the integration configuration, independently of whether the app calls Stripe. A screenshot confirmed this while the existing published site and health endpoint both responded successfully.

**How to apply:** When publishing is blocked after payments have been deferred, inspect the Integrations configuration rather than repeatedly changing application code or requesting payment secrets. The documented removal path is Integrations → Stripe → Manage → Edit → Delete. Remove the project integration only, not the user's Stripe account. Do not enable live payments as a workaround.
