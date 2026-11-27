# Tester briefing: mac languages

## What changed

- Every string of the app, the widgets and the Siri and Shortcuts phrases comes from two String Catalogs (`apps/macos/Copy/Localizable.xcstrings`, `apps/macos/Todz/Shortcuts/AppShortcuts.xcstrings`) in English, Português (Brasil), Español, Deutsch, Français, 日本語, 한국어 and 简体中文, each with state `translated`. Plurals are catalog variations.
- The app follows the Mac's best language match among the eight, else English.
- Settings › General has Language (System, then the eight native names) and Appearance (System, Light, Dark). A language applies at once in the window, Settings and the popover, and the widgets reload; Appearance sets `NSApp.appearance`.
- Every request, the health probe and the socket upgrade carry `Accept-Language` with the effective language tag.
- Each erase at launch writes one line to the unified log (category `launch`) and to `launch-breadcrumbs.log` in the App Group (rotating to `launch-breadcrumbs.1.log` at 16 KB): timestamp, path, reason, never task data.
- No server change. The Language value is stored in the App Group defaults under `language`; Appearance in the app's defaults under `appearance`.

## How to run it

- Unit: `swift test --package-path apps/macos/TodzKit`; shape: `pnpm --filter @todz/repository-shape test`.
- Build: `xcodegen generate --spec apps/macos/project.yml`, then `xcodebuild build` of the Debug scheme into your own derived data. Never launch it on screen and never touch `/Applications`.
- Renders: the offscreen renderer in `todz-loop/notes/mac-render` (a headless app with stub data) writes the PNGs in `todz-loop/notes/mac-renders`. It cannot draw the main window's sidebar (the system source list stays blank offscreen), so the window shots are the task column only.

## Red and green

| Test | Red | Green |
|------|-----|-------|
| language resolver, preference, bundle lookup, Appearance mapping | did not build (the types did not exist) | passes |
| `Accept-Language` on requests, probe, socket | did not build | passes |
| breadcrumb lines per erase path, no task data, rotation | did not build | passes |
| catalogs: all eight translated, plurals, every key used and present | no catalog | passes after the merge |
| Swift language list mirrors `libs/types` `Language` | no `language.ts` on this branch | red until site-languages is on main |

## Hypotheses to attack

- A key missing in one language silently shows English: only the shape test proves it, so read a real language bundle (`pt-BR.lproj`, `ja.lproj`) for plurals of 1 and 2.
- Switching language while Settings is open resets its state; the picker should keep the new choice and the rest of the window should change at once.
- Widgets: after a change the widget gallery and the placed widgets should follow within a reload; the widget process reads the App Group defaults on every render.
- A stored language outside the eight (`defaults write` of `tlh` into the group domain) is logged and falls back to the Mac's language, never a crash.
- Appearance Light or Dark must hold for the popover as well as the window and Settings.
- Touch ID reasons must complete the system's "is trying to …" sentence in every language.
- The 6 shortcut phrases keep the application name in every language.
- The launch breadcrumb: erase the cached owner file by hand, relaunch, and expect exactly one line.

## Added to this PR: the sign-in code and the grant scopes

- "Check your inbox" has six code boxes over one VoiceOver field with `oneTimeCode` AutoFill: typing advances, backspace goes back, a paste anywhere fills the boxes and submits. A wrong code shakes the boxes (Reduce Motion: a red ring only), a locked answer shows the server's wait, and "Resend code" waits 30 seconds and sends a new verifier.
- Settings › Connected apps lists each grant's scopes in words (the account, every project of a workspace, a project in its workspace), with Limit to… and Remove, and Disconnect as before. While the session is locked it names only visible workspaces, hides a grant that covers none, and offers no Limit or Remove, because a narrowing from a partial view would drop scopes it cannot see.
- Autofocus: the sign-in email field, then the code field's first box, the add-task field and every one-field sheet already take focus on open; the code field and the email field do not take it while the server form is open.
- Attack: paste text around a code; paste while the challenge token is still loading (the code is held and sent when it arrives); five wrong codes; narrow an account grant while locked (it must be impossible).
