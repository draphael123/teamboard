'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Layers, LayoutDashboard, LogOut, ChevronRight, CheckSquare } from 'lucide-react'
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
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  const NAV = [
    { href: '/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
    { href: '/my-tasks',   label: 'My Tasks',  icon: CheckSquare },
  ]

  return (
    <aside
      className="fixed inset-y-0 left-0 w-[260px] flex flex-col z-20"
      style={{
        background: 'rgba(6,6,14,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 logo-mark rounded-lg flex items-center justify-center shrink-0">
          <Layers size={15} className="text-white" />
        </div>
        <span className="font-bold text-white text-base tracking-tight">TeamBoard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={active
                ? { background: 'linear-gradient(135deg,rgba(41,82,255,0.2),rgba(109,40,217,0.15))', color: '#7ba3ff', border: '1px solid rgba(41,82,255,0.2)' }
                : { color: 'rgba(107,114,128,0.9)', border: '1px solid transparent' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e5e7eb' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(107,114,128,0.9)' } }}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}

        {/* Boards section */}
        {boards.length > 0 && (
          <div className="pt-5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest mb-2"
               style={{ color: 'rgba(75,85,99,0.9)' }}>
              Boards
            </p>
            {boards.map(board => {
              const active = pathname === `/boards/${board.id}`
              const color = board.color || '#2952ff'
              return (
                <Link
                  key={board.id}
                  href={`/boards/${board.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group"
                  style={active
                    ? { background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.08)' }
                    : { color: 'rgba(107,114,128,0.9)', border: '1px solid transparent' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#d1d5db' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(107,114,128,0.9)' } }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
                    style={{ backgroundColor: color, boxShadow: active ? `0 0 6px ${color}` : 'none' }}
                  />
                  <span className="flex-1 truncate">{board.name}</span>
                  {active && <ChevronRight size={11} style={{ color: 'rgba(107,114,128,0.7)' }} />}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* Shortcuts hint */}
      <div className="px-5 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px]" style={{ color: 'rgba(75,85,99,0.8)' }}>
          <span className="font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>N</span> new task ·{' '}
          <span className="font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>/</span> search ·{' '}
          <span className="font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>Esc</span> close
        </p>
      </div>

      {/* User footer */}
      <div className="px-3 pb-4 pt-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#2952ff,#8b5cf6)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-200 truncate">{user?.full_name || 'User'}</p>
            <p className="text-[10px] truncate" style={{ color: 'rgba(107,114,128,0.8)' }}>{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="transition-colors p-1 rounded-lg"
            style={{ color: 'rgba(107,114,128,0.7)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#e5e7eb'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(107,114,128,0.7)'}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
