CREATE TABLE owner_keys (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  id TEXT NOT NULL UNIQUE,
  hint TEXT NOT NULL CHECK (length(hint) = 4),
  owner_id TEXT NOT NULL REFERENCES owners (id),
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
) STRICT;

CREATE INDEX owner_keys_owner ON owner_keys (owner_id, created_at);
