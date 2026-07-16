# Build Prompt — Farm Operations Dashboard

> **How to use:** fill in §0, then paste this whole file into Claude Code in an empty folder opened in VS Code. Or save it as `docs/SPEC.md` in the folder and tell Claude Code: *"Read docs/SPEC.md and build it, starting at Step 0."*

---

## 0. FILL THESE IN BEFORE YOU PASTE

```
APP_NAME:          Farmstead
FARM_NAME:         Farmstead
ADMIN_USERNAME:    admin
ADMIN_PASSWORD:    (set via ADMIN_PASSWORD env var — never written in this repo)
DEFAULT_CURRENCY:  USD
DEFAULT_LOCALE:    en-GB
VERCEL_SCOPE:      (to be provided at Milestone 9 — deploy)
GITHUB_REPO:       (to be provided at Milestone 9 — personal repo, NOT an org repo — see §11)
```

---

## 1. START HERE (do this before writing any code)

You are building a complete, production-quality web app from an empty folder. You have full permission to create files, install packages, run migrations, commit, and deploy. Read this entire document before touching anything.

**Step 0:**
1. `git init`, create the project.
2. Save this entire document verbatim to `docs/SPEC.md`.
3. Write `CLAUDE.md` at the repo root containing: the locked stack (§3), the working rules (§13), the npm scripts, and the milestone list (§12). This is your durable memory — keep it accurate as the project evolves.
4. Create `docs/PROGRESS.md` with the milestone checklist. Tick items off as you finish them.
5. Create `docs/DECISIONS.md`. Every time you deviate from this spec or make a non-obvious call, add a dated one-paragraph entry with the reasoning.
6. Then start Milestone 1.

**Verify versions before you pin them.** This spec was written against what was current at the time; libraries move. Before installing anything, run `npm view <pkg> version` and skim the official docs for anything that looks changed. Prefer the current stable release. **If reality contradicts this spec, follow reality** and log it in `docs/DECISIONS.md`.

**Work milestone by milestone.** Do not attempt to one-shot the whole app. After each milestone: run `npm run typecheck && npm run lint && npm run build`, actually open the app and click through it, commit, update `docs/PROGRESS.md`.

**Ask me only when genuinely blocked** on something only I can decide (credentials, an irreversible choice, a real ambiguity in this spec). Otherwise decide, log it, keep moving.

---

## 2. WHAT WE ARE BUILDING

A private web dashboard for a farm that breeds, buys, and sells **sheep, cows, goats, bees**, and produces **milk, dairy, honey, wool, eggs and other farm products**.

Three things it must do exceptionally well:

1. **Eat any Excel file.** The owner uploads a sales spreadsheet. The app reads it, figures out what the columns actually mean, shows its reasoning, lets the owner correct it, and then turns the file into a real dashboard — charts, tables, KPIs — with no hardcoded assumptions about column names or layout. A different file next month with different columns must work just as well.
2. **Manage products properly.** Full CRUD over a product catalogue with preset categories *and* user-defined categories, units, and custom fields. Calculations, stock, margins, bulk operations, history.
3. **Look genuinely good.** Light, dark, and several named themes. This is going to be shown to people. It should look like a product, not a template.

The whole app is behind a username/password login. There is no public sign-up. It gets deployed to Vercel's free tier on a `*.vercel.app` URL — no custom domain.

---

## 3. STACK (locked — check versions, don't substitute libraries without logging why)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16, App Router, TypeScript strict** | Turbopack is the default bundler in 16; Node 20+ required |
| Runtime | Node.js (not Edge) for anything touching the DB | |
| Styling | **Tailwind CSS v4** | CSS-first config |
| Components | **shadcn/ui** | Own the code, don't fight a component library |
| Theming | **next-themes** + CSS custom properties | §10 |
| Database | **Neon Postgres** via Vercel Marketplace | Vercel Postgres no longer exists; Neon is the successor and has a free tier |
| DB driver | `@neondatabase/serverless` | HTTP driver, serverless-friendly |
| ORM | **Drizzle ORM** + `drizzle-kit` | Migrations checked into git |
| Auth | **Better Auth** (email/password + admin plugin) | Auth.js/NextAuth is now in maintenance mode under the Better Auth team; use Better Auth for a new project |
| Tables | **TanStack Table v8** | |
| Charts | **Recharts** via shadcn/ui `chart` | |
| Excel | **SheetJS** — see §3.1 | |
| Forms | **React Hook Form** + **Zod** | Zod schemas shared client/server |
| Dates | **date-fns** | |
| Money | **decimal.js** or `Decimal` via Drizzle `numeric` | Never floats — §9 |
| Icons | **lucide-react** | |
| Motion | **framer-motion**, sparingly | |
| Tests | **Vitest** for the inference engine; **Playwright** for one login→import→dashboard happy path | |

**Reference:** the official `neondatabase/vercel-marketplace-neon` template on GitHub is almost exactly this stack (Next.js + Neon + Drizzle + shadcn/ui + next-themes + Better Auth) and ships a Neon MCP server and agent skill preconfigured for Claude Code. Look at it before scaffolding; borrow its wiring, don't inherit its scope.

### 3.1 SheetJS install gotcha

The `xlsx` package on the public npm registry is **abandoned at 0.18.5** — SheetJS moved distribution to their own CDN and the registry copy is years stale. Install from the authoritative source:

```bash
npm install --save https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz
```

Confirm the current version at `https://cdn.sheetjs.com/` first and pin an explicit version rather than `latest` so builds are reproducible. If the tarball install causes friction on Vercel's build step, fall back to `exceljs` and log the swap in `DECISIONS.md`.

---

## 4. AUTH & PRIVACY

- Single admin account seeded from env (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) on first run. Password hashed (scrypt/argon2/bcrypt) — plaintext never touches the DB, git, or a log line.
- Better Auth email/password. A real, designed login page — not a browser Basic Auth dialog.
- **Optional but build it:** a second role, `viewer` (read-only), and an invite flow in settings, so the owner can show the dashboard to someone without giving them edit rights. No public sign-up route, ever.
- Change-password flow in `/settings`.

### 4.1 The security rule that matters most

**Do not rely on middleware alone to protect routes.** Next.js middleware auth has a known bypass class (CVE-2025-29927 and follow-ups — a spoofed internal header can skip it). Treat middleware as a **UX redirect only**.

Write this helper and make it the literal first line of every server component, server action, and route handler that touches data:

```ts
// src/lib/auth/require-user.ts
export async function requireUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new UnauthorizedError()
  return session.user
}
```

No exceptions. A route that forgets this is a bug, not a style issue.

### 4.2 Also

- Rate limit login: 5 attempts / 15 min per IP+username, exponential backoff, generic "invalid credentials" message either way, constant-time compare.
- Session cookie: `httpOnly`, `secure`, `sameSite=lax`, rolling expiry, 7-day max.
- `X-Robots-Tag: noindex, nofollow` on every response + `robots.txt` with `Disallow: /`. This app should never be indexed.
- Security headers + a CSP in `next.config.ts`.
- `.env*` in `.gitignore` from commit one. Ship `.env.example` with empty values and comments.
- Run `npm audit` before every deploy. Confirm the installed Next.js version is past the React2Shell fixes (CVE-2025-55182 / CVE-2025-66478) — do not pin an old minor.

---

## 5. THE IMPORT ENGINE (the heart of this app — spend your time here)

The pipeline: **upload → parse → infer → review → validate → commit → dashboard**. Nothing is hardcoded to any particular spreadsheet.

### 5.1 Parse (client-side, deliberately)

Vercel caps request bodies at **4.5 MB**. So parse the workbook **in the browser** with SheetJS, then POST normalized JSON to the server in chunks of ~2,000 rows. Each chunk carries `{ importId, chunkIndex }` and is idempotent — re-sending a chunk must not duplicate rows.

Handle real-world mess:
- multiple sheets → let the user pick, or import several
- a merged title/logo row above the real header → detect the header row, don't assume row 1
- trailing blank rows and blank columns → drop
- merged cells → forward-fill
- formulas → take the cached value
- Excel serial dates → convert, respecting the workbook's 1900/1904 epoch flag
- `.xlsx`, `.xls`, `.csv`, `.ods`
- >50k rows → Web Worker so the UI never freezes; show a progress bar

### 5.2 Infer (per column)

Sample up to 500 non-empty cells per column. Score every candidate type, take the winner, keep the confidence score.

**Physical type:** `empty` · `boolean` · `integer` · `decimal` · `currency` · `percent` · `date` · `duration` · `category` (distinct/total ≤ 0.3 and distinct ≤ 50) · `text` · `id` (near-unique)

Use the cell's **Excel number format** as evidence, not just the value — a currency format or a percent format is a much stronger signal than a regex on the string.

**Never guess ambiguous dates silently.** If `03/04/2026` parses as both D/M and M/D, flag the column as ambiguous, default to the workbook/user locale, and surface it in the review step for confirmation.

**Semantic role** (one per column): `period` · `entity_type` · `entity_name` · `quantity` · `unit` · `unit_price` · `total_amount` · `cost` · `party` · `location` · `transaction_type` · `weight` · `breed` · `sex` · `age` · `tag_id` · `notes` · fallback `dimension` (categorical) / `measure` (numeric).

Role detection = **header synonym match + value-pattern evidence**. Normalize headers before matching: lowercase, strip diacritics, collapse spaces/underscores/punctuation, then fuzzy match (Levenshtein ≤ 2).

Put the synonym dictionary in `src/lib/import/synonyms.json` — one entry per role, arrays of aliases, so new languages and new aliases are a data change not a code change. Ship English and Arabic aliases at minimum (`quantity` / `qty` / `عدد` / `الكمية`, `price` / `سعر`, `total` / `الإجمالي`, `cow` / `بقرة`, `sheep` / `خروف` / `أغنام`, `honey` / `عسل`, `milk` / `حليب` / `لبن`, and so on). Cover livestock vocabulary properly: head, ewe, ram, lamb, heifer, calf, kid, doe, buck, hive, nucleus, super, litre, kg.

**Cross-column reasoning** — this is what makes it feel smart:
- If `quantity × unit_price ≈ total_amount` on ≥90% of rows, mark the relationship confirmed and let the user choose which column is authoritative.
- If total exists but unit price doesn't, derive `unit_price = total / quantity`.
- Rows where the arithmetic disagrees by >1% → flag as anomalies (don't drop them).
- Detect the currency from symbols, number formats, or a currency column.
- Detect mixed units inside one column (kg and lb in the same column) and flag it.

Output an `InferredSchema` object. Persist it with the import. **Unit-test this module hard** — it is the one part of the app where a silent wrong answer costs the owner real money.

### 5.3 Review (mandatory — never auto-commit an import)

A review screen after inference, before anything hits the database:

- One row per source column: original header → detected type (editable dropdown) → detected role (editable) → unit (editable) → 3 sample values → confidence badge → "ignore this column" toggle.
- Unit and currency selectors with conversion (kg/lb/ton, L/gal, per-head).
- Live preview of the first 20 **normalized** rows, updating as the user changes the mapping.
- A **data quality panel**: row count, blanks per column, duplicate rows, type coercion failures, arithmetic anomalies, detected date range, detected currencies, outliers (values >3σ). Each number is clickable and jumps to the offending rows.
- **Save as mapping profile.** Key the profile on a stable signature (`sha256` of sorted normalized headers). Next time a file with the same signature arrives, auto-apply the profile and skip straight to preview. This is what makes the second upload take five seconds.

Nothing enters the database until the user clicks Import.

### 5.4 Commit

- Store both the **raw** row and the **normalized** row (`import_rows.raw` / `.normalized`). The raw file's truth must always be recoverable.
- Transactional per chunk. A failed chunk rolls back cleanly.
- Every import gets a batch record with full provenance. **Rollback** must be one click — delete a whole import and everything it created.
- Auto-match imported product names to existing products (fuzzy); show the matches for confirmation; offer "create missing products" in bulk.

### 5.5 Auto-generate the dashboard

From the `InferredSchema`, generate a ranked list of widgets. This is a rules engine, not magic:

| Column shape | Widget |
|---|---|
| `period` + `measure` | Time series — line if continuous, bar if discrete periods. Show MoM and YoY delta. |
| `dimension` (≤8 distinct) + `measure` | Horizontal bar, ranked descending |
| `dimension` (≤6 distinct) + `measure` | Donut with the total in the centre |
| `dimension` (>8 distinct) + `measure` | Ranked bar, top 10 + "Other" |
| `dimension` × `dimension` + `measure` | Stacked bar, or heatmap if both are high-cardinality |
| `measure` + `measure` | Scatter with a trend line |
| single `measure` | KPI card + sparkline + a distribution histogram |
| `period` + `dimension` + `measure` | Small multiples (one mini-chart per category) |
| everything else | It still shows up in the data table |

Rank by `role importance × completeness × cardinality fit`. Show the top 8 by default, the rest under "More charts".

Every widget carries: a title, a one-line subtitle saying **what it actually shows**, the source column names, a hover tooltip, "view underlying rows", and export to PNG/CSV. The user can pin, hide, reorder (drag), and change the chart type per widget. Persist the layout per dataset per user.

Alongside the charts: a full **data explorer** for the file — virtualized TanStack Table, every column, sort/filter/group, column visibility, and a text view for narrow/long data. Charts are the headline; the table is the ground truth. Both, always.

---

## 6. DATA MODEL

Drizzle schema. Money is `numeric(14,4)`, never `real`/`double`. Soft-delete via `deleted_at` where noted.

```
-- Better Auth owns: users, sessions, accounts, verifications

categories        id, name, slug, kind(livestock|dairy|apiary|crop|input|equipment|other),
                  icon, color, is_system, created_by, deleted_at
units             id, code(head|kg|g|ton|L|mL|gal|dozen|hive|bag|bale), label,
                  dimension(mass|volume|count), to_base_factor, is_system
attribute_defs    id, category_id, key, label,
                  type(text|number|date|select|boolean), options jsonb, required, sort_order
products          id, sku, name, category_id, unit_id, species, breed, description,
                  unit_price numeric(14,4), cost_price numeric(14,4), currency char(3),
                  stock_qty numeric(14,4), reorder_level numeric(14,4),
                  attributes jsonb,        -- user-defined fields, validated against attribute_defs
                  tags text[], image_url, notes,
                  is_active, created_at, updated_at, deleted_at
parties           id, name, type(customer|supplier|both), phone, email, address, notes, deleted_at
transactions      id, type(sale|purchase|birth|death|consumption|adjustment|expense),
                  occurred_on date, product_id, party_id, qty numeric(14,4), unit_id,
                  unit_price numeric(14,4), total numeric(14,4), currency char(3),
                  notes, source(manual|import), import_id, created_at, deleted_at
imports           id, filename, sheet_name, signature, row_count, status,
                  mapping jsonb, inferred_schema jsonb, quality jsonb, uploaded_by, created_at
import_rows       id, import_id, row_index, raw jsonb, normalized jsonb, errors jsonb
mapping_profiles  id, signature, name, mapping jsonb, created_by, created_at
dashboards        id, name, dataset_ref, layout jsonb, owner_id
audit_log         id, actor_id, entity, entity_id, action, before jsonb, after jsonb, at
settings          singleton: currency, locale, timezone, default_weight_unit,
                  default_volume_unit, fiscal_year_start, default_theme, direction(ltr|rtl)
```

Index what you actually query: `transactions(occurred_on)`, `transactions(product_id)`, `products(category_id)`, `import_rows(import_id)`, `mapping_profiles(signature)`.

---

## 7. PAGES

| Route | Contents |
|---|---|
| `/login` | The only public route |
| `/` | Overview: KPI row (revenue, margin, head count, stock value, this month vs last), revenue over time, mix by category, top products, recent transactions, alerts (low stock, anomalies, unusual price) |
| `/import` | Upload → map → preview → commit. Import history with status, row counts, rollback, re-run with a different mapping |
| `/data/[importId]` | The auto-generated dashboard + data explorer for that file |
| `/products` | The CRUD table — §8 |
| `/products/[id]` | Detail: attributes, stock history, price history, transactions, per-product charts |
| `/transactions` | The ledger. Filter by type, date, product, category, party. Inline edit. Bulk import/export |
| `/parties` | Customers and suppliers, with their transaction history and totals |
| `/analytics` | Deeper cuts — §9 — plus a pivot builder (drag dimensions to rows/cols, measures to values) |
| `/settings` | Currency, locale, units, direction, categories, attribute definitions, theme, users, change password, demo data controls |

---

## 8. PRODUCTS CRUD — full spec

**The table** (TanStack Table v8): sort, per-column filters, global fuzzy search, column visibility, column pinning + resize, row selection, pagination, density toggle (comfortable/compact), saved views, virtualized above 500 rows.

**Row actions:** edit (slide-over sheet, not a page navigation), duplicate, adjust stock (with a reason), archive, delete (soft, with an **undo toast** — 5 seconds to change your mind).

**Bulk actions:** price change (% or absolute), reassign category, archive, export selection to Excel.

**The add/edit form — this is where "let him write his own option" lives:**
- **Category:** combobox with presets (Sheep, Cows, Goats, Bees, Milk, Dairy, Honey, Wool, Eggs, Poultry, Feed, Crops, Equipment, Other) **plus a "Create new category…" free-text option that persists it** and makes it available everywhere from then on.
- **Unit:** same pattern — presets (head, kg, litre, dozen, hive, bag, bale, ton) plus custom.
- **Custom fields:** the form renders dynamic inputs from `attribute_defs` for the chosen category, plus an **"Add custom field"** control (name, type, options) that persists a new attribute definition. So the owner can add "Ear tag", "Vaccination date", "Milk fat %", "Hive queen year" himself, without me.
- A **live calculation strip** in the form: margin, markup %, stock value, updating as he types.
- Optimistic update, rollback + toast on failure.
- One Zod schema, shared client and server. **The server re-validates regardless** — client validation is UX, not security.

**Import/export products** via Excel/CSV, reusing the §5 mapping engine.

---

## 9. CALCULATIONS

All money in `Decimal`. Round only at display. Never `parseFloat` a price.

- Line total = `qty × unit_price`, rounded per currency
- Revenue, COGS, gross margin, margin %, markup %
- Stock valuation = `Σ stock_qty × weighted_average_cost`
- Revenue and profit grouped by product / category / species / party / month
- Average price per head, per kg, per litre
- **Herd movement reconciliation:** `opening + births + purchases − sales − deaths − consumption = closing`. Show it as a table. **It must balance** — if it doesn't, show the discrepancy loudly rather than hiding it.
- Mortality rate = deaths / average herd size
- Yields: litres per cow per day · kg honey per hive per season · kg wool per head per shearing · eggs per bird per week
- MoM / YoY deltas, 3-month moving average, a simple naive forecast (be honest in the UI that it's naive)
- Top and bottom performers by margin
- Cost per head (feed, vet, labour) if expense rows exist

Unit-test the reconciliation and the margin maths against known fixtures.

---

## 10. DESIGN

The brief is "the most beautiful." That means intentional, not decorated. Restraint, good type, real hierarchy.

### Themes

`light` · `dark` · `system`, **plus five named presets:**

| Preset | Direction |
|---|---|
| **Pasture** | deep greens, warm neutral paper |
| **Honey** | amber/ochre, cream, dark walnut text |
| **Dairy** | cool blue-grey, off-white, high clarity |
| **Midnight** | deep slate, low-glare, for evening use |
| **Terracotta** | clay, sand, olive accent |

Each preset is a set of CSS custom properties in `oklch()`, applied via `data-theme` on `<html>`. `next-themes` handles persistence and the no-flash script. Every preset has a light and a dark variant.

**Non-negotiable:** every theme passes WCAG AA (4.5:1 body text, 3:1 for large text and UI boundaries). Write `scripts/check-contrast.ts` that walks every token pair and **fails the build** if any drops below. A pretty theme nobody can read in sunlight is a broken theme — and this app gets used outdoors.

**Chart colours derive from theme tokens.** Not one hardcoded hex anywhere. Charts recolour when the theme changes. Sequential palette for ordered data, categorical palette for unordered, and it must stay distinguishable in deuteranopia — test it.

### The rest

- **Type:** one UI face, one display face for headings, one mono for numbers/IDs/SKUs. `font-variant-numeric: tabular-nums` on **every** number in a table or KPI — figures that jitter as they update look amateur.
- **Space:** 8px grid, consistent radius scale, at most two elevation levels. Prefer borders and spacing over shadows.
- **Motion:** 150–250ms, ease-out, transform/opacity only. Honour `prefers-reduced-motion: reduce`.
- **States:** skeletons not spinners. Empty states with an illustration and a primary action. Error states with a retry and a real message. Loading states that reserve their final layout (no reflow).
- **⌘K command palette.** `g d` / `g p` / `g i` for nav, `/` focuses search, `?` opens the shortcut sheet.
- **Mobile-first.** This gets opened one-handed in a barn. Tables collapse to cards below `md`. Touch targets ≥44px.
- **RTL-ready.** Logical properties throughout (`ps-*`, `pe-*`, `ms-*`, `me-*` — never `pl-*`/`ml-*`), `dir` on `<html>` driven by settings. Even if we ship LTR first, don't paint into a corner.
- **Accessibility:** keyboard reachable everywhere, visible focus rings, proper labels and aria, charts have a table fallback and an accessible summary.

---

## 11. DEPLOYMENT — Vercel free tier

```bash
npm i -g vercel
vercel login                    # or: export VERCEL_TOKEN=... and pass --token to every command
vercel link --scope <VERCEL_SCOPE>

# Database: Vercel dashboard → Storage → Marketplace → Neon → create.
# It injects DATABASE_URL into the project automatically.
vercel env pull .env.local

vercel env add AUTH_SECRET production        # openssl rand -base64 32
vercel env add ADMIN_USERNAME production
vercel env add ADMIN_PASSWORD production
# repeat for preview + development environments

npm run db:migrate
npm run db:seed
vercel --prod
```

Then **verify the deployed app yourself** — log in, upload the sample file, check a chart renders. Not "the build succeeded." Actually use it.

### Free-tier constraints to design around

- **4.5 MB request body** → hence client-side parsing and chunked upload (§5.1). Do not send the workbook to the server.
- **Function duration is capped and Active CPU is metered** (roughly 4 h/month on Hobby) → handlers stay short. No long loops, no processing 50k rows in one request. Check the current limits at `vercel.com/docs/limits` before you design anything long-running.
- **Hard caps, no overage** — if a limit is hit the project pauses rather than billing. That's a feature here, but it means an accidental loop can take the demo offline.
- **1 concurrent build, ~100 deploys/day.**
- **Hobby projects cannot link to a repo owned by a GitHub organisation** — use a personal repo.
- **Neon free tier:** ~0.5 GB storage per branch, scale-to-zero. Fine for this. Note the cold start after idle — the first login of the day will be slow. Consider a lightweight warm-up.
- **Serverless is stateless.** No SQLite file, no writing to disk, no in-memory cache that needs to survive a request.

### One thing to flag to the owner

Vercel's Hobby plan is, per their fair-use policy, **for personal, non-commercial use**. Showing a demo is fine. If this becomes the farm's real day-to-day operational system, it needs Pro ($20/mo). Put this in the README so nobody's surprised later.

---

## 12. MILESTONES

Each one ends with: `npm run typecheck && npm run lint && npm run build` green → open the app and click through it → commit → update `docs/PROGRESS.md`.

- [ ] **0 — Foundation.** Repo, `docs/SPEC.md`, `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `.env.example`, scripts, CI-ish npm scripts.
- [ ] **1 — Shell & design system.** Next 16 + TS strict + Tailwind 4 + shadcn. All 7 themes with the contrast script passing. App shell: sidebar, topbar, breadcrumbs, ⌘K palette, theme picker, density toggle. Wire it to fake data. **This milestone should already be screenshot-able.**
- [ ] **2 — Database.** Neon + Drizzle, full schema, migrations, seed script. `npm run db:studio` works.
- [ ] **3 — Auth.** Better Auth, login page, `requireUser()` everywhere, middleware redirect, rate limiting, admin seeded from env, change-password, viewer role.
- [ ] **4 — Products CRUD.** The whole of §8, including custom categories / units / attributes.
- [ ] **5 — Import engine.** §5 end to end: parse → infer → review → quality → chunked commit → history → rollback → profiles. **With unit tests.**
- [ ] **6 — Auto dashboard.** Widget generator, chart library, layout persistence, drill-down to rows, data explorer.
- [ ] **7 — Analytics.** §9 — reconciliation, margins, yields, deltas, pivot builder, exports.
- [ ] **8 — Polish.** Every empty/loading/error state. A11y pass (keyboard, focus, aria, contrast across all themes). Mobile pass. RTL check. Lighthouse ≥90. Playwright happy path.
- [ ] **9 — Ship.** Env vars, migrate, seed, `vercel --prod`, verify live, README.

---

## 13. WORKING RULES

- **TypeScript strict.** No `any`, no `@ts-ignore`, no `as unknown as`. If the types are fighting you, the design is wrong.
- **No secrets in code or git.** Ever. `.env*` gitignored from the first commit.
- **Server-side validation on everything.** Client validation is UX.
- **Money is `Decimal`.** Never a float. Never `parseFloat` a price.
- **Don't invent APIs.** If you're unsure of a library's surface, read its types or docs first. A hallucinated method that fails at build is cheap; one that fails at runtime in front of the owner is not.
- **No stubs in a milestone you've marked done.** No `// TODO: implement`. No functions that return `null` as a placeholder.
- **Real error handling.** No empty catch blocks. No `console.log` as an error strategy.
- **Conventional commits**, one logical change each. Commit often enough that anything can be reverted.
- **Actually run it.** Before marking a milestone done, open the app and click through the feature. "The build passed" is not testing.
- **Push back.** If something in this spec is wrong, over-engineered, or will hurt later — say so and explain. Don't silently do something different, and don't build something you think is a mistake just because it's written here.

---

## 14. DEMO DATA (do not skip — the whole point is showing this to people)

- `npm run db:seed` → **18 months of realistic data**: ~40 products across sheep/cows/goats/bees/milk/dairy/wool/feed, ~30 customers and suppliers, ~1,500 transactions with genuine seasonal shape (lambing in spring, honey harvest in late summer, milk yield dipping in winter, Eid demand spike for sheep). Include a few deliberate anomalies so the quality panel has something real to catch.
- `npm run gen:sample-xlsx` → writes two files to `public/samples/`:
  - a **clean** one, and
  - a **deliberately messy** one: merged title row above the header, mixed date formats, mixed units in one column, trailing blanks, a sheet with Arabic headers, one column where `qty × price ≠ total`.
  The importer must survive both. The messy file is the actual test.
- A "Load demo data" and a "Reset demo" button in `/settings`.

An empty dashboard is a failed demo. It must look alive the moment someone logs in.

---

## 15. DEFINITION OF DONE

- [ ] Live at `https://<project>.vercel.app`, login required on every route, no sign-up route exists
- [ ] Wrong password rejected and rate-limited; right password lands on a populated dashboard
- [ ] The messy sample `.xlsx` uploads: columns detected, mapping editable, quality report accurate, import commits, dashboard renders
- [ ] **A second file with completely different columns also works** — nothing in the pipeline is hardcoded to the sample. Test this with a file you invent yourself.
- [ ] Rollback removes an import cleanly, leaving nothing behind
- [ ] Products: create with a brand-new custom category *and* a brand-new custom attribute; edit; archive; undo; bulk price change; export
- [ ] Herd movement reconciliation balances against the seeded data
- [ ] All 7 themes render correctly, charts recolour, contrast script passes
- [ ] Works properly on a phone
- [ ] `npm run build` clean, no console errors in production
- [ ] README: setup, env vars, how to change the admin password, how to redeploy, the live URL, the Hobby-plan note from §11
- [ ] `docs/DECISIONS.md` explains every deviation from this spec

---

**Now start with Step 0 in §1.** Tell me your plan for Milestone 1 before you build it, then go.
