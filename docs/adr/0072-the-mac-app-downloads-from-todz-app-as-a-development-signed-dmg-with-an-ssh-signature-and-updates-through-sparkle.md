# 0072. The Mac app downloads from todz.app as a development-signed DMG with an SSH signature, and updates through Sparkle

- Status: Accepted
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, under the owner's "vamos sem notarizar"); Dhyego Calota (owner) may overturn it
- Inspired by: `todz-loop/PROMPT.md` → `mac-distribution`, the `mac-distribution` spike of 2026-11-25 (below), [ADR 0035](0035-with-the-personal-team-the-widgets-share-the-app-group.md), [ADR 0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md), [ADR 0049](0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md)

## Context

The owner wants a public download now, without the Apple Developer Program, "de forma segura e verificada". Without Developer ID there is no notarization, so Gatekeeper rejects every build we can make; what remains is to make each build traceable to a tagged commit, verifiable by anyone, and updatable without a second Gatekeeper prompt.

The machine has one signing identity, an Apple Development certificate of team `XFWR794VS8` (the Personal Team of ADR 0035). `minisign`, `cosign` and `signify` are not installed, and the loop may not install tools. Homebrew's OpenSSL 3.6 is present on this Mac but not on a visitor's: macOS ships LibreSSL 3.3.6, which cannot verify an Ed25519 signature (`unknown option '-rawin'`). macOS ships OpenSSH 10.3, whose `ssh-keygen -Y` signs and verifies Ed25519 signatures over files. The `todz-cloudflare` token cannot use R2 (`wrangler r2 bucket list` → `Authentication error [code: 10000]`), and the owner's session declined an account-wide R2 permission. The token already deploys the Worker, and a Worker's static assets take files up to 25 MiB each; the measured DMG is 4.7 MB.

## Decision

1. **Signing.** The release is the Release configuration signed by Xcode with the team's Apple Development identity, with the hardened runtime on both targets and `CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO` in Release, so no `get-task-allow` ships. The app embeds no provisioning profile, and its entitlements (sandbox, network client, the team-prefixed App Group, Sparkle's two mach-lookup exceptions) need none, so nothing binds it to a registered device. The release script refuses a build whose signature lacks `TeamIdentifier=XFWR794VS8`, the `runtime` flag or a strict deep verification, or that still has `get-task-allow`.
   **Fallback, not built:** if the owner's check on a Mac outside this one (todz-6f, his other notebook) shows the app killed at launch or the "would like to access data from other apps" prompt for the App Group, a superseding ADR signs the release ad hoc and moves the widgets' shared files to ADR 0033's folder in Application Support for that build. No release is published until that check passes.
2. **Package.** A DMG made by `hdiutil` (UDZO, the app and an `Applications` link), itself signed with the same identity, named `Todz-<version>.dmg`.
3. **Sum and detached signature.** `Todz-<version>.dmg.sha256` in `shasum -a 256` format, and `Todz-<version>.dmg.sig`, an SSH signature (`ssh-keygen -Y sign`, Ed25519, namespace `todz-release`, principal `release@todz.app`). The public key is published as an allowed-signers line in `apps/macos/release/allowed-signers` and on the "Install on Mac" docs page, never only on `todz.app`, the host that serves the binary. A visitor verifies with `shasum -a 256 -c` and `ssh-keygen -Y verify`, both on every Mac.
4. **Keys.** The release key is the base64 of an OpenSSH Ed25519 private key in the login Keychain item `todz-release-key`. The script loads it into a throwaway `ssh-agent` on a socket inside `~/.todz-release/`, signs, and kills the agent; the key never touches a file. Sparkle's EdDSA key is the one Sparkle's `generate_keys` puts in the login Keychain, read only by `sign_update`. Neither is echoed, logged or passed on a command line.
5. **Hosting.** The release files are the Worker's own static assets, deployed with the code, so no permission beyond the deploy token's is needed (least privilege). The DMGs never enter git: they live in the release folder `~/.todz-release/site/` (mode `700`), which keeps every version built. At deploy time `scripts/stage-site-assets.sh` fills an empty directory with `apps/api/public` and the latest two versions under `download/<version>/` (`Todz-<version>.dmg`, `.sha256`, `.sig`), `download/appcast.xml` and `download/allowed-signers`, and writes `_redirects` (`/download` and `/download/latest` → `302` to the newest DMG) and `_headers` (the public folder's rules, then `Content-Disposition: attachment` on the DMGs, `Cache-Control: public, max-age=31536000, immutable` on every versioned file, five minutes on the appcast). `wrangler deploy --assets <that directory>` runs through `scripts/todz-cloudflare.sh`. A path that is not a staged file falls to the Worker and answers the site's `404`, so the version guard is the file set itself. Every deploy stages, and the staging refuses when production serves a version the release folder lacks, so a deploy never removes the published download. A file over 25 MiB stops the staging: the fallback is an R2 bucket behind the Worker, by a superseding ADR.
6. **Updates.** Sparkle `2.10.1`, pinned exactly in `project.yml`, in the app target, with the sandboxed installer service. The appcast holds the latest release, its enclosure signed with Sparkle's EdDSA key. Sparkle installs an update only when that signature verifies against `SUPublicEDKey`, so after the first install every update is trusted without notarization. Checks run daily and the owner confirms each install. Debug has no feed and starts no updater.
7. **Versions.** The tag `mac-v<version>` on a commit of `main` is the source of the version; the build number is that commit's `git rev-list --count`. Both are passed to `xcodebuild`; no release commits to `main`.
8. **Automation.** `pnpm release:mac` (`scripts/release-mac.sh`) does a release end to end, refuses anything but a clean `main` equal to `origin/main`, is idempotent per version, never overwrites a published file, has `--dry-run`, and is tested by `scripts/release-mac.test.sh`. It builds into the release folder once per version, deploys the staged assets, checks production (the `302` of `/download/latest`, the DMG, its sum, its signature, the appcast's version), rolls the Worker back to the deployment before when a check fails, and pushes the tag only after the checks pass. It refuses while D1 has migrations pending, so it never deploys code ahead of its schema. Agents deploy only through the repository skill `deploy`: `docs/runbooks/deploy-the-api.md`, then `pnpm release:mac` when `apps/macos` changed since the highest `mac-v*` tag, then the production checks (the download answers, the sum matches, the signature verifies, the appcast lists the version), stopping at the first failure. Each release is recorded in `docs/runbooks/release-the-mac-app.md`.
9. **Disclosure.** The landing's download button carries one line, "Not notarized by Apple yet: the first time, open it from System Settings › Privacy & Security.", linking the "Install on Mac" page, which also carries the verification steps.
10. **Notarization, switched off.** The script holds `notarize_and_staple` (`xcrun notarytool submit --keychain-profile todz-notary --wait`, `xcrun stapler staple`, then `spctl -a -vv` must answer `accepted`) behind a constant that is `false`. Turning it on is: buy the Developer Program, create a Developer ID Application certificate, switch the signing identity, store the notary profile, flip the constant, supersede decisions 1 and 9.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Apple Development signature, hardened runtime (chosen) | Team ID visible to `codesign -dv`; Sparkle can compare signatures; the App Group of ADR 0035 keeps working | Gatekeeper rejects it; the certificate's name, the owner's Apple ID address, is in every copy's signature | — |
| Ad hoc signature | No certificate at all | No Team ID to verify; the App Group prompts (ADR 0033), so the widgets need the Application Support folder | Kept as the fallback of decision 1 |
| minisign | Small, made for this | Not installed, and visitors would need to install it | The loop may not install tools; verification would need a tool the visitor lacks |
| Sigstore (`cosign`, keyless) | No long-lived key | Not installed; every signature, its artifact hash and the signer's identity go to the public Rekor log; visitors need `cosign` | Same as minisign, and leaks more |
| OpenSSL Ed25519 (`pkeyutl -rawin`) | Plain keys | macOS's LibreSSL 3.3.6 cannot verify it | Fails on a stock Mac |
| GPG detached signature | Familiar | Not on a stock Mac; key management heavier than SSH's | Visitors would need GnuPG |
| SSH signature (`ssh-keygen -Y`, chosen) | On every Mac; Ed25519; namespaced; the same format git uses | Keys need the agent detour to stay off disk | — |
| Worker static assets, staged at deploy (chosen) | No new permission or binding; served with the code; a rollback restores the previous files | 25 MiB per file; every deploy must stage the release folder; the files answer on every host the Worker serves, `api.todz.app` too | — |
| R2 bucket behind the Worker | No size limit that matters; deploys and releases independent | Needs an R2 permission the token lacks (`10000`) and the owner declined account-wide; a binding and a route to guard | The fallback when a DMG passes 25 MiB |
| GitHub Releases | Free hosting | The repository is private, so its release assets are too | Not public |
| GitHub Actions release on tag | Reproducible runner | The signing identity and both private keys as repository secrets; paid macOS minutes on a private repository | Off unless the owner asks |
| Bump the version in a commit | The version visible in `project.yml` | A release would commit on `main`, which the conventions forbid | The tag carries it |
| No updater | Nothing to add | Every fix needs a fresh download and a second Gatekeeper visit | The owner asked for Sparkle |

## Consequences

- **Gatekeeper.** `spctl -a -vv` answers `rejected` with `origin=Apple Development: …`. The first open goes through System Settings › Privacy & Security › Open Anyway; later Sparkle updates do not ask again.
- **Privacy.** The certificate's common name, `Apple Development: <the owner's Apple ID address> (<certificate id>)`, is visible to anyone who runs `codesign -dv` on a download. A Developer ID certificate names the team instead. This is an owner's line in the loop's Blockers.
- **Certificate expiry.** An Apple Development certificate lasts one year. A renewed certificate keeps the team and Sparkle keeps installing, because the EdDSA signature stays valid; a build signed after expiry fails the script's checks.
- **Moving to Developer ID.** Sparkle accepts a change of code signing identity when the EdDSA signature verifies, so installed copies update into the notarized build; the EdDSA key must never change.
- **One deploying Mac.** The release folder exists only on the Mac that built the releases; a deploy from anywhere else is refused by the staging until that folder is restored. Losing it means re-downloading the published files from production into it, which the files' sums make safe.
- **Every host.** Assets answer on `api.todz.app` and `www.todz.app` as on `todz.app`; the landing and the appcast name only `todz.app`.
- **Lost keys.** Losing Sparkle's key strands installed copies on their version: they need a fresh download. Losing the release key means a new allowed-signers line, announced on the docs page. The runbook keeps an exported, encrypted backup with the owner.
- **Cost.** Static asset requests are not billed as Worker invocations; the two DMGs add about 10 MB to each deploy's upload, and unchanged files are not uploaded again.

## Evidence

The spike of 2026-11-25, on this Mac only, scripts in the scratchpad, nothing committed:

- `codesign -dv --verbose=4 /Applications/Todz.app` (the current Release build): `Authority=Apple Development: … (7N2H5833HE)`, `TeamIdentifier=XFWR794VS8`, `flags=0x0(none)` (no hardened runtime, because `project.yml` sets `ENABLE_HARDENED_RUNTIME: NO`), entitlements include `com.apple.security.get-task-allow`; no `embedded.provisionprofile` in `Contents/`.
- A copy re-signed with `codesign --force --options runtime --sign "Apple Development"` and the entitlements without `get-task-allow`: `flags=0x10000(runtime)`, `TeamIdentifier=XFWR794VS8`, `valid on disk`, `satisfies its Designated Requirement`, no `get-task-allow`. The private key signed without a prompt.
- `spctl -a -vv` on that copy, with and without a quarantine attribute, and on its signed DMG: `rejected`, `origin=Apple Development: …`. The DMG: 4,670,897 bytes.
- Launching on a Mac outside this one was not observed; that check is the owner's (decision 1).
- `which minisign cosign signify`: not found. `/usr/bin/openssl version`: `LibreSSL 3.3.6`; its `pkeyutl -verify -rawin` → `unknown option '-rawin'`.
- `ssh-keygen -Y sign -n file` then `-Y verify`: `Good "file" signature for release@todz.app with ED25519 key`; one byte appended → `Signature verification failed: incorrect signature`, exit 255. The same with the key loaded by `ssh-add -` from a base64 string into an agent on a private socket: verified, and no private key file in the work folder afterwards.
- `scripts/todz-cloudflare.sh pnpm exec wrangler r2 bucket list`: `Authentication error [code: 10000]`: the token has no R2 permission, and the owner's session declined adding one account-wide. That is why decision 5 serves the files as assets.
- `apps/api/public` today: 2.1 MB with one `_headers` file (the three security headers on `/*`, a CSP on `/icon.svg`), which the staging keeps first.
- `gh api repos/sparkle-project/Sparkle/releases/latest`: `2.10.1`, published 2026-10-25.

## Revisit when

- The owner's other-Mac check fails (decision 1's fallback), or passes (record it here).
- The owner buys the Apple Developer Program (decision 10).
- The owner asks for a GitHub Actions release.
- A DMG passes 25 MiB (decision 5's R2 fallback), or `_headers` turns out unable to set a header decision 5 needs.
- Sparkle ships a release that fixes a security issue in the installer.
