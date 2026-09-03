/**
 * Link-kataloget: hvor peger vi hen, og hvad ved vi om det?
 *
 * Vigtigt om hvad dette IKKE er. Ungapped rapporterer ét samlet klik-tal pr.
 * udsendelse — der findes intet endpoint i de 225, der udleverer klik pr. link.
 * Kataloget kan derfor ikke sige "kalenderlinket fik 42 klik". Det den kan sige
 * er noget andet og stadig brugbart: hvilke sider vi overhovedet sender folk
 * hen til, hvor ofte, hvor i mailen de plejer at stå, og om de udsendelser der
 * indeholder en bestemt destination klikker anderledes end dem der ikke gør.
 *
 * Det sidste er en sammenhæng, ikke en årsag: en mail om selvstændig praksis
 * indeholder både et link til praksis-siden og et emne der optager netop den
 * gruppe. Derfor står forskellen kun, når den har volumen bag sig efter samme
 * regel som resten af dashboardet, og teksten på kortet siger hvad den er.
 */
import { pct, round1 } from './extract.mjs'

/** Destinationer, der står i næsten hver eneste mail, kan ikke skille noget ad. */
const UBIQUITOUS_SHARE = 0.85

const poolRate = (mailings, field) => {
  const delivered = mailings.reduce((s, m) => s + m.stats.delivered, 0)
  const n = mailings.reduce((s, m) => s + m.stats[field], 0)
  return delivered > 0 ? round1(pct(n, delivered)) : null
}

const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const i = Math.floor(s.length / 2)
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2
}

/** Hvor i mailen linket plejer at stå, sagt på dansk. */
const placeOf = (at) => (at === null ? null : at < 0.34 ? 'øverst' : at < 0.67 ? 'i midten' : 'nederst')

export function buildLinkCatalogue(mailings, { minSendouts, minDelivered }) {
  const withLinks = mailings.filter((m) => m.content?.destinations?.length)
  if (!withLinks.length) return null

  const total = withLinks.length
  const housePool = poolRate(withLinks, 'clicks')

  /* ── Pr. destination ─────────────────────────────────────────────────── */
  const byPath = new Map()
  for (const m of withLinks) {
    for (const d of m.content.destinations) {
      if (!byPath.has(d.path)) byPath.set(d.path, { path: d.path, uses: 0, mailings: [], spots: [] })
      const e = byPath.get(d.path)
      e.uses += d.n
      e.mailings.push(m)
      e.spots.push(d.at)
    }
  }

  const rows = [...byPath.values()].map((e) => {
    const inIds = new Set(e.mailings.map((m) => m.id))
    const without = withLinks.filter((m) => !inIds.has(m.id))
    const delivered = e.mailings.reduce((s, m) => s + m.stats.delivered, 0)
    const withRate = poolRate(e.mailings, 'clicks')
    const withoutRate = without.length ? poolRate(without, 'clicks') : null
    const share = e.mailings.length / total
    const dates = e.mailings.map((m) => m.when).filter(Boolean).sort()
    const at = median(e.spots)
    /**
     * Den vigtigste forklaring på en forskel er som regel ikke linket, men
     * hvor stor mailen var. Et link i sidefoden står i de store nyhedsbreve,
     * og store nyhedsbreve klikker lavere end små målrettede mails. Forholdet
     * mellem gennemsnitsstørrelserne står derfor ved siden af forskellen, så
     * ingen læser et footer-link som noget der skræmmer folk væk.
     */
    const avgIn = e.mailings.length ? delivered / e.mailings.length : 0
    const avgOut = without.length
      ? without.reduce((s, m) => s + m.stats.delivered, 0) / without.length
      : 0
    return {
      path: e.path,
      host: e.path.split('/')[0],
      uses: e.uses,
      mailings: e.mailings.length,
      share: round1(share * 100),
      delivered,
      withRate,
      withoutRate,
      delta: withRate !== null && withoutRate !== null ? round1(withRate - withoutRate) : null,
      // Samme volumenregel som alle andre sammenligninger i dashboardet, plus:
      // en destination der står i næsten hver mail kan ikke skille noget ad.
      comparable: e.mailings.length >= minSendouts
        && delivered >= minDelivered
        && share < UBIQUITOUS_SHARE,
      everywhere: share >= UBIQUITOUS_SHARE,
      avgDelivered: Math.round(avgIn),
      sizeRatio: avgOut > 0 ? Math.round((avgIn / avgOut) * 10) / 10 : null,
      at,
      place: placeOf(at),
      first: dates[0] ?? null,
      last: dates[dates.length - 1] ?? null,
    }
  })

  /* ── Pr. værtsnavn ───────────────────────────────────────────────────── */
  const byHost = new Map()
  for (const r of rows) {
    if (!byHost.has(r.host)) byHost.set(r.host, { host: r.host, paths: 0, uses: 0, ids: new Set() })
    const e = byHost.get(r.host)
    e.paths += 1
    e.uses += r.uses
    for (const m of byPath.get(r.path).mailings) e.ids.add(m.id)
  }
  const hosts = [...byHost.values()]
    .map((e) => {
      const inside = withLinks.filter((m) => e.ids.has(m.id))
      const share = inside.length / total
      return {
        host: e.host,
        paths: e.paths,
        uses: e.uses,
        mailings: inside.length,
        share: round1(share * 100),
        clickRate: poolRate(inside, 'clicks'),
        everywhere: share >= UBIQUITOUS_SHARE,
      }
    })
    .sort((a, b) => b.uses - a.uses)

  /* ── Engangslinks ────────────────────────────────────────────────────── */
  const oneOffs = rows.filter((r) => r.mailings === 1)
  const recurring = rows.filter((r) => r.mailings >= minSendouts)

  /* ── Hvor står linkene henne ─────────────────────────────────────────── */
  const places = ['øverst', 'i midten', 'nederst'].map((label) => {
    const group = rows.filter((r) => r.place === label)
    return { label, destinations: group.length, uses: group.reduce((s, r) => s + r.uses, 0) }
  })

  const comparable = rows.filter((r) => r.comparable)
  const sortByDelta = (a, b) => (b.delta ?? -99) - (a.delta ?? -99)

  return {
    totals: {
      destinations: rows.length,
      mailings: total,
      uses: rows.reduce((s, r) => s + r.uses, 0),
      oneOffs: oneOffs.length,
      recurring: recurring.length,
      comparable: comparable.length,
      houseClickRate: housePool,
    },
    /* De mest brugte, uanset om de kan sammenlignes. */
    mostUsed: [...rows].sort((a, b) => b.mailings - a.mailings || b.uses - a.uses).slice(0, 25),
    /* Kun dem der må udtale sig, sorteret efter forskellen. */
    strongest: [...comparable].sort(sortByDelta).slice(0, 8),
    weakest: [...comparable].sort(sortByDelta).reverse().slice(0, 8),
    hosts: hosts.slice(0, 14),
    places,
    /* Et udsnit af engangslinks, nyeste først — resten står i tallet. */
    oneOffSample: oneOffs
      .filter((r) => r.last)
      .sort((a, b) => String(b.last).localeCompare(String(a.last)))
      .slice(0, 12),
    minSendouts,
    minDelivered,
    ubiquitousShare: Math.round(UBIQUITOUS_SHARE * 100),
    note:
      'Ungapped rapporterer ét samlet klik-tal pr. udsendelse og ikke klik pr. link. '
      + 'Kataloget viser derfor, hvordan de udsendelser der indeholder en destination klikker, '
      + 'sammenlignet med dem der ikke gør — en sammenhæng, ikke en årsag. '
      + 'Størrelsesforholdet ved siden af hver forskel siger, hvor meget af den der kan '
      + 'skyldes at destinationen sidder i større eller mindre udsendelser end resten.',
  }
}
