# Test plan: Waitlist inline

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Copy referenced below, from `LANDING_COPY.join`: JOINED "You're on the list. Check your inbox.", TRY_AGAIN "Couldn't add you right now. Try again in a minute.", OPENS_SOON "The waitlist opens soon.", INVALID "That address doesn't look right.", CHECK_FAILED "The check didn't pass. Try it again.", UNREACHABLE "Couldn't reach todz. Check your connection and try again.", CHECK_ERROR "The check couldn't load. Reload the page to try again.", WAITING "Finish the check below to join.", NOTE "Only to tell you when todz opens.".

## The failing test first

- [ ] `apps/api/test/waitlist-stamp.test.ts` — committed red alone; expected failure `renderStampOf is not implemented`.
- [ ] `apps/api/test/waitlist-join.test.ts` (JSON describe) — committed red alone; expected failure `expected 'text/html; charset=utf-8' to be 'application/json'`.
- [ ] `apps/api/test/waitlist-join.test.ts` (bot describe) — committed red alone; expected failure `expected 1 to be 0` on the row count.
- [ ] `apps/api/test/site-pages.test.ts` (markup) — committed red alone; expected failure `expected null not to be null` on the stamp input.
- [ ] `apps/api/e2e/landing.spec.ts` (join) — committed red alone; expected failure on `page.url()` being `…/join#hero`.
- [ ] `apps/api/e2e/landing-seo.spec.ts` (WebMCP join) — committed red alone; expected failure on the old "sent" answer.
- [ ] Confirmed each red run printed the failure above for the missing feature, not a broken test: the tester checks out each red commit in a throwaway worktree, runs the named test and records the printed text.

## Unit

### The stamp (`waitlist-stamp.test.ts`)

- [ ] Shape — input: `renderStampOf({ secret: "s", renderedAt: 1764000000000 })`; expected: matches `^\d{13}\.[A-Za-z0-9_-]{43}$`.
- [ ] Deterministic — input: the same call twice; expected: equal strings.
- [ ] Boundary accepted — input: `now = renderedAt + 2000`; expected: `Patient`.
- [ ] Boundary refused — input: `now = renderedAt + 1999`; expected: `TooFast`.
- [ ] Future — input: `now = renderedAt - 1`; expected: `Forged`.
- [ ] Tampered signature — input: one signature character changed; expected: `Forged`.
- [ ] Tampered time — input: the time part changed, signature kept; expected: `Forged`.
- [ ] Other secret — input: signed with `"other"`, checked with `"s"`; expected: `Forged`.
- [ ] Malformed — inputs `"1"`, `"abc.def"`, `"."`, a 5 000-character string; expected: `Forged` each.
- [ ] Absent — inputs `""` and `undefined`; expected: `Missing` each.
- [ ] Constants — expected: `WAITLIST_MINIMUM_FILL_MS` is 2 000, `WAITLIST_FILL_HOLD_MS` is 3 000, minimum < hold.

### The JSON answer (`waitlist-join.test.ts`)

- [ ] New address, `Accept: application/json` — expected: 200, `Content-Type: application/json`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Vary: Accept`, body exactly `{"outcome":"joined"}`, one row, one mail.
- [ ] Duplicate — input: the same address again; expected: 200 `{"outcome":"joined"}`, byte-identical body and headers to the first except `Date`, still one row, still one mail.
- [ ] Case and spaces — input: `" Maria@Example.COM "` after `maria@example.com`; expected: 200 `joined`, one row, no second mail.
- [ ] Wrong media type — input: `Content-Type: text/plain`; expected: 400 `{"outcome":"invalid"}`, no row.
- [ ] Oversized body — input: 5 KB; expected: 400 `invalid`, no row.
- [ ] Bad address — input: `email=not-an-address`; expected: 400 `invalid`, no row, no siteverify call.
- [ ] Missing token — input: no `cf-turnstile-response`; expected: 403 `{"outcome":"check-failed"}`, no siteverify call, no row.
- [ ] Malformed token — input: `cf-turnstile-response=bad token!`; expected: 403 `check-failed`, no siteverify call.
- [ ] Refused token — input: siteverify answers `success: false`; expected: 403 `check-failed`, no row.
- [ ] Wrong hostname — input: siteverify `success: true`, `hostname: evil.example`; expected: 403 `check-failed`.
- [ ] Wrong action — input: siteverify `success: true`, `action: sign_in`; expected: 403 `check-failed`.
- [ ] siteverify unreachable — input: the fetcher rejects; expected: 503 `{"outcome":"opens-soon"}`, no row.
- [ ] siteverify own fault — input: `error-codes: ["invalid-input-secret"]`; expected: 503 `opens-soon`.
- [ ] Per-client limit — input: `WAITLIST_LIMITER` refuses; expected: 429 `{"outcome":"try-again"}`, `Retry-After: 60`, body not read.
- [ ] Per-address limit — input: `WAITLIST_ADDRESS_LIMITER` refuses; expected: 429 `try-again`, `Retry-After: 60`, no row.
- [ ] Global limit — input: `WAITLIST_GLOBAL_LIMITER` refuses; expected: 429 `try-again`, `Retry-After: 60`, no row.
- [ ] Missing limiter binding — expected: 503 `opens-soon`, body not read.
- [ ] Missing client address header (public host) — expected: 503 `opens-soon`.
- [ ] Missing site key or secret — expected: 503 `opens-soon`, body not read.
- [ ] Store fails — input: D1 rejects; expected: 429 `try-again`.
- [ ] No echo — for every case above: the body does not contain the posted address.
- [ ] `Accept: text/html, application/json;q=0.9` — expected: JSON (any naming of `application/json` selects it).
- [ ] No `Accept` — expected: the HTML page, as below.

### The HTML answer stays (`waitlist-join.test.ts`)

- [ ] New address, no `Accept` — expected: 200 HTML with the JOINED notice in `#join-notice`, `Vary: Accept`.
- [ ] Missing token — expected: 429 HTML with TRY_AGAIN, `Retry-After: 60`.
- [ ] Bad address — expected: 429 HTML with TRY_AGAIN.
- [ ] Unguarded — expected: 503 HTML with OPENS_SOON.
- [ ] The answered page carries a fresh stamp in each form.

### Bots (`waitlist-join.test.ts`)

- [ ] Honeypot filled — input: `todz_fax=https://spam.example`, valid stamp, accepted token; expected: JSON 200 `joined`, HTML 200 JOINED, no row, no mail, one siteverify call, a client-limit slot spent.
- [ ] Honeypot filled, token refused — expected: 403 `check-failed`, no row.
- [ ] Honeypot empty — input: `todz_fax=`; expected: a normal join, one row.
- [ ] Honeypot absent — input: no `todz_fax` field; expected: a normal join, one row.
- [ ] Honeypot and no token — expected: 403 `check-failed` (the token check is first).
- [ ] Stamp missing — expected: JSON 403 `check-failed`, HTML 429 TRY_AGAIN, no row.
- [ ] Stamp forged — input: signed with another secret, accepted token; expected: 200 `joined`, no row, no mail, one siteverify call.
- [ ] Stamp forged, token refused — expected: 403 `check-failed`, no row.
- [ ] Too fast — input: rendered 1 000 ms before `now`; expected: 200 `joined`, no row, no mail. The 1 999 and 2 000 ms boundary is proven only in `waitlist-stamp.test.ts`.
- [ ] Future stamp — input: rendered 1 000 ms after `now`; expected: 200 `joined`, no row, no mail.
- [ ] Patient — input: rendered 2 500 ms before `now`; expected: 200 `joined`, one row, one mail.

### The page markup (`site-pages.test.ts`)

- [ ] Stamp field — expected: each form has one `input[type=hidden][name=stamp]` that verifies `Patient` with the test secret at its render time plus 2 000 ms.
- [ ] Honeypot — expected: each form has `.join-extra[aria-hidden="true"]` with a `label` for `input[name=website][type=text][tabindex="-1"][autocomplete=off]`, and no `display:none` on it.
- [ ] Widget — expected: `data-appearance="always"`, `data-size="flexible"`, `data-theme="auto"`, `data-action="waitlist"`, `data-callback`, `data-error-callback`, `data-expired-callback`, `data-timeout-callback`.
- [ ] Status region — expected: one `p[role=status]#join-notice` and one `#final-notice` holding NOTE.
- [ ] No inline handlers — expected: no attribute name starting with `on` in the HTML.
- [ ] Two renders — expected: different stamps, the same `Content-Security-Policy`.
- [ ] Strict policy — expected: no `'unsafe-inline'`, no `'unsafe-eval'`; `script-src` is only `'sha256-…'` hashes and `https://challenges.cloudflare.com`; `frame-src https://challenges.cloudflare.com`; `connect-src 'self'`; `form-action 'self'`; `default-src 'none'`.
- [ ] Without the secret — expected: no stamp, no widget, the policy without the Turnstile origin.

### WebMCP (`webmcp-tools.test.ts`)

- [ ] Copy — expected: `WEBMCP_COPY.answers` has `joined`, `invalid`, `checkFailed`, `tryAgain`, `opensSoon`, `unreachable`, `checkTimedOut`, `alreadySubmitting`, and no `sent`.
- [ ] Description — expected: the join tool's description says it waits for the page's human check and answers with the result.
- [ ] Scripts — expected: `PAGE_SCRIPT` and `WEBMCP_SCRIPT` contain no `fetch(` in `WEBMCP_SCRIPT` and exactly one in `PAGE_SCRIPT`.

## E2E (Playwright specs)

`apps/api/e2e/landing.spec.ts`, desktop (1280) and mobile (375) projects, the Turnstile stub unless stated.

- [ ] No navigation, hero — steps: open `/`, type a fresh address, press Join; expected: JOINED in `#join-notice`, zero `load` and zero `framenavigated` events after the first load, `page.url()` unchanged, one `POST /join` with `Accept: application/json`, `cf-turnstile-response`, `stamp`, empty `todz_fax`, answered 200 `{"outcome":"joined"}`; the field empty; the address nowhere in the DOM; the server log holds one mail to it.
- [ ] No navigation, final — the same from the final form, JOINED in `#final-notice`.
- [ ] Disabled until token — steps: open `/` with the never-solving stub; expected: both buttons `aria-disabled="true"`, `data-join-state="waiting"`; a press posts nothing and shows WAITING.
- [ ] Ready on token — steps: the stub solves; expected: no `aria-disabled`, `data-join-state="ready"`.
- [ ] Reset after every answer — steps: one join; expected: `data-turnstile-resets` is `1` and the button waits for the new token before it is ready.
- [ ] Hold — steps: press Join at once on load; expected: the label "Joining…" until at least 3 s after navigation start, then one post.
- [ ] Duplicate — steps: join an address, then the same address again after the new token; expected: JOINED both times, one mail in the server log.
- [ ] Honeypot — steps: fill `todz_fax` through `locator.evaluate`, join; expected: JOINED; after the reload and before the second press the mail count of the address is 0; then join it normally: exactly one mail.
- [ ] Too fast — steps: `page.clock.install()`, load, `fastForward` past 3 s, join within 2 s of the render; expected: JOINED, no mail; then count mails (0) and join the same address in a new browser context without `page.clock`: exactly one mail.
- [ ] Invalid answer — steps: `page.route` fulfils 400 `{"outcome":"invalid"}`; expected: INVALID, label restored, reset count 1.
- [ ] Check failed — fulfils 403 `{"outcome":"check-failed"}`; expected: CHECK_FAILED, reset count 1.
- [ ] Opens soon — fulfils 503 `{"outcome":"opens-soon"}`; expected: OPENS_SOON.
- [ ] Try again with Retry-After — fulfils 429 `{"outcome":"try-again"}`, `Retry-After: 2`, under `page.clock`; expected: TRY_AGAIN, the button `aria-disabled` after the new token until the clock passes 2 s, then ready.
- [ ] Network error — `route.abort()`; expected: UNREACHABLE, label restored.
- [ ] Non-JSON answer — fulfils 200 `text/html`; expected: UNREACHABLE.
- [ ] Script blocked — the Turnstile script aborted; expected: after `load`, buttons stay `aria-disabled`, CHECK_ERROR in each status.
- [ ] Widget errors — the erroring stub; expected: the button back to `aria-disabled`, CHECK_ERROR, no post.
- [ ] Token expires — the expired callback fired; expected: `aria-disabled` until the stub solves again; no post.
- [ ] Back-forward cache — press Join, navigate to `/llms.txt` during the hold, go back; expected: no form stuck in `sending`, the button waits for or has its token.
- [ ] Missing token, scripted — `request.post('/join')` with `Accept: application/json`, `email` only; expected: 403 `{"outcome":"check-failed"}`.
- [ ] Bad token, scripted — the same with `cf-turnstile-response=bad token!`; expected: 403 `{"outcome":"check-failed"}`.
- [ ] No-JavaScript fallback — a context with `javaScriptEnabled: false`, press Join with an address; expected: the browser lands on `/join#hero`, status 429, TRY_AGAIN in `#join-notice`, no mail.
- [ ] Strict policy in the browser — through one join: zero `securitypolicyviolation` events, zero console errors, only the own origin and `challenges.cloudflare.com` requested.
- [ ] Light 1280 — expected: the widget box inside its form box and the viewport, `data-theme="auto"`.
- [ ] Dark 1280 (`colorScheme: dark`) — expected: the same; the dark tokens applied.
- [ ] 375 — expected: no horizontal scroll, the widget box inside the viewport, the capsule, widget and status stacked.
- [ ] Timeout — steps: `page.route` never fulfils `/join`, `page.clock` past 15 s; expected: UNREACHABLE, label restored, reset count 1.
- [ ] One form's token expires — steps: remove one form's token and call `waitlistTokenExpired`; expected: that form waiting, the other ready, no CHECK_ERROR.
- [ ] No widget — steps: the landing served without its widget; expected: the button ready at once, a press shows the server's answer.
- [ ] Keyboard — Tab from the email reaches the button with a visible focus ring, including while `aria-disabled`; the honeypot is never focused.
- [ ] Existing tests kept — the first fold, narrow screen, images, dark, reduced motion, assets, self-host, credit, keyboard and console groups pass unchanged.

`apps/api/e2e/landing-seo.spec.ts`:

- [ ] `join_waitlist` joins — input: `{ email: "maria.<unique>@example.com" }`; expected: the tool returns the joined answer, JOINED in `#join-notice`, no navigation, one `POST /join`.
- [ ] `join_waitlist` waits for the check — with the never-solving stub and `page.clock` past 30 s; expected: `checkTimedOut`, no post, the person's typed value restored.
- [ ] `join_waitlist` in a `try-again` wait — expected: `tryAgain`, not `checkTimedOut`.
- [ ] `join_waitlist` invalid — input: `{ email: "not-an-address" }`; expected: `invalid`, no post, the field's previous value restored.
- [ ] `join_waitlist` twice — the second call while the first is `sending`; expected: `alreadySubmitting`, one `POST /join`.
- [ ] `join_waitlist` refused — `page.route` fulfils 403 `check-failed`; expected: the tool returns `checkFailed`.
- [ ] The three other tools unchanged — the existing tests pass.

## Prove it for real — Playwright MCP

On `wrangler dev` (the E2E's site environment, Cloudflare's always-pass test keys):

- [ ] Happy path: open `/`, see the visible widget under the capsule in both forms, wait for the button to brighten, type an address, press Join; expected: "Joining…", then JOINED inline, the page never reloads (the scroll position stays), the widget resets.
- [ ] Empty: press Join with the field empty; expected: the browser's required-field bubble, no post.
- [ ] Single: one join; expected: JOINED.
- [ ] Many: join three different addresses in a row from the same tab; expected: JOINED each time, the widget reset between them.
- [ ] Rejected input: `not-an-address`; expected: the browser's email bubble, no post.
- [ ] Browser Back mid-flow: press Join, then Back during the hold; expected: the previous page, no error; Forward shows the form ready again.
- [ ] Reload mid-flow: reload during the hold; expected: a fresh form, no post or one post at most, never two.
- [ ] Two visitors in two browser contexts (`playwright`, `playwright-second`) joining the same address; expected: both see JOINED, one mail in the server log.
- [ ] Latency: Slow 3G throttle; expected: "Joining…" stays until the answer, then JOINED; offline: UNREACHABLE.
- [ ] Console and network clean: zero console errors, zero failed requests other than the deliberate abort.
- [ ] Desktop width 1280 × 800, light and dark; expected: the widget framed in the glass card.
- [ ] Narrow width 375 × 812, light and dark; expected: no horizontal scroll, stacked rows.
- [ ] Screenshots at `.pr-media/waitlist-inline/`; video at `.pr-media/waitlist-inline/join.mp4`.

## Production check (after the deploy, lead)

- [ ] Widget renders on `https://todz.app/` at 1280 light, 1280 dark and 375; expected: both widgets visible under the capsules; screenshots in `.pr-media/waitlist-inline/production/`.
- [ ] Real join with `hello+waitlist-inline@todz.app`; expected: JOINED inline, no navigation; the remote D1 count for that address is `1`.
- [ ] Scripted JSON post without a token; expected: `403` and `{"outcome":"check-failed"}`; the count of `nobody@example.com` stays `0`.
- [ ] Scripted HTML post without a token; expected: `429`.
- [ ] Policy header on production; expected: no `'unsafe-inline'`, `connect-src 'self'`.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: a real visitor's join is never dropped by the minimum time — attack: <how>; result: <refuted | held>
- [ ] Claim 2: no answer reveals whether an address is on the list — attack: <how>; result: <refuted | held>
- [ ] Claim 3: the page cannot post without a token, and the server keeps nothing without one — attack: <how>; result: <refuted | held>

## Coverage honesty

- The limits' 429 is proven by unit tests with refusing limiter stubs; a local site host skips the limiters, so no E2E reaches them. The production runbook's step 15 exercises the per-client limit on sign-in, not on the waitlist.
- The stamp proves only that the poster fetched the page at least 2 s before posting; one stamp can be replayed for ever, and the single-use token is what bounds it. Real autofill of the honeypot and 320 px are not under test.
- siteverify's refusal is proven by unit tests with a fake fetcher; the E2E uses Cloudflare's always-pass test keys and refuses only malformed tokens before siteverify.
- The look of the Turnstile iframe in light and dark is Cloudflare's; the tests prove its frame, size and theme attribute, and the screenshots show the rest.
- Whether Turnstile challenges an automated browser in production is not under test; the production check falls back to the owner's own browser if it does.
