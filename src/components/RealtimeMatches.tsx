'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GroupMatch } from '@/types'
import { GroupMatchCard } from './MatchCard'

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

  // Grupăm meciurile în runde de câte 2: match_number 1-2 = Runda 1, 3-4 = Runda 2 etc.
  const sorted = [...matches].sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0))
  const rounds = new Map<number, typeof matches>()
  for (const m of sorted) {
    const r = Math.ceil((m.match_number ?? 0) / 2)
    if (!rounds.has(r)) rounds.set(r, [])
    rounds.get(r)!.push(m)
  }

  return (
    <div>
      {groupName && (
        <h4 className="text-sm font-semibold text-gray-600 mb-2">{groupName}</h4>
      )}
      <div className="space-y-4">
        {Array.from(rounds.entries()).map(([roundNum, roundMatches]) => (
          <div key={roundNum}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Runda {roundNum}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-1">
              {roundMatches.map((m) => (
                <GroupMatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
