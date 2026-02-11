import 'dotenv/config'

function parseIntEnv(key: string, fallback: number) {
  const v = process.env[key]
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
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
  CACHE_TTL_MS: 90_000
} as const
