# Menu bar redesign test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter "MenuBarDayTests|MenuBarRowMetaTests|MenuBarNavigationTests|MenuBarNoticeTests"`)

- [x] Empty, all done, active, closing the day and day closed resolve to their screen; pending adds alone are not empty; a failed load beats a loading one. Evidence: `MenuBarDayTests`, red as a compile failure before `MenuBarDay` existed.
- [x] The first open task is Up next and the rest is the queue; a lingering just-checked first row keeps the card until the linger ends; closing the day draws no card. Evidence: `MenuBarDayTests`.
- [x] Left and done counts, and the progress at none, partial and complete. Evidence: `MenuBarDayTests`.
- [x] The Inbox hides its tag, one workspace hides the workspace, overdue only before today, a human has no agent, the second line never carries the agent. Evidence: `MenuBarRowMetaTests`.
- [x] Arrow navigation walks the targets in order, does not wrap, falls back to the composer for a vanished row, and has no composer in day close. Evidence: `MenuBarNavigationTests`.
- [x] A banner outranks offline; the dot shows only with a pending update note. Evidence: `MenuBarNoticeTests`.

## Offscreen renders (the app's views hosted in process, light and dark, never the live popover)

- [x] Today with the Up next card, an overdue task, an agent-added task, two workspaces tagged, `Done today`.
- [x] All done. Offline strip. Day close.
- [ ] The More menu and the locked header: the system menu cannot open offscreen, and the locked header needs track L's switcher; neither is rendered.

## Builds and gates

- [x] The Debug app builds from its own derived data (`xcodegen generate`, `xcodebuild build`).
- [x] `swift test` in `apps/macos/TodzKit`, `pnpm --filter @todz/repository-shape test`, `pnpm typecheck`.

## User-visible walk (tester, never in a loop: the popover opens in front of the owner's work)

- [ ] Open once: the composer has focus; ↓ moves to the card, then the rows, then `Done today`; ↑ from the first returns to the composer.
- [ ] Space on a row completes it and Space again reopens it; Return shows it in the window; ⌘↩ completes the Up next task from the composer.
- [ ] ⌘O opens todz; the More menu holds Check for Updates…, Star todz on GitHub and Quit todz, and shows the dot while an update note is pending.
- [ ] Reduce Motion: no ring burst, the card swap crossfades.
- [ ] VoiceOver reads the ring and count as one element and each row with its state.

## Coverage honesty

The views are not under unit test (the app target has no test bundle): the logic lives in TodzKit and the views are read from renders. Focus, key handling and the More menu are untested until the tester's walk; the composer's arrow handling is the likeliest to need a fix.
