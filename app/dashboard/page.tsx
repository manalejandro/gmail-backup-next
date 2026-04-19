'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import EmailList from '@/components/EmailList'
import EmailReader from '@/components/EmailReader'
import BackupModal from '@/components/BackupModal'
import SettingsPanel from '@/components/SettingsPanel'
import type { EmailMeta } from '@/lib/types'

interface EmailListResponse {
  items: EmailMeta[]
  total: number
}

export default function DashboardPage() {
  const [emails, setEmails] = useState<EmailMeta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState<'all' | 'from' | 'subject'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const LIMIT = 50
  const [selectedEmail, setSelectedEmail] = useState<EmailMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBackup, setShowBackup] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const fetchEmails = useCallback(async (p: number, q: string, field: string, from: string, to: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q) params.set('q', q)
      if (field && field !== 'all') params.set('field', field)
      if (from) params.set('dateFrom', from)
      if (to) params.set('dateTo', to)
      const res = await fetch(`/api/emails?${params}`)
      if (res.ok) {
        const data: EmailListResponse = await res.json()
        setEmails(data.items)
        setTotal(data.total)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // Load session info
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(s => { if (s.email) setUserEmail(s.email) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchEmails(page, search, searchField, dateFrom, dateTo)
  }, [fetchEmails, page, search, searchField, dateFrom, dateTo])

  function handleSearch(q: string, field: 'all' | 'from' | 'subject') {
    setSearch(q)
    setSearchField(field)
    setPage(1)
  }

  function handleDateFilter(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
    setPage(1)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    setSelectedEmail(null)
  }

  function handleSelectEmail(email: EmailMeta) {
    setSelectedEmail(email)
    // Optimistically mark as read in local list
    setEmails(prev =>
      prev.map(e => (e.id === email.id ? { ...e, read: true } : e))
    )
  }

  function handleBackupComplete() {
    fetchEmails(page, search, searchField, dateFrom, dateTo)
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#f1f3f4]">
      {/* Sidebar */}
      <Sidebar
        emailCount={total}
        userEmail={userEmail}
        onBackupClick={() => setShowBackup(true)}
        onSettingsClick={() => setShowSettings(true)}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden rounded-l-2xl shadow-sm m-2 ml-0 bg-white">
        {/* Email list */}
        <EmailList
          emails={emails}
          total={total}
          page={page}
          limit={LIMIT}
          selectedId={selectedEmail?.id ?? null}
          loading={loading}
          onSelect={handleSelectEmail}
          onRefresh={() => fetchEmails(page, search, searchField, dateFrom, dateTo)}
          onPageChange={handlePageChange}
          onSearch={handleSearch}
          onDateFilter={handleDateFilter}
        />

        {/* Email reader */}
        <EmailReader selectedEmail={selectedEmail} />
      </div>

      {/* Modals */}
      {showBackup && (
        <BackupModal
          onClose={() => setShowBackup(false)}
          onComplete={handleBackupComplete}
        />
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
