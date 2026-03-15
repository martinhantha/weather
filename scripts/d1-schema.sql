CREATE TABLE IF NOT EXISTS measurement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeid TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_measurement_timeid ON measurement(timeid);
