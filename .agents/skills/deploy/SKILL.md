---
name: deploy
description: Deploys todz to production, the one way an agent deploys: the gate, the API runbook, a Mac release when apps/macos changed since the last mac-v tag, then the live download checks. Stops at the first failure and leaves the previous release live. Run only when the owner has asked for a deploy.
argument-hint: [--skip-release]
allowed-tools: Bash(pnpm:*), Bash(git:*), Bash(curl:*), Bash(shasum:*), Bash(ssh-keygen:*), Bash(scripts/todz-cloudflare.sh:*), Bash(scripts/deploy-worker.sh:*), Bash(ls:*), Bash(cat:*), Read, Edit
metadata:
  author: in-house
  created: 2026-11-25
---

# Deploy

Process: `.claude/HARNESS.md` §11 (a deploy is public and costs money: the owner asks first). Decisions: [ADR 0044](../../../docs/adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) for the Worker, [ADR 0072](../../../docs/adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) for the Mac release. The runbooks hold every step and its expected result; this skill orders them and never repeats them.

## Steps

1. **Gate.** On a clean `main` equal to `origin/main`, run `pnpm verify all`. Anything else, or a red gate, stops here.
2. **Deploy the API.** Follow [Deploy the API](../../../docs/runbooks/deploy-the-api.md) from its first step to its last, one command per call. Its deploy step is `scripts/deploy-worker.sh`, which keeps the released downloads served and deploys with `HEAD`'s sha as the message. A step whose expected result is not what it printed stops the skill at that step's `If it fails` line.
3. **Decide on the release.** The last release is the highest `mac-v*` tag. `git diff --quiet <tag> HEAD -- apps/macos` exiting 1, or no tag exists (the first release), means the Mac app changed: continue. Exit 0, or `--skip-release` in `$ARGUMENTS`, means none is due: say so and go to step 6.
4. **Release the Mac app.** Run `pnpm release:mac` (the release runbook's steps 4 and 6 in one command: build, deploy, production checks, tag). Steps 2, 3 and 8 of that runbook are the owner's, once, and the skill never runs them; a missing key, a time limit naming `sign_update` or a failed production check stops the skill and names the step.
5. **Check production.** Take `<version>` from the line `pnpm release:mac` printed and run, from the repository root, a second check of what the release command already checked:

   ```bash
   mkdir -p ~/.todz-release/<version>/check
   curl -sS -D - -o /dev/null https://todz.app/download/latest
   curl -fsS -o ~/.todz-release/<version>/check/Todz-<version>.dmg https://todz.app/download/<version>/Todz-<version>.dmg
   curl -fsS -o ~/.todz-release/<version>/check/Todz-<version>.dmg.sha256 https://todz.app/download/<version>/Todz-<version>.dmg.sha256
   curl -fsS -o ~/.todz-release/<version>/check/Todz-<version>.dmg.sig https://todz.app/download/<version>/Todz-<version>.dmg.sig
   curl -sS https://todz.app/download/appcast.xml
   (cd ~/.todz-release/<version>/check && shasum -a 256 -c Todz-<version>.dmg.sha256)
   ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s ~/.todz-release/<version>/check/Todz-<version>.dmg.sig < ~/.todz-release/<version>/check/Todz-<version>.dmg
   ```

   Expected: the first answers `HTTP/2 302` with `location: /download/<version>/Todz-<version>.dmg`; the sum prints `OK`; the signature prints `Good "todz-release" signature for release@todz.app`; the appcast carries `<sparkle:shortVersionString><version></sparkle:shortVersionString>` and `sparkle:edSignature`.
6. **Record.** A row in the run log of `deploy-the-api.md` and, for a release, a row in the releases table of `release-the-mac-app.md`, in date order; nothing else changes in the repository.

## Rules

- The skill stops at the first failure: it pastes the failing command, its output and the runbook's `If it fails` line, and goes no further.
- A failed release or check leaves the previous release live: `pnpm release:mac` rolls the Worker back to the version id it recorded, takes the version out of the release folder and leaves the list of released versions unchanged. The skill never retries a deploy blindly, never edits `~/.todz-release` by hand and never runs a bare `wrangler rollback`.
- No key, token or Keychain value is printed, copied or passed on a command line: the release goes through `pnpm release:mac` and Cloudflare calls through `scripts/todz-cloudflare.sh` only, and the secrets guard hook refuses the rest.
- The report says what ran, what each check printed and what is live.
