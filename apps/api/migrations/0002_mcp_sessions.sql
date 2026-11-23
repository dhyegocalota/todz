CREATE TABLE mcp_sessions (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  key_digest TEXT NOT NULL REFERENCES project_keys (digest),
  client_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
