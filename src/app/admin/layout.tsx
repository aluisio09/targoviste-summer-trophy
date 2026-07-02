import Link from 'next/link'
import { logoutAction } from '@/app/actions/auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-[#0f3d1f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1 flex-wrap">
          <Link href="/" className="text-[#f0c040] font-extrabold text-base mr-4">
            ⚽ TST Admin
          </Link>
          <Link href="/admin/dashboard" className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded hover:bg-green-900 transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/teams" className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded hover:bg-green-900 transition-colors">
            Echipe & Grupe
          </Link>
          <Link href="/admin/matches" className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded hover:bg-green-900 transition-colors">
            Meciuri
          </Link>
          <Link href="/admin/brackets" className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded hover:bg-green-900 transition-colors">
            Playoff
          </Link>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="text-xs text-red-300 hover:text-red-100 px-3 py-1.5 rounded hover:bg-red-900/40 transition-colors">
              Deconectare
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
