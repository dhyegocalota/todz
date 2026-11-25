# Test plan: Deploy run

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `runbooks.test.ts` > the old "ends with a run log table" at `origin/main` against this branch's runbook — expected: fails, because rows follow the header — evidence: origin/main's test file run against the branch runbook: 1 failed, 18 passed; `endsWith(RUN_LOG_HEADER)` received false; tree restored clean

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green — evidence: 17 files, 222 tests passed at e912c57
- [x] Mutation: change one run-log row's commit to `zzzzzzz` — expected: the run-log test fails naming the row; restore — expected: green — evidence: row 4 mutated; "the deploy runbook ends with a run log table whose rows name a date, a commit and a step" failed (221 passed, 1 failed); it prints a one-element array, not the row text; restored, 222 green
- [x] Mutation: add a `## Notes` heading after the run log — expected: the run-log test fails; restore — expected: green — evidence: same test failed with `expected [ '## Notes' ] to deeply equal []`; restored, 222 green

## Prove it for real (production, read-only)

- [x] Step 9's new command: `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view 8d389ed9-126b-475d-b936-ab951e1141c9 --json` — expected: a `d1` binding `DIRECTORY` with `id` `dc22b1c3-1869-44a0-b805-91bf92017f19` — evidence: `d1` binding `DIRECTORY`, `id` and `database_id` both `dc22b1c3-1869-44a0-b805-91bf92017f19`
- [x] Step 15's new grep, exactly as the runbook writes it — expected: fourteen `HTTP/2` statuses printed, one per post: 503 or 429 while the secret is absent, with at least one 429 followed by `retry-after: 60` — evidence: fourteen statuses, eleven 503 then three 429, each 429 followed by `retry-after: 60`
- [x] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}` — evidence: body `{"method":"link"}`
- [x] The run log carries no token, secret, link or challenge — expected: only the version id, the database id, the bookmark, the sending tag and public record values — evidence: read all 15 rows; only commit 2bde053, version id, database id, bookmark, sending tag, DNS record values and the workers.dev subdomain

## Edge cases found during execution

- The row-mutation failure message prints a one-element array, not the row's name as the plan expected: the check fails correctly; minor.

## Coverage honesty

- Steps 10 and onwards with the secret are not run until the owner creates the widget.
