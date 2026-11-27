CREATE TABLE oauth_grant_scopes (
  grant_id TEXT NOT NULL REFERENCES oauth_grants (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('account', 'workspace', 'project')),
  workspace_id TEXT REFERENCES workspaces (id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects (id) ON DELETE CASCADE,
  CHECK (
    (kind = 'account' AND workspace_id IS NULL AND project_id IS NULL)
    OR (kind = 'workspace' AND workspace_id IS NOT NULL AND project_id IS NULL)
    OR (kind = 'project' AND workspace_id IS NULL AND project_id IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX oauth_grant_scopes_target ON oauth_grant_scopes (grant_id, kind, coalesce(workspace_id, project_id, ''));

CREATE INDEX oauth_grant_scopes_workspace ON oauth_grant_scopes (workspace_id);

CREATE INDEX oauth_grant_scopes_project ON oauth_grant_scopes (project_id);

INSERT INTO oauth_grant_scopes (grant_id, kind, workspace_id, project_id)
SELECT id, 'project', NULL, project_id FROM oauth_grants WHERE project_id IS NOT NULL;

INSERT INTO oauth_grant_scopes (grant_id, kind, workspace_id, project_id)
SELECT id, 'account', NULL, NULL FROM oauth_grants WHERE project_id IS NULL;

CREATE TRIGGER oauth_grant_scopes_last_deleted AFTER DELETE ON oauth_grant_scopes
BEGIN
  DELETE FROM oauth_grants WHERE id = OLD.grant_id AND NOT EXISTS (SELECT 1 FROM oauth_grant_scopes WHERE grant_id = OLD.grant_id);
END;

ALTER TABLE oauth_codes ADD COLUMN scopes TEXT CHECK (scopes IS NULL OR json_valid(scopes));

UPDATE oauth_codes
SET scopes = CASE
  WHEN project_id IS NULL THEN json_array(json_object('kind', 'account'))
  ELSE json_array(json_object('kind', 'project', 'project_id', project_id))
END;
