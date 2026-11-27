# Plan: workspace lock

Steps are checked off by the developer as each commit lands. Red commits come first.

## Steps

- [x] 1. ADR 0110 and this folder.
- [x] 2. Red then green TodzKit: `WorkspaceLockTests`, `WorkspaceLockPreferenceTests`, `AppModelTests+WorkspaceLock` (collapse, gates, relock, widget, intent, link, writes).
- [x] 3. App: `MacOwnerAuthenticator`, `WorkspaceLockMonitor`, Settings rows, locked rows in the switcher, the Workspace menu, Settings lists and the picker, Copy.
- [x] 4. Docs: `docs/features/README.md` row, `docs/adr/README.md` row, `apps/docs/workspaces.mdx`.
- [x] 5. Debug build, offscreen renders of the Settings rows in light and dark under `.pr-media/workspace-lock/`.
- [x] 6. Push; `gh pr create`.

## File ownership

Single developer lane: `apps/macos/`, `docs/`, `apps/docs/`.

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| 2 | A surface reads `workspaces` instead of `shownWorkspaces` and leaks a name | a test finds a locked name in a snapshot or a presented list | route it through `presentedWorkspaces` |
| 2 | A relock leaves another workspace's watch open | `cancelled` never arrives in the relock test | collapse through `selectWorkspaces` |
| 3 | The idle check relocks while the person types | the session locks under input | the local monitor's `noteInput` is missing |
| 3 | The prompt stacks twice | `asked` shows two prompts for one tap | the shared in-flight authentication |
