import { db } from './db.js'

export async function getUserNationalCode(telegramId: number): Promise<string | null> {
  const row = await db.get('SELECT national_code FROM users WHERE telegram_id = $1', [telegramId])
  return row?.national_code ?? null
}

export async function upsertUserNationalCode(telegramId: number, nationalCode: string) {
  await db.run(`
    INSERT INTO users (telegram_id, national_code) VALUES ($1, $2)
    ON CONFLICT(telegram_id) DO UPDATE SET national_code=excluded.national_code
  `, [telegramId, nationalCode])
}

export async function getTotalUsersCount(): Promise<number> {
  const row = await db.get('SELECT COUNT(*) as count FROM users')
  return row?.count ?? 0
}

export async function getNewUsersCount(sinceHours: number): Promise<number> {
  const sinceTimestamp = Math.floor(Date.now() / 1000) - (sinceHours * 3600)
  const row = await db.get(`
    SELECT COUNT(*) as count FROM users 
    WHERE telegram_id IN (
      SELECT telegram_id FROM watches 
      WHERE created_at > $1 
      GROUP BY telegram_id
    )
  `, [sinceTimestamp])
  return row?.count ?? 0
}

export async function getTopUsersByWatches(limit: number = 10): Promise<Array<{
  telegramId: number
  watchCount: number
}>> {
  const rows = await db.all(`
    SELECT 
      telegram_id as "telegramId",
      COUNT(*) as "watchCount"
    FROM watches
    WHERE active = 1
    GROUP BY telegram_id
    ORDER BY COUNT(*) DESC
    LIMIT $1
  `, [limit])
  return rows as any
}
