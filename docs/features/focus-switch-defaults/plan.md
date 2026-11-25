# Plan: One Focus switch and new defaults

**Spec:** [spec.md](spec.md)
**Tier:** 🟡
**Seam:** on the app side, `ProactiveGate` (its second input) and the three preferences' `isOn` reads, with the launch's filter read moved out of `AppDelegate` into a TodzKit coordinator; the Settings form's Focus row. On the server, the owner row's insert and `storeOwnerChanges`, migrations 0009 and 0010, the day email default step, and the day mail's send path from `feat/day-email`.
**Assumptions (decided, owner can override):**
- `feat/day-email` merges to `main` before either lane starts; the lead merges `origin/main` into `feat/focus-switch-defaults` first (merge, never rebase). The server lane needs `day_email`, its migration 0008 and its send path; the app lane needs its Settings row.
- An untouched app setting is a key absent from the app's persistent domain (ADR 0068 §6); no app migration.
- The gate's `init` takes `respectsFocus` as a required argument, so no caller gets a silent default.
- Red-first commits are separate from their green commit; a test green on landing is a `pin`. Every Swift red stubs `fatalError("<Type>.<member> is not implemented")`; every TypeScript red stubs `throw new Error('<name> is not implemented')`. The briefing records the failure text each red run actually printed.
- The stop link lives on the API host (`api.todz.app`), the host the mail's `{{origin}}` already names.
- Nothing that mails an untouched owner runs before the Worker that adds the stop link is live and the owner's own mail has proven its headers (R1, R5).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 server | `apps/api/**` (sources, tests, `migrations/0009_setting_choices.sql`, `migrations/0010_agent_nudge_default.sql`, `scripts/setting-defaults/**`, `scripts/emails/**`, the generated templates, `vitest.config.mts`, `wrangler.jsonc`), `apps/api/README.md`, `libs/types/src/constants.ts` and its test, `tools/repository-shape/src/api-source.test.ts` and any shape test that pins `wrangler.jsonc`, `docs/runbooks/deploy-the-api.md`, the amendment of ADR 0063 (step 11) | `developer-server` |
| G2 app | `apps/macos/**` (with `apps/macos/README.md`), `tools/repository-shape/src/settings-focus-copy.test.ts` (new) | `developer-app` |
| G3 docs | `docs/product/README.md`, `README.md` (the walk), `docs/screenshots/focus-switch-defaults/**`, the replaced Settings shots under `docs/screenshots/{agent-nudge,day-close,day-temperature,focus-aware}/`, one sentence in `apps/docs/self-host.mdx` | the lead, after G1 and G2 merge |

G1 and G2 are disjoint. `tester-briefing.md` has one section per lane, `## G1 server` and `## G2 app`; each developer writes only its own and the lead resolves the merge. Siblings touching the same files: `feat/day-email` (SettingsView, SettingsCopy, AppModel, OwnerModels, owner-account, owner-json, owner-sign-in, directory-owners, directory-seed, its tests, the day mail, migration 0008, `libs/types` constants, `wrangler.jsonc`: merged before this starts); `feat/siri-shortcuts` (`apps/macos/Todz/AppDelegate.swift`, `AppModel.swift`: G2 keeps its `AppDelegate.swift` edit to two lines and puts the rest in `AppDelegate+FocusSwitch.swift`; whichever merges second resolves); a security sweep that takes rate-limit namespaces from 8611 (this feature takes 8615); `feat/menu-bar-ribbon` (not started; it admits through the gate and needs nothing from here); `feat/version-compat` (queued after this one).

## Sequencing

1. The lead merges `origin/main` (with `feat/day-email`) into `feat/focus-switch-defaults`.
2. G1 and G2 run in parallel, each in its own worktree on a lane branch from that head. Neither pushes.
3. The lead merges G1 and G2 into the feature branch, then G3 runs (screenshots need the built app).
4. Z runs: tester, reviewer, security reviewer, `/open-pr`; after the merge, the deploy in its fixed order: 0009, the Worker, the stop route check, the owner's own mail, the counts, 0010, the day email default.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 server

- [ ] **Step 1 (red):** `apps/api/test/owner-sign-in.test.ts`: "a new owner starts with the agent nudge and the day email on": sign in a new identity, then `GET /owner`; expected `agent_nudge: true`, `day_email: true`, `day_email_minutes: 420`. Red today with `expected false to be true`. Commit `test(focus-switch-defaults): a new owner starts with the nudges on`.
- [ ] **Step 2 (green):** `libs/types/src/constants.ts` gains `AGENT_NUDGE_BY_DEFAULT = true` and `DAY_EMAIL_BY_DEFAULT = true` (with `constants.test.ts` pins); `insertOwnerWithIdentity` names both columns from them; `identityOwner`'s new-owner record carries them.
- [ ] **Step 3 (red):** `apps/api/test/migration-0009.test.ts` over a test-only D1 binding `MIGRATION_DIRECTORY` (added to `vitest.config.mts` only) with migrations through 0008 applied: seed owners at `0/0`, `1/0`, `1/1` (`agent_nudge`/`day_email`); apply 0009; expected every flag unchanged (0009 changes no flag), each flag already at 1 stamped with a time not null and ≤ now, each 0 with a null time; `day_email_stop_links` exists and refuses a 63-character digest. Red with the test's own `no migration named 0009_setting_choices.sql`.
- [ ] **Step 4 (green):** `apps/api/migrations/0009_setting_choices.sql`, schema and stamp only: the two nullable columns; `UPDATE owners SET agent_nudge_chosen_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE agent_nudge = 1` and the same for `day_email`; the stop link table and its two indexes. No backfill.
- [ ] **Step 5 (red):** `apps/api/test/owner-setting-choices.test.ts`: `PATCH {agent_nudge: false}` stamps `agent_nudge_chosen_at` with the request's time; `PATCH {day_email: true}` on an owner already on still stamps; `PATCH {time_zone}` and a repeat sign-in stamp nothing; `PATCH {day_email_minutes}` alone stamps nothing. Red with `expected null not to be null`.
- [ ] **Step 6 (green):** `storeOwnerChanges` takes `now` and stamps the time of each flag it is given (`CASE WHEN ? IS NULL THEN <flag>_chosen_at ELSE ? END`); `updateOwner` passes `Date.now()` at the edge; sign-in passes `null` flags as today.
- [ ] **Step 7 (red):** `apps/api/test/day-email/day-mail.test.ts`, `day-email-run.test.ts` and `email-sender.test.ts`: a sent day mail's `List-Unsubscribe` matches `/^<https:\/\/[^>]+\/day-email\/stop\?token=[0-9a-f]{64}>$/` (`http://localhost:8787` locally) and `List-Unsubscribe-Post` equals `List-Unsubscribe=One-Click`; the Cloudflare sender passes both headers to the `send_email` binding beside `Auto-Submitted`; the HTML and text footers carry the same URL (design §3); one `day_email_stop_links` row exists for the owner with `expires_at = sent + DAY_EMAIL_STOP_LINK_LIFETIME_MS`; no log line other than the local console sender's text (ADR 0041) carries `token=` or the token. Red with `expected undefined to match …`.
- [ ] **Step 8 (green):** `DAY_EMAIL_STOP_LINK_LIFETIME_MS` in `libs/types`; the send path mints the secret, stores its digest, sets both headers and the `{{stopUrl}}` slot; `day-email-copy.ts` footer per design §3; regenerate the templates; the prune step deletes expired stop links; update `test/budgets/budget-limits.ts` for the one extra statement per mail and say so in the briefing.
- [ ] **Step 9 (red):** `apps/api/test/day-email/day-email-stop.test.ts`, with `/day-email/stop` already routed to a stub `dayEmailStopResponse` that throws `dayEmailStopResponse is not implemented` (the briefing records the printed text): `GET` with a live token answers 200 with the form and changes nothing; `POST` with a live token answers 200, `day_email` 0, `day_email_chosen_at` set, the owner's reply addresses and stop links gone, whatever the body (`List-Unsubscribe=One-Click`, empty, JSON, no `Content-Type`, no `Content-Length`); a second `POST` with the same token answers 404; unknown, expired, 63-character, 65-character, non-hex, missing and repeated tokens answer 404 for `GET` and `POST` with nothing stored; `PUT` answers 405; past the limiter's limit from one client, 429 through `limitRefusal`; every answer carries the exact `Content-Security-Policy` of design §3, `X-Robots-Tag: noindex`, `Cache-Control: no-store` and the shared security headers; `PATCH {day_email: false}` deletes the owner's stop links; another owner's rows are untouched.
- [ ] **Step 10 (green):** `apps/api/src/day-email/day-email-stop.ts` (one handler per method from a record keyed by the method; the `POST` never reads the body: only the token decides), its copy in `apps/api/src/day-email/day-email-stop-copy.ts` (design §3), the page through `escapedHtml` and `withSecurityHeaders` with its own CSP whose `style-src` hash is computed from the page's one style block, routed on the API host; `DAY_EMAIL_STOP_LIMITER` (namespace `8615`, 10 per 60 s per client address) in `wrangler.jsonc` and `Env`; `/day-email/stop` joins `assets.run_worker_first`; `storeOwnerChanges`' day-email-off path deletes stop links beside reply addresses.
- [ ] **Step 11:** `tools/repository-shape/src/api-source.test.ts` and any shape test that pins `wrangler.jsonc` follow the new route, limiter and table; `apps/api/README.md` lines 5 and 21 (the nudge on by default, the stop link among the public addresses); ADR 0063 §1 and §8 amended in place: on by default for untouched owners (ADR 0068), and every mail carries the stop link and the `List-Unsubscribe` headers.
- [ ] **Step 12 (red, then green):** `apps/api/test/migration-0010.test.ts` over `MIGRATION_DIRECTORY` through 0009: owners with `agent_nudge` 0 and a null time become 1; a stamped 0 stays 0; `day_email` is untouched by 0010. Then `apps/api/migrations/0010_agent_nudge_default.sql` (`UPDATE owners SET agent_nudge = 1 WHERE agent_nudge_chosen_at IS NULL`). Red with `no migration named 0010_agent_nudge_default.sql`.
- [ ] **Step 13 (red, then green):** `apps/api/test/setting-defaults.test.ts` runs the two runbook statements, which `vitest.config.mts` reads into a test-only binding as it reads the migrations: `apps/api/scripts/setting-defaults/candidate-counts.sql` answers four numbers and no address or id (all owners; owners with an `email` identity and a workspace; owners with `agent_nudge = 1`; of those candidates, how many have `day_email_chosen_at IS NULL`), checked against seeded rows; `apps/api/scripts/setting-defaults/day-email-default.sql` (`UPDATE owners SET day_email = 1 WHERE day_email_chosen_at IS NULL`) turns on untouched rows and leaves a stamped 0 at 0. Red with the test's own `no statement named day-email-default.sql`.
- [ ] **Step 14:** `docs/runbooks/deploy-the-api.md` gains the deploy order of Z with an expected result and an `If it fails` line per step, and the rollback row's `UPDATE`.
- [ ] **Step 15:** the `## G1 server` section of `tester-briefing.md`.

### G2 app

- [ ] **Step 16 (red):** `ProactiveGateTests`: "turning Respect Focus off while held releases each held kind once" (calls `setRespectsFocus`, so the stub is reached), "with Respect Focus off a quiet filter shows", "with Respect Focus on a quiet filter holds", "turning Respect Focus on during a quiet filter holds from then on", "a perform() while off is remembered and applies when the switch turns on", "switch off while held, then perform(false): nothing is released twice". Every existing test builds `ProactiveGate(respectsFocus: true)`. Stub `setRespectsFocus` with `fatalError("ProactiveGate.setRespectsFocus is not implemented")`; the red run is the first test above.
- [ ] **Step 17 (green):** `ProactiveGate(respectsFocus:)`, `setRespectsFocus(_:)`, the filter's value kept apart from `isQuiet`, release on the quiet ending either way and never twice; `DayCloseCoordinatorTests` and `MorningGlanceCoordinatorTests` construct the gate with `respectsFocus: true`.
- [ ] **Step 18 (red):** `RespectFocusPreferenceTests`: the key is `respectsFocus`; a fresh domain reads off; a stored `true` reads on; registering the defaults registers off and never overwrites a choice; a value only in another searched domain is ignored. Stub `isOn` with `fatalError("RespectFocusPreference.isOn is not implemented")`.
- [ ] **Step 19 (green):** `apps/macos/TodzKit/Sources/TodzKit/RespectFocusPreference.swift`.
- [ ] **Step 20 (red):** `DayClosePreferenceTests`, `MorningGlancePreferenceTests`, `DayTemperaturePreferenceTests`: "a fresh domain reads on", "registering the defaults registers on", "a stored false stays off" (pin), "a non-Bool value reads as the default", "a false only in another searched domain is ignored". Red with `Expectation failed: (… .isOn) → false`.
- [ ] **Step 21 (green):** the three `isOnByDefault` become `true`; each `isOn` returns the stored Bool when present and `isOnByDefault` when not (`guard let`, no `??`). Coordinator tests that assumed an absent key meant off store an explicit `false`.
- [ ] **Step 22 (red):** `FocusSwitchCoordinatorTests` with an injected `readFilter` and `pause`: with the switch off at start, `readFilter` is never called and the gate is open at once; on at start, it is called once and its answer reaches the gate; a read that outlasts the timeout makes the gate quiet after the pause, and its later answer `false` releases the gate (ADR 0054); turning the switch on calls it once; turning it off calls nothing and opens the gate; a `perform()` before the read wins; a defaults change that does not flip the switch while it is on reads nothing. Stub `start` with `fatalError("FocusSwitchCoordinator.start is not implemented")`.
- [ ] **Step 23 (green):** `apps/macos/TodzKit/Sources/TodzKit/FocusSwitchCoordinator.swift` takes over `readFocusFilter`'s timeout logic and reacts only to a change of the switch's value; `apps/macos/Todz/AppDelegate+FocusSwitch.swift` builds it with `TodzFocusFilter.current` and is told of defaults changes by the existing `UserDefaults.didChangeNotification` observation in `AppDelegate+DayTemperature.swift` (no second observer); `AppDelegate.swift` builds the gate from `RespectFocusPreference` and awaits the coordinator instead of `readFocusFilter()`; `TodzApp` registers `RespectFocusPreference`'s defaults.
- [ ] **Step 24 (red):** `tools/repository-shape/src/settings-focus-copy.test.ts`: in `apps/macos/Copy/SettingsCopy.swift`, "Focus" appears only in the `respectFocus*`, `openFocusSettings` and `focusQuietNow` values (read with `swiftCopyValue`); `respectFocusDetail` is "Hold what todz shows on this Mac in a Focus that has the todz filter."; `dayTemperatureDetail` is "Dims the menu bar count through the afternoon and tints overdue widget rows.". Red on `dayTemperatureDetail`.
- [ ] **Step 25 (green):** `SettingsCopy` and `SettingsView` per design §1–2: the Respect Focus switch last in the first section, the helper row only while on, the detail per `FocusQuietNotice` only while on; `TodzFocusFilter`'s description per design §2; the Settings height test follows the extra row; `apps/macos/README.md` line 7 (the switch, the new defaults).
- [ ] **Step 26:** the `## G2 app` section of `tester-briefing.md`, with the computer-use walk steps and the fresh-preferences recipe of R10.

### G3 docs

- [ ] **Step 27:** `docs/product/README.md`: the proactive line says the nudges are on by default and one Respect Focus switch, off by default, holds the app's own surfaces in a Focus that has the filter (ADR 0068).
- [ ] **Step 28:** the recorder's Settings shots (light and dark, defaults; Respect Focus on with the helper line) into `docs/screenshots/focus-switch-defaults/`; the README walk's four Settings shots replaced, not added to (ADR 0047), the "Quiet during Focus" caption gone; the old Settings shots no README links deleted.
- [ ] **Step 29:** `apps/docs/self-host.mdx`: one sentence that, on a server that already has owners, an owner who never touched Email me my day gets it only after the day email default step, and new owners get it at once.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a new owner's row omits a flag and takes the schema's `DEFAULT 0` | step 1 stays red | revert step 2 |
| 4 | 0009 changes a flag | step 3's unchanged-flag assertions fail | revert step 4 |
| 4 | 0009 fails on production D1 | `wrangler d1 migrations apply` exits non-zero; the Worker is not deployed | fix and re-run; nothing depends on it yet |
| 6 | a sign-in stamps a choice time | step 5's sign-in case fails | revert step 6 |
| 7–8 | the `send_email` binding refuses the headers | the owner's own mail after deploy is missing, a `day_emails` row has `failure = 'send_failed'` | stop before the counts; `wrangler rollback`; no untouched owner was turned on yet |
| 8 | a mail without a stop link, or a token in a log | step 7 fails; Workers Logs show `token=` | revert step 8; the mail keeps its footer |
| 10 | a link scanner turns the mail off with a `GET` | step 9's `GET` case fails | revert step 10; links in sent mails answer 404 |
| 10 | an owner's stop link turns off another owner's mail | step 9's isolation case fails | revert step 10 |
| 10 | the CSP blocks the page's own style | step 9's header assertion or the walk's screenshot unstyled | fix the hash; the button still works unstyled |
| 12 | 0010 turns on a nudge an owner chose off after 0009 | step 12's stamped-0 case fails | `UPDATE owners SET agent_nudge = 0 WHERE agent_nudge_chosen_at IS NULL` restores the old default exactly |
| 13 | the day email default mails an owner who is not the project owner | the counts' fourth number was not 0 and the statement ran anyway; `day_emails` gains a row for another owner | `UPDATE owners SET day_email = 0 WHERE day_email_chosen_at IS NULL` before the next quarter-hour tick |
| 17 | the gate stays quiet with the switch off, or releases twice | step 16 fails; a day close missing at 18:00 with no Focus | revert steps 16–17 |
| 21 | an owner's explicit off reads on | step 20's pin fails | revert step 21 |
| 23 | the launch waits 3 s or quiets todz with the switch off | step 22 fails; the morning glance late on wake | revert step 23; `readFocusFilter` comes back |
| 25 | the helper row shows while off, or Focus copy remains | step 24 fails; the walk's screenshot | revert step 25 |
| Z deploy | the Worker fails on the new route | `/health` not 200 after deploy; Workers Logs 5xx | first `UPDATE owners SET day_email = 0 WHERE day_email_chosen_at IS NULL`, then `wrangler rollback`; the columns and the table stay unused |

**Steps with no backout:** none loses data. Each backfill's inverse is exact for rows still untouched; a stop link an owner used is that owner's own choice and stays.

## Z. Prove and ship

- [ ] **Tester briefing:** both developers wrote their sections of `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** verdict on the stop link route, the token's handling, the limiter, the CSP, the backfills and the day email default step.
- [ ] **/check-ui:** Settings screenshots and a short video through computer use with the fresh-preferences recipe of R10 (the owner's popover is not walked in loops), and the stop page through Playwright MCP on the local stack.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
- [ ] **Deploy 1, schema:** `wrangler d1 migrations apply` has no stop point, so the lead runs it from a detached worktree at the last commit before step 12, which has no 0010 file. Expected: 0009 listed as applied, 0010 not, every flag unchanged.
- [ ] **Deploy 2, Worker:** `wrangler deploy`; `/health` 200; `GET` and `POST https://api.todz.app/day-email/stop?token=<random 64 hex>` answer 404 with the CSP header.
- [ ] **Deploy 3, the owner's own mail:** the project owner's day email is already chosen on (if it is not, the owner turns it on in Settings first, which stamps it); at its next send the owner's session reads the mail's original source: both `List-Unsubscribe` headers present; the loop opens the link with `GET` only and sees the button page while `GET /owner` still answers `day_email: true`; `day_emails` holds no `send_failed` row for that day. A `send_failed` row stops the deploy here. The one-click `POST` is proven on the local stack only; a real stop link is never posted in production.
- [ ] **Deploy 4, counts:** `wrangler d1 execute todz-directory --remote --file apps/api/scripts/setting-defaults/candidate-counts.sql`, read-only, four numbers and never an address, recorded in the run log. Deploy 3 proved the project owner's `day_email` is 1, so 0009 stamped that row: every untouched candidate (the fourth number) is another owner.
- [ ] **Deploy 5, nudge default:** apply 0010 (from the merged head). Expected: `SELECT count(*) FROM owners WHERE agent_nudge = 0 AND agent_nudge_chosen_at IS NULL` is 0.
- [ ] **Deploy 6, day email default:** the project owner is already on and stamped, so the owner-only backfill of R3 changes no row. When the fourth number is 0, run `day-email-default.sql` (it reaches only rows that cannot be mailed today); when it is not 0, run nothing. The call and the row count go in the run log.
- [ ] **Release preferences:** before installing the Release build, read `closesTheDay`, `showsMorningGlance`, `showsDayTemperature` and `respectsFocus` in the Release container's preferences; report each as absent (takes the new default) or present with its value; a present `false` is reported as "stays off because it was flipped".

## Plan review answers (R1–R23)

The plan review of 556d5f9 answered NO (2 CRITICAL, 10 IMPORTANT, 11 MINOR). Every finding is accepted; the decisions are the loop's.

- **R1 (CRITICAL) the backfill before the stop link.** 0009 is schema and stamp only; the nudge backfill is 0010 and the day email default a separate step, both after the Worker deploy and the stop route check (Deploy 1–6). The rollback row first turns untouched day emails off, then rolls back. One deviation: a migration takes no bound parameter, so an owner-only day email backfill in 0010 would commit the address. 0010 carries the nudge backfill only; the day email default is a runbook statement (step 13, Deploy 6).
- **R2 (CRITICAL) the production check would post the owner's own stop link.** Deploy 3 reads the headers from the mail's source and opens the link with `GET` only; a random token's `POST` answers 404 (Deploy 2). The one-click `POST` is proven on the local stack only; the test plan's production section says the same.
- **R3 (IMPORTANT) nobody counted who the backfill mails.** Deploy 4 records the read-only counts; the project owner (the `ADMIN_EMAIL` owner) already chose the day email on, which Deploy 3 proves and 0009 stamps, so the owner-only backfill changes no row and is met without matching the address at all: Deploy 6 runs the day email default only when no other untouched candidate exists, and runs nothing otherwise. No address is read, bound or printed. The nudge backfill (0010) applies to all; it sends no mail. ADR 0068's Consequences and the test plan's coverage line now say the day email ships with `feat/day-email`.
- **R4 (IMPORTANT) the footer suggests the owner turned it on.** Design §3's footer is "Sent at {{time}} because Email me my day is on in todz Settings, where it starts on. Stop these emails"; the text part ends "Stop these emails: <url>".
- **R5 (IMPORTANT) the binding may refuse the headers.** Step 7 tests that the sender passes both headers; Deploy 3 proves them in the owner's own mail before any untouched owner is turned on, and a `send_failed` row stops the deploy.
- **R6 (IMPORTANT) the 413 rule can fail an unsubscribe.** The `POST` never reads the body; any body, `Content-Type` or missing `Content-Length` is accepted. The 413 row and `isBoundedRequest` are gone from step 10, the spec and the test plan.
- **R7 (IMPORTANT) the stop page's CSP.** Design §3 states the exact header and `X-Robots-Tag: noindex`; no Turnstile; step 9 asserts the exact header.
- **R8 (IMPORTANT) the late launch read contradicted ADR 0054.** The test plan and step 22 now say a later `false` releases the gate, as `aLateLaunchReadAfterTheTimeoutQuietedTheGateReleasesWhatItHeld` pins.
- **R9 (IMPORTANT) a red text that cannot print.** The red test is "turning Respect Focus off while held releases each held kind once", which calls `setRespectsFocus` and reaches the stub.
- **R10 (IMPORTANT) walks would pop the day close and the glance.** Fresh preferences for a walk: remove the Debug domain, then before launch `defaults write <Debug domain> lastClosedDay -string <today>` and `lastMorningGlanceDay -string <today>`; the `isOn` keys stay absent.
- **R11 (IMPORTANT) the owner's Release preferences.** The Z "Release preferences" check reads the four keys before installing and reports each.
- **R12 (IMPORTANT) README ownership.** G1 owns `apps/api/README.md` (step 11), G2 owns `apps/macos/README.md` (step 25); G3 drops both.
- **R13 (MINOR) the console sender prints the token.** Step 7 and the test plan exclude the local console sender, which logs the text by design (ADR 0041).
- **R14 (MINOR) the Respect Focus detail.** "Hold what todz shows on this Mac in a Focus that has the todz filter." in design §2, step 24 and the test plan; the mail and the agent nudge never go quiet.
- **R15 (MINOR) ADR 0063.** Step 11 amends §1 and §8 after the day-email merge.
- **R16 (MINOR) the stamp value.** `CAST(unixepoch('subsec') * 1000 AS INTEGER)` in step 4; step 3 asserts not null and ≤ now; the claim that D1 runs a migration in one transaction is dropped.
- **R17 (MINOR) owners the old Worker creates between 0009 and the deploy.** Their rows get `DEFAULT 0` with null times; 0010 and the day email default, which run after the deploy, cover them (ADR 0068 Consequences).
- **R18 (MINOR) the stale-link copy.** "This link no longer works. Your day email is set in todz Settings." in design §3 and the test plan.
- **R19 (MINOR) a limiter.** `DAY_EMAIL_STOP_LIMITER`, namespace `8615`, 10 per 60 s per client address, 429 through `limitRefusal`; `/day-email/stop` joins `assets.run_worker_first` (step 10).
- **R20 (MINOR) step 9's red and the header regex.** Step 9's red routes `/day-email/stop` to the stub and records the printed text; step 7 and the test plan carry the real regex.
- **R21 (MINOR) edges.** Switch off while held then `perform(false)` releases nothing twice (step 16); a defaults write that does not flip the switch reads nothing (step 22); the coordinator reuses the existing defaults observation (step 23).
- **R22 (MINOR) "Not changing" and the self-host guide.** The spec says "the day mail's task lines and schedule"; G3 owns one sentence in `apps/docs/self-host.mdx` (step 29).
- **R23 (MINOR) the briefing.** Sections `## G1 server` and `## G2 app`; the lead resolves the merge.
