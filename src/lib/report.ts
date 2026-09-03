/**
 * Ugebrevet til ledergruppen — og alarmvarslet.
 *
 * Vigtigt: intet herfra sender noget. Funktionerne bygger teksten, og siden
 * viser den, så et menneske kan læse den igennem og selv sende den. Der er
 * ingen mailserver bag et statisk site, og en automatisk udsendelse til
 * ledergruppen skal ikke starte som en bivirkning af at nogen åbner et
 * dashboard. Når I vil have den sendt automatisk, er teksten her klar til at
 * blive lagt ind i det job, der i forvejen henter data hver time.
 */
import type { Alert, Dashboard } from './data'

export interface Report {
  subject: string
  /** Ren tekst — den, man plakker ind i en mail. */
  text: string
  /** Simpel HTML i DP's farver, hvis mailen skal se ud af noget. */
  html: string
  /** Antal punkter, så knappen kan sige noget om indholdet. */
  points: number
}

const nf = new Intl.NumberFormat('da-DK')
const num = (n: number | null | undefined) => (n === null || n === undefined ? '–' : nf.format(Math.round(n)))
const dec = (n: number, d = 1) => n.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d })
const pctf = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${dec(n)} %`)
const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })
const stampFmt = new Intl.DateTimeFormat('da-DK', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
export const stamp = (iso: string) => stampFmt.format(new Date(iso))

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Hvor dashboardet ligger, så mailen kan linke til det den taler om. */
export const SITE_URL = 'https://sebastianlistfeirup.github.io/Dashboard/'

/* ── Ugebrevet ───────────────────────────────────────────────────────────── */

export function buildWeeklyReport(data: Dashboard): Report {
  const today = new Date()
  const lines: string[] = []
  const blocks: string[] = []
  let points = 0

  const push = (text: string, html: string) => {
    lines.push(text)
    blocks.push(html)
    points += 1
  }

  const subject = `Medlemskommunikation — status ${dateFmt.format(today)}`

  /* Månedens tekst først: det er den, der kan læses højt på et møde. */
  if (data.narrative) {
    push(
      `${data.narrative.monthName}\n${data.narrative.text}`,
      `<h2 style="${H2}">${esc(data.narrative.monthName)}</h2><p style="${P}">${esc(data.narrative.text)}</p>`,
    )
  }

  /* Nøgletallene mod målene. */
  if (data.targets?.length) {
    const rows = data.targets.map((t) => {
      const digits = t.target < 2 ? 2 : 1
      const state = t.reached ? 'nået' : t.gap === null ? 'ukendt' : `mangler ${dec(Math.abs(t.gap), digits)}`
      return {
        label: t.label,
        value: pctf(t.value),
        target: dec(t.target, t.target < 2 ? 2 : 0),
        state,
        ok: t.reached === true,
      }
    })
    push(
      `Mål og status\n${rows.map((r) => `  • ${r.label}: ${r.value} (mål ${r.target}) — ${r.state}`).join('\n')}`,
      `<h2 style="${H2}">Mål og status</h2>
       <table style="width:100%;border-collapse:collapse;font-size:14px">
         ${rows.map((r) => `<tr>
           <td style="padding:6px 0;border-bottom:1px solid #e7ebef;color:#2a4368">${esc(r.label)}</td>
           <td style="padding:6px 0;border-bottom:1px solid #e7ebef;text-align:right;font-weight:600;color:#16233a">${r.value}</td>
           <td style="padding:6px 0 6px 12px;border-bottom:1px solid #e7ebef;text-align:right;color:${r.ok ? '#179fa0' : '#8299bb'}">${esc(r.state)}</td>
         </tr>`).join('')}
       </table>`,
    )
  }

  /* De vigtigste findings — maks tre, ellers læses de ikke. */
  const findings = (data.findings ?? []).slice(0, 3)
  if (findings.length) {
    push(
      `Værd at bemærke\n${findings.map((f) => `  • ${f.title}: ${f.body}`).join('\n')}`,
      `<h2 style="${H2}">Værd at bemærke</h2>
       ${findings.map((f) => `<div style="margin:0 0 14px;padding-left:12px;border-left:3px solid ${f.color ?? '#df790d'}">
         <p style="margin:0;font-weight:600;color:#16233a;font-size:15px">${esc(f.title)}</p>
         <p style="margin:4px 0 0;color:#4a5a72;font-size:14px;line-height:1.55">${esc(f.body)}</p>
       </div>`).join('')}`,
    )
  }

  /* Alarmer, hvis der er nogen. */
  const alerts = data.alerts?.items ?? []
  if (alerts.length) {
    push(
      `Kræver opmærksomhed\n${alerts.map((a) => `  • ${a.title}${a.subject ? ` — «${a.subject}»` : ''}: ${a.detail}`).join('\n')}`,
      `<h2 style="${H2}">Kræver opmærksomhed</h2>
       ${alerts.map((a) => alertHtml(a)).join('')}`,
    )
  }

  /* Seneste periode i tal. */
  const r = data.overview.recent
  if (r) {
    const delta = (v: number | null) => (v === null ? '' : ` (${v > 0 ? '+' : '−'}${dec(Math.abs(v))} point)`)
    push(
      `Seneste ${r.window}\n  • ${num(r.current.count)} udsendelser til ${num(r.current.delivered)} modtagere\n` +
        `  • Åbningsrate ${pctf(r.current.openRate)}${delta(r.openRateDelta)}\n` +
        `  • Klikrate ${pctf(r.current.clickRate)}${delta(r.clickRateDelta)}`,
      `<h2 style="${H2}">Seneste ${esc(r.window)}</h2>
       <p style="${P}">${num(r.current.count)} udsendelser til ${num(r.current.delivered)} modtagere.
       Åbningsrate ${pctf(r.current.openRate)}${esc(delta(r.openRateDelta))},
       klikrate ${pctf(r.current.clickRate)}${esc(delta(r.clickRateDelta))}.</p>`,
    )
  }

  const text = [
    subject,
    '',
    ...lines.flatMap((l) => [l, '']),
    `Hele dashboardet: ${SITE_URL}`,
    `Tallene er hentet fra Ungapped ${stamp(data.meta.generatedAt)}.`,
  ].join('\n')

  const html = `<div style="font-family:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#16233a">
  <div style="background:#16233a;padding:24px 28px;border-radius:16px 16px 0 0">
    <p style="margin:0;color:#df790d;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">Dansk Psykolog Forening</p>
    <h1 style="margin:8px 0 0;color:#fff;font-family:'IBM Plex Serif',Georgia,serif;font-size:24px;font-weight:600">Medlemskommunikation</h1>
    <p style="margin:6px 0 0;color:#aebdd4;font-size:13px">Status til ledergruppen · ${esc(dateFmt.format(today))}</p>
  </div>
  <div style="border:1px solid #e7ebef;border-top:0;border-radius:0 0 16px 16px;padding:24px 28px">
    ${blocks.join('')}
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e7ebef;font-size:12px;color:#8299bb">
      <a href="${SITE_URL}" style="color:#4c7bbd">Åbn hele dashboardet</a> ·
      tal hentet fra Ungapped ${esc(stamp(data.meta.generatedAt))}.
    </p>
  </div>
</div>`

  return { subject, text, html, points }
}

/* ── Alarmvarsel ─────────────────────────────────────────────────────────── */

/**
 * Kort varsel, når noget falder udenfor. Bygges her, sendes ikke — se noten
 * øverst i filen.
 */
export function buildAlertNotice(data: Dashboard): Report | null {
  const items = data.alerts?.items ?? []
  if (!data.alerts?.active || items.length === 0) return null

  const critical = items.filter((a) => a.severity === 'critical').length
  const subject = critical > 0
    ? `${critical} kritisk${critical === 1 ? '' : 'e'} varsel på udsendelser`
    : `${items.length} udsendelse${items.length === 1 ? '' : 'r'} til gennemsyn`

  const text = [
    subject,
    '',
    ...items.map((a) => `• ${a.title}${a.subject ? ` — «${a.subject}»` : ''}\n  ${a.detail}`),
    '',
    `Se dem i dashboardet: ${SITE_URL}#alarmer`,
  ].join('\n')

  const html = `<div style="font-family:'IBM Plex Sans',system-ui,sans-serif;max-width:560px;color:#16233a">
    <h1 style="font-family:'IBM Plex Serif',Georgia,serif;font-size:20px;margin:0 0 14px">${esc(subject)}</h1>
    ${items.map((a) => alertHtml(a)).join('')}
    <p style="margin:18px 0 0;font-size:12px"><a href="${SITE_URL}#alarmer" style="color:#4c7bbd">Se dem i dashboardet</a></p>
  </div>`

  return { subject, text, html, points: items.length }
}

function alertHtml(a: Alert) {
  const colour = a.severity === 'critical' ? '#d24e46' : '#df790d'
  return `<div style="margin:0 0 12px;padding:12px 14px;border-left:4px solid ${colour};background:#f7f8fa;border-radius:0 10px 10px 0">
    <p style="margin:0;font-weight:600;font-size:14px;color:#16233a">${esc(a.title)}</p>
    ${a.subject ? `<p style="margin:3px 0 0;font-size:13px;color:#2a4368">«${esc(a.subject)}»</p>` : ''}
    <p style="margin:4px 0 0;font-size:13px;color:#4a5a72;line-height:1.5">${esc(a.detail)}</p>
  </div>`
}

const H2 = 'font-family:\'IBM Plex Serif\',Georgia,serif;font-size:17px;font-weight:600;color:#16233a;margin:22px 0 8px'
const P = 'margin:0 0 12px;font-size:14px;line-height:1.65;color:#2a4368'

/** mailto-adresse med emne og brødtekst, hvis nogen vil sende den fra sin egen mail. */
export function mailtoLink(report: Report, to = '') {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.text)}`
}
