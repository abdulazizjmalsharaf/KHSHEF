---
name: Arabic key normalization
description: Match Arabic supplier and item names consistently in SQL across database locales.
---

**Rule:** Do not rely on locale-sensitive alphanumeric regex classes to normalize Arabic names in PostgreSQL. Normalize Unicode consistently, then collapse whitespace and punctuation without requiring the database locale to classify Arabic letters.

**Why:** A local PostgreSQL instance initialized with the `C` locale treated Arabic letters as non-alphanumeric, which broke supplier-price linking and backfill.

**How to apply:** Test representative Arabic labels under a `C` locale before shipping SQL text-key logic. Keep SQL and JavaScript normalization aligned, including whether common Arabic diacritics are removed.
