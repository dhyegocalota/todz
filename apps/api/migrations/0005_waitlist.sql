CREATE TABLE waitlist (
  address TEXT PRIMARY KEY,
  joined_at INTEGER NOT NULL,
  confirmation_claimed_at INTEGER,
  confirmation_failed_at INTEGER
) STRICT;
