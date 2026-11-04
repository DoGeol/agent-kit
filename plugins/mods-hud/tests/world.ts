// The world every hud test runs in: the engine's answers to what the mod asks, and helpers to read what it drew.
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

export const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
export const NOW = new Date(2026, 9, 11, 12, 0).getTime()

export const BAND = {
  hasSurvey: false,
  isWorking: true,
  maxRows: 16,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
} as const

export type World = { looks?: number; failUsage?: true; failList?: boolean; usage?: typeof USAGE; agentText?: string; completes?: string[]; perModel?: Record<string, { effortLevel: string }>; five?: number; statuses?: (string | undefined)[]; model?: string; effort?: string; forkText?: string; list: { id: string; type: string; description: string; status: 'running' | 'completed' | 'idle' }[]; forks: string[] }

export const world = (on: On, w: World) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.model', () => {
    w.looks = (w.looks ?? 0) + 1
    return { value: w.model ?? 'claude-opus-5-5' }
  })
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('ui.status', (_, e) => {
    w.statuses?.push(e.text)
    return { value: undefined }
  })
  on('classic.PostModelSwitch', () => ({}))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('settings.read', () => ({ value: { effortLevel: 'max', modelSettings: w.perModel ?? { [w.model ?? 'claude-opus-5-5']: { effortLevel: w.effort ?? 'high' } } } }))
  on('session.usage', () => {
    if (w.failUsage) throw new Error('usage not ready')
    return { value: {
      startedAt: NOW,
      context: { window: 200000, percent: 18 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: w.five ?? 63, resetsAt: new Date(2026, 9, 11, 15, 30).toISOString() },
        { kind: 'seven_day', percentUsed: 77, resetsAt: new Date(2026, 9, 14, 12, 0).toISOString() },
      ],
    } }
  })
  on('agent.list', () => {
    if (w.failList) throw new Error('busy')
    return { value: w.list }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('model.complete', (_, e) => {
    // the session line and the agents' lines both come from Haiku; the session's ask names its 현재 상황
    if (String(e.prompt).startsWith('아래 정보로 이 세션에서')) {
      w.forks.push(String(e.prompt))
      return { value: { isAnswered: true, text: w.forkText ?? '- **"모니터 band 레이아웃 정리 중"**\n', usage: w.usage ?? USAGE } }
    }
    w.completes?.push(String(e.prompt))
    return { value: { isAnswered: true, text: w.agentText ?? '파일 세는 중', usage: USAGE } }
  })
}

// Orchestration: other sessions this one messages.
export const send = ($: Engine, to: string, message: string, agentId?: string) =>
  $.tool.call({ tool: 'SendMessage', tool_use_id: `s-${to}`, to, message, ...(agentId ? { agentId } : {}) } as never)
export const peerMsg = (from: string, body: string) => `<agent-message from="${from}">${body}</agent-message>`

export type Mounted = Awaited<ReturnType<Engine['ui']['mount']>>
// Lines drawn in feed regions (hooks/feed.tsx): their props, since a Client's own tree is the surface's
export const feedOf = async (ui: Mounted) =>
  (await ui.findAll({ type: 'Client' }))
    .filter(c => c.props.module === 'hooks/feed.tsx')
    .flatMap(c => (c.props.props as { lines: { mark?: string; color?: string; text: string }[] }).lines)
// Every text drawn, feed lines included
export const texts = async (ui: Mounted) => [...(await ui.findAll({ type: 'Text' })).map(t => t.text), ...(await feedOf(ui)).map(l => l.text)]
