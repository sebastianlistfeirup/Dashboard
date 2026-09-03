/**
 * Sammenligninger — to perioder, eller to udsendelser side om side.
 *
 * Almost every question about a change is really a comparison, and the usual
 * way to answer it is to export two things into a spreadsheet. This does it in
 * place: pick two windows or two mails, and every measure lines up on the same
 * row with the difference already taken.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChartCard, SectionHeading } from '@/components/primitives'
import { fmtDec, fmtNum, fmtPct } from '@/components/charts'
import type { Dashboard, Mailing, PoolStats } from '@/lib/data'
import { formatDate, poolOf } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

/* ── Fælles ──────────────────────────────────────────────────────────────── */

const METRICS: { key: keyof PoolStats; label: string; kind: 'pct' | 'num'; lowerIsBetter?: boolean }[] = [
  { key: 'count', label: 'Udsendelser', kind: 'num' },
  { key: 'delivered', label: 'Leverede mails', kind: 'num' },
  { key: 'openRate', label: 'Åbningsrate', kind: 'pct' },
  { key: 'clickRate', label: 'Klikrate', kind: 'pct' },
  { key: 'ctor', label: 'Klik pr. åbning', kind: 'pct' },
  { key: 'unsubRate', label: 'Afmeldinger', kind: 'pct', lowerIsBetter: true },
  { key: 'bounceRate', label: 'Bounce', kind: 'pct', lowerIsBetter: true },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

interface Window { from: string; to: string; label: string }

function presets(): { key: string; label: string; a: Window; b: Window }[] {
  const today = new Date()
  const mk = (from: Date, to: Date, label: string): Window => ({ from: iso(from), to: iso(to), label })
  const d30a = mk(addDays(today, -30), today, 'Seneste 30 dage')
  const d30b = mk(addDays(today, -60), addDays(today, -30), 'De 30 dage før')
  const d90a = mk(addDays(today, -90), today, 'Seneste 90 dage')
  const d90b = mk(addDays(today, -180), addDays(today, -90), 'De 90 dage før')
  const y = today.getUTCFullYear()
  const ytdA = mk(new Date(Date.UTC(y, 0, 1)), today, `${y} til nu`)
  const ytdB = mk(new Date(Date.UTC(y - 1, 0, 1)), new Date(Date.UTC(y - 1, today.getUTCMonth(), today.getUTCDate())), `${y - 1} til samme dag`)
  return [
    { key: '30', label: '30 dage', a: d30a, b: d30b },
    { key: '90', label: '90 dage', a: d90a, b: d90b },
    { key: 'ytd', label: 'År mod år', a: ytdA, b: ytdB },
  ]
}

/* ── To perioder ─────────────────────────────────────────────────────────── */

export function PeriodCompare({ mailings }: { mailings: Mailing[] }) {
  const opts = useMemo(presets, [])
  const [preset, setPreset] = useState('30')
  const [custom, setCustom] = useState<{ a: Window; b: Window } | null>(null)

  const chosen = custom ?? opts.find((o) => o.key === preset) ?? opts[0]

  const inWindow = (m: Mailing, w: Window) => {
    const when = m.when?.slice(0, 10)
    return Boolean(when && when >= w.from && when <= w.to)
  }

  const poolA = useMemo(() => poolOf(mailings.filter((m) => inWindow(m, chosen.a))), [mailings, chosen])
  const poolB = useMemo(() => poolOf(mailings.filter((m) => inWindow(m, chosen.b))), [mailings, chosen])

  const setWindow = (side: 'a' | 'b', patch: Partial<Window>) => {
    const base = custom ?? { a: chosen.a, b: chosen.b }
    setCustom({ ...base, [side]: { ...base[side], ...patch, label: 'Valgt periode' } })
  }

  return (
    <ChartCard
      title="Sammenlign to perioder"
      subtitle="Vælg et fast spring, eller sæt dine egne datoer. Alle tal er for de udsendelser, filteret ovenfor slipper igennem."
      actions={
        <div className="flex flex-wrap gap-1.5">
          {opts.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => { setPreset(o.key); setCustom(null) }}
              aria-pressed={!custom && preset === o.key}
              className={`rounded-full border px-3 py-1 text-[0.6875rem] font-semibold transition ${
                !custom && preset === o.key
                  ? 'border-dp-navy-600 bg-dp-navy-600 text-white'
                  : 'border-dp-navy-100 text-dp-navy-600 hover:border-dp-navy-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <WindowPicker side="a" window={chosen.a} colour="#df790d" onChange={(p) => setWindow('a', p)} pool={poolA} />
        <WindowPicker side="b" window={chosen.b} colour="#8299bb" onChange={(p) => setWindow('b', p)} pool={poolB} />
      </div>

      <DiffTable a={poolA} b={poolB} labelA={chosen.a.label} labelB={chosen.b.label} />

      {poolA.count === 0 && poolB.count === 0 && (
        <p className="mt-4 rounded-xl bg-dp-gul-15 px-4 py-3 text-[0.8125rem] text-dp-navy-700">
          Ingen udsendelser i nogen af perioderne. Prøv et bredere spring, eller ryd filtrene øverst.
        </p>
      )}
    </ChartCard>
  )
}

function WindowPicker({
  side, window: w, colour, onChange, pool,
}: {
  side: 'a' | 'b'; window: Window; colour: string; onChange: (p: Partial<Window>) => void; pool: PoolStats
}) {
  return (
    <div className="rounded-2xl border border-dp-navy-100 p-4" style={{ borderTopColor: colour, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.14em]" style={{ color: colour }}>
          {side === 'a' ? 'Periode A' : 'Periode B'}
        </span>
        <span className="tnum text-[0.75rem] text-dp-navy-500">{fmtNum(pool.count)} udsendelser</span>
      </div>
      <p className="mt-1 text-[0.9375rem] font-semibold text-dp-navy-900">{w.label}</p>
      <div className="mt-3 flex items-center gap-2">
        <input type="date" value={w.from} onChange={(e) => onChange({ from: e.target.value })}
               className="tnum w-full rounded-lg border border-dp-navy-100 px-2 py-1.5 text-[0.75rem] focus:border-dp-orange focus:outline-none"
               aria-label={`Fra-dato for periode ${side.toUpperCase()}`} />
        <span className="text-dp-navy-300">–</span>
        <input type="date" value={w.to} onChange={(e) => onChange({ to: e.target.value })}
               className="tnum w-full rounded-lg border border-dp-navy-100 px-2 py-1.5 text-[0.75rem] focus:border-dp-orange focus:outline-none"
               aria-label={`Til-dato for periode ${side.toUpperCase()}`} />
      </div>
    </div>
  )
}

function DiffTable({ a, b, labelA, labelB }: { a: PoolStats; b: PoolStats; labelA: string; labelB: string }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[0.875rem]">
        <thead>
          <tr className="border-b border-dp-navy-100 text-[0.6875rem] uppercase tracking-wider text-dp-navy-400">
            <th className="py-2 pr-3 text-left font-bold">Måletal</th>
            <th className="py-2 pr-3 text-right font-bold" style={{ color: '#df790d' }}>{labelA}</th>
            <th className="py-2 pr-3 text-right font-bold">{labelB}</th>
            <th className="py-2 text-right font-bold">Forskel</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m, i) => {
            const va = a[m.key] as number | null
            const vb = b[m.key] as number | null
            const diff = va !== null && vb !== null ? va - vb : null
            const good = diff === null || diff === 0 ? null : m.lowerIsBetter ? diff < 0 : diff > 0
            const fmt = m.kind === 'pct' ? fmtPct : fmtNum
            const relative = m.kind === 'num' && vb ? ((va ?? 0) - vb) / vb * 100 : null
            return (
              <motion.tr
                key={m.key as string}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="border-b border-dp-navy-50 last:border-0"
              >
                <td className="py-2.5 pr-3 text-dp-navy-700">{m.label}</td>
                <td className="tnum py-2.5 pr-3 text-right font-semibold text-dp-navy-900">{fmt(va)}</td>
                <td className="tnum py-2.5 pr-3 text-right text-dp-navy-600">{fmt(vb)}</td>
                <td className="tnum py-2.5 text-right font-semibold"
                    style={{ color: good === null ? '#8299bb' : good ? '#179fa0' : '#d24e46' }}>
                  {diff === null ? '–' : (
                    <>
                      {diff > 0 ? '+' : diff < 0 ? '−' : ''}
                      {m.kind === 'pct' ? fmtDec(Math.abs(diff)) : fmtNum(Math.abs(diff))}
                      {relative !== null && Math.abs(relative) >= 1 && (
                        <span className="ml-1 text-[0.6875rem] font-normal opacity-70">
                          ({relative > 0 ? '+' : '−'}{Math.round(Math.abs(relative))} %)
                        </span>
                      )}
                    </>
                  )}
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── To udsendelser ──────────────────────────────────────────────────────── */

export function MailingDiff({ data, mailings }: { data: Dashboard; mailings: Mailing[] }) {
  const sent = useMemo(
    () => mailings.filter((m) => m.stats.delivered > 0).sort((x, y) => (y.when ?? '').localeCompare(x.when ?? '')),
    [mailings],
  )
  const [idA, setIdA] = useState<string>('')
  const [idB, setIdB] = useState<string>('')

  const a = sent.find((m) => m.id === idA) ?? sent[0] ?? null
  const b = sent.find((m) => m.id === idB) ?? sent[1] ?? null
  if (!a || !b) return null

  const typeOf = (m: Mailing) => data.types.find((t) => t.key === m.type)

  const rows: { label: string; a: string; b: string; better?: 'a' | 'b' | null }[] = [
    { label: 'Sendt', a: formatDate(a.when), b: formatDate(b.when) },
    { label: 'Type', a: typeOf(a)?.label ?? '–', b: typeOf(b)?.label ?? '–' },
    { label: 'Afsender', a: a.from.name ?? '–', b: b.from.name ?? '–' },
    { label: 'Modtagere', a: fmtNum(a.stats.recipients), b: fmtNum(b.stats.recipients) },
    { label: 'Leveret', a: fmtNum(a.stats.delivered), b: fmtNum(b.stats.delivered) },
    { label: 'Åbningsrate', a: fmtPct(a.stats.openRate), b: fmtPct(b.stats.openRate), better: pick(a.stats.openRate, b.stats.openRate) },
    { label: 'Klikrate', a: fmtPct(a.stats.clickRate), b: fmtPct(b.stats.clickRate), better: pick(a.stats.clickRate, b.stats.clickRate) },
    { label: 'Klik pr. åbning', a: fmtPct(a.stats.ctor), b: fmtPct(b.stats.ctor), better: pick(a.stats.ctor, b.stats.ctor) },
    { label: 'Afmeldinger', a: fmtNum(a.stats.unsubscribes), b: fmtNum(b.stats.unsubscribes), better: pick(b.stats.unsubRate, a.stats.unsubRate) },
    { label: 'Emnelinjens længde', a: `${a.subjectAnalysis.length} tegn`, b: `${b.subjectAnalysis.length} tegn` },
    { label: 'Links i mailen', a: fmtNum(a.content.links), b: fmtNum(b.content.links) },
    { label: 'Billeder', a: fmtNum(a.content.images), b: fmtNum(b.content.images) },
    { label: 'Længde', a: `${fmtNum(a.content.words)} ord`, b: `${fmtNum(b.content.words)} ord` },
    { label: 'Sendt kl.', a: a.local ? `${String(a.local.hour).padStart(2, '0')}.${String(a.local.minute).padStart(2, '0')}` : '–', b: b.local ? `${String(b.local.hour).padStart(2, '0')}.${String(b.local.minute).padStart(2, '0')}` : '–' },
  ]

  return (
    <ChartCard
      title="Sammenlign to udsendelser"
      subtitle="Vælg to mails og se hver forskel på samme række — også dem i indholdet, ikke kun i tallene."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <MailingPicker label="Udsendelse A" colour="#df790d" value={a.id} options={sent} onChange={setIdA} />
        <MailingPicker label="Udsendelse B" colour="#4c7bbd" value={b.id} options={sent} onChange={setIdB} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SubjectCard m={a} colour="#df790d" />
        <SubjectCard m={b} colour="#4c7bbd" />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-[0.875rem]">
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.tr
                  key={r.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.03, ease: mo.ease }}
                  className="border-b border-dp-navy-50 last:border-0"
                >
                  <td className="w-[38%] py-2.5 pr-3 text-[0.8125rem] text-dp-navy-500">{r.label}</td>
                  <td className={`tnum py-2.5 pr-3 text-right ${r.better === 'a' ? 'font-bold text-dp-navy-900' : 'text-dp-navy-700'}`}>
                    {r.better === 'a' && <span className="mr-1.5 text-dp-gron">▲</span>}
                    {r.a}
                  </td>
                  <td className={`tnum py-2.5 text-right ${r.better === 'b' ? 'font-bold text-dp-navy-900' : 'text-dp-navy-700'}`}>
                    {r.better === 'b' && <span className="mr-1.5 text-dp-gron">▲</span>}
                    {r.b}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}

const pick = (x: number | null, y: number | null): 'a' | 'b' | null => {
  if (x === null || y === null || x === y) return null
  return x > y ? 'a' : 'b'
}

function MailingPicker({
  label, colour, value, options, onChange,
}: {
  label: string; colour: string; value: string; options: Mailing[]; onChange: (id: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[0.6875rem] font-bold uppercase tracking-[0.14em]" style={{ color: colour }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full truncate rounded-xl border border-dp-navy-100 bg-white px-3 py-2 text-[0.8125rem] text-dp-navy-900 focus:border-dp-orange focus:outline-none"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {formatDate(m.when)} — {m.subject.slice(0, 70)}
          </option>
        ))}
      </select>
    </label>
  )
}

function SubjectCard({ m, colour }: { m: Mailing; colour: string }) {
  return (
    <div className="rounded-2xl border border-dp-navy-100 p-4" style={{ borderTopColor: colour, borderTopWidth: 3 }}>
      <p className="font-serif text-[0.9375rem] font-semibold leading-snug text-dp-navy-900">{m.subject}</p>
      <p className="tnum mt-2 text-[0.75rem] text-dp-navy-500">
        {fmtPct(m.stats.openRate)} åbning · {fmtPct(m.stats.clickRate)} klik · {fmtNum(m.stats.delivered)} leveret
      </p>
    </div>
  )
}

/* ── Sektionsramme ───────────────────────────────────────────────────────── */

export function Comparisons({ data, mailings }: { data: Dashboard; mailings: Mailing[] }) {
  const [tab, setTab] = useState<'perioder' | 'udsendelser'>('perioder')
  return (
    <>
      <SectionHeading
        kicker="Sammenlign"
        title="Hvad har flyttet sig?"
        lead="To perioder holdt op mod hinanden, eller to udsendelser sat side om side — helt ned til emnelinje, længde og afsendetidspunkt."
        right={
          <div className="flex rounded-full border border-dp-navy-100 p-0.5">
            {(['perioder', 'udsendelser'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className="relative rounded-full px-4 py-1.5 text-[0.75rem] font-semibold transition-colors"
                style={{ color: tab === t ? '#fff' : '#4a5a72' }}
              >
                {tab === t && (
                  <motion.span
                    layoutId="compare-tab"
                    className="absolute inset-0 rounded-full bg-dp-navy-600"
                    transition={{ duration: 0.3, ease: mo.ease }}
                  />
                )}
                <span className="relative">{t === 'perioder' ? 'To perioder' : 'To udsendelser'}</span>
              </button>
            ))}
          </div>
        }
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: mo.ease }}
        >
          {tab === 'perioder'
            ? <PeriodCompare mailings={mailings} />
            : <MailingDiff data={data} mailings={mailings} />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}
