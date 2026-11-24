# Plan: The owner's checklist notes

**Spec:** spec.md
**Tier:** 🟢
**Seam:** `HistoryList` and `CredentialSlot` in the app, one small decision in `TodzKit`
**Assumptions (decided, owner can override):**
- The counts stay as `mac-sync` O4 decided (spec, note 5).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/macos/TodzKit/Sources/TodzKit/HistoryFailure.swift` (new), its test, `apps/macos/Todz/MainWindow/Inspector/HistoryList.swift`, `apps/macos/Copy/InspectorCopy.swift`, `apps/macos/Todz/SignIn/CredentialSlot.swift`, the popover's shortcut files under `apps/macos/Todz/MenuBar/` only if note 4 reproduces, `docs/features/mac-app-shell/design.md` | `developer` |

## Sequencing

One group, after `menu-bar-count` merges (it touches the popover).

## Steps

### G1

- [ ] **Step 1:** Red: `HistoryFailureTests`: offline → `.offline`; online → `.failed`. Commit with a stub that fails with `HistoryFailure is not implemented`.
- [ ] **Step 2:** Green: `HistoryFailure.of(isOffline:)`; `HistoryList` shows `InspectorCopy.historyOffline` in the secondary style for `.offline` and today's red line for `.failed`, Try Again under both.
- [ ] **Step 3:** `CredentialSlot` focuses the identity field when it appears after a sign-out (the window may already be key, or become key later); the developer reproduces the note in a build first and states the cause in the commit.
- [ ] **Step 4:** Note 4: the developer checks in a build whether ⌘2 reaches the popover opened while another app is in front, with a real key event (`osascript` key code through System Events). If it works, no code: state it in the briefing. If not, the popover's window becomes key on open, in its own commit.
- [ ] **Step 5:** `mac-app-shell/design.md` § 1.1 and § 7 record the measured minimum, 976 × 532 (the owner's check, 2026-11-24), next to the earlier 848 and the reason it grew (the sidebar measured 308 wide with the Connect an Agent section). Tester briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | Focus stolen from the window's first responder elsewhere | Typing after launch lands nowhere or in another field | Revert the commit |
| 4 | Making the popover key steals focus from the owner's app on every open | The front app loses its text cursor when the popover opens | Revert the commit; record the note as the test driver's |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** screenshots of the offline history line and the sign-in focus.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
