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
