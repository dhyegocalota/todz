# Widgets

**Status:** Approved
**Tier:** 🔴
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 8; macOS app → Widgets and Sync; the approved mockup's widgets in [`glass-screens.html`](../../product/mockups/glass-screens.html)), approved by the owner on 2026-11-23; the calls below that the product design does not make are an ADR or design decisions marked as the loop's calls and listed in the loop's questions for the owner
**ADRs:** [0024](../../adr/0024-the-macos-app-is-an-xcodegen-project-over-a-local-swift-package.md), [0027](../../adr/0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md), [0028](../../adr/0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md), [0032](../../adr/0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md)
**Not changing:** `apps/api`, `libs/core`, `libs/types`, the owner API, the cache and outbox formats and their place in the app's container, the main window and the popover's screens. No session secret leaves the app's container. Nothing is signed with a team or deployed.

## Problem

The owner sees Today only by opening the app or its popover. The product design asks for four desktop widgets (a small Today ring, a small Next up, a medium and a large list) whose checkboxes complete tasks without opening the app, and for every local change to reload them. There is no signing team, so the App Group the design assumes cannot be a `group.` one (ADR 0032).

## Goals

- A WidgetKit extension in the XcodeGen project, ad-hoc signed like the app, sharing an App Group `<prefix>.dev.todz` with it; `<prefix>` is one build setting, `TODZLOCAL0` until the owner's team (ADR 0032).
- The app writes `widget-snapshot.json` to the group whenever the active workspace's Today changes (tasks, outbox, workspace switch, day change, sign-in and sign-out), then reloads the widget timelines.
- Four widgets read only the snapshot: small Today ring (done today of the day's total), small Next up (the first open task in Today's order), medium and large Today lists, per [`design.md`](design.md).
- A widget checkbox runs an `AppIntent` that records a completion or reopening request in the group, redraws the widget at once, and posts a Darwin notification; the app takes the requests into the outbox (ADR 0028) when it runs, launches or becomes active, only for tasks of the snapshot it wrote.
- Signed out, no snapshot, or a snapshot of another day: the widgets' empty states.
- Sign-out and a sign-in as another owner erase the snapshot and the requests with the cache.
- The root README gallery gains the widgets (ADR 0030).

## Non-goals

- The cache or the outbox in the group, or the session in the group (ADR 0032).
- A widget that sends to the server itself, or that works while the app has never run.
- Widgets for Upcoming, Done, a project, or another workspace than the active one.
- Lock screen, iPhone or iPad widgets; Control Center controls.

## Design

Screens, states and copy: [`design.md`](design.md).

### Data flow

```
AppModel change (board, outbox, active workspace, day, phase)
   ─▶ WidgetSnapshot.of(model) ─▶ equal to the last written? stop
   ─▶ WidgetStore.writeSnapshot (group: widget-snapshot.json, 0600, atomic) ─▶ WidgetCenter.reloadAllTimelines()

widget timeline ─▶ WidgetStore.readSnapshot ─▶ entries (now, and the next midnight in the snapshot's time zone)

checkbox ─▶ ToggleTaskIntent.perform
   ─▶ WidgetStore.appendRequest({ project, number, state, at })
   ─▶ snapshot with that task toggled ─▶ writeSnapshot ─▶ reloadAllTimelines
   ─▶ post Darwin notification "dev.todz.widget-requests"

app (launch, became active, notification) ─▶ WidgetStore.takeRequests
   ─▶ each: task in the last written snapshot? ─▶ complete / reopen through the outbox ─▶ new snapshot
```

### Interfaces

`TodzKit` gains (names final in the plan): `WidgetSnapshot` (Codable, built from `TaskViews.today`, the pending adds, the workspace and the day; pure, unit-tested), `WidgetRequest`, the `WidgetStore` port with a file implementation over a folder (the group container in production, a temporary folder in tests) through `PrivateFile`, and the `AppModel` hooks that write the snapshot and take the requests. A new `TodzWidgets` extension target holds the four widgets, their views and the `ToggleTaskIntent`; the strings both targets show live where `design.md` § 8 says.

### Failure handling

- **The group container is missing** (an entitlement the system refused) → the app goes on without widgets and logs nothing about tasks; the widgets show "Open todz".
- **An unreadable snapshot** → the widgets show their empty state; the app's next write replaces it.
- **An unreadable request file** → erased; the requests in it are lost, the widget redraws from the next snapshot.
- **A request for a task not in the last written snapshot** (another workspace, a forged request) → dropped.
- **The app is quit** → requests wait in the group; the widget shows them done; the app sends them at its next launch.
- **Another owner signs in** → the snapshot and the requests are erased before anything is written for the new owner.
- **Logs:** nothing about tasks.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How do the app and the widgets share data without a team? | snapshot + requests in a placeholder-prefixed group / cache in the group / extension calls the API / wait for the team | Loop's call: [ADR 0032](../../adr/0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md); listed for the owner with its local risk until the team exists | 2026-11-24 |
| The design's open choices | see [`design.md`](design.md) | Loop's calls: the designer's recommendations, recorded in `design.md` § 7; listed for the owner | 2026-11-24 |

## Rollback

Nothing is deployed. Reverting the merge removes the extension and the snapshot writes; the group folder stays in `~/Library/Group Containers/TODZLOCAL0.dev.todz` until deleted by hand; the cache and outbox are untouched.

## Test strategy summary

Swift Testing in `TodzKit`: `WidgetSnapshot` from boards with open, overdue, done-today and pending tasks, another day, signed out; its `Codable` round trip; the file `WidgetStore` (modes, atomic writes, erase, unreadable files, appended requests read and cleared once); `AppModel` writing the snapshot on each change and not when unchanged, taking requests into the outbox only for snapshot tasks, erasing both files on sign-out and another owner's sign-in; the intent's request and optimistic snapshot logic as a pure function. The build gains the extension target. The tester walks the widgets on the desktop with the owner's OK (they draw on his screen, [the menu bar learning](../../learnings/2026-11-24-a-menu-bar-extra-closed-from-code-needs-two-clicks-to-reopen.md)), including a checkbox with the app running and quit.
