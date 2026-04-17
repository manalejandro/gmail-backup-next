'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

type Lang = 'en' | 'es'

// Lazy-loaded translation objects
const translations: Record<Lang, Record<string, unknown>> = {
  en: {},
  es: {},
}

let enLoaded = false
let esLoaded = false

async function loadLang(lang: Lang) {
  if (lang === 'en' && !enLoaded) {
    const mod = await import('@/locales/en.json')
    translations.en = mod.default as Record<string, unknown>
    enLoaded = true
  }
  if (lang === 'es' && !esLoaded) {
    const mod = await import('@/locales/es.json')
    translations.es = mod.default as Record<string, unknown>
    esLoaded = true
  }
}

function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [, forceUpdate] = useState(0)

  // Load initial lang from localStorage + preload both
  useEffect(() => {
    const stored = (localStorage.getItem('gbn_lang') as Lang) ?? 'en'
    setLangState(stored)
    Promise.all([loadLang('en'), loadLang('es')]).then(() => forceUpdate(n => n + 1))
  }, [])

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('gbn_lang', newLang)
    loadLang(newLang).then(() => forceUpdate(n => n + 1))
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = getNestedValue(translations[lang], key) ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{{${k}}}`, String(v))
        }
      }
      return text
    },
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
