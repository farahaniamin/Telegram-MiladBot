import { db } from './db.js'

export function getUserNationalCode(telegramId: number): string | null {
  return db.get('SELECT national_code FROM users WHERE telegram_id = $1', [telegramId]) as any
}

export function upsertUserNationalCode(telegramId: number, nationalCode: string) {
  db.run(`
    INSERT INTO users (telegram_id, national_code) VALUES ($1, $2)
    ON CONFLICT(telegram_id) DO UPDATE SET national_code=excluded.national_code
  `, [telegramId, nationalCode])
}
