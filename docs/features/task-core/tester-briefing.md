# Tester briefing: Task core

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `libs/types/src/task.ts` — the task enums and constants of the spec tables, plus `RuleIssue.TaskNumberInvalid` (see Known gaps).
- `libs/core` — new package `@todz/core`: `task.ts`, `ports.ts`, `errors.ts`, `short-id.ts`, `calendar-date.ts`, `order-key.ts`, `task-text.ts`, `actor.ts`, `add-tasks.ts`, `update-task.ts`, `complete-tasks.ts`, `reopen-tasks.ts`, `list-tasks.ts`, `next-task.ts`, `index.ts`.
- `libs/core` internal helpers — `batch-size.ts`, `find-batch-tasks.ts`, `project-tasks.ts`; test-only: `in-memory-task-store.ts`, `test-support.ts` (neither exported from the index).
- `libs/README.md`, `AGENTS.md` layout, `libs/types/README.md`, `libs/core/README.md`, `tools/repository-shape/src/delivery-docs.test.ts` (`FEATURE_PACKAGES`), `pnpm-lock.yaml`.

## How to run

```bash
pnpm --filter @todz/types test:unit
pnpm --filter @todz/core test:unit
pnpm typecheck
pnpm --filter @todz/repository-shape test:unit
```

## Red today, green after

Red commits carry the failure text in their body; the run printed these.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `libs/types/src/task.test.ts` (c4cfb1d) | `AssertionError: expected {} to deeply equal { Open: 'open', Done: 'done' }` (8 tests; no stub possible for enums, so `pnpm typecheck` was red on that commit) | 1bf20ab |
| `libs/core/src/short-id.test.ts` (8aa2f21) | `Error: formatShortId is not implemented`, `Error: parseShortId is not implemented` (14 tests) | 2165104 |
| `libs/core/src/calendar-date.test.ts` (f09c92b) | `Error: parseCalendarDate is not implemented`, `Error: dueWindowOf is not implemented` (21 tests) | e9b5a3f |
| `libs/core/src/order-key.test.ts` (052afad) | `Error: orderKeyBetween is not implemented` (9 tests), `AssertionError: expected error to be instance of RangeError` (2 tests) | 105cf51 |
| `libs/core/src/task-text.test.ts` (1c52dd2) | `Error: <normalizer or textMatches> is not implemented` (30 tests) | b986e07 |
| `libs/core/src/actor.test.ts` (ef80c47) | `Error: agentActor is not implemented` (7 tests; the `OWNER_ACTOR` test is a pin) | 7b349c1 |
| `libs/core/src/add-tasks.test.ts` and the `normalizeDueDate` tests in `calendar-date.test.ts` (c9313b0) | `Error: addTasks is not implemented`, `Error: normalizeDueDate is not implemented` (22 tests) | e898149 |
| `libs/core/src/update-task.test.ts` (52f97c6) | `Error: updateTask is not implemented` (29 tests) | 250ae6a |
| `complete-tasks.test.ts`, `reopen-tasks.test.ts` (c2f0481) | `Error: completeTasks is not implemented`, `Error: reopenTasks is not implemented` (20 tests); the `TaskNumberInvalid` line in `libs/types/src/task.test.ts` is a pin | b331cde |
| `libs/core/src/list-tasks.test.ts` (219c477) | `Error: listTasks is not implemented` (14 tests) | 0ba8df6 |
| `libs/core/src/next-task.test.ts` (439fc95) | `Error: nextTask is not implemented` (8 tests) | 4890929 |

Pins (green on arrival): `in-memory-task-store.test.ts` (c68026b), `index.test.ts` (a853a18), the `OWNER_ACTOR` test.

## Hypotheses to attack

1. Hypothesis: `orderKeyBetween` returns a key strictly between any two valid keys. Break it by: keys at the head boundaries (`az`, `b00`, `Zz`, `A` plus 26 zeros), a fraction ending in `V` against `a0`, other seeds.
2. Hypothesis: a use case that throws has written nothing. Break it by: a store whose `insertTask` throws on the second task of a batch (the error must propagate unchanged), and a draft that is invalid only in its last position.
3. Hypothesis: error messages never carry task text. Break it by: sentinel text in titles, notes, completion notes and search text, for every error path including `TaskNotFoundError`.
4. Hypothesis: `updateTask` keeps the order key when it already lies between the new neighbours, so a no-op placement writes nothing. Break it by: placements next to done tasks, `Before` the first task, `After` the last.
5. Hypothesis: `[k1, k1, no key]` numbers T-1, T-1, T-2 and a replay across calls returns the stored task unchanged. Break it by: a replay with a different actor, notes or due date.
6. Hypothesis: `clock.now()` is read once per use case. Break it by: a clock that advances on every read.
7. Hypothesis: text matching ignores case and accents. Break it by: decomposed accents typed as combining marks, `ß`, Turkish `İ`.

## Known gaps

- The spec's `RuleIssue` table has no issue for an invalid task number in a `completeTasks` or `reopenTasks` batch, yet the test plan expects a `RuleViolation` with the original `index` for `[2, 2, -1]`. I added `RuleIssue.TaskNumberInvalid = 'task_number_invalid'` (a non-positive or non-integer number). The spec table needs the same line.
- The red commit of `libs/types/src/task.test.ts` has no stub: enums cannot throw "not implemented", so `pnpm typecheck` was red on c4cfb1d only.
- `updateTask` with equal values returns the stored task without reading the clock.
- `libs/core/src/test-support.ts` and the helpers `batch-size.ts`, `find-batch-tasks.ts`, `project-tasks.ts` are files the plan's file map does not name.
- `scripts/verify-gates.tsv` maps `libs/types/*` to the gates; `libs/core/*` falls under the generic `libs/*` row (`typecheck unit`), which I did not change.
- A task that is `Done` with `completedAt` `null` makes `listTasks` throw a plain `Error`; no use case produces that state.

## Second pass: edge cases from the tester run

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `order-key.test.ts` nothing sorts below the smallest integer key (6c1fc0e) | `AssertionError: expected function to throw an error, but it didn't` | 26106bf |
| `task-text.test.ts` zero-width titles and names (cf4aa90) | `Error: expected RuleViolation` (4 tests) | 8f50de6 |
| `actor.test.ts` U+2028 and U+2029 client names (cf4aa90) | `Error: expected RuleViolation` (2 tests) | 8f50de6 |

Pins (green on arrival): largest integer key, boundary pairs, 5000 appends and prepends (6c1fc0e); mixed replay batch, done-task replay, failing `insertTask` keeping the first task, After T-150 among 299 done tasks, decomposed accents, sharp s (02986c5); search text of a lone combining mark means no filter, joined emoji title kept (cf4aa90).

### Third pass: security review

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `task-text.test.ts` control characters in titles, notes, completion notes, names (a77f259) | `Error: expected RuleViolation` (16 tests) | 61ff74d |
| `update-task.test.ts` order key over `ORDER_KEY_MAX_LENGTH` (2ccc7d7) | `Error: expected RuleViolation` | 8c7db25 |
| `update-task.test.ts` invalid `number` or `anchor` (2ccc7d7) | `TaskNotFoundError: T-1.5` / `T-NaN` / `T-0` / `T--1` (5 tests) | 8c7db25 |

Pins: the `RuleIssue` additions and `ORDER_KEY_MAX_LENGTH` (ca4a665); `limit * 2 + 1` ASCII characters for every text and the search text (a77f259); a key of exactly the limit is accepted.

Hypotheses: no title, name or note ever stores NUL, ESC, DEL or C1 characters (notes keep LF and TAB only); error messages stay free of the text; no placement can store a key longer than 1024 characters; `updateTask` rejects a non-positive-integer number or anchor before any store read.

Hypotheses (earlier passes): `orderKeyBetween` throws a RangeError whenever no key can exist; a title or name of only whitespace and format characters is empty while a joined emoji survives; only case and accents fold in `textMatches`.
