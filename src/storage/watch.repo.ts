import { db } from './db.js'

export async function addWatch(telegramId: number, infirmaryId: number) {
  await db.run(
    'INSERT INTO watches (telegram_id, infirmary_id, active) VALUES ($1, $2, 1)',
    [telegramId, infirmaryId]
  )
}

export async function deactivateWatch(telegramId: number, infirmaryId: number) {
  await db.run('UPDATE watches SET active = 0 WHERE telegram_id = $1 AND infirmary_id = $2 AND active = 1',
    [telegramId, infirmaryId])
}

export async function deactivateAllByInfirmary(infirmaryId: number) {
  await db.run('UPDATE watches SET active = 0 WHERE infirmary_id = $1 AND active = 1',
    [infirmaryId])
}

export async function listActiveWatchesByUser(telegramId: number): Promise<Array<{ infirmaryId: number }>> {
  const rows = await db.all('SELECT infirmary_id as infirmaryId FROM watches WHERE telegram_id = $1 AND active = 1',
    [telegramId])
  return rows as any
}

export async function listActiveWatchesWithDetails(telegramId: number): Promise<Array<{
  watchId: number
  infirmaryId: number
  infirmaryTitle: string
  createdAt: number
}>> {
  const rows = await db.all(`
    SELECT 
      w.id as watchId,
      w.infirmary_id as infirmaryId,
      i.title as infirmaryTitle,
      w.created_at as createdAt
    FROM watches w
    JOIN infirmaries i ON w.infirmary_id = i.id
    WHERE w.telegram_id = $1 AND w.active = 1
    ORDER BY w.created_at DESC
  `, [telegramId])
  return rows as any
}

export async function getActiveWatchesGrouped(): Promise<Array<{ infirmaryId: number; userIds: number[] }>> {
  const rows = await db.all(`
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

export async function getActiveWatchesWithSmartData(): Promise<WatchWithSmartData[]> {
  const rows = await db.all(`
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
  `)
  return rows as WatchWithSmartData[]
}

export async function incrementNotificationCount(watchId: number): Promise<void> {
  await db.run('UPDATE watches SET notification_count = notification_count + 1 WHERE id = $1', [watchId])
}

export async function getNotificationCount(watchId: number): Promise<number> {
  const row = await db.get('SELECT notification_count FROM watches WHERE id = $1', [watchId]) as any
  return row?.notification_count ?? 0
}

export async function setLastNotified(watchId: number, timestamp: number): Promise<void> {
  await db.run('UPDATE watches SET last_notified_at = $1 WHERE id = $2', [timestamp, watchId])
}

export async function getLastNotified(watchId: number): Promise<number | null> {
  const row = await db.get('SELECT last_notified_at FROM watches WHERE id = $1', [watchId]) as any
  return row?.last_notified_at ?? null
}

export async function setGracePeriod(watchId: number, endTimestamp: number): Promise<void> {
  await db.run('UPDATE watches SET grace_period_end = $1 WHERE id = $2', [endTimestamp, watchId])
}

export async function getGracePeriodEnd(watchId: number): Promise<number | null> {
  const row = await db.get('SELECT grace_period_end FROM watches WHERE id = $1', [watchId]) as any
  return row?.grace_period_end ?? null
}

export async function isInGracePeriod(watchId: number): Promise<boolean> {
  const end = await getGracePeriodEnd(watchId)
  if (!end) return false
  return Date.now() < end
}

export async function setWatchStatus(watchId: number, status: string): Promise<void> {
  await db.run('UPDATE watches SET status = $1 WHERE id = $2', [status, watchId])
}

export async function getWatchStatus(watchId: number): Promise<string> {
  const row = await db.get('SELECT status FROM watches WHERE id = $1', [watchId]) as any
  return row?.status ?? 'active'
}

export async function getWatchByUserAndInfirmary(telegramId: number, infirmaryId: number): Promise<WatchWithSmartData | null> {
  const row = await db.get(`
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

export async function recordNotificationEvent(
  watchId: number, 
  telegramId: number, 
  infirmaryId: number, 
  attemptNumber: number
): Promise<void> {
  await db.run(`
    INSERT INTO watch_history (watch_id, telegram_id, infirmary_id, attempt_number)
    VALUES ($1, $2, $3, $4)
  `, [watchId, telegramId, infirmaryId, attemptNumber])
}

export async function recordUserResponse(watchId: number, response: 'booked' | 'continue' | 'stop'): Promise<void> {
  await db.run(`
    UPDATE watch_history 
    SET user_response = $1 
    WHERE watch_id = $2 
    ORDER BY id DESC 
    LIMIT 1
  `, [response, watchId])
}

export async function getNotificationHistory(watchId: number): Promise<Array<{
  id: number
  notifiedAt: number
  attemptNumber: number
  userResponse: string | null
}>> {
  const rows = await db.all(`
    SELECT 
      id,
      notified_at as notifiedAt,
      attempt_number as attemptNumber,
      user_response as userResponse
    FROM watch_history
    WHERE watch_id = $1
    ORDER BY notified_at DESC
  `, [watchId])
  return rows as any
}
