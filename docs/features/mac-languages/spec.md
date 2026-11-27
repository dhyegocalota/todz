# Mac languages

**Status:** Approved
**Tier:** 🟡 (every user-facing string of the app and the widgets moves into a catalog, two new Settings rows, one new header; no server change, no schema)
**Owner approval:** approved by [`docs/product/README.md`](../../product/README.md) (2026-11-23) and the owner's v1.2 order of 2026-11-27: the native macOS app and its widgets in eight languages, a Language override and an Appearance setting.
**ADRs:** [0120](../../adr/0120-the-mac-app-localizes-through-one-string-catalog-and-a-language-choice-in-the-app-group-switches-it-at-once.md), [0121](../../adr/0121-every-erase-at-launch-writes-one-breadcrumb-line-that-names-the-path-and-never-task-data.md)
**Not changing:** the server, the website, the docs, the sync, the widgets' content and layout, the shortcuts' phrases

## Problem

The app and the widgets speak English only, the Mac's language does not matter, and the owner cannot pick light or dark for todz alone. A launch that erases the cached account also leaves no trace of why.

## Goals

- One `Localizable.xcstrings` compiled into the app and the widget extension, every key in English, Português (Brasil), Español, Deutsch, Français, 日本語, 한국어 and 简体中文, each with state `translated`; plurals are catalog plural variations.
- The app follows the Mac's language by default (the best match among the eight, else English).
- Settings › General: Language (System, then the eight native names) and Appearance (System, Light, Dark).
- A Language choice applies at once, with no relaunch, in the window, Settings, the popover and the widgets.
- Appearance sets the app's appearance for the window, Settings and the popover; the widgets follow the desktop.
- Every request carries `Accept-Language` with the effective language, so the server mails in it.
- Every erase path at launch writes one line to the log and to a small breadcrumb file in the App Group (ADR 0121).

## Non-goals

- The Siri and Shortcuts phrases (they need their own table) and the Info.plist usage strings.
- Right-to-left languages, regional variants beyond the eight, a ninth language.

## Design

- `AppLanguage` mirrors `libs/types` `Language`; `LanguageChoice` adds System; `LanguagePreference` stores the choice in the App Group defaults and refuses a stored value outside the eight.
- `LanguageBundle` finds `<code>.lproj` in a bundle; `Localized` in `apps/macos/Copy` resolves a catalog key through the effective language's bundle, so no relaunch is needed.
- `AppearanceChoice` maps System, Light, Dark to nil, `.aqua`, `.darkAqua` on `NSApp.appearance`.
- Copy modules keep their names; each string becomes a catalog lookup keyed by its English text.

## Failure handling

- A stored language outside the eight is refused and logged; the app then reads the Mac's language.
- A catalog key missing in a language fails the repository-shape test, never at runtime.

## Test strategy summary

TodzKit unit tests, red first, for the resolver, the preference, the Appearance mapping, the header and the breadcrumb lines; repository-shape tests for the catalog completeness, the Swift list mirroring `libs/types` and every copy key existing in the catalog.
