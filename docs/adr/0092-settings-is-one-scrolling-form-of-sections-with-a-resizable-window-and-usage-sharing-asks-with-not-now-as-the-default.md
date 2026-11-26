# 0092. Settings is one scrolling form of sections in a resizable window, and the usage prompt defaults to Not Now

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner) reported the 0.2.2 Settings window and asked for the fix; Claude (the build loop's call on the layout and the count rule)
- Inspired by: the owner's report ("tá cortando!!! ajusta, acelera"); [ADR 0085](0085-the-readme-is-a-six-shot-showcase-and-the-docs-hold-the-tour.md) for the screenshots; [docs/features/settings-layout](../features/settings-layout/spec.md)

## Context

Settings is one long grouped form in a fixed 420-point window, its descriptions cut at two lines, its server field unlabelled. The one-time usage alert makes Share the Return button while the default is off, so a stray Return opts the owner in.

## Decision

1. Settings is one `Form` with a header per section: General, Proactive, Privacy & updates, Workspaces, Workspace shortcuts, Server. The window has a 520 by 640 default, a 460 by 420 minimum, and is resizable.
2. Every description wraps in full and sits beside a control aligned to the first line of its title. Settings never uses a `lineLimit` on a description.
3. The usage prompt's buttons are ordered Not Now then Share, Not Now is the default, and Escape declines. The order and the answers live in TodzKit (`UsageSharingPrompt`), so a test pins them.
4. A workspace's project count counts every project it holds, the Inbox included.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One form of sections (chosen) | keeps the native grouped look, one scroll, no new window model | a long scroll on a small screen | smallest change that fixes the cut text and the cramped window |
| Tabbed Settings | short panes | seven panes split across tabs, and a new layout for the owner to learn | more change than the report asks for |
| Sidebar Settings | the most Apple-native for many panes | needs a split view inside the Settings scene | more change, and seven panes do not need a sidebar |
| Keep "Share" first and only relabel it | no code change in the prompt | the stray Return still opts the owner in | the owner asked for Not Now as the default |
| Count only named projects, show "Inbox only" when empty | keeps the old meaning | a second copy and a second rule | the owner asked for a truthful count; the Inbox is a project |

## Consequences

- Settings reads as six named groups; the grey pill is the labelled Server address field.
- A workspace with only an Inbox reads "1 project".
- The usage prompt cannot opt the owner in with a stray Return; a test pins the default.

## Evidence

`apps/macos/TodzKit/Tests/TodzKitTests/UsageSharingPromptTests.swift` and `AppModelTests+WorkspaceChoice.swift`; the Debug captures in `apps/docs/images/settings-layout/`.

## Revisit when

- Settings grows past about ten sections, or a pane needs its own toolbar: then use tabs or a sidebar.
- The Inbox stops being a project in the owner's API.
