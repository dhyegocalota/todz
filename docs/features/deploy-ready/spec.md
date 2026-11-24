# Deploy ready

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-24 by the owner's authorization in PROMPT.md "Publishing on todz.app" ("já comprei todz.app no Cloudflare, configura tudo") and the queued `deploy-ready`; the configuration shape is [ADR 0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), the loop's call
**ADRs:** [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md), [0020](../../adr/0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md), [0041](../../adr/0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md), [0008](../../adr/0008-runbooks-live-in-the-repository.md)
**Not changing:** the product's behaviour, the landing on `todz.app` (`landing`), the Apple membership and Developer ID signing

## Problem

Nothing about todz runs anywhere but this Mac. The owner bought `todz.app` and authorized the deploy; the configuration still names a placeholder database, no route and no production provider, and the app can only talk to `localhost`.

## Goals

- `wrangler.jsonc` describes production on `https://api.todz.app`: the `todz-directory` D1 database, the `todz-api` Worker with its Durable Objects, the email provider, the Cloudflare sender, the public origin, and a per-client rate limit on the two public sign-in posts.
- Development and tests keep running exactly as today, overriding the production vars.
- The app's Release build talks to `https://api.todz.app`; Debug keeps `localhost`.
- A runbook, `docs/runbooks/deploy-the-api.md`, lists every remote step with its expected result: create the database, apply the migrations, deploy, attach the custom domain, onboard `todz.app` for Email Sending, and a smoke check of the live routes.
- The loop runs that runbook from `main` once this feature and its predecessors have shipped, and records the outcome. The remote steps also wait for `sign-in-guard` to ship (the owner, 2026-11-24: sign-in never goes to production without it).

## Non-goals

- The production smoke walk with the app, a real inbox and Claude Code (it follows the deploy and is recorded in its own runbook run), the landing, a staging environment, CI deploys.

## Design

### Data flow

```
main (green) ──▶ wrangler d1 create todz-directory ──▶ id into wrangler.jsonc (this feature's PR)
             ──▶ wrangler d1 migrations apply todz-directory --remote
             ──▶ wrangler deploy  ──▶ todz-api + ProjectStore DO + custom domain api.todz.app (DNS record by Cloudflare)
             ──▶ POST /zones/{todz.app}/email/sending/subdomains  ──▶ cf-bounce MX, SPF, DKIM
             ──▶ curl https://api.todz.app/owner/sign-in-method ──▶ {"method":"link"}
macOS Release build: TodzAPIBaseURL = https://api.todz.app
```

### Interfaces

- `apps/api/wrangler.jsonc`: `d1_databases[0]` `database_name: todz-directory` and its id; `routes: [{ pattern: "api.todz.app", custom_domain: true }]`; `vars: { SIGN_IN_PROVIDER: "email", EMAIL_SENDER: "cloudflare", PUBLIC_ORIGIN: "https://api.todz.app" }`; `ratelimits: [{ name: "SIGN_IN_LIMITER", namespace_id: <id>, simple: { limit, period } }]` (values as constants the Worker shares with its tests); `send_email` and `assets` as `transactional-email` left them.
- `apps/api/package.json`: `dev` and `dev:email` pass `--var` for `SIGN_IN_PROVIDER`, `EMAIL_SENDER` and `PUBLIC_ORIGIN`; the D1 migration command in `dev` names `todz-directory`.
- The Worker: `SIGN_IN_LIMITER.limit({ key: CF-Connecting-IP })` before the link request and the session post; over the limit answers 429 `too_many_requests`, the same body for both; a missing binding (development) skips the check by an explicit branch.
- `tools/repository-shape/src/api-source.test.ts`: `wrangler.jsonc` names `SIGN_IN_PROVIDER` `email`, `EMAIL_SENDER` `cloudflare`, an `https` `PUBLIC_ORIGIN` on `todz.app`, never `fake` or `console`; every resource name starts with `todz`.
- `apps/macos/project.yml`: a `TODZ_API_BASE_URL` build setting per configuration, `TodzAPIBaseURL: $(TODZ_API_BASE_URL)`.
- `docs/runbooks/deploy-the-api.md` and its row in `docs/runbooks/README.md` (which says this runbook is run by the loop under the owner's authorization).

### Failure handling

| Case | Outcome |
|------|---------|
| The token lacks a permission for a step | the step's `If it fails` names the permission; the loop records it under Blockers and stops the remote part |
| `wrangler deploy` fails | nothing changes in production; the runbook's rollback is `wrangler rollback` to the previous version once one exists |
| Email Sending onboarding fails or is pending | link requests answer 503 until it completes; the runbook waits for the records to verify |
| Over the per-client limit | 429 `too_many_requests` |

## Plan review answers (2026-11-24)

These bind the build and win over any line above that disagrees.

- **D1, the limiter's key.** A named helper reads the client address from `CF-Connecting-IP`, which Cloudflare sets on every production request. With no header (`wrangler dev`, Miniflare tests, the v1 scenario) the limit is skipped by an explicit branch, and a test pins that. The key is `<route>:<address>`, so the two posts have separate buckets. Limiter tests send distinct addresses. Amended in fix round 1: the key is `<route>:<clientRateKey(address)>`, where `clientRateKey` (ported from the owner's zapbip helper) keys an IPv6 address by its /64 and unwraps an IPv4-mapped one, so a client cannot spread across the addresses of its prefix; and the limiter is skipped when the request's own URL host is local (`localhost`, `127.0.0.1`, the check the console sender uses), because Miniflare sets `CF-Connecting-IP` itself for socket requests, while production's `request.url` is always `api.todz.app`. The no-header and no-binding skips stay.
- **D2, the limiter's answer.** Over the limit answers 429 `too_many_requests` (a new `OwnerErrorCode`, apart from `too_many_links`) with a `Retry-After` of the period. The limit (10) and the period (60 seconds, one of the two values Wrangler accepts) are constants in `libs/types`. `namespace_id` is `"1001"` (amended in fix round 1: `"8601"`, because `"1001"` collides with the owner's other Worker; the period constant is `SECONDS_PER_MINUTE`). The app maps `too_many_requests` to a new `SignInError.tooManyRequests` with its own copy.
- **D3, one public origin.** `wrangler.jsonc` sets `workers_dev: false` and `preview_urls: false`, both pinned by the shape test; the runbook's smoke check confirms the `workers.dev` host does not answer.
- **D4, renames and the scenario.** The local migration command names `todz-directory` in `dev`, `dev:email` and `dev:email:cloudflare`. Every dev script passes `--var` for the provider, the sender and a local origin. `docs/scenarios/v1-walk.md`'s boot line follows (G1 owns it). The README says the new database id leaves earlier local state behind. The shape tests that said "never names" are inverted. A new shape test: no `package.json` script contains `--remote`.
- **D5, `wrangler dev` with production routes.** Step 0 is a local spike: with the production `routes`, a request to `localhost:8787` must reach the Worker with a `localhost` `request.url`, so the console-sender guard still sees a local host. If it does not, the scripts pass `--host localhost` or `--local-upstream`. The answer goes into ADR 0044's Evidence.
- **D6, the runbook's rollback and safety.** Its steps:
  - check that the tree is clean and on `main`;
  - pass the token from the Keychain item `todz-cloudflare` without echoing it, with `CLOUDFLARE_ACCOUNT_ID` set explicitly;
  - verify that the database id exists (idempotent);
  - take a `d1 time-travel info` bookmark, and a `d1 export --remote` before any migration;
  - run migrations, always with `--remote`;
  - deploy with no `--var`;
  - for a first deploy, the backout is to detach the custom domain and `wrangler delete`, which loses nothing while the database is empty;
  - for a later deploy, the backout is `wrangler rollback`. Migrations are forward-only and must stay compatible with the previous Worker;
  - Durable Object classes are never deleted.
- **D7, Email Sending onboarding.** The runbook's call, path, body and permission are checked against Cloudflare's documentation through Context7 before writing it. It names the onboarded domain (`todz.app`, for `noreply@todz.app`), and its expected result is a poll until the records verify. The last smoke step is one real `POST /owner/sign-in-links` to an address the owner controls.
- **D8, the custom domain.** Wrangler creates the DNS record and certificate. The runbook first lists the zone's DNS records named `api` and stops if one exists. `If it fails` names Workers Routes and DNS edit.
- **D9, the app.** `project.yml` sets `TODZ_API_BASE_URL` under the Todz target's `settings.configs` (Debug and Release), and `Info.plist` is regenerated. `scripts/verify.sh` builds Debug only, so the Release box is an explicit `xcodebuild -configuration Release`. The README says the Release build is development-signed and not yet distributable.
- **D10, runbooks and ADRs.**
  - `docs/runbooks/README.md` says agents never run runbooks, except `deploy-the-api`, which the loop runs under the owner's authorization. `runbooks.test.ts` follows in the same commit.
  - ADR 0044 turns `Accepted` on the branch at ship, alongside the amended ADRs' lines.
  - The adversarial claim 2 is attacked against a `--var` or dashboard override. The runbook deploys with no `--var` and smoke-checks `{"method":"link"}`.

## Fix round 1 (2026-11-24)

These amend the answers above and bind the fix.

- `wrangler.jsonc` names `account_id` `e2035d8e0b7173d520ccf643f6f4661c`, and the D1 binding has `preview_database_id` `00000000-0000-0000-0000-000000000000`, so `wrangler dev --remote` fails closed instead of binding production. Shape tests pin both.
- The fake sign-in provider is honoured only when `PUBLIC_ORIGIN` and the request host are both local; elsewhere the method route and the session post answer 503 `sign_in_unavailable`.
- Debug and Release are separate apps: bundle ids `dev.todz.Todz.debug` and `dev.todz.Todz.debug.widgets` with the App Group `dev.todz.debug` in Debug, the shipped ids in Release, and `NSAllowsLocalNetworking` in Debug only (as a build-setting string, since XcodeGen cannot split a boolean per configuration).
- The runbook runs through `scripts/todz-cloudflare.sh`, which reads the token from the Keychain for one command or one API call; the loop's shell guard refuses `$`, backticks, braces and heredocs, so no command line holds them and nothing is exported between calls. The runbook has fifteen steps (clean `main` and in sync with `origin/main`, token identity, DNS pre-check and apex snapshot, database by id, bookmark, export into a private folder, migrations, deploy, custom domain, Email Sending, Always Use HTTPS, smoke, one real sign-in link, limiter, run log), a first-deploy rollback only while `owners` is empty, and a note on rotating the token.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Production config shape | top level is production / `env.production` / two files | Loop's call (ADR 0044): top level is production | 2026-11-24 |
| API host | `api.todz.app` / `todz.app/api` | Loop's call (ADR 0044): `api.todz.app`, leaving `todz.app` for the landing | 2026-11-24 |
| Per-client limit | Workers rate-limit binding / zone rule | Loop's call (ADR 0044): the binding, 10 per minute per client address | 2026-11-24 |
| Who runs the runbook | the loop under the owner's authorization / only a person | Loop's call (ADR 0044): the loop, from `main`, recorded | 2026-11-24 |

## Test strategy summary

Red first: the repository-shape test for the production config and the resource names; the Worker's limiter (over the limit answers 429 on both posts, a missing binding skips, the key is the client address); the dev scripts' overrides; the app's base URL per configuration (a TodzKit or shape test on `project.yml`). `wrangler deploy --dry-run` builds. The runbook is executed by the loop after merge, and its run is recorded with each step's actual result.
