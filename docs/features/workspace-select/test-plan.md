# Workspace select test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter WorkspaceChoice`)

- [ ] Two workspaces, no remembered choice, signed in: the phase is `choosing`, no workspace is active, and the listing is the only call.
- [ ] One workspace, no remembered choice: the phase is `ready` and that workspace is active (unchanged).
- [ ] No workspace: the phase is `naming` (unchanged).
- [ ] Two workspaces and a remembered choice for one of them: the phase is `ready` on the remembered one.
- [ ] A remembered identifier that is not in the listing: the phase is `choosing`, not the first workspace.
- [ ] `chooseWorkspace(identifier: side)` from `choosing`: the phase is `ready`, `side` is active, and its projects are pulled from cursor zero.
- [ ] `chooseWorkspace(identifier: "unknown")` from `choosing`: the phase stays `choosing` and no call is made.
- [ ] `chooseWorkspace` outside `choosing` (phase `ready`): nothing changes.
- [ ] The picker offers exactly the listed workspaces: a workspace from another owner never appears in the listing the model holds.
- [ ] While `choosing`, the widget snapshot is `absent`.

## User-visible walk (tester, by hand, after the Debug app runs against a local `wrangler dev`)

- [ ] Sign in on a Mac with no remembered workspace and an account with two workspaces: the picker shows both names and "N projects" counts, with no "Name your first workspace" title.
- [ ] Choosing a row opens that workspace on its Inbox.
- [ ] "New Workspace…" opens the name sheet; creating one enters it.
- [ ] Settings lists every workspace, marks the active one, and a tap switches to it.
- [ ] The popover's ⌘1 and ⌘2 still switch.
- [ ] Relaunch with the same workspace remembered: it opens directly, with no picker.
- [ ] Light and dark appearance: the picker and the Settings rows are legible.
