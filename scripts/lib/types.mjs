/**
 * Udsendelsestyper.
 *
 * In Ungapped a sendout carries free-text tags; these group them into the types
 * DP actually thinks in. This list is the single source of truth — the sync
 * writes the resolved type onto every sendout and ships the list itself in the
 * output, so the dashboard never has to classify anything client-side.
 *
 * Colours are the validated series palette (see src/design/tokens.ts for how
 * they were derived from the designmanual's accent colours).
 */
export const MAILING_TYPES = [
  {
    key: 'nyhedsbrev',
    label: 'Psykologernes Nyhedsbrev',
    short: 'Nyhedsbrev',
    color: '#4c7bbd',
    soft: '#c1cde9',
    tags: ['psykologernes nyhedsbrev'],
    description: 'Det brede medlemsnyhedsbrev.',
  },
  {
    key: 'magasinet-p',
    label: 'Magasinet P',
    short: 'Magasinet P',
    color: '#179fa0',
    soft: '#c4dcdb',
    tags: ['magasinet p'],
    description: 'Psykologernes Fagmagasin.',
  },
  {
    key: 'videncenter',
    label: 'Nationalt Videncenter for Psykologi',
    short: 'Videncenter',
    color: '#4e4897',
    soft: '#bcbbde',
    tags: ['nationalt videnscenter for psykologi', 'nationalt videncenter for psykologi'],
    description: 'Udsendelser fra videncentret.',
  },
  {
    key: 'tr-amr',
    label: 'TR/AMR Nyt',
    short: 'TR/AMR',
    color: '#d24e46',
    soft: '#f1c7bb',
    tags: ['tr/amr nyt', 'tr-kampagne 2026', 'tr - udsendelser', 'tr flow'],
    description: 'Nyt til tillids- og arbejdsmiljørepræsentanter.',
  },
  {
    key: 'kompetencenyt',
    label: 'Kompetencenyt',
    short: 'Kompetencenyt',
    color: '#d8a90c',
    soft: '#f8eabd',
    tags: ['kompetencenyt'],
    description: 'Kurser, efteruddannelse og kompetenceudvikling.',
  },
  {
    key: 'netvaerksnyt',
    label: 'Netværksnyt',
    short: 'Netværksnyt',
    color: '#4fa388',
    soft: '#cfe6dd',
    tags: ['netværksnyt'],
    description: 'Nyt fra faglige netværk og selskaber.',
  },
  {
    key: 'flow',
    label: 'Flows og automatiseringer',
    short: 'Flows',
    color: '#df790d',
    soft: '#f6d3b1',
    tags: [
      'flow', 'automation', 'onboarding', 'dimittendflow', 'ydernummerflow',
      'velkomstflow til studerende', 'pensionistflow', 'exitflow', 'flow til ledige',
      'selvstændige (flow)', 'selvstændige nyt', 'normalansatte over og under 19 timer (flow)',
      'velkomstmail frivillige',
    ],
    description: 'Automatiske medlemsrejser: onboarding, dimittender, ydernummer, TR, pensionister, exit.',
  },
  {
    key: 'medlemskommunikation',
    label: 'Medlemskommunikation',
    short: 'Medlemskomm.',
    color: '#3a557d',
    soft: '#d4dbe1',
    tags: ['medlemskommunikation', 'strakskampagne', 'løbende medlemstilfredshed'],
    description: 'Direkte medlemsinformation, strakskampagner og tilfredshedsmålinger.',
  },
  {
    key: 'ovrige',
    label: 'Øvrige udsendelser',
    short: 'Øvrige',
    color: '#8299bb',
    soft: '#e7ebef',
    tags: [],
    description: 'Udsendelser uden en genkendelig type-tag.',
  },
]

/** Specific types win over the broad "flow" tag, which is applied widely. */
const PRIORITY = [
  'nyhedsbrev', 'magasinet-p', 'videncenter', 'tr-amr',
  'kompetencenyt', 'netvaerksnyt', 'medlemskommunikation', 'flow',
]

const byKey = new Map(MAILING_TYPES.map((t) => [t.key, t]))

export function resolveType({ tags = [], journey = null, category = null } = {}) {
  const lower = tags.map((t) => String(t).trim().toLowerCase())
  for (const key of PRIORITY) {
    const type = byKey.get(key)
    if (type.tags.some((t) => lower.some((l) => l === t || l.startsWith(`${t} `)))) return key
  }
  // A sendout that belongs to a journey is an automation even when untagged.
  if (journey) return 'flow'
  if (category && /nyhedsbrev/i.test(category) && lower.length === 0) return 'ovrige'
  return 'ovrige'
}

export const typeLabel = (key) => byKey.get(key)?.label ?? 'Øvrige udsendelser'
export const typeColor = (key) => byKey.get(key)?.color ?? '#8299bb'
