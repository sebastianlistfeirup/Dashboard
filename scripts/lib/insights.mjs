/**
 * Analyser der svarer på ledelsesspørgsmål.
 *
 * Everything here answers a question someone actually asks out loud: is this
 * good, are we getting better, who has stopped listening, what should we do
 * about it. Each one carries its own evidence and its own caveat, because a
 * number handed to a management group without either is worse than no number.
 */
import { pct } from './extract.mjs'

const round1 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10)
const round2 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100)
const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) ?? 0), 0)
const num = (n) => (n ?? 0).toLocaleString('da-DK')
const fmtPct = (n) => (n === null || n === undefined ? '–' : `${round1(n).toLocaleString('da-DK')} %`)

const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']

/* ── Mål ─────────────────────────────────────────────────────────────────── */

/**
 * Distance to target per KPI. "retning" says which way is good, so a bounce
 * rate under its target counts as reached rather than as a shortfall.
 */
export function buildTargets(pool, audience, config) {
  const defs = config?.maal ?? {}
  const actual = {
    openRate: pool.openRate,
    clickRate: pool.clickRate,
    ctor: pool.ctor,
    unsubRate: pool.unsubRate,
    bounceRate: audience?.totals?.bounceShare ?? pool.bounceRate,
  }

  return Object.entries(defs)
    .filter(([key]) => !key.startsWith('_') && actual[key] !== undefined)
    .map(([key, def]) => {
      const value = actual[key]
      const target = def.maal
      const up = def.retning !== 'ned'
      const reached = value === null ? null : up ? value >= target : value <= target
      const gap = value === null ? null : round2(up ? value - target : target - value)
      return {
        key,
        label: def.label ?? key,
        value,
        target,
        direction: up ? 'op' : 'ned',
        reached,
        gap,
        // How far along the way to the target, for the meter.
        progress: value === null ? null : up
          ? round1(Math.min(120, (value / target) * 100))
          : round1(Math.min(120, (target / Math.max(value, 0.0001)) * 100)),
      }
    })
}

/* ── Benchmark ───────────────────────────────────────────────────────────── */

/** DP's figures against the external yardsticks, with the source attached. */
export function buildBenchmarks(pool, config) {
  const b = config?.benchmarks
  if (!b?.kilder) return null

  const sources = Object.entries(b.kilder)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, src]) => ({
      key,
      name: src.navn,
      source: src.kilde,
      basis: src.grundlag,
      year: src.aar,
      url: src.url,
      notes: src.noter ?? {},
      metrics: Object.entries(src.tal ?? {}).map(([metric, external]) => {
        const own = pool[metric] ?? null
        return {
          metric,
          external,
          own,
          delta: own === null ? null : round1(own - external),
          ratio: own === null || !external ? null : round1(own / external),
        }
      }),
    }))

  return {
    primary: b.primaer ?? sources[0]?.key ?? null,
    caveat: b._forbehold ?? null,
    sources,
  }
}

/* ── Kohorter ────────────────────────────────────────────────────────────── */

/**
 * Do members who joined this year engage the way earlier cohorts did at the
 * same point in their membership? Comparing cohorts at equal tenure is the
 * only way to ask that without newer members losing simply for being newer.
 */
export function buildCohorts(engagement, tenureBuckets, minPeople = 25) {
  const rows = engagement.filter((e) => e.cohortYear && e.tenure && Object.keys(e.tenure).length)
  if (!rows.length) return null

  const byYear = new Map()
  for (const e of rows) {
    if (!byYear.has(e.cohortYear)) byYear.set(e.cohortYear, [])
    byYear.get(e.cohortYear).push(e)
  }

  const cohorts = [...byYear.entries()]
    .filter(([, group]) => group.length >= minPeople)
    .sort((a, b) => b[0] - a[0])
    .map(([year, group]) => ({
      year,
      people: group.length,
      buckets: tenureBuckets.map((b) => {
        const received = sum(group, (e) => e.tenure[b.key]?.received)
        const opened = sum(group, (e) => e.tenure[b.key]?.opened)
        const clicked = sum(group, (e) => e.tenure[b.key]?.clicked)
        return {
          key: b.key,
          label: b.label,
          received,
          openRate: pct(opened, received),
          clickRate: pct(clicked, received),
          // A cohort only reaches a bucket once it is old enough for it.
          reached: received > 0,
        }
      }),
    }))

  // The comparable window: the first three months, which every cohort has.
  const firstWindow = cohorts
    .map((c) => ({ year: c.year, people: c.people, ...(c.buckets.find((b) => b.key === '0-2') ?? {}) }))
    .filter((c) => c.received > 0)

  return {
    buckets: tenureBuckets,
    cohorts,
    firstWindow,
    minPeople,
    note: 'Hver årgang måles på det samme tidsvindue efter indmeldelse, så en ny årgang ikke taber bare fordi den er ny. Tallene kommer fra engagement-stikprøven.',
  }
}

/* ── Afsendernavne ───────────────────────────────────────────────────────── */

/** Does it matter whose name is in the From field? */
export function buildSenders(sent, minSendouts = 3, minDelivered = 20_000) {
  const map = new Map()
  for (const m of sent) {
    const name = (m.from?.name ?? '').trim()
    if (!name) continue
    if (!map.has(name)) map.set(name, [])
    map.get(name).push(m)
  }

  const rows = [...map.entries()].map(([name, group]) => {
    const delivered = sum(group, (m) => m.stats.delivered)
    const opens = sum(group, (m) => m.stats.opens)
    const clicks = sum(group, (m) => m.stats.clicks)
    return {
      name,
      count: group.length,
      delivered,
      openRate: pct(opens, delivered),
      clickRate: pct(clicks, delivered),
      ctor: pct(clicks, opens),
      types: [...new Set(group.map((m) => m.type))],
      comparable: group.length >= minSendouts && delivered >= minDelivered,
      lastUsed: group.reduce((max, m) => (m.when && m.when > max ? m.when : max), ''),
    }
  }).sort((a, b) => b.delivered - a.delivered)

  return { rows, minSendouts, minDelivered }
}

/* ── Genaktivering ───────────────────────────────────────────────────────── */

/**
 * Who has stopped listening, what it costs, and what removing them would do.
 * The share comes from the sample and is scaled to the whole base, so the
 * headcount is an estimate — it is labelled as one.
 */
export function buildReengagement(engagement, audience, config) {
  const cfg = config?.genaktivering ?? {}
  const months = cfg.maanederUdenAabning ?? 12
  const minReceived = cfg.minModtagneUdsendelser ?? 3
  const cutoff = Date.now() - months * 30.44 * 864e5

  const eligible = engagement.filter((e) => e.received >= minReceived)
  if (!eligible.length) return null

  const dormant = eligible.filter((e) => !e.lastOpenedAt || Date.parse(e.lastOpenedAt) < cutoff)
  const neverOpened = eligible.filter((e) => e.opened === 0)

  // What the headline rate would look like without them.
  const activeRows = eligible.filter((e) => !dormant.includes(e))
  const allReceived = sum(eligible, (e) => e.received)
  const allOpened = sum(eligible, (e) => e.opened)
  const keptReceived = sum(activeRows, (e) => e.received)
  const keptOpened = sum(activeRows, (e) => e.opened)

  const share = pct(dormant.length, eligible.length)
  const estimatedPeople = Math.round(((share ?? 0) / 100) * (audience?.totals?.active ?? 0))

  // Which groups the dormant sit in, so a re-engagement effort can be aimed.
  const groupBy = (keyOf) => {
    const counts = new Map()
    const totals = new Map()
    for (const e of eligible) {
      for (const k of [keyOf(e.profile)].flat()) {
        if (!k) continue
        totals.set(k, (totals.get(k) ?? 0) + 1)
        if (dormant.includes(e)) counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    return [...totals.entries()]
      .filter(([, total]) => total >= 25)
      .map(([name, total]) => ({
        name,
        dormant: counts.get(name) ?? 0,
        total,
        share: round1(pct(counts.get(name) ?? 0, total)),
      }))
      .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
  }

  return {
    monthsWithoutOpen: months,
    minReceived,
    sample: eligible.length,
    dormantInSample: dormant.length,
    neverOpenedInSample: neverOpened.length,
    dormantShare: share,
    estimatedPeople,
    currentOpenRate: pct(allOpened, allReceived),
    openRateWithoutDormant: pct(keptOpened, keptReceived),
    lift: round1((pct(keptOpened, keptReceived) ?? 0) - (pct(allOpened, allReceived) ?? 0)),
    byKontingent: groupBy((p) => p.kontingent),
    byAnciennitet: groupBy((p) => (p.indmeldt ? `${new Date(p.indmeldt).getUTCFullYear()}` : null)),
    byRegion: groupBy((p) => p.region),
    ideas: reengagementIdeas(share, months),
    caveat: `Andelen er målt på engagement-stikprøven og skaleret til hele bestanden, så hovedtallet er et skøn. Sovende betyder her: har modtaget mindst ${minReceived} udsendelser og ikke åbnet nogen i ${months} måneder.`,
  }
}

/**
 * Concrete first moves, in DP's own vocabulary. Not generic advice: each one
 * is something a membership organisation can actually send next week.
 */
function reengagementIdeas(share, months) {
  return [
    {
      title: 'Spørg, i stedet for at sende mere',
      body: `En kort mail med ét spørgsmål: "Hører du stadig gerne fra os — og om hvad?" Med tre svarknapper der sætter interesser i Ungapped. Den kan sendes til alle ${fmtPct(share)} på én gang og koster ingenting at lave.`,
      effort: 'lav',
    },
    {
      title: 'Skift emnelinje-stil på netop den gruppe',
      body: 'De sovende har set jeres normale emnelinjer i ' + months + ' måneder uden at reagere. Send den samme mail med en markant kortere, konkret emnelinje — under 30 tegn virker bedst i jeres egne tal.',
      effort: 'lav',
    },
    {
      title: 'Send det, der faktisk virker',
      body: 'TR/AMR Nyt og Selvstændige-indholdet har jeres højeste klikrater. Send de sovende ét stykke af det bedste indhold i stedet for det brede nyhedsbrev — relevans slår frekvens.',
      effort: 'mellem',
    },
    {
      title: 'Prøv en anden kanal',
      body: 'De medlemmer der har et mobilnummer, kan få én sms: "Vi savner dig i indbakken — vil du stadig have nyhedsbrevet?" Sms har ingen åbningsrate at gemme sig bag; enten svarer de, eller også ved I besked.',
      effort: 'mellem',
    },
    {
      title: 'Sæt en grænse, og ryd op',
      body: 'Beslut hvornår nok er nok — fx to genaktiveringsforsøg. Derefter flyttes de til en lavfrekvent liste med fire udsendelser om året i stedet for at blive fjernet. I beholder kontakten, og afsenderomdømmet holder op med at lide.',
      effort: 'lav',
    },
  ]
}

/* ── Alarmer ─────────────────────────────────────────────────────────────── */

/**
 * Things worth noticing the same week they happen. Each alert names the
 * sendout, the number, and what it is being compared with.
 */
export function buildAlerts(sent, byType, audience, config) {
  const cfg = config?.alarmer ?? {}
  if (cfg.aktiv === false) return { active: false, items: [] }

  const items = []
  const typeAverage = new Map(byType.map((t) => [t.key, t.openRate]))

  const under = cfg.udsendelseUnderNormal ?? {}
  const underDrop = under.relativFaldPct ?? 25
  const underMin = under.minLeverede ?? 1000
  for (const m of sent) {
    if (m.stats.delivered < underMin || m.stats.openRate === null) continue
    const avg = typeAverage.get(m.type)
    if (!avg) continue
    const drop = ((avg - m.stats.openRate) / avg) * 100
    if (drop >= underDrop) {
      items.push({
        kind: 'under-normal',
        severity: drop >= underDrop * 1.6 ? 'critical' : 'warning',
        title: 'Åbningsraten lå markant under normalen',
        subject: m.subject,
        id: m.id,
        when: m.when,
        value: m.stats.openRate,
        reference: round1(avg),
        detail: `${fmtPct(m.stats.openRate)} mod ${fmtPct(avg)} som er gennemsnittet for denne type — et fald på ${round1(drop)} %.`,
      })
    }
  }

  const wave = cfg.afmeldingsboelge ?? {}
  for (const m of sent) {
    if (m.stats.delivered < (wave.minLeverede ?? 1000)) continue
    if ((m.stats.unsubRate ?? 0) >= (wave.unsubRatePct ?? 0.5)) {
      items.push({
        kind: 'afmeldinger',
        severity: 'critical',
        title: 'Usædvanlig mange afmeldte sig',
        subject: m.subject,
        id: m.id,
        when: m.when,
        value: m.stats.unsubRate,
        reference: wave.unsubRatePct ?? 0.5,
        detail: `${num(m.stats.unsubscribes)} afmeldinger ud af ${num(m.stats.delivered)} leverede — ${fmtPct(m.stats.unsubRate)}.`,
      })
    }
  }

  const bounce = cfg.bounce ?? {}
  for (const m of sent) {
    if (m.stats.recipients < (bounce.minLeverede ?? 500)) continue
    if ((m.stats.bounceRate ?? 0) >= (bounce.bounceRatePct ?? 5)) {
      items.push({
        kind: 'bounce',
        severity: 'warning',
        title: 'Høj andel afviste adresser',
        subject: m.subject,
        id: m.id,
        when: m.when,
        value: m.stats.bounceRate,
        reference: bounce.bounceRatePct ?? 5,
        detail: `${num(m.stats.bounces)} af ${num(m.stats.recipients)} adresser blev afvist — ${fmtPct(m.stats.bounceRate)}.`,
      })
    }
  }

  const base = cfg.bestandBounce ?? {}
  if ((audience?.totals?.bounceShare ?? 0) >= (base.andelPct ?? 4)) {
    items.push({
      kind: 'bestand',
      severity: 'warning',
      title: 'Bounce-andelen i hele bestanden er for høj',
      subject: null,
      id: null,
      when: null,
      value: audience.totals.bounceShare,
      reference: base.andelPct ?? 4,
      detail: `${num(audience.totals.bounced)} af ${num(audience.totals.all)} adresser bouncer. Det trækker afsenderomdømmet ned for alle udsendelser.`,
    })
  }

  items.sort((a, b) => {
    const rank = { critical: 0, warning: 1 }
    return (rank[a.severity] - rank[b.severity]) || String(b.when ?? '').localeCompare(String(a.when ?? ''))
  })

  return {
    active: true,
    thresholds: cfg,
    items,
    recent: items.filter((i) => i.when && Date.now() - Date.parse(i.when) < 90 * 864e5),
  }
}

/* ── Månedens tekst ──────────────────────────────────────────────────────── */

/**
 * The month in prose. Written from the same figures the charts use, so it can
 * never drift from them — and kept to what actually changed.
 */
export function buildNarrative(monthly, byType, sent, alerts) {
  const withData = monthly.filter((m) => m.count > 0)
  if (withData.length < 2) return null

  const current = withData[withData.length - 1]
  const previous = withData[withData.length - 2]
  const [year, monthNo] = current.month.split('-').map(Number)
  const monthName = MONTHS[monthNo - 1] ?? current.month

  const openDelta = round1((current.openRate ?? 0) - (previous.openRate ?? 0))
  const clickDelta = round1((current.clickRate ?? 0) - (previous.clickRate ?? 0))
  const busier = current.count - previous.count

  const inMonth = sent.filter((m) => m.local?.yearMonth === current.month)
  const best = [...inMonth].filter((m) => m.stats.delivered >= 500)
    .sort((a, b) => (b.stats.openRate ?? 0) - (a.stats.openRate ?? 0))[0]

  // Which type moved the month, measured by how much its volume weighted the
  // average — so the sentence names a cause rather than a coincidence.
  const movers = Object.entries(current.byType ?? {})
    .map(([key, v]) => {
      const prev = previous.byType?.[key]
      const label = byType.find((t) => t.key === key)?.label ?? key
      if (!prev || v.openRate === null || prev.openRate === null) return null
      return { key, label, delta: round1(v.openRate - prev.openRate), count: v.count }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const mover = movers[0]

  const sentences = []
  sentences.push(
    busier === 0
      ? `${cap(monthName)} lå på samme niveau som måneden før med ${current.count} udsendelser til ${num(current.delivered)} modtagere.`
      : busier > 0
        ? `${cap(monthName)} var en travlere måned end den forrige: ${current.count} udsendelser mod ${previous.count}, i alt ${num(current.delivered)} leverede mails.`
        : `${cap(monthName)} var en roligere måned: ${current.count} udsendelser mod ${previous.count} måneden før, i alt ${num(current.delivered)} leverede mails.`,
  )

  if (Math.abs(openDelta) >= 1) {
    sentences.push(
      `Åbningsraten ${openDelta > 0 ? 'steg' : 'faldt'} ${Math.abs(openDelta).toLocaleString('da-DK')} procentpoint til ${fmtPct(current.openRate)}${mover && Math.abs(mover.delta) >= 3 ? `, trukket af ${mover.label}, der ${mover.delta > 0 ? 'lå' : 'lå'} ${Math.abs(mover.delta).toLocaleString('da-DK')} point ${mover.delta > 0 ? 'højere' : 'lavere'} end i den foregående måned` : ''}.`,
    )
  } else {
    sentences.push(`Åbningsraten lå stabilt på ${fmtPct(current.openRate)}.`)
  }

  if (Math.abs(clickDelta) >= 0.5) {
    sentences.push(`Klikraten ${clickDelta > 0 ? 'gik op' : 'gik ned'} til ${fmtPct(current.clickRate)}.`)
  }

  if (best) {
    sentences.push(`Månedens bedst åbnede udsendelse var "${best.subject}" med ${fmtPct(best.stats.openRate)}.`)
  }

  const monthAlerts = (alerts?.items ?? []).filter((a) => a.when && a.when.startsWith(current.month))
  if (monthAlerts.length) {
    sentences.push(
      monthAlerts.length === 1
        ? `Én udsendelse kræver opmærksomhed: ${monthAlerts[0].title.toLowerCase()}.`
        : `${monthAlerts.length} udsendelser kræver opmærksomhed — se alarmerne.`,
    )
  }

  return {
    month: current.month,
    monthName: `${cap(monthName)} ${year}`,
    text: sentences.join(' '),
    figures: {
      count: current.count,
      delivered: current.delivered,
      openRate: current.openRate,
      clickRate: current.clickRate,
      openDelta,
      clickDelta,
    },
    note: 'Teksten er skrevet automatisk ud fra de samme tal som graferne, så den kan ikke komme til at sige noget andet end dem.',
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
