# 0055. The day closes once a day in the menu bar popover, at the owner's time

- Status: Accepted (the build loop's call, the owner may overturn it); amended by [0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md) (§1 on by default; §3 the gate holds only with Respect Focus on)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 4 from the loop's `proactive-day` list: at a time the owner picks, the menu bar popover opens once by itself on what is left of Today, each task gets done, tomorrow or drop; it respects Focus and never fires twice a day; opt-in, off by default, no push notifications
- Inspired by: [ADR 0031](0031-the-menu-bar-extra-is-a-swiftui-window-over-the-app-s-one-model.md) (the popover is closed from code by clicking its own status button), [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md) (Settings and app-local preferences), [ADR 0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) (the proactive gate), the run-16 spike on opening the popover from code

## Context

The owner wants todz to close his day: once, at a time he picks, the popover he already uses opens by itself on Today's open tasks, and each one is finished, moved to tomorrow or dropped. The app holds no scheduler today, the popover is a SwiftUI `MenuBarExtra` with no public "open" call, the product has no task deletion, and the Focus gate (ADR 0054) exists for exactly this kind of surface.

## Decision

1. **An app-local preference, off by default.** "Close the day" with a time, kept in the app's defaults like the menu bar count (ADR 0036), not on the server: only the app acts on it. The default time is 18:00 in the Mac's time zone. *Amended on 2026-11-25 by [ADR 0068](0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md):* on by default; a Mac where the owner never flipped the switch takes it, one where the owner turned it off keeps it off.
2. **Once a day, on time or on the first chance after.** A `DayCloseSchedule` in `TodzKit` decides, from the preference, the last day it fired and the current instant, whether to fire now and when to look next. It fires at the chosen time, or at the first wake or launch after it on the same calendar day; never twice on one day, never on a day already over. The day it fired is stored with the preference.
3. **Through the gate.** A due day close asks `ProactiveGate.admit(.dayClose)`. Held during a Focus, it shows when the gate releases it, if that is still the same day; otherwise it is dropped.
4. **Nothing to close, nothing shown.** With no open task in Today of the active workspace, the day is marked closed and nothing opens.
5. **The popover opens itself the way it closes itself.** The app clicks its own status item button (ADR 0031's mechanism, from code), and the popover shows Today in a day-close mode: a heading with what is left and, on each row, Done, Tomorrow and Drop. **Drop clears the task's due date**: the task leaves Today and stays open, because the product has no deletion. Leaving the popover ends the mode; the next normal opening is the usual Today. The day is marked closed when the popover is seen or nothing is left, never when the click is sent, and only on a day whose close is due when it is seen (a mode left from an earlier day and seen after today's time counts as today's): a click that shows nothing leaves the day unmarked and a later check that day clicks again.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Popover opened from code (chosen) | the owner's own surface, as asked | relies on the status button (already relied on by ADR 0031) | — |
| A separate panel under the menu bar | full control | a second Today surface to keep in step | the owner asked for the popover |
| A notification | standard | the owner ruled out push notifications | excluded |
| Drop = complete | one fewer state | lies in the history ("done" when not done) | wrong record |
| Drop = archive or delete | literal | the product has neither | out of scope |
| Server-side schedule | follows the owner across Macs | a mail or push the owner did not ask for | the app is where he closes the day |

## Consequences

- With two Macs, each closes the day on its own; the second finds less left, or nothing, and stays silent.
- Any local process can post `com.apple.screenIsUnlocked`; it only makes todz re-run the check, which re-reads the clock, the real lock state, the gate and the once-a-day mark, so it can time a due day close but never open one early, during Focus, while locked or twice.
- The popover appears over the owner's work once a day, which is the feature; the walk proves it with as few openings as the test plan needs.

## Evidence

Run-16 spike (scratch, not committed), Xcode 27.2, macOS 26: the SDK offers no public way to open a `MenuBarExtra` (`init(isInserted:)` and `menuBarExtraStyle` only). `performClick(nil)` on the `NSStatusBarButton` found through `NSApp.windows` opened the popover anchored under the item with its highlight, and an outside click closed it as a user-opened one; a second click toggles it closed, so the opener checks that the popover is not already visible. An app launched hidden showed nothing until `NSApp.unhideWithoutActivation()`. Not tested: full screen with an auto-hidden menu bar, several displays, Stage Manager.

## Revisit when

The owner wants the day close on one Mac only, or a different meaning for Drop.
