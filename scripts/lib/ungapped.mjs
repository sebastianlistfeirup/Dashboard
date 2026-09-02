/**
 * Ungapped API client.
 *
 * Read-only by construction: the only verb it can issue is GET, so a bug here
 * cannot alter anything in DP's Ungapped account. Authentication is the
 * X-API-KEY header, established by the discovery pass.
 */

const BASE = 'https://api.ungapped.com'

export class Ungapped {
  #key
  #concurrency
  #inflight = 0
  #queue = []

  stats = { requests: 0, retries: 0, failures: 0, bytes: 0, ms: 0 }

  constructor(key, { concurrency = 6 } = {}) {
    if (!key) throw new Error('Ungapped: missing API key')
    this.#key = key
    this.#concurrency = concurrency
  }

  /** Strip the key from anything that might be logged or written to disk. */
  redact(text) {
    return String(text ?? '').split(this.#key).join('«API_KEY»')
  }

  async #slot() {
    if (this.#inflight < this.#concurrency) { this.#inflight += 1; return }
    await new Promise((resolve) => this.#queue.push(resolve))
    this.#inflight += 1
  }

  #release() {
    this.#inflight -= 1
    this.#queue.shift()?.()
  }

  /**
   * GET a path and parse JSON. Retries transient failures with backoff; a 404
   * resolves to null so callers can treat "no such thing" as data rather than
   * as an error.
   */
  async get(path, { retries = 3, timeout = 120_000, allow404 = true } = {}) {
    await this.#slot()
    try {
      let lastError
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (attempt > 0) {
          this.stats.retries += 1
          await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1) + Math.random() * 250))
        }
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), timeout)
        const started = Date.now()
        try {
          const res = await fetch(BASE + path, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'X-API-KEY': this.#key,
              'User-Agent': 'dp-udsendelsesdashboard/1.0',
            },
            signal: ctl.signal,
          })
          const text = await res.text()
          this.stats.requests += 1
          this.stats.bytes += text.length
          this.stats.ms += Date.now() - started

          if (res.status === 404 && allow404) return null
          if (res.status === 429 || res.status >= 500) {
            lastError = new Error(`${res.status} on ${path}`)
            continue
          }
          if (!res.ok) {
            lastError = new Error(`${res.status} on ${path}: ${this.redact(text).slice(0, 200)}`)
            break
          }
          if (!text) return null
          try { return JSON.parse(text) } catch {
            lastError = new Error(`non-JSON response from ${path}`)
            break
          }
        } catch (err) {
          lastError = err
        } finally {
          clearTimeout(timer)
        }
      }
      this.stats.failures += 1
      throw lastError ?? new Error(`GET ${path} failed`)
    } finally {
      this.#release()
    }
  }

  /** GET that returns null instead of throwing — for endpoints that may 500. */
  async tryGet(path, opts) {
    try { return await this.get(path, opts) } catch { this.stats.failures += 1; return null }
  }

  /** Map over items with the client's concurrency, reporting progress. */
  async map(items, fn, { label = 'items', onProgress } = {}) {
    const out = new Array(items.length)
    let done = 0
    await Promise.all(items.map(async (item, i) => {
      out[i] = await fn(item, i)
      done += 1
      if (onProgress && (done % 25 === 0 || done === items.length)) onProgress(done, items.length, label)
    }))
    return out
  }
}

/* ── Ungapped enumerations ────────────────────────────────────────────────
 * Observed on this account; StatusName on the full issue confirms them.
 */
export const ISSUE_STATUS = {
  10: 'Kladde',
  20: 'Planlagt',
  30: 'Sender',
  40: 'Fejlet',
  50: 'Sendt',
  60: 'Sat på pause',
  110: 'Skabelon',
}

export const SMS_STATUS = {
  10: 'Kladde',
  20: 'Planlagt',
  30: 'Sender',
  40: 'Fejlet',
  50: 'Sendt',
  60: 'Sat på pause',
  70: 'Afbrudt',
  110: 'Skabelon',
}

export const SURVEY_STATUS = {
  10: 'Kladde',
  20: 'Planlagt',
  30: 'Aktiv',
  50: 'Afsluttet',
}

/**
 * Contact custom-field meanings, read from GET /Contacts/Fields on this
 * account. Kept as a map rather than hard-coded lookups so the sync can warn
 * when DP renames a field in Ungapped.
 */
export const CONTACT_FIELDS = {
  Custom1: 'Udmeldelsesgrund',
  Custom2: 'Medlemstype',
  Custom3: 'Sektioner (Medlemskaber)',
  Custom4: 'Udvalgsposter (Medlemskab af bestyrelsen)',
  Custom5: 'Netværk/selskaber',
  Custom6: 'Region',
  Custom7: 'Interesser (selvvalgte nyheder)',
  Custom10: 'Udmeldelsesgrund',
  CustomLong1: 'Medlemskab',
  CustomLong2: 'Egne Felter',
  CustomDate1: 'Indmeldelsesdato',
  CustomDate2: 'Udmeldelsesdato',
  CustomNumeric1: 'Alder',
}
