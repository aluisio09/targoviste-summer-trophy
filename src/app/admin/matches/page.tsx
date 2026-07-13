'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateGroupMatches, updateGroupMatchScore, setMatchLive, updateGroupMatchSchedule } from '@/app/actions/admin'
import type { Category, Group, GroupMatch } from '@/types'

export default function MatchesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [matches, setMatches] = useState<GroupMatch[]>([])
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [schedules, setSchedules] = useState<Record<string, { date: string; time: string }>>({})

  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => {
      setCategories((data as Category[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) { setGroups([]); setMatches([]); return }
    supabase.from('groups').select('*').eq('category_id', selectedCategoryId).order('display_order').then(({ data }) => {
      setGroups((data as Group[]) ?? [])
    })
  }, [selectedCategoryId])

  useEffect(() => {
    if (!selectedGroupId) { setMatches([]); return }
    loadMatches()
  }, [selectedGroupId])

  async function loadMatches() {
    const { data } = await supabase
      .from('group_matches')
      .select('*, home_team:home_team_id(id, name, short_name, group_id, category_id, created_at), away_team:away_team_id(id, name, short_name, group_id, category_id, created_at)')
      .eq('group_id', selectedGroupId)
      .order('match_number')
    const m = (data as GroupMatch[]) ?? []
    setMatches(m)
    const initScores: Record<string, { home: string; away: string }> = {}
    const initSchedules: Record<string, { date: string; time: string }> = {}
    m.forEach((match) => {
      initScores[match.id] = {
        home: match.home_score?.toString() ?? '',
        away: match.away_score?.toString() ?? '',
      }
      initSchedules[match.id] = {
        date: match.scheduled_date ?? '',
        time: match.scheduled_time ?? '',
      }
    })
    setScores(initScores)
    setSchedules(initSchedules)
  }

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleGenerate() {
    if (!selectedGroupId || !selectedCategoryId) return
    if (!confirm('Generezi meciurile round-robin pentru această grupă? Meciurile existente rămân.')) return
    startTransition(async () => {
      try {
        await generateGroupMatches(selectedGroupId, selectedCategoryId)
        await loadMatches()
        flash('Meciuri generate cu succes!')
      } catch (err: any) {
        flash(`Eroare: ${err.message}`)
      }
    })
  }

  async function handleSaveScore(matchId: string, status: 'scheduled' | 'live' | 'finished') {
    const s = scores[matchId]
    if (!s) return
    const homeScore = parseInt(s.home) || 0
    const awayScore = parseInt(s.away) || 0
    startTransition(async () => {
      try {
        await updateGroupMatchScore(matchId, homeScore, awayScore, status)
        await loadMatches()
        flash('Scor actualizat!')
      } catch (err: any) {
        flash(`Eroare: ${err.message}`)
      }
    })
  }

  async function handleScheduleBlur(matchId: string) {
    const s = schedules[matchId]
    if (!s) return
    startTransition(async () => {
      try {
        await updateGroupMatchSchedule(matchId, s.date || null, s.time || null)
      } catch (err: any) {
        flash(`Eroare orar: ${err.message}`)
      }
    })
  }

  async function handleSetLive(matchId: string) {
    startTransition(async () => {
      await setMatchLive(matchId)
      await loadMatches()
      flash('Meci marcat ca LIVE!')
    })
  }

  const statusBadge = (status: string) => {
    if (status === 'live') return <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">🔴 LIVE</span>
    if (status === 'finished') return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">✅ Terminat</span>
    return <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">⏳ Programat</span>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Meciuri faza grupelor</h1>

      {message && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{message}</div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={selectedCategoryId}
          onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedGroupId('') }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Categorie —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          disabled={!selectedCategoryId}
        >
          <option value="">— Grupă —</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {selectedGroupId && (
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            ⚙️ Generează meciuri round-robin
          </button>
        )}
      </div>

      {/* Matches list */}
      {matches.length === 0 && selectedGroupId && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium">Nu există meciuri. Generează meciurile round-robin.</p>
        </div>
      )}

      {matches.length > 0 && (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Meci</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-left">Orar</th>
                <th className="px-4 py-2 text-center">Scor</th>
                <th className="px-4 py-2 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(
                matches.reduce((acc, m) => {
                  const r = Math.ceil((m.match_number ?? 0) / 2)
                  if (!acc.has(r)) acc.set(r, [])
                  acc.get(r)!.push(m)
                  return acc
                }, new Map<number, GroupMatch[]>()).entries()
              ).flatMap(([roundNum, roundMatches]) => [
                <tr key={`rh-${roundNum}`} className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={6} className="px-4 py-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Runda {roundNum}
                    </span>
                  </td>
                </tr>,
                ...roundMatches.map((match) => (
                  <tr key={match.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-medium">{match.match_number}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-800">{match.home_team?.name}</span>
                      <span className="mx-2 text-gray-300">vs</span>
                      <span className="font-semibold text-gray-800">{match.away_team?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(match.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={schedules[match.id]?.date ?? ''}
                          onChange={(e) => setSchedules((prev) => ({ ...prev, [match.id]: { ...prev[match.id], date: e.target.value } }))}
                          onBlur={() => handleScheduleBlur(match.id)}
                          className="border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-600 w-32"
                        />
                        <input
                          type="time"
                          value={schedules[match.id]?.time ?? ''}
                          onChange={(e) => setSchedules((prev) => ({ ...prev, [match.id]: { ...prev[match.id], time: e.target.value } }))}
                          onBlur={() => handleScheduleBlur(match.id)}
                          className="border border-gray-200 rounded px-1.5 py-1 text-xs text-gray-600 w-20"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={scores[match.id]?.home ?? ''}
                          onChange={(e) => setScores((prev) => ({ ...prev, [match.id]: { ...prev[match.id], home: e.target.value } }))}
                          className="w-12 border border-gray-300 rounded px-2 py-1 text-center font-bold text-sm"
                        />
                        <span className="text-gray-400 font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={scores[match.id]?.away ?? ''}
                          onChange={(e) => setScores((prev) => ({ ...prev, [match.id]: { ...prev[match.id], away: e.target.value } }))}
                          className="w-12 border border-gray-300 rounded px-2 py-1 text-center font-bold text-sm"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center flex-wrap">
                        {match.status !== 'live' && match.status !== 'finished' && (
                          <button
                            onClick={() => handleSetLive(match.id)}
                            disabled={isPending}
                            className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100"
                          >
                            🔴 Live
                          </button>
                        )}
                        {match.status === 'live' && (
                          <button
                            onClick={() => handleSaveScore(match.id, 'live')}
                            disabled={isPending}
                            className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100"
                          >
                            💾 Actualizează
                          </button>
                        )}
                        <button
                          onClick={() => handleSaveScore(match.id, 'finished')}
                          disabled={isPending}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100 font-medium"
                        >
                          ✅ Final
                        </button>
                      </div>
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
