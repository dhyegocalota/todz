# Landing digest

**Status:** Shipped 2026-11-25
**Tier:** 🟡 (a cron, a mail carrying personal data, configuration)
**Owner approval:** approved 2026-11-25 by inheritance from the owner's request in PROMPT.md "Landing" ("fila de espera, painel admin, digest etc igual zapbip … pra ser um prod ready mesmo"; "a waitlist signup … appears in the admin panel and in the next digest"). The behaviour is the loop's call in [ADR 0052](../../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md).
**ADRs:** [0052](../../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md), [0051](../../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md), [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md), [0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md), [0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)
**Not changing:** the site's pages and routes, the admin, the waitlist's join, the API host

## Problem

The owner sees new joins only by opening the admin. He asked for a daily digest like zapbip's.

## Goals

- Every day at 11:00 UTC the Worker mails `ADMIN_EMAIL` "Your todz waitlist: N new" with: the joins in the 24 hours before the run, the total on the list, the failed confirmations in that window, and the window's addresses newest first, at most fifty, then "and N more".
- An empty day still sends "Your todz waitlist: no one new", with the total.
- One button opens `https://todz.app/admin` (the `SITE_ORIGIN`'s `/admin`).
- Without a valid `ADMIN_EMAIL`, a usable `SITE_ORIGIN` or a mail sender, the run sends nothing and logs one line naming what is missing, never an address.
- A D1 or send failure rejects the handler.

## Non-goals

- Retries, a "sent today" table, other schedules, time zones, unsubscribe, per-locale totals, referrers.
- One address per line in mail clients that ignore `white-space: pre-line` (Outlook for Windows runs them together; the text part keeps one per line), and the empty paragraph or blank lines left when "and N more" is empty (review MINORs 6 and 7, accepted).
- Filling the subject from the values for every mail: only the digest passes a subject today (review MINOR 8, accepted; a template with a slot in its subject must pass one).

## Design

### Data flow

```
scheduled(controller, env, ctx)
  → DIGEST_OF_CRON[controller.cron]                       unknown cron → throw
  → recipient = adminEmailOf(env); siteOrigin = publicOriginOf(env.SITE_ORIGIN); sender = emailSenderOf(…)
        any missing → console.log(one line naming the missing pieces) and return
  → facts = waitlistDigestFacts({ database, since: now − 24 h, until: now })      D1 throws → reject
  → sender.send(waitlistDigestMail({ to: recipient, facts, origin: siteOrigin }))  throws → reject
```

### Interfaces

- `wrangler.jsonc`: `"triggers": { "crons": ["0 11 * * *"] }`, pinned by `api-source.test.ts`.
- `src/index.ts`: the default export gains `scheduled`, which calls `site/waitlist-digest.ts`'s `runScheduled({ cron, env, now })`.
- `site/waitlist-digest.ts`: `DIGEST_CRON = '0 11 * * *'`, the record `RUN_OF_CRON`, `runWaitlistDigest({ env, now })`.
- `site/admin-store.ts` gains `waitlistDigestFacts({ database, since, until })` returning `{ joined: number; total: number; failedConfirmations: number; addresses: string[]; moreAddresses: number }` with `addresses` capped at `DIGEST_ADDRESSES_MAX = 50`, newest first; `since` exclusive, `until` inclusive.
- Constants: `DIGEST_WINDOW_MS = HOURS_PER_DAY * MILLISECONDS_PER_HOUR` (from `@todz/types`, adding `HOURS_PER_DAY` there if it is missing).
- Mail: `EmailTemplateName.WaitlistDigest`, a template and its copy on the shared layout; the addresses and the counts fill slots at send time, each address escaped, through `emails/waitlist-digest-mail.ts`, then `pnpm emails:generate`.
- The local scheduled path: `wrangler dev --test-scheduled` with `/__scheduled?cron=0+11+*+*+*` on the dev server, named in the runbook.

### Failure handling

| Case | Effect |
|---|---|
| `ADMIN_EMAIL` unset or invalid, `SITE_ORIGIN` unusable, no sender | no mail, one log line naming the missing pieces, the handler resolves |
| an unknown cron | the handler rejects |
| D1 throws | the handler rejects, no mail |
| the send throws | the handler rejects |
| no joins | the "no one new" mail with the total |
| 51 joins | fifty addresses and "and 1 more" |

### Rollback

`wrangler rollback`; the cron trigger belongs to the deployment's configuration, so an older version without `scheduled` would fail its invocations, which only logs. Removing `triggers` and deploying stops it.

## Plan review answers

The plan review (2026-11-25, NO: two CRITICAL) is answered here; these lines win over the sections above, the plan and the test plan.

- **R1** No log line at all: a missing piece rejects the handler with an `Error` whose message lists `DigestMissingPiece` enum values (`admin_email`, `site_origin`, `email_sender`), never an address, so the dashboard shows a failed invocation. `console` stays pinned to `email-sender.ts`.
- **R2** The mail is two generated templates, `WaitlistDigest` and `WaitlistDigestEmpty`, with slots `{{joined}}`, `{{total}}`, `{{failed}}`, `{{addresses}}` (the addresses joined by `\n`, shown with `white-space: pre-line`, escaped like every slot) and `{{more}}` (the whole "and N more." sentence, or empty). The subject comes from a `subjectOf` in `waitlist-digest-mail.ts`, through an optional `subject` on `filledEmailOf` (`filled-email.ts`, now G1's).
- **R3** The window is `MILLISECONDS_PER_DAY` from `@todz/types`; no new constant, no `libs/types` edit.
- **R4** `until` is `controller.scheduledTime`, `since` is `until − MILLISECONDS_PER_DAY`, and a row counts when `since < joined_at ≤ until`, so consecutive days neither overlap nor gap. The handler takes `{ controller, env }`.
- **R5** `failedConfirmations` counts `confirmation_failed_at` in `(since, until]`; `total` counts every row with `joined_at ≤ until`. The three reads run in one `database.batch`, and the address order reuses the panel's `joined_at DESC, rowid DESC` statement fragment. `moreAddresses` is `joined − addresses.length`.
- **R6** `emailSenderOf` gets `publicOrigin: siteOrigin, requestUrl: siteOrigin`, as `waitlist-join.ts` does; a test proves `EMAIL_SENDER=console` with `SITE_ORIGIN=https://todz.app` sends nothing and rejects with `email_sender`.
- **R7** The tester proves how to stop the cron (`GET /accounts/<account>/workers/scripts/todz-api/schedules` through the wrapper, if its path is allowed, or the deploy output). The runbook's Rollback says: set `"crons": []` and deploy; a `wrangler rollback` keeps the schedule.
- **R8** Settled in `landing-admin` (its V1): `ADMIN_EMAIL` is a secret only.
- **R9** The local check is `pnpm --filter @todz/api exec wrangler dev --test-scheduled` with the dev site variables on its own port, then `curl "http://localhost:<port>/__scheduled?cron=0+11+*+*+*"`; the dev scripts stay as they are. That the route answers ahead of the assets is the tester's to prove.
- **R10** The escaping case is `o'brien&co@example.com` (`&amp;` and `&#39;` in the html, raw in the text); exactly fifty rows shows no "and N more".
- **R11** The Workers pool recipe: `worker.scheduled(createScheduledController({ cron, scheduledTime }), workerEnvWith({...}), executionContext)` then `waitOnExecutionContext`; success cases set `EMAIL` to a recording binding and `ADMIN_EMAIL` and `SITE_ORIGIN`.
- **R12** The lead's docs: runbook step 8 (the schedule in the deploy output), a read of the schedule at step 9, the Rollback line, the first digest as a post-deploy check, and `docs/self-host.md` (the digest goes to your `ADMIN_EMAIL` at 11:00 UTC from `triggers`).
- **R13** G1 also owns `test/emails/email-slot.test.ts`, `scripts/emails/cli.ts`'s preview values, and the template-listing tests.
- **R14** `api-source.test.ts`'s configuration type gains `triggers`.
- **R15** `enum DigestCron { Daily = '0 11 * * *' }` keys the record, and the shape test compares it with `wrangler.jsonc`; a missing key rejects.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Who gets the digest? | a `DIGEST_RECIPIENT` var; `ADMIN_EMAIL` | the loop's call: `ADMIN_EMAIL` (ADR 0052 §1) | 2026-11-25 |
| Which schedule? | `0 11 * * *`; zapbip's `*/30` with a sent-today check | the loop's call: `0 11 * * *` (ADR 0052 §2) | 2026-11-25 |

## Test strategy summary

Unit (Workers pool, local D1): the facts query with rows inside, outside and on the window's edges, the cap of fifty, the counts; the run with every missing piece, an unknown cron, D1 and a sender that throw, an empty day, and the mail's text and html (escaped addresses, the admin link). The mail template's tests beside the others. A shape test for the cron. A run through `wrangler dev --test-scheduled` by the tester, reading the console sender's line.
