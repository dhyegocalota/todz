# Sidebar overlap

**Status:** In review
**Tier:** 🟢
**Owner approval:** approved 2026-11-26 by inheritance of the owner's words "o nome do workspace tá ficando overlapped com o nome do projeto na lateral do scroll; fix it", product scope of [docs/product/README.md](../../product/README.md)
**ADRs:** none
**Not changing:** the workspace switcher in the menu bar popover, its menu, the project rows, the New Project footer of [sidebar-new-project](../sidebar-new-project/spec.md), the selection and the count badges

## Problem

`WorkspaceSwitcher` is pinned over the sidebar list with `.safeAreaInset(edge: .top)`. The sidebar's glass is transparent, so while the list scrolls the rows pass under the workspace name and the two texts overlap.

## Goals

- At every scroll offset, the workspace name and the project rows never share a pixel, in light and dark, with many projects.
- The same mechanism as the footer of #93: a stacked child of a `VStack(spacing: 0)`, not a transparent inset.

## Non-goals

- A new switcher design, a divider, a material.

## Design

`SidebarView.body` becomes `VStack(spacing: 0) { WorkspaceSwitcher(...); list; NewProjectButton(...) }` and the top inset is removed. Chosen over letting the header scroll away because the switcher is the workspace's only visible name and its menu, and over an opaque `.background` bar because the stack needs no fill that would fight the sidebar's glass; the list simply starts below the header, exactly as it ends above the footer.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Pin, bar or scroll away? | stacked header, opaque bar, header in the list | Loop's call: stacked header, consistent with the footer | 2026-11-26 |

## Test strategy summary

`sidebar-overlap.test.ts` pins the stack order and the absence of the top inset, red first. In-process renders of the sidebar scrolled to the top, the middle and the end with many projects, light and dark.
