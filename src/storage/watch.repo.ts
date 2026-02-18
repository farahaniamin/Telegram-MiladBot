import { db } from './db.js'

export function addWatch(telegramId: number, infirmaryId: number) {
  db.run(
    'INSERT INTO watches (telegram_id, infirmary_id, active) VALUES ($1, $2, 1)',
    [telegramId, infirmaryId]
  )
}

export function deactivateWatch(telegramId: number, infirmaryId: number) {
  db.run('UPDATE watches SET active = 0 WHERE telegram_id = $1 AND infirmary_id = $2 AND active = 1',
    [telegramId, infirmaryId])
}

export function deactivateAllByInfirmary(infirmaryId: number) {
  db.run('UPDATE watches SET active = 0 WHERE infirmary_id = $1 AND active = 1',
    [infirmaryId])
}

export function listActiveWatchesByUser(telegramId: number): Array<{ infirmaryId: number }> {
  return db.all('SELECT infirmary_id as infirmaryId FROM watches WHERE telegram_id = $1 AND active = 1',
    [telegramId]) as any
}

export function listActiveWatchesWithDetails(telegramId: number): Array<{
  watchId: number
  infirmaryId: number
  infirmaryTitle: string
  createdAt: number
}> {
  return db.all(`
    SELECT 
      w.id as watchId,
      w.infirmary_id as infirmaryId,
      i.title as infirmaryTitle,
      w.created_at as createdAt
    FROM watches w
    JOIN infirmaries i ON w.infirmary_id = i.id
    WHERE w.telegram_id = $1 AND w.active = 1
    ORDER BY w.created_at DESC
  `, [telegramId]) as any
}

export function getActiveWatchesGrouped(): Array<{ infirmaryId: number; userIds: number[] }> {
  const rows = db.all(`
    SELECT infirmary_id as infirmaryId, ARRAY_AGG(telegram_id) as users
    FROM watches
    WHERE active = 1
    GROUP BY infirmary_id
  `) as any[]

  return rows.map(r => ({
    infirmaryId: r.infirmaryId as number,
    userIds: (r.users || []).map((x: number) => Number(x)).filter((n: number) => Number.isFinite(n))
  }))
}

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
  return db.all(`
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
  `) as WatchWithSmartData[]
}

export function incrementNotificationCount(watchId: number): void {
  db.run('UPDATE watches SET notification_count = notification_count + 1 WHERE id = $1', [watchId])
}

export function getNotificationCount(watchId: number): number {
  const row = db.get('SELECT notification_count FROM watches WHERE id = $1', [watchId]) as any
  return row?.notification_count ?? 0
}

export function setLastNotified(watchId: number, timestamp: number): void {
  db.run('UPDATE watches SET last_notified_at = $1 WHERE id = $2', [timestamp, watchId])
}

export function getLastNotified(watchId: number): number | null {
  const row = db.get('SELECT last_notified_at FROM watches WHERE id = $1', [watchId]) as any
  return row?.last_notified_at ?? null
}

export function setGracePeriod(watchId: number, endTimestamp: number): void {
  db.run('UPDATE watches SET grace_period_end = $1 WHERE id = $2', [endTimestamp, watchId])
}

export function getGracePeriodEnd(watchId: number): number | null {
  const row = db.get('SELECT grace_period_end FROM watches WHERE id = $1', [watchId]) as any
  return row?.grace_period_end ?? null
}

export function isInGracePeriod(watchId: number): boolean {
  const end = getGracePeriodEnd(watchId)
  if (!end) return false
  return Date.now() < end
}

export function setWatchStatus(watchId: number, status: string): void {
  db.run('UPDATE watches SET status = $1 WHERE id = $2', [status, watchId])
}

export function getWatchStatus(watchId: number): string {
  const row = db.get('SELECT status FROM watches WHERE id = $1', [watchId]) as any
  return row?.status ?? 'active'
}

export function getWatchByUserAndInfirmary(telegramId: number, infirmaryId: number): WatchWithSmartData | null {
  const row = db.get(`
    SELECT 
      id as watchId,
      telegram_id as telegramId,
      infirmary_id as infirmaryId,
      notification_count as notificationCount,
      last_notified_at as lastNotifiedAt,
      grace_period_end as gracePeriodEnd,
      status
    FROM watches
    WHERE telegram_id = $1 AND infirmary_id = $2 AND active = 1
  `, [telegramId, infirmaryId]) as WatchWithSmartData | undefined
  
  return row ?? null
}

export function recordNotificationEvent(
  watchId: number, 
  telegramId: number, 
  infirmaryId: number, 
  attemptNumber: number
): void {
  db.run(`
    INSERT INTO watch_history (watch_id, telegram_id, infirmary_id, attempt_number)
    VALUES ($1, $2, $3, $4)
  `, [watchId, telegramId, infirmaryId, attemptNumber])
}

export function recordUserResponse(watchId: number, response: 'booked' | 'continue' | 'stop'): void {
  db.run(`
    UPDATE watch_history 
    SET user_response = $1 
    WHERE watch_id = $2 
    ORDER BY id DESC 
    LIMIT 1
  `, [response, watchId])
}

export function getNotificationHistory(watchId: number): Array<{
  id: number
  notifiedAt: number
  attemptNumber: number
  userResponse: string | null
}> {
  return db.all(`
    SELECT 
      id,
      notified_at as notifiedAt,
      attempt_number as attemptNumber,
      user_response as userResponse
    FROM watch_history
    WHERE watch_id = $1
    ORDER BY notified_at DESC
  `, [watchId]) as any
}
