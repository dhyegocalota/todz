# Design: focus-switch-defaults

**Sources:** [the spec](spec.md), [ADR 0068](../../adr/0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md), the current `SettingsView` and `SettingsCopy`, the day-email design on `feat/day-email` (§1.1 the Email me my day row, §1.2 the mail).
**Design system:** unchanged. System controls only; no token, font or spacing is added.
**Screenshots:** taken after the build by the `recorder` through computer use (ADR 0026), light and dark, into `.pr-media/focus-switch-defaults/`; the README's Settings shots are replaced from them.

## 1. Settings window

```
┌──────────────── todz Settings ───────────────────────┐
│ Show pending count in the menu bar             [●━]  │
│ Let agents mention today's tasks               [●━]  │
│ Close the day                        [18:00 ⇅] [●━]  │
│ Morning glance                                 [●━]  │
│ Day temperature                                [●━]  │
│ Dims the menu bar count through the afternoon        │
│ and tints overdue widget rows.                       │
│ Email me my day                      [07:00 ⇅] [●━]  │
│ Respect Focus                                  [━○]  │
│ Hold what todz shows on this Mac in a Focus that     │
│ has the todz filter.                                 │
│─────────────────────────────────────────────────────-│
│ Server …                                             │
└──────────────────────────────────────────────────────┘
```

- The "Quiet during Focus" row goes. "Respect Focus" is a `.switch` `Toggle` with a title and a detail `Text` (`lineLimit(subtitleLines, reservesSpace: true)`), the last row of the first section, after every proactive row, so it reads as covering what is above it. `@AppStorage(RespectFocusPreference.isOnStorageKey)`.
- While the switch is on, one more row sits directly under it: a short helper line, `LabeledContent` whose label is "Add the todz filter to a Focus." and whose content is a link-style `Button` "Open Focus Settings" (the existing `openFocusSettings` action). It is absent, not disabled, while the switch is off.
- While the switch is on and the gate is quiet, the detail reads "Quiet now, until this Focus ends." (`FocusQuietNotice.quietNow`). While the switch is off the detail never says "Quiet now", whatever the filter says.
- Day temperature's detail drops "Quiet in a Focus." No other row mentions Focus.
- The Settings window grows by one row while Respect Focus is on; the window's height follows the form (`fixedSize`), as today.

| State | Switch | Detail | Helper line | VoiceOver |
|---|---|---|---|---|
| Off (default) | off | `respectFocusDetail` | absent | "Respect Focus, switch, off", then the detail |
| On, not quiet | on | `respectFocusDetail` | shown | "…, on"; then "Add the todz filter to a Focus.", "Open Focus Settings, button" |
| On, quiet | on | `focusQuietNow` | shown | "…, on", "Quiet now, until this Focus ends." |
| Turned off while quiet | off | `respectFocusDetail` | absent | the held surfaces show once |

## 2. Copy

| Key | Text |
|---|---|
| `respectFocus` | Respect Focus |
| `respectFocusDetail` | Hold what todz shows on this Mac in a Focus that has the todz filter. |
| `respectFocusHelper` | Add the todz filter to a Focus. |
| `openFocusSettings` | Open Focus Settings (kept) |
| `focusQuietNow` | Quiet now, until this Focus ends. (kept) |
| `dayTemperatureDetail` | Dims the menu bar count through the afternoon and tints overdue widget rows. |
| Focus filter description | Keeps todz from showing anything on its own while this Focus is on, when Respect Focus is on in todz Settings. |

Removed: `focusQuiet` ("Quiet during Focus"), `focusQuietDetail`.

## 3. The day mail's stop link

- The footer becomes: "Sent at {{time}} because Email me my day is on in todz Settings, where it starts on. [Stop these emails]" with the link in the existing `.email-link` style; the plain-text part ends "Stop these emails: <url>".
- The stop page on the API host uses the same shell as the sign-in link page: the lockup, one card, one sentence, one button. Its one style block is inline and hashed; every answer carries `Content-Security-Policy: default-src 'none'; style-src 'sha256-<hash of the page style>'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`, `X-Robots-Tag: noindex` and `Cache-Control: no-store`. No Turnstile: a mail client's one-click `POST` cannot solve it. The lockup is a `data:` image so `img-src` stays `data:` only.

| Page | Heading | Sentence | Control |
|---|---|---|---|
| `GET`, live token | Stop your day email? | todz will stop mailing your day to this address. | button "Stop my day email" (a `POST` form to the same URL) |
| `POST`, done | Your day email is off | Turn it back on in todz Settings. | none |
| Unknown, expired or used | This link no longer works | Your day email is set in todz Settings. | none |
| Too many requests (429, after `limitRefusal`) | Try again in a minute | Too many tries from here. | none |

## 4. Accessibility

The helper line's button is reachable by Tab after the switch; it is removed from the tab order with the row when the switch is off. The stop page's button is a real `<button type="submit">` with a visible focus ring, and each page has one `h1`.
