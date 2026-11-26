# Test plan: Sidebar new project

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

The surface is native macOS: there is no browser surface, so there is no Playwright E2E spec and no Playwright MCP walk. There is no test target for the app's views, so the shape is pinned by `tools/repository-shape`, and the sidebar is seen through in-process renders (an `NSHostingView` with its `appearance` set, drawn with `cacheDisplay(in:to:)`) of the shipped views in a scratch harness outside the repository. No synthetic keystroke, mouse event or Accessibility automation is sent, and the owner's todz is never opened: the hover state, the click, ⇧⌘N, VoiceOver and Reduce Motion are Human checklist rows.

## The failing test first

- [ ] `tools/repository-shape/src/sidebar-new-project.test.ts::the copy names the button New Project` — input: `apps/macos/Copy/MainWindowCopy.swift`; expected: `newProjectButton` is `New Project`
- [ ] Confirmed it fails for the right reason: the red run printed the failure text recorded here

## Unit

- [ ] `sidebar-new-project.test.ts` — input: `MainWindowCopy.swift`; expected: `newProjectHelp(workspaceName:)` returns `Adds a project to \(workspaceName)`
- [ ] `sidebar-new-project.test.ts` — input: `SidebarView.swift`; expected: contains `.safeAreaInset(edge: .bottom)`, `NewProjectButton(workspace: workspace)` and `Text(MainWindowCopy.projects)`, and no `ProjectsHeader`
- [ ] `sidebar-new-project.test.ts` — input: `NewProjectButton.swift`; expected: contains `windowState.sheet = .newProject`, `.help(MainWindowCopy.newProjectHelp(`, `.accessibilityHint(MainWindowCopy.newProjectHelp(`, `.disabled(!model.isReady)`, `.todzAnimation(.snap`, `Color.accentColor`, `.contentShape(.rect)`; no `.opacity(` and no `.keyboardShortcut(`
- [ ] `sidebar-new-project.test.ts` — input: `apps/macos/Todz/MainWindow/Sidebar/ProjectsHeader.swift`; expected: absent
- [ ] `sidebar-new-project.test.ts` — input: `AccessibilityCopy.swift`; expected: no `addProject`
- [ ] Pin: `sidebar-new-project.test.ts` — input: `AppCommands.swift`; expected: `Button(MainWindowCopy.newProject)` followed by `.keyboardShortcut(newKey, modifiers: [.command, .shift])`
- [ ] `swift test` in `apps/macos/TodzKit`; expected: every test passes
- [ ] `xcodebuild` of the Todz scheme, Debug; expected: `BUILD SUCCEEDED`, no compiler warning from the changed files

## Renders (in-process, scratch harness)

- [ ] Light, one workspace "Acme", two projects with counts: the footer shows "New Project" with the accent glyph, under Connect an Agent — `01-rest-light.png`
- [ ] Dark, the same layout — `02-rest-dark.png`
- [ ] Light, All Workspaces shown, tagged rows "Acme · Launch", "Beta · Roadmap", badges on: rows, tags and badges unchanged, the footer below — `03-several-workspaces-light.png`
- [ ] Dark, the same — `04-several-workspaces-dark.png`
- [ ] Empty Projects section: the "Projects" header and the footer only — `05-empty-projects.png`
- [ ] Narrow, 180 pt: "New Project" on one line — `06-narrow.png`
- [ ] Overloaded, fifteen projects in a short window: the list scrolls under a fixed footer — `07-overloaded.png`

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: the footer never covers the last row — attack: the overloaded render scrolled to the end; result: pending
- [ ] Claim 2: no second ⇧⌘N — attack: grep every `.keyboardShortcut(newKey` in `apps/macos/Todz`; result: pending
- [ ] Claim 3: nothing else used `ProjectsHeader` or `AccessibilityCopy.addProject` — attack: grep the whole repository after the delete; result: pending

## Human checklist rows

- Hover the footer: the label turns `.primary`; with Reduce Motion on it crossfades.
- Click the footer and press ⇧⌘N: each opens the New Project sheet; Create selects the new project.
- VoiceOver on the footer: "New Project, button. Adds a project to Acme."
- Full Keyboard Access: Tab reaches the footer after the list; Space presses it.

## Coverage honesty

- The shape test pins strings, not behaviour: the click and the shortcut are proven only by the Human checklist.
- The renders draw the shipped views offscreen; the window's Liquid Glass sidebar material on macOS 26 is drawn by the window server and may differ from the offscreen background.
