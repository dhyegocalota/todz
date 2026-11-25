# Tester briefing: Mac distribution

## G2: the app

### What changed and where

- `apps/macos/project.yml`: `ENABLE_HARDENED_RUNTIME: NO` in base and `YES` in Release, and `CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO` in Release, on both targets (Debug unchanged); the package `Sparkle` (`https://github.com/sparkle-project/Sparkle`, pinned by `revision: ab7d71291238df6e0492143b120c9b696a35f603`, the commit of tag 2.10.1, because `Package.resolved` is not committed) as a dependency of `Todz` only; `TODZ_UPDATE_FEED_URL` (empty in Debug, `https://todz.app/download/appcast.xml` in Release); the app's Info.plist keys `SUFeedURL`, `SUEnableInstallerLauncherService`, `SUEnableAutomaticChecks`, `SUScheduledCheckInterval` (86400), `SURequireSignedFeed` and `SUVerifyUpdateBeforeExtraction` (both YES; Sparkle's `sign_update` signs an `.xml` feed in place, G3 signs `appcast.xml` with `--account todz`), `SUPublicEDKey` `BYXfy/qfQvJmxxD6JPs8gelvFwACXZ8xhhcG2p/fpYY=`; the app's mach-lookup entitlements `$(PRODUCT_BUNDLE_IDENTIFIER)-spks` and `-spki`. The generated `Todz/Info.plist` and `Todz/Todz.entitlements` follow.
- `TodzKit/Sources/TodzKit/UpdateFeed.swift`: reads `SUFeedURL`; only an `https` address with a host is a feed.
- `Todz/Updates/AppUpdater.swift`: starts Sparkle's standard updater only when `UpdateFeed` has a URL; `AppDelegate` owns it, `TodzApp` hands it to `AppCommands`, which adds "Check for Updates…" (copy in `Copy/UpdateCopy.swift`) after About Todz when the updater exists.
- `apps/macos/README.md` names the updates.
- New dependency (named by the plan, for the PR body): **Sparkle 2.10.1**, exact, Swift Package Manager, `Todz` target only.

- `Todz/Updates/UpdateReminders.swift` (a Sparkle user-driver delegate with gentle scheduled reminders) and `ScheduledUpdateReminder.showsNow(inImmediateFocus:)` in TodzKit: a scheduled check shows its window only in immediate focus, otherwise the update waits for the next launch or "Check for Updates…".

### How to run

- `cd tools/repository-shape && pnpm exec vitest run src/macos-release.test.ts`
- `cd apps/macos && xcodegen generate`, then `xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug|Release -clonedSourcePackagesDirPath ~/.todz-release/packages build`
- `cd apps/macos/TodzKit && swift test --filter UpdateFeedTests` (the whole package: 1038 tests, green)

### Red today, green after

| Commit | Test | Red text printed |
|---|---|---|
| `d363602c` | `tools/repository-shape/src/macos-release.test.ts`, all eight tests | `AssertionError: expected '\n  Todz:\n    type: application\n …' to contain 'ENABLE_HARDENED_RUNTIME: YES'` (the target holds `NO`); the others fail the same way on their missing setting |
| `6738f324` | `macos-release.test.ts` after the review, four tests | `expected the Todz target to contain 'ENABLE_HARDENED_RUNTIME: NO'`; `expected project.yml to contain` the Sparkle `revision` pin; `expected the Todz target to contain 'SURequireSignedFeed: YES'`; the public key test, key undefined |
| `27aca0f9` | `ScheduledUpdateReminderTests`, both | `TodzKit/ScheduledUpdateReminder.swift:3: Fatal error: ScheduledUpdateReminder is not implemented`, signal code 5 |
| `4d899fe9` | `UpdateFeedTests`, all four | `TodzKit/UpdateFeed.swift:7: Fatal error: UpdateFeed is not implemented`, then `exited with unexpected signal code 5` |

Green: settings `ef713283` then `6ad31486` (review fixes and the key), reminders `451986b7`, `UpdateFeed` and the updater `6a212c26`. The shape test's own corrections (the Release-entitlements pattern did not allow `TODZ_API_BASE_URL` before the key; the `SUPublicEDKey` plist check moved to the key's test) are the `test(mac-distribution)` commit after `6a212c26`, so the red commit's first run had two assertions that were wrong, not the settings.

No pins.

### Step 13: the signed Release build (checked by hand, never launched, `/Applications/Todz.app` untouched)

Built with `xcodebuild -configuration Release -derivedDataPath ~/.todz-release/derived-release` (`** BUILD SUCCEEDED **`), identity `Apple Development` of the team.

- `codesign --verify --deep --strict --verbose=2 Todz.app`: exit 0, `valid on disk`, `satisfies its Designated Requirement`; `--validated` for `Sparkle.framework`, `Installer.xpc` and `Downloader.xpc`.
- `codesign -dv Todz.app`: `Identifier=dev.todz.Todz`, `flags=0x10000(runtime)`, `TeamIdentifier=XFWR794VS8`.
- `codesign -d --entitlements - Todz.app`: app-sandbox, application-groups `XFWR794VS8.dev.todz`, network.client, mach-lookup `dev.todz.Todz-spks` and `dev.todz.Todz-spki`; zero `get-task-allow`.
- `TodzWidgets.appex`: verify exit 0, `flags=0x10000(runtime)`, `TeamIdentifier=XFWR794VS8`, zero `get-task-allow`, no mach-lookup entry.
- `Sparkle.framework`: verify exit 0, `flags=0x10000(runtime)`, `TeamIdentifier=XFWR794VS8`.
- **Finding:** Sparkle's own helpers inside the framework (`Installer.xpc`, `Downloader.xpc`, `Autoupdate`, `Updater.app`) are signed `flags=0x10002(adhoc,runtime)`, `TeamIdentifier=not set`: Xcode copies them as Sparkle ships them. Strict deep verification passes. Whether the release must re-sign them with the team identity (inside out, before signing the app) is a decision for the lead and for `scripts/release-mac.sh` (G3), whose "another Team ID" refusal reads the app's signature only.

### Hypotheses for the tester

- A Debug build shows no "Check for Updates…" item and starts no Sparkle updater (its `SUFeedURL` is empty, so `UpdateFeed` is `nil`). Never launched by me.
- A Release build shows "Check for Updates…" right after About Todz, enabled once Sparkle's updater is ready.
- `UpdateFeed` refuses an absent, empty, `http://`, scheme-less or non-text `SUFeedURL`.
- Debug and Release still build side by side with their own identities (`macos-identities.test.ts` green).
- The widgets' entitlements gained nothing and the widgets do not link Sparkle.

### Gaps I know about

- The built Release plist was read back: `SUFeedURL`, `SUPublicEDKey`, `SURequireSignedFeed`, `SUVerifyUpdateBeforeExtraction` present; Debug's `SUFeedURL` is empty and its flags are `0x0(none)`.
- I did not launch the Release app: whether the sandboxed Sparkle installer starts (failure-mode row 12) is untested until a release is installed by the tester or the owner.
- Sparkle's nested helpers are ad hoc signed, above.
- The appcast, the signing keys and the release script are G3's and the lead's.

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

The `deploy` skill (plan steps D1 and D2) is also in this lane at the lead's word: `.agents/skills/deploy/SKILL.md`, its pin `tools/repository-shape/src/deploy-skill.test.ts` (red `685ebf1d`: 5 failed, each ENOENT on the skill file), the lines in `.agents/skills/README.md` and `.claude/HARNESS.md`, and the purpose paragraph of `deploy-the-api.md`. `.claude/skills` links `.agents/skills`, so one file serves Claude Code and Codex. The skill is a prompt: only its text is pinned.

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

## G1 — the Worker's downloads and the landing

Sources: `apps/api/src/site/download-release.ts`, `landing-page.ts`, `landing-copy.ts`, `site-style.ts`, `site-urls.ts`, `discovery-copy.ts`, `site-endpoint.ts`, `waitlist-join.ts`, `apps/api/wrangler.jsonc` (the `ASSETS` binding), `apps/api/playwright.config.ts`, `apps/api/e2e/download.spec.ts`, `apps/api/e2e/stage-fixture-site.sh`, `apps/api/e2e/fixtures/release/`.

No route code exists: `/download`, `/download/latest` and the versioned files are the assets and the `_redirects` and `_headers` that `scripts/deploy-worker.sh` stages (G3). G1 proves them and shows the button only when `ASSETS` answers `/download/latest` with a `302` to a versioned disk image; a `404` keeps "coming soon"; any other answer throws.

How to run: `pnpm --filter @todz/api test:unit`, then `pnpm --filter @todz/api test:e2e` (the staged server is a second `wrangler dev --assets <staged folder>` on port 8792, built by `stage-fixture-site.sh` through the real `deploy-worker.sh --stage-only` in a throwaway repository and home, with a fake production that answers `404` and a throwaway key whose private half was never committed).

### Red today, green after

| Commit | Test | Red text |
|---|---|---|
| `50f01626` | `site-pages.test.ts` "the landing download" | 6 failed: `expected '<!doctype html>…' to contain '<a class="download-button" href="/dow…'` (four notices), `expected [ …(46) ] to include 'macOS 14 or later'`, `expected ':root{color-scheme:light dark;…' to contain '.download{'` |
| `50f01626` | `site-discovery.test.ts` "starts with the name and a blockquote, then holds the facts" | `expected '# todz\n\n> todz is a native Mac to-d…' to contain 'a download, not yet notarized by Apple'` |
| `50f01626` | `download-release.test.ts` | 2 failed (the `true` and `false` cases): `Error: isDownloadReleased is not implemented` |
| `e3122056` | `download.spec.ts`, `landing.spec.ts` "without a released version" | pin: the e2e landed after the code, so it never ran red; its first run was 26 of 26 green |

The green commit is `5928a230`.

### A5 and A6 evidence

- A5: `wrangler dev --assets <folder>` keeps the config's `run_worker_first`. Probe, not committed: a staged file named `health` and a `sign-in/index.html` beside the real files; `GET /health` still answered the Worker's JSON (`{"service":"todz",…}`), never the file. So the generated `--config` copy of review answer A5 is not needed and `deploy-worker.sh` stays as it is. Local only: the lead's first real `wrangler deploy --assets` confirms it with the smoke checks.
- A6: the `302` of `/download` and `/download/latest` carries `location: /download/0.0.2/Todz-0.0.2.dmg` and, from the `/*` rule of `_headers`, `strict-transport-security: max-age=31536000`, `referrer-policy: no-referrer` and `x-content-type-options: nosniff` (plus the transport's `content-encoding` and `transfer-encoding`); no `cache-control` and no `content-disposition`. `download.spec.ts` asserts these.

### Hypotheses for the tester

1. With a released version staged the hero shows `Download for Mac` and the honest note with "Install steps" above the waitlist form, light and dark, at 1280 and 375, with no horizontal scroll; without one it shows `macOS · Coming soon` and no button.
2. A click downloads `Todz-0.0.2.dmg` (the `Content-Disposition` filename of the `302`'s target).
3. The previous version still downloads; `/download/0.2/x.dmg`, `/download/0.0.2/notes.txt`, `/download/9.9.9/Todz-9.9.9.dmg`, `/_headers` and `/_redirects` answer the site's `404`.
4. The CSP of the landing is unchanged (the same page tests run on the released pages); `/llms.txt` says the app "is a download, not yet notarized by Apple".
5. The staged server's `/health` and `/sign-in` still answer from the Worker.

### Gaps I know about

- Step 6 is done (`docs-pages.test.ts` "the install page", red `4215579a`). `quickstart.mdx` still says "coming soon"; it is not in G1's files.
- Files outside the plan's G1 list that I had to touch: `apps/api/wrangler.jsonc` (`assets.binding: "ASSETS"`), `apps/api/src/env.ts` (optional `ASSETS`), `apps/api/src/http-status.ts` (`Found`), `apps/api/src/site/site-endpoint.ts` and `waitlist-join.ts` (they pass `isReleased` to the landing), `apps/api/test/waitlist-join.test.ts`, `site-discovery.test.ts` and `owner-client.ts` (a helper's env gains `ASSETS`).
- The landing asks `ASSETS` on every landing render and every no-JavaScript join answer; the answer is local to the Worker, not a network call, and the page is not cached.
- `/llms.txt` says "a download" whether or not a release is staged: the file is static. The landing is the gated surface.
- The staged-server fixture trusts the throwaway key of `fixtures/release/allowed-signers`, never the real one.
