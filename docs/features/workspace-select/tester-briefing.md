# Tester briefing: workspace select

## What changed

- An account with two or more workspaces and no remembered choice on this Mac now lands on a picker, "Choose a workspace", instead of entering the first one. Each row shows the name and the named project count (the Inbox is not counted). "New Workspace…" opens the existing name sheet.
- Settings has a "Workspaces" section listing every workspace, with a check on the active one. A tap switches to it.
- The choice is remembered per Mac, as before. A remembered workspace opens directly with no picker.
- One workspace still opens directly. No workspace still shows the naming screen.
- No server change, no deploy, no schema change. Last activity is not shown (v1.1, see ADR 0076).

## How to run it

- Run the Debug app against a local Worker: `wrangler dev` in `apps/api`, then the Debug build from `apps/macos`, signed in to the local Worker.
- Make the account have two workspaces (create one from the Workspace menu) and clear the remembered choice by signing out, then signing in again on a fresh cache, or use a second owner.

## Red and green

| Test | Red (stubbed) | Green |
|------|---------------|-------|
| signing in with two workspaces and no remembered choice opens the picker | `Expectation failed: harness.model.phase == .choosing` | passes |
| a remembered workspace that is no longer listed opens the picker | `phase == .choosing` expected | passes |
| choosing a workspace opens it and pulls its projects from zero | `activeWorkspace == side` expected | passes |
| choosing an unlisted workspace changes nothing | `phase == .choosing` expected | passes |
| a workspace counts its named projects without the Inbox | `namedProjectCount == 1` expected, stub returned 0 | passes |
| signing in with one workspace opens it, no workspace names the first | (unchanged behaviour) | passes |
| remembered workspace, choosing outside the picker, widgets absent while choosing | (guards) | passes |

Red text was taken from `swift test --package-path apps/macos/TodzKit --filter WorkspaceChoice` at commit `679f1901` (9 issues) and at `6e404990` (1 issue for the count).

Existing tests that seeded two workspaces and expected the first to open were updated to remember the workspace they expect, through `AppModelHarness.rememberWorkspace(identifier:)`. This is the intended behaviour change, not a weakened assertion.

## Hypotheses to attack

- A remembered workspace from another owner must not open. The cache is keyed by owner; try two accounts on one Mac.
- Creating a workspace from the picker's sheet should land on its Inbox and leave the picker.
- A row tapped twice should not double-pull.
- The Settings list must mark only the active workspace.
- The popover shows "Choose a workspace to see what's due today." while the picker is open.
- Widgets show their absent state while the picker is open.

## Known gaps

- Last activity is not in the picker (v1.1).
- The named project count is derived on the client from the listing, so a project added on another device appears after the next refresh.
- The walk in `test-plan.md` has not been run by hand yet.
