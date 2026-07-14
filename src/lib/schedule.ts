import type { GroupMatch } from '@/types'

const MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]

export function formatDateLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

export function formatTimeLabel(time: string): string {
  return time.substring(0, 5)
}

export function formatSchedule(date: string | null, time: string | null): string | null {
  if (!date && !time) return null
  let result = ''
  if (date) result += formatDateLabel(date)
  if (time) result += (result ? ' · ' : '') + formatTimeLabel(time)
  return result
}

export type MatchGroup<T> = { key: string; label: string; sortKey: string; matches: T[] }

export function buildScheduleGroups<T extends Pick<GroupMatch, 'scheduled_date' | 'scheduled_time' | 'match_number'>>(
  matches: T[]
): MatchGroup<T>[] {
  const sorted = [...matches].sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
  const map = new Map<string, MatchGroup<T>>()

  for (const m of sorted) {
    const hasSchedule = !!(m.scheduled_date || m.scheduled_time)
    let key: string, label: string, sortKey: string

    if (hasSchedule) {
      const dk = m.scheduled_date ?? ''
      const tk = m.scheduled_time ?? ''
      key = `${dk}|${tk}`
      sortKey = `0:${key}` // meciuri programate primele, sortate cronologic
      label = formatSchedule(m.scheduled_date, m.scheduled_time) ?? ''
    } else {
      const r = Math.ceil((m.match_number ?? 0) / 2)
      key = `__r${r}`
      sortKey = `1:${String(r).padStart(4, '0')}` // runde fără dată, după meciurile programate
      label = `Runda ${r}`
    }

    if (!map.has(key)) map.set(key, { key, label, sortKey, matches: [] })
    map.get(key)!.matches.push(m)
  }

  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}
