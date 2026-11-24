# Tester briefing: MCP server

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## What changed

- `apps/api/package.json`, `pnpm-lock.yaml`: `@modelcontextprotocol/server` 2.4.0 and `zod` 4.6.7 (runtime), `@modelcontextprotocol/client` 2.4.0 (dev), exact; the lockfile changes only the `apps/api` importer and its new packages
- `apps/api/migrations/0001_directory.sql`: `owners.time_zone TEXT NOT NULL CHECK (time_zone <> '')`; `0002_mcp_sessions.sql`: the `mcp_sessions` table
- `libs/types/src/constants.ts`: `PROJECT_KEY_PREFIX` (`todz_`) and `LIST_LIMIT_DEFAULT` (20)
- `apps/api/src/credential-secret.ts`: 32 random bytes as unpadded base64url
- `apps/api/src/project-keys.ts`: `issueProjectKey`, the `todz_` secret returned once, its digest stored
- `apps/api/src/directory.ts`: `findKeyProject` returns `{ projectId, timeZone }` through the owner join; `insertProjectKey`, `insertMcpSession`, `findMcpSessionClient`
- `apps/api/src/project-routing.ts`: `openKeyProject` returns a `KeyProject` `{ project, keyDigest, timeZone }`
- `apps/api/src/owner-today.ts`: `calendarDateInTimeZone` from `formatToParts`
- `apps/api/src/mcp-copy.ts`: every agent-facing string, the `McpToolName` and `McpPromptName` enums, `Record<RuleIssue, string>`
- `apps/api/src/mcp-format.ts`: the compact text answers and failure texts
- `apps/api/src/mcp-sessions.ts`: `openMcpSession` (30-day sessions) and `findSessionClientName`
- `apps/api/src/mcp-endpoint.ts`: `serveMcp`, the HTTP surface table: bearer parsing, 401, 405, era routing, the legacy session layer
- `apps/api/src/mcp-server.ts`: a fresh `McpServer` per request with the five tools and the `next` prompt; `mcp-tool-arguments.ts` (split from it past 150 lines): the zod schemas and their conversion to drafts, numbers and patches
- `apps/api/src/index.ts`: routes from a record keyed by the path; `/mcp` goes to `serveMcp`, anything else 404
- `apps/api/test/`: `directory-seed.ts` (`seedOwner(timeZone = 'UTC')`, `seedIssuedKey`, `revokeKey`), `mcp-client.ts` (real client in either era through the Worker's `fetch`), and the new suites `credential-secret`, `project-keys`, `owner-today`, `mcp-format`, `mcp-endpoint`, `mcp-tools`, `mcp-isolation`; `directory`, `project-routing`, `isolation`, `edge-cases`, `worker` follow the new shapes
- `apps/api/README.md`: the MCP server's purpose

## How to run

```bash
pnpm install
pnpm --filter @todz/api test:unit
pnpm --filter @todz/types test:unit
pnpm --filter @todz/repository-shape test:unit
pnpm typecheck
```

Last runs by the developer: `@todz/api` 244 tests in 15 files green; `@todz/types` 15; `@todz/core` 253; `@todz/repository-shape` 144; `pnpm typecheck` green; `prettier --check apps/api libs/types` clean. No SDK warning appears in the test output.

## Red today, green after

Red text is what the red run printed, never the text expected. Every red commit precedes its green commit.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| step 1: `directory.test.ts` (time zone and `mcp_sessions` constraints), `worker.test.ts` (six tables), `libs/types/src/constants.test.ts` (2) | pin, `9038c84`: green when it landed | n/a |
| `test/credential-secret.test.ts` (2), `test/project-keys.test.ts` (3), red `503c626` | `Error: generateCredentialSecret is not implemented` (2), `Error: issueProjectKey is not implemented` (2), `AssertionError: expected [Function] to throw error including 'FOREIGN KEY constraint failed' but got 'issueProjectKey is not implemented'` (1) | green `926591b` |
| `test/directory.test.ts`, `project-routing.test.ts`, `isolation.test.ts`, `edge-cases.test.ts`, `project-keys.test.ts` (42 tests in 5 files), red `64b19c3` | only `Error: findKeyProject is not implemented`, `Error: insertMcpSession is not implemented` and `Error: openKeyProject is not implemented` | green `239638a` |
| `test/owner-today.test.ts` (6), red `3d58860` | `Error: calendarDateInTimeZone is not implemented` (5), `AssertionError: expected error to be instance of RangeError` (1) | green `ee6a81b` |
| `test/mcp-format.test.ts` (16 of 38), red `9767e59` | `Error: <name> is not implemented` for `taskLine` (2), `taskBlock` (2), `listAnswer` (2), `addedAnswer`, `updatedAnswer`, `completedAnswer`, `nextAnswer` (2), `nextPromptText` (2), `failureText` (3); the 22 copy tests (one per `RuleIssue`, the task id sentence) are pins, since `mcp-copy.ts` landed whole in the red commit | green `b5bb8ce` |
| `test/mcp-endpoint.test.ts` (27 of 29) and `worker.test.ts` `POST /mcp` (1), red `4f9363c` | through the Worker, still 404 everywhere: `AssertionError: expected 404 to be 200`, `… to be 400`, `… to be 401`, `… to be 405`; `Error: initialize should answer a session id` (tests that open a session first); `SyntaxError: Unexpected end of JSON input` (404 rows whose status already matched, reading an empty body); through `serveMcp` with the counting namespace: `Error: serveMcp is not implemented`. The two `paths other than /mcp` tests were green | green `c9c7783` |
| `test/mcp-tools.test.ts` (39), red `2356366` | against a server with no tools or prompts: `AssertionError: expected [] to deeply equal [ 'add', 'done', 'list', 'next', …(1) ]`, `AssertionError: expected [] to deeply equal [ { name: 'next', …(2) } ]`, `ProtocolError: Method not found` (legacy calls), `SdkHttpError: Error POSTing to endpoint: {"jsonrpc":"2.0","id":0,"error":{"code":-32601,"message":"Method not found"}}` (modern calls) | green `e68a57f` |
| `test/mcp-isolation.test.ts` (9) | pin, `1a62a78`: green when it landed. A first draft compared the not-found result with a literal and failed only on the modern result's `_meta.serverInfo`; it now compares the cross-project result with the never-issued one | n/a |

## Hypotheses to attack

1. Hypothesis: no refused credential addresses a Durable Object or touches `mcp_sessions`. Break it by: every `Authorization` shape (missing, `Basic`, `Bearer` with only spaces, two spaces, tab, a newline-free but trailing-space key, a digest as the key, a key of another environment) through `serveMcp` with the counting namespace, on `POST`, `GET` and `DELETE`.
2. Hypothesis: a 2025-era session names only the key it was opened with. Break it by: a session from key A sent with key B of the same project, of another project and of another owner; a session after its key is revoked; a session exactly at `expires_at`.
3. Hypothesis: a project key never reveals another project. Break it by: every tool with B's numbers, anchors, text and idempotency keys through A's key, comparing whole results with never-issued numbers, in both eras.
4. Hypothesis: every write names the client: `Claude Code` for the legacy client, `Codex` for the modern one, the trimmed name from `initialize`. Break it by: reading history after `update` and `done`, a legacy name with surrounding spaces, a modern client whose name breaks `agentActor` (65 characters, a line break, blank).
5. Hypothesis: `next` and `list` see today in the owner's zone. Break it by: an owner in `Pacific/Kiritimati` or `Pacific/Pago_Pago` near midnight UTC, tasks due on each side of the date line.
6. Hypothesis: arguments that break a schema reach nothing. Break it by: wrong types, unknown enum values, a `placement` of kind `before` without an anchor, extra properties, `limit` as a string or float.
7. Hypothesis: a body that is not one `initialize` never opens a session. Break it by: a notification-shaped `initialize` (no `id`), an `initialize` with an `id` of `null` or an object, a batch of two `initialize`s, a body of `null`.
8. Hypothesis: `wrangler dev` prints no task title, note, key or session id during a walk (no `console` in `apps/api/src`, no SDK `onerror`).

## Known gaps

- `issueProjectKey` needs `insertProjectKey`, so that directory function landed with step 2's green commit (`926591b`), not step 3; it is tested through `project-keys.test.ts`, not on its own in `directory.test.ts`.
- ~~`mcp-endpoint.ts` parses the body with a local `parsedBody`.~~ Merged into `parsedJson` (`apps/api/src/parsed-json.ts`) in `c71c3d6` (fix round 2).
- An `initialize` is recognised by `method: 'initialize'` with a string or number `id`; one without an `id` is treated as any other 2025-era request (400 `session_required`). The spec does not name this case.
- ~~The session row is stored before the SDK answers `initialize`.~~ Fixed in `9a85ae4` (fix round).
- The server `instructions` and the field descriptions are not asserted through the client; only the tool and prompt descriptions are.
- The `wrangler dev` walk and the Node client walk are the tester's (Prove it for real); the developer did not run them.
- ~~Expired sessions are never deleted.~~ Since `a6978b3` a new session deletes its key's expired rows and keeps the 20 newest; a key that opens no new session keeps up to 20 expired rows.

## Fix round (after the security review, 2026-11-23)

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mcp-endpoint.test.ts::an initialize with $name that the SDK answers with an error opens no session` (2), the tester's red `d53ee22` | `expected '<session id>' to be null` | green `9a85ae4`: served first; row and header only when `isInitializeRequest` passes and the answer is `ok` |
| `mcp-endpoint.test.ts::the sessions of one key` (2), red `dd89154` | `expected [ … ] to have a length of 20 but got 21`; `expected [ …(2) ] to have a length of 1 but got 2` | green `a6978b3`: one D1 batch deletes the key's expired rows, inserts, and keeps the 20 newest (`created_at`, then `rowid`) |
| `mcp-format.test.ts::the prompt fences the task…`, `mcp-tools.test.ts::the next prompt asks…` and `::the next prompt keeps notes that read as instructions inside the task tags` (both eras), red `dd89154` | `expected 'Work on this task from todz.\n\nT-3 S…' to be 'Work on this task from todz. The text…'`; `expected [ { role: 'user', … } ] to deeply equal [ … ]` | green `07fbeb1` |
| `mcp-tools.test.ts::a request whose envelope names no client writes nothing`, red `dd89154` | `expected { content: [ { …(2) } ], …(3) } to match object { Object (content, isError) }` | green `7a21663`: `MCP_COPY.clientUnnamed` |

Hypotheses: 9. A key never holds more than 20 rows, even under concurrent `initialize` calls. Break it by: 30 `initialize` calls with one key in `Promise.all`, then counting rows. 10. A task's notes cannot leave the `<task>` fence. Break it by: notes holding `</task>` followed by instructions (the fence is not escaped; the fixed sentence is the only guard).

## Fix round 2

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `mcp-endpoint.test.ts::an initialize whose clock is behind the live rows of its key is served with the session it answers`, the tester's red `a4e2286` | `expected 404 to be 200` | green `8171e84`: the cap never deletes the new digest and keeps the 19 newest others |
| `mcp-format.test.ts::the prompt escapes ampersands and angle brackets…`, `mcp-tools.test.ts::the next prompt escapes notes that close the task tag…` (both eras; replaces the tester's pin of the unescaped fence), red `8fb4f52` | `expected 'Work on this task from todz. The text…' to contain '<task>\nT-3 Ship &lt;it&gt; &amp; go\…'`; `expected [ …(3) ] to have a length of 2 but got 3` | green `561f127`: the prompt's task block is escaped; the `next` tool's answer is not |
| `directory.test.ts::the mcp sessions table > is indexed by key digest and creation time (pin)` | pin, `2360157` (lands with the index) | n/a |
| `parsedJson` shared by `sqlite-task-store.ts` and `mcp-endpoint.ts` | refactor `c71c3d6`, existing suites green | n/a |

Hypothesis 10 now reads: a note cannot close the fence. Break it by: `&lt;/task&gt;` typed literally (it becomes `&amp;lt;/task&amp;gt;`), titles holding tags, and a closing tag split across the title and the notes.
