---
name: Stripe demo currency compatibility
description: Check the connected Stripe account's supported currencies before creating a demo catalog.
---

Check the connected account's `country_specs.supported_payment_currencies` before creating catalog prices. The connected sandbox rejected KWD and its country specification confirmed KWD was unsupported, while USD and EUR were supported.

**Why:** Demo mode does not bypass currency restrictions. Displaying local prices does not mean the Stripe account can accept that currency.

**How to apply:** Keep the approved website currency unchanged. If a demo needs another currency, obtain explicit approval and label the demo currency and amounts separately; never silently reinterpret KWD fils as another currency's minor units. Recheck capabilities if the Stripe account changes.
