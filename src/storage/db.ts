import Database from 'better-sqlite3'

export const db = new Database('data.db')

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('temp_store = MEMORY')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  national_code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS infirmaries (
  id INTEGER PRIMARY KEY,
  code TEXT,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  infirmary_id INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  notification_count INTEGER DEFAULT 0,
  last_notified_at INTEGER,
  grace_period_end INTEGER,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS watch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL,
  telegram_id INTEGER NOT NULL,
  infirmary_id INTEGER NOT NULL,
  notified_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  attempt_number INTEGER DEFAULT 1,
  user_response TEXT,
  FOREIGN KEY (watch_id) REFERENCES watches(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_watches_active_infirmary ON watches(active, infirmary_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_watch ON watch_history(watch_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_time ON watch_history(notified_at);
`)
