ALTER TABLE owners ADD COLUMN agent_nudge_chosen_at INTEGER;
ALTER TABLE owners ADD COLUMN day_email_chosen_at INTEGER;

UPDATE owners SET agent_nudge_chosen_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE agent_nudge = 1;
UPDATE owners SET day_email_chosen_at = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE day_email = 1;

CREATE TABLE day_email_stop_links (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  owner_id TEXT NOT NULL REFERENCES owners (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX day_email_stop_links_expiry ON day_email_stop_links (expires_at);

CREATE INDEX day_email_stop_links_owner ON day_email_stop_links (owner_id);
