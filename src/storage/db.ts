import Database from 'better-sqlite3'
import pg from 'pg'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
const isPg = !!databaseUrl

let sqliteDb: Database.Database
let pgPool: pg.Pool

if (isPg) {
  console.log('🗄️ Using PostgreSQL database')
  pgPool = new Pool({
    connectionString: databaseUrl,
    max: 2
  })
  
  const initPg = async () => {
    const client = await pgPool.connect()
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          telegram_id BIGINT PRIMARY KEY,
          national_code TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS infirmaries (
          id SERIAL PRIMARY KEY,
          code TEXT,
          title TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS watches (
          id SERIAL PRIMARY KEY,
          telegram_id BIGINT NOT NULL,
          infirmary_id INTEGER NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
          notification_count INTEGER DEFAULT 0,
          last_notified_at INTEGER,
          grace_period_end INTEGER,
          status TEXT DEFAULT 'active'
        );
        
        CREATE TABLE IF NOT EXISTS watch_history (
          id SERIAL PRIMARY KEY,
          watch_id INTEGER NOT NULL,
          telegram_id BIGINT NOT NULL,
          infirmary_id INTEGER NOT NULL,
          notified_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
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
      console.log('✅ PostgreSQL tables initialized')
    } finally {
      client.release()
    }
  }
  
  initPg().catch(console.error)
} else {
  console.log('🗄️ Using SQLite database')
  sqliteDb = new Database('data.db')
  
  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.pragma('synchronous = NORMAL')
  sqliteDb.pragma('temp_store = MEMORY')
  
  sqliteDb.exec(`
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
}

function toSqliteParams(sql: string, params: any[]): [string, any[]] {
  let i = 1
  const sqliteSql = sql.replace(/\$\d+/g, () => '?')
  return [sqliteSql, params]
}

export const db = {
  run(sql: string, params: any[] = []): any {
    if (isPg) {
      return pgPool.query(sql, params)
    }
    const [sqliteSql, sqliteParams] = toSqliteParams(sql, params)
    return sqliteDb.prepare(sqliteSql).run(...sqliteParams)
  },
  
  get(sql: string, params: any[] = []): any {
    if (isPg) {
      return pgPool.query(sql, params).then(r => r.rows[0])
    }
    const [sqliteSql, sqliteParams] = toSqliteParams(sql, params)
    return sqliteDb.prepare(sqliteSql).get(...sqliteParams)
  },
  
  all(sql: string, params: any[] = []): any {
    if (isPg) {
      return pgPool.query(sql, params).then(r => r.rows)
    }
    const [sqliteSql, sqliteParams] = toSqliteParams(sql, params)
    return sqliteDb.prepare(sqliteSql).all(...sqliteParams)
  }
}
