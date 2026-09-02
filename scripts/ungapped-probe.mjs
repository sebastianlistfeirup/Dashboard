#!/usr/bin/env node
/**
 * Ungapped API probe — pass 3.
 *
 * The statistics endpoints carry no schema in the Swagger definition, so their
 * shapes have to be observed. This samples each of them against real ids and
 * records the structure, plus the account metadata the dashboard needs.
 *
 * PRIVACY: the repository is public. Numbers and DP's own content (subject
 * lines, tag names, list names) are recorded. Anything a recipient wrote or
 * that identifies one is reduced to a shape or a bucketed count.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const KEY = process.env.UNGAPPED_API_KEY?.trim()
if (!KEY) { console.error('UNGAPPED_API_KEY is not set.'); process.exit(1) }

const BASE = 'https://api.ungapped.com'
const OUT = path.resolve('ungapped-probe')
const redact = (s) => String(s ?? '').split(KEY).join('«API_KEY»')

async function api(pathname, { timeout = 90000 } = {}) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const res = await fetch(BASE + pathname, {
      headers: { Accept: 'application/json', 'X-API-KEY': KEY, 'User-Agent': 'dp-dashboard/1.0' },
      signal: ctl.signal,
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, bytes: text.length, json, text }
  } catch (err) {
    return { status: 0, bytes: 0, json: null, text: '', error: String(err?.message ?? err) }
  } finally { clearTimeout(t) }
}

/** Structure with scalar types; short strings kept because they are usually enums. */
function shapeOf(v, depth = 0) {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) {
    if (!v.length) return 'array<empty>'
    if (depth > 5) return 'array<…>'
    return { _array: v.length, of: shapeOf(v[0], depth + 1) }
  }
  if (typeof v === 'object') {
    if (depth > 5) return 'object<…>'
    const o = {}
    for (const [k, x] of Object.entries(v).slice(0, 90)) o[k] = shapeOf(x, depth + 1)
    return o
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return 'datetime'
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v)) return 'guid'
    if (v.includes('@')) return 'string<email>'
    return v.length <= 40 ? `string(${JSON.stringify(v)})` : `string(len ${v.length})`
  }
  return typeof v
}

const record = {}
const note = (key, res, { keepBody = false } = {}) => {
  record[key] = {
    status: res.status, bytes: res.bytes, error: res.error,
    shape: res.json ? shapeOf(res.json) : null,
    body: keepBody && res.json ? res.json : undefined,
  }
  const n = Array.isArray(res.json) ? ` ${res.json.length} items` : ''
  console.log(`   ${String(res.status).padStart(3)} ${key.padEnd(52)} ${String(res.bytes).padStart(9)} b${n}`)
}

async function main() {
  await mkdir(OUT, { recursive: true })

  // ── Sendouts: which ones exist, and do the light listings carry send dates?
  console.log('▸ udsendelser')
  const listing = await api('/Issues/Listing')
  note('GET /Issues/Listing', listing)
  const sent = await api('/Issues/Sent?tagIds=&categoryIds=')
  note('GET /Issues/Sent', sent)
  const sentList = await api('/Issues/SentList?tagIds=&categoryIds=')
  note('GET /Issues/SentList', sentList)
  const allTagged = await api('/Issues/all?tagIds=&categoryIds=')
  note('GET /Issues/all', allTagged)

  // Choose real sent issues to probe statistics against.
  const pool = [sentList.json, sent.json, listing.json].find((x) => Array.isArray(x) && x.length) ?? []
  const sentIssues = pool.filter((i) => i?.Status === 50 || i?.Status === undefined).slice(0, 4)
  const ids = sentIssues.map((i) => i.IssueId).filter(Boolean)
  console.log(`   probing statistics for ${ids.length} issues`)

  for (const [n, id] of ids.entries()) {
    note(`GET /Issues/${n}/Statistics/Overview`, await api(`/Issues/${id}/Statistics/Overview`), { keepBody: n === 0 })
    note(`GET /Issues/Sent/${n}/Statistics`, await api(`/Issues/Sent/${id}/Statistics`), { keepBody: n === 0 })
    const reasons = await api(`/Issues/${id}/Statistics/UnsubscribeReasons`)
    note(`GET /Issues/${n}/Statistics/UnsubscribeReasons`, reasons)
  }

  // One full issue, field names only — the body carries the whole HTML template.
  if (ids[0]) {
    const one = await api(`/Issues/${ids[0]}`)
    record['GET /Issues/{id} — field names'] = {
      status: one.status, bytes: one.bytes,
      fields: one.json && typeof one.json === 'object' ? Object.keys(one.json) : null,
      shape: one.json ? shapeOf({ ...one.json, HtmlBody: undefined, Html: undefined, Content: undefined }) : null,
    }
    console.log(`   ${one.status} GET /Issues/{id} → ${one.json ? Object.keys(one.json).length : 0} fields, ${one.bytes} b`)
  }

  // ── SMS
  console.log('▸ sms')
  const sms = await api('/Textmessages/Listing')
  note('GET /Textmessages/Listing', sms, { keepBody: true })
  for (const [n, s] of (sms.json ?? []).filter((x) => x?.Status === 50 || x?.Status >= 40).slice(0, 3).entries()) {
    note(`GET /Textmessages/${n}/Statistics`, await api(`/Textmessages/${s.SmsMessageId}/Statistics`), { keepBody: n === 0 })
    note(`GET /Textmessages/Listings/${n}/Statistics`, await api(`/Textmessages/Listings/${s.SmsMessageId}/Statistics`), { keepBody: n === 0 })
  }

  // ── Spørgeskemaer
  console.log('▸ spørgeskemaer')
  const surveys = await api('/Surveys/Listing')
  note('GET /Surveys/Listing', surveys, { keepBody: true })
  note('GET /Surveys/Summary', await api('/Surveys/Summary'), { keepBody: true })
  for (const [n, s] of (surveys.json ?? []).slice(0, 3).entries()) {
    note(`GET /Surveys/${n}/Statistics/Summary`, await api(`/Surveys/${s.SurveyId}/Statistics/Summary`), { keepBody: n === 0 })
    note(`GET /Surveys/${n}/Statistics`, await api(`/Surveys/${s.SurveyId}/Statistics`))
    note(`GET /Surveys/${n}/Questions`, await api(`/Surveys/${s.SurveyId}/Questions`), { keepBody: n === 0 })
  }

  // ── Lister, segmenter, felter
  console.log('▸ lister, segmenter og felter')
  const lists = await api('/Lists')
  note('GET /Lists', lists, { keepBody: true })
  for (const [n, l] of (lists.json ?? []).slice(0, 3).entries()) {
    note(`GET /Lists/${n}/Stats`, await api(`/Lists/${l.ListId}/Stats`), { keepBody: n === 0 })
  }
  note('GET /Contacts/Fields', await api('/Contacts/Fields'), { keepBody: true })
  note('GET /Contacts/Count', await api('/Contacts/Count'), { keepBody: true })
  note('GET /Segments', await api('/Segments'))
  note('GET /Tags', await api('/Tags'), { keepBody: true })
  note('GET /Categories', await api('/Categories'), { keepBody: true })

  // ── Per-recipient reach: needed for segment-level open/click analysis.
  console.log('▸ modtager-niveau')
  if (ids[0]) {
    const one = await api(`/Issues/${ids[0]}`)
    const occasions = one.json?.SendOccasions ?? one.json?.sendOccasions ?? null
    record['SendOccasions on issue'] = { shape: occasions ? shapeOf(occasions) : null }
    const occId = Array.isArray(occasions) && occasions[0]
      ? (occasions[0].SendOccasionId ?? occasions[0].Id ?? occasions[0].OccasionId) : null
    if (occId) {
      const recips = await api(`/Issues/${ids[0]}/SendOccasions/${occId}/Recipients`)
      // Recipient rows are personal: structure only, plus how many rows exist.
      record['GET /Issues/{id}/SendOccasions/{occ}/Recipients'] = {
        status: recips.status, bytes: recips.bytes,
        count: Array.isArray(recips.json) ? recips.json.length : null,
        shape: recips.json ? shapeOf(Array.isArray(recips.json) ? recips.json.slice(0, 1) : recips.json) : null,
      }
      console.log(`   ${recips.status} recipients for one send occasion → ${Array.isArray(recips.json) ? recips.json.length : '?'} rows`)
    } else {
      console.log('   no send occasion id found on the issue')
    }
  }

  await writeFile(path.join(OUT, 'probe.json'), redact(JSON.stringify(record, null, 2)))
  console.log(`\n✔ probed ${Object.keys(record).length} endpoints`)
}

main().catch((e) => { console.error(redact(String(e?.stack ?? e))); process.exit(1) })
