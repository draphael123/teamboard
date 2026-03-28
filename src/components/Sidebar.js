'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Layers, LayoutDashboard, LogOut, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function Sidebar({ boards = [], user }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] flex flex-col bg-gray-900 border-r border-gray-800 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-800 shrink-0">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Layers size={15} className="text-white" />
        </div>
        <span className="font-bold text-gray-100 text-base">TeamBoard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${pathname === '/dashboard'
              ? 'bg-brand-600/20 text-brand-400'
              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>

        {boards.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Boards
            </p>
            {boards.map(board => {
              const active = pathname === `/boards/${board.id}`
              return (
                <Link
                  key={board.id}
                  href={`/boards/${board.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors group
                    ${active
                      ? 'bg-gray-800 text-gray-100'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: board.color || '#2952ff' }}
                  />
                  <span className="flex-1 truncate">{board.name}</span>
                  {active && <ChevronRight size={12} className="text-gray-500" />}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-2 border-t border-gray-800 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-200 truncate">{user?.full_name || 'User'}</p>
            <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
