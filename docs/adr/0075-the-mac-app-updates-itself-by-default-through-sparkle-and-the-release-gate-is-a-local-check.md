# 0075. The Mac app updates itself by default through Sparkle, and the first release's gate is a local check on this Mac

- Status: Accepted
- Date: 2026-11-26
- Deciders: Claude (the build loop's call under the owner's "decide every call" instruction); Dhyego Calota (owner) asked for the switch, on by default, and for the local check in place of the other notebook: "auto update… pode desativar mas por padrão on.. não pode rely on na App Store" and "quero finalizar ainda hoje" (PROMPT.md "Tonight's last three", 2026-11-26)
- Inspired by: [ADR 0072](0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) (Sparkle, the EdDSA feed, the gate), [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) (a setting the owner never touched takes the default), [ADR 0074](0074-closing-the-window-keeps-todz-in-the-menu-bar-as-an-accessory-app-behind-a-setting-on-by-default.md) (an app-local switch read from the app's defaults)

## Context

Sparkle already checks an EdDSA-signed appcast daily and offers updates through its gentle reminders. The owner wants installed copies to update without asking, with a Settings switch to turn that off, a "Check for Updates…" entry in the popover, and one quiet note after an update. The App Store is not an option. The first public release is due tonight, and ADR 0072 held it behind a check on the owner's other notebook.

## Decision

1. **Automatic updates, on by default in a released build only.** The Info.plist key `SUAutomaticallyUpdate` is the build setting `TODZ_AUTOMATICALLY_UPDATES`, which `project.yml` sets to `"NO"` for every configuration and `scripts/release-mac.sh` overrides to `YES` for the one Release build it signs; the script refuses a built app whose key is not `YES`. A build from source, or the owner's own rebuilt app, therefore never replaces itself with a public release (review R1). Sparkle reads its own user default first and falls back to that key, so a Mac whose owner never touched the switch updates automatically. The Settings switch, "Update todz automatically", is bound to `SPUUpdater.automaticallyDownloadsUpdates` through `AppUpdater`, which observes that property and writes Sparkle's user default. With the switch off, scheduled checks still run and an update is offered at the next launch or on "Check for Updates…".
2. **Install on quit or relaunch, without asking.** Sparkle downloads the verified update in the background and installs it when the app quits or relaunches, with no confirmation and no window over another app. This amends [ADR 0072](0072-the-mac-app-downloads-from-todz-app-as-a-development-signed-dmg-with-an-ssh-signature-and-updates-through-sparkle.md) decision 6, which had the owner confirm each install. The update is refused, as before, unless the feed and the archive both verify against `SUPublicEDKey`.
3. **"Check for Updates…" in the popover.** The popover's foot gains the entry beside "Quit todz". `AppUpdater` reaches the views through a SwiftUI environment value, `appUpdater`, that the menu bar content and the Settings scene set from the app delegate. In Debug, where no feed exists, the value is nil and the entry and the switch are not shown.
4. **The quiet note.** At launch `AppUpdater` compares the bundle's `CFBundleShortVersionString` with the version recorded at the previous launch, both in the app's standard defaults. A different recorded version, never a missing one, sets the pending version, which the popover foot shows as "Updated to x.y" until the owner taps it. The first launch records the version and shows nothing.
5. **The gate for the first public release.** ADR 0072 decision 1's gate, "publish only after the other-notebook check", is replaced by a local check on this Mac, run after the release is live: download the DMG from `todz.app`, mark it quarantined with `xattr -w com.apple.quarantine`, open it and confirm Gatekeeper's Open Anyway path, then confirm that a copy of version x updates to x+1 through Sparkle. The owner's other notebook becomes a later check, recorded in ADR 0072's Evidence when it happens. This amends ADR 0072's decision 1 gate only; the signing, the feed and the hosting stay.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the other-notebook gate | Tests a second Mac with no developer profile | Needs the owner's other Mac tonight; blocks the first release on a manual step | The owner asked to ship tonight; the check moves to a later step |
| Local check before the release is live | A bad build never reaches the public URL | The DMG has to be fetched from `todz.app`, which is only possible once it is served | The local check runs on the download as a visitor gets it, which is what the owner asked for; a failed check is answered by a fixed x+1 |
| Default off, the owner turns it on | No surprise installs | Contradicts "por padrão on" | The owner asked for the default on |
| Install immediately on download, with a relaunch prompt | Faster | Interrupts the owner's work | Sparkle's install on quit is quiet and the owner asked for install on quit or relaunch |
| Custom updater (our own downloads and replacement) | Full control | Re-implements the signature checks and the bundle replacement | Sparkle already does both, verified |
| Developer ID and notarization now | No Gatekeeper prompt | Needs an account and a notarization round trip tonight | Deferred, as ADR 0072 decision 10 already says |

## Consequences

- An installed copy updates itself on quit or relaunch, unless the owner turns the switch off. Every release reaches the Macs that are on, once they quit.
- A release that is bad for a Mac, by Gatekeeper or by a crash, reaches every Mac that updates. The local check runs after the release is live, so the remedy is a fixed x+1, not a rollback of the appcast. The release command never rolls back a published version.
- `SUAutomaticallyUpdate` in `apps/macos/project.yml` and `apps/macos/Todz/Info.plist` reads the build setting `TODZ_AUTOMATICALLY_UPDATES`; the shape test pins it, and the release script's test pins the override and the refusal.
- A compromised Sparkle EdDSA key now means code that installs silently on every Mac that is on and has the switch on, not a prompt the owner can read. This is why the runbook's step 2 has the owner approve each `sign_update` read by hand, with Allow and never Always Allow, and removes `sign_update` and `generate_keys` from the key's access list.
- The popover foot gets one entry and one note; the Settings window gets one switch. All are hidden in Debug.

## Evidence

- Pending: the first release's local check (the runbook's step 8) and the x to x+1 update check (step 9) will be recorded here with the macOS version of this Mac.

## Revisit when

- The owner's other-notebook check runs: its result goes into ADR 0072's Evidence.
- Sparkle changes what `automaticallyDownloadsUpdates` installs on quit, or a release needs a rollback path that is not a fixed x+1.
- The first public release is published with a Developer ID signature (ADR 0072 decision 10).
