# Farmstead

A private operations dashboard for a working farm — sheep, cows, goats, bees,
and everything they produce. Three things it does exceptionally well:

1. **Eats any Excel file.** Upload a sales spreadsheet with any column layout —
   Farmstead detects the header row (even under a merged title), infers what
   each column means (English and Arabic headers, fuzzy-matched), shows its
   reasoning with confidence scores, flags ambiguous dates / mixed units /
   rows where qty × price ≠ total, lets you correct everything, and only then
   commits — with one-click rollback and reusable mapping profiles.
2. **Manages the catalogue properly.** Full products CRUD with preset *and*
   user-defined categories, units and custom fields, stock adjustments with
   reasons, bulk price changes, undo, Excel export, and an audit trail.
3. **Looks like a product.** Six palettes × light/dark (all WCAG AA, enforced
   by a build-failing contrast script), theme-aware charts that survive
   deuteranopia, ⌘K command palette, RTL support, and a phone-friendly layout.

Everything sits behind a username/password login. There is no sign-up.

## Stack

Next.js 16 (App Router, TS strict, Turbopack) · Tailwind v4 · shadcn/ui ·
Neon Postgres + Drizzle ORM (PGlite fallback for local dev) · Better Auth ·
TanStack Table · Recharts · SheetJS · React Hook Form + Zod · decimal.js ·
Vitest + Playwright.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill it in:
#   BETTER_AUTH_SECRET  → openssl rand -base64 32
#   ADMIN_USERNAME      → e.g. admin
#   ADMIN_PASSWORD      → your password (10+ chars)
#   DATABASE_URL        → leave EMPTY to use the embedded local database

npm run db:migrate           # applies migrations (creates .pglite/ locally)
npm run db:seed              # 18 months of demo data (~1,400 transactions)
npm run dev                  # http://localhost:3000
```

Log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. The admin account is created
on first run; change the password afterwards in **Settings → Account** (that
is also the answer to "how do I change the admin password" — the env var only
seeds the very first account).

> **PGlite is single-writer:** stop the dev server before running
> `db:seed` / `db:migrate`, or they'll fight over the data directory.

Sample spreadsheets to test the importer live in `public/samples/`
(`farmstead-sample-clean.xlsx` and the deliberately nasty
`farmstead-sample-messy.xlsx`). Regenerate them with `npm run gen:sample-xlsx`.

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | the usual (build runs the contrast gate first) |
| `typecheck` / `lint` | TS strict + ESLint |
| `test` | Vitest — import inference, widget engine, analytics maths |
| `test:e2e` | Playwright happy path (uses your installed Edge; `npm run build` first) |
| `db:generate` / `db:migrate` / `db:seed` / `db:studio` | Drizzle workflow |
| `gen:sample-xlsx` | writes the clean + messy sample workbooks |
| `check-contrast` | WCAG AA + colour-blindness gate over every theme |

## Deploying to Vercel (Hobby)

```bash
npm i -g vercel
vercel login
vercel link

# Database: Vercel dashboard → Storage → Marketplace → Neon → create.
# That injects DATABASE_URL into the project automatically.
vercel env pull .env.local

vercel env add BETTER_AUTH_SECRET production   # openssl rand -base64 32
vercel env add BETTER_AUTH_URL production      # https://<project>.vercel.app
vercel env add ADMIN_USERNAME production
vercel env add ADMIN_PASSWORD production

npm run db:migrate    # with the Neon DATABASE_URL in .env.local
npm run db:seed       # optional: demo data
vercel --prod
```

Then actually use the deployed app: log in, upload
`public/samples/farmstead-sample-messy.xlsx`, and check a chart renders.

**Live URL:** _not deployed yet — add it here after the first `vercel --prod`._

### The Hobby-plan note (read this)

Vercel's Hobby tier is, per their fair-use policy, **for personal,
non-commercial use**. Showing this dashboard as a demo is fine. If it becomes
the farm's real day-to-day operational system, move to Vercel Pro. Related
design constraints already baked in: spreadsheets are parsed **in the
browser** (4.5 MB request-body cap) and uploaded as idempotent JSON chunks,
handlers stay short, and nothing writes to local disk in production.

Also expect the first login after a quiet day to be slow — Neon's free tier
scales to zero and cold-starts.

## Repo map

- `docs/SPEC.md` — the full build specification (source of truth)
- `docs/PROGRESS.md` — milestone checklist with what was verified
- `docs/DECISIONS.md` — every deviation from the spec, dated, with reasoning
- `src/lib/import/` — the import engine (parse → infer → normalize → quality)
- `src/lib/dashboard/widgets.ts` — the auto-dashboard rules engine
- `src/lib/analytics/calc.ts` — §9 farm maths (Decimal everywhere)
- `scripts/check-contrast.ts` — the theme gate that fails the build
