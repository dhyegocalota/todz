# Tester briefing: Landing waitlist deploy

## What changed

- `docs/runbooks/deploy-the-api.md`: fifteen run-log rows for the 2026-11-25 run at 6a65b68, which applied migration `0005_waitlist.sql` and deployed `todz-api` as version `15252c7f-ec20-42f9-9e53-17db3a4c7ba1`.

## How to run

- From the repository root, read-only: the commands in `test-plan.md`. Every Cloudflare call goes through `scripts/todz-cloudflare.sh`, which reads the token from the Keychain; never print it.

## Hypotheses

- Each row matches what production answers today.
- No row carries a secret.
