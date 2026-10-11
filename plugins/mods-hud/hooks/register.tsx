import { atom, read, update } from 'claude-code'
import type { Register, SessionMessage, SessionUsage, StateDollar } from 'claude-code'

import type { AgentRow, DetailTab, DetailView, Limit, Meter, Phase, SessionRow, Spend, Summary, TurnCard } from '../types'

const summary = atom({ plugin: 'mods-hud', key: 'summary' } as const, null)
const prompt = atom({ plugin: 'mods-hud', key: 'prompt' } as const, null)
const phase = atom({ plugin: 'mods-hud', key: 'phase' } as const, 'idle')
const meter = atom({ plugin: 'mods-hud', key: 'meter' } as const, null)
const agents = atom({ plugin: 'mods-hud', key: 'agents' } as const, [])
const showAgentsAtom = atom({ plugin: 'mods-hud', key: 'showAgents' } as const, false)
const hiddenAtom = atom({ plugin: 'mods-hud', key: 'hidden' } as const, [] as string[])
const stopArmedAtom = atom({ plugin: 'mods-hud', key: 'stopArmed' } as const, null as string | null)
const agentSummariesAtom = atom({ plugin: 'mods-hud', key: 'agentSummaries' } as const, true)
const spendAtom = atom({ plugin: 'mods-hud', key: 'spend' } as const, {
  turn: { calls: 0, input: 0, output: 0 },
  agent: { calls: 0, input: 0, output: 0 },
  session: { calls: 0, input: 0, output: 0 },
} as Spend)
const beatAtom = atom({ plugin: 'mods-hud', key: 'beat' } as const, 0)
const detailAtom = atom({ plugin: 'mods-hud', key: 'detail' } as const, null as DetailView | null)
const sessionsAtom = atom({ plugin: 'mods-hud', key: 'sessions' } as const, [] as SessionRow[])
const showSessionsAtom = atom({ plugin: 'mods-hud', key: 'showSessions' } as const, false)
const hiddenSessionsAtom = atom({ plugin: 'mods-hud', key: 'hiddenSessions' } as const, [] as string[])
const historyAtom = atom({ plugin: 'mods-hud', key: 'history' } as const, [] as TurnCard[])
const detailTabAtom = atom({ plugin: 'mods-hud', key: 'detailTab' } as const, 'history' as DetailTab)
const showOlderTurnsAtom = atom({ plugin: 'mods-hud', key: 'showOlderTurns' } as const, false)
// Agents that aged off the band: kept so a reload does not bring them back (issue 008).
const droppedAtom = atom({ plugin: 'mods-hud', key: 'dropped' } as const, [] as string[])

// update() writes even when `fn` hands back what was there, and each write redraws every site that reads the
// value: the 2 s poll redrew the band and the detail pane while nothing changed, so a press could land
// mid-redraw (issue 001). The polled values go through these, which write only a change.
const changeMeter = async ($: StateDollar, fn: (m: Meter | null) => Meter | null) => {
  const prev = await read($, meter)
  const next = fn(prev)
  // fn runs once per value (the meter's marks what moved since its last call); again only if the value moved meanwhile
  if (JSON.stringify(next) !== JSON.stringify(prev)) await update($, meter, cur => (JSON.stringify(cur) === JSON.stringify(prev) ? next : fn(cur)))
}
const changeHistory = async ($: StateDollar, fn: (cards: TurnCard[]) => TurnCard[]) => {
  const prev = await read($, historyAtom)
  const next = fn(prev)
  // fn runs once per value (the meter's marks what moved since its last call); again only if the value moved meanwhile
  if (JSON.stringify(next) !== JSON.stringify(prev)) await update($, historyAtom, cur => (JSON.stringify(cur) === JSON.stringify(prev) ? next : fn(cur)))
}
const changeSessions = async ($: StateDollar, fn: (rows: SessionRow[]) => SessionRow[]) => {
  const prev = await read($, sessionsAtom)
  const next = fn(prev)
  // fn runs once per value (the meter's marks what moved since its last call); again only if the value moved meanwhile
  if (JSON.stringify(next) !== JSON.stringify(prev)) await update($, sessionsAtom, cur => (JSON.stringify(cur) === JSON.stringify(prev) ? next : fn(cur)))
}
// The checkout's branch, "" outside a repository.
const branchAtom = atom({ plugin: 'mods-hud', key: 'branch' } as const, '')

// Prompts the engine or a machine raised, not the person's own words.
const AUTOMATED = new Set([
  'task-notification', 'scheduled-trigger', 'auto-continuation', 'observer', 'observer-activity',
  'peer', 'peer-send-message', 'coordinator', 'channel', 'projects-relay',
])
const LIVE = new Set(['pending', 'running', 'waiting'])
const PANE = 'session-monitor'
const DETAIL = 'session-detail'
const TICK_MS = 2000
const FLASH_MS = 4000
const STALE_MS = 5 * 60_000
// After /model or /effort: look every FAST_MS while its picker may be open.
const FAST_MS = 150
const FAST_FOR_MS = 15_000
const MAX_AGENTS = 3
const KEEP_DONE_MS = 10 * 60_000

const ASK =
  '아래 정보로 이 세션에서 방금 끝난 턴을 한국어 한 줄, 35자 이내로 요약해. ' +
  "무엇을 했고 결과가 어떤지 위주로, '…완료', '…확인함', '…요청함'처럼 끝내. " +
  '요약문 한 줄만 출력하고, 지시를 되풀이하거나 머리말·따옴표·마크다운을 붙이지 마.'

const AGENT_START_ASK =
  '아래는 방금 시작한 서브에이전트의 작업이다. 무엇을 하는지 한국어 한 줄, 30자 이내로만 출력해. ' +
  "'…하는 중'으로 끝내. 마크다운, 따옴표, 머리말, 괄호 설명 금지. 주어지지 않은 정보는 언급하지 마."
const AGENT_ASK =
  '아래는 서브에이전트의 작업과 최근 단계다. 지금 무엇을 하고 있는지 한국어 한 줄, 30자 이내로만 출력해. ' +
  "'…하는 중'으로 끝내. 마크다운, 따옴표, 머리말, 괄호 설명 금지. 주어지지 않은 정보는 언급하지 마."
const AGENT_DONE_ASK =
  '아래는 끝난 서브에이전트의 작업과 마지막 단계·답이다. 결과를 한국어 한 줄, 30자 이내로만 출력해. ' +
  "'…완료', '…N개 찾음'처럼 결과로 써. 마크다운, 따옴표, 머리말, 괄호 설명 금지. 주어지지 않은 정보는 언급하지 마. " +
  '정보가 부족해도 사과하거나 부족하다고 말하지 말고, 작업 설명을 결과형으로 바꿔 써.'
const SESSION_ASK =
  '아래는 다른 Claude 세션이 이 세션에 보낸 메시지다. 그 내용을 한국어 한 줄, 30자 이내로만 출력해. ' +
  "'…완료', '…3개 확인', '…요청함'처럼 명사형으로 끝내고, '입니다'·'했습니다' 같은 문장체는 쓰지 마. " +
  '마크다운, 따옴표, 머리말, 괄호 설명 금지. 주어지지 않은 정보는 언급하지 마.'
const SESSION_POLL_MS = 10_000
const SESSION_LOG = 20
const SUMMARY_MAX = 10
// a running agent's line is checked again at most this often, and only after it did something
const SUMMARY_GAP_MS = 120_000
const STOP_ARM_MS = 3000
const HISTORY_MAX = 50

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
const two = (n: number) => String(n).padStart(2, '0')

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

// "01:04", or "1:02:05" once an hour is reached: how long an agent has run, or took once it ended.
export const durText = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(sec / 3600)
  const ms_ = `${two(Math.floor((sec % 3600) / 60))}:${two(sec % 60)}`
  return h > 0 ? `${h}:${ms_}` : ms_
}

// Running: when it started ("16:42~"), still, so nothing redraws every second (that made the app blink and drop clicks);
// ended: how long it took ("03:12").
export const elapsedText = (a: { startedAt: number; endedAt?: number; status: string }, now: number) => {
  const phase = agentPhase(a.status)
  if (phase !== 'done' && phase !== 'stopped') return `${hhmm(a.startedAt)}~`
  return durText((a.endedAt ?? now) - a.startedAt)
}

const untilText = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}일 ${h}시간` : h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

// Cells the desktop footer keeps for its own controls (attach, mic, mode, model, effort, spinner).
const FOOTER_RESERVED = 55
// The desktop gives the mode labels a fixed slot whatever the window's width: about 30 cells, then "…".
const FOOTER_SLOT = 30

// Terminal cells a string takes: Hangul, CJK and other wide scripts take two.
export const cells = (text: string) =>
  [...text].reduce((n, ch) => n + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1), 0)

// Cut to n cells with …: every surface then draws one line, a Button's label included.
export const clipCells = (t: string, n: number) => {
  if (cells(t) <= n) return t
  let out = ''
  for (const ch of t) {
    if (cells(out + ch) > n - 1) break
    out += ch
  }
  return `${out}…`
}

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
const base = (path: unknown) => (typeof path === 'string' ? path.split('/').pop() ?? path : '')

// What a subagent's tool call is doing, in a few words: "Grep "auth"", "Read login.ts", "Bash ls -la".
export const describeCall = (tool: string, input: Record<string, unknown>) => {
  const name = shortTool(tool)
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).replace(/\s+/g, ' ').trim() : '')
  const detail =
    name === 'Bash' ? str('description') || str('command')
    : ['Read', 'Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(name) ? base(input.file_path ?? input.notebook_path)
    : name === 'Grep' ? (str('pattern') ? `"${str('pattern')}"` : '')
    : name === 'Glob' ? str('pattern')
    : name === 'WebFetch' ? str('url').replace(/^https?:\/\//, '').split('/')[0] ?? ''
    : name === 'WebSearch' ? str('query')
    : name === 'Agent' ? str('description')
    : ''
  return clip(detail ? `${name} ${detail}` : name, 48)
}

const shortTool = (tool: string) => tool.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '')

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

// "⎇ main" or "⎇ feat (워크트리)" from `git rev-parse --abbrev-ref HEAD --git-dir --git-common-dir`:
// a linked worktree has its own git dir apart from the common one. Empty outside a repository.
export const branchLabel = (out: string) => {
  const [head, gitDir, commonDir] = out.trim().split('\n')
  if (!head || !gitDir || !commonDir) return ''
  return `⎇ ${head}${gitDir !== commonDir ? ' (워크트리)' : ''}`
}

// The widest state word (진행 중): the state sits left in a cell this wide, so what follows lines up.
const STATE_CELLS = 7

const isFresh = (at: number | undefined, now: number) => at !== undefined && now - at < FLASH_MS

// A usage figure: blue for a moment after it moved, gray while stale, else colored by how much is used.
export const pctLook = (m: Meter, p: number, now: number) =>
  isFresh(m.flash?.usage, now)
    ? { bold: true, color: 'suggestion' as const }
    : m.isStale
      ? { dimColor: true }
      : { bold: p >= 70, color: usedColor(p) ?? 'success' }

const toLimits = (u: Pick<SessionUsage, 'rateLimits'>): Limit[] =>
  u.rateLimits.map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: r.resetsAt }))

// The four states the monitor speaks: 대기 gray, 진행 중 yellow, 완료 green (its row dims), 중지 red.
const LOOK: Record<Phase, { word: string; dot: string; color: string; isDone: boolean }> = {
  idle: { word: '대기', dot: '○', color: 'subtle', isDone: false },
  running: { word: '진행 중', dot: '●', color: 'warning', isDone: false },
  done: { word: '완료', dot: '✓', color: 'success', isDone: true },
  stopped: { word: '중지', dot: '✗', color: 'error', isDone: false },
}

export const agentPhase = (status: string): Phase =>
  status === 'pending' || status === 'running'
    ? 'running'
    : status === 'completed'
      ? 'done'
      : status === 'failed' || status === 'killed'
        ? 'stopped'
        : 'idle'

// The fork's one line, cleaned of the decorations the model adds anyway.
export const oneLine = (text: string) =>
  (text.split('\n').map(l => l.trim()).find(Boolean) ?? '')
    .replace(/^[-*•]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim()

// A Haiku line that drifted from the asks (issue 009): an instruction echoed, an apology, a sentence ending,
// or running wording on something finished. Such a line is dropped and the last one stays.
export const summaryLine = (text: string, isFinal = false) => {
  const line = oneLine(text)
  const isBad =
    /이내로|한 줄|출력해|끝내|금지|머리말|형태로:|^…/.test(line) ||
    /정보가 (부족|없)|죄송/.test(line) ||
    /(니다|어요|해요)[.!]?$/.test(line) ||
    (isFinal && /(중|하는 중)[.…]*$/.test(line))
  return isBad ? '' : line
}

// "<agent-message from="x">…</agent-message>": another session's (or a subagent's) message inside a prompt.
// Messages from elsewhere inside a prompt: a subagent's `<agent-message from="id">`, or another session's
// `<cross-session-message from-session="local_…" from-name="title">` (keyed by its session id, shown by its title).
export const agentMessages = (text: string) =>
  [...text.matchAll(/<(agent-message|cross-session-message)\b([^>]*)>([\s\S]*?)<\/\1>/g)].flatMap(m => {
    const attr = (k: string) => new RegExp(`\\b${k}="([^"]+)"`).exec(m[2]!)?.[1]
    const from = attr('from-session') ?? attr('from')
    return from ? [{ from, title: attr('from-name'), body: m[3]!.trim() }] : []
  })

// SendMessage may spell a listed name with its " [ref]".
export const sessionName = (to: string) => to.replace(/\s*\[[^\]]*\]$/, '').trim()

// ListAgents' answer, as rows when it has them, else its "[idle]  ·  NAME  ·  /path  ·  started 2h ago" lines.
export const listedStates = (r: unknown) => {
  const x = (r ?? {}) as { result?: { listing?: unknown; sections?: { rows?: { name?: string; status?: string }[] }[] }; text?: unknown }
  const res = typeof x.result === 'object' && x.result ? x.result : {}
  const out = new Map<string, SessionRow['state']>()
  const word = (s: string | undefined): SessionRow['state'] => (s === 'running' ? 'running' : s === 'idle' ? 'idle' : 'unknown')
  for (const sec of Array.isArray(res.sections) ? res.sections : []) for (const row of sec.rows ?? []) if (row.name) out.set(sessionName(row.name), word(row.status))
  const listing = typeof res.listing === 'string' ? res.listing : typeof x.text === 'string' ? x.text : ''
  for (const line of listing.split('\n')) {
    const m = /^\s*\[(\w+)\]\s*·\s*(.+?)\s*(?:·|$)/.exec(line)
    if (m && !out.has(sessionName(m[2]!))) out.set(sessionName(m[2]!), word(m[1]))
  }
  return out
}

const hhmm = (at: number) => `${two(new Date(at).getHours())}:${two(new Date(at).getMinutes())}`

// An agent's snapshot in its turn card. What the card first saw holds where the live row lost it:
// a reload re-finds an old agent with a fresh start and no line.
const snapOf = (t: AgentRow, prev?: TurnCard['agents'][number]): TurnCard['agents'][number] => {
  const ended = agentPhase(t.status) === 'done' || agentPhase(t.status) === 'stopped'
  const endedAt = ended ? (prev?.endedAt ?? t.endedAt) : undefined
  return {
    id: t.id, type: t.type, summary: t.summary ?? prev?.summary ?? t.description, status: t.status,
    startedAt: prev?.startedAt ?? t.startedAt, ...(endedAt === undefined ? {} : { endedAt }),
  }
}

// "30초 전", "2분 전", "3시간 전", "1일 전"
export const ago = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`
}

// A session's newest message either way: its direction arrow and when.
const lastOf = (s: SessionRow) => {
  const out = s.lastSent?.at ?? -1
  const inn = s.lastReceived?.at ?? -1
  return out >= inn ? (s.lastSent ? { arrow: '↑', ...s.lastSent } : undefined) : { arrow: '↓', ...s.lastReceived! }
}

// ◆ running, ◇ idle, ◇ dim when ListAgents never placed it; 대기 covers both of the last.
const SESSION_LOOK: Record<SessionRow['state'], { dot: string; color?: string; dim: boolean; word: string }> = {
  running: { dot: '◆', color: 'warning', dim: false, word: '진행 중' },
  idle: { dot: '◇', color: 'subtle', dim: false, word: '대기' },
  unknown: { dot: '◇', dim: true, word: '대기' },
  gone: { dot: '■', dim: true, word: '종료' },
}

// A saved `{ agentId, at }` from an older build reads as the view it meant.
export const detailView = (d: DetailView | { agentId: string | null; at: number } | null): DetailView | null =>
  !d ? null : 'kind' in d ? d : { kind: d.agentId === null ? 'main' : 'agent', id: d.agentId, at: d.at }

export const register: Register = on => {
  let turns = 0
  let isBusy = false
  let wantsPane = false
  let settingsEffort: string | undefined
  // null: not yet written by this load, so the first poll clears whatever an earlier load left there.
  let statusLine: string | undefined | null = null
  let hasFooter = false
  const lastDraw: Record<string, string> = {}
  // The transcript changes only when a call finishes or a turn ends: the pane reads it again only then.
  // (Reading thousands of messages on every redraw made the pane slow to answer a press.)
  const transcriptV = new Map<string, number>()
  const transcriptCache = new Map<string, { v: number; msgs: SessionMessage[] }>()
  const touchTranscript = (key: string) => transcriptV.set(key, (transcriptV.get(key) ?? 0) + 1)
  // Per-agent facts the list does not carry; a hot reload starts them over.
  // Every subagent this load has heard of, kept live from its spawn, its tool calls and its end.
  const tracked = new Map<string, AgentRow>()
  const dropped = new Set<string>()
  // Set in session.start: writes `tracked` to the drawn state (only when it changed).
  let publish: (() => Promise<void>) | null = null
  // Set in session.start: writes an agent's Korean line from its own transcript.
  let summarizeAgent: ((id: string, isFinal: boolean, answer?: string) => Promise<void>) | null = null
  const inFlight = new Set<string>()
  // Set in session.start: polls fast for a while after /model or /effort.
  let rush: (() => void) | null = null
  let seen: { model: string; effort: string; usage: string } | null = null
  // Set in session.start: closes over that hook's $, so timers can work after a dispatch ended.
  let refresh: ((answer: string) => Promise<void>) | null = null
  // Set in session.start: logs a message to or from another session, and whether an id is one of our subagents.
  let recordSession: ((name: string, dir: 'out' | 'in', text: string, title?: string) => Promise<void>) | null = null
  let isSubagent: ((id: string) => Promise<boolean>) | null = null
  const sessionBusy = new Set<string>()

  on('session.start', async ($, e, next) => {
    // The line comes from Haiku over the turn's ask, its recent calls and the answer's head: a few thousand tokens,
    // where a fork re-sent the whole conversation on the main model every turn.
    refresh = async answer => {
      if (isBusy) return
      isBusy = true
      try {
        const got = await $.session.messages().catch(() => [])
        const msgs = Array.isArray(got) ? got : []
        const askAt = msgs.findLastIndex(x => x.role === 'user' && x.text.trim() && !x.text.trimStart().startsWith('<'))
        const ask = (askAt >= 0 ? msgs[askAt]!.text : (await read($, prompt)) ?? '').slice(0, 800)
        const steps = msgs.slice(Math.max(0, askAt)).flatMap(x => x.toolUses).slice(-8).map(u => describeCall(u.tool, u.input))
        const said = (answer.trim() || [...msgs].reverse().find(x => x.role === 'assistant' && x.text.trim())?.text || '').slice(0, 1500)
        const request = [
          ASK,
          ask && `[요청]\n${ask}`,
          steps.length > 0 && `[최근 단계]\n${steps.join('\n')}`,
          said && `[마지막 답변]\n${said}`,
        ].filter(Boolean).join('\n\n')
        const reply = await $.model.complete({ model: 'haiku', prompt: request, effort: 'low', maxTokens: 80 })
        if (reply.isAnswered) await count('turn', reply.usage)
        const text = reply.isAnswered ? summaryLine(reply.text) : ''
        if (text) {
          const at = await $.clock.now()
          await update($, summary, () => ({ text, at, turns }) satisfies Summary)
          // ponytail: the latest card, so a turn started before Haiku answered gets the line one card late
          await update($, historyAtom, cards => {
            const last = cards.at(-1)
            return last ? [...cards.slice(0, -1), { ...last, result: text }] : cards
          })
        }
        // ponytail: a failed summary keeps the last line; the state shows the turn, not the summarizer
      } catch {
        // as above
      } finally {
        isBusy = false
      }
    }

    const count = (kind: keyof Spend, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number }) =>
      update($, spendAtom, sp => ({
        ...sp,
        // a spend saved before a kind existed lacks it
        [kind]: {
          calls: (sp[kind]?.calls ?? 0) + 1,
          input: (sp[kind]?.input ?? 0) + u.input_tokens + (u.cache_read_input_tokens ?? 0),
          output: (sp[kind]?.output ?? 0) + u.output_tokens,
        },
      }))

    publish = async () => {
      const now = await $.clock.now()
      const aged = [...tracked.values()].filter(t => t.endedAt !== undefined && now - t.endedAt > KEEP_DONE_MS)
      if (aged.length > 0) {
        for (const t of aged) {
          tracked.delete(t.id)
          dropped.add(t.id)
        }
        // ponytail: the newest 200 ids; an older one the engine still lists would come back once
        await update($, droppedAtom, () => [...dropped].slice(-200))
      }
      const rows = [...tracked.values()]
        .sort((x, y) => y.startedAt - x.startedAt)
        .slice(0, 12)
        .map(t => ({ ...t }))
      const prev = await read($, agents)
      if (JSON.stringify(prev) !== JSON.stringify(rows)) await update($, agents, () => rows)
      // Each agent's snapshot stays in the card it started in, updated there; one not yet in a card joins the latest.
      // (one older than that card is from before the history: left out)
      await changeHistory($, cards => {
        const last = cards.at(-1)
        if (!last) return cards
        const placed = new Set(cards.flatMap(c => c.agents.map(a => a.id)))
        const fresh = [...tracked.values()].filter(t => !placed.has(t.id) && t.startedAt >= last.startedAt)
        const out = cards.map((c, i) => ({
          ...c,
          agents: [
            ...c.agents.map(s => {
              const t = tracked.get(s.id)
              return t ? snapOf(t, s) : s
            }),
            ...(i === cards.length - 1 ? fresh.map(t => snapOf(t)) : []),
          ],
        }))
        return JSON.stringify(out) === JSON.stringify(cards) ? cards : out
      })
    }

    summarizeAgent = async (id, isFinal, answer) => {
      const t = tracked.get(id)
      // one at a time per agent, two at once overall, at most SUMMARY_MAX per agent
      if (!t) return
      // the result line must not be lost behind a progress line still being written
      if (isFinal && (inFlight.has(id) || inFlight.size >= 2)) {
        $.clock.after(2000, () => void summarizeAgent?.(id, true, answer))
        return
      }
      if (inFlight.has(id) || inFlight.size >= 2 || (!isFinal && (t.summaryCount ?? 0) >= SUMMARY_MAX)) return
      if (!(await read($, agentSummariesAtom))) return
      // calls queued in one gap each asked for a check-in: the first one answers for them all
      if (!isFinal && t.summaryAt !== undefined && (await $.clock.now()) - t.summaryAt < SUMMARY_GAP_MS) return
      inFlight.add(id)
      try {
        const got = await $.session.messages({ agentId: id }).catch(() => [])
        const msgs = Array.isArray(got) ? got : []
        const steps = msgs.flatMap(x => x.toolUses).slice(-8).map(u => describeCall(u.tool, u.input))
        // its final answer comes with turn.complete; the transcript may not hold it yet
        const said = (answer?.trim() || [...msgs].reverse().find(x => x.role === 'assistant' && x.text.trim())?.text || '').slice(0, 600)
        // only what is there: a section marked missing came back as "(마지막 말 없음)" in the line
        const prompt = [
          isFinal ? AGENT_DONE_ASK : t.tools === 0 ? AGENT_START_ASK : AGENT_ASK,
          `[작업] ${t.description}`,
          steps.length > 0 && `[최근 단계]\n${steps.join('\n')}`,
          said && `[마지막 말]\n${said}`,
        ].filter(Boolean).join('\n\n')
        const r = await $.model.complete({ model: 'haiku', prompt: prompt.slice(0, 2400), effort: 'low', maxTokens: 80 })
        if (r.isAnswered) await count('agent', r.usage)
        const text = r.isAnswered ? summaryLine(r.text, isFinal) : ''
        const cur = tracked.get(id)
        // an answer counts as a check-in even when its line was dropped: no new ask before the next gap
        if (r.isAnswered && cur) {
          if (text) cur.summary = text
          cur.summaryAt = await $.clock.now()
          cur.summaryTools = cur.tools
          cur.summaryCount = (cur.summaryCount ?? 0) + 1
          await publish?.()
        }
        // ponytail: a failed or dropped line keeps the last one, or the description
      } catch {
        // as above
      } finally {
        inFlight.delete(id)
      }
    }

    isSubagent = async id => tracked.has(id) || dropped.has(id) || (await read($, agents)).some(a => a.id === id)

    // A Korean line on the latest received message, one at a time per session.
    // ponytail: an older line landing after a newer message is possible; the next message rewrites it
    const summarizeSession = async (name: string, text: string) => {
      if (sessionBusy.has(name)) return
      sessionBusy.add(name)
      try {
        const r = await $.model.complete({ model: 'haiku', prompt: `${SESSION_ASK}\n\n[메시지]\n${text.slice(0, 1500)}`, effort: 'low', maxTokens: 80 })
        if (r.isAnswered) await count('session', r.usage)
        const line = r.isAnswered ? summaryLine(r.text) : ''
        if (line) await update($, sessionsAtom, rows => rows.map(s => (s.name === name ? { ...s, summary: line } : s)))
      } catch {
        // a failed line leaves the message's own first line shown
      } finally {
        sessionBusy.delete(name)
      }
    }

    recordSession = async (name, dir, text, title) => {
      const at = await $.clock.now()
      const line = clip(oneLine(text), 200)
      await update($, sessionsAtom, rows => {
        const cur = rows.find(s => s.name === name) ?? { name, state: 'unknown' as const, log: [] }
        const row: SessionRow = {
          ...cur,
          ...(title ? { title } : {}),
          ...(dir === 'out' ? { lastSent: { at, text: line } } : { lastReceived: { at, text: line }, summary: undefined }),
          log: [...cur.log, { dir, at, text: line }].slice(-SESSION_LOG),
        }
        return [row, ...rows.filter(s => s.name !== name)]
      })
      // new traffic brings a closed row back
      await update($, hiddenSessionsAtom, ids => (ids.includes(name) ? ids.filter(x => x !== name) : ids))
      // and lands in the current turn's card
      const row = (await read($, sessionsAtom)).find(s => s.name === name)
      await update($, historyAtom, cards => {
        const last = cards.at(-1)
        if (!last || !row) return cards
        const prev = last.sessions.find(s => s.name === name)
        const snap: TurnCard['sessions'][number] = {
          ...prev,
          name,
          ...(row.title ? { title: row.title } : {}),
          state: row.state,
          ...(dir === 'out' ? { lastOut: line } : { lastIn: line }),
        }
        const sessions = prev ? last.sessions.map(s => (s.name === name ? snap : s)) : [...last.sessions, snap]
        return [...cards.slice(0, -1), { ...last, sessions }]
      })
      if (dir === 'in') $.clock.after(0, () => void summarizeSession(name, text))
    }

    // ListAgents is the word on whether a session works or waits; unavailable, every row reads unknown.
    let isListing = false
    const pollSessions = async () => {
      if (isListing || (await read($, sessionsAtom)).length === 0) return
      isListing = true
      try {
        const r = await $.tool.call({ tool: 'ListAgents' }).catch(() => null)
        const listed = r && !('deny' in r && r.deny) && !('isError' in r && r.isError) ? listedStates(r) : new Map<string, SessionRow['state']>()
        lastDraw['list-agents'] = r === null ? 'threw' : 'deny' in r && r.deny ? `deny: ${r.deny}` : 'isError' in r && r.isError ? 'error' : `ok ${listed.size}개`
        await changeSessions($, rows => {
          // a session the list answered without has ended (archived, closed); a failed list leaves it unknown
          const missing: SessionRow['state'] = listed.size > 0 ? 'gone' : 'unknown'
          const fresh = rows.map(s => ({ ...s, state: listed.get(s.name) ?? (s.title ? listed.get(s.title) : undefined) ?? missing }))
          return JSON.stringify(fresh) === JSON.stringify(rows) ? rows : fresh
        })
        // a session's state reads on in the newest card that has it; older cards keep theirs from then
        const states = new Map((await read($, sessionsAtom)).map(s => [s.name, s.state]))
        await changeHistory($, cards => {
          const newest = new Map<string, number>()
          cards.forEach((c, i) => c.sessions.forEach(s => newest.set(s.name, i)))
          let isChanged = false
          const out = cards.map((c, i) => ({
            ...c,
            sessions: c.sessions.map(s => {
              const state = states.get(s.name)
              if (newest.get(s.name) !== i || !state || state === s.state) return s
              isChanged = true
              return { ...s, state }
            }),
          }))
          return isChanged ? out : cards
        })
      } finally {
        isListing = false
      }
    }

    let isPolling = false
    const poll = async () => {
      if (isPolling) return
      isPolling = true
      try {
        await look()
      } finally {
        isPolling = false
      }
    }
    const look = async () => {
      const now = await $.clock.now()

      // /model and /effort land here within a tick, before any request is made.
      const [model, settings] = await Promise.all([
        $.session.model().catch(() => null),
        $.settings.read().catch(() => null),
      ])
      const level = effortFor(settings, model)
      const effortChanged = level !== undefined && level !== settingsEffort
      settingsEffort = level ?? settingsEffort
      // A window past its reset starts over at 0 even before a response says so.
      const isStale = (l: Limit) => !!l.resetsAt && new Date(l.resetsAt).getTime() <= now
      await changeMeter($, m => {
        if (!m) return m
        const modelChanged = !!model && (!m.model || prettyModel(model) !== prettyModel(m.model))
        // a model switch brings that model's saved level along
        const effort = (effortChanged || modelChanged) && level ? level : m.effort
        const isOld = m.measuredAt === undefined || now - m.measuredAt > STALE_MS
        // Mark what moved since the last tick for FLASH_MS, whichever hook moved it (a tick, a switch, a step, a measure).
        const usageKey = JSON.stringify([m.limits.map(l => Math.round(l.percent)), Math.round(m.context ?? -1)])
        const now$ = { model: prettyModel(modelChanged ? model : m.model), effort: effort ?? '', usage: usageKey }
        const moved = { model: !!seen && seen.model !== now$.model, effort: !!seen && seen.effort !== now$.effort, usage: !!seen && seen.usage !== now$.usage }
        seen = now$
        const flash = Object.fromEntries(
          (['model', 'effort', 'usage'] as const)
            .map(k => [k, moved[k] ? now : m.flash?.[k]] as const)
            .filter(([, at]) => at !== undefined && now - at < FLASH_MS),
        )
        const isSame =
          !modelChanged && effort === m.effort && !m.limits.some(isStale) && isOld === !!m.isStale && JSON.stringify(flash) === JSON.stringify(m.flash ?? {})
        return isSame
          ? m
          : {
              ...m,
              model: modelChanged ? model : m.model,
              effort,
              isStale: isOld,
              flash,
              limits: m.limits.map(l => (isStale(l) ? { kind: l.kind, percent: 0 } : l)),
            }
      })
      // The engine's list is the authority on status; events fill in between ticks.
      const list = await $.agent.list().catch(() => [])
      for (const a of list) {
        // a row that aged off the band stays off (the engine still lists it, and a reload would bring it back),
        // unless a message woke it and it runs again
        if (dropped.has(a.id)) {
          if (agentPhase(a.status) !== 'running') continue
          dropped.delete(a.id)
        }
        const t = tracked.get(a.id) ??{ id: a.id, type: a.type, description: a.description, status: a.status, lastTool: '', activity: '', tools: 0, startedAt: now }
        // idle is a loop that ended its turn and waits for a message: a subagent there is done
        // (a message may wake it, and the next tick shows it running again); a teammate waits (대기).
        t.status = a.status === 'idle' && !a.teammateId ? 'completed' : a.status
        t.type = a.type
        t.description = a.description
        // only a finished agent has an end; one idle between steps is still at work
        const ended = agentPhase(a.status) === 'done' || agentPhase(a.status) === 'stopped'
        t.endedAt = ended ? (t.endedAt ?? now) : undefined
        tracked.set(a.id, t)
      }
      await publish?.()

      // The desktop app shows usage in its bar under the prompt; a terminal keeps it in the band.
      const surfaces: readonly string[] = await $.session.surfaces().catch(() => [])
      const m = await read($, meter)
      // Fallback only: where the desktop never asked us to draw its footer modes, use the status line.
      const line = surfaces.includes('desktop') && m && !hasFooter ? usageLine(m, now) : undefined
      if (line !== statusLine) {
        statusLine = line
        $.ui.status(line)
      }


      if (wantsPane) {
        const panes = await $.ui.panes().catch(() => null)
        if (panes && !panes.some(p => p.id === PANE)) await $.ui.open({ id: PANE, title: 'Session', rows: 8 })
      }
    }

    // A reload starts with an empty map: take back the rows already shown (model, effort, call id, last step),
    // so an agent's model stays on its row instead of waiting for its next request.
    // (a row named 'agent' came from a fork's calls in an older build: dropped)
    for (const id of await read($, droppedAtom)) dropped.add(id)
    for (const row of await read($, agents)) if (!tracked.has(row.id) && !dropped.has(row.id) && row.type !== 'agent') tracked.set(row.id, { ...row })

    await $.command.register({
      name: 'mods-hud',
      description: 'HUD 요약 지금 갱신 (usage: 사용량·모드 토큰, pane: 패널로 보기, agents on/off: 서브에이전트 요약, debug: 진단)',
      argumentHint: '[usage|pane|agents on|agents off|debug]',
    })

    // Any of these may fail at start: the meter is made anyway, and the timers below still start.
    // (A throw here once left the meter empty for good: no model, effort or usage on any surface.)
    const [model, usage, settings] = await Promise.all([
      $.session.model().catch(() => null),
      $.session.usage().catch(() => null),
      $.settings.read().catch(() => null),
    ])
    settingsEffort = effortFor(settings, model)
    // A reload starts here too: keep when figures last arrived.
    await update($, meter, prev => {
      const name = model ?? prev?.model ?? ''
      return {
        model: name,
        // a reload keeps the level the last request ran on
        effort: (prev && prettyModel(prev.model) === prettyModel(name) && prev.effort) || settingsEffort,
        context: usage ? usage.context.percent : prev?.context,
        limits: usage ? toLimits(usage) : (prev?.limits ?? []),
        measuredAt: prev?.measuredAt,
        isStale: prev?.isStale,
      } satisfies Meter
    })

    $.clock.every(TICK_MS, () => void poll())
    $.clock.every(SESSION_POLL_MS, () => void pollSessions())
    // A branch changes by hand (checkout, a new worktree's session): read it now and every session poll.
    const pollBranch = async () => {
      const r = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--abbrev-ref', 'HEAD', '--git-dir', '--git-common-dir']).catch(() => null)
      const label = r && r.exitCode === 0 ? branchLabel(r.stdout) : ''
      if (label !== (await read($, branchAtom))) await update($, branchAtom, () => label)
    }
    void pollBranch()
    $.clock.every(SESSION_POLL_MS, () => void pollBranch())
    let fast: { cancel: () => void } | null = null
    rush = () => {
      fast?.cancel()
      void poll()
      const timer = $.clock.every(FAST_MS, () => void poll())
      fast = timer
      $.clock.after(FAST_FOR_MS, () => timer.cancel())
    }

    return next(e)
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    await update($, meter, m => (m && m.model !== e.to_model ? { ...m, model: e.to_model } : m))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    // an empty meter is made here too; the next tick names the model
    await update($, meter, m => ({ model: '', ...m, context: e.context.percent, limits: toLimits(e), measuredAt: now, isStale: false }))

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      // A step that names no effort (a fork, a model without one) keeps the last one seen.
      await update($, meter, m => {
        const effort = e.effort === undefined ? m?.effort : String(e.effort)
        return m && (m.model !== e.model || m.effort !== effort) ? { ...m, model: e.model, effort } : m
      })
    } else {
      const t = tracked.get(e.agentId)
      const effort = e.effort === undefined ? t?.effort : String(e.effort)
      if (t && (t.model !== e.model || t.effort !== effort)) {
        t.model = e.model
        t.effort = effort
        await publish?.()
      }
    }

    return yield* next(e)
  })

  // The picker saves its choice whenever the person picks: look fast from the moment it opens.
  for (const command of ['model', 'effort']) {
    on('command.run', { command }, async ($, e, next) => {
      rush?.()
      const ran = await next(e)
      rush?.()
      return ran
    })
  }

  on('command.run', { command: 'mods-hud' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'pane') {
      wantsPane = true
      const opened = await $.ui.open({ id: PANE, title: 'Session', rows: 8 })
      return { text: opened.isPlaced ? '모니터 패널 열림.' : `패널 대기: ${opened.reason}` }
    }
    if (arg === 'usage') {
      const [m, now] = await Promise.all([read($, meter), $.clock.now()])
      const sp = await read($, spendAtom)
      const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
      const line = (name: string, x: { calls: number; input: number; output: number }) =>
        `${name} ${x.calls}회 · 입력 ${k(x.input)} · 출력 ${k(x.output)} 토큰`
      const zero = { calls: 0, input: 0, output: 0 }
      const mod = `이 모드의 요청 (Haiku)\n${line('세션 요약', sp.turn)}\n${line('서브에이전트 요약', sp.agent)}\n${line('오케스트레이션 요약', sp.session ?? zero)}`
      return { text: `${m ? usageTip(m, now) : '사용량 정보 없음'}\n\n${mod}` }
    }
    if (arg === 'agents on' || arg === 'agents off') {
      await update($, agentSummariesAtom, () => arg === 'agents on')
      return { text: arg === 'agents on' ? '서브에이전트 한글 요약 켬.' : '서브에이전트 한글 요약 끔 (요약 요청을 보내지 않음).' }
    }
    if (arg === 'debug') {
      const surfaces = await $.session.surfaces()
      const draws = Object.entries(lastDraw).map(([k, v]) => `${k}: ${v}`).join(' | ') || '아직 한 번도 안 그림'
      const rows = (await read($, agents)).map(a => `${a.id.slice(0, 8)}:${a.type}:${a.status}`).join(', ') || '없음'
      const peers = (await read($, sessionsAtom)).map(x => `${x.title ?? x.name}:${x.state}:로그${x.log.length}`).join(', ') || '없음'
      const m = await read($, meter)
      const usage = m ? `${prettyModel(m.model) || '모델 없음'} ${m.effort ?? '-'} 한도${m.limits.length} ctx=${m.context ?? '-'}` : '없음'
      return { text: `[진단] surfaces=${surfaces.join(',') || '없음'} · 입력=${e.origin?.kind ?? '?'} · 사용량: ${usage} · 에이전트: ${rows} · 세션: ${peers} · 마지막 그림: ${draws}` }
    }
    $.clock.after(0, () => void refresh?.(''))

    return { text: '진행 요약 갱신 중.' }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') wantsPane = false
    return next(e)
  })

  on('ui.close', { id: DETAIL }, async ($, e, next) => {
    await update($, detailAtom, () => null)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // Another session's message comes as an `<agent-message from>` prompt (origin peer); a subagent's from is its id.
    for (const m of agentMessages(e.text)) {
      if (!(await isSubagent?.(m.from))) await recordSession?.(sessionName(m.from), 'in', m.body, m.title)
    }
    // a subagent's hand-back arrives as an `<agent-message …>` prompt: not the person's words
    if (!AUTOMATED.has(e.origin.kind) && !e.text.trimStart().startsWith('<')) {
      const text = e.text.replace(/\s+/g, ' ').trim().slice(0, 160)
      await update($, prompt, () => text)
    }

    return next(e)
  })

  // The main loop's SendMessage to a name that is not one of our subagents: a message to another session.
  // This mod's own ↻ logs itself (whether its own hooks see that call is the engine's to decide).
  on('tool.call', { tool: 'SendMessage' }, async ($, e, next) => {
    const ran = await next(e)
    if (next.origin.plugin === 'mods-hud') return ran
    const m = e as unknown as { to?: unknown; message?: unknown }
    const to = typeof m.to === 'string' ? sessionName(m.to) : ''
    const isSent = !('deny' in ran && ran.deny) && !('isError' in ran && ran.isError)
    if (e.agentId === undefined && isSent && to && to !== 'main' && typeof m.message === 'string' && !(await isSubagent?.(to))) {
      const known = (await read($, sessionsAtom)).find(s => s.name === to || s.title === to)
      await recordSession?.(known?.name ?? to, 'out', m.message)
    }
    return ran
  })

  on('tool.call', async ($, e, next) => {
    // Only agents we saw start (agent.spawn) or the engine lists: a fork (this mod's own summary fork among them)
    // also calls with an agentId, is never listed and never ends as an agent, so it would hang on as 진행 중.
    const known = e.agentId === undefined ? undefined : tracked.get(e.agentId)
    if (e.agentId !== undefined && known) {
      const now = await $.clock.now()
      const t = known
      tracked.set(e.agentId, {
        ...t,
        status: LIVE.has(t.status) ? t.status : 'running',
        lastTool: shortTool(String(e.tool)),
        activity: describeCall(String(e.tool), e as unknown as Record<string, unknown>),
        tools: t.tools + 1,
      })
      await publish?.()
      // Korean lines come on a change: its task when it starts, a check-in every SUMMARY_GAP_MS while it works, its result at the end
      const cur = tracked.get(e.agentId)!
      if (cur.summaryAt !== undefined && now - cur.summaryAt >= SUMMARY_GAP_MS && cur.tools > (cur.summaryTools ?? 0)) {
        $.clock.after(0, () => void summarizeAgent?.(e.agentId!, false))
      }
    }

    const ran = await next(e)
    touchTranscript(e.agentId ?? 'main')
    // an open detail pane lists calls from the transcript: a finished call is its one cue to redraw
    if (await read($, detailAtom)) {
      const now = await $.clock.now()
      await update($, detailAtom, d => (d ? { ...d, at: now } : d))
    }
    return ran
  })

  // A subagent shows the moment it starts, foreground or background, before any tool call or tick.
  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.agentId !== undefined) {
      const now = await $.clock.now()
      tracked.set(ran.agentId, {
        id: ran.agentId, type: e.subagentType, description: e.description, status: 'running',
        lastTool: '', activity: '시작', tools: 0, startedAt: now, model: ran.model, toolUseId: e.tool_use_id,
      })
      await publish?.()
      // its task in Korean right away
      const id = ran.agentId
      $.clock.after(0, () => void summarizeAgent?.(id, false))
    }
    return ran
  })

  // Only the main loop raises turn.start (a subagent's run raises none): each opens a card.
  on('turn.start', async ($, e, next) => {
    await update($, phase, () => 'running' as const)
    // a turn a notice or another session's message started (its text is a <tag>) adds to the card before it
    if (String((e as { text?: unknown }).text ?? '').trimStart().startsWith('<')) return next(e)
    const [ask, m, now] = await Promise.all([read($, prompt), read($, meter), $.clock.now()])
    // ponytail: a card whose turn.complete never came (a reload mid-turn) ends where the next begins
    await update($, historyAtom, cards =>
      [
        ...cards.map(c => (c.endedAt === undefined ? { ...c, endedAt: now } : c)),
        { n: (cards.at(-1)?.n ?? 0) + 1, startedAt: now, ...(m ? { model: m.model, effort: m.effort } : {}), ask: ask ?? '', agents: [], sessions: [] },
      ].slice(-HISTORY_MAX))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    touchTranscript(e.agentId ?? 'main')
    if (e.agentId === undefined) {
      await update($, phase, () => (e.reason === 'answer' ? 'done' : 'stopped') as Phase)
      const end = await $.clock.now()
      // an aborted or failed turn gets no session line: its card says so
      await update($, historyAtom, cards => {
        const last = cards.at(-1)
        return last && last.endedAt === undefined
          ? [...cards.slice(0, -1), { ...last, endedAt: end, ...(e.reason === 'answer' || last.result ? {} : { result: '중지됨' }) }]
          : cards
      })
      // a response came back, so the usage figures are current even when none moved
      const now = await $.clock.now()
      await update($, meter, m => (m ? { ...m, measuredAt: now, isStale: false } : m))
    } else {
      const t = tracked.get(e.agentId)
      if (t) {
        const now = await $.clock.now()
        tracked.set(e.agentId, { ...t, status: e.reason === 'answer' ? 'completed' : 'failed', endedAt: t.endedAt ?? now, activity: '' })
        await publish?.()
        const id = e.agentId
        const answer = e.answer
        if (t.tools > 0) $.clock.after(0, () => void summarizeAgent?.(id, true, answer))
        // The last background agent finished after the main turn: summarize again so the line catches up.
        const idle = (await read($, phase)) !== 'running'
        const stillLive = [...tracked.values()].some(x => LIVE.has(x.status))
        if (idle && !stillLive) {
          const answer = e.answer
          $.clock.after(0, () => void refresh?.(answer))
        }
      }
    }
    if (e.agentId === undefined && e.reason === 'answer') {
      turns += 1
      const answer = e.answer
      // ponytail: after(0) lifts the fork out of this dispatch so the turn ends at once
      $.clock.after(0, () => void refresh?.(answer))
    }

    return ran
  })

  // One hook for the band and the pane: the drawing is the same, only its room differs.
  on('ui.render', async ($, e, next) => {
    // The desktop footer's mode labels: usage drawn there in color, no plugin name in front.
    if (e.component === 'SessionMode' && e.surface === 'desktop') {
      hasFooter = true
      const [m, now] = await Promise.all([read($, meter), $.clock.now()])
      if (!m) return next(e)
      const { Box, Text } = $.ui.resolve(e)
      // Fit the footer: every reset, then today's only, then percentages only.
      // ponytail: the footer's room is guessed from the window width less what the app draws beside it
      const columns = e.viewport?.columns ?? 100
      const room = Math.min(columns - FOOTER_RESERVED, FOOTER_SLOT)
      const parts = fitUsage(usageParts(m, now), room)
      const tier = parts.filter(p => p.reset).length
      lastDraw['footer'] = `cols=${columns} room=${room} resets=${tier}`
      // No hover card here: the desktop counts a hidden card into the slot's width and cuts the figures.
      return (
        <Box key="usage" flexDirection="row" columnGap={1}>
          {parts.map((part, i) => (
            <Text key={part.label}>
              {i > 0 && <Text dimColor>· </Text>}
              <Text dimColor>{part.label} </Text>
              <Text {...pctLook(m, part.percent, now)}>{Math.round(part.percent)}%</Text>
              {part.reset && <Text dimColor>({part.reset})</Text>}
            </Text>
          ))}
          {e.props.modes.length > 0 && <Text dimColor>· {e.props.modes.join(' & ')}</Text>}
        </Box>
      )
    }
    if (e.component === 'Pane' && e.requestId === DETAIL) {
      const [raw, ags, m, hidden, sess, hiddenSess, hist, tab, showOlder, now] = await Promise.all([
        read($, detailAtom), read($, agents), read($, meter), read($, hiddenAtom), read($, sessionsAtom), read($, hiddenSessionsAtom),
        read($, historyAtom), read($, detailTabAtom), read($, showOlderTurnsAtom), $.clock.now(),
      ])
      const d = detailView(raw)
      if (!d) return next(e)
      const { Box, Text, Button } = $.ui.resolve(e)
      const width = e.props.bodyColumns
      const bodyRows = e.props.scroll.bodyRows
      // ponytail: the desktop sets text in a proportional font where Hangul takes about 1.3 cells, not 2; cut by that there
      const fit = (n: number) => (e.surface === 'desktop' ? Math.floor(n * 1.3) : n)
      const show = (kind: DetailView['kind'], id: string | null) => update($, detailAtom, () => ({ kind, id, at: now }))
      // back to the main view, on the tab it was left on
      const back = (
        <Box key="back" flexDirection="row">
          <Button key="back" plain dimColor label="← 메인 세션" onPress={() => show('main', null)} />
        </Box>
      )

      // A session's view: its state and the messages both ways, newest at the bottom.
      if (d.kind === 'session') {
        const s = sess.find(x => x.name === d.id)
        const look = SESSION_LOOK[s?.state ?? 'unknown']
        const log = (s?.log ?? []).slice(-Math.max(1, bodyRows - 6))
        lastDraw['detail-draw'] = `session ${d.id} log=${log.length} at=${now}`
        return (
          <Box flexDirection="column" rowGap={1} width={width}>
            <Box key="head" flexDirection="row" columnGap={1} width={width}>
              <Box flexShrink={0}><Text color={look.color} dimColor={look.dim}>{look.dot}</Text></Box>
              <Text wrap="truncate-end" bold>{clipCells(s?.title || d.id || '', fit(Math.max(4, width - 2 - STATE_CELLS - 2)))}</Text>
              <Box flexShrink={0}><Text color={look.color} dimColor={look.dim}>{look.word}</Text></Box>
            </Box>
            {back}
            <Box key="log" flexDirection="column" width={width}>
              <Text dimColor>주고받은 메시지</Text>
              {log.length === 0 && <Text dimColor>아직 메시지가 없음</Text>}
              {log.map((x, i) => (
                <Text key={`log-${i}`} wrap="truncate-end" dimColor={x.dir === 'out'}>
                  {clipCells(`${x.dir === 'out' ? '↑' : '↓'} ${hhmm(x.at)} ${x.text}`, fit(width - 1))}
                </Text>
              ))}
            </Box>
          </Box>
        )
      }

      const agentId = d.kind === 'agent' ? d.id : null
      // an agent whose row was closed or dropped still opens from its turn card, drawn from the snapshot
      const snap = agentId === null ? undefined : hist.flatMap(c => c.agents).find(x => x.id === agentId)
      const a: Pick<AgentRow, 'type' | 'status' | 'description' | 'summary' | 'model' | 'effort'> | undefined =
        agentId === null ? undefined : (ags.find(x => x.id === agentId) ?? (snap && { ...snap, description: snap.summary }))
      const key = agentId ?? 'main'
      const v = transcriptV.get(key) ?? 0
      let msgs = transcriptCache.get(key)?.v === v ? transcriptCache.get(key)!.msgs : undefined
      if (!msgs) {
        const got = await (agentId === null ? $.session.messages() : $.session.messages({ agentId })).catch(() => [])
        // ponytail: the newest 400 rows cover what the tabs show; a deeper history would need paging
        msgs = (Array.isArray(got) ? got : []).slice(-400)
        transcriptCache.set(key, { v, msgs })
      }
      const look = LOOK[a ? agentPhase(a.status) : agentId === null ? await read($, phase) : 'idle']
      const said = [...msgs].reverse().find(x => x.role === 'assistant' && x.text.trim())?.text
      const uses = msgs.flatMap(x => x.toolUses)
      const tag = a ? modelTag(a.model, a.effort) : m ? modelTag(m.model, m.effort) : ''
      const callDot = (u: { isError?: true; result?: unknown; text?: string }) =>
        u.isError ? { dot: '✗', color: 'error' } : u.result === undefined && u.text === undefined ? { dot: '●', color: 'warning' } : { dot: '✓', color: 'success' }
      // the newest calls that fit
      const calls = (room: number) => (
        <Box key="calls" flexDirection="column" width={width}>
          {uses.length === 0 && <Text dimColor>아직 도구 호출이 없음</Text>}
          {uses.slice(-room).map(u => (
            <Box key={u.tool_use_id} flexDirection="row" columnGap={1} width={width}>
              <Box flexShrink={0}><Text color={callDot(u).color}>{callDot(u).dot}</Text></Box>
              <Text wrap="truncate-end">{clipCells(describeCall(u.tool, u.input), fit(width - 3))}</Text>
            </Box>
          ))}
        </Box>
      )
      const head = (
        <Box key="head" flexDirection="row" justifyContent="space-between" width={width}>
          <Box flexDirection="row" columnGap={1} flexShrink={1} minWidth={0}>
            <Box flexShrink={0}><Text color={look.color}>{look.dot} {look.word}</Text></Box>
            <Text wrap="truncate-end" bold>{a ? clipCells(`${a.type}  ${a.summary || a.description}`, fit(Math.max(4, width - 20))) : '메인 세션'}</Text>
          </Box>
          <Box flexShrink={0}><Text dimColor>{tag}</Text></Box>
        </Box>
      )
      const last = said && <Text key="said" wrap="truncate-end" dimColor>{clipCells(`“${oneLine(said)}”`, fit(width - 1))}</Text>

      if (agentId !== null) {
        lastDraw['detail-draw'] = `${agentId} msgs=${msgs.length} uses=${uses.length} at=${now}`
        return (
          <Box flexDirection="column" rowGap={1} width={width}>
            {head}
            {back}
            {calls(Math.max(3, bodyRows - 5))}
            {last}
          </Box>
        )
      }

      // The main view: three tabs, the turn history first. A desktop Button is native: the active one is marked in its label.
      const tabs: [DetailTab, string][] = [['history', '히스토리'], ['calls', `도구 호출 ${uses.length}`], ['live', '현재']]
      const labels = tabs.map(([k, l]) => (k === tab ? `● ${l}` : l))
      const isTight = labels.reduce((n, l) => n + cells(l), 0) > fit(width - 2)
      const tabRow = (
        <Box key="tabs" flexDirection="row" columnGap={1} width={width}>
          {tabs.map(([k], i) => (
            <Button
              key={`tab-${k}`}
              plain
              dimColor={k !== tab}
              label={isTight ? clipCells(labels[i]!, fit(Math.max(4, Math.floor((width - 2) / 3)))) : labels[i]!}
              onPress={() => update($, detailTabAtom, () => k)}
            />
          ))}
        </Box>
      )
      lastDraw['detail-draw'] = `main ${tab} msgs=${msgs.length} uses=${uses.length} cards=${hist.length} at=${now}`

      if (tab === 'calls') {
        return (
          <Box flexDirection="column" rowGap={1} width={width}>
            {tabRow}
            {calls(Math.max(3, bodyRows - 2))}
          </Box>
        )
      }

      if (tab === 'history') {
        // Newest last, as many as fit under the tabs and the fold line; the rest behind a press, the pane scrolling.
        const cardRows = (c: TurnCard) => 3 + c.agents.length + c.sessions.length
        let fits = 0
        for (let i = hist.length - 1, used = 0; i >= 0; i--) {
          used += cardRows(hist[i]!)
          if (fits > 0 && used > bodyRows - 3) break
          fits += 1
        }
        const older = hist.length - fits
        const shown = showOlder ? hist : hist.slice(older)
        const card = (c: TurnCard) => {
          const isLive = c.endedAt === undefined
          const top = [`─ 턴 ${c.n}`, hhmm(c.startedAt), durText((c.endedAt ?? now) - c.startedAt), modelTag(c.model, c.effort)].filter(Boolean).join(' · ')
          return (
            <Box key={`card-${c.n}`} flexDirection="column" width={width}>
              <Text key="top" wrap="truncate-end" bold={isLive} dimColor={!isLive}>{clipCells(top, fit(width - 1))}</Text>
              <Box key="ask" flexDirection="row" width={width}>
                <Text dimColor>{'  요청  '}</Text>
                <Text wrap="truncate-end">{clipCells(c.ask || '—', fit(Math.max(4, width - 9)))}</Text>
              </Box>
              <Box key="result" flexDirection="row" width={width}>
                <Text dimColor>{'  결과  '}</Text>
                <Text wrap="truncate-end">{clipCells(isLive ? '…' : (c.result ?? '…'), fit(Math.max(4, width - 9)))}</Text>
              </Box>
              {c.agents.map(x => {
                const s = LOOK[agentPhase(x.status)]
                const took = elapsedText(x, now)
                return (
                  <Box key={`h-a-${x.id}`} flexDirection="row" width={width}>
                    <Box flexShrink={0}><Text dimColor>{'    ⎿ '}</Text></Box>
                    <Box flexShrink={0}><Text color={s.color}>{`${s.dot} `}</Text></Box>
                    <Box flexShrink={1} minWidth={0} overflow="hidden">
                      <Button
                        key={`h-agent-${x.id}`}
                        plain
                        dimColor={s.isDone}
                        label={clipCells(`${x.type}  ${x.summary}`, fit(Math.max(4, width - 8 - 2 - cells(took) - 1)))}
                        onPress={() => show('agent', x.id)}
                      />
                    </Box>
                    <Box flexShrink={0}><Text dimColor>{`  ${took}`}</Text></Box>
                  </Box>
                )
              })}
              {c.sessions.map(x => {
                const s = SESSION_LOOK[x.state]
                const text = [x.title || x.name, x.lastOut && `↑${x.lastOut}`, x.lastIn && `↓${x.lastIn}`].filter(Boolean).join('  ')
                return (
                  <Box key={`h-s-${c.n}-${x.name}`} flexDirection="row" width={width}>
                    <Box flexShrink={0}><Text dimColor>{'    ↔ '}</Text></Box>
                    <Box flexShrink={0}><Text color={s.color} dimColor={s.dim}>{`${s.dot} `}</Text></Box>
                    <Box flexShrink={1} minWidth={0} overflow="hidden">
                      <Button key={`h-sess-${c.n}-${x.name}`} plain label={clipCells(text, fit(Math.max(4, width - 9)))} onPress={() => show('session', x.name)} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )
        }
        return (
          <Box flexDirection="column" rowGap={1} width={width}>
            {tabRow}
            <Box key="history" flexDirection="column" width={width}>
              {hist.length === 0 && <Text dimColor>아직 기록된 턴이 없음</Text>}
              {older > 0 && (
                <Button
                  key="older"
                  plain
                  dimColor
                  label={clipCells(`${showOlder ? '▾' : '▸'} 이전 턴 ${older}개`, fit(width - 1))}
                  onPress={() => update($, showOlderTurnsAtom, v => !v)}
                />
              )}
              {shown.map(card)}
            </Box>
          </Box>
        )
      }

      // 현재: the main loop's state, its agents (an orchestrating session's work is mostly theirs), its sessions, its last words.
      const subs = ags.filter(x => !hidden.includes(x.id)).slice(0, MAX_AGENTS * 2)
      const peers = sess.filter(x => !hiddenSess.includes(x.name)).slice(0, MAX_AGENTS * 2)
      return (
        <Box flexDirection="column" rowGap={1} width={width}>
          {tabRow}
          {head}
          {subs.length === 0 && peers.length === 0 && <Text key="none" dimColor>서브에이전트·오케스트레이션 없음</Text>}
          {subs.length > 0 && (
            <Box key="subs" flexDirection="column" width={width}>
              <Text dimColor>{`서브에이전트 ${subs.length}`}</Text>
              {subs.map(x => {
                const s = LOOK[agentPhase(x.status)]
                const t = modelTag(x.model, x.effort)
                const meta = [elapsedText(x, now), t, x.tools > 0 && `도구 ${x.tools}`].filter(Boolean).join(' · ')
                return (
                  <Box key={`sub-${x.id}`} flexDirection="column" width={width}>
                    {/* a pane is narrow: the whole first line is the press target, details go below it */}
                    <Button key={`open-${x.id}`} plain onPress={() => show('agent', x.id)}>
                      <Text color={s.color}>{`${s.dot} `}</Text>
                      <Text color={s.isDone ? undefined : 'suggestion'} dimColor={s.isDone}>{`${x.type} `}</Text>
                      <Text dimColor={s.isDone}>{clipCells(x.summary || x.description, fit(Math.max(4, width - 3 - cells(x.type))))}</Text>
                    </Button>
                    <Box paddingLeft={2} width={width}>
                      <Text dimColor>{clipCells([meta, LIVE.has(x.status) && x.activity && `→ ${x.activity}`].filter(Boolean).join('  '), fit(width - 3))}</Text>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}
          {peers.length > 0 && (
            <Box key="peers" flexDirection="column" width={width}>
              <Text dimColor>{`오케스트레이션 ${peers.length}`}</Text>
              {peers.map(x => {
                const s = SESSION_LOOK[x.state]
                const lastMsg = lastOf(x)
                const meta = lastMsg ? `${lastMsg.arrow} ${ago(now - lastMsg.at)}` : ''
                const name = clipCells(x.title || x.name, 20)
                return (
                  <Box key={`peer-${x.name}`} flexDirection="row" justifyContent="space-between" width={width}>
                    <Box flexDirection="row" columnGap={1} flexShrink={1} minWidth={0}>
                      <Box flexShrink={0}><Text color={s.color} dimColor={s.dim}>{s.dot}</Text></Box>
                      <Box flexShrink={0}><Text color="suggestion">{name}</Text></Box>
                      <Box flexShrink={1} minWidth={0} overflow="hidden">
                        <Button key={`open-s-${x.name}`} plain onPress={() => show('session', x.name)}>
                          <Text wrap="truncate-end">
                            {clipCells(x.summary || lastMsg?.text || '', fit(Math.max(4, width - 4 - cells(name) - cells(meta) - 4)))}
                          </Text>
                        </Button>
                      </Box>
                    </Box>
                    <Box flexShrink={0}><Text dimColor>{meta}</Text></Box>
                  </Box>
                )
              })}
            </Box>
          )}
          {last}
        </Box>
      )
    }

    const room =
      e.component === 'AbovePrompt' && !e.props.hasSurvey
        ? { width: e.props.bodyColumns, rows: e.props.maxRows, isWorking: e.props.isWorking }
        : e.component === 'Pane' && e.requestId === PANE
          ? { width: e.props.bodyColumns, rows: e.props.scroll.bodyRows, isWorking: false }
          : null
    if (!room) return next(e)

    const isPane = e.component === 'Pane'
    const [sum, typed, turnPhase, m, ags, now, showAgentsRaw, hidden, stopArmed, sess, showSessionsRaw, hiddenSess, branch] = await Promise.all([
      read($, beatAtom).then(() => read($, summary)),
      read($, prompt),
      read($, phase),
      read($, meter),
      read($, agents),
      $.clock.now(),
      read($, showAgentsAtom),
      read($, hiddenAtom),
      read($, stopArmedAtom),
      read($, sessionsAtom),
      read($, showSessionsAtom),
      read($, hiddenSessionsAtom),
      read($, branchAtom),
    ])
    // the pane has the room: everything unfolded
    const showAgents = showAgentsRaw || isPane
    const showSessions = showSessionsRaw || isPane
    if (!m && !sum && !typed) return next(e)

    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // a surface module's region, where the surface has one (terminal, desktop)
    const Client = 'Client' in els ? els.Client : undefined
    // The terminal draws chat and band in one stream: the band gets its own card so it reads apart.
    // Too few rows for the card (its borders, the gap and the usage line take 4): plain rows, no usage,
    // or the surface cuts the card to its top edge while its own agent list is up.
    const isTight = e.surface === 'terminal' && room.rows < 7
    const isCard = e.surface === 'terminal' && !isPane && !isTight
    const width = room.width - (isCard ? 4 : 0)
    const isNarrow = width < 60
    // Narrower than this, a state is its colored dot alone: the word goes first.
    const isCompact = width < 90
    // ponytail: the desktop sets text in a proportional font where Hangul takes about 1.3 cells, not 2;
    // cutting by terminal cells left half the row empty there. Retune the factor if rows start to crowd.
    const fit = (n: number) => (e.surface === 'desktop' ? Math.floor(n * 1.3) : n)

    // A background subagent still working keeps the session 진행 중 after the main turn ends.
    const anyLive = ags.some(a => LIVE.has(a.status))
    const state = LOOK[room.isWorking || anyLive ? 'running' : turnPhase]
    const headline = (sum && oneLine(sum.text)) || typed || '첫 턴을 기다리는 중'

    // One agent shows as its row; two or more fold into one line with their counts, unfolded on a press.
    // Closed ones are gone. Live rows first, then the ones that ended (완료 or 중지), newest first.
    const shownAgs = ags.filter(a => !hidden.includes(a.id))
    const isEnded = (a: AgentRow) => LOOK[agentPhase(a.status)].isDone || agentPhase(a.status) === 'stopped'
    const live = shownAgs.filter(a => !isEnded(a))
    const ended = shownAgs.filter(isEnded)
    const isGrouped = shownAgs.length >= 2
    const isFolded = isGrouped && !showAgents
    // Rows the band may take: the session line, the usage block outside the desktop, the fold line; the rest is the agents'.
    // An agent's first line comes first, and one always shows; step lines only when every live row gets one.
    // (Halving the budget per agent made a lone agent blink whenever the surface gave a row more or less.)
    // Sessions are always one group: its fold line costs a row; unfolded, its rows take what the agents leave.
    const peers = sess.filter(s => !hiddenSess.includes(s.name))
    const budget = Math.max(0, room.rows - 1 - (m && e.surface !== 'desktop' && !isTight ? 4 : 0) - (isGrouped ? 1 : 0) - (peers.length > 0 ? 1 : 0))
    const rows = isFolded ? [] : [...live, ...ended].slice(0, Math.max(1, Math.min(MAX_AGENTS * 2, budget)))
    const liveShown = rows.filter(a => !isEnded(a))
    const withSteps = budget >= rows.length + liveShown.length
    const peerRows = showSessions ? peers.slice(0, Math.max(1, Math.min(MAX_AGENTS * 2, budget - rows.length - (withSteps ? liveShown.length : 0)))) : []
    // the fold line's counts, each in its state's color
    const doneCount = ended.filter(a => LOOK[agentPhase(a.status)].isDone).length
    const counts = [
      { n: live.length, word: '진행 중', color: LOOK.running.color },
      { n: doneCount, word: '완료', color: LOOK.done.color },
      { n: ended.length - doneCount, word: '중지', color: LOOK.stopped.color },
    ].filter(c => c.n > 0)
    lastDraw[`${e.surface} ${e.component}`] = `rows=${room.rows} cols=${width} rows=${rows.length} live=${live.length} ended=${ended.length} at=${new Date(now).toTimeString().slice(0, 8)}`

    // A row is a label cell that shrinks and a status cell that never does: two elements, no drawn divider.
    const row = (key: string, label: JSX.Element, status: JSX.Element) => (
      <Box key={key} flexDirection="row" justifyContent="space-between" columnGap={2} width={width}>
        <Box flexDirection="row" flexGrow={1} flexShrink={1} minWidth={8}>{label}</Box>
        <Box flexShrink={0}>{status}</Box>
      </Box>
    )

    // A press on a row opens the detail pane on it: its recent calls, live, on any surface.
    const openDetail = async (kind: DetailView['kind'], id: string | null, title: string) => {
      await update($, detailAtom, () => ({ kind, id, at: now }))
      const opened = await $.ui.open({ id: DETAIL, title, rows: 12 })
      lastDraw['detail'] = `${id ?? 'main'} ${opened.isPlaced ? 'open' : opened.reason}`
    }

    // A live agent stops on a second press within STOP_ARM_MS (the engine's TaskStop, as the model would call it);
    // a finished one closes off the band with ✕.
    const stopAgent = async (id: string) => {
      if (stopArmed !== id) {
        await update($, stopArmedAtom, () => id)
        $.clock.after(STOP_ARM_MS, () => void update($, stopArmedAtom, v => (v === id ? null : v)))
        return
      }
      await update($, stopArmedAtom, () => null)
      const r = await $.tool.call({ tool: 'TaskStop', task_id: id } as never).catch((err: unknown) => ({ isError: true, text: String(err) }))
      const failed = 'deny' in r || ('isError' in r && r.isError)
      const why = ('deny' in r ? r.deny : 'text' in r ? String(r.text) : '') ?? ''
      lastDraw['stop'] = `${id} ${failed ? `failed: ${why}` : 'ok'}`
      $.ui.toast(failed ? `서브에이전트를 종료하지 못함: ${clipCells(oneLine(why), 60)}` : '서브에이전트 종료함')
    }

    // A stopped agent picks up again on a message, as the model would send one (SendMessage to its id).
    const resumeAgent = async (id: string) => {
      const r = await $.tool
        .call({ tool: 'SendMessage', to: id, summary: '현황판에서 재개', message: '중단된 지점부터 이어서 작업을 계속해줘.' } as never)
        .catch((err: unknown) => ({ isError: true, text: String(err) }))
      const failed = 'deny' in r || ('isError' in r && r.isError)
      const why = ('deny' in r ? r.deny : 'text' in r ? String(r.text) : '') ?? ''
      lastDraw['resume'] = `${id} ${failed ? `failed: ${why}` : 'ok'}`
      if (!failed) {
        // running again from now; the next tick takes the engine's word for it
        const t = tracked.get(id)
        if (t) {
          t.status = 'running'
          t.endedAt = undefined
        }
        await publish?.()
      }
      $.ui.toast(failed ? `재개하지 못함: ${clipCells(oneLine(why), 60)}` : '서브에이전트 재개함')
    }

    // Another session picks up again on a message, one press: the model's own SendMessage to its name.
    const resumeSession = async (name: string) => {
      const r = await $.tool
        .call({ tool: 'SendMessage', to: name, summary: '현황판에서 이어서', message: '이어서 진행해줘' } as never)
        .catch((err: unknown) => ({ isError: true, text: String(err) }))
      const failed = 'deny' in r || ('isError' in r && r.isError)
      const why = ('deny' in r ? r.deny : 'text' in r ? String(r.text) : '') ?? ''
      lastDraw['resume-session'] = `${name} ${failed ? `failed: ${why}` : 'ok'}`
      if (!failed) await recordSession?.(name, 'out', '이어서 진행해줘')
      $.ui.toast(failed ? `보내지 못함: ${clipCells(oneLine(why), 60)}` : `${clipCells(name, 30)}에 이어서 진행 요청함`)
    }

    // A session row: who and what on the left; its last message's direction and age, ↻ and ✕ on the right.
    const peerRow = (s: SessionRow) => {
      const look = SESSION_LOOK[s.state]
      const last = lastOf(s)
      const meta = last ? `${last.arrow} ${ago(now - last.at)}` : ''
      const name = clipCells(s.title || s.name, isNarrow ? 12 : 24)
      const text = clipCells(s.summary || last?.text || '', fit(Math.max(4, width - 4 - 2 - cells(name) - 1 - cells(meta) - 2 - 4 - 4)))
      return row(
        `peer-${s.name}`,
        <Box flexDirection="row" columnGap={1} flexShrink={1} minWidth={0}>
          <Box flexShrink={0}><Text dimColor>  ⎿</Text></Box>
          <Box flexShrink={0}><Text color={look.color} dimColor={look.dim}>{look.dot}</Text></Box>
          <Box flexShrink={0}><Text color="suggestion">{name}</Text></Box>
          <Box flexShrink={1} minWidth={0} overflow="hidden">
            <Button key={`go-s-${s.name}`} plain onPress={() => openDetail('session', s.name, clipCells(`세션 · ${s.title || s.name}`, 40))}>
              <Text wrap="truncate-end">{text}</Text>
            </Button>
          </Box>
        </Box>,
        <Box flexDirection="row" columnGap={1}>
          {meta && <Text dimColor>{meta}</Text>}
          {s.state !== 'gone' && <Button key={`resume-s-${s.name}`} plain dimColor label="↻" onPress={() => resumeSession(s.name)} />}
          <Button key={`hide-s-${s.name}`} plain dimColor label="✕" onPress={() => update($, hiddenSessionsAtom, ids => [...ids, s.name])} />
        </Box>,
      )
    }
    const peerRunning = peers.filter(s => s.state === 'running').length
    const peerGone = peers.filter(s => s.state === 'gone').length

    // The state cell before a label: its dot, and its word where there is room.
    const stateCells = isCompact ? 2 : 2 + STATE_CELLS + 1

    // An agent takes two lines: who and what on the first, its latest step below while it runs.
    // Labels are cut here, by cells, so a Button's label never wraps on any surface.
    const agentRows = (a: AgentRow) => {
      const s = LOOK[agentPhase(a.status)]
      const tag = !isNarrow && a.model ? modelTag(a.model, a.effort) : ''
      // a running clock ticks in its own Client region (mm:ss, 5 cells); an ended one is fixed text
      const isTicking = !isEnded(a) && !!Client
      const took = isTicking ? '00:00' : elapsedText(a, now)
      const room = width - 4 - stateCells - cells(a.type) - 1 - (tag ? cells(tag) + 2 : 0) - cells(took) - 2 - 4
      const label = clipCells(a.summary || a.description, fit(Math.max(4, room)))
      return [
        row(
          `agent-${a.id}`,
          <Box flexDirection="row" columnGap={1} flexShrink={1} minWidth={0}>
            <Box flexShrink={0}><Text dimColor>  ⎿</Text></Box>
            <Box flexShrink={0}><Text color={s.color}>{s.dot}</Text></Box>
            {!isCompact && <Box width={STATE_CELLS} flexShrink={0}><Text color={s.color}>{s.word}</Text></Box>}
            <Box flexShrink={0}><Text color={s.isDone ? undefined : 'suggestion'} dimColor={s.isDone}>{a.type}</Text></Box>
            <Box flexShrink={1} minWidth={0} overflow="hidden">
              <Button key={`go-${a.id}`} plain onPress={() => openDetail('agent', a.id, `${a.type} · ${a.description}`)}>
                <Text wrap="truncate-end" dimColor={s.isDone}>{label}</Text>
              </Button>
            </Box>
          </Box>,
          <Box flexDirection="row" columnGap={1}>
            {isTicking && Client ? (
              <Client key={`time-${a.id}`} module="./elapsed.tsx" props={{ startedAt: a.startedAt, now }} />
            ) : (
              <Text dimColor>{took}</Text>
            )}
            {tag && <Text dimColor>{tag}</Text>}
            {isEnded(a) ? (
              <Box flexDirection="row" columnGap={1}>
                {agentPhase(a.status) === 'stopped' && (
                  <Button key={`resume-${a.id}`} plain dimColor label="↻" onPress={() => resumeAgent(a.id)} />
                )}
                <Button key={`hide-${a.id}`} plain dimColor label="✕" onPress={() => update($, hiddenAtom, ids => [...ids, a.id])} />
              </Box>
            ) : (
              <Button key={`stop-${a.id}`} plain dimColor={stopArmed !== a.id} label={stopArmed === a.id ? '종료?' : '■'} onPress={() => stopAgent(a.id)} />
            )}
          </Box>,
        ),
        // Every unfinished agent keeps its step line, between calls too, so the band never jumps (room allowing).
        !isEnded(a) && withSteps && (
          <Box key={`step-${a.id}`} paddingLeft={isCompact ? 6 : 14} width={width}>
            <Text wrap="truncate-end" dimColor>{clipCells(`→ ${a.activity || '…'}`, Math.max(4, width - (isCompact ? 6 : 14) - 1))}</Text>
          </Box>
        ),
      ]
    }

    const sessionTag = [branch, m && turnPhase !== 'idle' ? modelTag(m.model, m.effort) : ''].filter(Boolean).join(' · ')
    const headLabel = clipCells(headline, fit(Math.max(4, width - stateCells - (sessionTag ? cells(sessionTag) + 2 : 0) - 3)))
    const activity = (
      <Box key="activity" flexDirection="column" width={width}>
        {row(
          'session',
          <Box flexDirection="row" columnGap={1} flexShrink={1} minWidth={0}>
            <Box flexShrink={0}><Text color={state.color}>{state.dot}</Text></Box>
            {!isCompact && <Box width={STATE_CELLS} flexShrink={0}><Text color={state.color}>{state.word}</Text></Box>}
            <Box flexShrink={1} minWidth={0} overflow="hidden">
              <Button key="go-session" plain onPress={() => openDetail('main', null, '세션 상세')}>
                <Text wrap="truncate-end" bold={!state.isDone} dimColor={state.isDone}>{headLabel}</Text>
              </Button>
            </Box>
          </Box>,
          <Box>{sessionTag && <Text dimColor>{sessionTag}</Text>}</Box>,
        )}
        {isGrouped && !isPane && (
          <Box key="agents-line" flexDirection="row" width={width}>
            <Text dimColor>  </Text>
            {/* a desktop draws a Button natively and drops its children's colors: the counts sit beside it */}
            <Button key="agents" plain label={`${showAgents ? '▾' : '▸'} 서브에이전트 ${shownAgs.length}`} onPress={() => update($, showAgentsAtom, v => !v)} />
            <Text> </Text>
            {counts.map((c, i) => (
              <Text key={c.word} color={c.color}>{`${i > 0 ? ' · ' : ' '}${c.word} ${c.n}`}</Text>
            ))}
          </Box>
        )}
        {rows.map(agentRows)}
        {peers.length > 0 && !isPane && (
          <Box key="sessions-line" flexDirection="row" width={width}>
            <Text dimColor>  </Text>
            <Button key="sessions" plain label={`${showSessions ? '▾' : '▸'} 오케스트레이션 ${peers.length}`} onPress={() => update($, showSessionsAtom, v => !v)} />
            <Text> </Text>
            {peerRunning > 0 && <Text color={SESSION_LOOK.running.color}>{` 진행 중 ${peerRunning}`}</Text>}
            {peers.length - peerRunning - peerGone > 0 && (
              <Text color={SESSION_LOOK.idle.color}>{`${peerRunning > 0 ? ' ·' : ''} 대기 ${peers.length - peerRunning - peerGone}`}</Text>
            )}
            {peerGone > 0 && <Text dimColor>{`${peers.length > peerGone ? ' ·' : ''} 종료 ${peerGone}`}</Text>}
          </Box>
        )}
        {peerRows.map(peerRow)}
      </Box>
    )

    // The fixed line: its own bordered block, model and effort first, then the short usage.
    const status = m && e.surface !== 'desktop' && !isTight && (() => {
      const head = `${prettyModel(m.model)}${m.effort ? ` ${m.effort}` : ''}`
      // its own border and padding take 4 cells outside the card, the model and its gap the rest
      const parts = fitUsage(usageParts(m, now), width - (isCard ? 0 : 4) - cells(head) - 3 - (m.isStale ? 12 : 0))
      return (
        <Box
          key="status"
          flexDirection="row"
          flexWrap="wrap"
          columnGap={1}
          {...(isCard ? {} : { borderStyle: 'round', borderDimColor: true, paddingX: 1 })}
          width={width}
        >
          <Box key="model" flexShrink={0}>
            <Text>
              <Text bold color={isFresh(m.flash?.model, now) ? 'suggestion' : undefined}>{prettyModel(m.model)}</Text>
              {m.effort && (isFresh(m.flash?.effort, now) ? <Text bold color="suggestion"> {m.effort}</Text> : <Text dimColor> {m.effort}</Text>)}
            </Text>
          </Box>
          {parts.map(part => (
            <Box key={part.label} flexShrink={0}>
              <Text>
                <Text dimColor>· {part.label} </Text>
                <Text {...pctLook(m, part.percent, now)}>{Math.round(part.percent)}%</Text>
                {part.reset && <Text dimColor>({part.reset})</Text>}
              </Text>
            </Box>
          ))}
          {m.isStale && (
            <Box key="age" flexShrink={0}>
              <Text dimColor>· {m.measuredAt === undefined ? '이전 값' : `${resetAt(new Date(m.measuredAt).toISOString(), now)} 기준`}</Text>
            </Box>
          )}
        </Box>
      )
    })()

    return (
      <Box
        key="band"
        flexDirection="column"
        rowGap={1}
        {...(isCard ? { borderStyle: 'round', borderColor: 'claude', borderDimColor: true, paddingX: 1 } : {})}
        width={room.width}
      >
        {activity}
        {status}
      </Box>
    )
  })
}
