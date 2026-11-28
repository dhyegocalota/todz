ALTER TABLE oauth_tokens ADD COLUMN parent_digest TEXT;

UPDATE oauth_tokens SET parent_digest = (
  SELECT parent.digest FROM oauth_tokens AS parent
  WHERE parent.grant_id = oauth_tokens.grant_id AND parent.kind = 'refresh' AND parent.digest <> oauth_tokens.digest
    AND (parent.spent_at = oauth_tokens.created_at OR parent.retried_at = oauth_tokens.created_at)
  ORDER BY parent.rowid
  LIMIT 1
) WHERE kind = 'refresh';

CREATE INDEX oauth_tokens_parent ON oauth_tokens (parent_digest);
