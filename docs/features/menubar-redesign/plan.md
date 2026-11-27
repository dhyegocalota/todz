# Menu bar redesign plan

Track P of [design § 7](design.md#7-components-tokens-copy-and-the-build). The lead merges the three tracks; this lane owns the popover.

## Steps

- [x] P1. Model: `MenuBarDay`, `MenuBarRowMeta`, `MenuBarNavigation`, `MenuBarNotice` with their tests, red first. Evidence: red `test(macos): red, the menu bar day, row meta, navigation and notice models`, green `feat(macos): the menu bar day, row meta, navigation and notice models`; two small additions (`hasSubline`, `doneToday`) each with its own red and green commit.
- [x] P2. Copy: the keys in `MenuBarCopy.swift`. The two VoiceOver values `doneTodayShown` and `doneTodayHidden` are not added: `AccessibilityCopy.disclosureExpanded` and `disclosureCollapsed` already say the same words.
- [x] P3. Foot to More: `MenuBarFoot` deleted, `MenuBarMoreMenu` added, the header uses it and the open icon with ⌘O; the popover is given the updater. Evidence: `feat(macos): the menu bar popover leads with what's next`.
- [x] P4. Rows and the composer: `MenuBarRow` (one line, id on hover and focus, agent mark), `MenuBarDoneToday`, the `AddTaskField` chrome and focus ring. Same commit.
- [x] P5. Ring and states: `MenuBarDayRing`, the header count, `MenuBarTodayBody` driven by `MenuBarDay.screen`, the offline strip, `MenuBarSkeleton`. Same commit.
- [x] P6. Keyboard: arrows through `MenuBarNavigation`, Space completes, Return opens, ⌘↩, ⌘O. Same commit.
- [x] P7. Up next: `MenuBarUpNext`, `MenuBarAllDone`, the closing ring. Same commit.
- [x] P8. Renders and docs: the in-process renders, README, the docs tour and shortcuts page, ADR 0112, menu-bar O3 and O10 marked amended.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| P3 | The updater is missing from the popover, so More has no update items | `Check for Updates…` absent in a Release build | pass `.environment(appDelegate.updater)` to the popover |
| P4 | `AddTaskField` is shared with the main window; its chrome changes there too | the main window's add field looks different | restore the old chrome behind a parameter |
| P6 | Arrow keys do not reach the composer's text field | ↓ in the composer does nothing | move the handler to the field's own `onKeyPress` |
| P7 | The card does not hand over after a linger | the checked task stays on the card | `MenuBarDay.upNext` reads the open list that already holds the lingering task |
