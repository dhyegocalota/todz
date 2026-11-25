# Release the Mac app

Publish a release of the Mac app at `https://todz.app/download`: a development-signed DMG built from a tagged commit on `main`, its SHA-256 sum, its SSH signature and the signed Sparkle appcast, served as the Worker's own static assets ([ADR 0072](../adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md)). Steps 2, 3 and 5 run once, step 11 only when the release folder is lost; the others run for every release. Once `mac-distribution` ships, the build loop runs it after any batch that merged a change under `apps/macos`, and every run adds a row to the releases table at the end.

Every command runs from the repository root, one command per call. Cloudflare calls go through `scripts/todz-cloudflare.sh`, which gives the deploy token to that one command; no R2 permission is used. The two private keys live only in the login Keychain: Sparkle's EdDSA key, which Sparkle's own tools read, and the release key, the item `todz-release-key`. No step prints, exports or copies either one; the secrets guard hook refuses an agent command that reads them outside the release command. The DMGs never enter git. `~/.todz-release/` (mode `700`) holds `builds/<version>/` (every build, dry runs included) and `site/` (only released versions, and `site/released`, the list a deploy serves from), so deploys run only from the Mac that holds it. `<version>` is the version step 4 or 7 prints. Agents run the per-release steps through the `deploy` skill, which stops at the first failure.

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

   Expected: `generate_keys` says it saved a new private key to the Keychain and prints the public key as a `SUPublicEDKey` value of 44 characters; that value goes into `apps/macos/project.yml`. When macOS asks whether `sign_update` may use the key, the owner chooses Always Allow; `sign_update` then prints an `sparkle:edSignature` for the file, which is thrown away.
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

   Expected: it prints `~/.todz-release/builds/<version>/Todz-<version>.dmg` and its sum. Then, inside that folder: `shasum -a 256 -c Todz-<version>.dmg.sha256` prints `OK`; `ssh-keygen -Y verify -f <repository>/apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` prints `Good "todz-release" signature for release@todz.app`; on the mounted app `codesign -dv` shows `TeamIdentifier=XFWR794VS8` and `flags=0x10000(runtime)`, and `spctl -a -vv` answers `rejected` with `origin=Apple Development`. Nothing appears under `~/.todz-release/site/`, `git tag -l "mac-v*"` is unchanged, and `git status --porcelain` still prints nothing.
   If it fails: the script names its refusal (a dirty tree, a tag, a version, the deployment, the Sparkle pin, the signature checks, a missing key, a time limit); fix that cause, never the check. `spctl` answering `accepted` means a Developer ID identity signed it; stop and read ADR 0072 decision 10.

5. **Open it on another Mac, once per change of signing.** The owner sends the dry-run DMG to his other notebook by AirDrop, which marks it as downloaded, opens it, drags Todz to Applications, opens it once and lets macOS refuse, then opens System Settings › Privacy & Security, chooses Open Anyway (it shows for a limited time after the refusal) and enters an administrator password. Then he signs in, adds a widget, and runs `codesign -dv /Applications/Todz.app`.

   Expected: the app opens after Open Anyway; no "would like to access data from other apps" prompt appears; the widget shows Today; `codesign -dv` shows his Apple ID address in the certificate's name, which he accepted on 2026-11-25. The result, with the macOS version of that Mac, goes into ADR 0072's Evidence.
   If it fails: the app killed at launch, "damaged", or the App Group prompt means decision 1 of ADR 0072 does not hold; stop, publish nothing, and write the superseding ADR for the ad hoc fallback.

6. **Deploy the API first.** Follow [Deploy the API](deploy-the-api.md). Its deploy step is `scripts/deploy-worker.sh`, which stages the archived public folder and the released versions and deploys with `HEAD`'s sha as the message, so the downloads already published stay served, pending migrations are applied first, and the release command can confirm it is re-deploying reviewed code.

   Expected: that runbook's smoke check passes, and `/download/latest` answers as it did before (a `404` before the first release).
   If it fails: follow that runbook's own lines and do not release; the previous release stays live. "would remove the published download" means this Mac lacks the release folder; deploy from the Mac that holds it, or run step 11.

7. **Release.** The dry run's build, deployed:

   ```bash
   pnpm release:mac
   ```

   Expected: it reuses the dry run's build for this `HEAD`, records the active deployment's version id, copies the build into `site/download/<version>/`, deploys, checks `https://todz.app/download/latest`, the DMG's headers, its sum, its signature and the signed appcast, then adds `<version>` to `site/released`, creates and pushes the tag `mac-v<version>`, and prints `https://todz.app/download/<version>/Todz-<version>.dmg` and the sum. A second run prints "already published" and deploys nothing.
   If it fails: a failed production check has already rolled the Worker back to the recorded version id and removed the version from `site/`, so the previous release is live and no later deploy republishes the failed one; read the named check. "differs from the published file" means production already serves that version with other bytes; release the next version instead. A file over 25 MiB stops the staging: that is ADR 0072's R2 fallback, by a superseding ADR. A time limit naming `sign_update` means step 2's approval is missing; one naming `security` means the owner did not answer the Keychain prompt for `todz-release-key` within a minute.

8. **Check the live download.** From any folder outside the repository:

   ```bash
   curl -sS -D - -o /dev/null https://todz.app/download
   curl -sS -D - -o /dev/null https://todz.app/download/latest
   curl -sSI https://todz.app/download/<version>/Todz-<version>.dmg
   curl -sS https://todz.app/download/appcast.xml
   ```

   Expected: the first two answer `HTTP/2 302` with `location: /download/<version>/Todz-<version>.dmg`; the third `HTTP/2 200` with `content-disposition: attachment; filename="Todz-<version>.dmg"` and `cache-control: public, max-age=31536000, immutable`; the appcast names `<version>` and carries both `sparkle:edSignature` and its feed signature. A DMG downloaded from the third URL, with its `.sha256` and `.sig` beside it, passes the two checks of step 4.
   If it fails: a `404` on `/download` means the deploy carried no release; re-run step 7. A missing header means `_headers` did not apply; compare with the deploy script's test, and tell the owner before any rollback, which only the release command does to a recorded version id.

9. **Check the update, from the second release on.** On a Mac with the previous version installed, choose Todz › Check for Updates….

   Expected: Sparkle offers `<version>`, installs it after the owner confirms, relaunches, and About Todz shows `<version>`. A scheduled check while another app is in front opens no window; the offer shows when todz comes forward.
   If it fails: "improperly signed" or a refused feed means the appcast's signatures do not match `SUPublicEDKey`; stop releasing, tell the owner and investigate the key. No offer means the build number is not greater than the installed one.

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
