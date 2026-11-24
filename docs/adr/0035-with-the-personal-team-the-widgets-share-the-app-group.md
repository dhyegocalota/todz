# 0035. With the Personal Team, the widgets share the App Group

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md) § 5, [the ad-hoc App Group learning](../learnings/2026-11-24-an-ad-hoc-app-group-raises-a-consent-prompt-per-build-and-process.md), the loop's Blockers of 2026-11-24 (signing resolved)

## Context

ADR 0033 shared the widget snapshot and requests through a folder in `~/Library/Application Support/` under a sandbox temporary exception, because an ad-hoc signature has no team and an ad-hoc App Group raises a consent prompt after every build. The Mac now holds a valid "Apple Development" identity of the owner's Personal Team, `XFWR794VS8`. The product design puts the shared data in the App Group container.

## Decision

1. Both targets sign with `DEVELOPMENT_TEAM: XFWR794VS8` and `CODE_SIGN_IDENTITY: Apple Development`, still `CODE_SIGN_STYLE: Manual`, with no provisioning profile.
2. Both carry `com.apple.security.application-groups` with `$(TeamIdentifierPrefix)dev.todz`, which this team expands to `XFWR794VS8.dev.todz`, and neither carries the home-relative temporary exception.
3. One Info.plist key in both targets, `TodzAppGroup`, holds the same `$(TeamIdentifierPrefix)dev.todz`; each process asks the file manager for that group's container. A process without the container keeps ADR 0033's behaviour for a missing folder: the app writes nothing for the widgets and the widgets draw their empty state.
4. Everything else in ADR 0033 holds inside the group container: the files, the intake rules, the untrusted-folder checks of § 3, the Darwin notification and the erase on sign-out. ADR 0033's location (§ 1 and § 5) is superseded.
5. The old folder in Application Support is left on disk: the sandboxed app can no longer reach it. The app's README says where it is.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| The team-prefixed App Group (chosen) | The product design's shape; the system protects the container; no exception | A machine needs the owner's identity to build | The owner is the only builder in v1 |
| Keep ADR 0033's folder | Builds anywhere | Any unsandboxed process reads today's titles; a temporary exception | ADR 0033 was a stopgap until a team |
| A `group.dev.todz` group | Portable name | Needs a provisioning profile from the developer portal | The loop does not touch the account (Forbidden list) |
| Automatic signing with `-allowProvisioningUpdates` | Xcode manages profiles | Registers the app and group on the account | Changes account state; forbidden without the owner |

## Consequences

- The `macos` gate builds only on a Mac with the owner's Apple Development identity; the app's README says so.
- The local risk of ADR 0033 (another app reading today's titles in the folder) is gone for new data; the old folder keeps the last snapshot until the owner deletes it.
- The cache and the session stay in the app's own container (ADRs 0025, 0027); moving them is not part of this decision.

## Evidence

- 2026-11-24, run 10 of the loop, a scratch build: a Manual-style build with the identity "Apple Development" and the team-prefixed group built with no provisioning profile; `codesign -dv` showed the TeamIdentifier on the app and on the extension.
- The hidden launch with no consent prompt and the snapshot in the group container are proven by the `widgets-app-group` test plan, under "Prove it for real".

## Revisit when

The owner publishes with the paid membership (Developer ID, notarization), or a second person needs to build the app.
