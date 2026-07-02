import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BracketView } from '@/components/BracketView'
import type { Bracket, BracketMatch, Category } from '@/types'

export const revalidate = 10

interface PageProps {
  params: Promise<{ id: string }>
}

async function getData(categoryId: string) {
  const supabase = await createServerSupabaseClient()

  const [{ data: category }, { data: brackets }] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase
      .from('brackets')
      .select('*')
      .eq('category_id', categoryId)
      .order('position_start'),
  ])

  if (!category) return null

  // Load matches for each bracket with team info
  const bracketsWithMatches: Bracket[] = []
  for (const bracket of (brackets ?? [])) {
    const { data: matches } = await supabase
      .from('bracket_matches')
      .select(
        '*, home_team:home_team_id(id, name, short_name, group_id, category_id, created_at), away_team:away_team_id(id, name, short_name, group_id, category_id, created_at), winner:winner_id(id, name, short_name, group_id, category_id, created_at)'
      )
      .eq('bracket_id', bracket.id)
      .order('round_number')
      .order('match_order')

    bracketsWithMatches.push({
      ...bracket,
      matches: (matches ?? []) as BracketMatch[],
    })
  }

  return { category: category as Category, brackets: bracketsWithMatches }
}

export default async function BracketPage({ params }: PageProps) {
  const { id } = await params
  const data = await getData(id)

  if (!data) notFound()

  const { category, brackets } = data

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f3d1f] text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <Link href="/" className="text-green-300 hover:text-white text-sm">← Acasă</Link>
          <span className="text-green-600">/</span>
          <Link href={`/category/${id}`} className="text-green-300 hover:text-white text-sm">
            {category.name}
          </Link>
          <span className="text-green-600">/</span>
          <span className="text-[#f0c040] font-bold">Playoff</span>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <Link
            href={`/category/${id}`}
            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-green-700"
          >
            Faza Grupelor
          </Link>
          <span className="px-4 py-2 text-sm font-semibold text-green-700 border-b-2 border-green-600">
            🏆 Playoff
          </span>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">{category.name} · Bracket Playoff</h2>
          <p className="text-sm text-gray-500 mt-1">
            Toate echipele continuă să joace — clasament final complet
          </p>
        </div>

        <BracketView brackets={brackets} />
      </div>

      <footer className="bg-[#0f3d1f] text-green-300 text-center text-xs py-3">
        Targoviste Summer Trophy
      </footer>
    </div>
  )
}
