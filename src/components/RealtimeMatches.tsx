'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GroupMatch } from '@/types'
import { GroupMatchCard } from './MatchCard'

const MONTHS = ['ian.','feb.','mar.','apr.','mai','iun.','iul.','aug.','sep.','oct.','nov.','dec.']

type MatchGroup = { key: string; label: string; sortKey: string; matches: GroupMatch[] }

function buildGroups(matches: GroupMatch[]): MatchGroup[] {
  const sorted = [...matches].sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
  const map = new Map<string, MatchGroup>()

  for (const m of sorted) {
    const hasSchedule = !!(m.scheduled_date || m.scheduled_time)
    let key: string, label: string, sortKey: string

    if (hasSchedule) {
      const dk = m.scheduled_date ?? ''
      const tk = m.scheduled_time ?? ''
      key = `${dk}|${tk}`
      sortKey = `0:${key}` // meciuri programate primele, sortate cronologic
      let lbl = ''
      if (dk) {
        const [, mo, d] = dk.split('-')
        lbl = `${parseInt(d)} ${MONTHS[parseInt(mo) - 1]}`
      }
      if (tk) lbl += (lbl ? ' · ' : '') + tk.substring(0, 5)
      label = lbl
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

interface Props {
  categoryId: string
  initialMatches: GroupMatch[]
  groupId?: string
  groupName?: string
}

export function RealtimeGroupMatches({ categoryId, initialMatches, groupId, groupName }: Props) {
  const [matches, setMatches] = useState(initialMatches)
  const supabase = createClient()

  useEffect(() => {
    const filter = groupId
      ? `group_id=eq.${groupId}`
      : `category_id=eq.${categoryId}`

    const channel = supabase
      .channel(`matches-${groupId ?? categoryId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_matches', filter },
        (payload) => {
          setMatches((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [categoryId, groupId])

  if (matches.length === 0) return null

  const groups = buildGroups(matches)

  return (
    <div>
      {groupName && (
        <h4 className="text-sm font-semibold text-gray-600 mb-2">{groupName}</h4>
      )}
      <div className="space-y-4">
        {groups.map(({ key, label, matches: gm }) => (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {label}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-1">
              {gm.map((m) => (
                <GroupMatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
