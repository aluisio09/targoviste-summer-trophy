import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calculateStandings } from '@/lib/standings'
import { GroupStandings } from '@/components/GroupStandings'
import { RealtimeGroupMatches } from '@/components/RealtimeMatches'
import type { Category, Group, Team, GroupMatch } from '@/types'

export const revalidate = 10

interface PageProps {
  params: Promise<{ id: string }>
}

async function getData(categoryId: string) {
  const supabase = await createServerSupabaseClient()

  const [{ data: category }, { data: groups }] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase
      .from('groups')
      .select('*')
      .eq('category_id', categoryId)
      .order('display_order'),
  ])

  if (!category) return null

  const groupIds = (groups ?? []).map((g: Group) => g.id)

  const [{ data: teams }, { data: matches }] = await Promise.all([
    supabase.from('teams').select('*').in('group_id', groupIds.length ? groupIds : ['none']),
    supabase
      .from('group_matches')
      .select('*, home_team:home_team_id(id, name, short_name, group_id, category_id, created_at), away_team:away_team_id(id, name, short_name, group_id, category_id, created_at)')
      .eq('category_id', categoryId)
      .order('match_number'),
  ])

  return { category: category as Category, groups: (groups ?? []) as Group[], teams: (teams ?? []) as Team[], matches: (matches ?? []) as GroupMatch[] }
}

export default async function CategoryPage({ params }: PageProps) {
  const { id } = await params
  const data = await getData(id)

  if (!data) notFound()

  const { category, groups, teams, matches } = data

  // Build standings per group
  const groupData = groups.map((group) => {
    const groupTeams = teams.filter((t) => t.group_id === group.id)
    const groupMatches = matches.filter((m) => m.group_id === group.id)
    const standings = calculateStandings(groupMatches, groupTeams)
    return { group, groupTeams, groupMatches, standings }
  })

  const liveCount = matches.filter((m) => m.status === 'live').length

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#0f3d1f] text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-green-300 hover:text-white text-sm">← Acasă</Link>
          <span className="text-green-600">/</span>
          <span className="text-[#f0c040] font-bold">{category.name}</span>
          {liveCount > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-xs bg-red-600 text-white px-2.5 py-1 rounded-full font-bold">
              <span className="live-dot w-2 h-2 bg-white rounded-full inline-block" />
              {liveCount} meci{liveCount > 1 ? 'uri' : ''} live
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* Navigation tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <span className="px-4 py-2 text-sm font-semibold text-green-700 border-b-2 border-green-600">
            Faza Grupelor
          </span>
          {category.group_stage_complete && (
            <Link
              href={`/category/${id}/bracket`}
              className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-green-700"
            >
              🏆 Playoff
            </Link>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">⚽</p>
            <p className="font-medium">Nu există grupe configurate pentru această categorie.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupData.map(({ group, groupMatches, standings }) => (
              <div key={group.id} className="space-y-4">
                {/* Standings */}
                <GroupStandings
                  standings={standings}
                  groupName={group.name}
                />

                {/* Live matches (with real-time updates) */}
                {groupMatches.length > 0 && (
                  <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Meciuri · {group.name}
                    </h4>
                    <RealtimeGroupMatches
                      categoryId={id}
                      initialMatches={groupMatches}
                      groupId={group.id}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {category.group_stage_complete && (
          <div className="mt-10 text-center">
            <Link
              href={`/category/${id}/bracket`}
              className="inline-flex items-center gap-2 bg-[#0f3d1f] text-[#f0c040] font-bold px-8 py-3 rounded-full hover:bg-green-900 transition-colors shadow"
            >
              🏆 Vezi Bracket-urile Playoff
            </Link>
          </div>
        )}
      </div>

      <footer className="bg-[#0f3d1f] text-green-300 text-center text-xs py-3">
        Targoviste Summer Trophy
        <br />
        <span className="text-green-500">Powered by KRUK România</span>
      </footer>
    </div>
  )
}
