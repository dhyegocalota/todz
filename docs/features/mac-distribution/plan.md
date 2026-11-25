# Plan: Mac distribution

**Spec:** spec.md
**Tier:** 🔴
**Seam:** the site router of the `todz.app` host (`site-endpoint.ts`), the hero of `landing-page.ts`, `apps/macos/project.yml` and the app's commands, and a new release script beside `scripts/todz-cloudflare.sh`.
**Assumptions (decided, owner can override):**
- Sparkle `2.10.1` is the pinned version (latest on 2026-11-25, published 2026-10-25).
- The first release is `0.2.0` (the project's `MARKETING_VERSION` is `0.1.0`, which was never published).
- The release key's principal is `release@todz.app`, its namespace `todz-release`.
- `latest.json` is the only source of "latest"; the Worker never lists the bucket.
- `waitlist-inline` and `mac-install-docs` merge before G1 starts; G1 merges `main` first.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/site/download-routes.ts` (new), `apps/api/src/site/site-endpoint.ts`, `apps/api/src/env.ts`, `apps/api/wrangler.jsonc`, `apps/api/src/site/landing-copy.ts`, `apps/api/src/site/landing-page.ts`, `apps/api/src/site/site-style.ts`, `apps/api/src/site/site-urls.ts`, `apps/api/src/site/discovery-copy.ts`, `apps/api/test/download-routes.test.ts` (new), `apps/api/test/site-pages.test.ts`, `apps/api/e2e/landing.spec.ts`, `apps/api/e2e/` seeding helper (new, if needed), `apps/api/README.md`, `apps/docs/install-on-mac.mdx`, `tools/repository-shape/src/docs-pages.test.ts` | `developer-web` |
| G2 | `apps/macos/project.yml`, `apps/macos/Todz/Updates/` (new), `apps/macos/Todz/AppCommands.swift`, `apps/macos/Copy/UpdateCopy.swift` (new), `apps/macos/TodzKit/Sources/TodzKit/UpdateFeed.swift` (new), `apps/macos/TodzKit/Tests/TodzKitTests/UpdateFeedTests.swift` (new), `tools/repository-shape/src/macos-release.test.ts` (new), `apps/macos/README.md` | `developer-app` |
| G3 | `scripts/release-mac.sh` (new), `scripts/release-mac.test.sh` (new), `scripts/README.md`, `scripts/verify-gates.tsv`, `package.json`, `docs/runbooks/release-the-mac-app.md`, `docs/runbooks/README.md`, `tools/repository-shape/src/runbooks.test.ts`, `AGENTS.md` (the `scripts` layout line) | `developer-release` |
| Lead | `apps/macos/release/allowed-signers` (new), the Keychain items, the bucket | the lead |

## Sequencing

G2 and G3 start at once; they share no file. G1 starts when `waitlist-inline` and `mac-install-docs` are on `main` (both touch `landing-copy.ts`, `landing-page.ts`, `site-style.ts`, `site-urls.ts`, `site-pages.test.ts`, `landing.spec.ts`; `mac-install-docs` creates `install-on-mac.mdx`). Step 9 (the lead's keys) waits for G2's step 8, which brings Sparkle's `generate_keys`, and G3's step 15, which brings `--create-release-key`; G2's step 10 and G1's step 6 wait for step 9. The owner's two blockers (the R2 permission, the other-Mac check) gate only section Z.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1 — the Worker and the landing

- [ ] **Step 1 (red):** `apps/api/test/download-routes.test.ts` against a stubbed `serveDownload` that throws `serveDownload is not implemented`, with an R2 binding whose reads are counted. Cases: `GET` and `HEAD` `/download` and `/download/latest` with `latest.json` `{version:"0.2.0",build:412,sha256:<64 hex>}` → `302`, `Location: /download/0.2.0/Todz-0.2.0.dmg`, `Cache-Control: no-cache`; no `latest.json` → `404`; `latest.json` missing `build`, or `{}` or not JSON → `503` and one `download_pointer_invalid` log line without the body; the DMG → `200`, `Content-Type: application/x-apple-diskimage`, `Content-Disposition: attachment; filename="Todz-0.2.0.dmg"`, `Cache-Control: public, max-age=31536000, immutable`, the object's `ETag` and `Content-Length`, the bytes; `HEAD` the DMG → the same headers, no body; `.sha256` and `.sig` → `text/plain; charset=utf-8`, immutable; `/download/appcast.xml` → `application/xml; charset=utf-8`, `max-age=300`; a versioned object absent → `404`; each of `/download/latest.json`, `/download/0.2/Todz-0.2.dmg`, `/download/0.2.0/Todz-0.3.0.dmg`, `/download/0.2.0/notes.txt`, `/download/0.2.0/Todz-0.2.0.dmg/`, `/download/0.2.0%2FTodz-0.2.0.dmg`, `/download/..%2Flatest.json`, `/download/00000.2.0/Todz-00000.2.0.dmg` → `404` with zero bucket reads; `POST /download` → the site's no-route answer; every answer carries the security headers. Commit `test(mac-distribution): …` alone; record the printed failure.
- [ ] **Step 2 (green):** `download-routes.ts`: one handler per file kind in a record keyed by the kind, the version and name guard before any read, the pointer parsed into a required shape; `RELEASES: R2Bucket` in `env.ts`; `r2_buckets` `{binding:"RELEASES",bucket_name:"todz-releases"}` in `wrangler.jsonc`; `site-endpoint.ts` sends `/download` and paths under `/download/` to it. Constants (`DOWNLOAD_PATH`, the cache lifetimes, the content types) at the top of the module or in `libs/types` where a constant already lives.
- [ ] **Step 3 (red):** `apps/api/test/site-pages.test.ts`: the landing's hero has `<a class="download-button" href="/download" download>Download for Mac</a>`, then the note "Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security." with an "Install steps" link to `https://docs.todz.app/install-on-mac`; the eyebrow is `macOS 14 or later`; neither the landing nor `/llms.txt` contains "Coming soon" or "coming soon"; the status line is the one in `design.md` §4. Commit alone.
- [ ] **Step 4 (red):** `apps/api/e2e/landing.spec.ts`: at 1280 and 375, light and dark, the button and the note are visible above the waitlist form, the page has no horizontal scroll, and a click on the button with a seeded local bucket (`wrangler r2 object put --local` of a tiny `Todz-0.0.1.dmg`, its sum, signature and `latest.json`) fires a download named `Todz-0.0.1.dmg`. Commit alone.
- [ ] **Step 5 (green):** `LANDING_COPY.download` and the new eyebrow, the block in `heroHtml`, the `.download`, `.download-button` and `.download-note` rules of `design.md` §1–3 in `SITE_STYLE`, the status line in `discovery-copy.ts`; steps 3 and 4 green.
- [ ] **Step 6 (red, then green):** after step 9, `tools/repository-shape/src/docs-pages.test.ts` pins that `install-on-mac.mdx` holds the exact line of `apps/macos/release/allowed-signers`, the `ssh-keygen -Y verify -f <file> -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` command, `shasum -a 256 -c`, a link to `https://todz.app/download`, and no "until `mac-distribution` ships" sentence; then the page: download, Open Anyway, the three verification steps (sum, signature, `codesign -dv` shows `TeamIdentifier=XFWR794VS8` and `flags=0x10000(runtime)`), what `spctl` answers and why, and that updates arrive through Sparkle. Building from source stays.
- [ ] **Step 7:** `apps/api/README.md` names the downloads among the `todz.app` host's purposes.

### G2 — the app

- [ ] **Step 8 (red, then the settings):** `tools/repository-shape/src/macos-release.test.ts` reads `project.yml` and fails until: both targets set `ENABLE_HARDENED_RUNTIME: YES`; Release sets `CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO`; the package `Sparkle` comes from `https://github.com/sparkle-project/Sparkle` with `exactVersion: 2.10.1` and is a dependency of `Todz` only; the app's Info.plist has `SUFeedURL: $(TODZ_UPDATE_FEED_URL)` with `TODZ_UPDATE_FEED_URL` `https://todz.app/download/appcast.xml` in Release and empty in Debug, `SUEnableInstallerLauncherService: YES`, `SUEnableAutomaticChecks: YES`, `SUScheduledCheckInterval: 86400` and `SUPublicEDKey` matching `^[A-Za-z0-9+/]{43}=$`; the app's entitlements list `$(PRODUCT_BUNDLE_IDENTIFIER)-spks` and `$(PRODUCT_BUNDLE_IDENTIFIER)-spki` under `com.apple.security.temporary-exception.mach-lookup.global-name`; the widget's entitlements do not. Commit the red test alone. Then every setting except `SUPublicEDKey`; `xcodegen generate` and `xcodebuild -resolvePackageDependencies -clonedSourcePackagesDirPath ~/.todz-release/packages`; tell the lead the path of `generate_keys`.
- [ ] **Step 10 (green):** after step 9, `SUPublicEDKey` from the lead; the shape test green.
- [ ] **Step 11 (red):** `UpdateFeedTests`: `UpdateFeed(info:)` with `SUFeedURL` `https://todz.app/download/appcast.xml` → that URL; the key absent, empty or `http://…` → `nil`. Stub throws `UpdateFeed is not implemented`. Commit alone.
- [ ] **Step 12 (green):** `UpdateFeed` in TodzKit; `Todz/Updates/AppUpdater.swift` starts Sparkle's standard updater only when `UpdateFeed` has a URL; `AppCommands` adds "Check for Updates…" after `.appInfo` when the updater exists; `UpdateCopy.swift`; `apps/macos/README.md` names updates.
- [ ] **Step 13:** a local Release build (`xcodebuild -configuration Release`): `codesign --verify --deep --strict` passes on the app, `Sparkle.framework` and its XPC services; `codesign -dv` shows `flags=0x10000(runtime)` and `TeamIdentifier=XFWR794VS8`; `codesign -d --entitlements -` has no `get-task-allow`. Outputs into the tester briefing.

### Lead

- [ ] **Step 9:** `docs/runbooks/release-the-mac-app.md` steps 2 and 3: the Sparkle key with `generate_keys`, the release key into `todz-release-key`; write `apps/macos/release/allowed-signers`; hand `SUPublicEDKey` to G2 and the allowed-signers line to G1. Commit `chore(mac-distribution): the release's public keys`.

### G3 — the release command

- [ ] **Step 14 (red):** `scripts/release-mac.test.sh` in the shape of `scripts/todz-cloudflare.test.sh`, with every tool replaced through `TODZ_RELEASE_*_BINARY` overrides by fakes that log their arguments, and a fake Keychain value `FAKE-PRIVATE-KEY-VALUE`. Each case states its exit code and its message: a dirty tree; a branch other than `main`; `HEAD` ahead of and behind `origin/main`; a `mac-v<version>` tag on another commit; `--version` not greater than the highest tag; a build number not greater than `latest.json`'s; `codesign` output without `runtime`, with `get-task-allow`, or with another Team ID → refused before `hdiutil`; `todz-release-key` missing → refused naming the item; a published object whose sum differs → refused before any pointer; every object published with the same sums → exit 0, "already published", no `put`; one object missing → only it is put, then `appcast.xml`, then `latest.json`, then `git push origin mac-v<version>`, in that order; `--dry-run` → no `put`, no push, prints the local DMG path and the sum; `notarytool` and `stapler` never called; the agent is killed when signing fails; `--create-release-key` with the item present → refused, and without it → the fake `security` receives the key on standard input (never in its arguments), no key file remains under `~/.todz-release`, and the allowed-signers line `release@todz.app namespaces="todz-release" ssh-ed25519 …` is printed; `FAKE-PRIVATE-KEY-VALUE` appears in no output, log or argument. The script is a stub that exits 1 with `release-mac is not implemented`. Commit alone.
- [ ] **Step 15 (green):** `scripts/release-mac.sh`: constants at the top (Team ID, identity, bucket, `~/.todz-release`, the namespace and principal, the site origin, `notarization_enabled=false`), flat functions, `set -euo pipefail`, a `trap` that kills the agent, uploads through `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler r2 object put … --remote` with explicit content types, existence through `… r2 object get … --remote --pipe`. The appcast is rendered from `sign_update`'s output with one item: `sparkle:version` (build), `sparkle:shortVersionString`, `sparkle:minimumSystemVersion` `14.0`, the enclosure URL, length and `sparkle:edSignature`.
- [ ] **Step 16:** `package.json`: `release:mac` and `release-mac.test.sh` in `test:verify`; `scripts/verify-gates.tsv` maps `scripts/release-mac*` to the unit gate; `scripts/README.md` and the `scripts` line of `AGENTS.md` name the release.
- [ ] **Step 17 (red, then green):** `runbooks.test.ts`'s exception sentence adds "and the loop's steps of `release-the-mac-app`" (red), then `docs/runbooks/README.md` (green); the runbook's steps call `pnpm release:mac` where they call the script directly today.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | Production deploy without the bucket | `wrangler deploy` fails: R2 bucket `todz-releases` not found | Create the bucket (runbook step 4) first; or drop the `r2_buckets` entry and redeploy |
| 2 | The guard lets a path read any key | a step 1 case with a read count above zero | revert step 2 |
| 5 | The hero collides with `waitlist-inline` | conflict markers, or `site-pages.test.ts` red after the merge from `main` | merge `main` before step 3, as sequenced |
| 5 | `main` deployed before the first release | the button answers `404` on `todz.app` | publish the release (runbook step 7); the route needs no deploy for it |
| 8 | Sparkle cannot be fetched by the macOS gate | `xcodebuild` "Could not resolve package dependencies" | retry with network; the pin stays |
| 8 | The hardened runtime breaks the app or the sign-in web view | the Release app crashes at launch or the check page stays blank | `ENABLE_HARDENED_RUNTIME: NO`, an ADR 0072 amendment |
| 12 | The sandboxed installer cannot start | Sparkle: "An error occurred while launching the installer" | check the mach-lookup names against the bundle identifier; ship without Sparkle and re-release |
| 15 | A release stops halfway | the script exits non-zero after some `put`s | re-run: published objects are skipped, missing ones put, pointers last |
| 15 | An appcast signed with the wrong key | the runbook's update check: Sparkle "The update is improperly signed" | replace `appcast.xml` with the previous one (pointers may be replaced) |
| Z | Gatekeeper kills the app on another Mac | the owner's check: "Todz is damaged" or killed at launch, or the App Group prompt | ADR 0072 decision 1's fallback through a superseding ADR; nothing published yet |

**Steps with no backout:** the first `pnpm release:mac` that uploads (runbook step 7: a downloaded DMG cannot be recalled; `latest.json` can be pointed back), and shipping `SUPublicEDKey` in a release (step 10: changing it later needs every installed copy downloaded again).

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** verdict `CLEAR`; its lens includes the path guard, the keys' paths through the script, and the update channel.
- [ ] **/check-ui:** screenshots and video of the landing hero recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
- [ ] **Owner blockers cleared:** the `todz-cloudflare` token has R2 edit; the owner opened a dry-run DMG on his other notebook (runbook step 6).
- [ ] **First release:** after the merge, runbook steps 4 to 10: the bucket, the release, the deploy, the live checks, the run row.
