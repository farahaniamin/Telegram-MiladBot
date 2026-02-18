import { getDatabase } from './db.js'
import { CONFIG } from '../config.js'

export async function getSetting(key: string): Promise<string | null> {
  const db = getDatabase()
  const result = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first()
  return (result as any)?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDatabase()
  await db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).bind(key, value).run()
}

export async function getIntervalMinutes(): Promise<number> {
  const v = await getSetting('interval_minutes')
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) ? n : CONFIG.DEFAULT_INTERVAL_MIN
}

export async function setIntervalMinutes(minutes: number): Promise<void> {
  await setSetting('interval_minutes', String(minutes))
}

export async function isPaused(): Promise<boolean> {
  return (await getSetting('paused')) === '1'
}

export async function setPaused(paused: boolean): Promise<void> {
  await setSetting('paused', paused ? '1' : '0')
}

// Proxy-related settings removed - not supported in Cloudflare Workers
// export function isLocalProxyEnabled(): boolean { ... }
// export function setLocalProxyEnabled(enabled: boolean) { ... }
// export function isApiWorkerEnabled(): boolean { ... }
// export function setApiWorkerEnabled(enabled: boolean) { ... }
