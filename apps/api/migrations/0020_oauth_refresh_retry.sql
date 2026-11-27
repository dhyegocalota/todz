ALTER TABLE oauth_tokens ADD COLUMN retried_at INTEGER;

CREATE INDEX oauth_tokens_expiry ON oauth_tokens (grant_id, expires_at);
