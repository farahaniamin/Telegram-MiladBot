import { db } from './db.js'

export function addWatch(telegramId: number, infirmaryId: number) {
  db.prepare(
    'INSERT INTO watches (telegram_id, infirmary_id, active) VALUES (?, ?, 1)'
  ).run(telegramId, infirmaryId)
}

export function deactivateWatch(telegramId: number, infirmaryId: number) {
  db.prepare('UPDATE watches SET active = 0 WHERE telegram_id = ? AND infirmary_id = ? AND active = 1')
    .run(telegramId, infirmaryId)
}

export function deactivateAllByInfirmary(infirmaryId: number) {
  db.prepare('UPDATE watches SET active = 0 WHERE infirmary_id = ? AND active = 1')
    .run(infirmaryId)
}

export function listActiveWatchesByUser(telegramId: number): Array<{ infirmaryId: number }> {
  return db.prepare('SELECT infirmary_id as infirmaryId FROM watches WHERE telegram_id = ? AND active = 1')
    .all(telegramId) as any
}

/**
 * Group watches by infirmary to minimize requests.
 * Returns: [{ infirmaryId, userIds: number[] }]
 */
export function getActiveWatchesGrouped(): Array<{ infirmaryId: number; userIds: number[] }> {
  const rows = db.prepare(`
    SELECT infirmary_id as infirmaryId, GROUP_CONCAT(telegram_id) as users
    FROM watches
    WHERE active = 1
    GROUP BY infirmary_id
  `).all() as any[]

  return rows.map(r => ({
    infirmaryId: r.infirmaryId as number,
    userIds: String(r.users).split(',').map((x: string) => Number(x)).filter((n: number) => Number.isFinite(n))
  }))
}
