/**
 * The shape the sync writes, and the hooks that read it.
 *
 * The published page fetches ./data/dashboard.json; the single-file build has
 * the same object compiled in at window.__DP_DATA__. Both paths end in the same
 * `useDashboard` state, so nothing downstream needs to know which build it is.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ── Typer ───────────────────────────────────────────────────────────────── */

export interface PoolStats {
  count: number
  recipients: number
  delivered: number
  opens: number
  clicks: number
  unsubscribes: number
  bounces: number
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
}

export interface MailingType {
  key: string
  label: string
  short: string
  color: string
  soft: string
  tags: string[]
  description: string
}

export interface SubjectAnalysis {
  text: string
  length: number
  words: number
  hasEmoji: boolean
  hasQuestion: boolean
  hasExclamation: boolean
  hasNumber: boolean
  hasPersonalisation: boolean
  hasColon: boolean
  capsWords: number
  firstWord: string
}

export interface Mailing {
  id: string
  number: number | null
  subject: string
  name: string | null
  status: number
  statusName: string
  category: string | null
  tags: string[]
  type: string
  journey: string | null
  isRecurring: boolean
  from: { name: string | null; address: string | null }
  lists: string[]
  segments: string[]
  when: string | null
  scheduled: string | null
  started: string | null
  ended: string | null
  local: { year: number; month: number; day: number; hour: number; minute: number; weekday: number; date: string; yearMonth: string } | null
  week: string | null
  stats: {
    recipients: number
    sent: number
    delivered: number
    opens: number
    clicks: number
    openClicks: number
    conversions: number
    bounces: number
    unsubscribes: number
    failed: number
    inactive: number
    openRate: number | null
    clickRate: number | null
    ctor: number | null
    bounceRate: number | null
    unsubRate: number | null
  }
  subjectAnalysis: SubjectAnalysis
  content: {
    links: number
    uniqueLinks: number
    hosts: { host: string; n: number }[]
    topPaths: { path: string; n: number }[]
    images: number
    buttons: number
    words: number
    chars: number
    readingMinutes: number
  }
  unsubscribeReasons: { reason: string; count: number }[]
}

export interface Sms {
  id: string
  subject: string
  body: string
  sender: string | null
  status: number
  statusName: string
  wasSent: boolean
  category: string | null
  when: string | null
  local: Mailing['local']
  week: string | null
  isRecurring: boolean
  stats: {
    recipients: number
    unique: number | null
    bounced: number
    blocked: number
    pending: number
    duplicates: number
    sentRate: number | null
    receivedRate: number | null
    failRate: number | null
  }
  length: number
  segments: number
  usesShortener: boolean
}

export interface Survey {
  id: string
  title: string
  status: number
  statusName: string
  isActive: boolean
  start: string | null
  end: string | null
  lastModified: string | null
  responses: number
  respondents: number
  responseLimit: number
  url: string | null
  questionCount: number | null
  questionTypes: string[]
  tags: string[]
}

export interface Bucket { name: string; n: number; share: number | null; isOther?: boolean }

export interface EngagementGroup {
  name: string
  people: number
  received: number
  mailsPerPerson: number | null
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  neverOpened: number | null
  superReaders: number | null
  isOther?: boolean
}

export interface Finding {
  id: string
  kind: 'positive' | 'negative' | 'neutral' | 'opportunity'
  area: string
  title: string
  body: string
  metric: string
  delta?: number
  evidence: string
  color?: string
  section: string
}

export interface SegmentRow extends PoolStats {
  name: string
  types: string[]
  lastSent: string
  contacts?: number
  activeContacts?: number | null
  bouncedContacts?: number | null
}

export interface Dashboard {
  meta: {
    generatedAt: string
    account: string
    source: string
    minBucket: number
    fieldWarnings: string[]
    issueStatusCounts: Record<string, number> | null
    engagementSample: { requested: number; resolved: number; population: number }
    fetch: { requests: number; retries: number; failures: number; megabytes: number; seconds: number }
  }
  types: MailingType[]
  mailings: Mailing[]
  sms: Sms[]
  surveys: Survey[]
  lists: { id: string; name: string; contacts: number; active: number | null; blocked: number | null; bounced: number | null; created: string | null }[]
  segments: { id: string; name: string; inUse: boolean; ownedBy: string | null }[]
  tags: { id: string; title: string; usage: number }[]
  categories: { id: string; name: string }[]
  overview: {
    totals: Record<string, number>
    pool: PoolStats
    recent: { window: string; current: PoolStats; previous: PoolStats; openRateDelta: number | null; clickRateDelta: number | null }
    best: SlimMailing[]
    mostClicked: SlimMailing[]
  }
  byType: (PoolStats & { key: string; label: string; short: string; color: string; soft: string })[]
  trends: {
    monthly: (PoolStats & { month: string; byType: Record<string, { count: number; openRate: number | null; clickRate: number | null }> })[]
    weekly: (PoolStats & { week: string })[]
  }
  timing: {
    heat: (PoolStats & { weekday: number; hour: number })[]
    byWeekday: (PoolStats & { weekday: number; label: string; comparable: boolean })[]
    hourBands: (PoolStats & { label: string; from: number; to: number; comparable: boolean })[]
    weekdayLabels: string[]
    minSendouts: number
    minDelivered: number
    excludesJourneys: boolean
  }
  subjects: {
    byLength: (PoolStats & { label: string; from: number; to: number; comparable: boolean })[]
    flags: {
      label: string
      hint: string | null
      with: PoolStats
      without: PoolStats
      openDelta: number | null
      clickDelta: number | null
      reliable: boolean
    }[]
    best: SlimMailing[]
    worst: SlimMailing[]
    words: { best: (PoolStats & { word: string })[]; worst: (PoolStats & { word: string })[] }
    minSendouts: number
    minDelivered: number
  }
  content: {
    byLinks: (PoolStats & { label: string; comparable: boolean })[]
    byWords: (PoolStats & { label: string; comparable: boolean })[]
    byImages: (PoolStats & { label: string; comparable: boolean })[]
    topHosts: { host: string; links: number; mailings: number; clickRate: number | null }[]
    topDestinations: { path: string; uses: number; mailings: number; clickRate: number | null }[]
    catalogue: LinkCatalogue | null
    minSendouts: number
    minDelivered: number
  }
  audience: {
    totals: {
      active: number; blocked: number; bounced: number; all: number
      blockedShare: number | null; bounceShare: number | null; smsReachable: number
    }
    profile: Record<string, Bucket[]>
    churn: {
      reasons: Bucket[]
      byMonth: { month: string; n: number }[]
      joinedByMonth: { month: string; n: number }[]
      blockedProfile: Record<string, Bucket[]>
    }
    engagement: {
      sample: number
      withMail: number
      overall: EngagementGroup
      distribution: { label: string; n: number; share: number | null }[]
      byKontingent: EngagementGroup[]
      byMedlemstype: EngagementGroup[]
      byRegion: EngagementGroup[]
      byAlder: EngagementGroup[]
      byAnciennitet: EngagementGroup[]
      bySektion: EngagementGroup[]
      byNetvaerk: EngagementGroup[]
      byKoen: EngagementGroup[]
      minPeople: number
    } | null
  }
  segmentPerformance: { byList: SegmentRow[]; bySegment: SegmentRow[] }
  findings: Finding[]

  /** Shared settings as committed in config/dashboard.json. */
  config: Record<string, unknown>
  targets: TargetStatus[]
  benchmarks: Benchmarks | null
  senders: { rows: SenderRow[]; minSendouts: number; minDelivered: number }
  alerts: Alerts
  cohorts: Cohorts | null
  reengagement: Reengagement | null
  crossTabs: CrossTabs
  narrative: Narrative | null
}

export interface TargetStatus {
  key: string
  label: string
  value: number | null
  target: number
  direction: 'op' | 'ned'
  reached: boolean | null
  gap: number | null
  progress: number | null
}

export interface Benchmarks {
  primary: string | null
  caveat: string | null
  sources: {
    key: string
    name: string
    source: string
    basis: string
    year: number
    url: string
    notes: Record<string, string>
    metrics: { metric: string; external: number; own: number | null; delta: number | null; ratio: number | null }[]
  }[]
}

export interface SenderRow {
  name: string
  count: number
  delivered: number
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  types: string[]
  comparable: boolean
  lastUsed: string
}

export interface Alert {
  kind: 'under-normal' | 'afmeldinger' | 'bounce' | 'bestand'
  severity: 'critical' | 'warning'
  title: string
  subject: string | null
  id: string | null
  when: string | null
  value: number | null
  reference: number | null
  detail: string
}

export interface Alerts {
  active: boolean
  items: Alert[]
  recent?: Alert[]
  thresholds?: Record<string, unknown>
}

export interface CohortBucket {
  key: string
  label: string
  received: number
  openRate: number | null
  clickRate: number | null
  reached: boolean
}

export interface Cohorts {
  buckets: { key: string; label: string }[]
  cohorts: { year: number; people: number; buckets: CohortBucket[] }[]
  firstWindow: (Partial<CohortBucket> & { year: number; people: number })[]
  minPeople: number
  note: string
}

export interface Reengagement {
  monthsWithoutOpen: number
  minReceived: number
  sample: number
  dormantInSample: number
  neverOpenedInSample: number
  dormantShare: number | null
  estimatedPeople: number
  currentOpenRate: number | null
  openRateWithoutDormant: number | null
  lift: number | null
  byKontingent: { name: string; dormant: number; total: number; share: number | null }[]
  byAnciennitet: { name: string; dormant: number; total: number; share: number | null }[]
  byRegion: { name: string; dormant: number; total: number; share: number | null }[]
  ideas: { title: string; body: string; effort: string }[]
  caveat: string
}

export interface CrossTabPair {
  rowKey: string
  rowLabel: string
  colKey: string
  colLabel: string
  rows: string[]
  cols: string[]
  cells: { row: string; col: string; people: number; received: number; openRate: number | null; clickRate: number | null }[]
  suppressed: number
}

export interface CrossTabs {
  dimensions: { key: string; label: string }[]
  pairs: Record<string, CrossTabPair>
  minPeople: number
  note: string
}

export interface Narrative {
  month: string
  monthName: string
  text: string
  figures: {
    count: number
    delivered: number
    openRate: number | null
    clickRate: number | null
    openDelta: number | null
    clickDelta: number | null
  }
  note: string
}

export interface LinkRow {
  path: string
  host: string
  uses: number
  mailings: number
  share: number | null
  delivered: number
  withRate: number | null
  withoutRate: number | null
  delta: number | null
  comparable: boolean
  everywhere: boolean
  avgDelivered: number
  sizeRatio: number | null
  at: number | null
  place: 'øverst' | 'i midten' | 'nederst' | null
  first: string | null
  last: string | null
}

export interface LinkCatalogue {
  totals: {
    destinations: number
    mailings: number
    uses: number
    oneOffs: number
    recurring: number
    comparable: number
    houseClickRate: number | null
  }
  mostUsed: LinkRow[]
  strongest: LinkRow[]
  weakest: LinkRow[]
  hosts: { host: string; paths: number; uses: number; mailings: number; share: number | null; clickRate: number | null; everywhere: boolean }[]
  places: { label: string; destinations: number; uses: number }[]
  oneOffSample: LinkRow[]
  minSendouts: number
  minDelivered: number
  ubiquitousShare: number
  note: string
}

export interface SlimMailing {
  id: string
  subject: string
  type: string
  when: string | null
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  delivered: number
}

/* ── Indlæsning ──────────────────────────────────────────────────────────── */

declare global {
  interface Window { __DP_DATA__?: Dashboard }
}

const DATA_URL = `${import.meta.env.BASE_URL}data/dashboard.json`

export type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: Dashboard; error: null }
  | { status: 'error'; data: Dashboard | null; error: string }

/** One hour, matching the sync's schedule. */
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000

export function useDashboard() {
  const [state, setState] = useState<LoadState>(() =>
    window.__DP_DATA__
      ? { status: 'ready', data: window.__DP_DATA__, error: null }
      : { status: 'loading', data: null, error: null },
  )
  const [fetchedAt, setFetchedAt] = useState<Date | null>(window.__DP_DATA__ ? new Date() : null)
  const [refreshing, setRefreshing] = useState(false)
  const embedded = Boolean(window.__DP_DATA__)

  const load = useCallback(async (silent = false) => {
    if (embedded) return
    if (silent) setRefreshing(true)
    try {
      // Cache-bust so a refresh really re-reads the file rather than the copy
      // the browser kept from the last hour.
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Kunne ikke hente data (HTTP ${res.status})`)
      const json = (await res.json()) as Dashboard
      setState({ status: 'ready', data: json, error: null })
      setFetchedAt(new Date())
    } catch (err) {
      setState((prev) => ({ status: 'error', data: prev.data, error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setRefreshing(false)
    }
  }, [embedded])

  useEffect(() => { void load() }, [load])

  return { ...state, fetchedAt, refreshing, reload: () => load(true), embedded }
}

/** Auto-refresh on an interval, pausing while the tab is hidden. */
export function useAutoRefresh(enabled: boolean, onRefresh: () => void, intervalMs = REFRESH_INTERVAL_MS) {
  const saved = useRef(onRefresh)
  saved.current = onRefresh
  const [nextAt, setNextAt] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) { setNextAt(null); return }
    setNextAt(Date.now() + intervalMs)
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        saved.current()
        setNextAt(Date.now() + intervalMs)
      }
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])

  return nextAt
}

/* ── Filtrering ──────────────────────────────────────────────────────────── */

export interface Filters {
  types: string[]
  segment: string | null
  from: string | null
  to: string | null
  search: string
}

export const emptyFilters: Filters = { types: [], segment: null, from: null, to: null, search: '' }

export function useFilteredMailings(data: Dashboard | null, filters: Filters) {
  return useMemo(() => {
    if (!data) return []
    return data.mailings.filter((m) => {
      // Same rule as the analysis: a sendout counts when it delivered mail,
      // whatever Ungapped's status says. Journey mails sit at "Sat på pause".
      if (m.stats.delivered <= 0) return false
      if (filters.types.length && !filters.types.includes(m.type)) return false
      if (filters.segment) {
        const inList = m.lists.includes(filters.segment)
        const inSegment = m.segments.includes(filters.segment)
        if (!inList && !inSegment) return false
      }
      if (filters.from && (!m.when || m.when < filters.from)) return false
      if (filters.to && (!m.when || m.when > filters.to)) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const hay = `${m.subject} ${m.name ?? ''} ${m.tags.join(' ')} ${m.journey ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, filters])
}

/* ── Beregninger på et filtreret sæt ─────────────────────────────────────── */

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + (f(x) || 0), 0)
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

export function poolOf(mailings: Mailing[]): PoolStats {
  const delivered = sum(mailings, (m) => m.stats.delivered)
  const opens = sum(mailings, (m) => m.stats.opens)
  const clicks = sum(mailings, (m) => m.stats.clicks)
  const unsubscribes = sum(mailings, (m) => m.stats.unsubscribes)
  const bounces = sum(mailings, (m) => m.stats.bounces)
  const recipients = sum(mailings, (m) => m.stats.recipients)
  return {
    count: mailings.length,
    recipients,
    delivered,
    opens,
    clicks,
    unsubscribes,
    bounces,
    openRate: pct(opens, delivered),
    clickRate: pct(clicks, delivered),
    ctor: pct(clicks, opens),
    unsubRate: pct(unsubscribes, delivered),
    bounceRate: pct(bounces, recipients),
  }
}

/** Monthly series for a filtered set, so the trend follows the filters. */
/**
 * En måneds rate skal have noget bag sig for at være en rate.
 *
 * November og december 2024 rummer én leveret mail hver, begge åbnet. To punkter
 * på 100 % låste y-aksen og trykkede to års rigtige tal ned i bunden af grafen.
 * Måneden tæller stadig med i volumen og i alle totaler — det er kun raten der
 * ikke bliver tegnet, hvor den ikke kan betyde noget.
 */
export const MIN_MONTH_DELIVERED = 500

export function monthlyOf(mailings: Mailing[]) {
  const map = new Map<string, Mailing[]>()
  for (const m of mailings) {
    if (!m.local) continue
    const key = m.local.yearMonth
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, group]) => {
      const pool = poolOf(group)
      // Raten tegnes kun, når måneden har volumen nok til at bære den.
      const thin = pool.delivered < MIN_MONTH_DELIVERED
      return { month, ...pool, thin }
    })
}

/* ── Formatering ─────────────────────────────────────────────────────────── */

const dtf = new Intl.DateTimeFormat('da-DK', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Copenhagen',
})
const dtfTime = new Intl.DateTimeFormat('da-DK', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Europe/Copenhagen',
})

export const formatDate = (iso: string | null) => (iso ? dtf.format(new Date(iso)) : '–')
export const formatDateTime = (iso: string | null) => (iso ? dtfTime.format(new Date(iso)) : '–')

export function relativeTime(date: Date | string | null) {
  if (!date) return '–'
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `for ${mins} min. siden`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `for ${hours} ${hours === 1 ? 'time' : 'timer'} siden`
  const days = Math.round(hours / 24)
  if (days < 30) return `for ${days} ${days === 1 ? 'dag' : 'dage'} siden`
  return formatDate(d.toISOString())
}

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  const names = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
  return `${names[Number(m) - 1] ?? m} ${y.slice(2)}`
}
