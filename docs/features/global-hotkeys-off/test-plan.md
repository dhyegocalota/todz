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

- [ ] A registration status of 0 (no error) is `available`.
- [ ] The status `eventHotKeyExistsErr` (-9878) is `inUse`, and nothing else is.
- [ ] Any other status (for example -50) is `failed`, not `inUse`.
- [ ] `GlobalChordPlan` plans every global default chord and no in-app chord, even when a global override holds an in-app chord.

Not tested here, and not claimed: another app's ordinary (non-exclusive) shortcut, and macOS's system symbolic hot keys. The system table is not read (ADR 0091, decision 5).

## Chord modifiers

- [ ] `canBeGlobal` is true for two or more of ⌃⌥⌘ and false for one of them alone.

## App layer (manual, recorded)

- [ ] Settings with the switch off shows no number rows.
- [ ] Settings with the switch on shows ⌃⌥⌘1…9 per workspace, in light and dark.
- [ ] A chord marked in use shows "In use by another app" beside it.
- [ ] A chord that failed for another reason shows "todz could not register this shortcut." beside it.
- [ ] Settings with the switch on shows the Mission Control line in the section footer.
- [ ] The Workspace menu still shows ⌃1…⌃9 and ⌃⌘[ ⌃⌘].

## Coverage honesty

Carbon's `RegisterEventHotKey` and the live system hot key table are not unit-tested; they are covered by the Debug build and by the manual rows above. The unit tests pin the decision logic.
