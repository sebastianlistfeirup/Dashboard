/**
 * Hero: the whole picture in four numbers.
 *
 * "Ingen husker en masse tal. Vælg max tre-fire tal. Fremstil dine tal
 * dramatisk store." — designmanualen, side 27. Each figure sits on the
 * manual's horizontal band, whose filled length is the proportion itself.
 */
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { AnimatedNumber, Band, Reveal } from '@/components/primitives'
import { Sparkline } from '@/components/charts'
import { monthlyOf, type Dashboard, type Mailing, type PoolStats } from '@/lib/data'
import { motion as mo } from '@/design/tokens'

export function Hero({
  data, filtered, pool, filtersActive,
}: {
  data: Dashboard
  filtered: Mailing[]
  pool: PoolStats
  filtersActive: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 130])
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.25])

  const months = monthlyOf(filtered)
  const spark = months.slice(-14)
  const totals = data.overview.totals
  const delta = data.overview.recent.openRateDelta

  const figures = [
    {
      value: pool.count,
      label: 'udsendelser',
      sub: filtersActive ? 'i det valgte udsnit' : `${totals.drafts} kladder · ${totals.paused} på pause`,
      color: '#df790d',
      share: null as number | null,
      spark: spark.map((m) => m.count),
    },
    {
      value: pool.delivered,
      label: 'leverede mails',
      sub: `til ${totals.activeContacts.toLocaleString('da-DK')} aktive modtagere`,
      color: '#4c7bbd',
      share: null,
      spark: spark.map((m) => m.delivered),
    },
    {
      value: pool.openRate ?? 0,
      suffix: ' %',
      decimals: 1,
      label: 'åbningsrate',
      sub: delta !== null && !filtersActive
        ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('da-DK')} pct.point seneste 90 dage`
        : `${pool.opens.toLocaleString('da-DK')} åbninger i alt`,
      color: '#eab922',
      share: pool.openRate ?? 0,
      spark: spark.map((m) => m.openRate),
    },
    {
      value: pool.clickRate ?? 0,
      suffix: ' %',
      decimals: 1,
      label: 'klikrate',
      sub: `${pool.ctor?.toLocaleString('da-DK') ?? '–'} % af dem der åbner, klikker`,
      color: '#4fa388',
      share: (pool.clickRate ?? 0) * 4, // scaled so a low rate still reads as a band
      spark: spark.map((m) => m.clickRate),
    },
  ]

  return (
    <div ref={ref} className="relative overflow-hidden" style={{ background: '#16233a' }}>
      {/* Tone-in-tone light: the manual's "vælg en farve og kombiner den med en
          lysere udgave af samme farve", here as a slow, quiet gradient. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ y: reduced ? 0 : glowY, opacity: reduced ? 1 : glowOpacity }}
      >
        <div
          className="absolute -left-[15%] -top-[45%] h-[70rem] w-[70rem] rounded-full opacity-[0.30] blur-3xl"
          style={{ background: 'radial-gradient(circle, #2a4368 0%, transparent 62%)' }}
        />
        <div
          className="absolute -right-[18%] top-[12%] h-[52rem] w-[52rem] rounded-full opacity-[0.20] blur-3xl"
          style={{ background: 'radial-gradient(circle, #df790d 0%, transparent 66%)' }}
        />
      </motion.div>

      <div className="relative mx-auto w-full max-w-[80rem] px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <Reveal>
          <div className="kicker text-dp-orange">Overblik</div>
          <h1 className="mt-4 max-w-4xl text-display-lg font-semibold text-white">
            Sådan læser medlemmerne{' '}
            <span className="relative inline-block">
              <span className="relative z-10">det, vi sender</span>
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 -z-0 h-[0.32em] rounded-sm"
                style={{ background: '#df790d', transformOrigin: 'left center' }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, ease: mo.ease, delay: 0.5 }}
              />
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-dp-navy-300">
            {filtersActive
              ? 'Tallene nedenfor følger de filtre, du har valgt — hele siden viser kun det udsnit.'
              : `Alle udsendelser fra ${data.meta.account} i Ungapped: e-mail, sms og spørgeskemaer, samlet ét sted og opdateret hver time.`}
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:mt-16 lg:grid-cols-4 lg:gap-x-10">
          {figures.map((f, i) => (
            <Reveal key={f.label} delay={0.12 + i * 0.09}>
              <div className="text-center">
                <div
                  className="font-serif font-semibold leading-[0.9] tracking-tightest tnum"
                  style={{ color: f.color, fontSize: 'clamp(2.4rem, 5.4vw, 4.2rem)' }}
                >
                  <AnimatedNumber
                    value={f.value}
                    decimals={f.decimals ?? 0}
                    suffix={f.suffix ?? ''}
                    duration={1.4}
                  />
                </div>

                <Band
                  value={f.share ?? 100}
                  color={f.color}
                  track="rgba(255,255,255,0.14)"
                  height={8}
                  rounded={false}
                  className="mx-auto mt-4 w-full max-w-[12rem]"
                  delay={0.35 + i * 0.09}
                />

                <div className="mt-4 text-[0.9375rem] font-semibold text-white">{f.label}</div>
                <div className="mx-auto mt-1 max-w-[13rem] text-[0.8125rem] leading-snug text-dp-navy-300">
                  {f.sub}
                </div>

                {f.spark.filter((v) => v !== null).length > 2 && (
                  <div className="mt-3 flex justify-center opacity-70">
                    <Sparkline values={f.spark} color={f.color} width={104} height={22} />
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
