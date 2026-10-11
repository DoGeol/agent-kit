export type Phase = 'idle' | 'running' | 'done' | 'stopped'

export type Summary = { text: string; at: number; turns: number }

export type Limit = { kind: string; percent: number; resetsAt?: string }

export type Meter = {
  model: string
  effort?: string
  context?: number
  limits: Limit[]
  /** When this session last got a response, the only time usage figures arrive. */
  measuredAt?: number
  /** Usage not refreshed for a while: other sessions may have spent since. */
  isStale?: boolean
  /** When each figure last changed, to mark it for a moment. */
  flash?: { model?: number; effort?: number; usage?: number }
}

/** What this mod's own model requests cost: calls, input and output tokens, per kind. */
export type Spend = Record<'turn' | 'agent' | 'session', { calls: number; input: number; output: number }>

export type AgentRow = {
  id: string
  type: string
  description: string
  status: string
  lastTool: string
  activity: string
  tools: number
  startedAt: number
  endedAt?: number
  /** A Korean line on what it has done so far, or its result once it ended. */
  summary?: string
  summaryAt?: number
  /** Its tool count when that line was written, and how many lines it has had. */
  summaryTools?: number
  summaryCount?: number
  /** What its latest request ran on. */
  model?: string
  effort?: string
}

/** Another Claude session this one messages (SendMessage out, `<agent-message from>` in). */
export type SessionRow = {
  /** As SendMessage's `to` and ListAgents spell it. */
  name: string
  title?: string
  /** ListAgents' word for it; unknown until it answers, or when it fails. */
  /** gone: ListAgents answered without it (archived, closed, exited) */
  state: 'running' | 'idle' | 'unknown' | 'gone'
  lastSent?: { at: number; text: string }
  lastReceived?: { at: number; text: string }
  /** A Korean line on the latest received message. */
  summary?: string
}

declare module 'claude-code' {
  interface PluginState {
    'mods-hud': {
      summary: Summary | null
      prompt: string | null
      phase: Phase
      meter: Meter | null
      agents: AgentRow[]
      /** Two or more agents fold into one line with their counts until unfolded. */
      showAgents: boolean
      /** Finished agents the person closed off the band. */
      hidden: string[]
      /** The live agent whose stop button was pressed once and waits for the second press. */
      stopArmed: string | null
      /** Whether agents get Korean summaries (`/mods-hud agents on|off`). */
      agentSummaries: boolean
      spend: Spend
      /** Ticks while an agent runs, so its elapsed time redraws. */
      beat: number
      /** Other sessions this one coordinates with by message. */
      sessions: SessionRow[]
      /** The orchestration group, folded to one line until unfolded. */
      showSessions: boolean
      /** Session rows the person closed, by name. */
      hiddenSessions: string[]
      /** Agents that aged off the band, so a reload does not bring them back. */
      dropped: string[]
      /** The checkout's branch, marked when it is a linked worktree; "" outside a repository. */
      branch: string
    }
  }
}
