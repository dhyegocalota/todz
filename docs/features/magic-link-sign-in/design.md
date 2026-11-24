# Design: magic-link-sign-in

**Sources:** [spec.md](spec.md), [ADR 0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), the sign-in section of [mac-app-shell/design.md](../mac-app-shell/design.md), `apps/macos/Todz/SignIn/*`, `apps/macos/Copy/SignInCopy.swift`.
**Design system:** unchanged. Glass direction, SwiftUI text styles and semantic colours (`.title` bold, `.secondary`, `.footnote`, `.red`), the system accent. No new font, colour or token. The browser page uses CSS system keywords that map to the same roles.
**Screenshots:** none; the screens are the existing sign-in column with different content. The build's walk captures each state under `.pr-media/magic-link-sign-in/`.

## 1. The app's sign-in screen

Same window, same `CenteredColumn(width: 280)`, same 64 pt app icon (`accessibilityHidden`). Only the content below the icon changes with the stage. The session-ended notice line keeps its place above the slot in every stage.

### 1.1 Stages

| Stage | Title / subtitle | Slot | Footnote |
|---|---|---|---|
| Method loading | title, subtitle (unchanged) | small `ProgressView` labelled `SignInCopy.gettingReady`, nothing else | none |
| Method unavailable | title, subtitle | `SignInErrorLine` (503 `signInUnavailable`, no Try Again; offline `networkTitle` with Try Again, which asks the method again) | none |
| Identity form | title, subtitle | `CredentialSlot`, unchanged in layout, states and copy | `developmentNotice` |
| Address entry | title, subtitle | email field, `Send Link` button | `SignInCopy.linkPromise` |
| Sending | title, subtitle | field read-only, small `ProgressView` `SignInCopy.sendingLink` in place of the button | `linkPromise` |
| Check your inbox | `SignInCopy.inboxTitle`; `inboxSubtitle`, then the address on its own line | `Send Again`, `Use a Different Email` | `SignInCopy.linkLifetime`, then the cooldown line while it runs |
| Redeeming | title, subtitle | small `ProgressView` `SignInCopy.signingIn` (existing string), no buttons | none |
| Error | stage the error came from | the stage's slot with `SignInErrorLine` under it | the stage's footnote |

`developmentNotice` appears only in the identity form. With the email kind the footnote is `linkPromise` (address entry, sending) or `linkLifetime` (inbox); it is never "Development sign-in" there, because that line is a lie for a real provider.

### 1.2 Address entry

- Field placeholder `SignInCopy.emailPlaceholder`, `.roundedBorder`, `textContentType(.emailAddress)`, autocorrection off, focused when the stage appears. Prefilled with the pending address when the owner came back through `Use a Different Email` or the pending link expired.
- `Send Link` is the default action, disabled with `DisabledReason` `SignInCopy.emailRequired` while the field is empty.
- On submit the trimmed address is checked locally with the Worker's rule (one line, at most 254 characters, one `@`, a dot after it). Refused: `SignInCopy.emailFormat` in `.red` under the field, field keeps focus, nothing is sent. A Worker 400 `invalid_request` shows the same line.
- Sending: field disabled, button replaced by the progress view, as `CredentialSlot` does today.
- Success (202): the pending link is saved, the stage becomes Check your inbox.

### 1.3 Check your inbox

```
        [ icon 64 ]
   Check your inbox            (.title bold)
   We sent a sign-in link to   (.secondary)
   maria@example.com           (bold, one line, middle truncation, full address as help)

        [ Send Again ]         (default action; disabled during the cooldown)
   Use a Different Email       (plain button)

   The link works for 15 minutes, on this Mac only.   (.footnote .secondary)
   You can send another in 28 seconds.                (.footnote .secondary, only while it runs)
```

- **Send Again** asks for a new link for the same address with a new verifier; the old link stops working only by expiry, so the copy never promises it. It is disabled for the cooldown after every send, with `DisabledReason` `SignInCopy.sendAgainWaiting(seconds:)`, and the visible footnote repeats it. When a 429 comes back, the error line shows and the cooldown restarts.
- **Use a Different Email** clears the pending link and returns to address entry, prefilled, field focused with the text selected.
- The cooldown line has the `updatesFrequently` accessibility trait so VoiceOver does not read each second.
- Quitting and reopening with an unexpired pending link opens on this stage (option A below). An expired pending link is cleared and the stage is address entry, prefilled, with no message.

### 1.4 Redeeming

The link arrives through `todz://sign-in?token=…` while the app shows any signed-out stage; the screen goes to Redeeming at once, hiding the buttons so a second click cannot race. Success hands over to First workspace or Main window with the system crossfade. A failure returns to address entry (never back to Check your inbox, because the pending link is already spent or refused) with the error under the slot.

### 1.5 Failure rows

Each row is a `SignInError` case rendered by the existing `SignInErrorLine` (`.red`, optional Try Again).

| Case | Stage it shows in | Copy | Try Again |
|---|---|---|---|
| Address malformed (local or 400) | address entry, under the field, not an error line | `emailFormat` | no |
| 429 `too_many_links` | address entry or inbox | `tooManyLinks` | no |
| 503 `sign_in_unavailable` (sender rejected, no origin, no method) | where it happened | `signInUnavailable` (existing) | no |
| 401 `identity_rejected` on a link | address entry, prefilled | `linkRejected` | no |
| Link with no pending request here, or an expired pending one | address entry | `linkNotRequested` | no |
| Link while signed in | none, the app drops it | none | none |
| Offline asking | address entry | `ErrorCopy.networkTitle` | yes, sends again |
| Offline redeeming | Redeeming becomes the error line over the held link | `ErrorCopy.networkTitle` | yes, redeems the held link again; the pending file is kept |
| 5xx / unexpected | where it happened | `ErrorCopy.serverTitle` | yes |
| 422 `time_zone_invalid` on redeem | address entry | `timeZoneInvalid` (existing) | no |

New `SignInError` cases: `.tooManyLinks`, `.linkRejected`, `.linkNotRequested`. Their `copy` and `canTryAgain` join `SignInError+Copy.swift`'s exhaustive switches. A link rejected or never requested clears the pending file, so Return on `Send Link` starts clean.

## 2. Components

| Component | Source | Use |
|---|---|---|
| `CenteredColumn(width: 280)` | `apps/macos/Todz/Shared/CenteredColumn.swift` | the column in every stage, unchanged |
| App icon at 64 | `SignInScreen.swift` | unchanged, `accessibilityHidden` |
| `SignInErrorLine` | `apps/macos/Todz/SignIn/SignInErrorLine.swift` | every error row, unchanged |
| `disabled(because:)` | `apps/macos/Todz/Shared/DisabledReason.swift` | `Send Link` (empty field), `Send Again` (cooldown) |
| `CredentialSlot` | `apps/macos/Todz/SignIn/CredentialSlot.swift` | the identity form, unchanged |
| `SignInStage` (new enum, `apps/macos/Todz/SignIn/`) | model-owned: method loading, method unavailable, identity, address, sending, awaiting link, redeeming | `SignInScreen` switches on it for title, subtitle, slot and footnote |
| `AddressSlot` (new) | `apps/macos/Todz/SignIn/AddressSlot.swift` | the address field, `Send Link`, progress, `emailFormat`; same shape as `CredentialSlot` (focus on appear, refocus when the window becomes key, `onSubmit`) |
| `InboxSlot` (new) | `apps/macos/Todz/SignIn/InboxSlot.swift` | the address line, `Send Again`, `Use a Different Email`, the cooldown footnote |

New components are justified because the identity slot is the region the spec replaces by method; the slots stay side by side and `SignInScreen` only chooses. No new colour: error text `.red`, hints `.secondary`, the address `.bold()`.

## 3. Copy

`SignInCopy.swift`; existing strings are not repeated. Lifetime and cooldown interpolate shared constants (`SignInLinkLifetime`, `SignInLinkCooldown`), as `identityFormat` interpolates `IdentityFormat.maxLength`; no number is typed in a string.

| Key | String |
|---|---|
| `gettingReady` | Getting ready… |
| `emailPlaceholder` | Email |
| `sendLink` | Send Link |
| `sendingLink` | Sending… |
| `emailRequired` | Enter your email address to continue. |
| `emailFormat` | Enter a valid email address. |
| `linkPromise` | We'll email you a link. No password needed. |
| `inboxTitle` | Check your inbox |
| `inboxSubtitle` | We sent a sign-in link to |
| `sendAgain` | Send Again |
| `useDifferentEmail` | Use a Different Email |
| `linkLifetime(minutes:)` | The link works for 15 minutes, on this Mac only. |
| `sendAgainWaiting(seconds:)` | You can send another in 28 seconds. (inflected: "1 second") |
| `tooManyLinks` | Too many links. Wait a few minutes and try again. |
| `linkRejected` | That link has expired or was already used. Send a new one. |
| `linkNotRequested` | Open the link on the Mac that asked for it, or send a new one. |

The last three are the spec's failure table verbatim. Buttons are Title Case as the app's are (`Sign In`, `Try Again`), so the spec's "Send again" and "Use a different email" are `Send Again` and `Use a Different Email`. `signingIn` ("Signing in…") serves Redeeming.

## 4. Interaction and accessibility

- **Keyboard.** Return submits: `Send Link` in address entry, `Send Again` in the inbox once the cooldown ends (both `keyboardShortcut(.defaultAction)`). Tab order: field, primary button, `Use a Different Email`. No new shortcut.
- **Focus.** Address entry focuses the field on appear (after `Task.yield()`, as `CredentialSlot` does) and again when `controlActiveState` becomes `.key`; the identity form behaves as today. The inbox has no field, so nothing is forced on window activation. Back to address entry from the inbox focuses and selects the field.
- **VoiceOver.** The title carries the header trait and takes accessibility focus when the stage changes, so the move from address entry to the inbox is announced as "Check your inbox". The field is labelled "Email address" (`accessibilityLabel`, the placeholder disappears once typed); the address line reads "maria@example.com" with no decoration. `Send Again` while cooling reads its `DisabledReason` as the hint. Progress views carry their text as the label. The icon stays hidden. Error lines keep `children: .contain`.
- **Contrast and motion.** Only system semantic colours on the window background, as today; `.red` on error text matches the existing error lines. No animation beyond the system crossfade between stages.
- **Disabled reasons.** Empty address, cooldown. Redeeming has no buttons, so nothing is disabled without a reason.

## 5. The browser page, `GET /sign-in`

Copy in a `*-copy.ts` module; the page is one centred column of the same shape as the app's.

```
        [ icon 64 ]
   Sign in to todz              (title, bold)
   Opening todz on your Mac…    (secondary)
      [ Open todz ]             (the one button)
   Nothing happened? Open this link on the Mac that asked for it, with todz installed.   (small, secondary)
```

| Key | String |
|---|---|
| `title` | Sign in to todz |
| `opening` | Opening todz on your Mac… |
| `openButton` | Open todz |
| `notOpened` | Nothing happened? Open this link on the Mac that asked for it, with todz installed. |
| `missingToken` | This link is incomplete. Send a new one from todz. |

- **Layout.** A column at most 280 px wide, centred horizontally and vertically (`min-height: 100vh`, flex), icon 64 × 64 above, 16 px gaps. At 375 px it is the same column with the viewport's side padding; nothing reflows.
- **Light and dark.** `color-scheme: light dark`; background `Canvas`, text `CanvasText`, secondary lines `GrayText`, button `AccentColor` with `AccentColorText`, so the browser draws the OS's colours and no hex value enters the CSS. Font `system-ui`; title 22 px bold (the app's `.title`), body 1 rem, the last line 0.8125 rem (the app's `.footnote`). The icon is the app icon, one artwork for both schemes.
- **Behaviour.** The script reads the fragment, sets `location` to `todz://sign-in?token=…` and leaves the button as the manual retry, which sets the same location on click. With no token in the fragment the page shows `missingToken` in place of `opening`, hides the button and the last line. The fragment is cleared from the address bar with `history.replaceState` after reading, so the token does not sit in the browser history entry or a screenshot.
- **Accessibility.** One `h1`, one `button`, `lang="en"`, the icon `alt=""`, the last line plain text after the button. The button is focused on load so Return opens the app; contrast is the browser's own system pair.
- **Build constraint for the developer.** The spec's content security policy allows only the inline script by hash. The icon and the inline stylesheet need `img-src data:` (or the icon inlined as SVG) and a `style-src` hash; both are the same hash approach, not a loosening to `unsafe-inline`.

## 6. Options

### A. Reopening with a pending link
| Option | Trade-off |
|---|---|
| A. Open on Check your inbox | matches what the owner expects after quitting to read mail; the vault already keeps the file |
| B. Always start on address entry, prefilled | simpler; hides that a link is on its way, so the owner may request a fourth link and hit the limit |

Recommendation A. **Loop's call: A.**

### B. Cooldown for Send Again
| Option | Trade-off |
|---|---|
| A. 30 seconds, a visible line, `Send Again` disabled | stops double sends well under the 3-per-15-minutes limit; one more line |
| B. 30 seconds, disabled button only, reason in help | quieter; the owner sees a dead button with no visible why |
| C. No cooldown, rely on the 429 | no timer code; the owner burns the limit with double clicks |

Recommendation A. **Loop's call: A.**

### C. The primary button's title
| Option | Trade-off |
|---|---|
| A. `Send Link` | says what happens; fits the subtitle |
| B. `Continue` | Apple's usual word; says nothing about email |

Recommendation A. **Loop's call: A.**

### D. Where the heading changes in the inbox
| Option | Trade-off |
|---|---|
| A. Replace title and subtitle; the address shown as a bold line | one clear message; the welcome copy is gone only while waiting |
| B. Keep the welcome and add a status line under it | the screen keeps one identity; the instruction sits among the welcome text and is missed |

Recommendation A. **Loop's call: A.**

## 7. Owner decisions

The owner asked the loop to decide every call and review later (PROMPT.md, 2026-11-24), so each option takes its recommendation as the loop's call, listed in the loop's questions for the owner: A. open on Check your inbox; B. a 30 second cooldown with a visible line; C. `Send Link`; D. the inbox replaces the title and subtitle. The rate limit is 5 links per address per 15 minutes (spec → Plan review answers, R3), so the cooldown sits well under it.
