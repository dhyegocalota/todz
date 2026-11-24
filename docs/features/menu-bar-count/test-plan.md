# Test plan: The menu bar shows the pending count

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `MenuBarBadgeTests` (`apps/macos/TodzKit/Tests/TodzKitTests/MenuBarBadgeTests.swift`) — input: the red commit; expected: each test, run alone with `--filter`, fails on the stub `MenuBarBadge is not implemented` (a `fatalError` stub stops a whole run at its first test) — BLOCKED: this run was on the merged head ac499c0 and did not check out the red commit 756958f
- [ ] Confirmed it fails for the right reason: the failure text recorded from the red run — BLOCKED: same, the red run was not reproduced

## Unit

- [x] Off — input: count 5, toggle off; expected: `nil` — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aTurnedOffBadgeShowsNothing)
- [x] Zero — input: count 0, toggle on; expected: `nil` — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (zeroOpenTasksShowNothing)
- [x] One — input: 1, on; expected: "1" — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aCountUpToTheCapShowsTheNumber)
- [x] Twelve — input: 12, on; expected: "12" — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aCountUpToTheCapShowsTheNumber); live: the item read "todz, 11 left today" and "18" in the build
- [x] Edge: the cap — input: 99, on; expected: "99" — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aCountUpToTheCapShowsTheNumber); live: 99 tasks, label "todz, 99 left today", item 56 pt wide
- [x] Edge: above the cap — input: 100, on; expected: "99+" — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aCountAboveTheCapShowsTheOverflow); live: 100 and 134 tasks read "99+"
- [x] Edge: a negative count — input: -1, on; expected: `nil` — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aNegativeCountShowsNothing)
- [x] The toggle's default is on: a fresh `UserDefaults` suite after the app's default registration reads `true` for the key, and registering never overwrites a stored `false` — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (aRegisteredDefaultReadsOnForAFreshDefaultsStore, registeringNeverOverwritesTheOwnersChoice); live: `defaults read dev.todz.Todz showsMenuBarCount` absent before, the first launch showed the number
- [x] The count the item and the popover heading share: every project loaded → the open count; one loaded and one failed → the same count the heading shows; nothing loaded yet → none — evidence: ac499c0, `swift test --package-path apps/macos/TodzKit --filter "MenuBarBadge|HeadingCount"`: 12 tests in 3 suites passed (theHeadingCount* x4)
- [x] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded — evidence: ac499c0, 555 tests in 37 suites passed

## Prove it for real — the app (ADR 0026)

The app is walked with Orca against `wrangler dev` and a seeded fictional workspace; the menu bar is read with Orca's status item state and a screenshot of the item.

- [x] One open task due today, one overdue from yesterday, one due tomorrow, one done today; expected: the item shows the icon and "2" (today and overdue; tomorrow and done not counted), and the popover's heading reads "2 left" — evidence: seed Acme with 4 tasks (due today, due yesterday, due tomorrow, done today); System Events read the status item "todz, 2 left today", 47 pt wide; popover heading "Today 2 left"; .pr-media/menu-bar-count/status-2.png, .pr-media/menu-bar-count/status-highlighted.png
- [x] Complete one in the popover; expected: the item reads "1" with the heading "1 left" — evidence: real click on the overdue row in the popover; item "todz, 1 left today" (45 pt) with the heading "1 left" in the same frame
- [x] Complete the last; expected: icon only, accessibility label "todz" — evidence: real click in the popover; item label "todz", 33 pt (icon only), heading "0 left"
- [x] Add a task due today from the main window; expected: the item reads "1" again — evidence: added through the owner API (Node fetch) with the main window open, not the main window field, because Orca could not send Return to the field in the background; the item read "todz, 1 left today" after the pull
- [ ] Settings: ⌘, opens the Settings window with the switch "Show pending count in the menu bar" on and its subtitle; expected: as `design.md` § 4 — FAILED (D1): the Settings window opens from the app menu "Settings…" and by ⌘, from the popover, titled "Todz Settings", with the switch "Show pending count in the menu bar" on and the subtitle "Today's open tasks in the active workspace. Hidden when none are left."; but the window is 418 x 448 pt with the form in the top 130 pt and the rest empty, against design § 1.2 "the height fits the content" (.pr-media/menu-bar-count/settings-on.png)
- [x] Switch off; expected: the item shows the icon only at once, Today still has an open task — evidence: click on the switch; item label "todz", 33 pt, at once; `defaults` showsMenuBarCount = 0; the sidebar still read "1 open Today"
- [x] Quit and relaunch with the switch off; expected: icon only; switch on; expected: the number returns at once — evidence: quit, relaunch: icon only (label "todz") with Today at 1 open, no Settings window at launch; switch on in Settings: label "todz, 1 left today" at once
- [x] Switch workspace with ⌘2 (another workspace with no open task today); expected: icon only; ⌘1 back; expected: the number — evidence: ⌘2 with the popover open: workspace "Side" (nothing due today), item "todz" icon only; ⌘1: "todz, 1 left today" (.pr-media/menu-bar-count/popover-side-workspace.png)
- [x] Signed out; expected: icon only — evidence: app menu "Sign Out": item "todz", icon only
- [x] Offline (stop `wrangler dev`) with a cached Today of one open task; expected: "1" — evidence: wrangler and the proxy stopped, the port refused connections: the item still read "todz, 2 left today" from the cache (two open tasks, not one)
- [x] Accessibility: the status item's label reads "todz, 1 left today" with one open task (Orca's tree or the Accessibility Inspector); if the label does not reach the status item, FAILED with what was read — evidence: System Events (AXTitle) on the status item read "todz, 1 left today", "todz, 2 left today", "todz, 100 left today", "todz, 134 left today", and "todz" at zero, off and signed out; the label reaches the status item (hypothesis 7 part 2 held); VoiceOver itself was not run
- [x] Dark menu bar: the number tints with the icon (screenshot) — evidence: this Mac's bar is dark; the icon and the number are both white and take the highlight pill together (.pr-media/menu-bar-count/status-highlighted.png, docs/screenshots/menu-bar-count/01-count.png); a light bar was not reachable: toggling the system appearance to light left the bar dark (the wallpaper decides), so the light half is BLOCKED
- [x] One project loaded and one failing (stop serving it through a proxy or remove its access); expected: the item and the popover heading show the same number — evidence: a Node proxy on 8787 answered 500 and dropped the socket for the Launch project; item "todz, 2 left today" and heading "2 left" (.pr-media/menu-bar-count/popover-partial-load.png)
- [x] More than 99 open tasks today (seeded); expected: the item reads "99+", the accessibility label names the real number — evidence: 99 via the owner API: label "todz, 99 left today", item 56 pt; 100: 64 pt; 134: label "todz, 134 left today", the item shows "99+" (.pr-media/menu-bar-count/status-99-plus.png)
- [x] A task due today added by an agent through MCP while the popover is closed; expected: the item's number rises after the pull, without opening the popover — evidence: MCP `add` with a key issued through the owner API (client "Claude Code"), popover and main window closed: item went from "1 left today" to "2 left today" without opening the popover
- [x] ⌘, with only the popover open and no main window; expected: the Settings window opens — evidence: main window closed, popover open, ⌘, via System Events: a "Todz Settings" window appeared in Orca's window list; whether it came to the front was not provable (the frontmost process stayed Dia)
- [x] The main window and the launch are unchanged: launch from cold opens the menu bar item and the main window as before; expected: the same as before this feature (no second launch, no Settings window at launch) — evidence: two cold launches: one main window "todz", the menu bar item, no Settings window
- [ ] Screenshots: `docs/screenshots/menu-bar-count/01-count.png` (light, fictional workspace, at most 1600 px wide and 1 MB) for the README, and the Settings window in `.pr-media/menu-bar-count/` for the PR — PARTIAL: docs/screenshots/menu-bar-count/01-count.png exists (180 x 60 px, 20 KB) but shows a dark bar, because a light bar was not reachable; .pr-media/menu-bar-count/settings-on.png exists; the root README does not yet embed 01-count.png, so `pnpm verify all` fails product-screenshots.test.ts

## Edge cases found during execution

- D1 (defect): the Settings window is 418 x 448 pt: the grouped form fills the top 130 pt and the rest is empty. Repro: build, launch, app menu "Settings…" (or ⌘,). Expected (design § 1.2): the height fits the content. Observed: a tall empty window. Evidence: `.pr-media/menu-bar-count/settings-on.png`. Regression test requested: a check that the Settings scene has a content-sized height.
- Hypothesis 6 refuted, accepted by design O3's fallback: digits are proportional in the status item. Measured item widths: icon only 33 pt, "1" 45, "2" 47, "11" 51, "18" 54, "99" 56, "99+" 64. The number is never clipped.
- Hypotheses 5, 7, 8 held: icon and number render side by side, white template icon and text, both on the highlight pill; the label redraws on an MCP add with the popover and main window closed, and the AX title reaches the status item; Settings opens from the popover with no main window, its title is "Todz Settings". Raised-to-front was not provable.
- Item and 99 cap: "99" at 99 open, "99+" at 100 and 134, the accessibility label carries the real number.
- Rapid toggling (off, on, off in a row) is consistent; the stored value follows the last click.
- A light menu bar could not be produced on this Mac: switching the system appearance to light left the bar dark, so the README shot is a dark-bar crop and the light half of the dark/light boxes is BLOCKED.
- The root README does not embed `docs/screenshots/menu-bar-count/01-count.png`, so `pnpm verify all` stops at `tools/repository-shape/src/product-screenshots.test.ts` ("the root README shows every screenshot"); the later gates did not run, `swift test --package-path apps/macos/TodzKit` ran separately: 555 tests passed.
- The popover opened by an accessibility press toggles like a click, so a second press closes it; the highlight pill appears only on a real open.
- The owner's session file read 968fcbc9…63e5f when this run started (not 6d7f01fe…); it was restored to exactly that.

## Adversarial review

- [x] Claim 1: the item and the popover's heading never disagree — attack: a partial load, a pull while the popover is closed, an optimistic write still in the outbox — result: held. Partial load (Launch failing): item and heading both "2"; every popover opening agreed with the item (2/2, 1/1, 0/0, side workspace none/none, and 2/2 after an MCP add and a relaunch). A pull while the popover was closed moved the item (box above); the heading was not read at that instant. The optimistic outbox case was not isolated
- [x] Claim 2: the switch takes effect without a relaunch — attack: toggle with the popover open, with the main window closed, twice quickly — result: held. Toggled with the main window open, with no main window, three clicks in a row (off, on, off): the item followed each click and the stored value ended at 0; relaunch kept it
- [x] Claim 3: the item renders the number next to the icon — attack: the built app with 1, 12 and 100 open tasks, light and dark menu bars — result: held in the dark bar: the icon and the number render side by side at 2, 11, 18, 99, 99+ and 134 (.pr-media/menu-bar-count/status-99-plus.png); the light bar could not be produced

## Coverage honesty

- The label's rendering is proven on this Mac's macOS only; macOS 14 itself is not available to run.
- At midnight the item, like the popover, keeps yesterday's split of today and overdue until the model next changes; shared with the popover, not fixed here.
