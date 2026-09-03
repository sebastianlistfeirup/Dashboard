/**
 * SMS og spørgeskemaer.
 *
 * The other two channels DP runs in Ungapped. They are smaller than e-mail and
 * measured differently — SMS has no open rate, and a survey's currency is
 * responses — so they get their own frames rather than being forced into the
 * e-mail metrics.
 */
import { motion } from 'framer-motion'
import { DataTable, fmtNum, fmtPct } from '@/components/charts'
import { AnimatedNumber, Band, ChartCard, Reveal, SectionHeading } from '@/components/primitives'
import { formatDate, type Dashboard } from '@/lib/data'
import { motion as mo } from '@/design/tokens'
import { Empty } from './Performance'

export function SmsSection({ data }: { data: Dashboard }) {
  const sent = data.sms.filter((s) => s.wasSent)
  const drafts = data.sms.filter((s) => !s.wasSent && s.stats.recipients === 0)

  /**
   * Ungapped tæller tre forskellige ting, og de må ikke blandes sammen.
   *
   * `recipients` er segmentets størrelse, `unique` er de numre der faktisk blev
   * skrevet til — derfor melder Ungapped selv "sendt" på over 100 % på flere
   * udsendelser. Numrene er dem der blev skrevet til.
   *
   * `bounced` er ContactsUniqueBouncedCount: kontakter i segmentet hvis nummer
   * er registreret som bouncet, akkumuleret på kontakten over tid — ikke fejl i
   * netop denne afsendelse. Dividerede man den med segmentstørrelsen, fik man
   * 57 % fejlede, samtidig med at hver enkelt sms viste 0 %. Tallet står nu som
   * en optælling, og fejlraten er Ungapps egen pr. udsendelse, vægtet efter
   * hvor mange numre den ramte.
   */
  const numbers = sent.reduce((s, x) => s + (x.stats.unique ?? x.stats.recipients), 0)
  const bounced = sent.reduce((s, x) => s + x.stats.bounced, 0)
  const failWeighted = numbers
    ? sent.reduce((s, x) => s + (x.stats.failRate ?? 0) * (x.stats.unique ?? x.stats.recipients), 0) / numbers
    : null
  const avgLength = sent.length ? Math.round(sent.reduce((s, x) => s + x.length, 0) / sent.length) : 0

  return (
    <>
      <SectionHeading
        moduleId="sms"
        kicker="SMS"
        title="Beskeder der lander i lommen"
        lead={`${fmtNum(data.sms.length)} sms'er i Ungapped, heraf ${fmtNum(sent.length)} sendt. ${fmtNum(data.audience.totals.smsReachable)} kontakter har et mobilnummer, vi må skrive til.`}
        color="#4fa388"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sendte sms'er", value: sent.length, color: '#4fa388', sub: `${drafts.length} kladder` },
          { label: 'Numre skrevet til', value: numbers, color: '#4c7bbd', sub: sent.length ? `${fmtNum(Math.round(numbers / sent.length))} pr. udsendelse` : '—' },
          { label: 'Kan modtage sms', value: data.audience.totals.smsReachable, color: '#df790d', sub: `${fmtPct((data.audience.totals.smsReachable / Math.max(1, data.audience.totals.active)) * 100)} af de aktive` },
          { label: 'Bouncede numre', value: bounced, color: '#d24e46', sub: failWeighted === null ? '—' : `fejlrate ${fmtPct(failWeighted)} på selve afsendelserne` },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06}>
            <div className="card p-5">
              <div className="font-serif text-[2rem] font-semibold leading-none tnum" style={{ color: s.color }}>
                <AnimatedNumber value={s.value} />
              </div>
              <Band value={100} color={s.color} track="#e7ebef" height={5} className="mt-3" delay={i * 0.06} />
              <div className="mt-3 text-[0.8125rem] font-semibold text-dp-navy-900">{s.label}</div>
              <div className="text-[0.75rem] text-dp-navy-500">{s.sub}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <ChartCard
        className="mt-5"
        title="Sendte sms'er"
        subtitle={`Gennemsnitlig længde ${avgLength} tegn — hver påbegyndt 160 tegn koster en ekstra takst.`}
        table={
          <DataTable
            columns={[
              { key: 'd', label: 'Dato' },
              { key: 's', label: 'Emne' },
              { key: 'r', label: 'Modtagere', align: 'right' },
              { key: 'l', label: 'Tegn', align: 'right' },
              { key: 'f', label: 'Fejlrate', align: 'right' },
            ]}
            rows={sent.map((s) => ({
              d: formatDate(s.when), s: s.subject, r: fmtNum(s.stats.recipients),
              l: fmtNum(s.length), f: fmtPct(s.stats.failRate, 2),
            }))}
          />
        }
      >
        {!sent.length ? (
          <Empty>Ingen sendte sms'er.</Empty>
        ) : (
          <ul className="space-y-3">
            {[...sent]
              .sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))
              .slice(0, 12)
              .map((s, i) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, ease: mo.ease, delay: Math.min(0.35, i * 0.05) }}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-xl border border-dp-navy-50 bg-dp-navy-50/40 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[0.8125rem] font-semibold text-dp-navy-900">{s.subject}</span>
                      <span className="text-[0.6875rem] text-dp-navy-400">{formatDate(s.when)}</span>
                      {s.category && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[0.625rem] font-medium text-dp-navy-600">
                          {s.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[0.75rem] leading-relaxed text-dp-navy-600">{s.body}</p>
                  </div>
                  <dl className="flex shrink-0 gap-5 text-center">
                    <div>
                      <dd className="tnum text-[0.9375rem] font-semibold text-dp-navy-900">{fmtNum(s.stats.recipients)}</dd>
                      <dt className="text-[0.625rem] text-dp-navy-400">modtagere</dt>
                    </div>
                    <div>
                      <dd className="tnum text-[0.9375rem] font-semibold text-dp-navy-900">{s.length}</dd>
                      <dt className="text-[0.625rem] text-dp-navy-400">tegn · {s.segments} takst</dt>
                    </div>
                    <div>
                      <dd className="tnum text-[0.9375rem] font-semibold" style={{ color: (s.stats.failRate ?? 0) > 2 ? '#d24e46' : '#179fa0' }}>
                        {fmtPct(s.stats.failRate, 1)}
                      </dd>
                      <dt className="text-[0.625rem] text-dp-navy-400">fejlrate</dt>
                    </div>
                  </dl>
                </motion.li>
              ))}
          </ul>
        )}
      </ChartCard>

      <p className="mt-4 max-w-3xl text-[0.6875rem] leading-relaxed text-dp-navy-400">
        Sms har ingen åbningsrate — der findes ingen sporingspixel i en tekstbesked. Ungapped
        rapporterer leverance og fejl, og hvis beskeden indeholder et link, kan klik spores
        gennem linkforkorteren.
      </p>
    </>
  )
}

/* ── Spørgeskemaer ───────────────────────────────────────────────────────── */

export function Surveys({ data }: { data: Dashboard }) {
  const withResponses = data.surveys.filter((s) => s.responses > 0)
  const totalResponses = data.surveys.reduce((s, x) => s + x.responses, 0)
  const active = data.surveys.filter((s) => s.isActive)
  const maxResponses = Math.max(1, ...data.surveys.map((s) => s.responses))

  return (
    <>
      <SectionHeading
        moduleId="sporgeskemaer"
        kicker="Spørgeskemaer"
        title="Hvad medlemmerne svarer"
        lead={`${fmtNum(data.surveys.length)} spørgeskemaer i Ungapped med ${fmtNum(totalResponses)} besvarelser i alt. ${fmtNum(active.length)} er aktive lige nu.`}
        color="#4e4897"
      />

      {!data.surveys.length ? (
        <Empty>Ingen spørgeskemaer i kontoen.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...data.surveys]
            .sort((a, b) => b.responses - a.responses)
            .map((s, i) => (
              <Reveal key={s.id} delay={Math.min(0.4, i * 0.05)}>
                <article className="card card-hover h-full p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold leading-snug text-dp-navy-900">{s.title}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-dp-navy-400">
                        <span>{s.statusName}</span>
                        {s.questionCount !== null && <><span>·</span><span>{s.questionCount} spørgsmål</span></>}
                        {s.lastModified && <><span>·</span><span>ændret {formatDate(s.lastModified)}</span></>}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[0.625rem] font-semibold"
                      style={{
                        background: s.isActive ? '#e0eded' : '#f4f1f1',
                        color: s.isActive ? '#179fa0' : '#7a8798',
                      }}
                    >
                      {s.isActive ? 'Aktiv' : s.statusName}
                    </span>
                  </div>

                  <div className="mt-5 flex items-end gap-6">
                    <div>
                      <div className="font-serif text-[2rem] font-semibold leading-none tnum text-dp-lilla">
                        <AnimatedNumber value={s.responses} />
                      </div>
                      <div className="mt-1 text-[0.6875rem] text-dp-navy-500">besvarelser</div>
                    </div>
                    <div>
                      <div className="font-serif text-[1.25rem] font-semibold leading-none tnum text-dp-navy-700">
                        {fmtNum(s.respondents)}
                      </div>
                      <div className="mt-1 text-[0.6875rem] text-dp-navy-500">respondenter</div>
                    </div>
                    {s.responseLimit > 0 && (
                      <div>
                        <div className="font-serif text-[1.25rem] font-semibold leading-none tnum text-dp-navy-700">
                          {fmtPct((s.responses / s.responseLimit) * 100, 0)}
                        </div>
                        <div className="mt-1 text-[0.6875rem] text-dp-navy-500">af grænsen</div>
                      </div>
                    )}
                  </div>

                  <Band
                    value={(s.responses / maxResponses) * 100}
                    color="#4e4897"
                    track="#e7ebef"
                    height={7}
                    className="mt-4"
                    delay={i * 0.04}
                  />

                  {s.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {s.tags.map((t) => (
                        <span key={t} className="rounded-full bg-dp-lilla-15 px-2 py-0.5 text-[0.625rem] font-medium text-dp-lilla">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
        </div>
      )}

      {withResponses.length > 0 && (
        <p className="mt-5 max-w-3xl text-[0.6875rem] leading-relaxed text-dp-navy-400">
          Antallet af besvarelser er hentet fra Ungapped. Selve svarene bliver ikke hentet ind i
          dashboardet — de kan indeholde fritekst om enkeltpersoner, og de hører hjemme i Ungapped,
          hvor adgangen er styret.
        </p>
      )}
    </>
  )
}
