PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS public_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  venue TEXT NOT NULL,
  allow_multiple_races_per_day INTEGER NOT NULL,
  allow_schedule_overlap INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_races (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_start TEXT NOT NULL,
  schedule_end TEXT,
  duplicate_day INTEGER NOT NULL,
  overlaps_existing INTEGER NOT NULL,
  startlist_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_races_event_schedule ON public_races(event_id, schedule_start);

CREATE TABLE IF NOT EXISTS public_startlists (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public_events(id) ON DELETE CASCADE,
  race_id TEXT NOT NULL UNIQUE REFERENCES public_races(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_startlist_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startlist_id TEXT NOT NULL REFERENCES public_startlists(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(startlist_id, version)
);

CREATE INDEX IF NOT EXISTS idx_public_startlist_versions_startlist ON public_startlist_versions(startlist_id, version);
