ALTER TABLE owners ADD COLUMN suspended_at INTEGER;

CREATE TABLE owner_usage (
  owner_id TEXT NOT NULL REFERENCES owners (id),
  day TEXT NOT NULL CHECK (length(day) = 10),
  writes INTEGER NOT NULL CHECK (writes >= 0),
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  PRIMARY KEY (owner_id, day)
) STRICT, WITHOUT ROWID;

CREATE TABLE sign_up_usage (
  client_key TEXT NOT NULL CHECK (length(client_key) = 64),
  day TEXT NOT NULL CHECK (length(day) = 10),
  accounts INTEGER NOT NULL CHECK (accounts >= 0),
  PRIMARY KEY (client_key, day)
) STRICT, WITHOUT ROWID;
