/**
 * Interessante findings.
 *
 * Reads the finished aggregation and states what stands out. Every finding
 * carries the numbers it rests on and how many sendouts or people that is, so
 * a reader can tell a real pattern from a coincidence — and nothing is claimed
 * from a handful of observations.
 */

const MIN_SENDOUTS = 4
const MIN_PEOPLE = 25

const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10)
const fmt = (n, unit = '%') => (n === null || n === undefined ? '–' : `${round1(n).toLocaleString('da-DK')}${unit}`)
const num = (n) => (n ?? 0).toLocaleString('da-DK')

/** A finding is only worth showing if the gap is big enough to act on. */
const RELATIVE_GAP = 0.18 // 18 % relative difference
const ABSOLUTE_GAP = 2.5 // or 2.5 percentage points

function meaningful(a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return false
  const diff = Math.abs(a - b)
  const base = Math.max(Math.abs(b), 0.1)
  return diff >= ABSOLUTE_GAP || diff / base >= RELATIVE_GAP
}

export function buildFindings(analysis) {
  const out = []
  const push = (f) => { if (f) out.push(f) }

  const { overview, byType, trends, timing, subjects, content, audience, segmentPerformance } = analysis
  const baseline = overview.pool.openRate
  const clickBaseline = overview.pool.clickRate

  /* ── Retning ───────────────────────────────────────────────────────────── */
  const r = overview.recent
  if (r.current.count >= MIN_SENDOUTS && r.previous.count >= MIN_SENDOUTS && meaningful(r.current.openRate, r.previous.openRate)) {
    const up = r.current.openRate > r.previous.openRate
    push({
      id: 'trend-open',
      kind: up ? 'positive' : 'negative',
      area: 'Udvikling',
      title: up
        ? `Åbningsraten er steget ${fmt(Math.abs(r.openRateDelta), ' pct.point')} de sidste 90 dage`
        : `Åbningsraten er faldet ${fmt(Math.abs(r.openRateDelta), ' pct.point')} de sidste 90 dage`,
      body: `Seneste 90 dage: ${fmt(r.current.openRate)} åbninger over ${r.current.count} udsendelser. De 90 dage før: ${fmt(r.previous.openRate)} over ${r.previous.count} udsendelser.`,
      metric: fmt(r.current.openRate),
      delta: r.openRateDelta,
      evidence: `${r.current.count + r.previous.count} udsendelser`,
      section: 'udvikling',
    })
  }

  /* ── Typer ─────────────────────────────────────────────────────────────── */
  const rankable = byType.filter((t) => t.count >= MIN_SENDOUTS)
  if (rankable.length >= 2) {
    const best = [...rankable].sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))[0]
    const worst = [...rankable].sort((a, b) => (a.openRate ?? 0) - (b.openRate ?? 0))[0]
    if (best.key !== worst.key && meaningful(best.openRate, worst.openRate)) {
      push({
        id: 'type-spread',
        kind: 'neutral',
        area: 'Udsendelsestyper',
        title: `${best.label} åbnes ${fmt(best.openRate - worst.openRate, ' pct.point')} oftere end ${worst.label}`,
        body: `${best.label}: ${fmt(best.openRate)} åbninger over ${best.count} udsendelser. ${worst.label}: ${fmt(worst.openRate)} over ${worst.count}. Gennemsnittet på tværs er ${fmt(baseline)}.`,
        metric: fmt(best.openRate),
        evidence: `${best.count + worst.count} udsendelser`,
        color: best.color,
        section: 'typer',
      })
    }

    // A type that gets opened but not clicked is a content problem, not a
    // subject-line problem — worth separating out.
    const opened = rankable.filter((t) => t.openRate !== null && t.ctor !== null)
    const overpromise = [...opened].sort((a, b) => (a.ctor ?? 0) - (b.ctor ?? 0))[0]
    const avgCtor = overview.pool.ctor
    if (overpromise && overpromise.openRate >= (baseline ?? 0) && meaningful(overpromise.ctor, avgCtor) && overpromise.ctor < avgCtor) {
      push({
        id: 'type-ctor-gap',
        kind: 'opportunity',
        area: 'Indhold',
        title: `${overpromise.label} bliver åbnet, men ikke klikket`,
        body: `${fmt(overpromise.openRate)} åbner, men kun ${fmt(overpromise.ctor)} af dem klikker videre — mod ${fmt(avgCtor)} på tværs af alle udsendelser. Emnelinjen leverer; indholdet gør ikke helt.`,
        metric: fmt(overpromise.ctor),
        evidence: `${overpromise.count} udsendelser`,
        color: overpromise.color,
        section: 'indhold',
      })
    }
  }

  /* ── Tidspunkter ───────────────────────────────────────────────────────── */
  const days = timing.byWeekday.filter((d) => d.count >= MIN_SENDOUTS)
  if (days.length >= 2) {
    const best = [...days].sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))[0]
    const worst = [...days].sort((a, b) => (a.openRate ?? 0) - (b.openRate ?? 0))[0]
    if (meaningful(best.openRate, worst.openRate)) {
      push({
        id: 'weekday',
        kind: 'opportunity',
        area: 'Tidspunkt',
        title: `${best.label} er den bedste udsendelsesdag`,
        body: `Udsendelser om ${best.label.toLowerCase()}en åbnes af ${fmt(best.openRate)} mod ${fmt(worst.openRate)} om ${worst.label.toLowerCase()}en. Målt på ${best.count} henholdsvis ${worst.count} udsendelser.`,
        metric: fmt(best.openRate),
        evidence: `${days.reduce((s, d) => s + d.count, 0)} udsendelser`,
        section: 'tidspunkt',
      })
    }
  }

  const bands = timing.hourBands.filter((b) => b.count >= MIN_SENDOUTS)
  if (bands.length >= 2) {
    const best = [...bands].sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))[0]
    const worst = [...bands].sort((a, b) => (a.openRate ?? 0) - (b.openRate ?? 0))[0]
    if (meaningful(best.openRate, worst.openRate)) {
      push({
        id: 'hour-band',
        kind: 'opportunity',
        area: 'Tidspunkt',
        title: `${best.label} slår ${worst.label.toLowerCase()} med ${fmt(best.openRate - worst.openRate, ' pct.point')}`,
        body: `${best.count} udsendelser i tidsrummet ${best.label.toLowerCase()} åbnes af ${fmt(best.openRate)}. ${worst.count} udsendelser ${worst.label.toLowerCase()} når ${fmt(worst.openRate)}.`,
        metric: fmt(best.openRate),
        evidence: `${bands.reduce((s, d) => s + d.count, 0)} udsendelser`,
        section: 'tidspunkt',
      })
    }
  }

  /* ── Emnelinjer ────────────────────────────────────────────────────────── */
  const lengths = subjects.byLength.filter((b) => b.count >= MIN_SENDOUTS)
  if (lengths.length >= 2) {
    const best = [...lengths].sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))[0]
    const worst = [...lengths].sort((a, b) => (a.openRate ?? 0) - (b.openRate ?? 0))[0]
    if (meaningful(best.openRate, worst.openRate)) {
      push({
        id: 'subject-length',
        kind: 'opportunity',
        area: 'Emnelinjer',
        title: `Emnelinjer på ${best.label.toLowerCase()} virker bedst`,
        body: `${fmt(best.openRate)} åbninger mod ${fmt(worst.openRate)} for ${worst.label.toLowerCase()}. Baseret på ${best.count} og ${worst.count} udsendelser.`,
        metric: fmt(best.openRate),
        evidence: `${lengths.reduce((s, b) => s + b.count, 0)} udsendelser`,
        section: 'emnelinjer',
      })
    }
  }

  for (const f of subjects.flags.filter((x) => x.reliable)) {
    if (!meaningful(f.with.openRate, f.without.openRate)) continue
    const helps = f.with.openRate > f.without.openRate
    push({
      id: `subject-flag-${f.label}`,
      kind: helps ? 'positive' : 'negative',
      area: 'Emnelinjer',
      title: helps
        ? `${f.label} løfter åbningsraten ${fmt(Math.abs(f.openDelta), ' pct.point')}`
        : `${f.label} koster ${fmt(Math.abs(f.openDelta), ' pct.point')} i åbningsrate`,
      body: `${f.with.count} udsendelser med: ${fmt(f.with.openRate)}. ${f.without.count} uden: ${fmt(f.without.openRate)}.${f.hint ? ` ${f.hint}.` : ''}`,
      metric: fmt(f.with.openRate),
      delta: f.openDelta,
      evidence: `${f.with.count + f.without.count} udsendelser`,
      section: 'emnelinjer',
    })
  }

  /* ── Indhold ───────────────────────────────────────────────────────────── */
  const linkBuckets = content.byLinks.filter((b) => b.count >= MIN_SENDOUTS)
  if (linkBuckets.length >= 2) {
    const best = [...linkBuckets].sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0))[0]
    const worst = [...linkBuckets].sort((a, b) => (a.clickRate ?? 0) - (b.clickRate ?? 0))[0]
    if (meaningful(best.clickRate, worst.clickRate)) {
      push({
        id: 'links',
        kind: 'opportunity',
        area: 'Indhold',
        title: `${best.label} giver flest klik`,
        body: `Udsendelser med ${best.label.toLowerCase()} har ${fmt(best.clickRate)} klikrate mod ${fmt(worst.clickRate)} ved ${worst.label.toLowerCase()}. Gennemsnittet er ${fmt(clickBaseline)}.`,
        metric: fmt(best.clickRate),
        evidence: `${linkBuckets.reduce((s, b) => s + b.count, 0)} udsendelser`,
        section: 'indhold',
      })
    }
  }

  const wordBuckets = content.byWords.filter((b) => b.count >= MIN_SENDOUTS)
  if (wordBuckets.length >= 2) {
    const best = [...wordBuckets].sort((a, b) => (b.ctor ?? 0) - (a.ctor ?? 0))[0]
    const worst = [...wordBuckets].sort((a, b) => (a.ctor ?? 0) - (b.ctor ?? 0))[0]
    if (meaningful(best.ctor, worst.ctor)) {
      push({
        id: 'length',
        kind: 'opportunity',
        area: 'Indhold',
        title: `Udsendelser på ${best.label.toLowerCase()} konverterer bedst fra åbning til klik`,
        body: `${fmt(best.ctor)} af dem der åbner klikker videre, mod ${fmt(worst.ctor)} ved ${worst.label.toLowerCase()}.`,
        metric: fmt(best.ctor),
        evidence: `${wordBuckets.reduce((s, b) => s + b.count, 0)} udsendelser`,
        section: 'indhold',
      })
    }
  }

  /* ── Modtagere ─────────────────────────────────────────────────────────── */
  const eng = audience.engagement
  if (eng) {
    const cmp = (rows, area, dimension, unit = 'gruppe') => {
      const list = (rows ?? []).filter((x) => !x.isOther && x.people >= MIN_PEOPLE && x.received > 0)
      if (list.length < 2) return
      const best = list[0]
      const worst = list[list.length - 1]
      if (!meaningful(best.clickRate, worst.clickRate) && !meaningful(best.openRate, worst.openRate)) return
      push({
        id: `engagement-${dimension}`,
        kind: 'neutral',
        area,
        title: `${best.name} er den mest engagerede ${unit}`,
        body: `${best.name}: ${fmt(best.openRate)} åbner og ${fmt(best.clickRate)} klikker (${num(best.people)} personer i stikprøven). ${worst.name}: ${fmt(worst.openRate)} / ${fmt(worst.clickRate)} (${num(worst.people)} personer).`,
        metric: fmt(best.clickRate),
        evidence: `${num(list.reduce((s, x) => s + x.people, 0))} personer i stikprøven`,
        section: 'modtagere',
      })
    }
    cmp(eng.byMedlemstype, 'Modtagere', 'medlemstype', 'medlemstype')
    cmp(eng.byRegion, 'Modtagere', 'region', 'region')
    cmp(eng.byAlder, 'Modtagere', 'alder', 'aldersgruppe')
    cmp(eng.byAnciennitet, 'Modtagere', 'anciennitet', 'medlemsgruppe')
    cmp(eng.bySektion, 'Modtagere', 'sektion', 'sektion')

    const never = eng.distribution.find((d) => d.label === 'Har aldrig åbnet')
    if (never && never.share >= 10) {
      push({
        id: 'dormant',
        kind: 'negative',
        area: 'Modtagere',
        title: `${fmt(never.share)} af modtagerne har aldrig åbnet en udsendelse`,
        body: `${num(never.n)} af ${num(eng.withMail)} i stikprøven har modtaget mindst én udsendelse uden nogensinde at åbne. De trækker alle gennemsnit ned og er kandidater til enten en genaktiveringsindsats eller en oprydning.`,
        metric: fmt(never.share),
        evidence: `${num(eng.withMail)} personer i stikprøven`,
        section: 'modtagere',
      })
    }

    const loyal = eng.distribution.find((d) => d.label === 'Åbner næsten alt (80 %+)')
    if (loyal && loyal.n > 0) {
      push({
        id: 'loyal',
        kind: 'positive',
        area: 'Modtagere',
        title: `${fmt(loyal.share)} åbner stort set alt, DP sender`,
        body: `${num(loyal.n)} personer i stikprøven åbner mindst 80 % af det, de modtager. Det er kernen af medlemmer, der reelt læser med — og den gruppe, der kan bære mere målrettet kommunikation.`,
        metric: fmt(loyal.share),
        evidence: `${num(eng.withMail)} personer i stikprøven`,
        section: 'modtagere',
      })
    }
  }

  /* ── Afmeldinger ───────────────────────────────────────────────────────── */
  const reasons = (audience.churn.reasons ?? []).filter((r) => !r.isOther)
  if (reasons.length) {
    const top = reasons[0]
    push({
      id: 'churn-reason',
      kind: 'neutral',
      area: 'Afmeldinger',
      title: `Den hyppigste udmeldelsesgrund er "${top.name}"`,
      body: `${num(top.n)} medlemmer (${fmt(top.share)} af dem med en angivet grund).${reasons[1] ? ` Næsthyppigst: "${reasons[1].name}" med ${num(reasons[1].n)}.` : ''}`,
      metric: num(top.n),
      evidence: `${num(reasons.reduce((s, x) => s + x.n, 0))} angivne grunde`,
      section: 'modtagere',
    })
  }

  const unsubDrivers = (analysis.byType ?? []).filter((t) => t.count >= MIN_SENDOUTS && t.delivered > 2000)
  if (unsubDrivers.length >= 2) {
    const worst = [...unsubDrivers].sort((a, b) => (b.unsubRate ?? 0) - (a.unsubRate ?? 0))[0]
    const best = [...unsubDrivers].sort((a, b) => (a.unsubRate ?? 0) - (b.unsubRate ?? 0))[0]
    if (worst.key !== best.key && (worst.unsubRate ?? 0) > 0) {
      push({
        id: 'unsub-driver',
        kind: 'negative',
        area: 'Afmeldinger',
        title: `${worst.label} koster flest afmeldinger`,
        body: `${fmt(worst.unsubRate)} afmelder sig pr. udsendelse mod ${fmt(best.unsubRate)} for ${best.label}. Over ${num(worst.delivered)} leverede mails svarer det til ${num(worst.unsubscribes)} afmeldinger.`,
        metric: fmt(worst.unsubRate),
        evidence: `${worst.count} udsendelser`,
        color: worst.color,
        section: 'modtagere',
      })
    }
  }

  /* ── Segmenter ─────────────────────────────────────────────────────────── */
  const segs = (segmentPerformance.byList ?? []).filter((s) => s.count >= MIN_SENDOUTS && s.delivered > 500)
  if (segs.length >= 2) {
    const best = [...segs].sort((a, b) => (b.openRate ?? 0) - (a.openRate ?? 0))[0]
    const worst = [...segs].sort((a, b) => (a.openRate ?? 0) - (b.openRate ?? 0))[0]
    if (meaningful(best.openRate, worst.openRate)) {
      push({
        id: 'segment-spread',
        kind: 'opportunity',
        area: 'Segmenter',
        title: `Listen "${best.name}" åbner ${fmt(best.openRate - worst.openRate, ' pct.point')} mere end "${worst.name}"`,
        body: `${best.name}: ${fmt(best.openRate)} over ${best.count} udsendelser. ${worst.name}: ${fmt(worst.openRate)} over ${worst.count}. Jo smallere listen er, jo mere relevant plejer indholdet at være.`,
        metric: fmt(best.openRate),
        evidence: `${best.count + worst.count} udsendelser`,
        section: 'segmenter',
      })
    }
  }

  /* ── Bounce ────────────────────────────────────────────────────────────── */
  if (audience.totals.bounceShare >= 3) {
    push({
      id: 'bounce',
      kind: 'negative',
      area: 'Datakvalitet',
      title: `${fmt(audience.totals.bounceShare)} af adresserne bouncer`,
      body: `${num(audience.totals.bounced)} af ${num(audience.totals.all)} adresser afvises af modtagerens mailserver. Hver bounce trækker afsenderomdømmet ned og gør, at de øvrige udsendelser oftere lander i spam.`,
      metric: fmt(audience.totals.bounceShare),
      evidence: `${num(audience.totals.all)} adresser`,
      section: 'modtagere',
    })
  }

  /* ── Frekvens ──────────────────────────────────────────────────────────── */
  const months = (trends.monthly ?? []).filter((m) => m.count > 0).slice(-18)
  if (months.length >= 8) {
    const busy = [...months].sort((a, b) => b.count - a.count).slice(0, Math.ceil(months.length / 3))
    const quiet = [...months].sort((a, b) => a.count - b.count).slice(0, Math.ceil(months.length / 3))
    const busyOpen = weighted(busy, 'opens', 'delivered')
    const quietOpen = weighted(quiet, 'opens', 'delivered')
    if (meaningful(busyOpen, quietOpen)) {
      const worse = busyOpen < quietOpen
      push({
        id: 'frequency',
        kind: worse ? 'negative' : 'positive',
        area: 'Frekvens',
        title: worse
          ? 'Travle måneder betaler for sig i lavere åbningsrate'
          : 'Flere udsendelser går ikke ud over åbningsraten',
        body: `I de ${busy.length} travleste måneder (gennemsnitligt ${Math.round(busy.reduce((s, m) => s + m.count, 0) / busy.length)} udsendelser) er åbningsraten ${fmt(busyOpen)}. I de ${quiet.length} roligste (${Math.round(quiet.reduce((s, m) => s + m.count, 0) / quiet.length)} udsendelser) er den ${fmt(quietOpen)}.`,
        metric: fmt(busyOpen),
        evidence: `${months.length} måneder`,
        section: 'udvikling',
      })
    }
  }

  /* ── SMS ───────────────────────────────────────────────────────────────── */
  const smsSent = (analysis.sms ?? []).filter((s) => s.status === 50 && s.stats.recipients > 0)
  if (smsSent.length >= 2) {
    const recipients = smsSent.reduce((s, x) => s + x.stats.recipients, 0)
    push({
      id: 'sms-reach',
      kind: 'neutral',
      area: 'SMS',
      title: `${smsSent.length} sms'er har nået ${num(recipients)} modtagere`,
      body: `Gennemsnitligt ${num(Math.round(recipients / smsSent.length))} modtagere pr. udsendelse. ${num(audience.totals.smsReachable)} kontakter kan modtage sms — det er ${fmt((audience.totals.smsReachable / Math.max(1, audience.totals.active)) * 100)} af de aktive.`,
      metric: num(recipients),
      evidence: `${smsSent.length} sms-udsendelser`,
      section: 'sms',
    })
  }

  /* ── Spørgeskemaer ─────────────────────────────────────────────────────── */
  const answered = (analysis.surveys ?? []).filter((s) => s.responses > 0)
  if (answered.length) {
    const top = [...answered].sort((a, b) => b.responses - a.responses)[0]
    push({
      id: 'survey-top',
      kind: 'positive',
      area: 'Spørgeskemaer',
      title: `"${top.title}" har flest besvarelser`,
      body: `${num(top.responses)} besvarelser fra ${num(top.respondents)} respondenter. På tværs af ${answered.length} spørgeskemaer med svar er der ${num(answered.reduce((s, x) => s + x.responses, 0))} besvarelser i alt.`,
      metric: num(top.responses),
      evidence: `${answered.length} spørgeskemaer`,
      section: 'sporgeskemaer',
    })
  }

  // Strongest first, but keep one finding per area near the top so the section
  // reads as a survey of the whole picture rather than a single theme.
  const order = { negative: 0, opportunity: 1, positive: 2, neutral: 3 }
  const seenArea = new Set()
  const ranked = [...out].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))
  const lead = []
  const rest = []
  for (const f of ranked) {
    if (!seenArea.has(f.area)) { seenArea.add(f.area); lead.push(f) } else rest.push(f)
  }
  return [...lead, ...rest]
}

function weighted(rows, numeratorKey, denominatorKey) {
  const n = rows.reduce((s, r) => s + (r[numeratorKey] ?? 0), 0)
  const d = rows.reduce((s, r) => s + (r[denominatorKey] ?? 0), 0)
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null
}
