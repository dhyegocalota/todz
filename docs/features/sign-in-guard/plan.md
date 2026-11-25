# Plan: Sign-in guard

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `serveOwner` in `apps/api/src/owner-endpoint.ts` (the limits before any public handler), the two public handlers `requestSignInLink` and `signIn`, the two pages beside `sign-in-page.ts`; in the app, `OwnerService`, `AppModel+SignInLink.swift`, `SignInLink` and the two sign-in slots
**Assumptions (decided, owner can override):**
- The spec's Interfaces are the contract between the lanes; neither lane changes them without the lead.
- The dev scripts and the Miniflare bindings carry Cloudflare's public test keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`); if gitleaks flags them, `.gitleaks.toml` allowlists those exact strings, anchored.
- `TURNSTILE_SITE_KEY` stays out of `wrangler.jsonc` until the owner creates the widget.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/**`, `libs/types/src/**`, `tools/repository-shape/src/api-source.test.ts`, `tools/repository-shape/src/runbooks.test.ts`, `docs/runbooks/deploy-the-api.md`, `scripts/deploy-bodies/**`, `.gitleaks.toml` | `developer` (API lane, worktree `../todz-guard-api`) |
| G2 | `apps/macos/**` | `developer` (app lane, worktree `../todz-guard-app`) |

## Sequencing

G1 and G2 run in parallel on the spec's contract. G2's walk against a real Worker needs G1; the tester runs after both merge into `feat/sign-in-guard`.

## Steps

### G1

- [x] **Step 1:** Red: `apps/api/test/turnstile.test.ts` for a new `verifyTurnstileToken` (stubbed `fetch`): accepted on success with the host and action; refused on `success: false`, a wrong hostname, a wrong action; unavailable on a thrown fetch, an abort after the timeout, a non-2xx, malformed JSON; the dummy token accepted without a call only when told the host is local; ~~the form body carries `secret`, `response`, `remoteip`~~ the form body carries `secret` and `response` only (R6). Commit red with a throwing stub. Evidence: `turnstile.test.ts`, 20 red with `Error: verifyTurnstileToken is not implemented`.
- [x] **Step 2:** Green: `apps/api/src/turnstile.ts`, a `TurnstileVerdict` and a `TurnstileAction` enum, constants for the URL, the timeout and the dummy token; ported from zapbip's `site/turnstile.ts` without its logging. Evidence: `turnstile.test.ts` 20 green.
- [x] **Step 3:** Red: limiter tests in `apps/api/test/sign-in-limiter.test.ts` rewritten for the three limits: client ~~and global on all three public routes~~ on all three public routes and global on the two posts (R4), the address limit on sending with a key that holds the address's SHA-256 hex and never the address; `sign_in_refused` with `Retry-After: 60` on each; a missing binding (each of the three) or a missing `CF-Connecting-IP` on a public host answers 503 `sign_in_unavailable`; a local host skips all three; a refused request never sends mail nor inserts a link row. Commit red. Evidence: `sign-in-limiter.test.ts`, 30 red of 43, for example `expected { error: 'too_many_requests' } to deeply equal { error: 'sign_in_refused' }` and `expected 202 to be 503`.
- [x] **Step 4:** Green: `sign-in-limiter.ts` (or a new `sign-in-guard.ts` beside it) with the three bindings in `Env`, constants in `libs/types`, `OwnerErrorCode.SignInRefused` replacing `TooManyLinks` and `TooManyRequests`, the D1 count answering `sign_in_refused` too. Evidence: `sign-in-limiter.test.ts` 43 green; `isLocalHost` in `local-origin.ts` (R5); the two new `ratelimits` moved here from step 8, because the configured-binding test reads them.
- [x] **Step 5:** Red: route tests (`owner-sign-in.test.ts`, `sign-in-links.test.ts` or a new `sign-in-guard.test.ts`): a missing or malformed `turnstile_token` is 400; a refused token is 429 `sign_in_refused` and leaves no link row and no mail; siteverify down is 503 and spends nothing; a valid token sends the mail and signs in; the fake provider needs no token; a missing `TURNSTILE_SECRET_KEY` on a public host is 503; `console.log`/`console.error` never carry the address or either token across these runs. Commit red. Evidence: new `sign-in-guard.test.ts`, 36 red, for example `expected 202 to be 429`, `expected 202 to be 400`, `expected 400 to be 503`; the helpers gained the token in this commit, and the welcome mail's "no public origin" case moved to a 503 here (R2, R3).
- [ ] **Step 6:** Green: the handlers read `turnstile_token`, call the guard in the spec's order, and update every existing test helper that posts these routes (`email-sign-in-client.ts`, `owner-client.ts`) to send the dummy token on a local host.
- [ ] **Step 7:** Red: `sign-in-page.test.ts` and a new `sign-in-challenge-page.test.ts`: `/sign-in/challenge` renders one widget with the site key, `data-action="request_link"`, posts to the `turnstile` handler, 503 without a site key, 404 for other methods; `/sign-in` renders `data-action="sign_in"`, hands `todz://sign-in?token=…&turnstile=…`; both CSPs add `https://challenges.cloudflare.com` to `script-src` and `frame-src` only and keep the script hash; `run_worker_first` lists `/sign-in/challenge`. Commit red.
- [ ] **Step 8:** Green: the two pages, copy in `sign-in-page-copy.ts`, the route in `index.ts`, `wrangler.jsonc` `run_worker_first` and the two new `ratelimits`; the dev scripts and `vitest.config.mts` pass the test keys.
- [ ] **Step 9:** Shape: `api-source.test.ts` pins the three `ratelimits` names, ids and limits against `libs/types`, and that no `TURNSTILE_SECRET_KEY` sits in `wrangler.jsonc`; `deploy-the-api.md` gains the widget step (owner step while the token lacks Turnstile Edit), `wrangler secret put TURNSTILE_SECRET_KEY` after the deploy, the site key PR, and the smoke expectations; `runbooks.test.ts` follows. `apps/api/README.md` purpose line if it names sign-in limits.
- [ ] **Step 10:** Tester briefing section for G1.

### G2

- [ ] **Step 11:** Red: TodzKit tests: `SignInLink` parses `token` + `turnstile`, refuses a link without `turnstile`, with an extra parameter, a malformed or 2049-character token; `SignInLinkRequestBody` and `SignInBody` encode `turnstile_token`; `OwnerAPIError` decodes `sign_in_refused`; `SignInError.signInRefused` maps; `AppModel.acceptChallenge` keeps a valid token and clears on `""` or malformed; `requestSignInLink` without a token sends nothing; with one it sends it, then clears it and advances `challengeRound` on success and on failure; `redeem` sends the link's Turnstile token. Commit red.
- [ ] **Step 12:** Green in TodzKit: the model, service, bodies, errors, copy keys; remove `tooManyLinks` and `tooManyRequests`.
- [ ] **Step 13:** The app: `Todz/SignIn/ChallengeView.swift` (`NSViewRepresentable` over `WKWebView`, non-persistent store, message handler `turnstile`, navigation policy per ADR 0046 §3, reload on `challengeRound`), placed in `AddressSlot` and `InboxSlot`; Send disabled with "Complete the check first." while no token; `SignInErrorLine` copy for `signInRefused`; WebKit linked in `project.yml` if needed. The app builds with no warnings; `swift test` green.
- [ ] **Step 14:** Tester briefing section for G2.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | a fail-closed branch skipped on a public host | a limiter test with the binding absent answers 202 | revert the step's commit |
| 6 | existing sign-in tests break on the new body field | `pnpm --filter @todz/api test:unit` red across owner tests | fix the helpers, not the assertions |
| 8 | the CSP blocks the widget's script or frame | the tester's page console shows a CSP violation | add the exact origin, never `*` |
| 8 | gitleaks flags the test keys | `pnpm verify` secret scan red | anchored allowlist of the exact strings |
| 13 | the web view navigates elsewhere or keeps cookies | the tester's network log or the data store | the policy denies; store non-persistent |
| 13 | Turnstile never yields a token in WKWebView | Send stays disabled in the tester's walk | record a learning; fall back to the browser page (ADR 0046 alternative 2) |

**Steps with no backout:** none in this feature; at deploy, rolling back reopens the unguarded routes (spec R18). Each lane returns its tester briefing section to the lead, who owns `tester-briefing.md` (spec R16).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots and video recorded and uploaded (only if UI was touched).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
