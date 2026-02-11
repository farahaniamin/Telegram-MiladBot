import { db } from './db.js'

export function getUserNationalCode(telegramId: number): string | null {
  const row = db.prepare('SELECT national_code FROM users WHERE telegram_id = ?').get(telegramId) as any
  return row?.national_code ?? null
}

export function upsertUserNationalCode(telegramId: number, nationalCode: string) {
  db.prepare(`
    INSERT INTO users (telegram_id, national_code) VALUES (?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET national_code=excluded.national_code
  `).run(telegramId, nationalCode)
}
