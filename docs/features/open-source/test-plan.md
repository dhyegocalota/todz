# Test plan: Open source

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/open-source.test.ts` — input: the tree before the change; expected: 6 failed, 13 passed

## Unit

- [ ] `open-source.test.ts::the security policy names the address and the issue template configuration the private advisory form` — input: `.github/SECURITY.md`; expected: contains `security@todz.app`
- [ ] `open-source.test.ts::the open source runbook ends with a run log table whose rows name a date, a commit and a step` — input: the runbook; expected: every row after the header matches the row pattern
- [ ] `runbooks.test.ts` — input: the new runbook; expected: numbered steps, each with an `If it fails` line, linked once from the index

## Prove it for real

- [ ] Run each pre-flight step of the runbook on `origin/main`; expected: the results of the run log, with no finding.

## Coverage honesty

The post-flip steps run only after the owner's flip; their results are not recorded by this feature.
