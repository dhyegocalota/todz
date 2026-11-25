# Design: server-url

**Sources:** [the spec](spec.md), [ADR 0056](../../adr/0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md), [the magic-link sign-in design](../magic-link-sign-in/design.md) (§ 1 stages and footnotes), [the menu-bar-count design](../menu-bar-count/design.md) (§ 1.2 the Settings window), and the current code: `SettingsView` (a grouped `Form`, `subtitleLines` 2, `LabeledContent` for the Focus row, `settingsWidth` 420 in `TodzApp`), `SignInScreen` (`CenteredColumn` of `columnWidth` 280, title, subtitle, slot, footnote), `AddressSlot` and `CredentialSlot` (a `.roundedBorder` field, the format line in `.red` after a submit, a `ProgressView` in place of the button while a request runs, `.keyboardShortcut(.defaultAction)` on the primary button, refocus on `controlActiveState == .key`), `SignInErrorLine`, `DisabledReason` (`disabled(because:)`), `KeyScreen` (the `Server URL` `CommandBlock`, read from `AppConfiguration.baseURL`), `KeyRow` and `RootView` (destructive `confirmationDialog`, Cancel as the default action), `MainWindowState.requestSignOut` (no dialog when nothing waits), `SyncCopy.signOutTitle(count:)`, `ErrorCopy.signOutFailed`.
**Design system:** unchanged. System materials, semantic colours (`.primary`, `.secondary`, `.red`), text styles (`.title` bold, `.body`, `.subheadline`, `.footnote`), the one accent `#2F5BFF`, SF Symbols. No token is added.
**Screenshots:** none taken. Both surfaces are native (the Settings window and the main window's sign-in screen); Playwright MCP drives a browser and captures neither. The `recorder` takes the captures of § 6 with Orca into `.pr-media/server-url/design/`. Neither surface is the menu bar popover, so the captures do not pop anything over the owner's work.

## 1. Screens and states

Three surfaces change: Settings gains a Server group, the sign-in screen gains a quiet Server line, Connect an Agent's Server URL follows the server in use. The popover, the widgets and the rest of the main window do not change. One new component carries the field on both editing surfaces, so the two never drift (§ 2).

The server is shown by its **name**: the host, with `:port` when the URL has one (`api.todz.app`, `todz.example.com`, `localhost:8787`, `[::1]:8787`). The full URL appears only in the field and in Connect an Agent.

### 1.1 Settings: the Server group

A second `Section` after the existing rows, so the one control that erases data sits apart from the switches (O1, A).

```
┌──────────────── todz Settings ────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ Show pending count in the menu bar   [●━] │ │
│ │ …existing rows…                           │ │
│ └───────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────┐ │
│ │ Server                     Use todz cloud │ │  ← the button only when not on the default
│ │ Where your tasks are kept. Switching      │ │
│ │ signs you out and erases this Mac's copy. │ │
│ │───────────────────────────────────────────│ │
│ │ [https://todz.example.com      ] Switch…  │ │
│ │ No todz server answered at that address.  │ │  ← the status line, only when there is one
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

- Row 1, `LabeledContent`: the label is `server` and `serverDetail` (`lineLimit(subtitleLines, reservesSpace: true)`, as the rows above); the content is `useTodzCloud`, a `.bordered` `.small` button, present only when the URL in use is not the build's default.
- Row 2, `ServerAddressForm` (new, § 2): a `.roundedBorder` `TextField` that fills the row, prefilled with the full URL in use, then `switchServer`; under them one status line.
- The window keeps its width 420 and its `fixedSize` height; the status line adds one line while it shows, the same way the sign-in slots grow.

| State | When | Field | Switch… | Use todz cloud | Status line |
|---|---|---|---|---|---|
| Idle | the field holds the URL in use | enabled | disabled, reason `serverInUse` | enabled | none |
| Empty | the field is blank | enabled | disabled, reason `serverEmpty` | enabled | none |
| Editing | the text differs from the URL in use | enabled | enabled | enabled | none |
| Refused, address | `ServerAddress.check` returns an issue on submit | enabled, refocused, text kept | enabled | enabled | the issue (§ 4), `.red` |
| Checking | the `/health` probe is in flight | disabled | replaced by `ProgressView(checkingServer)` `.small` and `SheetCopy.cancel` (O7, A) | disabled, reason `serverBusy` | none |
| Refused, not todz | the probe errs, times out or answers anything else | enabled, refocused, text kept | enabled | enabled | `notTodzServer`, `.red` |
| Refused, other origin | the probe answers `service: todz` with another origin | enabled, refocused, text kept | enabled | enabled | `serverNamedOther(origin:)`, `.red`, the origin selectable (O5, B) |
| Confirming | the probe passed and the owner is signed in, or changes wait | disabled | hidden behind the dialog (§ 1.3) | disabled | none |
| Switching | the owner confirmed, or no dialog was needed | disabled | replaced by `ProgressView(switchingServer)` `.small` | disabled | none |
| Failed erase | erasing the session or the cache failed | enabled, text kept | enabled (it is the retry) | enabled | `serverSwitchFailed(server:)`, `.red`, naming the server still in use |
| Switched | the switch finished | the new URL, now in use | disabled, reason `serverInUse` | per the new URL | `switched(server:)`, `.secondary` (O8, A); cleared when Settings closes |
| Busy elsewhere | a sign-in request or a switch from the sign-in screen is in flight | disabled | disabled, reason `serverBusy` | disabled, reason `serverBusy` | none |

A submit of the same URL as in use does nothing (spec), which the disabled button and the guard in the submit both hold. The address check runs only on submit, never as the owner types, like `emailFormat`.

**Overloaded and slow.** A server answering 429 or 5xx to `/health` is "not todz" for the switch; nothing changes. A probe that hangs keeps `Checking the server…` until the request timeout; Cancel and Escape end it at any moment (O7). A switch whose sign-out at the old server hangs keeps `Switching…`; the switch cannot be cancelled once the erase may have begun (§ 7, note 2).

**Width.** One width, 420. A long URL scrolls inside the field; nothing wraps.

### 1.2 The sign-in screen: the Server line

A quiet line at the foot of the 280 column, after the footnote (O2, A; O3, A).

```
Collapsed                                Expanded
┌────────── 280 ──────────┐              ┌────────── 280 ──────────┐
│         [icon]          │              │         [icon]          │
│     Welcome to todz     │              │     Welcome to todz     │
│ Your tasks, shared with │              │ Your tasks, shared with │
│      your agents.       │              │      your agents.       │
│ [Email                ] │              │ [Email                ] │
│     [ security check ]  │              │     [ security check ]  │
│       [ Send Link ]     │              │       [ Send Link ]     │
│ We'll email you a link. │              │ We'll email you a link. │
│   No password needed.   │              │   No password needed.   │
│                         │              │                         │
│  Server: api.todz.app › │              │  Server: api.todz.app ⌄ │
└─────────────────────────┘              │ [https://api.todz.app ] │
                                         │        [Switch…]        │
                                         │     Use todz cloud      │  ← only when not on the default
                                         │ No todz server answered │  ← status line, as Settings
                                         │   at that address.      │
                                         └─────────────────────────┘
```

- Collapsed: one plain button, `.footnote`, `.secondary`, `serverDisclosure(server:)` then the SF Symbol `chevron.right`, `.lineLimit(1)`, `.truncationMode(.middle)`, `.help` the full URL (the pattern of the awaited link's address). It is the only thing the feature adds to the column at rest.
- Expanded: the symbol turns to `chevron.down`; under it `ServerAddressForm` in its column layout: the field at the column's width, `switchServer` centred under it, `useTodzCloud` as a `.plain` button (the weight of `useDifferentEmail`), the status line. The column re-centres; the move animates with `.default`, none under Reduce Motion (the `MainWindowState` pattern).
- Shown in every stage, so the server is readable even when it is the problem (`methodUnavailable`, "Can't reach todz"). Collapsed on every appearance of the screen; the state is the screen's own.
- The same states as § 1.1, with three differences: the dialog of § 1.3 is rarer here (signed out, so it shows only when changes wait); a switch collapses the line, which now names the new server, and the slot returns to `Getting ready…` while the new server's sign-in method loads (§ 7, note 3); no `switched` line is shown, the new name in the collapsed line is the confirmation.
- `Busy elsewhere` here is `model.isSigningIn`, `model.isRequestingLink`, the redeeming stage, or a switch from Settings.

### 1.3 The confirmation

A `confirmationDialog` on the form, the shape of `KeyRow` and `RootView`: title visible, a destructive button, `SheetCopy.cancel` as the default action. `{new}` is the new server's name, `{old}` the one in use, `{count}` `model.waitingChangeCount`.

| Owner | Waiting changes | Dialog | Title | Message | Destructive button |
|---|---|---|---|---|---|
| Signed in | 0 | yes | `Switch to {new}?` | `You'll be signed out, and this Mac's copy of your tasks is erased. Your tasks stay on {old}.` | `Switch Server` |
| Signed in | N | yes | `Switch to {new} and lose {count} change(s)?` | `They haven't reached {old} yet. Switching signs you out and erases them from this Mac.` | `Switch Server` |
| Signed out | N (the session ended) | yes | `Switch to {new} and lose {count} change(s)?` | `They haven't reached {old} yet. Switching erases them from this Mac.` | `Switch Server` |
| Signed out | 0 | no, the switch runs at once | | | |

The losing title mirrors `SyncCopy.signOutTitle(count:)` ("Sign out and lose 3 changes?") so the two destructive moves read alike. `Use todz cloud` goes through the same probe and the same dialog with `{new}` the default's name.

### 1.4 Connect an Agent

The `Server URL` section already shows the MCP URL and every client command embeds it; both now read `AgentCommand.serverURL(apiBase: model.serverURL)` instead of the file constant (§ 7, note 4). The block gains a caption (O6, B):

```
Server URL
The server in use. Change it in Settings › Server.        [Copy]
┌─────────────────────────────────────────────────────────┐
│ https://todz.example.com/mcp                            │
└─────────────────────────────────────────────────────────┘
```

Connect an Agent exists only signed in, and a switch signs out, so the screen never shows a stale server: the next time it opens, it is on the new one.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `ServerAddressForm` (new) | `apps/macos/Todz/Server/` | the field, Switch…, Use todz cloud, the status line and the dialog of § 1.3; one view used by both surfaces, a `layout` value (`.row` for Settings, `.column` for sign-in) choosing an `HStack` or a centred `VStack`. Its own state: the text, the check stage (idle, checking, refused with its reason, switched); the switch in flight is `model.isSwitchingServer` so Settings and the sign-in screen disable together |
| `ServerDisclosure` (new) | `apps/macos/Todz/SignIn/` | the collapsed line and the expanded `ServerAddressForm` |
| `ServerName` (new, pure) | `TodzKit` | URL to its display name (host, `:port` when present), unit-tested beside `ServerAddress` |
| `SettingsView` | `apps/macos/Todz/Settings/` | the second `Section` of § 1.1 |
| `SignInScreen` | `apps/macos/Todz/SignIn/` | `ServerDisclosure` after the footnote; the sign-in method reloads when `model.serverURL` changes |
| `AddressSlot`, `CredentialSlot` | `apps/macos/Todz/SignIn/` | their refocus on `controlActiveState == .key` must not take focus from an expanded server field (§ 5) |
| `KeyScreen` | `apps/macos/Todz/MainWindow/KeyScreen/` | `serverURL` from the model; the caption |
| Reused unchanged | | `DisabledReason`, `CommandBlock`, `SheetCopy.cancel`, `InflectedCopy.text`, `AccessibilityNotification.Announcement` (as `SettingsView.announce`) |

## 3. Tokens

| Use | Token |
|---|---|
| Group, rows, separators | the grouped `Form`'s system materials |
| `Server` title | `.primary`, the form's title style |
| `serverDetail`, `switched` line | `.secondary`, the form's subtitle style |
| Field | `.roundedBorder`, `.body`, system font (the URL is typed, not code; the monospaced face stays for `CommandBlock`) |
| Switch… | the system push button; never `.borderedProminent`, it is not the screen's primary action |
| Use todz cloud | `.bordered` `.small` in Settings (as `Revoke…`), `.plain` on sign-in (as `Use a Different Email`) |
| Status line, refused and failed | `.red`, as `emailFormat` and `SignInErrorLine` |
| Sign-in Server line | `.footnote`, `.secondary`; the chevron at the same style |
| Progress | `ProgressView` `.controlSize(.small)` |
| Widths | `settingsWidth` 420, `columnWidth` 280; no new constant; spacing is the stacks' and the form's defaults |

## 4. Copy

Every string is in § 8. Reused: `SheetCopy.cancel`, `KeyScreenCopy.serverURL`. Counts go through `InflectedCopy.text`. Names and URLs are interpolated, never concatenated.

The address issues, one line each, shown after a submit:

| Issue | Line |
|---|---|
| not a URL at all | `Enter an address like https://todz.example.com.` |
| no scheme, or one other than http and https | `Start the address with https://.` (O4, A) |
| `http://` to a host that is not loopback | `Use https://. Plain http:// works only for localhost.` |
| no host (`https://`) | `Add the server's name after https://.` |
| a query | `Remove the part from ? on.` |
| a fragment | `Remove the part from # on.` |
| credentials | `Remove the name and password before @.` |

The spec's "That address is not a todz server" becomes `No todz server answered at that address.`: it stays true when the probe timed out or nothing listened, which is the commonest self-host mistake (`wrangler dev` not running).

## 5. Interaction and accessibility

**Keyboard**

| Keys | Where | Does |
|---|---|---|
| Return | the server field | submits: check, probe, then the dialog or the switch. Through `.onSubmit`, never `.keyboardShortcut(.defaultAction)` on Switch…: on the sign-in screen Send Link and Sign In own the default action |
| Escape | the server field, editing or refused | restores the URL in use and clears the status line; on sign-in it also collapses the line and returns focus to it (`.onExitCommand`) |
| Escape | checking | cancels the probe, back to Editing with the text kept |
| Return, Escape | the dialog | both cancel (Cancel is the default action, as every destructive dialog in the app); the destructive button takes a click, or Tab then Space |
| Space, Return | the collapsed sign-in line, focused | expands it and focuses the field with its text selected |
| Tab | Settings | the existing rows, then Use todz cloud (when shown), the field, Switch… |
| Tab | sign-in | the slot's controls, the Server line, then when expanded the field, Switch…, Use todz cloud |

Nothing in the Server group takes focus when Settings opens. After a refusal the field takes focus back. The sign-in slots refocus their own field when the window becomes key; while the server field is expanded and focused they leave focus where it is, or the owner loses the address mid-typing.

**VoiceOver**

| Element | Announces |
|---|---|
| Field | label `serverAddressLabel` "Server address", value the text |
| Switch… | "Switch…, button"; disabled with its reason as the hint (`DisabledReason`) |
| Use todz cloud | "Use todz cloud, button" |
| Sign-in line | label `serverDisclosure(server:)` "Server: api.todz.app", value `Collapsed` or `Expanded`, hint `serverDisclosureHint` |
| Checking, switching | the progress view's label |
| Status line | read in place; a refusal, a failed erase and a switch are also posted as announcements, the pattern of `SettingsView.announce` |
| Dialog | the system's: title, message, buttons |

**Motion:** only the sign-in column's re-centre on expanding, `.default`, none under Reduce Motion. The progress views are the system's.

**Contrast:** `.primary` and `.secondary` on the window and form backgrounds are the system's guarantee in light and dark. The `.red` lines are the app's existing error style; system red on the light window is about 3.6:1, under 4.5:1 for body text, a gap the sign-in and Settings errors already share and that Increase Contrast closes; changing it is a design-system question, not this feature's. The chevron carries no meaning that the value `Collapsed`/`Expanded` does not.

**Disabled reasons:** `serverEmpty`, `serverInUse`, `serverBusy`, each as hover help and as the accessibility hint.

## 6. Options

Picked by the build loop on 2026-11-25: every recommendation (O1 A, O2 A, O3 A, O4 A, O5 B, O6 B, O7 A, O8 A).

Captures for the `recorder`, from the built Debug app with Orca, into `.pr-media/server-url/design/`, in light and dark: `settings-idle-default.png`, `settings-idle-own-server.png`, `settings-refused-address.png`, `settings-checking.png`, `settings-not-todz.png`, `settings-confirm-signed-in.png`, `settings-confirm-waiting.png`, `settings-failed-erase.png` (when it can be forced), `settings-switched.png`, `sign-in-collapsed.png`, `sign-in-expanded.png`, `sign-in-refused.png`, `connect-an-agent-own-server.png`, and one annotated copy per option (`o1-…png` to `o8-…png`).

**O1. How Settings edits the server**
- A. An always-present field prefilled with the URL in use, Switch… beside it, in its own group. One click to start, the same form the sign-in screen shows, one modal layer (the dialog). The idle row holds an editable field the owner rarely touches.
- B. A read-only row with `Change…` opening a sheet (as `NameSheet`) holding the field, the status line, Cancel and Switch. The calmest idle row, but the dialog then stacks on a sheet over the Settings window, and the sign-in screen needs a second shape anyway.
- C. A read-only row whose `Change…` expands the field inline. Calm idle and one layer, but a second state to explain with the same result as A.
- **Recommendation: A. The loop picks.**

**O2. The sign-in control**
- A. A plain, centred `.footnote` button with a chevron, value `Collapsed`/`Expanded`. Keeps the column's centred symmetry; one quiet line at rest.
- B. A native `DisclosureGroup`. Disclosure semantics for free, but its triangle and label sit at the leading edge and break the centred column.
- C. A `Server…` text button opening a sheet. No column change at all, but a sheet over a screen whose whole job is one field.
- **Recommendation: A. The loop picks.**

**O3. Where the sign-in line sits**
- A. Inside the column, after the footnote. Never overlaps anything at the window's minimum 760 by 480; expanding re-centres the column once.
- B. Pinned to the window's bottom edge, outside the column. The column never moves, but at 480 high with the security check showing, the expanded form can meet the footnote.
- **Recommendation: A. The loop picks.**

**O4. An address typed without a scheme**
- A. Refuse with `Start the address with https://.` The deploy log prints the full origin to paste, and guessing `https://` for `localhost:8787` would fail against `wrangler dev`, which is plain http.
- B. Prefix `https://` when no scheme is typed. One keystroke saved for a cloud host, a confusing failure for a local one, and a change to ADR 0056 § 3.
- **Recommendation: A. The loop picks.**

**O5. The probe answers todz, with another origin**
- A. The same line as every other refusal (the spec's row "refused the same way").
- B. `That server answers as {origin}. Enter that address instead.`, the origin selectable. The commonest real mismatch is a self-hoster pasting the `workers.dev` address of a Worker whose `PUBLIC_ORIGIN` is their own domain; naming it ends the hunt. No one-click "use it": the owner retypes or pastes, and that address goes through the probe again. Needs one row of the spec's failure table reworded.
- **Recommendation: B. The loop picks.**

**O6. Connect an Agent**
- A. Unchanged: the existing `Server URL` block now reads the model. Zero new copy; nothing says where it comes from.
- B. A plus the caption `The server in use. Change it in Settings › Server.` in the block's empty caption slot. One string; answers "why is this my server, and where do I change it".
- **Recommendation: B. The loop picks.**

**O7. The probe in flight**
- A. `Checking the server…` with Cancel beside it; Escape does the same. The probe can wait for the full request timeout when a host swallows packets.
- B. The progress view alone. Simpler, but a dead end until the timeout.
- **Recommendation: A. The loop picks.**

**O8. After a switch from Settings**
- A. `Switched to {new}. Sign in from the todz window.` under the field until Settings closes, also announced. Settings is a separate window; without it the only change in front of the owner is the field's value.
- B. Nothing but the field's value and the announcement.
- **Recommendation: A. The loop picks.**

**Minor calls made by the loop** (reversible)

| Call | Choice |
|---|---|
| The button's title | `Switch…` on both surfaces; the ellipsis because a check and often a dialog follow |
| `Use todz cloud` in the Debug app | the same title; it restores the build's default, `localhost:8787` there; Debug is the developer's app |
| The dialog's default button | Cancel, as `KeyRow` and `RootView`; Return in the dialog never erases |
| No dialog | signed out with nothing waiting, as `requestSignOut` |
| The sign-in line on each appearance | collapsed |
| The server's name | host with `:port` when present, in titles, the sign-in line and the status lines |
| The field's font | the system body font, not monospaced |

## 7. Notes for the plan

1. The check state is the form's; the switch in flight is the model's (`isSwitchingServer`), so a switch from one surface disables the other.
2. The sign-out at the old server is best effort (spec) and the old server is often the unreachable one; a short timeout on that request keeps `Switching…` from lasting a minute. The probe's timeout is the same question. Both are plan decisions, not copy.
3. `SignInScreen` loads the sign-in method once in `.task`; a switch on that screen erases the method while the phase stays signed out, so the load must follow `model.serverURL` (`.task(id:)`), or the slot sticks on `Getting ready…`.
4. `KeyScreen`'s file-level `serverURL` constant becomes a computed value from the model; `ClientCommands` and the block both take it.

## 8. Owner decisions

Empty when written; the lead records each answer here before the plan.

| Option | Answer | Date |
|---|---|---|

## 9. Every new copy string

**SettingsCopy** (`apps/macos/Copy/SettingsCopy.swift`):
- server "Server"
- serverDetail "Where your tasks are kept. Switching signs you out and erases this Mac's copy."
- serverAddressLabel "Server address"
- serverPlaceholder "https://todz.example.com"
- switchServer "Switch…"
- useTodzCloud "Use todz cloud"
- checkingServer "Checking the server…"
- switchingServer "Switching…"
- serverEmpty "Enter a server address."
- serverInUse "todz already uses this server."
- serverBusy "Wait until sign-in or the switch finishes."
- confirmSwitch "Switch Server"
- switchTitle(server:) "Switch to {server}?"
- switchMessage(server:) "You'll be signed out, and this Mac's copy of your tasks is erased. Your tasks stay on {server}."
- switchLosingTitle(server:count:) "Switch to {server} and lose {count} change(s)?", through `InflectedCopy.text`
- switchLosingSignedInMessage(server:) "They haven't reached {server} yet. Switching signs you out and erases them from this Mac."
- switchLosingSignedOutMessage(server:) "They haven't reached {server} yet. Switching erases them from this Mac."
- switched(server:) "Switched to {server}. Sign in from the todz window."

**SignInCopy** (`apps/macos/Copy/SignInCopy.swift`):
- serverDisclosure(server:) "Server: {server}"
- serverDisclosureHint "Change the server todz signs in to."

**ErrorCopy** (`apps/macos/Copy/ErrorCopy.swift`):
- serverAddressIssue(issue:), one case per issue: "Enter an address like https://todz.example.com." · "Start the address with https://." · "Use https://. Plain http:// works only for localhost." · "Add the server's name after https://." · "Remove the part from ? on." · "Remove the part from # on." · "Remove the name and password before @."
- notTodzServer "No todz server answered at that address."
- serverNamedOther(origin:) "That server answers as {origin}. Enter that address instead." (O5, B)
- serverSwitchFailed(server:) "todz couldn't erase this Mac's copy of your tasks, so it's still on {server}. Try again."

**KeyScreenCopy** (`apps/macos/Copy/KeyScreenCopy.swift`):
- serverURLCaption "The server in use. Change it in Settings › Server." (an `AttributedString`, as the other captions; O6, B)

**AccessibilityCopy** (`apps/macos/Copy/AccessibilityCopy.swift`):
- disclosureCollapsed "Collapsed"
- disclosureExpanded "Expanded"
