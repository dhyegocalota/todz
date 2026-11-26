# 0091. Global workspace hot keys are off by default and take ⌃⌥⌘1…9, and a chord another app holds shows as in use

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner); Claude (advisor, the loop's call under "global-hotkeys-off"; it amends [ADR 0079](0079-workspaces-switch-by-chord-with-carbon-hot-keys-and-a-stored-rebindable-binding-table.md))
- Inspired by: the owner's report of 2026-11-26, that ⌃1…⌃9 take Dia's profile switching system-wide; [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) (an untouched switch is an absent key and takes the new default); the owner's decision of 2026-11-26 to ship 0.2.3 with in-app keys fixed and to restore their rebinding in 0.2.4

## Context

ADR 0079 registered ⌃1…⌃9 and ⌃⌘[ ⌃⌘] as global Carbon hot keys, on by default, so while todz ran they belonged to todz in every app. Those chords are common in other apps (Dia switches profiles with ⌃1…⌃9), and the owner loses them. The same chords are also the right in-app keys, which need no global registration: the Workspace menu carries them and they work while todz is frontmost.

## Decision

1. Two scopes with two defaults. **In-app** chords are the Workspace menu's `keyboardShortcut`s and are never registered globally: ⌃1…⌃9 pick workspaces 1…9, ⌃⌘[ and ⌃⌘] step. In 0.2.3 they are fixed and not rebindable; their rebinding returns in 0.2.4. **Global** chords are Carbon hot keys: ⌃⌥⌘1…⌃⌥⌘9 pick workspaces 1…9, rebindable in Settings. Previous and Next have no global chord.
2. The global switch is off by default. An untouched switch is an absent key (ADR 0068, rule 6): the new default applies at the next launch with no stamp and no migration step. A Mac where the owner turned the switch on keeps it on, and one where he turned it off keeps it off. Stored overrides in `workspaceChords` are read as global chords. At read they are applied one by one in key order through the same rebinding rules; an override that is no longer valid (one modifier, an in-app chord, Previous or Next, or a chord another workspace already holds) is dropped silently, and its action keeps its ⌃⌥⌘ default. Previous and Next overrides are dropped silently too, because in 0.2.3 they cannot be changed.
3. A global chord needs at least two of ⌃, ⌥ and ⌘, and it may not equal an in-app chord. `GlobalChordPlan` filters in-app chords out by construction, so no in-app chord is ever registered globally, whatever the stored value. Refusals: "Hold two of ⌃, ⌥ or ⌘ with the key." and "That is a workspace key inside todz."
4. A global chord is registered with `RegisterEventHotKey` as an **exclusive** hot key (`kEventHotKeyExclusive`). What this can detect, honestly: an exclusive registration held by another app, and our own duplicates. A registration that fails with `eventHotKeyExistsErr` is "In use by another app"; the row shows that next to the chord and the chord is not registered. Any other failure is its own state, "todz could not register this shortcut.", and the chord is not registered either. What this cannot detect: another app's ordinary (non-exclusive) hot key or in-app shortcut, and macOS's Mission Control keys that are not registered through Carbon. That is why the default is ⌃⌥⌘, which common apps do not use: todz cannot see other apps' shortcuts.
5. The system's symbolic hot keys (`com.apple.symbolichotkeys`) were considered as a second check and dropped for 0.2.3. A sandboxed read of that domain needs a temporary shared-preference exception, and a sandboxed check could not be confirmed to run in the build environment; a check that cannot be shown to read is worse than none. The read is not in the app.
6. Registration happens only while the switch is on and the app is ready with workspaces (ADR 0079's eligibility, unchanged).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep ⌃1…⌃9 global and ask the owner to disable Dia's chords | No change in todz | The owner's complaint: a global key must not take common chords | The owner's rule, not the owner's workaround |
| Global default ⌃⌘1…9 | Shorter | ⌘ digits are the lists' keys and common in many apps | Still takes common chords |
| Make in-app chords rebindable in 0.2.3 too | One table, as in ADR 0079 | Needs a second table, a second preference key and a two-section Settings layout; not finished for this release | Deferred to 0.2.4 by the owner's decision |
| Migration step that writes `false` to every untouched Mac | Explicit | A second source of truth for the same absent key ADR 0068 already reads | The new default does the same thing; no stamp needed |
| Read `com.apple.symbolichotkeys` to see Mission Control's keys | Would catch enabled system keys | Needs a sandbox exception; the read could not be confirmed here | Dropped; see Decision 5 |
| Check only `RegisterEventHotKey` without exclusivity | Smallest | Without `kEventHotKeyExclusive` another app's registration does not fail ours | Exclusive registration is the signal the API gives |

## Consequences

- Existing installs keep the workspace menu and its ⌃ keys in-app; global workspace keys are off until the owner turns them on; the chord moves to ⌃⌥⌘ for every owner who never rebound it.
- Settings shows the global number rows only while the switch is on. In 0.2.3 Previous and Next cannot be changed from Settings, and in-app keys cannot be rebound.
- A chord another app holds non-exclusively is not detected: it may be registered alongside it and the owner can choose a different one.
- No server, schema or deploy change. The stored key `workspaceChords` keeps its name and now holds the owner's global chord overrides.

## Evidence

- `apps/macos/TodzKit/Sources/TodzKit/GlobalWorkspaceChords.swift`, `WorkspaceAction.swift` and `WorkspaceShortcutsPreference.swift`: the scopes, the refusals and the read-time fold.
- `apps/macos/TodzKit/Sources/TodzKit/GlobalChordPlan.swift` and `GlobalChordAvailability.swift`: the in-app filter and the registration status mapping.
- `apps/macos/Todz/Shared/WorkspaceHotKeys.swift` and `WorkspaceShortcutController.swift`: exclusive registration and the availability per action.

## Revisit when

0.2.4 restores in-app rebinding. Also revisit when the owner reports a chord that another app uses non-exclusively and is still stolen, or when a sandboxed read of `com.apple.symbolichotkeys` can be shown to work in the shipped app.
