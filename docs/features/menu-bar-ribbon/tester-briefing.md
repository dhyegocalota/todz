# Tester briefing: Menu bar ribbon

## G2 (the app)

### What changed and where

| Step | Commit | Paths |
|------|--------|-------|
| 0 spike, recorded | `064c2338`, amended by `55700f02` | `docs/adr/0071-…`, `plan.md`: measurements and the decision to reveal inside a fixed width |
| 15 copy | `d61c5716` (on G1 `43919d10`) | `apps/macos/Copy/MenuBarCopy.swift`, `AccessibilityCopy.swift`, `SettingsCopy.swift` |
| 16 Settings row | `9fcaa375` (on G1 `a4ed0571`) | `apps/macos/Todz/Settings/SettingsView.swift`, `TodzApp.swift` (`registerDefaults`) |
| 17 drawing | `a1b31f8f` (on G1 `c43b99ba`) | `apps/macos/Todz/MenuBar/MenuBarRibbonImage.swift`, `MenuBarRibbonLabel.swift` (holds `MenuBarRibbonStripCache`) |
| 18 wiring | `b175650a` | `RibbonScheduler.swift`, `AppDelegate+Ribbon.swift`, `AppDelegate.swift`, `TodzApp.swift`, `MenuBarLabel.swift` |
| 19 docs and render | `9134eb23` | `README.md` (one cell), `docs/product/README.md`, `apps/macos/README.md`, `docs/screenshots/menu-bar-ribbon/01-ribbon-hold.png` |

How it works: `RibbonCoordinator` (TodzKit) publishes a `RibbonPresentation` per frame. `MenuBarLabel` draws `MenuBarRibbonLabel` while one is set and the count otherwise. Each frame is a crop of one template strip rendered once per content (`MenuBarRibbonStripCache`, shared by the coordinator's width measure and the label). Per ADR 0071 §8's amendment, every frame has the same width (glyph, spacing, `min(textWidth, 180)`); `reveal` only governs how much of the text is drawn and at what alpha, so the item resizes once at the start and once back to the count on the end.

### How to run

- TodzKit suite: `cd apps/macos/TodzKit && swift test` (1109 tests pass at `b175650a`).
- App build: `cd apps/macos && xcodegen && xcodebuild -scheme Todz -configuration Debug -destination 'platform=macOS' build` (BUILD SUCCEEDED, no warning in the touched files).
- Gate: `pnpm install --frozen-lockfile`, then `pnpm verify`.
- The app has no test target, so G2 has no red-first tests: Steps 15 to 18 are untested by unit tests and are proven by the build and the walk. Every row below is a hypothesis.

### Hypotheses for the tester

- With the switch off (default), nothing in the menu bar changes and no wait is held. Defaults: `showsMenuBarRibbon` false, `menuBarRibbonCadence` `hourly`.
- Settings shows one row after Day temperature: a menu picker (disabled while the switch is off) and the switch. With the cadence "At the close of the day" and Close the day on, the detail reads "Close the day already opens todz at that time."
- A stored cadence the app does not know shows the picker at "Every hour" (`pickerCadence`) and no ribbon.
- With the switch on and Today non-empty, at the next hour the item widens once to glyph plus up to 180 points, reveals the line over 0.25 s, holds or scrolls once if long, hides, and returns to the count's width on the last frame. The glyph does not move. Screens: `docs/screenshots/menu-bar-ribbon/01-ribbon-hold.png` (rendered offscreen).
- While it shows, the item's accessibility label is the ribbon line ("todz, 3 left today. Next: T-12 Review PR", "todz, last one today: T-12 Review PR"); otherwise the count's.
- The day temperature never dims the ribbon text (it is drawn through its own image path, not `MenuBarCountImage`).
- The ribbon ends at once on: switch off, screen lock, sleep (`willSleep`, `screensDidSleep`), the gate turning quiet, and the popover showing.
- An agent adding a task due today settles 3 s, then shows once, at most once in 10 minutes, only with the cadence "When an agent adds or completes a task".

### Gaps and findings the developer knows about

1. **The unfold was not re-measured after option (c).** The spike showed the window and its image a frame apart only in the captures taken while the width changed per frame. The amended design removes per-frame resizes; the walk must capture the first and last frame (the two resizes) and confirm no clipped glyph.
2. **The item is hidden under the notch on the owner's bar at rest**, so the ribbon is not visible there (ADR 0071 Evidence). The neighbour's position at five instants (plan review finding 4) was not measured for that reason: no visible neighbour to the left exists on this bar, and no setting was changed on the owner's Mac. To measure it, the tester needs a bar with room.
3. **The popover anchor** was not measured (no popover opened). `end()` is called from `MenuBarPopover.showPopover` (the lead allowed this one line in a file outside G2's list), which the panel's occlusion change fires; no earlier hook exists, so it can still land after the popover anchors to a wide item. If the arrow is off the glyph after a click mid-ribbon, this is the cause and a known gap.
4. **Reduce Motion does not tail-truncate.** ADR 0071 §4 says the text is tail-truncated to 180 points; `RibbonPresentation` carries no Reduce Motion flag, so the label crops the 420-point strip at 180 points, which cuts a long line mid-letter without an ellipsis. Fix needs `isMotionReduced` on the presentation (G1) and a 180-point strip in the label.
5. **The Settings detail was truncated at 83 characters**, so the lead shortened it to "Now and then, shows what's next beside the menu bar icon for a few seconds." (`SettingsCopy`, `design.md` §4). Not re-rendered: the tester checks that it fits two lines at 420 points.
6. **No copy test.** The plan reviewer asked for a test with an emoji or markup-looking title in `AccessibilityCopy.menuBarRibbon`; the app has no test target and `project.yml` is not G2's. The title is interpolated as a plain `String` (never parsed as markdown or inflection syntax), so the hypothesis is that such a title is spoken literally.
7. **Strip scale is fixed at 2** (`stripScale` in `MenuBarRibbonImage.swift`), so the coordinator's width measure needs no screen; a 1x display downscales the strip.
8. **Only the hold shot is committed.** ADR 0047 and `product-screenshots.test.ts` require every committed PNG in the README walk, so the other renders (rest, unfold start, mid-unfold, mid-scroll, end hold, fold end, Reduce Motion, "Last one", a pending task, the Settings row on and off, light and dark bars) are not in the repository. They were rendered offscreen by a scratch program and are for the PR media; their folder is the session scratchpad `ribbon-render/frames/`.
9. The merge of G1 at `a4ed0571`..`26b59649` briefly carried a red stub (`RibbonSchedule`); no G2 commit is built on a red commit (Steps 15 and 16 on green `43919d10`, `a4ed0571`; Steps 17 and 18 on `c43b99ba`).
10. `tester-briefing.md` was created by this lane; G1's section lands through the lead's merge and may conflict as an add/add.
