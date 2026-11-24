CREATE TABLE owner_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES owners (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
) STRICT;

CREATE UNIQUE INDEX projects_inbox ON projects (workspace_id) WHERE is_inbox = 1;
CREATE INDEX workspaces_owner ON workspaces (owner_id, created_at);
CREATE INDEX projects_workspace ON projects (workspace_id, created_at);
CREATE INDEX sessions_owner ON sessions (owner_id, created_at);
CREATE INDEX project_keys_project ON project_keys (project_id, created_at);
