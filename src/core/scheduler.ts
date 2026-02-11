import { CONFIG } from '../config.js'
import { getActiveWatchesGrouped } from '../storage/watch.repo.js'
import { getIntervalMinutes, isPaused } from '../storage/settings.repo.js'
import { processWatchGroup, type NotifyFn } from './watcher.js'

function jitterMs() {
  const j = CONFIG.JITTER_SEC * 1000
  return Math.floor((Math.random() * 2 - 1) * j)
}

export function startScheduler(notify: NotifyFn) {
  let running = true

  async function tick() {
    if (!running) return

    try {
      if (!isPaused()) {
        const groups = getActiveWatchesGrouped()
        for (const g of groups) {
          await processWatchGroup(g, notify)
        }
      }
    } catch {
      // swallow; backoff is handled by longer interval below
    } finally {
      const intervalMin = getIntervalMinutes()
      const delay = Math.max(15_000, intervalMin * 60_000 + jitterMs())
      setTimeout(tick, delay)
    }
  }

  tick()

  return {
    stop() {
      running = false
    }
  }
}
