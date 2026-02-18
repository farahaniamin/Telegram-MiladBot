import { CONFIG } from '../config.js'
import { getActiveWatchesGrouped } from '../storage/watch.repo.js'
import { getIntervalMinutes, isPaused } from '../storage/settings.repo.js'
import { processWatchGroup, type NotifyWithButtonsFn } from './watcher.js'

function jitterMs() {
  const j = CONFIG.JITTER_SEC * 1000
  return Math.floor((Math.random() * 2 - 1) * j)
}

// This function is called by the Cron Trigger
export async function runSchedulerTick(notifyWithButtons: NotifyWithButtonsFn) {
  try {
    if (await isPaused()) {
      return
    }
    
    const groups = await getActiveWatchesGrouped()
    for (const g of groups) {
      await processWatchGroup(g, notifyWithButtons)
    }
  } catch (error) {
    console.error('Scheduler tick error:', error)
    // Errors are swallowed; backoff is handled by Cron Trigger interval
  }
}

// For Cloudflare Workers, we don't use setTimeout
// Instead, Cron Triggers call runSchedulerTick every N minutes
export function getNextRunDelay(): number {
  // This is used for informational purposes only
  // Actual scheduling is done by Cron Triggers in wrangler.toml
  return 120000 // 2 minutes default
}
