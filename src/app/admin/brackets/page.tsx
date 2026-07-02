'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateBrackets, updateBracketMatchScore } from '@/app/actions/admin'
import type { Category, Bracket, BracketMatch } from '@/types'

export default function BracketsAdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [brackets, setBrackets] = useState<Bracket[]>([])
  const [matches, setMatches] = useState<BracketMatch[]>([])
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})

  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => {
      setCategories((data as Category[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) { setBrackets([]); setMatches([]); return }
    loadBracketsAndMatches()
  }, [selectedCategoryId])

  async function loadBracketsAndMatches() {
    const { data: bData } = await supabase
      .from('brackets')
      .select('*')
      .eq('category_id', selectedCategoryId)
      .order('position_start')
    setBrackets((bData as Bracket[]) ?? [])

    if (!bData || bData.length === 0) { setMatches([]); return }

    const bracketIds = bData.map((b: Bracket) => b.id)
    const { data: mData } = await supabase
      .from('bracket_matches')
      .select('*, home_team:home_team_id(id, name, short_name, group_id, category_id, created_at), away_team:away_team_id(id, name, short_name, group_id, category_id, created_at)')
      .in('bracket_id', bracketIds)
      .order('round_number')
      .order('match_order')

    const m = (mData as BracketMatch[]) ?? []
    setMatches(m)
    const initScores: Record<string, { home: string; away: string }> = {}
    m.forEach((match) => {
      initScores[match.id] = {
        home: match.home_score?.toString() ?? '',
        away: match.away_score?.toString() ?? '',
      }
    })
    setScores(initScores)
  }

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 4000)
  }

  async function handleGenerateBrackets() {
    if (!selectedCategoryId) return
    if (!confirm('Generezi bracket-urile playoff? Asta va marca faza grupelor ca terminată și va crea bracket-urile pentru TOATE pozițiile.')) return
    startTransition(async () => {
      try {
        await generateBrackets(selectedCategoryId)
        await loadBracketsAndMatches()
        flash('Bracket-uri generate cu succes! Toate echipele vor juca.')
      } catch (err: any) {
        flash(`Eroare: ${err.message}`)
      }
    })
  }

  async function handleSaveScore(matchId: string, status: 'scheduled' | 'live' | 'finished') {
    const s = scores[matchId]
    if (!s) return
    startTransition(async () => {
      try {
        await updateBracketMatchScore(matchId, parseInt(s.home) || 0, parseInt(s.away) || 0, status)
        await loadBracketsAndMatches()
        flash('Scor actualizat! Echipele avansează automat.')
      } catch (err: any) {
        flash(`Eroare: ${err.message}`)
      }
    })
  }

  const statusBadge = (status: string) => {
    if (status === 'live') return <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">🔴 LIVE</span>
    if (status === 'finished') return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">✅ Final</span>
    if (status === 'bye') return <span className="text-xs bg-blue-50 text-blue-400 px-2 py-0.5 rounded-full">BYE</span>
    if (status === 'scheduled') return <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">⏳ Programat</span>
    return <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">⏸ În așteptare</span>
  }

  const matchesByBracket = (bracketId: string) => matches.filter((m) => m.bracket_id === bracketId)
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Playoff & Bracket-uri</h1>

      {message && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{message}</div>
      )}

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Selectează categoria —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {selectedCategoryId && brackets.length === 0 && (
          <button
            onClick={handleGenerateBrackets}
            disabled={isPending}
            className="bg-[#0f3d1f] text-[#f0c040] font-bold px-5 py-2 rounded-lg hover:bg-green-900 disabled:opacity-50"
          >
            🏆 Generează Bracket-urile Playoff
          </button>
        )}

        {selectedCategoryId && brackets.length > 0 && (
          <button
            onClick={handleGenerateBrackets}
            disabled={isPending}
            className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            ♻️ Regenerează (resetează tot)
          </button>
        )}
      </div>

      {!selectedCategoryId && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🏆</p>
          <p>Selectează o categorie pentru a gestiona playoff-ul</p>
        </div>
      )}

      {selectedCategoryId && brackets.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium mb-2">Nu există bracket-uri pentru {selectedCategory?.name}</p>
          <p className="text-sm">Asigură-te că faza grupelor este completă, apoi generează bracket-urile.</p>
        </div>
      )}

      {brackets.map((bracket) => {
        const bracketMatches = matchesByBracket(bracket.id)
        return (
          <div key={bracket.id} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-bold text-gray-800">{bracket.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                bracket.status === 'completed' ? 'bg-gray-200 text-gray-500' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {bracket.status === 'completed' ? 'Finalizat' : 'În desfășurare'}
              </span>
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Rundă</th>
                    <th className="px-4 py-2 text-left">Meci</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Scor</th>
                    <th className="px-4 py-2 text-center">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {bracketMatches.map((match) => (
                    <tr key={match.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{match.round_name}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${match.home_team ? 'text-gray-800' : 'text-gray-300 italic'}`}>
                          {match.home_team?.name ?? 'TBD'}
                        </span>
                        <span className="mx-2 text-gray-300">vs</span>
                        <span className={`font-semibold ${match.away_team ? 'text-gray-800' : 'text-gray-300 italic'}`}>
                          {match.away_team?.name ?? 'TBD'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(match.status)}</td>
                      <td className="px-4 py-3">
                        {match.status !== 'pending' && match.status !== 'bye' ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={scores[match.id]?.home ?? ''}
                              onChange={(e) => setScores((prev) => ({ ...prev, [match.id]: { ...prev[match.id], home: e.target.value } }))}
                              className="w-12 border border-gray-300 rounded px-2 py-1 text-center font-bold text-sm"
                              disabled={match.status === 'finished'}
                            />
                            <span className="text-gray-400 font-bold">-</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={scores[match.id]?.away ?? ''}
                              onChange={(e) => setScores((prev) => ({ ...prev, [match.id]: { ...prev[match.id], away: e.target.value } }))}
                              className="w-12 border border-gray-300 rounded px-2 py-1 text-center font-bold text-sm"
                              disabled={match.status === 'finished'}
                            />
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs text-center block">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {match.status !== 'pending' && match.status !== 'bye' && match.status !== 'finished' && (
                          <div className="flex gap-1 justify-center flex-wrap">
                            <button
                              onClick={() => handleSaveScore(match.id, 'live')}
                              disabled={isPending}
                              className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100"
                            >
                              🔴 Live
                            </button>
                            <button
                              onClick={() => handleSaveScore(match.id, 'finished')}
                              disabled={isPending}
                              className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100 font-medium"
                            >
                              ✅ Final
                            </button>
                          </div>
                        )}
                        {match.status === 'live' && (
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleSaveScore(match.id, 'live')}
                              disabled={isPending}
                              className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-1 rounded hover:bg-orange-100"
                            >
                              💾 Actualizează
                            </button>
                            <button
                              onClick={() => handleSaveScore(match.id, 'finished')}
                              disabled={isPending}
                              className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100 font-medium"
                            >
                              ✅ Final
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bracketMatches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                        Nu există meciuri în acest bracket
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
