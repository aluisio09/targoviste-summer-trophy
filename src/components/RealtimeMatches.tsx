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

  return (
    <div>
      {groupName && (
        <h4 className="text-sm font-semibold text-gray-600 mb-2">{groupName}</h4>
      )}
      <div className="space-y-1">
        {matches.map((m) => (
          <GroupMatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}
