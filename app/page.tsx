'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, AlertCircle, ExternalLink } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'

export default function LoginPage() {
  const { t, lang, setLang } = useI18n()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()

      if (!res.ok) {
        const key = data.error as string
        setError(
          key === 'invalidCredentials' || key === 'connectionFailed'
            ? t(`login.error.${key}`)
            : t('login.error.generic')
        )
        return
      }

      router.push('/dashboard')
    } catch {
      setError(t('login.error.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Language switcher top-right */}
      <div className="flex justify-end p-4">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
          {(['en', 'es'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                lang === l
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          {/* Logo & heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
              <Image src="/logo.svg" alt="Gmail Backup Next" width={80} height={80} priority />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('login.title')}</h1>
            <p className="mt-1 text-gray-500 text-sm">{t('login.subtitle')}</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t('login.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
                    disabled:opacity-60 disabled:bg-gray-50 transition"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('login.passwordPlaceholder')}
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
                      disabled:opacity-60 disabled:bg-gray-50 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold text-sm
                  hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                {loading ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>
          </div>

          {/* Help text */}
          <div className="mt-5 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm">
            <p className="font-medium text-amber-800 mb-1">{t('login.helpTitle')}</p>
            <p className="text-amber-700">{t('login.help')}</p>
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:underline font-medium"
            >
              {t('login.helpLink')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
