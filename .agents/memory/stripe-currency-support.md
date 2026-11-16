---
name: Stripe demo currency compatibility
description: Check the connected Stripe account's supported currencies before creating a demo catalog.
---

Check the connected account's `country_specs.supported_payment_currencies` before creating catalog prices. The connected sandbox rejected KWD and its country specification confirmed KWD was unsupported, while USD and EUR were supported. The user approved fresh KWD-to-USD conversion for demo checkout: retain KWD display on the site and clearly disclose USD on Stripe's hosted page. Disable Adaptive Pricing to prevent a third, location-selected display currency.

**Why:** Demo mode does not bypass currency restrictions. The user's approval permits accurate conversion for this demo, but hosted Checkout must show its actual USD currency and must not imply the conversion rate is guaranteed by a bank.

**How to apply:** Keep the approved website currency unchanged. If a future project or live payment needs another currency, get approval first, fetch and validate a current exchange rate, round once in the target currency's minor units, and disclose the hosted checkout currency. Recheck capabilities if the Stripe account changes; never silently reinterpret KWD fils as another currency's minor units.
