CREATE TABLE metrics_daily (
  day TEXT NOT NULL CHECK (length(day) = 10),
  metric TEXT NOT NULL CHECK (metric <> ''),
  dimension TEXT NOT NULL CHECK (length(dimension) <= 24),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (day, metric, dimension)
) STRICT, WITHOUT ROWID;
