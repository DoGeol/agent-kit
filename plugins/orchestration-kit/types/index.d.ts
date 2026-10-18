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
  /** The Portfolio task the project task came from; absent when none or when kit.sh is too old to say. */
  port?: string
  /** Title of the linked project task. */
  title?: string
  /** `live` or `unverifiable:<reason>` as Orca says it; absent when kit.sh is too old to say. */
  liveness?: string
  /** When Orca last saw the Worker work, epoch ms. */
  observedAt?: number
  /** Orca's activity word: working, blocked, waiting, done, unknown. */
  activity?: string
  /** Orca's attention categories (input: waiting for an answer; approval: waiting for a person). */
  attention?: string[]
}

export type Board = {
  /** When the data last changed, epoch ms (an unchanged read keeps it; Orca seeing a Worker again is no change). */
  changedAt: number
  /** When the last check ended, epoch ms, whether or not it worked. */
  checkedAt: number
  /** When a check last worked; null if none has. */
  okAt: number | null
  /** Why the last check failed; absent when it worked. The data is then the last good one. */
  failed?: string
  projects: ProjectRow[]
  items: Item[]
  workers: WorkerRow[]
  /** Why workers could not be read (no orca, no jq, no answer); absent when they were. */
  workersUnknown?: string
  /** Why only some Runs could be read (one failed, or more rows than a page); absent when all were. */
  workersPartial?: string
  errors: string[]
  /** This session's own projectId, listed first. */
  mine?: string
  /** This session is an Orca worker: the band stays quiet. */
  isWorker: boolean
  hub: string
}

/** One piece of work (a Portfolio or project task) with the Workers on it. */
export type WorkItem = {
  /** projectId, or - when the Worker's folder is no project */
  project: string
  /** The Portfolio task, else the project task; empty when the Worker is not linked to any */
  key: string
  label: string
  title: string
  dot: Dot
  workers: number
  providers: string[]
  /** The latest sighting among its Workers. */
  observedAt?: number
  /** Workers silent for too long, whatever the task's own colour. */
  stalledWorkers: number
  /** Why the colour is unknown. */
  reason?: string
  runs: string[]
}

/** green: seen within 5 minutes; yellow: 5-15; red: longer; gray: waiting for an answer (ask); input: waiting for a person; unknown: no sighting. */
export type Dot = 'green' | 'yellow' | 'red' | 'gray' | 'input' | 'unknown'

/** The latest `kit.sh audit`, read once the pane has been opened. */
export type Audit = {
  at: number
  /** Runs with unfinished tasks whose Coordinator terminal is gone. */
  gone: { project: string; run: string; createdAt: string; status: string }[]
  drift: { project: string; kind: string; count: number }[]
  /** Why it could not be read. */
  error?: string
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
      /** The latest audit, or null before the first one (it starts when the pane is first opened). */
      audit: Audit | null
    }
  }
}
