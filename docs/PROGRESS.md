# Progress

Milestone checklist — tick items as they are finished and verified (typecheck + lint + build green, app clicked through, committed).

- [x] **0 — Foundation.** Repo, `docs/SPEC.md`, `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `.env.example`, `.gitignore`, npm scripts (scripts land with the scaffold in M1).
- [x] **1 — Shell & design system.** Next 16.2.10 + TS strict + Tailwind 4 + shadcn (radix, RTL init). All 12 theme variants (6 palettes × light/dark) pass `check-contrast` at strict thresholds (text 4.5:1, UI 3:1, CVD ΔE ≥ 0.08, normal-vision ≥ 0.15), gate wired into `npm run build`. Shell: icon-collapsible sidebar, topbar with breadcrumbs, Ctrl+K palette, `g`-chord nav, `/` and `?` shortcuts, theme picker, density toggle. Overview wired to fake data (KPIs, revenue/costs area chart, category donut, top products, transactions, alerts). Verified in headless Edge across 4 themes + mobile viewport, zero console errors.
- [x] **2 — Database.** Full §6 Drizzle schema (money `numeric(14,4)`, soft deletes, idempotency index on import_rows), migrations in git, driver-agnostic client (Neon HTTP when `DATABASE_URL` set, embedded PGlite fallback for local dev). Seed: 44 products, 30 parties, 1,422 transactions across 18 months with seasonal shape (Eid spikes, spring lambing, honey harvest, winter milk dip) and 5 deliberate anomalies; herd ledger guarantees §9 reconciliation balances (verified by `scripts/verify-seed.ts`). `db:generate/migrate/seed/studio` scripts all work.
- [ ] **3 — Auth.** Better Auth, login page, `requireUser()` everywhere, middleware redirect, rate limiting, admin seeded from env, change-password, viewer role.
- [ ] **4 — Products CRUD.** The whole of §8, including custom categories / units / attributes.
- [ ] **5 — Import engine.** §5 end to end: parse → infer → review → quality → chunked commit → history → rollback → profiles. With unit tests.
- [ ] **6 — Auto dashboard.** Widget generator, chart library, layout persistence, drill-down to rows, data explorer.
- [ ] **7 — Analytics.** §9 — reconciliation, margins, yields, deltas, pivot builder, exports.
- [ ] **8 — Polish.** Every empty/loading/error state. A11y pass. Mobile pass. RTL check. Lighthouse ≥90. Playwright happy path.
- [ ] **9 — Ship.** Env vars, migrate, seed, `vercel --prod`, verify live, README.
