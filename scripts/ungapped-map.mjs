#!/usr/bin/env node
/**
 * Ungapped API map — pass 2.
 *
 * The API is a Swashbuckle (ASP.NET) service; its full Swagger definition lives
 * at /swagger/docs/v2. This fetches that spec, writes a readable map of every
 * operation, then samples each parameterless GET so the response shapes are known.
 *
 * PRIVACY: the repository is public. Endpoints that return people (contacts,
 * users, recipients, respondents, …) are recorded as *shapes only* — never
 * values. Everything else records values, truncated. The API key is redacted
 * from every artefact.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const KEY = process.env.UNGAPPED_API_KEY?.trim()
if (!KEY) { console.error('UNGAPPED_API_KEY is not set.'); process.exit(1) }

const BASE = 'https://api.ungapped.com'
const AUTH = { 'X-API-KEY': KEY }           // established by pass 1
const OUT = path.resolve('ungapped-map')
const redact = (s) => String(s ?? '').split(KEY).join('«API_KEY»')

/** Paths whose payloads are personal data: record structure, never content. */
const PEOPLE = /contact|recipient|subscriber|\buser\b|users|member|person|respondent|answer|address|profile|audience|optout|unsubscribe|bounce/i

async function get(url, { timeout = 45000 } = {}) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'dp-dashboard/1.0', ...AUTH },
      signal: ctl.signal,
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, contentType: res.headers.get('content-type') ?? '', text, json }
  } catch (err) {
    return { status: 0, contentType: '', text: '', json: null, error: String(err?.message ?? err) }
  } finally { clearTimeout(t) }
}

function shapeOf(value, depth = 0) {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) {
    if (!value.length) return 'array<empty>'
    if (depth > 4) return 'array<…>'
    return { _array: value.length, of: shapeOf(value[0], depth + 1) }
  }
  if (typeof value === 'object') {
    if (depth > 4) return 'object<…>'
    const out = {}
    for (const [k, v] of Object.entries(value).slice(0, 80)) out[k] = shapeOf(v, depth + 1)
    return out
  }
  if (typeof value === 'string') {
    // Keep short enum-ish strings, they are usually status names, not data.
    return value.length <= 32 && !value.includes('@') ? `string(${JSON.stringify(value)})` : 'string'
  }
  return typeof value
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 110) || 'root'

async function main() {
  await mkdir(path.join(OUT, 'samples'), { recursive: true })

  // ── 1. The Swagger definition.
  console.log('▸ fetching Swagger definition')
  let spec = null
  for (const p of ['/swagger/docs/v2', '/swagger/docs/v1', '/swagger/docs/v3']) {
    const res = await get(BASE + p)
    console.log(`   ${res.status} ${p} (${res.text.length} bytes)`)
    if (res.status === 200 && res.json) {
      spec = res.json
      await writeFile(path.join(OUT, `swagger${p.replace(/\//g, '-')}.json`), redact(JSON.stringify(res.json, null, 2)))
      break
    }
  }
  if (!spec) { console.error('No Swagger definition found — cannot map the API.'); process.exit(1) }

  // ── 2. Readable operation map.
  const ops = []
  for (const [p, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue
      const params = (op.parameters ?? []).map((pa) => ({
        name: pa.name, in: pa.in, required: !!pa.required, type: pa.type ?? pa.schema?.$ref ?? pa.schema?.type,
      }))
      ops.push({
        path: p,
        method: method.toUpperCase(),
        summary: op.summary ?? '',
        tags: op.tags ?? [],
        params,
        requiredParams: params.filter((x) => x.required).map((x) => `${x.name}(${x.in})`),
        responseRef: op.responses?.['200']?.schema?.$ref ?? op.responses?.['200']?.schema?.items?.$ref ?? null,
      })
    }
  }
  ops.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  await writeFile(path.join(OUT, 'operations.json'), JSON.stringify(ops, null, 2))

  const byTag = new Map()
  for (const o of ops) for (const t of (o.tags.length ? o.tags : ['(untagged)'])) {
    if (!byTag.has(t)) byTag.set(t, [])
    byTag.get(t).push(o)
  }
  const md = [
    '# Ungapped API — operation map',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Spec: \`${spec.info?.title ?? '?'}\` version \`${spec.info?.version ?? '?'}\``,
    `Operations: ${ops.length} across ${byTag.size} tags`,
    `Auth: \`X-API-KEY\` header`,
    '',
    ...[...byTag.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([tag, list]) => [
      `## ${tag} (${list.length})`,
      '',
      ...list.map((o) => `- \`${o.method} ${o.path}\`${o.requiredParams.length ? ` — required: ${o.requiredParams.join(', ')}` : ''}${o.summary ? ` — ${o.summary}` : ''}`),
      '',
    ]),
  ].join('\n')
  await writeFile(path.join(OUT, 'OPERATIONS.md'), md)
  console.log(`   ${ops.length} operations, ${byTag.size} tags`)

  // ── 3. Sample every GET that needs no arguments.
  console.log('▸ sampling parameterless GET endpoints')
  const samples = []
  const targets = ops.filter((o) => o.method === 'GET' && o.requiredParams.length === 0 && !o.path.includes('{'))
  for (const o of targets) {
    const res = await get(BASE + o.path)
    const isPeople = PEOPLE.test(o.path)
    const count = Array.isArray(res.json) ? res.json.length
      : Array.isArray(res.json?.Items) ? res.json.Items.length
      : Array.isArray(res.json?.Data) ? res.json.Data.length : null
    const record = {
      path: o.path, status: res.status, bytes: res.text.length, count,
      personal: isPeople,
      shape: res.json ? shapeOf(res.json) : null,
    }
    samples.push(record)
    console.log(`   ${String(res.status).padStart(3)} ${o.path.padEnd(46)} ${String(res.text.length).padStart(8)} b${count !== null ? `  ${count} items` : ''}${isPeople ? '  [personal → shape only]' : ''}`)
    if (res.status === 200 && res.json && !isPeople) {
      await writeFile(path.join(OUT, 'samples', `${slug(o.path)}.json`), redact(JSON.stringify(res.json, null, 2)).slice(0, 900000))
    }
  }
  await writeFile(path.join(OUT, 'samples-index.json'), JSON.stringify(samples, null, 2))

  console.log(`\n✔ mapped ${ops.length} operations, sampled ${samples.length} endpoints`)
}

main().catch((e) => { console.error(redact(String(e?.stack ?? e))); process.exit(1) })
