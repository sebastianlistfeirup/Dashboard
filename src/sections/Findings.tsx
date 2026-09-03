/**
 * Interessante findings.
 *
 * What the numbers actually say, stated in plain Danish. Every card carries the
 * evidence it rests on, so a reader can weigh a claim rather than take it on
 * faith — and so a pattern from four sendouts never looks like a law.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Reveal, SectionHeading } from '@/components/primitives'
import { motion as mo } from '@/design/tokens'
import type { Finding } from '@/lib/data'

const KIND: Record<Finding['kind'], { label: string; color: string; soft: string; icon: string }> = {
  positive: { label: 'Går godt', color: '#179fa0', soft: '#e0eded', icon: 'M4 13l5 5L20 7' },
  negative: { label: 'Kræver handling', color: '#d24e46', soft: '#f6e1d8', icon: 'M12 8v5M12 17h.01' },
  opportunity: { label: 'Mulighed', color: '#df790d', soft: '#f9e8d4', icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2' },
  neutral: { label: 'Værd at vide', color: '#4c7bbd', soft: '#dfe5f4', icon: 'M12 8h.01M11 12h1v5h1' },
}

export function Findings({ findings }: { findings: Finding[] }) {
  const areas = useMemo(() => ['Alle', ...new Set(findings.map((f) => f.area))], [findings])
  const [area, setArea] = useState('Alle')
  const shown = area === 'Alle' ? findings : findings.filter((f) => f.area === area)

  if (!findings.length) {
    return (
      <>
        <SectionHeading
          kicker="Interessante findings"
          title="Ikke nok data endnu"
          lead="Der skal flere udsendelser til, før mønstrene er stærke nok til at sige noget om."
        />
      </>
    )
  }

  return (
    <>
      <SectionHeading
        moduleId="findings"
        kicker="Interessante findings"
        title="Hvad tallene faktisk siger"
        lead="Automatisk fundne mønstre på tværs af alle udsendelser. Hvert fund viser sit grundlag, så du kan se forskel på en tendens og et tilfælde."
        right={
          <div className="thin-scroll flex max-w-full gap-1 overflow-x-auto">
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className="relative shrink-0 rounded-full px-3 py-1.5 text-[0.75rem] font-semibold transition-colors"
                style={{ color: area === a ? '#fff' : '#4a5a72' }}
              >
                {area === a && (
                  <motion.span layoutId="finding-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{a}</span>
              </button>
            ))}
          </div>
        }
      />

      <motion.ul layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((f, i) => {
            const k = KIND[f.kind]
            return (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: mo.ease, delay: Math.min(0.3, i * 0.04) }}
                className="group relative overflow-hidden rounded-2xl border border-dp-navy-100 bg-white p-5 shadow-card transition-shadow duration-300 hover:shadow-card-hover"
              >
                {/* The band from the designmanual, here as the card's top edge. */}
                <motion.span
                  className="absolute inset-x-0 top-0 h-1 origin-left"
                  style={{ background: f.color ?? k.color }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: mo.ease, delay: 0.1 + i * 0.03 }}
                />

                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold"
                    style={{ background: k.soft, color: k.color }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d={k.icon} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {k.label}
                  </span>
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-dp-navy-400">
                    {f.area}
                  </span>
                </div>

                <div className="mb-2 flex items-baseline gap-3">
                  <span
                    className="font-serif text-[2rem] font-semibold leading-none tnum"
                    style={{ color: f.color ?? k.color }}
                  >
                    {f.metric}
                  </span>
                  {f.delta !== undefined && f.delta !== null && (
                    <span
                      className="tnum text-[0.8125rem] font-semibold"
                      style={{ color: f.delta >= 0 ? '#179fa0' : '#d24e46' }}
                    >
                      {f.delta >= 0 ? '▲' : '▼'} {Math.abs(f.delta).toLocaleString('da-DK')}
                    </span>
                  )}
                </div>

                <h3 className="text-[0.9375rem] font-semibold leading-snug text-dp-navy-900">{f.title}</h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-dp-navy-600">{f.body}</p>

                <div className="mt-4 flex items-center justify-between border-t border-dp-navy-50 pt-3">
                  <span className="text-[0.6875rem] text-dp-navy-400">Grundlag: {f.evidence}</span>
                  <a
                    href={`#${f.section}`}
                    className="text-[0.6875rem] font-semibold text-dp-navy-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    Se data →
                  </a>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </motion.ul>

      <Reveal delay={0.2}>
        <p className="mt-6 max-w-3xl text-[0.75rem] leading-relaxed text-dp-navy-400">
          Fund vises kun, når forskellen er mindst 2,5 procentpoint eller 18 % relativt, og når der
          er mindst fire udsendelser eller 25 personer bag hver side af sammenligningen. Det
          udelukker ikke tilfældigheder, men det udelukker de mest oplagte.
        </p>
      </Reveal>
    </>
  )
}
