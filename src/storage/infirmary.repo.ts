import { getDatabase } from './db.js'
import type { Infirmary } from '../data/infirmaries.seed.js'

export async function seedInfirmaries(items: Infirmary[]) {
  const db = getDatabase()
  
  for (const item of items) {
    await db.prepare('INSERT OR IGNORE INTO infirmaries (id, code, title) VALUES (?, ?, ?)')
      .bind(item.id, item.code, item.title)
      .run()
  }
}

export async function listInfirmaries(): Promise<Array<{ id: number; code: string | null; title: string }>> {
  const db = getDatabase()
  const result = await db.prepare('SELECT id, code, title FROM infirmaries ORDER BY title').all()
  return (result.results || []) as any
}

export async function getInfirmaryById(id: number): Promise<{ id: number; code: string | null; title: string } | null> {
  const db = getDatabase()
  const result = await db.prepare('SELECT id, code, title FROM infirmaries WHERE id = ?').bind(id).first()
  return result as any
}

export async function setInfirmaryCode(id: number, code: string) {
  const db = getDatabase()
  await db.prepare('UPDATE infirmaries SET code = ? WHERE id = ?').bind(code, id).run()
}
