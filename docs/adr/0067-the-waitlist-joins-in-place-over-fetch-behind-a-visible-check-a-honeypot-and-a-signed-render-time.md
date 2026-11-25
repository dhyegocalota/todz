# 0067. The waitlist joins in place over fetch, behind a visible check, a honeypot and a signed render time

- Status: Accepted (the build loop's call, the owner may overturn it); amends [0050](0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md) §5 and [0060](0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md) §5 (`join_waitlist`)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked on 2026-11-25: "waitlist no site tem que ter captcha, se vira e deploy pra prod até o fim.. não queremos spam.. e não precisa recarregar a página pra add na lista", `todz-loop/PROMPT.md` → "Waitlist inline"
- Inspired by: [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md) (limits and Turnstile, failing closed), [ADR 0046](0046-the-app-solves-the-challenge-in-a-web-view-and-the-link-page-solves-it-for-the-sign-in.md) (one fixed page script, one hash), [ADR 0050](0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md) (the waitlist), [ADR 0060](0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md) (WebMCP over the form), the owner's zapbip join route (read-only reference)

## Context

The todz.app form posts a plain HTML form (ADR 0050 §5): every join reloads the page and lands on `/join#hero`. Its Turnstile widget uses `data-appearance="interaction-only"`, so a visitor never sees a human check and the owner reads the page as having none. The owner wants a visible captcha, no reload, and no spam, deployed to production.

The server side is already strict: the per-client limit, Turnstile siteverify on hostname and action, the per-address and global limits, one alike answer for every address, failing closed. What is missing is a cheap signal against scripted posts that do pass a token farm, a way to answer without a page, and a check the visitor sees.

## Decision

1. **One route, negotiated.** `POST /join` stays the only join path. A request whose `Accept` names `application/json` gets JSON; any other request gets today's HTML page with its notice, so the no-JavaScript post and its statuses are unchanged. Both answers carry `Vary: Accept`. The request body is the same `application/x-www-form-urlencoded` form in both cases, read by the same bounded reader.
2. **The JSON answer is an outcome, never an address.** `{"outcome": <JoinOutcome>}` with `Cache-Control: no-store` and `nosniff`:

   | Outcome | Status | When |
   |---|---|---|
   | `joined` | 200 | stored, already on the list, a filled honeypot, or a render stamp that is forged, from the future or too young |
   | `invalid` | 400 | an unreadable body or an address that does not normalise |
   | `check-failed` | 403 | a missing or malformed token, a missing render stamp, or siteverify refusing the token |
   | `try-again` | 429 + `Retry-After: 60` | a limit refused, or the store failed |
   | `opens-soon` | 503 | the guard is incomplete, a limiter or the client address is missing, or siteverify is unavailable |

   The HTML path maps `invalid` and `check-failed` to its existing "try again" notice (429), so its three notices and statuses stay as ADR 0050 left them. A duplicate answers `joined` with the same copy as a new address (ADR 0050 §2).
3. **The minimum time is a render stamp signed by the Worker.** Each landing render writes a hidden `stamp` field: `<renderedAt ms>.<base64url HMAC-SHA-256 of "waitlist:<renderedAt>">`. The HMAC key is derived with HKDF-SHA-256 from `TURNSTILE_SECRET_KEY` (empty salt, info `todz waitlist render stamp`), so no new secret exists and a deploy without the Turnstile secret already answers "opens soon". The join verifies the signature with `crypto.subtle.verify` and refuses, silently, a stamp younger than `WAITLIST_MINIMUM_FILL_MS` (2 000 ms, `libs/types`) or later than the Worker's clock. A missing stamp answers `check-failed`, so a tab opened before the deploy gets a visible "try again" rather than a silent drop; the page it reloads carries a stamp. The page script holds a submit until `WAITLIST_FILL_HOLD_MS` (3 000 ms, `libs/types`) after navigation start, so a fast agent through WebMCP is never refused by the server's minimum: the request reaches the Worker roughly as long after the render as the submit is after navigation start, and the extra second absorbs the jitter.
4. **A honeypot field, hidden accessibly.** Each form holds `<div class="join-extra" aria-hidden="true">` with a labelled `<input name="website" type="text" tabindex="-1" autocomplete="off">`, placed off screen by CSS (`position: absolute`, clipped), never `display: none`, so form-filling bots see an ordinary field. A non-empty `website` answers `joined`, stores nothing and sends no mail. An absent field counts as empty.
5. **The order of checks.** guard → per-client limit → body and address → token present and well formed → stamp present → honeypot → stamp valid and old enough → siteverify (hostname and action `waitlist`) → global limit → per-address limit → store → mail once. The silent refusals sit before siteverify, so a bot costs no siteverify call, and every one of them answers what a real join answers.
6. **The check is visible.** The widget renders with `data-appearance="always"`, `data-theme="auto"` and `data-size="flexible"`, inside each form's glass card under the email capsule, so it takes the capsule's width at 375 px and above. Its callbacks stay global names in data attributes (`data-callback`, `data-error-callback`, `data-expired-callback`, `data-timeout-callback`); no inline handler is added and the policy stays hash-based, with `challenges.cloudflare.com` in `script-src` and `frame-src` and `connect-src 'self'` for the fetch.
7. **The page script joins in place.** It writes `data-join-state` on each form (`waiting`, `ready`, `sending`). The button carries `aria-disabled="true"` until the widget's token arrives; a press while waiting posts nothing and says so in the status. A submit holds for the fill time, then `fetch`es `/join` with `Accept: application/json` and the form's fields, never navigates, writes the outcome's copy into the form's `role="status"` region (polite), keeps focus where it is, clears the field only on `joined`, calls `turnstile.reset` on the form's widget after every answer, and waits for the next token before the button is ready again. A `try-again` also waits out `Retry-After`. A rejected fetch or an answer that is not the expected JSON shows "couldn't reach todz". Each answer dispatches a `waitlist-answered` event on the form with the outcome.
8. **`join_waitlist` waits and reports.** The WebMCP tool fills the first form's field, answers "already submitting" while that form is `sending` and "invalid" when the field refuses the address, waits up to 30 seconds for the form to be `ready`, calls `requestSubmit()`, and answers with the copy for the outcome of that form's next `waitlist-answered` event. It still calls no `fetch` of its own and carries no token: the page's own check and the server's guard are the only path.
9. **Copy lives in the copy modules.** The new status lines are in `landing-copy.ts`; the tool's new answers are in `webmcp-copy.ts`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A separate JSON path (`/join.json` or `/api/waitlist`) | Each path has one answer type | Two routes to limit, guard and keep alike; a second public write path | One route keeps one guard; `Accept` negotiation costs one branch |
| Answer JSON to every post and drop the HTML answer | One answer type | The no-JavaScript post would land on raw JSON | The owner asked to keep the fallback |
| A dedicated `WAITLIST_STAMP_SECRET` | Rotates on its own | A new secret, a new deploy step, a new fail-closed condition that can open a gap between the code and the secret | HKDF gives the key its own domain from the secret the guard already requires |
| Turnstile's `challenge_ts` as the minimum | No new field | It is when the check was solved, which `always` solves in about a second on page load, not when the page was rendered; a bot that waits for the token passes it | It measures the wrong interval |
| A signed cookie set on `GET /` | No hidden field | Sets a cookie on a page that sets none, needs `SameSite` care, and every reload rewrites it | The hidden field is stateless and visible to tests |
| An unsigned timestamp field | Trivial | A bot writes any time | Forgeable |
| A stamp with a maximum age | Limits replay | A tab left open loses its join silently, and Turnstile's single-use token already stops replay | No gain against the threat |
| Refuse the honeypot and too-fast posts with an error | Honest to a person who autofilled | Tells a bot which rule it broke | The owner asked for the generic answer |
| `display: none` on the honeypot | Simplest CSS | Many bots skip fields hidden that way | Off-screen and `aria-hidden` hide it from people and assistive tech alike |
| The real `disabled` attribute on the button | Native semantics | Takes the button out of the tab order and silences the reason | `aria-disabled` keeps it reachable and the status says why |
| `data-size="normal"` | Fixed 300 × 65 | Misaligned under a capsule wider than 300 px | `flexible` follows the capsule |
| Keep `join_waitlist` on "sent" without waiting | No change | With the button waiting for a token, the tool could not submit; and an agent learns nothing of the result | The fetch makes the outcome available on the page |

## Consequences

- Joins no longer reload the page; the no-JavaScript post still answers the HTML page, but without JavaScript there is no token, so it answers "try again" by design: the visible check needs JavaScript.
- The landing's HTML now varies per render (the stamp), which it already did per site key; the page stays `no-cache` and is not cached at the edge.
- Every join waits at least three seconds after the page starts loading; a person typing an address takes longer.
- Rotating the Turnstile secret invalidates the stamps of open tabs; their next join answers `joined` silently and stores nothing. Rotation is rare and the runbook says so.
- The E2E joins take about three seconds each, the product's hold, not a test sleep.

## Evidence

- Cloudflare Turnstile client-side rendering: `data-appearance` (`always`, `execute`, `interaction-only`), `data-size` (`normal`, `flexible`, `compact`), `turnstile.reset(container)`, single-use tokens valid for 300 seconds.
- WebCrypto HKDF and HMAC are available in Workers; `crypto.subtle.verify` compares in constant time.
- The landing's current policy already holds `connect-src 'self'` (`siteContentSecurityPolicy` with `connectsToSelf: true`).

## Revisit when

- Spam reaches the list despite the check: add a per-address cooldown or a second-opinion score.
- Turnstile's `always` widget hurts the Lighthouse scores of ADR 0060 on production.
- WebMCP agents report the 30-second wait as too short.
