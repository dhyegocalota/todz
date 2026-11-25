# A public owner route that answers differently for an account that exists tells so through `Server-Timing`

- Date: 2026-11-25
- Inspired by: the security review of the `performance` feature (the tester briefing's seventh hypothesis of Lane S), [ADR 0061](../adr/0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md) point 6
- Revisited: 2026-11-25 — still true (written the same day)

## Signal

A request to a public `/owner` route (the sign-in link, the session exchange) answers with `Server-Timing: directory;dur=<ms>, project;dur=<ms>`, unauthenticated. Today those routes do the same directory reads whatever the address, so the header tells nothing a caller cannot time from outside. The day a route reads the directory only when an account exists (a lookup that stops at the first miss, a second read for a known address), the header hands anyone the answer to "is this address registered" with a resolution of a tenth of a millisecond.

## Cause

`serveTimed` in `apps/api/src/index.ts` wraps every `/owner` request and `/mcp` request, and leaves the header off only for a 401 and for a socket upgrade. It cannot know which public route will one day branch on account existence, so the header sits on all of them.

## Do

Before a public `/owner` route branches on whether an account, an address or a key exists, make both branches do the same directory work, or take that route out of `serveTimed` in the same change and add a test that its answers carry no `Server-Timing`. Never time a route whose cost depends on a secret.

## Anchor

`apps/api/src/server-timing.ts` (`serveTimed`), `apps/api/src/index.ts`, `apps/api/test/server-timing.test.ts` (the 401 and socket cases that carry none).
