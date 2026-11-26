# Plan: global workspace hot keys off by default

Steps are checked off by the developer as each commit lands. Red commits come first.

## Steps

- [ ] 1. ADR 0091 and this folder (docs only, committed with the red tests).
- [ ] 2. Red: `GlobalWorkspaceChordsTests`, `WorkspaceShortcutsPreferenceTests` (new cases), `GlobalChordPlanTests`, `SymbolicHotKeysTests`, `ChordModifiersTests` reference the new API and fail to compile.
- [ ] 3. Green TodzKit: `WorkspaceAction` scopes, `GlobalWorkspaceChords` (rename), `ChordModifiers.canBeGlobal`, `GlobalChordPlan`, `SymbolicHotKeys`, preference default off and read-time filter.
- [ ] 4. Green app: `WorkspaceHotKeys` returns refused actions, `WorkspaceShortcutController` uses the plan, `inAppChord` for the menu, Settings rows and in-use line, Copy strings.
- [ ] 5. Docs: `docs/features/README.md` row, `apps/docs/keyboard-shortcuts.mdx` and `apps/docs/workspaces.mdx` describe the two scopes, ADR 0079 header amended.
- [ ] 6. Run `swift test` (TodzKit) and the xcodebuild Debug build; screenshot the Shortcuts rows in light and dark from the worktree's build folder.
- [ ] 7. `/verify` green; push; `gh pr create`.

## File ownership

Single developer lane: all paths under `apps/macos/`, `docs/`, `apps/docs/`.

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| 3 | Symbolic hot key parse misreads the modifier flags | `SymbolicHotKeysTests` fails | Revert the commit; in-use falls back to Carbon's refusal only |
| 3 | Rename breaks a caller | `swift build` fails | Revert the rename commit |
| 4 | Carbon call on a stale plan | Hot key not registered after a switch flip | Re-run `registerHotKeys` on the change; revert the controller commit |
| 4 | Settings number rows hidden while the switch is on | Screenshot shows no rows | Fix the `if`; no backout needed |
| 4 | Dropping a stored override too eagerly | A valid rebind reads as default in the preference test | Keep the filter to the refusal rules only; revert |
