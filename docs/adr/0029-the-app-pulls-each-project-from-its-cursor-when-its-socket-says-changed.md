# 0029. The app pulls each project from its cursor when its socket says "changed"

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0023](0023-each-project-numbers-its-changes-and-its-socket-only-says-changed.md), [the v1 product design](../product/README.md) (macOS app → Sync), the `mac-sync` socket spike of 2026-11-24

## Context

Each project numbers its changes and offers a socket that only says `changed` (ADR 0023). The shell pulls every project from cursor 0 on launch, on a workspace switch and on ⌘R, and opens no socket. The product design asks the app to pull each project's changes from a cursor and, while it is open, to pull when the socket says `changed`.

## Decision

1. Each project's cursor is kept with its tasks in the cache (ADR 0027). A pull asks for the changes after that cursor, follows `has_more`, and stores the new cursor with the merged tasks.
2. `cursor_ahead` means the server lost changes the app saw: the app pulls that project from 0 and replaces its tasks instead of merging them.
3. While the window shows a workspace, the app keeps one socket per project of that workspace: `GET /owner/projects/:id/socket` with the session as `Authorization: Bearer`, through `URLSessionWebSocketTask`.
4. A pull runs when:
   - the socket says `changed`;
   - the socket opens or reopens, which also sends the outbox (ADR 0028), since it proves the server is reachable;
   - the app launches (after showing the cache), the workspace changes, or the owner presses ⌘R.
5. One pull per project at a time. A trigger during a pull of that project runs one more pull after it, however many triggers arrive.
6. A socket that closes or fails reopens after 1, 2, 4, 8, 16, then every 30 seconds, while its workspace is shown. A 401 on the upgrade ends the session; a 404 reloads the workspaces.
7. Sockets close on a workspace switch, at sign-out and when the session ends. There is no polling timer.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Socket per shown project, pull from the cursor on `changed` and on (re)open (chosen) | changes from agents show within a round trip; the reopen loop doubles as the reachability probe | one socket per project of the workspace | a workspace has a handful of projects |
| Poll every N seconds | no sockets | latency of N seconds and requests while idle | the server already offers the socket |
| `NWPathMonitor` for reachability, plus the socket | knows about the network interface at once | the interface being up says nothing about the server; a second signal to test | the socket's own opening is the better proof |
| One socket for the whole workspace | fewer connections | the server has none; it would need a fan-in object outside the per-project isolation | breaks ADR 0023's per-project boundary |

## Consequences

- A task an agent changes appears in the open window without a click.
- A server that is down costs one upgrade attempt per project every 30 seconds.
- Socket tests need a fake signal source in `TodzKit`; the live suite proves the real one against `wrangler dev`.

## Evidence

Spike, 2026-11-24, against `wrangler dev` with the fake provider: a `URLSessionWebSocketTask` with `Authorization: Bearer <session>` on `/owner/projects/<id>/socket` received `changed` after `POST /owner/projects/<id>/tasks`; the same upgrade with a wrong secret failed, and the task's `response` carried status 401.

## Revisit when

- Workspaces grow past ten projects.
- The server can push the changed tasks themselves.
