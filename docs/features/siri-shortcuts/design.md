# Design: siri-shortcuts

**Sources:** [the spec](spec.md), [ADR 0066](../../adr/0066-siri-and-shortcuts-run-three-app-intents-in-the-app-over-its-one-model.md), [the morning-glance design](../morning-glance/design.md) (§ 1.1 rows, § 5 accessibility), and the current code: `MorningGlanceView` (heading `MainWindowCopy.today` in `.headline` with `MenuBarCopy.left(count:)` in `.secondary`, rows with a `circle`, one line, tail truncated, `MorningGlanceCopy.overdue` in red, `MorningGlanceCopy.more(count:)`), `ToggleTaskIntent` and `TodzFocusFilter` (literal titles at the declaration, a `displayRepresentation` from copy), `MenuBarCopy.dayClosedBody` ("Nothing left for today."), `ErrorCopy` and `RuleIssue+Copy` (the title rules), `AccessibilityCopy.morningGlance(count:)`.
**Design system:** unchanged. Siri, the Shortcuts app and Spotlight draw their own surfaces, type and buttons; todz supplies words, one snippet view drawn with semantic colours and system text styles, and SF Symbols for the three shortcuts. No colour, font or token is added.
**Screenshots:** none taken while designing. Playwright MCP cannot see Siri or the Shortcuts app. The `recorder` takes the captures of § 6 with Orca from the walk's single Shortcuts window session (test plan), into `.pr-media/siri-shortcuts/design/`.

## 1. Surfaces and states

Nothing inside todz's own windows changes. Four system surfaces show todz's words: the Shortcuts app's list of todz's shortcuts, Spotlight's actions, Siri's answer, and the result a shortcut run shows. The snippet below is the one view todz draws.

### 1.1 What's left today

```
Siri / Shortcuts result
┌───────────────────────────────────────────────┐
│ 7 left today in Logic Bit.                    │ ← the dialog (supporting text when the snippet shows)
│ ┌───────────────────────────────────────────┐ │
│ │ Today  7 left                             │ │ ← snippet: TodayDigest
│ │ Logic Bit                                 │ │   workspace name, .secondary
│ │ ○ Send the invoice to Ana        Overdue  │ │
│ │ ○ Review the onboarding copy              │ │
│ │ ○ Reply to the landlord                   │ │
│ │ ○ Book the dentist                        │ │
│ │ ○ Draft the release notes for the 0.2…    │ │
│ │ +2 more                                   │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
Spoken (Siri can only speak, or the system shows no snippet):
"7 left today in Logic Bit. The first three: Send the invoice to Ana, Review the onboarding copy, and Reply to the landlord."
```

| State | When | Dialog (full / supporting) | Snippet |
|---|---|---|---|
| Empty | Today has nothing open | `nothingLeft` / the same | `MenuBarCopy.dayClosedBody` under the heading |
| One | 1 open | `leftWithTitles` with its title / `left` | heading, the row |
| Few | 2 or 3 open | `leftWithTitles` with every title / `left` | heading, the rows |
| Many | 4 or more open | `leftWithFirstTitles` with the first three / `left` | heading, five rows, `+N more` past five |
| Overdue | a task due before today | as above; the word is not spoken | the row ends `Overdue` in red |
| Long title | wider than the row | spoken whole | one line, tail truncated |
| Emoji | an emoji in a title | spoken as the system reads it | drawn as typed |
| Offline | the server unreachable, a cache | each dialog ends with `offline` | the same rows from the cache |
| Signed out, no workspace, still loading | readiness is not `ready` | the refusal of § 1.4 | none |

The returned value is every open Today task as a `TodzTaskEntity`, title and project name, in Today's order.

### 1.2 Add a task

```
"Add a task to todz"  →  Siri: "What's the task?"  →  "Book the dentist"
                       →  Siri: "Added “Book the dentist” to Today in Logic Bit."
```

| State | Dialog |
|---|---|
| Added, due today (default) | `added(title:, destination: .today, workspaceName:)` |
| Added, `Due Today` off (Shortcuts editor only) | `added(title:, destination: .inbox, workspaceName:)` |
| Added offline | the same, then `syncsLater` |
| Blank title | refusal `ErrorCopy.titleEmpty` |
| Over 200 characters | refusal `ErrorCopy.titleTooLong` |
| Signed out, no workspace, still loading | § 1.4 |

No snippet: the sentence says everything. The returned value is the title as saved.

### 1.3 Complete a task

```
"Complete a task in todz"  →  Siri: "Which task?"  + the list of Today's open tasks (title, project)
                           →  "the dentist"  →  one match  →  "Done: “Book the dentist”."
                                             →  two matches →  the system asks which one
```

| State | Dialog |
|---|---|
| Completed | `completed(title:)` |
| Completed offline | `completed(title:)`, then `syncsLater` |
| Already done (done elsewhere meanwhile, or a saved shortcut) | `alreadyDone(title:)` |
| Gone or in another workspace | `taskGone` |
| Today empty | the system shows an empty list and asks again; nothing completes |
| No match | the system's own answer; nothing completes |
| Signed out, no workspace, still loading | § 1.4 |

The list Siri and the Shortcuts editor show is each task's `displayRepresentation`: the title, and the project name as the subtitle.

### 1.4 Refusals

Thrown as errors, so Siri speaks them and a shortcut stops at that action: `signedOut`, `noWorkspace`, `loading`, and the title rules' `ErrorCopy` strings.

### 1.5 The Shortcuts app and Spotlight

In the Debug build the app is named `Todz Dev` (ADR 0066 §10), so its tiles sit under that name and its phrases end `in Todz Dev`. Three tiles under todz, in this order: What's Left Today (`checklist`), Add a Task (`plus.circle`), Complete a Task (`checkmark.circle`). The tile colour stays the system default (O7).

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `TodayDigest` (new, extracted) | `Todz/Shared` | the heading with the count, an optional subtitle, up to five rows with the overdue word, the rest line, the empty line; `MorningGlanceView` and the snippet both draw it |
| `MorningGlanceView` | `Todz/MorningGlance` | draws `TodayDigest` inside its glass; nothing on screen changes |
| `LeftTodaySnippet` (new) | `Todz/Shortcuts` | `TodayDigest` with the workspace name as subtitle, padded, on no background of its own (the system draws the platter); one accessibility element |
| `TodzTaskEntity`, `TodzTaskQuery`, `LeftTodayIntent`, `AddTaskIntent`, `CompleteTaskIntent`, `TodzShortcuts`, `ShortcutRefusal` (new) | `Todz/Shortcuts` | the system surfaces' words and symbols |
| `ShortcutsCopy` (new) | `Copy` | § 8 |

## 3. Tokens

None new. The snippet uses the glance's text styles: heading `Font.headline` `.primary`, count and subtitle `.secondary`, rows `Font.body`, the circle `.secondary`, overdue `Color.red`, rest and empty lines `Font.subheadline` `.secondary`; the system's `padding()`. Its width is the system's; it never sets one. Rows shown: 5 (`MorningGlanceContent`'s limit); titles spoken: 3 (`ShortcutsCopy`'s, a copy decision); suggestions and matches: 10 (`ShortcutLimits.taskLimit`).

## 4. Copy

Every dialog and refusal is in § 8. Reused: `MainWindowCopy.today`, `MenuBarCopy.left(count:)`, `MenuBarCopy.dayClosedBody`, `MorningGlanceCopy.overdue`, `MorningGlanceCopy.more(count:)`, `ErrorCopy.titleEmpty`, `ErrorCopy.titleTooLong`, `AccessibilityCopy.morningGlance(count:)`. "todz" stays lower case in every sentence; the app's name in the phrases is the system's `\(.applicationName)`. Titles are wrapped in curly quotes. Lists use the system's list format (`formatted(.list(type: .and))`).

The static metadata stays literal at each declaration (ADR 0066 §8): the App Intents metadata processor reads it from the source.

| Declaration | Text |
|---|---|
| `LeftTodayIntent.title` / `description` | "What's Left Today" / "Tells what is left today in the active workspace of todz." |
| `AddTaskIntent.title` / `description` | "Add a Task" / "Adds a task to the Inbox of the active workspace of todz, due today unless Due Today is off." |
| `AddTaskIntent` parameters | "Title"; "Due Today", default on |
| `CompleteTaskIntent.title` / `description` | "Complete a Task" / "Completes an open task of the active workspace of todz." |
| `CompleteTaskIntent` parameter | "Task" |
| `TodzTaskEntity.typeDisplayRepresentation` | "Task" |
| Phrases, What's Left Today | "What's left today in \(.applicationName)", "What do I have today in \(.applicationName)" |
| Phrases, Add a Task | "Add a task to \(.applicationName)", "New task in \(.applicationName)" |
| Phrases, Complete a Task | "Complete a task in \(.applicationName)", "Check off a task in \(.applicationName)" |
| Short titles | "What's Left Today", "Add a Task", "Complete a Task" |

## 5. Interaction and accessibility

- **Voice first.** Every answer is a sentence that stands alone without the snippet: the count, the workspace, the titles. Siri may show neither the dialog nor the snippet (Apple's note in ADR 0066 Evidence), so the returned value and the dialog never depend on the snippet.
- **The parameters Siri asks for:** "What's the task?" for Add (a `String`, dictated), "Which task?" for Complete (an entity, with Today's open tasks as the list; the owner can say part of a title).
- **Keyboard:** Siri and Shortcuts own it; todz takes none. The app never comes to the front and never opens a window (`openAppWhenRun` false).
- **VoiceOver on the snippet:** one element, label `AccessibilityCopy.morningGlance(count:)` ("Today, 7 left"), value the shown titles joined with commas, no hint and no action (the snippet is not a control). The overdue word is part of the row's text, so it is read.
- **Contrast:** `.primary` and `.secondary` on the system's platter; overdue said in words, red repeats it. Increase Contrast and Reduce Transparency are the system's.
- **Motion:** none of todz's.

## 6. Options

Captures into `.pr-media/siri-shortcuts/design/` from the walk's single Shortcuts session, light: `shortcuts-list.png` (todz's three tiles), `left-today-result.png` (a run's dialog and snippet). README: `left-today-result.png` joins the walk as `docs/screenshots/siri-shortcuts/left-today.png` if ADR 0047's dozen cells allow it (the lead's call at Step 12; the list of tiles is a setup shot and stays in the PR).

**O1. What "what's left" shows**
- A. The dialog and a snippet of five rows (the glance's content). Readable at a glance in the Shortcuts app; the voice answer still stands alone.
- B. The dialog only. Simplest; the Shortcuts app shows one sentence.
- **Recommendation: A.**

**O2. How many titles Siri speaks**
- A. Up to three, then the count says the rest. Short enough to listen to.
- B. Every title. Complete; a long Today becomes a minute of speech.
- C. None, only the count. Quickest; says nothing about which tasks.
- **Recommendation: A.**

**O3. Where "add" puts the task**
- A. Today in the Inbox, as the menu bar's Add field, with a `Due Today` switch in the editor. "What's left" then includes it.
- B. The Inbox with no date. Plain capture; it vanishes from "what's left".
- **Recommendation: A.**

**O4. Which tasks "complete" offers and finds**
- A. Offers Today's open tasks; finds any open task of the active workspace. A short list to pick from; an undated Inbox task is still reachable by name.
- B. Today only. Smallest; "complete buy milk" fails when it has no date.
- **Recommendation: A.**

**O5. Confirming a completion**
- A. No confirmation; the answer names the task. One click undoes it in the app.
- B. "Complete “Book the dentist”?" first. Safer; a second turn for every completion.
- **Recommendation: A.**

**O6. Phrase variants**
- A. Two per shortcut (§ 4). Covers the natural wording; few false matches.
- B. One each. Fewest; Siri misses "check off".
- **Recommendation: A.**

**O7. The tile colour**
- A. The system default. No new colour decision.
- B. A `ShortcutTileColor` near the cobalt accent. On brand; a design-system choice for the owner.
- **Recommendation: A.**

## 7. Owner decisions

| Option | Answer | Date |
|---|---|---|
| O1–O7 | each one's recommendation in § 6, the build loop's call (the owner may overturn it) | 2026-11-25 |

## 8. Every new copy string

**ShortcutsCopy** (`apps/macos/Copy/ShortcutsCopy.swift`, new): it only maps `ShortcutTodaySentence` (`nothingLeft`, `withTitles`, `withFirstTitles`, chosen and tested in `TodzKit` with the titles to speak) to the strings below, and names no type of `Todz/Shortcuts/`, because `Copy/` is compiled into the widget extension too.

- askTitle "What's the task?" · askTask "Which task?"
- nothingLeft(workspaceName:) "Nothing left today in \(workspaceName)."
- left(count:workspaceName:) `InflectedCopy.text("\(count) left today in \(workspaceName).")`
- leftWithTitles(count:workspaceName:titles:) `InflectedCopy.text("\(count) left today in \(workspaceName): \(titles).")`, for up to three
- leftWithFirstTitles(count:workspaceName:titles:) `InflectedCopy.text("\(count) left today in \(workspaceName). The first three: \(titles).")`
- offline "todz is offline, so this is the last synced list."
- added(title:destination:workspaceName:) "Added “\(title)” to Today in \(workspaceName)." for `.today`; "Added “\(title)” to the Inbox in \(workspaceName)." for `.inbox`
- syncsLater "It syncs when todz is back online."
- completed(title:) "Done: “\(title)”."
- alreadyDone(title:) "“\(title)” is already done."
- taskGone "That task is no longer in this workspace."
- signedOut "Sign in to todz first."
- noWorkspace "Name your first workspace in todz first."
- loading "todz is still loading Today. Try again in a moment."
