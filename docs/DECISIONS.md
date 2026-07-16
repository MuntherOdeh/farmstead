# Decisions

Dated entries for every deviation from `SPEC.md` and every non-obvious call.

## 2026-07-16 — §0 values settled in chat, not pre-filled

The spec was pasted with §0 placeholders unfilled. Confirmed with the owner via in-chat questions: APP_NAME/FARM_NAME = **Farmstead**, DEFAULT_CURRENCY = **USD**, DEFAULT_LOCALE = **en-GB**. ADMIN_USERNAME defaults to `admin`; the admin password will never pass through chat or the repo — the owner sets `ADMIN_PASSWORD` in `.env.local` locally (needed from Milestone 3) and in Vercel env at deploy. VERCEL_SCOPE and GITHUB_REPO are deferred until Milestone 9 since nothing before deployment needs them.

## 2026-07-16 — shadcn CLI 4.x: Radix base, RTL flag at init

The shadcn CLI now offers Base UI or Radix as the component library and style presets (Vega et al.) instead of a base-color flag. Chose **Radix** (`-b radix -p vega`) — it is the battle-tested classic shadcn/ui the spec references, with the widest community compatibility. Passed `--rtl` at init so generated components use logical properties from day one (SPEC §10 RTL-ready).

## 2026-07-16 — Contrast gate thresholds adopted from the dataviz validator

`scripts/check-contrast.ts` enforces stricter chart-palette floors than the spec's WCAG-only wording: normal-vision ΔE(OKLab) ≥ 0.15 and deuteranopia-simulated (Machado 2009) ΔE ≥ 0.08 between all chart-token pairs, plus 3:1 chart-vs-card contrast. Borders are checked at a 1.3:1 visibility floor rather than 3:1 — WCAG 1.4.11 requires 3:1 only for component-identifying visuals (focus ring and control fills are enforced at 3:1); forcing hairlines to 3:1 would wreck the design for no accessibility gain.

## 2026-07-16 — Destructive is a soft style in current shadcn

Current shadcn renders destructive buttons/badges as `text-destructive` on a 10–20% wash, not white-on-red fills. The contrast script therefore checks destructive **as text** (≥ 4.5:1 on background, card, popover, and its own wash), and dark themes use a brighter red (L 0.72) than a fill-based design would.

## 2026-07-16 — useSyncExternalStore instead of set-state-in-effect

`eslint-plugin-react-hooks` now hard-errors on `setState` directly inside effects (`react-hooks/set-state-in-effect`), which rules out the classic "sync from localStorage after mount" pattern — including shadcn's own `use-mobile` hook. Theme preset, density, `useIsMobile`, and the mounted-check in settings were written/rewritten on `useSyncExternalStore`, which is the sanctioned pattern and handles SSR snapshots cleanly.

## 2026-07-16 — `[data-theme="default"]` alias and descendant theme scoping

`themes.css` registers the default palette under `:root, [data-theme="default"]` and each dark preset under `.dark[data-theme="x"], .dark [data-theme="x"]`. This lets any small element (theme-picker swatches) carry `data-theme` and render its own palette's colours regardless of the active page theme, in the correct mode. Page-level theming is unaffected (an element is never its own descendant).

## 2026-07-16 — Type stack: Inter / Fraunces / Geist Mono

SPEC §10 wants one UI face, one display face, one mono. Chose Inter (UI), Fraunces (display — a warm serif that suits a farm product), Geist Mono (numbers/SKUs, kept from the scaffold). `tabular-nums` is applied globally to tables and KPI tiles.

## 2026-07-16 — Milestone 0 npm scripts deferred to the scaffold

The M0 checklist mentions "CI-ish npm scripts", but a `package.json` created before `create-next-app` runs would block the scaffold (it refuses non-whitelisted files). The scripts are documented in `CLAUDE.md` now and land with the Milestone 1 scaffold. No behaviour is lost — there is no code to run scripts against yet.
