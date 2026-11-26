# Plan: Sidebar overlap

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `SidebarView` in `apps/macos/Todz/MainWindow/Sidebar/`
**Assumptions (decided, owner can override):**
- Stacks on #93: both change `SidebarView.swift`.
- Plan review is skipped for this 🟢 fix.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/sidebar-overlap.test.ts`, `tools/repository-shape/src/sidebar-new-project.test.ts` | lane lead, inline |
| G2 | `apps/macos/Todz/MainWindow/Sidebar/SidebarView.swift` | lane lead, inline |
| G3 | `docs/features/sidebar-overlap/`, `docs/features/README.md` | lane lead, inline |

## Sequencing

G1 (red) → G2 (green) → G3.

## Steps

### G1

- [ ] **Step 1:** Red: `sidebar-overlap.test.ts` pins the stack `WorkspaceSwitcher`, `list`, `NewProjectButton` and no `.safeAreaInset(edge: .top)`.

### G2

- [ ] **Step 2:** `SidebarView` stacks the switcher above the list; the top inset goes; the footer test's pattern follows.
- [ ] **Step 3:** `pnpm verify`.

### G3

- [ ] **Step 4:** In-process renders (light, dark, top, middle, end, overloaded) attached to the PR.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | The list loses its top scroll-edge effect under the glass | the render shows a hard edge under the header | revert the commit |

**Steps with no backout:** none
