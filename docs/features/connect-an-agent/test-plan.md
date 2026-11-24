# Test plan: Connect an agent

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path). Copy keys are those of [`design.md`](design.md) § 8.

## The failing test first

- [ ] Each red commit of steps 1 to 4 holds only its test (plus stubs that fail with `<name> is not implemented`), and its body records the failure the red run printed — input: `git log --format='%h %s%n%b' origin/main..HEAD`; expected: one red commit before each green one
- [ ] Red-first spot check in a throwaway worktree for steps 3 and 4 — input: check out each red commit, `swift test --filter` its suite; expected: the failure printed matches the commit body
- [ ] Each group's last commit builds — input: `swift test` and the app build at G1's and G2's last commits; expected: green at each

## Unit

- [ ] `ProjectKeyTests`: `{ id, hint, created_at }` decodes; `{ key, secret }` decodes; a missing `hint` fails; the `OwnerCoding` round trip
- [ ] `OwnerAPITests+Keys`: `GET /owner/projects/<p>/keys`, `POST …/keys` with an empty body, `DELETE …/keys/<k>`, each with `Authorization: Bearer <session>`; 404 → `notFound`; 401 → the session error; 5xx and offline mapped as the other calls
- [ ] `AgentCommandTests`: Claude Code `claude mcp add --transport http todz http://localhost:8787/mcp --header "Authorization: Bearer todz_…"` exactly; Codex's `[mcp_servers.todz]` table with `url` and `bearer_token_env_var = "TODZ_API_KEY"` and `export TODZ_API_KEY=todz_…`; Cursor's link decodes to `{"url":"http://localhost:8787/mcp","headers":{"Authorization":"Bearer todz_…"}}` and its `mcp.json` JSON; with no secret, the placeholder forms and no Cursor link; `serverURL(apiBase:)` with and without a trailing slash
- [ ] `AppModelTests+Keys`: the shown project is the selected one, else the Inbox; load → loaded; load failure → failed and "Try again" loads again; issue → the key appended and its secret held; a failed issue → no secret; revoke → removed, and the secret dropped when it was that key's; revoke 404 → removed with no error; project change, leaving the screen, workspace switch and sign-out → no secret and no list; a late list answer for a project no longer shown is dropped
- [ ] The whole suite stays green — `swift test`; count recorded

## E2E

- [ ] No browser surface. `pnpm verify all` green with the `macos` gate — summary recorded

## Prove it for real — the app (ADR 0026)

- [ ] Sidebar: "Connect an agent" sits at the bottom of the sidebar; clicking it shows the key screen for the project that was selected (or the Inbox), with the picker naming it
- [ ] Server URL: `http://localhost:8787/mcp` shown; Copy puts exactly that on the pasteboard (`pbpaste`) and the confirmation does not move the layout
- [ ] Tools: `next`, `add`, `list`, `update`, `done` with their lines per design § 8
- [ ] No keys: the empty state per design; the client blocks show the placeholder and their Copy is disabled
- [ ] Create a key: the secret appears once, the notice says it will not be shown again; the keys list gains a row with the secret's last four characters and today's date; `pbpaste` after the Claude Code Copy equals the command with that secret
- [ ] The secret is real: in a throwaway folder, run the copied Claude Code command, then `claude mcp list` — expected: `todz` connected; an MCP call through it (or `curl` with the same header to `/mcp` initialize) answers 200; then `claude mcp remove todz` in that folder
- [ ] Codex block: the copied text is the `config.toml` table and the `export` line with the secret (Codex is not installed: text only)
- [ ] Cursor: "Add to Cursor" asks the system to open a `cursor://` link (Cursor is not installed: the link's text checked, recorded as unproven)
- [ ] Leaving forgets: pick another project and back, or open Today and back — expected: no secret anywhere on screen, the key still listed by its last four characters
- [ ] Revoke: confirm — expected: the row leaves; the same `curl` with the revoked key answers as an unknown key; cancel keeps the row
- [ ] Revoked elsewhere: revoke a key through the API by hand, then revoke it in the app — expected: the row leaves with no error
- [ ] Failures: stop `wrangler dev`, open the screen — expected: the list's error with "Try again"; "Create a key" fails with the issue error and no secret; restart the server and "Try again" loads
- [ ] Many keys (six) and a long project name: the list scrolls, the name truncates per design
- [ ] Narrow window and keyboard: the screen at the window's minimum width; Tab reaches the picker, each Copy, Create and Revoke; VoiceOver labels per design § 5
- [ ] Light; README shot `docs/screenshots/connect-an-agent/01-…png` (fictional data, no real secret: revoke the key shown before committing the shot)

## Edge cases found during execution

## Adversarial review

## Coverage honesty

- Codex and Cursor are not installed on this machine: their blocks are proven as text, and Cursor's install link is unproven.
- The secret on the pasteboard stays until the owner copies something else; the app does not clear it.
