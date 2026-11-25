# Tester briefing: Turnstile live

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/wrangler.jsonc` — `TURNSTILE_SITE_KEY` in `vars`
- `tools/repository-shape/src/api-source.test.ts` — the vars pin expects it
- `docs/runbooks/deploy-the-api.md` — step 10 says the key is in the file and adds the Keychain path for the secret

## How to run

```bash
pnpm --filter @todz/repository-shape exec vitest run src/api-source.test.ts
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `api-source.test.ts` the wrangler configuration is production test | the received vars lacked `TURNSTILE_SITE_KEY` (commit a6824c6) | the key is in `vars` |

## Hypotheses to attack

1. Hypothesis: `scripts/todz-cloudflare.sh` hands its standard input to the wrapped command, so the piped secret reaches `wrangler secret put`. Break it by: reading the script's `exec "$@"` path and running it with a harmless stdin-reading command and a stubbed security binary.
2. Hypothesis: gitleaks does not flag the public site key. Break it by: running the repository's secret scan over the branch.

## Known gaps

- The secret put and the runbook run from step 1 happen after the merge, by the lead, never by the developer.
