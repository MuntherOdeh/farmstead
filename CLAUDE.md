# Farmstead — CLAUDE.md

Private farm-operations dashboard: Excel import with schema inference, product CRUD, auto-generated dashboards, analytics. Full spec: `docs/SPEC.md` (source of truth). Progress: `docs/PROGRESS.md`. Deviations: `docs/DECISIONS.md`.

## Project constants (§0)

- APP_NAME / FARM_NAME: **Farmstead**
- DEFAULT_CURRENCY: **USD** · DEFAULT_LOCALE: **en-GB**
- ADMIN_USERNAME: `admin` (password only ever via `ADMIN_PASSWORD` env var)
- Vercel scope & GitHub repo: to be provided by owner at Milestone 9

## Locked stack (§3 — verify versions before pinning; log substitutions in DECISIONS.md)

- **Next.js 16** App Router, TypeScript strict, Turbopack, Node runtime for DB code (never Edge)
- **Tailwind CSS v4** (CSS-first config) + **shadcn/ui** + **next-themes** (CSS custom properties, `data-theme` on `<html>`)
- **Neon Postgres** (`@neondatabase/serverless` HTTP driver) + **Drizzle ORM** / `drizzle-kit`, migrations in git
- **Better Auth** (email/password + admin plugin) — NOT Auth.js/NextAuth
- **TanStack Table v8** · **Recharts** via shadcn `chart` · **SheetJS** from cdn.sheetjs.com tarball (npm registry copy is stale — see SPEC §3.1)
- **React Hook Form + Zod** (schemas shared client/server) · **date-fns** · **decimal.js** for money · **lucide-react** · **framer-motion** (sparingly)
- **Vitest** (inference engine) · **Playwright** (login→import→dashboard happy path)

## npm scripts (all implemented)

- `dev` / `build` / `start` — `build` runs `check-contrast` first and fails on any WCAG violation
- `typecheck` — `tsc --noEmit` · `lint` — ESLint
- `test` — Vitest (import inference, widgets, analytics) · `test:e2e` — Playwright via system Edge (`npm run build` first)
- `db:generate` / `db:migrate` / `db:seed` / `db:studio` — drizzle-kit + seed
- `gen:sample-xlsx` — writes clean + messy sample workbooks to `public/samples/`
- `check-contrast` — walks all theme token pairs, fails build below WCAG AA

After every milestone: `npm run typecheck && npm run lint && npm run build` → click through the app → commit → tick `docs/PROGRESS.md`.

## Gotchas

- **PGlite is single-writer**: stop the dev/prod server before `db:seed`, `db:migrate`, or any script touching `.pglite/`.
- Local dev DB is PGlite (no `DATABASE_URL`); production is Neon via `DATABASE_URL`. `getDb()` in `src/db/index.ts` picks.
- In auth helpers, `headers()` must be awaited **before** `getAuth()` so `next build` bails to dynamic rendering without touching the DB.
- Viewer role is Better Auth's `"user"` (displayed "Viewer"); mutations require `requireAdmin()`.
- Admin login: username `admin`, password in `.env.local` `ADMIN_PASSWORD` (never committed).

## Working rules (§13)

- TypeScript strict. No `any`, no `@ts-ignore`, no `as unknown as`.
- No secrets in code or git. `.env*` gitignored from commit one.
- Server-side validation on everything; client validation is UX only.
- Money is `Decimal` / `numeric(14,4)`. Never floats, never `parseFloat` on a price.
- Auth: `requireUser()` is the first line of every server component, server action, and route handler that touches data. Middleware is a UX redirect only (CVE-2025-29927 class).
- Don't invent APIs — read the library's types/docs first.
- No stubs or TODOs in a milestone marked done. Real error handling, no empty catches.
- Conventional commits, one logical change each.
- Actually run it before marking done — "the build passed" is not testing.
- Push back on the spec when it's wrong; log deviations in `docs/DECISIONS.md`.

## Milestones (§12)

0. Foundation — repo, docs, `.env.example`, npm scripts
1. Shell & design system — Next 16 + Tailwind 4 + shadcn, all 7 themes + contrast script, sidebar/topbar/⌘K/theme picker, fake data, screenshot-able
2. Database — Neon + Drizzle full schema, migrations, seed, studio
3. Auth — Better Auth, login page, `requireUser()`, rate limiting, admin seed, change-password, viewer role
4. Products CRUD — §8 incl. custom categories/units/attributes
5. Import engine — §5 parse→infer→review→quality→chunked commit→history→rollback→profiles, unit-tested
6. Auto dashboard — widget generator, charts, layout persistence, drill-down, data explorer
7. Analytics — §9 reconciliation, margins, yields, deltas, pivot builder, exports
8. Polish — states, a11y, mobile, RTL check, Lighthouse ≥90, Playwright
9. Ship — Vercel prod deploy, verify live, README
