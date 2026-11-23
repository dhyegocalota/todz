# Plan: Task core

**Spec:** spec.md
**Tier:** 🟡
**Seam:** a new workspace package `@todz/core` under `libs/core`, depending only on `@todz/types`; nothing imports it yet
**Assumptions (decided, owner can override):**
- The ranking of `next`, reopening and the length limits are the loop's calls recorded in the spec and in the loop's questions.
- An in-memory `TaskStore` lives in `libs/core/src/in-memory-task-store.ts` for the tests; it is not exported from the package index.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src/task.ts`, `libs/types/src/task.test.ts`, `libs/types/src/index.ts`, `libs/types/README.md` | `developer-1` |
| G2 | `libs/core/package.json`, `libs/core/tsconfig.json`, `libs/core/vitest.config.mts`, `libs/core/README.md`, `libs/core/src/{index,task,ports,errors,short-id,calendar-date,order-key,task-text,actor,in-memory-task-store}.ts` and their `*.test.ts`, `pnpm-lock.yaml`, `libs/README.md`, `AGENTS.md` (layout line), `tools/repository-shape/src/delivery-docs.test.ts` (`FEATURE_PACKAGES`) | `developer-1` |
| G3 | `libs/core/src/{add-tasks,update-task,complete-tasks,reopen-tasks,list-tasks,next-task}.ts` and their `*.test.ts`, `libs/core/src/index.ts` exports | `developer-1` |

## Sequencing

One developer runs G1, G2 and G3 in order: G2 imports the enums of G1 and G3 builds on the primitives of G2. The package is small enough that parallel lanes would cost more in merging than they save.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### G1

- [x] **Step 1:** red: `libs/types/src/task.test.ts` pins every enum value and constant of the spec's tables; green: `libs/types/src/task.ts`, exported from `index.ts`; README names the task concepts. (red c4cfb1d, green 1bf20ab)

### G2

- [x] **Step 2:** scaffold `@todz/core` (package, tsconfig, vitest config copied from `libs/types`, workspace dependency on `@todz/types`, `pnpm install --offline`), README, `libs/README.md` row, `AGENTS.md` layout line, `FEATURE_PACKAGES`; `task.ts`, `ports.ts`, `errors.ts`, `in-memory-task-store.ts`. (c68026b)
- [x] **Step 3:** red then green: `short-id` (`formatShortId`, `parseShortId`). (red 8aa2f21, green 2165104)
- [x] **Step 4:** red then green: `calendar-date` (`parseCalendarDate`, `dueWindowOf`). (red f09c92b, green e9b5a3f)
- [x] **Step 5:** red then green: `order-key` (`orderKeyBetween`), including a seeded thousand-move property test. (red 052afad, green 105cf51)
- [x] **Step 6:** red then green: `task-text` (`normalizeTitle`, `normalizeNotes`, `normalizeCompletionNote`, `normalizeName`, the accent- and case-insensitive text match used by `listTasks`). (red 1c52dd2, green b986e07)
- [x] **Step 7:** red then green: `actor` (`agentActor`, `OWNER_ACTOR`). (red ef80c47, green 7b349c1)

### G3

- [x] **Step 8:** red then green: `addTasks`. (red c9313b0, green e898149)
- [x] **Step 9:** red then green: `updateTask`. (red 52f97c6, green 250ae6a)
- [x] **Step 10:** red then green: `completeTasks` and `reopenTasks`. (red c2f0481, green b331cde)
- [x] **Step 11:** red then green: `listTasks`. (red 219c477, green 0ba8df6)
- [x] **Step 12:** red then green: `nextTask`. (red 439fc95, green 4890929)
- [x] **Step 13:** `index.ts` exports every public function, type and error; `tester-briefing.md` written. (a853a18; briefing in the docs commit that follows)

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | the workspace link to `@todz/types` does not resolve offline | `pnpm install --offline` fails or `tsc` cannot find `@todz/types` | revert `pnpm-lock.yaml` and the package folder |
| 2 | the root-entries or README tests fail on the new package | `pnpm verify` shape gate red | add the missing README link or `FEATURE_PACKAGES` entry |
| 5 | a key generated between two keys is not strictly between them | the property test fails with the seed and the pair | fix the generator; the seed reproduces it |
| 8 | a batch writes part of its drafts before failing | the in-memory store holds tasks after a thrown `RuleViolation` | move validation before the first write |
| 9 | a placement produces a key equal to a done task's key | the uniqueness assertion over both states fails | compute neighbours over both states |
| 11 | accents or case break the text match | the `listTasks` text tests fail on `Reunião` vs `reuniao` | normalize both sides with NFD and strip marks |

**Steps with no backout:** none; nothing is deployed or migrated.

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence. — evidence: 64af690, 610e766, f58d759, 3b1fa4f
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`. — evidence: Ship-ready YES after 20585b1; adversarial review in 17e8820
- [x] **/check-ui:** not applicable: no UI.
- [x] **/open-pr:** gates passed, learnings sweep stated, PR opened. — evidence: verify 7 gates green at cbc56a5; [PR #3](https://github.com/dhyegocalota/todz/pull/3)
