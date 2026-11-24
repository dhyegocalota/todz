# Tester briefing: transactional email

## Steps 1 and 2: the templates and their generator

**What changed.** `apps/api/scripts/emails/` renders the sign-in and welcome templates with React Email into `apps/api/src/emails/generated/email-templates.ts`; `apps/api/src/emails/email-slot.ts` fills the `{{link}}`, `{{email}}` and `{{origin}}` slots in one pass. `vitest.config.mts` has two projects, `workers` and `node`; `tsconfig.scripts.json` types `scripts/` and the Node tests.

**Run it.** From the root: `pnpm emails:generate`, `pnpm emails:check`, `pnpm emails:preview` (writes `.pr-media/emails/sign-in.html` and `welcome.html` with `maria@example.com` and `http://localhost:8787`; the lockup image loads only while a Worker serves `/brand/todz-lockup.png`, which step 4 adds). From `apps/api`: `npx vitest run` and `pnpm typecheck`.

**Red today, green after.** Red commit `38d598b`. The run printed `filledTextOf is not implemented`, `filledHtmlOf is not implemented` and `generatedEmailsSource is not implemented`; the email-templates tests failed on the empty stub strings. Pins that were green on landing: both `runtime-email-imports` tests and the slot-order test in `email-slot.test.ts`.

**Hypotheses.**

- The generated module equals a fresh render, and a template edit without `pnpm emails:generate` fails `generated-emails.test.ts`.
- No file under `apps/api/src` imports React or React Email.
- A value such as `{{link}}@x.io` is written as it is and never expanded; `& < > " '` are escaped in HTML, including in `href`; text is not escaped.
- Both HTML parts declare `color-scheme` and `supported-color-schemes` as `light dark` and carry a `prefers-color-scheme: dark` block; the lockup `img` has `alt="todz"`, `width="240"` and `height="80"`.
- The preview files open in a browser as the todz look in light, and in dark with the browser's dark preference.

**Gaps.** Dark rendering and Outlook are not walked by the developer. The sign-in text holds the link twice (button and fallback line). The workers project excludes `test/brand-asset.test.ts` ahead of step 3.

## Steps 3 to 5: the sender, the mails, the welcome and the assets

**What changed.** `src/email-sender.ts` has the `cloudflare` kind as a factory on the `EMAIL` binding (constants `SENDER_ADDRESS` and `REPLY_TO_ADDRESS` at the top); `emailSenderOf` takes `binding` and keeps the console's local-origin and local-request rules for console only. `src/emails/filled-email.ts`, `sign-in-mail.ts` and `welcome-mail.ts` fill the generated templates (origin from `PUBLIC_ORIGIN`); `sign-in-mail-copy.ts` is gone. `owner-sign-in.ts` returns `{ ownerId, isNewOwner }` from its owner lookup and hands the welcome to `executionContext.waitUntil` only when the owner is new and the provider kind is `email`; `OwnerContext` carries the `ExecutionContext` from `index.ts` through `serveOwner`. `wrangler.jsonc` gains `send_email` (`EMAIL`, allowed sender `noreply@todz.app`) and `assets` (`./public`, `run_worker_first` for `/owner/*`, `/mcp`, `/sign-in`); `public/brand/todz-lockup.png` is a byte copy of `docs/brand/todz-lockup.png`. `vitest.config.mts` names both timeouts literally in each project (the step 2 spread failed `test-timeouts.test.ts` in `tools/repository-shape`).

**Run it.** `pnpm emails:preview` from the root writes `.pr-media/emails/sign-in.html` and `welcome.html`; open them in a browser (the lockup shows only while a Worker serves it). From `apps/api`: `pnpm dev:email` (console sender, mail text on the terminal) and `pnpm dev:email:cloudflare` (the simulated binding: `wrangler dev` prints `send_email binding called with MessageBuilder` with From, To and Subject, and writes the text to `apps/api/.wrangler/tmp/email/<instance>/email-text/<id>@todz.app.txt` and the HTML to `.../email-html/<id>@todz.app.html`, gitignored). Ask a link with `POST /owner/sign-in-links`, open the HTML file, and redeem with `POST /owner/sessions` to see the welcome written the same way. Unit loop: `cd apps/api && npx vitest run` (both projects), `pnpm typecheck`, `pnpm emails:check`; `cd tools/repository-shape && npx vitest run`.

**Red today, green after.** Red commit `08a4730` (stubs: the `cloudflare` factory throwing, `signInMail` with empty `html`, `welcomeMail` throwing); green commit `1107b17`.

| Test | Red text | Green |
|------|----------|-------|
| `email-sender.test.ts` sends through the binding from todz | `Error: the cloudflare sender is not implemented` | yes |
| `email-sender.test.ts` rejects when the binding throws | `expected [Function] to throw error including 'the binding is down' but got 'the cloudflare sender is not implemented'` | yes |
| `email-sender.test.ts` is no sender without the binding | `expected { send: [AsyncFunction send] } to be null` | yes |
| `owner-sign-in.test.ts` a new owner by link gets exactly one welcome | `exactly one message should have been sent` | yes |
| `owner-sign-in.test.ts` a returning owner by link gets none | `expected [] to have a length of 1 but got +0` | yes |
| `owner-sign-in.test.ts` a welcome that throws after the session opened | `expected "vi.fn()" to be called 1 times, but got 0 times` | yes |
| `owner-sign-in.test.ts` the sign-in answers while the welcome is still being sent | `expected "vi.fn()" to be called 1 times, but got 0 times` | yes |
| `sign-in-links.test.ts` sends one mail from a public https origin | `expected 503 to be 202` (the stub sender throws, so the HTML assertions were not reached) | yes |
| `sign-in-links.test.ts` stores the digest of the token it mailed | `exactly one message should have been sent` | yes |
| `brand-asset.test.ts` byte copy | `ENOENT: no such file or directory, open '.../apps/api/public/brand/todz-lockup.png'` | yes |
| `api-source.test.ts` binds EMAIL to the one allowed sender | `expected '{ "name": "todz-api", "main": ... }' to match /"send_email":...` | yes |
| `api-source.test.ts` static assets never answer before the Worker | `expected ... to match /... "run_worker_first" ...` | yes |
| `api-source.test.ts` dev:email:cloudflare script | `Error: the api has no dev:email:cloudflare script` | yes |

Pins (green when they landed): the four `worker.test.ts` cases that `/sign-in`, `/owner`, `/owner/sign-in-links` and `/mcp` still reach the Worker; the fake-provider, rival-path, no-sender, no-origin, unknown-kind and no-binding welcome cases (they hold today because the welcome was not there yet); the console cases of `email-sender.test.ts`; the existing sign-in-links console cases.

**Bundle.** `wrangler deploy --dry-run --outdir` of this branch: `index.js` 1,390,969 bytes, upload 1358.37 KiB (gzip 240.15 KiB). The same dry run on `feat/magic-link-sign-in` (no emails): `index.js` 1,368,040 bytes, upload 1335.98 KiB (gzip 236.66 KiB). The templates cost 22,929 bytes (about 3.5 KiB gzip), the lockup asset is uploaded as an asset, and no React reaches the bundle. The dry run printed `env.EMAIL (unrestricted - senders: noreply@todz.app) Send Email`.

**Hypotheses.**

- With `EMAIL_SENDER=cloudflare` and the binding, a link request on a public https origin and a public request host sends one mail from `{name: 'todz', email: 'noreply@todz.app'}` with reply-to `hello@todz.app`, an HTML part whose button `href` is the link and whose header image is `{origin}/brand/todz-lockup.png`, and the text part with the link and the ignore line.
- A throwing binding on a link request answers 503 `sign_in_unavailable` and leaves no `sign_in_links` row; `cloudflare` without the binding answers 503 and stores nothing.
- The first sign-in by link for an address sends exactly one welcome to that address; a second sign-in, the fake provider, the rival path of the insert race, a missing `EMAIL_SENDER`, an unknown kind, a missing `PUBLIC_ORIGIN` or a missing binding send none and still answer 201.
- A welcome whose send throws or hangs never changes the 201 and never delays it; the Worker runs it through `waitUntil`.
- The console sender still logs only `{to, text}`, and only when both the public origin and the request host are local.
- Under `wrangler dev` (walked once on port 8799, then killed) `/brand/todz-lockup.png` answers 200 `image/png`, `/owner` answers 401 and `/sign-in` answers 200 from the Worker, and the simulated binding wrote the mail files named above.

**Gaps.**

- The Workers test pool does not serve static assets (`GET /brand/todz-lockup.png` answered 404 there), so the PNG is proven by the Node byte-equality test plus the `wrangler dev` request; the `run_worker_first` list is proven by a text pattern in `api-source.test.ts` and by the `worker.test.ts` pins, not by a request that an asset would have shadowed.
- `run_worker_first: ["/owner/*", ...]` does not name `/owner` itself (the spec's list); no file in `public/` can sit there.
- The `from` is the object `{name, email}`, not the string `todz <noreply@todz.app>`: `index.d.ts` types it `string | EmailAddress` and documents no display-name string form.
- The red commit's `sign-in-links` HTML assertions were not reached (the stub threw first); they were seen green only.
- A real send through Cloudflare, SPF/DKIM and mail-client rendering are not exercised (`deploy-ready`).
- `dev:email:cloudflare` was run once by the developer; the macOS app was not run.
- An unrelated `wrangler dev` of the `feat/magic-link-sign-in` worktree (port 8787, not started by this lane) was still running at the end.

## Fix round 1

**Dependency.** `@react-email/components` 1.0.12 (2026-04-09) is deprecated on npm ("Package no longer supported"). `react-email` 6.11.16 (2026-11-17, `latest`, same maintainers, not deprecated) exports Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section and Text, re-exports `@react-email/render`, and has no install script. Switched in `edfc81b` (`react-email` 6.11.16, `@react-email/render` 2.3.1); the generated HTML lost only the lockup `<link rel="preload">`. `pnpm security:audit` and `pnpm audit --audit-level=high` (no `--prod`) both print `No known vulnerabilities found`. Evidence in ADR 0042. `@types/react-dom` dropped, `prettier` 3.9.10 declared in `@todz/api`.

**Red then green.**

| Test | Red text | Red | Green |
|------|----------|-----|-------|
| `email-slot.test.ts` throws for a slot with no value (text and html) | `expected [Function] to throw an error` | `46d5bb1` | `904eeff` |
| `api-source.test.ts` run_worker_first names `/owner` | the `wrangler.jsonc` text did not match the pattern | `fa268b5` | `56efbbc` |
| `email-templates.test.ts` the dark mode block styles `.email-button` | `expected '<!DOCTYPE html ...' to match /@media \(prefers-color-scheme: dark\)...` | `3d9952a` | `fd9c11e` |

**Pins (green when they landed).** `a(b)@x.co` reaches the binding as the structured `to` (T7b, `0a40e02`); the worker routing tests are renamed to say they pin the handler; the import guard flags `react-email`, any `scripts/` import, bare `import 'x'`, `import('x')` and `require('x')` (`c4dfa57`, `f42f7bd`; a mutation file under `src` turned it red); the lockup URL appears only in the `img` tag (`f42f7bd`; the link to the PNG was the preload `<link>`, gone with the switch).

**Not red-first.** The CLI changes (a missing generated module is stale, `fileURLToPath`) and the gitleaks allowlist of the committed preview token have no unit seam; `pnpm emails:check` exit 0 and `pnpm verify all` stand in. The preview placeholder is now `preview-only-not-a-token`, and `.gitleaks.toml` allowlists the old committed string, anchored.

**T9 is met by** the `dev:email:cloudflare` script in `apps/api/package.json`, `api-source.test.ts` (the script exists, `wrangler.jsonc` never names `EMAIL_SENDER`, the `EMAIL` binding has the one sender) and the test environment's `EMAIL` stub in `email-sign-in-client.ts`.

**T10 bundle.** `wrangler deploy --dry-run`: upload 1358.41 KiB, gzip 240.15 KiB, `index.js` 1,391,016 bytes; the only `react` strings in it are the `__react-email-column` data attributes of the rendered HTML.

**Gaps.** `/owner` in `run_worker_first` is asserted by a text pattern only. No `wrangler dev` was run this round.
