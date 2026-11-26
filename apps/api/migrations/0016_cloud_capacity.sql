CREATE TABLE cloud_queue (
  email TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  notified_at INTEGER,
  admitted_at INTEGER
) STRICT, WITHOUT ROWID;

CREATE INDEX cloud_queue_waiting ON cloud_queue (created_at) WHERE admitted_at IS NULL;

CREATE TABLE cloud_budget (
  month TEXT PRIMARY KEY CHECK (length(month) = 7),
  level TEXT NOT NULL,
  heavy_writes INTEGER NOT NULL CHECK (heavy_writes >= 0),
  warned_at INTEGER
) STRICT, WITHOUT ROWID;
