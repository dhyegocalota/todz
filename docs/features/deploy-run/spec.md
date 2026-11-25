# Deploy run

**Status:** In review
**Tier:** 🟢
**Owner approval:** approved 2026-11-24 by PROMPT.md "Publishing on todz.app" (the loop runs `deploy-the-api.md` from `main` and records it) and [ADR 0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §6
**ADRs:** [0044](../../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [0045](../../adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)
**Not changing:** code, configuration, the Turnstile widget (the owner's step 10)

## Problem

The first production run of `docs/runbooks/deploy-the-api.md` happened at 2bde053, and its rows must be recorded (step 16). It also found three places where the runbook and its test disagree with reality:
- Step 8 expects `env.DIRECTORY (todz-directory)`, but Wrangler 4.167.0 prints the nil preview id.
- Step 15's `grep "^HTTP"` misses every status after the first, because each body ends without a newline.
- `runbooks.test.ts` requires the runbook to end with an empty run log, so no run could ever be recorded.

## Change

- The run log gains one row per step run, 1 to 15. Step 10 is marked not run: the owner's widget.
- Step 8's expectation says what Wrangler prints. Step 9 adds `wrangler versions view <version-id> --json` and checks that the `d1` binding is `todz-directory`'s id.
- Step 15 matches with `grep -oE "HTTP/2 [0-9]+|retry-after: [0-9]+"` and says why.
- `runbooks.test.ts`: the run log is the runbook's last section, and every row names a date, a commit and a step.
- A learning: [the deploy table shows the preview id](../../learnings/2026-11-24-wrangler-deploy-lists-the-preview-database-id-in-its-bindings.md).

## Test list

- Shape: `runbooks.test.ts` green with the rows. A malformed row fails it (mutation).
- The two changed commands, run against production read-only: step 9's `versions view`, and step 15's grep over fourteen posts.
