'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Save, CheckCircle } from 'lucide-react'
import { useI18n } from '@/context/I18nContext'
import type { AppSettings } from '@/lib/types'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, lang, setLang } = useI18n()
  const [backupFolder, setBackupFolder] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: AppSettings) => {
        setBackupFolder(s.backupFolder ?? '')
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFolder, language: lang }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-700 to-gray-800">
          <div className="flex items-center gap-2.5 text-white">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Backup folder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.backupFolder')}
            </label>
            <input
              type="text"
              value={backupFolder}
              onChange={e => setBackupFolder(e.target.value)}
              placeholder={t('settings.backupFolderPlaceholder')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
                font-mono transition"
            />
            <p className="text-xs text-gray-400">{t('settings.backupFolderHelp')}</p>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('settings.language')}
            </label>
            <div className="flex gap-3">
              {(['en', 'es'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${
                    lang === l
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {l === 'en' ? t('settings.english') : t('settings.spanish')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-sm font-medium text-gray-600
              hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            {t('settings.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold
              bg-gray-800 text-white hover:bg-gray-900 active:bg-black transition-colors
              disabled:opacity-60"
          >
            {saved ? (
              <><CheckCircle className="w-4 h-4" />{t('settings.saved')}</>
            ) : (
              <><Save className="w-4 h-4" />{t('settings.save')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
