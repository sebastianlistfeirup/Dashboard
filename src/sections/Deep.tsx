/**
 * Dybdeanalyserne: krydstabel, kohorter og genaktivering.
 *
 * All three answer questions the flat breakdowns cannot. A group can look
 * ordinary on kontingent and ordinary on region while one crossing of the two
 * is far off; a falling average can be new members behaving differently rather
 * than everyone slipping; and the quiet third of the list is invisible in every
 * rate until you count it.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChartCard, SectionHeading } from '@/components/primitives'
import { LineChart, fmtDec, fmtNum, fmtPct } from '@/components/charts'
import type { Cohorts as CohortData, CrossTabs, Dashboard, Reengagement as ReengagementData, SenderRow } from '@/lib/data'
import { formatDate } from '@/lib/data'
import { motion as mo, series } from '@/design/tokens'

/* ── Krydstabel ──────────────────────────────────────────────────────────── */

export function CrossTab({ crossTabs }: { crossTabs: CrossTabs }) {
  const keys = useMemo(() => Object.keys(crossTabs?.pairs ?? {}), [crossTabs])
  const [pairKey, setPairKey] = useState(keys[0] ?? '')
  const [metric, setMetric] = useState<'openRate' | 'clickRate'>('openRate')
  const [hover, setHover] = useState<string | null>(null)

  if (!keys.length) return null
  const pair = crossTabs.pairs[pairKey] ?? crossTabs.pairs[keys[0]]

  const cellAt = new Map(pair.cells.map((c) => [`${c.row}||${c.col}`, c]))
  const values = pair.cells.map((c) => c[metric]).filter((v): v is number => v !== null)
  const lo = Math.min(...values)
  const hi = Math.max(...values)

  const shade = (v: number | null) => {
    if (v === null) return '#f4f1f1'
    const t = hi > lo ? (v - lo) / (hi - lo) : 0.5
    const steps = ['#e7ebef', '#d4dbe1', '#aebdd4', '#8299bb', '#5a76a0', '#3a557d', '#2a4368', '#1e3050']
    return steps[Math.min(steps.length - 1, Math.round(t * (steps.length - 1)))]
  }

  const best = pair.cells.filter((c) => c[metric] !== null).sort((a, b) => b[metric]! - a[metric]!)[0]
  const worst = pair.cells.filter((c) => c[metric] !== null).sort((a, b) => a[metric]! - b[metric]!)[0]

  return (
    <ChartCard
      title="Krydstabel"
      subtitle="To dimensioner på én gang. Mørkere felt betyder højere rate; tomme felter har for få personer til at blive vist."
      moduleId="krydstabel"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={pairKey || keys[0]}
            onChange={(e) => setPairKey(e.target.value)}
            className="rounded-full border border-dp-navy-100 bg-white px-3 py-1 text-[0.6875rem] font-semibold text-dp-navy-700 focus:border-dp-orange focus:outline-none"
            aria-label="Vælg to dimensioner"
          >
            {keys.map((k) => (
              <option key={k} value={k}>
                {crossTabs.pairs[k].rowLabel} × {crossTabs.pairs[k].colLabel}
              </option>
            ))}
          </select>
          <div className="flex rounded-full border border-dp-navy-100 p-0.5">
            {(['openRate', 'clickRate'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`rounded-full px-3 py-1 text-[0.6875rem] font-semibold transition ${
                  metric === m ? 'bg-dp-navy-600 text-white' : 'text-dp-navy-600'
                }`}
              >
                {m === 'openRate' ? 'Åbning' : 'Klik'}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate" style={{ borderSpacing: '3px' }}>
          <thead>
            <tr>
              <th className="w-40 pb-1 text-left text-[0.6875rem] font-bold uppercase tracking-wider text-dp-navy-400">
                {pair.rowLabel}
              </th>
              {pair.cols.map((c) => (
                <th key={c} className="pb-1 text-center text-[0.6875rem] font-semibold text-dp-navy-500">
                  <span className="block max-w-[6.5rem] truncate" title={c}>{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pair.rows.map((r, ri) => (
              <tr key={r}>
                <th className="max-w-[10rem] truncate pr-2 text-left text-[0.8125rem] font-medium text-dp-navy-800" title={r}>
                  {r}
                </th>
                {pair.cols.map((c, ci) => {
                  const cell = cellAt.get(`${r}||${c}`)
                  const v = cell?.[metric] ?? null
                  const id = `${r}||${c}`
                  const strong = v !== null && (hi > lo ? (v - lo) / (hi - lo) : 0.5) > 0.55
                  return (
                    <td key={c} className="p-0">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.32, delay: (ri * pair.cols.length + ci) * 0.012, ease: mo.ease }}
                        onMouseEnter={() => setHover(id)}
                        onMouseLeave={() => setHover((h) => (h === id ? null : h))}
                        className="grid h-14 cursor-default place-items-center rounded-lg transition-shadow"
                        style={{
                          background: shade(v),
                          boxShadow: hover === id ? '0 0 0 2px #df790d' : 'none',
                        }}
                        title={cell ? `${r} × ${c}: ${fmtPct(v)} · ${fmtNum(cell.people)} personer` : `${r} × ${c}: for få personer`}
                      >
                        {v === null ? (
                          <span className="text-[0.6875rem] text-dp-navy-300">–</span>
                        ) : (
                          <span className="text-center leading-tight">
                            <span className={`tnum block text-[0.875rem] font-semibold ${strong ? 'text-white' : 'text-dp-navy-900'}`}>
                              {fmtDec(v)}
                            </span>
                            <span className={`tnum block text-[0.625rem] ${strong ? 'text-dp-navy-200' : 'text-dp-navy-500'}`}>
                              n={fmtNum(cell!.people)}
                            </span>
                          </span>
                        )}
                      </motion.div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {best && (
          <Callout colour="#179fa0" label="Højest">
            <strong>{best.row}</strong> i <strong>{best.col}</strong> ligger på {fmtPct(best[metric])} —{' '}
            {fmtNum(best.people)} personer.
          </Callout>
        )}
        {worst && worst !== best && (
          <Callout colour="#d24e46" label="Lavest">
            <strong>{worst.row}</strong> i <strong>{worst.col}</strong> ligger på {fmtPct(worst[metric])} —{' '}
            {fmtNum(worst.people)} personer.
          </Callout>
        )}
      </div>

      <p className="mt-4 text-[0.75rem] leading-relaxed text-dp-navy-400">
        {crossTabs.note}
        {pair.suppressed > 0 && ` ${pair.suppressed} kombination${pair.suppressed === 1 ? '' : 'er'} er skjult, fordi de har under ${crossTabs.minPeople} personer.`}
      </p>
    </ChartCard>
  )
}

function Callout({ colour, label, children }: { colour: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dp-navy-100 p-3.5" style={{ borderLeftColor: colour, borderLeftWidth: 4 }}>
      <p className="text-[0.625rem] font-bold uppercase tracking-wider" style={{ color: colour }}>{label}</p>
      <p className="mt-1 text-[0.8125rem] leading-snug text-dp-navy-700">{children}</p>
    </div>
  )
}

/* ── Kohorter ────────────────────────────────────────────────────────────── */

const COHORTS_SHOWN = 6

export function Cohorts({ cohorts }: { cohorts: CohortData | null }) {
  if (!cohorts?.cohorts?.length) return null

  // Femten årgange gør kurven ulæselig. De seneste seks er dem, onboardingen
  // faktisk kan nå at ændre noget for.
  const all = [...cohorts.cohorts].sort((a, b) => b.year - a.year)
  const shown = all.slice(0, COHORTS_SHOWN).sort((a, b) => a.year - b.year)
  const hidden = all.length - shown.length

  const lines = shown.map((c, i) => ({
    key: String(c.year),
    label: `Indmeldt ${c.year} · ${fmtNum(c.people)} pers.`,
    color: series[i % series.length],
    points: c.buckets.map((b) => ({ x: b.label, y: b.reached ? b.openRate : null })),
  }))

  const years = new Set(shown.map((c) => c.year))
  const firstWindow = cohorts.firstWindow
    .filter((f) => f.openRate !== null && f.openRate !== undefined && years.has(f.year))
    .sort((a, b) => a.year - b.year)

  return (
    <ChartCard
      title="Onboarding over tid"
      subtitle="Hvordan hver årgang af nye medlemmer åbner mails, målt fra deres indmeldelse. Kurverne skal helst ligge oven på hinanden."
      moduleId="kohorter"
      legend={lines.map((l) => ({ label: l.key, color: l.color }))}
    >
      <LineChart series={lines} height={280} />

      {firstWindow.length > 2 && (
        <div className="mt-6 border-t border-dp-navy-50 pt-5">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
            De første seks måneder, årgang for årgang
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-4">
            {firstWindow.map((f, i) => {
              const max = Math.max(...firstWindow.map((x) => x.openRate ?? 0)) || 1
              return (
                <div key={f.year} className="flex min-w-[3.75rem] flex-1 flex-col items-center gap-1.5">
                  <span className="tnum text-[0.8125rem] font-semibold text-dp-navy-900">{fmtPct(f.openRate ?? null)}</span>
                  <motion.div
                    className="w-full rounded-t-md"
                    style={{ background: series[i % series.length] }}
                    initial={{ height: 0 }}
                    whileInView={{ height: Math.max(6, ((f.openRate ?? 0) / max) * 92) }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: i * 0.06, ease: mo.ease }}
                  />
                  <span className="tnum text-[0.6875rem] font-semibold text-dp-navy-700">{f.year}</span>
                  <span className="tnum text-[0.625rem] text-dp-navy-400">{fmtNum(f.people)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="mt-4 text-[0.75rem] leading-relaxed text-dp-navy-400">
        {cohorts.note}
        {hidden > 0 && ` Kun de ${COHORTS_SHOWN} seneste årgange er tegnet; ${hidden} ældre årgange er udeladt for læsbarhedens skyld.`}
      </p>
    </ChartCard>
  )
}

/* ── Genaktivering ───────────────────────────────────────────────────────── */

export function Reengagement({ reengagement }: { reengagement: ReengagementData | null }) {
  const [dim, setDim] = useState<'byKontingent' | 'byAnciennitet' | 'byRegion'>('byKontingent')
  if (!reengagement) return null
  const r = reengagement

  const DIMS = {
    byKontingent: 'Kontingentgruppe',
    byAnciennitet: 'Anciennitet',
    byRegion: 'Region',
  } as const

  const rows = [...(r[dim] ?? [])].sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, 8)
  const maxShare = Math.max(1, ...rows.map((x) => x.share ?? 0))

  return (
    <ChartCard
      title="Genaktivering"
      subtitle={`Medlemmer der har fået mindst ${r.minReceived} mails, men ikke åbnet en eneste i ${r.monthsWithoutOpen} måneder.`}
      moduleId="genaktivering"
    >
      {/* Hovedtallet */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          value={fmtNum(r.estimatedPeople)}
          label="sovende medlemmer"
          note={`Skøn ud fra ${fmtNum(r.sample)} i stikprøven`}
          colour="#df790d"
          big
        />
        <Stat value={fmtPct(r.dormantShare)} label="af dem der får mails" note="ligger stille" colour="#4c7bbd" />
        <Stat
          value={r.lift === null ? '–' : `+${fmtDec(r.lift)}`}
          label="point højere åbningsrate"
          note="hvis de sovende ikke talte med"
          colour="#179fa0"
        />
      </div>

      {/* Hvem er de */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
            Hvor sidder de sovende?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(DIMS) as (keyof typeof DIMS)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDim(k)}
                aria-pressed={dim === k}
                className={`rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold transition ${
                  dim === k ? 'border-dp-navy-600 bg-dp-navy-600 text-white' : 'border-dp-navy-100 text-dp-navy-600'
                }`}
              >
                {DIMS[k]}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.ul
            key={dim}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: mo.ease }}
            className="space-y-2.5"
          >
            {rows.map((row, i) => (
              <li key={row.name} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[0.8125rem] text-dp-navy-800" title={row.name}>
                  {row.name}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-dp-navy-50">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: (row.share ?? 0) > maxShare * 0.75 ? '#d24e46' : '#df790d' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${((row.share ?? 0) / maxShare) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04, ease: mo.ease }}
                  />
                </div>
                <span className="tnum w-24 shrink-0 text-right text-[0.75rem] text-dp-navy-600">
                  <strong className="text-dp-navy-900">{fmtPct(row.share)}</strong> · {fmtNum(row.dormant)}
                </span>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>

      {/* Hvad kan man gøre */}
      {r.ideas?.length > 0 && (
        <div className="mt-7 border-t border-dp-navy-50 pt-5">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
            Hvad man kunne sende dem
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {r.ideas.map((idea, i) => (
              <motion.li
                key={idea.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: mo.ease }}
                className="group rounded-2xl border border-dp-navy-100 bg-white p-4 transition-shadow hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-serif text-[0.9375rem] font-semibold leading-snug text-dp-navy-900">
                    {idea.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-dp-navy-50 px-2 py-0.5 text-[0.625rem] font-semibold text-dp-navy-600">
                    {idea.effort}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-dp-navy-600">{idea.body}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[0.75rem] leading-relaxed text-dp-navy-400">{r.caveat}</p>
    </ChartCard>
  )
}

function Stat({
  value, label, note, colour, big = false,
}: { value: string; label: string; note: string; colour: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-dp-navy-100 p-4" style={{ borderTopColor: colour, borderTopWidth: 3 }}>
      <p className={`tnum font-serif font-semibold leading-none text-dp-navy-900 ${big ? 'text-[2rem]' : 'text-[1.625rem]'}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[0.8125rem] font-semibold text-dp-navy-800">{label}</p>
      <p className="mt-0.5 text-[0.6875rem] text-dp-navy-500">{note}</p>
    </div>
  )
}

/* ── Afsendernavne ───────────────────────────────────────────────────────── */

export function Senders({ senders }: { senders: Dashboard['senders'] }) {
  const rows = (senders?.rows ?? []).slice(0, 10)
  if (rows.length < 2) return null
  const max = Math.max(1, ...rows.map((r) => r.openRate ?? 0))
  const reliable = rows.filter((r) => r.comparable)

  return (
    <ChartCard
      title="Betyder afsendernavnet noget?"
      subtitle={`Åbningsrate pr. afsendernavn. Kun navne med mindst ${senders.minSendouts} udsendelser og ${fmtNum(senders.minDelivered)} leverede mails tæller som sammenlignelige.`}
      moduleId="afsendere"
    >
      <ul className="space-y-4">
        {rows.map((r: SenderRow, i) => (
          <li key={r.name} className={r.comparable ? '' : 'opacity-55'}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[0.875rem] font-semibold text-dp-navy-900" title={r.name}>{r.name}</span>
                {!r.comparable && (
                  <span className="shrink-0 rounded-full bg-dp-navy-50 px-2 py-0.5 text-[0.625rem] font-semibold text-dp-navy-500">
                    for lidt data
                  </span>
                )}
              </span>
              <span className="tnum shrink-0 text-[0.8125rem] font-semibold text-dp-navy-900">
                {fmtPct(r.openRate)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-dp-navy-50">
              <motion.div
                className="h-full rounded-full"
                style={{ background: r.comparable ? series[i % series.length] : '#c9d3de' }}
                initial={{ width: 0 }}
                whileInView={{ width: `${((r.openRate ?? 0) / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: mo.ease }}
              />
            </div>
            <p className="tnum mt-1 text-[0.6875rem] text-dp-navy-500">
              {fmtNum(r.count)} udsendelser · {fmtNum(r.delivered)} leveret · {fmtPct(r.clickRate)} klik · senest {formatDate(r.lastUsed)}
            </p>
          </li>
        ))}
      </ul>

      {reliable.length >= 2 && (
        <p className="mt-5 rounded-xl bg-dp-navy-50 px-4 py-3 text-[0.8125rem] leading-relaxed text-dp-navy-700">
          Blandt de sammenlignelige navne ligger <strong>{reliable[0].name}</strong> højest med{' '}
          {fmtPct(reliable[0].openRate)}, og <strong>{reliable[reliable.length - 1].name}</strong> lavest med{' '}
          {fmtPct(reliable[reliable.length - 1].openRate)}. Forskellen kan lige så godt være typen af
          indhold navnene bruges til som selve navnet — de sendes sjældent til den samme gruppe.
        </p>
      )}
    </ChartCard>
  )
}

/* ── Sektionsramme ───────────────────────────────────────────────────────── */

export function DeepDive({ data }: { data: Dashboard }) {
  return (
    <>
      <SectionHeading
        kicker="Dybdeanalyse"
        title="Hvem gør hvad — og hvem er holdt op?"
        lead="Engagement på to dimensioner samtidig, nye årganges første måneder, og den del af bestanden der er faldet i søvn."
      />
      <div className="space-y-6">
        <CrossTab crossTabs={data.crossTabs} />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Cohorts cohorts={data.cohorts} />
          <Reengagement reengagement={data.reengagement} />
        </div>
      </div>
    </>
  )
}
