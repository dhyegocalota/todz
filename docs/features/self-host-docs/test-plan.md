# Test plan: Self-host docs

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `tools/repository-shape/src/self-host.test.ts` > "the root README links it" at the red commit — expected: fails with `expected '<p align="center">…' to contain '](docs/self-host.md)'` — evidence: at 07423ae in a throwaway worktree, 1 failed | 7 passed, AssertionError `expected '<p align="center">\n  <img src="docs/…' to contain '](docs/self-host.md)'`; worktree removed

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green, `self-host.test.ts` 8 of 8 — evidence: 17 files, 228 tests passed at 12622e9; self-host.test.ts 8 of 8
- [x] Mutation: change `todz-directory` to `todz-other` in the guide's `migrations apply` line — expected: "every database command names the database in the Wrangler configuration" fails; restore — expected: green — evidence: failed as expected (1 failed, 7 passed); `git checkout -- docs/self-host.md`, 8 of 8 green, tree clean
- [x] Mutation: change `--transport http todz` to `--transport http todo` — expected: "the Claude Code command has the shape the key screen copies" fails; restore — expected: green — evidence: failed as expected (1 failed, 7 passed); restored, 8 of 8 green, tree clean

## Prove it for real

- [x] Read the guide against the repository: every command runs as written in this repository, without executing a remote step (for example `pnpm --filter @todz/api exec wrangler --version`, `xcodegen --version`, the file paths exist) — expected: no command names a script, flag or file the repository lacks — evidence: pass 2 at 36f8ddf, both defects fixed. Every command, script, flag and path exists (wrangler 4.167.0, xcodegen 2.48.0, `d1 migrations apply <database> --remote`, `email sending enable` and `dns get` with `--zone-id`, `secret put` and `delete`, `wrangler rollback` exists, `/owner/sign-in-method` returns `{"method":"link"}` by code, ADR 0044 and 0045, the runbook and `docs/product/README.md` exist, the `xcodebuild` line matches `scripts/verify.sh` with Release); `bundleIdPrefix`, both `DEVELOPMENT_TEAM` lines, the two bundle identifiers and `TODZ_APP_GROUP` are in `apps/macos/project.yml`; `SENDER_ADDRESS` and `REPLY_TO_ADDRESS` are in `email-sender.ts`; `workers_dev` is in `wrangler.jsonc`; self-host.test.ts 13 of 13
- [x] The guide is short: under 120 lines — expected: true — evidence: 117 lines at 36f8ddf (was 84 at 12622e9)
- [x] The README renders the link to the guide — expected: present in the README's intro — evidence: README.md line 33, intro paragraph before "A walk through todz"

## Edge cases found during execution

- `pnpm verify all` (step 3) fails on a renamed fork: `tools/repository-shape/src/api-source.test.ts` pins `PUBLIC_ORIGIN` to `https://api.todz.app` (mutated to `api.example.com`: 1 failed, 19 passed; restored, tree clean), and `apps/api/test/email-sender.test.ts`, `turnstile.test.ts`, `sign-in-method.test.ts` and `ChallengeNavigationTests.swift` pin the production names too. The guide neither warned nor named the pins. FIXED at 7827ee7: step 1 installs and runs `verify all` before renaming and names `api-source.test.ts` and `email-sender.test.ts`; regression test `every repository path it names exists` (the guide's backticked paths exist) passes.
- Step 6 built with `DEVELOPMENT_TEAM: XFWR794VS8` and the author's identifiers, and the guide never said to replace them. FIXED at 7827ee7: step 7 names `DEVELOPMENT_TEAM`, `bundleIdPrefix`, both bundle identifiers and `TODZ_APP_GROUP`; regression test `every app setting it asks a fork to change is in the app project, and the guide names each`; mutation `bundleIdPrefix` to `bundleIdPrefixx` in the guide turned exactly that test red (1 failed, 12 passed), restored, tree clean.
- Newcomer gaps, all closed: `pnpm install` is step 1; gitleaks named in step 1 and Xcode and XcodeGen under "What you need"; identifiers replaced in step 7; Updating uses the full `pnpm --filter @todz/api exec` commands. Added in 36f8ddf with test `the production settings it says to keep are the configured ones`: keep-production-settings, workers.dev check, secret prompt, MCP key history note.
- Remaining nit, not a defect: the claim "the free Personal Team works" with manual `Apple Development` signing and an app group is not verifiable without a build; the guide's step 7 build was not run.

## Coverage honesty

- The remote steps (create, deploy, sending, Turnstile) are not executed by the test; the deploy runbook's run proves the same commands against Cloudflare.
