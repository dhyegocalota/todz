# Test plan: The owner's checklist notes

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `HistoryFailureTests` — input: the red commit, each test run alone with `--filter`; expected: fails on the stub `HistoryFailure is not implemented` — evidence: 892249a, `--filter HistoryFailureTests`, both tests stop with `Fatal error: HistoryFailure is not implemented`, log `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/a9303f4f-a3cc-459a-9abc-cf91fed064ff/scratchpad/tester6/red1.log`; throwaway worktree removed
- [x] Confirmed it fails for the right reason: the failure text recorded from the red run — evidence: e177ba8, `--filter aHistoryThatFailsToLoadWhileOfflineIsStoredAsOffline`: `Expectation failed: harness.model.histories[firstTask] == .failed(.offline)` (actual `.failed(.failed)`), log `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/a9303f4f-a3cc-459a-9abc-cf91fed064ff/scratchpad/tester6/red2.log`; matches the briefing; worktree removed

## Unit

- [x] Offline — input: `HistoryFailure.of(isOffline: true)`; expected: `.offline` — evidence: `aFailureWhileOfflineIsOffline` green at 7dc96ee, `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/a9303f4f-a3cc-459a-9abc-cf91fed064ff/scratchpad/tester6/unit.log`
- [x] Online — input: `HistoryFailure.of(isOffline: false)`; expected: `.failed` — evidence: `aFailureWhileOnlineIsFailed` green at 7dc96ee, same log
- [x] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded — evidence: 558 tests in 38 suites passed at 7dc96ee (the briefing's 546 plus main's), same log

## Prove it for real — the app (ADR 0026)

- [x] Offline history: signed in, stop `wrangler dev`, select a task whose history was never loaded; expected: the inspector's history reads "History shows when todz is back online." in secondary colour (not red), with Try Again; screenshot — evidence: `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/a9303f4f-a3cc-459a-9abc-cf91fed064ff/scratchpad/wt-notes/.pr-media/owner-check-notes/history-offline.png` (toolbar reads Offline, line in secondary colour, Try Again)
- [x] Back online: start `wrangler dev`, press Try Again; expected: the history lines load — evidence: server back, the stored offline line stayed until Try Again, then "24 Nov 2026 at 16:37, You added it" loaded and the Offline pill left, `.pr-media/owner-check-notes/history-back-online.png`
- [x] Online failure keeps the red line: with the server up, make the history route fail (a proxy answering 404 with a JSON body, a refused answer; a 500 reads as offline by design, ADR 0028, see E1); expected: "Couldn't load the history." in red with Try Again — evidence: a proxy answering 404 `{"error":"not_found"}` on `/history` shows the red line with Try Again, `.pr-media/owner-check-notes/history-online-failure.png`. A 500 does not: see edge case E1
- [x] Sign out, then type at once without clicking; expected: the typed text lands in the identity field — evidence: pass 2 at 6c76d50, Todz > Sign Out from the menu, 2 s later a real "ZZ" keystroke: field value `ZZ`, focused element the Identity field, `.pr-media/owner-check-notes/signout-focus-2.png` (pass 1 FAILED D1, fixed by 0290c98)
- [x] Launch signed out from cold, type at once; expected: the typed text lands in the identity field — evidence: cold launch, typed "coldfocus", the field value became `coldfocus`, `.pr-media/owner-check-notes/cold-launch-focus.png`. Note E2: launched with `open` from Bash the app had no visible window until activated. Pass 2 at 6c76d50 (after the D1 change): cold launch, "coldfocus" typed at once, value `coldfocus`, focused element the field, `.pr-media/owner-check-notes/cold-launch-focus-2.png`
- [x] Popover ⌘2: bring another app to the front, open the popover from the status item, press ⌘2 with a real key event; expected: the popover shows the second workspace — evidence: pass 2 at 6c76d50, Dia frontmost, status item clicked, `key code 19 using command down` moved the switcher to "Side"; `key code 20` (⌘3) moved it to "Other"; Dia stayed frontmost throughout (pass 1 FAILED D2, fixed by e3c05ad); `.pr-media/owner-check-notes/popover-cmd2-2.png` shows the window state (the popover itself is not capturable without showing the desktop)
- [x] Popover open does not steal the front app's typing beyond the popover itself: after closing the popover, the previous app gets its key focus back — evidence: Orca stayed the frontmost process while the popover was open and after closing it (System Events); the popover never took focus, which was D2's cause. Pass 2 at 6c76d50: frontmost process read "Dia" with the popover open, after ⌘2 and ⌘3, and after closing it
- [x] Window minimum: `set size` to 200 × 200 reads back 1000 × 532 (Orca agrees), every column shown, sidebar splitter 308, inspector splitter 680 — evidence: pass 2 at 6c76d50, `.pr-media/owner-check-notes/window-minimum-2.png`; `mac-app-shell/design.md` § 1.1 and § 7 now record 1000 × 532 next to the owner's 976 × 532 (the minimum follows the sidebar width), so D3 is closed as stale design. The owner's own 976 is not reproduced here

## Edge cases found during execution

- E1: a history route answering 500 reads as offline: the toolbar shows Offline and the history line is "History shows when todz is back online." (the app counts an unexpected answer as offline, `SendOutcome.unexpected`). The plan's "proxy answering 500" therefore proves the offline line, not the red one; only a refused answer (404 with a body) gives the red line. Screenshot `.pr-media/owner-check-notes/history-500-reads-offline.png`. Outcome: by design per ADR 0028, the plan wording should say 404
- E2: after `open Todz.app` from a shell the process ran with no visible window; `tell application "Todz" to activate` alone did not show it, the Window menu's "todz" item did (once shown, a second cold launch with activate showed it). Not reproduced a second time; unconfirmed
- E3: the session ended by the server (DELETE of the app's own session, then ⌘R) shows "Your session has ended. Sign in again." with the identity prefilled, and typing "late" did not land either (focused element: the window), `.pr-media/owner-check-notes/signout-401-focus.png`. Same as D1
- E4: Sign Out in the app menu signs out at once, with no confirmation dialog, so the briefing's presumed cause (the dialog still key) does not apply: the window stays key, `controlActiveState` never changes, and the new `onChange` never fires. Regression test requested from the developer (a UI-level check is not possible in the app target; a model-level focus token that changes on every sign-out would be)
- D1 (defect): the identity field is not focused after Sign Out or after a 401. Repro: sign in, app menu Todz > Sign Out, type; nothing lands. Expected: text in the Identity field. Observed: field unfocused. Evidence above
- D2 (defect): ⌘2 in the popover does nothing while another app is in front (note 4 not fixed, no code changed). Repro: Orca in front, click the status item, press ⌘2. Expected: "Side". Observed: stays "Acme". The popover needs to be key when it opens
- D3 (defect or stale design): the minimum is 1000 × 532 at 7dc96ee, not 976 × 532; `design.md` § 1.1 and § 7 record 976
- Side effect: the ⌘2 of D2 went to the frontmost app (Orca)
- D1 pass 2 (6c76d50): fixed. Sign Out from the app menu, then "ZZ" lands in the Identity field (`signout-focus-2.png`)
- E3 pass 2 (6c76d50): fixed. DELETE of the app's own session (204), then ⌘R: "Your session has ended. Sign in again." and "late" typed at once landed in the Identity field, focused element the field, `.pr-media/owner-check-notes/signout-401-focus-2.png`
- D2 pass 2 (6c76d50): fixed with Dia in front; no keystroke reached Dia
- D3 pass 2 (6c76d50): the minimum is 1000 × 532 and the design text matches
- E5: ⌘2 in the popover with Caps Lock, one try: `key code 57` sent, then `key code 19 using command down` with Dia in front; the switcher moved from "Other" to "Side". The Caps Lock state could not be read back (no Quartz module), so a synthetic key 57 may not have engaged it: unconfirmed, no failure observed; key 57 sent again to restore
- Pass 2 also: `swift test --filter WorkspaceShortcutsTests` at 06bf48c in a throwaway worktree (removed) prints `TodzKit/WorkspaceShortcuts.swift:15: Fatal error: number(forKey:) is not implemented` twice, signal 5, log `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/a9303f4f-a3cc-459a-9abc-cf91fed064ff/scratchpad/tester7/red.log`; matches the briefing. `pnpm verify all`: 7 gates green at 6c76d50, `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/a9303f4f-a3cc-459a-9abc-cf91fed064ff/scratchpad/tester7/verify.log`

## Adversarial review

- [x] Claim 1: the offline line never shows while online — attack: a failure that arrives as the app goes offline, then back online; result: held — a 500 turned the line offline together with the toolbar (E1); the stored offline line stayed until Try Again, then loaded; the red line appeared only for a refused answer while online
- [x] Claim 2: the identity field takes focus after every sign-out path — attack: Sign Out from the menu, a session ended by the server (401); result: refuted — neither path focuses the field (D1, E3); only the cold launch does
- [x] Claim 3: the popover shortcut works with a real key — attack: the owner's own key press, not a synthetic one; result: refuted with a System Events key code while another app is in front (D2); held with the app in front (synthetic, not the owner's hand)

## Coverage honesty

- The focus and popover keys are proven with synthetic key events from System Events; the owner's hand is the last check.
