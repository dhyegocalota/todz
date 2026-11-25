# 0074. Closing the window keeps todz in the menu bar as an accessory app, behind a setting on by default

- Status: Accepted
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the switch, on by default: "coloca uma flag enabled by default urgente: para eu poder fechar e o todz não aparecer no Dock (nem no ⌘Tab), mas ainda tá ativo no menu bar e widgets e Siri tudo certinho"
- Inspired by: [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) (the app keeps running when the window closes, and keeps its Dock icon), [ADR 0055](0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md) (an app-local preference read from the app's own defaults domain)

## Context

ADR 0031 keeps the app running in the menu bar after its window closes, with its Dock icon. The owner wants the Dock icon and the ⌘Tab entry gone while no window is open, and everything else running: the menu bar item and its count, the sync and the change feed, the widgets' reloads, App Intents and Siri, the day close and the morning glance. All of those live in the one process, so the process must stay; only how macOS presents it changes.

## Decision

1. A Settings switch, "Keep todz in the menu bar when closed", on by default, stored under `keepsInMenuBarWhenClosed` in the app's own defaults domain and read by `MenuBarOnlyPreference`, like `DayClosePreference`: a value only in another searched domain is ignored, and nothing stored reads as on.
2. The decision is `ActivationPolicyRule.policy(isSettingOn:visibleWindowCount:)` in TodzKit: `.accessory` when the switch is on and no ordinary window is open, `.regular` otherwise. An ordinary window can become main and is visible or minimized (`OpenAppWindow.counts`, behind `NSWindow.isOpenAppWindow`, which the popover's return to the earlier app and the morning glance's "Today in front" also read): the main window and Settings. A minimized window keeps the Dock icon, which is how it comes back. The popover and the morning glance panel cannot become main, so they never count. While the app is hidden (⌘H) its windows read as not visible, so the policy is left alone.
3. The app applies it with `NSApp.setActivationPolicy` when a window becomes key and when a window closes (counting every other open window). `LaunchActivation.of(isDefaultLaunch:)` decides the launch: a default launch opens the window, so it leaves the policy to the first window event and the Dock icon never flickers; any other launch (a `todz://` link, a background launch) applies it once right after launch, so it ends as an accessory when no window shows. A launch for an App Intent starts with the prohibited policy, which ADR 0066 reads as "the owner has not engaged yet"; the app never changes a prohibited policy, so it stays out of the Dock and the deferred start of the pushed surfaces still waits for the owner's own engagement.
4. Every entry point that opens the window goes through `openWindow.mainWindow()`. A reopen of the running app (Finder, `open -a`, Spotlight) reaches `applicationShouldHandleReopen`, which asks the menu bar label to open the main window the same way. The window becoming key switches the app to regular, and the switch to regular activates the app again so its menu bar and the window come to the front.
5. No observer on the switch: it is flipped in Settings, whose window keeps the app regular until it closes, and the close applies the new value.
6. ⌘Q and `applicationShouldTerminateAfterLastWindowClosed` are unchanged. The popover gains "Quit todz", in its foot and under the sign-in and naming prompts, so the app can be quit with no window and no Dock icon.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Switch the activation policy at runtime from the window count (chosen) | One process, no plist change; the switch off is exactly today's app | AppKit glue in the delegate | — |
| `LSUIElement` in Info.plist with a regular switch while a window is open | Never a Dock icon at launch | The switch off would need the reverse dance; the app's menu bar and ⌘Tab are lost by default | The owner keeps a setting, and off must be today's behaviour |
| Hide the app (`NSApp.hide`) on close | No policy change | The Dock icon and ⌘Tab entry stay | It is the problem the owner names |

## Consequences

- With the switch on and no window, the app's own menu bar is not shown; the popover's "Quit todz" quits.
- A default launch whose window is not shown (closed when the app last quit) keeps the Dock icon until the first window event, the popover opening included.
- A Debug build and the Release app keep separate switches, as they keep separate defaults domains.
- Supersedes the "keeps its Dock icon" half of ADR 0031's decision 2 while the switch is on; ADR 0031 stays in force with the switch off.

## Evidence

The rule's unit tests in `ActivationPolicyRuleTests` and `MenuBarOnlyPreferenceTests`; the hand checks in `docs/features/menu-bar-only/test-plan.md`.

## Revisit when

- todz gets a login item, which would launch it straight into the menu bar.
- The owner wants Settings in the popover.
