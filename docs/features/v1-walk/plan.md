# Plan: The v1 walk

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `docs/scenarios/` and the `/scenario` skill
**Assumptions (decided, owner can override):**
- ADR 0037: Orca for the app, an MCP client for the agent, T14 BLOCKED without the owner.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `docs/scenarios/v1-walk.md`, `docs/scenarios/README.md`, `.agents/skills/scenario/SKILL.md` | lead |
| G2 | the run: `.pr-media/scenario-v1-walk/` (git-ignored), this folder's `test-plan.md` | `tester` |

## Sequencing

G1, then G2 once `menu-bar-count` is merged, so T7 and T9 can assert the count.

## Steps

### G1

- [ ] **Step 1:** The scenario file and its index row; `pnpm verify` runs `scenarios.test.ts` green.
- [ ] **Step 2:** The skill's paragraph for `Surface: macOS app`.

### G2

- [ ] **Step 3:** A fresh `tester` runs `/scenario v1-walk` against `main` with `menu-bar-count` merged, writes the report, and copies its table into `test-plan.md`.
- [ ] **Step 4:** Every FAIL becomes a fix feature with a regression test; the run is repeated for the failed tests after the fix.
- [ ] **Step 5:** README: the walk's shots that the gallery lacks (the agent's tasks in Launch, Today with the count) replace or join the gallery's cells.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | The owner's session is lost | `shasum` of the session file differs at the end | Restore from the scratchpad copy taken in Setup |
| 3 | The run pops windows over the owner's work | The owner says so, or the popover is opened in a loop | Stop the run; continue only the tests that need no popover |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** the lead wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent ran the scenario and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** the run's frames as the PR's screenshots and video (ADR 0026).
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
