import { db } from './db.js'
import { CONFIG } from '../config.js'

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.get('SELECT value FROM settings WHERE key = $1', [key]) as any
  return row?.value ?? null
}

export async function setSetting(key: string, value: string) {
  await db.run(`
    INSERT INTO settings (key, value) VALUES ($1, $2)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `, [key, value])
}

export async function getIntervalMinutes(): Promise<number> {
  const v = await getSetting('interval_minutes')
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) ? n : CONFIG.DEFAULT_INTERVAL_MIN
}

export async function setIntervalMinutes(minutes: number) {
  await setSetting('interval_minutes', String(minutes))
}

export async function isPaused(): Promise<boolean> {
  return (await getSetting('paused')) === '1'
}

export async function setPaused(paused: boolean) {
  await setSetting('paused', paused ? '1' : '0')
}

export async function isLocalProxyEnabled(): Promise<boolean> {
  const v = await getSetting('use_local_proxy')
  if (v === '1') return true
  if (v === '0') return false
  return CONFIG.DEFAULT_USE_LOCAL_PROXY
}

export async function setLocalProxyEnabled(enabled: boolean) {
  await setSetting('use_local_proxy', enabled ? '1' : '0')
}

export async function isApiWorkerEnabled(): Promise<boolean> {
  const v = await getSetting('use_api_worker')
  if (v === '1') return true
  if (v === '0') return false
  return CONFIG.DEFAULT_USE_API_WORKER
}

export async function setApiWorkerEnabled(enabled: boolean) {
  await setSetting('use_api_worker', enabled ? '1' : '0')
}
