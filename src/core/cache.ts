import { CONFIG } from '../config.js'

export type CacheValue = {
  hasSlot: boolean
  checkedAt: number
}

// Simple Map-based cache for Cloudflare Workers
class SimpleCache {
  private cache = new Map<number, CacheValue>()
  private maxSize: number
  private ttl: number

  constructor(options: { max: number; ttl: number }) {
    this.maxSize = options.max
    this.ttl = options.ttl
  }

  get(key: number): CacheValue | undefined {
    const value = this.cache.get(key)
    if (!value) return undefined
    
    // Check if expired
    if (Date.now() - value.checkedAt > this.ttl) {
      this.cache.delete(key)
      return undefined
    }
    
    return value
  }

  set(key: number, value: CacheValue): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, value)
  }

  has(key: number): boolean {
    return this.get(key) !== undefined
  }
}

export const timingCache = new SimpleCache({
  max: 500,
  ttl: CONFIG.CACHE_TTL_MS
})
