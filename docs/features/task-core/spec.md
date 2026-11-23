# Task core

**Status:** Shipped 2026-11-23
**Tier:** 🟡
**Owner approval:** approved 2026-11-23, by inheritance from [the v1 product design](../../product/README.md) (Order of delivery, item 1), approved by the owner on 2026-11-23; the calls below that the product design does not make are listed in the loop's questions for the owner
**ADRs:** [0009](../../adr/0009-manual-order-uses-fractional-keys.md), [0010](../../adr/0010-the-task-rules-run-behind-synchronous-ports.md), [0011](../../adr/0011-due-dates-are-calendar-dates-and-the-caller-names-today.md)
**Not changing:** no Worker, no storage adapter, no HTTP or MCP surface, no app; those are `project-store`, `mcp-server`, `owner-api` and the macOS features

## Problem

The MCP server and the owner API must apply the same task rules: what a valid title is, how a short id reads, where a new task lands in the manual order, what a history line records, which task is "next", which tasks a filter matches. Written twice, they drift, and an agent and the owner would see the same project behave differently.

## Goals

- `libs/core` holds the task and project rules behind a `TaskStore` and a `Clock` port, with no runtime dependency and no I/O of its own.
- `libs/types` holds the enums and limits those rules name, so every package uses the same words.
- Every use case validates its whole input before it writes anything, so a batch is all or nothing inside the caller's transaction.
- Errors carry an issue code and a task number, never a title, notes or a completion note, so a logged error never leaks task content.

## Non-goals

- Storage, the change feed, sync, keys, sessions: later features.
- Deleting a task: the product design names no delete; it is a question for the owner.
- Rendering history lines or tool output: the MCP server and the app own their words.
- "Done today": the app works it out from `completedAt` in its own zone; the MCP `list` tool filters by state, due window and text only.

## Design

### Data flow

```
caller (MCP tool, owner API)            libs/core                      TaskStore port
  opens its storage transaction ──▶ use case({ store, clock, actor, input })
                                      validate whole input ── RuleViolation ──▶ caller maps to its error
                                      read through the port ◀──────────────────── findTask / listTasks / ...
                                      compute (order key, history, next, filter)
                                      write through the port ──────────────────▶ insertTask / replaceTask / appendHistory
  commits ◀──────────────────────────  returns plain values
```

### Interfaces

Enums and constants in `libs/types` (`src/task.ts`):

| Name | Values |
|---|---|
| `TaskState` | `Open = 'open'`, `Done = 'done'` |
| `ActorKind` | `Owner = 'owner'`, `Agent = 'agent'` |
| `TaskField` | `Title = 'title'`, `Notes = 'notes'`, `DueDate = 'due_date'`, `Order = 'order'` |
| `HistoryAction` | `Created = 'created'`, `Updated = 'updated'`, `Completed = 'completed'`, `Reopened = 'reopened'` |
| `DueWindow` | `Overdue = 'overdue'`, `Today = 'today'`, `Upcoming = 'upcoming'`, `Undated = 'undated'` |
| `TaskPlacement` | `First = 'first'`, `Last = 'last'`, `Before = 'before'`, `After = 'after'` |
| `RuleIssue` | `TitleEmpty`, `TitleTooLong`, `NotesTooLong`, `CompletionNoteTooLong`, `DueDateInvalid`, `BatchEmpty`, `BatchTooLarge`, `IdempotencyKeyInvalid`, `ClientNameInvalid`, `NothingToUpdate`, `PlacementAnchorInvalid`, `SearchTextTooLong`, `LimitInvalid`, `NameEmpty`, `NameTooLong`, `TaskNumberInvalid`, `TitleInvalid`, `NotesInvalid`, `CompletionNoteInvalid`, `NameInvalid`, `OrderKeyTooLong` (string values in snake case) |

| Constant | Value |
|---|---|
| `TASK_SHORT_ID_PREFIX` | `'T-'` |
| `TASK_TITLE_MAX_LENGTH` | `200` |
| `TASK_NOTES_MAX_LENGTH` | `20_000` |
| `COMPLETION_NOTE_MAX_LENGTH` | `2_000` |
| `IDEMPOTENCY_KEY_MAX_LENGTH` | `128` |
| `CLIENT_NAME_MAX_LENGTH` | `64` |
| `TASK_BATCH_MAX_SIZE` | `50` |
| `LIST_LIMIT_MAX` | `100` |
| `SEARCH_TEXT_MAX_LENGTH` | `200` |
| `NAME_MAX_LENGTH` | `80` |
| `INBOX_PROJECT_NAME` | `'Inbox'` |
| `ORDER_KEY_MAX_LENGTH` | `1_024` |

Lengths count Unicode code points, not UTF-16 units. A text whose UTF-16 length is more than twice its limit is rejected as too long before it is read further, so an oversized input costs no more than its length check.

Values in `libs/core`:

```ts
type CalendarDate = string & { readonly calendarDate: unique symbol };
type Actor = { kind: ActorKind.Owner } | { kind: ActorKind.Agent; clientName: string };
type Task = {
  number: number;
  title: string;
  notes: string | null;
  dueDate: CalendarDate | null;
  state: TaskState;
  orderKey: string;
  idempotencyKey: string | null;
  createdBy: Actor;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};
type HistoryEntry = { at: number; actor: Actor; action: HistoryAction; fields: TaskField[]; note: string | null };
type TaskDraft = { title: string; notes: string | null; dueDate: string | null; idempotencyKey: string | null };
type Placement =
  | { kind: TaskPlacement.First }
  | { kind: TaskPlacement.Last }
  | { kind: TaskPlacement.Before; anchor: number }
  | { kind: TaskPlacement.After; anchor: number };
type TaskPatch = { title?: string; notes?: string | null; dueDate?: string | null; placement?: Placement };
type TaskFilter = { state: TaskState; dueWindows: DueWindow[]; text: string | null; limit: number };
```

A `CalendarDate` is `YYYY-MM-DD` (ADR 0011). A task's `number` is its short id `T-<number>`, unique per project and never reused. `orderKey` follows ADR 0009. Instants are epoch milliseconds in server time.

Ports (ADR 0010):

```ts
interface TaskStore {
  findTask(number: number): Task | null;
  findTaskByIdempotencyKey(idempotencyKey: string): Task | null;
  listTasksInState(state: TaskState): Task[];
  lastIssuedTaskNumber(): number | null;
  insertTask(task: Task): void;
  replaceTask(task: Task): void;
  appendHistory({ number, entry }: { number: number; entry: HistoryEntry }): void;
}
interface Clock { now(): number }
```

`lastIssuedTaskNumber` is the highest number ever issued in the project, kept by the store even if a task stops existing, and `null` before the first task; the first number is 1.

Functions:

| Function | Rule |
|---|---|
| `formatShortId(number)` | `T-<number>` |
| `parseShortId(text)` | trims; `T-<digits>` in either case, no leading zero, at least 1, at most 999 999 999 → the number; anything else → `null` |
| `parseCalendarDate(text)` | `YYYY-MM-DD` that names a real day (leap years included) → `CalendarDate`; anything else → `null` |
| `dueWindowOf({ dueDate, today })` | `null` → `Undated`; before → `Overdue`; equal → `Today`; after → `Upcoming` |
| `orderKeyBetween({ before, after })` | a key strictly between the two (either may be `null` for an open end), in the scheme of ADR 0009; throws a `RangeError` when `before >= after`, a programmer error no user input can reach |
| `normalizeTitle(text)` | trims, turns every whitespace run (newlines included) into one space; empty, or only whitespace and format characters such as a zero-width space → `TitleEmpty`; a control character left after that (NUL, ESC, DEL, C1) → `TitleInvalid`; over the limit → `TitleTooLong` |
| `normalizeNotes(text)` | `null` or blank → `null`; CRLF → LF; otherwise kept as written; a control character other than LF and tab → `NotesInvalid`; over the limit → `NotesTooLong` |
| `normalizeCompletionNote(text)` | as notes, with its own limit → `CompletionNoteInvalid`, `CompletionNoteTooLong` |
| `normalizeIdempotencyKey(text)` | `null` → `null`; otherwise it must match `^[A-Za-z0-9._:-]{1,128}$` exactly, with no trimming and case kept → the key; anything else → `IdempotencyKeyInvalid` |
| `normalizeName(text)` | project and workspace names: as a title, with `NAME_MAX_LENGTH` → `NameEmpty`, `NameInvalid`, `NameTooLong` |
| `agentActor(clientName)` | trims; 1 to `CLIENT_NAME_MAX_LENGTH` code points, no control characters and no line or paragraph separators → `Actor`; otherwise `ClientNameInvalid` |
| `OWNER_ACTOR` | `{ kind: ActorKind.Owner }` |
| `normalizeDueDate(text)` | `null` → `null`; a text `parseCalendarDate` accepts → the `CalendarDate`; anything else → `DueDateInvalid` |
| `textMatches({ text, search })` | whether the folded search (case and accents removed, as `listTasks` does) occurs in the folded text |

Use cases, each taking one named object:

| Use case | Rule |
|---|---|
| `addTasks({ store, clock, actor, drafts })` → `{ task, replayed }[]` | 1 to `TASK_BATCH_MAX_SIZE` drafts, every draft validated first, replayed or not (the error's `index` is the draft's position). A draft whose idempotency key already names a task returns that task unchanged with `replayed: true`; the same key twice in one batch creates one task and the repeat takes no number (`[k1, k1, no key]` → `T-1`, `T-1`, `T-2`). New tasks get the next numbers in draft order, `Open`, an order key after the highest key of the project, and one `Created` history line with empty fields. |
| `updateTask({ store, clock, actor, number, patch })` → `Task` | `number` and an anchor not a positive integer → `TaskNumberInvalid`; an empty patch → `NothingToUpdate`; a new order key longer than `ORDER_KEY_MAX_LENGTH` → `OrderKeyTooLong`; a missing task or anchor → `TaskNotFoundError`; the task itself as anchor → `PlacementAnchorInvalid`. A placement computes neighbours among every task of the project (both states) in key order, excluding the moved task, so keys stay unique: `First` goes before the lowest key, `Last` after the highest, `Before`/`After` next to the anchor, and a done task may be an anchor. When the task's current key already lies between those neighbours, the key is kept and the order does not count as a change. Only fields whose value changes are written; one `Updated` history line lists them in `TaskField` order; nothing changed → no write and no history line. Done tasks can be updated. |
| `completeTasks({ store, clock, actor, numbers, note })` → `{ task, alreadyDone }[]` | 1 to `TASK_BATCH_MAX_SIZE` numbers, each a positive integer (else `TaskNumberInvalid`), duplicates collapsed in first-seen order; any missing number → `TaskNotFoundError` before anything is written. An open task becomes `Done` with `completedAt` and one `Completed` history line carrying the note; a done task is returned untouched with `alreadyDone: true` and the note is not recorded for it, so the caller can say so. |
| `reopenTasks({ store, clock, actor, numbers })` → `{ task, alreadyOpen }[]` | the mirror of `completeTasks`, without a note: `completedAt` back to `null`, the order key kept, one `Reopened` line. |
| `listTasks({ store, today, filter })` with `today: CalendarDate` → `{ tasks, totalMatched }` | tasks of `filter.state` whose due window is in `filter.dueWindows` (empty means any) and whose title or notes contain `filter.text`, compared without case or accents and nothing else folded (`ß` stays `ß`); a text that is blank, or blank once accents are removed, means no text filter; text over the limit → `SearchTextTooLong`; `limit` an integer from 1 to `LIST_LIMIT_MAX` (else `LimitInvalid`). Open tasks sort by order key, done tasks by `completedAt` newest first then number highest first. `totalMatched` counts before the limit. |
| `nextTask({ store, today })` with `today: CalendarDate` → `Task \| null` | the first open task in this ranking: due today or overdue (earliest due date, then order key); then undated (order key); then upcoming (earliest due date, then order key). |

Every write sets `updatedAt` to `clock.now()`; `clock.now()` is read once per use case.

### Failure handling

- `RuleViolation` (`issue: RuleIssue`, `index: number | null`: the position in the caller's original batch, before duplicates collapse) and `TaskNotFoundError` (`number`). Their messages name the issue or the short id only.
- Validation happens before the first write; a use case that throws has written nothing.
- A store that throws propagates unchanged; the caller's transaction rolls back.
- Enum values (`TaskPlacement`, `TaskState`, `DueWindow`) arrive typed: the caller validates untrusted input against its schema before calling, and the core does not re-check them.
- Titles, notes and names reject control characters, so text an agent stores cannot carry terminal escape sequences to the owner's terminal, logs, widgets or another agent's context.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How does `next` rank tasks? | due first / manual order only / undated first | Loop's call: due today or overdue, then undated, then upcoming; listed for the owner | 2026-11-23 |
| Can a done task be reopened? | yes / no | Loop's call: yes, keeping its place, so unchecking a box in the app works; listed for the owner | 2026-11-23 |
| Length limits for title, notes, names | the table above | Loop's call; listed for the owner | 2026-11-23 |
| Can the owner delete a task? | yes / no / archive only | Not decided: asked in the loop's questions; out of this feature | 2026-11-23 |

## Test strategy summary

Unit tests with Vitest only: there is no browser or HTTP surface. Every function and use case is tested against an in-memory `TaskStore` and a fixed `Clock`, including the batch that fails on its last item and writes nothing, the windows around month and year ends, a thousand seeded random order-key insertions, and errors that never carry task text.
