/**
 * Aggregation and findings.
 *
 * Everything the dashboard shows is computed here, from already-anonymised
 * inputs. Two rules run through the whole file:
 *
 *  1. A rate is only reported when it rests on enough sendouts or people to
 *     mean anything; below the threshold the group is reported as "for lille".
 *  2. Groups smaller than `minBucket` are folded into a single "andre"-row, so
 *     a handful of members can never be singled out from the published file.
 */
import { MAILING_TYPES, resolveType } from './types.mjs'
import { buildLinkCatalogue } from './links.mjs'
import { pct } from './extract.mjs'
import { buildFindings } from './findings.mjs'
import {
  buildAlerts, buildBenchmarks, buildCohorts, buildNarrative, buildReengagement,
  buildSenders, buildTargets,
} from './insights.mjs'
import { buildCrossTabs } from './crosstab.mjs'
import { TENURE_MONTH_BUCKETS } from './tenure.mjs'

/** Minimum sendouts before a rate comparison is reported as a finding. */
const MIN_SENDOUTS = 4
/**
 * Minimum delivered mails before a group is comparable.
 *
 * Counting sendouts alone is not enough, and this is the single most important
 * guard in the file. DP's flow and welcome mails go to a few hundred people and
 * are opened far more often than a newsletter to thirteen thousand — so eleven
 * personalised sendouts totalling 2.075 mails "proved" that personalisation
 * lifts opening by 25 percentage points, and eight Sunday sendouts to 1.043
 * people made Sunday the best day to send. Neither is true. A side of a
 * comparison has to carry real volume before it may speak.
 */
const MIN_DELIVERED = 20_000
/** Minimum sampled people before an engagement rate is reported. */
const MIN_PEOPLE = 25

/** Both sides of a comparison must clear the bar for the result to mean anything. */
const comparable = (stats) => stats.count >= MIN_SENDOUTS && stats.delivered >= MIN_DELIVERED

const sum = (xs, f = (x) => x) => xs.reduce((s, x) => s + (f(x) ?? 0), 0)
const mean = (xs, f = (x) => x) => (xs.length ? sum(xs, f) / xs.length : null)
const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10)
const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100)

/** Weighted rate across sendouts: total events over total delivered. */
function poolRate(mailings, field) {
  const delivered = sum(mailings, (m) => m.stats.delivered)
  const events = sum(mailings, (m) => m.stats[field])
  return pct(events, delivered)
}

function poolStats(mailings) {
  const delivered = sum(mailings, (m) => m.stats.delivered)
  const opens = sum(mailings, (m) => m.stats.opens)
  const clicks = sum(mailings, (m) => m.stats.clicks)
  return {
    count: mailings.length,
    recipients: sum(mailings, (m) => m.stats.recipients),
    delivered,
    opens,
    clicks,
    unsubscribes: sum(mailings, (m) => m.stats.unsubscribes),
    bounces: sum(mailings, (m) => m.stats.bounces),
    openRate: pct(opens, delivered),
    clickRate: pct(clicks, delivered),
    ctor: pct(clicks, opens),
    unsubRate: round2(pct(sum(mailings, (m) => m.stats.unsubscribes), delivered)),
    bounceRate: round2(pct(sum(mailings, (m) => m.stats.bounces), sum(mailings, (m) => m.stats.recipients))),
  }
}

/** Group items, fold small groups together, and sort by size. */
function bucket(items, keyOf, { minBucket = 5, otherLabel = 'Ikke oplyst / for få' } = {}) {
  const map = new Map()
  for (const item of items) {
    const keys = keyOf(item)
    for (const k of Array.isArray(keys) ? keys : [keys]) {
      const key = k === null || k === undefined || k === '' ? '__missing__' : String(k)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  const rows = []
  let folded = 0
  for (const [name, n] of map) {
    if (name === '__missing__' || n < minBucket) { folded += n; continue }
    rows.push({ name, n })
  }
  rows.sort((a, b) => b.n - a.n)
  if (folded > 0) rows.push({ name: otherLabel, n: folded, isOther: true })
  const total = sum(rows, (r) => r.n)
  return rows.map((r) => ({ ...r, share: round1(pct(r.n, total)) }))
}

/* ── Hovedfunktion ───────────────────────────────────────────────────────── */

export function buildAnalysis(input) {
  const { minBucket } = input

  // Resolve the type once; from here on the dashboard just reads it.
  const mailings = input.mailings.map((m) => ({
    ...m,
    type: resolveType({ tags: m.tags, journey: m.journey, category: m.category }),
  }))

  // A sendout counts when it actually delivered mail. Ungapped parks a
  // journey's mails at status 60 once the journey is stopped, but those have
  // already reached thousands of members — excluding them would hide every flow.
  const sent = mailings.filter((m) => m.stats.delivered > 0)
  const measurable = sent.filter((m) => m.stats.delivered >= 30)

  const analysis = {
    types: MAILING_TYPES,
    mailings,
    sms: input.sms,
    surveys: input.surveys,
    lists: input.lists,
    segments: input.segments,
    tags: input.tags,
    categories: input.categories,

    overview: buildOverview(mailings, sent, input),
    byType: buildByType(sent),
    trends: buildTrends(sent),
    // Journey mails fire whenever a member qualifies, so their send time is not
    // a decision anyone made — including them would let eight tiny welcome
    // mails outrank a newsletter to 13.000 people.
    timing: buildTiming(measurable.filter((m) => !m.journey)),
    subjects: buildSubjects(measurable),
    content: buildContent(measurable),
    audience: buildAudience(input.contacts, input.engagement, minBucket),
    segmentPerformance: buildSegmentPerformance(sent, input.lists),
  }

  // Everything below reads the finished aggregation, so a figure can never
  // disagree with the chart it sits next to.
  const config = input.config ?? {}
  analysis.targets = buildTargets(analysis.overview.pool, analysis.audience, config)
  analysis.benchmarks = buildBenchmarks(analysis.overview.pool, config)
  analysis.senders = buildSenders(sent)
  analysis.alerts = buildAlerts(sent, analysis.byType, analysis.audience, config)
  analysis.cohorts = buildCohorts(input.engagement, TENURE_MONTH_BUCKETS, MIN_PEOPLE)
  analysis.reengagement = buildReengagement(input.engagement, analysis.audience, config)
  analysis.crossTabs = buildCrossTabs(input.engagement, profileValue, MIN_PEOPLE)
  analysis.narrative = buildNarrative(analysis.trends.monthly, analysis.byType, sent, analysis.alerts)

  // Findings read the finished aggregation, so they can compare across sections.
  analysis.findings = buildFindings(analysis)
  return analysis
}

/* ── Overblik ────────────────────────────────────────────────────────────── */

function buildOverview(all, sent, input) {
  const pool = poolStats(sent)
  const last90 = sent.filter((m) => m.when && Date.now() - Date.parse(m.when) < 90 * 864e5)
  const prev90 = sent.filter((m) => {
    if (!m.when) return false
    const age = Date.now() - Date.parse(m.when)
    return age >= 90 * 864e5 && age < 180 * 864e5
  })
  return {
    totals: {
      mailings: all.length,
      sent: sent.length,
      drafts: all.filter((m) => m.status === 10).length,
      paused: all.filter((m) => m.status === 60).length,
      sms: input.sms.length,
      smsSent: input.sms.filter((s) => s.wasSent).length,
      surveys: input.surveys.length,
      surveyResponses: sum(input.surveys, (s) => s.responses),
      lists: input.lists.length,
      segments: input.segments.length,
      contacts: input.contacts.active.length + input.contacts.blocked.length,
      activeContacts: input.contacts.active.length,
    },
    pool,
    recent: {
      window: '90 dage',
      current: poolStats(last90),
      previous: poolStats(prev90),
      openRateDelta: round1((poolStats(last90).openRate ?? 0) - (poolStats(prev90).openRate ?? 0)),
      clickRateDelta: round1((poolStats(last90).clickRate ?? 0) - (poolStats(prev90).clickRate ?? 0)),
    },
    best: [...sent]
      .filter((m) => m.stats.delivered >= 100)
      .sort((a, b) => (b.stats.openRate ?? 0) - (a.stats.openRate ?? 0))
      .slice(0, 5)
      .map(slim),
    mostClicked: [...sent]
      .filter((m) => m.stats.delivered >= 100)
      .sort((a, b) => (b.stats.clickRate ?? 0) - (a.stats.clickRate ?? 0))
      .slice(0, 5)
      .map(slim),
  }
}

const slim = (m) => ({
  id: m.id, subject: m.subject, type: m.type, when: m.when,
  openRate: m.stats.openRate, clickRate: m.stats.clickRate, ctor: m.stats.ctor,
  delivered: m.stats.delivered,
})

/* ── Pr. udsendelsestype ─────────────────────────────────────────────────── */

function buildByType(sent) {
  return MAILING_TYPES.map((t) => {
    const group = sent.filter((m) => m.type === t.key)
    return { key: t.key, label: t.label, short: t.short, color: t.color, soft: t.soft, ...poolStats(group) }
  }).filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
}

/* ── Udvikling over tid ──────────────────────────────────────────────────── */

function buildTrends(sent) {
  const byMonth = new Map()
  for (const m of sent) {
    if (!m.local) continue
    const key = m.local.yearMonth
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(m)
  }
  const monthly = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, group]) => ({
      month,
      ...poolStats(group),
      byType: Object.fromEntries(
        MAILING_TYPES.map((t) => {
          const g = group.filter((m) => m.type === t.key)
          return [t.key, g.length ? { count: g.length, openRate: poolRate(g, 'opens'), clickRate: poolRate(g, 'clicks') } : null]
        }).filter(([, v]) => v),
      ),
    }))

  const byWeek = new Map()
  for (const m of sent) {
    if (!m.week) continue
    if (!byWeek.has(m.week)) byWeek.set(m.week, [])
    byWeek.get(m.week).push(m)
  }
  const weekly = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, group]) => ({ week, ...poolStats(group) }))

  return { monthly, weekly }
}

/* ── Udsendelsestidspunkter ──────────────────────────────────────────────── */

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']

function buildTiming(mailings) {
  const cells = new Map()
  for (const m of mailings) {
    if (!m.local) continue
    const key = `${m.local.weekday}:${m.local.hour}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(m)
  }
  const heat = [...cells.entries()].map(([key, group]) => {
    const [weekday, hour] = key.split(':').map(Number)
    return { weekday, hour, ...poolStats(group) }
  })

  const byWeekday = WEEKDAYS.map((label, weekday) => {
    const group = mailings.filter((m) => m.local?.weekday === weekday)
    const stats = poolStats(group)
    return { weekday, label, ...stats, comparable: comparable(stats) }
  }).filter((r) => r.count > 0)

  const hourBands = [
    { label: 'Før kl. 8', from: 0, to: 8 },
    { label: 'Kl. 8–10', from: 8, to: 10 },
    { label: 'Kl. 10–12', from: 10, to: 12 },
    { label: 'Kl. 12–14', from: 12, to: 14 },
    { label: 'Kl. 14–16', from: 14, to: 16 },
    { label: 'Efter kl. 16', from: 16, to: 24 },
  ].map((b) => {
    const group = mailings.filter((m) => m.local && m.local.hour >= b.from && m.local.hour < b.to)
    const stats = poolStats(group)
    return { ...b, ...stats, comparable: comparable(stats) }
  }).filter((r) => r.count > 0)

  return {
    heat, byWeekday, hourBands,
    weekdayLabels: WEEKDAYS,
    minSendouts: MIN_SENDOUTS,
    minDelivered: MIN_DELIVERED,
    excludesJourneys: true,
  }
}

/* ── Emnelinjer ──────────────────────────────────────────────────────────── */

const LENGTH_BUCKETS = [
  { label: '≤ 30 tegn', from: 0, to: 31 },
  { label: '31–45 tegn', from: 31, to: 46 },
  { label: '46–60 tegn', from: 46, to: 61 },
  { label: '61–75 tegn', from: 61, to: 76 },
  { label: 'Over 75 tegn', from: 76, to: 1e6 },
]

function buildSubjects(mailings) {
  const withSubject = mailings.filter((m) => m.subjectAnalysis?.length > 0)

  const byLength = LENGTH_BUCKETS.map((b) => {
    const group = withSubject.filter((m) => m.subjectAnalysis.length >= b.from && m.subjectAnalysis.length < b.to)
    const stats = poolStats(group)
    return { ...b, ...stats, comparable: comparable(stats) }
  }).filter((r) => r.count > 0)

  const flag = (label, test, hint) => {
    const yes = withSubject.filter((m) => test(m.subjectAnalysis))
    const no = withSubject.filter((m) => !test(m.subjectAnalysis))
    return {
      label, hint,
      with: { ...poolStats(yes) },
      without: { ...poolStats(no) },
      openDelta: round1((poolStats(yes).openRate ?? 0) - (poolStats(no).openRate ?? 0)),
      clickDelta: round1((poolStats(yes).clickRate ?? 0) - (poolStats(no).clickRate ?? 0)),
      reliable: comparable(poolStats(yes)) && comparable(poolStats(no)),
    }
  }

  const flags = [
    flag('Emoji i emnelinjen', (s) => s.hasEmoji, 'Fx 🎓 eller 📣'),
    flag('Spørgsmålstegn', (s) => s.hasQuestion, 'Emnelinjen stiller et spørgsmål'),
    flag('Udråbstegn', (s) => s.hasExclamation, null),
    flag('Tal i emnelinjen', (s) => s.hasNumber, 'Fx "3 gode råd" eller en dato'),
    flag('Personalisering', (s) => s.hasPersonalisation, 'Modtagerens navn flettes ind'),
    flag('Kolon', (s) => s.hasColon, 'Fx "Nyt fra DP: …"'),
    flag('Versaler', (s) => s.capsWords > 0, 'Mindst ét ord med store bogstaver'),
  ].filter((f) => f.with.count > 0)

  const ranked = withSubject
    .filter((m) => m.stats.delivered >= 300)
    .sort((a, b) => (b.stats.openRate ?? 0) - (a.stats.openRate ?? 0))

  // Words that appear in several subject lines, scored by the open rate of the
  // sendouts carrying them. Stop-words removed so the list says something.
  const STOP = new Set(['og', 'i', 'til', 'af', 'på', 'med', 'for', 'er', 'du', 'de', 'den', 'det', 'en', 'et', 'som', 'om', 'har', 'kan', 'nu', 'din', 'dit', 'dine', 'vi', 'her', 'fra', 'ny', 'nyt', 'der', 'så', 'at', 'a', 'the'])
  const words = new Map()
  for (const m of withSubject) {
    if (m.stats.delivered < 200) continue
    const seen = new Set()
    for (const raw of m.subjectAnalysis.text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      const w = raw.trim()
      if (w.length < 4 || STOP.has(w) || seen.has(w)) continue
      seen.add(w)
      if (!words.has(w)) words.set(w, [])
      words.get(w).push(m)
    }
  }
  const wordScores = [...words.entries()]
    .filter(([, group]) => group.length >= MIN_SENDOUTS)
    .map(([word, group]) => ({ word, ...poolStats(group) }))
    .sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))

  return {
    byLength,
    flags,
    best: ranked.slice(0, 8).map(slim),
    worst: ranked.slice(-8).reverse().map(slim),
    words: { best: wordScores.slice(0, 12), worst: wordScores.slice(-8).reverse() },
    minSendouts: MIN_SENDOUTS,
  }
}

/* ── Indhold ─────────────────────────────────────────────────────────────── */

const LINK_BUCKETS = [
  { label: '1–5 links', from: 1, to: 6 },
  { label: '6–10 links', from: 6, to: 11 },
  { label: '11–20 links', from: 11, to: 21 },
  { label: '21–35 links', from: 21, to: 36 },
  { label: 'Over 35 links', from: 36, to: 1e6 },
]

const WORD_BUCKETS = [
  { label: 'Under 150 ord', from: 0, to: 150 },
  { label: '150–350 ord', from: 150, to: 350 },
  { label: '350–600 ord', from: 350, to: 600 },
  { label: '600–1000 ord', from: 600, to: 1000 },
  { label: 'Over 1000 ord', from: 1000, to: 1e9 },
]

function buildContent(mailings) {
  const byLinks = LINK_BUCKETS.map((b) => {
    const group = mailings.filter((m) => m.content.uniqueLinks >= b.from && m.content.uniqueLinks < b.to)
    const stats = poolStats(group)
    return { ...b, ...stats, comparable: comparable(stats) }
  }).filter((r) => r.count > 0)

  const byWords = WORD_BUCKETS.map((b) => {
    const group = mailings.filter((m) => m.content.words >= b.from && m.content.words < b.to)
    const stats = poolStats(group)
    return { ...b, ...stats, comparable: comparable(stats) }
  }).filter((r) => r.count > 0)

  const byImages = [
    { label: 'Ingen billeder', from: 0, to: 1 },
    { label: '1–3 billeder', from: 1, to: 4 },
    { label: '4–8 billeder', from: 4, to: 9 },
    { label: 'Over 8 billeder', from: 9, to: 1e6 },
  ].map((b) => {
    const group = mailings.filter((m) => m.content.images >= b.from && m.content.images < b.to)
    const stats = poolStats(group)
    return { ...b, ...stats, comparable: comparable(stats) }
  }).filter((r) => r.count > 0)

  // Which destinations DP links to, weighted by how well those sendouts clicked.
  const hosts = new Map()
  for (const m of mailings) {
    for (const h of m.content.hosts) {
      if (!hosts.has(h.host)) hosts.set(h.host, { host: h.host, links: 0, mailings: [] })
      const e = hosts.get(h.host)
      e.links += h.n
      e.mailings.push(m)
    }
  }
  const topHosts = [...hosts.values()]
    .map((e) => ({ host: e.host, links: e.links, mailings: e.mailings.length, clickRate: poolRate(e.mailings, 'clicks') }))
    .sort((a, b) => b.links - a.links)
    .slice(0, 14)

  const paths = new Map()
  for (const m of mailings) {
    for (const p of m.content.topPaths) {
      if (!paths.has(p.path)) paths.set(p.path, { path: p.path, uses: 0, mailings: [] })
      const e = paths.get(p.path)
      e.uses += p.n
      e.mailings.push(m)
    }
  }
  const topDestinations = [...paths.values()]
    .filter((e) => e.mailings.length >= 2)
    .map((e) => ({ path: e.path, uses: e.uses, mailings: e.mailings.length, clickRate: poolRate(e.mailings, 'clicks') }))
    .sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0))
    .slice(0, 14)

  return {
    byLinks,
    byWords,
    byImages,
    topHosts,
    topDestinations,
    // Hele link-kataloget: hver destination, ikke kun de otte hyppigste pr. mail.
    catalogue: buildLinkCatalogue(mailings, { minSendouts: MIN_SENDOUTS, minDelivered: MIN_DELIVERED }),
    minSendouts: MIN_SENDOUTS,
    minDelivered: MIN_DELIVERED,
  }
}

/* ── Modtagere ───────────────────────────────────────────────────────────── */

const AGE_BUCKETS = [
  { label: 'Under 30', from: 0, to: 30 },
  { label: '30–39', from: 30, to: 40 },
  { label: '40–49', from: 40, to: 50 },
  { label: '50–59', from: 50, to: 60 },
  { label: '60–69', from: 60, to: 70 },
  { label: '70+', from: 70, to: 200 },
]

const TENURE_BUCKETS = [
  { label: 'Under 1 år', from: 0, to: 1 },
  { label: '1–3 år', from: 1, to: 3 },
  { label: '3–7 år', from: 3, to: 7 },
  { label: '7–15 år', from: 7, to: 15 },
  { label: 'Over 15 år', from: 15, to: 200 },
]

const yearsSince = (iso) => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : (Date.now() - t) / (365.25 * 864e5)
}

const ageBucket = (age) => (age === null ? null : AGE_BUCKETS.find((b) => age >= b.from && age < b.to)?.label ?? null)
const tenureBucket = (iso) => {
  const y = yearsSince(iso)
  return y === null ? null : TENURE_BUCKETS.find((b) => y >= b.from && y < b.to)?.label ?? null
}

function buildAudience(contacts, engagement, minBucket) {
  const { active, blocked, bounced } = contacts
  const everyone = [...active, ...blocked]

  const profile = {
    kontingent: bucket(everyone, (c) => c.kontingent, { minBucket }),
    medlemstype: bucket(everyone, (c) => c.medlemstype, { minBucket }),
    region: bucket(everyone, (c) => c.region, { minBucket }),
    sektioner: bucket(everyone, (c) => c.sektioner, { minBucket }),
    udvalgspost: bucket(everyone, (c) => c.udvalgspost, { minBucket }),
    netvaerk: bucket(everyone, (c) => c.netvaerk, { minBucket }),
    interesser: bucket(everyone, (c) => c.interesser, { minBucket }),
    medlemskab: bucket(everyone, (c) => c.medlemskab, { minBucket }),
    alder: orderBuckets(bucket(everyone, (c) => ageBucket(c.alder), { minBucket }), AGE_BUCKETS),
    anciennitet: orderBuckets(bucket(everyone, (c) => tenureBucket(c.indmeldt), { minBucket }), TENURE_BUCKETS),
    koen: bucket(everyone, (c) => translateGender(c.koen), { minBucket }),
  }

  // Who leaves, and why.
  const churn = {
    reasons: bucket(
      [...blocked, ...active.filter((c) => c.udmeldelsesgrund)],
      (c) => c.udmeldelsesgrund,
      { minBucket, otherLabel: 'Ingen grund angivet' },
    ),
    byMonth: monthHistogram(blocked.map((c) => c.udmeldt).filter(Boolean)),
    joinedByMonth: monthHistogram(everyone.map((c) => c.indmeldt).filter(Boolean), 36),
    blockedProfile: {
      kontingent: bucket(blocked, (c) => c.kontingent, { minBucket }),
      medlemstype: bucket(blocked, (c) => c.medlemstype, { minBucket }),
      region: bucket(blocked, (c) => c.region, { minBucket }),
      alder: orderBuckets(bucket(blocked, (c) => ageBucket(c.alder), { minBucket }), AGE_BUCKETS),
      anciennitet: orderBuckets(bucket(blocked, (c) => tenureBucket(c.indmeldt), { minBucket }), TENURE_BUCKETS),
    },
  }

  return {
    totals: {
      active: active.length,
      blocked: blocked.length,
      bounced: bounced.length,
      all: active.length + blocked.length,
      blockedShare: round1(pct(blocked.length, active.length + blocked.length)),
      bounceShare: round1(pct(bounced.length, active.length + blocked.length)),
      smsReachable: active.filter((c) => c.smsActive).length,
    },
    profile,
    churn,
    engagement: buildEngagement(engagement, minBucket),
  }
}

/** Resolve a profile attribute by dimension key, for the cross-tab. */
function profileValue(profile, key) {
  switch (key) {
    case 'kontingent': return profile.kontingent
    case 'region': return profile.region
    case 'alder': return ageBucket(profile.alder)
    case 'anciennitet': return tenureBucket(profile.indmeldt)
    case 'sektioner': return profile.sektioner
    case 'koen': return translateGender(profile.koen)
    default: return null
  }
}

function translateGender(g) {
  if (!g) return null
  const s = g.toLowerCase()
  if (s.startsWith('f')) return 'Kvinde'
  if (s.startsWith('m')) return 'Mand'
  return 'Andet / ikke oplyst'
}

function orderBuckets(rows, order) {
  const index = new Map(order.map((b, i) => [b.label, i]))
  return [...rows].sort((a, b) => (index.get(a.name) ?? 99) - (index.get(b.name) ?? 99))
}

function monthHistogram(dates, limit = 60) {
  const map = new Map()
  for (const d of dates) {
    const t = Date.parse(d)
    if (Number.isNaN(t)) continue
    const dt = new Date(t)
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-limit).map(([month, n]) => ({ month, n }))
}

/**
 * Engagement joined to the membership profile. This is the only place where a
 * person's behaviour meets their attributes, and it happens on already-stripped
 * profiles, in aggregate, on a stable sample.
 */
function buildEngagement(rows, minBucket) {
  if (!rows.length) return null

  const groupBy = (keyOf) => {
    const map = new Map()
    for (const r of rows) {
      const keys = keyOf(r.profile)
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (k === null || k === undefined || k === '') continue
        if (!map.has(k)) map.set(k, [])
        map.get(k).push(r)
      }
    }
    const out = []
    let foldedPeople = 0
    let foldedRows = []
    for (const [name, group] of map) {
      if (group.length < Math.max(minBucket, MIN_PEOPLE)) { foldedPeople += group.length; foldedRows = foldedRows.concat(group); continue }
      out.push(statsFor(name, group))
    }
    out.sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))
    if (foldedPeople >= minBucket) out.push({ ...statsFor('Mindre grupper samlet', foldedRows), isOther: true })
    return out
  }

  const statsFor = (name, group) => {
    const received = sum(group, (r) => r.received)
    const opened = sum(group, (r) => r.opened)
    const clicked = sum(group, (r) => r.clicked)
    return {
      name,
      people: group.length,
      received,
      mailsPerPerson: round1(mean(group, (r) => r.received)),
      openRate: pct(opened, received),
      clickRate: pct(clicked, received),
      ctor: pct(clicked, opened),
      neverOpened: round1(pct(group.filter((r) => r.received > 0 && r.opened === 0).length, group.filter((r) => r.received > 0).length)),
      superReaders: round1(pct(group.filter((r) => r.received >= 5 && r.opened / Math.max(1, r.received) >= 0.8).length, group.length)),
    }
  }

  const withMail = rows.filter((r) => r.received > 0)
  const openShare = (r) => (r.received ? r.opened / r.received : 0)

  return {
    sample: rows.length,
    withMail: withMail.length,
    overall: statsFor('Alle i stikprøven', rows),
    distribution: [
      { label: 'Aldrig', n: withMail.filter((r) => r.opened === 0).length },
      { label: 'Sjældent · under 20 %', n: withMail.filter((r) => openShare(r) > 0 && openShare(r) < 0.2).length },
      { label: 'Af og til · 20–50 %', n: withMail.filter((r) => openShare(r) >= 0.2 && openShare(r) < 0.5).length },
      { label: 'Ofte · 50–80 %', n: withMail.filter((r) => openShare(r) >= 0.5 && openShare(r) < 0.8).length },
      { label: 'Næsten alt · 80 %+', n: withMail.filter((r) => openShare(r) >= 0.8).length },
    ].map((b) => ({ ...b, share: round1(pct(b.n, withMail.length)) })),
    byKontingent: groupBy((p) => p.kontingent),
    byMedlemstype: groupBy((p) => p.medlemstype),
    byRegion: groupBy((p) => p.region),
    byAlder: groupBy((p) => ageBucket(p.alder)),
    byAnciennitet: groupBy((p) => tenureBucket(p.indmeldt)),
    bySektion: groupBy((p) => p.sektioner),
    byNetvaerk: groupBy((p) => p.netvaerk),
    byKoen: groupBy((p) => translateGender(p.koen)),
    minPeople: MIN_PEOPLE,
  }
}

/* ── Segmenter og lister ─────────────────────────────────────────────────── */

/**
 * How sendouts perform per list and per segment. A sendout counts towards every
 * list and segment it targeted, so the same sendout can appear under several —
 * which is what makes the segment filter meaningful.
 */
function buildSegmentPerformance(sent, lists) {
  const collect = (keyOf) => {
    const map = new Map()
    for (const m of sent) {
      for (const name of keyOf(m)) {
        if (!name) continue
        if (!map.has(name)) map.set(name, [])
        map.get(name).push(m)
      }
    }
    return [...map.entries()]
      .map(([name, group]) => ({
        name,
        ...poolStats(group),
        types: [...new Set(group.map((m) => m.type))],
        lastSent: group.reduce((max, m) => (m.when && m.when > max ? m.when : max), ''),
      }))
      .sort((a, b) => b.count - a.count)
  }

  const byList = collect((m) => m.lists)
  const bySegment = collect((m) => m.segments)

  // Join in the list's own contact counts where the names match.
  const listMeta = new Map(lists.map((l) => [l.name, l]))
  for (const row of byList) {
    const meta = listMeta.get(row.name)
    if (meta) {
      row.contacts = meta.contacts
      row.activeContacts = meta.active
      row.bouncedContacts = meta.bounced
    }
  }

  return { byList, bySegment }
}
