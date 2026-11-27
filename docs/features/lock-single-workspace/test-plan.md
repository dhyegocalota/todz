# Test plan: lock single workspace

Unit tests run with Swift Testing in `apps/macos/TodzKit` (`swift test`) against a fake `DeviceOwnerAuthenticator`. Boxes stay unticked until the tester has run them.

## One workspace while the switch is on

- [ ] An unlocked session refuses All workspaces and several workspaces and keeps one.
- [ ] A locked session refuses toggles, All workspaces and several without asking.
- [ ] The picker refuses All workspaces after the switch prompt.
- [ ] The switcher draws no All workspaces row while the switch is on.
- [ ] Turning the switch on collapses a multi-selection and the widget snapshot follows.
- [ ] Unlocking a launch that remembered All leaves one workspace.
- [ ] Turning the switch off brings several back without restoring the old selection.

## Switching asks

- [ ] A switch to another workspace, the picker and the numbered and step shortcuts ask while locked; a refusal leaves the selection as it was.
- [ ] A number naming the current workspace asks nothing and stays put.
- [ ] A number beyond the visible list asks, then resolves against every workspace.
- [ ] The in-app number chords beyond the list reach the model while locked without drawing rows.
- [ ] With the switch off or the session unlocked nothing asks; a confirmed prompt asks once.
