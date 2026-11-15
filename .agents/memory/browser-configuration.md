---
name: Browser configuration refresh
description: Safely distinguish invalid configuration from stale Vite environment snapshots.
---

After edits to browser configuration secrets, restart the managed Vite workflow before concluding the browser has the new values. A secure-form confirmation alone does not prove the values have valid formats or are accepted by the provider.

**Why:** During Supabase setup, the running frontend retained an earlier configuration while fresh shell checks saw updated values.

**How to apply:** Validate formats and provider responses using only booleans/status codes in logs. Compare whether browser and process configuration match without printing either value. Never include configuration values in thrown errors, including URL constructor errors.
