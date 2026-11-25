CREATE TABLE admin_sign_in_links (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  email TEXT NOT NULL,
  challenge TEXT NOT NULL CHECK (length(challenge) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
) STRICT;

CREATE INDEX admin_sign_in_links_email ON admin_sign_in_links (email, created_at);

CREATE INDEX admin_sign_in_links_expiry ON admin_sign_in_links (expires_at);

CREATE TABLE admin_sessions (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX admin_sessions_expiry ON admin_sessions (expires_at);

CREATE INDEX waitlist_joined_at ON waitlist (joined_at);
