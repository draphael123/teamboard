'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Layers, ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Aurora blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-15%] left-[20%] w-[50%] h-[50%] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #2952ff 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-10%] right-[10%] w-[45%] h-[45%] rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 logo-mark rounded-xl flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">TeamBoard</span>
        </div>

        <div className="card p-8">
          {!success ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Reset password</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              {error && (
                <div
                  className="mb-5 rounded-xl px-4 py-3 text-sm text-red-400"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full mt-2 gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    'Sending link...'
                  ) : (
                    <>
                      <Mail size={15} />
                      <span>Send reset link</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'rgba(74,222,128,0.12)',
                  border: '1px solid rgba(74,222,128,0.3)',
                }}
              >
                <Mail size={20} className="text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Check your email</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                We sent a password reset link to{' '}
                <span className="text-white font-medium">{email}</span>. Click the link
                in the email to reset your password.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 mt-5">
          <Link
            href="/auth/login"
            className="font-semibold inline-flex items-center gap-1.5"
            style={{ color: '#4d74ff' }}
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
