/**
 * Emnelinje-testeren.
 *
 * Not a generic "subject line grader" — those score against someone else's
 * inbox. This one scores against DP's own 198 udsendelser: the estimate is the
 * house average, moved by exactly the effects the dashboard has measured, and
 * only by the ones that cleared the volume rule. Everything else is shown but
 * explicitly not counted, so nobody rewrites a headline on eleven mails.
 */
import { useDeferredValue, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChartCard } from '@/components/primitives'
import { fmtDec, fmtDelta, fmtNum, fmtPct } from '@/components/charts'
import type { Dashboard } from '@/lib/data'
import { formatDate } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
const STOP = new Set(['og', 'i', 'til', 'af', 'på', 'for', 'med', 'den', 'det', 'de', 'en', 'et', 'er', 'som', 'du', 'din', 'dit', 'vi', 'om', 'fra', 'ny', 'nyt', 'nye', 'der', 'har', 'kan', 'så', 'nu'])

interface Factor {
  label: string
  hint: string | null
  active: boolean
  delta: number | null
  reliable: boolean
  n: number
}

export function SubjectLab({ data }: { data: Dashboard }) {
  const [text, setText] = useState('')
  const typed = useDeferredValue(text)
  const s = typed.trim()

  const baseline = data.overview.pool.openRate ?? 0

  const analysis = useMemo(() => {
    const words = s ? s.split(/\s+/).filter(Boolean) : []
    return {
      length: s.length,
      words: words.length,
      hasEmoji: EMOJI.test(s),
      hasQuestion: s.includes('?'),
      hasExclamation: s.includes('!'),
      hasNumber: /\d/.test(s),
      hasPersonalisation: /\[@|\{\{|\[%/.test(s),
      hasColon: s.includes(':'),
      capsWords: words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-ZÆØÅ]/.test(w)).length,
      tokens: words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')).filter((w) => w.length > 2 && !STOP.has(w)),
    }
  }, [s])

  /** Længdebåndet er den ene faktor, der altid gælder — hver emnelinje har en længde. */
  const lengthBucket = useMemo(
    () => data.subjects.byLength.find((b) => analysis.length >= b.from && analysis.length < b.to) ?? null,
    [data.subjects.byLength, analysis.length],
  )

  const flagByLabel = useMemo(
    () => new Map(data.subjects.flags.map((f) => [f.label, f])),
    [data.subjects.flags],
  )

  const factors: Factor[] = useMemo(() => {
    const wanted: [string, boolean][] = [
      ['Emoji i emnelinjen', analysis.hasEmoji],
      ['Spørgsmålstegn', analysis.hasQuestion],
      ['Udråbstegn', analysis.hasExclamation],
      ['Tal i emnelinjen', analysis.hasNumber],
      ['Personalisering', analysis.hasPersonalisation],
      ['Kolon', analysis.hasColon],
      ['Versaler', analysis.capsWords > 0],
    ]
    return wanted
      .map(([label, active]) => {
        const f = flagByLabel.get(label)
        if (!f) return null
        return {
          label,
          hint: f.hint,
          active,
          delta: f.openDelta,
          reliable: f.reliable,
          n: f.with.count,
        }
      })
      .filter((f): f is Factor => f !== null)
  }, [analysis, flagByLabel])

  /** Skøn: husets gennemsnit, flyttet af længdebåndet og de faktorer der tåler vægt. */
  const estimate = useMemo(() => {
    if (!s) return null
    const parts: { label: string; delta: number }[] = []
    let value = baseline

    if (lengthBucket?.comparable && lengthBucket.openRate !== null) {
      const d = lengthBucket.openRate - baseline
      value += d
      parts.push({ label: lengthBucket.label, delta: d })
    }
    for (const f of factors) {
      if (!f.active || !f.reliable || f.delta === null) continue
      value += f.delta
      parts.push({ label: f.label, delta: f.delta })
    }
    return { value: Math.max(0, Math.min(100, value)), parts }
  }, [s, baseline, lengthBucket, factors])

  /** Ord vi selv har målt: kun dem hvor emnelinjen faktisk bruger ordet. */
  const wordHits = useMemo(() => {
    if (!analysis.tokens.length) return { best: [], worst: [] }
    const inText = (w: string) => analysis.tokens.some((t) => t === w || t.startsWith(w) || w.startsWith(t))
    return {
      best: data.subjects.words.best.filter((w) => inText(w.word)),
      worst: data.subjects.words.worst.filter((w) => inText(w.word)),
    }
  }, [analysis.tokens, data.subjects.words])

  /** De nærmeste emnelinjer vi har sendt før — samme ord vejer tungest. */
  const similar = useMemo(() => {
    if (analysis.tokens.length === 0) return []
    const set = new Set(analysis.tokens)
    return data.mailings
      .filter((m) => m.stats.delivered > 0 && m.stats.openRate !== null && m.subject)
      .map((m) => {
        const t = m.subject.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter((w) => w.length > 2 && !STOP.has(w))
        const shared = t.filter((w) => set.has(w) || [...set].some((x) => w.startsWith(x) || x.startsWith(w)))
        return { m, score: new Set(shared).size }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.m.stats.delivered - a.m.stats.delivered)
      .slice(0, 4)
  }, [analysis.tokens, data.mailings])

  const truncMobile = 34
  const truncDesktop = 62

  return (
    <ChartCard
      title="Emnelinje-tester"
      subtitle="Skriv en emnelinje og se, hvad DP's egne tal siger om den. Skønnet bygger kun på de mønstre, der har nok udsendelser bag sig."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <label htmlFor="subject-lab" className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
            Din emnelinje
          </label>
          <div className="relative mt-2">
            <input
              id="subject-lab"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Fx: Nyt fra DP: sådan får du mest ud af din overenskomst"
              className="w-full rounded-2xl border-2 border-dp-navy-100 bg-white px-4 py-3.5 pr-16 font-serif text-[1.0625rem] text-dp-navy-900 transition-colors placeholder:font-sans placeholder:text-[0.9375rem] placeholder:text-dp-navy-300 focus:border-dp-orange focus:outline-none"
            />
            <span className={`tnum absolute right-4 top-1/2 -translate-y-1/2 text-[0.75rem] font-semibold ${
              analysis.length > 75 ? 'text-dp-rod' : analysis.length > 60 ? 'text-dp-orange' : 'text-dp-navy-400'
            }`}>
              {analysis.length}
            </span>
          </div>

          {/* Sådan ser den ud i indbakken */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InboxPreview title="På mobil" line={s} limit={truncMobile} />
            <InboxPreview title="På computer" line={s} limit={truncDesktop} />
          </div>

          {/* Skønnet */}
          <AnimatePresence mode="wait">
            {estimate ? (
              <motion.div
                key="estimate"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: mo.ease }}
                className="mt-6 overflow-hidden rounded-2xl border border-dp-navy-100"
              >
                <div className="flex flex-wrap items-end justify-between gap-4 bg-dp-navy-900 px-5 py-4 text-white">
                  <div>
                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
                      Skønnet åbningsrate
                    </p>
                    <p className="tnum mt-1 font-serif text-[2.25rem] font-semibold leading-none">
                      {fmtDec(estimate.value)}<span className="text-[1.125rem] font-normal text-dp-navy-300">%</span>
                    </p>
                  </div>
                  <p className="tnum text-[0.8125rem] text-dp-navy-300">
                    Husets gennemsnit: {fmtPct(baseline)}{' '}
                    <span style={{ color: estimate.value >= baseline ? '#8ebec0' : '#e39687' }}>
                      ({fmtDelta(estimate.value - baseline)})
                    </span>
                  </p>
                </div>

                <div className="space-y-2.5 bg-white px-5 py-4">
                  {estimate.parts.length === 0 ? (
                    <p className="text-[0.8125rem] text-dp-navy-500">
                      Ingen af de målte træk slår ud på denne emnelinje — skønnet er husets gennemsnit.
                    </p>
                  ) : (
                    estimate.parts.map((p, i) => (
                      <motion.div
                        key={p.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05, ease: mo.ease }}
                        className="flex items-center gap-3"
                      >
                        <span className="w-40 shrink-0 truncate text-[0.8125rem] text-dp-navy-700">{p.label}</span>
                        <div className="relative h-2.5 flex-1 rounded-full bg-dp-navy-50">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-dp-navy-200" />
                          <motion.span
                            className="absolute inset-y-0 rounded-full"
                            style={{
                              background: p.delta >= 0 ? '#179fa0' : '#d24e46',
                              left: p.delta >= 0 ? '50%' : undefined,
                              right: p.delta < 0 ? '50%' : undefined,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(50, (Math.abs(p.delta) / 12) * 50)}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05, ease: mo.ease }}
                          />
                        </div>
                        <span className="tnum w-14 shrink-0 text-right text-[0.8125rem] font-semibold"
                              style={{ color: p.delta >= 0 ? '#179fa0' : '#d24e46' }}>
                          {fmtDelta(p.delta)}
                        </span>
                      </motion.div>
                    ))
                  )}
                  <p className="border-t border-dp-navy-50 pt-3 text-[0.75rem] leading-relaxed text-dp-navy-400">
                    Skønnet er en fremskrivning af DP's egne tal, ikke en forudsigelse. Emnelinjen er
                    sjældent den eneste forskel mellem to udsendelser — modtagergruppe, tidspunkt og
                    afsender trækker også.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 rounded-2xl border border-dashed border-dp-navy-200 px-5 py-8 text-center text-[0.875rem] text-dp-navy-500"
              >
                Skriv en emnelinje ovenfor, så regner vi den igennem mod {fmtNum(data.mailings.filter((m) => m.stats.delivered > 0).length)} tidligere udsendelser.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Sidepanel: træk, ord og tidligere emnelinjer ─────────────── */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-dp-navy-100 bg-white p-4">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">Træk i linjen</p>
            <ul className="mt-3 space-y-2">
              {factors.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5">
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.5625rem] font-bold text-white transition-colors ${
                      f.active ? '' : 'bg-dp-navy-100'
                    }`}
                    style={f.active ? { background: f.reliable ? (f.delta ?? 0) >= 0 ? '#179fa0' : '#d24e46' : '#aebdd4' } : undefined}
                    aria-hidden="true"
                  >
                    {f.active ? '✓' : ''}
                  </span>
                  <span className={`flex-1 text-[0.8125rem] ${f.active ? 'text-dp-navy-900' : 'text-dp-navy-400'}`}>
                    {f.label}
                  </span>
                  <span className="tnum shrink-0 text-[0.75rem] font-semibold"
                        style={{ color: f.reliable ? ((f.delta ?? 0) >= 0 ? '#179fa0' : '#d24e46') : '#aebdd4' }}>
                    {fmtDelta(f.delta)}
                  </span>
                </li>
              ))}
            </ul>
            {factors.some((f) => f.active && !f.reliable) && (
              <p className="mt-3 rounded-lg bg-dp-gul-15 px-3 py-2 text-[0.6875rem] leading-snug text-dp-navy-700">
                Grå tal tæller ikke med i skønnet: der er for få udsendelser bag dem til at sige noget.
              </p>
            )}
            {lengthBucket && (
              <p className="mt-3 border-t border-dp-navy-50 pt-3 text-[0.75rem] leading-snug text-dp-navy-600">
                Længden lander i <strong className="text-dp-navy-900">{lengthBucket.label}</strong>, hvor DP
                historisk får {fmtPct(lengthBucket.openRate)} på {fmtNum(lengthBucket.count)} udsendelser.
              </p>
            )}
          </div>

          {(wordHits.best.length > 0 || wordHits.worst.length > 0) && (
            <div className="rounded-2xl border border-dp-navy-100 bg-white p-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">Ord vi har målt</p>
              <ul className="mt-2.5 space-y-1.5">
                {wordHits.best.map((w) => (
                  <li key={w.word} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="text-dp-navy-800">«{w.word}»</span>
                    <span className="tnum font-semibold" style={{ color: '#179fa0' }}>{fmtPct(w.openRate)}</span>
                  </li>
                ))}
                {wordHits.worst.map((w) => (
                  <li key={w.word} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="text-dp-navy-800">«{w.word}»</span>
                    <span className="tnum font-semibold" style={{ color: '#d24e46' }}>{fmtPct(w.openRate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {similar.length > 0 && (
            <div className="rounded-2xl border border-dp-navy-100 bg-dp-navy-50 p-4">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-dp-navy-400">
                Vi har sendt noget lignende
              </p>
              <ul className="mt-2.5 space-y-3">
                {similar.map(({ m }) => (
                  <li key={m.id}>
                    <p className="line-clamp-2 text-[0.8125rem] leading-snug text-dp-navy-800" title={m.subject}>
                      {m.subject}
                    </p>
                    <p className="tnum mt-0.5 text-[0.6875rem] text-dp-navy-500">
                      {formatDate(m.when)} · {fmtPct(m.stats.openRate)} åbning · {fmtNum(m.stats.delivered)} leveret
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  )
}

/** Hvordan linjen ser ud, når indbakken klipper den af. */
function InboxPreview({ title, line, limit }: { title: string; line: string; limit: number }) {
  const cut = line.length > limit
  return (
    <div className="rounded-xl border border-dp-navy-100 bg-dp-navy-50 p-3">
      <p className="text-[0.625rem] font-bold uppercase tracking-wider text-dp-navy-400">{title}</p>
      <div className="mt-2 rounded-lg bg-white px-3 py-2.5 shadow-sm">
        <p className="text-[0.6875rem] font-semibold text-dp-navy-500">Dansk Psykolog Forening</p>
        <p className="mt-0.5 truncate text-[0.8125rem] font-semibold text-dp-navy-900">
          {line ? line.slice(0, limit) : <span className="text-dp-navy-300">Din emnelinje…</span>}
          {cut && <span className="text-dp-navy-300">…</span>}
        </p>
      </div>
      {cut && (
        <p className="mt-1.5 text-[0.625rem] text-dp-orange">
          {line.length - limit} tegn falder uden for skærmen
        </p>
      )}
    </div>
  )
}
