# Release the Mac app

Publish a release of the Mac app at `https://todz.app/download`: a development-signed DMG built from a tagged commit on `main`, its SHA-256 sum, its SSH signature and the Sparkle appcast, served as the Worker's own static assets ([ADR 0072](../adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md)). Steps 2, 3 and 5 run once; the others run for every release. Once `mac-distribution` ships, the build loop runs it after any batch that merged a change under `apps/macos`, and every run adds a row to the releases table at the end.

Every command runs from the repository root, one command per call. Cloudflare calls go through `scripts/todz-cloudflare.sh`, which gives the deploy token to that one command; no R2 permission is used. The two private keys live only in the login Keychain: Sparkle's EdDSA key, which Sparkle's own tools read, and the release key, the item `todz-release-key`. No step prints, exports or copies either one to a file in the repository. The DMGs never enter git: they live in the release folder `~/.todz-release/site/`, outside the repository, in folders only the owner can open, and every deploy stages the latest two versions from it, so deploys run only from the Mac that holds it. `<version>` is the version step 4 or 7 prints. Agents run the per-release steps through the `deploy` skill, which stops at the first failure.

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

2. **Create Sparkle's key, once.** Resolve the packages into the release folder, then let Sparkle make its key in the login Keychain:

   ```bash
   xcodegen generate --spec apps/macos/project.yml
   xcodebuild -project apps/macos/Todz.xcodeproj -resolvePackageDependencies -clonedSourcePackagesDirPath ~/.todz-release/packages
   ~/.todz-release/packages/artifacts/sparkle/Sparkle/bin/generate_keys
   ```

   Expected: `generate_keys` says it saved a new private key to the Keychain and prints the public key as a `SUPublicEDKey` value of 44 characters; that value goes into `apps/macos/project.yml`. macOS may ask once to allow `generate_keys` to use the Keychain; allow it.
   If it fails: a message that a key already exists means this step ran before; `generate_keys -p` prints the existing public key, which must equal the one in `project.yml`. A missing `generate_keys` means the packages did not resolve; check the network and the Sparkle pin.

3. **Create the release key, once.** The script makes an Ed25519 key, stores it in the Keychain item `todz-release-key` through standard input, deletes its only file and prints the allowed-signers line:

   ```bash
   scripts/release-mac.sh --create-release-key
   ```

   Expected: one line starting `release@todz.app namespaces="todz-release" ssh-ed25519 `, which goes into `apps/macos/release/allowed-signers` and the "Install on Mac" docs page; `security find-generic-password -s todz-release-key` finds the item (without `-w`, so nothing secret prints). The owner then exports both keys by hand to his password manager: the loop never runs an export.
   If it fails: "already exists" means the key was made before; the allowed-signers line in the repository is its public half. A Keychain error means the login keychain is locked; unlock it and run again.

4. **Build a dry run and check it.** Everything but the deploy and the tag push:

   ```bash
   scripts/release-mac.sh --dry-run
   ```

   Expected: it prints `~/.todz-release/site/download/<version>/Todz-<version>.dmg` and its sum. Then, inside that folder: `shasum -a 256 -c Todz-<version>.dmg.sha256` prints `OK`; `ssh-keygen -Y verify -f <repository>/apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` prints `Good "todz-release" signature for release@todz.app`; on the mounted app `codesign -dv` shows `TeamIdentifier=XFWR794VS8` and `flags=0x10000(runtime)`, and `spctl -a -vv` answers `rejected` with `origin=Apple Development`. `git status --porcelain` still prints nothing.
   If it fails: the script names its refusal (a dirty tree, a tag, a version, pending migrations, the signature checks, a missing key); fix that cause, never the check. `spctl` answering `accepted` means a Developer ID identity signed it; stop and read ADR 0072 decision 10.

5. **Open it on another Mac, once per change of signing.** The owner sends the dry-run DMG to his other notebook by AirDrop, which marks it as downloaded, opens it, drags Todz to Applications, opens it, and when macOS refuses, opens System Settings › Privacy & Security › Open Anyway. Then he signs in and adds a widget.

   Expected: the app opens after Open Anyway; no "would like to access data from other apps" prompt appears; the widget shows Today. The result, with the macOS version of that Mac, goes into ADR 0072's Evidence.
   If it fails: the app killed at launch, "damaged", or the App Group prompt means decision 1 of ADR 0072 does not hold; stop, publish nothing, and write the superseding ADR for the ad hoc fallback.

6. **Deploy the API first.** Follow [Deploy the API](deploy-the-api.md). Its deploy step stages `apps/api/public` and the release folder's current versions, so the downloads already published stay served and any pending migration is applied before the release deploys.

   Expected: that runbook's smoke check passes, and `/download/latest` answers as it did before (a `404` before the first release).
   If it fails: follow that runbook's own lines and do not release; the previous release stays live. "would remove the published download" means this Mac lacks the release folder; deploy from the Mac that holds it.

7. **Release.** The same build, deployed:

   ```bash
   scripts/release-mac.sh
   ```

   Expected: it reuses the dry run's files, stages them with the previous version, deploys, checks `https://todz.app/download/latest`, the DMG, its sum, its signature and the appcast, pushes the tag `mac-v<version>`, and prints `https://todz.app/download/<version>/Todz-<version>.dmg` and the sum. A second run of the same version prints "already published" and deploys nothing.
   If it fails: a failed production check has already rolled the Worker back to the deployment before, so the previous release is live; read the named check. "differs from the published file" means production already serves that version with other bytes; release the next version instead. A file over 25 MiB stops the staging: that is ADR 0072's R2 fallback, by a superseding ADR.

8. **Check the live download.** From any folder outside the repository:

   ```bash
   curl -sS -D - -o /dev/null https://todz.app/download
   curl -sS -D - -o /dev/null https://todz.app/download/latest
   curl -sSI https://todz.app/download/<version>/Todz-<version>.dmg
   curl -sS https://todz.app/download/appcast.xml
   ```

   Expected: the first two answer `HTTP/2 302` with `location: /download/<version>/Todz-<version>.dmg`; the third `HTTP/2 200` with `content-disposition: attachment; filename="Todz-<version>.dmg"` and `cache-control: public, max-age=31536000, immutable`; the appcast names `<version>` and carries `sparkle:edSignature`. A DMG downloaded from the third URL, with its `.sha256` and `.sig` beside it, passes the two checks of step 4.
   If it fails: a `404` on `/download` means the deploy carried no release; re-run step 7. A missing header means `_headers` did not apply; compare with the staging test and roll back with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler rollback`.

9. **Check the update, from the second release on.** On a Mac with the previous version installed, choose Todz › Check for Updates….

   Expected: Sparkle offers `<version>`, installs it after the owner confirms, relaunches, and About Todz shows `<version>`.
   If it fails: "improperly signed" means the appcast's signature does not match `SUPublicEDKey`; roll the Worker back to the deployment before and investigate the key. No offer means the build number is not greater than the installed one.

10. **Record the release.** Add a row to the table below: the date, the version, the build number, the short commit and the sum.

    Expected: one new row, in date order.
    If it fails: a release without a row is not done; add it.

## Releases

| Date | Version | Build | Commit | SHA-256 |
|------|---------|-------|--------|---------|
