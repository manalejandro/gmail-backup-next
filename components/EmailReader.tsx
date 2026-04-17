'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Download,
  Paperclip,
  Mail,
  AlignLeft,
  Globe2,
  Loader2,
  ImageOff,
  SendHorizonal,
  CheckCheck,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import type { EmailMeta, EmailContent } from '@/lib/types'
import { useI18n } from '@/context/I18nContext'

interface EmailReaderProps {
  selectedEmail: EmailMeta | null
}

/** Returns true if the HTML contains any external http(s) resources */
function detectExternal(html: string): boolean {
  return /src\s*=\s*["']https?:\/\//i.test(html) ||
    /url\s*\(\s*["']?https?:\/\//i.test(html)
}

/**
 * Injects a strict CSP <meta> tag that blocks all external resources while
 * still allowing inline styles and data-URI / CID images (email inline images).
 */
function withBlockingCSP(html: string): string {
  const csp =
    '<meta http-equiv="Content-Security-Policy" ' +
    'content="default-src \'none\'; style-src \'unsafe-inline\'; ' +
    'img-src data: cid:; font-src data:;">'
  if (/<head\b/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, m => `${m}${csp}`)
  }
  return csp + html
}

export default function EmailReader({ selectedEmail }: EmailReaderProps) {
  const { t, lang } = useI18n()
  const [content, setContent] = useState<EmailContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html')
  const [allowExternal, setAllowExternal] = useState(false)
  const [forwardState, setForwardState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const locale = lang === 'es' ? es : enUS

  useEffect(() => {
    if (!selectedEmail) {
      setContent(null)
      return
    }
    setLoading(true)
    setContent(null)
    setAllowExternal(false)
    setForwardState('idle')
    fetch(`/api/emails/${encodeURIComponent(selectedEmail.id)}`)
      .then(r => r.json())
      .then((data: EmailContent) => setContent(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedEmail?.id])

  // Adjust iframe height to content
  // Rerun height adjustment whenever the displayed HTML changes (incl. when
  // the user allows external content and the srcdoc is swapped out).
  useEffect(() => {
    if (!iframeRef.current || !content?.htmlBody) return
    const iframe = iframeRef.current
    const onLoad = () => {
      try {
        const h = iframe.contentDocument?.body?.scrollHeight
        if (h) iframe.style.height = `${h + 20}px`
      } catch { /* cross-origin */ }
    }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [content?.htmlBody, allowExternal])

  async function handleForward() {
    if (!content || forwardState === 'sending') return
    setForwardState('sending')
    try {
      const res = await fetch(`/api/emails/${encodeURIComponent(content.id)}/forward`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      setForwardState('sent')
      setTimeout(() => setForwardState('idle'), 3000)
    } catch {
      setForwardState('error')
      setTimeout(() => setForwardState('idle'), 3000)
    }
  }

  if (!selectedEmail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center p-8">
        <Mail className="w-16 h-16 text-gray-200 mb-4" />
        <h3 className="text-xl font-medium text-gray-400">{t('emailReader.selectEmail')}</h3>
        <p className="text-gray-300 mt-1 text-sm">{t('emailReader.selectEmailSub')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!content) return null

  const formattedDate = (() => {
    try {
      return format(parseISO(content.date), 'PPpp', { locale })
    } catch {
      return content.date
    }
  })()

  const hasHtml = Boolean(content.htmlBody)
  const hasText = Boolean(content.textBody)
  const hasExternalResources = hasHtml && detectExternal(content.htmlBody!)
  const displayHtml = hasHtml
    ? (allowExternal ? content.htmlBody! : withBlockingCSP(content.htmlBody!))
    : null

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
        <h1 className="text-xl font-semibold text-gray-900 mb-4 leading-tight">
          {content.subject || t('emailList.noSubject')}
        </h1>

        <div className="space-y-1 text-sm">
          <MetaRow label={t('emailReader.from')} value={content.from} />
          <MetaRow label={t('emailReader.to')} value={content.to} />
          {content.cc && <MetaRow label={t('emailReader.cc')} value={content.cc} />}
          <MetaRow label={t('emailReader.date')} value={formattedDate} />
        </div>

        {/* Attachments */}
        {content.parsedAttachments?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {content.parsedAttachments.map((att, i) => (
              <a
                key={i}
                href={`/api/emails/${encodeURIComponent(content.id)}/attachments/${i}`}
                download={att.filename}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-blue-50
                  hover:text-blue-700 rounded-full text-sm text-gray-700 transition-colors cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                <span className="max-w-[180px] truncate">{att.filename}</span>
                <span className="text-gray-400 text-xs">
                  {att.size > 1024 * 1024
                    ? `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${(att.size / 1024).toFixed(0)} KB`}
                </span>
                <Download className="w-3 h-3 text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-4 flex items-center gap-2">
          {/* View mode toggle */}
          {hasHtml && hasText && (
            <div className="flex bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setViewMode('html')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  viewMode === 'html'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                {t('emailReader.htmlView')}
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  viewMode === 'text'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                {t('emailReader.plainText')}
              </button>
            </div>
          )}

          {/* Download EML */}
          <a
            href={`/api/emails/${encodeURIComponent(content.id)}/download`}
            download={`${content.id}.eml`}
            className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white
              rounded-full text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('emailReader.downloadEml')}
          </a>

          {/* Forward to self via Gmail SMTP */}
          <button
            onClick={handleForward}
            disabled={forwardState === 'sending'}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${
                forwardState === 'sent'
                  ? 'bg-green-100 text-green-700'
                  : forwardState === 'error'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
              }`}
          >
            {forwardState === 'sending' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : forwardState === 'sent' ? (
              <CheckCheck className="w-4 h-4" />
            ) : (
              <SendHorizonal className="w-4 h-4" />
            )}
            {forwardState === 'sending'
              ? t('emailReader.forwarding')
              : forwardState === 'sent'
              ? t('emailReader.forwarded')
              : forwardState === 'error'
              ? t('emailReader.forwardError')
              : t('emailReader.forwardToSelf')}
          </button>
        </div>
      </div>

      {/* External-resource banner */}
      {viewMode === 'html' && hasExternalResources && !allowExternal && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="flex items-center gap-2 text-amber-700 text-xs">
            <ImageOff className="w-4 h-4 shrink-0" />
            <span>{t('emailReader.externalBlocked')}</span>
          </div>
          <button
            onClick={() => setAllowExternal(true)}
            className="shrink-0 text-xs font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors"
          >
            {t('emailReader.showImages')}
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'html' && displayHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={displayHtml}
            sandbox="allow-same-origin"
            className="w-full min-h-full border-none"
            style={{ minHeight: '400px' }}
            title="Email content"
          />
        ) : hasText ? (
          <pre className="p-6 text-sm text-gray-700 font-sans whitespace-pre-wrap break-words leading-relaxed">
            {content.textBody}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            {t('emailReader.noBody')}
          </div>
        )}
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-12 shrink-0">{label}</span>
      <span className="text-gray-700 break-all">{value}</span>
    </div>
  )
}

