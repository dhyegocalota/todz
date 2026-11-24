# Architecture Decision Records

An ADR records one architecturally significant decision: the context that forced it, the option chosen, the options rejected and why, and the conditions under which it should be reopened. ADRs are short, immutable once accepted, and written from [`_template.md`](_template.md).

## Numbering

- File name: `NNNN-kebab-slug.md`, four digits, assigned in order of creation.
- Numbers are never reused and never renumbered.
- The index lists every record in number order, with the title, status and date the record states; `tools/repository-shape/src/document-indexes.test.ts` checks it.
- A decision is changed by writing a new ADR and marking the old one `Superseded by [NNNN](NNNN-slug.md)`. The old file stays in place.

## Status lifecycle

- `Proposed`: written, not yet confirmed by the owner or pending a spike.
- `Accepted`: confirmed; the code follows it.
- `Superseded by [NNNN](NNNN-slug.md)`: replaced; kept for history.

A `Proposed` ADR moves to `Accepted` by editing its status line and date. Any other change of substance requires a new ADR.

## Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [0001](0001-one-source-per-agent-surface.md) | One source per agent surface, a thin adapter per tool | Accepted | 2026-11-23 |
| [0002](0002-mechanical-security-gates-and-a-security-reviewer.md) | Mechanical security gates and a dedicated security reviewer before every PR | Accepted | 2026-11-23 |
| [0003](0003-agentic-scenario-runs-with-one-browser-per-user.md) | Agentic scenario runs with one Playwright MCP server per user | Accepted | 2026-11-23 |
| [0004](0004-the-agent-repairs-its-own-machine-doctor-reports-never-installs.md) | The agent repairs its own machine: a doctor reports at session start and never installs | Accepted | 2026-11-23 |
| [0005](0005-the-local-gate-runs-what-the-diff-can-break.md) | The local gate runs what the diff can break | Accepted | 2026-11-23 |
| [0006](0006-pull-request-media-is-attached-with-the-github-cli.md) | Pull request media is attached with the GitHub CLI | Accepted | 2026-11-23 |
| [0007](0007-contributions-come-under-a-contributor-license-agreement.md) | Contributions come under a contributor license agreement | Accepted | 2026-11-23 |
| [0008](0008-runbooks-live-in-the-repository.md) | Runbooks live in the repository | Accepted | 2026-11-23 |
| [0009](0009-manual-order-uses-fractional-keys.md) | Manual order uses fractional keys | Proposed | 2026-11-23 |
| [0010](0010-the-task-rules-run-behind-synchronous-ports.md) | The task rules run behind synchronous ports | Proposed | 2026-11-23 |
| [0011](0011-due-dates-are-calendar-dates-and-the-caller-names-today.md) | Due dates are calendar dates and the caller names today | Proposed | 2026-11-23 |
| [0012](0012-worker-tests-run-inside-workerd.md) | Worker tests run inside workerd | Proposed | 2026-11-23 |
| [0013](0013-a-project-is-reached-only-through-the-directory.md) | A project is reached only through the directory | Proposed | 2026-11-23 |
| [0014](0014-credentials-are-stored-as-sha-256-digests.md) | Credentials are stored as SHA-256 digests | Proposed | 2026-11-23 |
| [0015](0015-the-project-store-answers-with-results-not-thrown-errors.md) | The project store answers with results, not thrown errors | Proposed | 2026-11-23 |
| [0016](0016-the-mcp-server-runs-on-the-sdk-v2-and-serves-both-protocol-eras.md) | The MCP server runs on the TypeScript SDK v2 and serves both protocol eras | Proposed | 2026-11-23 |
| [0017](0017-a-2025-era-client-is-named-by-a-session-in-the-directory.md) | A 2025-era client is named by a session in the directory | Proposed | 2026-11-23 |
| [0018](0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md) | The MCP server reads today in the owner's time zone | Proposed | 2026-11-23 |
| [0019](0019-mcp-keys-are-prefixed-and-shown-once.md) | MCP keys are prefixed and shown once | Proposed | 2026-11-23 |
| [0020](0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md) | Sign-in goes through a provider port, and v1 ships only the fake | Proposed | 2026-11-23 |
| [0021](0021-owner-sessions-are-bearer-secrets-that-last-90-days.md) | Owner sessions are bearer secrets that last 90 days | Proposed | 2026-11-23 |
| [0022](0022-the-owner-api-is-json-routes-and-the-app-builds-the-cross-project-views.md) | The owner API is JSON routes, and the app builds the cross-project views | Proposed | 2026-11-23 |
| [0023](0023-each-project-numbers-its-changes-and-its-socket-only-says-changed.md) | Each project numbers its changes, and its socket only says "changed" | Proposed | 2026-11-23 |
| [0024](0024-the-macos-app-is-an-xcodegen-project-over-a-local-swift-package.md) | The macOS app is an XcodeGen project over a local Swift package | Proposed | 2026-11-24 |
| [0025](0025-the-session-secret-lives-in-a-private-file-until-the-app-has-a-team.md) | The session secret lives in a private file until the app has a team | Proposed | 2026-11-24 |
| [0026](0026-a-native-app-is-walked-with-computer-use-and-recorded-from-its-screenshots.md) | A native app is walked with computer use and recorded from its screenshots | Proposed | 2026-11-24 |
| [0027](0027-the-app-caches-each-owner-s-data-as-json-files-in-its-own-container-until-it-has-a-team.md) | The app caches each owner's data as JSON files in its own container until it has a team | Proposed | 2026-11-24 |
| [0028](0028-the-app-s-task-writes-are-optimistic-and-go-through-a-persisted-outbox.md) | The app's task writes are optimistic and go through a persisted outbox | Proposed | 2026-11-24 |
| [0029](0029-the-app-pulls-each-project-from-its-cursor-when-its-socket-says-changed.md) | The app pulls each project from its cursor when its socket says "changed" | Proposed | 2026-11-24 |
| [0030](0030-product-screenshots-live-in-docs-screenshots-and-the-readme-walks-them.md) | Product screenshots live in docs/screenshots, and the README walks them | Proposed | 2026-11-24 |
| [0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) | The menu bar extra is a SwiftUI window over the app's one model | Proposed | 2026-11-24 |
| [0032](0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md) | Widgets read a snapshot in an App Group that a team prefix replaces later | Superseded by [0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md) | 2026-11-24 |
| [0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md) | Without a team, the widgets share a folder in Application Support that an App Group replaces later | Superseded by [0035](0035-with-the-personal-team-the-widgets-share-the-app-group.md) | 2026-11-24 |
| [0035](0035-with-the-personal-team-the-widgets-share-the-app-group.md) | With the Personal Team, the widgets share the App Group | Proposed | 2026-11-24 |
