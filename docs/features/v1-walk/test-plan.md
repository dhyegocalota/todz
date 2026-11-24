# Test plan: The v1 walk

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/scenarios.test.ts` — input: `docs/scenarios/v1-walk.md` without its index row; expected: fails with `v1-walk: not in the index`; with the row, green
- [ ] Confirmed it fails for the right reason: the failure text recorded

## Unit

- [ ] `pnpm verify`: the `shape` gate green with the scenario file

## Prove it for real — the scenario run (ADR 0037)

One box per test of `docs/scenarios/v1-walk.md`; expected: its `Expect` line, asserted on what the app shows and what the MCP client receives.

- [ ] T1 Sign in to an empty Mac
- [ ] T2 Name the first workspace
- [ ] T3 Create a project
- [ ] T4 Create a key for the project
- [ ] T5 The agent connects
- [ ] T6 The agent adds tasks
- [ ] T7 Today and the menu bar
- [ ] T8 The widget snapshot
- [ ] T9 The owner completes a task
- [ ] T10 The agent asks what is next and completes it
- [ ] T11 The key reaches one project only
- [ ] T12 Revoke the key
- [ ] T13 Offline and back
- [ ] T14 A widget tick (owner's desktop) — BLOCKED without the owner's OK to place a widget
- [ ] Edge cases hunted, each with input and observed outcome
- [ ] The owner's session file restored byte-identical; port 8787 free; the app quit
- [ ] Report at `.pr-media/scenario-v1-walk/report.md`, frames and `walkthrough.mp4`

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: the agent's changes reach the app without a refresh — attack: <how>; result: <refuted | held>
- [ ] Claim 2: the key never reaches another project — attack: <how>; result: <refuted | held>
- [ ] Claim 3: the menu bar count follows every change in the walk — attack: <how>; result: <refuted | held>

## Coverage honesty

- T14, a widget tick, needs the owner's desktop: on the PR's Human checklist.
- The agent is a script speaking MCP, not a model; a real Claude Code session is the owner's check.
