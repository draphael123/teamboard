'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Layers, Kanban, Users, Bell, GripVertical, CheckCircle2, ArrowRight } from 'lucide-react'

const HOW_TO = [
  {
    step: '01',
    icon: Kanban,
    title: 'Create a board',
    desc: 'Pick a template – Sprint, Product Launch, Kanban Starter and more – or start blank.',
    color: 'from-brand-500 to-violet-500',
  },
  {
    step: '02',
    icon: GripVertical,
    title: 'Add & drag tasks',
    desc: 'Add tasks to any column and drag them between To Do, In Progress, and Done.',
    color: 'from-violet-500 to-cyan-500',
  },
  {
    step: '03',
    icon: Users,
    title: 'Invite your team',
    desc: 'Share the board with teammates. Everyone sees updates in real time.',
    color: 'from-cyan-500 to-green-500',
  },
  {
    step: '04',
    icon: Bell,
    title: 'Stay notified',
    desc: 'Get notified when tasks are assigned or commented on. Never miss a beat.',
    color: 'from-green-500 to-brand-500',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel ---------------------------------------------------- */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, #29521f 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #405c16 0%, transparent 70%)' }} />
          <div className="absolute top-[-10%] right-[-10%] w-[-10%] h-[10%] rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #00b5d4 0%, transparent 70%)' }} />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

        {/* Floating kanban mockup */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-56 opacity-40 pointer-events-none select-none">
          <div className="space-y-2">
            {[
              { label: 'To Do', color: '#4175d0', tasks: ['Define Scope', 'Research'] },
              { label: 'In Progress', color: '#29521f', tasks: ['Build MVP'] },
              { label: 'Done', color: '#10b981', tasks: ['Kickoff', 'Planning'] },
            ].map(col => (
              <div key={col.label} className="rounded-lg p-3.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
                  <span className="text-[10px] font-semibold text-gray-400">{col.label}</span>
                </div>
                {col.tasks.map(t => (
                  <div key={t} className="rounded-md px-2 py-1.5 mb-1 text-[10px] text-gray-400"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {t}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 logo-mark rounded-xl flex items-center justify-center">
              <Layers size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">TeamBoard</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl font-bold text-white leading-tight mb-3">
            Ship faster,<br />
            <span className="gradient-text">together.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-xs">
            A collaborative kanban workspace that keeps your whole team in sync — no setup required.
          </p>
        </div>

        {/* How to use steps */}
        <div className="relative z-10 space-y-4">
          <div className="glow-divider mb-6" />
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">How it works</p>
          {HOW_TO.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={item.step} className="flex items-start gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0 shadow-lg ">
                  <Icon size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-200">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* -- Right panel -- Form ------------------------------------- */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 justify-center mb-8 lg:hidden">
            <div className="w-9 h-9 logo-mark rounded-xl flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">TeamBoard</span>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl px-4 py-3 text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email" className="input"
                  placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password" className="input"
                  placeholder="********"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <button type="submit" className="btn-primary w-full mt-2 gap-2" disabled={loading}>
                {loading ? 'Signing in...' : <><span>Sign in</span><ArrowRight size={15} /></>}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-600 mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-semibold" style={{ color: '#4de7ff' }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
        }
