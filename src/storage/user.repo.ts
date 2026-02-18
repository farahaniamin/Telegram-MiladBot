import { getDatabase } from './db.js'

export async function getUserNationalCode(telegramId: number): Promise<string | null> {
  const db = getDatabase()
  const result = await db.prepare('SELECT national_code FROM users WHERE telegram_id = ?')
    .bind(telegramId)
    .first()
  return (result as any)?.national_code ?? null
}

export async function upsertUserNationalCode(telegramId: number, nationalCode: string) {
  const db = getDatabase()
  await db.prepare(`
    INSERT INTO users (telegram_id, national_code) VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET national_code=excluded.national_code
  `).bind(telegramId, nationalCode).run()
}
