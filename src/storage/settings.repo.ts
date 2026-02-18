import { db } from './db.js'
import { CONFIG } from '../config.js'

export function getSetting(key: string): string | null {
  const row = db.get('SELECT value FROM settings WHERE key = $1', [key]) as any
  return row?.value ?? null
}

export function setSetting(key: string, value: string) {
  db.run(`
    INSERT INTO settings (key, value) VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `, [key, value])
}

export function getIntervalMinutes(): number {
  const v = getSetting('interval_minutes')
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) ? n : CONFIG.DEFAULT_INTERVAL_MIN
}

export function setIntervalMinutes(minutes: number) {
  setSetting('interval_minutes', String(minutes))
}

export function isPaused(): boolean {
  return getSetting('paused') === '1'
}

export function setPaused(paused: boolean) {
  setSetting('paused', paused ? '1' : '0')
}

export function isLocalProxyEnabled(): boolean {
  const v = getSetting('use_local_proxy')
  if (v === '1') return true
  if (v === '0') return false
  return CONFIG.DEFAULT_USE_LOCAL_PROXY
}

export function setLocalProxyEnabled(enabled: boolean) {
  setSetting('use_local_proxy', enabled ? '1' : '0')
}

export function isApiWorkerEnabled(): boolean {
  const v = getSetting('use_api_worker')
  if (v === '1') return true
  if (v === '0') return false
  return CONFIG.DEFAULT_USE_API_WORKER
}

export function setApiWorkerEnabled(enabled: boolean) {
  setSetting('use_api_worker', enabled ? '1' : '0')
}
