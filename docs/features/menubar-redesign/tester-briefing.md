# Menu bar redesign tester briefing (track P)

## What changed and where

- TodzKit, new and pure: `MenuBarDay`, `MenuBarRowMeta`, `MenuBarNavigation` (with `MenuBarFocus` and `MenuBarDirection`), `MenuBarNotice`, each with a `*Tests.swift` in `Tests/TodzKitTests/`.
- App, `apps/macos/Todz/MenuBar/`: new `MenuBarMoreMenu`, `MenuBarDayRing`, `MenuBarUpNext`, `MenuBarAllDone`, `MenuBarDoneToday`, `MenuBarSkeleton`, `MenuBarAgentMark`, `MenuBarRowMetaLine`, `MenuBarMetrics`, `MenuBarShortcut`; rewritten `MenuBarHeader`, `MenuBarToday`, `MenuBarTodayBody`, `MenuBarTodayRows`, `MenuBarRow`, `MenuBarLoading`, `MenuBarPrompt`, `MenuBarPopover`; deleted `MenuBarFoot`, `MenuBarTodayHeading` and the app's `MenuBarFocus`.
- Outside track P's list, flagged: `Todz/TodzApp.swift` gains one line, `.environment(appDelegate.updater)` on the popover (before, the popover never had the updater, so its Check for Updates and update note could not show). `Todz/Shared/AddTaskField.swift` is shared with the main window: its chrome is now the glass capsule there too.
- `MenuBarCopy.swift`: the new keys. `doneTodayShown` and `doneTodayHidden` are not added; `AccessibilityCopy.disclosureExpanded` and `disclosureCollapsed` are reused.
- Docs: ADR 0112, this folder, the README showcase image, the docs tour and shortcuts page, menu-bar O3 and O10 marked amended.

## How to run

`swift test --package-path apps/macos/TodzKit --filter "MenuBarDayTests|MenuBarRowMetaTests|MenuBarNavigationTests|MenuBarNoticeTests"`; `xcodegen generate --spec apps/macos/project.yml` then `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`. Never launch the app on screen.

## Red today, green after

All four suites were red as compile failures (`cannot find type 'MenuBarDay' in scope`); two later additions were red too: `value of type 'MenuBarRowMeta' has no member 'hasSubline'` and `value of type 'MenuBarDay' has no member 'doneToday'`.

## Hypotheses for the tester

1. ↓ in the composer moves focus to the Up next card (the handler is on the text field itself). Likeliest to be wrong.
2. Space on a focused row completes it and the card keeps the checked task until the linger ends, then hands over to the next; Space again reopens.
3. ⌘↩ from the composer completes the Up next task without moving focus.
4. `Done today` expands on Space or Return and shows the done rows; collapsed it shows the count.
5. The ring closes into a check with one mint burst when the last task is completed, and not at all under Reduce Motion; the All done card replaces the Up next card after the linger.
6. The More menu has Check for Updates… and Star and Quit; with an update note pending it also has `Updated to …` and a dot shows on the icon.
7. Offline shows the strip under the header; a banner shows instead of the strip when both apply.
8. In day close the composer collapses, no card is drawn, every row shows Done, Tomorrow and No date, and D, T, N and Space act on the focused row.

## Gaps

- The renders are in process: no animation, the system blue instead of the app's accent, a flat window colour instead of the menu bar material. The More menu (a system menu) and the locked header (needs track L) are not rendered; the other renders are under `docs/screenshots/menubar-redesign/` (one, shown by the README) and `apps/docs/images/menubar-redesign/` (the rest, shown by the docs tour), because a screenshot under `docs/screenshots` must be shown by the README or the landing.
- Expanded `Done today` rows are reached by Tab and the mouse, not by the arrow keys (design § 5 stops the arrows at `Done today`).
- Type-to-add is deferred (design Q5).
