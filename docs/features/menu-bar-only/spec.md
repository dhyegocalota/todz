# Menu bar only

**Status:** Building
**Tier:** 🟢 (one Settings switch, on by default, and the app's activation policy; no server, no schema, no new entitlement)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop: "coloca uma flag enabled by default urgente: para eu poder fechar e o todz não aparecer no Dock (nem no ⌘Tab), mas ainda tá ativo no menu bar e widgets e Siri tudo certinho", recorded in `todz-loop/PROMPT.md` "Menu bar only, URGENT".
**ADRs:** [0074](../../adr/0074-closing-the-window-keeps-todz-in-the-menu-bar-as-an-accessory-app-behind-a-setting-on-by-default.md), [0031](../../adr/0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md)
**Not changing:** the popover, the main window's content, the sync, the widgets, the App Intents, the day close, the morning glance, ⌘Q and the menu bar's Quit

## Problem

Closing the todz window leaves a Dock icon and a ⌘Tab entry for an app the owner only wants in the menu bar.

## Goals

- Settings: a switch "Keep todz in the menu bar when closed", on by default, kept in the app's own defaults domain.
- Switch on: with no ordinary window open (the main window or Settings), the app is an accessory: no Dock icon, not in ⌘Tab. It keeps running the menu bar item and its count, sync, the change feed, widget reloads, App Intents and Siri, the day close and the morning glance.
- Opening a window again (the popover's "Open todz", a row, a widget tap, a `todz://` link, a Siri result, reopening the app from Finder or Spotlight) makes it a regular app while the window is open, in front and active.
- A launch that shows no window starts as an accessory.
- Switch off: today's behaviour, always a regular app.

## Non-goals

- A login item, a Dock menu, hiding the menu bar item, a change to `LSUIElement`.

## Design

`ActivationPolicyRule.policy(isSettingOn:visibleWindowCount:)` in TodzKit decides `.regular` or `.accessory`; `MenuBarOnlyPreference` reads the switch. The app counts its visible main-capable windows when one becomes key, when one closes and right after launch, and applies the rule with `NSApp.setActivationPolicy`.

## Test strategy summary

Unit tests for every case of the rule and the preference, red first. By hand: the Settings row, close and reopen from each entry point, the widgets and a Siri intent while hidden.
