# Fair use: plan

Lane lead: Claude (loop). Lighter gates for this lane: no plan-review round; one pass of each review; findings below IMPORTANT are listed here as v1.1 and not fixed. Red-first: each group commits its failing tests before its code.

Ownership is by group, not by developer: one lead works the groups in order, so no two steps run at once.

## Steps

### Group A: the numbers and the text rules (red, then code)

- [ ] A1. Red: `libs/types/src/constants.test.ts` pins the new defaults (projects 100, open tasks 5,000, writes 1,000 a day, stored bytes 50 MiB, sign-ups 5 a client a day, notes 10,240 bytes, title 500), `FairUseLimit` values. Commit "test(types): pin fair use limits (red)".
- [ ] A2. Red: `libs/core/src/task-text.test.ts` pins notes at exactly 10,240 bytes accepted, 10,241 bytes refused with `notes_too_long`, multi-byte notes counted in bytes, titles at 500 accepted and 501 refused. Commit "test(core): pin the note byte limit (red)".
- [ ] A3. Code: `libs/types/src/constants.ts`, `libs/types/src/fair-use.ts` (new enum `FairUseLimit`), `libs/types/src/task.ts`; `libs/core/src/task-text.ts` measures notes in bytes; `LimitViolation` in `libs/core/src/errors.ts`; `mcp-copy.ts` notes copy says "10 KB".

### Group B: configuration

- [ ] B1. Red: `apps/api/test/fair-use-limits.test.ts`: unset vars keep the defaults; a set positive integer is used; `0`, `-1`, `1.5`, `ten` throw naming the var. Commit "test(api): pin the fair use vars (red)".
- [ ] B2. Code: `apps/api/src/env.ts` (the `FAIR_USE_*` vars as optional strings), `apps/api/src/fair-use-limits.ts` (`fairUseLimitsOf(env)`), `apps/api/wrangler.jsonc` is unchanged (defaults apply).

### Group C: storage

- [ ] C1. Migration `apps/api/migrations/0012_fair_use.sql`: `owners.suspended_at INTEGER` (nullable), `owner_usage` (owner_id, day, writes, bytes; primary key owner_id, day), `sign_up_usage` (client_key, day, accounts; primary key client_key, day; index on day).
- [ ] C2. Red: `apps/api/test/owner-write-quota.test.ts`: a reservation under the caps adds the writes and bytes; the reservation that would pass the daily cap is refused and adds nothing; the same for the stored cap; concurrent reservations at the last unit accept exactly the units left; a suspended owner's reservation is refused and adds nothing; a day boundary starts a fresh count. Commit "test(api): pin the write reservation (red)".
- [ ] C3. Code: `apps/api/src/owner-usage-store.ts` (`reserveOwnerWrites`, `diagnoseWriteRefusal`, `findOwnerSuspension`, `setOwnerSuspension`, `topOwnerUsage`), `apps/api/src/owner-write-quota.ts` (`writeRefusalOf` turns a reservation into a `FairUseRefusal` or null; `fairUseRefusalResponse`, `fairUseRefusalText`).

### Group D: owner API refusals and suspension

- [ ] D1. Red: `apps/api/test/owner-suspension.test.ts`: every session write route (workspace create and rename, project create and rename, add, update, complete, reopen, key issue and revoke, owner update) answers 403 `account_suspended` with a message and writes nothing; every session `GET` answers 200; sign-out answers; restoring the owner restores writes; `owner-quotas.test.ts` expects `limit` and `message` on the existing workspace, project and key refusals (its `{ error: 'limit_reached' }` expectations are updated). Commit "test(api): pin suspension and limit messages (red)".
- [ ] D2. Code: `apps/api/src/owner-errors.ts` (new codes `AccountSuspended`, `SignUpRefused`; `limitResponse`, `fairUseRefusalResponse`), `apps/api/src/owner-endpoint.ts` (suspension check before a non-`GET` session route, except sign-out), `owner-task-writes.ts` (reservation before the Durable Object), `owner-workspaces.ts` and `owner-keys.ts` (limits from `fairUseLimitsOf`), `directory-workspaces.ts` and `directory-keys.ts` (the limit parameter from the caller).
- [ ] D3. Copy: `apps/api/src/fair-use-copy.ts`: one message per refusal, built from the constants.

### Group E: open tasks and the Durable Object

- [ ] E1. Red: `apps/api/test/project-store.test.ts` (new cases) and `apps/api/test/owner-tasks.test.ts`: with the cap at 3 (through the vars), a fourth open task is refused with `limit_reached` `open_tasks`; completing one frees a slot; a reopen over the cap is refused; a batch that would cross the cap is refused whole. Commit "test(api): pin the open task cap (red)".
- [ ] E2. Code: `apps/api/src/sqlite-task-store.ts` (`countOpenTasks`), `apps/api/src/project-store.ts` (the cap check inside `runWrite` for add and reopen, `LimitViolation` thrown there), `apps/api/src/project-result.ts` (`ProjectFailureKind.LimitReached`), `apps/api/src/owner-errors.ts` `failureResponse`, `apps/api/src/mcp-format.ts` `failureText`.

### Group F: MCP

- [ ] F1. Red: `apps/api/test/mcp-fair-use.test.ts`: a suspended key's MCP call answers 403 with the suspended message, reads included; a write over the daily cap returns an error tool result with the message and adds no task; a write over the open-task cap returns the open-task message; a normal write is unchanged. Commit "test(api): pin fair use over MCP (red)".
- [ ] F2. Code: `apps/api/src/project-routing.ts` (`KeyProject` gains `ownerId` and `isSuspended`; the key query reads `owners.id` and `owners.suspended_at`), `apps/api/src/mcp-endpoint.ts` (suspended refusal before the scope), `apps/api/src/mcp-server.ts` (write tools reserve first through a `reserveWrites` in the scope).

### Group G: sign-up

- [ ] G1. Red: `apps/api/test/owner-sign-up-limits.test.ts`: the sixth new account from one client answers 429 `limit_reached` `daily_sign_ups` with `Retry-After`, creates no owner row, and an existing owner still signs in past the cap; a listed disposable domain answers 403 `sign_up_refused` for a new owner, creates nothing, and is accepted for an existing owner; `isDisposableEmailDomain` matches the domain case-insensitively and not a subdomain of a longer unrelated name. Commit "test(api): pin sign-up caps (red)".
- [ ] G2. Code: `apps/api/src/disposable-email-domains.ts` (the vendored list), `apps/api/src/sign-up-limiter.ts` (`signUpRefusalOf`), `apps/api/src/owner-sign-in.ts` (called before a new owner is inserted), `owner-usage-store.ts` (`reserveSignUp`).

### Group H: admin

- [ ] H1. Red: `apps/api/test/admin-usage.test.ts`: `GET /admin/usage` answers the sign-in card with no data without an admin session and with a non-admin session; the page lists the top owners by writes and by bytes over seven days, each with its suspension state; `POST /admin/suspensions` refuses without the session, with a foreign origin, and for a non-admin; with the session it sets and clears `suspended_at` and redirects to `/admin/usage`. Commit "test(api): pin the admin usage view (red)".
- [ ] H2. Code: `apps/api/src/site/admin-usage.ts` (page), `apps/api/src/site/admin-suspension.ts` (POST), `apps/api/src/site/admin-paths.ts` (`Usage`, `Suspensions`), `apps/api/src/site/admin-routes.ts`, `apps/api/src/site/admin-copy.ts` (copy), a link from `admin-page.ts` to the page.

### Group I: docs and indexes

- [ ] I1. `apps/docs`: a "Fair use" page with the limits table, the refusal messages a person sees, what suspension means, and the self-host vars; linked from the navigation. Checked by `tools/repository-shape` (`docs-pages.test.ts`).
- [ ] I2. `docs/adr/README.md` rows for 0086 to 0089; `docs/features/README.md` row for `fair-use` (Building, last).
- [ ] I3. `apps/api/README.md` unchanged (purpose only); `docs/self-host.md` gets a short "limits" paragraph with the var names (the self-host test keeps the links true).

### Group J: gate and ship

- [ ] J1. `pnpm typecheck`, `pnpm test:unit`, `/verify` green, each step's tests listed above green on the branch.
- [ ] J2. Test plan ticked with evidence (command, counts) in `test-plan.md`.
- [ ] J3. Commit with Conventional Commit, push, `gh pr create`.

## Failure modes

| Step | What breaks | Concrete signal | How to back out |
|---|---|---|---|
| A3 | An existing title or note between 200 and 500 characters is now accepted by old tests | `task-text.test.ts` and `mcp-copy` snapshot tests red | Update the pinned test; the app copy reads the constant |
| B2 | A self-host with a typo in a var stops the Worker | Error names the var on first request | Unset the var to get the default |
| C3 | The reservation statement is wrong for the conflict branch, so the stored cap is off by one day | `owner-write-quota` concurrency and day-boundary tests red | Revert C3 to the two-statement read-then-write and re-run |
| D2 | Suspension check misses a route | `owner-suspension` route list test red (it enumerates every session write route) | Add the route to the check; the list is the test |
| E2 | The cap check runs outside the transaction and two adds overshoot | Concurrent add test over the cap red | Move the check into `runWrite`'s transaction (it already is) |
| F2 | A suspended key still reads over MCP | `mcp-fair-use` read-under-suspension test red | Keep the refusal ahead of the legacy and modern branches |
| G2 | The sign-up cap counts existing owners | `owner-sign-up-limits` existing-owner test red | The count is taken only after the identity lookup finds no owner |
| H2 | The admin POST accepts a foreign origin | `admin-usage` origin test red | `isSameOriginPost` is already the guard; do not bypass it |
| I1 | The docs navigation names a missing page | `docs-pages.test.ts` red | Fix the path in `docs.json` |

No step is without a backout.

## Deviations and v1.1

- v1.1 (IMPORTANT or below, not fixed here): the app's `OwnerErrorCode` does not decode `limit_reached`, `account_suspended` or `sign_up_refused`, so the app shows its generic "change not saved" banner. A follow-up in `apps/macos` decodes the codes and shows `message`. Not part of this lane (the owner's brief excludes `apps/macos`).
- v1.1: the MCP `next` tool and the day email read paths are not quota-checked (reads are never counted).
- v1.1: the admin Top usage page's screenshots are not recorded in this lane; the page is server-rendered HTML and is covered by `admin-usage.test.ts`.
- v1.1: stored text overcounts edits (an edit counts its new text); exact accounting needs a byte ledger in the Durable Object.
