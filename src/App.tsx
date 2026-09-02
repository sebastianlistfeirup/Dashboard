/**
 * Udsendelsesdashboard for Dansk Psykolog Forening.
 *
 * One filter surface at the top, then the sections in the order a reader needs
 * them: what happened, what it means, and then the detail behind each claim.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FilterBar, RefreshControls, Section, SectionNav, Wordmark, type SectionDef } from '@/components/shell'
import { Hero } from '@/sections/Hero'
import { Findings } from '@/sections/Findings'
import { Mailings } from '@/sections/Mailings'
import { Segments, Trends, Types } from '@/sections/Performance'
import { Content, Subjects, Timing } from '@/sections/Optimisation'
import { Audience } from '@/sections/Audience'
import { SmsSection, Surveys } from '@/sections/Channels'
import {
  emptyFilters, poolOf, useAutoRefresh, useDashboard, useFilteredMailings, type Filters,
} from '@/lib/data'
import { motion as mo } from '@/design/tokens'

const SECTIONS: SectionDef[] = [
  { id: 'findings', label: 'Findings' },
  { id: 'udvikling', label: 'Udvikling' },
  { id: 'typer', label: 'Typer' },
  { id: 'segmenter', label: 'Segmenter' },
  { id: 'udsendelser', label: 'Alle udsendelser' },
  { id: 'tidspunkt', label: 'Tidspunkter' },
  { id: 'emnelinjer', label: 'Emnelinjer' },
  { id: 'indhold', label: 'Indhold' },
  { id: 'modtagere', label: 'Modtagere' },
  { id: 'sms', label: 'SMS' },
  { id: 'sporgeskemaer', label: 'Spørgeskemaer' },
]

export default function App() {
  const { status, data, error, fetchedAt, refreshing, reload, embedded } = useDashboard()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const nextRefreshAt = useAutoRefresh(autoRefresh && !embedded, reload)

  const filtered = useFilteredMailings(data, filters)
  const pool = useMemo(() => poolOf(filtered), [filtered])
  const filtersActive = filters.types.length > 0 || Boolean(filters.segment) || Boolean(filters.from) || Boolean(filters.search)

  if (status === 'loading') return <Splash />
  if (!data) return <LoadError message={error ?? 'Ukendt fejl'} onRetry={reload} />

  return (
    <div className="min-h-screen bg-white">
      {/* Toplinje */}
      <header className="sticky top-0 z-50 border-b border-dp-navy-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[80rem] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
            <Wordmark />
            <RefreshControls
              generatedAt={data.meta.generatedAt}
              fetchedAt={fetchedAt}
              refreshing={refreshing}
              autoRefresh={autoRefresh}
              onToggleAuto={setAutoRefresh}
              onRefresh={reload}
              nextAt={nextRefreshAt}
              embedded={embedded}
            />
          </div>
          <div className="border-t border-dp-navy-50 py-2">
            <SectionNav sections={SECTIONS} />
          </div>
        </div>
      </header>

      {/* Filtre */}
      <div className="sticky top-[7.4rem] z-40 border-b border-dp-navy-100 bg-dp-navy-50/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[80rem] px-4 py-3 sm:px-6">
          <FilterBar data={data} filters={filters} setFilters={setFilters} resultCount={filtered.length} />
        </div>
      </div>

      {error && (
        <div className="border-b border-dp-rod-30 bg-dp-rod-15 px-4 py-2 text-center text-[0.8125rem] text-dp-rod">
          Kunne ikke hente friske data ({error}). Viser sidst indlæste tal.
        </div>
      )}

      <main>
        <Hero data={data} filtered={filtered} pool={pool} filtersActive={filtersActive} />

        <Section id="findings" tone="sunken">
          <Findings findings={data.findings} />
        </Section>

        <Section id="udvikling">
          <Trends data={data} mailings={filtered} filtersActive={filtersActive} />
        </Section>

        <Section id="typer" tone="sunken">
          <Types data={data} mailings={filtered} />
        </Section>

        <Section id="segmenter">
          <Segments
            data={data}
            active={filters.segment}
            onPick={(name) => {
              setFilters({ ...filters, segment: name })
              document.getElementById('udsendelser')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </Section>

        <Section id="udsendelser" tone="sunken">
          <Mailings data={data} mailings={filtered} />
        </Section>

        <Section id="tidspunkt">
          <Timing data={data} />
        </Section>

        <Section id="emnelinjer" tone="sunken">
          <Subjects data={data} />
        </Section>

        <Section id="indhold">
          <Content data={data} />
        </Section>

        <Section id="modtagere" tone="sunken">
          <Audience data={data} />
        </Section>

        <Section id="sms">
          <SmsSection data={data} />
        </Section>

        <Section id="sporgeskemaer" tone="sunken">
          <Surveys data={data} />
        </Section>
      </main>

      <Footer data={data} />
      <BackToTop />
    </div>
  )
}

/* ── Tilstande ───────────────────────────────────────────────────────────── */

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-dp-navy-900">
      <div className="text-center">
        <motion.div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl font-serif text-xl font-bold text-white"
          style={{ background: '#df790d' }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          DP
        </motion.div>
        <p className="mt-6 font-serif text-lg text-white">Henter udsendelsesdata…</p>
        <div className="mx-auto mt-4 h-1 w-40 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full w-1/3 rounded-full bg-dp-orange"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-dp-navy-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl font-semibold text-dp-navy-900">Data kunne ikke hentes</h1>
        <p className="mt-3 text-[0.875rem] text-dp-navy-600">{message}</p>
        <p className="mt-2 text-[0.8125rem] text-dp-navy-500">
          Dataene opdateres af et planlagt job hver time. Hvis fejlen bliver ved, er filen
          formentlig ikke blevet skrevet endnu.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-full bg-dp-navy-600 px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-dp-navy-700"
        >
          Prøv igen
        </button>
      </div>
    </div>
  )
}

/* ── Bund ────────────────────────────────────────────────────────────────── */

function Footer({ data }: { data: ReturnType<typeof useDashboard>['data'] }) {
  if (!data) return null
  const f = data.meta.fetch
  return (
    <footer className="border-t border-dp-navy-100 bg-dp-navy-900 px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-[80rem]">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <Wordmark onDark />
          <div className="max-w-xl text-[0.75rem] leading-relaxed text-dp-navy-300">
            <p>
              Data kommer direkte fra Ungapped ({data.meta.source}) og opdateres hver time.
              Seneste kørsel hentede {f.megabytes.toLocaleString('da-DK')} MB over{' '}
              {f.requests.toLocaleString('da-DK')} kald på {f.seconds} sekunder
              {f.failures > 0 ? `, med ${f.failures} fejlede kald` : ' uden fejl'}.
            </p>
            <p className="mt-3">
              Dashboardet viser kun aggregerede tal. Modtagernes oplysninger bliver læst for at
              kunne beskrive medlemsprofilen, men reduceret til optællinger inden noget skrives —
              og grupper under {data.meta.minBucket} personer er lagt sammen, så ingen kan udpeges.
              Kørslen afbrydes automatisk, hvis der alligevel skulle stå noget personhenførbart i
              resultatet.
            </p>
            {data.meta.fieldWarnings.length > 0 && (
              <p className="mt-3 text-dp-gul">
                Bemærk: feltnavne i Ungapped er ændret siden dashboardet blev bygget —{' '}
                {data.meta.fieldWarnings.join('; ')}. Nogle opdelinger kan være forkert mærket.
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

function BackToTop() {
  const [show, setShow] = useState(false)
  if (typeof window !== 'undefined') {
    window.onscroll = () => setShow(window.scrollY > 900)
  }
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: mo.ease }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 grid h-11 w-11 place-items-center rounded-full bg-dp-navy-600 text-white shadow-card-hover transition hover:bg-dp-navy-700"
          aria-label="Til toppen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
