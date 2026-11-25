# Tester briefing: Landing admin deploy

## What changed

- `docs/runbooks/deploy-the-api.md`: fifteen run-log rows for the 2026-11-25 run at 217d5c3, which applied migration `0006_admin.sql`, deployed `todz-api` as version `2148e758-9c33-4d5d-a168-5468fe89ff11` with the `0 11 * * *` schedule, and put the `ADMIN_EMAIL` secret, which made `f98645a5-c4ac-468d-b003-4bb60b248ada` current.

## How to run

- From the repository root, read-only: the commands in `test-plan.md`. Every Cloudflare call goes through `scripts/todz-cloudflare.sh`, which reads the token from the Keychain; never print it, and never print the `ADMIN_EMAIL` value.

## Hypotheses

- Each row matches what production answers today.
- No row carries a secret value.
