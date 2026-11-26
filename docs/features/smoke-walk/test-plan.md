# Test plan: Production smoke walk

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `tools/repository-shape/src/runbooks.test.ts::the index says agents never run a runbook except...` — input: the index sentence names `production-smoke-walk` while the test constant does not; expected: fails until both agree
- [ ] Confirmed it fails for the right reason: the index link test names `production-smoke-walk.md` as linked zero times before the row exists

## Unit

- [ ] `runbooks.test.ts` — input: the new runbook; expected: numbered steps 1 to 17 in sequence, each with an `If it fails` line, no broken relative link, every `pnpm` command a root script
- [ ] `runbooks.test.ts` — input: the index; expected: one link to `production-smoke-walk.md`, under twenty lines

## E2E (Playwright specs)

- None: no browser surface.

## Prove it for real

- [ ] The first run of the walk against production, after the last deploy: every step's actual result in the Run log, dated, with the commit — BLOCKED until the deploy lands and the owner's session is available

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: the probes assert what the code answers — attack: read `sign-in-links.ts`, `owner-sign-in.ts` and `waitlist-join.ts` against steps 4 to 6; result: held | refuted
- [ ] Claim 2: no step spends the owner's real data — attack: read each step for a write outside `todz-perf` and `smoke-` titles; result: held | refuted
- [ ] Claim 3: no step puts a key in a file or a command line the repository keeps — attack: read steps 10 and 11; result: held | refuted

## Coverage honesty

- The runbook is not executed by this change: production is probed only by the first run, after the deploy.
- Steps 2 and 15 depend on `version-compat` and `day-email` being deployed; their expected results follow those specs and are corrected on the first real run.
