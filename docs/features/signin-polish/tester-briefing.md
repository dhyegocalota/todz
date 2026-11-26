# Tester briefing: sign-in polish

## What changed

- `workspaces.last_activity_at` (migration 0013) is stamped from the project store after a task write, throttled to one directory write per project every five minutes, and listed by `GET /owner/workspaces`.
- The picker and Settings rows show "Active ..." under the project count when a stamp exists.
- A sign-in link handled while the app is signed in shows "You're already signed in." in the existing banner and brings the main window forward.

## How to run it

- API: `pnpm --filter @todz/api exec vitest run --project workers`.
- Mac: `swift test --package-path apps/macos/TodzKit`. For the walk, a Debug build from your own derived data against a fresh `wrangler dev --persist-to` directory with migrations applied; never touch /Applications.

## Red and green

| Test | Red | Green |
|------|-----|-------|
| `isActivityWriteDue` (3 cases) | `isActivityWriteDue is not implemented for null and ...` | passes |
| listing and stamp cases | `expected undefined to be null` | passes |
| `ActivityRecencyTests` | `recency(secondsAgo:) == .justNow` failed (stub returns nil) | passes |
| `workspaceDecodesTheLastActivityTheServerStamped` | `workspace.lastActivityAt == instant` failed | passes |
| the three signed-in link tests | `harness.model.banner == .alreadySignedIn` failed | passes |
| keeps-an-error-banner, dismiss, signed-out | green when they landed: pins | passes |

## Hypotheses to try

- A task added through MCP or the app moves the workspace's activity within a moment; a second add inside five minutes does not write again.
- A workspace written before the deploy shows no activity line until its next write.
- With a retryable error banner showing, a sign-in link leaves that banner alone.
- The popover also shows the line when it is the surface with a banner.

## Gaps

- The throttle lives in memory, so an evicted project store may stamp once more.
- The walk has not been run by hand; the screenshots are offscreen renders.
