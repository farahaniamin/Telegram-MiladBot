import { timingCache } from './cache.js'
import { requestQueue } from './queue.js'
import { searchInfirmaryTiming } from '../services/hospital.client.js'
import { CONFIG } from '../config.js'
import { deactivateAllByInfirmary } from '../storage/watch.repo.js'
import { getInfirmaryById } from '../storage/infirmary.repo.js'

export type WatchGroup = {
  infirmaryId: number
  userIds: number[]
}

export type NotifyFn = (userIds: number[], infirmaryTitle: string, results: any[]) => Promise<void>

export async function processWatchGroup(group: WatchGroup, notify: NotifyFn) {
  const infirmaryRow = getInfirmaryById(group.infirmaryId)
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

    if (hasSlot) {
      // notify all users watching this infirmary
      await notify(group.userIds, infirmaryRow.title, results)
      // deactivate watches to prevent repeated spam
      deactivateAllByInfirmary(group.infirmaryId)
    }
  })
}
