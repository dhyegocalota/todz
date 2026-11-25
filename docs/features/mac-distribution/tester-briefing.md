# Tester briefing: Mac distribution

## G3 — the deploy script, the release command and the key guard

### What changed and where

| Path | Change |
|---|---|
| `scripts/deploy-worker.sh` | `[--stage-only <folder>]`. Stages `git archive HEAD apps/api/public` and the latest two released versions of `~/.todz-release/site/`, writes `_redirects` and one `_headers` rule per file, refuses strays and any file that does not verify, then runs `wrangler deploy --assets <stage> --message <HEAD sha>` through `scripts/todz-cloudflare.sh` and records the version id under `~/.todz-deploy/deployments/`. |
| `scripts/release-mac.sh` | `pnpm release:mac [--version <x.y.z>] [--dry-run] [--create-release-key]`. Builds into `~/.todz-release/builds/<v>/` (dry runs included), re-signs Sparkle's nested helpers, checks every code object, makes the DMG, sum, SSH signature (own agent, own socket) and the Sparkle-signed appcast, then for a real release copies into `site/download/<v>/`, runs `deploy-worker.sh`, checks production, appends to `site/released`, tags and pushes. A failed check or deploy rolls back to the version id recorded before it. |
| `scripts/release-shared.sh` | New, sourced by both scripts: `bounded` (a perl `alarm` around every external step), the shared lock `~/.todz-release/lock`, the signal traps. Not in the plan's file map; added because both scripts need the same time limit and lock. |
| `scripts/*.test.sh` | `deploy-worker.test.sh` and `release-mac.test.sh`, with a fake for every tool (`TODZ_RELEASE_*_BINARY`, `TODZ_DEPLOY_*_BINARY`), a real scratch git repository with a bare origin, and real `ssh-keygen` signing and verifying. |
| `.agents/hooks/guard-secrets.sh`, `hooks.test.sh` | Refuses an agent command that names `todz-release-key` with a `security` value flag (`-w`, `-g`, combined), names `sparkle-project.org`, or runs `generate_keys -x`, unless the command is exactly `pnpm release:mac` or `scripts/release-mac.sh` with flags. |
| `docs/runbooks/deploy-the-api.md` step 8, `docs/runbooks/README.md`, `release-the-mac-app.md` | Step 8 runs `scripts/deploy-worker.sh`; the index names the release runbook as the fourth loop exception; the release runbook's steps call `pnpm release:mac`. |
| `package.json`, `scripts/verify-gates.tsv`, `scripts/README.md`, `AGENTS.md` | `release:mac`; both tests in `test:verify`; `scripts/release-*` and `scripts/deploy-worker*` map to `product` / `unit` on the root package. |

The `deploy` skill is G0's, not G3's: the earlier G3 commit that added it was removed in the merge of `feat/mac-distribution`.

### How to run

- `bash scripts/deploy-worker.test.sh`, `bash scripts/release-mac.test.sh` (a few minutes each; they print `FAIL ...` lines and exit 1, or print nothing and exit 0). Both are part of `pnpm test:verify`.
- `bash .agents/hooks/hooks.test.sh`, `pnpm --filter @todz/repository-shape exec vitest run src/runbooks.test.ts`.
- Never run `pnpm release:mac` for real, and never `scripts/deploy-worker.sh` without `--stage-only`, before the owner's other-Mac check passes.

### Red today, green after

| Red commit → green commit | Test | Red text printed |
|---|---|---|
| `0e698585` → `5066ab74` | `hooks.test.sh` release-secret forms | 18 checks failed, each `FAIL claude: security find-generic-password -s todz-release-key -w is blocked: expected exit 2, got 0` (and the codex twin, the Sparkle address and `generate_keys -x` forms) |
| `10878c0e` → `094640fb` | `deploy-worker.test.sh` | 47 failures against the stub, the first `FAIL an empty release folder stages the public files: expected '0', got '1'` |
| `d49dbf9f` → `2e7eb12b` | `release-mac.test.sh` | 125 failures against the stub, the first `FAIL a dirty tree is refused: message: expected 'the working tree is not clean' in 'release-mac is not implemented'` |
| `e9c3dbff` → `053701c3` | `runbooks.test.ts` exception sentence | 1 failed, 36 passed: the index lacked "the loop's steps of `release-the-mac-app`" |
| `27aac488` | `runbooks.test.ts` "the deploy step runs scripts/deploy-worker.sh" | pin: the runbook step was edited before its test |

The green commits of the two scripts also changed a few assertions of their red tests, found when the green run first executed: `094640fb` compares `_headers` with `cmp`; `2e7eb12b` fixes the rollback pattern, the key-file count and the `ssh-add -t 120 -` substring.

### Hypotheses for the tester

1. `deploy-worker.sh --stage-only <folder>` stages only `git archive HEAD` of `apps/api/public` (an untracked or edited file in the working tree never appears), only the latest two versions of `site/released` in numeric order, only the three served files per version plus the newest `appcast.xml`, with `_redirects` and `_headers` exactly as the test pins; it refuses symlinks, strays, a foreign `_headers`/`_redirects`/`.assetsignore`, a sum or signature that does not verify against `apps/macos/release/allowed-signers` at `HEAD`, a production sum that differs, a production `latest` naming a version the folder lacks, any production answer but `200`/`302`/`404`, and a file over 25 MiB.
2. A deploy exits through the shared lock; a held lock is never removed; the release's deploy runs under the release's lock.
3. `release-mac.sh` never writes under `site/` or deploys on `--dry-run`, never tags before the production checks pass, and a complete build for `HEAD` is re-checked and reused, so a dry run then a real run publishes the same sum.
4. Each of the five production checks, each deploy failure and each time limit leaves the previous release live: `wrangler rollback <the recorded version id>` (never a bare rollback), `site/download/<v>/` removed, `released` unchanged, no tag.
5. The signing agent is the script's own (`ssh-agent -a ~/.todz-release/agent.<n>.sock -s`), empty before the key loads with `ssh-add -t 120 -`, never the inherited `SSH_AUTH_SOCK`, and killed on success, on failure, on a time limit and on SIGTERM.
6. The private key reaches only `ssh-add -` and, on `--create-release-key`, `security -i` on standard input; `FAKE-PRIVATE-KEY-VALUE` and its base64 are in no output and no logged argument.
7. Sparkle's nested helpers (`Installer.xpc`, `Downloader.xpc`, `Updater.app`, `Autoupdate`) are re-signed inside-out, then the framework, then the app, with `--options runtime`; every code object, the widget and the app included, is checked for the team, the runtime, strict verification, no `get-task-allow`, no `com.apple.developer.` entitlement and no embedded profile.

### Gaps I know about

- Every external tool is a fake in the tests. The real forms are from manuals and the spike in ADR 0072: `wrangler deployments status --json` (I read the message with `jq` wherever a `workers/message` key appears, and the version id from any `version_id` key), `wrangler rollback <id> --message … -y`, the text `Current Version ID:` of `wrangler deploy`, `sign_update --account todz` signing an XML feed in place with a `sparkle-signatures` comment, `generate_keys --account todz -p`, PlistBuddy. The first real dry run (runbook step 4) and the first real staged deploy are the proof.
- Plan step 15's fallback (a copy of `wrangler.jsonc` with only `assets.directory` changed, if `--assets` drops `run_worker_first`) is not built: it waits for G1's step 4 to show whether it is needed. Until then `deploy-worker.sh` trusts `--assets` to keep `run_worker_first`; the runbook's step 13 smoke checks on the staged deploy are the check.
- Plan step 17's probe of `security add-generic-password -w` reading standard input on a throwaway keychain was not run (the secrets guard blocks the probe for an agent); the script uses `security -i`, which the review allowed.
- `bounded` kills only the process it started; a child that the command spawns (`pnpm` under the wrapper) can outlive a time limit.
- Sparkle `sign_update` is assumed to run unattended once the owner approved it (runbook step 2).
- `release-mac.sh --dry-run` still reads production's appcast (read only) for the build-number rule, and a dry run needs the Sparkle checkout at the pinned revision.
- A re-run on a Mac without `~/.todz-release/builds/<v>/` and without the release folder cannot reproduce a published version; it rebuilds a different DMG and production's sum refuses it ("differs from the published file").
- The guard hook is a text match: an agent command that builds the key name at run time (`todz-release-$x`) is caught only by the existing expansion rule, and nothing stops a process that is not an agent command.
