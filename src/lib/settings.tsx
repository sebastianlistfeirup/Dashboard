/**
 * Indstillinger som kontekst, så et modul kan pinne sig selv uden at hele
 * dashboardet skal sende props ned gennem fem lag.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useSettings, type Settings } from './config'
import type { Dashboard } from './data'

const SettingsContext = createContext<Settings | null>(null)

export function SettingsProvider({ data, children }: { data: Dashboard | null; children: ReactNode }) {
  const settings = useSettings(data)
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

/** Null outside a provider — the leadership print view renders without one. */
export function useSettingsMaybe() {
  return useContext(SettingsContext)
}

export function useSettingsRequired(): Settings {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettingsRequired uden SettingsProvider')
  return value
}
