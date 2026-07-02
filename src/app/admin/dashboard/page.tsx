import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const revalidate = 0

async function getStats() {
  const supabase = await createServerSupabaseClient()

  const [
    { count: categories },
    { count: teams },
    { count: total },
    { count: live },
    { count: finished },
  ] = await Promise.all([
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase.from('group_matches').select('*', { count: 'exact', head: true }),
    supabase.from('group_matches').select('*', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('group_matches').select('*', { count: 'exact', head: true }).eq('status', 'finished'),
  ])

  return { categories: categories ?? 0, teams: teams ?? 0, total: total ?? 0, live: live ?? 0, finished: finished ?? 0 }
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Categorii', value: stats.categories, icon: '📋', color: 'text-blue-700' },
          { label: 'Echipe', value: stats.teams, icon: '⚽', color: 'text-green-700' },
          { label: 'Meciuri live', value: stats.live, icon: '🔴', color: 'text-red-600' },
          { label: 'Meciuri jucate', value: stats.finished, icon: '✅', color: 'text-gray-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow border border-gray-100 p-5">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <h2 className="text-base font-bold text-gray-700 mb-3">Acțiuni rapide</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/admin/teams', label: 'Gestionează echipe și grupe', icon: '⚽', desc: 'Adaugă grupe și echipe pe categorii' },
          { href: '/admin/matches', label: 'Introduce scoruri', icon: '📊', desc: 'Generează meciuri și actualizează scoruri' },
          { href: '/admin/brackets', label: 'Playoff', icon: '🏆', desc: 'Generează bracket-uri și completează playoff-ul' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl shadow border border-gray-100 p-5 hover:shadow-md hover:border-green-400 transition-all group"
          >
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="font-bold text-gray-800 group-hover:text-green-700">{item.label}</div>
            <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/" className="text-sm text-green-600 hover:underline">
          → Vizualizează site-ul public
        </Link>
      </div>
    </div>
  )
}
