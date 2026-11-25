# 0062. The morning glance is a non-activating glass panel that shows Today on the first wake or unlock of the day

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose idea 5 from the loop's `proactive-day` list: on the first wake or unlock of the day, a small glass panel shows Today for about 5 seconds and fades, with no focus steal and a click to open the window; opt-in, off by default, no push notifications
- Inspired by: [ADR 0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) (the proactive gate), [ADR 0055](0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md) (an app-local preference, marked only once seen, and the day close's seven fix rounds), [ADR 0036](0036-the-menu-bar-icon-counts-today-s-open-tasks-behind-a-setting.md) (what Today's count is), [ADR 0033](0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md) (the Today rows the app already builds for the widgets), the run-17 spike on a non-activating glass panel

## Context

The owner wants to see his day the moment he sits down, without asking for it and without todz taking the keyboard from whatever he opens first. The app has no panel of its own: the popover is a `MenuBarExtra`, and opening it is the day close's job. The day close's review rounds taught what a surface that shows itself must hold: it never takes keystrokes meant for another app, the day is marked only once the surface is seen, a screen lock opens nothing, the day follows the Mac's time zone, the launch Focus read is bounded, and a check while one opening is in flight does nothing. The proactive gate already names a `.morningGlance` surface.

## Decision

1. **An app-local preference, off by default.** "Morning glance" in Settings, kept in the app's defaults with the day it last showed, like the day close (ADR 0055 §1). Turning it on shows nothing until the next chance.
2. **The first chance of each calendar day.** A launch, a wake from sleep (`NSWorkspace.didWakeNotification`), a display wake (`NSWorkspace.screensDidWakeNotification`), a screen unlock (the `com.apple.screenIsUnlocked` distributed notification) or a return to the session (`NSWorkspace.sessionDidBecomeActiveNotification`) is a chance. There is no time of day. The day is computed in the Mac's current time zone at the chance, and only that day is marked, only after the panel is on screen, so a held, locked or unseen glance tries again on the next chance that day.
3. **Today known soon, something open.** The glance waits for Today of the active workspace to be known for at most 60 seconds after its chance; later, the chance passes unmarked. With nothing open, the day is marked and nothing shows.
4. **Locked opens nothing.** A chance found while the screen is locked shows nothing and stays pending; the unlock, or the first switch between apps if the unlock never arrives, retries it as a fresh chance of the day it happens on. The panel reads the lock again right before it orders itself front, and a lock found there shows and marks nothing.
5. **Through the gate.** The glance asks `ProactiveGate.admit(.morningGlance)`. Held during a todz Focus, it shows once when the gate releases it, on the day of its latest held chance; a held chance on a later day moves the held day forward; a release on a day with no held chance is claimed and dropped; a release while locked waits for the unlock; a release that finds nothing open marks the day.
6. **The day close and Today in front win.** When the day close is due and not yet opening, the day close is opening the popover, the popover shows, or todz is the active app with a window on screen, the day is marked and the panel does not show. The glance's observers start after the day close's, so a chance both see decides for the day close first. When the popover opens while the panel shows, or while the panel is on its way, the panel closes the moment it is on screen; the day stays marked.
7. **A non-activating glass panel.** An `NSPanel` subclass that can never become key or main, borderless and non-activating, at the status bar level on every Space and over full-screen apps, at the top right of the screen with the menu bar (`NSScreen.screens.first`), under it. It holds the heading with what is left and up to five of Today's open tasks (title, overdue said in words), then "+N more", captured when it shows. Liquid Glass on macOS 26 and later, the regular material before. When todz is hidden, it is unhidden without activation first, because a hidden app's panel stays invisible. The panel counts as seen when its occlusion state turns visible within one second of ordering it front; otherwise it is ordered out and nothing is marked. It ignores the pointer for its first 0.4 seconds, so a click aimed at the app beneath it as it appears never lands on it.
8. **Five seconds, then it fades.** It fades out over half a second after five seconds; with Reduce Motion it disappears without the fade. While the pointer is over it, it stays, for at most 30 seconds from its appearance; the five seconds restart when the pointer leaves. It closes at once when the screen locks, the Mac goes to sleep, the owner signs out or the active workspace changes. A click anywhere on it closes it, activates the app and opens the main window on Today, through the same request a widget's Today link uses. It never takes the keyboard, so nothing typed elsewhere reaches it, and it has no keys of its own.
9. **Mirrored screens skip it.** When the screen with the menu bar is in a mirror set (`CGDisplayIsInMirrorSet`), as when presenting on a projector, the chance shows and marks nothing. Screen sharing, recording and Focus modes without the todz filter still show the titles: the window keeps its default sharing type, and the owner opts out with the switch or the filter.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A non-activating `NSPanel` (chosen) | never takes focus (spike), full control of placement and fade | the app's first panel and first glass | — |
| Open the popover | one Today surface | takes the keyboard, needs a click to close, is the day close's surface | the owner asked for a glance that fades without focus |
| A user notification | standard, Focus-aware by the system | the owner ruled out push notifications | excluded |
| A widget refresh only | no new surface | the owner has to look at the desktop | not a glance |
| A fixed morning time | predictable | fires while he is away; misses the moment he sits down | the owner said "first wake or unlock" |
| Wait for Today without a limit | never misses a day | a glance hours later, mid-work, when the network returns | not the moment he sits down |

## Consequences

- With two Macs, each glances on its own first chance of the day.
- A Mac that stays awake and unlocked across midnight shows the next day's glance only at its next launch, wake or unlock.
- On a wake, the glance shows Today as the app last knew it: the cache and the last pull, which may be minutes stale until the change feed reconnects. A glance is a reminder, not a record, so it does not wait for the pull.
- Task titles appear on screen without a click, so a screen share, a recording or a Focus without the todz filter shows them; only a mirrored menu bar screen skips the glance.
- When the owner hid todz with ⌘H and left its window open, the unhide brings the window back behind the frontmost app, as the day close does.
- Any local process can post `com.apple.screenIsUnlocked`; it only makes todz re-run the check, which re-reads the clock, the real lock state, the gate and the once-a-day mark, so it can never show the glance twice, while locked or during Focus.
- A screen unlock's delivery to the sandboxed app is proven by registration only; the first real unlock is a Human checklist row. Launch and wake already work without it, and the app switch retries a locked chance.
- A walk shows the panel on the owner's screen for five seconds per opening; walks use a launch as the trigger and keep to two openings.

## Evidence

Run-17 spike (scratch, not committed), Xcode 27.2, SDK macOS 27.2, a sandboxed `LSUIElement` app signed with the Personal Team and launched with `open -g -j`: an `NSPanel` subclass with `canBecomeKey` and `canBecomeMain` false, `[.borderless, .nonactivatingPanel]`, level `.statusBar`, `[.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]`, `hidesOnDeactivate = false`, `becomesKeyOnlyIfNeeded`, hosting SwiftUI with `glassEffect(.regular, in: .rect(cornerRadius: 18))`, showed only after `NSApp.unhideWithoutActivation()` and `orderFrontRegardless()`. The frontmost app stayed the same at show, during and after the fade, and the panel was never key. A 0.5 s alpha fade then `orderOut` at 5 s ran clean. A real click reached the SwiftUI tap without activating the app, so the handler activates it. Registering for `com.apple.screenIsUnlocked` logged no error and no sandbox denial; delivery was not tested, because locking the screen would disturb the owner. `glassEffect` needs macOS 26; the app targets macOS 14. The spike did not time the panel's occlusion change after ordering it front; the walk records it (the test plan's Showing 1), and the one-second wait for it is the build's assumption until then.

## Revisit when

The owner wants the glance only in the morning, on more than the menu bar's screen, with actions on its rows, or the unlock is found not to reach the sandboxed app.
