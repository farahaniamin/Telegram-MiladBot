import { timingCache } from './cache.js'
import { requestQueue } from './queue.js'
import { searchInfirmaryTiming } from '../services/hospital.client.js'
import { CONFIG } from '../config.js'
import { 
  getInfirmaryById 
} from '../storage/infirmary.repo.js'
import {
  getWatchByUserAndInfirmary,
  incrementNotificationCount,
  setLastNotified,
  recordNotificationEvent
} from '../storage/watch.repo.js'

export type WatchGroup = {
  infirmaryId: number
  userIds: number[]
}

// New type for notification with buttons
export type NotifyWithButtonsFn = (
  userId: number, 
  infirmaryTitle: string, 
  results: any[],
  watchId: number
) => Promise<void>

export async function processWatchGroup(group: WatchGroup, notifyWithButtons: NotifyWithButtonsFn) {
  const infirmaryRow = await getInfirmaryById(group.infirmaryId)
  if (!infirmaryRow) return

  // If code unknown, skip to avoid useless/invalid calls.
  if (!infirmaryRow.code) return

  const cached = timingCache.get(group.infirmaryId)
  if (cached && Date.now() - cached.checkedAt < 5_000) {
    // tiny guard to avoid immediate double checks in same tick
    return
  }

  // Cache key for hasSlot; we still call at most once per TTL.
  if (timingCache.has(group.infirmaryId)) return

  await requestQueue.add(async () => {
    const results = await searchInfirmaryTiming(
      { id: infirmaryRow.id, code: infirmaryRow.code!, title: infirmaryRow.title },
      CONFIG.SYSTEM_NATIONAL_CODE
    )

    const hasSlot = Array.isArray(results) && results.length > 0
    timingCache.set(group.infirmaryId, { hasSlot, checkedAt: Date.now() })

    if (!hasSlot) return

    // SIMPLIFIED: Process each user individually
    for (const userId of group.userIds) {
      await processUserWatch(userId, group.infirmaryId, infirmaryRow.title, results, notifyWithButtons)
    }
  })
}

async function processUserWatch(
  userId: number,
  infirmaryId: number,
  infirmaryTitle: string,
  results: any[],
  notifyWithButtons: NotifyWithButtonsFn
) {
  const watch = await getWatchByUserAndInfirmary(userId, infirmaryId)
  if (!watch) return

  // Simplified: Always send notification with buttons
  // Let the bot handle the user response
  await notifyWithButtons(userId, infirmaryTitle, results, watch.watchId)
  
  // Track for analytics
  await incrementNotificationCount(watch.watchId)
  await setLastNotified(watch.watchId, Date.now())
  await recordNotificationEvent(watch.watchId, userId, infirmaryId, watch.notificationCount + 1)
}
