# Tester briefing: Mac distribution

## G2: the app

### What changed and where

- `apps/macos/project.yml`: `ENABLE_HARDENED_RUNTIME: YES` on both targets; `CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO` in Release on both targets; the package `Sparkle` (`https://github.com/sparkle-project/Sparkle`, `exactVersion: 2.10.1`) as a dependency of `Todz` only; `TODZ_UPDATE_FEED_URL` (empty in Debug, `https://todz.app/download/appcast.xml` in Release); the app's Info.plist keys `SUFeedURL`, `SUEnableInstallerLauncherService`, `SUEnableAutomaticChecks`, `SUScheduledCheckInterval` (86400); the app's mach-lookup entitlements `$(PRODUCT_BUNDLE_IDENTIFIER)-spks` and `-spki`. The generated `Todz/Info.plist` and `Todz/Todz.entitlements` follow.
- `TodzKit/Sources/TodzKit/UpdateFeed.swift`: reads `SUFeedURL`; only an `https` address with a host is a feed.
- `Todz/Updates/AppUpdater.swift`: starts Sparkle's standard updater only when `UpdateFeed` has a URL; `AppDelegate` owns it, `TodzApp` hands it to `AppCommands`, which adds "Check for Updates…" (copy in `Copy/UpdateCopy.swift`) after About Todz when the updater exists.
- `apps/macos/README.md` names the updates.
- New dependency (named by the plan, for the PR body): **Sparkle 2.10.1**, exact, Swift Package Manager, `Todz` target only.

### Not done, waiting on the lead (step 9)

- Step 10: `SUPublicEDKey` is not in `project.yml`. The test "the app carries the public key that verifies every update" is red until the lead's key lands; `pnpm verify` stops at the `shape` gate for that one test.

### How to run

- `cd tools/repository-shape && pnpm exec vitest run src/macos-release.test.ts`
- `cd apps/macos && xcodegen generate`, then `xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug|Release -clonedSourcePackagesDirPath ~/.todz-release/packages build`
- `cd apps/macos/TodzKit && swift test --filter UpdateFeedTests` (the whole package: 1038 tests, green)

### Red today, green after

| Commit | Test | Red text printed |
|---|---|---|
| `d363602c` | `tools/repository-shape/src/macos-release.test.ts`, all eight tests | `AssertionError: expected '\n  Todz:\n    type: application\n …' to contain 'ENABLE_HARDENED_RUNTIME: YES'` (the target holds `NO`); the others fail the same way on their missing setting |
| `4d899fe9` | `UpdateFeedTests`, all four | `TodzKit/UpdateFeed.swift:7: Fatal error: UpdateFeed is not implemented`, then `exited with unexpected signal code 5` |

Green: settings `ef713283`, `UpdateFeed` and the updater `6a212c26`. The shape test's own corrections (the Release-entitlements pattern did not allow `TODZ_API_BASE_URL` before the key; the `SUPublicEDKey` plist check moved to the key's test) are the `test(mac-distribution)` commit after `6a212c26`, so the red commit's first run had two assertions that were wrong, not the settings.

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

- `SUPublicEDKey` (step 10), above.
- I did not launch the Release app: whether the sandboxed Sparkle installer starts (failure-mode row 12) is untested until a release is installed by the tester or the owner.
- Sparkle's nested helpers are ad hoc signed, above.
- The appcast, the signing keys and the release script are G3's and the lead's.
