# The Worker answers 500 "no such table" under wrangler dev while every Vitest test passes
- Date: 2026-11-23
- Inspired by: `owner-api` tester run (fresh `pnpm --filter @todz/api dev`, the first sign-in), fixed in 0e9f463 (red) and 6f4a275

## Signal
On a fresh local state, the first request that touches the directory answers 500 with `D1_ERROR: no such table: owner_identities` (or any other table). The whole Vitest suite is green, and an older checkout that ran migrations by hand once keeps working, so only a new machine or a deleted `.wrangler` shows it.

## Cause
The Vitest configuration reads the migrations with `readD1Migrations` and a setup file applies them to every test run, so the tests never depend on Wrangler's own state. `wrangler dev` never applies D1 migrations: it serves whatever the local `.wrangler` state holds, and an empty state has no tables. Nothing failed at boot, so the gap only surfaced on the first query.

## Do
Keep the `dev` script of `apps/api` applying the directory migrations locally before it starts the Worker, and leave the `api-source.test.ts` pin that checks the order in place. A tester walking `wrangler dev` starts from a fresh `--persist-to` directory in the scratchpad, never from a state left by an earlier run.

## Anchor
- `apps/api/package.json` (`dev`)
- `tools/repository-shape/src/api-source.test.ts`: the dev script applies the directory migrations before `wrangler dev`
- `apps/api/vitest.config.mts`, `apps/api/test/apply-migrations.ts`
- commits 0e9f463 (red), 6f4a275 (fix)
