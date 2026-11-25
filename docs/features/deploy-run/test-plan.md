# Test plan: Deploy run

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `runbooks.test.ts` > the old "ends with a run log table" at `origin/main` against this branch's runbook — expected: fails, because rows follow the header

## Unit

- [ ] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green
- [ ] Mutation: change one run-log row's commit to `zzzzzzz` — expected: the run-log test fails naming the row; restore — expected: green
- [ ] Mutation: add a `## Notes` heading after the run log — expected: the run-log test fails; restore — expected: green

## Prove it for real (production, read-only)

- [ ] Step 9's new command: `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view 8d389ed9-126b-475d-b936-ab951e1141c9 --json` — expected: a `d1` binding `DIRECTORY` with `id` `dc22b1c3-1869-44a0-b805-91bf92017f19`
- [ ] Step 15's new grep, exactly as the runbook writes it — expected: fourteen `HTTP/2` statuses printed, one per post: 503 or 429 while the secret is absent, with at least one 429 followed by `retry-after: 60`
- [ ] `curl -sS https://api.todz.app/owner/sign-in-method` — expected: `{"method":"link"}`
- [ ] The run log carries no token, secret, link or challenge — expected: only the version id, the database id, the bookmark, the sending tag and public record values

## Edge cases found during execution

Empty on purpose.

## Coverage honesty

- Steps 10 and onwards with the secret are not run until the owner creates the widget.
