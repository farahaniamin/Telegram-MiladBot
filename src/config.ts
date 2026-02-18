function parseIntEnv(key: string, fallback: number) {
  const v = process.env[key]
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const v = process.env[key]?.toLowerCase()
  if (v === 'on' || v === 'true' || v === '1') return true
  if (v === 'off' || v === 'false' || v === '0') return false
  return fallback
}

export const CONFIG = {
  BASE_URL: 'https://miladhospital.com',
  BOT_TOKEN: process.env.BOT_TOKEN ?? '',
  ADMIN_IDS: new Set(
    (process.env.ADMIN_IDS ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => Number(s))
      .filter(n => Number.isFinite(n))
  ),
  SYSTEM_NATIONAL_CODE: process.env.SYSTEM_NATIONAL_CODE ?? '0310751942',
  DEFAULT_INTERVAL_MIN: parseIntEnv('DEFAULT_INTERVAL_MIN', 5),
  JITTER_SEC: parseIntEnv('JITTER_SEC', 20),
  CACHE_TTL_MS: 90_000,
  
  // Smart Re-watch Settings
  GRACE_PERIOD_MINUTES: 15,
  MAX_NOTIFICATIONS_PER_WATCH: 5,
  COOLDOWN_BETWEEN_NOTIFICATIONS_MIN: 2,
  ASK_USER_AFTER_GRACE_PERIOD: true
} as const
