# 0033. Without a team, the widgets share a folder in Application Support that an App Group replaces later

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0032](0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md), the `widgets` plan step 0 spike of 2026-11-24

## Context

ADR 0032 put the widget snapshot and the widget requests in an App Group named with a placeholder team prefix, `TODZLOCAL0.dev.todz`, because a `group.` name needs a provisioning profile. Plan step 0 tested whether a second ad-hoc signed, sandboxed process can use that group. It cannot without the owner: macOS shows "“WSpikeReader” would like to access data from other apps" when a process opens a group container that another code identity created, and the process waits on the answer. Ad-hoc signatures carry no team, so the identity is the code hash and every rebuild of the app is another identity: the prompt would come back after each build, and the widget extension, which has no window, would have to raise it too. After "Allow" the second process read and wrote the group.

The same spike gave the two sandboxed ad-hoc processes one folder outside every container through the sandbox's home-relative temporary exception, `~/Library/Application Support/dev.todz.wspikeb/`. The first wrote, the second read what it wrote and wrote back, a rebuilt first process (a new code hash) wrote again, and no prompt appeared at any point.

## Decision

1. Until the owner has a team, the app and the widget extension share the folder `~/Library/Application Support/dev.todz.widgets/`. Both are sandboxed and both carry `com.apple.security.temporary-exception.files.home-relative-path.read-write` for that one folder and nothing else. Its path relative to the home folder is one Info.plist key both targets read; each process builds the absolute path from the account's home directory, not from the sandbox's.
2. Everything else in ADR 0032's decision holds unchanged, in this folder instead of the group: `widget-snapshot.json` written by the app and read by the widgets, no session and no cache, one file per request under `requests/`, the intake rules, the empty states, and the erase with the cache. Files are `0600` through `PrivateFile`.
3. The Darwin notification that tells the running app a request is waiting is named `dev.todz.widgets.requests`.
4. With a team, the folder becomes the App Group `<TeamID>.dev.todz`, the exception is removed, and the app writes a fresh snapshot on its next launch. Nothing else changes, because the store takes its folder from the app.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A sandbox-exception folder in Application Support (chosen) | No prompt; survives rebuilds; one key to swap for the group | Any process the owner runs outside the sandbox can read today's titles there; a temporary exception is not accepted by the Mac App Store | Accepted until a team; v1 is not on the App Store |
| The placeholder-prefixed App Group (ADR 0032) | The shape a team keeps | A consent prompt per ad-hoc build and per process, raised by an extension without a window | The owner would answer prompts after every build, and the widgets stay empty until he does |
| Wait for the team | No exception | Blocks feature 8 | The owner asked the loop not to stop |
| The extension reads the app's own container through an exception | No new folder | Exposes the cache and the session file to the extension | The session must not leave the app's container (ADR 0032) |

## Consequences

- **Owner's step:** add the Apple ID in Xcode (Personal Team), then replace the exception with the App Group `<TeamID>.dev.todz` in `project.yml`. Listed in the loop's Blockers.
- **Local risk until then:** another app on this Mac could read today's titles and drop a request to complete or reopen one of today's tasks. It cannot read the session, other days, other workspaces or notes. Same reach as ADR 0032's risk, without the prompts.
- The folder stays on disk after the app is deleted; the README says where it is.

## Evidence

Spike of 2026-11-24, in the scratchpad, never committed, on macOS 26 with Xcode 27.2:

- Group: the rebuilt spike app and a second app with the same `TODZLOCAL0.dev.todz.wspike` group each raised "would like to access data from other apps" and blocked until it was answered; after "Allow", the second app wrote `reader.txt` in the group.
- Folder: with the exception for `/Library/Application Support/dev.todz.wspikeb/` in both, the app wrote `shared.txt`, the second app read "from the app" and wrote `reader.txt`, and a rebuilt app wrote again; no prompt, nothing waited. `codesign -d --entitlements` showed the exception on the extension too, and `pluginkit -m` listed it.
- Not observed: the widget extension itself reading the folder, which needs a widget on the desktop. The extension's sandbox reads the same entitlement key, so the tester's walk with a placed widget is where it is proven or refuted.
