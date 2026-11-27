# Release the Mac app

Publish a release of the Mac app at `https://todz.app/download`: a development-signed DMG built from a tagged commit on `main`, its SHA-256 sum, its SSH signature and the signed Sparkle appcast, served as the Worker's own static assets ([ADR 0072](../adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md)). Steps 2, 3 and 8 run once (8 with the first public release), step 11 only when the release folder is lost; the others run for every release. The owner asks for a deploy after a batch that merged a change under `apps/macos`; then the `deploy` skill runs the per-release steps, and every release adds a row to the releases table at the end.

Every command runs from the repository root, one command per call. Cloudflare calls go through `scripts/todz-cloudflare.sh`, which gives the deploy token to that one command; no R2 permission is used. The two private keys live only in the login Keychain: Sparkle's EdDSA key, which Sparkle's own tools read, and the release key, the item `todz-release-key`. No step prints, exports or copies either one; the secrets guard hook refuses an agent command that reads them outside the release command. The scripts' test overrides work only when a test sets `TODZ_RELEASE_TEST_MODE=1`: never export it in a shell, a profile or a command of this runbook. The DMGs never enter git. `~/.todz-release/` (mode `700`) holds `builds/<version>/` (every build, dry runs included) and `site/` (only released versions, and `site/released`, the list a deploy serves from), so deploys run only from the Mac that holds it. `<version>` is the version step 4 or 6 prints. Agents run the per-release steps through the `deploy` skill, which stops at the first failure.

1. **Start from a clean `main`.** Check the tree, the branch and that nothing differs from `origin/main`, then run the gate:

   ```bash
   git status --porcelain
   git rev-parse --abbrev-ref HEAD
   git fetch origin
   git rev-list --count origin/main..HEAD
   git rev-list --count HEAD..origin/main
   pnpm verify
   ```

   Expected: the first prints nothing, the second `main`, the fourth and fifth `0`, and the gate passes. The release script checks the same and refuses otherwise.
   If it fails: a dirty tree, another branch or a commit ahead or behind is not the reviewed build; stop, and never release from it. A red gate goes back to Build.

2. **Create Sparkle's key and approve its tool, once.** Resolve the packages into the release folder, let Sparkle make its key in the login Keychain, then sign a throwaway file once so macOS asks now and not during an unattended run:

   ```bash
   xcodegen generate --spec apps/macos/project.yml
   xcodebuild -project apps/macos/Todz.xcodeproj -resolvePackageDependencies -clonedSourcePackagesDirPath ~/.todz-release/packages
   ~/.todz-release/packages/artifacts/sparkle/Sparkle/bin/generate_keys
   ~/.todz-release/packages/artifacts/sparkle/Sparkle/bin/sign_update apps/macos/project.yml
   ```

   Expected: `generate_keys` says it saved a new private key to the Keychain and prints the public key as a `SUPublicEDKey` value of 44 characters; that value goes into `apps/macos/project.yml`. When macOS asks whether `sign_update` may use the key, the owner chooses Allow, never Always Allow; `sign_update` then prints an `sparkle:edSignature` for the file, which is thrown away. The owner approves the two `sign_update` prompts of each release the same way, and the release command's 120-second limit covers them.

   **Owner step, once, now, before the first release:** in Keychain Access, open Sparkle's key item (the generic password whose account is `todz`), go to Access Control, and remove `sign_update` and `generate_keys` from its list of applications. Nothing trusted by default may then read the key without asking; every release asks the owner for each `sign_update` read.
   If it fails: a message that a key already exists means this step ran before; `generate_keys -p` prints the existing public key, which must equal the one in `project.yml`. A missing `generate_keys` means the packages did not resolve; check the network and the Sparkle pin.

3. **Create the release key, once.** The script makes an Ed25519 key inside `~/.todz-release`, stores it in the Keychain item `todz-release-key` through standard input, deletes the file, and prints the allowed-signers line and its fingerprint:

   ```bash
   pnpm release:mac --create-release-key
   ```

   Expected: one line starting `release@todz.app namespaces="todz-release" ssh-ed25519 `, which goes into `apps/macos/release/allowed-signers` and the "Install on Mac" docs page, and a `SHA256:` fingerprint, which goes on that page too; `security find-generic-password -s todz-release-key` finds the item (without `-w`, so nothing secret prints). The item is made with an empty list of trusted applications (`-T ""`), so `/usr/bin/security` is not trusted and every later release asks the owner to allow the read: choose Allow, never Always Allow. The owner then adds the public key as an SSH signing key on his GitHub account, so the fingerprint is published outside the `todz.app` zone, and exports both private keys by hand to his password manager: the loop never runs an export.
   If it fails: "already exists" means the key was made before; the allowed-signers line in the repository is its public half. A Keychain error means the login keychain is locked; unlock it and run again.

4. **Build a dry run and check it.** Everything but the deploy, the tag and the push:

   ```bash
   pnpm release:mac --dry-run
   ```

   Expected: it prints `~/.todz-release/builds/<version>/Todz-<version>.dmg` and its sum. Then, inside that folder: `shasum -a 256 -c Todz-<version>.dmg.sha256` prints `OK`; `ssh-keygen -Y verify -f <repository>/apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` prints `Good "todz-release" signature for release@todz.app`; on the mounted app `codesign -dv` shows `TeamIdentifier=XFWR794VS8` and `flags=0x10000(runtime)`, and `spctl -a -vv` answers `rejected` with `origin=Apple Development`. The mounted volume lists `Todz.app`, `Applications`, and the hidden `.background` and `.DS_Store` of [ADR 0083](../adr/0083-the-release-dmg-opens-on-a-committed-background-and-a-committed-ds-store-layout-copied-into-the-image-folder.md); inspect it with `ls -A` after `hdiutil attach -nobrowse`, never `open`. Nothing appears under `~/.todz-release/site/`, `git tag -l "mac-v*"` is unchanged, and `git status --porcelain` still prints nothing.
   If it fails: the script names its refusal (a dirty tree, a tag, a version, the deployment, the Sparkle pin, the signature checks, a missing key, a time limit); fix that cause, never the check. `spctl` answering `accepted` means a Developer ID identity signed it; stop and read ADR 0072 decision 10.

5. **Deploy the API first.** Follow [Deploy the API](deploy-the-api.md). Its deploy step is `scripts/deploy-worker.sh`, which stages the archived public folder and the released versions and deploys with `HEAD`'s sha as the message, so the downloads already published stay served, pending migrations are applied first, and the release command can confirm it is re-deploying reviewed code.

   Expected: that runbook's smoke check passes, and `/download/latest` answers as it did before (a `404` before the first release).
   If it fails: follow that runbook's own lines and do not release; the previous release stays live. "would remove the published download" means this Mac lacks the release folder; deploy from the Mac that holds it, or run step 11.

6. **Release.** The dry run's build, deployed:

   ```bash
   pnpm release:mac
   ```

   Expected: it reuses the dry run's build for this `HEAD`, records the active deployment's version id, copies the build into `site/download/<version>/`, deploys, checks `https://todz.app/download/latest`, the DMG's headers, its sum, its signature and the signed appcast, then adds `<version>` to `site/released`, creates and pushes the tag `mac-v<version>`, and prints `https://todz.app/download/<version>/Todz-<version>.dmg` and the sum. A second run prints "already published" and deploys nothing.
   If it fails: a failed production check has already rolled the Worker back to the recorded version id and removed the version from `site/`, so the previous release is live and no later deploy republishes the failed one; read the named check. "differs from the published file" means production already serves that version with other bytes; release the next version instead. A file over 25 MiB stops the staging: that is ADR 0072's R2 fallback, by a superseding ADR. A time limit naming `sign_update` means step 2's approval is missing; one naming `security` means the owner did not answer the Keychain prompt for `todz-release-key` within 120 seconds, the limit of every Keychain prompt; a served signature that does not answer 200 or does not verify is fetched again a few times before the release is rolled back; a refusal that the active deployment is a release-mac rollback means a retry needs `scripts/deploy-worker.sh` first.

7. **Check the live download.** From any folder outside the repository:

   ```bash
   curl -sS -D - -o /dev/null https://todz.app/download
   curl -sS -D - -o /dev/null https://todz.app/download/latest
   curl -sSI https://todz.app/download/<version>/Todz-<version>.dmg
   curl -sS https://todz.app/download/appcast.xml
   ```

   Expected: the first two answer `HTTP/2 302` with `location: /download/<version>/Todz-<version>.dmg`; the third `HTTP/2 200` with `content-disposition: attachment; filename="Todz-<version>.dmg"` and `cache-control: public, max-age=31536000, immutable`; the appcast names `<version>` and carries both `sparkle:edSignature` and its feed signature. A DMG downloaded from the third URL, with its `.sha256` and `.sig` beside it, passes the two checks of step 4.
   If it fails: a `404` on `/download` means the deploy carried no release; re-run step 6. A missing header means `_headers` did not apply; compare with the deploy script's test, and tell the owner before any rollback, which only the release command does to a recorded version id.

8. **Verify and check the public download on this Mac, once, with the first release.** After step 7 passes, quit the owner's own Todz: this copy and the owner's share the defaults domain, the App Group and the widgets. Then download the DMG from `todz.app` the way a visitor does, and verify it before anything opens it. From the repository root, with `<version>` from step 6:

   ```bash
   mkdir -p ~/.todz-release/check/Applications
   curl -fsS -o ~/.todz-release/check/Todz-<version>.dmg https://todz.app/download/<version>/Todz-<version>.dmg
   curl -fsS -o ~/.todz-release/check/Todz-<version>.dmg.sha256 https://todz.app/download/<version>/Todz-<version>.dmg.sha256
   curl -fsS -o ~/.todz-release/check/Todz-<version>.dmg.sig https://todz.app/download/<version>/Todz-<version>.dmg.sig
   (cd ~/.todz-release/check && shasum -a 256 -c Todz-<version>.dmg.sha256)
   ssh-keygen -Y verify -f apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s ~/.todz-release/check/Todz-<version>.dmg.sig < ~/.todz-release/check/Todz-<version>.dmg
   ```

   Expected: `shasum` prints `Todz-<version>.dmg: OK` and `ssh-keygen` prints `Good "todz-release" signature for release@todz.app`. Only then quarantine the file and open it, so macOS treats it as downloaded:

   ```bash
   xattr -w com.apple.quarantine "0081;6A000000;Safari;3C8D5F2A-0000-4000-8000-000000000001" ~/.todz-release/check/Todz-<version>.dmg
   xattr -p com.apple.quarantine ~/.todz-release/check/Todz-<version>.dmg
   open ~/.todz-release/check/Todz-<version>.dmg
   ```

   The disk image mounts as `/Volumes/Todz`. Before the first launch, check the app on the mounted volume: `codesign -dv --verbose=4 /Volumes/Todz/Todz.app`. Then copy it, `cp -R /Volumes/Todz/Todz.app ~/.todz-release/check/Applications/`, and eject the volume. Open the copy once and let macOS refuse it, then open System Settings › Privacy & Security, choose Open Anyway (it shows for a limited time after the refusal), enter an administrator password, and open the copy again. Finally run `codesign -dv ~/.todz-release/check/Applications/Todz.app`.

   Expected: `codesign -dv` on both the mounted app and the copy shows `TeamIdentifier=XFWR794VS8` and `flags=0x10000(runtime)`; the first open of the copy is refused and Open Anyway is offered; the second open shows todz. Quit the copy and leave it for step 9.
   If it fails: a sum or signature that does not verify means production serves other bytes than the signed release: do not open the file, stop, and tell the owner. A refusal without Open Anyway, "damaged", or a copy killed at launch means the release is live and wrong: stop, tell the owner, and publish a fixed `<version>` plus one (the release command never rolls back a published version and no appcast is edited by hand). If the owner decides the build must instead be signed ad hoc, that needs a superseding ADR, as ADR 0072 decision 1's fallback says. This check replaces the owner's other-notebook check (ADR 0075 decision 5); that check becomes a later one.

9. **Check the update, from the second release on.** The step 8 copy is at the previous version and the owner's own Todz is still quit (step 8). Sparkle checks once a day, so clear its last check time first, then open the copy:

   ```bash
   defaults delete dev.todz.Todz SULastCheckTime
   ```

   With "Update todz automatically" on (the default), wait for the background download, then quit the copy. Expected: Sparkle installs `<version>` on quit, with no window over another app; reopen the copy and the popover foot shows "Updated to <version>" once, and a tap clears it. A first launch of a fresh copy shows no note.
   Check separately: on the copy at the previous version, choose Todz › Check for Updates…. Expected: Sparkle offers `<version>` in its own window, which is the one window this check is meant to show.
   Then remove the copy's application only, with `rm -rf ~/.todz-release/check/Applications`. Keep `~/.todz-release/check`: the third release's check uses it.
   If it fails: "improperly signed" or a refused feed means the appcast's signatures do not match `SUPublicEDKey`; stop releasing, tell the owner and investigate the key. No offer means the build number is not greater than the installed one. A switch that stays off after a relaunch means the owner changed that setting; the default is on only for a Mac that never touched it.
   If it fails: "improperly signed" or a refused feed means the appcast's signatures do not match `SUPublicEDKey`; stop releasing, tell the owner and investigate the key. No offer means the build number is not greater than the installed one. A switch that stays off after a relaunch means the owner's setting was changed; the default is on only for a Mac that never touched it.

10. **Record the release.** Add a row to the table below: the date, the version, the build number, the short commit and the sum.

    Expected: one new row, in date order.
    If it fails: a release without a row is not done; add it.

11. **Rebuild the release folder from production, only when it is lost.** For each version production serves (the newest from `/download/latest`, the one before from the releases table), download the three files into `~/.todz-release/site/download/<v>/` and the appcast into the newest one's folder, check them, then write `site/released` with the versions, oldest first:

    ```bash
    curl -fsS -o ~/.todz-release/site/download/<v>/Todz-<v>.dmg https://todz.app/download/<v>/Todz-<v>.dmg
    curl -fsS -o ~/.todz-release/site/download/<v>/Todz-<v>.dmg.sha256 https://todz.app/download/<v>/Todz-<v>.dmg.sha256
    curl -fsS -o ~/.todz-release/site/download/<v>/Todz-<v>.dmg.sig https://todz.app/download/<v>/Todz-<v>.dmg.sig
    curl -fsS -o ~/.todz-release/site/download/<newest>/appcast.xml https://todz.app/download/appcast.xml
    ```

    Expected: inside each version folder `shasum -a 256 -c Todz-<v>.dmg.sha256` prints `OK` and `ssh-keygen -Y verify` against the repository's allowed-signers prints `Good "todz-release" signature`; each sum equals the releases table's row; then `scripts/deploy-worker.sh --stage-only <an empty folder>` stages both versions without refusing.
    If it fails: a sum or signature that does not verify, or that differs from the table, means production does not serve what was released; stop and tell the owner, and never write `released` from it.

## Releases

| Date | Version | Build | Commit | SHA-256 |
|------|---------|-------|--------|---------|
| 2026-11-26 | 0.2.0 | 2063 | c4d3eb9 | `89544e285796233d7642a1682d91044368ca24c413196edf1efd73d86c9cca44` |
| 2026-11-26 | 0.2.1 | 2069 | 3ecdab2 | `66b6c61c8af95dda257e9dc1c7de31ab339f10119259b24751fea1c8dcc68b25` |
| 2026-11-26 | 0.2.2 | 2165 | f7d4810 | `012156e22501b7784ae3ef949981a8bd9e16b3d92a7b0f29092016be64f3b5fb` |
| 2026-11-26 | 0.2.3 | 2300 | aef5360a | `87c94a426c460e2a5a6ce464e73a4a6c74f51527dfe1c3900c9b09a17173c244` |
| 2026-11-26 | 0.2.4 | 2395 | 00ed0f42 | `9bd3e628b55c411cda32e6cfe7613f1cfa3984bb74363883db5cbc7fa71e6571` |
| 2026-11-26 | 0.2.5 | 2414 | 86b2a653 | `485ae2ee34a0a27dd2c00a4188e834592d45e05041c2348d30856cc083e1353f` |
| 2026-11-26 | 0.2.6 | 2450 | 91c1662f | `b9547d79d6cb42d9f9528d256db70dff1646221b5289781b8521e1f86277bf11` |
| 2026-11-27 | 0.2.7 | 2481 | 505e24e2 | `15a2c8fb785873e24aa6c3c4bdbe0caa30836e5cb26ccb4f9c6991ee3d179dd4` |

The first attempt at 0.2.3 failed with "the served signature does not verify" and the release command rolled the Worker back; the retry passed and tagged `mac-v0.2.3`. The first attempts at 0.2.4, 0.2.6 and 0.2.7 stopped at an unanswered `generate_keys` Keychain prompt (60 s, then 120 s after #107) before any upload; each retry passed. One 0.2.7 attempt also stopped at "the active deployment does not carry HEAD's sha" after a docs-only merge, until `scripts/deploy-worker.sh` deployed HEAD.
