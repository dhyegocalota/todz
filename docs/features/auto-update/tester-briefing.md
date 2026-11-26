# Auto update: tester briefing

Spec: [spec.md](spec.md). Test plan: [test-plan.md](test-plan.md). Decisions: [ADR 0075](../../adr/0075-the-mac-app-updates-itself-by-default-through-sparkle-and-the-release-gate-is-a-local-check.md).

## What changed

- **Settings › "Update todz automatically"** (on by default). A switch that writes Sparkle's `automaticallyDownloadsUpdates`. Default on comes from `SUAutomaticallyUpdate` `YES` in the Release Info.plist, which Sparkle reads when the owner never touched the switch.
- **Popover foot › "Check for Updates…"**, beside "Quit todz". Release only.
- **Popover foot › "Updated to x.y"**, once after a version change, cleared by a tap. Release only. No note on a first launch.
- **Release gate**: `docs/runbooks/release-the-mac-app.md` steps 8 (verify the DMG's sum and signature before opening it, then the local check on this Mac: quarantine, Open Anyway) and 9 (Sparkle x to x+1, with the daily check cleared first). The deploy skill's step 4 no longer carries the "release:mac is not a root script" branch; its step 3 still decides on the release by the `apps/macos` change since the last `mac-v*` tag, which is correct. Step 8 is the lead's, not the owner's.
- **Automatic updates are a build setting** (`TODZ_AUTOMATICALLY_UPDATES`, `"NO"` in `project.yml`): a build from source never updates itself. Only `scripts/release-mac.sh` passes `YES`, and it refuses a built app whose key is not `YES`.
- The Debug app has no feed, so it shows neither the switch nor the entry nor the note. Test those in Release.

## How to run it

Release has no `wrangler dev` flag, so point the Release app at the local Worker through the Server field the server-url feature shipped:

1. Start the Worker locally (`pnpm --filter @todz/api dev`, port 8787). Do not run `scripts/todz-cloudflare.sh` or any deploy.
2. Build the Release app with the repository's `macos` gate commands, but `-configuration Release`, into `apps/macos/build`.
3. Open the built `Todz.app`, go to Settings, and set the Server to `http://localhost:8787` (the server-url setting). Sign in with the local mail flow.
4. Check each row of the test plan's walk. The update feed is production's `https://todz.app/download/appcast.xml`, which answers 404 until the first public release; "Check for Updates…" will then report no update, and that is the expected result before release.

## Red and green

| Test | Red (real output) | Green |
|------|-------------------|-------|
| `UpdateNoteTests` (TodzKit) | stub commit `fb824be3`: `✘ Test aNewerVersionThanTheRecordedOneIsTheNote() recorded an issue … Expectation failed: UpdateNote.pendingVersion(recorded: "0.2.0", current: "0.2.1") == "0.2.1"`; `✘ Test aChangeOfVersionBackIsStillTheNote() … == "0.2.0"`; "Test run with 4 tests in 1 suite failed" | `4efbdaef`: `✔ Test run with 4 tests in 1 suite passed` |
| `macos-release.test.ts`, SUAutomaticallyUpdate | `8fd1ba89`: `AssertionError: expected '\n  Todz:\n    type: application\n …' to contain 'SUAutomaticallyUpdate: YES'` | `bcc51e44`: `Tests 12 passed (12)` |
| `deploy-skill.test.ts`, not-live branch | pinned in `main` as `the Mac release is not live yet`; now asserted absent with the owner's steps sentence present | `4d4d4f25`: `Tests 367 passed (367)` for the whole repository-shape suite after the runbook pin |
| `macos-release.test.ts`, runbook local check | pin: written after the runbook text, green when it lands (`ba6e2a7c`) | `ba6e2a7c` |
| Swift UI (Settings, popover foot, environment key) | no unit test: SwiftUI views are not in TodzKit; the Debug build compiled with zero warnings in the touched files | the walk below |

## Hypotheses to attack

1. A Mac that never touched the switch has Sparkle reading `SUAutomaticallyUpdate` as YES: on a fresh defaults domain, `defaults read dev.todz.Todz SUAutomaticallyUpdate` fails (no key), and the switch in Settings reads on.
2. Turning the switch off writes `SUAutomaticallyUpdate` NO and survives a relaunch.
3. With the switch on, a verified update installs on quit or relaunch with no window over another app. Not yet observed: it needs a newer appcast than the installed copy.
4. "Updated to x.y" appears after a version change, a tap clears it, and a relaunch does not bring a tapped note back.
5. A fresh install shows no note.
6. "Check for Updates…" is disabled until Sparkle reports it can check (`canCheckForUpdates`).

## Known gaps

- Install on quit is not observed end to end; it needs release x and x+1 (runbook steps 6 to 9), run by the lead after the merge.
- The Gatekeeper check on this Mac (runbook step 8) is the lead's, after the first release is live. The owner's other notebook stays a later check (ADR 0075 decision 5).
- The popover foot is crowded: the done count, the switch hint, the updater entry and the quit button share one row in 360 points. Look at it at that width in Release.
- No screenshots are recorded: the owner's production walk is in progress, so the app was not launched by the lane.
- The pending note stays until tapped, across launches, if the owner never opens the popover.
