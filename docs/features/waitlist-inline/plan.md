# Plan: Waitlist inline

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `serveWaitlistJoin` in `apps/api/src/site/waitlist-join.ts` (the `POST /join` route) and `PAGE_SCRIPT` / `joinFormHtml` in `apps/api/src/site/landing-page.ts`
**Assumptions (decided, owner can override):**
- ADR 0067's choices are the ones built: `Accept` negotiation on `POST /join`, a render stamp signed with a key derived from `TURNSTILE_SECRET_KEY`, the `website` honeypot, a visible `flexible` widget.
- No new Worker secret and no migration; the deploy is the runbook as it stands plus the check lines step 13 adds.
- The minimum applies on every host, local included; E2E joins take the product's 3-second hold, never a test `sleep`.

## File map

One developer lane: the server answer, the markup and the page script meet in `landing-page.ts` and `waitlist-join.ts`, so splitting them would make two lanes edit the same files.

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src/constants.ts` (two constants), `apps/api/src/site/waitlist-stamp.ts` (new), `apps/api/src/site/waitlist-join.ts`, `apps/api/src/site/landing-page.ts`, `apps/api/src/site/site-endpoint.ts` (the `GET /` call only), `apps/api/src/site/join-form-markup.ts`, `apps/api/src/site/landing-copy.ts`, `apps/api/src/site/site-style.ts`, `apps/api/src/site/webmcp-script.ts`, `apps/api/src/site/webmcp-copy.ts`, `apps/api/test/waitlist-stamp.test.ts` (new), `apps/api/test/waitlist-join.test.ts`, `apps/api/test/waitlist-client.ts`, `apps/api/test/site-pages.test.ts`, `apps/api/test/webmcp-tools.test.ts`, `apps/api/e2e/landing.spec.ts`, `apps/api/e2e/landing-seo.spec.ts`, `apps/api/e2e/turnstile-stub.ts`, `apps/api/e2e/model-context-stub.ts`, `docs/features/waitlist-inline/tester-briefing.md` | `developer` (worktree `todz-lanes/waitlist-inline`) |
| Lead | `docs/runbooks/deploy-the-api.md`, `apps/api/README.md` (only if its purpose line names the plain form), `docs/features/waitlist-inline/*` status lines, `docs/features/README.md`, the deploy and the production check | the lead |

## Sequencing

G1 runs steps 1–12 in order: each red commit lands alone before its green. The lead takes step 13 while G1 is on steps 9–12 (the runbook touches no G1 file). The tester runs after step 12 and the briefing; the reviewer and the security reviewer after the tester; the deploy (step 14) after the merge to `main`; the production check (step 15) right after it.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [x] **Step 1:** Red, the stamp. `libs/types/src/constants.ts` gains `WAITLIST_MINIMUM_FILL_MS = 2 * MILLISECONDS_PER_SECOND` and `WAITLIST_FILL_HOLD_MS = 3 * MILLISECONDS_PER_SECOND`. `waitlist-stamp.ts` exports the `StampVerdict` enum (`Patient`, `Missing`, `Forged`, `TooFast`), `renderStampOf({ secret, renderedAt })` and `stampVerdictOf({ secret, stamp, now })`, both throwing `renderStampOf is not implemented` / `stampVerdictOf is not implemented`. `waitlist-stamp.test.ts`: a stamp matches `^\d{13}\.[A-Za-z0-9_-]{43}$`; it verifies `Patient` at exactly `renderedAt + WAITLIST_MINIMUM_FILL_MS`; `TooFast` one millisecond earlier; `Forged` when `now < renderedAt`, when one character of the signature changes, when the time changes and the signature does not, when signed with another secret, for `"1"`, `"abc.def"` and a 5 000-character string; `Missing` for `""` and `undefined`; two stamps of the same time and secret are equal; `WAITLIST_MINIMUM_FILL_MS < WAITLIST_FILL_HOLD_MS`. Red on `renderStampOf is not implemented`. Evidence: red 64ac26f.
- [x] **Step 2:** Green. HKDF-SHA-256 from the secret (empty salt, info `todz waitlist render stamp`) to an HMAC-SHA-256 key, cached per secret value at module level so a render derives once per isolate; sign `waitlist:<renderedAt>`; base64url without padding; verify with `crypto.subtle.verify`. No `??`; an absent or malformed stamp returns `Missing` or `Forged` explicitly. Evidence: green d0406ee.
- [x] **Step 3:** Red, the JSON answer. `waitlist-client.ts` gains a JSON variant of its join post (`Accept: application/json`) and a helper that signs a stamp `renderedAt = now - WAITLIST_FILL_HOLD_MS` with the test secret; the existing HTML tests pass a stamp and keep their expectations. `waitlist-join.test.ts`, new describe "a JSON join answers an outcome and never the address": a new address → 200, `Content-Type: application/json`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Vary: Accept`, body exactly `{"outcome":"joined"}`, the row and one mail; the same address again → the same answer, no second mail; a body of `text/plain` → 400 `{"outcome":"invalid"}`; `email=not-an-address` → 400 `invalid`; no `cf-turnstile-response` → 403 `{"outcome":"check-failed"}`; `cf-turnstile-response=bad token!` → 403 `check-failed`, no siteverify call; a refusing siteverify → 403 `check-failed`; an unreachable siteverify → 503 `{"outcome":"opens-soon"}`; each of the three limiters refusing → 429 `{"outcome":"try-again"}`, `Retry-After: 60`; a missing limiter, site key, secret or client address → 503 `opens-soon` and no body read; a failing store → 429 `try-again`; no answer body contains the address; every HTML answer also carries `Vary: Accept`. Red on `expected 'text/html; charset=utf-8' to be 'application/json'`. Evidence: red cb34b19.
- [x] **Step 4:** Green. `JoinOutcome` enum and a record of status per outcome; the join computes an outcome; `serveWaitlistJoin` answers JSON when `Accept` names `application/json`, else maps the outcome to `LandingNotice` (`invalid` and `check-failed` → `TryAgain`) and answers the page as today; `Retry-After` on `try-again` (JSON) and `TryAgain` (HTML); `Vary: Accept` on both. Evidence: green 255bbc9.
- [x] **Step 5:** Red, honeypot and stamp in the join. `waitlist-join.test.ts`, describe "a bot's join answers joined and keeps nothing": `website=https://spam.example` with a valid stamp and token → JSON 200 `joined` and HTML 200 joined, no row, no mail, no siteverify call; `website=` (empty) → a normal join; no `stamp` field → 403 `check-failed` (HTML 429), no row; a stamp signed with another secret → 200 `joined`, no row, no mail, no siteverify call; a stamp rendered 1 999 ms before `now` → the same; a stamp from 1 s in the future → the same; a stamp rendered exactly 2 000 ms before → stored, one mail; a honeypot plus a missing token → 403 `check-failed` (the token check comes first). Red on `expected 1 to be 0` (the row count). Evidence: red e781b0d.
- [x] **Step 6:** Green. The form schema gains `stamp` and an optional `website`; the checks run in ADR 0067 §5's order with `Date.now()` read once per join. Evidence: green bd4484b.
- [x] **Step 7:** Red, the markup. `site-pages.test.ts`, the landing with both keys: each form holds one `input[type=hidden][name=stamp]` whose value `stampVerdictOf` finds `Patient` with the test secret at its time plus the minimum; one `.join-extra[aria-hidden="true"]` holding a `label` for `input[name=website][type=text][tabindex="-1"][autocomplete=off]`; the widget `data-appearance="always"`, `data-size="flexible"`, `data-theme="auto"`, `data-action="waitlist"` and the four callback attributes; one `p[role=status]#<form>-notice` holding the note; no attribute matching `^on` anywhere; two GETs carry different stamps (rendered at different times through a stubbed clock) and the same policy; the policy has no `'unsafe-inline'`, no `'unsafe-eval'`, `script-src` of hashes plus `https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`, `connect-src 'self'`, `form-action 'self'`; without the secret the page has no stamp and no widget. Red on `expected null not to be null` (the stamp input). Evidence: red 5af9f0e.
- [x] **Step 8:** Green. `serveLandingPage({ notice, siteKey, stampSecret })`, where `stampSecret` is the Turnstile secret already required by `siteKeyOf`; `site-endpoint.ts` and `waitlist-join.ts` pass it; `joinFormHtml` writes the stamp, the honeypot, the `.join-check` frame and the always-present status line; `LANDING_COPY.join` gains the design's keys; `site-style.ts` gains `.join-check`, `.join-extra` and the `[aria-disabled="true"]` look if missing. The page script stays one fixed source. Evidence: green 509b58b.
- [x] **Step 9:** Red, the page in a browser. `turnstile-stub.ts` gains a `window.turnstile` with `reset(container)` that counts resets in `document.documentElement.dataset.turnstileResets` and solves again; a stub that never solves. `landing.spec.ts` describe "join" is rewritten (the navigation tests below are struck in their commit with "the join no longer navigates, ADR 0067"): Evidence: red 94f701e.
  - for each form: a join shows "You're on the list. Check your inbox." in `#<form>-notice`, no `load` or `framenavigated` event after the first load, `page.url()` unchanged, exactly one `POST /join` carrying `Accept: application/json`, `cf-turnstile-response`, `stamp` and an empty `website`, answered 200 `{"outcome":"joined"}`, the field emptied, the address nowhere in the page, the server log one mail to it;
  - the button carries `aria-disabled="true"` until the token, then none; with the never-solving stub a press posts nothing and shows "Finish the check below to join.";
  - after an answer the reset count is 1 and the button waits for the new token;
  - the same address twice → the same line both times, one mail in the server log;
  - the honeypot filled through `locator.evaluate` → the joined line, no mail; then a real join of that address after a reload → one mail (proving nothing was kept);
  - with `page.clock` fast-forwarded past the hold on a fresh load → the joined line, no mail; a real join of that address afterwards → one mail;
  - each answer fulfilled by `page.route`: 400 `invalid`, 403 `check-failed`, 503 `opens-soon`, an aborted request, a 200 HTML body → each line of the design's table, label restored, reset count 1;
  - 429 `try-again` with `Retry-After: 2` fulfilled, under `page.clock` → the line, the button `aria-disabled` after the new token until the clock passes 2 s, then ready;
  - a request post with no token and `Accept: application/json` → 403 `{"outcome":"check-failed"}`; with `cf-turnstile-response=bad token!` → 403 the same;
  - with JavaScript disabled, a press posts the form, the browser lands on `/join#hero` with "Couldn't add you right now. Try again in a minute." and status 429 (no token without JavaScript);
  - the policy header strict as in step 7, and zero `securitypolicyviolation` events and zero console errors through a join;
  - at 375 px and 1280 px, light and dark: the widget's box lies inside its form's box and the viewport, no horizontal scroll, `data-theme="auto"`;
  - the Turnstile script blocked by `page.route` abort → the button stays `aria-disabled` and the line reads "The check couldn't load. Reload the page to try again." after `load`.
  Red on the first assertion of the no-navigation test (`page.url()` is `…/join#hero`).
- [x] **Step 10:** Green. `PAGE_SCRIPT` rewritten per ADR 0067 §7: `data-join-state`, the hold from `performance.now()`, `fetch` with `new URLSearchParams(new FormData(form))`, outcome copy embedded with `scriptJson` at module load, `turnstile.reset` per form, `Retry-After`, the `waitlist-answered` event, the script-missing check on `load`, `pageshow` restore kept. Still one fixed source with one hash. Evidence: green 7eae45c.
- [x] **Step 11:** Red, WebMCP. `webmcp-tools.test.ts`: the copy has the design's answers and no `sent`; the join tool's description says it waits for the human check and answers with the result. `landing-seo.spec.ts` (`model-context-stub.ts` unchanged unless it needs an awaited `execute`): `join_waitlist` with a fresh address returns the joined answer and the page shows the joined line with no navigation; with the never-solving stub and the tool's wait shortened by `page.clock`, it returns `checkTimedOut` and posts nothing; an invalid address returns `invalid` and posts nothing and restores the field; a second call while the first is `sending` returns `alreadySubmitting` and one `POST /join` leaves. Red on the tool returning the old "sent" text. Evidence: red b1ef411.
- [x] **Step 12:** Green. `webmcp-script.ts` per ADR 0067 §8 (30-second wait constant at the top of the file; no `fetch`); `webmcp-copy.ts`. Then the tester briefing: what changed, how to run `pnpm --filter @todz/api test` and the E2E, the red and green commits with the failure texts the red runs printed, every "it works" stated as a hypothesis. Evidence: green f0d327d.

### Developer notes (G1)

- `JoinOutcome` lives in `join-form-markup.ts`, not `waitlist-join.ts`: `landing-page.ts` embeds it in the page script and `waitlist-join.ts` imports `landing-page.ts`, so the enum in `waitlist-join.ts` would be a cycle.
- `Accept` and `Vary` are local constants in `waitlist-join.ts`: `http-header.ts` is not in G1's file map. A follow-up can move them into `HttpHeader`.
- `apps/api/e2e/server-log.ts` is new (the mail count of an address in the server log); `admin.spec.ts` keeps its own copy because it is not G1's file.
- `ERRORING_TURNSTILE_STUB` is gone: the submit-time error tests it served were struck with the navigation tests (the join no longer navigates, ADR 0067).
- `webmcp-tools.test.ts`: the "no network call" pin now holds for `WEBMCP_SCRIPT` only; `PAGE_SCRIPT` makes exactly one, the join `fetch` (step 10).
- Unit tests that compare the HTML answer with the page this module renders strip the stamp value first (`withoutStamps`), since each render carries its own.

### Lead

- [ ] **Step 13:** `docs/runbooks/deploy-the-api.md` step 14: beside the HTML waitlist probe (its expectation stays `429` with both keys), a JSON probe of the same body with `-H "Accept: application/json"` expecting `403` and `{"outcome":"check-failed"}`, and the count of the probe address unchanged; a note that rotating `TURNSTILE_SECRET_KEY` also rotates the waitlist stamps, so open tabs' next join keeps nothing. `apps/api/README.md` only if it names the plain form.

### Deploy and production check (lead, after the merge to `main`)

- [ ] **Step 14:** Deploy by `docs/runbooks/deploy-the-api.md` steps 1–17 from the merged `main`: no migration is unapplied (step 7 lists none), no secret is put (step 10 lists `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY`), step 14's three probes answer as step 13 wrote them; record the run log rows.
- [ ] **Step 15:** Production check, recorded in the run log and the PR:
  - Playwright MCP on `https://todz.app/` at 1280 × 800 light, 1280 × 800 dark and 375 × 812: both widgets visible, framed under the capsule, no horizontal scroll; screenshots into `.pr-media/waitlist-inline/production/`.
  - A real join from the hero form with `hello+waitlist-inline@todz.app`: no navigation, the joined line; then `SELECT COUNT(*) FROM waitlist WHERE address = 'hello+waitlist-inline@todz.app'` through `scripts/todz-cloudflare.sh … d1 execute todz-directory --remote` answers `1`, the row the admin panel lists. The probe row stays.
  - `curl -sS -X POST -H "Accept: application/json" -H "Content-Type: application/x-www-form-urlencoded" --data "email=nobody%40example.com" https://todz.app/join -w "\n%{http_code}\n"` → `{"outcome":"check-failed"}` and `403`; the same without `Accept` → `429`; the count of `nobody@example.com` stays `0`.
  - The policy header of `https://todz.app/` has no `'unsafe-inline'` and names `connect-src 'self'`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | HKDF or `verify` missing in the Workers runtime of the tests | `waitlist-stamp.test.ts` throws `NotSupportedError` | Derive with an HMAC of the label under the secret (`HMAC(secret, "todz waitlist render stamp")`) as the key; record it in the ADR |
| 2, 8 | Per-render signing breaks the landing's work-count budget (ADR 0061) | `work-budgets.test.ts` red in `pnpm verify` | Cache the derived key per isolate (already in step 2); if still over, raise the budget in the same commit with the measured number and the reason |
| 4 | The HTML answer changes for the no-JavaScript post | the HTML tests of `waitlist-join.test.ts` red | Restore the outcome-to-notice map; the HTML statuses are pinned |
| 6 | A real join is dropped silently (clock or order wrong) | E2E joins show the line but no mail in the server log | Revert step 6's commit; the join works without the stamp until fixed |
| 8 | The page script's hash changes per render | the policy differs between two GETs in step 7's test | Keep the stamp in the markup only, never in a script |
| 10 | `aria-disabled` never clears with the real widget | the production walk's button stays dimmed | Roll back the Worker version (runbook Rollback) |
| 10 | The hold or the reset leaves a form stuck in `sending` | E2E times out on the label "Joining…" | Fix forward; the HTML post still works without the script |
| 12 | `join_waitlist` waits forever | the E2E with the never-solving stub times out | The 30-second bound; fix forward |
| 14 | The deploy fails or the smoke checks fail | runbook step 8 or 13 output | The runbook's Rollback to the previous version; no data changed |
| 15 | Turnstile challenges or refuses the automated browser in production | the widget shows a failure or keeps asking | The owner joins by hand from his browser and the count query confirms it; recorded as the owner's step |
| 15 | A scripted post without a token is accepted | `200` or a count of `1` for `nobody@example.com` | Detach `todz.app` as the runbook's Rollback says and tell the owner |

**Steps with no backout:** 15's real join keeps its probe row (deleting data is the owner's call).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** a fresh `security-reviewer` returned `CLEAR` or findings fixed.
- [ ] **/check-ui:** screenshots and video recorded and uploaded (the landing's forms changed).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
