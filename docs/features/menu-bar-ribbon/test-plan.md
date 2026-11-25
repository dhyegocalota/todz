# Test plan: Menu bar ribbon

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

The surface is native macOS: there is no browser surface, so there is no Playwright E2E spec and no Playwright MCP walk. The user-facing walk runs with Orca (`orca computer …`), `screencapture -l <window>` and Accessibility Inspector. **The walk disturbs the owner's screen, so it stays short:** the popover is opened at most twice (two lines below say which), the Settings window once, at most three live ribbons, each at most 9.5 s; no appearance, Focus, Reduce Motion or Increase Contrast setting is changed on the owner's Mac. Everything those settings would show is proven by scratch renders of the shipped `MenuBarRibbonImage` and by the unit tests. The day temperature's walk found the todz item hidden under the notch on the owner's bar; when it is, the live lines are read from the item's window by number and say so.

## The failing test first

- [ ] `RibbonPreferenceTests` (step 1) — input: a fresh domain; expected: red on `RibbonPreference.isOn is not implemented`, not a compile error
- [ ] `RibbonContentTests` (step 3) — input: three open tasks; expected: red on `RibbonContent.of is not implemented`
- [ ] `RibbonScheduleTests` (step 5) — input: hourly after 10:20:05; expected: red on `RibbonSchedule.nextShowing is not implemented`
- [ ] `RibbonMotionTests` (step 7) — input: `textWidth: 150`; expected: red on `RibbonMotion.timeline is not implemented`
- [ ] `RibbonTriggerTests` (step 9) — input: an agent task due today; expected: red on `RibbonTrigger.isAgentChange is not implemented`
- [ ] `AppModelTests+Ribbon` (step 11) — input: a second pull with one agent task due today; expected: red on the expectation `agentChangeCount` 0 against 1, as printed
- [ ] `RibbonCoordinatorTests` (step 13) — input: hourly at 10:20, `refresh()`; expected: red on `RibbonCoordinator.refresh is not implemented`
- [ ] Confirmed each red commit precedes its green commit in `git log`, and each failure text above is the one the run printed (recorded in `tester-briefing.md`); three of them re-run in a throwaway worktree on the red hash

## Unit (TodzKit)

### Preference

- [ ] `RibbonPreferenceTests` — input: a fresh domain, `registerDefaults`; expected: `isOn == false`, `cadence == .hourly`
- [ ] `RibbonPreferenceTests` — input: the keys; expected: `"showsMenuBarRibbon"` and `"menuBarRibbonCadence"`
- [ ] `RibbonPreferenceTests` — input: `isOn` set true, cadence `agentChange`, read through a new preference on the same domain name; expected: `true`, `.agentChange`
- [ ] Edge: an unknown stored cadence — input: `"weekly"`; expected: `cadence == nil` and `pickerCadence(stored: "weekly") == .hourly`
- [ ] Edge: a stored cadence of the wrong type — input: the integer `3`; expected: `cadence == nil`
- [ ] `RibbonPreferenceTests` — input: `DayClosePreference.isOn` from the test target without `@testable`; expected: compiles and reads the stored value

### The line

- [ ] `RibbonContentTests` — input: `of(open: nil)`; expected: nil
- [ ] `RibbonContentTests` — input: `of(open: [])`; expected: nil
- [ ] `RibbonContentTests` — input: three open tasks, the first T-12 "Review PR"; expected: `.remaining(left: 3, next: RibbonTask(number: 12, title: "Review PR"))`
- [ ] `RibbonContentTests` — input: one open task T-7 "Ship it"; expected: `.last(RibbonTask(number: 7, title: "Ship it"))`
- [ ] Edge: the first task is pending — input: a first task with no number, "Draft notes"; expected: `RibbonTask(number: nil, title: "Draft notes")`
- [ ] Edge: order, not number — input: open tasks T-30 then T-2; expected: next is T-30
- [ ] Edge: 120 open — input: 120 open tasks; expected: `.remaining(left: 120, …)` (the line is words; no 99+ cap)
- [ ] `AppModelTests+Ribbon` — input: signed out; expected: `ribbonContent == nil`; input: two open tasks today; expected: `.remaining(left: 2, …)`

### The schedule

- [ ] `RibbonScheduleTests` — input: hourly after 2026-11-25 10:20:05 `America/Sao_Paulo`; expected: 11:00:00 the same day
- [ ] Edge: exactly on the hour — input: after 11:00:00; expected: 12:00:00
- [ ] Edge: across midnight — input: after 23:30; expected: 00:00 of 2026-11-26
- [ ] Edge: spring forward — input: `America/New_York`, after 2026-03-08 01:30; expected: 03:00 that day, never nil
- [ ] Edge: fall back — input: `America/New_York`, after 2026-11-01 01:30 (first pass); expected: a strictly later instant, and calling it again on that answer gives a strictly later instant again (no repeat)
- [ ] Edge: a half-hour zone — input: the same instant in `Asia/Kolkata` and `America/Sao_Paulo`; expected: each zone's own next local hour, as instants
- [ ] `RibbonScheduleTests` — input: `.dayClose`, 18:00, after 17:59; expected: 18:00 the same day
- [ ] Edge: exactly at the close — input: `.dayClose`, 18:00, after 18:00:00; expected: 18:00 the next day
- [ ] Edge: no close time — input: `.dayClose`, `closeMinutesAfterMidnight: nil`; expected: nil
- [ ] `RibbonScheduleTests` — input: `.agentChange`; expected: nil

### The timeline

- [ ] `RibbonMotionTests` — input: `textWidth: 150`, motion on; expected: 8 unfold frames, `reveal` 0.125 to 1, 0.25 s together; one 5 s hold at 1; 8 fold frames down to 0; every `offset` 0
- [ ] `RibbonMotionTests` — input: `textWidth: 280`; expected: unfold, a 1.5 s hold at `offset` 0, scroll frames of 1/30 s stepping 40/30 points, the last at `offset` exactly 100, a 1.5 s hold, fold
- [ ] Edge: the strip cap — input: `textWidth: 900`; expected: the last `offset` is 240
- [ ] Edge: exactly the window — input: `textWidth: 180`; expected: no scroll frame, the 5 s hold
- [ ] Edge: one point over — input: `textWidth: 181`; expected: a scroll whose last `offset` is 1
- [ ] Edge: the bound — input: every width from 0 to 2000 in steps of 1; expected: the sum of durations at most 9.5 s and at most 285 frames for each
- [ ] Edge: Reduce Motion — input: `isMotionReduced: true` with 150, 280 and 900; expected: exactly one frame `reveal 1, offset 0, 5 s` for each
- [ ] Edge: zero and negative width — input: 0 and -10; expected: the fitting timeline, no scroll, no negative offset
- [ ] Edge: no empty frame — input: every timeline above; expected: no frame with a zero or negative duration

### The agent trigger

- [ ] `RibbonTriggerTests` — input: no previous, created by `.agent(clientName: "claude-code")`, open, due today; expected: true
- [ ] `RibbonTriggerTests` — input: the same, created by `.owner`; expected: false
- [ ] Edge: no due date — input: agent-created, open, no due date; expected: false
- [ ] Edge: due tomorrow — input: agent-created, open, due tomorrow; expected: false
- [ ] Edge: overdue — input: agent-created, open, due yesterday; expected: true
- [ ] Edge: created done — input: agent-created, arriving done; expected: false
- [ ] `RibbonTriggerTests` — input: previous open due today, arriving done; expected: true
- [ ] Edge: completion outside Today — input: previous open due tomorrow, arriving done; expected: false
- [ ] Edge: already done — input: previous done, arriving done; expected: false
- [ ] Edge: an edit — input: previous open due today, arriving open with a new title; expected: false
- [ ] Edge: moved out of Today — input: previous open due today, arriving open due tomorrow; expected: false

### The model

- [ ] `AppModelTests+Ribbon` — input: a second pull with one agent task due today; expected: `agentChangeCount` 0 → 1
- [ ] Edge: a burst in one pull — input: a second pull with two such tasks; expected: +1
- [ ] Edge: the first pull — input: the first pull of a project, with an agent task due today; expected: 0
- [ ] Edge: a pull from the start — input: `isFromStart` with an agent task due today; expected: 0
- [ ] Edge: the owner's task — input: a second pull with an owner-created task due today; expected: 0
- [ ] `AppModelTests+Ribbon` — input: a second pull where a Today task arrives done; expected: +1
- [ ] Edge: the app's own completion — input: the owner completes a Today task in the app, then the pull that confirms it; expected: 0
- [ ] Edge: a workspace switch — input: a pull of the previous workspace's project landing after the switch; expected: 0

### The coordinator

- [ ] `RibbonCoordinatorTests` — input: switch off, `refresh()`; expected: no wait, `presentation` nil
- [ ] `RibbonCoordinatorTests` — input: hourly at 10:20, `refresh()`; expected: one wait until 11:00
- [ ] `RibbonCoordinatorTests` — input: the wait released at 11:00 with three open; expected: `presentation` takes each frame of the timeline in order with `content` `.remaining(left: 3, …)`, ends nil, then one wait until 12:00
- [ ] Edge: zero — input: released at 11:00 with none open; expected: no presentation; one wait until 12:00
- [ ] Edge: unknown count — input: released with `content` nil; expected: no presentation; the next wait armed
- [ ] Edge: popover — input: released while the popover is visible; expected: skipped; after a later quiet period ends, `gate.released` does not contain `.ribbon`
- [ ] Edge: locked — input: released while the screen is locked; expected: skipped, not held
- [ ] Edge: overlap — input: a second boundary while a ribbon is showing; expected: dropped; the first runs to its end
- [ ] Edge: quiet at the boundary — input: the gate quiet at 11:00; expected: held, `presentation` nil
- [ ] Edge: release — input: the quiet ends after the hold, with two open by then; expected: `claimRelease(.ribbon)` taken once; one ribbon with `.remaining(left: 2, …)`; a second quiet end adds nothing
- [ ] Edge: quiet mid-ribbon — input: the gate turns quiet during the hold; expected: `presentation` nil at once; no later frame lands
- [ ] Edge: `end()` — input: `end()` during the scroll; expected: nil at once
- [ ] Edge: switched off mid-ribbon — input: the switch off, then `refresh()`; expected: nil at once; no wait armed
- [ ] `RibbonCoordinatorTests` — input: `.dayClose`, Close the day off, released at 18:00; expected: one ribbon; next wait 18:00 tomorrow
- [ ] Edge: Close the day on — input: `.dayClose`, Close the day on, released at 18:00; expected: no ribbon
- [ ] `RibbonCoordinatorTests` — input: `.agentChange`, `agentChanged()`; expected: a 3 s settle, then one ribbon
- [ ] Edge: a burst — input: `agentChanged()` twice 1 s apart; expected: one ribbon, 3 s after the second
- [ ] Edge: inside the cooldown — input: `agentChanged()` 5 minutes after a shown agent ribbon; expected: dropped
- [ ] Edge: after the cooldown — input: `agentChanged()` 10 minutes after; expected: one ribbon
- [ ] Edge: wrong cadence — input: `agentChanged()` with cadence hourly; expected: nothing
- [ ] Edge: unknown cadence — input: stored `"weekly"`, `refresh()`; expected: no wait, no ribbon
- [ ] Edge: `refresh()` twice — input: two calls; expected: one pending wait
- [ ] Edge: Reduce Motion — input: `isMotionReduced` true at the boundary; expected: one frame of 5 s, then nil
- [ ] Edge: measured once — input: one ribbon with a scroll; expected: `textWidth` asked once

## Build

- [ ] `pnpm verify` — input: the branch; expected: green; the TodzKit test count recorded
- [x] `xcodebuild` of the `Todz` scheme — input: the branch after step 18; expected: BUILD SUCCEEDED, no new warning in the touched files — evidence: 8e85d684, BUILD SUCCEEDED, 0 warnings in the log

## Renders (scratch render of the shipped `MenuBarRibbonImage`, not committed code)

- [ ] Rest — input: three open, no ribbon; expected: identical pixels to `MenuBarCountImage` at plain for "3"
- [x] Mid-unfold, light bar — input: frame 4 of 8; expected: the glyph's columns identical to rest; the visible text half the window at half alpha — evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-frames-short-light-dark.png (half text at half alpha, glyph unchanged by eye; pixel diff not run)
- [x] Hold, light and dark bars — input: "3 left · next: T-12 Review PR"; expected: the full line, glyph unchanged, the image is a template (`isTemplate`), alpha 1 on the text — evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-short-remaining.png and ribbon-frames-short-light-dark.png (frame 8: full line, glyph fixed, template true)
- [x] Mid-scroll (evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-frames-long-light-dark.png, offsets 81 and 161, glyph fixed) — input: the 420-point strip at `offset` 120; expected: the window shows the strip from 120 points; the glyph does not scroll
- [x] End hold (evidence: 8e85d684, ribbon-frames-long-light-dark.png, offset 240, strip end with ellipsis) — input: `offset` 240; expected: the strip's end with its ellipsis in the window
- [x] Last one (evidence: 8e85d684, ribbon-frames-short-light-dark.png, "Last one: T-7 Ship it") — input: one open; expected: "Last one: T-7 Ship it"
- [x] Pending (evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-pending.png) — input: the first task unsaved; expected: "3 left · next: Draft notes"
- [x] Reduce Motion (evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-reduce-motion.png, "Review th…" and "WW…", one frame of 5 s) — input: the 420-point strip, one frame; expected: tail-truncated to 180 points with an ellipsis
- [ ] Day temperature on, evening — input: the count at 0.65; expected: at rest the count is at 0.65; at hold the ribbon text is at 1.0
- [ ] Width — input: the image size at rest, at hold and back at rest; expected: back at rest equals rest exactly; hold is at most the glyph plus 8 plus 180 points
- [x] Emoji (evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-emoji.png, rocket silhouette, no crash) — input: a title "🚀 Launch"; expected: drawn as a silhouette in the template, no crash, the line still reads
- [x] Right-to-left (evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-hebrew.png, no crash, window shows the start; the mixed-direction line shows "Last one: T-5 ..." then Hebrew, and the Hebrew run scrolls) — input: a Hebrew title of 300 points; expected: the strip renders, the window shows its start, no crash; the look recorded
- [x] A 200-character title (evidence: 8e85d684, .pr-media/menu-bar-ribbon/ribbon-huge-200-chars.png, strip 420, last offset 240, 198 frames, 9.5 s) — input: `TaskLimits.titleMaxLength` characters; expected: the strip stops at 420 points with an ellipsis; the scroll ends at 240
- [ ] Screenshots at `docs/screenshots/menu-bar-ribbon/` for the README and the PR

## Walk (Orca and `screencapture`, native)

Popover openings: two (lines marked **popover**). Settings window: one opening for the first three lines. Live ribbons: three at most.

- [x] Settings, off by default (offscreen row, not the live window; evidence: 8e85d684, .pr-media/menu-bar-ribbon/settings-off-light.png: off, picker greyed on Every hour, detail on two lines) — input: a fresh defaults domain, Settings opened; expected: "Menu bar ribbon" off, the picker disabled on "Every hour", the detail line of `design.md` §4
- [ ] Settings, on — input: the switch on; expected: the picker enabled; `defaults read` shows `showsMenuBarRibbon = 1`
- [x] Settings, overlap (offscreen row; evidence: 8e85d684, .pr-media/menu-bar-ribbon/settings-overlap-light.png: detail text correct, but at 420 pt the picker and switch drop below the label, see edge cases) — input: cadence "At the close of the day" with Close the day on; expected: the detail reads "Close the day already opens todz at that time."; then the cadence back to "Every hour"; Settings closed
- [ ] BLOCKED (needs a bar with room; the owner's item sits under the notch, live ribbons not run) Live hourly ribbon — input: the switch on, three open, the clock at the next hour (the walk waits for a real hour boundary, never changes the clock); expected: within 1 s of the hour the item unfolds, the line reads as rendered, it folds back within 9.5 s; captures of the item window by number every 0.5 s
- [ ] BLOCKED (needs a bar with room) Live agent ribbon — input: cadence "When an agent adds or completes a task", a task due today added through the MCP server with a test key on the local stack; expected: one ribbon about 3 s after the pull lands, the line counts the new task; a second task added 1 minute later shows no ribbon
- [ ] BLOCKED (popover not opened while the owner works) Live **popover** cut — input: a click on the item during a live ribbon; expected: the ribbon ends at once, the popover's arrow points at the glyph of the item at rest; the popover closed with Escape
- [ ] BLOCKED (popover not opened while the owner works) **popover** skip — input: the popover open at an hour boundary; expected: no ribbon; after closing, no ribbon arrives late
- [ ] BLOCKED (needs a live ribbon) VoiceOver label — input: Accessibility Inspector on the item during a live ribbon, then at rest; expected: "todz, 3 left today. Next: T-12 Review PR", then ADR 0036's label
- [ ] BLOCKED (needs a bar with room) Neighbour — input: the frame of the status item to the left of todz before, during and after a live ribbon; expected: it moves left by the ribbon's width and returns to the same origin
- [ ] BLOCKED (needs a live ribbon) Notch — input: the todz item hidden under the notch on the owner's bar; expected: the item's window still receives the frames (captured by number); recorded as the known limitation, not a failure
- [ ] Screen locked — input: the screen locked across an hour boundary (only if the owner locks it himself during the walk window; never locked by the walk); expected: no ribbon on unlock for that hour
- [ ] Focus — not run live (no Focus is started on the owner's Mac); the gate's hold, release and quiet-mid-ribbon are proven by the coordinator tests

## Edge cases found during execution

- [ ] Settings row wraps at 420 pt — input: the Settings row rendered offscreen at 420 pt with the cadence "At the close of the day" or "When an agent adds or completes a task"; expected: the picker and switch stay beside the label like "Every hour" (row height 105 pt); observed: they drop below the label and the row grows to 131 to 132 pt (.pr-media/menu-bar-ribbon/settings-overlap-light.png, settings-on-dark.png); replica of the shipped row in a plain 420 pt form, so the live window's width decides. FAIL candidate, owner to confirm at the real window width.
- [x] The longest ribbon stays within 9.5 s — input: the 420-point and 200-character lines; observed: 198 frames, 9.4999999999 s, every frame 206 pt wide including reveal 0 (the item resizes once) — evidence: 8e85d684, render log

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: the app's own completion never shows an agent ribbon — attack: complete a Today task in the app while offline, come back online, let the outbox send and the pull land; result: <refuted | held>
- [ ] Claim 2: a held ribbon shows exactly once after the gate releases it, and never while the popover is open — attack: quiet, two boundaries, open the popover, end the quiet; result: <refuted | held>
- [ ] Claim 3: the longest ribbon lasts at most 9.5 s and the item returns to its exact width — attack: a 200-character title, a 99+ count, Reduce Motion toggled mid-ribbon; result: <refuted | held>

## Coverage honesty

- A real Focus, Reduce Motion and Increase Contrast are not toggled on the owner's Mac; the gate and the timeline are proven by unit tests and the look by renders.
- The light bar is a render, not the live bar, because switching appearance repaints the owner's screen.
- A completion from the owner's other Mac counts as an agent change; not tested, accepted by ADR 0071.
- The crowded-bar hide is macOS's; it is observed, not prevented.
- `MenuBarLabel`'s branch has no unit test (the app target has none); the renders and the live walk prove it.
