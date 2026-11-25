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
| [`sign-in-guard`](sign-in-guard/) | A per-client, per-address and global limit and a Turnstile check on the public sign-in routes, failing closed, with the check shown in the app and on the link page | Shipped 2026-11-24 ([PR #21](https://github.com/dhyegocalota/todz/pull/21)) |
| [`readme-walk`](readme-walk/) | The README walk cut to the twelve shots that tell the product's story | Shipped 2026-11-24 ([PR #22](https://github.com/dhyegocalota/todz/pull/22)) |
| [`self-host-docs`](self-host-docs/) | A short, tested guide to running your own todz server on Cloudflare and pointing the app and an agent at it | Shipped 2026-11-24 ([PR #23](https://github.com/dhyegocalota/todz/pull/23)) |
| [`deploy-run`](deploy-run/) | The first production run of the deploy runbook, recorded, with the three corrections it taught | Shipped 2026-11-24 ([PR #24](https://github.com/dhyegocalota/todz/pull/24)) |
| [`landing`](landing/) | todz.app: one short, polished page with the waitlist form, real screenshots and the self-host guide, served by the same Worker by host | Shipped 2026-11-25 ([PR #25](https://github.com/dhyegocalota/todz/pull/25)) |
| [`landing-deploy`](landing-deploy/) | The run of the deploy runbook that put todz.app live, recorded | Shipped 2026-11-25 ([PR #26](https://github.com/dhyegocalota/todz/pull/26)) |
| [`landing-waitlist`](landing-waitlist/) | The todz.app form keeps the address and mails a confirmation once, behind three limits and Turnstile, failing closed | Shipped 2026-11-25 ([PR #27](https://github.com/dhyegocalota/todz/pull/27)) |
| [`landing-waitlist-deploy`](landing-waitlist-deploy/) | The run of the deploy runbook that applied the waitlist migration and put the join route live, recorded | Shipped 2026-11-25 ([PR #28](https://github.com/dhyegocalota/todz/pull/28)) |
| [`landing-admin`](landing-admin/) | The owner signs in to todz.app/admin by a mail link bound to his browser, and reads and exports the waitlist | Shipped 2026-11-25 ([PR #29](https://github.com/dhyegocalota/todz/pull/29)) |
| [`landing-digest`](landing-digest/) | A daily mail to the admin address with the waitlist's last day: new joins, the total, failed confirmations and the new addresses | Shipped 2026-11-25 ([PR #30](https://github.com/dhyegocalota/todz/pull/30)) |
| [`landing-admin-deploy`](landing-admin-deploy/) | The run of the deploy runbook that put the admin and the daily digest live, recorded | Shipped 2026-11-25 ([PR #31](https://github.com/dhyegocalota/todz/pull/31)) |
| [`agent-nudge`](agent-nudge/) | With a Settings toggle on, an agent's `next` says how many of the project's tasks are due today and which to start with | Shipped 2026-11-25 ([PR #32](https://github.com/dhyegocalota/todz/pull/32)) |
| [`agent-nudge-deploy`](agent-nudge-deploy/) | The run of the deploy runbook that applied the agent nudge migration and put the nudge live, recorded | Shipped 2026-11-25 ([PR #33](https://github.com/dhyegocalota/todz/pull/33)) |
| [`focus-aware`](focus-aware/) | A todz Focus filter and one shared gate keep every proactive surface quiet during a Focus that holds it, and show each once after | Shipped 2026-11-25 ([PR #34](https://github.com/dhyegocalota/todz/pull/34)) |
| [`turnstile-live`](turnstile-live/) | The public Turnstile site key goes into the production vars and the deploy runbook runs again, opening the guarded sign-in, waitlist and admin routes | Shipped 2026-11-25 ([PR #35](https://github.com/dhyegocalota/todz/pull/35)) |
| [`day-close`](day-close/) | Once a day at the owner's time, the menu bar popover opens on what is left of Today, and each task is done, moved to tomorrow or dropped from Today | Shipped 2026-11-25 ([PR #37](https://github.com/dhyegocalota/todz/pull/37)) |
| [`credits`](credits/) | todz.app's footer and the README credit Logic Bit, the studio that built todz, from one constant | Shipped 2026-11-25 ([PR #38](https://github.com/dhyegocalota/todz/pull/38)) |
| [`server-url`](server-url/) | The app's server is a setting with the cloud as default: a checked, probed address, a clean switch, and a deploy that ends naming the URL to paste | Shipped 2026-11-25 ([PR #40](https://github.com/dhyegocalota/todz/pull/40)) |
| [`docs-mintlify`](docs-mintlify/) | Real docs on Mintlify for docs.todz.app from `apps/docs`: the introduction, the quickstart, connecting an agent, the MCP tools and the self-host guide, which moves there as its one source | Shipped 2026-11-25 ([PR #42](https://github.com/dhyegocalota/todz/pull/42)) |
| [`security-fixes`](security-fixes/) | The open findings of the security sweep fixed red-first: the Debug app's own sign-in scheme, the Cloudflare wrapper's paths, the URL-shaped waitlist address, the mail button's contrast, the admin and waitlist accessibility fixes, the production headers on every host, the macOS gate's flake and the day close's stale mode | Shipped 2026-11-25 ([PR #43](https://github.com/dhyegocalota/todz/pull/43)) |
| [`docs-cutover`](docs-cutover/) | `todz.app/self-host` answers 301 to the guide on docs.todz.app, the landing and the README link it there, and the landing's generated copy of the guide goes | Shipped 2026-11-25 ([PR #44](https://github.com/dhyegocalota/todz/pull/44)) |
| [`landing-seo`](landing-seo/) | todz.app describes itself to search engines, chat previews, answer engines and browser agents: head tags, JSON-LD, icons, a share image, `llms.txt`, an MCP server card and WebMCP tools whose waitlist join keeps Turnstile | Shipped 2026-11-25 ([PR #45](https://github.com/dhyegocalota/todz/pull/45)) |
| [`performance`](performance/) | Written budgets for the API, MCP, the change feed, the app and the landing; `pnpm perf` load, stress and bounded production runs; the bottlenecks it finds fixed red-first; work-count budgets in `pnpm verify`; numbers before and after in a runbook | Shipped 2026-11-25 ([PR #47](https://github.com/dhyegocalota/todz/pull/47)) |
| [`morning-glance`](morning-glance/) | On the first wake or unlock of the day, a small glass panel shows Today for about five seconds without taking focus, and a click opens the window on Today | Shipped 2026-11-25 ([PR #46](https://github.com/dhyegocalota/todz/pull/46)) |
| [`health-head`](health-head/) | `HEAD /health` answers like `GET` for uptime monitors, and the runbooks say `/health` carries no `Server-Timing` | Shipped 2026-11-25 ([PR #48](https://github.com/dhyegocalota/todz/pull/48)) |
| [`day-temperature`](day-temperature/) | A setting, off by default: the menu bar count fades in three steps after noon while Today has tasks, and overdue widget rows get a red wash by days overdue, silent during a Focus that holds todz | Shipped 2026-11-25 ([PR #49](https://github.com/dhyegocalota/todz/pull/49)) |
| [`sign-in-captcha-scroll`](sign-in-captcha-scroll/) | The sign-in screen's security check shows no scroll bar and no scrolling: the page hides its overflow, the view follows the widget's height, the scrollers are hidden | Shipped 2026-11-25 ([PR #50](https://github.com/dhyegocalota/todz/pull/50)) |
| [`waitlist-inline`](waitlist-inline/) | The todz.app waitlist joins without a reload behind a visible Turnstile check, a honeypot and a signed minimum time, answering alike for every address | Shipped 2026-11-25 ([PR #51](https://github.com/dhyegocalota/todz/pull/51)) |
| [`day-email`](day-email/) | At a time the owner picks, a short "Your day" mail with Today across every workspace; a reply from his own authenticated address adds one task to his Inbox | Shipped 2026-11-25 ([PR #53](https://github.com/dhyegocalota/todz/pull/53)) |
| [`menu-bar-ribbon`](menu-bar-ribbon/) | A setting, off by default: now and then the menu bar item unfolds beside the glyph into "3 left · next: T-12 Review PR", scrolls once if long and folds back within seconds, every hour, at the close of the day or when an agent changes Today, through the proactive gate | Shipped 2026-11-25 ([PR #52](https://github.com/dhyegocalota/todz/pull/52)) |
