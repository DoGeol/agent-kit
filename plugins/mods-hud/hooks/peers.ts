// Other sessions this one messages: their names, ListAgents' answer about them, and how a row looks.
import type { SessionRow } from '../types'

// SendMessage may spell a listed name with its " [ref]".
export const sessionName = (to: string) => to.replace(/\s*\[[^\]]*\]$/, '').trim()

// Whether ListAgents' answer is one we can read (rows, or a listing text, even empty): then a session it lacks has ended.
// An answer of another shape says nothing about who is gone (issue 019).
export const hasListing = (r: unknown) => {
  const x = (r ?? {}) as { result?: { listing?: unknown; sections?: unknown }; text?: unknown }
  const res = typeof x.result === 'object' && x.result ? x.result : {}
  return Array.isArray(res.sections) || typeof res.listing === 'string' || typeof x.text === 'string'
}

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

// A session's newest message either way: its direction arrow and when.
export const lastOf = (s: SessionRow) => {
  const out = s.lastSent?.at ?? -1
  const inn = s.lastReceived?.at ?? -1
  return out >= inn ? (s.lastSent ? { arrow: '↑', ...s.lastSent } : undefined) : { arrow: '↓', ...s.lastReceived! }
}

// ◆ running, ◇ idle, ◇ dim when ListAgents never placed it; 대기 covers both of the last.
export const SESSION_LOOK: Record<SessionRow['state'], { dot: string; color?: string; dim: boolean; word: string }> = {
  running: { dot: '◆', color: 'warning', dim: false, word: '진행 중' },
  idle: { dot: '◇', color: 'subtle', dim: false, word: '대기' },
  unknown: { dot: '?', dim: true, word: '확인 중' },
  gone: { dot: '■', dim: true, word: '종료' },
}
