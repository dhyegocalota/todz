# Tester briefing: focus-switch-defaults

## G1 server

Lane `lane/focus-switch-g1`, steps 1 to 15. Nothing here touches production; the deploy order is the runbook's steps 19 to 24.

### What changed and where

- A new owner starts with the agent nudge and the day email on: `AGENT_NUDGE_BY_DEFAULT` and `DAY_EMAIL_BY_DEFAULT` in `libs/types/src/constants.ts`, named by `insertOwnerWithIdentity` (`apps/api/src/directory-owners.ts`) and by the new-owner record of `apps/api/src/owner-sign-in.ts`.
- `apps/api/migrations/0009_setting_choices.sql`: two nullable columns `agent_nudge_chosen_at` and `day_email_chosen_at`, the stamp of every flag already on (`CAST(unixepoch('subsec') * 1000 AS INTEGER)`), table `day_email_stop_links` with its two indexes. No flag changes.
- `apps/api/migrations/0010_agent_nudge_default.sql`: `agent_nudge = 1` where `agent_nudge_chosen_at IS NULL`. Nothing else.
- `storeOwnerChanges` takes `now` and stamps the time of each flag the request names (`PATCH /owner`); a time zone or a minute alone, and a repeat sign-in, stamp nothing. `now` is the request's time from the owner context, not a fresh `Date.now()`.
- The day mail carries a footer link and the `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers. The send path (`apps/api/src/day-email/day-email-run.ts`) mints a 64-hexadecimal token per mail through `issueStopLink` and stores only its digest in `day_email_stop_links` for `DAY_EMAIL_STOP_LINK_LIFETIME_MS` (30 days); `pruneDayEmails` deletes expired links. The text part ends `Stop these emails: <url>` through a plain-text formatter for the `email-stop-link` class in `apps/api/scripts/emails/render-email.ts`. The generated module `src/emails/generated/email-templates.ts` was regenerated with `pnpm emails:generate`, never edited.
- `GET` and `POST /day-email/stop?token=...` on the API host (`apps/api/src/day-email/day-email-stop.ts`, its page and copy beside it): `GET` shows one button and stores nothing; `POST` never reads the body, turns `day_email` off, stamps `day_email_chosen_at`, deletes the owner's reply addresses and stop links in one batch, and answers the done page; any unknown, expired, reused, malformed, missing or repeated token answers the 404 page; other methods answer 405 with `Allow`. Every answer carries its own CSP (the style block's hash), `X-Robots-Tag: noindex`, `Cache-Control: no-store` and the shared security headers. Limiter `DAY_EMAIL_STOP_LIMITER`: 10 per 60 s per client address (429 with `Retry-After: 60`; on a public host a missing limiter or client address answers 503). `PATCH {day_email: false}` also deletes the owner's stop links.
- `wrangler.jsonc`: `DAY_EMAIL_STOP_LIMITER` namespace **8613** (the plan said 8615; main's taken namespaces end at 8612 and no other branch holds 8613), and `/day-email/stop` in `assets.run_worker_first`. `apps/docs/self-host.mdx` line 33 says thirteen bindings and `8601` to `8613`.
- `apps/api/scripts/setting-defaults/candidate-counts.sql` (four numbers: `owners`, `candidates`, `agent_nudge_on`, `untouched_candidates`) and `day-email-default.sql`.
- `docs/runbooks/deploy-the-api.md`: steps 19 to 24 and a rollback bullet; step 8's expected bindings list the stop limiter and namespaces `8601` to `8613`.
- Docs: `apps/api/README.md`, ADR 0063 §1 and §8 amended in place.
- Tests that need the helpers: `test/migration-directory.ts` and a test-only D1 binding `MIGRATION_DIRECTORY` plus a binding `SETTING_DEFAULT_STATEMENTS`, both in `vitest.config.mts` only.

### Deviations from the plan, for the lead

- Namespace 8613, not 8615 (the lead's message said to pick the next free contiguous number). The spec, test plan, ADR 0068 and plan still say 8615 and need the same edit.
- `tools/repository-shape/src/runbooks.test.ts` changed (not on the G1 file map): its script-name pattern now ignores a path that is not at the repository root, and one new test checks that each `--file ./scripts/...` the runbook hands to wrangler from the package folder exists under `apps/api`. Needed because wrangler runs from `apps/api`, so the file path cannot be root-relative.
- The stop link is issued with its own insert, not batched with the reply address, so `DAY_EMAIL_OWNER_BUDGET` went from 5 round trips and 5 statements to 6 and 6, and `DAY_EMAIL_TICK_BUDGET` from 4 statements to 5 (one more prune statement) in `test/budgets/budget-limits.ts`.
- Step 3's red commit adds `.gitkeep` to `apps/api/scripts/setting-defaults/` so the config can read the folder; the green commit removes it.
- Many existing assertions in `owner-sign-in.test.ts` and `day-email/owner-day-email.test.ts` changed from off to on, and a flag test that used to turn the nudge on now turns it off. A rival owner seeded by a raw `INSERT` still reads off (the schema default).
- `apps/api/test/worker.test.ts` lists fifteen tables now.

### How to run

From the repository root after `pnpm install --frozen-lockfile`: `pnpm --filter @todz/api test:unit` (a loaded machine takes minutes; one file: `pnpm --filter @todz/api exec vitest run --project workers test/<file>`), `pnpm --filter @todz/api typecheck`, `pnpm --filter @todz/api emails:check`, `pnpm exec vitest run` inside `tools/repository-shape`, `pnpm verify`.

### Red today, green after (red text as the run printed it)

| Step | Test | Red commit | Printed text | Green commit |
|---|---|---|---|---|
| 1 | `owner-sign-in.test.ts` "a new owner starts with the agent nudge and the day email on" | e8283128 | `AssertionError: expected { owner: { …(5) } } to deeply equal …` with `- "agent_nudge": true, - "day_email": true` against `+ false`, `+ false` | 93cae38e |
| 3 | `migration-0009.test.ts` (8 tests) | 5ed8d764 | `Error: no migration named 0009_setting_choices.sql` (suite fails, 8 skipped) | b7a5c9e5 |
| 5 | `owner-setting-choices.test.ts`: 3 red, 5 pin (the stamp-nothing cases pass on landing: pin) | d0acd666 | `AssertionError: expected { agent_nudge_chosen_at: null, …(1) } to deeply equal { …(2) }` | 4eb9c361 |
| 7 | `day-mail.test.ts`, `day-email-run.test.ts`; the `email-sender.test.ts` row is a pin | 0fd9987b | `expected { 'Auto-Submitted': 'auto-generated' } to deeply equal { …(3) }`; `Error: the mail should carry a List-Unsubscribe header with a stop token`; `expected '1 due today\n\nT-12 Review the releas…' to contain 'Sent at 07:00 because Email me my day…'`; `expected '<!DOCTYPE html PUBLIC …' to contain 'href="https://api.todz.app/day-email/…'`; `expected [ …(2) ] to deeply equal [ Array(1) ]` (the prune) | 0264b12e |
| 9 | `day-email-stop.test.ts` (23 of 24) | ac344edc | `AssertionError: expected 500 to be 200 // Object.is equality` (and `to be 404`, `to be 405`); the Worker logs `{"event":"worker_crash","name":"Error","message":"dayEmailStopResponse is not implemented for GET"}` | a84e8944 |
| 12 | `migration-0010.test.ts` (7 tests) | 8c92d9f5 | `Error: no migration named 0010_agent_nudge_default.sql` | 33f6bfcb |
| 13 | `setting-defaults.test.ts` (3 tests) | 5d9b4129 | `Error: no statement named candidate-counts.sql` and `Error: no statement named day-email-default.sql` | 05d3e260 |

Pins that landed green: the `constants.test.ts` pins, `email-sender.test.ts` "sends the one-click unsubscribe headers beside the auto-submitted header (pin)", the stamp-nothing cases of `owner-setting-choices.test.ts`, `generateStopSecret`'s tests.

### Hypotheses for the tester (each is a claim to attack, not a result)

1. Migration 0009 on a copy of production-shaped data changes no flag, stamps exactly the flags that are on, and the stamp is within the second of the apply.
2. A `PATCH /owner` naming `agent_nudge` or `day_email`, even with the value it already holds, stamps that flag's time with the request time and the other flag's time is untouched; no other field and no sign-in stamps.
3. A day mail's `List-Unsubscribe` is `<https://<origin>/day-email/stop?token=<64 hex>>`, the same url is the footer link in both parts, one row per mail exists in `day_email_stop_links` with the digest of that token and `expires_at` thirty days on, and no log line of the run holds `token=` or the token (the local console sender prints the mail text by design, ADR 0041, and is out of this claim).
4. On the local stack, in a real browser: `GET` on a live link shows the button page and changes nothing; the button's `POST` turns the owner's `day_email` off (read it through `GET /owner`), stamps it, and the same link answers the 404 page afterwards. A link scanner that only `GET`s never turns the mail off.
5. A `POST` with any body (empty, JSON, the one-click form, 100 000 bytes, no `Content-Type`, no `Content-Length`) is accepted; the body is never read.
6. An unknown, expired, reused, 63- or 65-character, non-hexadecimal, uppercase, missing or repeated token answers the same 404 page and stores nothing, for both methods.
7. Past 10 requests a minute from one client address the route answers 429 with `Retry-After: 60` and nothing stored; on a public host a missing limiter or client address answers 503.
8. Every answer of the route carries the CSP of design §3 whose `style-src` hash is the sha-256 of the page's one style block, so the page is styled in a browser with no CSP violation in the console.
9. Turning the day email off in Settings (`PATCH {day_email: false}`) deletes that owner's stop links and no other owner's.
10. Migration 0010 turns on every untouched nudge and no chosen one, and leaves `day_email` and both times alone. The two runbook statements behave as `setting-defaults.test.ts` seeds them; `candidate-counts.sql` prints no address and no id.
11. The runbook's steps 19 to 24 read as a procedure someone could follow without the agent (its shape is pinned by `runbooks.test.ts`; nobody has run it).

### Gaps I know about

- Nothing was run against a real `send_email` binding: whether it accepts `List-Unsubscribe` and `List-Unsubscribe-Post` is the question of deploy step 21, which stops the deploy on a `send_failed` row.
- No browser walk was done; the stop page's look (the shell is the sign-in page's inline lockup with its own style) is untested by eye.
- The plain-text formatter relies on html-to-text's `formatters` option through `@react-email/render`'s `toPlainText`; the generated text was read, not rendered in a mail client.
- `apps/api/e2e` was not run.
- Namespace 8613 is free on every branch I could read; if another lane merges first with 8613, the number moves.
