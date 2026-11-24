# Plan: Sign in with an email link

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the Worker's sign-in provider port and public owner routes; the app's `OwnerAPI`, `AppModel.signIn`, the sign-in screen and `AppDelegate`'s URL handling
**Assumptions (decided, owner can override):**
- ADRs 0040 and 0041, built while `Proposed`: the owner asked the loop to decide every call and review later (PROMPT.md, 2026-11-24).
- `design.md` recommendations are taken as the loop's calls.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 Worker | `apps/api/src/sign-in-provider.ts`, `apps/api/src/owner-sign-in.ts`, `apps/api/src/sign-in-links.ts` (new), `apps/api/src/sign-in-method.ts` (new), `apps/api/src/sign-in-page.ts` (new), `apps/api/src/sign-in-page-copy.ts` (new), `apps/api/src/email-sender.ts` (new), `apps/api/src/directory-sign-in-links.ts` (new), `apps/api/src/owner-endpoint.ts`, `apps/api/src/owner-request.ts`, `apps/api/src/owner-routes.ts`, `apps/api/src/owner-errors.ts`, `apps/api/src/env.ts`, `apps/api/src/index.ts`, `apps/api/migrations/0004_sign_in_links.sql` (new), `apps/api/test/**`, `apps/api/vitest.config.mts`, `apps/api/package.json`, `apps/api/README.md`, `libs/types/src/constants.ts` (only if a shared constant is missing) | `developer` (lane `feat/magic-link-sign-in`) |
| G2 App model | `apps/macos/TodzKit/Sources/TodzKit/**`, `apps/macos/TodzKit/Tests/**` | `developer` (lane `feat/magic-link-sign-in-app`) |
| G3 App views | `apps/macos/Todz/SignIn/**`, `apps/macos/Todz/AppDelegate.swift`, `apps/macos/Copy/SignInCopy.swift`, `apps/macos/Copy/SignInError+Copy.swift`, `apps/macos/README.md` | `developer`, after G2 merges into the lane |

## Sequencing

G1 and G2 run in parallel in their own worktrees; G2's lane merges into `feat/magic-link-sign-in` when both are done, then G3 builds the screen on G2's model. The API contract in spec → Interfaces is the only thing G1 and G2 share.

## Steps

### G1 Worker

- [ ] **Step 1:** Red: `test/sign-in-method.test.ts`: `GET /owner/sign-in-method` answers `link` with `email`, `identity` with `fake`, 503 with none; no bearer needed. Commit failing alone (a stub route may throw `not implemented`).
- [ ] **Step 2:** Green: the two public routes in `OwnerRoute`, `PublicRoute` widened, public handlers dispatched from a record in `serveOwner`; the method handler.
- [ ] **Step 3:** Red: `test/sign-in-links.test.ts`: 202 `{}` for a known and an unknown address alike; one row holding the token's digest, the lower-cased address, the challenge and an expiry 15 minutes after `now`, and no token in D1; the console sender's text carries `PUBLIC_ORIGIN/sign-in#token=` and a token whose digest is the row's; 400 for each malformed address and challenge; 429 `too_many_links` on the fourth request in 15 minutes, none sent, and 202 again once the first is older than 15 minutes; 503 with no `email` kind, no origin, or no sender; a sender that rejects leaves no row and answers 503. Commit failing alone.
- [ ] **Step 4:** Green: migration `0004`, `directory-sign-in-links.ts` (insert, count recent, delete spent and expired for the address, spend), `email-sender.ts` with the `console` kind, `sign-in-links.ts`; test config sets `EMAIL_SENDER=console` and `PUBLIC_ORIGIN`.
- [ ] **Step 5:** Red: redeeming in `test/owner-sign-in.test.ts`: a link redeems to 201 and an owner keyed by `("email", address)`; a second link for the same address finds the same owner; 401 `identity_rejected` for a spent link, an expired one (by `now`), an unknown token, a wrong verifier and no verifier; two concurrent redeems of one link give one 201 and one 401; the fake provider's tests stay green with `link_verifier` absent. Commit failing alone.
- [ ] **Step 6:** Green: `verify({identityToken, linkVerifier, directory, now})`, the `email` provider spending the link in one statement, `owner-sign-in.ts` passing them.
- [ ] **Step 7:** Red then green: `GET /sign-in` serves the page with `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, a CSP whose script hash matches the inline script, the copy from `sign-in-page-copy.ts`, and no token in the body; any query string is ignored.
- [ ] **Step 8:** `apps/api/README.md` names the email link and the console sender (purpose only); `.env.example` is untouched (no secret); tester briefing section for G1 with how to run the Worker with `email` and `console`.

### G2 App model

- [ ] **Step 9:** Red: TodzKit tests for `SignInMethod` decoding, `SignInLink(url:)` (accepts `todz://sign-in?token=` with a 43-character base64url token; refuses other hosts, missing or malformed tokens, extra paths), `PendingSignInLink` round-trip through `FilePendingLinkVault` at 0600 and through the in-memory vault. Commit failing alone.
- [ ] **Step 10:** Green: those types, the vault port and its two adapters on `PrivateFile`.
- [ ] **Step 11:** Red: `AppModelTests+SignInLink`: reading the method; asking sends the SHA-256 hex of a fresh verifier and keeps `{email, verifier, expiresAt}`; each refusal of the spec's table maps to its `SignInError`; redeeming posts the kept verifier with the token and the time zone, opens the session exactly as `signIn(identity:)` does (cache check, vault, sending, workspaces) and clears the pending link; a link with no pending request, an expired pending one, or while signed in sends nothing and reports the matching notice; a 401 clears the pending link. Commit failing alone.
- [ ] **Step 12:** Green: `OwnerAPI` calls, `AppModel` state and methods, sharing the session-opening path with `signIn(identity:)`.

### G3 App views

- [ ] **Step 13:** The sign-in screen by method per `design.md`: the address form, the inbox state, send again, use a different email, redeeming; copy in `SignInCopy` and `SignInError+Copy`; `AppDelegate` routes `SignInLink` before `WidgetLink`. Build with no warning.
- [ ] **Step 14:** `apps/macos/README.md` (purpose only); tester briefing section for G2 and G3.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 4 | Migration `0004` fails on a database with rows | `wrangler d1 migrations apply` errors locally | the table is new; drop it and re-apply |
| 6 | The spend is not atomic | the concurrent-redeem test gives two 201s | one `UPDATE … RETURNING` with every condition in its `WHERE` |
| 7 | The page's script is blocked by its own CSP | the walk's browser does not jump to `todz://` | the hash is computed from the exact script text at build time in the test |
| 11 | Redeeming diverges from `signIn(identity:)` and skips the cache check | an owner switch keeps the other owner's cache | one shared private method that both call |
| 13 | The URL arrives before the window exists | the walk's cold launch from the link stays on the sign-in screen | the model holds the link until the screen asks, as `waitingLink` does |

**Steps with no backout:** none (no production data exists yet).

## Z. Prove and ship

- [ ] **Tester briefing:** developers wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** verdict recorded.
- [ ] **/check-ui:** screenshots recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
