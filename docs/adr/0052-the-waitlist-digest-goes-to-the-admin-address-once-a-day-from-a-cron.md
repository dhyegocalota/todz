# 0052. The waitlist digest goes to the admin address once a day from a cron

- Status: Accepted (the build loop's call, the owner may overturn it); refines [0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md) §3.3 and [0051](0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md) §8
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for "fila de espera, painel admin, digest etc igual zapbip … pra ser um prod ready mesmo" and for the digest in the production smoke walk (PROMPT.md "Landing"), and may overturn the details
- Inspired by: zapbip's `operations/subscriber-digest.ts`, `subscriber-digest-queries.ts` and `emails/subscriber-digest-email.ts` (read-only)

## Context

ADR 0049 promised a daily digest to `hello@todz.app` from a `0 11 * * *` cron, sent even when nobody joined. ADR 0051 then made the admin address a secret, because a committed address lets one mailbox read another deployment's waitlist. A digest recipient in `vars` would reopen that hole: a fork would mail its waitlist to the todz owner every day.

## Decision

1. **The recipient is `ADMIN_EMAIL`.** The digest goes to the admin's address, the same secret ADR 0051 reads. Without a valid one, a usable `SITE_ORIGIN` or a sender, the run sends nothing and rejects with an error naming only the missing pieces, so the dashboard shows the failed invocation and no log carries an address.
2. **Once a day at 11:00 UTC** (`triggers.crons: ["0 11 * * *"]`, 08:00 in São Paulo), a `scheduled` handler dispatches by cron expression through a record, so a later cron is one more key.
3. **It covers the 24 hours before the scheduled time** (`since < joined_at ≤ scheduledTime`, so days neither overlap nor gap): the joins in that window, the total on the list, the failed confirmations in the window, and the window's addresses, newest first, at most fifty, with "and N more" past that. It goes even when the window is empty, so its arrival proves the cron and the mail work.
4. **The mail** is a React Email template on the shared layout, rendered at build time like the others (ADR 0042), from `noreply@todz.app`, with one button to `https://todz.app/admin`.
5. **A failure throws.** A D1 or send failure rejects the handler, so the Workers dashboard marks the invocation failed. Nothing retries it: the panel and the CSV still hold every row the lost digest would have listed.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `ADMIN_EMAIL` as the recipient (chosen) | one secret; a fork mails nobody | the digest and the admin share an address | they are the same person |
| A `DIGEST_RECIPIENT` var | separate address | committed, so forks mail the todz owner | the ADR 0051 hole |
| zapbip's `*/30` cron with a "sent today" check | survives a missed tick | a table and a state machine for a mail to one person | not worth it |
| Skip empty days | quieter | silence hides a broken cron | ADR 0049 said send |

## Consequences

- The owner gets one mail every morning, with waitlist addresses in it, at an alias only he reads.
- A missed or failed run is lost; the panel and the CSV still hold every row.
- The production smoke walk can check the digest by running the handler once with `wrangler`'s scheduled test path locally, and by the first 11:00 UTC mail in production.

## Evidence

zapbip runs the same shape (`runSubscriberDigest` throws on a failed send). Cloudflare runs `scheduled` handlers for `triggers.crons` on Workers Paid, which the account has.

## Revisit when

The owner wants the digest at another hour or in his time zone, or the window's addresses grow past what a mail should list.
