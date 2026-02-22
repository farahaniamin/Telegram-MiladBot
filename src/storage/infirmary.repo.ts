import { db } from './db.js'
import type { Infirmary } from '../data/infirmaries.seed.js'

export async function seedInfirmaries(items: Infirmary[]) {
  for (const r of items) {
    await db.run('INSERT INTO infirmaries (id, code, title) VALUES ($1, $2, $3) ON CONFLICT(id) DO NOTHING', [r.id, r.code, r.title])
  }
}

export async function listInfirmaries(): Promise<Array<{ id: number; code: string | null; title: string }>> {
  const rows = await db.all('SELECT id, code, title FROM infirmaries ORDER BY title')
  return rows as any
}

export async function getInfirmaryById(id: number): Promise<{ id: number; code: string | null; title: string } | null> {
  const row = await db.get('SELECT id, code, title FROM infirmaries WHERE id = $1', [id])
  return row as any
}

export async function setInfirmaryCode(id: number, code: string) {
  await db.run('UPDATE infirmaries SET code = $1 WHERE id = $2', [code, id])
}
