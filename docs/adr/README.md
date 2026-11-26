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
| [0034](0034-the-key-screen-shows-a-new-key-once-inside-each-client-s-command.md) | The key screen shows a new key once, inside each client's command | Proposed | 2026-11-24 |
| [0035](0035-with-the-personal-team-the-widgets-share-the-app-group.md) | With the Personal Team, the widgets share the App Group | Proposed | 2026-11-24 |
| [0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md) | The menu bar icon counts Today's open tasks, behind a setting | Proposed | 2026-11-24 |
| [0037](0037-the-v1-scenario-walks-the-native-app-with-computer-use-and-the-agent-with-an-mcp-client.md) | The v1 scenario walks the native app with computer use and the agent with an MCP client | Proposed | 2026-11-24 |
| [0038](0038-the-brand-sources-are-svgs-in-docs-brand-and-the-app-s-assets-are-generated-from-them.md) | The brand sources are SVGs in docs/brand, and the app's assets are generated from them | Proposed | 2026-11-24 |
| [0039](0039-the-app-icon-is-a-layered-icon-composer-document-with-the-flat-set-as-its-fallback.md) | The app icon is a layered Icon Composer document, with the flat set as its fallback | Proposed | 2026-11-24 |
| [0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md) | The owner signs in with an email link, bound to the Mac that asked for it | Proposed | 2026-11-24 |
| [0041](0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md) | Outgoing email goes through a port, with a console sender for development | Proposed | 2026-11-24 |
| [0042](0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md) | Emails are React Email templates, rendered at build time into a generated module | Proposed | 2026-11-24 |
| [0043](0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md) | Mail leaves through Cloudflare Email Service, from noreply@todz.app | Proposed | 2026-11-24 |
| [0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) | The Wrangler configuration is production on api.todz.app, and development overrides it | Proposed | 2026-11-24 |
| [0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) | The public sign-in routes are limited three ways and Turnstile-guarded, failing closed | Proposed | 2026-11-24 |
| [0046](0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md) | The app solves the challenge in a web view, and the link page solves it for the sign-in | Proposed | 2026-11-24 |
| [0047](0047-the-readme-walk-shows-only-the-shots-that-tell-the-product-s-story.md) | The README walk shows only the shots that tell the product's story | Superseded by [0085](0085-the-readme-is-a-six-shot-showcase-and-the-docs-hold-the-tour.md) | 2026-11-24 |
| [0048](0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md) | The self-host guide is one Markdown file that the landing serves | Proposed | 2026-11-24 |
| [0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md) | todz.app is served by the same Worker, dispatched by host, and built in three features | Accepted | 2026-11-24 |
| [0050](0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md) | The waitlist answers alike for every address, mails once, and is guarded like sign-in | Accepted | 2026-11-25 |
| [0051](0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md) | The admin signs in by a mail link bound to the browser that asked, into a cookie session | Accepted | 2026-11-25 |
| [0052](0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md) | The waitlist digest goes to the admin address once a day from a cron | Accepted | 2026-11-25 |
| [0053](0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md) | Agents mention today's tasks in `next` when the owner turns it on | Accepted | 2026-11-25 |
| [0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) | The app learns Focus through a todz Focus filter, not the Focus status API | Accepted | 2026-11-25 |
| [0055](0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md) | The day closes once a day in the menu bar popover, at the owner's time | Accepted | 2026-11-25 |
| [0056](0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md) | The app keeps its server URL as a setting, and switching it starts clean | Accepted | 2026-11-25 |
| [0057](0057-the-focus-filter-stays-discoverable-so-the-owner-can-add-it.md) | The Focus filter stays discoverable, so the owner can add it in System Settings | Accepted | 2026-11-25 |
| [0058](0058-the-app-tells-the-server-its-own-link-scheme-and-the-sign-in-link-carries-it-back.md) | The app tells the server its own link scheme, and the sign-in link carries it back | Accepted | 2026-11-25 |
| [0059](0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md) | The docs are a Mintlify site on docs.todz.app, built from apps/docs, and the self-host guide moves into it | Accepted | 2026-11-25 |
| [0060](0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md) | The landing describes itself from the copy modules and offers WebMCP tools over its own Turnstile form | Accepted | 2026-11-25 |
| [0061](0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md) | Performance has written budgets, a fetch-based load harness behind pnpm perf, and work-count budgets in verify | Accepted | 2026-11-25 |
| [0062](0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md) | The morning glance is a non-activating glass panel that shows Today on the first wake or unlock of the day | Accepted | 2026-11-25 |
| [0063](0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md) | The day email is claimed once a day per owner from a quarter-hour cron | Accepted | 2026-11-25 |
| [0064](0064-a-reply-to-the-day-email-adds-one-task-only-from-the-owner-s-own-authenticated-address.md) | A reply to the day email adds one task, only from the owner's own authenticated address | Accepted | 2026-11-25 |
| [0065](0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md) | The day temperature steps the menu bar count's opacity after noon and washes overdue widget rows by age, behind a setting | Accepted | 2026-11-25 |
| [0066](0066-siri-and-shortcuts-run-three-app-intents-in-the-app-over-its-one-model.md) | Siri and Shortcuts run three App Intents in the app, over its one model | Accepted | 2026-11-25 |
| [0067](0067-the-waitlist-joins-in-place-over-fetch-behind-a-visible-check-a-honeypot-and-a-signed-render-time.md) | The waitlist joins in place over fetch, behind a visible check, a honeypot and a signed render time | Accepted | 2026-11-25 |
| [0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) | One Respect Focus switch decides for every proactive surface, and untouched settings follow the defaults | Accepted | 2026-11-25 |
| [0069](0069-the-api-states-its-build-version-and-the-oldest-app-it-accepts-and-the-app-shows-one-compatibility-line.md) | The API states its build version and the oldest app it accepts, and the app shows one compatibility line | Accepted | 2026-11-25 |
| [0071](0071-the-menu-bar-ribbon-unfolds-what-is-next-beside-the-glyph-for-a-few-seconds-as-template-frames-behind-a-setting-off-by-default.md) | The menu bar ribbon unfolds what is next beside the glyph for a few seconds, as template frames, behind a setting off by default | Accepted | 2026-11-25 |
| [0072](0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) | The Mac app downloads from todz.app as a development-signed DMG with an SSH signature, and updates through Sparkle | Accepted | 2026-11-25 |
| [0073](0073-signed-in-writes-have-quotas-and-signed-in-routes-a-rate-limit-per-owner-and-per-key.md) | Signed-in writes have quotas, and signed-in routes a rate limit per owner and per key | Accepted | 2026-11-25 |
| [0074](0074-closing-the-window-keeps-todz-in-the-menu-bar-as-an-accessory-app-behind-a-setting-on-by-default.md) | Closing the window keeps todz in the menu bar as an accessory app, behind a setting on by default | Accepted | 2026-11-25 |
| [0075](0075-the-mac-app-updates-itself-by-default-through-sparkle-and-the-release-gate-is-a-local-check.md) | The Mac app updates itself by default through Sparkle, and the first release's gate is a local check on this Mac | Accepted | 2026-11-26 |
| [0076](0076-an-account-with-several-workspaces-and-no-remembered-choice-opens-a-picker-of-names-and-project-counts.md) | An account with several workspaces and no remembered choice opens a picker of names and project counts | Accepted | 2026-11-26 |
| [0077](0077-the-motion-system-is-one-token-set-in-todzkit-with-every-effect-under-350-ms-and-a-crossfade-under-reduce-motion.md) | The motion system is one token set in TodzKit, with every effect under 350 ms and a crossfade under Reduce Motion | Accepted | 2026-11-26 |
| [0079](0079-workspaces-switch-by-chord-with-carbon-hot-keys-and-a-stored-rebindable-binding-table.md) | Workspaces switch by chord, with global Carbon hot keys and a stored, rebindable binding table | Accepted | 2026-11-26 |
| [0080](0080-the-workspace-picker-selects-several-workspaces-or-all-and-every-surface-shows-their-union-tagged-by-workspace.md) | The workspace picker selects several workspaces or All, and every surface shows their union tagged by workspace | Accepted | 2026-11-26 |
| [0081](0081-the-whole-repository-is-agpl-3-0-only-and-going-public-follows-a-pre-flight-runbook.md) | The whole repository is AGPL-3.0-only, and going public follows a pre-flight runbook | Accepted | 2026-11-26 |
| [0082](0082-telemetry-is-daily-rollups-in-d1-counted-by-a-nightly-cron-the-appcast-and-an-opt-in-app-report-with-no-raw-event-and-self-host-off.md) | Telemetry is daily rollups in D1, counted by a nightly cron, the appcast and an opt-in app report, with no raw event, and self-host off | Accepted | 2026-11-26 |
| [0083](0083-the-release-dmg-opens-on-a-committed-background-and-a-committed-ds-store-layout-copied-into-the-image-folder.md) | The release DMG opens on a committed background and a committed .DS_Store layout, copied into the image folder | Accepted | 2026-11-26 |
| [0084](0084-the-full-gate-runs-on-every-pull-request-as-hosted-jobs-filtered-by-path-and-one-summary-check-is-the-merge-gate.md) | The full gate runs on every pull request as hosted jobs filtered by path, and one summary check is the merge gate | Accepted | 2026-11-26 |
| [0085](0085-the-readme-is-a-six-shot-showcase-and-the-docs-hold-the-tour.md) | The README is a six-shot showcase and the docs hold the tour | Accepted | 2026-11-26 |
| [0095](0095-the-committed-dmg-layout-carries-the-whole-icon-view-record-finder-writes-or-finder-drops-it.md) | The committed DMG layout carries the whole icon view record Finder writes, or Finder drops it | Accepted | 2026-11-26 |
