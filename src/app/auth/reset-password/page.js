'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Layers, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-950 flex-col justify-center items-center p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl"
            style={{ background: 'rgba(74,222,128,0.08)' }}
          />
          <div
            className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl"
            style={{ background: 'rgba(74,222,128,0.05)' }}
          />
          <div
            className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full blur-3xl"
            style={{ background: 'rgba(74,222,128,0.03)' }}
          />
        </div>

        <div className="relative z-10 text-center max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="logo-mark">
              <Layers size={24} />
            </div>
            <span className="text-2xl font-bold gradient-text">TeamBoard</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Set your new password
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Choose a strong password to keep your account secure.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="logo-mark">
              <Layers size={24} />
            </div>
            <span className="text-2xl font-bold gradient-text">TeamBoard</span>
          </div>

          <div className="card">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
              <p className="text-gray-400">Enter your new password below</p>
            </div>

            <div className="glow-divider mb-6" />

            {error && (
              <div
                className="mb-4 p-3 rounded-lg text-sm text-red-400"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                {error}
              </div>
            )}

            {success ? (
              <div className="text-center py-4">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{
                    background: 'rgba(74,222,128,0.12)',
                    border: '1px solid rgba(74,222,128,0.3)',
                  }}
                >
                  <Lock size={20} className="text-green-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Password updated!</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Your password has been reset successfully. Redirecting to dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full mt-2 gap-2"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : (
                    <>
                      <Lock size={15} />
                      <span>Update password</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-gray-600 mt-5">
              <Link
                href="/auth/login"
                className="font-semibold inline-flex items-center gap-1.5"
                style={{ color: '#4de7ff' }}
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
