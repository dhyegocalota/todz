# Test plan: Self-host docs

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/self-host.test.ts` > "the root README links it" at the red commit — expected: fails with `expected '<p align="center">…' to contain '](docs/self-host.md)'`

## Unit

- [ ] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all green, `self-host.test.ts` 8 of 8
- [ ] Mutation: change `todz-directory` to `todz-other` in the guide's `migrations apply` line — expected: "every database command names the database in the Wrangler configuration" fails; restore — expected: green
- [ ] Mutation: change `--transport http todz` to `--transport http todo` — expected: "the Claude Code command has the shape the key screen copies" fails; restore — expected: green

## Prove it for real

- [ ] Read the guide against the repository: every command runs as written in this repository, without executing a remote step (for example `pnpm --filter @todz/api exec wrangler --version`, `xcodegen --version`, the file paths exist) — expected: no command names a script, flag or file the repository lacks
- [ ] The guide is short: under 120 lines — expected: true
- [ ] The README renders the link to the guide — expected: present in the README's intro

## Edge cases found during execution

Empty on purpose.

## Coverage honesty

- The remote steps (create, deploy, sending, Turnstile) are not executed by the test; the deploy runbook's run proves the same commands against Cloudflare.
