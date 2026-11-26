# Design: sidebar-new-project

The owner, 2026-11-26: "new project também ficou difícil de enxergar… ajusta com cautela, com frontend-designer, de forma sexy".

## 0. What is on screen today

`ProjectsHeader` (`apps/macos/Todz/MainWindow/Sidebar/ProjectsHeader.swift`) puts a borderless `plus` in the Projects section header at `.opacity(0)` and shows it only while the pointer is over the header. At rest the sidebar offers no way to create a project: the README shot `docs/screenshots/mac-app-shell/03-today-two-projects.png` and `docs/screenshots/connect-an-agent/01-key-screen.png` show "Projects" with nothing beside it. When it does appear, the glyph is the header's small size in the header's `.secondary`, a 9 pt mark on a 20 pt line. The only other path is File ▸ New Project… (⇧⌘N, `AppCommands.swift:30`); the empty Projects section shows its header alone.

"New Workspace…" lives in the workspace switcher's menu (`WorkspaceSwitcher.swift:38`) and in the File menu. It is found through the switcher's chevron, which is always visible; it is not part of this problem.

No capture of the live app was taken: the native window is not reachable by Playwright, and walking it with computer use pops todz in front of the owner's work. The two README shots above are the "today" record; the developer's walk captures the after shots (§ 8).

## 1. Screens and states

One screen changes: the main window's sidebar. Every state below is the sidebar at its ideal width (224) and at its minimum (180).

| State | What shows |
|---|---|
| Rest | The affordance of the chosen option, always visible, label in `.secondary`, glyph in the accent |
| Hover | Label to `.primary`; glyph unchanged |
| Pressed | The system borderless press dimming; no custom value |
| Focus (Full Keyboard Access on) | The system focus ring around the button; Tab reaches it after Connect an Agent |
| Empty Projects section | The header "Projects" and the affordance; nothing else |
| Overloaded (30 projects, long names, several workspaces tagged "Acme · Launch") | Rows truncate at the tail as today; the affordance never moves with the scroll (option C) |
| Disabled | Same rule as the File menu item: `!model.isReady`. The sidebar only exists in the ready phase, so in practice it is never disabled; signed out shows the sign-in screen, with no sidebar |
| Offline | Enabled, as the menu item is today. The sheet opens; Create fails into the sheet's inline network error (existing `NameSheet` path). No new offline rule |
| Several workspaces shown | Enabled; the help tag and the VoiceOver hint name the workspace that receives the project, because `createProject` writes to the active workspace while the sidebar lists several |

## 2. Options

### Option A: the header `+`, always visible

```
 Acme ⌄
 ⎕ Inbox            3
 ☆ Today            4
 ▦ Upcoming         2
 ✓ Done

 Projects          (+)      <- plus.circle.fill, accent, always shown
   Launch           5
   Roadmap

 ⏻ Connect an Agent
```

- Change: drop the hover opacity in `ProjectsHeader`; the glyph becomes `plus.circle.fill` in `Color.accentColor`, `.imageScale(.medium)`, a 20 × 20 hit area through `.contentShape(.rect)`.
- For: the smallest diff; the `+` sits on the section it adds to.
- Against: still a lone glyph with no word; the header's type size keeps it small; the macOS 26 section header shows its own "Show/Hide" affordance on hover in collapsible sections, which this one would crowd if the section ever becomes collapsible. Discoverable, but not obvious.

### Option B: a "New Project" row, last in the Projects section

```
 Projects
   Launch           5
   Roadmap
   ⊕ New Project            <- a List row with no tag, .secondary label
                                 
 ⏻ Connect an Agent
```

- Change: a `Button` row after the `ForEach` of `ProjectRow`, `Label(…, systemImage: "plus.circle.fill")`, no `.tag`, so the selection never lands on it.
- For: read as part of the projects; the empty section reads "⊕ New Project" at once.
- Against: a row inside a selectable `List` that is not selectable: arrow keys skip it, click behaviour inside `List(selection:)` rows varies across macOS 14 and 26, and it sits in the subtree the selection re-renders (see `docs/learnings/2026-11-24-a-swiftui-subtree-that-reads-the-selection-itself-renders-once-more-with-the-new-item.md`). With 30 projects it scrolls out of view.

### Option C (recommended): a sidebar footer, the Reminders and Notes pattern

```
 light, ideal width 224                  dark
 ┌────────────────────────────┐          ┌────────────────────────────┐
 │ Acme ⌄                     │          │ Acme ⌄                     │
 │ ⎕ Inbox                 3  │          │ ⎕ Inbox                 3  │
 │ ☆ Today                 4  │          │ ☆ Today                 4  │
 │ ▦ Upcoming              2  │          │ ▦ Upcoming              2  │
 │ ✓ Done                     │          │ ✓ Done                     │
 │ Projects                   │          │ Projects                   │
 │   Acme · Launch         5  │          │   Acme · Launch         5  │
 │   Beta · Roadmap           │          │   Beta · Roadmap           │
 │ ⏻ Connect an Agent         │          │ ⏻ Connect an Agent         │
 │                            │          │                            │
 │                            │          │                            │
 │ ● New Project              │          │ ● New Project              │
 └────────────────────────────┘          └────────────────────────────┘
   ● = plus.circle.fill in the accent; label .secondary, .primary on hover
   both on the sidebar's own material (Liquid Glass on macOS 26); no added fill
```

- Change: a `NewProjectButton` pinned under the list with `.safeAreaInset(edge: .bottom)`, the mirror of the `WorkspaceSwitcher` pinned above it with `.safeAreaInset(edge: .top)`. The header `+` goes away, so there is one affordance, not two.
- For: Apple's own pattern on macOS 26 (Reminders "Add List", Notes "New Folder", both a circled plus and a word at the foot of the glass sidebar); always visible whatever the scroll; a word, not a lone glyph; outside the `List`, so no selection, tag or row-height effect on the views, the projects, the multi-workspace tags, the badges or Connect an Agent; the sidebar's width rule is untouched ("● New Project" is about 105 pt; the narrowest sidebar leaves 148 pt inside the default padding).
- Against: further from the Projects header when the list is short; the label carries the link. Takes about 44 pt of height from the scrolling list at the bottom, as the switcher does at the top.

**Recommendation: C.** It is the most visible at rest without shouting (one accent glyph, a grey word), it is the platform's convention, and it touches no `List` mechanics.

## 3. Components (option C)

| Piece | Where | Note |
|---|---|---|
| `NewProjectButton` (new) | `apps/macos/Todz/MainWindow/Sidebar/NewProjectButton.swift` | Takes `workspace: Workspace` from `SidebarView`, as the switcher does |
| `SidebarView` | same folder | Adds `.safeAreaInset(edge: .bottom) { NewProjectButton(workspace: workspace) }` after the top inset; the Projects `Section` header becomes `Text(MainWindowCopy.projects)` |
| `ProjectsHeader` | same folder | Deleted: its only job was the hover `+` |
| `WorkspaceSwitcher` | `apps/macos/Todz/Shared` | Unchanged; "New Workspace…" stays in its menu and in File |

`NewProjectButton` building blocks, in order:

```
Button { windowState.sheet = .newProject } label: {
    Label {
        Text(MainWindowCopy.newProjectButton).foregroundStyle(isHovering ? .primary : .secondary)
    } icon: {
        Image(systemName: "plus.circle.fill").foregroundStyle(Color.accentColor)
    }
    .lineLimit(1)
}
.buttonStyle(.borderless)
.disabled(!model.isReady)
.help(MainWindowCopy.newProjectHelp(workspaceName: workspace.name))
.accessibilityHint(MainWindowCopy.newProjectHelp(workspaceName: workspace.name))
.frame(maxWidth: .infinity, alignment: .leading)
.contentShape(.rect)
.padding()
.onHover { isHovering = $0 }
.todzAnimation(.snap, value: isHovering)
```

- The symbol name sits in a file-top constant, as `addSymbol` does in `ProjectsHeader` today.
- `.padding()` with no value, the same as `WorkspaceSwitcher`, so header and footer share their inset and the footer's glyph lines up with the switcher's text and the view icons.
- Font: the system default of a `Label` in the sidebar (`.body`); no size is set.
- No background, no glass modifier: the sidebar column already is the glass on macOS 26 and `Material.sidebar` before it. A custom fill or `.buttonStyle(.glass)` would shout.
- `.contentShape(.rect)` after the frame makes the whole footer strip the click target, as in Reminders.

## 4. Tokens

| Use | Token |
|---|---|
| Glyph | `Color.accentColor` (the asset catalog's `AccentColor`, `#2F5BFF`) |
| Label at rest | `.secondary` |
| Label on hover | `.primary` |
| Background | none; the sidebar's material |
| Spacing | `.padding()` default, as `WorkspaceSwitcher` |
| Motion | `MotionToken.snap` through `todzAnimation`, the label's colour only |

No new token. Mint `#8CF7D0` is not used: on the light sidebar it is about 1.3:1, and ADR 0077 keeps it to the completion burst. The brand blue gradient `#4C6BFF → #1B2A9E` is a logo and DMG asset, not an app token; the app's accent stays the catalog colour.

## 5. Copy

`apps/macos/Copy/MainWindowCopy.swift`:

| Name | Value |
|---|---|
| `newProjectButton` | `New Project` |
| `newProjectHelp(workspaceName:)` | `Adds a project to {workspaceName}` |

- No ellipsis on the button, as Reminders' "Add List"; the menu item keeps `newProject` = "New Project…".
- `AccessibilityCopy.addProject` is removed: its only user was `ProjectsHeader`, and the button's visible label is now its accessible name.

## 6. Interaction and accessibility

**Shortcut check.** ⇧⌘N is already New Project… in the File menu (`AppCommands.swift:31`, `.keyboardShortcut(newKey, modifiers: [.command, .shift])`). Nothing else claims it: ⌘N is New Task, ⌘R Refresh, ⌥⌘I the inspector, ⌘⏎ and ⌥⌘↑↓ the Task menu, ⌃1…⌃9 and ⌃⌘[ ⌃⌘] the workspace chords (ADR 0079), and the popover uses its own keys inside its window. No change; the footer button does not repeat the shortcut (a menu owns it, and a second `.keyboardShortcut` would register twice). A user who rebinds a workspace chord to ⇧⌘N in Settings takes it globally; that is the rebinding's own conflict rule, not this feature's.

**Keyboard path.** ⇧⌘N from anywhere in the window. With Full Keyboard Access on, Tab moves switcher → list → New Project; Space presses it.

**VoiceOver.** "New Project, button. Adds a project to Acme." The label comes from the `Label`'s text; the hint names the target workspace, which matters when several are shown and tagged.

**Disabled reason.** Only `!model.isReady`, which never holds while the sidebar shows; no hint needed.

**Motion.** Only the label's colour change on hover, through `todzAnimation(.snap, value:)`; under Reduce Motion `MotionRule` turns it into the 150 ms crossfade (ADR 0077). No scale, bounce or symbol effect.

**Contrast** on the light sidebar (about `#F5F5F5`): accent glyph about 4.7:1 (passes 3:1 for a graphic); `.secondary` label about 3.7:1 at rest, the system's own secondary, raised by Increase Contrast; `.primary` on hover about 15:1. Dark sidebar (about `#2A2A2A`): the accent glyph is about 2.8:1, under 3:1, so the glyph is never the only cue: the word "New Project" carries the meaning and the glyph is decorative; `.secondary` label about 4.6:1. A dark variant of `AccentColor` would lift the glyph and is an owner decision (open question 2), not part of this change.

## 7. Open choices

1. **Option A, B or C.** Recommended C (§ 2).
2. **A dark-appearance variant of `AccentColor`.** Not proposed here: it changes every accent use (checkbox, selection, ring, widgets). Recommended: leave for a token change of its own.

## 8. Tests the developer adds

There is no test target for the app's views (`docs/learnings/2026-11-24-a-swiftui-subtree-that-reads-the-selection-itself-renders-once-more-with-the-new-item.md`), so the shape is pinned by `tools/repository-shape` the way `open-source-surfaces.test.ts` pins `StarRepositoryButton`. New file `tools/repository-shape/src/sidebar-new-project.test.ts`, red first:

- `MainWindowCopy.newProjectButton` is "New Project" (`swiftCopyValue`).
- `SidebarView.swift` contains `.safeAreaInset(edge: .bottom)` and `NewProjectButton(workspace: workspace)`, and no longer contains `ProjectsHeader()`.
- `NewProjectButton.swift` contains `windowState.sheet = .newProject`, `.help(MainWindowCopy.newProjectHelp(` and `.accessibilityHint(`, and contains no `.opacity(` (the affordance is never hidden).
- `apps/macos/Todz/MainWindow/Sidebar/ProjectsHeader.swift` does not exist.
- `AppCommands.swift` still binds New Project to `.keyboardShortcut(newKey, modifiers: [.command, .shift])`.

The walk, recorded for the PR into `.pr-media/sidebar-new-project/` (few, short openings of the window; never the popover):

1. Light, window focused, one workspace, two projects: the footer at rest. `01-rest-light.png`.
2. The same with the pointer on the footer: label in `.primary`. `02-hover-light.png`.
3. Dark, same layout. `03-rest-dark.png`.
4. All Workspaces shown, tagged rows "Acme · Launch", badges on: nothing shifts; hover shows the help tag naming the active workspace. `04-several-workspaces.png`.
5. An empty Projects section: header and footer only. `05-empty-projects.png`.
6. Sidebar dragged to its 180 minimum: the label fits on one line. `06-narrow.png`.
7. Fifteen projects: the list scrolls; the footer and Connect an Agent stay reachable. `07-overloaded.png`.
8. Click the footer and press ⇧⌘N: each opens the New Project sheet; Create selects the new project.
9. Reduce Motion on: hover crossfades. VoiceOver reads "New Project, button" and the hint.

## 9. Owner decisions

1. **Option C**, the sidebar footer: the loop's pick, 2026-11-26, under the owner's standing instruction to decide every call (2026-11-24) and his words "ajusta com cautela … de forma sexy".
2. **No dark variant of `AccentColor`** in this change: deferred to v1.1 as its own token change (`plan.md` → Deferred).
