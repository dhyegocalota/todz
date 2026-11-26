# Settings layout

**Status:** In review
**Tier:** 🟡 (Settings layout, one prompt default, one count rule; no server, no schema, no deploy)
**Owner approval:** the owner's report on the 0.2.2 Settings window ("tá cortando!!! ajusta, acelera"), approved by inheritance from [docs/product/README.md](../../product/README.md) (approved 2026-11-23) and the owner's words, received 2026-11-26.
**ADRs:** [0092](../../adr/0092-settings-is-one-scrolling-form-of-sections-with-a-resizable-window-and-usage-sharing-asks-with-not-now-as-the-default.md)
**Not changing:** the server, the settings values and their storage keys, the workspace shortcut bindings, the usage rollup, the Focus filter, the widgets and the popover.

## Problem

- Setting descriptions are cut to two lines: "Menu bar ribbon … beside the menu bar icon for a few…" and "Share anonymous usage … Never tasks, na…".
- Settings is one long list in a fixed 420-point window. It scrolls into a half-hidden "Workspace shortcuts" header next to a stray grey pill: the Server address field, shown with no label.
- The one-time usage alert puts "Share" first, so the default button (Return) opts the owner in. The default is off; the alert must not turn it on.
- The Workspaces list says "0 projects" for a workspace that has an Inbox.

## Goals

- Every description wraps in full. Controls sit on the first line of their label.
- Settings is grouped into sections with headers: General, Proactive, Privacy & updates, Workspaces, Workspace shortcuts, Server.
- The window has a sensible default size and can be resized.
- "Not Now" is the default button of the usage alert, and Escape declines. Share needs a deliberate click.
- A workspace's project count counts every project it holds, the Inbox included.

## Non-goals

- A tabbed or sidebar Settings window.
- Changing a setting's meaning, default, or storage.
- Reflowing the sign-in server disclosure (it keeps its column layout).

## Design

- **Sections.** One `Form` with a `Section` per group, each with a header. Settings already reads as a grouped list, so sections keep the native look; a sidebar would have needed a new window model for six sections. The Workspaces and Workspace shortcuts sections keep their own views.
- **Rows.** `SettingsRow` puts a title and a full-width detail on the left and the control on the right, top-aligned, so the switch sits on the first line of the title. Details wrap with `fixedSize(horizontal: false, vertical: true)`; no `lineLimit` remains in Settings.
- **Window.** The scene uses a 520 by 640 default, a 460 by 420 minimum, and `.contentMinSize` resizability. The form no longer forces its own height.
- **Grey pill.** The Server address field is the rounded text field with its label hidden. The row now shows a "Server address" label, so the field reads as a control.
- **Usage prompt.** `UsageSharingPrompt` in TodzKit holds the button order (Not Now, then Share), the default answer (Not Now), and the escape answer (Not Now). The alert maps the returned button index through it.
- **Project count.** `Workspace.projectCount` counts all projects, the Inbox included. A workspace with only an Inbox reads "1 project".

## Failure handling

- An alert response outside the two buttons cannot happen (`NSAlert` returns only those); the index lookup is unchecked by design.
- A workspace with no projects still reads "0 projects".

## Test strategy summary

- Unit (TodzKit): the prompt's default, escape, and button order; the project count with and without the Inbox.
- Visual (Debug app): the Settings window in dark, with the scrolled bottom sections; the captures are committed to the tour.
- Gate: `/verify`, `swift test`, and the Debug `xcodebuild`.
