# Design: ui-polish-forms

**Sources:** the owner's ask (2026-11-26, "faz a UI ficar sexy, até mesmo os forms"), [ADR 0077](../../adr/0077-the-motion-system-is-one-token-set-in-todzkit-with-every-effect-under-350-ms-and-a-crossfade-under-reduce-motion.md) (motion tokens, Reduce Motion crossfade), [the server-url design](../server-url/design.md) (§ 1 the Server field's states), [the magic-link sign-in design](../magic-link-sign-in/design.md) (the sign-in stages), and the current code on `main` at `32fd07ba`, cited per surface in § 1.
**Design system:** unchanged at its root: system text styles (`.title` bold, `.headline`, `.body`, `.subheadline`, `.footnote`), semantic colours (`.primary`, `.secondary`, `.red`, `Color.accentColor`, the `AccentColor` asset, `#2F5BFF`), system materials, SF Symbols, the `MotionToken` set. No custom font. This feature adds **form components** and proposes **four metrics** (§ 3) that are an owner decision before the plan.
**Screenshots:** none taken. Every surface is native (the main window, its sheets and Settings); Playwright MCP drives a browser and captures none of them. The `recorder` takes the before and after captures of § 7 with Orca from a Debug build in its own derived data, light and dark, into `.pr-media/ui-polish-forms/design/`. No capture opens the menu bar popover.
**Moving ground.** ADR 0092 (the Settings layout) is not on `main` yet; § 1.6 and step 6 of § 7 defer to it when it lands. Two open PRs touch these files: **#89** (delete-workspace confirms: adds the typed-name confirmation, so `NameConfirmation*` does not exist on `main`) and **#96** (the sign-in banner, so `SignInScreen.swift` and its slots change). This design is drawn against `main`; § 1.4 and § 1.1 say where each PR lands, and § 7 orders the migration after both merge.

## 1. Inventory: every form surface today

Shared facts across all of them: every field is `.textFieldStyle(.roundedBorder)` at the regular control size; every inline problem is a bare `Text(...).foregroundStyle(.red)` with no symbol, so colour is the only signal; a field never shows that it is the invalid one; a busy action **replaces** its button with a `ProgressView`, so the row changes width and height mid-flow; only `ServerAddressForm` and `KeyScreenFailureLine` announce a problem to VoiceOver.

### 1.1 Sign-in

Files: `apps/macos/Todz/SignIn/SignInScreen.swift`, `AddressSlot.swift`, `CredentialSlot.swift`, `InboxSlot.swift`, `SignInErrorLine.swift`, `ChallengeView.swift`; `apps/macos/Todz/Shared/CenteredColumn.swift`. **PR #96 changes `SignInScreen.swift`** (the banner); migrate after it merges.

| # | Problem | Where |
|---|---|---|
| S1 | The column floats on the bare window background: icon, title, field, button and footnote have no surface tying them into one card. | `SignInScreen` `CenteredColumn(width: 280)` |
| S2 | `Send Link` and `Sign In` are default-styled buttons (blue only because of `.keyboardShortcut(.defaultAction)`), while `FirstWorkspaceScreen`'s `Create` is `.borderedProminent`: the two primary actions of the same first-run flow look different. | `AddressSlot:33`, `CredentialSlot:30`, `FirstWorkspaceScreen:39` |
| S3 | While sending, the button disappears and `ProgressView("Sending…")` takes its place: the column jumps and the error line moves up. | `AddressSlot:28-36`, `CredentialSlot:25-33`, `InboxSlot:13-19` |
| S4 | `emailFormat` and `identityFormat` appear in `.red` with no symbol; the field itself does not change; VoiceOver hears nothing (focus returns to the field, which reads only its value). | `AddressSlot:24-27`, `CredentialSlot:21-24` |
| S5 | The identity field has no accessibility label; VoiceOver reads its placeholder only. | `CredentialSlot:16` |
| S6 | `Use a Different Email` is `.buttonStyle(.plain)`: it reads as body text, not as an action; `Sign Out` on the next screens is `.link`. Two styles for the same weight of action. | `InboxSlot:20-21`, `FirstWorkspaceScreen:47` |
| S7 | `SignInErrorLine` stacks a red sentence over a default `Try Again` button with no spacing rule and no announcement. | `SignInErrorLine` |

### 1.2 Name sheets (new workspace, new project, rename project)

Files: `apps/macos/Todz/Shared/NameSheet.swift`, `NameSheetKind.swift`, `NameIssue.swift`; presented from `MainWindow.swift:42` and `Onboarding/WorkspacePickerScreen.swift:43`.

| # | Problem | Where |
|---|---|---|
| N1 | `.frame(width: 320)` fixes the sheet width; with larger text the field and the issue line wrap inside a box that cannot grow. | `NameSheet:4,53` |
| N2 | The only label is the placeholder `Name`; it vanishes as soon as the owner types (rename opens with text, so the label is never seen). | `NameSheet:23` |
| N3 | `.disabled(isUnchanged)` disables `Rename` with no reason: no tooltip, no VoiceOver hint, against the `disabled(because:)` rule every other button follows. Two `.disabled` modifiers stack on one button. | `NameSheet:47-48` |
| N4 | Two separate red lines can show at once (the rule issue and the save failure), unstyled and unannounced. | `NameSheet:28-35` |
| N5 | `Create` turns into a bare spinner while saving (S3 again), and the sheet's buttons shift left. | `NameSheet:40-49` |
| N6 | The title is `.headline` with no line saying what a workspace or project is; the sheet reads as a raw prompt. | `NameSheet:21` |

`FirstWorkspaceScreen` (`apps/macos/Todz/Onboarding/FirstWorkspaceScreen.swift`) repeats the same field, the same `NameIssue` line and the same spinner swap inline: a second copy of the name form. `WorkspacePickerScreen` pads its rows with the inline literal `.padding(.vertical, 4)` (`:24`).

### 1.3 Destructive confirms on `main`

Files: `apps/macos/Todz/RootView.swift:16` (sign out), `MainWindow/KeyScreen/KeyRow.swift:41` (revoke a key), `Server/ServerAddressForm.swift:60` (switch server). All three are system `confirmationDialog`s with a `.destructive` button and Cancel as the default action. They are correct and native; **this feature leaves them alone** (§ 6, O4). Only the typed-name confirmation is a form.

### 1.4 Typed-name confirmation (delete a workspace or project)

**Lands in PR #89; not on `main`.** Whatever #89 names it (`NameConfirmation*`), it is a sheet with a field the owner types the name into before a destructive button enables. This design gives it the same chrome as § 1.2 (it is the name sheet's destructive sibling) and does not change its rule or its copy; § 4.3 proposes copy only for the parts #89 leaves open. Migrate after #89 merges, onto § 2's components.

### 1.5 Server field

Files: `apps/macos/Todz/Server/ServerAddressForm.swift`, `ServerDisclosure.swift`, `VersionLine.swift`.

| # | Problem | Where |
|---|---|---|
| V1 | `Use todz cloud` is `.bordered .small` in Settings and `.plain` on sign-in: one action, two looks. | `ServerAddressForm:104-117` |
| V2 | `Switch…` becomes `ProgressView("Checking the server…")` plus Cancel (S3), so the field shrinks mid-check in the row layout. | `ServerAddressForm:84-102` |
| V3 | The status line uses `.red` vs `.secondary` with no symbol; refusal and success differ by colour only. It already announces, the one surface that does. | `ServerAddressForm:120-126,254-257` |

### 1.6 Settings rows

Files: `apps/macos/Todz/Settings/SettingsView.swift`, `SettingsWorkspaceRows.swift`, `SettingsWorkspaceShortcuts.swift`, `WorkspaceChordRow.swift`; window width `settingsWidth` 420 in `TodzApp.swift:7`. **ADR 0092 (Settings layout) is not on `main`; when it lands, its grouping wins over § 5.6.**

| # | Problem | Where |
|---|---|---|
| T1 | Eleven rows sit in one unlabelled group before the first `Section`; the window is a long undifferentiated list. | `SettingsView:27-133` |
| T2 | Every subtitle reserves two lines (`lineLimit(subtitleLines, reservesSpace: true)`), so one-line details leave a blank line under them, row after row. The reservation exists to stop rows jumping when a notice swaps the subtitle; most rows never swap. | `SettingsView` throughout, `SettingsWorkspaceShortcuts:16` |
| T3 | A chord row that is recording only changes its text to `.secondary`; nothing frames the row as listening for a key. | `WorkspaceChordRow:23-32` |
| T4 | A rebind refusal replaces the `.secondary` footnote with another `.secondary` sentence: the owner cannot tell a refusal from the usual note, and VoiceOver hears neither. | `SettingsWorkspaceShortcuts:25,33-36` |
| T5 | The Server row's field (§ 1.5) is the only field in the window and gets no more care than a toggle. | `SettingsView:136-140` |

### 1.7 Connect an Agent

Files: `apps/macos/Todz/MainWindow/KeyScreen/KeyScreen.swift`, `KeyCreation.swift`, `KeyRow.swift`, `SecretNotice.swift`, `CommandBlock.swift`, `CopyButton.swift`, `KeyScreenFailureLine.swift`.

| # | Problem | Where |
|---|---|---|
| K1 | `SecretNotice` and every `CommandBlock` sit on `.background(.fill.quaternary)` with square corners: hard rectangles in an otherwise rounded window. | `SecretNotice:28`, `CommandBlock:40` |
| K2 | `Revoke` is a neutral `.bordered .small` button with no destructive role; only the dialog behind it says it destroys. | `KeyRow:34-38` |
| K3 | `KeyScreenFailureLine` is the one announced red line, but it has its own name and no symbol, so it drifts from every other surface. | `KeyScreenFailureLine` |
| K4 | `Create Key` becomes a separate `ProgressView` row plus text (S3). | `KeyCreation:12-26` |

## 2. Components

Seven pieces, five views and two pure types. Views live flat in `apps/macos/Todz/Shared/` like `DisabledReason` and `BannerActionButton`; the pure rules live in TodzKit so `TodzKitTests` can pin them (the app target has no test bundle). Every view reads the control size, the colour scheme contrast and Reduce Motion from the environment; none takes a size.

### 2.1 `FieldState` (TodzKit, new)

`apps/macos/TodzKit/Sources/TodzKit/FieldState.swift`. The one place that decides how a field looks, so every surface draws the same state from the same facts.

```swift
public enum FieldState: Sendable, Equatable {
    case rest
    case focused
    case invalid
    case disabled
    case busy

    public static func of(isFocused: Bool, hasIssue: Bool, isDisabled: Bool, isBusy: Bool) -> FieldState
}
```

Precedence, highest first: `busy`, `disabled`, `invalid`, `focused`, `rest`. Invalid outranks focus, so a refocused invalid field keeps its red ring until the text changes (§ 4.1). Unit tests cover all sixteen combinations.

### 2.2 `FormField` (new)

`apps/macos/Todz/Shared/FormField.swift`. A labelled text field with the chrome of § 2.3.

```swift
struct FormField: View {
    let label: String
    let prompt: String
    @Binding var text: String
    let issue: String?
    let isLabelShown: Bool
    let isBusy: Bool
    var isFocused: FocusState<Bool>.Binding
}
```

- Body: `VStack(alignment: .leading)` of the visible label (only when `isLabelShown`; `.subheadline`, `.secondary`) and `TextField(label, text: $text, prompt: Text(prompt))` with `.textFieldStyle(.plain)`, `.focused(isFocused)`, `.disabled(isBusy)`, then `.modifier(FieldChrome(state:))`, then `ValidationLine` when `issue != nil`.
- Accessibility: `.accessibilityLabel(label)` always (closes S5); `.accessibilityHint(issue)` while invalid, so returning to the field reads the problem again.
- Callers keep their own `.onSubmit`, `.textContentType`, `.autocorrectionDisabled`, `.onExitCommand`: the component draws, it does not decide.
- Sign-in and the onboarding column pass `isLabelShown: false` (the centred column reads as a card, the prompt is enough and the label is spoken); sheets, the typed-name confirmation and Settings pass `true` (N2).

### 2.3 `FieldChrome` (new, view modifier)

`apps/macos/Todz/Shared/FieldChrome.swift`. Draws the field's surface and ring from a `FieldState`.

```swift
content
    .padding(.horizontal, horizontalPadding)          // @ScaledMetric(relativeTo: .body)
    .padding(.vertical, verticalPadding)              // @ScaledMetric(relativeTo: .body)
    .background(.fill.quaternary, in: shape)          // shape: RoundedRectangle(cornerRadius: fieldCornerRadius, style: .continuous)
    .overlay { shape.strokeBorder(ringStyle, lineWidth: ringWidth) }
    .opacity(state == .disabled ? disabledOpacity : enabledOpacity)
    .todzAnimation(.snap, value: state)
```

| State | Ring colour | Ring width | Fill |
|---|---|---|---|
| `rest` | `Color(nsColor: .separatorColor)`; `.secondary` under Increase Contrast | rest width | `.fill.quaternary` |
| `focused` | `Color.accentColor` | focus width | `.fill.quaternary` |
| `invalid` | `.red` | focus width | `.fill.quaternary` |
| `disabled` | separator | rest width | `.fill.quaternary`, content at the system disabled opacity |
| `busy` | `Color.accentColor` at the disabled opacity | rest width | `.fill.quaternary` |

`.textFieldStyle(.plain)` drops the system focus ring, so this ring **is** the focus indicator; Full Keyboard Access still reaches the field because the `TextField` is focusable. Under Increase Contrast every ring gains one point of width. `separatorColor` and `.red` are system colours, so dark mode and Increase Contrast switch them without a per-component colour.

### 2.4 `ValidationLine` (new; replaces `KeyScreenFailureLine` and every bare red `Text`)

`apps/macos/Todz/Shared/ValidationLine.swift`.

```swift
enum ValidationTone { case issue, note }

struct ValidationLine: View {
    let text: String
    let tone: ValidationTone
}
```

- `issue`: `Label(text, systemImage: "exclamationmark.circle.fill")`, `.font(.subheadline)`, `.foregroundStyle(.red)`.
- `note`: `Text(text)`, `.font(.subheadline)`, `.foregroundStyle(.secondary)` (Server `switched`, `serverInUse`, the chord footnote).
- Announces `text` through `AccessibilityNotification.Announcement` on appear and whenever `text` changes, for both tones (KeyScreenFailureLine's behaviour, now everywhere).
- Enters with `.transition(.opacity)` under `todzAnimation(.snap, value:)`; no shake, no offset.
- `.fixedSize(horizontal: false, vertical: true)` so it wraps under larger text and never truncates.

The symbol makes the issue readable without colour (S4, V3, T4). `ServerAddressForm`'s own `announceStatus` goes away; the line announces.

### 2.5 `FormButton` and `FormActionKind` (new)

`apps/macos/Todz/Shared/FormButton.swift`. One button for every form action, with a busy state that keeps its place.

```swift
enum FormActionKind { case primary, secondary, destructive, quiet }

struct FormButton: View {
    let title: String
    let busyTitle: String?
    let kind: FormActionKind
    let isBusy: Bool
    let disabledReason: String?
    let action: () -> Void
}
```

| Kind | Style | Role | Use |
|---|---|---|---|
| `primary` | `.borderedProminent` | none | Send Link, Sign In, Create, Rename, Switch…, Create Key |
| `secondary` | `.bordered` | `.cancel` when it cancels | Cancel, Send Again, Try Again, Use todz cloud (row), Record |
| `destructive` | `.borderedProminent` with `.tint(.red)` | `.destructive` | the typed-name Delete |
| `quiet` | `.link` | none | Use a Different Email, Sign Out, Use todz cloud (column), New Workspace |

- Busy: the label is the `CopyButton` pattern, a `ZStack` of the idle title at zero opacity (it holds the width) and an `HStack` of `ProgressView().controlSize(.small)` with `busyTitle`; the button is disabled with no reason and its accessibility label becomes `busyTitle`. Nothing around it moves (S3, N5, V2, K4).
- Disabled: `disabled(because: disabledReason)`, unchanged.
- The keyboard shortcut stays at the caller (`.defaultAction`, `.cancelAction`), as today.
- Size is the surface's, not the button's: the sign-in and onboarding columns set `.controlSize(.large)` once on the column; sheets and Settings stay `.regular`; Connect an Agent's row actions keep `.small`.
- On macOS 26 the system draws `.bordered` and `.borderedProminent` in the Liquid Glass control style, so the buttons pick up the new look with no availability branch. `.glassProminent` is option C (§ 6, O1).

### 2.6 `GlassSurface` (moved and generalised)

`MorningGlanceSurface` (`apps/macos/Todz/MorningGlance/MorningGlanceView.swift:27-35`) moves to `apps/macos/Todz/Shared/GlassSurface.swift` with its corner radius as a parameter; the morning glance passes its existing 18.

```swift
if #available(macOS 26.0, *) {
    content.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
}
content.background(.regularMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))   // macOS 14–15, the deployment target is 14.0
```

(The real body keeps `MorningGlanceSurface`'s `if #available { } else { }` shape, the one place Swift availability forces an `else`.) Used by the centred columns only: sign-in, first workspace, workspace picker. Never inside a sheet (macOS 26 already draws sheets in glass; glass on glass reads muddy) and never on scrolling content. Reduce Transparency turns both the glass and the material opaque through the system.

### 2.7 `FormPanel` (new)

`apps/macos/Todz/Shared/FormPanel.swift`. The centred card: `VStack` of the content, `.padding()` twice over (the default padding, scaled), `.modifier(GlassSurface(cornerRadius: panelCornerRadius))`, `.controlSize(.large)`, `.todzEntrance()`. Wraps the `CenteredColumn` content of the three centred screens; `CenteredColumn` itself does not change.

### 2.8 Sheet layout (no new view)

`NameSheet` and the typed-name sheet share one layout, written in each, not a component (two users, and #89 owns the second):

```
VStack(alignment: .leading) {
    title            .font(.title3).bold()      ← was .headline
    detail           .foregroundStyle(.secondary), only when the kind has one
    FormField        isLabelShown: true
    ValidationLine   the save failure, .issue
    HStack { Spacer(); Cancel (.secondary, .cancelAction); action (.primary or .destructive) }
}
.padding()
.frame(minWidth: sheetWidth)                    ← was width:, so it grows with text (N1)
```

## 3. Tokens

The repository has a colour and motion vocabulary but no spacing or radius tokens; `MorningGlanceView` keeps its 18 as a private literal. § 2 needs four values the set cannot express. **These are an owner decision (D2) before the plan**, never inline values. Proposed, all in one `FormMetrics` enum in `apps/macos/Todz/Shared/FormMetrics.swift`:

| Metric | Proposed | Why |
|---|---|---|
| `fieldCornerRadius` | 8, `.continuous` | Matches the radius macOS 26 draws on `.large` bordered controls, so field and button read as one family. |
| `panelCornerRadius` | 18 | The morning glance's radius; one panel radius in the app. |
| `fieldPadding` | horizontal 10, vertical 7, both `@ScaledMetric(relativeTo: .body)` | The height of a `.large` button at default text size, so a field and its button align in an `HStack` (the Server row); scales with text. |
| `ringWidth` | rest 1, focus and invalid 2, plus 1 under Increase Contrast | The system focus ring's weight. |

Colours: none added. Motion: `.snap` for ring, line and busy swaps, `.settle` for the sign-in column growing between stages, `todzEntrance()` for panels; all exist (ADR 0077).

## 4. States and copy

### 4.1 When a validation line shows

| Rule | Shows | Clears |
|---|---|---|
| Empty required field | never as a line; it is the primary button's disabled reason (tooltip and VoiceOver hint), as today | — |
| Name too long | live, as the owner types (`NameIssue.shown`, unchanged) | when the text fits |
| Email, identity, server address format | on submit only, as today | on the next edit of the field (new; today it waits for the next submit) |
| Server rule issue (name taken, refused) | after the save returns | on the next edit |
| Save or request failure | after the request returns, under the field, as `.issue` | on the next submit |

The field turns `invalid` exactly while a format or rule issue shows; a failure of the request (network, server) shows the line but leaves the field at `rest`, because the text was not the problem.

### 4.2 Copy that exists and is reused

`ErrorCopy.nameEmpty`, `ErrorCopy.nameTooLong`, `SignInCopy.emailFormat`, `emailRequired`, `identityFormat`, `identityRequired`, `sendingLink`, `signingIn`, `SettingsCopy.checkingServer`, `switchingServer`, `serverEmpty`, `serverInUse`, `serverBusy`, `KeyScreenCopy.creating`, `issueFailed`, `revokeFailed`, `SheetCopy.cancel`, `create`, `rename`, `WorkspaceShortcutsCopy.refusal(_:)`. None changes.

### 4.3 New copy, ready for the `*-copy.swift` files

| Key | File | Text |
|---|---|---|
| `SheetCopy.creating` | `apps/macos/Copy/SheetCopy.swift` | `Creating…` |
| `SheetCopy.renaming` | same | `Renaming…` |
| `SheetCopy.renameUnchanged` | same | `Type a new name to rename.` (the missing reason of N3) |
| `SheetCopy.newWorkspaceDetail` | same | `A workspace keeps its own projects and tasks.` |
| `SheetCopy.newProjectDetail` | same | `A project groups tasks, and agents connect to it with their own keys.` |
| `SettingsCopy.menuBarSection` | `apps/macos/Copy/SettingsCopy.swift` | `Menu Bar` (option T-A, § 6) |
| `SettingsCopy.yourDaySection` | same | `Your Day` |
| `SettingsCopy.agentsSection` | same | `Agents` |
| `SettingsCopy.appSection` | same | `App` |
| `WorkspaceShortcutsCopy.recordingHint` | `apps/macos/Copy/WorkspaceShortcutsCopy.swift` | `Press the new shortcut, or Esc to keep the old one.` |

Typed-name confirmation: **#89's copy stands.** If #89 leaves any of these open, use:

| Key | Text |
|---|---|
| title | `Delete “{name}”?` |
| detail | `This deletes its projects and every task in them, on every device. Agents with its keys lose access. This can't be undone.` |
| field label | `Type {name} to confirm` |
| mismatch reason (disabled Delete) | `Type the name exactly as shown.` |
| busy | `Deleting…` |

## 5. Screens, after

Widths are the existing ones (sign-in 280, onboarding 320, Settings 420); narrow width does not apply to the app's centred screens, which keep `CenteredColumn`'s minimum window of 760 × 480.

### 5.1 Sign-in (email stage)

```
┌──────────────── window background ────────────────┐
│          ╭──────────── glass panel ───────────╮   │
│          │              [icon]                │   │
│          │          Welcome to todz           │   │  .title bold
│          │  Your tasks, shared with your …    │   │  .secondary
│          │  ╭──────────────────────────────╮  │   │
│          │  │ Email                        │  │   │  FormField, ring per state
│          │  ╰──────────────────────────────╯  │   │
│          │  ⓘ Enter a valid email address.    │   │  ValidationLine .issue, after submit
│          │        [ security check ]          │   │
│          │  ┌──────────────────────────────┐  │   │
│          │  │          Send Link           │  │   │  .primary, .large; busy: ◌ Sending…
│          │  └──────────────────────────────┘  │   │
│          │  We'll email you a link. No …      │   │  .footnote .secondary
│          ╰────────────────────────────────────╯   │
│               Server: api.todz.app ›              │  ServerDisclosure, outside the panel
└───────────────────────────────────────────────────┘
```

- The primary button fills the panel's width (`.frame(maxWidth: .infinity)` on its label) in the centred columns only.
- The inbox stage: `Send Again` `.secondary`, `Use a Different Email` `.quiet`; the cooldown line stays `.footnote` `.secondary`.
- `SignInErrorLine` becomes a `ValidationLine(.issue)` over a `.secondary` `Try Again`.
- The Server disclosure stays outside the panel so the card holds only the sign-in; expanded, its `ServerAddressForm` (column layout) uses `FormField` and `FormButton` the same way.

### 5.2 Name sheet

```
╭───────────────── sheet (system glass on 26) ─────────────────╮
│ New Project                                                  │  .title3 bold
│ A project groups tasks, and agents connect to it with …      │  .secondary
│ Name                                                         │  .subheadline .secondary
│ ╭──────────────────────────────────────────────────────────╮ │
│ │ Groceries                                                │ │
│ ╰──────────────────────────────────────────────────────────╯ │
│ ⓘ That name is already taken.                                │  only when there is one
│                                         [ Cancel ] [Create]  │  busy: [◌ Creating…]
╰──────────────────────────────────────────────────────────────╯
```

`FirstWorkspaceScreen` uses the same field and button inside a `FormPanel`; `WorkspacePickerScreen`'s rows keep `.bordered` but drop the literal `4` for the default padding.

### 5.3 Typed-name confirmation

The § 5.2 layout with `destructive` as the action. `Delete` is disabled with the mismatch reason until the typed text matches #89's rule; Return in the field submits only when it matches; Cancel keeps `.cancelAction` and is **not** the default action, because typing the name is the guard, and no button carries `.defaultAction`.

### 5.4 Server field

Row layout (Settings): `FormField` (no visible label, the row's `Server` title is the label) and `FormButton(.primary, Switch…)` in an `HStack`, aligned by the shared padding metric; `Use todz cloud` stays at the trailing edge of the `Server` row, `.secondary` `.small`. Column layout (sign-in): field, `Switch…` `.primary`, `Use todz cloud` `.quiet`. One look per layout, chosen by the layout (V1). The status line is a `ValidationLine`: refusals `.issue`, `serverInUse` and `switched` `.note`.

### 5.5 Connect an Agent

`SecretNotice` and `CommandBlock` keep `.fill.quaternary` but on `RoundedRectangle(cornerRadius: fieldCornerRadius, style: .continuous)` (K1); no glass, it is scrolling content. `Revoke` becomes `Button(role: .destructive)` `.bordered` `.small`: the system tints its title red, the dialog behind it is unchanged (K2). `KeyScreenFailureLine` is deleted for `ValidationLine(.issue)` (K3). `Create Key` is a `FormButton(.primary)` with `busyTitle: KeyScreenCopy.creating` (K4).

### 5.6 Settings

- Sections (option T-A, § 6): `Menu Bar` (pending count, keep in menu bar, ribbon), `Your Day` (close the day, morning glance, day temperature, day email, respect Focus), `Agents` (agent nudge), `App` (automatic updates, usage sharing), then the existing Workspaces, Workspace Shortcuts, Server and open-source sections. **ADR 0092 overrides this grouping if it lands first.**
- `reservesSpace: true` stays only on the rows whose subtitle swaps at run time (agent nudge, day email, ribbon, respect Focus); the rest drop it (T2).
- A recording chord row draws its chord slot with `FieldChrome` in the `focused` state and shows `recordingHint` under it; the row's button reads `Cancel` as today (T3).
- The chord footnote is a `ValidationLine`: the Mission Control note `.note`, a refusal `.issue` (T4).

## 6. Options

### O1. How far the new look goes

| | A. Native, tuned | B. Native plus glass panel and drawn fields (**recommended**) | C. Full Liquid Glass |
|---|---|---|---|
| Fields | `.roundedBorder`, `.controlSize(.large)` in columns | `FormField` with `FieldChrome` | `FieldChrome` with `.glassEffect(.regular.interactive())` on each field |
| Buttons | `.borderedProminent` / `.bordered` | same as A | `.glassProminent` / `.glass` on 26, bordered fallback |
| Panels | none | one glass panel per centred screen | glass panels plus `GlassEffectContainer` morphing the button into the inbox state with `glassEffectID` |
| Invalid field | line only, field unchanged | red ring plus line | red ring plus line |
| New code | `ValidationLine`, `FormButton` | § 2 entire | § 2 plus availability branches in every button and field |
| Risk | lowest; looks like every Mac app | the drawn ring must match the system's under Increase Contrast and Full Keyboard Access | glass on glass inside panels, morph timing is the system's and cannot be held under ADR 0077's 350 ms, two looks to test on 14–15 vs 26 |
| "Sexy" | modest | clearly a product, still a Mac app | most striking on 26, plainest on 14–15 |

**Recommendation: B.** It delivers what the owner named (field styles, focus rings, inline validation, primary/secondary, spacing, a glass panel) with system styles doing the hard parts, one look across macOS 14–26, and no conflict with ADR 0077. A leaves the invalid field unmarked, which is the main gap today; C spends its effort on 26-only flourish and breaks the motion ceiling.

### O2. The sign-in field's label

A. Placeholder only, label spoken (**recommended**): the card stays clean; the field is alone, so its purpose is clear. B. Visible label above, as in sheets: consistent with sheets, but the centred card gets a left-aligned caption over a centred column.

### O3. The primary button's width in centred columns

A. Fills the panel (**recommended**): one strong target, the iOS and macOS 26 onboarding shape. B. Intrinsic width, as today: quieter, but reads as an afterthought under a full-width field.

### O4. Confirm dialogs

A. Leave `confirmationDialog` as is (**recommended**): native, already correct, already glass on 26. B. Replace with custom sheets for one look with the typed-name sheet: more code, loses the system's alert behaviour and VoiceOver shape.

### O5. Settings grouping (T-A)

A. Four labelled sections as in § 5.6 (**recommended**, unless ADR 0092 decides). B. Keep one group, fix only the reserved space: smaller change, the long list stays.

## 7. Build order

One surface per commit, each with its red-first unit tests where there is logic and its before/after captures (light and dark, default and Increase Contrast) by the `recorder` with Orca. Every step is shippable alone; a later step never edits an earlier step's surface.

1. **Foundation.** `FieldState` in TodzKit with `FieldStateTests` (red first: the sixteen combinations and the precedence); `FormMetrics` (after D2), `FieldChrome`, `FormField`, `ValidationLine`, `FormButton`, `GlassSurface` (moved from `MorningGlanceView`, which then uses it), `FormPanel`. No surface changes yet except the morning glance, which must look identical.
2. **Name sheet.** `NameSheet` onto the components; `renameUnchanged` replaces the bare `.disabled(isUnchanged)`; `minWidth`. Then `FirstWorkspaceScreen` and `WorkspacePickerScreen` inside `FormPanel`.
3. **Typed-name confirmation**, after #89 merges: its sheet onto § 2.8 with `destructive`. Rule and copy unchanged.
4. **Sign-in**, after #96 merges: `CredentialSlot`, `AddressSlot`, `InboxSlot`, `SignInErrorLine`, then `SignInScreen` in `FormPanel`.
5. **Server field**: `ServerAddressForm` both layouts; its `announceStatus` removed for `ValidationLine`'s.
6. **Settings**: sections (per ADR 0092 if it has landed, else O5), reserved space, chord recording state, the footnote line.
7. **Connect an Agent**: rounded blocks, destructive Revoke, `ValidationLine` for `KeyScreenFailureLine` (deleted), `Create Key` busy.

Tests beyond step 1: `ValidationTone` has no logic to pin; the typed-name match is #89's and keeps its tests. Every step's walk checks, by hand: focus order, Return and Esc, the busy state not moving the layout, the line announced once by VoiceOver, Reduce Motion crossfading, Increase Contrast rings, Reduce Transparency making the panel opaque, dark mode.

## 8. Interaction and accessibility

**Focus order.**
- Sign-in, email stage: email field (focused on appear, as today) → security check → Send Link → Server disclosure. Inbox stage: security check → Send Again → Use a Different Email → Server disclosure.
- Name sheet and typed-name sheet: field (focused on appear) → Cancel → action. Return submits from the field when the action is enabled; Esc cancels.
- Settings: system order of the grouped `Form`; the Server field → Switch… → Use todz cloud.
- Connect an Agent: unchanged.

**What each control announces.**
- `FormField`: its label, its value, and while invalid the issue as its hint.
- `ValidationLine`: its text once on appear and once per change, both tones; the symbol is hidden from VoiceOver (the `Label` reads its title only).
- `FormButton`: its title; busy, its busy title and the system's progress trait; disabled, the reason as its hint and tooltip (`disabled(because:)`).
- Destructive buttons carry `role: .destructive`, which VoiceOver reads.

**Disabled reasons.** Every disabled action has one: the existing ones, plus `renameUnchanged` and the typed-name mismatch. Busy buttons are disabled without a reason; their label already says why.

**Motion.** Ring, line and busy swaps: `.snap` (200 ms). Sign-in stage growth: `.settle` (320 ms). Panels: `todzEntrance()`. Under Reduce Motion every one becomes the `crossfade` token through `MotionRule`; no view reads the setting itself. No shake on invalid.

**Contrast.** All text is `.primary`, `.secondary` or `.red` on window background, `.fill.quaternary`, glass or `.regularMaterial`; these are system colours over system surfaces and adapt to dark mode, Increase Contrast and Reduce Transparency. Two pairs need the recorder to measure from the captures, because glass takes its tint from whatever is behind the window: `.red` `.subheadline` on the glass panel (target 4.5:1) and `.secondary` `.footnote` on the glass panel (target 4.5:1). If either fails at default contrast, it is an owner question (D3), never a hand-picked colour. Rings meet 3:1 against `.fill.quaternary` by being the accent, `.red` or, under Increase Contrast, `.secondary`.

## 9. Owner decisions

Answered 2026-11-26 by the loop, under the owner's instruction to decide every call ([ADR 0104](../../adr/0104-forms-share-one-drawn-field-language-on-native-buttons-and-a-glass-panel.md)).

- D1 (O1): B, native plus a glass panel and drawn fields.
- D2 (§ 3): the four `FormMetrics` values as written in § 3.
- D3 (§ 8): if a glass-panel contrast pair fails, that screen's panel uses `.regularMaterial` instead of glass; no colour is hand-picked.
- D4 (O2, O3, O4, O5): O2 A (placeholder, label spoken), O3 A (the primary button fills the panel), O4 A (the confirmation dialogs stay), O5 the Settings sections as ADR 0092 already shipped them, so § 5.6's regrouping and the reserved-space change (T1, T2) are dropped.
- Moving ground resolved: PR #89 and PR #96 are on `main`, so the typed-name confirmation is `DeleteConfirmSheet` and § 7 steps 3 and 4 run now.
