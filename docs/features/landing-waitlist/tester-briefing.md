# Tester briefing: Landing waitlist

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- <file or module> — <one line>

## How to run

```bash
<commands to start the stack and open the feature>
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `<path>::<name>` |  |  |

## Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. Hypothesis: <claim>. Break it by: <suggested attack>.

## Known gaps

- <what the developer knows is missing or untested>

## G2: the page, the mail and the E2E

Lane `feat/landing-waitlist-page`, commits `9aa20c5` (red), `5b9ed78`, `c229693` (red), `a67aed7`, `694678b`.

### What changed

- `apps/api/src/site/landing-page.ts`: `serveLandingPage({ notice, siteKey })`. `LandingNotice` gains `Joined` and `TryAgain`. Every notice renders under both forms (R7). The page is rendered per notice and per key presence. With a key matching `SITE_KEY_PATTERN`, each form gets the `cf-turnstile` div (action `waitlist`, `interaction-only`, theme `auto`) between its capsule and its status, and the page loads `TURNSTILE_SCRIPT_TAG` once, at the end of `main`. The page always answers 200; the route sets the status (R8).
- `apps/api/src/site/landing-copy.ts`: `join.joined` and `join.tryAgain`.
- `apps/api/src/site/site-headers.ts`: `siteContentSecurityPolicy` takes `widgetOrigin`. With an origin, it is added to `script-src` and gets its own `frame-src`; with `null`, the policy is the same as before.
- `apps/api/src/site/site-style.ts`: `.cf-turnstile` centres an interactive challenge. It has no margin, so an invisible widget changes no layout.
- `apps/api/scripts/emails/waitlist-template.ts`, `waitlist-email-copy.ts`, `EmailTemplateName.Waitlist`, the generated `WAITLIST_EMAIL`, and `apps/api/src/emails/waitlist-mail.ts` (`waitlistMail({ to, origin })`, which fills only the origin slot).
- `apps/api/e2e/landing.spec.ts`:
  - a Turnstile stub on `page.route` for every test;
  - a unique address per test and project;
  - the foreign-request tests allow exactly the Turnstile script URL;
  - the console tests keep main-frame messages only.
- Sibling files touched so the lane typechecks. G1's version wins in the merge:
  - `src/turnstile.ts`: `TurnstileAction.Waitlist`;
  - `src/turnstile-page.ts`: `export` on `SITE_KEY_PATTERN` and `TURNSTILE_ORIGIN`;
  - `src/site/site-endpoint.ts`: `siteKey: null` on both calls;
  - `test/email-sign-in-client.ts`: a `Waitlist` token in `TURNSTILE_TOKEN_OF_ACTION`;
  - `src/site/self-host-page.ts` (unowned): `widgetOrigin: null`.

### How to run

`pnpm --filter @todz/api test:unit`, `pnpm --filter @todz/api emails:check`, `pnpm --filter @todz/api test:e2e`, `pnpm --filter @todz/api emails:preview` (writes `.pr-media/emails/waitlist.html`).

### Red today, green after

| Test | Red before the change because (printed) | Green after because |
|------|--------------------------------|---------------------|
| `site-pages.test.ts`: 26 rows over the notices × key presence (HSTS, no style attribute, Turnstile script once, CSP with and without the origin, copy-only words, the notice under each form, the widget between capsule and status, no widget for a missing or unusable key) | `Error: serveLandingPage is not implemented` (Joined, TryAgain); `AssertionError: expected [] to have a length of 1 but got +0` (no script tag); `expected 'default-src …' to be 'default-src …'` (no origin); `Target cannot be null or undefined.` (no widget) | `5b9ed78` |
| `site-pages.test.ts`: the widget keeps the page script of the landing without it | pin, green when it landed | — |
| `emails/email-templates.test.ts` › the waitlist email (5 rows) and `generated-emails.test.ts` | `Error: generatedWaitlistEmail is not implemented` | `a67aed7` |
| `e2e/landing.spec.ts` › join: the token in each form, the hero join, the final join, and a second join of the same address (×2 projects) | `test.fail` today: no widget, and `/join` answers "opens soon" in this lane | after G1's route, when the lead removes `test.fail`. Checked once against a scratch route that passed the dummy key and answered `Joined`: all 8 came back "Expected to fail, but passed", and the other 24 stayed green |

Counts: unit 1124 passed (48 files); E2E 32 passed, 2 skipped (the 8 `test.fail` tests count as passed).

### Hypotheses to attack

1. The notice text is the same under both forms, and only the one named by the fragment gets focus. Break it by posting from `#final` and checking that focus lands on `#final-notice`, not `#join-notice`.
2. Without a usable key, the page is byte-identical to the one before this feature. Break it by diffing `GET /` with no `TURNSTILE_SITE_KEY` against `main`.
3. With the dummy key, the widget is invisible and the layout is unchanged at 1280 and 375, in light and dark. Break it with the real dummy widget (no stub), which the E2E never loads.
4. The mail shows the lockup from `SITE_ORIGIN` and never shows the address. Preview: `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/e625c263-20cc-4bdf-bc50-d9d128298c0f/scratchpad/wg2/waitlist-mail-light.png` and `waitlist-mail-dark.png`.

### Known gaps

- `waitlistMail` itself has no unit test of its own. `test/emails` typechecks with node types and cannot import `email-sender`, and `test/waitlist-*.test.ts` belongs to G1. G1's join tests, which record the sent mail, cover it.
- The mail's preview line, "Thanks for joining the todz waitlist", is my choice; R15 does not name one. The second line of R15 is the mail's footer, as the sign-in mail's ignore line is.
- The E2E posts 5 joins per project, 10 in all, in under a minute from one client. If G1's limits apply on a local site host, the per-client limit of 10 a minute sits exactly at that edge.
