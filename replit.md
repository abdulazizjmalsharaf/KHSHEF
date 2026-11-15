# كاشف

كاشف يساعد أصحاب المشاريع الصغيرة على مراجعة فواتير الموردين بمطابقتها مع طلب الشراء والكميات المستلمة وإظهار الفروقات.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/kashef run dev` — homepage frontend (managed workflow)
- The current homepage requires no database or secrets.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Data/backend target requested by the user: Supabase, to be connected in a later approved step. Do not substitute the scaffold's PostgreSQL database.
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

The first approved step is only an Arabic RTL homepage and a supplier-name form that explicitly does not save yet. No backend, authentication, invoice extraction, or persistence in this step.

## User preferences

- Work in small, runnable steps with simple explanations.
- MVP scope only: suppliers; purchase order quantities/prices; actual received quantities; invoice upload; automatic invoice extraction; three-way matching; discrepancy display.
- Future supplier comparisons, analytics, inventory/accounting integrations and forecasting are out of scope.
- Requested toolchain: Replit for work, GitHub for code, Vercel for publishing, Supabase for data/backend. Do not push or publish as part of the homepage-only step.
- Supabase URL and anon key belong in Replit Secrets and Vercel environment variables, not source code.
- Payments are not part of the MVP; if requested later, Stripe must use test mode.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
