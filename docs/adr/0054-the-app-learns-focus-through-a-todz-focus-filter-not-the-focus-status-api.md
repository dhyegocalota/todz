# 0054. The app learns Focus through a todz Focus filter, not the Focus status API

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 7 from the loop's `proactive-day` list: every proactive surface stays silent during a macOS Focus and shows once when it ends, opt-in and off by default
- Inspired by: the run-16 spike (scratch, not committed): three signed builds with the Personal Team `XFWR794VS8`; Apple's [INFocusStatusCenter](https://developer.apple.com/documentation/intents/infocusstatuscenter), [Handling communication notifications and Focus status updates](https://developer.apple.com/documentation/usernotifications/handling-communication-notifications-and-focus-status-updates), [SetFocusFilterIntent](https://developer.apple.com/documentation/appintents/setfocusfilterintent), [WWDC22 10121](https://developer.apple.com/videos/play/wwdc2022/10121/), [supported macOS capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-macos)

## Context

The proactive surfaces the owner asked for (`day-close`, `morning-glance`, `day-temperature`, `menu-bar-ribbon`) must stay quiet during a Focus and show once after it. macOS offers two ways for an app to learn about Focus:

- `INFocusStatusCenter` reports `isFocused`, but only with the Communication Notifications capability. The free Personal Team cannot hold it: automatic signing finds no profile, manual signing asks for "a provisioning profile with the Communication Notifications feature", and a build re-signed with the entitlement is refused at launch by AMFI (`No matching profile found`). Without it, the plain sandboxed build reads `isFocused == false` whatever the Focus. It also has no change notification, so it must be polled, and App Store review expects messaging or calling intents next to it.
- A Focus filter (`SetFocusFilterIntent`, App Intents, macOS 13+) needs no entitlement and built and signed with the Personal Team. The system runs it when a Focus that holds the app's filter turns on, with the values the owner configured, and again with the default values when that Focus ends; `current` reads the active values at launch. The app already ships App Intents for its widgets.

## Decision

1. **A todz Focus filter is the only Focus signal.** `TodzFocusFilter` with one parameter, "Keep todz quiet", default off. The owner opts in by adding the filter to the Focus modes he wants (System Settings → Focus → a mode → Focus filters → todz) with the switch on. A Focus without the filter never quiets todz.
2. **One shared gate.** A `ProactiveGate` in `TodzKit` holds whether todz is quiet. A proactive surface asks the gate before showing; while quiet, the gate keeps one pending entry per surface kind and shows nothing; when quiet ends, it hands back each pending surface once, then forgets it. Surfaces never read Focus themselves.
3. **The app reads the filter at launch and on every change.** `perform()` updates the gate; at launch the app reads `TodzFocusFilter.current`, so a Focus that began while the app was closed is honoured.
4. **Settings tells the owner how to opt in.** The Settings window gains a row that says todz stays quiet during a Focus that has the todz filter, with a button that opens Focus settings. Nothing is stored by todz: the system holds the filter.
5. **Agents are not gated.** The agent nudge (ADR 0053) answers an agent's call, which is not a surface the owner sees unasked.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Focus filter (chosen) | no entitlement; per-mode opt-in; live on/off | the owner adds the filter per Focus mode | the only path that works with the Personal Team |
| `INFocusStatusCenter` | any Focus, no setup per mode | Communication Notifications capability (paid membership, profile), polling, review friction | does not build or launch here |
| Read `~/Library/DoNotDisturb/DB/Assertions.json` | no setup | refused even outside the sandbox | not readable |
| A todz-only "quiet hours" setting | no system dependency | duplicates Focus, the owner keeps two schedules | not what the owner asked |

## Consequences

- No new entitlement, no provisioning profile, no paid membership.
- Quiet is opt-in twice over: each proactive surface is off by default, and only Focus modes the owner gives the todz filter quiet them.
- `perform()` may run in an extension process when the app is not running; the app re-reads `current` at launch, so nothing depends on that run.

## Evidence

Spike, 2026-11-25, Xcode 27.2, macOS 26: automatic signing with the entitlement: `No profiles for '…' were found`; manual: `requires a provisioning profile with the Communication Notifications feature`; re-signed: `AMFI: Code has restricted entitlements … -413 "No matching profile found"`; the same app without the entitlement and with a `SetFocusFilterIntent`: BUILD SUCCEEDED, `authorizationStatus=0`, `isFocused=false` with no prompt.

## Revisit when

The owner joins the paid Apple Developer Program and wants any Focus to quiet todz without adding a filter.
