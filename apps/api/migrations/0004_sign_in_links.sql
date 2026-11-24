CREATE TABLE sign_in_links (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  email TEXT NOT NULL,
  challenge TEXT NOT NULL CHECK (length(challenge) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
) STRICT;

CREATE INDEX sign_in_links_email ON sign_in_links (email, created_at);
