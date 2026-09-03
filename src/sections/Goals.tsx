/**
 * Mål, benchmark, månedens tekst og alarmer.
 *
 * These four belong together: they are the answer to "hvordan går det?" before
 * anyone has scrolled into the detail. The month text says it in words, the
 * gauges say it against our own ambition, the benchmark says it against the
 * world, and the alerts say what needs a hand this week.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { Badge, ChartCard, Reveal, SectionHeading } from '@/components/primitives'
import { fmtNum, fmtPct } from '@/components/charts'
import type { Alert, Benchmarks, Dashboard, Narrative, TargetStatus } from '@/lib/data'
import { formatDate } from '@/lib/data'
import { useSettingsMaybe } from '@/lib/settings'
import { ModuleToggle } from '@/components/ModuleToggle'
import { motion as mo } from '@/design/tokens'

/** Danske decimaler — komma, ikke punktum. */
const da = (n: number, d = 1) => n.toFixed(d).replace('.', ',')

/* ── Månedens tekst ──────────────────────────────────────────────────────── */

/**
 * The prose is written by the ETL, so the words on screen and the numbers in
 * the file can never drift apart. Here it is only set — one sentence at a time,
 * so it reads as if someone is telling you.
 */
export function NarrativeCard({ narrative }: { narrative: Narrative | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.4 })
  if (!narrative) return null

  const sentences = narrative.text.match(/[^.!?]+[.!?]+\s*/g) ?? [narrative.text]
  const f = narrative.figures

  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl bg-dp-navy-900 p-6 text-white sm:p-9">
      {/* Rolige lysfelter i baggrunden, så fladen ikke står død */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle,#df790d55,transparent 70%)' }}
        animate={{ scale: [1, 1.14, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle,#4c7bbd66,transparent 70%)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="kicker text-dp-orange">Månedens tekst</div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/15 px-3 py-1 text-[0.6875rem] font-semibold text-dp-navy-300">
              {narrative.monthName}
            </span>
            <ModuleToggle moduleId="maaned-tekst" onDark />
          </div>
        </div>

        <p className="mt-6 max-w-[60ch] font-serif text-[1.375rem] leading-[1.5] text-white sm:text-[1.625rem]">
          {sentences.map((s, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={seen ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.12 + i * 0.16, ease: mo.ease }}
              className="inline"
            >
              {s}
            </motion.span>
          ))}
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4">
          <Figure label="Udsendelser" value={fmtNum(f.count)} />
          <Figure label="Leverede mails" value={fmtNum(f.delivered)} />
          <Figure label="Åbningsrate" value={fmtPct(f.openRate)} delta={f.openDelta} />
          <Figure label="Klikrate" value={fmtPct(f.clickRate)} delta={f.clickDelta} />
        </dl>

        <p className="mt-5 text-[0.75rem] leading-relaxed text-dp-navy-400">{narrative.note}</p>
      </div>
    </div>
  )
}

function Figure({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-dp-navy-400">{label}</dt>
      <dd className="tnum mt-1.5 flex items-baseline gap-2 font-serif text-[1.75rem] font-semibold leading-none text-white">
        {value}
        {delta !== null && delta !== undefined && Math.abs(delta) >= 0.1 && (
          <span
            className="tnum text-[0.75rem] font-semibold"
            style={{ color: delta > 0 ? '#8ebec0' : '#e39687' }}
          >
            {delta > 0 ? '▲' : '▼'} {da(Math.abs(delta))}
          </span>
        )}
      </dd>
    </div>
  )
}

/* ── Mål og status ───────────────────────────────────────────────────────── */

/**
 * A half-circle gauge per KPI. The arc is the distance travelled toward the
 * target; the notch is the target itself, so "hvor langt er vi" is one glance
 * rather than a subtraction.
 */
export function Targets({ targets }: { targets: TargetStatus[] }) {
  const settings = useSettingsMaybe()
  const [editing, setEditing] = useState(false)
  if (!targets?.length) return null

  return (
    <ChartCard
      title="Mål og status"
      subtitle="Hvor langt vi er fra det, vi har sat os for. Målene kan sættes af jer selv."
      moduleId="kpi-maalere"
      actions={settings && (
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
          className="rounded-full border border-dp-navy-100 px-3 py-1 text-[0.6875rem] font-semibold text-dp-navy-600 transition hover:border-dp-navy-300 hover:text-dp-navy-900"
        >
          {editing ? 'Færdig' : 'Sæt mål'}
        </button>
      )}
    >
      <div className="grid gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {targets.map((t, i) => (
          <Gauge key={t.key} target={t} index={i} editing={editing} />
        ))}
      </div>
      {editing && (
        <p className="mt-6 rounded-xl bg-dp-navy-50 px-4 py-3 text-[0.75rem] leading-relaxed text-dp-navy-600">
          Ændringer gemmes i din browser med det samme. Vil du gøre dem til foreningens
          fælles mål, kan du hente dem som JSON nederst på ledelsessiden og lægge dem ind i{' '}
          <code className="rounded bg-white px-1 py-0.5 text-[0.6875rem]">config/dashboard.json</code>.
        </p>
      )}
    </ChartCard>
  )
}

function Gauge({ target, index, editing }: { target: TargetStatus; index: number; editing: boolean }) {
  const settings = useSettingsMaybe()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  const [shown, setShown] = useState(0)

  const progress = Math.max(0, Math.min(1, (target.progress ?? 0) / 100))
  const reached = target.reached === true
  const colour = reached ? '#179fa0' : progress > 0.85 ? '#df790d' : '#d24e46'

  // Halvcirkel: 180° fra venstre til højre.
  const R = 52
  const CIRC = Math.PI * R
  const arc = `M 8 62 A ${R} ${R} 0 0 1 ${8 + 2 * R} 62`

  useEffect(() => {
    if (!seen || target.value === null) return
    const from = 0
    const to = target.value
    const start = performance.now()
    const dur = 1000
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, target.value])

  return (
    <div ref={ref} className="flex flex-col items-center text-center">
      <div className="relative">
        <svg width="120" height="74" viewBox="0 0 120 74" role="img" aria-label={`${target.label}: ${fmtPct(target.value)} mod mål ${target.target}`}>
          <path d={arc} fill="none" stroke="#e7ebef" strokeWidth="9" strokeLinecap="round" />
          <motion.path
            d={arc}
            fill="none"
            stroke={colour}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={seen ? { strokeDashoffset: CIRC * (1 - progress) } : {}}
            transition={{ duration: 1.1, delay: index * 0.08, ease: mo.ease }}
          />
          {/* Målmærket sidder altid for enden — det er der, vi vil hen */}
          <circle cx={8 + 2 * R} cy="62" r="4.5" fill="#fff" stroke={reached ? '#179fa0' : '#aebdd4'} strokeWidth="2.5" />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <div className="tnum font-serif text-[1.5rem] font-semibold leading-none text-dp-navy-900">
            {target.value === null ? '–' : da(shown, target.target < 2 ? 2 : 1)}
            <span className="text-[0.875rem] font-normal text-dp-navy-400">%</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[0.8125rem] font-semibold leading-tight text-dp-navy-900">{target.label}</div>

      {editing && settings ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="number"
            step={target.target < 2 ? 0.05 : 0.5}
            value={target.target}
            onChange={(e) => settings.setTarget(target.key, Number(e.target.value))}
            className="tnum w-[4.5rem] rounded-lg border border-dp-navy-200 px-2 py-1 text-center text-[0.8125rem] focus:border-dp-orange focus:outline-none"
            aria-label={`Mål for ${target.label}`}
          />
          {settings.isLocalTarget(target.key) && (
            <button
              type="button"
              onClick={() => settings.resetTarget(target.key)}
              className="text-[0.6875rem] font-semibold text-dp-navy-500 underline underline-offset-2 hover:text-dp-navy-900"
            >
              nulstil
            </button>
          )}
        </div>
      ) : (
        <div className="tnum mt-1 text-[0.75rem] text-dp-navy-500">
          Mål {da(target.target, target.target < 2 ? 2 : 0)}{' '}
          {target.gap !== null && (
            <span style={{ color: reached ? '#179fa0' : '#8299bb' }}>
              {reached ? '· nået' : `· mangler ${da(Math.abs(target.gap), target.target < 2 ? 2 : 1)}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Benchmark ───────────────────────────────────────────────────────────── */

const METRIC_LABEL: Record<string, string> = {
  openRate: 'Åbningsrate',
  clickRate: 'Klikrate',
  ctor: 'Klik pr. åbning',
  unsubRate: 'Afmeldinger',
  bounceRate: 'Bounce',
}

export function Benchmark({ benchmarks }: { benchmarks: Benchmarks | null }) {
  const [source, setSource] = useState(benchmarks?.primary ?? benchmarks?.sources[0]?.key ?? '')
  if (!benchmarks?.sources.length) return null
  const active = benchmarks.sources.find((s) => s.key === source) ?? benchmarks.sources[0]

  return (
    <ChartCard
      title="Sammenlignet med andre"
      subtitle="DP holdt op mod eksterne målestokke. Kilde og grundlag står på hver enkelt."
      moduleId="benchmark"
      actions={
        <div className="flex flex-wrap gap-1.5">
          {benchmarks.sources.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSource(s.key)}
              aria-pressed={s.key === active.key}
              className={`rounded-full border px-3 py-1 text-[0.6875rem] font-semibold transition ${
                s.key === active.key
                  ? 'border-dp-navy-600 bg-dp-navy-600 text-white'
                  : 'border-dp-navy-100 text-dp-navy-600 hover:border-dp-navy-300'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      }
    >
      <ul className="space-y-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: mo.ease }}
            className="space-y-5"
          >
            {active.metrics.map((m) => (
              <BenchmarkRow key={m.metric} metric={m} note={active.notes?.[m.metric]} />
            ))}
          </motion.div>
        </AnimatePresence>
      </ul>

      <div className="mt-6 space-y-2 border-t border-dp-navy-50 pt-4 text-[0.75rem] leading-relaxed text-dp-navy-500">
        <p>
          <strong className="text-dp-navy-700">Kilde:</strong> {active.source} ({active.year}).{' '}
          {active.basis}.{' '}
          <a href={active.url} target="_blank" rel="noreferrer" className="text-dp-blaa underline underline-offset-2">
            Se rapporten
          </a>
        </p>
        {benchmarks.caveat && <p className="text-dp-navy-400">{benchmarks.caveat}</p>}
      </div>
    </ChartCard>
  )
}

function BenchmarkRow({
  metric, note,
}: {
  metric: { metric: string; external: number; own: number | null; delta: number | null; ratio: number | null }
  note?: string
}) {
  const lower = metric.metric === 'unsubRate' || metric.metric === 'bounceRate'
  const better = metric.delta === null ? null : lower ? metric.delta < 0 : metric.delta > 0
  const max = Math.max(metric.external, metric.own ?? 0) * 1.12 || 1

  return (
    <li>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[0.875rem] font-semibold text-dp-navy-900">
          {METRIC_LABEL[metric.metric] ?? metric.metric}
        </span>
        {metric.delta !== null && (
          <Badge color={better ? '#179fa0' : '#d24e46'}>
            {metric.delta > 0 ? '+' : '−'}{da(Math.abs(metric.delta))} point
            {metric.ratio && metric.ratio >= 1.15 ? ` · ${da(metric.ratio)}×` : ''}
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <Track label="DP" value={metric.own} max={max} colour="#df790d" delay={0} />
        <Track label="Andre" value={metric.external} max={max} colour="#aebdd4" delay={0.12} />
      </div>
      {note && <p className="mt-1.5 text-[0.6875rem] leading-snug text-dp-navy-400">{note}</p>}
    </li>
  )
}

function Track({
  label, value, max, colour, delay,
}: { label: string; value: number | null; max: number; colour: string; delay: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wider text-dp-navy-400">
        {label}
      </span>
      <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-dp-navy-50">
        <motion.div
          className="h-full rounded-full"
          style={{ background: colour }}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(100, ((value ?? 0) / max) * 100)}%` }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.9, delay, ease: mo.ease }}
        />
      </div>
      <span className="tnum w-14 shrink-0 text-right text-[0.8125rem] font-semibold text-dp-navy-900">
        {fmtPct(value)}
      </span>
    </div>
  )
}

/* ── Alarmer ─────────────────────────────────────────────────────────────── */

const SEVERITY = {
  critical: { colour: '#d24e46', soft: '#f6e1d8', label: 'Kritisk' },
  warning: { colour: '#df790d', soft: '#f9e8d4', label: 'Se på den' },
} as const

export function Alerts({ alerts }: { alerts: Dashboard['alerts'] }) {
  const [showOld, setShowOld] = useState(false)
  if (!alerts?.active) return null
  const items = alerts.items ?? []
  const older = alerts.recent ?? []

  return (
    <ChartCard
      title="Alarmer"
      subtitle="Udsendelser der falder markant udenfor det normale. Tærsklerne står i konfigurationen."
      moduleId="alarmer"
      actions={older.length > 0 && (
        <button
          type="button"
          onClick={() => setShowOld((v) => !v)}
          aria-pressed={showOld}
          className="rounded-full border border-dp-navy-100 px-3 py-1 text-[0.6875rem] font-semibold text-dp-navy-600 transition hover:border-dp-navy-300"
        >
          {showOld ? 'Skjul ældre' : `Ældre (${older.length})`}
        </button>
      )}
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl bg-dp-gron-15 px-5 py-6">
          <motion.span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
            style={{ background: '#179fa0' }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: mo.ease }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </motion.span>
          <div>
            <p className="text-[0.9375rem] font-semibold text-dp-navy-900">Ingen alarmer lige nu</p>
            <p className="mt-0.5 text-[0.8125rem] text-dp-navy-600">
              Ingen udsendelse ligger markant under sin type, og bestanden er inden for tærsklerne.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a, i) => <AlertRow key={`${a.kind}-${a.id ?? i}`} alert={a} index={i} />)}
        </ul>
      )}

      <AnimatePresence>
        {showOld && older.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: mo.ease }}
            className="mt-4 space-y-3 overflow-hidden border-t border-dp-navy-50 pt-4"
          >
            {older.map((a, i) => <AlertRow key={`old-${a.id ?? i}`} alert={a} index={i} muted />)}
          </motion.ul>
        )}
      </AnimatePresence>
    </ChartCard>
  )
}

function AlertRow({ alert, index, muted = false }: { alert: Alert; index: number; muted?: boolean }) {
  const s = SEVERITY[alert.severity] ?? SEVERITY.warning
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: muted ? 0.72 : 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: mo.ease }}
      className="flex gap-4 rounded-2xl border border-dp-navy-100 bg-white p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: s.colour }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[0.875rem] font-semibold text-dp-navy-900">{alert.title}</span>
          {!muted && (
            <span
              className="rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider"
              style={{ background: s.soft, color: s.colour }}
            >
              {s.label}
            </span>
          )}
        </div>
        {alert.subject && (
          <p className="mt-1 truncate text-[0.8125rem] text-dp-navy-700" title={alert.subject}>
            «{alert.subject}»
          </p>
        )}
        <p className="mt-1 text-[0.8125rem] leading-snug text-dp-navy-500">{alert.detail}</p>
      </div>
      {alert.when && (
        <span className="shrink-0 self-start text-[0.6875rem] text-dp-navy-400">{formatDate(alert.when)}</span>
      )}
    </motion.li>
  )
}

/* ── Sektionsramme ───────────────────────────────────────────────────────── */

export function Status({ data }: { data: Dashboard }) {
  return (
    <>
      <SectionHeading
        kicker="Status"
        title="Hvor står vi lige nu?"
        lead="Månedens tal sat i ord, holdt op mod vores egne mål og mod andre foreninger — og en liste over det, der kalder på en hånd."
      />
      <Reveal>
        <NarrativeCard narrative={data.narrative} />
      </Reveal>
      <div className="mt-6">
        <Reveal delay={0.06}>
          <Targets targets={data.targets} />
        </Reveal>
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Reveal delay={0.1}><Benchmark benchmarks={data.benchmarks} /></Reveal>
        <Reveal delay={0.14}><Alerts alerts={data.alerts} /></Reveal>
      </div>
    </>
  )
}
