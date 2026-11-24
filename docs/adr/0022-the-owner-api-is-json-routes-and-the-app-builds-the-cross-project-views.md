# 0022. The owner API is JSON routes, and the app builds the cross-project views

- Status: Proposed
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (Views; Isolation: the app reads across projects by fanning out per project; Sync: a local cache pulled per project from a cursor), [ADR 0013](0013-a-project-is-reached-only-through-the-directory.md)

## Context

The macOS app needs to sign in, manage workspaces and projects, change tasks, read history, pull changes and manage MCP keys. Today, Upcoming and Done span every project of a workspace, while each project's tasks live in their own Durable Object. The app already keeps a local cache of every project it pulls, for the widgets and for offline use.

## Decision

1. The owner API is plain HTTP under `/owner`, JSON bodies with snake_case fields, one handler per route dispatched from a table of `URLPattern`s keyed by a route enum. A task is addressed by its project id and its number: `/owner/projects/<id>/tasks/<number>`.
2. Errors answer `{ "error": "<code>" }` from one `OwnerErrorCode` enum, plus `issue` and `index` for a broken task rule and `number` for a missing task. Another owner's workspace, project or key answers exactly like one that never existed.
3. There is no cross-project route. The app pulls each project's change feed into its cache and computes Inbox, Today, Upcoming and Done locally, in the owner's own zone. Every project route resolves the session's owner and checks the project in the directory before a Durable Object is opened (ADR 0013).
4. A first sign-in creates an owner and nothing else. `POST /owner/workspaces` creates the workspace and its Inbox project in one D1 batch; the Inbox is marked `projects.is_inbox`, at most one per workspace, and cannot be renamed.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| JSON routes, views built by the app from the feeds (chosen) | one read path for the app, the cache and the widgets; the Worker never joins projects | the app must hold every project of the active workspace | — |
| A server route per view that fans out to every project | the app could show a view without a cache | a second read path that the cache would ignore; one request opens N Durable Objects | duplicates the sync design |
| GraphQL or tRPC | typed queries | a Swift client gains nothing from TypeScript types; one more dependency | no consumer benefits |
| A default workspace created at first sign-in | the app opens on a usable list | its name is owner-visible copy no one has chosen | the app's onboarding decides |

## Consequences

- `mac-app-shell` asks for a workspace name when the owner has none.
- Deleting a workspace, project or task stays out of v1 (an open question for the owner).

## Evidence

The `owner-api` route tests walk every row of the route table, and the isolation suite repeats each project route with another owner's session.

## Revisit when

- A web or iPhone client without a full cache appears.
- A view must be shown before the first pull completes.
