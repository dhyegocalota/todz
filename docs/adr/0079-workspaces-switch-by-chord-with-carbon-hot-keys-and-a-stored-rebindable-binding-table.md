# 0079. Workspaces switch by chord, with global Carbon hot keys and a stored, rebindable binding table

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under "Workspaces, more")
- Inspired by: `todz-loop/PROMPT.md` "Workspaces, more"; the owner's request of 2026-11-26, "quero switch between workspaces com shortcuts configurados por padrão"; [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md); [ADR 0076](0076-an-account-with-several-workspaces-and-no-remembered-choice-opens-a-picker-of-names-and-project-counts.md)

## Context

The Workspace menu switches with ⌘1–⌘9 and the popover reads the same keys. The owner wants chords that work by default, that he can change, and that also work while another app is in front. ⌘1–⌘9 belongs to lists, so the default moves to ⌃1–⌃9.

## Decision

1. Defaults: ⌃1…⌃9 pick workspace 1…9 in the Workspace menu's order, and ⌃⌘[ and ⌃⌘] go to the previous and next workspace, wrapping at both ends. A workspace beyond the ninth has no default chord and is reached by stepping. The popover keeps its own ⌘1–⌘9.
2. A chord is a `KeyChord` value type in TodzKit: a virtual key code, the key's character and a `ChordModifiers` option set. A `WorkspaceBindings` value holds only the owner's overrides, keyed by action; an action with no override reads its default. This is ADR 0068's rule: an untouched entry follows the defaults, so a later change of a default reaches every owner who never rebound it.
3. The overrides are stored as one JSON `Data` value in UserDefaults under `workspaceChords`; an unreadable value reads as the defaults. The global switch is a separate Bool, `switchesWorkspacesFromAnyApp`, on by default through `registerDefaults`.
4. A rebind is refused when the chord has no ⌃, ⌥ or ⌘, and when another action already holds it. Accepting the chord an action already holds changes nothing.
5. Global chords go through Carbon `RegisterEventHotKey` on the application event target. It needs no Accessibility or Input Monitoring permission. Every chord is registered again whenever a binding or the global switch changes, and none is registered while the switch is off.
6. Settings records a rebind with a small recorder: one row per action with its chord and a Record button; the next key-down with modifiers becomes the chord, and Escape cancels. The Workspace menu shows each chord through the system's own shortcut display.
7. ⌃1–⌃9 may collide with Mission Control's "Switch to Desktop N" when the owner enabled those. Registration still succeeds and the system shortcut wins. Settings says so in one quiet line.
8. Switching uses the existing single-selection call, `AppModel.switchWorkspace(identifier:)`, so the selection model can change without touching the chords.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `NSEvent.addGlobalMonitorForEvents` for global keys | No Carbon | Needs the Accessibility permission, cannot consume the key | A permission prompt for a convenience; the key also reaches the front app |
| A key-recorder package | Polished recorder | A dependency for one row type | The recorder is thirty lines; no dependency added |
| Store every chord, defaults included | Simple read | A changed default never reaches an owner whose Mac stored the old one | Breaks ADR 0068 |
| ⌘1–⌘9 stay the default | No change | They are the lists' keys | The owner asked for ⌃ |
| A hidden or unbound action | Lets the owner clear a chord | More states in a small recorder | Not asked; rebinding to another chord is enough |

## Consequences

- The Workspace menu's ⌘1–⌘9 go away; the main window loses those keys, the popover keeps them.
- A chord another app registered first makes our registration fail quietly; the row still shows the chord and the menu still works while todz is in front.
- No server, schema or deploy change.

## Evidence

- `apps/macos/TodzKit/Sources/TodzKit/WorkspaceBindings.swift`, `WorkspaceAction.swift` and `WorkspaceShortcutsPreference.swift`: the defaults, the refusals and the stored form.
- `apps/macos/Todz/Shared/WorkspaceHotKeys.swift`: the Carbon registration.

## Revisit when

An owner reports a chord that does not register, or the app is sandboxed in a way that blocks Carbon hot keys, or the selection model of `multi-workspace` makes "switch" mean something other than one active workspace.
