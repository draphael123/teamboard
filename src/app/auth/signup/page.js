'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Layers, ArrowRight, CheckCircle2 } from 'lucide-react'

const FEATURES = [
  'Drag-and-drop kanban boards',
  '6 ready-to-use templates',
  'Real-time task updates',
  'Comments & notifications',
  'Invite unlimited teammates',
  'Filter by priority & assignee',
]

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
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

      {/* ── Left panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] relative overflow-hidden flex-col justify-between p-12">
        {/* Aurora blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-15%] left-[-5%] w-[60%] h-[60%] rounded-full opacity-25 blur-3xl"
               style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-10%] right-[5%] w-[55%] h-[55%] rounded-full opacity-20 blur-3xl"
               style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />
          <div className="absolute top-[50%] left-[20%] w-[35%] h-[35%] rounded-full opacity-15 blur-3xl"
               style={{ background: 'radial-gradient(circle, #2952ff 0%, transparent 70%)' }} />
        </div>

        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
             style={{
               backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
               backgroundSize: '40px 40px',
             }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 logo-mark rounded-xl flex items-center justify-center">
              <Layers size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">TeamBoard</span>
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight mb-3">
            Everything your<br />
            team needs to<br />
            <span className="gradient-text">get things done.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-xs mt-4">
            Free to get started. No credit card required.
          </p>
        </div>

        <div className="relative z-10">
          <div className="glow-divider mb-6" />
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-5">What you get</p>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="text-brand-400 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300 leading-snug">{f}</span>
              </div>
            ))}
          </div>

          {/* Mini board preview */}
          <div className="mt-8 flex gap-2 opacity-50">
            {['#475569', '#2952ff', '#10b981'].map((color, i) => (
              <div key={i} className="flex-1 rounded-lg p-2"
                   style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-1 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <div className="h-1.5 rounded-full flex-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
                </div>
                {[...Array(i === 1 ? 2 : i === 0 ? 3 : 1)].map((_, j) => (
                  <div key={j} className="h-5 rounded mb-1"
                       style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm animate-fade-in">

          <div className="flex items-center gap-2.5 justify-center mb-8 lg:hidden">
            <div className="w-9 h-9 logo-mark rounded-xl flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">TeamBoard</span>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Create an account</h1>
              <p className="text-sm text-gray-500 mt-1">Start for free, no card needed</p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl px-4 py-3 text-sm text-red-400"
                   style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input
                  type="text" className="input" placeholder="Jane Smith"
                  value={fullName} onChange={e => setFullName(e.target.value)} required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email" className="input" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password" className="input" placeholder="At least 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)} required
                />
              </div>
              <button type="submit" className="btn-primary w-full mt-2 gap-2" disabled={loading}>
                {loading ? 'Creating account…' : <><span>Get started free</span><ArrowRight size={15} /></>}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-600 mt-5">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold" style={{ color: '#4d74ff' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
