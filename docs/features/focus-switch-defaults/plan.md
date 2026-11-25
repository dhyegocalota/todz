# Plan: One Focus switch and new defaults

**Spec:** [spec.md](spec.md)
**Tier:** 🟡
**Seam:** on the app side, `ProactiveGate` (its second input) and the three preferences' `isOn` reads, with the launch's filter read moved out of `AppDelegate` into a TodzKit coordinator; the Settings form's Focus row. On the server, the owner row's insert and `storeOwnerChanges`, migration 0009, and the day mail's send path from `feat/day-email`.
**Assumptions (decided, owner can override):**
- `feat/day-email` merges to `main` before either lane starts; the lead merges `origin/main` into `feat/focus-switch-defaults` first (merge, never rebase). The server lane needs `day_email`, its migration 0008 and its send path; the app lane needs its Settings row.
- An untouched app setting is a key absent from the app's persistent domain (ADR 0068 §6); no app migration.
- The gate's `init` takes `respectsFocus` as a required argument, so no caller gets a silent default.
- Red-first commits are separate from their green commit; a test green on landing is a `pin`. Every Swift red stubs `fatalError("<Type>.<member> is not implemented")`; every TypeScript red stubs `throw new Error('<name> is not implemented')`. The briefing records the failure text each red run actually printed.
- The stop link lives on the API host (`api.todz.app`), the host the mail's `{{origin}}` already names.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 server | `apps/api/**` (sources, tests, `migrations/0009_setting_choices.sql`, `scripts/emails/**`, the generated templates, `vitest.config.mts`, `wrangler.jsonc` only if a route needs it), `libs/types/src/constants.ts` and its test, `tools/repository-shape/src/api-source.test.ts`, `docs/runbooks/deploy-the-api.md` | `developer-server` |
| G2 app | `apps/macos/**`, `tools/repository-shape/src/settings-focus-copy.test.ts` (new) | `developer-app` |
| G3 docs | `docs/product/README.md`, `README.md` (the walk), `docs/screenshots/focus-switch-defaults/**`, the replaced Settings shots under `docs/screenshots/{agent-nudge,day-close,day-temperature,focus-aware}/`, `apps/macos/README.md` and `apps/api/README.md` if their purpose line names a default | the lead, after G1 and G2 merge |

G1 and G2 are disjoint. Siblings touching the same files: `feat/day-email` (SettingsView, SettingsCopy, AppModel, OwnerModels, owner-account, owner-json, owner-sign-in, directory-owners, directory-seed, its tests, the day mail, migration 0008, `libs/types` constants: merged before this starts); `feat/siri-shortcuts` (`apps/macos/Todz/AppDelegate.swift`, `AppModel.swift`: G2 keeps its `AppDelegate.swift` edit to two lines and puts the rest in `AppDelegate+FocusSwitch.swift`; whichever merges second resolves); `feat/menu-bar-ribbon` (not started; it admits through the gate and needs nothing from here); `feat/version-compat` (queued after this one).

## Sequencing

1. The lead merges `origin/main` (with `feat/day-email`) into `feat/focus-switch-defaults`.
2. G1 and G2 run in parallel, each in its own worktree on a lane branch from that head. Neither pushes.
3. The lead merges G1 and G2 into the feature branch, then G3 runs (screenshots need the built app).
4. Z runs: tester, reviewer, security reviewer, `/open-pr`; after the merge, the deploy of G1.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 server

- [ ] **Step 1 (red):** `apps/api/test/owner-sign-in.test.ts`: "a new owner starts with the agent nudge and the day email on": sign in a new identity, then `GET /owner`; expected `agent_nudge: true`, `day_email: true`, `day_email_minutes: 420`. Red today with `expected false to be true`. Commit `test(focus-switch-defaults): a new owner starts with the nudges on`.
- [ ] **Step 2 (green):** `libs/types/src/constants.ts` gains `AGENT_NUDGE_BY_DEFAULT = true` and `DAY_EMAIL_BY_DEFAULT = true` (with `constants.test.ts` pins); `insertOwnerWithIdentity` names both columns from them; `identityOwner`'s new-owner record carries them.
- [ ] **Step 3 (red):** `apps/api/test/migration-0009.test.ts` over a test-only D1 binding `MIGRATION_DIRECTORY` (added to `vitest.config.mts` only) with migrations through 0008 applied: seed owner A (`agent_nudge 0`, `day_email 0`), owner B (`agent_nudge 1`, `day_email 1`); apply 0009; expected A `1/1` with both choice times null, B `1/1` with both choice times set; `day_email_stop_links` exists with its checks. Red with the test's own `no migration named 0009_setting_choices.sql`.
- [ ] **Step 4 (green):** `apps/api/migrations/0009_setting_choices.sql`: the two nullable columns, the stamp of rows already on, the backfill of rows with a null time, the stop link table and its two indexes.
- [ ] **Step 5 (red):** `apps/api/test/owner-setting-choices.test.ts`: `PATCH {agent_nudge: false}` stamps `agent_nudge_chosen_at` with the request's time; `PATCH {day_email: true}` on an owner already on still stamps; `PATCH {time_zone}` and a repeat sign-in stamp nothing; `PATCH {day_email_minutes}` alone stamps nothing. Red with `expected null not to be null`.
- [ ] **Step 6 (green):** `storeOwnerChanges` takes `now` and stamps the time of each flag it is given (`CASE WHEN ? IS NULL THEN <flag>_chosen_at ELSE ? END`); `updateOwner` passes `Date.now()` at the edge; sign-in passes `null` flags as today.
- [ ] **Step 7 (red):** `apps/api/test/day-email/day-mail.test.ts` and `day-email-run.test.ts`: a sent day mail carries `List-Unsubscribe: <https://…/day-email/stop?token=<64 hex>>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, the HTML and text footers carry the same URL, one `day_email_stop_links` row exists for the owner with `expires_at = sent + DAY_EMAIL_STOP_LINK_LIFETIME_MS`, and the token never appears in a log line. Red with `expected undefined to match …`.
- [ ] **Step 8 (green):** `DAY_EMAIL_STOP_LINK_LIFETIME_MS` in `libs/types`; the send path mints the secret, stores its digest, sets both headers and the `{{stopUrl}}` slot; `day-email-copy.ts` footer per design §3; regenerate the templates; the prune step deletes expired stop links; update `test/budgets/budget-limits.ts` for the one extra statement per mail and say so in the briefing.
- [ ] **Step 9 (red):** `apps/api/test/day-email/day-email-stop.test.ts` with a stub `dayEmailStopResponse` that throws `dayEmailStopResponse is not implemented`: `GET` with a live token answers 200 with the form and changes nothing; `POST` with a live token (body `List-Unsubscribe=One-Click`, and an empty body) answers 200, `day_email` 0, `day_email_chosen_at` set, the owner's reply addresses and stop links gone; a second `POST` with the same token answers 404; unknown, expired, 63-character and non-hex tokens answer 404 for `GET` and `POST` with nothing stored; `PUT` answers 405; a body over the bound answers 413; the security headers are on every answer; `PATCH {day_email: false}` deletes the owner's stop links; another owner's rows are untouched.
- [ ] **Step 10 (green):** `apps/api/src/day-email/day-email-stop.ts` (one handler per method from a record keyed by the method), its copy in `apps/api/src/day-email/day-email-stop-copy.ts`, the page through `escapedHtml` and `withSecurityHeaders`, the body bound through `isBoundedRequest`, routed on the API host; `storeOwnerChanges`' day-email-off path deletes stop links beside reply addresses.
- [ ] **Step 11:** `tools/repository-shape/src/api-source.test.ts` follows any new route or table list it pins; `docs/runbooks/deploy-the-api.md` names migration 0009 and the post-deploy checks of Z; `apps/api/README.md` if its purpose line names the defaults.
- [ ] **Step 12:** tester briefing section for G1 in `tester-briefing.md`.

### G2 app

- [ ] **Step 13 (red):** `ProactiveGateTests`: "with Respect Focus off a quiet filter shows", "with Respect Focus on a quiet filter holds", "turning Respect Focus off while held releases each held kind once", "turning Respect Focus on during a quiet filter holds from then on", "a perform() while off is remembered and applies when the switch turns on". Every existing test builds `ProactiveGate(respectsFocus: true)`. Stub `setRespectsFocus` with `fatalError("ProactiveGate.setRespectsFocus is not implemented")`.
- [ ] **Step 14 (green):** `ProactiveGate(respectsFocus:)`, `setRespectsFocus(_:)`, the filter's value kept apart from `isQuiet`, release on the quiet ending either way; `DayCloseCoordinatorTests` and `MorningGlanceCoordinatorTests` construct the gate with `respectsFocus: true`.
- [ ] **Step 15 (red):** `RespectFocusPreferenceTests`: the key is `respectsFocus`; a fresh domain reads off; a stored `true` reads on; registering the defaults registers off and never overwrites a choice; a value only in another searched domain is ignored. Stub `isOn` with `fatalError("RespectFocusPreference.isOn is not implemented")`.
- [ ] **Step 16 (green):** `apps/macos/TodzKit/Sources/TodzKit/RespectFocusPreference.swift`.
- [ ] **Step 17 (red):** `DayClosePreferenceTests`, `MorningGlancePreferenceTests`, `DayTemperaturePreferenceTests`: "a fresh domain reads on", "registering the defaults registers on", "a stored false stays off" (pin), "a non-Bool value reads as the default", "a false only in another searched domain is ignored". Red with `Expectation failed: (… .isOn) → false`.
- [ ] **Step 18 (green):** the three `isOnByDefault` become `true`; each `isOn` returns the stored Bool when present and `isOnByDefault` when not (`guard let`, no `??`). Coordinator tests that assumed an absent key meant off store an explicit `false`.
- [ ] **Step 19 (red):** `FocusSwitchCoordinatorTests` with an injected `readFilter` and `pause`: with the switch off at start, `readFilter` is never called and the gate is open at once; on at start, it is called once and its answer reaches the gate; a read that outlasts the timeout makes the gate quiet; turning the switch on calls it once; turning it off calls nothing and opens the gate; a `perform()` before the read wins. Stub `start` with `fatalError("FocusSwitchCoordinator.start is not implemented")`.
- [ ] **Step 20 (green):** `apps/macos/TodzKit/Sources/TodzKit/FocusSwitchCoordinator.swift` takes over `readFocusFilter`'s timeout logic; `apps/macos/Todz/AppDelegate+FocusSwitch.swift` builds it with `TodzFocusFilter.current` and observes `UserDefaults.didChangeNotification`; `AppDelegate.swift` builds the gate from `RespectFocusPreference` and awaits the coordinator instead of `readFocusFilter()`; `TodzApp` registers `RespectFocusPreference`'s defaults.
- [ ] **Step 21 (red):** `tools/repository-shape/src/settings-focus-copy.test.ts`: in `apps/macos/Copy/SettingsCopy.swift`, "Focus" appears only in the `respectFocus*`, `openFocusSettings` and `focusQuietNow` values (read with `swiftCopyValue`); `dayTemperatureDetail` is "Dims the menu bar count through the afternoon and tints overdue widget rows.". Red on `dayTemperatureDetail` and `focusQuiet`.
- [ ] **Step 22 (green):** `SettingsCopy` and `SettingsView` per design §1–2: the Respect Focus switch last in the first section, the helper row only while on, the detail per `FocusQuietNotice` only while on; `TodzFocusFilter`'s description per design §2; the Settings height test follows the extra row.
- [ ] **Step 23:** tester briefing section for G2 in `tester-briefing.md`, with the computer-use walk steps.

### G3 docs

- [ ] **Step 24:** `docs/product/README.md`: the proactive line says the nudges are on by default and one Respect Focus switch, off by default, quiets the app's own surfaces in a Focus that holds the filter (ADR 0068).
- [ ] **Step 25:** the recorder's Settings shots (light and dark, defaults; Respect Focus on with the helper line) into `docs/screenshots/focus-switch-defaults/`; the README walk's four Settings shots replaced, not added to (ADR 0047), the "Quiet during Focus" caption gone; the old Settings shots no README links deleted.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a new owner's row omits a flag and takes the schema's `DEFAULT 0` | step 1 stays red | revert step 2 |
| 4 | the backfill turns on a flag the owner chose off after 0009 | step 3's owner B and step 5 fail; production `SELECT count(*) FROM owners WHERE agent_nudge = 0 AND agent_nudge_chosen_at IS NULL` is not 0 right after the migration | `UPDATE owners SET agent_nudge = 0 WHERE agent_nudge_chosen_at IS NULL` and `UPDATE owners SET day_email = 0 WHERE day_email_chosen_at IS NULL` restore the old defaults exactly (untouched rows were 0) |
| 4 | the migration fails on production D1 | `wrangler d1 migrations apply` exits non-zero; the Worker is not deployed | nothing applied (D1 runs a migration in one transaction); fix and re-run |
| 6 | a sign-in stamps a choice time | step 5's sign-in case fails | revert step 6 |
| 8 | a mail without a stop link, or a token in a log | step 7 fails; Workers Logs show `token=` | revert step 8; the mail keeps its footer |
| 10 | a link scanner turns the mail off with a `GET` | step 9's `GET` case fails | revert step 10; links in sent mails answer 404 |
| 10 | an owner's stop link turns off another owner's mail | step 9's isolation case fails | revert step 10 |
| 14 | the gate stays quiet with the switch off, or never releases | step 13 fails; a day close missing at 18:00 with no Focus | revert steps 13–14 |
| 18 | an owner's explicit off reads on | step 17's pin fails | revert step 18 |
| 20 | the launch waits 3 s or quiets todz with the switch off | step 19 fails; the morning glance late on wake | revert step 20; `readFocusFilter` comes back |
| 22 | the helper row shows while off, or Focus copy remains | step 21 fails; the walk's screenshot | revert step 22 |
| Z deploy | the Worker fails on the new route | `/health` not 200 after deploy; Workers Logs 5xx | `wrangler rollback` to the previous version; the columns and the table stay unused |

**Steps with no backout:** none loses data. The backfill's inverse is exact for rows still untouched; a stop link an owner used is that owner's own choice and stays.

## Z. Prove and ship

- [ ] **Tester briefing:** both developers wrote their sections of `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** verdict on the stop link route, the token's handling and the backfill.
- [ ] **/check-ui:** Settings screenshots and a short video through computer use (the owner's popover is not walked in loops), and the stop page through Playwright MCP.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
- [ ] **Deploy (after the merge):** `docs/runbooks/deploy-the-api.md`: migration 0009 on production, then the Worker; checks: the owner's `GET /owner` answers the effective flags; `SELECT count(*) FROM owners WHERE agent_nudge_chosen_at IS NULL AND agent_nudge = 0` is 0; the next day mail of the `todz-perf` account carries `List-Unsubscribe`; its stop link's `GET` shows the button and its `POST` turns that account's mail off; `/health` 200.
