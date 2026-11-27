# Test plan: lock single workspace

Unit tests run with Swift Testing in `apps/macos/TodzKit` (`swift test`) against a fake `DeviceOwnerAuthenticator`.

## Collapse

- [ ] Turning the switch on, a relock (sleep, screen lock, idle, Lock Now) and a launch each leave a multi-selection as the current workspace alone.
- [ ] Unlocking does not restore the earlier multi-selection.
- [ ] The widget snapshot and the menu bar count hold the current workspace alone while locked.

## Every widening path asks

- [ ] The switcher toggle, ⌘-click and All workspaces ask; a refusal leaves the selection as it was.
- [ ] The picker of a locked launch asks before choosing.
- [ ] ⌃1–9, ⌃⌘[ ] and the global hot keys toward another workspace ask, and so does the popover.
- [ ] A confirmed prompt selects; a cancelled one changes nothing and pulls nothing.
- [ ] With the lock off or the session unlocked nothing asks.
