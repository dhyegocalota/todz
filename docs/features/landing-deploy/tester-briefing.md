# Tester briefing: Landing deploy

## What changed

- `docs/runbooks/deploy-the-api.md`: fifteen run-log rows for the 2026-11-25 run at fe34431, which attached `todz.app` and `www.todz.app` to `todz-api` (version `bafcf42c-9857-4ada-9ff1-6d1d068711dc`).

## How to run

- From the repository root, read-only: the commands in `test-plan.md`. Every Cloudflare call goes through `scripts/todz-cloudflare.sh`, which reads the token from the Keychain; never print it.

## Hypotheses

- Each row matches what production answers today.
- No row carries a secret.
