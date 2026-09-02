/**
 * Krydstabel: engagement på to dimensioner ad gangen.
 *
 * The interesting patterns sit in the crossings, not in either dimension
 * alone — a group can look average on kontingent and average on region while
 * one particular combination of the two is far off.
 *
 * Computed here rather than shipped as raw rows on purpose: a person described
 * by five attributes at once stops being anonymous, so only cells holding at
 * least `minPeople` ever leave this function.
 */
import { pct } from './extract.mjs'

/** The dimensions a cross-tab may combine. */
export const CROSS_DIMENSIONS = [
  { key: 'kontingent', label: 'Kontingentgruppe' },
  { key: 'region', label: 'Region' },
  { key: 'alder', label: 'Alder' },
  { key: 'anciennitet', label: 'Anciennitet' },
  { key: 'sektioner', label: 'Sektion' },
  { key: 'koen', label: 'Køn' },
]

export function buildCrossTabs(engagement, valueOf, minPeople = 25) {
  const pairs = {}

  for (let i = 0; i < CROSS_DIMENSIONS.length; i += 1) {
    for (let j = i + 1; j < CROSS_DIMENSIONS.length; j += 1) {
      const a = CROSS_DIMENSIONS[i]
      const b = CROSS_DIMENSIONS[j]
      const cells = new Map()

      for (const e of engagement) {
        if (!e.received) continue
        const aKeys = [valueOf(e.profile, a.key)].flat().filter(Boolean)
        const bKeys = [valueOf(e.profile, b.key)].flat().filter(Boolean)
        for (const av of aKeys) {
          for (const bv of bKeys) {
            const id = `${av}||${bv}`
            if (!cells.has(id)) {
              cells.set(id, { row: av, col: bv, people: 0, received: 0, opened: 0, clicked: 0 })
            }
            const cell = cells.get(id)
            cell.people += 1
            cell.received += e.received
            cell.opened += e.opened
            cell.clicked += e.clicked
          }
        }
      }

      const kept = [...cells.values()]
        .filter((c) => c.people >= minPeople)
        .map((c) => ({
          row: c.row,
          col: c.col,
          people: c.people,
          received: c.received,
          openRate: pct(c.opened, c.received),
          clickRate: pct(c.clicked, c.received),
        }))
      if (!kept.length) continue

      // Order both axes by size, so the biggest groups read first.
      const axis = (field) => {
        const totals = new Map()
        for (const c of kept) totals.set(c[field], (totals.get(c[field]) ?? 0) + c.people)
        return [...totals.entries()].sort((x, y) => y[1] - x[1]).map(([name]) => name)
      }

      pairs[`${a.key}|${b.key}`] = {
        rowKey: a.key,
        rowLabel: a.label,
        colKey: b.key,
        colLabel: b.label,
        rows: axis('row'),
        cols: axis('col'),
        cells: kept,
        suppressed: cells.size - kept.length,
      }
    }
  }

  return {
    dimensions: CROSS_DIMENSIONS,
    pairs,
    minPeople,
    note: `Hver celle skal rumme mindst ${minPeople} personer fra stikprøven for at blive vist. Et tomt felt betyder "for få til at sige noget" — ikke "ingen".`,
  }
}
