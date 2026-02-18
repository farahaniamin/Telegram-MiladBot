import type { D1Database } from '@cloudflare/workers-types'

// D1 database instance - will be set by the entry point
let dbInstance: D1Database | null = null

export function setDatabase(database: D1Database) {
  dbInstance = database
}

export function getDatabase(): D1Database {
  if (!dbInstance) {
    throw new Error('Database not initialized')
  }
  return dbInstance
}

// Schema statements - exec() has issues in D1, so we run them individually
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    national_code TEXT NOT NULL
  )`,
  
  `CREATE TABLE IF NOT EXISTS infirmaries (
    id INTEGER PRIMARY KEY,
    code TEXT,
    title TEXT NOT NULL
  )`,
  
  `CREATE TABLE IF NOT EXISTS watches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    infirmary_id INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    notification_count INTEGER DEFAULT 0,
    last_notified_at INTEGER,
    grace_period_end INTEGER,
    status TEXT DEFAULT 'active'
  )`,
  
  `CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_id INTEGER NOT NULL,
    telegram_id INTEGER NOT NULL,
    infirmary_id INTEGER NOT NULL,
    notified_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    attempt_number INTEGER DEFAULT 1,
    user_response TEXT,
    FOREIGN KEY (watch_id) REFERENCES watches(id)
  )`,
  
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  
  `CREATE INDEX IF NOT EXISTS idx_watches_active_infirmary ON watches(active, infirmary_id)`,
  
  `CREATE INDEX IF NOT EXISTS idx_watch_history_watch ON watch_history(watch_id)`,
  
  `CREATE INDEX IF NOT EXISTS idx_watch_history_time ON watch_history(notified_at)`
]

// Initialize database with schema
export async function initializeDatabase(db: D1Database) {
  console.log('Initializing database schema...')
  
  for (let i = 0; i < SCHEMA_STATEMENTS.length; i++) {
    const statement = SCHEMA_STATEMENTS[i]
    try {
      await db.prepare(statement).run()
      console.log(`✅ Schema statement ${i + 1}/${SCHEMA_STATEMENTS.length} executed`)
    } catch (error) {
      console.error(`❌ Failed to execute schema statement ${i + 1}:`, error)
      // If table already exists, that's okay
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg && errorMsg.includes('already exists')) {
        console.log(`   (Table/index already exists, continuing...)`)
      } else {
        throw error
      }
    }
  }
  
  console.log('✅ Database schema initialized successfully')
}
