import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Category } from '@/types'

export const revalidate = 30

async function getCategories(): Promise<Category[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('display_order')
  return (data as Category[]) ?? []
}

export default async function HomePage() {
  const categories = await getCategories()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f3d1f] text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <div className="text-5xl mb-2">⚽</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#f0c040]">
            Targoviste Summer Trophy
          </h1>
          <p className="mt-2 text-green-200 text-sm md:text-base">
            Turneu de fotbal pentru juniori · Târgoviște
          </p>
          <p className="mt-1 text-green-400 text-xs">
            Powered by KRUK România
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <h2 className="text-xl font-bold text-gray-700 mb-6">Categorii de vârstă</h2>

        {categories.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-lg font-medium">Turneul va începe în curând.</p>
            <p className="text-sm mt-2">Reveniți pentru rezultate live.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.id}`}
                className="group bg-white rounded-xl shadow hover:shadow-md border border-gray-200 hover:border-green-600 transition-all p-5 flex flex-col items-center text-center"
              >
                <span className="text-3xl mb-2">⚽</span>
                <span className="text-lg font-bold text-gray-800 group-hover:text-green-700">
                  {cat.name}
                </span>
                <span className={`mt-3 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  cat.group_stage_complete
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {cat.group_stage_complete ? '🏆 Playoff' : '🔄 Faza grupelor'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-[#0f3d1f] text-green-300 text-center text-xs py-4 mt-auto">
        Targoviste Summer Trophy · Rezultate live
        <br />
        <span className="text-green-500">Powered by KRUK România</span>
      </footer>
    </div>
  )
}
