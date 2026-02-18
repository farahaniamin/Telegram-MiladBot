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

export function listActiveWatchesWithDetails(telegramId: number): Array<{
  watchId: number
  infirmaryId: number
  infirmaryTitle: string
  createdAt: number
}> {
  return db.prepare(`
    SELECT 
      w.id as watchId,
      w.infirmary_id as infirmaryId,
      i.title as infirmaryTitle,
      w.created_at as createdAt
    FROM watches w
    JOIN infirmaries i ON w.infirmary_id = i.id
    WHERE w.telegram_id = ? AND w.active = 1
    ORDER BY w.created_at DESC
  `).all(telegramId) as any
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

// ================= SMART RE-WATCH FUNCTIONS =================

export type WatchWithSmartData = {
  watchId: number
  telegramId: number
  infirmaryId: number
  notificationCount: number
  lastNotifiedAt: number | null
  gracePeriodEnd: number | null
  status: string
}

export function getActiveWatchesWithSmartData(): WatchWithSmartData[] {
  return db.prepare(`
    SELECT 
      id as watchId,
      telegram_id as telegramId,
      infirmary_id as infirmaryId,
      notification_count as notificationCount,
      last_notified_at as lastNotifiedAt,
      grace_period_end as gracePeriodEnd,
      status
    FROM watches
    WHERE active = 1
  `).all() as WatchWithSmartData[]
}

export function incrementNotificationCount(watchId: number): void {
  db.prepare('UPDATE watches SET notification_count = notification_count + 1 WHERE id = ?').run(watchId)
}

export function getNotificationCount(watchId: number): number {
  const row = db.prepare('SELECT notification_count FROM watches WHERE id = ?').get(watchId) as any
  return row?.notification_count ?? 0
}

export function setLastNotified(watchId: number, timestamp: number): void {
  db.prepare('UPDATE watches SET last_notified_at = ? WHERE id = ?').run(timestamp, watchId)
}

export function getLastNotified(watchId: number): number | null {
  const row = db.prepare('SELECT last_notified_at FROM watches WHERE id = ?').get(watchId) as any
  return row?.last_notified_at ?? null
}

export function setGracePeriod(watchId: number, endTimestamp: number): void {
  db.prepare('UPDATE watches SET grace_period_end = ? WHERE id = ?').run(endTimestamp, watchId)
}

export function getGracePeriodEnd(watchId: number): number | null {
  const row = db.prepare('SELECT grace_period_end FROM watches WHERE id = ?').get(watchId) as any
  return row?.grace_period_end ?? null
}

export function isInGracePeriod(watchId: number): boolean {
  const end = getGracePeriodEnd(watchId)
  if (!end) return false
  return Date.now() < end
}

export function setWatchStatus(watchId: number, status: string): void {
  db.prepare('UPDATE watches SET status = ? WHERE id = ?').run(status, watchId)
}

export function getWatchStatus(watchId: number): string {
  const row = db.prepare('SELECT status FROM watches WHERE id = ?').get(watchId) as any
  return row?.status ?? 'active'
}

export function getWatchByUserAndInfirmary(telegramId: number, infirmaryId: number): WatchWithSmartData | null {
  const row = db.prepare(`
    SELECT 
      id as watchId,
      telegram_id as telegramId,
      infirmary_id as infirmaryId,
      notification_count as notificationCount,
      last_notified_at as lastNotifiedAt,
      grace_period_end as gracePeriodEnd,
      status
    FROM watches
    WHERE telegram_id = ? AND infirmary_id = ? AND active = 1
  `).get(telegramId, infirmaryId) as WatchWithSmartData | undefined
  
  return row ?? null
}

// ================= WATCH HISTORY FUNCTIONS =================

export function recordNotificationEvent(
  watchId: number, 
  telegramId: number, 
  infirmaryId: number, 
  attemptNumber: number
): void {
  db.prepare(`
    INSERT INTO watch_history (watch_id, telegram_id, infirmary_id, attempt_number)
    VALUES (?, ?, ?, ?)
  `).run(watchId, telegramId, infirmaryId, attemptNumber)
}

export function recordUserResponse(watchId: number, response: 'booked' | 'continue' | 'stop'): void {
  db.prepare(`
    UPDATE watch_history 
    SET user_response = ? 
    WHERE watch_id = ? 
    ORDER BY id DESC 
    LIMIT 1
  `).run(response, watchId)
}

export function getNotificationHistory(watchId: number): Array<{
  id: number
  notifiedAt: number
  attemptNumber: number
  userResponse: string | null
}> {
  return db.prepare(`
    SELECT 
      id,
      notified_at as notifiedAt,
      attempt_number as attemptNumber,
      user_response as userResponse
    FROM watch_history
    WHERE watch_id = ?
    ORDER BY notified_at DESC
  `).all(watchId) as any
}
