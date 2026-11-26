# Test plan: global workspace hot keys off by default

Unit tests run with Swift Testing in `apps/macos/TodzKit` (`swift test`). The app layer (Carbon registration, Settings rows) is checked by a Debug build and screenshots of the Shortcuts rows.

## Defaults

- [ ] `GlobalWorkspaceChords` default for `.number(1)` is `⌃⌥⌘1`; for `.number(9)` it is `⌃⌥⌘9`.
- [ ] `previous` and `next` have no global chord; `number(10)` has none.
- [ ] Every global default chord is distinct.
- [ ] The in-app chords are `⌃1`…`⌃9`, `⌃⌘[` and `⌃⌘]`, and are distinct from every global default.

## Migration (an absent key is untouched, ADR 0068)

- [ ] A fresh domain reads the global switch off.
- [ ] A domain where the owner stored `true` reads on.
- [ ] A domain where the owner stored `false` reads off.
- [ ] `registerDefaults` registers off.
- [ ] A stored override that is a valid global chord is read back.
- [ ] A stored override with one modifier (`⌃2` style) is dropped and reads as the default.
- [ ] A stored override for Previous or Next is dropped.
- [ ] Unreadable stored data reads as the defaults.

## In-app chords are never global

- [ ] `GlobalChordPlan` on default chords registers no in-app chord.
- [ ] A global rebind to an in-app chord (`⌃⌘[`) is refused with `inAppChord`.
- [ ] A global rebind to a one-modifier chord (`⌃5`) is refused with `needsTwoModifiers`.
- [ ] A global rebind to a two-modifier chord (`⌃⌥K`) is accepted.
- [ ] A global rebind to a chord another number holds is refused with `taken(by:)`.
- [ ] A rebind to the chord the action already holds is accepted unchanged.
- [ ] A `previous` or `next` rebind is refused with `notGlobal`.

## In use

- [ ] A chord the system holds (an enabled `AppleSymbolicHotKeys` entry with the same key and modifiers) is in the plan's in-use set and not in its registrations.
- [ ] A disabled system entry with the same chord does not hold it.
- [ ] A system entry with a different modifier set does not hold it.
- [ ] System modifier flags map to ⌃, ⌥, ⇧ and ⌘ exactly.
- [ ] A chord not held by the system is registered.

## Chord modifiers

- [ ] `canBeGlobal` is true for two or more of ⌃⌥⌘ and false for one of them alone.

## App layer (manual, recorded)

- [ ] Settings with the switch off shows no number rows.
- [ ] Settings with the switch on shows ⌃⌥⌘1…9 per workspace, in light and dark.
- [ ] A chord marked in use shows "In use by another app" beside it.
- [ ] The Workspace menu still shows ⌃1…⌃9 and ⌃⌘[ ⌃⌘].

## Coverage honesty

Carbon's `RegisterEventHotKey` and the live system hot key table are not unit-tested; they are covered by the Debug build and by the manual rows above. The unit tests pin the decision logic.
