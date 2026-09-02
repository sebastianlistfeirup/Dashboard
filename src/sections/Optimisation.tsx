/**
 * Udsendelsestidspunkter, emnelinjer og indhold.
 *
 * Three questions with the same shape: does this choice change whether people
 * open and click? Each comparison shows how many sendouts sit behind it, and
 * anything below the threshold is drawn but marked as too thin to lean on.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarRows, DataTable, GroupedBars, HeatMap, fmtNum, fmtPct } from '@/components/charts'
import { ChartCard, Reveal, SectionHeading } from '@/components/primitives'
import { formatDate, type Dashboard, type SlimMailing } from '@/lib/data'
import { motion as mo } from '@/design/tokens'
import { Empty } from './Performance'

/* ── Tidspunkter ─────────────────────────────────────────────────────────── */

export function Timing({ data }: { data: Dashboard }) {
  const [metric, setMetric] = useState<'openRate' | 'clickRate'>('openRate')
  const { timing } = data
  const hours = [...new Set(timing.heat.map((c) => c.hour))].sort((a, b) => a - b)
  const hourRange = hours.length
    ? Array.from({ length: hours[hours.length - 1] - hours[0] + 1 }, (_, i) => hours[0] + i)
    : []

  const reliableDays = timing.byWeekday.filter((d) => d.count >= timing.minSendouts)
  const bestDay = [...reliableDays].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))[0]

  return (
    <>
      <SectionHeading
        kicker="Udsendelsestidspunkter"
        title="Hvornår rammer vi bedst"
        lead={bestDay
          ? `${bestDay.label} giver den højeste ${metric === 'openRate' ? 'åbningsrate' : 'klikrate'} på tværs af ${fmtNum(bestDay.count)} udsendelser. Feltet nedenfor viser hver kombination af ugedag og klokkeslæt.`
          : 'Feltet viser hver kombination af ugedag og klokkeslæt, DP har sendt på.'}
        right={
          <div className="inline-flex rounded-full border border-dp-navy-200 bg-white p-0.5">
            {([['openRate', 'Åbninger'], ['clickRate', 'Klik']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                className="relative rounded-full px-3.5 py-1 text-[0.75rem] font-semibold transition-colors"
                style={{ color: metric === k ? '#fff' : '#4a5a72' }}
              >
                {metric === k && (
                  <motion.span layoutId="timing-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <ChartCard
          title="Ugedag × klokkeslæt"
          subtitle="Mørkere felt = højere rate. Hold musen over et felt for tallene bag."
          table={
            <DataTable
              columns={[
                { key: 'd', label: 'Ugedag' },
                { key: 'h', label: 'Kl.', align: 'right' },
                { key: 'n', label: 'Udsendelser', align: 'right' },
                { key: 'o', label: 'Åbningsrate', align: 'right' },
                { key: 'c', label: 'Klikrate', align: 'right' },
              ]}
              rows={[...timing.heat]
                .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
                .map((c) => ({
                  d: timing.weekdayLabels[c.weekday],
                  h: String(c.hour).padStart(2, '0'),
                  n: fmtNum(c.count),
                  o: fmtPct(c.openRate),
                  c: fmtPct(c.clickRate),
                }))}
            />
          }
        >
          {timing.heat.length ? (
            <HeatMap
              cells={timing.heat}
              weekdayLabels={timing.weekdayLabels}
              hours={hourRange}
              valueKey={metric}
            />
          ) : <Empty>Ingen tidspunkter at vise.</Empty>}
        </ChartCard>

        <div className="grid gap-5">
          <ChartCard
            title="Ugedag"
            subtitle={`Kun dage med mindst ${timing.minSendouts} udsendelser er sammenlignelige.`}
          >
            <BarRows
              rows={timing.byWeekday.map((d) => ({
                label: d.label,
                value: d[metric],
                color: d.count >= timing.minSendouts ? '#4c7bbd' : '#c1cde9',
                n: d.count,
                note: d.count < timing.minSendouts ? 'For få udsendelser til at sammenligne' : undefined,
              }))}
            />
          </ChartCard>

          <ChartCard title="Tidspunkt på dagen" subtitle="Samme forbehold gælder her.">
            <BarRows
              rows={data.timing.hourBands.map((b) => ({
                label: b.label,
                value: b[metric],
                color: b.count >= timing.minSendouts ? '#df790d' : '#f6d3b1',
                n: b.count,
              }))}
            />
          </ChartCard>
        </div>
      </div>
    </>
  )
}

/* ── Emnelinjer ──────────────────────────────────────────────────────────── */

export function Subjects({ data }: { data: Dashboard }) {
  const { subjects } = data
  const reliable = subjects.flags.filter((f) => f.reliable)

  return (
    <>
      <SectionHeading
        kicker="Emnelinjer"
        title="Hvad der får folk til at åbne"
        lead="Hvert træk sammenlignet med de udsendelser, der ikke har det. Forskellen er ikke et bevis for årsag — men den siger, hvor det er værd at eksperimentere."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Længde"
          subtitle="Åbningsrate efter emnelinjens længde i tegn."
          table={
            <DataTable
              columns={[
                { key: 'l', label: 'Længde' },
                { key: 'n', label: 'Udsendelser', align: 'right' },
                { key: 'o', label: 'Åbningsrate', align: 'right' },
                { key: 'c', label: 'Klikrate', align: 'right' },
              ]}
              rows={subjects.byLength.map((b) => ({
                l: b.label, n: fmtNum(b.count), o: fmtPct(b.openRate), c: fmtPct(b.clickRate),
              }))}
            />
          }
        >
          <BarRows
            rows={subjects.byLength.map((b) => ({
              label: b.label,
              value: b.openRate,
              color: b.count >= subjects.minSendouts ? '#eab922' : '#f8eabd',
              n: b.count,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Virkemidler"
          subtitle={`Åbningsrate med og uden hvert træk. Kun træk med mindst ${subjects.minSendouts} udsendelser på hver side.`}
          legend={[{ label: 'Med', color: '#4e4897' }, { label: 'Uden', color: '#bcbbde' }]}
        >
          {reliable.length ? (
            <GroupedBars
              categories={reliable.map((f) => f.label.replace(' i emnelinjen', ''))}
              series={[
                { key: 'with', label: 'Med', color: '#4e4897', values: reliable.map((f) => f.with.openRate) },
                { key: 'without', label: 'Uden', color: '#bcbbde', values: reliable.map((f) => f.without.openRate) },
              ]}
              height={252}
            />
          ) : <Empty>Ingen virkemidler har nok udsendelser på begge sider til en sammenligning.</Empty>}

          {reliable.length > 0 && (
            <ul className="mt-5 space-y-1.5 border-t border-dp-navy-50 pt-4">
              {[...reliable]
                .sort((a, b) => Math.abs(b.openDelta ?? 0) - Math.abs(a.openDelta ?? 0))
                .slice(0, 4)
                .map((f) => (
                  <li key={f.label} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="min-w-0 truncate text-dp-navy-700">{f.label}</span>
                    <span
                      className="tnum shrink-0 font-semibold"
                      style={{ color: (f.openDelta ?? 0) >= 0 ? '#179fa0' : '#d24e46' }}
                    >
                      {(f.openDelta ?? 0) >= 0 ? '+' : '−'}{Math.abs(f.openDelta ?? 0).toLocaleString('da-DK')} pct.point
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TopSubjects title="Bedst åbnede emnelinjer" items={subjects.best} data={data} accent="#179fa0" />
        <TopSubjects title="Dårligst åbnede emnelinjer" items={subjects.worst} data={data} accent="#d24e46" />
      </div>

      {subjects.words.best.length > 0 && (
        <Reveal delay={0.1}>
          <div className="card mt-5 p-5 sm:p-6">
            <h3 className="text-[1.0625rem] font-semibold text-dp-navy-900">Ord der går igen</h3>
            <p className="mt-1 text-[0.8125rem] text-dp-navy-500">
              Ord brugt i mindst {subjects.minSendouts} emnelinjer, rangeret efter åbningsraten på de
              udsendelser, der bruger dem. Almindelige småord er sorteret fra.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {subjects.words.best.map((w) => {
                const scale = Math.min(1, (w.openRate ?? 0) / Math.max(1, subjects.words.best[0].openRate ?? 1))
                return (
                  <motion.span
                    key={w.word}
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, ease: mo.ease }}
                    className="inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5"
                    style={{
                      background: `rgba(78,72,151,${0.07 + scale * 0.16})`,
                      color: '#4e4897',
                      fontSize: `${0.78 + scale * 0.2}rem`,
                    }}
                    title={`${w.count} udsendelser`}
                  >
                    <span className="font-semibold">{w.word}</span>
                    <span className="tnum text-[0.6875rem] opacity-70">{fmtPct(w.openRate, 0)}</span>
                  </motion.span>
                )
              })}
            </div>
          </div>
        </Reveal>
      )}
    </>
  )
}

function TopSubjects({ title, items, data, accent }: {
  title: string; items: SlimMailing[]; data: Dashboard; accent: string
}) {
  const typeOf = new Map(data.types.map((t) => [t.key, t]))
  return (
    <ChartCard title={title} subtitle="Kun udsendelser til mindst 300 modtagere.">
      {items.length ? (
        <ol className="space-y-3">
          {items.map((m, i) => {
            const t = typeOf.get(m.type)
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, ease: mo.ease, delay: i * 0.05 }}
                className="flex items-start gap-3"
              >
                <span
                  className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold"
                  style={{ background: `${accent}1a`, color: accent }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-dp-navy-900" title={m.subject}>
                    {m.subject}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-dp-navy-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t?.color ?? '#8299bb' }} />
                      {t?.short ?? 'Øvrige'}
                    </span>
                    <span>·</span>
                    <span>{formatDate(m.when)}</span>
                    <span>·</span>
                    <span>{fmtNum(m.delivered)} modtagere</span>
                  </p>
                </div>
                <span className="tnum shrink-0 text-[0.875rem] font-semibold" style={{ color: accent }}>
                  {fmtPct(m.openRate)}
                </span>
              </motion.li>
            )
          })}
        </ol>
      ) : <Empty>Ingen udsendelser opfylder kravet.</Empty>}
    </ChartCard>
  )
}

/* ── Indhold ─────────────────────────────────────────────────────────────── */

export function Content({ data }: { data: Dashboard }) {
  const { content } = data
  return (
    <>
      <SectionHeading
        kicker="Indhold"
        title="Hvad der bliver klikket på"
        lead="Længde, antal links og billeder holdt op mod klikraten — og hvilke destinationer DP faktisk sender folk hen til."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="Antal links" subtitle="Klikrate efter hvor mange unikke links mailen indeholder.">
          <BarRows
            rows={content.byLinks.map((b) => ({
              label: b.label,
              value: b.clickRate,
              color: b.count >= content.minSendouts ? '#4fa388' : '#cfe6dd',
              n: b.count,
            }))}
          />
        </ChartCard>

        <ChartCard title="Længde" subtitle="Klik pr. åbning efter mailens ordantal.">
          <BarRows
            rows={content.byWords.map((b) => ({
              label: b.label,
              value: b.ctor,
              color: b.count >= content.minSendouts ? '#4c7bbd' : '#c1cde9',
              n: b.count,
            }))}
          />
        </ChartCard>

        <ChartCard title="Billeder" subtitle="Klikrate efter antal billeder.">
          <BarRows
            rows={content.byImages.map((b) => ({
              label: b.label,
              value: b.clickRate,
              color: b.count >= content.minSendouts ? '#df790d' : '#f6d3b1',
              n: b.count,
            }))}
          />
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Hvor linker vi hen"
          subtitle="Antal links pr. destination, og klikraten på de udsendelser der bruger dem."
          table={
            <DataTable
              columns={[
                { key: 'h', label: 'Domæne' },
                { key: 'l', label: 'Links', align: 'right' },
                { key: 'm', label: 'Udsendelser', align: 'right' },
                { key: 'c', label: 'Klikrate', align: 'right' },
              ]}
              rows={content.topHosts.map((h) => ({
                h: h.host, l: fmtNum(h.links), m: fmtNum(h.mailings), c: fmtPct(h.clickRate),
              }))}
            />
          }
        >
          {content.topHosts.length ? (
            <BarRows
              rows={content.topHosts.slice(0, 10).map((h) => ({
                label: h.host,
                value: h.links,
                color: '#4e4897',
                n: h.mailings,
                note: `Klikrate på disse udsendelser: ${fmtPct(h.clickRate)}`,
              }))}
              valueFormat={(n) => `${fmtNum(n)} links`}
            />
          ) : <Empty>Ingen links registreret.</Empty>}
        </ChartCard>

        <ChartCard
          title="Sider der trækker klik"
          subtitle="Destinationer brugt i mindst to udsendelser, sorteret efter klikraten på dem."
        >
          {content.topDestinations.length ? (
            <ol className="space-y-2.5">
              {content.topDestinations.slice(0, 10).map((d, i) => (
                <motion.li
                  key={d.path}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.32, ease: mo.ease, delay: i * 0.04 }}
                  className="flex items-baseline justify-between gap-3 border-b border-dp-navy-50 pb-2.5 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-dp-navy-800" title={d.path}>
                    {d.path}
                  </span>
                  <span className="shrink-0 text-[0.6875rem] text-dp-navy-400">{d.mailings} udsendelser</span>
                  <span className="tnum w-14 shrink-0 text-right text-[0.8125rem] font-semibold text-dp-gron">
                    {fmtPct(d.clickRate)}
                  </span>
                </motion.li>
              ))}
            </ol>
          ) : <Empty>Ingen destinationer bruges i flere udsendelser.</Empty>}
        </ChartCard>
      </div>

      <p className="mt-4 max-w-3xl text-[0.6875rem] leading-relaxed text-dp-navy-400">
        Klikraten er målt på hele udsendelsen, ikke på det enkelte link — Ungapped-API'et
        rapporterer ikke klik pr. link. En destination med høj rate optræder altså i udsendelser,
        der klarede sig godt; det er ikke et bevis for, at netop det link blev klikket.
      </p>
    </>
  )
}
