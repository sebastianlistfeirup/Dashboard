/**
 * "Tilføj til ledelsesdashboard" — pin-knappen på hvert modul.
 *
 * It sits where the eye already goes for module controls, stays quiet until
 * the module is hovered or the control is focused, and turns solid once the
 * module is on the leadership page — so the state is readable at a glance
 * while scrolling, without a row of loud badges down the page.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { moduleById } from '@/lib/config'
import { useSettingsMaybe } from '@/lib/settings'
import { motion as mo } from '@/design/tokens'

export function ModuleToggle({ moduleId, onDark = false }: { moduleId: string; onDark?: boolean }) {
  const settings = useSettingsMaybe()
  const [justChanged, setJustChanged] = useState<'til' | 'fra' | null>(null)
  if (!settings) return null

  const def = moduleById.get(moduleId)
  if (!def) return null

  const on = settings.isOnLeadership(moduleId)

  const toggle = () => {
    settings.toggleLeadership(moduleId)
    setJustChanged(on ? 'fra' : 'til')
    window.setTimeout(() => setJustChanged(null), 1800)
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        title={on
          ? `"${def.label}" vises på ledelsesdashboardet — klik for at fjerne`
          : `Tilføj "${def.label}" til ledelsesdashboardet`}
        className={`group/pin inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition-all duration-300 ease-dp ${
          on ? '' : 'opacity-45 hover:opacity-100 focus-visible:opacity-100'
        }`}
        style={{
          borderColor: on ? '#df790d' : onDark ? 'rgba(255,255,255,0.25)' : '#e2e6ea',
          background: on ? '#df790d' : 'transparent',
          color: on ? '#fff' : onDark ? '#aebdd4' : '#4a5a72',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"
             fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
        </svg>
        <span className="hidden sm:inline">{on ? 'På ledelsessiden' : 'Til ledelsen'}</span>
      </button>

      <AnimatePresence>
        {justChanged && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: mo.ease }}
            className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-lg bg-dp-navy-900 px-2.5 py-1.5 text-[0.6875rem] font-medium text-white shadow-card"
          >
            {justChanged === 'til' ? 'Tilføjet til ledelsesdashboardet' : 'Fjernet igen'}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
