# Test plan: Task core

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Fixtures: a fixed `Clock` at `1_764_000_000_000`, `today` = `2026-11-23`, an empty in-memory store unless stated.

## The failing test first

- [ ] Every module of steps 1 and 3 to 12 has a test commit that precedes its implementation commit in `git log`, and the red run of each fails on a named assertion or on `<name> is not implemented`, recorded in `tester-briefing.md`
- [ ] Spot check in a throwaway worktree: check out the red commit of `orderKeyBetween` and of `addTasks`, run their tests; expected: they fail with the text the briefing records

## Unit

### Types

- [ ] `libs/types/src/task.test.ts` — input: the enums and constants; expected: every value equals the spec's tables

### Short id

- [ ] `formatShortId(12)` → `'T-12'`
- [ ] `parseShortId` of `'T-12'`, `' t-12 '` → `12`
- [ ] Edge: `parseShortId` of `'T-0'`, `'T-012'`, `'12'`, `'T12'`, `'T-'`, `'T-1.5'`, `'T--1'`, `'T-1000000000'`, `''` → `null`

### Calendar date

- [ ] `parseCalendarDate('2026-11-23')` → `'2026-11-23'`; `'2028-02-29'` → valid (leap year)
- [ ] Edge: `'2026-02-29'`, `'2026-13-01'`, `'2026-11-31'`, `'2026-1-5'`, `'2026-11-23T00:00'`, `''`, `'2100-02-29'` → `null`
- [ ] `dueWindowOf` with today `2026-11-23`: `null` → `Undated`, `2026-11-22` → `Overdue`, `2026-11-23` → `Today`, `2026-11-24` → `Upcoming`
- [ ] Edge: month and year ends: today `2026-12-31`, due `2027-01-01` → `Upcoming`; today `2027-01-01`, due `2026-12-31` → `Overdue`; today `2026-02-28`, due `2026-03-01` → `Upcoming`

### Order key

- [ ] `orderKeyBetween({ before: null, after: null })` → a non-empty key
- [ ] Keys before the first, after the last and between two neighbours sort strictly between their bounds as plain strings
- [ ] Seeded property: a thousand random insertions (first, last, between two random neighbours) keep the list strictly increasing, every key matches `^[0-9a-z]*[1-9a-z]$`, no two keys equal
- [ ] A thousand insertions always at the front keep every key under 40 characters
- [ ] Edge: `before` equal to `after`, or `before` greater than `after` → throws

### Text

- [ ] `normalizeTitle('  Fix\n the   login ')` → `'Fix the login'`
- [ ] Edge: `normalizeTitle('   ')` → `RuleViolation` `TitleEmpty`; 201 code points → `TitleTooLong`; 200 emoji (400 UTF-16 units) → accepted
- [ ] `normalizeNotes(null)`, `normalizeNotes('  \n ')` → `null`; `'a\r\nb'` → `'a\nb'`; `'    code'` kept with its leading spaces; 20 001 code points → `NotesTooLong`
- [ ] `normalizeCompletionNote` of 2 001 code points → `CompletionNoteTooLong`
- [ ] `normalizeName('  Logic   Bit ')` → `'Logic Bit'`; `''` → `NameEmpty`; 81 code points → `NameTooLong`

### Actor

- [ ] `agentActor(' Claude Code ')` → `{ kind: Agent, clientName: 'Claude Code' }`
- [ ] Edge: `''`, 65 code points, a name with `\n` or `\u0000` → `RuleViolation` `ClientNameInvalid`

### addTasks

- [ ] One draft → task `T-1`, `Open`, `createdBy` the actor, `createdAt` = `updatedAt` = the clock, `completedAt` `null`, one `Created` history line with empty fields, `replayed: false`
- [ ] Three drafts → `T-1`, `T-2`, `T-3` in draft order with strictly increasing order keys
- [ ] After `T-1`..`T-3` exist (one done), a new draft → `T-4`, with an order key above every existing key
- [ ] Idempotency: the same draft with key `k1` added twice → the second call returns `T-1` with `replayed: true`, the store holds one task and one history line
- [ ] Idempotency: a replay whose title differs → the stored task is returned unchanged
- [ ] Idempotency: one batch with key `k1` twice → one task created, both results name it, the second `replayed: true`
- [ ] Edge: `[]` → `BatchEmpty`; 51 drafts → `BatchTooLarge`
- [ ] Edge: a batch of three whose third draft has an empty title → `RuleViolation` `TitleEmpty` with `index: 2`, and the store is empty afterwards
- [ ] Edge: due date `'2026-02-30'` → `DueDateInvalid`; idempotency key with a space or 129 characters → `IdempotencyKeyInvalid`

### updateTask

- [ ] Title change → task with the new title, `updatedAt` = the clock, one `Updated` line with `[Title]`
- [ ] Title, notes and due date in one patch → one `Updated` line with `[Title, Notes, DueDate]`
- [ ] `notes: null` and `dueDate: null` clear the fields
- [ ] A patch whose values equal the current ones → task unchanged, no write, no history line
- [ ] Placement `Before T-1` for `T-3` in `T-1, T-2, T-3` → open order `T-3, T-1, T-2`; `After`, `First`, `Last` likewise
- [ ] Placement where the task already sits (`T-2 After T-1`) → no write, no history line
- [ ] Placement with a done task between open neighbours → every key across both states stays unique
- [ ] Edge: `{}` → `NothingToUpdate`; missing task `T-9` → `TaskNotFoundError` with number 9; missing anchor → `TaskNotFoundError` naming the anchor; the task as its own anchor → `PlacementAnchorInvalid`
- [ ] Edge: updating a done task's title works and keeps it `Done`

### completeTasks and reopenTasks

- [ ] `completeTasks` of `[1, 2]` with note `'shipped in #4'` → both `Done`, `completedAt` = the clock, one `Completed` line each carrying the note
- [ ] Already done → returned with `alreadyDone: true`, no new history line, `completedAt` unchanged
- [ ] Duplicates `[2, 1, 2]` → results for `T-2`, `T-1` in that order
- [ ] Edge: `[1, 9]` where `T-9` is missing → `TaskNotFoundError` with number 9 and `T-1` still `Open`
- [ ] Edge: `[]` → `BatchEmpty`; 51 numbers → `BatchTooLarge`; a 2 001 code-point note → `CompletionNoteTooLong`
- [ ] `reopenTasks` of a done task → `Open`, `completedAt` `null`, the same order key, one `Reopened` line; an open one → `alreadyOpen: true`

### listTasks

- [ ] Open filter with no windows → open tasks in order-key order; done tasks absent
- [ ] Done filter → newest `completedAt` first, ties by number highest first
- [ ] Windows `[Overdue, Today]` with tasks due 11-22, 11-23, 11-24 and undated → the first two
- [ ] Text `'reuniao'` matches a title `'Reunião com Ana'` and notes containing `'REUNIÃO'`; `'  '` means no text filter
- [ ] Limit 2 of 5 matches → two tasks, `totalMatched: 5`
- [ ] Edge: limit `0`, `101`, `1.5` → `LimitInvalid`; 201-code-point text → `SearchTextTooLong`

### nextTask

- [ ] Empty project or only done tasks → `null`
- [ ] Overdue 11-20 (order key last), due today (order key first), undated, upcoming → the overdue task
- [ ] Two due today → the one with the lower order key
- [ ] Only undated and upcoming → the undated one with the lowest order key
- [ ] Only upcoming 11-30 and 11-25 → the 11-25 one

### Content never leaks

- [ ] Every `RuleViolation` and `TaskNotFoundError` thrown in this plan has a message that contains neither the title, the notes nor the completion note of its input (asserted with a sentinel string in each)

## E2E (Playwright specs)

Not applicable: `libs/core` has no browser or HTTP surface.

## Prove it for real — Playwright MCP

Not applicable: no UI. The tester instead runs `pnpm --filter @todz/core test:unit`, `pnpm --filter @todz/types test:unit`, `pnpm typecheck` and `pnpm verify all`.

- [ ] `pnpm verify all` green on the branch head

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- The real `TaskStore` adapter and its transaction — `project-store` owns them; the rules are proven against the in-memory store only.
- Concurrency between two requests — the caller's transaction serialises them; untestable without the runtime.
