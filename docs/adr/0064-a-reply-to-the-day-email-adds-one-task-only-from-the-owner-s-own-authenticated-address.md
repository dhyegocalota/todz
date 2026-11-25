# 0064. A reply to the day email adds one task, only from the owner's own authenticated address

- Status: Accepted (the build loop's call, the owner may overturn it); extends [0013](0013-a-project-is-reached-only-through-the-directory.md) §2 with a third credential, a reply address whose sender is authenticated
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked that "replying adds a task, through Email Routing to a Worker email handler; the reply-to-add part needs its own ADR and security review (only the owner's own address may add)"
- Inspired by: [ADR 0063](0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md), [ADR 0014](0014-credentials-are-stored-as-sha-256-digests.md), [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md) (the mailbox is already the sign-in credential), [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) (limits), Cloudflare's Email Service documentation read on 2026-11-25 (Email Workers, the `Authentication-Results` header, subaddressing), the zone's Email Routing settings read the same day through `scripts/todz-cloudflare.sh` (enabled, `support_subaddress: false`, rules `hello@` and `support@` forward to the owner, the catch-all disabled)

## Context

Inbound mail is unauthenticated input from the whole internet that would write into a tenant's project. A From header is trivially forged; a reply address can be forwarded or leaked. Email Routing checks SPF, DKIM and DMARC before it invokes a Worker and prepends its own `Authentication-Results` header, but it rejects only mail whose domain's DMARC policy asks for it, and Gmail's policy is `p=none`, so forged Gmail mail still reaches the Worker with `dmarc=fail`. The owner's mailbox already signs him in (a magic link, ADR 0040), so a reply proven to come from that mailbox grants nothing the mailbox does not already have.

## Decision

1. **A fresh reply address per send.** Each day mail's reply-to is `reply+<secret>@todz.app`, the secret 16 random bytes as 32 lowercase hexadecimal characters (lowercase survives any mail system that folds case). The `day_email_reply_addresses` table keeps its SHA-256 digest, the owner and an expiry 7 days later (ADR 0014); expired rows are deleted on each cron tick. A leaked address dies within a week and adds nothing without the owner's own mailbox.
2. **Routing.** Email Routing's subaddressing is turned on for `todz.app` and one rule sends the literal `reply@todz.app` to the Worker `todz-api`; `reply+<detail>@` falls back to it and the detail is kept in `message.to`. `hello@` and `support@` keep forwarding, and the catch-all stays disabled. The Worker's default export gains `email`.
3. **Every check fails silently, in this order.** A refused message is dropped: no `setReject` (a bounce would confirm the address exists), no reply, no task. One log line records `{event: 'day_email_reply', outcome}` with an outcome enum and never an address, a subject or a title; `unauthenticated` adds whether the first header was Cloudflare's and the `dmarc` verdict word, never the header's `smtp.mailfrom` or `header.from`.
   1. A global limiter (60 a minute) before any other work → `limited`.
   2. `message.to`, lowercased, matches `reply+<32 hex>@todz.app` → else `unknown_recipient`.
   3. `rawSize` at most 1 MiB → else `too_large`.
   4. The secret's digest names an unexpired row → else `unknown_recipient`. This yields the owner.
   5. A per-owner limiter (5 a minute) → `limited`.
   6. The raw message is parsed with `postal-mime`. The **first** `Authentication-Results` header in the message (the one Email Routing prepends; any later one may be the sender's) must have the authentication service `mx.cloudflare.net` and `dmarc=pass` → else `unauthenticated`. DMARC pass means SPF or DKIM passed for a domain aligned with the From header.
   7. The From header's address, normalized like every address (`normalizedAddress`), equals the owner's `email` identity → else `not_owner`. The display name is ignored; a second From address refuses.
   8. A `Message-ID` header exists → else `no_message_id`.
   9. Fewer than 20 replies accepted for this owner in the last 24 hours → else `daily_cap`.
   10. The plain-text part has a title (item 4) → else `empty`. A message with no text part refuses as `empty`.
4. **One task per reply, the title only.** The title is the first non-empty line of the text part above the quoted mail, whitespace collapsed and trimmed, cut at `TASK_TITLE_MAX_LENGTH` code points. The quote starts at the first line that begins with `>`, contains `noreply@todz.app` (every client's attribution line names the sender, in any language), is the signature delimiter `-- `, or is Outlook's `-----Original Message-----` or underscore rule. The rest of the reply is ignored: no notes, no due date parsing, no commands, no attachments.
5. **Where it lands.** In the Inbox of the owner's first workspace (by creation), due today in the owner's time zone, by the owner (`OWNER_ACTOR`), so it shows in Today at once. Its idempotency key is `mail:` and the SHA-256 of the `Message-ID`, so a redelivered message adds nothing twice. Each accepted reply is recorded in `day_email_replies (owner_id, message_digest, accepted_at)` for the daily cap.
6. **Through the directory.** Only the reply module produces a `ReplyOwner` (a branded owner, like `SessionOwner`), and only after checks 1 to 7; `openReplyInbox` in the routing module turns it into the Inbox's stub. An owner with no workspace adds nothing (`no_inbox`).
7. **No confirmation mail.** The task appears in the app through the usual change feed; a refused reply is silent. An unexpected failure (D1 or the project store throwing) rejects the handler, and the idempotency key makes a retry harmless.
8. **The Email Routing rule is created by the loop** through `scripts/todz-cloudflare.sh api` (its allowlist already admits `/zones/<zone>/…`), after the deploy that ships the `email` handler: subaddressing on, then `POST /zones/<zone>/email/routing/rules` with `{"name": "todz day email replies", "matchers": [{"type": "literal", "field": "to", "value": "reply@todz.app"}], "actions": [{"type": "worker", "value": ["todz-api"]}], "enabled": true}`. The token read the rules on 2026-11-25; whether it may write them is unproven. An authentication error makes both an owner step in the dashboard (Email Routing → Settings → Subaddressing on; Routing rules → Create address `reply`, Send to a Worker, `todz-api`). Deleting the rule turns the feature's inbound half off without a deploy.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Per-send `reply+secret@` with subaddressing and one rule (chosen) | one rule for every owner; secrets expire; digests only | a zone setting to turn on | — |
| A signed token in the subject or a header, replies to `reply@` | no subaddressing | clients rewrite subjects; a header is not echoed by replies | not carried back reliably |
| An HMAC token in the address, no table | no storage | a Worker secret to manage and rotate; no expiry without more fields | the table is smaller than the secret's runbook |
| A catch-all to the Worker | no zone setting | every typo and spam to any `@todz.app` invokes the Worker | widens the surface |
| One rule per owner | no subaddressing | 200-rule limit; an API write per owner | does not scale |
| From check alone | simple | From is forged freely; Gmail's DMARC is `p=none` | not authentication |
| DMARC alone, any sender | simple | anyone with a DMARC-passing domain and a leaked address adds tasks | the owner said only his address |
| Bounce refused mail (`setReject`) | the sender learns why | confirms live addresses to an attacker; backscatter | silent drop |
| Several tasks per reply, one per line | faster capture | a quoted line or a signature becomes a task | one per reply, as asked |
| A confirmation mail per add | feedback | a second outbound path and mail volume | the app shows it live |
| The workspace the owner picks | precise | another setting | the first workspace's Inbox until asked |

## Consequences

- A runtime dependency, `postal-mime` (4.2.1, MIT-0, no dependencies, no install scripts), parses inbound MIME in the Worker.
- Two rate limiter bindings and two tables join the configuration and migration 0008.
- An owner whose mail domain publishes no DMARC record (so `dmarc=none`) cannot add by reply; the mail still arrives.
- A forwarded day mail lets its reader reply, but the reply is refused unless it comes from the owner's own mailbox.

## Evidence

Cloudflare's Email Workers documentation (2025-07 changelog and the email handler page, read 2026-11-25): "Email Routing validates DMARC before invoking your Worker. It prepends a standard `Authentication-Results` header … read the first `Authentication-Results` header … and verify that its authentication service identifier is `mx.cloudflare.net`. Other `Authentication-Results` headers may have been supplied by the sender and should not be trusted"; with subaddressing on, "`user+detail@example.com` … will be matched by the `user@example.com` routing rule … the `+detail` part … is preserved in `message.to`". The inbound flow rejects only "mail that fails authentication according to the sender's DMARC policy". `GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing` answered `enabled: true`, `support_subaddress: false`; the rules listing answered the two forwards and a disabled catch-all. `npm view postal-mime` on 2026-11-25: 4.2.1, modified 2026-11-10, no `dependencies`, no `preinstall`, `install` or `postinstall`.

## Revisit when

The owner wants several tasks per reply, notes or a due date from the reply, a confirmation, another workspace, or replies from a second address; or Email Routing changes where it puts its verdict.
