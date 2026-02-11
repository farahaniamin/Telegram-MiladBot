import { db } from './db.js'
import type { Infirmary } from '../data/infirmaries.seed.js'

export function seedInfirmaries(items: Infirmary[]) {
  const insert = db.prepare('INSERT OR IGNORE INTO infirmaries (id, code, title) VALUES (?, ?, ?)')
  const trx = db.transaction((rows: Infirmary[]) => {
    for (const r of rows) insert.run(r.id, r.code, r.title)
  })
  trx(items)
}

export function listInfirmaries(): Array<{ id: number; code: string | null; title: string }> {
  return db.prepare('SELECT id, code, title FROM infirmaries ORDER BY title').all() as any
}

export function getInfirmaryById(id: number): { id: number; code: string | null; title: string } | null {
  return db.prepare('SELECT id, code, title FROM infirmaries WHERE id = ?').get(id) as any
}

export function setInfirmaryCode(id: number, code: string) {
  db.prepare('UPDATE infirmaries SET code = ? WHERE id = ?').run(code, id)
}
