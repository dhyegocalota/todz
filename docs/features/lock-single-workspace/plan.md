# Plan: lock single workspace

## Steps

- [x] 1. ADR 0122 and this folder.
- [x] 2. Red tests per path in `AppModelTests+LockSingleWorkspace`, committed alone.
- [x] 3. TodzKit: `selectWorkspaces` and `chooseWorkspaces` ask before showing a selection the locked session cannot show; the shortcuts ask before resolving a target beyond the current workspace.
- [x] 4. Green: `swift test`, the app build, `pnpm --filter @todz/repository-shape test`.
- [x] 5. Flip the spec and index row to Shipped inside the PR.

## File ownership

Single developer lane: `apps/macos/TodzKit`, `docs/`.

## Failure modes

| Step | What breaks | Signal | Backout |
|------|-------------|--------|---------|
| 3 | A prompt stacks on top of the switch sheet's prompt | `asked` lists two prompts for one choice | the first confirmed prompt unlocks the session, so the second never asks |
| 3 | A chord toward a missing workspace answers differently from one toward an existing workspace | the two tests disagree on `asked` | ask before resolving the target |
