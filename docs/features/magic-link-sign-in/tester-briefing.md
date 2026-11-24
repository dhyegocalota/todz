# Tester briefing: Sign in with an email link

## Worker (G1, lane `feat/magic-link-sign-in`)

### What changed and where

All under `apps/api`.

- Public routes dispatch from one record keyed by route (`PUBLIC_HANDLERS` in `src/owner-endpoint.ts`): `POST /owner/sessions` (existing), `GET /owner/sign-in-method` (`src/sign-in-method.ts`), `POST /owner/sign-in-links` (`src/sign-in-links.ts`).
- `src/sign-in-provider.ts`: kind `email`, `SignInMethod` (`link` | `identity`), `verify({identityToken, linkVerifier, directory, now})`. The email kind spends a link with one `UPDATE … RETURNING email` (`src/directory-sign-in-links.ts`).
- `src/owner-sign-in.ts`: the order is now provider, body, time zone, verifier shape, verify (R4). A `link_verifier` that is present and not 43 base64url characters answers 401 `identity_rejected`.
- `src/owner-request.ts`: `parsedPublicBody` requires `Content-Type: application/json` (any parameters, any case) before parsing; used by `POST /owner/sessions` and `POST /owner/sign-in-links` (R3).
- `src/sign-in-links.ts`: 202 `{}` for every well-formed address; the sweep of expired rows and the insert run as two statements, the insert being one `INSERT … SELECT … WHERE count < 5` whose `meta.changes` of 0 is 429 (R2); a rejecting sender deletes the row and answers 503. None of the statements touches `owners` or `owner_identities` (R12).
- `src/email-sender.ts`: the `EmailSender` port and the `console` kind, which logs one JSON line `{"to","text"}` per message; honoured only when `PUBLIC_ORIGIN`'s hostname is `localhost` or `127.0.0.1` (R8). `PUBLIC_ORIGIN` must equal `new URL(PUBLIC_ORIGIN).origin` (R8).
- `src/sign-in-page.ts`, `src/sign-in-page-copy.ts`: `GET /sign-in`, the static page of R9 (script and style pinned by hash, fragment read by the script, `history.replaceState` before the jump to `todz://sign-in?token=…`). Any other method on `/sign-in` is 404.
- `src/sign-in-mail-copy.ts`: the mail's subject and plain text.
- `migrations/0004_sign_in_links.sql`; `src/env.ts` gains `EMAIL_SENDER?` and `PUBLIC_ORIGIN?`; `src/http-status.ts` gains `Accepted` and `TooManyRequests`; `src/owner-errors.ts` gains `too_many_links`.
- `package.json` gains `dev:email`; the test configuration binds `EMAIL_SENDER=console` and `PUBLIC_ORIGIN=http://localhost:8787`.

### How to run

```
pnpm --filter @todz/api dev:email
```

It applies the migrations to the local D1 and starts `wrangler dev` on `http://localhost:8787` with `SIGN_IN_PROVIDER=email`, `EMAIL_SENDER=console` and `PUBLIC_ORIGIN=http://localhost:8787`. Ask for a link with a challenge (the vector below is the challenge of the verifier `AAAA…A`, 43 characters):

```
curl -i -X POST -H 'Content-Type: application/json' -d '{"email":"maria@example.com","link_challenge":"0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a"}' http://localhost:8787/owner/sign-in-links
```

The Worker's console prints one line with the address and the text, link included. Redeem with `POST /owner/sessions` `{"identity_token":"<token from the link>","link_verifier":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","time_zone":"UTC"}`. `pnpm --filter @todz/api dev` is unchanged (`fake`).

Unit loop: `cd apps/api && npx vitest run` and `pnpm typecheck`.

### Red to green

| Step | Red commit | Red text the run printed | Green commit |
|------|-----------|--------------------------|--------------|
| 1, 2 `test/sign-in-method.test.ts` | c08dde9 | `Error: readSignInMethod is not implemented` (5 failed) | 3780409 |
| 3, 4 `test/sign-in-links.test.ts` | 91d157e | `Error: requestSignInLink is not implemented` (21 assertions) and `D1_ERROR: no such table: sign_in_links` (4); 54 failed | dbd0e02 |
| 5, 6 `test/owner-sign-in.test.ts`, `test/sign-in-provider.test.ts` | 83a0c03 | `Error: the email provider verify is not implemented` (11), `expected 401 to be 422` (time zone before identity), `expected 201 to be 401` (verifier shape), `expected 201 to be 400` (content type); 20 failed in all | a755d2e |
| 7 `test/sign-in-page.test.ts` | 3a0071a | `Error: serveSignInPage is not implemented`; 15 failed | 098c128 |
| R5 vector, `test/credential-digest.test.ts` | 83a0c03 | pin: green when it landed (`0f007385…cd1a` is `digestCredential('A' x 43)`) | none |

`test/worker.test.ts` now lists eight directory tables (it changed with migration 0004 in dbd0e02). The fake provider's tests changed only in the rows R4 moves (time zone is checked before the identity) and in `test/sign-in-provider.test.ts`, rewritten for the new `verify` input (R10).

The tests of step 3 were corrected in the green commit dbd0e02: addresses made unique per test (the shared D1 persists across tests) and the `undefined` cases dropped (JSON drops them). The red failure texts above are from the red run as committed.

### Hypotheses for the tester

- H1: `GET /owner/sign-in-method` answers `{"method":"link"}` with `email`, `{"method":"identity"}` with `fake`, 503 `sign_in_unavailable` otherwise, with or without a bearer.
- H2: `POST /owner/sign-in-links` answers 202 `{}` for a known and an unknown address with the same statements, none on `owners` or `owner_identities`; the row holds the digest of the token, never the token.
- H3: the sixth link for one address in 15 minutes is 429 `too_many_links`, whatever the case or spaces of the address; four parallel requests with three already made give two 202 and two 429; at exactly 15 minutes after the first the limit lets one through again.
- H4: with no `email` kind, no `PUBLIC_ORIGIN`, a non-canonical origin, no sender, or the console sender on a non-local host, the answer is 503 and nothing is stored or sent, before the body is read.
- H5: a link redeems once, in the 15 minutes, with the verifier whose digest is the stored challenge; a second use, an expired link, an unknown token, a wrong, missing or malformed verifier all answer 401 `identity_rejected`; two concurrent redeems give one 201 and one 401.
- H6: a bad `time_zone` answers 422 and does not spend the link; a wrong verifier does not spend it either.
- H7: `POST` of a public route with a content type other than JSON is 400 `invalid_request`; a stray `Authorization` header never matters.
- H8: `GET /sign-in` sends no-store, no-referrer, nosniff and the policy of R9 whose hashes match the inline script and style; the script reads only a `token` fragment of exactly 43 base64url characters and drops the fragment before it navigates; a query string is ignored and a token in it never appears in the body.
- H9: a first mail's link carries the configured origin; the console line holds the address and text on one line.

### Known gaps

- `tools/repository-shape/src/api-source.test.ts` ("no file names console") is red on this lane because `src/email-sender.ts` names `console`, which ADR 0041 requires. That file is outside G1's paths: the lead lets that guard allow `apps/api/src/email-sender.ts`, or the guard names the exception.
- The page's script was exercised in unit tests against a fake `location`, `history` and `document`, not in a browser; the walk in a real browser is the tester's.
- Spent rows stay until they expire and an asking sweeps them (`expires_at <= now`); there is no scheduled sweep.
- Two statements (sweep, then insert) make the request, not a batch; the limit is atomic, the sweep is idempotent.
- A spent link is not restored if creating the owner fails after the spend (a thrown D1 error); the owner asks again.
- The mail's text copy lives in `src/sign-in-mail-copy.ts`, a file the plan's file map did not list.
- `SIGN_IN_PROVIDER=email` is not set in `wrangler.jsonc` (that is `deploy-ready`).

## App (G2 and G3, lane `feat/magic-link-sign-in-app`, merged in c5fae02)

### What changed

- TodzKit (G2):
  - `IncomingLink` and `SignInLink` parse `todz://sign-in?token=…`.
  - `PendingSignInLink` and `FilePendingLinkVault` keep the pending link in the private file `sign-in-link` beside the session file. `AppModel` takes the vault as `pendingLinks:`.
  - `AppModel` gains `signInMethod`, `pendingLink`, `isRequestingLink`, `loadSignInMethod()`, `requestSignInLink(email:)`, `redeem(signInLink:)` and `discardPendingLink()`. `signIn(identity:)` and `redeem` share `openSession(issuing:)`.
  - New `SignInError` cases: `tooManyLinks`, `linkRejected`, `linkNotRequested`.
  - `SignInLinkTiming`: a lifetime of 15 minutes and a cooldown of 30 seconds. The pending link is kept until 20 minutes.
  - Red/green: 75de111 → edd0faa (types, vault, API calls), 7fa8b38 → a284d99 (the model: 21 tests, of which 3 were green at red and are pins: `discardingThePendingLinkErasesItFromMemoryAndFromTheVault`, `aLinkWhileSignedInIsDroppedWithNothingSentOrShown`, `aLinkThatArrivesBeforeLaunchSettlesIsDroppedOnceSignedIn`).
- Todz (G3, e15c0b0):
  - `SignInStage`, `AddressSlot`, `InboxSlot` and `EmailAddressFormat` are new.
  - `SignInScreen` switches on the stage.
  - The copy lives in `SignInCopy` and `SignInError+Copy`.
  - `AppDelegate` passes `FilePendingLinkVault(folder: AppConfiguration.sessionFolder)` and routes `IncomingLink`: sign-in first, then widgets as before.

### How to run

1. Run `pnpm --filter @todz/api dev:email`. The console prints one JSON line per mail, and its `text` holds `http://localhost:8787/sign-in#token=…`.
2. Build and run the Todz scheme. `TodzAPIBaseURL` is already `http://localhost:8787`.
3. Open the printed link in a browser and press Open todz.

The owner's session file lives in the same folder as `sign-in-link`. Back it up before a walk against a fresh Worker, and restore it afterwards (run 12's brand-glass tester lost the cache mirror this way).

### Hypotheses

- The screen shows "Getting ready…", then the form for the method. A Worker that is down shows "Can't reach todz" with Try Again.
- Address entry:
  - an empty field disables Send Link;
  - `a@b` and `a b@c.d` show "Enter a valid email address.", send nothing and keep focus.
- A valid address shows "Sending…", then Check your inbox with the address in bold.
  - Send Again is disabled for 30 seconds, with a countdown line.
  - Use a Different Email returns to the prefilled field and erases the pending file.
- The browser link signs in. The pending file is then gone.
- A relaunch within 20 minutes opens on the inbox. After that, it opens on the address stage.
- Link outcomes:
  - a link with no pending request shows `linkNotRequested`;
  - a spent or expired link shows `linkRejected`;
  - the sixth request in 15 minutes shows `tooManyLinks`.
- Launch and signed-in cases:
  - a link that cold-launches the app ends signed in;
  - a sign-in link while signed in does nothing;
  - `todz://today` and `todz://task/…` still work.

### Known gaps (G3)

1. ~~Offline redeem falls back to the inbox with the error line. Its Try Again sends a new link with the same verifier, rather than retrying the held link.~~ Fixed in a173065.
2. ~~A Worker 400 maps to `.unexpected`. The local address check normally catches it first.~~ Fixed in a173065.
3. An expired pending link at launch is cleared before the view appears, so the address field is not prefilled.
4. The cooldown starts when the app sends and is not restored after a relaunch.
5. ~~`EmailAddressFormat` sits in the app target, untested.~~ Fixed in a173065: in TodzKit, with tests.

## Fix round 1 (Worker)

Red-first pairs, in `git log` order. The red text is what the run printed.

| Red | Green | Red text |
|---|---|---|
| a24091a | 07f51aa | `expected 'SCAN sign_in_links' to contain 'sign_in_links_expiry'` |
| f64563c | 3fe3797 | 14 failures, among them `expected [ 'replace /sign-in', …(1) ] to deeply equal [ 'replace /sign-in', 'focus', …(1) ]`; `expected [] to deeply equal [ 'replace /sign-in' ]` (a malformed fragment dropped nothing); `expected '<!doctype html>…' not to contain 'todz://'`; `to match /<svg[^>]* width="64" height="64"/` |
| e09d9c7 | 69118ba | `expected 202 to be 503` (the console sender on a request to `https://api.todz.test`); the wrangler-never-names-`EMAIL_SENDER` test in the same commit is a pin |
| 14ff05f | 048dfea | 8 failures: an address with `<`, `>`, `"`, a control character, DEL or a non-ASCII letter answered 202 instead of 400 (the comma row was already refused by the single-`@` rule: a pin) |
| 1695d29 | f969675 | `expected 'http://todz.app' to be null`, the same for `http://localhost.todz.app` and `ftp://todz.app`; the worker-level `http://todz.app` row is a pin, because the console sender already refused a public host |

Refactor without behaviour change: b39081a (named conditions `isLinkUnsendable` and `isMalformedAsk`, one `SIGN_IN_PAGE_PATH`, `enumValueOf` shared by `signInKindOf` and the sender kind, added to the AGENTS.md helper line). The content security policy is a module-level constant, computed once.

### Hypotheses

- `GET /sign-in` without a well-formed `#token=` (none, empty, 42 or 44 characters, an illegal character, another key) shows the missing-token words, no button and no `todz://` link; the fragment is dropped from the address bar either way.
- With a valid fragment the page shows the opening state, focuses the real `Open todz` button, navigates to `todz://sign-in?token=…`, and the button navigates again on click.
- The page uses system colour keywords (`Canvas`, `CanvasText`, `GrayText`, `AccentColor`, `AccentColorText`), no hex, and the 64 px app icon inline.
- The email request is refused with 503 unless the request URL host is `localhost` or `127.0.0.1` as well as the public origin; `PUBLIC_ORIGIN` over plain http is accepted only on those hosts.
- Addresses are ASCII with no `<`, `>`, `,`, `"`, spaces or control characters.
- Migration 0004 carries `sign_in_links_expiry`; the sweep plan reads it.

### Gaps

- The `test-plan.md` boxes at lines 38, 41, 43 and 61 already carried the lead's R6 wording when this round began, so no box text was changed.
- The icon is a copy of `docs/brand/todz-icon.svg`, with no test tying the two together.
- Nothing was walked in a browser; the page needs the tester's Playwright run at 375 and 1280, light and dark.

## Fix round 1 (app, merged in 7acf551)

- Red 849d8b9 (45 issues), green a173065. `swift test`: 629 passing. The app builds with no warnings.
- Changes:
  - An offline redeem keeps the link (`heldSignInLink`, `canRedeemAgain`), and the inbox's Try Again redeems it again.
  - Verifier reuse folds case and spaces.
  - A sign-in link opens the main window through `windowState.waitingSignInLink`.
  - `SignInStage` and `EmailAddressFormat` moved into TodzKit, with tests.
  - `signInMethodError` is apart from `signInError`, and a redeem in flight shows Redeeming first.
  - A 400 on asking maps to `.invalidAddress`, which shows the address hint.
  - Use a Different Email clears the error.
  - Any successful sign-in erases the pending link.
- Pins at 849d8b9: `beforeTheMethodIsKnownItIsLoading`, the failing-address cases of `anythingElseFails`, `aRedeemThatFailsForAnotherReasonKeepsNoLinkToRedeemAgain`, `sendingAnotherMailLetsGoOfTheHeldLink`, `aFailedSignInByIdentityKeepsThePendingLink`, `aMethodReadThatSucceedsAfterAFailureClearsTheMethodError`, `anInvalidRequestAnswerOnRedeemingStaysUnexpected`.
- Hypotheses:
  - Worker unreachable on redeem: the inbox shows the offline line, and Try Again redeems the same link with no new mail.
  - The same address in other case or spacing reuses the verifier.
  - With the main window closed, a sign-in link brings it forward and a refused link shows its line there.
  - A 400 shows "Enter a valid email address." with no Try Again.
  - The 429 line goes after Use a Different Email.
  - After an identity sign-in, the pending file is gone.
- Gaps: the window-opening path and the Try Again branch in `InboxSlot` are view code with no automated test.

## Fix round 2 (app and api, minor)

- Red 0a2ec9f, green 35c2398: `showsIncomingSignInLink` (false once naming or ready) gates `openWindow.mainWindow()` in `MenuBarLabel`. Red text: `Expectation failed: harness.model.showsIncomingSignInLink == false` in `anIncomingLinkIsNotShownOnceTheOwnerIsSignedIn`. Its sibling `anIncomingLinkIsShownOnlyWhileTheOwnerIsNotSignedIn` is a pin.
- Red 23fdfec, green 87cbe25: `restorePendingLink` erases the expired file but keeps a link held before launch. Red text: `Expectation failed: harness.model.signInError == .linkNotRequested` in `aLinkHeldBeforeLaunchSurvivesAnExpiredStoredPendingLinkAndSaysSo`.
- Red 021bbec, green e594168: `enumValueOf` takes `candidate` and the task store reads enums through it. Red text: `AssertionError: expected null to be 'sour'` in `enumValueOf > returns the member whose value matches the candidate`. The red commit does not typecheck until the green one renames the parameter; the not-found case is a pin.
- 2f37ce1, view only, no automated test: `AddressSlot` refocuses the field when a send ends with an error (a 400 or a 429).
- Hypotheses:
  - Signed in with the main window closed, opening a sign-in link opens no window and shows nothing.
  - Signed out, the same link brings the window forward.
  - After a Send Link refused with 400 or 429, the caret is back in the address field.
- Gaps: the window-opening condition and the refocus are view code; only the model property is tested. `swift test` rewrites two screenshots under `docs/screenshots` on every run; they were restored with `git checkout` and never committed.
