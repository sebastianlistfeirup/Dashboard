/**
 * The frame around the dashboard: identity, freshness, filters and navigation.
 *
 * The filter row is the one control surface for the whole page — every section
 * reads the same filtered set, so choosing a segment really does mean "kun data
 * for dem" everywhere below.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion as mo } from '@/design/tokens'
import { relativeTime, type Dashboard, type Filters } from '@/lib/data'

/* ── Afsendermærke ───────────────────────────────────────────────────────── */

/**
 * A typographic lockup rather than DP's figure mark: the manual's logo asset is
 * not part of this repository, and an approximation would be worse than none.
 */
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] font-serif text-[0.9375rem] font-bold leading-none"
        style={{ background: onDark ? '#df790d' : '#3a557d', color: '#fff' }}
        aria-hidden="true"
      >
        DP
      </div>
      <div className="leading-none">
        <div
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em]"
          style={{ color: onDark ? '#aebdd4' : '#7a8798' }}
        >
          Dansk Psykolog Forening
        </div>
        <div
          className="mt-1 font-serif text-[0.9375rem] font-semibold"
          style={{ color: onDark ? '#fff' : '#16233a' }}
        >
          Udsendelsesdashboard
        </div>
      </div>
    </div>
  )
}

/* ── Opdateringsstatus ───────────────────────────────────────────────────── */

export function RefreshControls({
  generatedAt, fetchedAt, refreshing, autoRefresh, onToggleAuto, onRefresh, nextAt, embedded,
}: {
  generatedAt: string | null
  fetchedAt: Date | null
  refreshing: boolean
  autoRefresh: boolean
  onToggleAuto: (v: boolean) => void
  onRefresh: () => void
  nextAt: number | null
  embedded: boolean
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const countdown = nextAt ? Math.max(0, Math.round((nextAt - Date.now()) / 60_000)) : null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {!embedded && (
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-dp-gron" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: embedded ? '#8299bb' : '#329d9e' }} />
        </span>
        <span className="text-[0.75rem] text-dp-navy-500">
          <span className="sm:hidden">{relativeTime(generatedAt)}</span>
          <span className="hidden sm:inline">
            Data hentet {relativeTime(generatedAt)}
            {fetchedAt && !embedded && <span className="text-dp-navy-400"> · side læst {relativeTime(fetchedAt)}</span>}
          </span>
        </span>
      </div>

      {!embedded && (
        <>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="group inline-flex items-center gap-2 rounded-full border border-dp-navy-200 px-3.5 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition-all duration-300 ease-dp hover:border-dp-orange hover:text-dp-orange disabled:opacity-50"
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              className={`transition-transform duration-500 ease-dp ${refreshing ? 'animate-spin' : 'group-hover:rotate-180'}`}
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">{refreshing ? 'Opdaterer…' : 'Opdater nu'}</span>
            <span className="sm:hidden">{refreshing ? 'Henter…' : 'Opdater'}</span>
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 text-[0.75rem] text-dp-navy-600">
            <span
              className="relative h-5 w-9 rounded-full transition-colors duration-300 ease-dp"
              style={{ background: autoRefresh ? '#329d9e' : '#d4dbe1' }}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={autoRefresh}
                onChange={(e) => onToggleAuto(e.target.checked)}
              />
              <motion.span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                animate={{ left: autoRefresh ? 18 : 2 }}
                transition={{ duration: 0.28, ease: mo.ease }}
              />
            </span>
            <span className="hidden sm:inline">Opdater automatisk</span>
            <span className="sm:hidden">Auto</span>
            {autoRefresh && countdown !== null && (
              <span className="tnum hidden text-dp-navy-400 sm:inline">om {countdown} min.</span>
            )}
          </label>
        </>
      )}
      {embedded && (
        <span className="rounded-full bg-dp-navy-50 px-2.5 py-1 text-[0.6875rem] text-dp-navy-500">
          Fast øjebliksbillede — denne fil opdaterer ikke selv
        </span>
      )}
    </div>
  )
}

/* ── Sektionsnavigation ──────────────────────────────────────────────────── */

export interface SectionDef { id: string; label: string; group?: string }

export function SectionNav({ sections }: { sections: SectionDef[] }) {
  const [active, setActive] = useState(sections[0]?.id)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections])

  /**
   * Hold den aktive knap synlig i rækken — men rul kun rækken.
   *
   * Her sad en scrollIntoView på selve knappen. Den ruller alle scrollbare
   * forfædre, dokumentet med, og en ny blød rulning afbryder den der er i gang.
   * Klikkede man på en sektion, satte observeren `active` undervejs, denne
   * effekt bad om en ny rulning, og siden stoppede hvor den var. Resultatet var
   * at næsten ingen af knapperne førte nogen steder hen.
   */
  useEffect(() => {
    const rail = railRef.current
    const el = rail?.querySelector<HTMLElement>(`[data-nav="${active}"]`)
    if (!rail || !el) return
    const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2
    const max = rail.scrollWidth - rail.clientWidth
    rail.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: 'smooth' })
  }, [active])

  /**
   * Spring selv til sektionen i stedet for at overlade det til ankeret.
   *
   * Toplinjen klæber, og hvor højt den er afhænger af skærmbredden og af om
   * filterlinjen klæber med. Et fast scroll-margin gætter på det; her måles det,
   * så overskriften altid lander lige under linjen og aldrig bag den.
   */
  const jumpTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    const header = document.querySelector('header')
    const sticky = [...document.querySelectorAll<HTMLElement>('header, [data-sticky-bar]')]
      .filter((el) => getComputedStyle(el).position === 'sticky')
      .reduce((h, el) => h + el.getBoundingClientRect().height, 0)
    const top = target.getBoundingClientRect().top + window.scrollY - (sticky || header?.getBoundingClientRect().height || 0) - 8
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  // Rækken kan være bredere end skærmen. En fadekant i hver ende siger, at der
  // er mere — ellers ser en afskåret sektion bare ud som om den ikke findes.
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const read = () => setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    })
    read()
    el.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => { el.removeEventListener('scroll', read); window.removeEventListener('resize', read) }
  }, [sections])

  return (
    <nav aria-label="Sektioner" className="relative">
      <div ref={railRef} className="thin-scroll -mx-1 flex items-center gap-1 overflow-x-auto px-1 py-1">
        {sections.map((s, i) => (
          <Fragment key={s.id}>
            {/* Grupperne holder rækken læsbar, når der er mange sektioner */}
            {s.group && s.group !== sections[i - 1]?.group && (
              <span className="ml-1.5 mr-0.5 flex shrink-0 items-center gap-1.5 first:ml-0">
                {i > 0 && <span className="h-4 w-px bg-dp-navy-200" aria-hidden="true" />}
                <span className="text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
                  {s.group}
                </span>
              </span>
            )}
          <a
            href={`#${s.id}`}
            data-nav={s.id}
            onClick={(e) => jumpTo(e, s.id)}
            className="relative shrink-0 rounded-full px-3.5 py-1.5 text-[0.75rem] font-semibold transition-colors duration-200"
            style={{ color: active === s.id ? '#fff' : '#4a5a72' }}
          >
            {active === s.id && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-dp-navy-600"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{s.label}</span>
          </a>
          </Fragment>
        ))}
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-300"
        style={{ opacity: edges.left ? 1 : 0 }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent transition-opacity duration-300"
        style={{ opacity: edges.right ? 1 : 0 }}
      />
    </nav>
  )
}

/* ── Filtre ──────────────────────────────────────────────────────────────── */

const PERIODS = [
  { key: 'all', label: 'Hele perioden', months: null },
  { key: '12m', label: 'Seneste 12 mdr.', months: 12 },
  { key: '6m', label: 'Seneste 6 mdr.', months: 6 },
  { key: '3m', label: 'Seneste 3 mdr.', months: 3 },
] as const

export function FilterBar({
  data, filters, setFilters, resultCount,
}: {
  data: Dashboard
  filters: Filters
  setFilters: (f: Filters) => void
  resultCount: number
}) {
  const [period, setPeriod] = useState<string>('all')
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [segmentQuery, setSegmentQuery] = useState('')
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setSegmentOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const applyPeriod = (key: string) => {
    setPeriod(key)
    const def = PERIODS.find((p) => p.key === key)
    if (!def || def.months === null) { setFilters({ ...filters, from: null }); return }
    const d = new Date()
    d.setMonth(d.getMonth() - def.months)
    setFilters({ ...filters, from: d.toISOString() })
  }

  const toggleType = (key: string) => {
    const next = filters.types.includes(key)
      ? filters.types.filter((t) => t !== key)
      : [...filters.types, key]
    setFilters({ ...filters, types: next })
  }

  // Lists and segments that sendouts were actually addressed to, biggest first.
  const targets = [
    ...data.segmentPerformance.byList.map((r) => ({ name: r.name, count: r.count, kind: 'Liste' })),
    ...data.segmentPerformance.bySegment.map((r) => ({ name: r.name, count: r.count, kind: 'Segment' })),
  ]
    .filter((t) => !segmentQuery || t.name.toLowerCase().includes(segmentQuery.toLowerCase()))
    .sort((a, b) => b.count - a.count)

  const active = filters.types.length > 0 || filters.segment || filters.search || period !== 'all'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
      {/* Udsendelsestyper */}
      <div className="flex flex-wrap items-center gap-1.5">
        {data.byType.map((t) => {
          const on = filters.types.includes(t.key)
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleType(t.key)}
              aria-pressed={on}
              title={`${t.label} · ${t.count} udsendelser`}
              className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition-all duration-300 ease-dp"
              style={{
                borderColor: on ? t.color : '#e2e6ea',
                background: on ? t.color : '#fff',
                color: on ? '#fff' : '#4a5a72',
              }}
            >
              <span
                className="h-2 w-2 rounded-full transition-colors"
                style={{ background: on ? 'rgba(255,255,255,0.85)' : t.color }}
              />
              {t.short}
              <span className={`tnum text-[0.6875rem] ${on ? 'text-white/70' : 'text-dp-navy-400'}`}>{t.count}</span>
            </button>
          )
        })}
      </div>

      <span className="hidden h-5 w-px bg-dp-navy-100 sm:block" />

      {/* Segment */}
      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => setSegmentOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-dp-navy-200 bg-white px-3.5 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-navy-400"
          aria-expanded={segmentOpen}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          {filters.segment ?? 'Alle segmenter'}
          {filters.segment && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Ryd segment"
              onClick={(e) => { e.stopPropagation(); setFilters({ ...filters, segment: null }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setFilters({ ...filters, segment: null }) } }}
              className="ml-0.5 rounded-full bg-dp-navy-100 px-1.5 text-dp-navy-500 hover:bg-dp-navy-200"
            >
              ×
            </span>
          )}
        </button>

        <AnimatePresence>
          {segmentOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.22, ease: mo.ease }}
              className="absolute left-0 top-full z-40 mt-2 w-[22rem] max-w-[85vw] overflow-hidden rounded-2xl border border-dp-navy-100 bg-white shadow-card-hover"
            >
              <div className="border-b border-dp-navy-50 p-2.5">
                <input
                  autoFocus
                  value={segmentQuery}
                  onChange={(e) => setSegmentQuery(e.target.value)}
                  placeholder="Søg efter liste eller segment…"
                  className="w-full rounded-lg bg-dp-navy-50 px-3 py-2 text-[0.8125rem] outline-none placeholder:text-dp-navy-400"
                />
              </div>
              <div className="thin-scroll max-h-[19rem] overflow-y-auto p-1.5">
                <button
                  type="button"
                  onClick={() => { setFilters({ ...filters, segment: null }); setSegmentOpen(false) }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[0.8125rem] hover:bg-dp-navy-50"
                >
                  <span className="font-semibold">Alle segmenter</span>
                  <span className="text-[0.6875rem] text-dp-navy-400">{data.overview.totals.sent} udsendelser</span>
                </button>
                {targets.map((t) => (
                  <button
                    key={`${t.kind}-${t.name}`}
                    type="button"
                    onClick={() => { setFilters({ ...filters, segment: t.name }); setSegmentOpen(false) }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] hover:bg-dp-navy-50 ${filters.segment === t.name ? 'bg-dp-blaa-15' : ''}`}
                  >
                    <span className="min-w-0 truncate">{t.name}</span>
                    <span className="shrink-0 text-[0.6875rem] text-dp-navy-400">
                      {t.kind} · {t.count}
                    </span>
                  </button>
                ))}
                {!targets.length && (
                  <p className="px-2.5 py-4 text-center text-[0.8125rem] text-dp-navy-400">Ingen match</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Periode */}
      <div className="inline-flex rounded-full border border-dp-navy-200 bg-white p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPeriod(p.key)}
            className="relative rounded-full px-3 py-1 text-[0.75rem] font-semibold transition-colors"
            style={{ color: period === p.key ? '#fff' : '#4a5a72' }}
          >
            {period === p.key && (
              <motion.span layoutId="period-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Fritekst */}
      <div className="relative">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
             className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dp-navy-400">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Søg i emnelinjer…"
          className="w-52 rounded-full border border-dp-navy-200 bg-white py-1.5 pl-9 pr-3 text-[0.75rem] outline-none transition focus:border-dp-navy-400 placeholder:text-dp-navy-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <AnimatePresence>
          {active && (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              onClick={() => { setPeriod('all'); setFilters({ types: [], segment: null, from: null, to: null, search: '' }) }}
              className="text-[0.75rem] font-semibold text-dp-orange hover:underline"
            >
              Ryd filtre
            </motion.button>
          )}
        </AnimatePresence>
        <span className="tnum whitespace-nowrap text-[0.75rem] text-dp-navy-500">
          <strong className="text-dp-navy-900">{resultCount.toLocaleString('da-DK')}</strong> udsendelser
        </span>
      </div>
    </div>
  )
}

/* ── Sektionsramme ───────────────────────────────────────────────────────── */

export function Section({
  id, children, tone = 'light', className = '',
}: {
  id: string; children: ReactNode; tone?: 'light' | 'sunken' | 'dark'; className?: string
}) {
  const bg = tone === 'dark' ? '#16233a' : tone === 'sunken' ? '#f4f1f1' : '#ffffff'
  return (
    <section id={id} className={`scroll-mt-[8.5rem] sm:scroll-mt-[11.5rem] ${className}`} style={{ background: bg }}>
      <div className="mx-auto w-full max-w-[80rem] px-4 py-14 sm:px-6 sm:py-20">{children}</div>
    </section>
  )
}
