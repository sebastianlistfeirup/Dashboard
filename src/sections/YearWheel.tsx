/**
 * Årshjulet — hele årets udsendelser i én figur.
 *
 * Time is a circle in an annual organisation: the same months come back, and
 * the question is always "hvad plejer der at ske her?". A calendar grid answers
 * that badly — twelve rows you have to read in sequence. A wheel answers it at
 * a glance: the busy stretches are dense, the quiet ones are empty, and a
 * whole year can be laid on top of another to see whether anything moved.
 *
 * Angle is the date. Radius is the open rate. Colour is the type. Size is the
 * number of recipients.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { ChartCard } from '@/components/primitives'
import { fmtNum, fmtPct } from '@/components/charts'
import type { Dashboard, Mailing } from '@/lib/data'
import { formatDate } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

const MONTHS = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December']
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']

const SIZE = 640
const C = SIZE / 2
const R_OUT = 268 // yderste datering
const R_MAX = 250 // 100 % åbning
const R_MIN = 96 // 0 % åbning
const R_HUB = 84

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** Vinkel i radianer, med januar øverst og året med uret. */
function angleOf(year: number, month: number, day: number) {
  const frac = (month + (day - 1) / daysInMonth(year, month)) / 12
  return frac * Math.PI * 2 - Math.PI / 2
}

const polar = (angle: number, radius: number) => ({
  x: C + Math.cos(angle) * radius,
  y: C + Math.sin(angle) * radius,
})

function wedgePath(a0: number, a1: number, r0: number, r1: number) {
  const p1 = polar(a0, r1)
  const p2 = polar(a1, r1)
  const p3 = polar(a1, r0)
  const p4 = polar(a0, r0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${r1} ${r1} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r0} ${r0} 0 ${large} 0 ${p4.x} ${p4.y} Z`
}

interface Dot {
  m: Mailing
  angle: number
  radius: number
  size: number
  colour: string
  month: number
  key: string
}

export function YearWheel({ data, mailings }: { data: Dashboard; mailings: Mailing[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.25 })
  const reduced = useReducedMotion()

  const typeColour = useMemo(() => {
    const map = new Map<string, { colour: string; label: string }>()
    for (const t of data.types) map.set(t.key, { colour: t.color, label: t.short || t.label })
    return map
  }, [data.types])

  const dated = useMemo(
    () => mailings.filter((m) => m.local && m.stats.delivered > 0 && m.stats.openRate !== null),
    [mailings],
  )

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const m of dated) set.add(m.local!.year)
    return [...set].sort((a, b) => b - a)
  }, [dated])

  const [year, setYear] = useState<number | null>(null)
  const activeYear = year ?? years[0] ?? new Date().getUTCFullYear()
  const [ghostYear, setGhostYear] = useState<number | null>(null)
  const [hover, setHover] = useState<Dot | null>(null)
  const [month, setMonth] = useState<number | null>(null)

  const dotsFor = useMemo(() => {
    const build = (y: number): Dot[] =>
      dated
        .filter((m) => m.local!.year === y)
        .map((m) => {
          const l = m.local!
          const rate = Math.max(0, Math.min(100, m.stats.openRate ?? 0))
          const t = typeColour.get(m.type)
          return {
            m,
            angle: angleOf(y, l.month - 1, l.day),
            radius: rate,   // omregnes til radius når domænet kendes
            size: Math.max(3.4, Math.min(11, Math.sqrt(m.stats.delivered) / 26)),
            colour: t?.colour ?? '#8299bb',
            month: l.month - 1,
            key: m.id,
          }
        })
        .sort((a, b) => a.angle - b.angle)
    return build
  }, [dated, typeColour])

  /**
   * Skalaen følger tallene, ikke 0–100. DP's åbningsrater ligger mellem ca. 30
   * og 85 %, og med en fast akse ville alle punkter klumpe sig i midten af
   * hjulet. Domænet rundes til nærmeste ti, så ringene stadig har pæne tal.
   */
  const domain = useMemo(() => {
    const rates = dated
      .filter((m) => m.local!.year === activeYear || m.local!.year === ghostYear)
      .map((m) => m.stats.openRate!)
      .sort((a, b) => a - b)
    if (rates.length < 4) return { lo: 0, hi: 100 }
    // 5.- og 95.-percentilen, ikke yderpunkterne: en enkelt velkomstmail på 96 %
    // ville ellers presse alt andet ind mod midten. De få udenfor lægger sig på
    // yderste eller inderste ring, hvor de stadig kan ses og peges på.
    const at = (q: number) => rates[Math.min(rates.length - 1, Math.max(0, Math.round(q * (rates.length - 1))))]
    const lo = Math.max(0, Math.floor((at(0.05) - 2) / 10) * 10)
    const hi = Math.min(100, Math.ceil((at(0.95) + 2) / 10) * 10)
    return hi - lo < 20 ? { lo: Math.max(0, hi - 20), hi } : { lo, hi }
  }, [dated, activeYear, ghostYear])

  const radiusFor = useCallback(
    (rate: number) => {
      const t = (Math.max(domain.lo, Math.min(domain.hi, rate)) - domain.lo) / (domain.hi - domain.lo || 1)
      return R_MIN + t * (R_MAX - R_MIN)
    },
    [domain],
  )

  const rings = useMemo(() => {
    const span = domain.hi - domain.lo
    const step = span <= 25 ? 5 : span <= 60 ? 10 : 20
    const out: number[] = []
    for (let v = Math.ceil(domain.lo / step) * step; v <= domain.hi; v += step) out.push(v)
    return out
  }, [domain])

  const dots = useMemo(
    () => dotsFor(activeYear).map((d) => ({ ...d, radius: radiusFor(d.radius) })),
    [dotsFor, activeYear, radiusFor],
  )
  const ghostDots = useMemo(
    () => (ghostYear ? dotsFor(ghostYear).map((d) => ({ ...d, radius: radiusFor(d.radius) })) : []),
    [dotsFor, ghostYear, radiusFor],
  )

  /** Månedsgennemsnit som en blød kurve — årets rytme uden støjen. */
  const monthly = useMemo(() => {
    const rows = MONTHS.map((_, i) => ({ month: i, delivered: 0, opens: 0, clicks: 0, count: 0 }))
    for (const d of dots) {
      const r = rows[d.month]
      r.delivered += d.m.stats.delivered
      r.opens += d.m.stats.opens
      r.clicks += d.m.stats.clicks
      r.count += 1
    }
    return rows.map((r) => ({
      ...r,
      openRate: r.delivered > 0 ? (r.opens / r.delivered) * 100 : null,
      clickRate: r.delivered > 0 ? (r.clicks / r.delivered) * 100 : null,
    }))
  }, [dots])

  const ribbon = useMemo(() => {
    const pts = monthly
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.openRate !== null)
    if (pts.length < 3) return null
    const coords = pts.map(({ r, i }) => {
      const a = angleOf(activeYear, i, Math.round(daysInMonth(activeYear, i) / 2))
      return polar(a, radiusFor(r.openRate!))
    })
    // Lukket Catmull-Rom, så årsskiftet ikke får et knæk.
    const n = coords.length
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
    for (let i = 0; i < n; i++) {
      const p0 = coords[(i - 1 + n) % n]
      const p1 = coords[i]
      const p2 = coords[(i + 1) % n]
      const p3 = coords[(i + 2) % n]
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
      d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d + ' Z'
  }, [monthly, activeYear, radiusFor])

  const maxMonthVolume = Math.max(1, ...monthly.map((r) => r.delivered))
  const yearPool = useMemo(() => {
    const t = dots.reduce(
      (acc, d) => ({
        delivered: acc.delivered + d.m.stats.delivered,
        opens: acc.opens + d.m.stats.opens,
        clicks: acc.clicks + d.m.stats.clicks,
      }),
      { delivered: 0, opens: 0, clicks: 0 },
    )
    return {
      count: dots.length,
      ...t,
      openRate: t.delivered ? (t.opens / t.delivered) * 100 : null,
      clickRate: t.delivered ? (t.clicks / t.delivered) * 100 : null,
    }
  }, [dots])

  const legend = useMemo(() => {
    const used = new Set(dots.map((d) => d.m.type))
    return data.types.filter((t) => used.has(t.key)).map((t) => ({ label: t.short || t.label, color: t.color }))
  }, [dots, data.types])

  if (years.length === 0) return null

  const focusMonth = hover ? hover.month : month
  const monthRow = focusMonth !== null ? monthly[focusMonth] : null

  return (
    <div ref={ref}>
      <ChartCard
        title="Årshjul"
        subtitle="Hvert punkt er en udsendelse. Vinklen er datoen, afstanden fra midten er åbningsraten, størrelsen er antal modtagere."
        moduleId="aarshjul"
        legend={legend}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { setYear(y); setGhostYear(null); setMonth(null) }}
                aria-pressed={y === activeYear}
                className={`tnum rounded-full border px-3 py-1 text-[0.6875rem] font-semibold transition ${
                  y === activeYear
                    ? 'border-dp-navy-600 bg-dp-navy-600 text-white'
                    : 'border-dp-navy-100 text-dp-navy-600 hover:border-dp-navy-300'
                }`}
              >
                {y}
              </button>
            ))}
            {years.length > 1 && (
              <select
                value={ghostYear ?? ''}
                onChange={(e) => setGhostYear(e.target.value ? Number(e.target.value) : null)}
                className="rounded-full border border-dp-navy-100 bg-white px-3 py-1 text-[0.6875rem] font-semibold text-dp-navy-600 focus:border-dp-orange focus:outline-none"
                aria-label="Læg et andet år bagved"
              >
                <option value="">Læg år bagved…</option>
                {years.filter((y) => y !== activeYear).map((y) => (
                  <option key={y} value={y}>{y} som skygge</option>
                ))}
              </select>
            )}
          </div>
        }
      >
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {/* ── Hjulet ─────────────────────────────────────────────────── */}
          <div className="relative mx-auto w-full max-w-[40rem]">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img"
                 aria-label={`Årshjul for ${activeYear} med ${dots.length} udsendelser`}>
              <defs>
                <radialGradient id="wheel-hub" cx="50%" cy="42%" r="62%">
                  <stop offset="0%" stopColor="#2a4368" />
                  <stop offset="100%" stopColor="#16233a" />
                </radialGradient>
                <linearGradient id="wheel-ribbon" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#df790d" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#4c7bbd" stopOpacity="0.22" />
                </linearGradient>
                <filter id="wheel-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="7" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Månedsfelter — de skiftevis tonede kiler holder øjet på plads */}
              {MONTHS.map((_, i) => {
                const a0 = angleOf(activeYear, i, 1)
                const a1 = angleOf(activeYear, i, daysInMonth(activeYear, i) + 1)
                const active = focusMonth === i
                return (
                  <motion.path
                    key={`wedge-${i}`}
                    d={wedgePath(a0, a1, R_HUB, R_OUT)}
                    fill={active ? '#e4eaf6' : i % 2 === 0 ? '#fbfcfd' : '#ffffff'}
                    stroke="#f0f3f6"
                    strokeWidth="1"
                    className="cursor-pointer"
                    animate={{ fill: active ? '#e4eaf6' : i % 2 === 0 ? '#fbfcfd' : '#ffffff' }}
                    transition={{ duration: 0.25 }}
                    onMouseEnter={() => setMonth(i)}
                    onMouseLeave={() => setMonth((m) => (m === i ? null : m))}
                    onClick={() => setMonth((m) => (m === i ? null : i))}
                  />
                )
              })}

              {/* Referencecirkler — skalaen står på hver ring, så afstanden kan aflæses */}
              {rings.map((v, i) => {
                const r = radiusFor(v)
                const p = polar(-Math.PI / 2 - 0.30, r)
                return (
                  <g key={`ring-${v}`}>
                    <circle cx={C} cy={C} r={r} fill="none" stroke="#dde3e9"
                            strokeWidth="1" strokeDasharray={i === rings.length - 1 ? '0' : '3 5'} />
                    <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                          fontSize="9.5" fill="#8b98a8" fontWeight="700"
                          stroke="#fff" strokeWidth="3.2" paintOrder="stroke">
                      {v}%
                    </text>
                  </g>
                )
              })}

              {/* Volumen pr. måned som en stille søjle langs kanten */}
              {monthly.map((r, i) => {
                if (!r.delivered) return null
                const a0 = angleOf(activeYear, i, 2)
                const a1 = angleOf(activeYear, i, daysInMonth(activeYear, i))
                const h = 4 + (r.delivered / maxMonthVolume) * 20
                return (
                  <motion.path
                    key={`vol-${i}`}
                    d={wedgePath(a0, a1, R_OUT + 3, R_OUT + 3 + h)}
                    fill={focusMonth === i ? '#df790d' : '#d7dfe8'}
                    initial={{ opacity: 0 }}
                    animate={seen ? { opacity: 1 } : {}}
                    transition={{ duration: 0.5, delay: 0.35 + i * 0.02 }}
                  />
                )
              })}

              {/* Årets rytme: månedsgennemsnittet som ét lukket bånd */}
              {ribbon && (
                <>
                  <motion.path
                    d={ribbon}
                    fill="url(#wheel-ribbon)"
                    stroke="none"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={seen ? { opacity: 1, scale: 1 } : {}}
                    style={{ transformOrigin: `${C}px ${C}px` }}
                    transition={{ duration: 1.1, delay: 0.2, ease: mo.ease }}
                  />
                  <motion.path
                    d={ribbon}
                    fill="none"
                    stroke="#df790d"
                    strokeWidth="2.25"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={seen ? { pathLength: 1, opacity: 1 } : {}}
                    transition={{ duration: reduced ? 0 : 1.6, delay: 0.25, ease: mo.ease }}
                  />
                </>
              )}

              {/* Skyggeåret, hvis man har lagt et bagved */}
              {ghostDots.map((d) => {
                const p = polar(d.angle, d.radius)
                return (
                  <circle key={`ghost-${d.key}`} cx={p.x} cy={p.y} r={d.size * 0.8}
                          fill="none" stroke="#aebdd4" strokeWidth="1.4" opacity="0.75" />
                )
              })}

              {/* Selve udsendelserne */}
              {dots.map((d, i) => {
                const p = polar(d.angle, d.radius)
                const dim = focusMonth !== null && focusMonth !== d.month
                const isHover = hover?.key === d.key
                return (
                  <motion.g key={d.key}>
                    {isHover && (
                      <>
                        <line x1={C} y1={C} x2={p.x} y2={p.y} stroke={d.colour} strokeWidth="1" opacity="0.4" />
                        <circle cx={p.x} cy={p.y} r={d.size + 6} fill={d.colour} opacity="0.18" />
                      </>
                    )}
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      fill={d.colour}
                      stroke="#fff"
                      strokeWidth="1.4"
                      className="cursor-pointer"
                      initial={{ r: 0, opacity: 0 }}
                      animate={seen ? { r: isHover ? d.size + 2.5 : d.size, opacity: dim ? 0.22 : 0.92 } : {}}
                      transition={{
                        r: { duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.45 + i * 0.012, ease: mo.ease },
                        opacity: { duration: 0.25 },
                      }}
                      onMouseEnter={() => setHover(d)}
                      onMouseLeave={() => setHover((h) => (h?.key === d.key ? null : h))}
                      filter={isHover ? 'url(#wheel-glow)' : undefined}
                    >
                      <title>{`${d.m.subject} — ${fmtPct(d.m.stats.openRate)} åbning`}</title>
                    </motion.circle>
                  </motion.g>
                )
              })}

              {/* Månedsnavne yderst */}
              {MONTHS_SHORT.map((label, i) => {
                const a = angleOf(activeYear, i, Math.round(daysInMonth(activeYear, i) / 2))
                const p = polar(a, R_OUT + 40)
                const active = focusMonth === i
                return (
                  <text
                    key={`label-${i}`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.1em"
                    fill={active ? '#16233a' : '#8299bb'}
                    className="pointer-events-none select-none"
                  >
                    {label}
                  </text>
                )
              })}

              {/* Navet — årets tal, eller den udsendelse man peger på */}
              <circle cx={C} cy={C} r={R_HUB} fill="url(#wheel-hub)" />
              <motion.circle
                cx={C} cy={C} r={R_HUB}
                fill="none" stroke="#df790d" strokeWidth="1.5"
                animate={reduced ? {} : { r: [R_HUB, R_HUB + 9, R_HUB], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeOut' }}
              />
              <text x={C} y={C - 26} textAnchor="middle" fontSize="10" fontWeight="700"
                    letterSpacing="0.14em" fill="#8299bb">
                {focusMonth !== null ? MONTHS[focusMonth].toUpperCase() : 'ÅRET'}
              </text>
              <text x={C} y={C + 6} textAnchor="middle" fontSize="30" fontWeight="700"
                    fill="#ffffff" fontFamily="IBM Plex Serif, Georgia, serif">
                {fmtPct(monthRow ? monthRow.openRate : yearPool.openRate)}
              </text>
              <text x={C} y={C + 28} textAnchor="middle" fontSize="10.5" fill="#aebdd4">
                {monthRow
                  ? `${monthRow.count} udsendelse${monthRow.count === 1 ? '' : 'r'}`
                  : `${yearPool.count} udsendelser i ${activeYear}`}
              </text>
              <text x={C} y={C + 46} textAnchor="middle" fontSize="10.5" fill="#8299bb">
                {fmtNum(monthRow ? monthRow.delivered : yearPool.delivered)} leverede
              </text>
            </svg>
          </div>

          {/* ── Sidepanel ──────────────────────────────────────────────── */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {hover ? (
                <motion.div
                  key={hover.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: mo.ease }}
                  className="rounded-2xl border border-dp-navy-100 bg-white p-4"
                >
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider"
                    style={{ background: `${hover.colour}22`, color: hover.colour }}
                  >
                    {typeColour.get(hover.m.type)?.label ?? 'Øvrige'}
                  </span>
                  <p className="mt-2.5 font-serif text-[1.0625rem] font-semibold leading-snug text-dp-navy-900">
                    {hover.m.subject}
                  </p>
                  <p className="mt-1 text-[0.75rem] text-dp-navy-500">{formatDate(hover.m.when)}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-dp-navy-50 pt-3">
                    <MiniStat label="Åbning" value={fmtPct(hover.m.stats.openRate)} />
                    <MiniStat label="Klik" value={fmtPct(hover.m.stats.clickRate)} />
                    <MiniStat label="Leveret" value={fmtNum(hover.m.stats.delivered)} />
                  </dl>
                </motion.div>
              ) : (
                <motion.div
                  key={`month-${focusMonth ?? 'all'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: mo.ease }}
                  className="rounded-2xl border border-dp-navy-100 bg-dp-navy-50 p-4"
                >
                  <p className="font-serif text-[1.0625rem] font-semibold text-dp-navy-900">
                    {focusMonth !== null ? `${MONTHS[focusMonth]} ${activeYear}` : `Hele ${activeYear}`}
                  </p>
                  <dl className="mt-3 space-y-2">
                    <PanelRow label="Udsendelser" value={fmtNum(monthRow ? monthRow.count : yearPool.count)} />
                    <PanelRow label="Leverede mails" value={fmtNum(monthRow ? monthRow.delivered : yearPool.delivered)} />
                    <PanelRow label="Åbningsrate" value={fmtPct(monthRow ? monthRow.openRate : yearPool.openRate)} />
                    <PanelRow label="Klikrate" value={fmtPct(monthRow ? monthRow.clickRate : yearPool.clickRate)} />
                  </dl>
                  <p className="mt-3 border-t border-dp-navy-200/60 pt-3 text-[0.75rem] leading-relaxed text-dp-navy-500">
                    {focusMonth !== null
                      ? 'Klik på måneden igen for at slippe den. Peg på et punkt for at se udsendelsen.'
                      : 'Peg på en måned for at fremhæve den, og på et punkt for at se udsendelsen bag.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Årets travleste og roligste måneder */}
            <div className="mt-4 rounded-2xl border border-dp-navy-100 bg-white p-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
                Årets rytme
              </p>
              <ul className="mt-2.5 space-y-1.5 text-[0.8125rem] text-dp-navy-700">
                {rhythmNotes(monthly, activeYear).map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-dp-orange" />
                    <span className="leading-snug">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </ChartCard>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] font-semibold uppercase tracking-wider text-dp-navy-400">{label}</dt>
      <dd className="tnum mt-0.5 text-[0.9375rem] font-semibold text-dp-navy-900">{value}</dd>
    </div>
  )
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[0.8125rem] text-dp-navy-600">{label}</dt>
      <dd className="tnum text-[0.9375rem] font-semibold text-dp-navy-900">{value}</dd>
    </div>
  )
}

/** Tre linjer, der siger hvad hjulet viser, så figuren ikke skal tolkes af sig selv. */
function rhythmNotes(
  monthly: { month: number; count: number; delivered: number; openRate: number | null }[],
  year: number,
) {
  const active = monthly.filter((m) => m.count > 0)
  if (active.length === 0) return [`Ingen udsendelser registreret i ${year}.`]
  const notes: string[] = []

  const busiest = [...active].sort((a, b) => b.count - a.count)[0]
  notes.push(`${MONTHS[busiest.month]} er den travleste måned med ${busiest.count} udsendelser.`)

  const rated = active.filter((m) => m.openRate !== null && m.delivered >= 5000)
  if (rated.length >= 2) {
    const best = [...rated].sort((a, b) => b.openRate! - a.openRate!)[0]
    const worst = [...rated].sort((a, b) => a.openRate! - b.openRate!)[0]
    notes.push(`Højest åbning i ${MONTHS[best.month].toLowerCase()} (${fmtPct(best.openRate)}), lavest i ${MONTHS[worst.month].toLowerCase()} (${fmtPct(worst.openRate)}).`)
  }

  const quiet = monthly.filter((m) => m.count === 0).map((m) => MONTHS[m.month].toLowerCase())
  if (quiet.length) {
    notes.push(quiet.length === 1
      ? `Ingen udsendelser i ${quiet[0]}.`
      : `Stille i ${quiet.slice(0, -1).join(', ')} og ${quiet[quiet.length - 1]}.`)
  }

  return notes
}
