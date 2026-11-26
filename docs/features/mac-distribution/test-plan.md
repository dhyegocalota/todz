# Test plan: Mac distribution

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/site-pages.test.ts` (the hero cases) red at its own commit — expected: the download button and note assertions fail on the current hero; record the text.
- [ ] `apps/api/e2e/download.spec.ts` and the download cases of `landing.spec.ts` red at their own commit — expected: `/download` answers `404` and no `.download-button` locator; record the text.
- [ ] `tools/repository-shape/src/macos-release.test.ts` red at its own commit — expected: `ENABLE_HARDENED_RUNTIME` is `NO` in Release, no Sparkle package; record the text.
- [ ] `UpdateFeedTests` and `UpdatePresentationTests` red at their own commit — expected: `UpdateFeed is not implemented` and `UpdatePresentation is not implemented`; record the text.
- [ ] `scripts/deploy-worker.test.sh` red at its own commit — expected: every case fails on `deploy-worker is not implemented`; record the text.
- [ ] `scripts/release-mac.test.sh` red at its own commit — expected: every case fails on `release-mac is not implemented`; record the text.
- [ ] `.agents/hooks/hooks.test.sh` (the release-key cases) red at its own commit — expected: the `todz-release-key -w` command passes the current guard; record the text.
- [ ] `tools/repository-shape/src/runbooks.test.ts` (the exception sentence and `deploy-the-api.md` step 8) red at its own commit — expected: the index lacks `release-the-mac-app` and step 8 runs a bare `wrangler deploy`.
- [ ] `tools/repository-shape/src/deploy-skill.test.ts` red at its own commit — expected: no `.agents/skills/deploy/SKILL.md`; record the text.
- [ ] `git log --oneline` shows each red commit before its green one.

## Unit — the deploy skill (`deploy-skill.test.ts`)

- [ ] The skill's front matter has `name: deploy` and a description that calls it the one way an agent deploys.
- [ ] Its body names `docs/runbooks/deploy-the-api.md`, which exists, and `pnpm release:mac`.
- [ ] Its release condition is `git diff --quiet <tag> HEAD -- apps/macos` against the highest `mac-v*` tag, and "no tag" means the first release.
- [ ] It holds the checks: the `302` of `https://todz.app/download/latest` to the new version, `shasum -a 256 -c`, `ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release`, and `sparkle:shortVersionString="<version>"` in the appcast.
- [ ] It says it stops at the first failure and leaves the previous release live, and never runs a bare `wrangler rollback`.
- [ ] It says that while `release:mac` is not a root script it deploys the API alone and reports "the Mac release is not live yet".
- [ ] `.agents/skills/README.md` and `.claude/HARNESS.md` (layout line and §10 table) name `deploy`; `.claude/skills/deploy/SKILL.md` resolves through the symlink.
- [ ] Mutation: delete the stop-at-first-failure sentence from the skill → the test goes red; restore.

## Unit — the deploy script (`scripts/deploy-worker.test.sh`)

- [ ] `released` lists `0.0.1`, `0.0.2`, `0.0.3`, and `site/download/` holds those three plus an unreleased `0.0.4` → the staged `download/` holds `0.0.2/` and `0.0.3/` (three files each) and `appcast.xml` equal to `0.0.3`'s; no `0.0.1/`, no `0.0.4/`.
- [ ] A dry run's build in `builds/0.0.4/` → nothing of `0.0.4` staged, `download/appcast.xml` unchanged.
- [ ] The staged public files equal `git archive HEAD apps/api/public`; a `.DS_Store` and an untracked file in the working tree's `apps/api/public` are absent.
- [ ] Numeric order: `released` with `0.9.0` and `0.10.0` → `0.10.0` is newest.
- [ ] `_redirects` is exactly `/download /download/0.0.3/Todz-0.0.3.dmg 302` and `/download/latest /download/0.0.3/Todz-0.0.3.dmg 302`, nothing else.
- [ ] `_headers` starts with `apps/api/public/_headers` unchanged, then one rule per staged file path: `Content-Disposition: attachment; filename="Todz-<v>.dmg"` on each DMG, `Cache-Control: public, max-age=31536000, immutable` on every versioned file, `Content-Type: text/plain; charset=utf-8` on each `.sha256` and `.sig`, `Cache-Control: public, max-age=300` on `/download/appcast.xml`.
- [ ] Edge: a symlink in `site/` → exit 1 naming it.
- [ ] Edge: `site/download/notes.txt`, `site/download/0.0.3/notes.txt` or `site/download/0.0.3/.DS_Store` → exit 1 naming it.
- [ ] Edge: a `_headers`, `_redirects` or `.assetsignore` anywhere in `site/` → exit 1 naming it.
- [ ] Edge: a directory `site/download/0.3/` or `00000.1.0/` → exit 1.
- [ ] Edge: a staged version whose `.sha256` does not match its DMG, or whose `.sig` fails `ssh-keygen -Y verify` → exit 1 naming the version.
- [ ] Edge: production's `.sha256` for `0.0.3` differs from the folder's → exit 1, "differs from the published file".
- [ ] Edge: a DMG of 25 MiB + 1 byte → exit 1, names the file and "R2 fallback (ADR 0072)", the staged directory left empty.
- [ ] Edge: the target directory not empty → exit 1, nothing written.
- [ ] Edge: production's `/download/latest` → `302` to `0.0.5`, not in `released` → exit 1, "would remove the published download".
- [ ] Edge: no release folder while production serves a release → exit 1, the same message.
- [ ] Edge: the production `curl` exits non-zero, or answers `500` → exit 1, never treated as "no release".
- [ ] Edge: no release folder and production answers `404` → exit 0, only the public files and `_headers`, no `_redirects`.
- [ ] Without `--stage-only`: the fake wrapper receives `pnpm --filter @todz/api exec wrangler deploy --assets <dir> --message <HEAD sha>`, and the version id it prints lands in `~/.todz-deploy/deployments/<HEAD sha>`.

## Unit — the secrets guard (`.agents/hooks/hooks.test.sh`)

- [ ] `security find-generic-password -s todz-release-key -w` → blocked, exit 2; the same with `-g` → blocked.
- [ ] A command naming `sparkle-project.org` → blocked.
- [ ] `pnpm release:mac`, `pnpm release:mac --dry-run` and `scripts/release-mac.sh --create-release-key` → allowed.
- [ ] `security find-generic-password -s todz-release-key` (no `-w`, no `-g`) → allowed.
- [ ] Both payload shapes (Claude Code and Codex) give the same answers.

## Unit — the landing

- [ ] The hero holds `<a class="download-button" href="/download" download>Download for Mac</a>` before the waitlist form.
- [ ] The note reads exactly "Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security." and its "Install steps" link is `https://docs.todz.app/install-on-mac`.
- [ ] The eyebrow reads `macOS 14 or later`.
- [ ] Neither `/` nor `/llms.txt` contains "coming soon" in any case.
- [ ] `/llms.txt`'s status line is the one in `design.md` §4.
- [ ] The waitlist form's markup is unchanged apart from its position after the download block (diff of `joinFormHtml` output before and after).

## Unit — the app and the repository

- [ ] `macos-release.test.ts`: every assertion of plan step 8 passes on `project.yml` and the committed plists and entitlements; with `revision` replaced by `exactVersion: 2.10.1` the test goes red (mutation; restore).
- [ ] `UpdateFeedTests`: `https://todz.app/download/appcast.xml` → that URL; absent → `nil`; `""` → `nil`; `http://todz.app/download/appcast.xml` → `nil`.
- [ ] `UpdatePresentationTests`: `handlesScheduledUpdate(immediateFocus: true)` → `true`; `(immediateFocus: false)` → `false`; `supportsGentleReminders` → `true`.
- [ ] `docs-pages.test.ts`: `install-on-mac.mdx` holds the exact allowed-signers line, the key's `ssh-keygen -lf` fingerprint, Team ID `XFWR794VS8`, the `ssh-keygen -Y verify` command of plan step 6, `shasum -a 256 -c`, ADR 0072 decision 3's trust sentence word for word, a link to `https://todz.app/download`, and no "until `mac-distribution` ships".
- [ ] `runbooks.test.ts`: the index sentence names `release-the-mac-app`; the runbook has a purpose, numbered steps and an `If it fails` line on each; `deploy-the-api.md` step 8 calls `scripts/deploy-worker.sh` and no bare `wrangler deploy`, and every script it names exists.

## Unit — the release command (`scripts/release-mac.test.sh`)

- [ ] A dirty tree → exit 1, `release-mac: the tree is not clean`, no `xcodebuild` call.
- [ ] Branch `feat/x` → exit 1, names the branch, no build.
- [ ] `HEAD` one commit ahead of `origin/main` → exit 1; one behind → exit 1.
- [ ] Tag `mac-v0.2.0` on another commit → exit 1, names the tag.
- [ ] `--version 0.1.9` with `mac-v0.2.0` existing → exit 1, "not greater".
- [ ] Build number 400 with production's appcast `sparkle:version` 412 → exit 1, "not greater"; build number 412 with that appcast at this version → accepted.
- [ ] The active deployment's message is not `HEAD`'s sha → exit 1, "deploy the API first", no build.
- [ ] The resolved Sparkle checkout at another commit → exit 1, names both commits.
- [ ] `security` finds no `todz-release-key` → exit 1, names `todz-release-key`, no build.
- [ ] `builds/0.2.0/commit` holds `HEAD` with a complete set → version `0.2.0`, no `xcodebuild`, no `hdiutil`, the sum and signature re-checked, the files' bytes unchanged.
- [ ] A crash after the build (the fake deploy fails), then a re-run → no `xcodebuild`, the same sum.
- [ ] A dry run then a real run → the same sum.
- [ ] `--dry-run` → exit 0, no tag created, nothing written under `site/`, no deploy, no push; prints the build path and the sum.
- [ ] The app without `runtime`, with `get-task-allow`, with `TeamIdentifier=ABCDE12345`, with an `embedded.provisionprofile`, or with a `com.apple.developer.` entitlement → exit 1 before `hdiutil` (one case each).
- [ ] The same five cases on `Contents/PlugIns/TodzWidgets.appex` → exit 1 before `hdiutil`.
- [ ] The built Info.plist's `SUFeedURL` other than `https://todz.app/download/appcast.xml`, or its `SUPublicEDKey` other than `generate_keys -p`'s output → exit 1.
- [ ] The new `.sig` failing `ssh-keygen -Y verify` against `apps/macos/release/allowed-signers` → exit 1 before any deploy.
- [ ] The agent: started as `ssh-agent -a ~/.todz-release/agent.<pid>.sock -s`; `ssh-add -l` checked empty before loading; the key loaded with `ssh-add -t 120 -`; an inherited `SSH_AUTH_SOCK` never reaches the fake `ssh-add`; the agent's PID killed and the socket removed on success, on a signing failure, and on SIGTERM during signing (one case each).
- [ ] The rendered appcast has one item, no `<description>`, no `sparkle:releaseNotesLink`, and `sign_update` is called on the DMG and then on `appcast.xml`.
- [ ] The happy path → `builds/0.2.0/` copied to `site/download/0.2.0/`, the active version id recorded, `deploy-worker.sh`, the production checks, then `0.2.0` appended to `released`, then `git tag mac-v0.2.0`, then `git push origin mac-v0.2.0`, in that order in the fakes' log; prints the URL and the sum.
- [ ] After the deploy, each of these → `wrangler rollback <the recorded version id>` (never a bare `rollback`), `site/download/0.2.0/` removed, `released` unchanged, no tag, no push, exit 1: the DMG answers `404`; its bytes differ from the sum; its signature fails; the appcast lacks `0.2.0`; the appcast's feed signature fails `sign_update --verify`.
- [ ] `0.2.0` in `released` with production serving the same sum → exit 0, "already published", no deploy; `git push origin mac-v0.2.0` only when `origin` lacks the tag.
- [ ] Production serving `0.2.0` with another sum → exit 1, "differs from the published file", no deploy.
- [ ] A fake `sign_update`, `codesign`, `hdiutil`, `xcodebuild`, Wrangler or `curl` that never returns → killed after the script's limit for that step, exit 1 naming the step (one case each).
- [ ] `notarytool` and `stapler` never appear in the fakes' log, in any case.
- [ ] `--create-release-key` with `todz-release-key` present → exit 1, "already exists", no `ssh-keygen` call.
- [ ] `--create-release-key` without it → the fake `security` is called as `security -i` and receives `add-generic-password -s todz-release-key -a release -w <value>` on standard input, never in its arguments (or, if the tester briefing records the real `-w` reading standard input, the fake asserts that form); a private key file exists only inside the fake `~/.todz-release` while the command runs and none remains when it returns; stdout is the line starting `release@todz.app namespaces="todz-release" ssh-ed25519 ` and its `SHA256:` fingerprint.
- [ ] `FAKE-PRIVATE-KEY-VALUE` appears in no stdout, stderr, log file or recorded argument, in any case.

## E2E (Playwright specs, a `wrangler dev --assets` server on the staged fixture)

- [ ] `download.spec.ts`: `GET /download` and `/download/latest` → `302`, `Location` `/download/0.0.2/Todz-0.0.2.dmg`; record every header the `302` carries (whether `nosniff` and HSTS are there).
- [ ] The DMG → `200`, `Content-Disposition: attachment; filename="Todz-0.0.2.dmg"`, `Cache-Control: public, max-age=31536000, immutable`, `x-content-type-options: nosniff`, `strict-transport-security`, an `ETag`, the fixture's exact bytes; record its `Content-Type`.
- [ ] `.sha256` and `.sig` → `200`, immutable; record their `Content-Type` (expected `text/plain; charset=utf-8`; if the assets keep the inferred type, record it and the plan's failure-mode row applies).
- [ ] `/download/appcast.xml` → `200`, `max-age=300`.
- [ ] The previous version `/download/0.0.1/Todz-0.0.1.dmg` → `200`.
- [ ] Edge: `/download/0.2/x.dmg`, `/download/0.0.2/notes.txt`, `/download/9.9.9/Todz-9.9.9.dmg`, `/download/0.0.2/Todz-0.0.2.dmg/`, `/download/..%2F_headers` → the site's `404`; `/_headers` and `/_redirects` are not served.
- [ ] `/health` and `/sign-in` answer from the Worker as on the unstaged server (the `run_worker_first` list survives `--assets`).
- [ ] `landing.spec.ts` at 1280 light: the button and the note are visible above the waitlist form; screenshot.
- [ ] 1280 dark (`colorScheme: 'dark'`): the same; screenshot.
- [ ] 375 light and dark: the button is the column's full width, the note wraps, `scrollWidth <= clientWidth`; screenshots.
- [ ] A click on the button → a `download` event whose suggested file name is `Todz-0.0.2.dmg`.
- [ ] Keyboard: Tab reaches the button after the hero lead and before the waitlist input, with the focus ring visible.

## Prove it for real — Playwright MCP

- [ ] Happy path on the local server with the staged fixture: open `/`, read the hero, click "Download for Mac" → a download starts; follow "Install steps" → `https://docs.todz.app/install-on-mac`.
- [ ] Empty: assets staged with no release folder → the button's request answers `404`; the landing itself renders unchanged.
- [ ] Narrow (375) and wide (1280), light and dark: no overlap with the stage figure; console clean; network shows `302` then `200` with the headers above.
- [ ] Reload mid-flow (after the redirect): the DMG answers again with its `ETag`; a request with `If-None-Match` answers `304` or `200` with the same bytes (record which).

## The release, by hand on this Mac (tester, then the runbook)

- [ ] Before any real `--create-release-key`: on a throwaway keychain in the scratchpad (deleted after), whether `security add-generic-password -s probe -a probe -w` with no value reads standard input; record the answer in the tester briefing.
- [ ] `pnpm release:mac --dry-run` on a clean `main` → prints `~/.todz-release/builds/<version>/Todz-<version>.dmg` and its sum; `ls ~/.todz-release/site/download` has no `<version>`; `git tag -l mac-v<version>` prints nothing; `curl -sS -o /dev/null -w '%{http_code}' https://todz.app/download/<version>/Todz-<version>.dmg` → `404`.
- [ ] On that DMG: `shasum -a 256 -c Todz-<version>.dmg.sha256` → `OK`.
- [ ] `ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` → `Good "todz-release" signature for release@todz.app`.
- [ ] One byte appended to a copy of the DMG → `ssh-keygen -Y verify` exits 255, `incorrect signature`; `shasum -c` → `FAILED`.
- [ ] The mounted app and its widget extension: `codesign --verify --deep --strict` passes; `codesign -dv` shows `TeamIdentifier=XFWR794VS8`, `flags=0x10000(runtime)`; `codesign -d --entitlements -` has no `get-task-allow`; no `embedded.provisionprofile`; `spctl -a -vv` → `rejected`, `origin=Apple Development: …`.
- [ ] `ls -ld ~/.todz-release` shows `drwx------`; `grep -rE 'OPENSSH PRIVATE KEY|b3BlbnNzaC1rZXktdjE|LS0tLS1CRUdJTiBPUEVOU1NI'` over the run's output and `~/.todz-release` finds nothing; the tester never reads a Keychain value; `git status --porcelain` stays empty after the run (no DMG in the repository).
- [ ] Update, once, with the owner's app quit (the popover rule): a copy of the dry-run app at version N in the scratchpad; N+1 built by a dry run from a throwaway worktree one empty commit ahead of N, never pushed; `SUFeedURL` overridden in N's container preferences to a local signed appcast of N+1 → "Check for Updates…" offers N+1, installs it, relaunches, and the About window shows N+1. Then the same appcast with one byte of its feed signature altered → Sparkle refuses the feed and N keeps running; then a valid feed whose enclosure `sparkle:edSignature` is altered → Sparkle refuses the update.
- [ ] Gentle reminders: with N running in the background and another app in front, a scheduled check that finds N+1 opens no window over that app; bringing todz forward or "Check for Updates…" shows it.
- [ ] Debug build: no "Check for Updates…" item.

## Tester results: one pass under lighter gates, at `b4ae3f0e`

Scope: visible behaviour only, against a local `wrangler dev` (8891 with no release staged, 8892 with the staged fixture from `stage-fixture-site.sh`), the docs page read as text, and a scratch Release bundle. The Playwright MCP browser is not installed on this Mac, so the walk was scripted with Playwright's library on system Chrome; no spec file was committed. Unit, E2E, typecheck and the release-by-hand boxes above were not run in this pass.

- PASS: landing with nothing released: the eyebrow reads "macOS · Coming soon", no `a.download-button`, the waitlist form is the hero's action.
- PASS: landing with the fixture released: eyebrow "macOS 14 or later", "Download for Mac" with `href="/download"` and `download`, above the waitlist form; the note reads "Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security." and "Install steps" links `https://docs.todz.app/install-on-mac`; no "coming soon" in the page.
- PASS: `/download` and `/download/latest` answer 302 to `/download/0.0.2/Todz-0.0.2.dmg`; the DMG answers 200 with `Content-Disposition: attachment; filename="Todz-0.0.2.dmg"`, `Cache-Control: public, max-age=31536000, immutable`, `Content-Type: application/octet-stream`; `/download/appcast.xml` answers 200 `application/xml`. The 302 carries HSTS, CSP `default-src 'none'`, referrer-policy and `nosniff`. With nothing released `/download` answers 404.
- PASS: `/llms.txt` makes no download claim in either state ("in development: the macOS app is not yet notarized by Apple and the waitlist is open").
- PASS: no horizontal overflow and no console error or 4xx/5xx response at 1280 and 375, light and dark, in both states. At 375 the button is the column's width (343 of 343 px, x=16), the note wraps; at 1280 the button is 200 px wide, centred, above the form.
- PASS: `apps/docs/install-on-mac.mdx` (read as text; Mintlify not run): offers the download only "When todz.app shows **Download for Mac**", gives the build-from-source section, the `allowed-signers` line, `ssh-keygen -Y verify` and `shasum -a 256 -c`, and the trust statement. The fingerprint `SHA256:yBlPOn96/UZM6GGCo//eqZtFjWl440Hr6rxWa0VS5Tk` was recomputed from the key (`ssh-keygen -lf -` on the key alone) and matches the page.
- PASS: the scratch Release app (`dev.todz.Todz`, built into the scratchpad, never `/Applications`) launched with `lastClosedDay` and `lastMorningGlanceDay` passed as argument-domain overrides, showed "Check for Updates…" under the Todz menu, and was quit.
- PASS: `codesign -dv`: `flags=0x10000(runtime)`, `TeamIdentifier=XFWR794VS8`; `codesign --verify --deep --strict` passes; the built Info.plist's `SUFeedURL` is `https://todz.app/download/appcast.xml`.
- NOT RUN: the update check (no release exists), `pnpm release:mac`, any Keychain read, anything against production, the Mintlify render, the click-to-download event and the Tab-focus ring.
- Media: `.pr-media/mac-distribution/landing-{nothing-released,released}-{1280,375}-{light,dark}.png`.

## Edge cases hunted during execution

- [ ] (add each new one here with its regression test)

## Adversarial review

- [ ] Reviewer: the three claims most likely wrong — (1) no deploy can publish a dry run or a failed release, or drop the published download (the `builds/`/`site/` split, `released`, the staging's refusals, `deploy-the-api.md` never deploying without the script); (2) the private keys never reach a file (outside `--create-release-key`'s moment), an argument or a log, and the guard stops an agent reading them; (3) a re-run never rewrites a published file and resumes the same version — each attacked with a concrete input, recorded here.
- [ ] Security reviewer: the staged directory holds nothing but the archived public folder and released files (no key, no `.env`, no source); the update channel (a signed feed and signed enclosures over HTTPS from the same Worker, EdDSA as the only trust); the trust limit stated on the docs page and the fingerprint anchored outside the zone; the wrapper's command mode; the rollback target.

## Coverage honesty

- A launch on a Mac outside this one is not proven by this plan; the owner's check (runbook step 5) is.
- Sparkle's update against the production feed is first proven by the second real release, recorded in the runbook's releases table.
- Gatekeeper's Open Anyway flow on a quarantined download is the owner's check too: this Mac built the app, so its own copy has no quarantine from a browser.
- `_headers` and `_redirects` are proven on the local server; production's answers are proven by runbook step 8 after the first release.
- The keys are not protected from other processes in the owner's session; the guard covers agents only.
