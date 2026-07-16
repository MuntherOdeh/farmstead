# Progress

Milestone checklist — tick items as they are finished and verified (typecheck + lint + build green, app clicked through, committed).

- [x] **0 — Foundation.** Repo, `docs/SPEC.md`, `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `.env.example`, `.gitignore`, npm scripts (scripts land with the scaffold in M1).
- [ ] **1 — Shell & design system.** Next 16 + TS strict + Tailwind 4 + shadcn. All 7 themes with the contrast script passing. App shell: sidebar, topbar, breadcrumbs, ⌘K palette, theme picker, density toggle. Wired to fake data. Screenshot-able.
- [ ] **2 — Database.** Neon + Drizzle, full schema, migrations, seed script. `npm run db:studio` works.
- [ ] **3 — Auth.** Better Auth, login page, `requireUser()` everywhere, middleware redirect, rate limiting, admin seeded from env, change-password, viewer role.
- [ ] **4 — Products CRUD.** The whole of §8, including custom categories / units / attributes.
- [ ] **5 — Import engine.** §5 end to end: parse → infer → review → quality → chunked commit → history → rollback → profiles. With unit tests.
- [ ] **6 — Auto dashboard.** Widget generator, chart library, layout persistence, drill-down to rows, data explorer.
- [ ] **7 — Analytics.** §9 — reconciliation, margins, yields, deltas, pivot builder, exports.
- [ ] **8 — Polish.** Every empty/loading/error state. A11y pass. Mobile pass. RTL check. Lighthouse ≥90. Playwright happy path.
- [ ] **9 — Ship.** Env vars, migrate, seed, `vercel --prod`, verify live, README.
