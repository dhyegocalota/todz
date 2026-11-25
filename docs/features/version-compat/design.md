# Design: version-compat

**Sources:** [the spec](spec.md), [ADR 0069](../../adr/0069-the-api-states-its-build-version-and-the-oldest-app-it-accepts-and-the-app-shows-one-compatibility-line.md), and the current code: `SettingsView` (a `Form` `.grouped` whose last `Section` holds `ServerAddressForm(layout: .row)`), `ServerDisclosure` (a footnote, secondary button that opens `ServerAddressForm(layout: .column)`), `KeyScreenHeader` (the Connect an Agent title and project picker), `AppBanner` and `AppBanner+Copy` (the main window's banner, title and body), `BannerActionButton`, `SignInError+Copy`.
**Design system:** unchanged. Text styles `.footnote` and `.secondary`, SF Symbols, the system green and the accent colour. No new assets, no new tokens.
**Screenshots:** native views. The recorder takes them with Orca into `.pr-media/version-compat/`, light and dark: each state in Settings, the sign-in disclosure and Connect an Agent, and the banner. The states come from a fake server in the TodzKit preview (`/health` with and without `version`, a `426`), not from production.

## 1. The line

One `VersionLine` view, one line, `.footnote`, `.secondary`, a leading symbol, never wraps past two lines at the narrowest Settings width. The server shows its date part only; the full stamp is the line's `.help` tooltip.

| State | When (ADR 0069 §10) | Symbol | Text | Action |
|---|---|---|---|---|
| Compatible | the server answered, the app is new enough, the server is new enough | `checkmark.circle.fill`, green | `App 0.2.0 · Server 2026.11.25 · Compatible` | — |
| Update needed | the server's minimum is above the app, or a `426 app_too_old` came back | `arrow.down.circle`, accent | `App 0.2.0 · Server 2026.12.03 · Update todz to keep syncing` | `Download` link → `https://todz.app` |
| Server behind | the server's date is before `minimumServerVersion` | `info.circle`, secondary | `App 0.2.0 · Server 2026.11.20 · Server needs an update` | — |
| Server behind, no version | the server answered without `version` | `info.circle`, secondary | `App 0.2.0 · Server older · Server needs an update` | — |
| Not answered yet, or unreachable | no health answer | none | `App 0.2.0` | — |

Tooltips: compatible → `Server build 2026.11.25+3f9c2ab`; update needed → `This server needs todz 0.3.0 or later.`; server behind → `This server is older than this app expects. Whoever runs it can update it.`

Accessibility label, one per state, read as a sentence: `todz 0.2.0 and server 2026.11.25 work together.` / `todz 0.2.0 is too old for this server. Update todz to keep syncing.` / `The server is older than todz 0.2.0 expects. It needs an update.` / `todz 0.2.0.` The symbol is hidden from VoiceOver; the Download link keeps its own label `Download todz`.

## 2. Where it shows

```
Settings › Server                      Sign-in, disclosure open
┌───────────────────────────────────┐  ┌──────────────────────────────┐
│ Server  [https://api.todz.app] ⏎  │  │  Server: api.todz.app ⌄      │
│ ✓ App 0.2.0 · Server 2026.11.25 · │  │  [https://api.todz.app]  Use │
│   Compatible                      │  │  ✓ App 0.2.0 · Server …      │
└───────────────────────────────────┘  └──────────────────────────────┘

Connect an Agent                       Main window, update needed, signed in
┌───────────────────────────────────┐  ┌──────────────────────────────────────┐
│ Connect an agent      [Project ▾] │  │ ⬇ Update todz to keep syncing        │
│ ✓ App 0.2.0 · Server 2026.11.25 · │  │   Your changes wait here until then. │
│   Compatible                      │  │                          [Download]  │
└───────────────────────────────────┘  └──────────────────────────────────────┘
```

- **Settings › Server:** the line is the footer of the Server section, under the address row.
- **Sign-in disclosure:** the line sits under the address form inside the open disclosure. In the update-needed state it also shows under the closed disclosure line, because sign-in cannot work until the app is updated.
- **Connect an Agent:** under the header, above the commands, so the owner sees both versions while wiring an agent.
- **Banner (signed in, update needed):** a new `AppBanner.updateNeeded`: title `Update todz to keep syncing`, body `Your changes wait here until then.`, action `Download`. It replaces the generic server banner for this case and stays until the state changes.
- **Sign-in attempt refused as too old:** the error line reads `Update todz to sign in.`, and the version line under the disclosure carries the Download link.

## 3. Copy

All strings live in a new `apps/macos/Copy/VersionCopy.swift`, plus one case each in `ErrorCopy` (the banner) and `SignInCopy` (the refused sign-in). The separator ` · ` and the words `App` and `Server` are copy, not code. No "API", "build", "minimum", "426" or "header" in any visible string; "build" appears only in the compatible tooltip.

## 4. Options

| Option | Recommendation |
|---|---|
| The line always visible in the sign-in screen | No: the disclosure is the sign-in screen's one place for the server, and the line only escapes it when it blocks sign-in |
| A red symbol for update needed | No: the owner asked for calm; the accent arrow says what to do, red says something broke |
| The build hash in the line | No: the date reads as a version; the hash is in the tooltip and the deploy log |
