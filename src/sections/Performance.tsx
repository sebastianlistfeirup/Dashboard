/**
 * Udvikling over tid, udsendelsestyper og segmenter.
 *
 * The trend follows the active filters, so choosing a segment really does mean
 * "kun data for dem" here too. Open and click rates share one axis on purpose —
 * two y-scales in one frame would let the shapes lie about their relationship.
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarRows, DataTable, LineChart, fmtNum, fmtPct } from '@/components/charts'
import { Band, ChartCard, Reveal, SectionHeading } from '@/components/primitives'
import { monthlyOf, monthLabel, type Dashboard, type Mailing, type SegmentRow } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

/* ── Udvikling over tid ──────────────────────────────────────────────────── */

export function Trends({ data, mailings, filtersActive }: {
  data: Dashboard; mailings: Mailing[]; filtersActive: boolean
}) {
  const [grain, setGrain] = useState<'month' | 'week'>('month')
  const [split, setSplit] = useState(false)

  const monthly = useMemo(() => monthlyOf(mailings), [mailings])
  const weekly = useMemo(() => {
    const map = new Map<string, Mailing[]>()
    for (const m of mailings) {
      if (!m.week) continue
      if (!map.has(m.week)) map.set(m.week, [])
      map.get(m.week)!.push(m)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, group]) => {
      const delivered = group.reduce((s, x) => s + x.stats.delivered, 0)
      const opens = group.reduce((s, x) => s + x.stats.opens, 0)
      const clicks = group.reduce((s, x) => s + x.stats.clicks, 0)
      return {
        key: week,
        count: group.length,
        delivered,
        openRate: delivered ? Math.round((opens / delivered) * 1000) / 10 : null,
        clickRate: delivered ? Math.round((clicks / delivered) * 1000) / 10 : null,
      }
    })
  }, [mailings])

  const points = grain === 'month'
    ? monthly.map((m) => ({ key: m.month, ...m }))
    : weekly

  const combined = [
    {
      key: 'open',
      label: 'Åbningsrate',
      color: '#eab922',
      points: points.map((p) => ({ x: p.key, y: p.openRate })),
    },
    {
      key: 'click',
      label: 'Klikrate',
      color: '#4fa388',
      points: points.map((p) => ({ x: p.key, y: p.clickRate })),
    },
  ]

  // Per type, only where the type has enough months to draw a line.
  const perType = data.types
    .map((t) => {
      const group = mailings.filter((m) => m.type === t.key)
      const series = monthlyOf(group)
      return {
        key: t.key,
        label: t.short,
        color: t.color,
        points: series.map((s) => ({ x: s.month, y: s.openRate })),
      }
    })
    .filter((s) => s.points.filter((p) => p.y !== null).length >= 3)

  return (
    <>
      <SectionHeading
        kicker="Udvikling over tid"
        title="Åbninger og klik måned for måned"
        lead={filtersActive
          ? 'Kurven viser kun de udsendelser, dine filtre rammer.'
          : 'Begge kurver deler samme akse, så forholdet mellem dem er til at stole på.'}
        right={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-dp-navy-200 bg-white p-0.5">
              {(['month', 'week'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrain(g)}
                  className="relative rounded-full px-3 py-1 text-[0.75rem] font-semibold transition-colors"
                  style={{ color: grain === g ? '#fff' : '#4a5a72' }}
                >
                  {grain === g && (
                    <motion.span layoutId="grain-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                  )}
                  <span className="relative">{g === 'month' ? 'Måned' : 'Uge'}</span>
                </button>
              ))}
            </div>
            {perType.length > 1 && (
              <button
                type="button"
                onClick={() => setSplit((v) => !v)}
                aria-pressed={split}
                className="rounded-full border border-dp-navy-200 px-3 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-navy-400"
              >
                {split ? 'Saml' : 'Del op på type'}
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <ChartCard
          title={split ? 'Åbningsrate pr. udsendelsestype' : 'Åbningsrate og klikrate'}
          subtitle={split
            ? 'Kun typer med mindst tre måneders data. Farven følger typen, ikke placeringen.'
            : `${points.length} ${grain === 'month' ? 'måneder' : 'uger'} · ${fmtNum(mailings.length)} udsendelser`}
          legend={(split ? perType : combined).map((s) => ({ label: s.label, color: s.color }))}
          table={
            <DataTable
              columns={[
                { key: 'p', label: grain === 'month' ? 'Måned' : 'Uge' },
                { key: 'n', label: 'Udsendelser', align: 'right' },
                { key: 'd', label: 'Leveret', align: 'right' },
                { key: 'o', label: 'Åbningsrate', align: 'right' },
                { key: 'c', label: 'Klikrate', align: 'right' },
              ]}
              rows={points.map((p) => ({
                p: grain === 'month' ? monthLabel(p.key) : p.key,
                n: fmtNum(p.count),
                d: fmtNum(p.delivered),
                o: fmtPct(p.openRate),
                c: fmtPct(p.clickRate),
              }))}
            />
          }
        >
          {points.length < 2 ? (
            <Empty>Der er ikke nok perioder til at tegne en udvikling.</Empty>
          ) : (
            <LineChart series={split ? perType : combined} height={288} area={false} />
          )}
        </ChartCard>

        <ChartCard
          title="Udsendelser pr. måned"
          subtitle="Hvor meget der bliver sendt — sammenhold med kurven til venstre."
        >
          {monthly.length < 2 ? (
            <Empty>Ikke nok data.</Empty>
          ) : (
            <div className="space-y-2.5">
              {monthly.slice(-12).map((m, i) => {
                const max = Math.max(...monthly.slice(-12).map((x) => x.count))
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[0.75rem] text-dp-navy-500">{monthLabel(m.month)}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-dp-navy-100">
                      <motion.div
                        className="h-full rounded-full bg-dp-blaa"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(m.count / max) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: mo.ease, delay: i * 0.04 }}
                      />
                    </div>
                    <span className="tnum w-7 shrink-0 text-right text-[0.75rem] font-semibold text-dp-navy-900">
                      {m.count}
                    </span>
                    <span className="tnum w-12 shrink-0 text-right text-[0.75rem] text-dp-navy-400">
                      {fmtPct(m.openRate, 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>
      </div>
    </>
  )
}

/* ── Udsendelsestyper ────────────────────────────────────────────────────── */

export function Types({ data, mailings }: { data: Dashboard; mailings: Mailing[] }) {
  const rows = useMemo(() => {
    return data.types
      .map((t) => {
        const group = mailings.filter((m) => m.type === t.key)
        const delivered = group.reduce((s, x) => s + x.stats.delivered, 0)
        const opens = group.reduce((s, x) => s + x.stats.opens, 0)
        const clicks = group.reduce((s, x) => s + x.stats.clicks, 0)
        const unsub = group.reduce((s, x) => s + x.stats.unsubscribes, 0)
        return {
          ...t,
          count: group.length,
          delivered,
          opens,
          clicks,
          unsub,
          openRate: delivered ? Math.round((opens / delivered) * 1000) / 10 : null,
          clickRate: delivered ? Math.round((clicks / delivered) * 1000) / 10 : null,
          ctor: opens ? Math.round((clicks / opens) * 1000) / 10 : null,
          unsubRate: delivered ? Math.round((unsub / delivered) * 10000) / 100 : null,
        }
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))
  }, [data.types, mailings])

  const totalDelivered = rows.reduce((s, r) => s + r.delivered, 0)

  return (
    <>
      <SectionHeading
        kicker="Udsendelsestyper"
        title="Hvilke typer bliver læst"
        lead="Hver type sammenlignet på de fire mål, der betyder noget: hvor mange der åbner, hvor mange der klikker, hvor mange af dem der åbnede der klikkede, og hvad det koster i afmeldinger."
      />

      {!rows.length ? (
        <Empty>Ingen udsendelser i det valgte udsnit.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => (
            <Reveal key={r.key} delay={i * 0.06}>
              <article className="card card-hover h-full overflow-hidden p-5">
                <span className="mb-4 block h-1 w-full origin-left rounded-full" style={{ background: r.color }} />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[0.9375rem] font-semibold text-dp-navy-900" title={r.label}>
                      {r.label}
                    </h3>
                    <p className="mt-1 text-[0.75rem] leading-snug text-dp-navy-500">{r.description}</p>
                  </div>
                  <span
                    className="tnum shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold"
                    style={{ background: r.soft, color: r.color }}
                  >
                    {r.count}
                  </span>
                </div>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-serif text-[2.25rem] font-semibold leading-none tnum" style={{ color: r.color }}>
                    {r.openRate?.toLocaleString('da-DK') ?? '–'}
                  </span>
                  <span className="text-[0.875rem] font-semibold" style={{ color: r.color }}>%</span>
                  <span className="ml-1 text-[0.75rem] text-dp-navy-500">åbner</span>
                </div>
                <Band value={r.openRate ?? 0} color={r.color} track="#e7ebef" height={8} className="mt-2.5" delay={i * 0.05} />

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-dp-navy-50 pt-3.5 text-center">
                  {[
                    { k: 'Klik', v: fmtPct(r.clickRate) },
                    { k: 'Klik pr. åbning', v: fmtPct(r.ctor) },
                    { k: 'Afmeldt', v: fmtPct(r.unsubRate, 2) },
                  ].map((x) => (
                    <div key={x.k}>
                      <dd className="tnum text-[0.9375rem] font-semibold text-dp-navy-900">{x.v}</dd>
                      <dt className="mt-0.5 text-[0.625rem] leading-tight text-dp-navy-400">{x.k}</dt>
                    </div>
                  ))}
                </dl>

                <p className="mt-3 text-[0.6875rem] text-dp-navy-400">
                  {fmtNum(r.delivered)} leverede mails
                  {totalDelivered > 0 && ` · ${Math.round((r.delivered / totalDelivered) * 100)} % af al volumen`}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}

/* ── Segmenter ───────────────────────────────────────────────────────────── */

export function Segments({ data, onPick, active }: {
  data: Dashboard
  onPick: (name: string | null) => void
  active: string | null
}) {
  const [view, setView] = useState<'list' | 'segment'>('list')
  const rows = (view === 'list' ? data.segmentPerformance.byList : data.segmentPerformance.bySegment)
    .filter((r) => r.count >= 2)
    .slice(0, 24)

  return (
    <>
      <SectionHeading
        kicker="Segmenter"
        title="Hvem åbner mest"
        lead="Hver liste og hvert segment målt på de udsendelser, det faktisk har modtaget. Klik på en række for at filtrere hele dashboardet til den gruppe."
        right={
          <div className="inline-flex rounded-full border border-dp-navy-200 bg-white p-0.5">
            {([['list', 'Lister'], ['segment', 'Segmenter']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                className="relative rounded-full px-3.5 py-1 text-[0.75rem] font-semibold transition-colors"
                style={{ color: view === k ? '#fff' : '#4a5a72' }}
              >
                {view === k && (
                  <motion.span layoutId="segview-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        }
      />

      {!rows.length ? (
        <Empty>Ingen {view === 'list' ? 'lister' : 'segmenter'} med mindst to udsendelser.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-dp-navy-100 bg-dp-navy-50/60 text-left">
                  <th className="px-4 py-2.5 font-semibold text-dp-navy-600">{view === 'list' ? 'Liste' : 'Segment'}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-dp-navy-600">Udsendelser</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-dp-navy-600">Modtagere</th>
                  <th className="px-3 py-2.5 font-semibold text-dp-navy-600">Åbningsrate</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-dp-navy-600">Klik</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-dp-navy-600">Afmeldt</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <SegmentRowView
                    key={r.name}
                    row={r}
                    index={i}
                    max={Math.max(...rows.map((x) => x.openRate ?? 0), 1)}
                    active={active === r.name}
                    onPick={onPick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function SegmentRowView({ row, index, max, active, onPick }: {
  row: SegmentRow; index: number; max: number; active: boolean; onPick: (n: string | null) => void
}) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: Math.min(0.3, index * 0.03) }}
      className={`border-b border-dp-navy-50 transition-colors last:border-0 ${active ? 'bg-dp-blaa-15' : 'hover:bg-dp-navy-50/60'}`}
    >
      <td className="max-w-[20rem] px-4 py-2.5">
        <div className="truncate font-medium text-dp-navy-900" title={row.name}>{row.name}</div>
        {row.contacts !== undefined && (
          <div className="text-[0.6875rem] text-dp-navy-400">
            {fmtNum(row.contacts)} kontakter på listen
            {row.bouncedContacts ? ` · ${fmtNum(row.bouncedContacts)} bouncer` : ''}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 tnum text-right text-dp-navy-700">{fmtNum(row.count)}</td>
      <td className="px-3 py-2.5 tnum text-right text-dp-navy-700">{fmtNum(row.delivered)}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-dp-navy-100">
            <motion.div
              className="h-full rounded-full bg-dp-gul"
              initial={{ width: 0 }}
              whileInView={{ width: `${((row.openRate ?? 0) / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: mo.ease, delay: index * 0.03 }}
            />
          </div>
          <span className="tnum w-12 text-right font-semibold text-dp-navy-900">{fmtPct(row.openRate)}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 tnum text-right text-dp-navy-700">{fmtPct(row.clickRate)}</td>
      <td className="px-3 py-2.5 tnum text-right" style={{ color: (row.unsubRate ?? 0) > 0.5 ? '#d24e46' : '#7a8798' }}>
        {fmtPct(row.unsubRate, 2)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={() => onPick(active ? null : row.name)}
          className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition"
          style={{
            borderColor: active ? '#df790d' : '#e2e6ea',
            color: active ? '#df790d' : '#4a5a72',
          }}
        >
          {active ? 'Ryd filter' : 'Vis kun disse'}
        </button>
      </td>
    </motion.tr>
  )
}

/* ── Delt tom-tilstand ───────────────────────────────────────────────────── */

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-dp-navy-200 bg-dp-navy-50/50 p-10 text-center">
      <p className="text-[0.875rem] text-dp-navy-500">{children}</p>
    </div>
  )
}

/* ── Genbrugt af flere sektioner ─────────────────────────────────────────── */

export function ComparisonCard({
  title, subtitle, rows, valueLabel = 'Åbningsrate', minNote,
}: {
  title: string
  subtitle?: string
  rows: { label: string; value: number | null; color: string; n?: number; note?: string }[]
  valueLabel?: string
  minNote?: string
}) {
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <DataTable
          columns={[
            { key: 'l', label: 'Gruppe' },
            { key: 'n', label: 'Grundlag', align: 'right' },
            { key: 'v', label: valueLabel, align: 'right' },
          ]}
          rows={rows.map((r) => ({ l: r.label, n: r.n !== undefined ? fmtNum(r.n) : '–', v: fmtPct(r.value) }))}
        />
      }
    >
      {rows.length ? <BarRows rows={rows} /> : <Empty>For lidt data til en sammenligning.</Empty>}
      {minNote && <p className="mt-4 text-[0.6875rem] text-dp-navy-400">{minNote}</p>}
    </ChartCard>
  )
}
