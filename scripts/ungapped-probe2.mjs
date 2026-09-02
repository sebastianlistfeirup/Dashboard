#!/usr/bin/env node
/**
 * Ungapped API probe — pass 4.
 *
 * One question: can per-recipient engagement be read in bulk? If it can, the
 * dashboard can say which member groups actually open and click. If it cannot,
 * engagement has to be attributed through the lists and segments each sendout
 * targeted. Probes the three candidate routes and records their shapes.
 *
 * PRIVACY: recipient rows are personal. Only structure and counts are written.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const KEY = process.env.UNGAPPED_API_KEY?.trim()
if (!KEY) { console.error('UNGAPPED_API_KEY is not set.'); process.exit(1) }
const BASE = 'https://api.ungapped.com'
const redact = (s) => String(s ?? '').split(KEY).join('«API_KEY»')

async function api(p, timeout = 90000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(BASE + p, { headers: { Accept: 'application/json', 'X-API-KEY': KEY }, signal: ctl.signal })
    const text = await r.text()
    let json = null; try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: r.status, bytes: text.length, json, text }
  } catch (e) { return { status: 0, bytes: 0, json: null, text: '', error: String(e?.message ?? e) } }
  finally { clearTimeout(t) }
}

function shapeOf(v, d = 0) {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return v.length ? { _array: v.length, of: shapeOf(v[0], d + 1) } : 'array<empty>'
  if (typeof v === 'object') {
    if (d > 5) return 'object<…>'
    const o = {}; for (const [k, x] of Object.entries(v).slice(0, 90)) o[k] = shapeOf(x, d + 1); return o
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return 'datetime'
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v)) return 'guid'
    if (v.includes('@')) return 'string<email>'
    return v.length <= 40 ? `string(${JSON.stringify(v)})` : `string(len ${v.length})`
  }
  return typeof v
}

const out = {}
async function main() {
  await mkdir(path.resolve('ungapped-probe2'), { recursive: true })

  // A contact id, taken from the first active contact and never written down.
  const contacts = await api('/Contacts/Active')
  const contactId = Array.isArray(contacts.json) ? contacts.json[0]?.ContactId : null
  out['contacts/active count'] = Array.isArray(contacts.json) ? contacts.json.length : null

  for (const [label, p] of [
    ['Timeline', `/Contacts/${contactId}/Timeline`],
    ['DataGroups', `/Contacts/${contactId}/DataGroups`],
    ['Categories', `/Contacts/${contactId}/Categories`],
    ['UnsubscribeReason', `/Contacts/${contactId}/UnsubscribeReason`],
    ['Lists for contact', `/Contacts/${contactId}/Lists`],
    ['Issues for contact', `/Issues/Recipient?contactId=${contactId}`],
  ]) {
    if (!contactId) break
    const r = await api(p)
    out[label] = { status: r.status, bytes: r.bytes, shape: r.json ? shapeOf(r.json) : null }
    console.log(`   ${String(r.status).padStart(3)} ${label.padEnd(22)} ${String(r.bytes).padStart(8)} b`)
  }

  // Do sent issues expose send occasions anywhere?
  const listing = await api('/Issues/Listing')
  const sentId = (listing.json ?? []).find((i) => i.Status === 50)?.IssueId
  if (sentId) {
    const full = await api(`/Issues/${sentId}`)
    const keys = full.json ? Object.keys(full.json) : []
    out['issue keys mentioning occasion/recipient'] = keys.filter((k) => /occasion|recipient|send/i.test(k))
    const stats = await api(`/Issues/Sent/${sentId}/Statistics`)
    out['Issues/Sent/{id}/Statistics body'] = stats.json
    // Try the recipients route with the issue id in the occasion slot, and with
    // the send-occasion ids some MailDirect builds expose on the statistics row.
    for (const occ of [sentId, stats.json?.SendOccasionId, stats.json?.IssueSendOccasionId].filter(Boolean)) {
      const r = await api(`/Issues/${sentId}/SendOccasions/${occ}/Recipients`)
      out[`SendOccasions/${occ === sentId ? 'issueId' : 'statsId'}/Recipients`] = {
        status: r.status, bytes: r.bytes,
        count: Array.isArray(r.json) ? r.json.length : null,
        shape: r.json ? shapeOf(Array.isArray(r.json) ? r.json.slice(0, 1) : r.json) : null,
        preview: r.status >= 400 ? redact(r.text.slice(0, 300)) : undefined,
      }
      console.log(`   ${String(r.status).padStart(3)} SendOccasions recipients (${r.bytes} b)`)
    }
  }

  // How large is a list's contact payload? Needed to decide whether the ETL can
  // profile every list on an hourly schedule.
  const lists = await api('/Lists')
  const smallest = (lists.json ?? []).slice().sort((a, b) => a.ContactCount - b.ContactCount).find((l) => l.ContactCount > 0)
  if (smallest) {
    const r = await api(`/Lists/${smallest.ListId}/Contacts`)
    out['Lists/{id}/Contacts'] = {
      status: r.status, bytes: r.bytes,
      count: Array.isArray(r.json) ? r.json.length : null,
      declaredContactCount: smallest.ContactCount,
      shape: r.json ? shapeOf(Array.isArray(r.json) ? r.json.slice(0, 1) : r.json) : null,
    }
    console.log(`   ${String(r.status).padStart(3)} Lists/{id}/Contacts → ${Array.isArray(r.json) ? r.json.length : '?'} rows, ${r.bytes} b`)
  }

  await writeFile(path.resolve('ungapped-probe2', 'probe2.json'), redact(JSON.stringify(out, null, 2)))
  console.log('\n✔ done')
}
main().catch((e) => { console.error(redact(String(e?.stack ?? e))); process.exit(1) })
