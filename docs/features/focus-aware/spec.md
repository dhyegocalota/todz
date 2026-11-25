# Focus aware

**Status:** In review
**Tier:** 🟡 (a new App Intent the system runs, a shared gate every later proactive surface goes through, a Settings row)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop (2026-11-24, ~20:30: "1,4,5,6,7,9,10 e também 11 … seja criativo, add no cron e só para quando tiver pronto"; every item "features opcionais", off by default, no push notifications), recorded in `todz-loop/STATE.md` "Owner requirements queued" → `proactive-day` item 5. Taken before `day-close` because it is the shared gate the others respect (the loop's call). The mechanism is the loop's call in [ADR 0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md).
**ADRs:** [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md), [0036](../../adr/0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md)
**Not changing:** the menu bar count, the popover, the widgets, the agent nudge, the server

## Problem

The proactive surfaces the owner asked for must never interrupt a Focus. macOS tells a Personal Team app about Focus only through a Focus filter the owner adds (ADR 0054).

## Goals

- A todz Focus filter, "Keep todz quiet" (off by default), that the owner can add to any Focus mode in System Settings.
- A shared `ProactiveGate`: while quiet, a surface that asks to show is held (one per kind) and nothing shows; when quiet ends, each held surface is handed back once, then forgotten.
- The app knows the quiet state at launch (`current`) and on every change (`perform()`).
- The Settings window says how to opt in, with a button that opens Focus settings.

## Non-goals

- Any proactive surface itself (they come as their own features and go through the gate).
- Reading Focus without the filter, gating the agent nudge, per-surface Focus choices.

## Design

### Data flow

```
System Settings → Focus "Work" → Focus filters → todz: Keep todz quiet ON
Work turns on   → system runs TodzFocusFilter.perform() with isQuiet = true  → ProactiveGate.quiet = true
surface asks    → gate.admit(kind) → .held (nothing shows; one pending per kind)
Work turns off  → perform() with the default isQuiet = false → gate.quiet = false → gate hands back each held kind once
app launch      → TodzFocusFilter.current → gate.quiet
```

### Interfaces

- `TodzKit`: `ProactiveSurface` enum with one case per planned surface that shows itself (`dayClose`, `morningGlance`, `ribbon`), so the gate's tests are concrete; `ProactiveGate` (`@MainActor`, `@Observable`): `isQuiet`, `admit(_:) -> GateDecision` (`.show` or `.held`), `setQuiet(_:)`, and the delivery of held surfaces through the gate itself (plan review R1): when quiet ends, the held kinds become `released` (observable, in the order first held), and a surface takes its own with `claimRelease(_:) -> Bool`, true once; the launch read `applyLaunchRead(isQuiet:)` is ignored once a `perform()` has set the gate (R7). `FocusQuietNotice` (`.notQuiet`, `.quietNow`) derives the Settings detail from `isQuiet` (R5).
- App target: `TodzFocusFilter: SetFocusFilterIntent` in `Todz/FocusFilter/` with `@Parameter(default: false) var isQuiet`; the title, description and parameter title are literals in the intent, as `ToggleTaskIntent` does, and only the display representation reads `FocusCopy.swift` (R4); `perform()` sets the gate, reached through `AppDependencyManager`, registered in `AppDelegate.init` (R3). The app reads `current` at launch.
- Settings: a row "Quiet during Focus" with the live detail and an "Open Focus Settings" button opening the Focus pane; the Settings scene receives the gate in its environment (R6); copy in `SettingsCopy.swift`.

### Failure handling

| Case | Effect |
|---|---|
| the owner never adds the filter | never quiet; every surface shows as usual |
| `current` throws at launch | not quiet (a Focus without a readable filter never silences todz) |
| two `perform()` calls with the same value | the second changes nothing and releases nothing |
| the same surface asked twice while quiet | held once; released once |
| the Focus pane URL cannot open | the button does nothing visible; the detail still says where to go |
| todz is not running when a Focus with the filter turns on or off | the system launches todz to run `perform()` (the intent lives in the app); todz starts as it does at login, in the menu bar; whether a window opens is checked by hand (Human checklist) (R2) |
| a `perform()` arrives while the launch read is pending | `perform()` wins; the launch read is ignored (R7) |

### Rollback

Revert the app change; the system drops the filter with the app version that declared it.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How the app learns Focus | `INFocusStatusCenter`; a Focus filter; a todz quiet-hours setting | the loop's call: a Focus filter (ADR 0054) | 2026-11-25 |
| What "shows once" means | replay every held request; one per kind | the loop's call: one per kind, in the order first held | 2026-11-25 |

## Test strategy summary

Swift tests for the gate: not quiet shows; quiet holds; a second ask of the same kind while quiet holds once; quiet ending releases each held kind once in order; quiet ending twice releases nothing the second time; nothing is claimed while a Focus is on. The filter's `perform()` is proven by the build's App Intents metadata and the PR's Human checklist (plan review R5 dropped the seam). A walk with Orca: the Settings row, its button opening Focus settings, and the todz filter listed under a Focus mode's filters (screenshots, no Focus turned on without the owner).
