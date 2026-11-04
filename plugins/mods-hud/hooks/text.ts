// Strings in and out: widths and cuts per surface, times and durations, the lines the model hands back,
// what a tool call is doing, and the branch label.
import type { Phase } from '../types'

export const two = (n: number) => String(n).padStart(2, '0')

// An engine status (pending, running, completed, failed, killed, idle) as one of the four phases the monitor speaks.
export const agentPhase = (status: string): Phase =>
  status === 'pending' || status === 'running'
    ? 'running'
    : status === 'completed'
      ? 'done'
      : status === 'failed' || status === 'killed'
        ? 'stopped'
        : 'idle'

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

export const untilText = (ms: number) => {
  const mins = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${d}일 ${h}시간` : h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

// The desktop sets text in a proportional font: a Hangul glyph takes about one and a half of its columns, a
// Latin one about one (issue 005). The terminal's cells are exact: wide scripts take two.
export const DESKTOP_WIDE = 1.5
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

// Cells a string takes: Hangul, CJK and other wide scripts take `wide` (two on a terminal), the rest one.
export const cells = (text: string, wide = 2) => [...text].reduce((n, ch) => n + (WIDE.test(ch) ? wide : 1), 0)

// Cut to n cells with …: every surface then draws one line, a Button's label included.
export const clipCells = (t: string, n: number, wide = 2) => {
  if (cells(t, wide) <= n) return t
  let out = ''
  for (const ch of t) {
    if (cells(out + ch, wide) > n - 1) break
    out += ch
  }
  return `${out}…`
}

export const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
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

export const shortTool = (tool: string) => tool.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '')

// "⎇ main" or "⎇ feat (워크트리)" from `git rev-parse --abbrev-ref HEAD --git-dir --git-common-dir`:
// a linked worktree has its own git dir apart from the common one. Empty outside a repository.
export const branchLabel = (out: string) => {
  const [head, gitDir, commonDir] = out.trim().split('\n')
  if (!head || !gitDir || !commonDir) return ''
  return `⎇ ${head}${gitDir !== commonDir ? ' (워크트리)' : ''}`
}

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

const hhmm = (at: number) => `${two(new Date(at).getHours())}:${two(new Date(at).getMinutes())}`

// "30초 전", "2분 전", "3시간 전", "1일 전"
export const ago = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`
}
