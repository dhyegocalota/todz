# Sign-in polish plan

- [x] Red 1: `workspace-activity.test.ts`, the `WORKSPACE_ACTIVITY_WRITE_INTERVAL_MS` constant and a throwing `isActivityWriteDue`. Done at 3abfa9ce (7 failures).
- [x] Green 1: migration 0012, `isActivityWriteDue`, `touchWorkspaceActivity`, the store stamp through `waitUntil`, the listing field. Done at c2599844.
- [x] Red 2: `ActivityRecencyTests`, the workspace field decoding and the banner tests in `AppModelTests+SignInLink`. Done at 5d9cb29b (18 issues).
- [x] Green 2: `ActivityRecency`, `Workspace.lastActivityAt`, `redeem` raising `alreadySignedIn`, the row line, the banner symbol, the window opening for every link. Done at f6147f8b.
- [x] ADR 0098 and 0076 marked superseded, both indexes.
- [x] Screenshots rendered offscreen, light and dark.
- [x] `pnpm verify` foreground.

## File map

| File | Change |
|------|--------|
| `apps/api/migrations/0012_workspace_last_activity.sql` | new column |
| `apps/api/src/workspace-activity.ts` | the throttle decision |
| `apps/api/src/project-store.ts` | stamp after a write that moved the change number |
| `apps/api/src/directory-workspaces.ts`, `owner-records.ts`, `owner-json.ts`, `owner-workspaces.ts` | read, carry and list the field |
| `libs/types/src/constants.ts` | the interval |
| `apps/macos/TodzKit/Sources/TodzKit/ActivityRecency.swift` | wording class |
| `apps/macos/TodzKit/Sources/TodzKit/OwnerModels.swift` | `lastActivityAt` |
| `apps/macos/TodzKit/Sources/TodzKit/AppModel+SignInLink.swift`, `AppBanner.swift` | the banner decision |
| `apps/macos/Copy/WorkspacePickerCopy.swift`, `ErrorCopy.swift`, `AppBanner+Copy.swift` | copy |
| `apps/macos/Todz/Shared/WorkspaceSummary.swift`, `MainWindow/TaskList/ErrorBanner.swift`, `MenuBar/MenuBarLabel.swift` | views |

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| Migration 0012 | The Worker deploys before the column exists | Listing answers 500 "no such column" | Apply the migration first; the column is nullable, so rollback of the Worker needs no data change |
| The stamp | D1 refuses the write | No stamp; task writes still succeed | None needed; the next write retries |
| The banner | A sign-in link shows the line while a retryable error banner waits | Never: the line only raises over an empty banner | Revert the `redeem` guard |

The migration has no backout of its own; dropping the column is possible but unneeded.
