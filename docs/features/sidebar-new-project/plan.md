# Plan: Sidebar new project

**Spec:** spec.md
**Design:** design.md, option C
**Tier:** 🟢
**Seam:** `SidebarView` in `apps/macos/Todz/MainWindow/Sidebar/`
**Assumptions (decided, owner can override):**
- Plan review is skipped for this 🟢 fix; findings below IMPORTANT land here.
- PR #89 (delete and rename workspace) owns the project context menu in `ProjectRow`; this lane touches only the section header and the footer.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/sidebar-new-project.test.ts` | lane lead, inline |
| G2 | `apps/macos/Todz/MainWindow/Sidebar/NewProjectButton.swift`, `apps/macos/Todz/MainWindow/Sidebar/SidebarView.swift`, `apps/macos/Todz/MainWindow/Sidebar/ProjectsHeader.swift` (deleted), `apps/macos/Copy/MainWindowCopy.swift`, `apps/macos/Copy/AccessibilityCopy.swift` | lane lead, inline |
| G3 | `docs/features/sidebar-new-project/`, `docs/features/README.md` | lane lead, inline |

## Sequencing

G3 (folder) → G1 (red) → G2 (green) → G3 (evidence, Shipped).

## Steps

### G1

- [x] **Step 1:** (297d6059) Red: `sidebar-new-project.test.ts`, committed alone, failing on the missing copy, inset, button file and on `ProjectsHeader.swift` still existing; the ⇧⌘N binding is a pin.

### G2

- [x] **Step 2:** (8104443e) Copy: `newProjectButton`, `newProjectHelp(workspaceName:)`; drop `AccessibilityCopy.addProject`.
- [x] **Step 3:** (8104443e, VStack in the next commit) `NewProjectButton` as design.md § 3; `SidebarView` stacks the button under the list (a `VStack`, chosen over the bottom inset so the footer never overlays a row) and a plain `Text` header; `ProjectsHeader.swift` deleted.
- [x] **Step 4:** (pnpm verify: 7 gates green at d9cd1fac, swift test and xcodebuild inside) `swift test` and the Debug `xcodebuild` in the foreground.

### G3

- [x] **Step 5:** (.pr-media/sidebar-new-project/ 01-09, light, dark, several workspaces, empty, narrow, overloaded) In-process renders (light, dark, one workspace, several) into `.pr-media/sidebar-new-project/`.
- [ ] **Step 6:** `/verify` green, the PR opened, then the status flipped to `Shipped 2026-11-26` with the PR link in the last commit.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | The footer pushes Connect an Agent or the last project under the inset | the overloaded render shows the last row hidden behind the footer | revert the commit |
| 3 | The footer label wraps or truncates at the 180 pt minimum | the narrow render | revert the commit |
| 3 | A second ⇧⌘N registers | `sidebar-new-project.test.ts` pin and `NewProjectButton` has no `.keyboardShortcut` | revert the commit |

**Steps with no backout:** none

## Deferred

- **A dark-appearance variant of `AccentColor`** (v1.1): on the dark sidebar the accent glyph is about 2.8:1, under 3:1. The word carries the meaning, so the glyph stays decorative here; a dark variant changes every accent use (checkbox, selection, ring, widgets) and gets a token change of its own (design.md § 6, § 7.2).

## Findings below IMPORTANT

None yet.
