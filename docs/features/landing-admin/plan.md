# Plan: Landing admin

**Spec:** spec.md
**Tier:** 🔴
**Seam:** `apps/api/src/site/site-endpoint.ts`'s `ROUTE_OF_REQUEST`, which today has no `/admin` key and answers the site's 404
**Assumptions (decided, owner can override):**
- ADR 0051's choices are the ones built.
- The owner's Turnstile widget does not exist yet, so production answers the admin's 503 card after this ships, as sign-in and the waitlist do; the E2E and the walk use Cloudflare's dummy keys on a local site host, where the limiters are skipped as for `/join`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| Lead (step 0, before the lanes) | `apps/api/src/site/admin-waitlist.ts` (the shared types), stubs of `admin-page.ts`, `admin-link-page.ts` and `src/emails/admin-sign-in-mail.ts` that throw `<name> is not implemented` | the lead |
| G1 (store, guard, session, routes) | `apps/api/migrations/0006_admin.sql`; `apps/api/src/site/admin-store.ts`, `admin-limiter.ts`, `admin-session.ts`, `admin-sign-in.ts`, `admin-export.ts`, `admin-routes.ts`; `site-endpoint.ts`; `src/turnstile.ts` (the enum member); `src/env.ts`; `libs/types/src/constants.ts` (the admin limit period); `apps/api/wrangler.jsonc`; `apps/api/package.json` (the `--var ADMIN_EMAIL` of every dev script); `apps/api/test/site/admin-store.test.ts`, `admin-limiter.test.ts`, `admin-sign-in.test.ts`, `admin-session.test.ts`, `admin-export.test.ts`; `apps/api/test/site-dispatch.test.ts`; `tools/repository-shape/src/api-source.test.ts` | `developer` (worktree `../todz-admin-store`) |
| G2 (pages, mail, E2E) | `apps/api/src/site/admin-page.ts`, `admin-link-page.ts`, `admin-copy.ts`; `site-style.ts`; `site-headers.ts` (the admin response helper); `src/emails/admin-sign-in-mail.ts`, `src/emails/email-slot.ts` if a slot is needed; `apps/api/scripts/emails/admin-sign-in-*.ts`, `generated-emails.ts`; `src/emails/generated/`; `apps/api/test/site/admin-pages.test.ts`; `apps/api/test/emails/` (the new template's tests); `apps/api/e2e/admin.spec.ts`; `apps/api/playwright.config.ts` | `developer` (worktree `../todz-admin-page`) |
| Lead (after the lanes) | `docs/runbooks/deploy-the-api.md` (migration 0006, nine limiters, the `ADMIN_EMAIL` var, an admin smoke check), `docs/self-host.md` if it names the limiters, `apps/api/README.md`, `AGENTS.md` if a helper joins the list, `tester-briefing.md`, `docs/adr/README.md` | the lead |

**Amended by the plan review answers (spec R1–R21), which win over the lines above and the steps below:**

- Every G1 test file is `apps/api/test/admin-*.test.ts`, not `test/site/` (R1); G2's rendering tests may stay in `test/site/admin-pages.test.ts`.
- Step 0 also writes `site/admin-paths.ts`, `TurnstileAction.AdminSignIn`, `HttpStatus.Forbidden` and the `HttpHeader` members (R7), and the stubs return real minimal values (R5).
- G1 also owns `libs/types/src/constants.ts`'s four admin constants (R16) and the `email` column of `admin_sessions` and the `waitlist_joined_at` index in 0006 (R8, R19).
- G2 also owns `site-headers.ts`'s `connectsToSelf` (R2), `apps/api/e2e/turnstile-stub.ts` and `landing.spec.ts` (R15), and `playwright.config.ts`'s `ADMIN_EMAIL` and log file (R4).
- The lead also owns `scripts/deploy-bodies/junk-turnstile-admin.txt`, `docs/self-host.md` with `pnpm site:generate` and its generated module (R13).

The shared types in `admin-waitlist.ts` (step 0):

```ts
export enum ConfirmationState { Sent = 'sent', Failed = 'failed' }
export type WaitlistRow = { address: string; joinedAt: number; confirmation: ConfirmationState };
export type WaitlistSummary = { total: number; joinedLastDay: number; failedConfirmations: number; rows: WaitlistRow[] };
export enum AdminNotice { None = 'none', CheckInbox = 'check-inbox', TryAgain = 'try-again', Closed = 'closed', Forbidden = 'forbidden' }
```

The stubs' signatures, which G2 fills and G1 calls:

```ts
serveAdminSignInPage({ notice, siteKey }: { notice: AdminNotice; siteKey: string | null }): Promise<Response>   // 200, admin headers
serveAdminPanel({ summary }: { summary: WaitlistSummary }): Promise<Response>                                    // 200, admin headers
serveAdminLinkPage(): Promise<Response>                                                                           // 200, admin headers
adminSignInMail({ to, link, origin }: { to: string; link: string; origin: string }): EmailMessage
```

G1 sets the status, `Retry-After` and the cookies on the response it gets back.

## Sequencing

Step 0 by the lead on `feat/landing-admin`; then G1 and G2 branch from it and run in parallel; the lead merges G2 into G1's result, regenerates the mail module once, runs the E2E, then does the lead steps.

## Steps

### Lead

- [x] **Step 0:** `admin-waitlist.ts`, `admin-paths.ts`, the enum members and the three stubs returning real minimal values (R5, R7), typecheck green — evidence: the step 0 commit.

### G1

- [ ] **Step 1:** Red: `admin-store.test.ts` against the local D1 with migration 0006: a link is stored as digests with its fifteen-minute expiry; the sixth link for the address in fifteen minutes is not stored; spending needs the same digest, the same challenge, the same email, an unspent and unexpired row, and spends once; expired links are deleted on insert; a session is found by digest until it expires, and deleted on sign-out; the waitlist summary counts the total, the last 24 hours and the failures and returns the newest 200 rows newest first, with `Sent` or `Failed`; the export reads every row. Then green with the migration and the store.
- [ ] **Step 2:** Red: `admin-limiter.test.ts`: each of the three limits refuses with `TryAgain`; a missing binding or client address is unguarded; a local site host skips. Then green.
- [ ] **Step 3:** Red: `admin-session.test.ts`: the cookie names and attributes (`Path=/; Secure; HttpOnly; SameSite=Strict`, the two Max-Ages, the clearing `Max-Age=0`); a request's cookie header with other cookies, duplicates or none; the same-origin rule (`Sec-Fetch-Site: same-origin`, or `Origin` equal to `SITE_ORIGIN`, else refused; `Sec-Fetch-Site: cross-site` refused even with a matching `Origin`). Then green.
- [ ] **Step 4:** Red: `admin-sign-in.test.ts`, one test per row of the spec's failure table through `SELF.fetch` on the local site host and on a public site host with counting limiters, a stub siteverify and a recording sender: assert status, `Retry-After`, `Set-Cookie`, the D1 rows and the mails each time; the admin's mail link carries the token in the fragment only; another address gets the same body and a challenge cookie but no row and no mail; `POST /admin/sessions` with the right token and cookie answers 201 with the session cookie and clears the challenge, and every wrong pairing answers 401 with no session row. Then green, with `TurnstileAction.AdminSignIn`, the bindings and `ADMIN_EMAIL` in `env.ts`, `wrangler.jsonc` and the dev scripts, and the routes in `admin-routes.ts` wired from `site-endpoint.ts`.
- [ ] **Step 5:** Red: `admin-export.test.ts`: the header line, quoting, doubled quotes, the formula prefix for each of `=`, `+`, `-`, `@`, tab and carriage return, ISO dates, `\r\n`; the route answers the CSV with its two headers and `no-store` with a session and 303 to `/admin` without one. Then green.
- [ ] **Step 6:** `site-dispatch.test.ts`: `/admin` and its paths answer 404 on the API host and on `www` they redirect; `api-source.test.ts` pins `ADMIN_EMAIL`, the three bindings and namespaces 8607–8609, and the dev scripts' `ADMIN_EMAIL`.

### G2

- [ ] **Step 7:** Red: `admin-pages.test.ts`: each notice's card and copy, the widget only with a site key (action `admin_sign_in`), the panel's three tiles, the table's rows and badges, the empty state, the "newest 200 of N" note only above 200, every address HTML-escaped, the link page's script and its no-script text, one hash per inline block in the CSP and no `style=` attribute, `Cache-Control: no-store` and `X-Robots-Tag: noindex` on each. Then green per `design.md`.
- [ ] **Step 8:** Red: the admin mail template's tests beside the others; then the template, its copy, `EmailTemplateName.AdminSignIn`, `admin-sign-in-mail.ts` and `pnpm emails:generate`.
- [ ] **Step 9:** The E2E on `dev:site`'s shape with `ADMIN_EMAIL`: ask for a link as the admin, read it from the console sender's line in the server log, open it in the same context and land on the panel; the same link in a second context is refused; another address shows the same card and logs no mail; the CSV downloads; sign out returns to the card. Each test carries `test.fail` until G1's routes land.

### Lead

- [ ] **Step 10:** Merge G2 into G1, `pnpm emails:generate` and `emails:check`, the E2E without `test.fail`, `pnpm verify`.
- [ ] **Step 11:** The runbook (step 7 lists 0006; step 8 expects nine limiters and `ADMIN_EMAIL`; step 13 checks `GET https://todz.app/admin` answers 200 with `no-store` and `noindex`; step 14 posts an unsolved admin link request and expects 503), the API README, the ADR index, the tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the spend statement matches across challenges or emails | a step 1 or step 4 test spends with the wrong pairing | fix the `WHERE` before merging |
| 3 | a cookie attribute is lost, so the challenge rides a cross-site request | the attribute tests; the E2E's second context signs in | fix the attribute list |
| 4 | another address is told apart (status, body or cookie differs) | the step 4 equality test of the two answers | make the answers one |
| 4 | the guard lets a request reach siteverify or D1 without its limiters | the counting limiter and the stub fetcher record a call | move the check up |
| 5 | a CSV cell runs as a formula | the formula prefix tests | prefix it |
| 9 | the E2E cannot read the link from the console sender | the test times out waiting for the log line | read the persist folder's log file instead |
| deploy | the new version breaks `/join` or sign-in | runbook step 13–15 answers change | `wrangler rollback` (the tables stay) |

**Steps with no backout:** the deploy's migration 0006 (it only adds two tables; a rollback keeps them).

## Z. Prove and ship

- [ ] **Tester run**
- [ ] **Reviewer**
- [ ] **Security reviewer**
- [ ] **/open-pr**
