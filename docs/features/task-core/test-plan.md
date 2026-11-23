# Test plan: Task core

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Fixtures: a fixed `Clock` at `1_795_446_000_000` (2026-11-23 15:00 UTC), `today` = `2026-11-23`, an empty in-memory store unless stated.

## The failing test first

- [x] Every module of steps 1 and 3 to 12 has a test commit that precedes its implementation commit in `git log`, and the red run of each fails on a named assertion or on `<name> is not implemented`, recorded in `tester-briefing.md` — evidence: git log main..HEAD at 73d5e75: red commits c4cfb1d, 8aa2f21, f09c92b, 052afad, 1c52dd2, ef80c47, c9313b0, 52f97c6, c2f0481, 219c477, 439fc95 each precede their implementation (1bf20ab, 2165104, e9b5a3f, 105cf51, b986e07, 7b349c1, e898149, 250ae6a, b331cde, 0ba8df6, 4890929)
- [x] Spot check in a throwaway worktree: check out the red commit of `orderKeyBetween` and of `addTasks`, run their tests; expected: they fail with the text the briefing records — evidence: worktrees at 052afad and c9313b0 removed after the run; order-key.test.ts 11 failed (9 "orderKeyBetween is not implemented", 2 "expected error to be instance of RangeError"); add-tasks.test.ts plus calendar-date.test.ts 22 failed with "addTasks is not implemented" and "normalizeDueDate is not implemented"; both match the briefing

## Unit

### Types

- [x] `libs/types/src/task.test.ts` — input: the enums and constants; expected: every value equals the spec's tables — evidence: libs/types/src/task.test.ts::task enums > TaskState, ActorKind, TaskField, HistoryAction, DueWindow, TaskPlacement, RuleIssue and task constants > every limit and name equals the spec, core 183/183 and types 12/12 green at 73d5e75

### Short id

- [x] `formatShortId(12)` → `'T-12'` — evidence: libs/core/src/short-id.test.ts::formatShortId > prefixes the number, core 183/183 and types 12/12 green at 73d5e75
- [x] `parseShortId` of `'T-12'`, `' t-12 '` → `12` — evidence: libs/core/src/short-id.test.ts::parseShortId > reads "T-12" as 12 and reads " t-12 " as 12, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `parseShortId` of `'T-0'`, `'T-012'`, `'12'`, `'T12'`, `'T-'`, `'T-1.5'`, `'T--1'`, `'T-1000000000'`, `''` → `null` — evidence: libs/core/src/short-id.test.ts::parseShortId > rejects "T-0", "T-012", "12", "T12", "T-", "T-1.5", "T--1", "T-1000000000", "" (one test each), core 183/183 and types 12/12 green at 73d5e75; probe: "T-\uff11\uff12" and Arabic-Indic digits also return null

### Calendar date

- [x] `parseCalendarDate('2026-11-23')` → `'2026-11-23'`; `'2028-02-29'` → valid (leap year) — evidence: libs/core/src/calendar-date.test.ts::parseCalendarDate > accepts "2026-11-23" and accepts "2028-02-29", core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `'2026-02-29'`, `'2026-13-01'`, `'2026-11-31'`, `'2026-1-5'`, `'2026-11-23T00:00'`, `''`, `'2100-02-29'` → `null` — evidence: libs/core/src/calendar-date.test.ts::parseCalendarDate > rejects "2026-02-29", "2026-13-01", "2026-11-31", "2026-1-5", "2026-11-23T00:00", "", "2100-02-29", core 183/183 and types 12/12 green at 73d5e75
- [x] `dueWindowOf` with today `2026-11-23`: `null` → `Undated`, `2026-11-22` → `Overdue`, `2026-11-23` → `Today`, `2026-11-24` → `Upcoming` — evidence: libs/core/src/calendar-date.test.ts::dueWindowOf > a task with no due date is undated, a date before today is overdue, today is today, a date after today is upcoming, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: month and year ends: today `2026-12-31`, due `2027-01-01` → `Upcoming`; today `2027-01-01`, due `2026-12-31` → `Overdue`; today `2026-02-28`, due `2026-03-01` → `Upcoming` — evidence: libs/core/src/calendar-date.test.ts::dueWindowOf > the three "month and year ends" tests, core 183/183 and types 12/12 green at 73d5e75

### Order key

- [x] `orderKeyBetween({ before: null, after: null })` → a non-empty key — evidence: libs/core/src/order-key.test.ts::orderKeyBetween > an empty list gets a non-empty key, core 183/183 and types 12/12 green at 73d5e75
- [x] Keys before the first, after the last and between two neighbours sort strictly between their bounds as plain strings — evidence: libs/core/src/order-key.test.ts::orderKeyBetween > a key before the first sorts below it, a key after the last sorts above it, a key between two neighbours sorts strictly between them, core 183/183 and types 12/12 green at 73d5e75
- [x] Seeded property: a thousand random insertions (first, last, between two random neighbours) keep the list strictly increasing as plain strings, every key matches the ADR 0009 alphabet and never ends its fraction in `0`, no two keys equal — evidence: libs/core/src/order-key.test.ts::orderKeyBetween > a thousand seeded random insertions keep the list strictly increasing in the scheme alphabet (KEY_PATTERN, no fraction ending in 0, no duplicate), core 183/183 and types 12/12 green at 73d5e75
- [x] A thousand appends and a thousand prepends each keep every key at most 6 characters — evidence: libs/core/src/order-key.test.ts::orderKeyBetween > a thousand appends / a thousand prepends keep every key at most six characters and increasing, core 183/183 and types 12/12 green at 73d5e75; probe: 5000 appends and 5000 prepends end at 4 characters
- [x] A thousand splits of the same gap keep every key under 200 characters — evidence: libs/core/src/order-key.test.ts::orderKeyBetween > a thousand splits of the same gap keep every key under two hundred characters, core 183/183 and types 12/12 green at 73d5e75; probe: 3000 splits reach 502 (lower side) and 602 (upper side) characters, still strictly between
- [x] Edge: `before` equal to `after`, or `before` greater than `after` → throws — evidence: libs/core/src/order-key.test.ts::orderKeyBetween > throws a RangeError when before is a1 and after is a1 / when before is a2 and after is a1, core 183/183 and types 12/12 green at 73d5e75

### Text

- [x] `normalizeTitle('  Fix\n the   login ')` → `'Fix the login'` — evidence: libs/core/src/task-text.test.ts::normalizeTitle > trims and collapses every whitespace run into one space, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `normalizeTitle('   ')` → `RuleViolation` `TitleEmpty`; 201 code points → `TitleTooLong`; 200 emoji (400 UTF-16 units) → accepted — evidence: libs/core/src/task-text.test.ts::normalizeTitle > a blank title is TitleEmpty, over the limit is TitleTooLong ..., the limit counts code points, so 200 emoji are accepted and 201 are not, core 183/183 and types 12/12 green at 73d5e75; probe: 200 emoji returns a 400-unit title
- [x] `normalizeNotes(null)`, `normalizeNotes('  \n ')` → `null`; `'a\r\nb'` → `'a\nb'`; `'    code'` kept with its leading spaces; 20 001 code points → `NotesTooLong` — evidence: libs/core/src/task-text.test.ts::normalizeNotes > null becomes null, "  \n " becomes null, CRLF becomes LF, indentation is kept, over the limit is NotesTooLong ..., core 183/183 and types 12/12 green at 73d5e75
- [x] `normalizeCompletionNote` of 2 001 code points → `CompletionNoteTooLong` — evidence: libs/core/src/task-text.test.ts::normalizeCompletionNote > over the limit is CompletionNoteTooLong and the message holds no note text, core 183/183 and types 12/12 green at 73d5e75
- [x] `normalizeName('  Logic   Bit ')` → `'Logic Bit'`; `''` → `NameEmpty`; 81 code points → `NameTooLong` — evidence: libs/core/src/task-text.test.ts::normalizeName > trims and collapses whitespace, a blank name is NameEmpty, over the limit is NameTooLong, core 183/183 and types 12/12 green at 73d5e75

- [x] `normalizeIdempotencyKey`: `null` → `null`; `'run-42:a.b_C'` → kept exactly; `' k1'`, `'k 1'`, `''`, `'é'`, 129 characters → `IdempotencyKeyInvalid` — evidence: libs/core/src/task-text.test.ts::normalizeIdempotencyKey > null stays null, a valid key is kept exactly, rejects " k1", "k 1", "", "é" and 129 characters, core 183/183 and types 12/12 green at 73d5e75

### Actor

- [x] `agentActor(' Claude Code ')` → `{ kind: Agent, clientName: 'Claude Code' }` — evidence: libs/core/src/actor.test.ts::agentActor > trims the client name, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `''`, 65 code points, a name with `\n` or `\u0000` → `RuleViolation` `ClientNameInvalid` — evidence: libs/core/src/actor.test.ts::agentActor > rejects "", rejects 65 characters, rejects "Claude\nCode", rejects "Claude\u0000Code", core 183/183 and types 12/12 green at 73d5e75

### addTasks

- [x] One draft → task `T-1`, `Open`, `createdBy` the actor, `createdAt` = `updatedAt` = the clock, `completedAt` `null`, one `Created` history line with empty fields, `replayed: false` — evidence: libs/core/src/add-tasks.test.ts::addTasks > one draft becomes T-1, open, created by the actor, with one Created history line, core 183/183 and types 12/12 green at 73d5e75
- [x] Three drafts → `T-1`, `T-2`, `T-3` in draft order with strictly increasing order keys — evidence: libs/core/src/add-tasks.test.ts::addTasks > three drafts take T-1, T-2, T-3 in draft order with strictly increasing order keys, core 183/183 and types 12/12 green at 73d5e75
- [x] After `T-1`..`T-3` exist (one done), a new draft → `T-4`, with an order key above every existing key — evidence: libs/core/src/add-tasks.test.ts::addTasks > a new draft after T-1 to T-3 (one done) is T-4 with an order key above every existing key, core 183/183 and types 12/12 green at 73d5e75
- [x] Idempotency: the same draft with key `k1` added twice → the second call returns `T-1` with `replayed: true`, the store holds one task and one history line — evidence: libs/core/src/add-tasks.test.ts::addTasks > the same key added twice replays the first task and writes nothing new, core 183/183 and types 12/12 green at 73d5e75
- [x] Idempotency: a replay whose title differs → the stored task is returned unchanged — evidence: libs/core/src/add-tasks.test.ts::addTasks > a replay whose title differs returns the stored task unchanged, core 183/183 and types 12/12 green at 73d5e75; probe: a replay with another actor, notes and due date also returns the stored task
- [x] Idempotency: one batch with key `k1` twice → one task created, both results name it, the second `replayed: true` — evidence: libs/core/src/add-tasks.test.ts::addTasks > one batch with key k1 twice creates one task and the repeat is replayed, core 183/183 and types 12/12 green at 73d5e75
- [x] Idempotency: `[k1, k1, no key]` → `T-1`, `T-1`, `T-2` — evidence: libs/core/src/add-tasks.test.ts::addTasks > [k1, k1, no key] numbers T-1, T-1, T-2, core 183/183 and types 12/12 green at 73d5e75
- [x] Idempotency: a replayed draft with an empty title → `TitleEmpty`; nothing written — evidence: libs/core/src/add-tasks.test.ts::addTasks > a replayed draft with an empty title is TitleEmpty and nothing is written, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `[]` → `BatchEmpty`; 51 drafts → `BatchTooLarge` — evidence: libs/core/src/add-tasks.test.ts::addTasks > an empty batch is BatchEmpty, a batch over the maximum is BatchTooLarge, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: a batch of three whose third draft has an empty title → `RuleViolation` `TitleEmpty` with `index: 2`, and the store is empty afterwards — evidence: libs/core/src/add-tasks.test.ts::addTasks > a batch whose third draft has an empty title fails with index 2 and writes nothing, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: due date `'2026-02-30'` → `DueDateInvalid`; idempotency key with a space or 129 characters → `IdempotencyKeyInvalid` — evidence: libs/core/src/add-tasks.test.ts::addTasks > an impossible due date is due_date_invalid ..., an idempotency key with a space ... / of 129 characters is idempotency_key_invalid ..., core 183/183 and types 12/12 green at 73d5e75

### updateTask

- [x] Title change → task with the new title, `updatedAt` = the clock, one `Updated` line with `[Title]` — evidence: libs/core/src/update-task.test.ts::updateTask fields > a title change returns the new title, stamps updatedAt and writes one Updated line, core 183/183 and types 12/12 green at 73d5e75
- [x] Title, notes and due date in one patch → one `Updated` line with `[Title, Notes, DueDate]` — evidence: libs/core/src/update-task.test.ts::updateTask fields > title, notes and due date in one patch write one line listing the fields in order, core 183/183 and types 12/12 green at 73d5e75
- [x] `notes: null` and `dueDate: null` clear the fields — evidence: libs/core/src/update-task.test.ts::updateTask fields > null notes and null due date clear the fields, core 183/183 and types 12/12 green at 73d5e75
- [x] A patch whose values equal the current ones → task unchanged, no write, no history line — evidence: libs/core/src/update-task.test.ts::updateTask fields > a patch whose values equal the current ones changes nothing and writes nothing, core 183/183 and types 12/12 green at 73d5e75
- [x] Placement `Before T-1` for `T-3` in `T-1, T-2, T-3` → open order `T-3, T-1, T-2`; `After`, `First`, `Last` likewise — evidence: libs/core/src/update-task.test.ts::updateTask placement > moving T-3 Before T-1 gives the open order [ 3, 1, 2 ], After, First, Last variants, core 183/183 and types 12/12 green at 73d5e75
- [x] Placement where the task already sits (`T-2 After T-1`) → no write, no history line — evidence: libs/core/src/update-task.test.ts::updateTask placement > placing a task where it already sits writes nothing, core 183/183 and types 12/12 green at 73d5e75
- [x] Placement with a done task between open neighbours → every key across both states stays unique — evidence: libs/core/src/update-task.test.ts::updateTask placement > a done task between open neighbours keeps every key unique across both states, core 183/183 and types 12/12 green at 73d5e75
- [x] Placement `First` on an open task preceded only by done tasks → it moves before them; `First` on the task holding the lowest key → no write, no history line — evidence: libs/core/src/update-task.test.ts::updateTask placement > First on an open task preceded only by done tasks moves it before them, First on the task holding the lowest key writes nothing, core 183/183 and types 12/12 green at 73d5e75
- [x] Placement `After` a done anchor → the key sits right after the anchor's key — evidence: libs/core/src/update-task.test.ts::updateTask placement > After a done anchor puts the key right after the anchor key, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: title `'  '` → `TitleEmpty`; due date `'2026-02-30'` → `DueDateInvalid`; notes of 20 001 code points → `NotesTooLong`; nothing written in each case — evidence: libs/core/src/update-task.test.ts::updateTask fields > a blank title is title_empty ..., an impossible due date is due_date_invalid ..., notes over the limit is notes_too_long and nothing is written, core 183/183 and types 12/12 green at 73d5e75
- [x] A title that normalizes to the current one (`'  Same  title '` for `'Same title'`) → no write, no history line — evidence: libs/core/src/update-task.test.ts::updateTask fields > a title that normalizes to the current one writes nothing, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `{}` → `NothingToUpdate`; missing task `T-9` → `TaskNotFoundError` with number 9; missing anchor → `TaskNotFoundError` naming the anchor; the task as its own anchor → `PlacementAnchorInvalid` — evidence: libs/core/src/update-task.test.ts::an empty patch is NothingToUpdate, a missing task is TaskNotFoundError with its number, a missing anchor is TaskNotFoundError naming the anchor, the task as its own anchor is PlacementAnchorInvalid, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: updating a done task's title works and keeps it `Done` — evidence: libs/core/src/update-task.test.ts::updateTask fields > updating a done task keeps it done, core 183/183 and types 12/12 green at 73d5e75

### completeTasks and reopenTasks

- [x] `completeTasks` of `[1, 2]` with note `'shipped in #4'` → both `Done`, `completedAt` = the clock, one `Completed` line each carrying the note — evidence: libs/core/src/complete-tasks.test.ts::completeTasks > completes every task and records the note on each Completed line, core 183/183 and types 12/12 green at 73d5e75
- [x] Already done → returned with `alreadyDone: true`, no new history line, `completedAt` unchanged, even with a note — evidence: libs/core/src/complete-tasks.test.ts::completeTasks > an already done task is returned untouched, with no new line, even with a note, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `RuleViolation.index` for an invalid number in `[2, 2, -1]` → `2`, the original position — evidence: libs/core/src/complete-tasks.test.ts::completeTasks > an invalid number is TaskNumberInvalid at its position in the original batch, core 183/183 and types 12/12 green at 73d5e75; probe: [1, 2, 0] gives task_number_invalid index 2 and writes nothing
- [x] Duplicates `[2, 1, 2]` → results for `T-2`, `T-1` in that order — evidence: libs/core/src/complete-tasks.test.ts::completeTasks > duplicates collapse in first-seen order, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `[1, 9]` where `T-9` is missing → `TaskNotFoundError` with number 9 and `T-1` still `Open` — evidence: libs/core/src/complete-tasks.test.ts::completeTasks > a missing number is TaskNotFoundError and nothing is written, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: `[]` → `BatchEmpty`; 51 numbers → `BatchTooLarge`; a 2 001 code-point note → `CompletionNoteTooLong` — evidence: libs/core/src/complete-tasks.test.ts::completeTasks > an empty batch is BatchEmpty, a batch over the maximum is BatchTooLarge, a note over the limit is CompletionNoteTooLong ..., core 183/183 and types 12/12 green at 73d5e75
- [x] `reopenTasks` of a done task → `Open`, `completedAt` `null`, the same order key, one `Reopened` line; an open one → `alreadyOpen: true` — evidence: libs/core/src/reopen-tasks.test.ts::reopenTasks > a done task becomes open, clears completedAt, keeps its order key and gets one Reopened line, an open task is returned untouched with alreadyOpen and no write, core 183/183 and types 12/12 green at 73d5e75

### listTasks

- [x] Open filter with no windows → open tasks in order-key order; done tasks absent — evidence: libs/core/src/list-tasks.test.ts::listTasks > open tasks come in order-key order and done tasks are absent, core 183/183 and types 12/12 green at 73d5e75
- [x] Done filter → newest `completedAt` first, ties by number highest first — evidence: libs/core/src/list-tasks.test.ts::listTasks > done tasks come newest completedAt first, ties by highest number first, core 183/183 and types 12/12 green at 73d5e75
- [x] Windows `[Overdue, Today]` with tasks due 11-22, 11-23, 11-24 and undated → the first two — evidence: libs/core/src/list-tasks.test.ts::listTasks > due windows Overdue and Today keep the first two of four tasks, core 183/183 and types 12/12 green at 73d5e75
- [x] Text `'reuniao'` matches a title `'Reunião com Ana'` and notes containing `'REUNIÃO'`; `'  '` means no text filter — evidence: libs/core/src/list-tasks.test.ts::listTasks > text matches titles and notes without case or accents, blank text means no text filter, core 183/183 and types 12/12 green at 73d5e75
- [x] Limit 2 of 5 matches → two tasks, `totalMatched: 5` — evidence: libs/core/src/list-tasks.test.ts::listTasks > the limit cuts the list and totalMatched counts before it, core 183/183 and types 12/12 green at 73d5e75
- [x] Edge: limit `0`, `101`, `1.5` → `LimitInvalid`; 201-code-point text → `SearchTextTooLong` — evidence: libs/core/src/list-tasks.test.ts::listTasks > the limit 0 / 101 / 1.5 is LimitInvalid, search text over the limit is SearchTextTooLong, without its text, core 183/183 and types 12/12 green at 73d5e75

### nextTask

- [x] Empty project or only done tasks → `null` — evidence: libs/core/src/next-task.test.ts::nextTask > an empty project has no next task, a project with only done tasks has no next task, core 183/183 and types 12/12 green at 73d5e75
- [x] Overdue 11-20 (order key last), due today (order key first), undated, upcoming → the overdue task — evidence: libs/core/src/next-task.test.ts::nextTask > overdue wins over due today, undated and upcoming even with the last order key, core 183/183 and types 12/12 green at 73d5e75
- [x] Two due today → the one with the lower order key — evidence: libs/core/src/next-task.test.ts::nextTask > two tasks due today go by order key, core 183/183 and types 12/12 green at 73d5e75
- [x] Only undated and upcoming → the undated one with the lowest order key — evidence: libs/core/src/next-task.test.ts::nextTask > with only undated and upcoming, the undated task with the lowest order key wins, core 183/183 and types 12/12 green at 73d5e75
- [x] Only upcoming 11-30 and 11-25 → the 11-25 one — evidence: libs/core/src/next-task.test.ts::nextTask > with only upcoming tasks, the earliest due date wins, core 183/183 and types 12/12 green at 73d5e75

### Content never leaks

- [x] Every `RuleViolation` and `TaskNotFoundError` thrown in this plan has a message that contains neither the title, the notes nor the completion note of its input (asserted with a sentinel string in each) — evidence: SENTINEL tests in add-tasks, complete-tasks, list-tasks, task-text and update-task test files (e.g. update-task.test.ts::a violation holds the issue only, never the notes) plus update-task.test.ts TaskNotFoundError message is exactly "T-9"; RuleViolation messages are the issue string only, core 183/183 and types 12/12 green at 73d5e75

## E2E (Playwright specs)

Not applicable: `libs/core` has no browser or HTTP surface.

## Prove it for real — Playwright MCP

Not applicable: no UI. The tester instead runs `pnpm --filter @todz/core test:unit`, `pnpm --filter @todz/types test:unit`, `pnpm typecheck` and `pnpm verify all`.

- [x] `pnpm verify all` green on the branch head — evidence: pnpm verify all: "verify: 6 gates green at 73d5e75 (product)"; unit core 183/183, types 12/12

## Edge cases found during execution

Found by the tester at 73d5e75 with throwaway probes outside the repo. Each unticked box needs a regression test from the developer.

- [ ] DEFECT (low, unreachable in practice): `orderKeyBetween({ before: null, after: 'A' + 26 zeros })`, the smallest integer key, → expected `RangeError` (nothing sorts below it); actual: returns `A` + 26 zeros + `V`, which sorts above `after`. The same happens when `after` is that key and `before` is any smaller one is impossible, so only the `null` form is exposed. Briefing hypothesis 1 (strictly between) fails at this boundary.
- [ ] `orderKeyBetween({ before: 'zzzzzzzzzzzzzzzzzzzzzzzzzzz', after: null })` (the largest integer) → a key strictly above it. Probe: `...zzzV` is above; held (needs a pin test)
- [ ] `orderKeyBetween` between `az` and `b00`, `Zz` and `a0`, `a0V` and `a1`, `a0` and `a0V`, `a0V` and `a0V1`: each strictly between. Probe: all held (needs a pin test)
- [ ] 5000 appends or prepends from `a0` stay at 4 characters; 3000 splits of one gap reach 502 to 602 characters and stay strictly between. Probe: held (growth is linear, so the 200-character bound in the plan is for 1000 splits only)
- [ ] Placement `After` an anchor among 299 done tasks and one open task, moved `First`, then `After` T-150 → the key is strictly between T-150 and T-151 and every key stays unique. Probe: held (needs a pin test)
- [ ] 500 alternating `After T-2` / `Before T-1` moves of one task → open order stays `[3, 1, 2]` consistent and the key stays at 2 characters. Probe: held
- [ ] Idempotency replay across calls mixed with new drafts: store holds `k1` as T-1, batch `[b, k1(other title, notes, due date, actor), k2, k2, d]` → T-2, T-1 replayed with the stored title and actor, T-3, T-3 replayed, T-4. Probe: held
- [ ] Replay of a done task by its key → the done task, `replayed: true`, store untouched. Probe: held
- [ ] A store whose `insertTask` throws on the second task of a batch → the error propagates unchanged (`boom`), but the first task stays inserted in an `InMemoryTaskStore`; atomicity rests on the caller's transaction only (as the coverage section says). Probe: confirmed, needs a pin test that documents it
- [ ] `listTasks` text of a single combining mark (`'̃'`) → folds to an empty search and matches every task; expected: decide (treat as blank, or reject). Probe: matched all 2 tasks
- [ ] `listTasks` text `'reunião'` against a title typed with a combining tilde (`'Reunião'`) and `'REUNIAO'` against it → both match. Probe: held (needs a pin test for decomposed input)
- [ ] `textMatches` of `'Straße'` against `'strasse'` → `false` (no `ß` folding); `'İstanbul'` against `'istanbul'` → `true`. Probe: matches the code; the spec says only "case or accents", so confirm `ß` is intentionally out
- [ ] `normalizeTitle` of 200 emoji → 400 UTF-16 units accepted; 201 → `TitleTooLong`; 70 family emoji (210 code points, joined) → `TitleTooLong` (code points, not graphemes). Probe: held
- [ ] `normalizeTitle('​')` (zero-width space only) → accepted as a visually empty title; expected: decide whether it is `TitleEmpty`. Probe: returned the single invisible character
- [ ] `agentActor('a b')` → accepted (line separator is not a `Cc` control character); `\u0085` and `\u007f` → `ClientNameInvalid`. Probe: matches the spec text "no control characters"; confirm `U+2028` is intended
- [ ] `parseShortId` of full-width digits (`'T-１２'`), Arabic-Indic digits, `'T-12\n34'`, `'T-1٢'` → `null`; `' t-12'` and a leading ideographic space → `12` (trim). Probe: held
- [ ] `completeTasks` with `NaN`, `Infinity`, `Number.MAX_SAFE_INTEGER + 2`, `-0` → `TaskNumberInvalid` each. Probe: held

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 2: <claim> — attack: <how>; result: <refuted | held>
- [ ] Claim 3: <claim> — attack: <how>; result: <refuted | held>

## Coverage honesty

What is not tested and why.

- The real `TaskStore` adapter and its transaction — `project-store` owns them; the rules are proven against the in-memory store only.
- Concurrency between two requests — the caller's transaction serialises them; untestable without the runtime.
