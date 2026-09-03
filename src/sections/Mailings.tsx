/**
 * Alle udsendelser.
 *
 * The full list, sortable, with the rates drawn as bands so a column can be
 * scanned as a shape rather than read as a column of digits. Expanding a row
 * shows what the sendout actually was: who it went to, what it contained, and
 * why anyone unsubscribed from it.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { SectionHeading } from '@/components/primitives'
import { fmtNum, fmtPct } from '@/components/charts'
import { formatDate, formatDateTime, type Dashboard, type Mailing } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

type SortKey = 'when' | 'subject' | 'delivered' | 'openRate' | 'clickRate' | 'ctor' | 'unsubRate'

const COLUMNS: { key: SortKey; label: string; align?: 'right'; width?: string; hint?: string }[] = [
  { key: 'when', label: 'Dato', width: '8.5rem' },
  { key: 'subject', label: 'Emnelinje' },
  { key: 'delivered', label: 'Leveret', align: 'right', width: '6rem' },
  { key: 'openRate', label: 'Åbninger', align: 'right', width: '9rem' },
  { key: 'clickRate', label: 'Klik', align: 'right', width: '9rem' },
  { key: 'ctor', label: 'Klik pr. åbning', align: 'right', width: '7rem', hint: 'Af dem der åbnede, hvor mange klikkede' },
  { key: 'unsubRate', label: 'Afmeldt', align: 'right', width: '5.5rem' },
]

export function Mailings({ data, mailings }: { data: Dashboard; mailings: Mailing[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'when', dir: 'desc' })
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(40)

  const typeOf = useMemo(() => new Map(data.types.map((t) => [t.key, t])), [data.types])

  const sorted = useMemo(() => {
    const val = (m: Mailing): string | number => {
      switch (sort.key) {
        case 'when': return m.when ?? ''
        case 'subject': return m.subject.toLowerCase()
        case 'delivered': return m.stats.delivered
        case 'openRate': return m.stats.openRate ?? -1
        case 'clickRate': return m.stats.clickRate ?? -1
        case 'ctor': return m.stats.ctor ?? -1
        case 'unsubRate': return m.stats.unsubRate ?? -1
      }
    }
    return [...mailings].sort((a, b) => {
      const av = val(a); const bv = val(b)
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string, 'da') : (av as number) - (bv as number)
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [mailings, sort])

  const maxOpen = Math.max(1, ...mailings.map((m) => m.stats.openRate ?? 0))
  const maxClick = Math.max(1, ...mailings.map((m) => m.stats.clickRate ?? 0))

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'subject' ? 'asc' : 'desc' }))

  return (
    <>
      <SectionHeading
        moduleId="top-udsendelser"
        kicker="Alle udsendelser"
        title={`${mailings.length.toLocaleString('da-DK')} sendte udsendelser`}
        lead="Klik på en række for at se afsender, modtagerlister, indhold og afmeldingsgrunde. Klik på en kolonneoverskrift for at sortere."
      />

      {!mailings.length ? (
        <div className="card p-12 text-center">
          <p className="font-serif text-lg text-dp-navy-700">Ingen udsendelser matcher filtrene</p>
          <p className="mt-2 text-[0.875rem] text-dp-navy-500">Prøv at rydde et filter eller vælge en længere periode.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[58rem] table-fixed border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-dp-navy-100 bg-dp-navy-50/60">
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      style={{ width: c.width }}
                      className={`px-3 py-2.5 font-semibold text-dp-navy-600 ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.key === 'subject' ? 'w-full' : ''}`}
                      title={c.hint}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-dp-navy-900 ${sort.key === c.key ? 'text-dp-navy-900' : ''}`}
                      >
                        {c.label}
                        <span className={`text-[0.625rem] transition-opacity ${sort.key === c.key ? 'opacity-100' : 'opacity-25'}`}>
                          {sort.key === c.key && sort.dir === 'asc' ? '▲' : '▼'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, limit).map((m, i) => {
                  const t = typeOf.get(m.type)
                  const isOpen = open === m.id
                  return (
                    <>
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: Math.min(0.25, i * 0.012) }}
                        onClick={() => setOpen(isOpen ? null : m.id)}
                        className={`cursor-pointer border-b border-dp-navy-50 transition-colors last:border-0 ${isOpen ? 'bg-dp-navy-50' : 'hover:bg-dp-navy-50/60'}`}
                      >
                        <td className="px-3 py-2.5 tnum whitespace-nowrap text-dp-navy-500">
                          {m.isRecurring && (
                            <span className="mr-1 text-[0.625rem] text-dp-navy-400" title="Gentagende udsendelse — datoen er seneste afsendelse">
                              senest
                            </span>
                          )}
                          {formatDate(m.when)}
                        </td>
                        <td className="w-full max-w-0 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                              style={{ background: t?.color ?? '#8299bb' }}
                              title={t?.label}
                            />
                            <span className="min-w-0 truncate font-medium text-dp-navy-900" title={m.subject}>
                              {m.subject || <em className="text-dp-navy-400">Uden emnelinje</em>}
                            </span>
                            {m.isRecurring && (
                              <span className="shrink-0 rounded bg-dp-navy-100 px-1.5 py-0.5 text-[0.625rem] font-semibold text-dp-navy-500">
                                gentages
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 tnum text-right text-dp-navy-700">{fmtNum(m.stats.delivered)}</td>
                        <td className="px-3 py-2.5">
                          <RateCell value={m.stats.openRate} max={maxOpen} color="#eab922" />
                        </td>
                        <td className="px-3 py-2.5">
                          <RateCell value={m.stats.clickRate} max={maxClick} color="#4fa388" />
                        </td>
                        <td className="px-3 py-2.5 tnum text-right text-dp-navy-700">{fmtPct(m.stats.ctor)}</td>
                        <td className="px-3 py-2.5 tnum text-right" style={{ color: (m.stats.unsubRate ?? 0) > 0.5 ? '#d24e46' : '#7a8798' }}>
                          {fmtPct(m.stats.unsubRate, 2)}
                        </td>
                      </motion.tr>

                      <AnimatePresence>
                        {isOpen && (
                          <tr key={`${m.id}-detail`}>
                            <td colSpan={COLUMNS.length} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.32, ease: mo.ease }}
                                className="overflow-hidden bg-dp-navy-50"
                              >
                                <MailingDetail mailing={m} typeLabel={t?.label ?? 'Øvrige'} typeColor={t?.color ?? '#8299bb'} />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {limit < sorted.length && (
            <div className="border-t border-dp-navy-100 p-3 text-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + 60)}
                className="rounded-full border border-dp-navy-200 px-4 py-1.5 text-[0.75rem] font-semibold text-dp-navy-700 transition hover:border-dp-navy-400"
              >
                Vis flere ({(sorted.length - limit).toLocaleString('da-DK')} tilbage)
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function RateCell({ value, max, color }: { value: number | null; max: number; color: string }) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-dp-navy-100">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, ((value ?? 0) / max) * 100)}%` }}
          transition={{ duration: 0.7, ease: mo.ease }}
        />
      </div>
      <span className="tnum w-12 text-right font-medium text-dp-navy-900">{fmtPct(value)}</span>
    </div>
  )
}

function MailingDetail({ mailing: m, typeLabel, typeColor }: { mailing: Mailing; typeLabel: string; typeColor: string }) {
  const facts: { label: string; value: string }[] = [
    { label: 'Type', value: typeLabel },
    { label: 'Afsender', value: m.from.name ? `${m.from.name}${m.from.address ? ` <${m.from.address}>` : ''}` : '–' },
    { label: 'Kategori', value: m.category ?? '–' },
    { label: m.isRecurring ? 'Senest sendt' : 'Sendt', value: formatDateTime(m.started ?? m.when) },
    ...(m.isRecurring ? [{ label: 'Gentages', value: 'Ja — sender løbende, efterhånden som medlemmer kvalificerer sig' }] : []),
    { label: 'Flow', value: m.journey ?? '–' },
    { label: 'Modtagere', value: fmtNum(m.stats.recipients) },
    { label: 'Leveret', value: `${fmtNum(m.stats.delivered)} (${fmtNum(m.stats.bounces)} bouncede)` },
    { label: 'Åbninger', value: `${fmtNum(m.stats.opens)} · ${fmtPct(m.stats.openRate)}` },
    { label: 'Klik', value: `${fmtNum(m.stats.clicks)} · ${fmtPct(m.stats.clickRate)}` },
    { label: 'Afmeldinger', value: `${fmtNum(m.stats.unsubscribes)} · ${fmtPct(m.stats.unsubRate, 2)}` },
    { label: 'Indhold', value: `${fmtNum(m.content.words)} ord · ${m.content.uniqueLinks} links · ${m.content.images} billeder · ca. ${m.content.readingMinutes} min. læsning` },
    { label: 'Emnelinje', value: `${m.subjectAnalysis.length} tegn, ${m.subjectAnalysis.words} ord` },
  ]

  const traits = [
    m.subjectAnalysis.hasEmoji && 'emoji',
    m.subjectAnalysis.hasQuestion && 'spørgsmål',
    m.subjectAnalysis.hasNumber && 'tal',
    m.subjectAnalysis.hasPersonalisation && 'personalisering',
    m.subjectAnalysis.hasExclamation && 'udråbstegn',
    m.subjectAnalysis.capsWords > 0 && 'versaler',
  ].filter(Boolean) as string[]

  return (
    <div className="grid gap-6 border-t-2 px-4 py-5 lg:grid-cols-[1.1fr_1fr]" style={{ borderColor: typeColor }}>
      <div>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex gap-2 text-[0.8125rem]">
              <dt className="w-28 shrink-0 text-dp-navy-500">{f.label}</dt>
              <dd className="min-w-0 break-words font-medium text-dp-navy-900">{f.value}</dd>
            </div>
          ))}
        </dl>

        {traits.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.75rem] text-dp-navy-500">Emnelinjen bruger:</span>
            {traits.map((t) => (
              <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[0.6875rem] font-medium text-dp-navy-700">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {m.lists.length > 0 && (
          <Chips title="Sendt til lister" items={m.lists} color="#4c7bbd" />
        )}
        {m.segments.length > 0 && (
          <Chips title="Segmenter" items={m.segments} color="#4e4897" />
        )}
        {m.tags.length > 0 && (
          <Chips title="Tags i Ungapped" items={m.tags} color="#7a8798" />
        )}
        {m.content.hosts.length > 0 && (
          <Chips title="Linker til" items={m.content.hosts.slice(0, 6).map((h) => `${h.host} (${h.n})`)} color="#179fa0" />
        )}
        {m.unsubscribeReasons.length > 0 && (
          <div>
            <div className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-dp-navy-400">
              Afmeldingsgrunde
            </div>
            <ul className="space-y-1">
              {m.unsubscribeReasons.slice(0, 6).map((r) => (
                <li key={r.reason} className="flex justify-between gap-3 text-[0.8125rem] text-dp-navy-700">
                  <span className="min-w-0 truncate">{r.reason}</span>
                  <span className="tnum shrink-0 font-semibold">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Chips({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-dp-navy-400">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <span
            key={x}
            className="max-w-full truncate rounded-full px-2.5 py-1 text-[0.6875rem] font-medium"
            style={{ background: `${color}18`, color }}
            title={x}
          >
            {x}
          </span>
        ))}
      </div>
    </div>
  )
}
