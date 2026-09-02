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
import { Ungapped, ISSUE_STATUS, SMS_STATUS, SMS_SENT_STATUSES, SURVEY_STATUS, CONTACT_FIELDS } from './lib/ungapped.mjs'
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
  // The key reaches two accounts; one is a retired copy marked "(raderas)".
  // Pick the live one rather than whichever the API lists first.
  const account = (accounts ?? []).map((a) => a.Name).find((n) => n && !/raderas|slettes|delete/i.test(n))
    ?? accounts?.[0]?.Name ?? 'Dansk Psykolog Forening'
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
    // Paused journey mails carry send timestamps too, so ask for both.
    const sentStats = row.Status === 50 || row.Status === 60
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

  const leaks = auditForPersonalData(payload)
  if (leaks.length) {
    console.error('\n✖ AFBRUDT — output indeholder personhenførbare værdier:')
    for (const l of leaks.slice(0, 30)) console.error(`   ${l.kind.padEnd(14)} ${l.path}  →  ${l.masked}`)
    if (leaks.length > 30) console.error(`   … og ${leaks.length - 30} mere`)
    process.exit(1)
  }
  step('privatlivstjek: ingen personhenførbare værdier i output')
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
          reason: scrubContactDetails((r.Reason ?? r.ReasonText ?? r.UnsubscribeReasonText ?? r.Name ?? 'Ikke oplyst').toString().slice(0, 120)),
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
    body: scrubContactDetails((row.Body ?? '').slice(0, 400)),
    sender: row.Sender ?? s.Sender ?? null,
    status: row.Status,
    statusName: SMS_STATUS[row.Status] ?? String(row.Status),
    wasSent: SMS_SENT_STATUSES.has(row.Status),
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
  const medlemskab = splitMulti(c.CustomLong1)
  return {
    medlemstype: clean(c.Custom2),
    kontingent: kontingentOf(medlemskab),
    sektioner: splitMulti(c.Custom3),
    udvalgspost: splitMulti(c.Custom4),
    netvaerk: splitMulti(c.Custom5),
    region: regionOf(c.Custom6) ?? regionOf(c.Region),
    interesser: splitMulti(c.Custom7),
    medlemskab,
    udmeldelsesgrund: clean(c.Custom1) ?? clean(c.Custom10),
    indmeldt: c.CustomDate1 ?? null,
    udmeldt: c.CustomDate2 ?? null,
    alder: age,
    koen: clean(c.Gender),
    postnummer: typeof c.PostalCode === 'string' ? c.PostalCode.trim().slice(0, 4) : null,
    isActive: Boolean(c.IsActive),
    hasBounced: Boolean(c.HasBounced),
    // IsSmsActive is set on almost every contact whether or not a mobile
    // number exists, so on its own it says nothing about reach.
    smsActive: Boolean(c.IsSmsActive && typeof c.SmsNumber === 'string' && c.SmsNumber.trim().length >= 8),
    oprettet: c.Created ?? null,
  }
}

/**
 * Free text that DP writes, but which a recipient's details could also reach:
 * an SMS body, an unsubscribe reason. Mask anything shaped like a way to
 * contact a person, so the text stays readable but can never publish one.
 */
function scrubContactDetails(text) {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, '[e-mail]')
    .replace(/(?:\+45|0045)[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/g, '[telefonnummer]')
    .replace(/(?<![\w-])\d{8}(?![\w-])/g, '[telefonnummer]')
}

const clean = (v) => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s && s.toLowerCase() !== 'null' ? s : null
}

/**
 * Ungapped stores multi-valued member fields as one string. The separator and
 * the quoting are not consistent — some rows read `A,B`, others `"A","B"` — so
 * split on the separators and strip the quotes rather than trusting a format.
 */
const splitMulti = (v) => {
  const s = clean(v)
  if (!s) return []
  return s
    .split(/[;,|]/)
    .map((x) => x.trim().replace(/^["'\u201d\u201c]+|["'\u201d\u201c]+$/g, '').trim())
    .filter(Boolean)
    .slice(0, 14)
}

/**
 * Kontingentgruppen — what a member pays under.
 *
 * It has no field of its own: it is mixed into "Medlemskab" alongside sections
 * and geography. These are the status labels DP uses, matched against the split
 * tokens. Anything that does not match stays in the full membership breakdown,
 * so nothing is lost — this view is just the clean cut of it.
 */
const KONTINGENT = /^(dp medlem|normaltansat|normalansat|pensionist|ledig|1 og 2 års kandidater|kandidat|studerende|studentersektionen|selvstændige psykologers sektion|selvstændig|dimittend|ydernummer|seniormedlem|æresmedlem|passiv|orlov)/i

const kontingentOf = (tokens) => tokens.filter((t) => KONTINGENT.test(t))

/**
 * Custom6 is meant to hold the member's region but also carries sections,
 * employers and a handful of Norwegian and Swedish counties. Keep the five
 * Danish regions as themselves and bucket the rest, so the geography view
 * compares like with like.
 */
const DK_REGIONS = ['Hovedstaden', 'Midtjylland', 'Nordjylland', 'Sjælland', 'Syddanmark']
const regionOf = (raw) => {
  const v = clean(raw)
  if (!v) return null
  const hit = DK_REGIONS.find((r) => v.toLowerCase().includes(r.toLowerCase()))
  return hit ?? 'Uden for de fem regioner'
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

/* ── Privatlivsvagt ──────────────────────────────────────────────────────── */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/
/**
 * A Danish number, not any run of eight digits: without the country code the
 * digits must stand alone as a whole token, or an ISO date and a GUID fragment
 * both read as a phone number.
 */
const PHONE_RE = /(?:\+45|0045)[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}|(?<![\w-])\d{8}(?![\w-])/

/**
 * Fields that legitimately hold an organisational address or number: DP's own
 * sender identity, and the numbers DP prints in its own SMS copy. Everything
 * else is checked, so a recipient's details can never slip through unnoticed.
 */
const ORGANISATIONAL = [
  /^mailings\.\d+\.from\.address$/,
  /^sms\.\d+\.sender$/,
]

const mask = (v) => String(v).replace(/[^\s@+.-]/g, '•').slice(0, 40)

/** Walk the payload and report every value that looks like it identifies a person. */
function auditForPersonalData(node, path = '', found = []) {
  if (node === null || node === undefined) return found
  if (Array.isArray(node)) {
    node.forEach((v, i) => auditForPersonalData(v, `${path}.${i}`, found))
    return found
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (/^contactid$|^recipientid$/i.test(k)) {
        found.push({ kind: 'kontakt-id', path: path ? `${path}.${k}` : k, masked: mask(v) })
      }
      auditForPersonalData(v, path ? `${path}.${k}` : k, found)
    }
    return found
  }
  if (typeof node !== 'string') return found
  if (ORGANISATIONAL.some((re) => re.test(path))) return found
  if (EMAIL_RE.test(node)) found.push({ kind: 'e-mailadresse', path, masked: mask(node.match(EMAIL_RE)[0]) })
  else if (PHONE_RE.test(node)) found.push({ kind: 'telefonnummer', path, masked: mask(node.match(PHONE_RE)[0]) })
  return found
}
