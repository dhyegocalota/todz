# Tester briefing: Mac distribution

## G3 — the release command

### What changed and where

| Path | Change |
|---|---|
| `scripts/release-mac.sh` | `pnpm release:mac [--version <x.y.z>] [--dry-run]` and `--create-release-key`. Refusals, build, signature checks, DMG, sum, SSH signature through a throwaway agent, Sparkle signature, appcast and `latest.json`, upload through `scripts/todz-cloudflare.sh`, tag push. |
| `scripts/release-mac.test.sh` | The test, with a fake for every tool (`TODZ_RELEASE_*_BINARY`), a real scratch git repository with a bare origin whose `pre-receive` hook logs the push, and a fake bucket folder. |
| `package.json` | `release:mac`; the test joins `test:verify`. |
| `scripts/verify-gates.tsv` | `scripts/release-mac*` is `product`, gate `unit`, on the root package. |
| `scripts/README.md`, `AGENTS.md` | The release command is named. |
| `docs/runbooks/release-the-mac-app.md` | Steps 3, 5 and 7 call `pnpm release:mac`. |
| `docs/runbooks/README.md`, `tools/repository-shape/src/runbooks.test.ts` | The index says the loop's steps of `release-the-mac-app` are the fourth exception. |
| `.agents/skills/deploy/SKILL.md`, `.agents/skills/README.md`, `tools/repository-shape/src/agent-surfaces.test.ts` | The `deploy` skill and its pin (plan steps 18 and 19, added at the lead's request). `.claude/skills` links `.agents/skills`, so one file serves both tools. |

### How to run

- `bash scripts/release-mac.test.sh` (about a minute; prints `FAIL ...` lines and exits 1, or prints nothing and exits 0). Also part of `pnpm test:verify`.
- `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts src/agent-surfaces.test.ts`.
- Never run `pnpm release:mac` for real before the owner's two blockers clear: the token lacks R2, and nothing may be published before the other-Mac check.

### Red today, green after

| Commit | Test | Red text printed |
|---|---|---|
| `cc15459f` (red) → `f9f4b84b` | `scripts/release-mac.test.sh`, 62 failures against the stub | `FAIL a dirty tree is refused: message: expected 'the working tree is not clean' in 'release-mac is not implemented'` |
| the `runbooks.test.ts` commit → the `docs/runbooks/README.md` commit | `runbooks.test.ts` "the index says agents never run a runbook except ..." | `e9c3dbff` (red) → `053701c3` | `runbooks.test.ts` "the index says agents never run a runbook except ..." | `AssertionError: expected '...agents never run them, except `deploy-the-api`, the loop's steps of `mintlify-publish` and the loop's steps of `performance`. The build loop ...' to contain '...the loop's steps of `performance` and the loop's steps of `release-the-mac-app`'` (1 failed, 36 passed) |
| `3f952c9a` | the three `deploy` skill tests in `agent-surfaces.test.ts` | pin: the skill was written before its test at the lead's request; green when it landed |

`f9f4b84b` also changed two assertions of the red test (a refusal must put nothing in the bucket; it may still read `latest.json`), found when the green run first executed.

### Hypotheses for the tester

1. Every refusal in plan step 14 exits 1 with the message the test names and before the step it must precede (no `xcodegen` after a dirty tree, a tag elsewhere, a bad version, a missing key or a build number that is not greater; no `hdiutil` after a bad signature).
2. A first release puts, in this order, the DMG, the sum, the signature, `appcast.xml`, `latest.json`, then pushes the tag; a re-run says "already published" and does nothing; after a crash (signature, appcast, `latest.json` missing, tag missing) it puts only those and the tag.
3. A re-run reuses `~/.todz-release/<version>/` instead of rebuilding, so the sum never changes between the dry run and the release (runbook steps 5 and 7), and a re-run on another machine without that folder would build a different DMG and be refused as "differs".
4. Nothing published is overwritten: a differing DMG, sum or signature stops before any put. A bucket read that fails for another reason than a missing key stops before any put.
5. The private key reaches only `ssh-add -` on standard input; the test's fake key is in no output, no argument and no log. `--create-release-key` sends the key to `security -i` on standard input and leaves no file; an existing item is never replaced.
6. The real `ssh-agent`, `ssh-add -` and `ssh-keygen -Y sign -f <public key>` sequence the script uses signs and verifies (checked once by hand on a scratch key, outside the test, which fakes all three).
7. `--dry-run` reads and writes nothing in the bucket and creates no tag.
8. `scripts/verify-gates.tsv`: a change under `scripts/release-mac*` runs the `unit` gate on the root package.

### Gaps I know about

- `xcodegen`, `xcodebuild`, `hdiutil`, `codesign`, `sign_update`, `security`'s `-i` mode and Wrangler's `r2 object get/put` are faked; their real flags and output formats are from their manuals and the spike in ADR 0072, not from a run. The first real dry run (runbook step 5) is the proof. In particular the missing-key text of `wrangler r2 object get` (`does not exist`) is an assumption in `release-mac.sh`; a different text makes a first release stop with "could not read latest.json" before any upload.
- The script does not verify its own SSH signature against `apps/macos/release/allowed-signers` (the file is the lead's step 9 and does not exist in this lane); the runbook's step 5 does.
- A fresh machine without `~/.todz-release/<version>/` cannot "re-run" an already published version: it rebuilds a different DMG and is refused.
- `--version` below `0.2.0` with no tag is allowed; the first release without the flag is `0.2.0`.
- `security -i` is how the key reaches the Keychain without an argument; if `security -i` limits a line's length below the key's encoded size (about 400 bytes) the step fails with "could not store the key", and the owner would store the item by hand.
- The `deploy` skill is a prompt, not code; only its text is pinned.
