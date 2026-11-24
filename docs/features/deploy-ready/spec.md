# Deploy ready

**Status:** Approved
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
- The loop runs that runbook from `main` once this feature and its predecessors have shipped, and records the outcome.

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

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Production config shape | top level is production / `env.production` / two files | Loop's call (ADR 0044): top level is production | 2026-11-24 |
| API host | `api.todz.app` / `todz.app/api` | Loop's call (ADR 0044): `api.todz.app`, leaving `todz.app` for the landing | 2026-11-24 |
| Per-client limit | Workers rate-limit binding / zone rule | Loop's call (ADR 0044): the binding, 10 per minute per client address | 2026-11-24 |
| Who runs the runbook | the loop under the owner's authorization / only a person | Loop's call (ADR 0044): the loop, from `main`, recorded | 2026-11-24 |

## Test strategy summary

Red first: the repository-shape test for the production config and the resource names; the Worker's limiter (over the limit answers 429 on both posts, a missing binding skips, the key is the client address); the dev scripts' overrides; the app's base URL per configuration (a TodzKit or shape test on `project.yml`). `wrangler deploy --dry-run` builds. The runbook is executed by the loop after merge, and its run is recorded with each step's actual result.
