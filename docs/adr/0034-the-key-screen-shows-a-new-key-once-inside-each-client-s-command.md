# 0034. The key screen shows a new key once, inside each client's command

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (macOS app → Connect an agent), [ADR 0019](0019-mcp-keys-are-prefixed-and-shown-once.md), the `connect-an-agent` research of 2026-11-24 into the three clients' documentation

## Context

The product design asks the key screen for "a ready command for Claude Code, Codex or Cursor". A key's secret is shown once, at creation (ADR 0019), so a command can only carry it at that moment. The three clients take a bearer key differently, as documented on 2026-11-24:

- **Claude Code:** `claude mcp add --transport http <name> <url> --header "Authorization: Bearer <key>"`, stored in the private `local` scope (`~/.claude.json`, per folder) by default.
- **Codex:** `codex mcp add` documents only OAuth for a URL server. A bearer key goes in `~/.codex/config.toml` as `bearer_token_env_var`, which names an environment variable and keeps the key off disk; `http_headers` would store it in plain text.
- **Cursor:** an install link, `cursor://anysphere.cursor-deeplink/mcp/install?name=<name>&config=<base64 of the server's JSON>`, and the same JSON in `mcp.json`. The documentation shows the link only for a local command; a remote server with `url` and `headers` follows the `mcp.json` shape.

## Decision

1. "Create a key" issues a key and shows, once, three blocks built from the server URL and the new secret, each with Copy:
   - **Claude Code:** `claude mcp add --transport http todz '<url>' --header 'Authorization: Bearer <secret>'`, single-quoted because a secret is `todz_` plus base64url and never holds a quote.
   - **Codex:** the `config.toml` table `[mcp_servers.todz]` with `url` and `bearer_token_env_var = "TODZ_API_KEY"`, and the line `export TODZ_API_KEY='<secret>'` for the owner's shell profile.
   - **Cursor:** an "Add to Cursor" button that opens the install link with `{"url": <url>, "headers": {"Authorization": "Bearer <secret>"}}`, and the same server as `mcp.json` JSON to copy.
2. Without a secret on screen, the blocks show the same text with the secret replaced by a visible placeholder, and their Copy is disabled until a key is created.
3. The secret lives only in the screen's memory. Leaving the project or the screen forgets it; nothing writes it to disk, the cache, the shared widget folder or a log. The pasteboard holds it only while the owner keeps it there.
4. The server name in every client is `todz`. The tools are listed from one constant in `TodzKit`, the same five names the server registers.
5. The commands are built by one pure function in `TodzKit`, tested with exact strings, so a change in a client's syntax changes one place.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| The secret inside each client's command, once (chosen) | One paste connects; nothing to edit by hand | The key ends up wherever the client keeps it (plain text for Claude Code and Cursor) | The clients' own storage is theirs; the app never stores it |
| A key field the owner pastes into a template | The app never shows a secret twice | The secret is only shown at creation anyway, so the owner would copy it twice | More steps for the same exposure |
| The app writes each client's configuration file | No copy and paste | Edits files outside the sandbox; a different format per client and version | Out of the sandbox, and the spec's non-goal |
| An environment variable for every client | No key on disk anywhere | Claude Code and Cursor then need a shell profile change and a restart | Codex only, where the CLI offers no header form |

## Consequences

- Claude Code and Cursor keep the key in their own files in plain text, as they do every header; Codex keeps only the variable's name. The screen says a key can be revoked here at any time.
- The Cursor link's remote shape is followed from `mcp.json`, not from an example of the link itself; the tester proves it if Cursor is installed, else it is listed as unproven.
- A client whose syntax changes needs one change in `TodzKit` and its tests.

## Evidence

The three clients' documentation, read on 2026-11-24: Claude Code (code.claude.com/docs/en/mcp), Codex (the MCP page of the Codex documentation: `config.toml` keys `url`, `bearer_token_env_var`, `http_headers`), Cursor (cursor.com/docs/context/mcp and its install-links page).
