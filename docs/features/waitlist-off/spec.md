# Waitlist off

**Status:** Shipped 2026-11-26
**Tier:** 🟡
**Owner approval:** approved 2026-11-26 by the owner's words to the loop ("desativa join waitlist por favor.. já estamos no ar"), inheriting the product scope of [docs/product/README.md](../../product/README.md)
**ADRs:** none; the earlier records of the waitlist ([0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0052](../../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md), [0060](../../adr/0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md), [0067](../../adr/0067-the-waitlist-joins-in-place-over-fetch-behind-a-visible-check-a-honeypot-and-a-signed-render-time.md)) stay as history
**Not changing:** the admin panel and its CSV export of the existing list, the waitlist table and its migrations, the limiter bindings in `wrangler.jsonc`, the sign-in Turnstile guard

## Problem

todz is live, so a waitlist form on the landing is wrong: it asks for an address to tell people when todz opens, and it ships a Turnstile widget, a page script and a digest cron for it.

## Goals

- The landing drops the form, its Turnstile widget, its page script and its copy; the hero's call to action is **Download for Mac**, always.
- `POST /join` answers 410 Gone with a short text pointing to `/download`, reads no body and writes no row.
- The WebMCP `join_waitlist` tool is gone; llms.txt, llms-full.txt, the JSON-LD and the docs no longer mention the waitlist.
- The digest cron is removed from `wrangler.jsonc` and from the dispatch; only the day email's quarter-hour cron stays.
- The landing's policy loses the Turnstile script source and frame; it stays hash based with no `unsafe-inline`.

## Non-goals

- Deleting the waitlist table, the admin panel or the stored addresses.
- Removing the unused limiter bindings or the mail templates.

## Design

### Data flow

`GET /` serves one prebuilt page with no form and no challenge keys. `POST /join` is routed to a handler that answers 410 without touching the request body or the database.

### Failure handling

An old tab posting the form gets the 410 text. A stale cron trigger named `0 11 * * *` is rejected by the dispatch naming the cron, so a deploy that did not drop it fails loudly in Cron Events.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Keep the digest | Keep it mailing, or stop | Stop: no new joins can arrive | 2026-11-26 |
| Smoke walk step 12 | Keep, or supersede | Superseded, dropped from the follow-ups | 2026-11-26 |

## Test strategy summary

`apps/api/test/waitlist-off.test.ts` pins the 410 with no write, the landing without form, widget or waitlist word, the strict policy, the JSON-LD, llms.txt, the tool list and the cron; `tools/repository-shape/src/api-source.test.ts` pins the trigger list.
