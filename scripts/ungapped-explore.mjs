#!/usr/bin/env node
/**
 * Ungapped API discovery.
 *
 * Read-only: only ever issues GET requests, so it cannot mutate anything in the
 * Ungapped account. Figures out which authentication scheme the API accepts,
 * sweeps a broad list of candidate endpoints, and writes a structural report
 * plus (redacted) sample payloads so the schema can be designed against.
 *
 * The API key is read from UNGAPPED_API_KEY and is redacted from every artefact.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const KEY = process.env.UNGAPPED_API_KEY?.trim()
if (!KEY) {
  console.error('UNGAPPED_API_KEY is not set — add it as a repository secret.')
  process.exit(1)
}

const OUT = path.resolve('ungapped-discovery')
const TIMEOUT_MS = 20000
const redact = (s) => String(s ?? '').split(KEY).join('«API_KEY»')

/** Every way an API of this shape might expect the key. */
const AUTH_SCHEMES = [
  { id: 'authorization-raw', headers: { Authorization: KEY } },
  { id: 'authorization-bearer', headers: { Authorization: `Bearer ${KEY}` } },
  { id: 'authorization-apikey', headers: { Authorization: `ApiKey ${KEY}` } },
  { id: 'authorization-token', headers: { Authorization: `Token ${KEY}` } },
  { id: 'header-apikey', headers: { apikey: KEY } },
  { id: 'header-x-api-key', headers: { 'X-API-KEY': KEY } },
  { id: 'header-x-apikey', headers: { 'X-ApiKey': KEY } },
  { id: 'header-api-key', headers: { 'api-key': KEY } },
  { id: 'header-ungapped-api-key', headers: { 'X-Ungapped-ApiKey': KEY } },
  { id: 'query-apikey', query: { apikey: KEY } },
  { id: 'query-api_key', query: { api_key: KEY } },
  { id: 'query-key', query: { key: KEY } },
  { id: 'query-token', query: { token: KEY } },
  { id: 'none', headers: {} },
]

const BASES = ['https://api.ungapped.com']
const PREFIXES = ['', '/v1', '/api', '/api/v1', '/v2', '/rest', '/1.0', '/public/v1']

/** Documentation-ish entry points worth dumping verbatim. */
const DOC_PATHS = [
  '/', '/docs', '/doc', '/documentation', '/help',
  '/swagger', '/swagger.json', '/swagger/v1/swagger.json', '/swagger-ui',
  '/openapi', '/openapi.json', '/openapi.yaml', '/api-docs', '/api-docs.json',
  '/redoc', '/spec', '/schema', '/.well-known/openapi.json',
]

/** Candidate resources across Ungapped's product areas. */
const RESOURCES = [
  // identity / account
  'me', 'whoami', 'account', 'accounts', 'user', 'users', 'profile', 'ping', 'status', 'version',
  // contacts and structure
  'contacts', 'contact', 'recipients', 'recipient', 'subscribers', 'members', 'persons', 'people',
  'groups', 'group', 'lists', 'list', 'segments', 'segment', 'tags', 'tag', 'categories',
  'fields', 'customfields', 'custom-fields', 'attributes', 'properties', 'demographics',
  // email sendouts
  'mailings', 'mailing', 'campaigns', 'campaign', 'newsletters', 'newsletter',
  'sendouts', 'sendout', 'sendings', 'sending', 'mails', 'mail', 'emails', 'email',
  'dispatches', 'deliveries', 'broadcasts', 'messages', 'message',
  // sms
  'sms', 'smsmessages', 'sms-messages', 'texts', 'textmessages', 'shortmessages',
  // surveys / forms / events
  'surveys', 'survey', 'forms', 'form', 'questionnaires', 'polls', 'questions', 'answers',
  'invitations', 'invites', 'events', 'event', 'signups', 'registrations',
  'landingpages', 'pages', 'templates', 'template',
  // automation
  'automations', 'automation', 'flows', 'flow', 'journeys', 'triggers', 'workflows',
  // analytics
  'statistics', 'stats', 'reports', 'report', 'analytics', 'metrics', 'results',
  'opens', 'clicks', 'bounces', 'unsubscribes', 'optouts', 'complaints',
  'activities', 'activity', 'interactions', 'links', 'urls', 'clicked-links',
  // infra
  'senders', 'domains', 'webhooks', 'integrations', 'apikeys', 'settings',
]

const results = []
const bodies = new Map()

function buildUrl(base, prefix, p, query) {
  const url = new URL(base + prefix + (p.startsWith('/') ? p : `/${p}`))
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  return url
}

async function get(url, headers) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/html;q=0.8, */*;q=0.5',
        'User-Agent': 'dp-dashboard-discovery/1.0',
        ...headers,
      },
      redirect: 'follow',
      signal: ctl.signal,
    })
    const text = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      ms: Date.now() - started,
      length: text.length,
      text,
    }
  } catch (err) {
    return {
      ok: false, status: 0, contentType: '', ms: Date.now() - started,
      length: 0, text: '', error: String(err?.message ?? err),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Describe a JSON value's shape without dumping (possibly personal) values. */
function shapeOf(value, depth = 0) {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (!value.length) return 'array<empty>'
    if (depth > 3) return 'array<…>'
    return { array: value.length, of: shapeOf(value[0], depth + 1) }
  }
  if (typeof value === 'object') {
    if (depth > 3) return 'object<…>'
    const out = {}
    for (const [k, v] of Object.entries(value).slice(0, 60)) out[k] = shapeOf(v, depth + 1)
    return out
  }
  return typeof value
}

function parseMaybeJson(text, contentType) {
  if (!text) return null
  if (!/json/i.test(contentType) && !/^\s*[[{]/.test(text)) return null
  try { return JSON.parse(text) } catch { return null }
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'root'

async function probe(label, url, scheme) {
  const res = await get(url, scheme.headers ?? {})
  const json = parseMaybeJson(res.text, res.contentType)
  const record = {
    label,
    url: redact(url.toString()),
    auth: scheme.id,
    status: res.status,
    contentType: res.contentType,
    ms: res.ms,
    bytes: res.length,
    error: res.error ? redact(res.error) : undefined,
    isJson: Boolean(json),
    shape: json ? shapeOf(json) : undefined,
    preview: redact(res.text.slice(0, 600)),
  }
  results.push(record)
  if (res.text) bodies.set(`${slug(label)}__${scheme.id}`, redact(res.text))
  return { res, json, record }
}

async function main() {
  await mkdir(path.join(OUT, 'bodies'), { recursive: true })

  // ── 1. Documentation surfaces. Tried unauthenticated: an API that publishes
  //       its own reference at the root tells us everything in one request.
  console.log('▸ Phase 1 — documentation surfaces')
  const docFindings = []
  for (const base of BASES) {
    for (const p of DOC_PATHS) {
      const { res, record } = await probe(`doc ${p}`, buildUrl(base, '', p), { id: 'none', headers: {} })
      console.log(`   ${String(record.status).padStart(3)} ${p} (${record.bytes} b, ${record.contentType.split(';')[0]})`)
      if (res.status >= 200 && res.status < 400 && res.length > 0) docFindings.push(record)
    }
  }

  // ── 2. Which authentication scheme does the API accept?
  console.log('▸ Phase 2 — authentication schemes')
  const authTargets = ['/contacts', '/groups', '/mailings', '/me', '/account', '/v1/contacts', '/v1/mailings', '/api/contacts']
  const authScore = new Map()
  for (const scheme of AUTH_SCHEMES) {
    let score = 0
    const seen = []
    for (const p of authTargets) {
      const url = buildUrl(BASES[0], '', p, scheme.query)
      const { record } = await probe(`auth ${p}`, url, scheme)
      seen.push(`${p}=${record.status}`)
      // 200 means it worked. 400/404/405 mean we got past auth into the app and
      // merely asked for the wrong route or arguments — still a strong signal.
      if (record.status === 200) score += 10
      else if (record.status === 400 || record.status === 404 || record.status === 405) score += 2
    }
    authScore.set(scheme.id, score)
    console.log(`   ${scheme.id.padEnd(26)} score ${score}  ${seen.join(' ')}`)
  }
  const bestId = [...authScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const best = AUTH_SCHEMES.find((s) => s.id === bestId) ?? AUTH_SCHEMES[0]
  console.log(`   → best scheme: ${best.id}`)

  // ── 3. Sweep resources across every plausible path prefix.
  console.log('▸ Phase 3 — endpoint sweep')
  const hits = []
  for (const prefix of PREFIXES) {
    let prefixHits = 0
    for (const r of RESOURCES) {
      const url = buildUrl(BASES[0], prefix, `/${r}`, best.query)
      const { record } = await probe(`sweep ${prefix}/${r}`, url, best)
      if (record.status === 200 && record.bytes > 0) {
        hits.push(record)
        prefixHits += 1
        console.log(`   200 ${prefix}/${r}  ${record.bytes} b  ${record.isJson ? 'json' : record.contentType.split(';')[0]}`)
      }
    }
    console.log(`   prefix "${prefix || '/'}" → ${prefixHits} hits`)
  }

  // ── 4. Report
  const report = {
    generatedAt: new Date().toISOString(),
    keyPrefix: `${KEY.slice(0, 4)}…${KEY.slice(-4)}`,
    bestAuthScheme: best.id,
    authScores: Object.fromEntries(authScore),
    docFindings: docFindings.map((d) => ({ label: d.label, status: d.status, bytes: d.bytes, contentType: d.contentType })),
    hits: hits.map((h) => ({ label: h.label, url: h.url, status: h.status, bytes: h.bytes, isJson: h.isJson, shape: h.shape })),
    all: results.map(({ preview, ...rest }) => rest),
  }
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  await writeFile(path.join(OUT, 'all-responses.json'), JSON.stringify(results, null, 2))
  for (const [name, body] of bodies) {
    if (!body.trim()) continue
    await writeFile(path.join(OUT, 'bodies', `${name}.txt`), body.slice(0, 400000))
  }

  const md = [
    '# Ungapped API — discovery report',
    '',
    `Generated: ${report.generatedAt}`,
    `Key: \`${report.keyPrefix}\``,
    `Best auth scheme: \`${report.bestAuthScheme}\``,
    '',
    '## Documentation surfaces that responded',
    '',
    docFindings.length
      ? docFindings.map((d) => `- \`${d.label}\` → ${d.status}, ${d.bytes} bytes, ${d.contentType}`).join('\n')
      : '_none_',
    '',
    '## Endpoints returning 200',
    '',
    hits.length ? hits.map((h) => `- \`${h.label}\` → ${h.bytes} bytes${h.isJson ? ' (JSON)' : ''}`).join('\n') : '_none_',
    '',
    '## Status codes seen (all probes)',
    '',
    '| probe | auth | status | bytes |',
    '| --- | --- | ---: | ---: |',
    ...results
      .filter((r) => r.status !== 0)
      .slice(0, 500)
      .map((r) => `| \`${r.label}\` | ${r.auth} | ${r.status} | ${r.bytes} |`),
  ].join('\n')
  await writeFile(path.join(OUT, 'REPORT.md'), md)

  console.log(`\n✔ wrote ${results.length} probe results to ungapped-discovery/`)
  console.log(`  200-hits: ${hits.length}, doc surfaces: ${docFindings.length}, best auth: ${best.id}`)
}

main().catch((err) => { console.error(redact(String(err?.stack ?? err))); process.exit(1) })
