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

// Skip schema initialization - migrations already applied via wrangler
export async function initializeDatabase(db: D1Database) {
  console.log('Database initialization skipped - schema already applied via migrations')
  // Schema was applied via: wrangler d1 migrations apply milad-bot-db --remote
}
