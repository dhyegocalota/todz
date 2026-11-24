# 0032. Widgets read a snapshot in an App Group that a team prefix replaces later

- Status: Superseded by [0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md)
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (macOS app → Widgets and Sync), [ADR 0027](0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md), [ADR 0028](0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md), [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md), the `widgets` spike of 2026-11-24

## Context

The product design has the widgets read the app's cache from an App Group container, and their checkboxes complete tasks through an App Intent without opening the app. The machine still has no signing identity, so the app and its extensions are signed ad hoc (ADR 0024). The spike of 2026-11-24 found:

- An App Group named `group.…` makes `xcodebuild` demand a provisioning profile, so it cannot be built without a team.
- An App Group named with a team-style prefix (`ABCDE12345.dev.todz.wspike`) builds ad hoc. At run time the sandbox gives the app `~/Library/Group Containers/<that id>` and the app writes to it. A widget extension built beside it registers with `pluginkit` and gets its own container, so the system launched it.
- Without a team, nothing ties that group to todz's signature: any other ad-hoc signed app on the Mac can claim the same identifier.

ADR 0027 keeps the cache, with its session-bound data, in the app's own container. ADR 0031 keeps the app running in the menu bar when its window closes, so the app is usually there to send what a widget asks for.

## Decision

1. The app and the widget extension share one App Group whose identifier is `<prefix>.dev.todz`. `<prefix>` is one build setting in `project.yml`. Until the owner has a team it is the placeholder `TODZLOCAL0`; with a team it becomes the Team ID, and nothing else changes.
2. The group holds no session secret and not the cache. The app writes `widget-snapshot.json` there: the active workspace's name, the day, and Today as the app shows it (open tasks with their number, project, title, due date and creator label, then those done today, then the pending adds), written whenever that view changes, and it reloads the widget timelines after every write. The widgets read only that file.
3. A widget's checkbox runs an `AppIntent` in the extension with the task and its target state. The intent writes one file per request, `requests/<UUID>.json` in the group, so the extension and the app never rewrite the same file. It sets the task's state in the snapshot so the widget redraws at once. The app takes the requests once it is ready after launch, when it becomes active, and when a Darwin notification posted by the intent arrives while it runs. Each request goes into the outbox (ADR 0028) only if its task is in the app's current Today and not already in that state, and only to complete or reopen. The app removes the files it read and writes a fresh snapshot.
4. Signed out, never launched, or the snapshot of another day: the widgets show their empty states from `design.md`, and the checkboxes do nothing.
5. Sign-out and a sign-in as another owner erase both files with the cache (ADR 0027).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A snapshot and a request file in a placeholder-prefixed group (chosen) | Builds and runs today without a team; no secret in the group; one setting changes for a team | Until a team exists, another local ad-hoc app could read today's titles and ask to complete them; a completion waits for the app to run | — |
| Move the whole cache to the group now | What the product design describes | Puts session-bound data and the outbox in a group anyone can claim without a team | Wrong trade before a team exists; the snapshot is enough for four widgets |
| The extension calls the owner API itself, with the session in the group | Completes even while the app is quit | The session secret in an unprotected group | A stolen session reads every project |
| Wait for the team | No placeholder | Blocks feature 8, against the loop's brief | The owner asked the loop not to stop |
| `group.`-prefixed App Group | The iOS-style name | Needs a provisioning profile | Does not build without a team |

## Consequences

- **Owner's step:** add the Apple ID in Xcode (Personal Team), then set the prefix to the Team ID in `project.yml`. The group's name changes, and the app writes a fresh snapshot on the next launch.
- **Local risk until then:** another ad-hoc app on this Mac could read today's titles and ask to complete or reopen today's tasks. It cannot read the session, other days, other workspaces or notes. This is listed in the loop's Blockers.
- A completion from a widget reaches the server when the app runs. The app usually does, because it stays in the menu bar.
- The cache and the outbox stay in the app's container (ADR 0027 stands).

## Evidence

The spike's ad-hoc build: `xcodebuild` refused `group.dev.todz.wspike` ("requires a provisioning profile"); it built `ABCDE12345.dev.todz.wspike`; the sandboxed app got `~/Library/Group Containers/ABCDE12345.dev.todz.wspike` and wrote `shared.txt` and `Library/Caches/shared.txt` there; `pluginkit -m -v -i dev.todz.wspike.widget` listed the extension. The extension reading the group was not observed: it needs the widget placed on the desktop. Nor was it recorded whether macOS showed a consent prompt for the group container. Plan step 0 proves both before any code, with the owner's OK (plan review of 2026-11-24, finding 2).

## Revisit when

- The owner has a team. The prefix becomes the Team ID, and moving the whole cache into the group can be reconsidered.
- The widgets need more than Today.
