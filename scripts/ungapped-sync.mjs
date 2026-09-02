#!/usr/bin/env node
/**
 * Ungapped → dashboard sync.
 *
 * Pulls everything the dashboard shows, aggregates it, and writes a single JSON
 * file. Runs on a GitHub runner because the API is not reachable from the
 * Claude Code session's network.
 *
 * PRIVACY. The output is published to a public GitHub Pages site, so it must
 * never carry a person. Contacts are read (that is the only way to know the
 * membership profile) but are reduced to counts before anything is written, and
 * any bucket smaller than MIN_BUCKET is folded into an "andre"-row so a small
 * group cannot be singled out. No name, e-mail, address or contact id is
 * written to the output under any mode.
 *
 * Usage:  UNGAPPED_API_KEY=… node scripts/ungapped-sync.mjs [--out public/data]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { Ungapped, ISSUE_STATUS, SMS_STATUS, SURVEY_STATUS, CONTACT_FIELDS } from './lib/ungapped.mjs'
import { analyseBody, analyseSubject, isoWeek, localParts, pct } from './lib/extract.mjs'
import { buildAnalysis } from './lib/analyse.mjs'

const KEY = process.env.UNGAPPED_API_KEY?.trim()
if (!KEY) { console.error('UNGAPPED_API_KEY is not set.'); process.exit(1) }

const args = process.argv.slice(2)
const outDir = path.resolve(argValue('--out') ?? 'public/data')
/** How many contacts to pull per-sendout engagement for. Stable across runs. */
const ENGAGEMENT_SAMPLE = Number(argValue('--sample') ?? process.env.ENGAGEMENT_SAMPLE ?? 2000)
/** Buckets smaller than this are folded together before publishing. */
const MIN_BUCKET = 5

function argValue(flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

const ug = new Ungapped(KEY, { concurrency: 8 })
const t0 = Date.now()
const step = (msg) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s] ${msg}`)
const progress = (done, total, label) => step(`   ${label}: ${done}/${total}`)

async function main() {
  await mkdir(outDir, { recursive: true })

  /* ── Reference data ───────────────────────────────────────────────────── */
  step('henter stamdata')
  const [accounts, tags, categories, lists, segments, contactFields, issueCounts] = await Promise.all([
    ug.tryGet('/Accounts'),
    ug.tryGet('/Tags'),
    ug.tryGet('/Categories'),
    ug.tryGet('/Lists'),
    ug.tryGet('/Segments'),
    ug.tryGet('/Contacts/Fields'),
    ug.tryGet('/Issues/Statistics'),
  ])
  const account = accounts?.[0]?.Name ?? 'Dansk Psykolog Forening'
  step(`   konto: ${account} · ${tags?.length ?? 0} tags · ${lists?.length ?? 0} lister · ${segments?.length ?? 0} segmenter`)

  // Warn if DP renamed a custom field, so the analysis never silently mislabels.
  const fieldWarnings = []
  for (const [key, expected] of Object.entries(CONTACT_FIELDS)) {
    const actual = contactFields?.[key]
    if (actual && actual.trim() !== expected.trim()) {
      fieldWarnings.push(`${key}: forventet "${expected}", fandt "${actual}"`)
    }
  }
  if (fieldWarnings.length) step(`   ⚠ feltnavne ændret: ${fieldWarnings.join('; ')}`)

  /* ── Udsendelser ──────────────────────────────────────────────────────── */
  step('henter udsendelser')
  const listing = (await ug.get('/Issues/Listing')) ?? []
  const wanted = listing.filter((i) => i.Status !== 110) // skip templates
  step(`   ${listing.length} udsendelser, heraf ${wanted.length} ikke-skabeloner`)

  const mailings = await ug.map(wanted, async (row) => {
    const [detail, stats, reasons] = await Promise.all([
      ug.tryGet(`/Issues/${row.IssueId}`),
      ug.tryGet(`/Issues/${row.IssueId}/Statistics/Overview`),
      ug.tryGet(`/Issues/${row.IssueId}/Statistics/UnsubscribeReasons`),
    ])
    const sentStats = row.Status === 50
      ? await ug.tryGet(`/Issues/Sent/${row.IssueId}/Statistics`)
      : null
    return toMailing(row, detail, stats, sentStats, reasons)
  }, { label: 'udsendelser', onProgress: progress })

  /* ── SMS ──────────────────────────────────────────────────────────────── */
  step('henter sms')
  const smsListing = (await ug.tryGet('/Textmessages/Listing')) ?? []
  const smsMessages = await ug.map(
    smsListing.filter((s) => s.Status !== 110),
    async (row) => {
      const stats = await ug.tryGet(`/Textmessages/${row.SmsMessageId}/Statistics`)
      return toSms(row, stats)
    },
    { label: 'sms', onProgress: progress },
  )

  /* ── Spørgeskemaer ────────────────────────────────────────────────────── */
  step('henter spørgeskemaer')
  const surveyListing = (await ug.tryGet('/Surveys/Listing')) ?? []
  const surveys = await ug.map(surveyListing, async (row) => {
    const [summary, questions] = await Promise.all([
      ug.tryGet(`/Surveys/${row.SurveyId}/Statistics/Summary`),
      ug.tryGet(`/Surveys/${row.SurveyId}/Questions`),
    ])
    return toSurvey(row, summary, questions)
  }, { label: 'spørgeskemaer', onProgress: progress })

  /* ── Lister ───────────────────────────────────────────────────────────── */
  step('henter listestatistik')
  const listStats = await ug.map(lists ?? [], async (l) => {
    const s = await ug.tryGet(`/Lists/${l.ListId}/Stats`)
    return {
      id: l.ListId,
      name: l.Name,
      contacts: l.ContactCount ?? s?.CountTotal ?? 0,
      active: s?.CountActive ?? null,
      blocked: s?.CountBlocked ?? null,
      bounced: s?.CountBounced ?? null,
      created: l.Created ?? null,
    }
  }, { label: 'lister', onProgress: progress })

  /* ── Modtagere ────────────────────────────────────────────────────────── */
  step('henter kontakter (aggregeres straks — ingen persondata forlader dette trin)')
  const [active, blocked, bounced] = await Promise.all([
    ug.tryGet('/Contacts/Active', { timeout: 240_000 }),
    ug.tryGet('/Contacts/Block', { timeout: 180_000 }),
    ug.tryGet('/Contacts/Bounce', { timeout: 180_000 }),
  ])
  step(`   ${active?.length ?? 0} aktive · ${blocked?.length ?? 0} afmeldte · ${bounced?.length ?? 0} bouncede`)

  /* ── Engagement pr. modtager (stabil stikprøve) ───────────────────────── */
  const sample = stableSample(active ?? [], ENGAGEMENT_SAMPLE)
  step(`henter engagement for ${sample.length} kontakter (stabil stikprøve af ${active?.length ?? 0})`)
  const engagement = await ug.map(sample, async (c) => {
    const rows = await ug.tryGet(`/Issues/Recipient?contactId=${c.ContactId}`)
    if (!Array.isArray(rows)) return null
    const opened = rows.filter((r) => (r.OpenedCount ?? 0) > 0).length
    const clicked = rows.filter((r) => (r.ClickCount ?? 0) > 0).length
    return {
      profile: profileOf(c),
      received: rows.length,
      opened,
      clicked,
      opens: rows.reduce((s, r) => s + (r.OpenedCount ?? 0), 0),
      clicks: rows.reduce((s, r) => s + (r.ClickCount ?? 0), 0),
      lastScheduled: rows.reduce((max, r) => (r.Scheduled && r.Scheduled > max ? r.Scheduled : max), ''),
    }
  }, { label: 'engagement', onProgress: progress })

  /* ── Aggregering ──────────────────────────────────────────────────────── */
  step('aggregerer')
  const analysis = buildAnalysis({
    mailings,
    sms: smsMessages,
    surveys,
    lists: listStats,
    segments: (segments ?? []).map((s) => ({
      id: s.SegmentId, name: s.Name, inUse: s.InUse,
      ownedBy: s.OwnedByJourney ? 'journey' : s.OwnedByIssue ? 'issue' : s.OwnedBySurvey ? 'survey' : null,
    })),
    tags: (tags ?? []).map((t) => ({ id: t.TagId, title: t.Title.trim(), usage: t.UsageCount })),
    categories: (categories ?? []).map((c) => ({ id: c.CategoryId, name: c.Name })),
    contacts: {
      active: (active ?? []).map(profileOf),
      blocked: (blocked ?? []).map(profileOf),
      bounced: (bounced ?? []).map(profileOf),
    },
    engagement: engagement.filter(Boolean),
    minBucket: MIN_BUCKET,
  })

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      account,
      source: 'Ungapped API v2',
      minBucket: MIN_BUCKET,
      fieldWarnings,
      issueStatusCounts: issueCounts ?? null,
      engagementSample: { requested: ENGAGEMENT_SAMPLE, resolved: engagement.filter(Boolean).length, population: active?.length ?? 0 },
      fetch: {
        requests: ug.stats.requests,
        retries: ug.stats.retries,
        failures: ug.stats.failures,
        megabytes: Math.round(ug.stats.bytes / 1e5) / 10,
        seconds: Math.round((Date.now() - t0) / 1000),
      },
    },
    ...analysis,
  }

  const file = path.join(outDir, 'dashboard.json')
  await writeFile(file, JSON.stringify(payload))
  const kb = Math.round(JSON.stringify(payload).length / 1024)
  step(`✔ skrev ${file} (${kb} kB)`)
  step(`  ${ug.stats.requests} kald · ${ug.stats.retries} genforsøg · ${ug.stats.failures} fejl · ${Math.round(ug.stats.bytes / 1e6)} MB hentet`)

  // Guard: the output must not contain anything that looks like a person.
  const serialised = JSON.stringify(payload)
  const leaks = []
  if (/[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(serialised)) leaks.push('e-mailadresse')
  if (/"ContactId"|"contactId"/.test(serialised)) leaks.push('contactId')
  if (/\+45\d{8}/.test(serialised)) leaks.push('telefonnummer')
  if (leaks.length) {
    console.error(`\n✖ AFBRUDT: output indeholder ${leaks.join(', ')} — det må ikke publiceres.`)
    process.exit(1)
  }
  step('privatlivstjek: ingen personhenførbare felter i output')
}

/* ── Mappers ─────────────────────────────────────────────────────────────── */

function toMailing(row, detail, stats, sentStats, reasons) {
  const d = detail ?? {}
  const tags = (d.Tags ?? row.Tags ?? []).map((t) => (t.Title ?? '').trim()).filter(Boolean)
  const subject = d.Subject ?? row.Subject ?? ''
  const started = sentStats?.Started ?? d.StartedDateTime ?? null
  const scheduled = d.ScheduledForSending ?? null
  const when = started ?? scheduled ?? d.LastModified ?? row.LastModified ?? null
  const parts = localParts(when)

  const s = stats ?? {}
  const recipients = s.RecipientCount ?? sentStats?.RecipientCount ?? 0
  const delivered = s.ReceivedCount ?? Math.max(0, (s.SentCount ?? sentStats?.SentCount ?? 0) - (s.BounceCount ?? 0))
  const opens = s.OpenCount ?? sentStats?.OpenCount ?? 0
  const clicks = s.ClickCount ?? sentStats?.ClickCount ?? 0

  return {
    id: row.IssueId,
    number: d.Number ?? null,
    subject,
    name: d.IssueName ?? row.IssueName ?? null,
    status: row.Status,
    statusName: ISSUE_STATUS[row.Status] ?? d.StatusName ?? String(row.Status),
    category: (d.Category ?? row.Category)?.Name ?? null,
    tags,
    journey: (d.Journey ?? row.Journey)?.Title ?? null,
    isRecurring: Boolean(d.IsRecurring),
    from: { name: d.FromName ?? null, address: d.FromAddress ?? null },
    lists: (d.Lists ?? []).map((l) => l.Name).filter(Boolean),
    segments: (d.Segments ?? []).map((x) => x.Name).filter(Boolean),
    when,
    scheduled,
    started,
    ended: sentStats?.Ended ?? d.EndedDateTime ?? null,
    local: parts,
    week: when ? isoWeek(when) : null,
    stats: {
      recipients,
      sent: s.SentCount ?? sentStats?.SentCount ?? 0,
      delivered,
      opens,
      clicks,
      openClicks: s.OpenClickCount ?? 0,
      conversions: s.ConversionCount ?? 0,
      bounces: s.BounceCount ?? sentStats?.BounceCount ?? 0,
      unsubscribes: s.UnsubscribeCount ?? 0,
      failed: s.FailedCount ?? sentStats?.FailedCount ?? 0,
      inactive: s.InactiveCount ?? 0,
      openRate: s.OpenPercentage ?? pct(opens, delivered),
      clickRate: s.ClickPercentage ?? pct(clicks, delivered),
      // Click-to-open: of those who opened, how many clicked. The honest
      // measure of whether the content delivered on the subject line.
      ctor: pct(clicks, opens),
      bounceRate: s.BouncePercentage ?? pct(s.BounceCount ?? 0, recipients),
      unsubRate: s.UnsubscribePercentage ?? pct(s.UnsubscribeCount ?? 0, delivered),
    },
    subjectAnalysis: analyseSubject(subject),
    content: analyseBody(d.BodyHtml, d.BodyText),
    unsubscribeReasons: Array.isArray(reasons)
      ? reasons.map((r) => ({
          reason: (r.Reason ?? r.ReasonText ?? r.UnsubscribeReasonText ?? r.Name ?? 'Ikke oplyst').toString().slice(0, 120),
          count: r.Count ?? r.Total ?? 1,
        }))
      : [],
  }
}

function toSms(row, stats) {
  const s = stats ?? {}
  const total = s.ContactsTotalCount ?? 0
  const recipients = s.ContactsRecipientCount ?? total
  const when = row.Started ?? row.ScheduledForSending ?? row.Created ?? row.Modified ?? null
  return {
    id: row.SmsMessageId,
    subject: row.Subject || row.Body?.slice(0, 60) || 'Uden emne',
    body: (row.Body ?? '').slice(0, 400),
    sender: row.Sender ?? s.Sender ?? null,
    status: row.Status,
    statusName: SMS_STATUS[row.Status] ?? String(row.Status),
    category: (row.Category ?? s.Category)?.Name ?? null,
    when,
    local: localParts(when),
    week: when ? isoWeek(when) : null,
    isRecurring: Boolean(row.IsRecurring),
    stats: {
      recipients,
      unique: s.ContactsUniqueCount ?? null,
      bounced: s.ContactsUniqueBouncedCount ?? 0,
      blocked: s.ContactsBlockedCount ?? 0,
      pending: s.ContactsPendingCount ?? 0,
      duplicates: s.ContactsDoubletsCount ?? 0,
      sentRate: s.SentPercentage ?? null,
      receivedRate: s.ReceivedPercentage ?? null,
      failRate: s.FailPercentage ?? null,
    },
    length: (row.Body ?? '').length,
    segments: Math.max(1, Math.ceil((row.Body ?? '').length / 160)),
    usesShortener: Boolean(row.UseUrlShortener),
  }
}

function toSurvey(row, summary, questions) {
  const responses = summary?.TotalResponseCount ?? row.ResponseCount ?? 0
  const respondents = summary?.TotalRespondentCount ?? row.RespondentCount ?? 0
  return {
    id: row.SurveyId,
    title: row.Title ?? summary?.Title ?? 'Uden titel',
    status: row.Status,
    statusName: SURVEY_STATUS[row.Status] ?? String(row.Status),
    isActive: Boolean(row.IsActive),
    start: row.Start ?? summary?.Start ?? null,
    end: row.End ?? summary?.End ?? null,
    lastModified: row.LastModified ?? null,
    responses,
    respondents,
    responseLimit: row.ResponseLimit ?? 0,
    url: summary?.Url ?? null,
    questionCount: Array.isArray(questions) ? questions.length : null,
    questionTypes: Array.isArray(questions)
      ? [...new Set(questions.map((q) => q.QuestionTypeName ?? q.TypeName ?? q.Type).filter(Boolean))].slice(0, 8)
      : [],
    tags: (row.Tags ?? []).map((t) => (t.Title ?? '').trim()).filter(Boolean),
  }
}

/**
 * Reduce a contact to the non-identifying attributes the analysis needs.
 * Called at the fetch boundary so full contact objects never reach the
 * aggregation, let alone the output.
 */
function profileOf(c) {
  const age = Number.isFinite(c.CustomNumeric1) ? c.CustomNumeric1 : null
  return {
    medlemstype: clean(c.Custom2),
    sektioner: splitMulti(c.Custom3),
    udvalgspost: clean(c.Custom4),
    netvaerk: splitMulti(c.Custom5),
    region: clean(c.Custom6) ?? clean(c.Region),
    interesser: splitMulti(c.Custom7),
    medlemskab: clean(c.CustomLong1),
    udmeldelsesgrund: clean(c.Custom1) ?? clean(c.Custom10),
    indmeldt: c.CustomDate1 ?? null,
    udmeldt: c.CustomDate2 ?? null,
    alder: age,
    koen: clean(c.Gender),
    postnummer: typeof c.PostalCode === 'string' ? c.PostalCode.trim().slice(0, 4) : null,
    isActive: Boolean(c.IsActive),
    hasBounced: Boolean(c.HasBounced),
    smsActive: Boolean(c.IsSmsActive),
    oprettet: c.Created ?? null,
  }
}

const clean = (v) => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s && s.toLowerCase() !== 'null' ? s : null
}

const splitMulti = (v) => {
  const s = clean(v)
  if (!s) return []
  return s.split(/[;,|]/).map((x) => x.trim()).filter(Boolean).slice(0, 12)
}

/**
 * A sample that is the same set on every run, so week-on-week movement in the
 * engagement figures reflects behaviour rather than a reshuffled sample.
 */
function stableSample(contacts, n) {
  if (contacts.length <= n) return contacts
  return contacts
    .map((c) => ({ c, h: createHash('sha1').update(String(c.ContactId)).digest('hex') }))
    .sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : 0))
    .slice(0, n)
    .map((x) => x.c)
}

main().catch((err) => {
  console.error(ug.redact(String(err?.stack ?? err)))
  process.exit(1)
})
