/** One active project, from `kit.sh board`. */
export type ProjectRow = {
  id: string
  /** shared, personal, or - when its state folder is missing */
  mode: string
  /** Tasks not done yet (assigned, accepted, in-progress, in-review, needs-review, blocked). */
  open: number
  lastPulled: string
  observedAt: string
  next: string
}

/** Something a person has to act on. */
export type Item = {
  kind: 'blocked' | 'pending' | 'handoff' | 'review'
  /** projectId, or portfolio for a Portfolio task */
  project: string
  /** task, report or PORT id */
  id: string
  text: string
}

export type WorkerRow = {
  project: string
  task: string
  run: string
  state: string
  model: string
  terminal: string
}

export type Board = {
  /** When it last changed, epoch ms (an unchanged read keeps it). */
  at: number
  projects: ProjectRow[]
  items: Item[]
  workers: WorkerRow[]
  /** Why workers could not be read (no orca, no jq, no answer); absent when they were. */
  workersUnknown?: string
  errors: string[]
  /** This session's own projectId, listed first. */
  mine?: string
  /** This session is an Orca worker: the band stays quiet. */
  isWorker: boolean
  hub: string
}

/** Where the hub search stands. */
export type Discovery = {
  /** searching until the first look ends; not-kit: no project here and no hubPath; no-hub: a project whose hub is unknown; found */
  state: 'searching' | 'not-kit' | 'no-hub' | 'found'
  /** This session's own projectId, when it is a project. */
  mine?: string
}

declare module 'claude-code' {
  interface PluginState {
    'orchestration-kit': {
      /** The latest board, or null before the first read or after a failed one. */
      board: Board | null
      /** Where the hub search stands; looked again at turn end and pane open until found. */
      discovery: Discovery
    }
  }
}
