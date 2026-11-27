# Menu bar redesign

**Status:** In review
**Tier:** 🟡 (a new pure model in TodzKit and a rebuilt popover, no server, no schema)
**Owner approval:** approved 2026-11-27 by the owner's order "Menu bar redesign" in PROMPT.md and, for what the order does not say, by inheritance from [the product document](../../product/README.md); the choices of [design § 10](design.md#10-owner-decisions) are the loop's calls under the owner's standing order to decide every call
**ADRs:** [0112](../../adr/0112-the-menu-bar-popover-leads-with-an-up-next-card-and-says-less.md)
**Not changing:** the menu bar count, the ribbon, the day temperature and the status item; the server and the owner API; the main window's task list and its row; the workspace switcher and the lock (track L of [the design](design.md#11-lock-reveals-nothing-track-l), which adds `Switch Workspace…` to the More menu after this feature), the motion tokens (track M re-points the popover to moments after this feature)

## Problem

The popover is crowded and noisy: a foot of up to six things in one line, a two-line row for every task even when the second line says nothing, an ambiguous `T-n` on the loudest edge, three stacked blocks before the first task, a flat add field unlike every other field, no keyboard path through the list, and a spinner in a blank panel while loading. The owner asked for it to be much sexier, more concise and more useful.

## Goals

- Option C of [the design](design.md#option-c-up-next-boldest-recommended): the list leads with one Up next card, and everything else is a quiet queue.
- The foot is gone: Quit, Check for Updates…, Star on GitHub and the update note live in a More menu (`…`) in the header, with a dot on the icon while an update note is pending. The Open button is an icon with ⌘O; the popover receives the updater so those items can show.
- The header answers "what is left" with a day ring and the count; at zero it closes into a check with the All done card.
- A glass composer with a `+` and a ⌘N keycap that hides while it is focused.
- Rows say less: one line by default; a second line only for overdue (red, with its word and a glyph), a project that is not the Inbox and the workspace when several show; the agent as a glyph and the client name; the id on hover and focus.
- The tasks done today sit behind a collapsed `Done today` disclosure.
- Loading is three static redacted rows; offline is a slim strip under the header; the empty, All done and Day close screens are drawn from one model.
- A keyboard path: ↓ and ↑ move through the composer, the card, the rows and `Done today`; Space completes or reopens; Return opens the window; ⌘↩ completes the Up next task from the composer; ⌘O opens todz.

## Non-goals

- Type-to-add from a focused row (a later version), a new colour, font or motion token, anything on the server.
- The lock's neutral way back in and the motion moments: other tracks.

## Design

[design.md](design.md) is the design of record: states, components, tokens, copy, accessibility and the build order (§ 7, track P). The decisions of § 10 are the loop's calls: option C, `MenuBarMetrics` for the ring, the id on hover and focus, `Done today` collapsed, the overdue glyph, ⌘O and Space-to-complete.

### Data flow

`TaskListState.of` still computes Today. `MenuBarDay` (TodzKit) takes its open tasks (lingering ones included, so a just-checked task keeps the card until the linger ends), the tasks done today, the pending count, whether the day is closing and the load state, and answers the screen, `upNext`, `queue`, the counts and the progress. The views only draw that.

### Interfaces

TodzKit gains `MenuBarDay`, `MenuBarRowMeta`, `MenuBarNavigation` (with `MenuBarFocus`) and `MenuBarNotice`. The app gains `MenuBarMoreMenu`, `MenuBarDayRing`, `MenuBarUpNext`, `MenuBarAllDone`, `MenuBarDoneToday`, `MenuBarSkeleton`, `MenuBarAgentMark`, `MenuBarRowMetaLine`, `MenuBarMetrics` and `MenuBarShortcut`; `MenuBarFoot` and `MenuBarTodayHeading` go.

### Failure handling

A load failure keeps the `FailureView` with Try Again and no composer. A banner shows under the header; offline shows the strip. Offline with no cache for the workspace is the `FailureView` as before.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| The option | A tidy, B quiet glass, C Up next | C, the loop's call | 2026-11-27 |
| Q1 to Q5, D6 | [design § 8](design.md#8-options-for-the-owner-and-open-questions) | as recommended; Q5 deferred, the loop's call | 2026-11-27 |

## Test strategy summary

Unit (TodzKit, Swift Testing): `MenuBarDay`, `MenuBarRowMeta`, `MenuBarNavigation`, `MenuBarNotice`, red first. The views have no logic beyond that and are rendered in process, light and dark ([test-plan.md](test-plan.md)); the Debug app builds. The popover is never opened on the owner's screen.
