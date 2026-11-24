# The owner's checklist notes

**Status:** Approved
**Tier:** 🟢
**Owner approval:** approved 2026-11-24, by inheritance from [the v1 product design](../../product/README.md) ("simple, fast, polished"; "It must feel like Apple made it"). The notes come from the owner's Human checklists of PRs #5–#10, run at his request on 2026-11-24; how each is answered is the loop's call, listed in the loop's questions for the owner
**ADRs:** none (no decision with alternatives beyond the ones recorded below)
**Not changing:** the counts (an add waiting to send counts once the server confirms it, as `mac-sync` O4 and `menu-bar/design.md` § 1.3 decided), the server, sync, the widgets

## Problem

The owner's checklist run passed every box, with five notes:

1. The main window's minimum is 976 × 532 on his Mac, while `mac-app-shell/design.md` says 848 × 532.
2. Offline, the inspector's history says "Couldn't load the history." in red, which reads as a fault although nothing is wrong but the connection.
3. After Sign Out, the identity field is not focused: the owner must click it before typing.
4. ⌘2 typed in the menu bar popover, opened while another app was in front, did not switch workspaces (maybe the test driver).
5. Offline, the sidebar's Inbox count stayed at 2 while 3 rows showed: the third was an add waiting to send.

## Goals

- (1) The design records the measured minimum, 976 × 532, and why it grew.
- (2) While the app is offline, a history that could not load shows a secondary-colour line, "History shows when todz is back online.", and Try Again; online failures keep today's red line.
- (3) The sign-in screen focuses the identity field whenever it appears, after a sign-out included.
- (4) ⌘1–⌘9 in the popover switch workspaces when the popover was opened while another app was in front; if a real key press already works, the note is closed with the evidence and no code.
- (5) No change: the count follows the server's tasks, and a waiting add shows its dashed circle. Recorded for the owner to overturn.

## Non-goals

- Any other copy, layout or count change.

## Design

### Data flow

(2) `HistoryList` reads `model.isOffline` with the history's `.failed` state and picks the line. (3) `CredentialSlot` asks for focus when it appears and again once its window is key, whichever comes later. (4) The popover's workspace shortcuts are checked with a real key event; a fix, if needed, makes the popover's window key when it opens.

### Interfaces

- `InspectorCopy.historyOffline`: "History shows when todz is back online."

### Failure handling

Unchanged.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Should the counts include adds waiting to send? | Count once confirmed (today) / count every row shown | Loop's call: keep "once confirmed", already decided in `mac-sync` O4 and `menu-bar` § 1.3; listed in the loop's questions for the owner | 2026-11-24 |
| The offline history line's colour and words | Secondary text with Try Again / hide the section offline | Loop's call: secondary text with Try Again, so the owner can retry the moment the connection returns | 2026-11-24 |

## Test strategy summary

The app target has no test target, so (2) and (3) are proven by the walk, and any model decision they need moves into `TodzKit` with a unit test. The walk: sign out and type at once; go offline, select a task whose history is not cached, read the line; open the popover while another app is in front and press ⌘2 with a real key event; resize the window to its minimum and measure.
