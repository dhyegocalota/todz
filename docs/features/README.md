# Features

One folder per feature or fix: `docs/features/<slug>/`. Slugs are kebab-case, without dates.

## Required files

`spec.md`, `plan.md` and `test-plan.md` are required together. Never one without the others. `tester-briefing.md` is written by the developer when the build ends.

## Start a new one

Use the `feature` skill, or copy [`_template/`](_template/) to `docs/features/<slug>/` by hand.

## Rules

- A fix gets the same folder. Its spec may be ten lines; it still exists.
- Folders stay after shipping. They are the history of why the code is the way it is.
- The header of `spec.md` carries the status line: `**Status:** Draft | In review | Approved | Building | Shipped YYYY-MM-DD`. The folder's row below carries the same status, plus the PR link once shipped; `tools/repository-shape/src/feature-status.test.ts` fails when they disagree, when a folder has no row, or when a merged pull request from a branch named after a folder (`<type>/<slug>`, whatever the type) left its spec unshipped ([HARNESS §7 → Status](../../.claude/HARNESS.md#7-ship)).
- Order of approval: spec approved by the owner, then plan, then test plan, then code.
- Process details: [`.claude/HARNESS.md`](../../.claude/HARNESS.md).

## Index

One row per folder, in the order the features ship; a row that turns `Shipped <date>` moves below the last row shipped on or before that date.

| Feature | Delivers | Status |
|---------|----------|--------|
| [`task-core`](task-core/) | The task and project rules in `libs/core` behind ports, with their enums in `libs/types` | Shipped 2026-11-23 ([PR #3](https://github.com/dhyegocalota/todz/pull/3)) |
| [`project-store`](project-store/) | The Worker, the D1 directory, one SQLite Durable Object per project, routing from a credential and the isolation suite | Shipped 2026-11-23 ([PR #4](https://github.com/dhyegocalota/todz/pull/4)) |
| [`mcp-server`](mcp-server/) | MCP over Streamable HTTP on the Worker: keys, the five tools, the `next` prompt, compact text, both protocol eras | Shipped 2026-11-23 ([PR #5](https://github.com/dhyegocalota/todz/pull/5)) |
| [`owner-api`](owner-api/) | Sign-in behind a provider port, workspaces with their Inbox, projects, owner task writes and history, the per-project change feed and "changed" socket, MCP key issue and revoke | Shipped 2026-11-23 ([PR #6](https://github.com/dhyegocalota/todz/pull/6)) |
| [`mac-app-shell`](mac-app-shell/) | The macOS app: the XcodeGen project over `TodzKit`, sign-in, the first workspace and the main window against the local API, and the `macos` gate | Shipped 2026-11-24 ([PR #7](https://github.com/dhyegocalota/todz/pull/7)) |
| [`mac-sync`](mac-sync/) | The app's local cache per owner, optimistic writes through a persisted outbox, pulls from each project's cursor and the "changed" socket | Shipped 2026-11-24 ([PR #8](https://github.com/dhyegocalota/todz/pull/8)) |
| [`menu-bar`](menu-bar/) | The menu bar extra: Today of the active workspace in a popover, an "Add a task" field and ⌘1–⌘9 to switch workspaces, over the app's one model | Shipped 2026-11-24 ([PR #9](https://github.com/dhyegocalota/todz/pull/9)) |
| [`widgets`](widgets/) | Four desktop widgets over a Today snapshot the app writes to a shared folder, with checkboxes that complete tasks through an App Intent | Shipped 2026-11-24 ([PR #10](https://github.com/dhyegocalota/todz/pull/10)) |
| [`connect-an-agent`](connect-an-agent/) | The key screen in the main window: the MCP server URL, the tools, ready commands for Claude Code, Codex and Cursor around a key shown once, and the project's keys with Revoke | Shipped 2026-11-24 ([PR #11](https://github.com/dhyegocalota/todz/pull/11)) |
| [`widgets-app-group`](widgets-app-group/) | The app and the widgets, signed with the Personal Team, share the App Group in place of the Application Support folder | Shipped 2026-11-24 ([PR #12](https://github.com/dhyegocalota/todz/pull/12)) |
| [`menu-bar-count`](menu-bar-count/) | The menu bar icon shows how many of Today's tasks are open, with a Settings toggle to turn it off | Shipped 2026-11-24 ([PR #13](https://github.com/dhyegocalota/todz/pull/13)) |
| [`owner-check-notes`](owner-check-notes/) | The notes from the owner's checklist run: the offline history line, the identity field's focus after sign-out, the popover's workspace keys and the measured window minimum | Shipped 2026-11-24 ([PR #14](https://github.com/dhyegocalota/todz/pull/14)) |
| [`brand`](brand/) | The owner's logo as the app icon, the menu bar glyph and the README header, rendered from SVGs in `docs/brand` | Shipped 2026-11-24 ([PR #15](https://github.com/dhyegocalota/todz/pull/15)) |
| [`v1-walk`](v1-walk/) | The scenario that walks the whole v1, from an empty Mac to tasks an agent added and the owner completed, and its run | Shipped 2026-11-24 ([PR #16](https://github.com/dhyegocalota/todz/pull/16)) |
| [`brand-glass`](brand-glass/) | The app icon as a layered Liquid Glass document with the flat set as fallback, and the todz glyph in every widget's header | Shipped 2026-11-24 ([PR #17](https://github.com/dhyegocalota/todz/pull/17)) |
| [`magic-link-sign-in`](magic-link-sign-in/) | Sign-in by an email link bound to the Mac that asked for it, behind the provider port, with a console sender for development | Shipped 2026-11-24 ([PR #18](https://github.com/dhyegocalota/todz/pull/18)) |
| [`transactional-email`](transactional-email/) | The sign-in and welcome mails as React Email templates rendered at build time, sent through Cloudflare Email Service from noreply@todz.app | Shipped 2026-11-24 ([PR #19](https://github.com/dhyegocalota/todz/pull/19)) |
| [`deploy-ready`](deploy-ready/) | The Wrangler configuration as production on api.todz.app with development overriding it, a per-client sign-in limit, the app's Release build on production, and the deploy runbook | Shipped 2026-11-24 ([PR #20](https://github.com/dhyegocalota/todz/pull/20)) |
