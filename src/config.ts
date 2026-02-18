// Config that will be set at runtime from environment
export let CONFIG = {
  BASE_URL: 'https://miladhospital.com',
  BOT_TOKEN: '',
  ADMIN_IDS: new Set<number>(),
  SYSTEM_NATIONAL_CODE: '0310751942',
  DEFAULT_INTERVAL_MIN: 5,
  JITTER_SEC: 20,
  CACHE_TTL_MS: 90_000,
  
  // Smart Re-watch Settings
  GRACE_PERIOD_MINUTES: 15,
  MAX_NOTIFICATIONS_PER_WATCH: 5,
  COOLDOWN_BETWEEN_NOTIFICATIONS_MIN: 2,
  ASK_USER_AFTER_GRACE_PERIOD: true
}

// Initialize config from environment
export function initializeConfig(env: { 
  BOT_TOKEN: string
  ADMIN_IDS: string
  SYSTEM_NATIONAL_CODE: string
  DEFAULT_INTERVAL_MIN?: string | undefined
  JITTER_SEC?: string | undefined
}) {
  CONFIG.BOT_TOKEN = env.BOT_TOKEN || ''
  
  // Parse admin IDs
  CONFIG.ADMIN_IDS = new Set(
    (env.ADMIN_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => Number(s))
      .filter(n => Number.isFinite(n))
  )
  
  CONFIG.SYSTEM_NATIONAL_CODE = env.SYSTEM_NATIONAL_CODE || '0310751942'
  CONFIG.DEFAULT_INTERVAL_MIN = parseInt(env.DEFAULT_INTERVAL_MIN || '5', 10) || 5
  CONFIG.JITTER_SEC = parseInt(env.JITTER_SEC || '20', 10) || 20
}
