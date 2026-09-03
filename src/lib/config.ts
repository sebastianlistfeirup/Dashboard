/**
 * Indstillinger: mål, noter og hvad der står på ledelsessiden.
 *
 * Two layers, on purpose. `config/dashboard.json` in the repository holds what
 * the whole organisation shares — targets, benchmarks, alert thresholds — and
 * is versioned like any other decision. Anything you change in the browser
 * lands in localStorage immediately, so the page reacts at once without a
 * deploy, and can then be exported and pasted back into the shared file.
 *
 * The site is static: there is no server to save to. Rather than pretend
 * otherwise, the UI says which layer a value is currently coming from.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dashboard } from './data'

const STORAGE_KEY = 'dp-dashboard-indstillinger-v1'

export interface Note {
  /** Month the note belongs to, as YYYY-MM. */
  month: string
  text: string
  /** Set when written in the browser, so local notes can be told apart. */
  created?: string
}

export interface Overrides {
  targets: Record<string, number>
  notes: Note[]
  leadershipModules: string[] | null
  leadershipTitle: string | null
  leadershipSubtitle: string | null
}

const EMPTY: Overrides = {
  targets: {},
  notes: [],
  leadershipModules: null,
  leadershipTitle: null,
  leadershipSubtitle: null,
}

/** localStorage throws in private windows and embedded frames; never let it break the page. */
function read(): Overrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Overrides>) }
  } catch {
    return EMPTY
  }
}

function write(value: Overrides) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* nothing we can do, and nothing that should stop the page */
  }
}

/* ── Modulkatalog ────────────────────────────────────────────────────────── */

/**
 * Every module that can appear on the leadership page. The catalogue lives
 * here so the toggle on a module and the renderer on the leadership page are
 * always talking about the same thing.
 */
export interface ModuleDef {
  id: string
  label: string
  /** What it shows, in one line — used in the picker and on hover. */
  summary: string
  /** Which section of the main dashboard it belongs to. */
  section: string
  /** How much room it wants on the printed page. */
  span: 'full' | 'half'
}

export const MODULES: ModuleDef[] = [
  { id: 'maaned-tekst', label: 'Månedens tekst', summary: 'Måneden opsummeret i prosa, skrevet automatisk ud fra tallene.', section: 'findings', span: 'full' },
  { id: 'kpi-maalere', label: 'Mål og status', summary: 'De fem nøgletal med afstand til målet.', section: 'findings', span: 'full' },
  { id: 'benchmark', label: 'Sammenlignet med andre', summary: 'DP holdt op mod foreningsbenchmark.', section: 'findings', span: 'half' },
  { id: 'findings', label: 'Interessante findings', summary: 'De vigtigste automatisk fundne mønstre.', section: 'findings', span: 'full' },
  { id: 'alarmer', label: 'Alarmer', summary: 'Udsendelser der kræver opmærksomhed.', section: 'alarmer', span: 'half' },
  { id: 'udvikling', label: 'Udvikling over tid', summary: 'Åbninger og klik måned for måned.', section: 'udvikling', span: 'full' },
  { id: 'aarshjul', label: 'Årshjul', summary: 'Hele årets udsendelser i ét billede.', section: 'udvikling', span: 'full' },
  { id: 'typer', label: 'Udsendelsestyper', summary: 'Hvordan hver type klarer sig.', section: 'typer', span: 'full' },
  { id: 'top-udsendelser', label: 'Bedste udsendelser', summary: 'De fem bedst åbnede.', section: 'udsendelser', span: 'half' },
  { id: 'segmenter', label: 'Segmenter', summary: 'Hvilke lister åbner mest.', section: 'segmenter', span: 'half' },
  { id: 'tidspunkt', label: 'Udsendelsestidspunkter', summary: 'Ugedag og klokkeslæt mod åbningsrate.', section: 'tidspunkt', span: 'half' },
  { id: 'emnelinjer', label: 'Emnelinjer', summary: 'Hvad der får folk til at åbne.', section: 'emnelinjer', span: 'half' },
  { id: 'indhold', label: 'Indhold', summary: 'Længde, links og billeder mod klikrate.', section: 'indhold', span: 'half' },
  { id: 'afsendere', label: 'Afsendernavne', summary: 'Om det betyder noget hvem mailen kommer fra.', section: 'emnelinjer', span: 'half' },
  { id: 'modtagere', label: 'Modtagerprofil', summary: 'Hvem medlemmerne er, og hvem der engagerer sig.', section: 'modtagere', span: 'full' },
  { id: 'kohorter', label: 'Onboarding over tid', summary: 'Om nye årgange engagerer sig som de tidligere.', section: 'modtagere', span: 'half' },
  { id: 'genaktivering', label: 'Genaktivering', summary: 'De sovende medlemmer, og hvad det koster.', section: 'genaktivering', span: 'half' },
  { id: 'krydstabel', label: 'Krydstabel', summary: 'Engagement på to dimensioner samtidig.', section: 'modtagere', span: 'full' },
  { id: 'sms', label: 'SMS', summary: 'Rækkevidde og fejlrate på sms.', section: 'sms', span: 'half' },
  { id: 'sporgeskemaer', label: 'Spørgeskemaer', summary: 'Besvarelser pr. undersøgelse.', section: 'sporgeskemaer', span: 'half' },
]

export const moduleById = new Map(MODULES.map((m) => [m.id, m]))

/* ── Hook ────────────────────────────────────────────────────────────────── */

export interface TargetDef {
  key: string
  label: string
  target: number
  direction: 'op' | 'ned'
}

export function useSettings(data: Dashboard | null) {
  const [overrides, setOverrides] = useState<Overrides>(() => read())

  useEffect(() => { write(overrides) }, [overrides])

  const shared = data?.config ?? {}

  /** Targets: the shared file, with any local change laid on top. */
  const targets = useMemo<TargetDef[]>(() => {
    const defs = (shared as { maal?: Record<string, { maal: number; retning?: string; label?: string }> }).maal ?? {}
    return Object.entries(defs)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, def]) => ({
        key,
        label: def.label ?? key,
        target: overrides.targets[key] ?? def.maal,
        direction: def.retning === 'ned' ? 'ned' : 'op',
      }))
  }, [shared, overrides.targets])

  const isLocalTarget = useCallback((key: string) => key in overrides.targets, [overrides.targets])

  const setTarget = useCallback((key: string, value: number) => {
    setOverrides((o) => ({ ...o, targets: { ...o.targets, [key]: value } }))
  }, [])

  const resetTarget = useCallback((key: string) => {
    setOverrides((o) => {
      const next = { ...o.targets }
      delete next[key]
      return { ...o, targets: next }
    })
  }, [])

  /** Notes: shared ones first, then anything written in this browser. */
  const notes = useMemo<Note[]>(() => {
    const sharedNotes = ((shared as { noter?: { poster?: Note[] } }).noter?.poster ?? []) as Note[]
    const merged = [...sharedNotes, ...overrides.notes]
    // A local note for the same month replaces the shared one.
    const byMonth = new Map<string, Note>()
    for (const n of merged) byMonth.set(n.month, n)
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [shared, overrides.notes])

  const setNote = useCallback((month: string, text: string) => {
    setOverrides((o) => {
      const rest = o.notes.filter((n) => n.month !== month)
      return text.trim()
        ? { ...o, notes: [...rest, { month, text: text.trim(), created: new Date().toISOString() }] }
        : { ...o, notes: rest }
    })
  }, [])

  /** Which modules the leadership page shows, and in what order. */
  const leadership = useMemo(() => {
    const sharedCfg = (shared as {
      ledelsesdashboard?: { titel?: string; undertitel?: string; moduler?: string[] }
    }).ledelsesdashboard ?? {}
    return {
      title: overrides.leadershipTitle ?? sharedCfg.titel ?? 'Medlemskommunikation',
      subtitle: overrides.leadershipSubtitle ?? sharedCfg.undertitel ?? 'Status til ledergruppen',
      modules: (overrides.leadershipModules ?? sharedCfg.moduler ?? [])
        .filter((id) => moduleById.has(id)),
    }
  }, [shared, overrides])

  const isOnLeadership = useCallback((id: string) => leadership.modules.includes(id), [leadership.modules])

  const toggleLeadership = useCallback((id: string) => {
    setOverrides((o) => {
      const sharedCfg = (shared as { ledelsesdashboard?: { moduler?: string[] } }).ledelsesdashboard ?? {}
      const current = o.leadershipModules ?? sharedCfg.moduler ?? []
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      return { ...o, leadershipModules: next }
    })
  }, [shared])

  const moveLeadership = useCallback((id: string, direction: -1 | 1) => {
    setOverrides((o) => {
      const sharedCfg = (shared as { ledelsesdashboard?: { moduler?: string[] } }).ledelsesdashboard ?? {}
      const current = [...(o.leadershipModules ?? sharedCfg.moduler ?? [])]
      const i = current.indexOf(id)
      const j = i + direction
      if (i < 0 || j < 0 || j >= current.length) return o
      ;[current[i], current[j]] = [current[j], current[i]]
      return { ...o, leadershipModules: current }
    })
  }, [shared])

  const setLeadershipText = useCallback((title: string, subtitle: string) => {
    setOverrides((o) => ({ ...o, leadershipTitle: title, leadershipSubtitle: subtitle }))
  }, [])

  const hasLocalChanges = useMemo(
    () => Object.keys(overrides.targets).length > 0
      || overrides.notes.length > 0
      || overrides.leadershipModules !== null
      || overrides.leadershipTitle !== null,
    [overrides],
  )

  const clearLocal = useCallback(() => setOverrides(EMPTY), [])

  /**
   * The local changes as the shape `config/dashboard.json` expects, ready to
   * paste in so they become everyone's.
   */
  const exportJson = useCallback(() => {
    const out: Record<string, unknown> = {}
    if (Object.keys(overrides.targets).length) {
      const defs = (shared as { maal?: Record<string, { maal: number; retning?: string; label?: string }> }).maal ?? {}
      out.maal = Object.fromEntries(
        Object.entries(defs)
          .filter(([key]) => !key.startsWith('_'))
          .map(([key, def]) => [key, { ...def, maal: overrides.targets[key] ?? def.maal }]),
      )
    }
    if (overrides.notes.length) {
      out.noter = { poster: notes.map(({ month, text }) => ({ month, text })) }
    }
    if (overrides.leadershipModules || overrides.leadershipTitle) {
      out.ledelsesdashboard = {
        titel: leadership.title,
        undertitel: leadership.subtitle,
        moduler: leadership.modules,
      }
    }
    return JSON.stringify(out, null, 2)
  }, [overrides, shared, notes, leadership])

  return {
    targets, isLocalTarget, setTarget, resetTarget,
    notes, setNote,
    leadership, isOnLeadership, toggleLeadership, moveLeadership, setLeadershipText,
    hasLocalChanges, clearLocal, exportJson,
  }
}

export type Settings = ReturnType<typeof useSettings>

/** Where to send someone who wants to make a local change permanent. */
export const CONFIG_EDIT_URL =
  'https://github.com/sebastianlistfeirup/Dashboard/edit/main/config/dashboard.json'
