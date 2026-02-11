import { db } from './db.js'
import { CONFIG } from '../config.js'

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  return row?.value ?? null
}

export function setSetting(key: string, value: string) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, value)
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
