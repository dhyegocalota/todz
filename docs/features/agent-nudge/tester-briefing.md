# Tester briefing: Agent nudge

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works.

## Server

Lane G1, branch `lane/agent-nudge-g1`. Everything below is a hypothesis for the tester to break.

### What changed

- `libs/core/src/due-now.ts` — `dueNow({ store, today })` returns `{ count, overdue }` from `dueWindowOf` over the open tasks; exported from `libs/core/src/index.ts`.
- `apps/api/migrations/0007_agent_nudge.sql` — `owners.agent_nudge INTEGER NOT NULL DEFAULT 0 CHECK (agent_nudge IN (0, 1))`.
- `apps/api/src/directory-owners.ts` — `storeOwnerChanges` (one `UPDATE … COALESCE … RETURNING`, replaces `updateOwnerTimeZone`), `findOwner` reads the flag; `owner-records.ts` and `owner-json.ts` carry `agentNudge` / `agent_nudge`.
- `apps/api/src/owner-account.ts` — `PATCH /owner` takes `{time_zone?, agent_nudge?}`, at least one, non-strict; an invalid zone is 422 `time_zone_invalid` even with a valid flag.
- `apps/api/src/owner-sign-in.ts` — sign-in answers the stored flag through `RETURNING`.
- `apps/api/src/directory.ts`, `project-routing.ts` — `findKeyProject` joins the flag; `KeyProject.agentNudge`.
- `apps/api/src/project-store.ts` — `dueNow({ today })` RPC beside `nextTask`.
- `apps/api/src/mcp-server.ts`, `mcp-format.ts`, `mcp-copy.ts`, `mcp-endpoint.ts` — both eras' scopes carry the flag; the `next` tool and prompt prepend `nudgeLine` plus a blank line only when the flag is on and `count > 0`; a `dueNow` that throws or answers `{ok: false}` leaves `next` as before. No acronyms or defaults added.

### How to run

```bash
pnpm --filter @todz/core test
cd apps/api && pnpm exec vitest run
pnpm typecheck
pnpm verify
```

Local server with an owner whose flag is on (the app is not needed):

```bash
cd apps/api
pnpm exec wrangler d1 migrations apply DIRECTORY --local
pnpm exec wrangler dev
```

Sign in as a fake-provider owner (the dev provider is `SIGN_IN_PROVIDER=fake`, set in `wrangler.jsonc`/`.dev.vars` as the existing sign-in tests do), then turn the flag on:

```bash
curl -s -X POST http://localhost:8787/owner/sessions -H 'Content-Type: application/json' -d '{"identity_token":"maria","time_zone":"UTC"}'
curl -s -X PATCH http://localhost:8787/owner -H 'Content-Type: application/json' -H 'Authorization: Bearer <session_token>' -d '{"agent_nudge":true}'
```

Expected: `{"owner":{"id":"…","time_zone":"UTC","agent_nudge":true}}`. Then create a workspace and a key (`POST /owner/workspaces`, `POST /owner/projects/<id>/keys`), add three tasks due today and yesterday, and reach the MCP endpoint from Claude Code:

```bash
claude mcp add --transport http todz-local http://localhost:8787/mcp --header "Authorization: Bearer <project key>"
```

Then ask the session to call `next` (or run the `next` prompt). When Claude Code cannot reach the local server, use the MCP SDK client the way `apps/api/test/mcp-client.ts` does.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `libs/core/src/due-now.test.ts` (5 tests, commit `edbacea`) | printed `Error: dueNow is not implemented` on all 5 | `dueNow` counts the open tasks whose window is Overdue or Today (`7f04fad`) |
| `apps/api/test/owner-sign-in.test.ts`, `directory.test.ts`, `owner-json.test.ts`, `project-routing.test.ts` (commit `2e5e0e8`, 26 red) | `D1_ERROR: no such column: agent_nudge`; `AssertionError: expected { …(2) } to deeply equal { …(3) }` (no `agent_nudge` in the answer); `expected 400 to be 200` for `PATCH {agent_nudge: true}`; `expected [Function] to throw error including 'CHECK constraint failed' but got 'D1_ERROR: no such column: agent_nudge…'` | migration 0007, the flag in every `owner` object, the partial PATCH, `findKeyProject` (`8473453`) |
| `apps/api/test/mcp-format.test.ts` nudge line (commit `c709d2f`, 7 red) | `Error: nudgeLine is not implemented`, `Error: nudgedText is not implemented` | `nudgeLine` and `nudgedText` (`d838961`) |
| `apps/api/test/mcp-nudge.test.ts`, `mcp-isolation.test.ts` flag-on tests (commit `c709d2f`, 12 red) | `AssertionError: expected 'T-1 Task 1 · due 2026-11-25' to be 'Today here: 1 due. Start with T-1?\n\n…'` (the line is missing); likewise for the overdue forms, the isolation probe and the title probe | the `next` tool and prompt prepend the line (`d838961`) |

Pins (green when they landed, never red-first): in `mcp-nudge.test.ts` the flag off with a task due today, the flag on with only upcoming and undated tasks, the flag on with no tasks, `list`/`add`/`update`/`done` carrying no line, and both `dueNow` failure cases (throws, `{ok: false}`); in `mcp-format.test.ts` nothing else. The failure cases pass at the red commit only because the line did not exist yet; they guard the green code.

Counts at `d838961`: `libs/core` 258 tests (Vitest); `apps/api` 1665 tests in 64 files; `pnpm verify`: 8 gates green at `d838961` (product), e2e 46 passed, 2 skipped.

### Hypotheses to attack

1. Hypothesis: with the flag off, every `next` text (tool and prompt, both eras) is byte for byte what it was. Break it by: running the old `mcp-tools.test.ts` pins against a flag-on owner with nothing due, and a flag-off owner with tasks due.
2. Hypothesis: the line never names a title and never crosses a project. Break it by: a task titled with an instruction or a `T-99` string in project B due today, and a key of project A; read the whole first line.
3. Hypothesis: `PATCH /owner` with `{time_zone}` alone never changes the flag and `{agent_nudge}` alone never changes the zone, and sign-in does not reset the flag. Break it by: alternating the two bodies and signing in again with a different zone, reading `GET /owner` each time.
4. Hypothesis: `PATCH {}`, `{agent_nudge: "yes"}`, `1` and `null` answer 400 and store nothing; `{time_zone: "Mars/Base", agent_nudge: true}` answers 422 and stores nothing. Break it by: reading the row after each.
5. Hypothesis: the line's task is the task `next` shows. Break it by: adding tasks between the two project calls, or many overdue tasks with equal due dates.
6. Hypothesis: the timezone of the owner decides what is due today for the count too. Break it by: an owner in `Pacific/Kiritimati` and a task due on the UTC date.

### Known gaps

- `dueNow` and `nextTask` are two RPCs, so a task completed between them can name a task that is no longer due; the answer still shows the same task the line names.
- The `ProjectStore.dueNow` RPC has no direct test beside `project-store.test.ts`; it is covered through the MCP tests in `mcp-nudge.test.ts`.
- A real Claude Code walk was not run (the tester does it).
- READMEs, the runbook row for migration 0007 and screenshots are lane G3's.
