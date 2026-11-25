---
name: deploy
description: Deploys todz to production — the API runbook, then a Mac release when apps/macos changed since the last release, then checks the live download. Stops at the first failure and leaves the previous release live. Run only when the owner has asked for a deploy.
argument-hint: [--skip-release]
allowed-tools: Bash(pnpm:*), Bash(git:*), Bash(curl:*), Bash(shasum:*), Bash(ssh-keygen:*), Bash(scripts/todz-cloudflare.sh:*), Bash(ls:*), Bash(cat:*), Read, Edit
metadata:
  author: in-house
  created: 2026-11-25
---

# Deploy

Process: `.claude/HARNESS.md` §11 (a deploy costs money and is public: the owner asks first). Decisions: [ADR 0044](../../../docs/adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) for the Worker, [ADR 0072](../../../docs/adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) for the Mac release. The runbooks hold every step and its expected result; this skill only orders them and never repeats them.

## Steps

1. **Deploy the API.** Follow [Deploy the API](../../../docs/runbooks/deploy-the-api.md) from its first step to its last, one command per call. A step whose expected result is not what it printed stops this skill.
2. **Decide on the release.** The last release is the newest `mac-v*` tag. `git diff --quiet <tag> HEAD -- apps/macos` exiting 1, or no `mac-v*` tag at all, means the Mac app changed since the last release: continue. Exit 0, or `--skip-release` in `$ARGUMENTS`, means no release is due: say so and go to step 5.
3. **Release the Mac app.** Follow [Release the Mac app](../../../docs/runbooks/release-the-mac-app.md) steps 1, 5 and 7: the clean `main`, the dry run, then `pnpm release:mac`. Steps 2, 3, 4 and 6 are the owner's, once; a missing key, bucket or the owner's other-Mac check stops this skill and names the step.
4. **Check production.** Take `<version>` from the line `pnpm release:mac` printed, then run step 9 of the release runbook (step 8, the Worker deploy, was step 1 here): `/download` and `/download/latest` answer `302` to `/download/<version>/Todz-<version>.dmg`, the disk image answers `200` as a download, and `appcast.xml` lists `<version>` with its `sparkle:edSignature`. Then, in `~/.todz-release/<version>/check/`, download the three files from `https://todz.app/download/<version>/` and run `shasum -a 256 -c Todz-<version>.dmg.sha256` (`OK`) and `ssh-keygen -Y verify` against `apps/macos/release/allowed-signers` as the runbook's step 5 does (`Good "todz-release" signature for release@todz.app`).
5. **Record.** The deploy runbook's run log and the release runbook's releases table each get their row, in date order, and nothing else in the repository changes.

## Rules

- Stop at the first failure. Paste the failing command, its output and the runbook's `If it fails` line, then stop; never skip a step, never retry with a changed command.
- A failed release or check leaves the previous release live: `latest.json` and `appcast.xml` change last, so nothing points at a half-published version. Never delete a published object, never re-point `latest.json` or `appcast.xml` at the previous version without the owner's word; report the state and the backout the runbook names.
- No key, token or Keychain value is printed, copied or passed on a command line; the release and the Cloudflare calls go through `pnpm release:mac` and `scripts/todz-cloudflare.sh` only.
- Report what ran and what each check printed, then what is live.
