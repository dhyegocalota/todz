# Test plan: Self-host docs

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `tools/repository-shape/src/self-host.test.ts` > "the root README links it" at the red commit — expected: fails with `expected '<p align="center">…' to contain '](docs/self-host.md)'` — evidence: at 07423ae in a throwaway worktree, 1 failed | 7 passed, AssertionError `expected '<p align="center">\n  <img src="docs/…' to contain '](docs/self-host.md)'`; worktree removed

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green, `self-host.test.ts` 8 of 8 — evidence: 17 files, 228 tests passed at 12622e9; self-host.test.ts 8 of 8
- [x] Mutation: change `todz-directory` to `todz-other` in the guide's `migrations apply` line — expected: "every database command names the database in the Wrangler configuration" fails; restore — expected: green — evidence: failed as expected (1 failed, 7 passed); `git checkout -- docs/self-host.md`, 8 of 8 green, tree clean
- [x] Mutation: change `--transport http todz` to `--transport http todo` — expected: "the Claude Code command has the shape the key screen copies" fails; restore — expected: green — evidence: failed as expected (1 failed, 7 passed); restored, 8 of 8 green, tree clean

## Prove it for real

- [ ] Read the guide against the repository: every command runs as written in this repository, without executing a remote step (for example `pnpm --filter @todz/api exec wrangler --version`, `xcodegen --version`, the file paths exist) — expected: no command names a script, flag or file the repository lacks — evidence: NOT ticked, two defects. Every command, script, flag and path exists (wrangler 4.167.0, xcodegen 2.48.0, `d1 migrations apply <database> --remote`, `email sending enable` and `dns get` with `--zone-id`, `secret put` and `delete`, `/owner/sign-in-method` returns `{"method":"link"}` by code, ADR 0044 and 0045, the runbook and `docs/product/README.md` exist, the `xcodebuild` line matches `scripts/verify.sh` with Release), but steps 3 and 6 fail for a self-hoster, see the edge cases
- [x] The guide is short: under 120 lines — expected: true — evidence: 84 lines
- [x] The README renders the link to the guide — expected: present in the README's intro — evidence: README.md line 33, intro paragraph before "A walk through todz"

## Edge cases found during execution

- `pnpm verify all` (step 3) fails on a renamed fork: `tools/repository-shape/src/api-source.test.ts` pins `PUBLIC_ORIGIN` to `https://api.todz.app` (mutated to `api.example.com`: 1 failed, 19 passed; restored, tree clean), and `apps/api/test/email-sender.test.ts`, `turnstile.test.ts`, `sign-in-method.test.ts` and `ChallengeNavigationTests.swift` pin the production names too. The guide neither warns nor names the pins. Defect; regression test requested: a shape check that every file pinning the production origin is named by the guide, or step 3 drops `verify all`.
- Step 6 builds with `DEVELOPMENT_TEAM: XFWR794VS8` and manual `Apple Development` signing in `apps/macos/project.yml`; the build fails for any other team. The guide never says to replace it. Defect.
- Newcomer gaps: no `pnpm install` step; `verify all` also needs gitleaks, XcodeGen and Xcode; the bundle identifiers and app group (`dev.todz`) stay the author's; the Updating section runs a bare `wrangler deploy` while every other command goes through `pnpm --filter @todz/api exec`.

## Coverage honesty

- The remote steps (create, deploy, sending, Turnstile) are not executed by the test; the deploy runbook's run proves the same commands against Cloudflare.
