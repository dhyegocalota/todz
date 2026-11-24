# The widgets share the App Group

**Status:** Approved
**Tier:** 🟡
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) (macOS app → Sync: "a local cache in the App Group container that the widgets read"; Owner prerequisites: "The App Group identifier carries the Team ID prefix"), approved by the owner on 2026-11-23. Where the data lives until then and how the switch happens is ADR 0035, the loop's call, listed in the loop's questions for the owner
**ADRs:** [0035](../../adr/0035-with-the-personal-team-the-widgets-share-the-app-group.md), [0033](../../adr/0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md), [0032](../../adr/0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md)
**Not changing:** what the widgets show, the snapshot and request files and their intake rules, the Darwin notification, the cache and the session in the app's own container (ADRs 0025, 0027)

## Problem

The widgets and the app share a folder in `~/Library/Application Support/dev.todz.widgets/` through a sandbox temporary exception (ADR 0033), because there was no team to sign an App Group. The product design puts the shared data in the App Group container, and any process the owner runs outside the sandbox can read today's titles in that folder. The Mac now has the owner's Personal Team identity (Team ID `XFWR794VS8`), so the group ADR 0033 promised can replace the folder.

## Goals

- The app and the widget extension are signed with the Personal Team and share the App Group `XFWR794VS8.dev.todz`, with no consent prompt after a rebuild.
- Neither target carries the home-relative temporary exception.
- The app writes a fresh snapshot into the group on its next launch; the widgets read it there.

## Non-goals

- Moving the cache or the session into the group.
- Removing the old folder in Application Support: the sandboxed app can no longer reach it. The app's README says where it was, so the owner can delete it.
- A Developer ID signature, notarization or the real Sign in with Apple.

## Design

### Data flow

The app's widget store and the extension's store both resolve their folder from one Info.plist key that holds the group identifier, through `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`. The group identifier is `$(TeamIdentifierPrefix)dev.todz`, so the Info.plist value and the entitlement come from the same build setting. Everything downstream of the folder URL is unchanged.

### Interfaces

- `SharedFolder.of(info:container:)` takes the Info.plist dictionary and a function from a group identifier to its container, and returns the container for the key's group, or `nil` when the key is missing, not text, empty, or the system has no container for it. `SharedFolder.of(bundle:)` passes the file manager's lookup.
- `SharedFolder.created` and `SharedFolder.owned` keep their checks: the group container is still treated as untrusted (ADR 0033 § 3).
- `project.yml`: both targets get `DEVELOPMENT_TEAM: XFWR794VS8` and `CODE_SIGN_IDENTITY: Apple Development`, keep `CODE_SIGN_STYLE: Manual`, and replace the exception with `com.apple.security.application-groups`.

### Failure handling

- No container for the group (a build without the team): the app uses its unavailable widget store, as it does today for a missing folder, and the extension draws its empty state.
- A machine without the Apple Development identity cannot build the app: the `macos` gate fails at signing with Xcode's message. That is the owner's machine today; the identity requirement is stated in the app's README.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Where does the shared data live once the team exists? | App Group `<TeamID>.dev.todz` / keep the exception folder | Loop's call (ADR 0035): the App Group, as ADR 0033 § 5 promised; listed in the loop's questions for the owner | 2026-11-24 |

## Test strategy summary

Unit tests for `SharedFolder.of(info:container:)` (the key, the missing key, a non-text key, an empty key, no container), red first. A build of both targets, then `codesign -d --entitlements` on the app and the extension shows the group and no exception, and `TeamIdentifier=XFWR794VS8` on both. A hidden launch against the local API writes `widget-snapshot.json` into `~/Library/Group Containers/XFWR794VS8.dev.todz/` with no consent prompt; a rebuilt app launches again with no prompt. A placed widget reading the group is the owner's eye, as in PR #10.
