# Test plan: The v1 walk

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `tools/repository-shape/src/scenarios.test.ts` — input: `docs/scenarios/v1-walk.md` without its index row; expected: fails with `v1-walk: not in the index`; with the row, green — evidence: 469b933 in a throwaway worktree (removed): `npx vitest run src/scenarios.test.ts` printed `v1-walk: no paths` and `v1-walk: not in the index`, `Tests 1 failed | 2 passed (3)`; on cff2e71 `Tests 3 passed (3)`
- [x] Confirmed it fails for the right reason: the failure text recorded — evidence: the failure text above matches tester-briefing.md: `"v1-walk: not in the index"` plus the unquoted-paths `"v1-walk: no paths"`

## Unit

- [x] `pnpm verify`: the `shape` gate green with the scenario file — evidence: `pnpm verify all` at cff2e71: 7 gates green (doctor, format, secrets, typecheck, audit, unit 148s, macos 35s), exit 0

## Prove it for real — the scenario run (ADR 0037)

One box per test of `docs/scenarios/v1-walk.md`; expected: its `Expect` line, asserted on what the app shows and what the MCP client receives.

- [x] T1 Sign in to an empty Mac — evidence: .pr-media/scenario-v1-walk/01-t1-sign-in-a.png
- [x] T2 Name the first workspace — evidence: .pr-media/scenario-v1-walk/02-t2-workspace-a.png; status item "todz", width 33
- [x] T3 Create a project — evidence: .pr-media/scenario-v1-walk/03-t3-project-a.png
- [x] T4 Create a key for the project — evidence: .pr-media/scenario-v1-walk/04-t4-key-a.png, 04-t4-key-listed-a.png
- [x] T5 The agent connects — evidence: tools next, list, add, update, done and prompt next, none with a project or workspace argument; .pr-media/scenario-v1-walk/report.md
- [x] T6 The agent adds tasks — evidence: .pr-media/scenario-v1-walk/06-t6-agent-adds-a.png; repeat answered "Already added"
- [x] T7 Today and the menu bar — evidence: .pr-media/scenario-v1-walk/07-t7-today-a.png, 07-t7-menu-bar-a.png; "todz, 2 left today"
- [x] T8 The widget snapshot — evidence: .pr-media/scenario-v1-walk/08-t8-widget-snapshot-a.json; mode 600
- [x] T9 The owner completes a task — evidence: .pr-media/scenario-v1-walk/09-t9-owner-completes-a.png, 09-t9-menu-bar-a.png; "1 left today"
- [x] T10 The agent asks what is next and completes it — evidence: .pr-media/scenario-v1-walk/10-t10-agent-done-a.png, 10-t10-menu-bar-a.png
- [x] T11 The key reaches one project only — evidence: .pr-media/scenario-v1-walk/11-t11-inbox-a.png, 11-t11-launch-a.png, 11-t11-done-a.png; "T-99 not found."
- [x] T12 Revoke the key — evidence: .pr-media/scenario-v1-walk/12-t12-revoked-a.png; 401 on the existing session and on a fresh connect
- [x] T13 Offline and back — evidence: .pr-media/scenario-v1-walk/13-t13-offline-a.png, 13-t13-back-online-a.png
- [ ] T14 A widget tick (owner's desktop) — BLOCKED: no owner OK to place a widget on the desktop; stays on the Human checklist
- [x] Edge cases hunted, each with input and observed outcome — evidence: .pr-media/scenario-v1-walk/report.md; six cases, see the section below
- [x] The owner's session file restored byte-identical; port 8787 free; the app quit — evidence: shasum 6d7f01fe1587e5a5d549fb7c6b8bd0750de9115c before and after; app quit, wrangler stopped, 8787 and 9797 free
- [x] Report at `.pr-media/scenario-v1-walk/report.md`, frames and `walkthrough.mp4` — evidence: .pr-media/scenario-v1-walk/report.md, walkthrough.mp4 (12 frames of the window)

## Edge cases found during execution

- Server limit versus the scenario: a title of 500 characters is rejected (`Task 1: The title is longer than 200 characters.`) and nothing is added, so the edge case "the app wraps it" is unreachable at 500; a 200-character title with Markdown notes is added, wraps to two lines with an ellipsis and the count stays right. The scenario file should say 200.
- `done` on an already done task: "Already done T-1 ...", nothing changed twice.
- Sign out mid-walk and in again: icon only while signed out; Acme, Launch, 4 open tasks and "2 left today" returned.
- Second workspace "Globex" active: icon only; ⌘1 from the popover (one opening) back to Acme: "2 left today".
- App quit while B added: the task is there after relaunch.
- A fresh connect with the revoked key: refused.
- Observation: the inspector keeps a task that is not in the list after switching screens; in the Inbox, `set-value` plus Return did not submit while typed text plus Return did (tooling artefact, not reproduced by hand).

## Adversarial review

- [x] Claim 1: the agent's changes reach the app without a refresh — attack: B added three tasks, the app read right after; result: held — evidence: B added three tasks and the app listed them with no refresh before the next read; held
- [x] Claim 2: the key never reaches another project — attack: list by text, update T-99, update T-1 beside an Inbox T-1; result: held — evidence: B list open and done with text "domain", update T-99 and T-1 against an Inbox T-1; Inbox untouched; held
- [x] Claim 3: the menu bar count follows every change in the walk — attack: read the status item after each step; result: held — evidence: status item read after add (2), complete (1), done by agent (icon only), sign out, relaunch, workspace switch; held

## Coverage honesty

- T14, a widget tick, needs the owner's desktop: on the PR's Human checklist.
- The agent is a script speaking MCP, not a model; a real Claude Code session is the owner's check.
