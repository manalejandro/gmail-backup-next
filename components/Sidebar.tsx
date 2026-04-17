'use client'

import { useRouter } from 'next/navigation'
import {
  Inbox,
  CloudDownload,
  Settings,
  LogOut,
  Mail,
  Globe,
} from 'lucide-react'
import Logo from './Logo'
import { useI18n } from '@/context/I18nContext'

interface SidebarProps {
  emailCount: number
  userEmail: string
  onBackupClick: () => void
  onSettingsClick: () => void
}

export default function Sidebar({
  emailCount,
  userEmail,
  onBackupClick,
  onSettingsClick,
}: SidebarProps) {
  const { t, lang, setLang } = useI18n()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-[#1a73e8] text-white h-full">
      {/* Logo */}
      <div className="p-5 pb-6 border-b border-white/20">
        <Logo size={44} />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {/* Inbox entry */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/15 font-medium">
          <Inbox className="w-5 h-5 shrink-0" />
          <span className="flex-1 truncate">{t('sidebar.inbox')}</span>
          {emailCount > 0 && (
            <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-semibold">
              {emailCount}
            </span>
          )}
        </div>

        {/* Email count info */}
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-white/70">
          <Mail className="w-4 h-4 shrink-0" />
          <span>{t('sidebar.total', { count: emailCount })}</span>
        </div>
      </nav>

      {/* Actions */}
      <div className="p-3 space-y-1 border-t border-white/20">
        {/* Backup */}
        <button
          onClick={onBackupClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            hover:bg-white/15 active:bg-white/25 transition-colors text-left font-medium"
        >
          <CloudDownload className="w-5 h-5 shrink-0" />
          {t('sidebar.backupNow')}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            hover:bg-white/15 active:bg-white/25 transition-colors text-left"
        >
          <Settings className="w-5 h-5 shrink-0" />
          {t('sidebar.settings')}
        </button>

        {/* Language switcher */}
        <div className="flex items-center gap-3 px-3 py-2">
          <Globe className="w-5 h-5 shrink-0 text-white/70" />
          <div className="flex gap-1.5 text-sm">
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                lang === 'en'
                  ? 'bg-white text-[#1a73e8] font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('es')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                lang === 'es'
                  ? 'bg-white text-[#1a73e8] font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              ES
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="px-3 py-2 text-xs text-white/60 truncate">
          {userEmail}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
            hover:bg-white/15 active:bg-white/25 transition-colors text-left text-white/80 hover:text-white"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {t('sidebar.signOut')}
        </button>
      </div>
    </aside>
  )
}
