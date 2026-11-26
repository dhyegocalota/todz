# 0086. Global workspace hot keys are off by default and take ⌃⌥⌘1…9, and a chord another app holds shows as in use

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under "global-hotkeys-off"; it amends [ADR 0079](0079-workspaces-switch-by-chord-with-carbon-hot-keys-and-a-stored-rebindable-binding-table.md))
- Inspired by: the owner's report of 2026-11-26, that ⌃1…⌃9 take Dia's profile switching system-wide; [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) (an untouched switch is an absent key and takes the new default)

## Context

ADR 0079 registered ⌃1…⌃9 and ⌃⌘[ ⌃⌘] as global Carbon hot keys, on by default, so while todz ran they belonged to todz in every app. Those chords are common in other apps (Dia switches profiles with ⌃1…⌃9), and the owner loses them. The same chords are also the right in-app keys, which need no global registration: the Workspace menu carries them and they work while todz is frontmost.

## Decision

1. Two scopes with two defaults. **In-app** chords are the Workspace menu's `keyboardShortcut`s and are never registered globally: ⌃1…⌃9 pick workspaces 1…9, ⌃⌘[ and ⌃⌘] step. They are fixed, not rebindable. **Global** chords are Carbon hot keys: ⌃⌥⌘1…⌃⌥⌘9 pick workspaces 1…9, rebindable. Previous and Next have no global chord.
2. The global switch is off by default. An untouched switch is an absent key (ADR 0068, rule 6): the new default applies at the next launch with no stamp and no migration step. A Mac where the owner turned the switch on keeps it on, and one where he turned it off keeps it off. The owner's rebinds in the stored `workspaceChords` table stay as global chords when they are still valid; a stored chord that is not valid globally (one modifier, an in-app chord, Previous or Next) is dropped at read, so the action returns to its ⌃⌥⌘ default. Nothing stored is read as a global chord that can steal a common key.
3. A global chord needs at least two of ⌃, ⌥ and ⌘, and it may not equal an in-app chord. Refusals: "Hold two of ⌃, ⌥ or ⌘ with the key." and "That is a workspace key inside todz."
4. A global chord is registered only when no other app owns it. Before registering, the app reads the system's symbolic hot keys (`com.apple.symbolichotkeys`, `AppleSymbolicHotKeys`) and treats an enabled system entry with the same key and modifiers as in use. Then it calls `RegisterEventHotKey`; any failure, including `eventHotKeyExistsErr`, is in use. An in-use action is not registered and its Settings row shows "In use by another app" next to the chord.
5. Registration happens only while the switch is on and the app is ready with workspaces (ADR 0079's eligibility, unchanged).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep ⌃1…⌃9 global and ask the owner to disable Dia's chords | No change in todz | The owner's complaint: a global key must not take common chords | The owner's rule, not the owner's workaround |
| Global default ⌃⌘1…9 | Shorter | ⌘ digits are the lists' keys and common in many apps | Still takes common chords |
| Make in-app chords rebindable too | One table, as in ADR 0079 | The row would rebind two scopes and the in-app chords could be made global by mistake | Not asked; the in-app chords are the Workspace menu's fixed keys |
| Migration step that writes `false` to every untouched Mac | Explicit | A second source of truth for the same absent key ADR 0068 already reads | The new default does the same thing; no stamp needed |
| Check only the symbolic hot keys | Read-only | Misses another app's registered hot key | Carbon's refusal is the signal for that |
| Check only `RegisterEventHotKey` | Smallest | Mission Control's enabled ⌃N keys can still be stolen if they register | Cheap to read the symbolic table, so both are checked |

## Consequences

- Existing installs keep the workspace menu and its ⌃ keys in-app; global workspace keys are off until the owner turns them on; the chord moves to ⌃⌥⌘ for every owner who never rebound it.
- Settings loses the Previous and Next rows; the global rows exist only while the switch is on.
- No server, schema or deploy change. The stored key `workspaceChords` keeps its name and holds global chords.

## Evidence

- `apps/macos/TodzKit/Sources/TodzKit/GlobalWorkspaceChords.swift`, `WorkspaceAction.swift` and `WorkspaceShortcutsPreference.swift`: the scopes, the refusals and the read-time filter.
- `apps/macos/TodzKit/Sources/TodzKit/SymbolicHotKeys.swift`: the system check.
- `apps/macos/Todz/Shared/WorkspaceHotKeys.swift` and `WorkspaceShortcutController.swift`: registration and the in-use set.

## Revisit when

Apple changes the symbolic hot keys store or stops reporting `eventHotKeyExistsErr`, or the owner wants in-app chords rebindable, or a second app reports a chord that is free by both checks yet still stolen.
