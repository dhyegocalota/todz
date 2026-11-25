# Test plan: Mac distribution

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/site-pages.test.ts` (the hero cases) red at its own commit — expected: the download button and note assertions fail on the current hero; record the text.
- [ ] `apps/api/e2e/download.spec.ts` and the download cases of `landing.spec.ts` red at their own commit — expected: `/download` answers `404` and no `.download-button` locator; record the text.
- [ ] `tools/repository-shape/src/macos-release.test.ts` red at its own commit — expected: `ENABLE_HARDENED_RUNTIME` is `NO`, no Sparkle package; record the text.
- [ ] `UpdateFeedTests` red at its own commit — expected: `UpdateFeed is not implemented`; record the text.
- [ ] `scripts/stage-site-assets.test.sh` red at its own commit — expected: every case fails on `stage-site-assets is not implemented`; record the text.
- [ ] `scripts/release-mac.test.sh` red at its own commit — expected: every case fails on `release-mac is not implemented`; record the text.
- [ ] `tools/repository-shape/src/runbooks.test.ts` (the exception sentence) red at its own commit — expected: the index lacks `release-the-mac-app` in the sentence.
- [ ] `tools/repository-shape/src/deploy-skill.test.ts` red at its own commit — expected: no `.agents/skills/deploy/SKILL.md`; record the text.
- [ ] `git log --oneline` shows each red commit before its green one.

## Unit — the deploy skill (`deploy-skill.test.ts`)

- [ ] The skill's front matter has `name: deploy` and a description that calls it the one way an agent deploys.
- [ ] Its body names `docs/runbooks/deploy-the-api.md`, which exists, and `pnpm release:mac`.
- [ ] Its release condition is `git diff --quiet <tag> HEAD -- apps/macos` against the highest `mac-v*` tag, and "no tag" means the first release.
- [ ] It holds the four checks: the `302` of `https://todz.app/download/latest` to the new version, `shasum -a 256 -c`, `ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release`, and `sparkle:shortVersionString="<version>"` in the appcast.
- [ ] It says it stops at the first failure and leaves the previous release live.
- [ ] It says that while `release:mac` is not a root script it deploys the API alone and reports "the Mac release is not live yet".
- [ ] `.agents/skills/README.md` and `.claude/HARNESS.md` (layout line and §10 table) name `deploy`; `.claude/skills/deploy/SKILL.md` resolves through the symlink.
- [ ] Mutation: delete the stop-at-first-failure sentence from the skill → the test goes red; restore.

## Unit — the staging (`scripts/stage-site-assets.test.sh`)

- [ ] A fake release folder with `0.0.1`, `0.0.2` and `0.0.3` → `<out>/download/` holds `0.0.2/` and `0.0.3/` (three files each), `appcast.xml` and `allowed-signers`, and no `0.0.1/`; `<out>` also holds every file of `apps/api/public` byte for byte.
- [ ] `<out>/_redirects` is exactly `/download /download/0.0.3/Todz-0.0.3.dmg 302` and `/download/latest /download/0.0.3/Todz-0.0.3.dmg 302`, nothing else.
- [ ] `<out>/_headers` starts with `apps/api/public/_headers` unchanged, then the `/download/*` rules: `Content-Disposition: attachment` on `*.dmg` only, `Cache-Control: public, max-age=31536000, immutable` on `/download/*/*`, `Content-Type: text/plain; charset=utf-8` on `*.sha256` and `*.sig`, `Cache-Control: public, max-age=300` on `appcast.xml` and `allowed-signers`.
- [ ] Versions compare numerically: `0.0.10` is newer than `0.0.9`.
- [ ] Edge: a DMG of 25 MiB + 1 byte → exit 1, names the file and "R2 fallback (ADR 0072)", `<out>` left empty.
- [ ] Edge: `<out>` not empty → exit 1, nothing written.
- [ ] Edge: production's `/download/latest` → `302` to `0.0.4`, which the folder lacks → exit 1, "would remove the published download".
- [ ] Edge: no release folder while production serves a release → exit 1, the same message.
- [ ] Edge: no release folder and production answers `404` → exit 0, only `apps/api/public` and its `_headers`, no `_redirects`.
- [ ] Edge: a file in the release folder outside the three names (`download/0.0.3/notes.txt`) → not copied.

## Unit — the landing

- [ ] The hero holds `<a class="download-button" href="/download" download>Download for Mac</a>` before the waitlist form.
- [ ] The note reads exactly "Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security." and its "Install steps" link is `https://docs.todz.app/install-on-mac`.
- [ ] The eyebrow reads `macOS 14 or later`.
- [ ] Neither `/` nor `/llms.txt` contains "coming soon" in any case.
- [ ] `/llms.txt`'s status line is the one in `design.md` §4.
- [ ] The waitlist form's markup is unchanged apart from its position after the download block (diff of `joinFormHtml` output before and after).

## Unit — the app and the repository

- [ ] `macos-release.test.ts`: every assertion of plan step 8 passes on `project.yml`.
- [ ] `UpdateFeedTests`: `https://todz.app/download/appcast.xml` → that URL; absent → `nil`; `""` → `nil`; `http://todz.app/download/appcast.xml` → `nil`.
- [ ] `docs-pages.test.ts`: `install-on-mac.mdx` holds the exact allowed-signers line of `apps/macos/release/allowed-signers`, the `ssh-keygen -Y verify` command of plan step 6, `shasum -a 256 -c`, a link to `https://todz.app/download`, and no "until `mac-distribution` ships".
- [ ] `runbooks.test.ts`: the index sentence names `release-the-mac-app`; the runbook has a purpose, numbered steps and an `If it fails` line on each; `deploy-the-api.md`'s deploy step stages before `wrangler deploy --assets` and every script it names exists.

## Unit — the release command (`scripts/release-mac.test.sh`)

- [ ] A dirty tree → exit 1, `release-mac: the tree is not clean`, no `xcodebuild` call.
- [ ] Branch `feat/x` → exit 1, names the branch, no build.
- [ ] `HEAD` one commit ahead of `origin/main` → exit 1; one behind → exit 1.
- [ ] Tag `mac-v0.2.0` on another commit → exit 1, names the tag.
- [ ] `--version 0.1.9` with `mac-v0.2.0` existing → exit 1, "not greater".
- [ ] Build number 400 with the deployed appcast's `sparkle:version` 412 → exit 1, "not greater".
- [ ] `wrangler d1 migrations list --remote` listing a pending migration → exit 1 before the build.
- [ ] `codesign -dv` without `runtime` → exit 1 before `hdiutil`.
- [ ] Entitlements with `get-task-allow` → exit 1 before `hdiutil`.
- [ ] `TeamIdentifier=ABCDE12345` → exit 1 before `hdiutil`.
- [ ] `security` finds no `todz-release-key` → exit 1, names `todz-release-key`, no deploy.
- [ ] The release folder already holds `0.2.0` → no `xcodebuild`, no `hdiutil`, its files' bytes unchanged.
- [ ] Production already serves `0.2.0` with the same sum → exit 0, "already published", no deploy, prints the URL and the sum.
- [ ] Production serves `0.2.0` with another sum → exit 1, "differs from the published file", no deploy.
- [ ] The happy path → staging, `wrangler deploy --assets`, the production checks (`/download/latest`, the DMG, its sum, its signature, the appcast's version), then `git push origin mac-v0.2.0`, in that order in the fakes' log; prints the URL and the sum.
- [ ] After the deploy the fake production DMG answers `404`, or other bytes, or a signature that fails, or an appcast without `0.2.0` → `wrangler rollback` in the log, exit 1, no push (one case each).
- [ ] `--dry-run` → exit 0, no staging, no deploy, no push, prints the local DMG path and the sum.
- [ ] `notarytool` and `stapler` never appear in the fakes' log, in any case.
- [ ] Signing fails → the fake agent's kill is in the log.
- [ ] `--create-release-key` with `todz-release-key` present → exit 1, "already exists", no `ssh-keygen` call.
- [ ] `--create-release-key` without it → the fake `security` gets the key on standard input and not in its arguments; no file under the fake `~/.todz-release` holds a private key afterwards; stdout is one line starting `release@todz.app namespaces="todz-release" ssh-ed25519 `.
- [ ] `FAKE-PRIVATE-KEY-VALUE` appears in no stdout, stderr, log file or recorded argument, in any case.

## E2E (Playwright specs, a server on the staged fixture assets)

- [ ] `download.spec.ts`: `GET /download` and `/download/latest` → `302`, `Location` `/download/0.0.2/Todz-0.0.2.dmg`.
- [ ] The DMG → `200`, `Content-Disposition: attachment; filename="Todz-0.0.2.dmg"`, `Cache-Control: public, max-age=31536000, immutable`, an `ETag`, the fixture's exact bytes; record its `Content-Type`.
- [ ] `.sha256` and `.sig` → `200`, immutable; record their `Content-Type` (expected `text/plain; charset=utf-8`; if the assets keep the inferred type, record it and the plan's failure-mode row applies).
- [ ] `/download/appcast.xml` → `200`, `max-age=300`; `/download/allowed-signers` → the fixture's line.
- [ ] The previous version `/download/0.0.1/Todz-0.0.1.dmg` → `200`.
- [ ] Edge: `/download/0.2/x.dmg`, `/download/0.0.2/notes.txt`, `/download/9.9.9/Todz-9.9.9.dmg`, `/download/0.0.2/Todz-0.0.2.dmg/`, `/download/..%2F_headers` → the site's `404`; `/_headers` and `/_redirects` are not served.
- [ ] Every answer carries `x-content-type-options: nosniff`, `referrer-policy` and `strict-transport-security`.
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

- [ ] `pnpm release:mac --dry-run` on a clean `main` → prints `~/.todz-release/site/download/<version>/Todz-<version>.dmg` and its sum; `curl -sS -o /dev/null -w '%{http_code}' https://todz.app/download/<version>/Todz-<version>.dmg` → `404` (nothing deployed).
- [ ] On that DMG: `shasum -a 256 -c Todz-<version>.dmg.sha256` → `OK`.
- [ ] `ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` → `Good "todz-release" signature for release@todz.app`.
- [ ] One byte appended to a copy of the DMG → `ssh-keygen -Y verify` exits 255, `incorrect signature`; `shasum -c` → `FAILED`.
- [ ] The mounted app: `codesign --verify --deep --strict` passes; `codesign -dv` shows `TeamIdentifier=XFWR794VS8`, `flags=0x10000(runtime)`; `codesign -d --entitlements -` has no `get-task-allow`; `spctl -a -vv` → `rejected`, `origin=Apple Development: …`.
- [ ] `ls -ld ~/.todz-release` shows `drwx------`; `grep -r` of the run's output and of `~/.todz-release` for the release key's first 16 base64 characters finds nothing; `git status --porcelain` stays empty after the run (no DMG in the repository).
- [ ] Update, once, with the owner's app quit (the popover rule): a copy of the dry-run app at version N in the scratchpad, with `SUFeedURL` overridden in its container's preferences to a local appcast of version N+1 built by a second dry run → "Check for Updates…" offers N+1, installs it, relaunches, and the About window shows N+1. Then the same appcast with its `sparkle:edSignature` altered → Sparkle refuses ("improperly signed") and N keeps running.
- [ ] Debug build: no "Check for Updates…" item.

## Edge cases hunted during execution

- [ ] (add each new one here with its regression test)

## Adversarial review

- [ ] Reviewer: the three claims most likely wrong — (1) no deploy can drop the published download (the staging's refusals, and `deploy-the-api.md` never deploying without staging); (2) the private keys never reach a file, argument or log; (3) a re-run never rewrites a published file — each attacked with a concrete input, recorded here.
- [ ] Security reviewer: the staged directory holds nothing but the public folder and the release files (no key, no `.env`, no source); the update channel (a feed served over HTTPS from the same Worker, EdDSA as the only trust); the allowed-signers line anchored off the binary's host; the wrapper's command mode.

## Coverage honesty

- A launch on a Mac outside this one is not proven by this plan; the owner's check (runbook step 5) is.
- Sparkle's update against the production feed is first proven by the second real release, recorded in the runbook's releases table.
- Gatekeeper's Open Anyway flow on a quarantined download is the owner's check too: this Mac built the app, so its own copy has no quarantine from a browser.
- `_headers` and `_redirects` are proven on the local server; production's answers are proven by runbook step 8 after the first release.
