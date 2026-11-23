CREATE TABLE owners (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners (id),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces (id),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE project_keys (
  digest TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
) STRICT;

CREATE TABLE sessions (
  digest TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
