# Design: agent-nudge

**Sources:** [the spec](spec.md), [ADR 0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md), [the menu bar count design](../menu-bar-count/design.md) (§ 1.2 the Settings window, § 3 tokens, O5, O7, O8), and the current code: `SettingsView` (one grouped `Form`, one `.switch` `Toggle` with a title and a subtitle `Text`), `SettingsCopy`, `TodzApp` (`Settings { SettingsView().frame(width: settingsWidth) }`, 420, `.contentSize`), `AppModel` (`isOwnerConfirmed`, `isOffline`, `confirmOwner` through `PATCH /owner`), `ErrorCopy`, `mcp-format.ts` (`nextAnswer`, `nextPromptText`, `paragraphs`), `mcp-copy.ts`.
**Design system:** unchanged. System materials, semantic colours, text styles, the one accent. No token is added.
**Screenshots:** none taken. The Settings window is native and the second surface is MCP text; Playwright MCP drives a browser and captures neither. The `recorder` takes the captures of § 6 from the built app and an agent session into `.pr-media/agent-nudge/design/`.

## 1. Screens and states

Two surfaces change: the Settings window gains a second row; the `next` prompt and tool gain an opening line. The menu bar, the popover, the main window, the widgets and every other MCP tool do not change.

### 1.1 Settings window

```
┌──────────────── todz Settings ────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ Show pending count in the menu bar   [●━] │ │
│ │ Today's open tasks in the active          │ │
│ │ workspace. Hidden when none are left.     │ │
│ │───────────────────────────────────────────│ │
│ │ Let agents mention today's tasks     [━○] │ │
│ │ When an agent asks what's next, it hears  │ │
│ │ what's due today in its project.          │ │
│ └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

- The same grouped `Form`, a second `Toggle` with a title and a subtitle `Text`, `.toggleStyle(.switch)`, in the same section (option O1). The window keeps `settingsWidth` 420 and `.contentSize`; the height grows by one row and stays fixed while the row's state changes, because a state swaps the subtitle's text in place instead of adding a line (option O2).
- The value is the server's: `Owner.agentNudge` from the owner's confirmation (`PATCH /owner`) and `GET /owner`, held by `AppModel`, never in `@AppStorage`. The last known value lives in memory for the session; it is cleared on sign-out.
- No narrow layout: the window has one width. Light and dark are the form's system materials; nothing is tinted by hand.

| State | When | Switch | Subtitle | VoiceOver |
|---|---|---|---|---|
| Unknown, signed out | `signedOut` | off, disabled | `agentNudgeSignedOut` | "Let agents mention today's tasks, switch, off, dimmed", then the subtitle |
| Unknown, confirming | signed in, `isOwnerConfirmed` false, no value yet | off, disabled | `agentNudgeDetail` | as above |
| Unknown, offline | `isOffline`, no value since launch | off, disabled | `agentNudgeOffline` | as above |
| Offline, known | `isOffline`, a value seen this session | last known, disabled | `agentNudgeOffline` | "…, on, dimmed" or "…, off, dimmed" |
| Ready | confirmed, online | the server value, enabled | `agentNudgeDetail` | "…, switch, on" or "off" |
| Saving | a `PATCH /owner {agent_nudge}` in flight | the new value at once, disabled until the answer (option O3) | `agentNudgeDetail` | the new value; no announcement |
| Saved | 200 with the owner | the answer's value, enabled | `agentNudgeDetail` | nothing extra |
| Save failed | network error, 5xx, 400 (an older server after rollback) | back to the value before the flip, enabled | `ErrorCopy.changeNotSaved` until the next flip or the window closes (option O4) | the announcement "Your change wasn't saved." |
| Signed out mid-save | the session ends while in flight | the answer is dropped; Unknown, signed out | `agentNudgeSignedOut` | — |

No write is queued offline (spec, Failure handling). A 401 during the save goes the app's usual way (sign-out), not through the row.

### 1.2 The agent's `next`

Flag on and at least one open task due today or overdue in the key's project: the `next` tool answer and the `next` prompt text start with the nudge line, a blank line (`paragraphs`), then today's answer unchanged byte for byte.

```
Today here: 2 due (1 overdue). Start with T-12?

<today's next tool answer, or the next prompt text>
```

| Case | Output |
|---|---|
| Flag off | today's answer, unchanged |
| Flag on, nothing due today or overdue | today's answer, unchanged |
| Flag on, `dueNow` fails | today's answer, unchanged |
| Flag on, something due | the line, a blank line, today's answer |

The line carries counts and a short id only: no title, no notes, no project name. `T-12` is `first` from `dueNow`, formatted by `formatShortId`, the task `next` itself picks.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `SettingsView` | `Todz/Settings` | a second `Toggle` bound to the model's agent nudge state; reads the model from the environment |
| `TodzApp` | app | `.environment(model)` on `SettingsView`; the width constant unchanged |
| `SettingsCopy` | `Copy` | § 8 |
| `AppModel` (+ a new state enum if the developer needs one, under `TodzKit`) | `TodzKit` | the value, whether it is known, in flight or failed; the flip with revert |
| `MCP_COPY.agentNudge` | `apps/api/src/mcp-copy.ts` | § 8 |
| `nextAnswer`, `nextPromptText` | `apps/api/src/mcp-format.ts` | an optional nudge line joined by `paragraphs` |

**Verify in a build** (macOS 14): the grouped form draws the row divider and both subtitles; the subtitle swap does not resize the window when both texts wrap to the same line count at 420; `.disabled` dims title and subtitle together; the announcement is heard while Settings is key.

## 3. Tokens

| Use | Token |
|---|---|
| Section, background | the grouped `Form`'s system materials |
| Toggle title | `.primary`, `Font.body` |
| Subtitle, every state, failure included | `.secondary`, the form's subtitle style (option O4) |
| Switch on | `Color.accentColor` = `#2F5BFF` |
| Disabled | the system's dimming; no opacity set |
| Width | `settingsWidth` 420, unchanged |

## 4. Copy

New strings in § 8. Reused: `ErrorCopy.changeNotSaved` "Your change wasn't saved." for the failed save, as the main window's banner says it. The MCP line needs no inflection: "1 due", "3 due", "1 overdue" read the same in the singular and the plural.

## 5. Interaction and accessibility

- **Keyboard:** ⌘, opens Settings as today. With Full Keyboard Access, Tab moves from the first switch to the second; Space flips it. A disabled switch is skipped by Tab. Nothing has focus when the window opens.
- **VoiceOver:** the toggle's label is the title, its value on or off, its description the subtitle (if the grouped form does not read the second `Text`, it becomes `.accessibilityHint`, as the menu bar count decided). A disabled switch reads "dimmed" and the subtitle gives the reason. A failed save posts `AccessibilityNotification.Announcement` with `ErrorCopy.changeNotSaved`, since the switch moving back alone is silent.
- **Motion:** the system switch animation, both on the flip and on the revert; Reduce Motion is the system's.
- **Contrast:** text is `.primary` and `.secondary` on the form's material, the system's guarantee in light, dark and Increase Contrast. The switch's state is its knob position, not the accent alone; the failure is said in words, not colour.

## 6. Options

Captures from the built app into `.pr-media/agent-nudge/design/`, light and dark: `settings-off.png`, `settings-on.png`, `settings-signed-out.png`, `settings-offline.png`, `settings-failed.png`; from a Claude Code session: `next-tool-nudge.png`, `next-prompt-nudge.png`, `next-flag-off.png`; one annotated copy per option (`o1-…png` to `o5-…png`).

**O1. One section or two**
- A. One section, two rows. The window stays one compact group; the subtitle says where the setting lives.
- B. Two sections, "This Mac" and "Your account" headers. States the scope, but two headers of copy for two controls.
- **Recommendation: A.**

**O2. Where a disabled reason shows**
- A. In place of the subtitle. One place to read, the window height steady.
- B. A section footer that appears when needed. Keeps the explanation, but the window jumps in height with `.contentSize`.
- C. A `.help` tooltip only. Invisible until hovered, unread by many.
- **Recommendation: A.**

**O3. Flip while saving**
- A. Optimistic: the switch moves at once and is disabled until the answer. Feels instant; no double write.
- B. Wait: a small `ProgressView` beside the switch, the switch moves on success. Honest, but a spinner for a sub-second write, and the row's width changes.
- **Recommendation: A.**

**O4. How the failed save is said**
- A. The switch reverts, the subtitle reads "Your change wasn't saved." in `.secondary`, plus the VoiceOver announcement. Calm, reuses existing copy.
- B. The same in `.red`. Louder, but no other Settings text is coloured and red has no token here.
- C. An alert. Blocks for a reversible preference.
- **Recommendation: A.**

**O5. The MCP line**
- A. "Today here: 2 due (1 overdue). Start with T-12?" The spec's wording; short.
- B. "Due today in this project: 2 (1 overdue). Start with T-12?" Plainer, eight characters longer, and the spec changes.
- **Recommendation: A**, with the all-overdue case reading "Today here: 2 overdue." rather than "2 due (2 overdue)".

**Minor calls** (reversible)

| Call | Choice |
|---|---|
| Last known value across launches | not persisted; unknown until confirmed |
| Failure text lifetime | until the next flip or the window closes |
| Success feedback | none beyond the switch |

## 7. Owner decisions

Empty when written; the lead records each answer here before the plan.

| Option | Answer | Date |
|---|---|---|

## 8. Every new copy string

**SettingsCopy** (`apps/macos/Copy/SettingsCopy.swift`): agentNudge "Let agents mention today's tasks" · agentNudgeDetail "When an agent asks what's next, it hears what's due today in its project." · agentNudgeOffline "Can't reach todz. You can change this when it's back." · agentNudgeSignedOut "Sign in to change this."

**MCP_COPY** (`apps/api/src/mcp-copy.ts`): agentNudge({ count, overdue, taskId })

| count | overdue | Line |
|---|---|---|
| 1 | 0 | `Today here: 1 due. Start with T-12?` |
| N | 0 | `Today here: 3 due. Start with T-12?` |
| N | M, 0 < M < N | `Today here: 3 due (1 overdue). Start with T-12?` |
| N | N (all overdue, 1 included) | `Today here: 2 overdue. Start with T-12?` · `Today here: 1 overdue. Start with T-12?` |
