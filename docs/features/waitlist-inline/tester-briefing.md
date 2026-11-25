# Tester briefing: Waitlist inline

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/types/src/constants.ts`: `WAITLIST_MINIMUM_FILL_MS` (2 s) and `WAITLIST_FILL_HOLD_MS` (3 s).
- `apps/api/src/site/waitlist-stamp.ts` (new): `renderStampOf` and `stampVerdictOf`, the render stamp signed with a key derived by HKDF from `TURNSTILE_SECRET_KEY`, the derived key cached per secret.
- `apps/api/src/site/waitlist-join.ts`: the join computes a `JoinOutcome`; `Accept: application/json` answers `{"outcome": ...}` with 200, 400, 403, 429 (`Retry-After: 60`), 503 and `no-store`, `nosniff`, `Vary: Accept`; any other `Accept` answers the landing HTML as before, statuses unchanged, plus `Vary: Accept`. New checks in ADR 0067 §5 order: token shape, stamp present, honeypot, stamp verdict, then siteverify. A filled honeypot or a stamp that is forged, from the future or younger than 2 s answers `joined` and keeps nothing.
- `apps/api/src/site/join-form-markup.ts`: field names, `JoinFormState`, `JoinOutcome`, the `waitlist-answered` event and the unreachable answer, shared by both page scripts.
- `apps/api/src/site/landing-page.ts`: `serveLandingPage({ notice, siteKey, stampSecret })` writes the stamp and the honeypot in each form, wraps the widget (`always`, `flexible`, `auto`) in `.join-check`, always renders the status line (`role="status"`), and the page script joins in place: `data-join-state`, `aria-disabled` until the token, the 3 s hold from `performance.now()`, one `fetch` of `/join`, the outcome's line, `turnstile.reset` after every answer, `Retry-After`, and the missing-script check on `load`. One fixed script, one hash.
- `apps/api/src/site/webmcp-script.ts`, `webmcp-copy.ts`: `join_waitlist` waits up to 30 s for the form to be ready, submits through the page and answers with the outcome's copy; `checkTimedOut`, `alreadySubmitting`, `invalid` and one answer per outcome. No `sent`.
- `apps/api/src/site/landing-copy.ts`, `site-style.ts`, `site-endpoint.ts`: the six new join lines, `.join-check` and `.join-extra`, the `GET /` call passing the secret.
- Tests: `waitlist-stamp.test.ts` (new), `waitlist-join.test.ts`, `waitlist-client.ts`, `site-pages.test.ts`, `webmcp-tools.test.ts`; E2E `landing.spec.ts`, `landing-seo.spec.ts`, `turnstile-stub.ts`, new `server-log.ts`.

## How to run

```bash
pnpm install --frozen-lockfile
pnpm --filter @todz/api test:unit
pnpm --filter @todz/api test:e2e
pnpm verify
```

The E2E config serves the site on port 8791 and the inspector on 9291, fixed: run one E2E at a time on a machine. Each real join takes the product's 3 s hold. To look at the page by hand: `pnpm --filter @todz/api dev:site` serves `http://localhost:8788` with the Turnstile test keys (the always-pass widget).

## Red today, green after

Failure texts are the ones the red runs printed.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `waitlist-stamp.test.ts` (14 of 15) | `Error: renderStampOf is not implemented` (red commit 64ac26f; the `stampVerdictOf` rows that never reach it print `stampVerdictOf is not implemented`); the last row is a pin | d0406ee |
| `waitlist-join.test.ts` "a JSON join answers an outcome and never the address" and the `Vary` assertions of the HTML answers (71 failed, 5 passed in the file) | `AssertionError: expected 'text/html; charset=utf-8' to be 'application/json'`, `expected null to be 'Accept'` (the `Vary` header), `expected 429 to be 403`, `expected 429 to be 400` (red cb34b19) | 255bbc9 |
| `waitlist-join.test.ts` "a bot's join answers joined and keeps nothing" (7 failed) | `AssertionError: expected [ { …(4) } ] to deeply equal []` (the row or the mail was kept), `expected 200 to be 403`, `expected 200 to be 429` for a missing stamp (red e781b0d) | bd4484b |
| `site-pages.test.ts` "the landing joins in place behind a stamp, a honeypot and a visible check" (9 failed; the no-handler and policy rows are pins) | `AssertionError: expected [ +0, +0 ] to deeply equal [ 1, 1 ]` (the stamp inputs), `expected null not to be null` (the honeypot), `expected '<div class="cf-turnstile" data-siteke…' to contain 'data-appearance="always"'`, `expected '<form id="join" …' to match /<p id="join-notice"…/` (red 5af9f0e) | 509b58b |
| `landing.spec.ts` "join" (16 failed per project on the desktop run) | `Expected: "http://localhost:8791/"  Received: "http://localhost:8791/join#join"` on the first assertion of the no-navigation test; the rest time out waiting for `#join-notice` or `aria-disabled` (red 94f701e). Pins in that commit: the two JSON posts with no token and a bad token, the no-JavaScript post, the policy and violations, the widget fit in both schemes, the console, the direct `GET /join` | 7eae45c |
| `webmcp-tools.test.ts` "the WebMCP copy" (2 failed) | `expected [ 'alreadySubmitting', …(10) ] to deeply equal [ 'alreadySubmitting', …(9) ]` and `expected 'Join the todz waitlist with an email …' to contain 'waits for'` (red b1ef411) | f0d327d |
| `landing-seo.spec.ts` three `join_waitlist` tests | the answer array holds `"The form was submitted. The page may ask the person for a quick human check before it finishes, and then shows the result."` where `"The address is on the waitlist; a confirmation mail is on its way if it is new."` is expected (red b1ef411) | f0d327d |

Pins (green when they landed): the last row of `waitlist-stamp.test.ts`; the no-handler and policy rows of the markup describe; the no-token JSON post, the no-JavaScript post, the policy and violations, the widget fit and the direct `GET /join` rows of `landing.spec.ts`; the invalid-address and restore-the-field rows of `landing-seo.spec.ts`.

Counts at f0d327d: 77 unit files, 1972 tests; E2E 137 passed and 6 skipped across both projects; `pnpm verify` green on 8 gates.

## Hypotheses to attack

1. Hypothesis: no join navigates. Break it by joining from both forms on 1280 and 375, with the keyboard (Enter in the field) and with a double click, and watching the network and `framenavigated`.
2. Hypothesis: a bot that fills `website`, forges or replays an old stamp, or posts under 2 s is told `joined` and nothing is stored or mailed. Break it by posting by hand: a stamp from another site, a stamp edited by one character, a stamp from the future, the honeypot with a space (a non-empty value counts as filled), the stamp of one render used twice (it is accepted twice by design: only the age is checked).
3. Hypothesis: a post with no token never reaches siteverify and never joins, JSON or HTML. Break it with a missing token, a 2 049-character token, a token with a space, a valid token of another action, a token replayed.
4. Hypothesis: the answers never reveal whether an address is on the list. Break it by joining one address from two browsers and diffing the status, headers and body; check timing is not the tell either.
5. Hypothesis: the button is `aria-disabled` from load until the token and again after every answer until the new one; a press while waiting posts nothing. Break it with the real Turnstile widget (not the stub): solve, join, watch the reset; let the token expire; block `challenges.cloudflare.com`.
6. Hypothesis: a `try-again` with `Retry-After` keeps the button waiting even with a fresh token. Break it by refusing the limiter with the real Worker (ten joins a minute from one client on a public host) and reading the button.
7. Hypothesis: the expired callback before any solve and the error callback show the "check couldn't load" line, and an expiry after a solve does not. The three callbacks share one function, so the line depends on whether the widget ever solved. Break it by letting a real token expire.
8. Hypothesis: the hold is 3 s from navigation start, so a person typing for longer never waits and a fast agent waits at most 3 s. Break it with `join_waitlist` on a fresh load and with a slow machine (CPU throttle).
9. Hypothesis: the policy stays hash-based and the new script hash is the only change. Break it by reading the header on two renders and on every notice page.
10. Hypothesis: `join_waitlist` answers `alreadySubmitting` for the second of two simultaneous calls and `checkTimedOut` after 30 s without a token. Break it with three calls at once and a call made while the form is `sending` from a human press.

## Known gaps

- No Playwright MCP walk, no production widget: the stub stands in for Turnstile, so the real `flexible` iframe's fit and the dark theme are unproven here.
- The clock-driven E2E rows need the Worker to answer within 2 s of the render: on a very slow machine the "faster than the minimum" row could see a patient stamp and fail.
- Retry-After blocking is client-side only; the server's per-minute limiter is the authority.
- `Accept` and `Vary` are local constants in `waitlist-join.ts` (`http-header.ts` is not in G1's file map); `JoinOutcome` lives in `join-form-markup.ts` to avoid an import cycle with `landing-page.ts`. Both are noted in `plan.md`.
- `admin.spec.ts` keeps its own server-log reader; `e2e/server-log.ts` is new and a follow-up can fold the two.
- Work-count budgets (ADR 0061) passed in `pnpm verify`; the per-render HKDF is cached per secret but the HMAC still runs once per render.
- Steps 13 to 15 (runbook, deploy, production check) are the lead's and untouched.
