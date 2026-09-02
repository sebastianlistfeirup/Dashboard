/**
 * Modtagerne.
 *
 * Who they are, who engages, and who leaves. Engagement is joined to the
 * membership profile from a stable sample of members, so the comparisons are
 * about groups rather than people — the published data holds no individual.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarRows, ChartCard, DataTable, Donut, fmtNum, fmtPct } from '@/components/charts'
import { AnimatedNumber, Band, Reveal, SectionHeading } from '@/components/primitives'
import { monthLabel, type Bucket, type Dashboard, type EngagementGroup } from '@/lib/data'
import { motion as mo } from '@/design/tokens'
import { Empty } from './Performance'

const PROFILE_VIEWS = [
  { key: 'medlemstype', label: 'Medlemstype', color: '#4c7bbd', note: 'Kontingentgruppen i medlemssystemet' },
  { key: 'region', label: 'Region', color: '#179fa0', note: null },
  { key: 'alder', label: 'Alder', color: '#df790d', note: null },
  { key: 'anciennitet', label: 'Anciennitet', color: '#4e4897', note: 'År siden indmeldelse' },
  { key: 'sektioner', label: 'Sektioner', color: '#d24e46', note: 'Et medlem kan være i flere' },
  { key: 'koen', label: 'Køn', color: '#3a557d', note: null },
] as const

const ENGAGEMENT_VIEWS = [
  { key: 'byMedlemstype', label: 'Medlemstype', color: '#4c7bbd' },
  { key: 'byRegion', label: 'Region', color: '#179fa0' },
  { key: 'byAlder', label: 'Alder', color: '#df790d' },
  { key: 'byAnciennitet', label: 'Anciennitet', color: '#4e4897' },
  { key: 'bySektion', label: 'Sektion', color: '#d24e46' },
  { key: 'byKoen', label: 'Køn', color: '#3a557d' },
] as const

export function Audience({ data }: { data: Dashboard }) {
  const { audience } = data
  const eng = audience.engagement
  const [profileView, setProfileView] = useState<string>('medlemstype')
  const [engView, setEngView] = useState<string>('byMedlemstype')
  const [engMetric, setEngMetric] = useState<'openRate' | 'clickRate'>('clickRate')

  const profileDef = PROFILE_VIEWS.find((v) => v.key === profileView)!
  const profileRows: Bucket[] = audience.profile[profileView] ?? []
  const engDef = ENGAGEMENT_VIEWS.find((v) => v.key === engView)!
  const engRows: EngagementGroup[] = (eng?.[engView as keyof typeof eng] as EngagementGroup[]) ?? []

  return (
    <>
      <SectionHeading
        kicker="Modtagerne"
        title="Hvem læser med"
        lead={`${fmtNum(audience.totals.all)} kontakter i alt. Profilen kommer fra medlemsoplysningerne i Ungapped; engagementet fra en fast stikprøve på ${fmtNum(eng?.sample ?? 0)} medlemmer, hvor hver enkelt udsendelse er talt op.`}
      />

      {/* Bestanden */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Aktive modtagere', value: audience.totals.active, color: '#179fa0', sub: 'kan modtage e-mail' },
          { label: 'Afmeldte', value: audience.totals.blocked, color: '#d24e46', sub: `${fmtPct(audience.totals.blockedShare)} af alle` },
          { label: 'Bouncer', value: audience.totals.bounced, color: '#df790d', sub: `${fmtPct(audience.totals.bounceShare)} af alle` },
          { label: 'Kan modtage sms', value: audience.totals.smsReachable, color: '#4c7bbd', sub: `${fmtPct((audience.totals.smsReachable / Math.max(1, audience.totals.active)) * 100)} af de aktive` },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06}>
            <div className="card p-5">
              <div className="font-serif text-[2rem] font-semibold leading-none tnum" style={{ color: s.color }}>
                <AnimatedNumber value={s.value} />
              </div>
              <Band
                value={(s.value / Math.max(1, audience.totals.all)) * 100}
                color={s.color}
                track="#e7ebef"
                height={6}
                className="mt-3"
                delay={i * 0.06}
              />
              <div className="mt-3 text-[0.8125rem] font-semibold text-dp-navy-900">{s.label}</div>
              <div className="text-[0.75rem] text-dp-navy-500">{s.sub}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Profil */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <ChartCard
          title="Sådan ser medlemsbestanden ud"
          subtitle={profileDef.note ?? undefined}
          actions={
            <select
              value={profileView}
              onChange={(e) => setProfileView(e.target.value)}
              className="rounded-full border border-dp-navy-200 bg-white px-3 py-1 text-[0.75rem] font-semibold text-dp-navy-700 outline-none"
              aria-label="Vælg opdeling"
            >
              {PROFILE_VIEWS.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
          }
          table={
            <DataTable
              columns={[{ key: 'g', label: 'Gruppe' }, { key: 'n', label: 'Antal', align: 'right' }, { key: 's', label: 'Andel', align: 'right' }]}
              rows={profileRows.map((r) => ({ g: r.name, n: fmtNum(r.n), s: fmtPct(r.share) }))}
            />
          }
        >
          {profileRows.length ? (
            <BarRows
              rows={profileRows.slice(0, 12).map((r) => ({
                label: r.name,
                value: r.n,
                color: r.isOther ? '#aebdd4' : profileDef.color,
                note: `${fmtPct(r.share)} af bestanden`,
              }))}
              valueFormat={(n) => fmtNum(n)}
            />
          ) : <Empty>Ingen data på denne opdeling.</Empty>}
        </ChartCard>

        <ChartCard
          title="Hvem åbner og klikker mest"
          subtitle={`Stikprøve på ${fmtNum(eng?.sample ?? 0)} medlemmer. Grupper under ${eng?.minPeople ?? 25} personer er lagt sammen.`}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={engView}
                onChange={(e) => setEngView(e.target.value)}
                className="rounded-full border border-dp-navy-200 bg-white px-3 py-1 text-[0.75rem] font-semibold text-dp-navy-700 outline-none"
                aria-label="Vælg opdeling"
              >
                {ENGAGEMENT_VIEWS.map((v) => (
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </select>
              <div className="inline-flex rounded-full border border-dp-navy-200 bg-white p-0.5">
                {([['openRate', 'Åbner'], ['clickRate', 'Klikker']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEngMetric(k)}
                    className="relative rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold transition-colors"
                    style={{ color: engMetric === k ? '#fff' : '#4a5a72' }}
                  >
                    {engMetric === k && (
                      <motion.span layoutId="eng-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                    )}
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          }
          table={
            <DataTable
              columns={[
                { key: 'g', label: 'Gruppe' },
                { key: 'p', label: 'Personer', align: 'right' },
                { key: 'm', label: 'Mails pr. person', align: 'right' },
                { key: 'o', label: 'Åbner', align: 'right' },
                { key: 'c', label: 'Klikker', align: 'right' },
                { key: 'n', label: 'Har aldrig åbnet', align: 'right' },
              ]}
              rows={engRows.map((r) => ({
                g: r.name, p: fmtNum(r.people), m: r.mailsPerPerson?.toLocaleString('da-DK') ?? '–',
                o: fmtPct(r.openRate), c: fmtPct(r.clickRate), n: fmtPct(r.neverOpened),
              }))}
            />
          }
        >
          {!eng ? (
            <Empty>Engagement-stikprøven kunne ikke hentes ved sidste opdatering.</Empty>
          ) : engRows.length ? (
            <BarRows
              rows={[...engRows]
                .sort((a, b) => (b[engMetric] ?? 0) - (a[engMetric] ?? 0))
                .map((r) => ({
                  label: r.name,
                  value: r[engMetric],
                  color: r.isOther ? '#aebdd4' : engDef.color,
                  n: r.people,
                  note: `${r.mailsPerPerson?.toLocaleString('da-DK') ?? '–'} mails pr. person · ${fmtPct(r.neverOpened)} har aldrig åbnet`,
                }))}
            />
          ) : <Empty>Ingen grupper er store nok til en sammenligning på denne opdeling.</Empty>}
        </ChartCard>
      </div>

      {/* Engagementfordeling */}
      {eng && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <ChartCard title="Hvor engagerede er de?" subtitle={`Fordelt på ${fmtNum(eng.withMail)} medlemmer, der har modtaget mindst én udsendelse.`}>
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Donut
                slices={eng.distribution.map((d, i) => ({
                  label: d.label,
                  value: d.n,
                  color: ['#d4dbe1', '#aebdd4', '#8299bb', '#4c7bbd', '#179fa0'][i] ?? '#8299bb',
                }))}
                size={168}
                thickness={26}
                centreValue={fmtPct(eng.overall.openRate)}
                centreLabel="åbner i gennemsnit"
              />
              <ul className="min-w-0 flex-1 space-y-2">
                {eng.distribution.map((d, i) => (
                  <li key={d.label} className="flex items-center gap-2.5 text-[0.8125rem]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: ['#d4dbe1', '#aebdd4', '#8299bb', '#4c7bbd', '#179fa0'][i] ?? '#8299bb' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-dp-navy-700">{d.label}</span>
                    <span className="tnum shrink-0 font-semibold text-dp-navy-900">{fmtPct(d.share, 0)}</span>
                    <span className="tnum w-12 shrink-0 text-right text-[0.6875rem] text-dp-navy-400">{fmtNum(d.n)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ChartCard>

          <ChartCard
            title="Nøgletal for stikprøven"
            subtitle="Målt over alle udsendelser, hvert medlem har modtaget."
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                { label: 'Mails pr. medlem', value: eng.overall.mailsPerPerson ?? 0, suffix: '', decimals: 1, color: '#4c7bbd' },
                { label: 'Åbner i snit', value: eng.overall.openRate ?? 0, suffix: ' %', decimals: 1, color: '#eab922' },
                { label: 'Klikker i snit', value: eng.overall.clickRate ?? 0, suffix: ' %', decimals: 1, color: '#4fa388' },
                { label: 'Har aldrig åbnet', value: eng.overall.neverOpened ?? 0, suffix: ' %', decimals: 1, color: '#d24e46' },
              ].map((s, i) => (
                <div key={s.label}>
                  <div className="font-serif text-[1.75rem] font-semibold leading-none tnum" style={{ color: s.color }}>
                    <AnimatedNumber value={s.value} decimals={s.decimals} suffix={s.suffix} />
                  </div>
                  <Band value={s.suffix ? s.value : s.value * 8} color={s.color} track="#e7ebef" height={5} className="mt-2.5" delay={i * 0.06} />
                  <div className="mt-2 text-[0.75rem] leading-snug text-dp-navy-600">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-dp-navy-50 pt-4 text-[0.75rem] leading-relaxed text-dp-navy-500">
              Stikprøven er den samme fra opdatering til opdatering — den vælges ved at sortere
              kontakterne efter en hashværdi af deres id. Bevægelse i tallene er derfor
              adfærd og ikke en ny stikprøve.
            </p>
          </ChartCard>
        </div>
      )}

      {/* Afmeldinger */}
      <div className="mt-10">
        <SectionHeading
          kicker="Afmeldinger"
          title="Hvem forlader os, og hvorfor"
          lead="Udmeldelsesgrunden kommer fra medlemssystemet. Grupper under fem personer er lagt sammen, så ingen kan udpeges."
          color="#d24e46"
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title="Angivne udmeldelsesgrunde"
            subtitle="Hyppigst først."
            table={
              <DataTable
                columns={[{ key: 'r', label: 'Grund' }, { key: 'n', label: 'Antal', align: 'right' }, { key: 's', label: 'Andel', align: 'right' }]}
                rows={audience.churn.reasons.map((r) => ({ r: r.name, n: fmtNum(r.n), s: fmtPct(r.share) }))}
              />
            }
          >
            {audience.churn.reasons.length ? (
              <BarRows
                rows={audience.churn.reasons.slice(0, 10).map((r) => ({
                  label: r.name,
                  value: r.n,
                  color: r.isOther ? '#aebdd4' : '#d24e46',
                  note: `${fmtPct(r.share)} af de angivne grunde`,
                }))}
                valueFormat={(n) => fmtNum(n)}
              />
            ) : <Empty>Ingen udmeldelsesgrunde er registreret.</Empty>}
          </ChartCard>

          <ChartCard
            title="Hvem afmelder sig"
            subtitle="Profilen for de afmeldte, holdt op mod bestanden som helhed."
          >
            <ChurnComparison
              blocked={audience.churn.blockedProfile}
              overall={audience.profile}
            />
          </ChartCard>
        </div>

        {audience.churn.byMonth.length > 1 && (
          <ChartCard
            className="mt-5"
            title="Afmeldinger over tid"
            subtitle="Registrerede udmeldelsesdatoer pr. måned."
          >
            <div className="thin-scroll flex h-40 items-end gap-1 overflow-x-auto pb-2">
              {audience.churn.byMonth.slice(-48).map((m, i) => {
                const max = Math.max(...audience.churn.byMonth.slice(-48).map((x) => x.n), 1)
                return (
                  <div key={m.month} className="group flex min-w-[0.6rem] flex-1 flex-col items-center justify-end gap-1">
                    <span className="tnum text-[0.625rem] text-dp-navy-400 opacity-0 transition-opacity group-hover:opacity-100">
                      {m.n}
                    </span>
                    <motion.div
                      className="w-full rounded-t-[3px] bg-dp-rod-60 transition-colors group-hover:bg-dp-rod"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${(m.n / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: mo.ease, delay: Math.min(0.5, i * 0.012) }}
                      title={`${monthLabel(m.month)}: ${m.n} afmeldinger`}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-[0.6875rem] text-dp-navy-400">
              <span>{monthLabel(audience.churn.byMonth.slice(-48)[0]?.month ?? '')}</span>
              <span>{monthLabel(audience.churn.byMonth[audience.churn.byMonth.length - 1]?.month ?? '')}</span>
            </div>
          </ChartCard>
        )}
      </div>
    </>
  )
}

/**
 * Over- or under-representation among the unsubscribed. A group that is 20 % of
 * the base but 35 % of those who left is the thing worth seeing, so the chart
 * shows the difference rather than two bar sets to compare by eye.
 */
function ChurnComparison({ blocked, overall }: {
  blocked: Record<string, Bucket[]>
  overall: Record<string, Bucket[]>
}) {
  const [dim, setDim] = useState('medlemstype')
  const dims = [
    { key: 'medlemstype', label: 'Medlemstype' },
    { key: 'region', label: 'Region' },
    { key: 'alder', label: 'Alder' },
    { key: 'anciennitet', label: 'Anciennitet' },
  ].filter((d) => (blocked[d.key] ?? []).length > 0)

  const blockedRows = blocked[dim] ?? []
  const overallRows = overall[dim] ?? []
  const overallShare = new Map(overallRows.map((r) => [r.name, r.share ?? 0]))

  const rows = blockedRows
    .filter((r) => !r.isOther && overallShare.has(r.name))
    .map((r) => ({
      name: r.name,
      blockedShare: r.share ?? 0,
      baseShare: overallShare.get(r.name) ?? 0,
      diff: (r.share ?? 0) - (overallShare.get(r.name) ?? 0),
      n: r.n,
    }))
    .sort((a, b) => b.diff - a.diff)

  if (!dims.length || !rows.length) return <Empty>For lidt data om de afmeldte til en sammenligning.</Empty>

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.diff)), 1)

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {dims.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDim(d.key)}
            className="relative rounded-full px-3 py-1 text-[0.6875rem] font-semibold transition-colors"
            style={{ color: dim === d.key ? '#fff' : '#4a5a72' }}
          >
            {dim === d.key && (
              <motion.span layoutId="churn-pill" className="absolute inset-0 rounded-full bg-dp-navy-600"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{d.label}</span>
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {rows.slice(0, 8).map((r, i) => (
          <li key={r.name}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="min-w-0 truncate text-dp-navy-800" title={r.name}>{r.name}</span>
              <span
                className="tnum shrink-0 font-semibold"
                style={{ color: r.diff > 0 ? '#d24e46' : '#179fa0' }}
              >
                {r.diff > 0 ? '+' : '−'}{Math.abs(r.diff).toLocaleString('da-DK', { maximumFractionDigits: 1 })} pct.point
              </span>
            </div>
            {/* Diverging bar: right of centre = over-represented among leavers. */}
            <div className="relative h-2.5 rounded-full bg-dp-navy-100">
              <span className="absolute left-1/2 top-0 h-full w-px bg-dp-navy-300" />
              <motion.div
                className="absolute top-0 h-full rounded-full"
                style={{
                  background: r.diff > 0 ? '#d24e46' : '#179fa0',
                  left: r.diff > 0 ? '50%' : undefined,
                  right: r.diff <= 0 ? '50%' : undefined,
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(Math.abs(r.diff) / maxAbs) * 48}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: mo.ease, delay: i * 0.05 }}
              />
            </div>
            <div className="mt-1 text-[0.6875rem] text-dp-navy-400">
              {fmtPct(r.blockedShare)} af de afmeldte mod {fmtPct(r.baseShare)} af bestanden · {fmtNum(r.n)} personer
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[0.6875rem] text-dp-navy-400">
        Rødt til højre: gruppen fylder mere blandt de afmeldte end i bestanden. Grønt til venstre:
        gruppen bliver hængende.
      </p>
    </div>
  )
}
