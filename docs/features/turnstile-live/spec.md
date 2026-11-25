# Turnstile live

**Status:** Building
**Tier:** 🟢
**Owner approval:** approved 2026-11-25 by PROMPT.md "Publishing on todz.app" (the loop runs `deploy-the-api.md` from `main` and records it) and by the owner creating the Turnstile widget the same day (relayed)
**ADRs:** [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md), [0050](../../adr/0050-the-waitlist-answers-alike-for-every-address-mails-once-and-is-guarded-like-sign-in.md), [0051](../../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md), [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md)
**Not changing:** the Worker's code, the limiters, the Turnstile guard itself or its failing-closed rule. The widget's secret is never read, printed or written to a file.

## Problem

The owner created the Turnstile widget (name `todz`, hostname `todz.app`, Managed). Until its public site key is in the production `vars` and its secret is a Worker secret, the sign-in pages, the link post, the waitlist and the admin answer 503, the safe state. Step 10 of `docs/runbooks/deploy-the-api.md` says a pull request puts the site key in `apps/api/wrangler.jsonc` and the runbook then runs again from step 1 on `main`.

## Change

- `apps/api/wrangler.jsonc` gains `TURNSTILE_SITE_KEY` in `vars`, pinned in `tools/repository-shape/src/api-source.test.ts`.
- Step 10 of the runbook says the key is there and adds the Keychain path for the secret: `security find-generic-password -s todz-turnstile -w` piped into `wrangler secret put TURNSTILE_SECRET_KEY` through the wrapper, which hands its standard input to the command, so the secret is never printed.
- After the merge, the runbook runs again from step 1 on `main`; steps 13 to 15 now expect the opened states: the sign-in pages 200, the junk link post 429 `sign_in_refused`, the waitlist junk post 429 with count 0, and the admin probe as its step says. A follow-up `docs` PR records the run in the run log.

## Test list

- The vars pin in `api-source.test.ts` is red without the key and green with it.
- No other test or gate flags the key: `pnpm verify` and gitleaks stay green.
- After the deploy, steps 13 to 15 of the runbook answer as the opened states say, and `wrangler secret list` names `TURNSTILE_SECRET_KEY` without a value.
