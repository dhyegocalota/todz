# 0063. The day email is claimed once a day per owner from a quarter-hour cron

- Status: Accepted (the build loop's call, the owner may overturn it); amends the product design's v1 non-goal "reminders, notifications" for this one opt-in mail, refines [0052](0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md) §2 (the `scheduled` handler dispatches more than one cron) and [0043](0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md) §2 (one mail carries another reply-to)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 9 from the loop's `proactive-day` list: "at a time the owner picks (default 07:00 in their time zone), a short 'Your day' mail with Today, through `transactional-email`"; every item opt-in, off by default, a Settings toggle, no push notifications
- Inspired by: [ADR 0052](0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md) (whose first production run is still unconfirmed, so this one leaves a record of every send), [ADR 0053](0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md) (an owner flag on the server written by a partial `PATCH /owner`), [ADR 0055](0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md) (once a day, on time or on the first chance after), [ADR 0018](0018-the-mcp-server-reads-today-in-the-owner-s-time-zone.md), [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md), [ADR 0042](0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md)

## Context

The owner wants a short mail with Today at a time he picks in his own time zone. Cloudflare cron triggers are fixed UTC expressions, owners live in many zones, and some zones sit on half or quarter hours (India +05:30, Nepal +05:45), so no single daily cron reaches everyone at 07:00. The server already holds each owner's time zone (ADR 0018, refreshed at every sign-in and owner confirmation) and his sign-in address (the `email` identity's subject, ADR 0040). The waitlist digest (ADR 0052) runs once a day with no record, and nobody can tell today whether its first production run happened.

## Decision

1. **Two owner settings on the server, off by default.** `owners.day_email INTEGER NOT NULL DEFAULT 0 CHECK (day_email IN (0, 1))` and `owners.day_email_minutes INTEGER NOT NULL DEFAULT 420 CHECK (day_email_minutes BETWEEN 0 AND 1439)` (07:00) in migration 0008. `GET /owner`, `PATCH /owner` and the sign-in answer carry `day_email` and `day_email_minutes`; the PATCH stays partial (every field optional, at least one). The server owns them because the server sends the mail.
2. **The recipient is the owner's sign-in address**, the subject of his `email` identity in `owner_identities`. An owner with no `email` identity (the fake provider of development and tests) is never mailed, whatever the flag says. No other address can be set.
3. **A cron every fifteen minutes** (`*/15 * * * *`) beside the digest's. `runScheduled` moves out of the digest into a `scheduled` module whose record maps each cron to its run, so the digest keeps `0 11 * * *` and its behaviour.
4. **Due, then claimed once.** On each tick, for every owner with the flag on and an address, the owner's local date and minute come from his time zone. The mail is due when the local minute is at or after the chosen minute and less than 180 minutes after it on the same local date (a catch-up window for a missed tick or an outage; past it, that day is skipped, so turning the mail on at 15:00 for 07:00 starts tomorrow, and a chosen 23:00 never spills into the next day). A due owner is claimed by `INSERT INTO day_emails (owner_id, day, claimed_at) … ON CONFLICT DO NOTHING` on the primary key `(owner_id, day)`; only the run whose insert changed a row sends. Two overlapping ticks never send twice, and a DST day that repeats an hour sends once.
5. **Every send leaves a record.** The claimed row gains `sent_at` after the send, or `failed_at` and a `failure` kind (`read_failed` when a project could not be read, `send_failed` when the binding threw). Nothing retries: a failed day stays failed. After trying every due owner, a run with any failure rejects with the count of failures only, so the dashboard marks the invocation failed without naming anyone. Rows older than 30 days are deleted on each tick. Workers Logs is turned on (`observability.enabled`) so each run's one summary line (`{event, due, sent, failed}`, never an address or a title) is kept.
6. **At most 50 sends per tick.** Due owners past that wait for the next tick, still inside their window. The cap bounds one invocation's subrequests; it is revisited when owners grow.
7. **"Today" is every workspace's.** The mail lists the open tasks due today or overdue (ADR 0036's Today, overdue included) across every workspace and project of the owner, in the directory's order: workspaces by creation, the Inbox first then projects by creation, tasks in each project's manual order, each line `T-12 Title · Project` with `· overdue` when overdue, and `Workspace / Project` when the owner has more than one workspace. At most 20 lines, then "and N more."; the subject counts all of them ("Your day: 3 due"). An empty Today still sends ("Your day: nothing due"), because silence would hide a broken cron (ADR 0052 §3) and the reply still adds a task. A project whose read fails fails the whole mail (`read_failed`): a partial Today would lie.
8. **The mail** is a React Email template on the shared layout, rendered at build time (ADR 0042) in two variants (with tasks, empty), from `noreply@todz.app`, its reply-to a fresh per-send reply address ([ADR 0064](0064-a-reply-to-the-day-email-adds-one-task-only-from-the-owner-s-own-authenticated-address.md)). It has no button: a `todz://` link is blocked by most mail clients and the web has no app. `EmailMessage` gains a required `replyTo`; `filledEmailOf` defaults it to `hello@todz.app`, so every other mail keeps today's reply-to.
9. **The app owns the controls.** The Settings window gains "Email me my day" with a time and a switch, read from `GET /owner` and written by a partial `PATCH /owner`, disabled offline, signed out and while a save is in flight, like the agent nudge (ADR 0053 §6).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `*/15` cron with a per-owner per-day claim in D1 (chosen) | reaches every zone, including quarter-hour ones; idempotent; a record of every send | 96 invocations a day, most doing one D1 read | the reads are cheap and the record answers "did it run?" |
| Hourly cron | fewer invocations | misses :30 and :45 zones by up to 45 minutes; a chosen 07:10 lands at 08:00 | too coarse for a time the owner picks |
| One Durable Object alarm per owner | exact to the minute | a new class, an alarm to re-arm on every change of time or zone, and nothing to list "who is due" | more moving parts than the mail is worth |
| Cloudflare Queues for the sends | retries, back-pressure | a new product, a consumer, a dead-letter path | not needed below the 50-per-tick cap |
| The app sends the mail at its own time | no server schedule | needs a Mac awake at 07:00; mail from the app's network | the server already sends mail |
| Today of the app's active workspace only | matches the menu bar count | the server has no "active workspace"; the person, not a window, reads the mail | every workspace, labelled |
| Skip empty days | quieter | silence hides a broken cron | ADR 0052's reasoning |
| Retry a failed send on the next tick | fewer lost days | a state machine and a risk of double mail after a timeout that did send | one record, no retry, the failure is visible |

## Consequences

- Migration 0008 adds two columns and the `day_emails` table; the owner API's body and answer grow two fields, which the app's `OwnerService` and its fakes follow.
- The owner's task titles leave the server in a mail to his own address, only after he turns it on.
- `wrangler.jsonc` triggers two crons and turns on Workers Logs; the repository-shape test pins both.
- The digest keeps its schedule; its run moves under the shared `scheduled` dispatch.

## Evidence

Cloudflare documents `ScheduledController.cron` as the expression that fired, so one `scheduled` handler dispatches several crons. D1 returns `meta.changes` for an `INSERT … ON CONFLICT DO NOTHING`, so the claim is one statement. `Intl.DateTimeFormat` with `timeZone` gives the local date and the hour and minute in workerd (ADR 0018 already relies on it for the date).

## Revisit when

The opted-in owners outgrow 50 sends per tick across the catch-up window, the owner wants a retry, a choice of days, or the mail at another address, or Gmail's bulk-sender rules start to apply (one-click unsubscribe).
