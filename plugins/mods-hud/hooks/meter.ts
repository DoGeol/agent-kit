// The meter: model and effort names, the usage windows and how they fit a width, and their colors.
import type { SessionUsage } from 'claude-code'

import type { Limit, Meter } from '../types'
import { cells, two, untilText } from './text'

// A figure that just moved is marked for this long.
export const FLASH_MS = 4000

// claude-opus-5-5[1m] -> Opus 5.5
export const prettyModel = (id: string) => {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id)
  if (!m) return id
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1)
  return m[3] ? `${name} ${m[2]}.${m[3]}` : `${name} ${m[2]}`
}

// five_hour -> 5시간, seven_day -> 주간, seven_day_fable -> Fable 주간
export const limitLabel = (kind: string) => {
  if (kind === 'five_hour') return '5시간'
  if (kind === 'seven_day') return '주간'
  if (kind === 'spend_limit') return '지출'
  const model = /^seven_day_(\w+)$/.exec(kind)?.[1]
  return model ? `${model.charAt(0).toUpperCase()}${model.slice(1)} 주간` : kind
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

// Today: "15:30"; another day: "10/14(화) 12:00".
export const resetAt = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const at = new Date(iso)
  const time = `${two(at.getHours())}:${two(at.getMinutes())}`
  return at.toDateString() === new Date(now).toDateString()
    ? time
    : `${at.getMonth() + 1}/${at.getDate()}(${DAYS[at.getDay()]}) ${time}`
}

const usedColor = (p: number) => (p >= 90 ? 'error' : p >= 70 ? 'warning' : undefined)

// "5h 4%(18:10) · w 78%(10/14 12:00) · ctx 38%": the desktop bar's short plain-text usage.
// "5h 4%(18:10) · w 78%(10/14 12:00) · ctx 38%": the short usage the desktop footer shows.
const SHORT: Record<string, string> = { five_hour: '5h', seven_day: 'w', spend_limit: '$' }

export const usageParts = (m: Meter, now: number) => [
  ...m.limits.map(l => {
    const at = l.resetsAt ? new Date(l.resetsAt) : null
    const time = at ? `${two(at.getHours())}:${two(at.getMinutes())}` : ''
    const reset = !at ? '' : at.toDateString() === new Date(now).toDateString() ? time : `${at.getMonth() + 1}/${at.getDate()} ${time}`
    return { label: SHORT[l.kind] ?? `w-${l.kind.replace(/^seven_day_/, '')}`, percent: l.percent, reset }
  }),
  ...(m.context === undefined ? [] : [{ label: 'ctx', percent: m.context, reset: '' }]),
]

type UsagePart = { label: string; percent: number; reset: string }

export const partsText = (parts: UsagePart[]) =>
  parts.map(p => `${p.label} ${Math.round(p.percent)}%${p.reset ? `(${p.reset})` : ''}`).join(' · ')

// Fit a width: every reset, then today's only ("18:10"), then percentages only, then fewer windows.
export const fitUsage = (full: UsagePart[], room: number) => {
  const bare = full.map(p => ({ ...p, reset: '' }))
  // still too wide: ctx goes, then the weekly window; the 5-hour one always stays
  const tiers = [full, full.map(p => ({ ...p, reset: p.reset.includes(' ') ? '' : p.reset })), bare, bare.filter(p => p.label !== 'ctx'), bare.slice(0, 1)]
  return tiers.find(t => cells(partsText(t)) <= room) ?? tiers[tiers.length - 1]!
}

export const usageLine = (m: Meter, now: number) => partsText(usageParts(m, now)) || undefined

// The tooltip: every window with its reset spelled out and how long until it.
export const usageTip = (m: Meter, now: number) => {
  const lines = m.limits.map(l => {
    const at = l.resetsAt ? new Date(l.resetsAt) : null
    const when = at ? `${resetAt(l.resetsAt, now)} 리셋 (${untilText(at.getTime() - now)} 후)` : '리셋 시각 없음'
    return `${limitLabel(l.kind)} 한도 ${Math.round(l.percent)}% · ${when}`
  })
  if (m.context !== undefined) lines.push(`컨텍스트 ${Math.round(m.context)}%`)
  lines.push(`모델 ${prettyModel(m.model)}${m.effort ? ` · effort ${m.effort}` : ''}`)
  return lines.join('\n')
}

// Cells the desktop footer keeps for its own controls (attach, mic, mode, model, effort, spinner).
export const FOOTER_RESERVED = 55
// The desktop gives the mode labels a fixed slot whatever the window's width: about 30 cells, then "…".
export const FOOTER_SLOT = 30

// /effort and /model save the level per model (modelSettings.<id>.effortLevel).
export const effortFor = (settings: unknown, model: string | null | undefined) => {
  const s = (settings ?? {}) as { effortLevel?: unknown; modelSettings?: Record<string, { effortLevel?: unknown }> }
  const per = s.modelSettings ?? {}
  const key = model && (per[model] ? model : Object.keys(per).find(k => prettyModel(k) === prettyModel(model)))
  // The top-level level is not what a model without its own entry runs on (a model may lower it), so it is not guessed.
  const level = key ? per[key]?.effortLevel : undefined
  return typeof level === 'string' ? level : undefined
}

// "Opus 5.5(high)": what a turn or an agent runs on.
export const modelTag = (model: string | undefined, effort: string | undefined) =>
  model ? `${prettyModel(model)}${effort ? `(${effort})` : ''}` : ''

export const isFresh = (at: number | undefined, now: number) => at !== undefined && now - at < FLASH_MS

// A usage figure: blue for a moment after it moved, gray while stale, else colored by how much is used.
export const pctLook = (m: Meter, p: number, now: number) =>
  isFresh(m.flash?.usage, now)
    ? { bold: true, color: 'suggestion' as const }
    : m.isStale
      ? { dimColor: true }
      : { bold: p >= 70, color: usedColor(p) ?? 'success' }

export const toLimits = (u: Pick<SessionUsage, 'rateLimits'>): Limit[] =>
  u.rateLimits.map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: r.resetsAt }))
