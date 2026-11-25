# Day email

**Status:** Approved
**Tier:** 🔴 (inbound mail that adds data to a tenant's project, a schema migration, a new cron, a runtime dependency, an Email Routing rule, the owner API's body, a new app control)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, a Settings toggle, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 6 (`day-email`, idea 9): "at a time the owner picks (default 07:00 in their time zone), a short 'Your day' mail with Today, through `transactional-email`. Replying adds a task, through Email Routing to a Worker email handler; the reply-to-add part needs its own ADR and security review (only the owner's own address may add)". The behaviour is the loop's call in ADRs 0063 and 0064.
**ADRs:** [0063](../../adr/0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md), [0064](../../adr/0064-a-reply-to-the-day-email-adds-one-task-only-from-the-owner-s-own-authenticated-address.md), [0013](../../adr/0013-a-project-is-reached-only-through-the-directory.md), [0014](../../adr/0014-credentials-are-stored-as-sha-256-digests.md), [0018](../../adr/0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md), [0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md), [0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md), [0052](../../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md), [0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md)
**Not changing:** the waitlist digest's schedule and content; every other mail's sender and reply-to (`hello@todz.app`); `hello@` and `support@` forwarding; the MCP server; the menu bar, the popover, the widgets and the day close; the site

## Problem

The owner wants Today in his inbox each morning without opening the app, and wants to add a task from that mail by replying. Nothing in todz sends mail on a schedule to an owner, and nothing reads inbound mail.

## Goals

- A Settings row "Email me my day" with a time (default 07:00) and a switch, off by default, stored on the owner's account.
- With it on, once a day at the chosen time in the owner's time zone (within the quarter hour after it, or up to three hours late after an outage), the owner's sign-in address receives "Your day: N due" listing Today across every workspace: open tasks due today or overdue, at most 20 lines, then "and N more."; an empty Today sends "Your day: nothing due".
- Never two day mails for one owner on one local date; every send leaves a row that says claimed, sent or failed.
- Replying to that mail from the owner's own mailbox adds one task, the reply's first line, to the Inbox of his first workspace, due today. Any other reply adds nothing and is answered by nothing.

## Non-goals

- A choice of days, several mails a day, another recipient, a digest of done tasks, tomorrow's preview.
- Several tasks per reply, notes, due dates or commands parsed from a reply, attachments, a confirmation mail.
- Unsubscribe headers (one owner's own opt-in mail; ADR 0063 revisits it), push notifications, the Focus gate (the mail is not an app surface).
- Retrying a failed day.

## Design

### Data flow

```
app Settings → PATCH /owner {day_email: true} | {day_email_minutes: 420}     (partial; GET /owner and sign-in answer both)

cron */15 * * * *  → scheduled → RUN_OF_CRON[cron]           (0 11 * * * → the waitlist digest, unchanged)
  → prune day_emails > 30 days and expired reply addresses
  → owners with day_email = 1 JOIN their email identity
  → due = local minute in [chosen, chosen + 180) on the local date        (Intl, the owner's time zone)
  → for each due owner, up to 50:
       INSERT day_emails (owner_id, day) ON CONFLICT DO NOTHING   → changes 0: skip
       Today = every workspace → every project → listTasks(open, overdue + today)     any failure → failed_at, read_failed
       issue reply+<secret>@todz.app (digest, owner, expires +7 days)
       EMAIL.send({from: noreply@, replyTo: reply+<secret>@, to: sign-in address, subject, html, text})
            ok → sent_at        throws → failed_at, send_failed
  → log {event: 'day_email_run', due, sent, failed}; any failed → reject with the count

reply from the owner's mailbox → MX → Email Routing (SPF, DKIM, DMARC; prepends Authentication-Results)
  → rule reply@todz.app (subaddressing) → Worker email(message)
  → global limit → recipient shape → size → secret digest (unexpired) → owner limit
  → postal-mime → first Authentication-Results: mx.cloudflare.net, dmarc=pass
  → From == owner's sign-in address → Message-ID → daily cap → first line above the quote
  → ReplyOwner → openReplyInbox → addTasks([{title, due_date: today, idempotency_key: mail:<sha256(Message-ID)>}], OWNER_ACTOR)
  → day_email_replies row; log {event: 'day_email_reply', outcome: 'added'}
  any refusal → drop silently; log {event: 'day_email_reply', outcome: <reason>}
```

### Interfaces

- **Migration `0008_day_email.sql`:** `owners.day_email` and `owners.day_email_minutes` (ADR 0063 §1); `day_emails (owner_id TEXT NOT NULL REFERENCES owners (id), day TEXT NOT NULL, claimed_at INTEGER NOT NULL, sent_at INTEGER, failed_at INTEGER, failure TEXT CHECK (failure IN ('read_failed', 'send_failed')), PRIMARY KEY (owner_id, day)) STRICT` with an index on `claimed_at`; `day_email_reply_addresses (digest TEXT PRIMARY KEY CHECK (length(digest) = 64), owner_id TEXT NOT NULL REFERENCES owners (id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL) STRICT` with an index on `expires_at`; `day_email_replies (owner_id TEXT NOT NULL REFERENCES owners (id), message_digest TEXT NOT NULL CHECK (length(message_digest) = 64), accepted_at INTEGER NOT NULL, PRIMARY KEY (owner_id, message_digest)) STRICT` with an index on `(owner_id, accepted_at)`.
- **Owner API:** `owner` JSON gains `day_email` (boolean) and `day_email_minutes` (integer 0–1439). `PATCH /owner` accepts `day_email` (boolean) and `day_email_minutes` (integer 0–1439) beside `time_zone` and `agent_nudge`, every field optional, at least one; anything else in those fields → 400 `invalid_request`, nothing stored.
- **Shared constants (`libs/types`):** the default minute, the catch-up minutes, the per-tick cap, the line cap, the record retention, the reply address lifetime, the reply size cap, the daily reply cap and the two reply rate limits.
- **Mail:** templates `DAY_EMAIL` and `DAY_EMAIL_EMPTY` in the generated module; new slots `{{count}}`, `{{tasks}}`, `{{workspace}}`, `{{time}}` (and `{{more}}`); `EmailMessage.replyTo` required, `filledEmailOf({ …, replyTo = HELLO_ADDRESS })`; the Cloudflare sender passes `message.replyTo`; the console sender logs `{to, replyTo, text}` (local only).
- **Worker:** `scheduled` dispatches through `apps/api/src/scheduled.ts`; the default export gains `email(message, env, executionContext)`; `Env` gains `DAY_EMAIL_REPLY_LIMITER` and `DAY_EMAIL_REPLY_GLOBAL_LIMITER`; the routing module gains `ReplyOwner` and `openReplyInbox`.
- **`wrangler.jsonc`:** `triggers.crons` `["0 11 * * *", "*/15 * * * *"]`; two `ratelimits` (namespaces 8610 and 8611); `observability: { enabled: true }`.
- **Email Routing (zone `todz.app`):** subaddressing on; rule `reply@todz.app` → Worker `todz-api` (ADR 0064 §8).
- **macOS:** `Owner.dayEmail: Bool?` and `Owner.dayEmailMinutes: Int?` decoded if present; `OwnerService.updateDayEmail(session:isEnabled:)` and `updateDayEmailMinutes(session:minutes:)` on `PATCH /owner`; `AppModel+DayEmail.swift`; `AgentNudgeNotice` becomes `OwnerSettingNotice`, shared by both rows; a Settings row from `design.md`.

### Failure handling

| Case | Effect |
|---|---|
| Flag off, or no `email` identity | no mail, no row |
| Tick before the chosen minute, or 180 minutes or more after | no mail, no row |
| Two ticks overlap | one claim wins; one mail |
| A project read fails | no mail; row `failed_at`, `read_failed`; the run rejects after the other owners |
| The binding throws | row `failed_at`, `send_failed`; the run rejects after the other owners; the reply address stays and expires |
| No sender (`EMAIL_SENDER` unset or the binding missing) | the run sends nothing, claims nothing and rejects naming the missing piece, like the digest |
| More than 50 due | the rest go on the next ticks inside their window |
| PATCH `{day_email_minutes: 1440}`, `-1`, `7.5`, `"07:00"`, `null`, or `{day_email: "yes"}` | 400 `invalid_request`, nothing stored |
| Any refused reply (ADR 0064 §3) | dropped silently, no task, no mail, no bounce; one log line with the reason |
| The same reply delivered twice | one task (idempotency key) |
| The project store throws while adding | the handler rejects; a redelivery adds once |
| The app offline or signed out | the row is disabled; no write is queued |

### Rollback

`wrangler rollback` to the version before: the older Worker has no `email` handler and one cron, so the mail stops and replies to `reply@` fail at Email Routing; delete the routing rule (one API call or the dashboard) to stop those deliveries. Migration 0008 only adds columns and tables an older Worker never reads; nothing is lost. An app still running shows the row and a flip answers 400 from the older server (shown as not saved); after relaunch the fields are absent, so the row is unknown and disabled.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How does the mail hit each owner's local time? | `*/15` cron with a claim; hourly; a Durable Object alarm per owner | the loop's call: `*/15` with a claim in D1 and a 3-hour catch-up (ADR 0063 §3–4) | 2026-11-25 |
| What is "Today" across workspaces? | every workspace; the active one | the loop's call: every workspace, labelled when more than one (ADR 0063 §7) | 2026-11-25 |
| Mail on an empty day? | send; skip | the loop's call: send "nothing due" (ADR 0063 §7) | 2026-11-25 |
| How is a reply tied to its owner? | per-send `reply+secret@` with subaddressing; subject token; HMAC; catch-all | the loop's call: per-send secret, digest stored, 7 days (ADR 0064 §1–2) | 2026-11-25 |
| How is the sender authenticated? | Cloudflare's first `Authentication-Results` with `dmarc=pass` plus From equal to the sign-in address plus the secret; From alone | the loop's call: all three (ADR 0064 §3) | 2026-11-25 |
| How many tasks per reply, and where? | one, the first line, first workspace's Inbox, due today; one per line | the loop's call: one (ADR 0064 §4–5) | 2026-11-25 |
| Who creates the routing rule? | the loop through the wrapper; the owner | the loop, falling back to an owner step on an authentication error (ADR 0064 §8) | 2026-11-25 |

## Test strategy summary

Workers tests for migration 0008's defaults and checks, the partial PATCH and the owner answers, the due window across zones (including a quarter-hour zone and a DST day), the claim under two runs, the record of each outcome, the cap, pruning, Today's lines and order across workspaces with isolation between owners, the mail's subjects, escaping and reply-to, the generated templates, and the `email` handler for every refusal reason and the happy path through raw MIME fixtures (each refusal: no task, nothing sent, no `setReject`, a log line with no address). Shape tests for the crons, limiters and observability. Swift tests for `OwnerAPI`, `AppModel` and the row's states. A walk on a local stack with the scheduled and email test endpoints and the app's Settings through computer use; the security reviewer attacks the inbound path; production checks after deploy (a `day_emails` row, then one real reply by the owner).
