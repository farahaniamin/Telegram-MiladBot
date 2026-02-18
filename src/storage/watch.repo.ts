import { getDatabase } from './db.js'

export async function addWatch(telegramId: number, infirmaryId: number) {
  const db = getDatabase()
  await db.prepare(
    'INSERT INTO watches (telegram_id, infirmary_id, active) VALUES (?, ?, 1)'
  ).bind(telegramId, infirmaryId).run()
}

export async function deactivateWatch(telegramId: number, infirmaryId: number) {
  const db = getDatabase()
  await db.prepare('UPDATE watches SET active = 0 WHERE telegram_id = ? AND infirmary_id = ? AND active = 1')
    .bind(telegramId, infirmaryId).run()
}

export async function deactivateAllByInfirmary(infirmaryId: number) {
  const db = getDatabase()
  await db.prepare('UPDATE watches SET active = 0 WHERE infirmary_id = ? AND active = 1')
    .bind(infirmaryId).run()
}

export async function listActiveWatchesByUser(telegramId: number): Promise<Array<{ infirmaryId: number }>> {
  const db = getDatabase()
  const result = await db.prepare('SELECT infirmary_id as infirmaryId FROM watches WHERE telegram_id = ? AND active = 1')
    .bind(telegramId).all()
  return (result.results || []) as any
}

export async function listActiveWatchesWithDetails(telegramId: number): Promise<Array<{
  watchId: number
  infirmaryId: number
  infirmaryTitle: string
  createdAt: number
}>> {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT 
      w.id as watchId,
      w.infirmary_id as infirmaryId,
      i.title as infirmaryTitle,
      w.created_at as createdAt
    FROM watches w
    JOIN infirmaries i ON w.infirmary_id = i.id
    WHERE w.telegram_id = ? AND w.active = 1
    ORDER BY w.created_at DESC
  `).bind(telegramId).all()
  return (result.results || []) as any
}

/**
 * Group watches by infirmary to minimize requests.
 * Returns: [{ infirmaryId, userIds: number[] }]
 */
export async function getActiveWatchesGrouped(): Promise<Array<{ infirmaryId: number; userIds: number[] }>> {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT infirmary_id as infirmaryId, GROUP_CONCAT(telegram_id) as users
    FROM watches
    WHERE active = 1
    GROUP BY infirmary_id
  `).all()
  
  const rows = (result.results || []) as any[]
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

export async function getActiveWatchesWithSmartData(): Promise<WatchWithSmartData[]> {
  const db = getDatabase()
  const result = await db.prepare(`
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
  `).all()
  return (result.results || []) as WatchWithSmartData[]
}

export async function incrementNotificationCount(watchId: number): Promise<void> {
  const db = getDatabase()
  await db.prepare('UPDATE watches SET notification_count = notification_count + 1 WHERE id = ?').bind(watchId).run()
}

export async function getNotificationCount(watchId: number): Promise<number> {
  const db = getDatabase()
  const result = await db.prepare('SELECT notification_count FROM watches WHERE id = ?').bind(watchId).first()
  return (result as any)?.notification_count ?? 0
}

export async function setLastNotified(watchId: number, timestamp: number): Promise<void> {
  const db = getDatabase()
  await db.prepare('UPDATE watches SET last_notified_at = ? WHERE id = ?').bind(timestamp, watchId).run()
}

export async function getLastNotified(watchId: number): Promise<number | null> {
  const db = getDatabase()
  const result = await db.prepare('SELECT last_notified_at FROM watches WHERE id = ?').bind(watchId).first()
  return (result as any)?.last_notified_at ?? null
}

export async function setGracePeriod(watchId: number, endTimestamp: number): Promise<void> {
  const db = getDatabase()
  await db.prepare('UPDATE watches SET grace_period_end = ? WHERE id = ?').bind(endTimestamp, watchId).run()
}

export async function getGracePeriodEnd(watchId: number): Promise<number | null> {
  const db = getDatabase()
  const result = await db.prepare('SELECT grace_period_end FROM watches WHERE id = ?').bind(watchId).first()
  return (result as any)?.grace_period_end ?? null
}

export async function isInGracePeriod(watchId: number): Promise<boolean> {
  const end = await getGracePeriodEnd(watchId)
  if (!end) return false
  return Date.now() < end
}

export async function setWatchStatus(watchId: number, status: string): Promise<void> {
  const db = getDatabase()
  await db.prepare('UPDATE watches SET status = ? WHERE id = ?').bind(status, watchId).run()
}

export async function getWatchStatus(watchId: number): Promise<string> {
  const db = getDatabase()
  const result = await db.prepare('SELECT status FROM watches WHERE id = ?').bind(watchId).first()
  return (result as any)?.status ?? 'active'
}

export async function getWatchByUserAndInfirmary(telegramId: number, infirmaryId: number): Promise<WatchWithSmartData | null> {
  const db = getDatabase()
  const result = await db.prepare(`
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
  `).bind(telegramId, infirmaryId).first()
  
  return (result as WatchWithSmartData) ?? null
}

// ================= WATCH HISTORY FUNCTIONS =================

export async function recordNotificationEvent(
  watchId: number, 
  telegramId: number, 
  infirmaryId: number, 
  attemptNumber: number
): Promise<void> {
  const db = getDatabase()
  await db.prepare(`
    INSERT INTO watch_history (watch_id, telegram_id, infirmary_id, attempt_number)
    VALUES (?, ?, ?, ?)
  `).bind(watchId, telegramId, infirmaryId, attemptNumber).run()
}

export async function recordUserResponse(watchId: number, response: 'booked' | 'continue' | 'stop'): Promise<void> {
  const db = getDatabase()
  await db.prepare(`
    UPDATE watch_history 
    SET user_response = ? 
    WHERE watch_id = ? 
    ORDER BY id DESC 
    LIMIT 1
  `).bind(response, watchId).run()
}

export async function getNotificationHistory(watchId: number): Promise<Array<{
  id: number
  notifiedAt: number
  attemptNumber: number
  userResponse: string | null
}>> {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT 
      id,
      notified_at as notifiedAt,
      attempt_number as attemptNumber,
      user_response as userResponse
    FROM watch_history
    WHERE watch_id = ?
    ORDER BY notified_at DESC
  `).bind(watchId).all()
  return (result.results || []) as any
}
