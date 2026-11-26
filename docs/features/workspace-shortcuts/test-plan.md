# Workspace shortcuts test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter "WorkspaceBindings|WorkspaceStep|WorkspaceShortcutsPreference|WorkspaceActions"`)

- [ ] Each number's default is ⌃ and its digit, with distinct key codes; 1 reads `⌃1`, 9 reads `⌃9`.
- [ ] Previous and next default to `⌃⌘[` and `⌃⌘]`; a tenth number has no chord.
- [ ] `.number(2)` on three workspaces picks the second; `.number(4)` and `.number(0)` pick nothing.
- [ ] `.next` from the last wraps to the first; `.previous` from the first wraps to the last; steps reach the tenth workspace.
- [ ] With no active workspace, next picks the first and previous the last; an empty list picks nothing.
- [ ] A rebind changes that action only, is stored, and reads back after a reload; the other actions keep their defaults.
- [ ] A chord another action holds is refused with that action named; a chord with no ⌃, ⌥ or ⌘ is refused.
- [ ] Rebinding to the chord the action already holds changes nothing.
- [ ] A fresh domain reads the global switch on; a stored off reads off; unreadable stored bindings read as the defaults.
- [ ] The model switches by action and ignores a number past the list.

## User-visible walk (tester, Debug app against a local `wrangler dev`, an account with three workspaces)

- [ ] The Workspace menu shows ⌃1, ⌃2, ⌃3 beside the names and ⌃⌘[ and ⌃⌘] beside Previous and Next Workspace.
- [ ] ⌃2 in the window switches to the second workspace; ⌃⌘] wraps from the last to the first.
- [ ] With another app in front, ⌃1 switches the workspace todz shows.
- [ ] Settings, Workspace shortcuts: Record on a row, then ⌃⌥J: the row reads `⌃⌥J`, the menu shows it, ⌃⌥J switches from another app, and the old chord does nothing.
- [ ] Record, then Escape: nothing changes. Record, then a bare letter: "Hold ⌃, ⌥ or ⌘ with the key."
- [ ] Record a chord another row holds: "Another workspace shortcut already uses those keys."
- [ ] Turning "Switch from any app" off: ⌃1 from another app does nothing; the menu chord still works in todz. Turning it on restores it.
- [ ] Quit and relaunch: a rebound chord and the switch persist.
- [ ] The Mission Control line shows in Settings.

## Edge cases

- [ ] One workspace: Previous and Next are disabled in the menu.
- [ ] The picker (`choosing`) is showing: a chord changes nothing.
- [ ] Not exercised by the tester without a system change: a ⌃1 Mission Control collision.
