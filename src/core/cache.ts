import { LRUCache } from 'lru-cache'
import { CONFIG } from '../config.js'

export type CacheValue = {
  hasSlot: boolean
  checkedAt: number
}

export const timingCache = new LRUCache<number, CacheValue>({
  max: 500,
  ttl: CONFIG.CACHE_TTL_MS
})
