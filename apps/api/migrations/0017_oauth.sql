CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY CHECK (length(id) = 43),
  name TEXT NOT NULL CHECK (name <> ''),
  redirect_uris TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  active_at INTEGER NOT NULL
) STRICT;

CREATE INDEX oauth_clients_active ON oauth_clients (active_at);

CREATE TABLE oauth_sessions (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  owner_id TEXT NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX oauth_sessions_expiry ON oauth_sessions (expires_at);

CREATE TABLE oauth_grants (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects (id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
) STRICT;

CREATE INDEX oauth_grants_owner ON oauth_grants (owner_id, last_used_at);
CREATE INDEX oauth_grants_client ON oauth_grants (client_id);
CREATE INDEX oauth_grants_project ON oauth_grants (project_id);

CREATE TABLE oauth_codes (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  client_id TEXT NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES owners (id) ON DELETE CASCADE,
  project_id TEXT,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL CHECK (length(code_challenge) = 43),
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  grant_id TEXT REFERENCES oauth_grants (id) ON DELETE SET NULL
) STRICT;

CREATE INDEX oauth_codes_expiry ON oauth_codes (expires_at);
CREATE INDEX oauth_codes_grant ON oauth_codes (grant_id);

CREATE TABLE oauth_tokens (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  grant_id TEXT NOT NULL REFERENCES oauth_grants (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  spent_at INTEGER
) STRICT;

CREATE INDEX oauth_tokens_grant ON oauth_tokens (grant_id, kind);
