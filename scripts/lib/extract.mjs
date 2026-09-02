/**
 * Derived measures for a sendout: what the subject line does, what the body
 * contains, and when it went out. Everything here is computed from DP's own
 * content — no recipient data passes through.
 */

const DK_TZ = 'Europe/Copenhagen'

/** Parts of a UTC instant as they read in Danish local time. */
export function localParts(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat('da-DK', {
    timeZone: DK_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit',
    year: 'numeric', month: '2-digit', day: '2-digit', hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  // Intl gives a localised weekday name; derive the index from a stable format.
  const wdName = new Intl.DateTimeFormat('en-GB', { timeZone: DK_TZ, weekday: 'short' }).format(d)
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wdName)
  return {
    iso,
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday, // 0 = søndag
    date: `${p.year}-${p.month}-${p.day}`,
    yearMonth: `${p.year}-${p.month}`,
  }
}

/** ISO week, used for the trend line. */
export function isoWeek(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-U${String(week).padStart(2, '0')}`
}

const EMOJI = /\p{Extended_Pictographic}/u

/** What a subject line is doing, so the dashboard can test what works. */
export function analyseSubject(subject) {
  const s = (subject ?? '').trim()
  const words = s ? s.split(/\s+/).filter(Boolean) : []
  const capsWords = words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-ZÆØÅ]/.test(w))
  return {
    text: s,
    length: s.length,
    words: words.length,
    hasEmoji: EMOJI.test(s),
    hasQuestion: s.includes('?'),
    hasExclamation: s.includes('!'),
    hasNumber: /\d/.test(s),
    hasPersonalisation: /\[@|\{\{|\[%/.test(s),
    hasColon: s.includes(':'),
    capsWords: capsWords.length,
    startsWithVerb: null, // filled in by the analyser, which has the word list
    firstWord: words[0]?.replace(/[^\p{L}\p{N}]/gu, '') ?? '',
  }
}

/**
 * Content measures from the sent HTML. Links are DP's own destinations, so the
 * dashboard can show which kinds of content earn clicks.
 */
export function analyseBody(html, text) {
  const body = html ?? ''
  const hrefs = [...body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])
  const links = hrefs.filter((h) => /^https?:/i.test(h))
  const hosts = new Map()
  const paths = new Map()
  for (const href of links) {
    try {
      const u = new URL(href)
      // Ungapped rewrites destinations for click tracking; keep the visible host
      // when it is a real one, and fold trackers into a single bucket.
      const host = u.hostname.replace(/^www\./, '')
      hosts.set(host, (hosts.get(host) ?? 0) + 1)
      const key = `${host}${u.pathname}`.replace(/\/$/, '')
      paths.set(key, (paths.get(key) ?? 0) + 1)
    } catch { /* malformed href */ }
  }
  const plain = (text ?? body.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  const images = (body.match(/<img\b/gi) ?? []).length
  const buttons = (body.match(/class="[^"]*(?:btn|button|cta)[^"]*"/gi) ?? []).length

  return {
    links: links.length,
    uniqueLinks: new Set(links).size,
    hosts: [...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([host, n]) => ({ host, n })),
    topPaths: [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => ({ path: p, n })),
    images,
    buttons,
    words: plain ? plain.split(/\s+/).length : 0,
    chars: plain.length,
    readingMinutes: plain ? Math.max(1, Math.round(plain.split(/\s+/).length / 200)) : 0,
  }
}

/** Safe division that returns null rather than NaN or Infinity. */
export const rate = (numerator, denominator) =>
  denominator > 0 ? numerator / denominator : null

/** Percentage with one decimal, or null. */
export const pct = (numerator, denominator) => {
  const r = rate(numerator, denominator)
  return r === null ? null : Math.round(r * 1000) / 10
}
