# Tester briefing: Deploy run

Written by the lead, who ran the deploy.

## What changed

- `docs/runbooks/deploy-the-api.md`:
  - the run log, steps 1 to 15;
  - step 8's expectation;
  - step 9's `versions view`;
  - step 15's grep.
- `tools/repository-shape/src/runbooks.test.ts`: the run-log check now allows rows and checks their shape.
- A learning about Wrangler's bindings table.

## How to run

Run from the repository root on this branch. `scripts/todz-cloudflare.sh` reads the token from the Keychain for one command; never print it. Every command line must avoid `$`, backticks, braces and heredocs, because the guard hook blocks them.

## Hypotheses to attack

1. The live Worker is bound to the production database. Break it by: step 9's `versions view`, and a wrong session on `https://api.todz.app/owner`, which answers 401 when D1 serves and 500 when it doesn't.
2. Step 15's grep shows every status. Break it by: running it as written.

## Known gaps

- Nothing with the Turnstile secret, which the owner has not created.
