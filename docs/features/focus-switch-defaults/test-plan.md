# Test plan: One Focus switch and new defaults

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing tests first

Each red is its own commit before its green; the failure text is the one the red run printed, copied from the briefing.

- [ ] `apps/api/test/owner-sign-in.test.ts` › a new owner starts with the agent nudge and the day email on — input: a new identity signs in, then `GET /owner`; expected: `agent_nudge: true`, `day_email: true`, `day_email_minutes: 420`. Red: `expected false to be true`.
- [ ] `apps/api/test/migration-0009.test.ts` › migration 0009 stamps chosen flags and backfills untouched ones — input: owners seeded at `0/0` and `1/1` under migrations through 0008, then 0009; expected: both `1/1`, the first with null choice times, the second stamped. Red: `no migration named 0009_setting_choices.sql`.
- [ ] `apps/api/test/owner-setting-choices.test.ts` › a PATCH that names a flag stamps its choice time — input: `PATCH {agent_nudge: false}`; expected: `agent_nudge_chosen_at` equals the request time. Red: `expected null not to be null`.
- [ ] `apps/api/test/day-email/day-mail.test.ts` › the day mail carries a one-click stop link — input: one due owner, one cron tick; expected: both `List-Unsubscribe` headers. Red: `expected undefined to match …`.
- [ ] `apps/api/test/day-email/day-email-stop.test.ts` › the stop link — input: any case below; Red: `dayEmailStopResponse is not implemented`.
- [ ] `ProactiveGateTests` › with Respect Focus off a quiet filter shows — Red: `ProactiveGate.setRespectsFocus is not implemented`.
- [ ] `RespectFocusPreferenceTests` › a fresh domain reads off — Red: `RespectFocusPreference.isOn is not implemented`.
- [ ] `DayClosePreferenceTests`, `MorningGlancePreferenceTests`, `DayTemperaturePreferenceTests` › a fresh domain reads on — Red: `Expectation failed: (… .isOn) → false` in each.
- [ ] `FocusSwitchCoordinatorTests` › with the switch off the filter is never read — Red: `FocusSwitchCoordinator.start is not implemented`.
- [ ] `tools/repository-shape/src/settings-focus-copy.test.ts` › only the Respect Focus row mentions Focus — Red: the assertion on `dayTemperatureDetail` naming "Quiet in a Focus.".
- [ ] Confirmed each red fails for the right reason: the reviewer checks out three red commits in a throwaway worktree and compares the printed failure with the text above.

## Unit — the gate (TodzKit)

- [ ] Switch off, filter quiet (`setQuiet(true)`) — input: `admit(.dayClose)`; expected: `.show`, `isQuiet == false`.
- [ ] Switch on, filter quiet — input: `admit(.dayClose)`; expected: `.held`, `isQuiet == true`.
- [ ] Switch on, filter not quiet — input: `admit(.morningGlance)`; expected: `.show`.
- [ ] Held `.dayClose` and `.morningGlance`, then `setRespectsFocus(false)` — expected: `released == [.dayClose, .morningGlance]`, each claimed once, a second claim `false`.
- [ ] Switch off, filter quiet, then `setRespectsFocus(true)` — expected: `isQuiet == true` at once and the next `admit` holds.
- [ ] Switch off, then `setRespectsFocus(false)` again — expected: nothing released, `isQuiet == false`.
- [ ] Switch off, a `perform()` sets quiet, then `applyLaunchRead(isQuiet: false)` after turning on — expected: still quiet (a `perform()` that came first wins, ADR 0054 §3).
- [ ] Every existing `ProactiveGateTests` case with `respectsFocus: true` — expected: unchanged outcomes.

## Unit — preferences (TodzKit)

- [ ] `RespectFocusPreference` key — expected: `"respectsFocus"`.
- [ ] `RespectFocusPreference`, fresh domain — expected: `isOn == false`.
- [ ] `RespectFocusPreference`, stored `true` — expected: `isOn == true`.
- [ ] `RespectFocusPreference.registerDefaults` on a fresh domain — expected: `object(forKey: "respectsFocus") as? Bool == false`; with a stored `true` first, it stays `true`.
- [ ] `RespectFocusPreference`, `true` only in another searched domain — expected: `isOn == false`.
- [ ] `DayClosePreference`, fresh domain — expected: `isOn == true`, `minutesAfterMidnight == 1080`.
- [ ] `DayClosePreference`, stored `false` (chosen off) — expected: `isOn == false`.
- [ ] `DayClosePreference`, stored `"yes"` (not a Bool) — expected: `isOn == true`.
- [ ] `DayClosePreference`, `false` only in another searched domain — expected: `isOn == true`.
- [ ] `MorningGlancePreference`, fresh domain — expected: `isOn == true`; stored `false` — `false`; stored `"yes"` — `true`; `false` only in another searched domain — `true`.
- [ ] `DayTemperaturePreference`, fresh domain — expected: `isOn == true`; stored `false` — `false`; stored `"yes"` — `true`; `false` only in another searched domain — `true`.
- [ ] Each of the three `registerDefaults` on a fresh domain — expected: the registered value is `true`; with a stored `false` first, it stays `false`.
- [ ] `MenuBarBadge.isEnabledByDefault` — expected: `true` (pin).

## Unit — the launch read (TodzKit)

- [ ] `FocusSwitchCoordinator`, switch off at start — expected: `readFilter` called 0 times; `start()` returns without awaiting the pause; gate open.
- [ ] Switch on at start, `readFilter` answers `true` — expected: called once; gate quiet.
- [ ] Switch on at start, `readFilter` never answers within the timeout — expected: gate quiet after the injected pause; a later answer `false` changes nothing (launch read already applied).
- [ ] Switch turned on after start — expected: `readFilter` called once more; its answer reaches the gate.
- [ ] Switch turned off — expected: no read; gate open; held surfaces released once.
- [ ] Switch flipped on, off, on quickly — expected: at most one read in flight; the gate ends matching the last state and the filter's answer.

## Unit — server (Workers)

- [ ] New owner by sign-in — expected: row `agent_nudge = 1`, `day_email = 1`, `day_email_minutes = 420`, both choice times null.
- [ ] Known owner signs in again with a new time zone — expected: time zone updated, flags and choice times unchanged.
- [ ] `PATCH {agent_nudge: false}` — expected: 200, `agent_nudge: false` in the answer, `agent_nudge_chosen_at` = request time, `day_email_chosen_at` still null.
- [ ] `PATCH {day_email: true}` on an owner already on — expected: 200, `day_email_chosen_at` set.
- [ ] `PATCH {day_email_minutes: 480}` alone — expected: no choice time set.
- [ ] `PATCH {time_zone: "America/Sao_Paulo"}` alone — expected: no choice time set.
- [ ] `PATCH {agent_nudge: "yes"}` — expected: 400 `invalid_request`, nothing stored, no choice time.
- [ ] Migration 0009, owner at `0/0` — expected: `1/1`, both times null.
- [ ] Migration 0009, owner at `1/0` — expected: `1/1`, `agent_nudge_chosen_at` set, `day_email_chosen_at` null.
- [ ] Migration 0009, owner at `1/1` — expected: `1/1`, both stamped.
- [ ] Migration 0009, `day_email_stop_links` with a 63-character digest — expected: the insert fails its check.
- [ ] Owner JSON shape — expected: exactly `id`, `time_zone`, `agent_nudge`, `day_email`, `day_email_minutes` (no choice time exposed).
- [ ] The agent nudge for an untouched owner after migration — input: MCP `next` with due tasks; expected: the nudge line.

## Unit — the stop link (Workers)

- [ ] Day mail sent — expected: `List-Unsubscribe: <https://api.todz.app/day-email/stop?token=<64 hex>>` (the request origin locally), `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, the same URL in the HTML footer link and the text footer, one stop link row for the owner expiring 30 days after the send.
- [ ] Two owners' mails in one tick — expected: two distinct tokens, each row naming its own owner.
- [ ] `GET` with a live token — expected: 200 page with heading "Stop your day email?" and a `POST` form to the same URL; `day_email` unchanged; the row kept.
- [ ] `POST` with a live token and body `List-Unsubscribe=One-Click` — expected: 200 page "Your day email is off"; `day_email = 0`; `day_email_chosen_at` set; the owner's reply addresses and stop links deleted.
- [ ] `POST` with a live token and an empty body — expected: as above.
- [ ] `POST` again with the same token — expected: 404 page "This link no longer works", nothing stored.
- [ ] `GET` and `POST` with an unknown 64-hex token — expected: 404, nothing stored.
- [ ] `GET` and `POST` with an expired token (one millisecond past `expires_at`) — expected: 404, nothing stored.
- [ ] `GET` with a token exactly at `expires_at` minus one millisecond — expected: 200.
- [ ] Token of 63 characters, of 65, non-hex, missing, repeated `token` parameters — expected: 404, no D1 read beyond none for the malformed ones.
- [ ] `PUT`, `DELETE` on the stop path — expected: 405.
- [ ] `POST` with a body over the request bound — expected: 413, nothing stored.
- [ ] Owner A's token used — expected: owner B's `day_email`, reply addresses and stop links untouched.
- [ ] `PATCH {day_email: false}` — expected: the owner's stop links deleted, as reply addresses are.
- [ ] The prune step — expected: expired stop links deleted, live ones kept.
- [ ] Every stop page answer — expected: the security headers of `withSecurityHeaders`, `Cache-Control: no-store`, one `h1`.
- [ ] Workers log lines during a send and a stop — expected: no `token=` and no token value.
- [ ] The work budget for a day mail tick — expected: within the updated limit in `budget-limits.ts`.

## Repository shape

- [ ] `settings-focus-copy.test.ts` — expected: "Focus" appears only in `respectFocus`, `respectFocusDetail`, `respectFocusHelper`, `openFocusSettings`, `focusQuietNow`; `dayTemperatureDetail` equals "Dims the menu bar count through the afternoon and tints overdue widget rows.".
- [ ] The Focus filter stays discoverable (ADR 0057 pin) — expected: green, unchanged.
- [ ] Feature status, ADR index and README links — expected: green in `pnpm verify`.

## Prove it for real — the app through computer use

Short openings only; the popover is not walked in loops.

- [ ] Fresh preferences (the app's defaults domain removed, Debug build): open Settings — expected: Show pending count, Let agents mention (signed in), Close the day 18:00, Morning glance, Day temperature and Email me my day 07:00 all on; Respect Focus off; no "Open Focus Settings"; no row mentions Focus except Respect Focus. Screenshot light and dark.
- [ ] Turn Respect Focus on — expected: the helper line "Add the todz filter to a Focus." with "Open Focus Settings" appears under it; the button opens System Settings → Focus.
- [ ] Turn it off — expected: the helper line disappears; the window shrinks by one row.
- [ ] A Mac with `showsDayTemperature = false` written before the update — expected: Day temperature off after launch; the others on.
- [ ] Respect Focus off, a Focus with the todz filter (Keep todz quiet on) active, Day temperature on, after noon with tasks in Today — expected: the menu bar count dims per step; the detail never reads "Quiet now".
- [ ] Respect Focus on in that Focus — expected: the count returns to full opacity; the detail reads "Quiet now, until this Focus ends.".
- [ ] Respect Focus off at launch with that Focus active — expected: the app reaches the menu bar without a 3 s wait and nothing is held (the morning glance on the next unlock shows).
- [ ] Day temperature's row — expected: detail "Dims the menu bar count through the afternoon and tints overdue widget rows." with no Focus sentence.
- [ ] VoiceOver on the Respect Focus row — expected: "Respect Focus, switch, off" then the detail; Tab reaches "Open Focus Settings" only while on.

## Prove it for real — the stop link through Playwright MCP

- [ ] Local stack, a seeded owner, the scheduled test endpoint sends a day mail to the console sender — expected: the logged text footer ends with "Stop these emails: <url>".
- [ ] Open the URL at 1280 — expected: the page "Stop your day email?" with one "Stop my day email" button; console and network clean.
- [ ] Reload the page — expected: the same page; `day_email` still on (`GET /owner`).
- [ ] Click the button — expected: "Your day email is off"; `GET /owner` answers `day_email: false`.
- [ ] Browser Back, then click again — expected: "This link no longer works".
- [ ] The same URL at 375 — expected: no horizontal scroll, the button fully visible.
- [ ] `curl -X POST -d 'List-Unsubscribe=One-Click'` with a fresh token — expected: 200 and the flag off (what Gmail's one-click sends).
- [ ] Screenshots at `.pr-media/focus-switch-defaults/`.

## Production (after deploy)

- [ ] `wrangler d1 migrations list` — expected: 0009 applied.
- [ ] `SELECT count(*) FROM owners WHERE agent_nudge = 0 AND agent_nudge_chosen_at IS NULL` and the same for `day_email` — expected: 0 and 0.
- [ ] `/health` — expected: 200.
- [ ] The `todz-perf` account's next day mail — expected: both headers; its link's `GET` shows the button; its `POST` turns that account's mail off.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: an explicit off on a Mac survives the update — attack: <how>; result: <refuted | held>
- [ ] Claim 2: with Respect Focus off no surface is held, at launch or later — attack: <how>; result: <refuted | held>
- [ ] Claim 3: a link scanner cannot turn the mail off, and a token works for its owner only — attack: <how>; result: <refuted | held>

## Coverage honesty

- An off chosen on the server before migration 0009 turns on; it cannot be told from the old default (ADR 0068, Consequences). Accepted: both settings shipped the same day.
- The Focus filter's real `perform()` is walked by hand once; the gate's handling of it is unit-tested with a fake.
- Gmail's and Apple Mail's own one-click buttons are not driven; the `curl` POST reproduces the RFC 8058 request they send.
- The Settings window is checked through computer use, not a test, as for every Settings row so far.
