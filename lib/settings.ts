import * as fs from 'fs'
import * as path from 'path'
import type { AppSettings } from './types'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

const DEFAULT_SETTINGS: AppSettings = {
  backupFolder: path.join(process.cwd(), 'backups'),
  language: 'en',
}

export function getSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings
    }
  } catch {
    // ignore, return defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated: AppSettings = { ...current, ...patch }
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true })
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
