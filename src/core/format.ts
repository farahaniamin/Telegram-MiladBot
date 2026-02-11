import type { TimingResult } from '../services/hospital.client.js'

export function formatTimingMessage(
  infirmaryTitle: string,
  results: TimingResult[]
): string {
  const top = results.slice(0, 8)

  const byDoctor = new Map<string, Set<string>>()
  let pDate = top[0]?.pDate ?? ''

  for (const r of top) {
    const name = r.doctor?.fullName ?? 'پزشک نامشخص'
    const shifts = (r.infirmaryTimingShiftTimeResults ?? [])
      .map(s => `${s.timingShiftType?.title ?? ''} (${s.start.slice(0,5)}–${s.end.slice(0,5)})`)
    const set = byDoctor.get(name) ?? new Set<string>()
    shifts.forEach(x => set.add(x))
    byDoctor.set(name, set)
    if (!pDate && r.pDate) pDate = r.pDate
  }

  const lines: string[] = []
  lines.push('🔔 نوبت باز شد!')
  lines.push('')
  lines.push(`🏥 درمانگاه: ${infirmaryTitle}`)
  if (pDate) lines.push(`📅 تاریخ: ${pDate}`)
  lines.push('')
  lines.push('👨‍⚕️ پزشکان/شیفت‌های در دسترس:')

  let i = 0
  for (const [doc, shifts] of byDoctor) {
    i += 1
    lines.push(`- ${doc}: ${Array.from(shifts).join('، ')}`)
    if (i >= 8) break
  }

  lines.push('')
  lines.push('⚠️ سریع اقدام کن، ممکنه پر بشه.')
  return lines.join('\n')
}
