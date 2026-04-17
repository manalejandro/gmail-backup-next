'use client'

import { useState, useEffect } from 'react'
import { Search, Paperclip, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatDistanceToNow, format, isToday, isYesterday, parseISO, type Locale } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import type { EmailMeta } from '@/lib/types'
import { useI18n } from '@/context/I18nContext'

interface EmailListProps {
  emails: EmailMeta[]
  total: number
  page: number
  limit: number
  selectedId: string | null
  loading: boolean
  onSelect: (email: EmailMeta) => void
  onRefresh: () => void
  onPageChange: (page: number) => void
  onSearch: (q: string) => void
  onDateFilter: (from: string, to: string) => void
}

function formatDate(dateStr: string, locale: Locale): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return formatDistanceToNow(date, { addSuffix: true, locale })
  if (isYesterday(date)) return format(date, "'Yesterday'")
  return format(date, 'MMM d, yyyy')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function initials(from: string): string {
  const name = from.replace(/<[^>]+>/g, '').trim()
  const words = name.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500',
  'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
]
function avatarColor(from: string): string {
  let h = 0
  for (let i = 0; i < from.length; i++) h = (h * 31 + from.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function EmailList({
  emails,
  total,
  page,
  limit,
  selectedId,
  loading,
  onSelect,
  onRefresh,
  onPageChange,
  onSearch,
  onDateFilter,
}: EmailListProps) {
  const { t, lang } = useI18n()
  const [searchInput, setSearchInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pageInput, setPageInput] = useState(String(page))
  const locale = lang === 'es' ? es : enUS
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // Keep pageInput in sync when the controlled page prop changes
  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  // Debounce search input → call onSearch
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchInput)
    }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function handleDateFromChange(v: string) {
    setDateFrom(v)
    onDateFilter(v, dateTo)
  }

  function handleDateToChange(v: string) {
    setDateTo(v)
    onDateFilter(dateFrom, v)
  }

  function clearDates() {
    setDateFrom('')
    setDateTo('')
    onDateFilter('', '')
  }

  function commitPageInput() {
    const n = parseInt(pageInput, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n)
    } else {
      setPageInput(String(page))
    }
  }

  return (
    <div className="w-80 shrink-0 flex flex-col bg-white border-r border-gray-200 h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-gray-100 space-y-2">
        {/* Text search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t('emailList.search')}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-full
              text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
              transition"
          />
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">{t('emailList.dateFrom')}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => handleDateFromChange(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg
              text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
              transition"
          />
          <span className="text-xs text-gray-400 shrink-0">{t('emailList.dateTo')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => handleDateToChange(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg
              text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
              transition"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={clearDates}
              className="shrink-0 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title={t('emailList.clearDates')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-xs text-gray-500 font-medium">
          {total > 0 ? `${total} emails` : ''}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Email items */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="text-sm">{t('emailList.loading')}</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2 px-4 text-center">
            <Search className="w-8 h-8 opacity-40" />
            <p className="text-sm">{searchInput ? t('emailList.noResults') : t('emailList.noEmails')}</p>
          </div>
        ) : (
          emails.map(email => (
            <button
              key={email.id}
              onClick={() => onSelect(email)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100
                hover:bg-blue-50 transition-colors
                ${selectedId === email.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                ${!email.read ? 'bg-blue-50/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full ${avatarColor(email.from)} 
                  flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}>
                  {initials(email.from)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className={`text-sm truncate ${!email.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {email.from.replace(/<[^>]+>/, '').trim() || email.from}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 ml-1">
                      {formatDate(email.date, locale)}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-0.5 ${!email.read ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                    {email.subject || t('emailList.noSubject')}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">{formatSize(email.size)}</span>
                    {email.hasAttachments && (
                      <Paperclip className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between shrink-0">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            aria-label={t('emailList.prevPage')}
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>

          {/* Manual page input */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="shrink-0">{t('emailList.pageInputLabel')}</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={e => { if (e.key === 'Enter') commitPageInput() }}
              className="w-12 text-center px-1 py-0.5 border border-gray-200 rounded-md text-xs
                focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent
                [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              aria-label={t('emailList.pageInputLabel')}
            />
            <span className="shrink-0">{t('emailList.pageOf', { pages: totalPages })}</span>
          </div>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-colors"
            aria-label={t('emailList.nextPage')}
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  )
}
