# Decisions

Dated entries for every deviation from `SPEC.md` and every non-obvious call.

## 2026-07-16 — §0 values settled in chat, not pre-filled

The spec was pasted with §0 placeholders unfilled. Confirmed with the owner via in-chat questions: APP_NAME/FARM_NAME = **Farmstead**, DEFAULT_CURRENCY = **USD**, DEFAULT_LOCALE = **en-GB**. ADMIN_USERNAME defaults to `admin`; the admin password will never pass through chat or the repo — the owner sets `ADMIN_PASSWORD` in `.env.local` locally (needed from Milestone 3) and in Vercel env at deploy. VERCEL_SCOPE and GITHUB_REPO are deferred until Milestone 9 since nothing before deployment needs them.

## 2026-07-16 — Milestone 0 npm scripts deferred to the scaffold

The M0 checklist mentions "CI-ish npm scripts", but a `package.json` created before `create-next-app` runs would block the scaffold (it refuses non-whitelisted files). The scripts are documented in `CLAUDE.md` now and land with the Milestone 1 scaffold. No behaviour is lost — there is no code to run scripts against yet.
