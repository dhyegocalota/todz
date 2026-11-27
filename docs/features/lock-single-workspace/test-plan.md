# Test plan: lock single workspace

Unit tests run with Swift Testing in `apps/macos/TodzKit` (`swift test`) against a fake `DeviceOwnerAuthenticator`.

## Collapse

- [x] Turning the switch on, a relock (sleep, screen lock, idle, Lock Now) and a launch each leave a multi-selection as the current workspace alone.
- [x] Unlocking does not restore the earlier multi-selection.
- [x] The widget snapshot and the menu bar count hold the current workspace alone while locked.

## Every widening path asks

- [x] The switcher toggle, ⌘-click and All workspaces ask; a refusal leaves the selection as it was.
- [x] The picker of a locked launch asks before choosing.
- [x] ⌃1–9, ⌃⌘[ ] and the global hot keys toward another workspace ask, and so does the popover.
- [x] A confirmed prompt selects; a cancelled one changes nothing and pulls nothing.
- [x] With the lock off or the session unlocked nothing asks.
