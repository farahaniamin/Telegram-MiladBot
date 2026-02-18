import { db } from './db.js'
import type { Infirmary } from '../data/infirmaries.seed.js'

export function seedInfirmaries(items: Infirmary[]) {
  for (const r of items) {
    db.run('INSERT INTO infirmaries (id, code, title) VALUES ($1, $2, $3) ON CONFLICT(id) DO NOTHING', [r.id, r.code, r.title])
  }
}

export function listInfirmaries(): Array<{ id: number; code: string | null; title: string }> {
  return db.all('SELECT id, code, title FROM infirmaries ORDER BY title') as any
}

export function getInfirmaryById(id: number): { id: number; code: string | null; title: string } | null {
  return db.get('SELECT id, code, title FROM infirmaries WHERE id = $1', [id]) as any
}

export function setInfirmaryCode(id: number, code: string) {
  db.run('UPDATE infirmaries SET code = $1 WHERE id = $2', [code, id])
}
