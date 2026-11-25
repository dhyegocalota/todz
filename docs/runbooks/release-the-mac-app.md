# Release the Mac app

Publish a release of the Mac app at `https://todz.app/download`: a development-signed DMG built from a tagged commit on `main`, its SHA-256 sum, its SSH signature and the Sparkle appcast, in the R2 bucket `todz-releases` ([ADR 0072](../adr/0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md)). Steps 2, 3, 4 and 6 run once; the others run for every release. Once `mac-distribution` ships, the build loop runs it after any batch that merged a change under `apps/macos`, and every run adds a row to the releases table at the end.

Every command runs from the repository root, one command per call. Cloudflare calls go through `scripts/todz-cloudflare.sh`, which gives the token to that one command. The two private keys live only in the login Keychain: Sparkle's EdDSA key, which Sparkle's own tools read, and the release key, the item `todz-release-key`. No step prints, exports or copies either one to a file in the repository. The run's files live in `~/.todz-release/`, outside the repository, in folders only the owner can open. `<version>` is the version step 5 or 7 prints.

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
   pnpm release:mac --create-release-key
   ```

   Expected: one line starting `release@todz.app namespaces="todz-release" ssh-ed25519 `, which goes into `apps/macos/release/allowed-signers` and the "Install on Mac" docs page; `security find-generic-password -s todz-release-key` finds the item (without `-w`, so nothing secret prints). The owner then exports both keys by hand to his password manager: the loop never runs an export.
   If it fails: "already exists" means the key was made before; the allowed-signers line in the repository is its public half. A Keychain error means the login keychain is locked; unlock it and run again.

4. **Create the bucket, once.** Make `todz-releases` and check it is listed:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler r2 bucket create todz-releases
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler r2 bucket list
   ```

   Expected: Wrangler says it created the bucket, and the list has `todz-releases`. The bucket has no public access and no custom domain: only the Worker reads it.
   If it fails: `Authentication error [code: 10000]` means the `todz-cloudflare` token lacks the R2 permission ("Workers R2 Storage: Edit"); tell the owner, who adds it, and stop. A message that R2 is not enabled means the owner enables R2 on the account in the dashboard.

5. **Build a dry run and check it.** Everything but the upload and the tag push:

   ```bash
   pnpm release:mac --dry-run
   ```

   Expected: it prints `~/.todz-release/<version>/Todz-<version>.dmg` and its sum. Then, inside `~/.todz-release/<version>/`: `shasum -a 256 -c Todz-<version>.dmg.sha256` prints `OK`; `ssh-keygen -Y verify -f <repository>/apps/macos/release/allowed-signers -I release@todz.app -n todz-release -s Todz-<version>.dmg.sig < Todz-<version>.dmg` prints `Good "todz-release" signature for release@todz.app`; on the mounted app `codesign -dv` shows `TeamIdentifier=XFWR794VS8` and `flags=0x10000(runtime)`, and `spctl -a -vv` answers `rejected` with `origin=Apple Development`.
   If it fails: the script names its refusal (a dirty tree, a tag, a version, the signature checks, a missing key); fix that cause, never the check. `spctl` answering `accepted` means a Developer ID identity signed it; stop and read ADR 0072 decision 10.

6. **Open it on another Mac, once per change of signing.** The owner sends the dry-run DMG to his other notebook by AirDrop, which marks it as downloaded, opens it, drags Todz to Applications, opens it, and when macOS refuses, opens System Settings › Privacy & Security › Open Anyway. Then he signs in and adds a widget.

   Expected: the app opens after Open Anyway; no "would like to access data from other apps" prompt appears; the widget shows Today. The result, with the macOS version of that Mac, goes into ADR 0072's Evidence.
   If it fails: the app killed at launch, "damaged", or the App Group prompt means decision 1 of ADR 0072 does not hold; stop, publish nothing, and write the superseding ADR for the ad hoc fallback.

7. **Release.** The same build, uploaded:

   ```bash
   pnpm release:mac
   ```

   Expected: it uploads the DMG, the sum and the signature under `<version>/`, then `appcast.xml`, then `latest.json`, pushes the tag `mac-v<version>`, and prints `https://todz.app/download/<version>/Todz-<version>.dmg` and the sum. A second run of the same version prints "already published" and uploads nothing.
   If it fails: a stop after some uploads is safe to re-run; the script skips what is published and puts the pointers last. "differs from the published file" means a versioned object already exists with other bytes; never delete it to make room, release the next version instead.

8. **Deploy the Worker when it changed.** The first release, or any release after a merge under `apps/api`, follows [Deploy the API](deploy-the-api.md) so the `/download` routes and the landing's button are live.

   Expected: that runbook's smoke check passes.
   If it fails: follow that runbook's own lines; the release itself stays published in the bucket.

9. **Check the live download.** From any folder outside the repository:

   ```bash
   curl -sS -D - -o /dev/null https://todz.app/download
   curl -sS -D - -o /dev/null https://todz.app/download/latest
   curl -sSI https://todz.app/download/<version>/Todz-<version>.dmg
   curl -sS https://todz.app/download/appcast.xml
   ```

   Expected: the first two answer `HTTP/2 302` with `location: /download/<version>/Todz-<version>.dmg`; the third `HTTP/2 200` with `content-type: application/x-apple-diskimage`, `content-disposition: attachment; filename="Todz-<version>.dmg"` and `cache-control: public, max-age=31536000, immutable`; the appcast names `<version>` and carries `sparkle:edSignature`. A DMG downloaded from the third URL passes the two checks of step 5.
   If it fails: a `404` on `/download` means `latest.json` is missing; re-run step 7. A `404` on every path means the Worker is older than the routes; run step 8.

10. **Check the update, from the second release on.** On a Mac with the previous version installed, choose Todz › Check for Updates….

    Expected: Sparkle offers `<version>`, installs it after the owner confirms, relaunches, and About Todz shows `<version>`.
    If it fails: "improperly signed" means the appcast's signature does not match `SUPublicEDKey`; put back the previous `appcast.xml` and `latest.json` and investigate the key. No offer means the build number is not greater than the installed one.

11. **Record the release.** Add a row to the table below: the date, the version, the build number, the short commit and the sum.

    Expected: one new row, in date order.
    If it fails: a release without a row is not done; add it.

## Releases

| Date | Version | Build | Commit | SHA-256 |
|------|---------|-------|--------|---------|
