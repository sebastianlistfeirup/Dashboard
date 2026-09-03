/**
 * Ledelsesdashboardet — én side til ledergruppen.
 *
 * A different job from the operational dashboard, so a different treatment:
 * quieter, more typographic, no filters, and every module condensed to the one
 * thing a management group needs from it. The page is built to be printed —
 * A4, sensible page breaks, no interface chrome on paper.
 *
 * What appears here is chosen from the main dashboard, where each module has a
 * "Til ledelsen" control. This page only renders that choice.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { moduleById, MODULES, CONFIG_EDIT_URL } from '@/lib/config'
import { useSettingsRequired } from '@/lib/settings'
import { formatDate, MIN_MONTH_DELIVERED, monthLabel, poolOf, type Dashboard } from '@/lib/data'
import { fmtDelta, fmtNum, fmtPct, LineChart, Sparkline } from '@/components/charts'
import { buildAlertNotice, buildWeeklyReport, mailtoLink, stamp, type Report } from '@/lib/report'
import { motion as mo } from '@/design/tokens'

export function Leadership({ data, onBack }: { data: Dashboard; onBack?: () => void }) {
  const settings = useSettingsRequired()
  const [editing, setEditing] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const modules = settings.leadership.modules

  return (
    <div className="min-h-screen bg-dp-navy-50 print:bg-white">
      {/* Værktøjslinje — forsvinder på tryk */}
      <div className="sticky top-0 z-40 border-b border-dp-navy-100 bg-white/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex w-full max-w-[62rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : (window.location.hash = ''))}
            className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-dp-navy-700 transition hover:text-dp-orange"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Tilbage til det fulde dashboard
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-pressed={editing}
              className="rounded-full border px-3.5 py-1.5 text-[0.75rem] font-semibold transition"
              style={{
                borderColor: editing ? '#df790d' : '#e2e6ea',
                background: editing ? '#df790d' : '#fff',
                color: editing ? '#fff' : '#4a5a72',
              }}
            >
              {editing ? 'Færdig med at redigere' : 'Tilpas siden'}
            </button>
            <button
              type="button"
              onClick={() => setMailOpen((v) => !v)}
              aria-pressed={mailOpen}
              className="inline-flex items-center gap-2 rounded-full border border-dp-navy-200 bg-white px-3.5 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-navy-400"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2.5" y="5" width="19" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              Ugebrev
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-full bg-dp-navy-600 px-3.5 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-dp-navy-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Print eller gem som PDF
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: mo.ease }}
            className="overflow-hidden border-b border-dp-navy-100 bg-white print:hidden"
          >
            <Editor data={data} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mailOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: mo.ease }}
            className="overflow-hidden border-b border-dp-navy-100 bg-white print:hidden"
          >
            <MailComposer data={data} onClose={() => setMailOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selve siden */}
      <main className="mx-auto w-full max-w-[62rem] px-4 py-10 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <article className="rounded-2xl bg-white p-8 shadow-card sm:p-12 print:rounded-none print:p-0 print:shadow-none">
          <Masthead data={data} settings={settings} editing={editing} />

          {!modules.length ? (
            <div className="mt-10 rounded-xl border border-dashed border-dp-navy-200 p-10 text-center">
              <p className="font-serif text-lg text-dp-navy-800">Siden er tom endnu</p>
              <p className="mx-auto mt-2 max-w-md text-[0.875rem] leading-relaxed text-dp-navy-500">
                Gå tilbage til dashboardet og tryk <strong>Til ledelsen</strong> på de moduler,
                der skal med. Eller vælg dem her under <strong>Tilpas siden</strong>.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-9 sm:grid-cols-2">
              {modules.map((id, i) => {
                const def = moduleById.get(id)
                if (!def) return null
                return (
                  <section
                    key={id}
                    className={`${def.span === 'full' ? 'sm:col-span-2' : ''} break-inside-avoid`}
                  >
                    <ModuleBlock id={id} data={data} index={i} />
                    {editing && (
                      <div className="mt-2 flex items-center gap-1.5 print:hidden">
                        <ReorderButton label="Flyt op" onClick={() => settings.moveLeadership(id, -1)} disabled={i === 0} up />
                        <ReorderButton label="Flyt ned" onClick={() => settings.moveLeadership(id, 1)} disabled={i === modules.length - 1} />
                        <button
                          type="button"
                          onClick={() => settings.toggleLeadership(id)}
                          className="rounded-full border border-dp-navy-100 px-2.5 py-1 text-[0.6875rem] font-semibold text-dp-rod transition hover:border-dp-rod"
                        >
                          Fjern
                        </button>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          <Colophon data={data} />
        </article>
      </main>
    </div>
  )
}

/* ── Sidehoved ───────────────────────────────────────────────────────────── */

function Masthead({ data, settings, editing }: {
  data: Dashboard
  settings: ReturnType<typeof useSettingsRequired>
  editing: boolean
}) {
  const months = data.trends.monthly.filter((m) => m.count > 0)
  const from = months[0]?.month
  const to = months[months.length - 1]?.month

  return (
    <header className="border-b-2 border-dp-navy-900 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] font-serif text-[0.75rem] font-bold leading-none text-white"
              style={{ background: '#3a557d' }}
              aria-hidden="true"
            >
              DP
            </span>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-dp-navy-500">
              Dansk Psykolog Forening
            </span>
          </div>

          {editing ? (
            <input
              value={settings.leadership.title}
              onChange={(e) => settings.setLeadershipText(e.target.value, settings.leadership.subtitle)}
              className="mt-4 w-full max-w-lg rounded-lg border border-dp-navy-200 px-3 py-1.5 font-serif text-display-md font-semibold text-dp-navy-900 outline-none focus:border-dp-orange"
            />
          ) : (
            <h1 className="mt-4 font-serif text-display-md font-semibold text-dp-navy-900">
              {settings.leadership.title}
            </h1>
          )}

          {editing ? (
            <input
              value={settings.leadership.subtitle}
              onChange={(e) => settings.setLeadershipText(settings.leadership.title, e.target.value)}
              className="mt-2 w-full max-w-lg rounded-lg border border-dp-navy-200 px-3 py-1 text-[0.9375rem] text-dp-navy-600 outline-none focus:border-dp-orange"
            />
          ) : (
            <p className="mt-1.5 text-[0.9375rem] text-dp-navy-600">{settings.leadership.subtitle}</p>
          )}
        </div>

        <dl className="shrink-0 text-right text-[0.75rem] leading-relaxed text-dp-navy-500">
          <div><dt className="inline">Periode: </dt><dd className="inline font-semibold text-dp-navy-800">
            {from ? monthLabel(from) : '–'} – {to ? monthLabel(to) : '–'}
          </dd></div>
          <div><dt className="inline">Udsendelser: </dt><dd className="inline font-semibold text-dp-navy-800 tnum">
            {fmtNum(data.overview.pool.count)}
          </dd></div>
          <div><dt className="inline">Opdateret: </dt><dd className="inline font-semibold text-dp-navy-800">
            {formatDate(data.meta.generatedAt)}
          </dd></div>
        </dl>
      </div>
    </header>
  )
}

function Colophon({ data }: { data: Dashboard }) {
  return (
    <footer className="mt-12 border-t border-dp-navy-100 pt-5 text-[0.6875rem] leading-relaxed text-dp-navy-400">
      <p>
        Kilde: Ungapped ({data.meta.source}). Tallene opdateres automatisk hver time og er
        aggregerede — der indgår ingen personoplysninger. Grupper under {data.meta.minBucket} personer
        er lagt sammen. Engagement pr. medlem hviler på en fast stikprøve på{' '}
        {fmtNum(data.meta.engagementSample.resolved)} af {fmtNum(data.meta.engagementSample.population)} aktive.
      </p>
      <p className="mt-1.5">
        Åbningsrater er undervurderede: Apple Mail Privacy Protection og lignende blokerer
        sporing for en del modtagere. Tallene er sammenlignelige indbyrdes, men er ikke et
        facit for hvor mange der læste.
      </p>
    </footer>
  )
}

function ReorderButton({ label, onClick, disabled, up = false }: {
  label: string; onClick: () => void; disabled: boolean; up?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-6 w-6 place-items-center rounded-full border border-dp-navy-100 text-dp-navy-600 transition hover:border-dp-navy-400 disabled:opacity-30"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"
           style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/* ── Modulvælger ─────────────────────────────────────────────────────────── */

function Editor({ data }: { data: Dashboard }) {
  const settings = useSettingsRequired()
  const [copied, setCopied] = useState(false)
  void data

  const grouped = useMemo(() => {
    const map = new Map<string, typeof MODULES>()
    for (const m of MODULES) {
      if (!map.has(m.section)) map.set(m.section, [])
      map.get(m.section)!.push(m)
    }
    return [...map.values()]
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(settings.exportJson())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked; the textarea below is the fallback */ }
  }

  return (
    <div className="mx-auto w-full max-w-[62rem] px-4 py-6 sm:px-6">
      <h2 className="font-serif text-lg font-semibold text-dp-navy-900">Vælg hvad siden viser</h2>
      <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-dp-navy-500">
        Klik et modul til eller fra. Rækkefølgen ændrer du med pilene ude ved hvert modul.
        Du kan også trykke <strong>Til ledelsen</strong> direkte på modulerne i det fulde dashboard.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {grouped.flat().map((m) => {
          const on = settings.isOnLeadership(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => settings.toggleLeadership(m.id)}
              title={m.summary}
              aria-pressed={on}
              className="rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition-all duration-200"
              style={{
                borderColor: on ? '#df790d' : '#e2e6ea',
                background: on ? '#df790d' : '#fff',
                color: on ? '#fff' : '#4a5a72',
              }}
            >
              {on ? '✓ ' : ''}{m.label}
            </button>
          )
        })}
      </div>

      {settings.hasLocalChanges && (
        <div className="mt-6 rounded-xl border border-dp-orange-30 bg-dp-orange-15 p-4">
          <p className="text-[0.8125rem] font-semibold text-dp-navy-900">
            Dine ændringer gælder indtil videre kun i din egen browser
          </p>
          <p className="mt-1 max-w-2xl text-[0.75rem] leading-relaxed text-dp-navy-600">
            Siden er en statisk hjemmeside uden database, så der er ikke noget sted at gemme
            centralt. Skal opsætningen gælde for alle, kopierer du den herunder og indsætter
            den i <code className="rounded bg-white px-1">config/dashboard.json</code>.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-full bg-dp-navy-600 px-3.5 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-dp-navy-700"
            >
              {copied ? 'Kopieret ✓' : 'Kopiér opsætningen'}
            </button>
            <a
              href={CONFIG_EDIT_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-dp-navy-200 px-3.5 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-navy-400"
            >
              Åbn filen på GitHub
            </a>
            <button
              type="button"
              onClick={settings.clearLocal}
              className="text-[0.75rem] font-semibold text-dp-navy-500 hover:text-dp-rod"
            >
              Nulstil mine ændringer
            </button>
          </div>
          <textarea
            readOnly
            value={settings.exportJson()}
            className="thin-scroll mt-3 h-28 w-full rounded-lg border border-dp-navy-100 bg-white p-2.5 font-mono text-[0.6875rem] text-dp-navy-700"
          />
        </div>
      )}
    </div>
  )
}

/* ── Modulerne i ledelsesudgave ──────────────────────────────────────────── */

function ModuleBlock({ id, data, index }: { id: string; data: Dashboard; index: number }) {
  const def = moduleById.get(id)!
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: mo.ease, delay: Math.min(0.4, index * 0.05) }}
    >
      <Body id={id} data={data} def={def} />
    </motion.div>
  )
}

function Heading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-serif text-[1.125rem] font-semibold text-dp-navy-900">{children}</h2>
      {note && <p className="mt-0.5 text-[0.75rem] text-dp-navy-500">{note}</p>}
    </div>
  )
}

function Body({ id, data, def }: { id: string; data: Dashboard; def: { label: string } }) {
  switch (id) {
    case 'maaned-tekst': return <NarrativeBlock data={data} />
    case 'kpi-maalere': return <TargetsBlock data={data} />
    case 'benchmark': return <BenchmarkBlock data={data} />
    case 'findings': return <FindingsBlock data={data} />
    case 'alarmer': return <AlertsBlock data={data} />
    case 'udvikling': return <TrendBlock data={data} />
    case 'typer': return <TypesBlock data={data} />
    case 'top-udsendelser': return <TopBlock data={data} />
    case 'segmenter': return <SegmentBlock data={data} />
    case 'modtagere': return <AudienceBlock data={data} />
    case 'genaktivering': return <ReengagementBlock data={data} />
    case 'kohorter': return <CohortBlock data={data} />
    case 'sms': return <SmsBlock data={data} />
    case 'sporgeskemaer': return <SurveyBlock data={data} />
    case 'aarshjul': return <YearRhythmBlock data={data} />
    case 'krydstabel': return <CrossTabBlock data={data} />
    case 'tidspunkt': return <TimingBlock data={data} />
    case 'emnelinjer': return <SubjectBlock data={data} />
    case 'indhold': return <ContentBlock data={data} />
    case 'afsendere': return <SenderBlock data={data} />
    default:
      return (
        <>
          <Heading>{def.label}</Heading>
          <p className="text-[0.8125rem] text-dp-navy-500">
            Dette modul vises kun i det fulde dashboard.
          </p>
        </>
      )
  }
}

function NarrativeBlock({ data }: { data: Dashboard }) {
  const n = data.narrative
  if (!n) return null
  return (
    <div className="rounded-xl bg-dp-navy-900 p-6 text-white print:bg-dp-navy-50 print:text-dp-navy-900">
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-dp-orange">
        {n.monthName}
      </div>
      <p className="mt-3 font-serif text-[1.1875rem] leading-relaxed">{n.text}</p>
    </div>
  )
}

function TargetsBlock({ data }: { data: Dashboard }) {
  if (!data.targets?.length) return null
  return (
    <>
      <Heading note="Afstand til de mål, der er sat for medlemskommunikationen.">Mål og status</Heading>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.targets.map((t) => (
          <div key={t.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.75rem] text-dp-navy-600">{t.label}</span>
              <span
                className="tnum text-[0.6875rem] font-semibold"
                style={{ color: t.reached ? '#179fa0' : '#df790d' }}
              >
                {t.reached ? 'Nået' : `${Math.abs(t.gap ?? 0).toLocaleString('da-DK')} fra målet`}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-serif text-[1.75rem] font-semibold leading-none tnum text-dp-navy-900">
                {t.value === null ? '–' : t.value.toLocaleString('da-DK')}
              </span>
              <span className="text-[0.75rem] text-dp-navy-400">mål {t.target.toLocaleString('da-DK')}</span>
            </div>
            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-dp-navy-100">
              <motion.div
                className="h-full rounded-full"
                style={{ background: t.reached ? '#179fa0' : '#df790d' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, t.progress ?? 0)}%` }}
                transition={{ duration: 0.8, ease: mo.ease }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function BenchmarkBlock({ data }: { data: Dashboard }) {
  const b = data.benchmarks
  const src = b?.sources.find((s) => s.key === b.primary) ?? b?.sources[0]
  if (!src) return null
  return (
    <>
      <Heading note={`${src.name} · ${src.source}`}>Sammenlignet med andre</Heading>
      <ul className="space-y-3">
        {src.metrics.map((m) => (
          <li key={m.metric}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] text-dp-navy-700">
                {m.metric === 'openRate' ? 'Åbningsrate' : m.metric === 'clickRate' ? 'Klikrate' : m.metric}
              </span>
              <span className="tnum text-[0.8125rem] font-semibold text-dp-navy-900">
                {fmtPct(m.own)} <span className="font-normal text-dp-navy-400">mod {fmtPct(m.external)}</span>
              </span>
            </div>
            {/* Skalaen går til den højeste af de to plus lidt luft, og de
                andres niveau står som et mærke — ellers fylder DP's søjle
                altid hele bredden og siger ingenting. */}
            {(() => {
              const top = Math.max(m.own ?? 0, m.external) * 1.15 || 1
              return (
                <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-dp-navy-100">
                  <motion.div
                    className="h-full rounded-full bg-dp-gron"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((m.own ?? 0) / top) * 100)}%` }}
                    transition={{ duration: 0.8, ease: mo.ease }}
                  />
                  <span
                    className="absolute inset-y-0 w-[2px] bg-dp-navy-700"
                    style={{ left: `${Math.min(100, (m.external / top) * 100)}%` }}
                    aria-hidden="true"
                  />
                </div>
              )
            })()}
            {m.ratio && m.ratio > 1 && (
              <p className="mt-1 text-[0.6875rem] text-dp-gron">
                {m.ratio.toLocaleString('da-DK')} gange benchmark
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.625rem] leading-relaxed text-dp-navy-400">{b?.caveat}</p>
    </>
  )
}

function FindingsBlock({ data }: { data: Dashboard }) {
  const top = data.findings.slice(0, 4)
  if (!top.length) return null
  return (
    <>
      <Heading note="Automatisk fundne mønstre, stærkeste først.">Det vigtigste lige nu</Heading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {top.map((f) => (
          <li key={f.id} className="border-l-2 pl-3.5" style={{ borderColor: f.color ?? '#4c7bbd' }}>
            <p className="text-[0.875rem] font-semibold leading-snug text-dp-navy-900">{f.title}</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-dp-navy-600">{f.body}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

function AlertsBlock({ data }: { data: Dashboard }) {
  // De aktive alarmer først. `recent` er de allerede overståede, og de hører
  // ikke hjemme under en overskrift der siger "kræver opmærksomhed".
  const items = (data.alerts?.items ?? []).slice(0, 4)
  return (
    <>
      <Heading note="Det der ligger uden for de tærskler, I har sat.">Kræver opmærksomhed</Heading>
      {!items.length ? (
        <p className="rounded-lg bg-dp-gron-15 px-3.5 py-2.5 text-[0.8125rem] text-dp-gron">
          Ingenting kræver opmærksomhed lige nu.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((a, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: a.severity === 'critical' ? '#d24e46' : '#df790d' }} />
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-semibold text-dp-navy-900">{a.title}</p>
                {a.subject && <p className="truncate text-[0.75rem] text-dp-navy-600">{a.subject}</p>}
                <p className="text-[0.6875rem] text-dp-navy-400">{a.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function TrendBlock({ data }: { data: Dashboard }) {
  // Samme regel som i det fulde dashboard: en måned uden volumen bag sig får
  // ingen rate tegnet — ellers strækker den aksen og flader alt andet ud.
  const points = data.trends.monthly
    .slice(-14)
    .map((m) => (m.delivered < MIN_MONTH_DELIVERED ? { ...m, openRate: null, clickRate: null } : m))
  return (
    <>
      <Heading note="Åbnings- og klikrate måned for måned.">Udvikling</Heading>
      <LineChart
        height={200}
        area={false}
        revealOnScroll={false}
        series={[
          { key: 'open', label: 'Åbningsrate', color: '#eab922', points: points.map((p) => ({ x: p.month, y: p.openRate })) },
          { key: 'click', label: 'Klikrate', color: '#4fa388', points: points.map((p) => ({ x: p.month, y: p.clickRate })) },
        ]}
      />
      <ul className="mt-2 flex gap-4 text-[0.6875rem] text-dp-navy-500">
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-dp-gul" />Åbninger</li>
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-dp-studerende" />Klik</li>
      </ul>
    </>
  )
}

function TypesBlock({ data }: { data: Dashboard }) {
  const rows = [...data.byType].sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0)).slice(0, 8)
  const max = Math.max(...rows.map((r) => r.openRate ?? 0), 1)
  return (
    <>
      <Heading note="Åbningsrate pr. type. Bredden viser andelen af den samlede volumen.">Udsendelsestyper</Heading>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                <span className="truncate text-dp-navy-800">{r.label}</span>
                <span className="shrink-0 text-[0.6875rem] text-dp-navy-400">{r.count}</span>
              </span>
              <span className="tnum shrink-0 font-semibold text-dp-navy-900">{fmtPct(r.openRate)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dp-navy-100">
              <motion.div className="h-full rounded-full" style={{ background: r.color }}
                initial={{ width: 0 }} animate={{ width: `${((r.openRate ?? 0) / max) * 100}%` }}
                transition={{ duration: 0.7, ease: mo.ease }} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function TopBlock({ data }: { data: Dashboard }) {
  return (
    <>
      <Heading note="Bedst åbnede udsendelser til mindst 100 modtagere.">Bedste udsendelser</Heading>
      <ol className="space-y-2.5">
        {data.overview.best.slice(0, 5).map((m, i) => (
          <li key={m.id} className="flex items-start gap-3">
            <span className="tnum mt-0.5 text-[0.75rem] font-semibold text-dp-navy-300">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] text-dp-navy-900">{m.subject}</p>
              <p className="text-[0.6875rem] text-dp-navy-400">{formatDate(m.when)} · {fmtNum(m.delivered)} modtagere</p>
            </div>
            <span className="tnum shrink-0 text-[0.8125rem] font-semibold text-dp-gul">{fmtPct(m.openRate)}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

function SegmentBlock({ data }: { data: Dashboard }) {
  const rows = data.segmentPerformance.byList.filter((r) => r.count >= 3).slice(0, 6)
  return (
    <>
      <Heading note="Lister med mindst tre udsendelser.">Segmenter</Heading>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
            <span className="min-w-0 truncate text-dp-navy-800">{r.name}</span>
            <span className="tnum shrink-0 font-semibold text-dp-navy-900">{fmtPct(r.openRate)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function AudienceBlock({ data }: { data: Dashboard }) {
  const a = data.audience
  const eng = a.engagement
  const spark = data.trends.monthly.slice(-12).map((m) => m.openRate)
  return (
    <>
      <Heading note="Bestanden og hvor engageret den er.">Modtagerne</Heading>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {[
          { label: 'Aktive modtagere', value: fmtNum(a.totals.active) },
          { label: 'Afmeldte', value: fmtNum(a.totals.blocked) },
          { label: 'Åbner næsten alt', value: fmtPct(eng?.distribution.find((d) => d.label.startsWith('Næsten'))?.share ?? null) },
          { label: 'Har aldrig åbnet', value: fmtPct(eng?.overall.neverOpened ?? null) },
        ].map((s) => (
          <div key={s.label}>
            <div className="font-serif text-[1.5rem] font-semibold leading-none tnum text-dp-navy-900">{s.value}</div>
            <div className="mt-1 text-[0.6875rem] leading-tight text-dp-navy-500">{s.label}</div>
          </div>
        ))}
      </div>
      {eng?.byKontingent?.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[0.75rem] font-semibold text-dp-navy-700">Klikrate pr. kontingentgruppe</p>
          <ul className="space-y-1.5">
            {eng.byKontingent.filter((r) => !r.isOther).slice(0, 5).map((r) => (
              <li key={r.name} className="flex items-baseline justify-between gap-3 text-[0.75rem]">
                <span className="min-w-0 truncate text-dp-navy-700">{r.name}</span>
                <span className="tnum shrink-0 font-semibold text-dp-navy-900">{fmtPct(r.clickRate)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-2 text-[0.6875rem] text-dp-navy-400">
        <Sparkline values={spark} color="#4c7bbd" width={110} height={20} />
        Åbningsrate, seneste 12 måneder
      </div>
    </>
  )
}

function ReengagementBlock({ data }: { data: Dashboard }) {
  const r = data.reengagement
  if (!r) return null
  return (
    <>
      <Heading note={`Har ikke åbnet noget i ${r.monthsWithoutOpen} måneder.`}>Sovende medlemmer</Heading>
      <p className="font-serif text-[2rem] font-semibold leading-none tnum text-dp-rod">
        {fmtNum(r.estimatedPeople)}
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-dp-navy-600">
        skønnet antal medlemmer, svarende til {fmtPct(r.dormantShare)} af bestanden. Uden dem
        ville åbningsraten være {fmtPct(r.openRateWithoutDormant)} i stedet for {fmtPct(r.currentOpenRate)}.
      </p>
      {r.ideas[0] && (
        <p className="mt-3 rounded-lg bg-dp-navy-50 px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-dp-navy-700">
          <strong>Første skridt:</strong> {r.ideas[0].title}. {r.ideas[0].body}
        </p>
      )}
    </>
  )
}

function CohortBlock({ data }: { data: Dashboard }) {
  const c = data.cohorts
  if (!c?.firstWindow?.length) return null
  const rows = c.firstWindow.slice(0, 6)
  const max = Math.max(...rows.map((r) => r.openRate ?? 0), 1)
  return (
    <>
      <Heading note="Åbningsrate i de første tre måneder efter indmeldelse, pr. årgang.">Onboarding over tid</Heading>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.year}>
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="text-dp-navy-800">Indmeldt {r.year}</span>
              <span className="tnum font-semibold text-dp-navy-900">{fmtPct(r.openRate ?? null)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-dp-navy-100">
              <motion.div className="h-full rounded-full bg-dp-lilla"
                initial={{ width: 0 }} animate={{ width: `${((r.openRate ?? 0) / max) * 100}%` }}
                transition={{ duration: 0.7, ease: mo.ease }} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function SmsBlock({ data }: { data: Dashboard }) {
  const sent = data.sms.filter((s) => s.wasSent)
  const recipients = sent.reduce((s, x) => s + x.stats.recipients, 0)
  return (
    <>
      <Heading note="Rækkevidde på sms.">SMS</Heading>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Sendte', value: fmtNum(sent.length) },
          { label: 'Modtagere', value: fmtNum(recipients) },
          { label: 'Kan nås på sms', value: fmtNum(data.audience.totals.smsReachable) },
        ].map((s) => (
          <div key={s.label}>
            <div className="font-serif text-[1.375rem] font-semibold leading-none tnum text-dp-navy-900">{s.value}</div>
            <div className="mt-1 text-[0.6875rem] text-dp-navy-500">{s.label}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function SurveyBlock({ data }: { data: Dashboard }) {
  const withAnswers = data.surveys.filter((s) => s.responses > 0)
  return (
    <>
      <Heading note="Besvarelser pr. undersøgelse.">Spørgeskemaer</Heading>
      <ul className="space-y-2">
        {withAnswers.slice(0, 5).map((s) => (
          <li key={s.id} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
            <span className="min-w-0 truncate text-dp-navy-800">{s.title}</span>
            <span className="tnum shrink-0 font-semibold text-dp-navy-900">{fmtNum(s.responses)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export const leadershipPoolOf = poolOf

/* ── Flere moduler i ledelsesudgave ──────────────────────────────────────── */

const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** Årshjulet i fladt format: én kolonne pr. måned, så det kan læses på papir. */
function YearRhythmBlock({ data }: { data: Dashboard }) {
  const year = useMemo(() => {
    const years = data.mailings.filter((m) => m.local && m.stats.delivered > 0).map((m) => m.local!.year)
    return years.length ? Math.max(...years) : new Date().getUTCFullYear()
  }, [data.mailings])

  const rows = useMemo(() => {
    const base = Array.from({ length: 12 }, () => ({ count: 0, delivered: 0, opens: 0 }))
    for (const m of data.mailings) {
      if (!m.local || m.local.year !== year || m.stats.delivered <= 0) continue
      const r = base[m.local.month - 1]
      r.count += 1
      r.delivered += m.stats.delivered
      r.opens += m.stats.opens
    }
    return base.map((r) => ({ ...r, openRate: r.delivered ? (r.opens / r.delivered) * 100 : null }))
  }, [data.mailings, year])

  const maxVol = Math.max(1, ...rows.map((r) => r.delivered))
  const maxRate = Math.max(1, ...rows.map((r) => r.openRate ?? 0))

  return (
    <>
      <Heading note={`Udsendelser og åbningsrate måned for måned i ${year}.`}>Årets rytme</Heading>
      <div className="flex items-end gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="tnum text-[0.5625rem] font-semibold text-dp-navy-500">
              {r.openRate === null ? '' : r.openRate.toFixed(0)}
            </span>
            <div className="relative flex h-20 w-full items-end">
              <motion.div
                className="w-full rounded-t-[3px] bg-dp-navy-200"
                initial={{ height: 0 }}
                animate={{ height: `${(r.delivered / maxVol) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.03, ease: mo.ease }}
              />
              {r.openRate !== null && (
                <motion.span
                  className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-dp-orange"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, bottom: `${(r.openRate / maxRate) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.03, ease: mo.ease }}
                />
              )}
            </div>
            <span className="text-[0.625rem] font-semibold text-dp-navy-400">{MONTHS_SHORT[i]}</span>
            <span className="tnum text-[0.5625rem] text-dp-navy-400">{r.count || ''}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.6875rem] text-dp-navy-500">
        Søjlen er antal leverede mails, prikken er åbningsraten, tallet nederst er antal udsendelser.
      </p>
    </>
  )
}

/** Krydstabellen i den udgave der kan læses uden at klikke: ét udvalgt kryds. */
function CrossTabBlock({ data }: { data: Dashboard }) {
  const keys = Object.keys(data.crossTabs?.pairs ?? {})
  if (!keys.length) return null
  const pair = data.crossTabs.pairs[keys[0]]
  const cellAt = new Map(pair.cells.map((c) => [`${c.row}||${c.col}`, c]))
  const values = pair.cells.map((c) => c.openRate).filter((v): v is number => v !== null)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const shade = (v: number | null) => {
    if (v === null) return '#f4f1f1'
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5
    const steps = ['#e7ebef', '#d4dbe1', '#aebdd4', '#8299bb', '#5a76a0', '#3a557d']
    return steps[Math.min(steps.length - 1, Math.round(t * (steps.length - 1)))]
  }
  const rows = pair.rows.slice(0, 5)
  const cols = pair.cols.slice(0, 5)

  return (
    <>
      <Heading note={`Åbningsrate, ${pair.rowLabel.toLowerCase()} mod ${pair.colLabel.toLowerCase()}. Grupper under ${data.crossTabs.minPeople} personer vises ikke.`}>
        {pair.rowLabel} × {pair.colLabel}
      </Heading>
      <table className="w-full border-separate text-[0.75rem]" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="pb-1 text-center font-semibold text-dp-navy-500">
                <span className="block max-w-[5rem] truncate" title={c}>{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th className="max-w-[8rem] truncate pr-2 text-left font-medium text-dp-navy-800" title={r}>{r}</th>
              {cols.map((c) => {
                const cell = cellAt.get(`${r}||${c}`)
                const v = cell?.openRate ?? null
                const strong = v !== null && (hi > lo ? (v - lo) / (hi - lo) : 0.5) > 0.6
                return (
                  <td key={c} className="p-0">
                    <div className="grid h-9 place-items-center rounded" style={{ background: shade(v) }}>
                      <span className={`tnum text-[0.75rem] font-semibold ${strong ? 'text-white' : 'text-dp-navy-800'}`}>
                        {v === null ? '–' : v.toFixed(0)}
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function TimingBlock({ data }: { data: Dashboard }) {
  const days = data.timing.byWeekday.filter((d) => d.comparable && d.openRate !== null)
  const bands = data.timing.hourBands.filter((b) => b.comparable && b.openRate !== null)
  if (!days.length && !bands.length) {
    return (
      <>
        <Heading>Hvornår vi sender</Heading>
        <p className="text-[0.8125rem] text-dp-navy-500">
          Ingen ugedag eller tidsrum har endnu nok udsendelser bag sig til at kunne sammenlignes.
        </p>
      </>
    )
  }
  const bestDay = [...days].sort((a, b) => b.openRate! - a.openRate!)[0]
  const bestBand = [...bands].sort((a, b) => b.openRate! - a.openRate!)[0]
  return (
    <>
      <Heading note={`Kun ugedage og tidsrum med mindst ${data.timing.minSendouts} udsendelser og ${fmtNum(data.timing.minDelivered)} leverede mails.`}>
        Hvornår vi sender
      </Heading>
      <div className="grid gap-3 sm:grid-cols-2">
        {bestDay && <KeyFact label="Bedste ugedag" value={bestDay.label} note={`${fmtPct(bestDay.openRate)} åbning på ${fmtNum(bestDay.count)} udsendelser`} />}
        {bestBand && <KeyFact label="Bedste tidsrum" value={bestBand.label} note={`${fmtPct(bestBand.openRate)} åbning på ${fmtNum(bestBand.count)} udsendelser`} />}
      </div>
      <ul className="mt-3 space-y-1.5">
        {days.slice(0, 5).map((d) => (
          <li key={d.label} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[0.75rem] text-dp-navy-600">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-dp-navy-100">
              <div className="h-full rounded-full bg-dp-blaa" style={{ width: `${(d.openRate! / Math.max(...days.map((x) => x.openRate!))) * 100}%` }} />
            </div>
            <span className="tnum w-12 shrink-0 text-right text-[0.75rem] font-semibold text-dp-navy-900">{fmtPct(d.openRate)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function SubjectBlock({ data }: { data: Dashboard }) {
  const lengths = data.subjects.byLength.filter((b) => b.comparable && b.openRate !== null)
  const best = lengths.length ? [...lengths].sort((a, b) => b.openRate! - a.openRate!)[0] : null
  const flags = data.subjects.flags.filter((f) => f.reliable && f.openDelta !== null)
    .sort((a, b) => Math.abs(b.openDelta!) - Math.abs(a.openDelta!)).slice(0, 3)
  return (
    <>
      <Heading note="Hvad der får medlemmerne til at åbne.">Emnelinjer</Heading>
      {best && (
        <KeyFact
          label="Bedste længde"
          value={best.label}
          note={`${fmtPct(best.openRate)} åbning på ${fmtNum(best.count)} udsendelser`}
        />
      )}
      <ul className="mt-3 space-y-2">
        {flags.map((f) => (
          <li key={f.label} className="flex items-baseline justify-between gap-4 text-[0.8125rem]">
            <span className="text-dp-navy-700">{f.label}</span>
            <span className="tnum font-semibold" style={{ color: f.openDelta! >= 0 ? '#179fa0' : '#d24e46' }}>
              {fmtDelta(f.openDelta)} point
            </span>
          </li>
        ))}
      </ul>
      {data.overview.best[0] && (
        <p className="mt-3 border-t border-dp-navy-100 pt-3 text-[0.8125rem] leading-snug text-dp-navy-600">
          Bedst åbnede emnelinje: <span className="font-semibold text-dp-navy-900">«{data.overview.best[0].subject}»</span>{' '}
          med {fmtPct(data.overview.best[0].openRate)}.
        </p>
      )}
    </>
  )
}

function ContentBlock({ data }: { data: Dashboard }) {
  const pick = (rows: { label: string; clickRate: number | null; comparable: boolean; count: number }[]) => {
    const ok = rows.filter((r) => r.comparable && r.clickRate !== null)
    return ok.length ? [...ok].sort((a, b) => b.clickRate! - a.clickRate!)[0] : null
  }
  const links = pick(data.content.byLinks)
  const words = pick(data.content.byWords)
  const images = pick(data.content.byImages)
  return (
    <>
      <Heading note="Hvilken slags mail der bliver klikket i.">Indhold</Heading>
      <div className="grid gap-3 sm:grid-cols-3">
        {links && <KeyFact label="Antal links" value={links.label} note={`${fmtPct(links.clickRate)} klik`} />}
        {words && <KeyFact label="Længde" value={words.label} note={`${fmtPct(words.clickRate)} klik`} />}
        {images && <KeyFact label="Billeder" value={images.label} note={`${fmtPct(images.clickRate)} klik`} />}
      </div>
      {data.content.topDestinations.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-dp-navy-100 pt-3">
          {data.content.topDestinations.slice(0, 4).map((d) => (
            <li key={d.path} className="flex items-baseline justify-between gap-4 text-[0.75rem]">
              <span className="truncate text-dp-navy-700" title={d.path}>{d.path}</span>
              <span className="tnum shrink-0 text-dp-navy-500">{fmtNum(d.uses)} links</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function SenderBlock({ data }: { data: Dashboard }) {
  const rows = (data.senders?.rows ?? []).slice(0, 5)
  if (!rows.length) return null
  return (
    <>
      <Heading note={`Kun navne med mindst ${data.senders.minSendouts} udsendelser tæller som sammenlignelige.`}>
        Afsendernavne
      </Heading>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className={`flex items-baseline justify-between gap-4 text-[0.8125rem] ${r.comparable ? '' : 'opacity-60'}`}>
            <span className="min-w-0 truncate text-dp-navy-800" title={r.name}>{r.name}</span>
            <span className="tnum shrink-0 text-dp-navy-500">
              <strong className="text-dp-navy-900">{fmtPct(r.openRate)}</strong> · {fmtNum(r.count)} udsendelser
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function KeyFact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-dp-navy-100 px-3 py-2.5">
      <p className="text-[0.625rem] font-bold uppercase tracking-wider text-dp-navy-400">{label}</p>
      <p className="mt-0.5 font-serif text-[1.0625rem] font-semibold leading-tight text-dp-navy-900">{value}</p>
      <p className="tnum mt-0.5 text-[0.6875rem] text-dp-navy-500">{note}</p>
    </div>
  )
}

/* ── Ugebrev og alarmvarsel ──────────────────────────────────────────────── */

/**
 * Siden sender ingenting. Den skriver brevet, viser det, og lader et menneske
 * sende det. Det er et bevidst valg: et statisk site har ingen mailserver, og
 * en automatisk mail til ledergruppen skal ikke kunne udløses af, at nogen
 * åbner et dashboard. Når I vil have den sendt automatisk, ligger teksten klar
 * i src/lib/report.ts og kan lægges ind i det job, der henter data hver time.
 */
function MailComposer({ data, onClose }: { data: Dashboard; onClose: () => void }) {
  const [kind, setKind] = useState<'ugebrev' | 'alarm'>('ugebrev')
  const [copied, setCopied] = useState<'tekst' | 'html' | null>(null)

  const weekly = useMemo(() => buildWeeklyReport(data), [data])
  const notice = useMemo(() => buildAlertNotice(data), [data])
  const report: Report | null = kind === 'ugebrev' ? weekly : notice

  const copy = async (what: 'tekst' | 'html') => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(what === 'tekst' ? report.text : report.html)
      setCopied(what)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      /* nogle browsere spærrer udklipsholderen — teksten kan stadig markeres */
    }
  }

  return (
    <div className="mx-auto w-full max-w-[62rem] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[1.125rem] font-semibold text-dp-navy-900">
            Brev til ledergruppen
          </h2>
          <p className="mt-1 max-w-xl text-[0.8125rem] leading-relaxed text-dp-navy-600">
            Teksten skrives ud fra de nyeste tal. <strong>Dashboardet sender ikke selv noget</strong> —
            kopiér den ind i din mail, eller åbn den i dit mailprogram.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-dp-navy-100 p-0.5">
            {(['ugebrev', 'alarm'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                disabled={k === 'alarm' && !notice}
                className={`rounded-full px-3 py-1 text-[0.6875rem] font-semibold transition disabled:opacity-40 ${
                  kind === k ? 'bg-dp-navy-600 text-white' : 'text-dp-navy-600'
                }`}
              >
                {k === 'ugebrev' ? 'Ugebrev' : `Alarmvarsel${notice ? ` (${notice.points})` : ''}`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[0.75rem] font-semibold text-dp-navy-500 underline underline-offset-2 hover:text-dp-navy-900"
          >
            Luk
          </button>
        </div>
      </div>

      {!report ? (
        <p className="mt-5 rounded-xl bg-dp-gron-15 px-4 py-6 text-center text-[0.875rem] text-dp-navy-700">
          Der er ingen alarmer lige nu, så der er heller ikke noget varsel at sende.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Emne og ren tekst */}
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-wider text-dp-navy-400">Emnelinje</p>
              <p className="mt-1 rounded-lg border border-dp-navy-100 bg-dp-navy-50 px-3 py-2 text-[0.875rem] font-semibold text-dp-navy-900">
                {report.subject}
              </p>
              <p className="mt-3 text-[0.625rem] font-bold uppercase tracking-wider text-dp-navy-400">Tekst</p>
              <pre className="thin-scroll mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-dp-navy-100 bg-white px-3 py-2.5 font-sans text-[0.8125rem] leading-relaxed text-dp-navy-700">
                {report.text}
              </pre>
            </div>

            {/* Sådan kommer den til at se ud */}
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-wider text-dp-navy-400">Sådan ser den ud</p>
              <div
                className="thin-scroll mt-1 max-h-[26rem] overflow-auto rounded-lg border border-dp-navy-100 bg-dp-navy-50 p-3"
                // Indholdet bygges udelukkende af buildWeeklyReport ud fra egne
                // tal, og alt tekstindhold er escapet dér.
                dangerouslySetInnerHTML={{ __html: report.html }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copy('tekst')}
              className="rounded-full bg-dp-navy-900 px-4 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-dp-navy-700"
            >
              {copied === 'tekst' ? 'Kopieret' : 'Kopiér teksten'}
            </button>
            <button
              type="button"
              onClick={() => copy('html')}
              className="rounded-full border border-dp-navy-200 px-4 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-navy-400"
            >
              {copied === 'html' ? 'Kopieret' : 'Kopiér som HTML'}
            </button>
            <a
              href={mailtoLink(report)}
              className="rounded-full border border-dp-navy-200 px-4 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-orange hover:text-dp-orange"
            >
              Åbn i mailprogram
            </a>
            <span className="ml-auto text-[0.6875rem] text-dp-navy-500">
              {report.points} afsnit · tal fra {stamp(data.meta.generatedAt)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
