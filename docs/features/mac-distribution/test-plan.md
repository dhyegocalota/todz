# Test plan: Mac distribution

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/download-routes.test.ts` red at its own commit — expected: every case fails on `serveDownload is not implemented`; record the printed text.
- [ ] `apps/api/test/site-pages.test.ts` (the hero cases) red at its own commit — expected: the download button and note assertions fail on the current hero; record the text.
- [ ] `apps/api/e2e/landing.spec.ts` (the download cases) red at its own commit — expected: no `.download-button` locator; record the text.
- [ ] `tools/repository-shape/src/macos-release.test.ts` red at its own commit — expected: `ENABLE_HARDENED_RUNTIME` is `NO`, no Sparkle package; record the text.
- [ ] `UpdateFeedTests` red at its own commit — expected: `UpdateFeed is not implemented`; record the text.
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

## Unit — the Worker

- [ ] `GET /download` with `latest.json` `{version:"0.2.0",build:412,sha256:<64 hex>}` → `302`, `Location: /download/0.2.0/Todz-0.2.0.dmg`, `Cache-Control: no-cache`.
- [ ] `GET /download/latest` → the same answer as `/download`.
- [ ] `HEAD /download` → `302` with the same `Location`, empty body.
- [ ] No `latest.json` → `/download` answers `404`, the site's no-route body.
- [ ] `latest.json` `{}`, `{"version":"0.2.0"}` and `not json` → `503`, one `download_pointer_invalid` log line, the pointer's body in no log line.
- [ ] `GET /download/0.2.0/Todz-0.2.0.dmg` → `200`, `Content-Type: application/x-apple-diskimage`, `Content-Disposition: attachment; filename="Todz-0.2.0.dmg"`, `Cache-Control: public, max-age=31536000, immutable`, `ETag` equal to the object's, `Content-Length` equal to its size, the exact bytes.
- [ ] `HEAD` of the DMG → the same headers, empty body.
- [ ] `.dmg.sha256` and `.dmg.sig` → `200`, `Content-Type: text/plain; charset=utf-8`, the immutable `Cache-Control`.
- [ ] `/download/appcast.xml` → `200`, `Content-Type: application/xml; charset=utf-8`, `Cache-Control: public, max-age=300`.
- [ ] A well-formed versioned path whose object is absent (`/download/9.9.9/Todz-9.9.9.dmg`) → `404`.
- [ ] Edge: `/download/latest.json` → `404`, zero bucket reads.
- [ ] Edge: `/download/0.2/Todz-0.2.dmg` → `404`, zero reads.
- [ ] Edge: `/download/0.2.0/Todz-0.3.0.dmg` (version and name disagree) → `404`, zero reads.
- [ ] Edge: `/download/0.2.0/notes.txt` → `404`, zero reads.
- [ ] Edge: `/download/0.2.0/Todz-0.2.0.dmg/` (trailing slash) → `404`, zero reads.
- [ ] Edge: `/download/0.2.0%2FTodz-0.2.0.dmg` and `/download/..%2Flatest.json` → `404`, zero reads.
- [ ] Edge: `/download/00000.2.0/Todz-00000.2.0.dmg` (a part over four digits) → `404`, zero reads.
- [ ] Edge: `POST /download` → the site's no-route answer, zero reads.
- [ ] Every answer above carries `x-content-type-options: nosniff`, `referrer-policy` and `strict-transport-security` from `withSecurityHeaders`.

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
- [ ] `runbooks.test.ts`: the index sentence names `release-the-mac-app`; the runbook has a purpose, numbered steps and an `If it fails` line on each.

## Unit — the release command (`scripts/release-mac.test.sh`)

- [ ] A dirty tree → exit 1, `release-mac: the tree is not clean`, no `xcodebuild` call.
- [ ] Branch `feat/x` → exit 1, names the branch, no build.
- [ ] `HEAD` one commit ahead of `origin/main` → exit 1; one behind → exit 1.
- [ ] Tag `mac-v0.2.0` on another commit → exit 1, names the tag.
- [ ] `--version 0.1.9` with `mac-v0.2.0` existing → exit 1, "not greater".
- [ ] Build number 400 with `latest.json` build 412 → exit 1, "not greater".
- [ ] `codesign -dv` without `runtime` → exit 1 before `hdiutil`.
- [ ] Entitlements with `get-task-allow` → exit 1 before `hdiutil`.
- [ ] `TeamIdentifier=ABCDE12345` → exit 1 before `hdiutil`.
- [ ] `security` finds no `todz-release-key` → exit 1, names `todz-release-key`, no `put`.
- [ ] A published DMG whose sum differs → exit 1, no pointer written, no push.
- [ ] All three objects published with the same sums → exit 0, "already published", no `put`, prints the URL and the sum.
- [ ] Only the `.sig` missing → one `put` for it, then `appcast.xml`, then `latest.json`, then `git push origin mac-v0.2.0`, in that order in the fakes' log.
- [ ] `--dry-run` → exit 0, no `put`, no push, prints the local DMG path and the sum.
- [ ] `notarytool` and `stapler` never appear in the fakes' log, in any case.
- [ ] The fake production `curl` answers `404` for the uploaded DMG → exit 1, no pointer `put`, no push.
- [ ] The production DMG's bytes differ from the local sum → exit 1, no pointer `put`.
- [ ] The production signature fails `ssh-keygen -Y verify` → exit 1, no pointer `put`.
- [ ] The read-back of `latest.json` differs from what was written → the saved previous `latest.json` and `appcast.xml` are `put` back, exit 1, no push.
- [ ] Signing fails → the fake agent's kill is in the log.
- [ ] `--create-release-key` with `todz-release-key` present → exit 1, "already exists", no `ssh-keygen` call.
- [ ] `--create-release-key` without it → the fake `security` gets the key on standard input and not in its arguments; no file under the fake `~/.todz-release` holds a private key afterwards; stdout is one line starting `release@todz.app namespaces="todz-release" ssh-ed25519 `.
- [ ] `FAKE-PRIVATE-KEY-VALUE` appears in no stdout, stderr, log file or recorded argument, in any case.

## E2E (Playwright specs)

- [ ] `landing.spec.ts` at 1280 light: the button and the note are visible above the waitlist form; screenshot.
- [ ] 1280 dark (`colorScheme: 'dark'`): the same; screenshot.
- [ ] 375 light and dark: the button is the column's full width, the note wraps, `scrollWidth <= clientWidth`; screenshots.
- [ ] A click on the button with the seeded local bucket → a `download` event whose suggested file name is `Todz-0.0.1.dmg`.
- [ ] Keyboard: Tab reaches the button after the hero lead and before the waitlist input, with the focus ring visible.

## Prove it for real — Playwright MCP

- [ ] Happy path on the local Worker with a seeded bucket: open `/`, read the hero, click "Download for Mac" → a download starts; follow "Install steps" → `https://docs.todz.app/install-on-mac`.
- [ ] Empty: no `latest.json` in the local bucket → the button's request answers `404`; the landing itself renders unchanged.
- [ ] Narrow (375) and wide (1280), light and dark: no overlap with the stage figure; console clean; network shows `302` then `200` with the headers of the unit section.
- [ ] Reload mid-flow (after the redirect): the DMG answers again with `ETag`; a conditional request with `If-None-Match` answers `304` or `200` with the same bytes (record which).

## The release, by hand on this Mac (tester, then the runbook)

- [ ] `pnpm release:mac --dry-run` on a clean `main` → prints `~/.todz-release/<version>/Todz-<version>.dmg` and its sum; nothing in R2 (`wrangler r2 object get` of the key fails).
- [ ] On that DMG: `shasum -a 256 -c Todz-<version>.dmg.sha256` → `OK`.
- [ ] `ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` → `Good "todz-release" signature for release@todz.app`.
- [ ] One byte appended to a copy of the DMG → `ssh-keygen -Y verify` exits 255, `incorrect signature`; `shasum -c` → `FAILED`.
- [ ] The mounted app: `codesign --verify --deep --strict` passes; `codesign -dv` shows `TeamIdentifier=XFWR794VS8`, `flags=0x10000(runtime)`; `codesign -d --entitlements -` has no `get-task-allow`; `spctl -a -vv` → `rejected`, `origin=Apple Development: …`.
- [ ] `ls ~/.todz-release` shows mode `drwx------`; `grep -r` of the run's output and of `~/.todz-release` for the release key's first 16 base64 characters finds nothing.
- [ ] Update, once, with the owner's app quit (the popover rule): a copy of the dry-run app at version N in the scratchpad, with `SUFeedURL` overridden in its container's preferences to a local appcast of version N+1 built by a second dry run → "Check for Updates…" offers N+1, installs it, relaunches, and the About window shows N+1. Then the same appcast with its `sparkle:edSignature` altered → Sparkle refuses ("improperly signed") and N keeps running.
- [ ] Debug build: no "Check for Updates…" item.

## Edge cases hunted during execution

- [ ] (add each new one here with its regression test)

## Adversarial review

- [ ] Reviewer: the three claims most likely wrong — (1) the guard reads R2 for no path outside the three names; (2) the private keys never reach a file, argument or log; (3) a re-run never replaces a versioned object — each attacked with a concrete input, recorded here.
- [ ] Security reviewer: the update channel (a feed served over HTTPS from the same Worker, EdDSA as the only trust), the allowed-signers file published off the binary's host, the wrapper's command mode.

## Coverage honesty

- A launch on a Mac outside this one is not proven by this plan; the owner's check (runbook step 6) is.
- Sparkle's update against the production feed is first proven by the second real release, recorded in the runbook's releases table.
- Gatekeeper's Open Anyway flow on a quarantined download is the owner's check too: this Mac built the app, so its own copy has no quarantine from a browser.
