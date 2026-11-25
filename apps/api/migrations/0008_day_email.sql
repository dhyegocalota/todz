ALTER TABLE owners ADD COLUMN day_email INTEGER NOT NULL DEFAULT 0 CHECK (day_email IN (0, 1));

ALTER TABLE owners ADD COLUMN day_email_minutes INTEGER NOT NULL DEFAULT 420 CHECK (day_email_minutes BETWEEN 0 AND 1439);

CREATE TABLE day_emails (
  owner_id TEXT NOT NULL REFERENCES owners (id),
  day TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  sent_at INTEGER,
  failed_at INTEGER,
  failure TEXT CHECK (failure IN ('read_failed', 'too_many_projects', 'send_failed')),
  PRIMARY KEY (owner_id, day)
) STRICT;

CREATE INDEX day_emails_claimed_at ON day_emails (claimed_at);

CREATE TABLE day_email_reply_addresses (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  owner_id TEXT NOT NULL REFERENCES owners (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX day_email_reply_addresses_expiry ON day_email_reply_addresses (expires_at);

CREATE INDEX day_email_reply_addresses_owner ON day_email_reply_addresses (owner_id);

CREATE TABLE day_email_replies (
  owner_id TEXT NOT NULL REFERENCES owners (id),
  message_digest TEXT NOT NULL CHECK (length(message_digest) = 64),
  accepted_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, message_digest)
) STRICT;

CREATE INDEX day_email_replies_owner_accepted_at ON day_email_replies (owner_id, accepted_at);

CREATE INDEX owners_day_email ON owners (id) WHERE day_email = 1;
