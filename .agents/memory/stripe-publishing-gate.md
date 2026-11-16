---
name: Stripe sandbox publishing restriction
description: A connected Stripe sandbox can block republishing even when payment code is disabled.
---

Replit's official Stripe guidance says the sandbox is for development testing. Publishing or republishing requires connecting a live Stripe account in the Publishing pane; sandbox credentials alone cannot satisfy that requirement. Disabling payment routes and startup code does not change the integration attached to the project.

**Why:** The publishing restriction is attached to the integration configuration, independently of whether the app calls Stripe. A screenshot confirmed the warning while the existing published site and health endpoint both responded successfully. Official guidance also says live Stripe is required for publishing.

**How to apply:** When a project must remain demo-only, do not enable live payments just to clear the publishing warning. Explain that the platform requires a live account and leave the connection unchanged unless the user explicitly chooses another course. For a future task where removal is explicitly authorized, the documented project-integration removal path is Integrations → Stripe → Manage → Edit → Delete; this does not delete the user's Stripe account.
