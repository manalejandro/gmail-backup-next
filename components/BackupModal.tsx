'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  CloudDownload,
  CheckCircle,
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import type { BackupEvent } from '@/lib/types'
import { useI18n } from '@/context/I18nContext'

interface BackupModalProps {
  onClose: () => void
  onComplete: () => void
}

type Status = 'idle' | 'running' | 'complete' | 'error'

export default function BackupModal({ onClose, onComplete }: BackupModalProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [newCount, setNewCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [sessionNum, setSessionNum] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [backupFolder, setBackupFolder] = useState('')
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => setBackupFolder(s.backupFolder ?? ''))
      .catch(() => {})
  }, [])

  async function startBackup() {
    setStatus('running')
    setMessage(t('backup.connecting'))
    setProgress({ current: 0, total: 0 })
    setNewCount(0)
    setSkippedCount(0)
    setSessionNum(0)
    setTotalSessions(0)

    try {
      const response = await fetch('/api/backup')
      if (!response.ok) throw new Error('Backup request failed')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw) as BackupEvent & { newCount?: number; skippedCount?: number }
            handleEvent(event)
          } catch { /* malformed JSON, skip */ }
        }
      }
    } catch (err) {
      if (status !== 'complete') {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : t('backup.error'))
      }
    }
  }

  function handleEvent(event: BackupEvent) {
    switch (event.type) {
      case 'connecting':
        if (event.session) setSessionNum(event.session)
        setMessage(t('backup.connecting'))
        break
      case 'start':
        if (event.session) setSessionNum(event.session)
        setMessage(t('backup.running'))
        setProgress({ current: 0, total: event.total ?? 0 })
        break
      case 'progress':
        setProgress({ current: event.current ?? 0, total: event.total ?? 0 })
        break
      case 'complete':
        setStatus('complete')
        setNewCount(event.newCount ?? 0)
        setSkippedCount(event.skippedCount ?? 0)
        setTotalSessions(event.sessions ?? 1)
        setMessage(t('backup.complete'))
        onComplete()
        break
      case 'error':
        setStatus('error')
        setMessage(event.message ?? t('backup.error'))
        break
      case 'keepalive':
        // Server heartbeat — ignore
        break
    }
  }

  function stopBackup() {
    readerRef.current?.cancel()
    setStatus('idle')
    setMessage('')
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-2.5 text-white">
            <CloudDownload className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{t('backup.title')}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'running'}
            className="text-white/70 hover:text-white transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Description */}
          {status === 'idle' && (
            <p className="text-sm text-gray-500">{t('backup.description')}</p>
          )}

          {/* Backup folder */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
            <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate font-mono text-xs">{backupFolder || '…'}</span>
          </div>

          {/* Progress */}
          {(status === 'running' || status === 'complete') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-1.5">
                  {status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {message}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  {sessionNum > 0 && (
                    <span className="text-xs text-blue-500 font-medium">
                      {t('backup.session', { n: sessionNum })}
                    </span>
                  )}
                  {progress.total > 0 && (
                    <span className="text-gray-500 font-medium text-xs">
                      {t('backup.progressLabel', { current: progress.current, total: progress.total })}
                    </span>
                  )}
                </div>
              </div>

              {progress.total > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {status === 'complete' && (
                <div className="flex flex-wrap gap-4 text-sm pt-1">
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {t('backup.newCount', { count: newCount })}
                  </div>
                  <div className="text-gray-400">
                    {t('backup.skippedCount', { count: skippedCount })}
                  </div>
                  {totalSessions > 1 && (
                    <div className="text-gray-400">
                      {t('backup.sessionCount', { count: totalSessions })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          {status === 'running' ? (
            <button
              onClick={stopBackup}
              className="px-5 py-2 rounded-full text-sm font-medium border border-gray-300
                hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              {t('backup.stop')}
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full text-sm font-medium text-gray-600
                  hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                {t('backup.close')}
              </button>
              <button
                onClick={startBackup}
                className="px-6 py-2 rounded-full text-sm font-semibold bg-blue-600 text-white
                  hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                {t('backup.start')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
