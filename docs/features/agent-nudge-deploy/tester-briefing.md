# Tester briefing: Agent nudge deploy

## What changed

- `docs/runbooks/deploy-the-api.md`: fifteen run-log rows for the 2026-11-25 run at 59d3966, which applied migration `0007_agent_nudge.sql` and deployed `todz-api` as version `25bc8121-a464-448e-9548-d4c10aa9c339`.

## How to run

- From the repository root, read-only: the commands in `test-plan.md`. Every Cloudflare call goes through `scripts/todz-cloudflare.sh`, which reads the token from the Keychain; never print it, and never print the `ADMIN_EMAIL` value.

## Hypotheses

- Each row matches what production answers today.
- No row carries a secret value.
