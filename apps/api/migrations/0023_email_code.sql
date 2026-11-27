ALTER TABLE sign_in_links ADD COLUMN code_digest TEXT CHECK (code_digest IS NULL OR length(code_digest) = 64);

ALTER TABLE sign_in_links ADD COLUMN code_salt TEXT;

ALTER TABLE admin_sign_in_links ADD COLUMN code_digest TEXT CHECK (code_digest IS NULL OR length(code_digest) = 64);

ALTER TABLE admin_sign_in_links ADD COLUMN code_salt TEXT;

CREATE TABLE sign_in_code_misses (
  address_digest TEXT NOT NULL CHECK (length(address_digest) = 64),
  challenge TEXT NOT NULL CHECK (length(challenge) = 64),
  missed_at INTEGER NOT NULL
) STRICT;

CREATE INDEX sign_in_code_misses_address ON sign_in_code_misses (address_digest, missed_at);
