/**
 * Link-kataloget — hvor peger vi hen, og hvad ved vi om det?
 *
 * Ungapped rapporterer ét samlet klik-tal pr. udsendelse. Der findes ikke et
 * endpoint i hele API'et der udleverer klik pr. link, så modulet kan ikke sige
 * "kalenderlinket fik 42 klik" — og lader være med at lade som om. Det den kan
 * er at katalogisere hver destination, hvor ofte og hvor i mailen den står, og
 * hvordan de udsendelser der indeholder den klikker sammenlignet med resten.
 *
 * Den sammenligning står aldrig alene: ved siden af hver forskel står, hvor
 * meget større eller mindre de udsendelser er, så et link i sidefoden ikke
 * bliver læst som noget der skræmmer folk væk.
 */
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChartCard } from '@/components/primitives'
import { fmtDec, fmtDelta, fmtNum } from '@/components/charts'
import type { Dashboard, LinkRow } from '@/lib/data'
import { formatDate } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

const PLACE_COLOUR: Record<string, string> = {
  'øverst': '#df790d',
  'i midten': '#4c7bbd',
  'nederst': '#8299bb',
}

/** Adressen forkortet til noget man kan læse, med hele stien på hover. */
function Path({ path }: { path: string }) {
  const cut = path.indexOf('/')
  const host = cut < 0 ? path : path.slice(0, cut)
  const rest = cut < 0 ? '' : path.slice(cut)
  return (
    <span className="min-w-0 truncate" title={path}>
      <span className="text-dp-navy-400">{host}</span>
      <span className="text-dp-navy-900">{rest}</span>
    </span>
  )
}

export function LinkCatalogue({ data }: { data: Dashboard }) {
  const cat = data.content.catalogue
  const [view, setView] = useState<'brugt' | 'forskel' | 'engangs'>('brugt')
  const rows = useMemo(() => {
    if (!cat) return []
    if (view === 'brugt') return cat.mostUsed
    if (view === 'engangs') return cat.oneOffSample
    return [...cat.strongest, ...cat.weakest]
      .filter((r, i, a) => a.findIndex((x) => x.path === r.path) === i)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
  }, [cat, view])

  if (!cat) return null
  const t = cat.totals

  return (
    <ChartCard
      title="Hvor peger vi hen"
      subtitle={`${fmtNum(t.destinations)} forskellige destinationer i ${fmtNum(t.mailings)} udsendelser. Ungapped tæller klik pr. mail, ikke pr. link — så kataloget beskriver, hvad vi linker til, ikke hvad der bliver klikket på.`}
      moduleId="links"
      actions={
        <div className="flex rounded-full border border-dp-navy-100 p-0.5">
          {([
            ['brugt', 'Mest brugte'],
            ['forskel', `Med forskel (${t.comparable})`],
            ['engangs', `Engangslinks (${t.oneOffs})`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className="relative rounded-full px-3 py-1 text-[0.6875rem] font-semibold transition-colors"
              style={{ color: view === k ? '#fff' : '#4a5a72' }}
            >
              {view === k && (
                <motion.span layoutId="link-tab" className="absolute inset-0 rounded-full bg-dp-navy-600"
                  transition={{ duration: 0.28, ease: mo.ease }} />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      }
    >
      {/* Fire tal der rammer omfanget */}
      <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact value={fmtNum(t.destinations)} label="destinationer" note="unikke sider vi linker til" />
        <Fact value={fmtNum(t.recurring)} label="går igen" note={`i mindst ${cat.minSendouts} udsendelser`} />
        <Fact value={fmtNum(t.oneOffs)} label="kun brugt én gang" note={`${Math.round((t.oneOffs / Math.max(1, t.destinations)) * 100)} % af alle links`} />
        <Fact value={fmtNum(t.comparable)} label="kan sammenlignes" note="har volumen nok bag sig" />
      </dl>

      {/* Selve listen */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] table-fixed border-collapse text-[0.8125rem]">
          <thead>
            <tr className="border-b border-dp-navy-100 text-[0.625rem] uppercase tracking-wider text-dp-navy-400">
              <th className="w-full max-w-0 py-2 pr-3 text-left font-bold">Destination</th>
              <th className="w-[5.5rem] py-2 pr-3 text-right font-bold">Udsendelser</th>
              <th className="w-[6rem] py-2 pr-3 text-left font-bold">Placering</th>
              {view === 'forskel'
                ? <th className="w-[9.5rem] py-2 text-right font-bold">Forskel i klikrate</th>
                : <th className="w-[6.5rem] py-2 text-right font-bold">Senest brugt</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr
                key={r.path}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(0.4, i * 0.02) }}
                className="border-b border-dp-navy-50 last:border-0"
              >
                <td className="w-full max-w-0 py-2 pr-3"><Path path={r.path} /></td>
                <td className="tnum py-2 pr-3 text-right text-dp-navy-700">
                  {fmtNum(r.mailings)}
                  {r.everywhere && <span className="ml-1 text-[0.625rem] text-dp-navy-400">næsten alle</span>}
                </td>
                <td className="py-2 pr-3">
                  {r.place && (
                    <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-dp-navy-600">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PLACE_COLOUR[r.place] }} />
                      {r.place}
                    </span>
                  )}
                </td>
                {view === 'forskel' ? (
                  <td className="py-2 text-right">
                    <Difference row={r} />
                  </td>
                ) : (
                  <td className="tnum py-2 text-right text-[0.75rem] text-dp-navy-500">{formatDate(r.last)}</td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {view === 'forskel' && (
        <p className="mt-4 rounded-xl bg-dp-gul-15 px-4 py-3 text-[0.75rem] leading-relaxed text-dp-navy-700">
          <strong className="text-dp-navy-900">Læs forskellen med varsomhed.</strong> Den siger, hvordan
          de udsendelser der indeholder destinationen klikker, sammenlignet med dem der ikke gør — ikke
          hvor mange der klikkede på selve linket. En mail om selvstændig praksis indeholder både et link
          til praksis-siden og et emne der optager netop den gruppe. Tallet i parentes er, hvor store de
          udsendelser er i forhold til resten: står der 0,1× eller 3×, handler forskellen formentlig mest
          om mailens størrelse.
        </p>
      )}
      {view === 'engangs' && (
        <p className="mt-4 text-[0.75rem] leading-relaxed text-dp-navy-500">
          {fmtNum(t.oneOffs)} destinationer er brugt i præcis én udsendelse. Det er ikke i sig selv
          et problem — en nyhed linker til sin egen side — men det er her man leder, hvis man vil vide
          hvilke sider der aldrig får et gensyn.
        </p>
      )}

      {/* Hvor i mailen linkene står */}
      <div className="mt-6 border-t border-dp-navy-50 pt-5">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
          Hvor i mailen linkene står
        </p>
        <div className="mt-3 flex gap-1.5">
          {cat.places.map((p) => {
            const total = cat.places.reduce((s, x) => s + x.uses, 0) || 1
            return (
              <div key={p.label} className="min-w-0" style={{ flex: p.uses || 0.001 }}>
                <motion.div
                  className="h-3 rounded-full"
                  style={{ background: PLACE_COLOUR[p.label] }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: mo.ease }}
                />
                <p className="mt-1.5 truncate text-[0.75rem] font-semibold text-dp-navy-800">{p.label}</p>
                <p className="tnum text-[0.6875rem] text-dp-navy-500">
                  {fmtNum(p.uses)} links · {Math.round((p.uses / total) * 100)} %
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Værtsnavne */}
      {cat.hosts.length > 1 && (
        <div className="mt-6 border-t border-dp-navy-50 pt-5">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
            Hvilke sider vi sender folk til
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {cat.hosts.slice(0, 10).map((h) => (
              <li key={h.host} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span className="min-w-0 truncate text-dp-navy-800" title={h.host}>{h.host}</span>
                <span className="tnum shrink-0 text-[0.75rem] text-dp-navy-500">
                  {fmtNum(h.paths)} sider · {fmtNum(h.uses)} links
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 border-t border-dp-navy-50 pt-4 text-[0.75rem] leading-relaxed text-dp-navy-400">
        {cat.note}
      </p>
    </ChartCard>
  )
}

function Fact({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div>
      <dd className="tnum font-serif text-[1.625rem] font-semibold leading-none text-dp-navy-900">{value}</dd>
      <dt className="mt-1 text-[0.8125rem] font-semibold text-dp-navy-800">{label}</dt>
      <p className="text-[0.6875rem] leading-snug text-dp-navy-500">{note}</p>
    </div>
  )
}

/** Forskellen, altid med størrelsesforholdet ved siden af. */
function Difference({ row }: { row: LinkRow }) {
  if (row.delta === null) return <span className="text-dp-navy-300">–</span>
  const good = row.delta > 0
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="tnum text-[0.875rem] font-semibold" style={{ color: good ? '#179fa0' : '#d24e46' }}>
        {fmtDelta(row.delta)} point
      </span>
      {row.sizeRatio !== null && (
        <span
          className="tnum text-[0.6875rem] text-dp-navy-400"
          title={`Udsendelserne med dette link er i snit ${fmtDec(row.sizeRatio)} gange så store som dem uden — ${fmtNum(row.avgDelivered)} leverede mod resten`}
        >
          ({fmtDec(row.sizeRatio)}×)
        </span>
      )}
    </span>
  )
}
