DELETE FROM mcp_sessions;

DELETE FROM owner_keys;

DELETE FROM project_keys;

DROP INDEX mcp_sessions_key_digest;

DROP TABLE mcp_sessions;

DROP INDEX owner_keys_owner;

DROP TABLE owner_keys;

DROP INDEX project_keys_project;

DROP TABLE project_keys;
