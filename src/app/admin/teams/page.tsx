'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createGroup, deleteGroup, createTeam, deleteTeam } from '@/app/actions/admin'
import type { Category, Group, Team } from '@/types'

export default function TeamsAdminPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamShort, setNewTeamShort] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('display_order').then(({ data }) => {
      setCategories((data as Category[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) { setGroups([]); setTeams([]); return }
    supabase.from('groups').select('*').eq('category_id', selectedCategoryId).order('display_order').then(({ data }) => {
      setGroups((data as Group[]) ?? [])
    })
  }, [selectedCategoryId])

  useEffect(() => {
    if (!selectedGroupId) { setTeams([]); return }
    supabase.from('teams').select('*').eq('group_id', selectedGroupId).order('created_at').then(({ data }) => {
      setTeams((data as Team[]) ?? [])
    })
  }, [selectedGroupId])

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCategoryId || !newGroupName.trim()) return
    startTransition(async () => {
      try {
        await createGroup(selectedCategoryId, newGroupName.trim())
        setNewGroupName('')
        const { data } = await supabase.from('groups').select('*').eq('category_id', selectedCategoryId).order('display_order')
        setGroups((data as Group[]) ?? [])
        flash('Grupă adăugată!')
      } catch (err: any) {
        flash(`Eroare: ${err.message}`)
      }
    })
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Ștergi această grupă și toate echipele din ea?')) return
    startTransition(async () => {
      await deleteGroup(groupId)
      const { data } = await supabase.from('groups').select('*').eq('category_id', selectedCategoryId).order('display_order')
      setGroups((data as Group[]) ?? [])
      if (selectedGroupId === groupId) { setSelectedGroupId(''); setTeams([]) }
      flash('Grupă ștearsă.')
    })
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroupId || !newTeamName.trim()) return
    startTransition(async () => {
      try {
        await createTeam(selectedGroupId, selectedCategoryId, newTeamName.trim(), newTeamShort.trim())
        setNewTeamName(''); setNewTeamShort('')
        const { data } = await supabase.from('teams').select('*').eq('group_id', selectedGroupId).order('created_at')
        setTeams((data as Team[]) ?? [])
        flash('Echipă adăugată!')
      } catch (err: any) {
        flash(`Eroare: ${err.message}`)
      }
    })
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm('Ștergi această echipă?')) return
    startTransition(async () => {
      await deleteTeam(teamId)
      setTeams((prev) => prev.filter((t) => t.id !== teamId))
      flash('Echipă ștearsă.')
    })
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Echipe & Grupe</h1>

      {message && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Select category + manage groups */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
            <h2 className="font-bold text-gray-700 mb-3">1. Selectează categoria</h2>
            <select
              value={selectedCategoryId}
              onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedGroupId('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Alege categoria —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selectedCategoryId && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">2. Grupe</h2>

              <form onSubmit={handleAddGroup} className="flex gap-2 mb-3">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="ex: Grupa A"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <button type="submit" disabled={isPending} className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
                  + Adaugă
                </button>
              </form>

              <div className="space-y-1">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${selectedGroupId === g.id ? 'bg-green-50 border border-green-300' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id) }}
                      className="text-red-400 hover:text-red-600 text-xs px-1"
                    >✕</button>
                  </div>
                ))}
                {groups.length === 0 && <p className="text-xs text-gray-400 italic">Nicio grupă</p>}
              </div>
            </div>
          )}
        </div>

        {/* Column 2-3: Teams in selected group */}
        <div className="lg:col-span-2">
          {selectedGroupId ? (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-4">
                3. Echipe în {selectedGroup?.name}
                <span className="ml-2 text-xs text-gray-400 font-normal">({teams.length} echipe)</span>
              </h2>

              <form onSubmit={handleAddTeam} className="flex gap-2 mb-4">
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Numele echipei (ex: FC Targoviste)"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
                <input
                  value={newTeamShort}
                  onChange={(e) => setNewTeamShort(e.target.value)}
                  placeholder="Abrev. (opțional)"
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" disabled={isPending} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
                  + Adaugă
                </button>
              </form>

              {teams.length > 0 ? (
                <div className="space-y-1">
                  {teams.map((t, idx) => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                        <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                        {t.short_name && <span className="text-xs text-gray-400">({t.short_name})</span>}
                      </div>
                      <button
                        onClick={() => handleDeleteTeam(t.id)}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-8">
                  Adaugă echipe în această grupă
                </p>
              )}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-600">
                💡 O grupă poate conține 3-6 echipe. Se generează câte un meci pentru fiecare pereche (round-robin).
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow border border-gray-100 p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">⚽</p>
              <p className="text-sm">Selectează o grupă din stânga pentru a gestiona echipele</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
