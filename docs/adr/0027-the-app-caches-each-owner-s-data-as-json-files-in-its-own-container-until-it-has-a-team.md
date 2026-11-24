# 0027. The app caches each owner's data as JSON files in its own container until it has a team

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (macOS app → Sync), [ADR 0025](0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md), the `mac-sync` brainstorm of 2026-11-24

## Context

The product design keeps a local cache "in the App Group container that the widgets read". An App Group identifier carries the Team ID prefix, and the machine still has no signing identity (`security find-identity -v -p codesigning` finds 0 on 2026-11-24), so the app is ad-hoc signed (ADR 0024) and has no App Group. The cache holds task titles and notes, so it is private data, and a Mac can be signed in by more than one owner over time: one owner's cache must never show in another owner's window.

The data is small: one owner, a few workspaces, a few projects, hundreds of tasks per project. The views are computed in memory from each project's tasks (ADR 0022); the cache only has to survive a relaunch and be readable by a widget extension later.

## Decision

1. `TodzKit` reads and writes the cache through a `SyncStore` protocol; v1 ships `FileSyncStore`.
2. The cache is one folder, `Cache`, in the app's sandboxed Application Support folder, beside the session file of ADR 0025:
   - `owner.json`: the owner's identifier, the workspaces with their projects, and the active workspace;
   - `projects/<project id>.json`: that project's last cursor and its tasks as the server sent them;
   - `outbox.json`: the writes not yet confirmed by the server (ADR 0028).
3. Every file is JSON in the owner API's own shapes (snake_case keys, epoch milliseconds), written atomically (a `0600` draft file, then `rename`), and excluded from backups. The folder is `0700`.
4. The cache belongs to one owner. Signing in as a different owner, or with no readable `owner.json`, empties the app's in-memory state and erases the whole folder **before the new session is stored**; if the erase fails, the sign-in fails, so a session never sits beside another owner's cache. A launch whose server names a different owner than the cache erases it too; until the server has named the session's owner (the sign-in's answer, the owner update a launch sends before it lists the workspaces, or the owner read that follows an update refusing the time zone), the cached window shows and its sockets open, but nothing in the outbox is sent; every trigger that would send (an opened socket, a successful pull, a new write, ⌘R) asks for the owner again, a workspace listing that ends without it asks again once after the reconnect delay, longer after each failed ask, and the status says offline while changes wait. Signing out erases the folder before the session; if that erase fails, the owner stays signed in and is told, so a sign-out never leaves the data behind unseen. A session that ends with a 401 keeps it, so the same owner signing in again resumes with the outbox.
5. A project file that cannot be read or decoded is erased and that project is pulled again from cursor 0. An `owner.json` that cannot be read erases the folder. An `outbox.json` that cannot be read erases it and tells the owner once that waiting changes were lost.
6. When the owner adds a signing team, the folder moves to the App Group container in the same format, so the widgets read it (feature 8 `widgets`).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| JSON files per project behind a port (chosen) | no dependency; the API's shapes already decode; a widget can read one file; a corrupt file loses one project | rewrites a whole project file per change | a project holds hundreds of tasks; the budget is one frame (16 ms) to write a project of 1 000 tasks, checked by a test |
| SwiftData | Apple's store, queries | a schema and migrations for data the server owns; sharing a store with an extension needs care; models fight the `Sendable` value types `TodzKit` uses | heavier than a cache needs |
| SQLite through GRDB | fast, transactional | a dependency, and schema migrations on the client | the cache is small; nothing queries it |
| Core Data | mature | the same costs as SwiftData, older API | as above |
| `UserDefaults` | trivial | a preferences plist, size limits, backed up | not for private task data |
| The App Group container now | what the product design says | needs a team prefix the machine cannot sign with | blocked; the move is one constant |

## Consequences

- Tasks are on disk as plaintext JSON in the sandbox container, as safe as the user's account, like the session (ADR 0025).
- Sign-out loses changes that never reached the server; the window says so before it signs out (see `docs/features/mac-sync/design.md`).
- A session revoked from elsewhere ends in a 401, which keeps the cache, and the sign-in screen cannot erase it, so a remote revocation never removes the tasks already on this Mac; only a sign-in as another owner, or a sign-out, does. Whether the sign-in screen should offer an erase is the owner's call.
- Moving to the App Group is required before `widgets`; it is listed for the owner with the signing team.

## Evidence

The shell already decodes every owner API shape in `OwnerCoding`; encoding the same types back is symmetrical. `FileSessionVault` proves the atomic `0600` write and the backup exclusion in the sandbox.

## Revisit when

- The owner adds a signing team (move to the App Group).
- A project grows past a few thousand tasks, or a write shows up in a frame-time trace.
