import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Board, Item } from '../types'

// One line above the prompt with what needs someone across the Portfolio, and a pane with the details.
// Read-only: every value comes from `kit.sh board`; nothing is written and no model is called.

const PANE = 'portfolio-board'
const POLL_MS = 30_000
const boardAtom = atom({ plugin: 'orchestration-kit', key: 'board' } as const, null as Board | null)

type Raw = Pick<Board, 'projects' | 'items' | 'workers' | 'workersUnknown' | 'errors'>
type Tone = 'error' | 'warning' | 'suggestion'

/** `kit.sh board` lines as a board. Unknown kinds are skipped, so a newer kit.sh does not break this mod. */
export const parseBoard = (tsv: string): Raw => {
  const out: Raw = { projects: [], items: [], workers: [], errors: [] }
  for (const line of tsv.split('\n')) {
    const a = line.split('\t')
    const k = a[0]
    if (k === 'project' && a.length >= 7) {
      out.projects.push({ id: a[1]!, mode: a[2]!, open: Number(a[3]) || 0, lastPulled: a[4]!, observedAt: a[5]!, next: a[6]! })
    } else if ((k === 'blocked' || k === 'handoff') && a.length >= 4) {
      out.items.push({ kind: k, project: a[1]!, id: a[2]!, text: a[3]! })
    } else if (k === 'review' && a.length >= 4) {
      out.items.push({ kind: 'review', project: a[1]!, id: a[2]!, text: a[4] && a[4] !== '-' ? `${a[3]} · ${a[4]}` : a[3]! })
    } else if (k === 'pending' && a.length >= 4) {
      out.items.push({ kind: 'pending', project: a[1]!, id: a[2]!, text: a[3]! })
    } else if (k === 'invalid' && a.length >= 4) {
      out.items.push({ kind: 'pending', project: a[1]!, id: a[2]!, text: `형식 오류: ${a[3]}` })
    } else if (k === 'error' && a.length >= 4) {
      out.errors.push(`${a[1]}: ${a[3]}`)
    } else if (k === 'worker' && a.length >= 7) {
      out.workers.push({ project: a[1]!, task: a[2]!, run: a[3]!, state: a[4]!, model: a[5]!, terminal: a[6]! })
    } else if (k === 'workers' && a[1] === 'unknown') {
      out.workersUnknown = a[2] || 'unknown'
    }
  }
  return out
}

const KINDS: readonly (readonly [Item['kind'], string, Tone])[] = [
  ['blocked', '블로커', 'error'],
  ['pending', '보고 대기', 'warning'],
  ['handoff', '위임 미수락', 'warning'],
  ['review', '검토 필요', 'warning'],
]

/** The band's counts, in the order they matter; zero counts are left out. */
export const bandParts = (b: Pick<Board, 'items' | 'workers'>): { label: string; tone: Tone }[] => {
  const parts: { label: string; tone: Tone }[] = []
  for (const [kind, label, tone] of KINDS) {
    const n = b.items.filter(i => i.kind === kind).length
    if (n > 0) parts.push({ label: `${label} ${n}`, tone })
  }
  if (b.workers.length > 0) parts.push({ label: `Worker ${b.workers.length} 진행`, tone: 'suggestion' })
  return parts
}

/** Rows of this session's own project first, the rest in their order. */
export const mineFirst = <T,>(rows: readonly T[], projectOf: (r: T) => string, mine?: string): T[] =>
  mine ? [...rows.filter(r => projectOf(r) === mine), ...rows.filter(r => projectOf(r) !== mine)] : [...rows]

export const ago = (iso: string, now: number): string => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '-'
  const m = Math.max(0, Math.round((now - t) / 60_000))
  return m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`
}

/**
 * Which hub to read and which project is this session's own. The `hubPath` option wins; else a Portfolio
 * session is its own hub and a personal-mode project finds it through its state folder (<hub>/projects/<id>).
 */
export const hubFrom = (option: string, home: string, where: string | null, config: string | null): { hub: string; mine?: string } => {
  const [mode, root] = (where ?? '').trim().split('\t')
  const role = /^role:\s*(\S+)/m.exec(config ?? '')?.[1]
  const mine = role === 'project' ? /^projectId:\s*(\S+)/m.exec(config ?? '')?.[1] : undefined
  const opt = option.trim()
  if (opt) return { hub: opt.startsWith('~/') ? `${home}/${opt.slice(2)}` : opt, mine }
  if (role === 'portfolio' && root) return { hub: root, mine }
  if (mode === 'personal' && root) return { hub: root.replace(/\/projects\/[^/]+\/?$/, ''), mine }
  return { hub: '', mine }
}

const groupBy = <T,>(rows: readonly T[], key: (r: T) => string): [string, T[]][] => {
  const m = new Map<string, T[]>()
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r])
  return [...m]
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'portfolio-board', description: '포트폴리오 현황 pane 열기: 처리할 것, 진행 중 Worker, 전체 프로젝트' })
    const start = async () => {
      const kit = `${$.plugin.root}/scripts/kit.sh`
      const home = (await $.env.get('HOME')) ?? ''
      const me = await $.env.get('ORCA_TERMINAL_HANDLE')
      const whereOf = async (dir: string) => {
        const w = await $.process.run(['sh', kit, 'where', dir]).catch(() => null)
        return w && w.exitCode === 0 ? w.stdout : null
      }
      // A session started in a subfolder finds its project through the repository root.
      let where = await whereOf('.')
      if (!where) {
        const g = await $.process.run(['git', 'rev-parse', '--show-toplevel']).catch(() => null)
        const top = g && g.exitCode === 0 ? g.stdout.trim() : ''
        if (top) where = await whereOf(top)
      }
      const root = where?.trim().split('\t')[1]
      const config = root ? await $.fs.read(`${root}/.ai/ORCHESTRATION.md`).catch(() => null) : null
      const { hub, mine } = hubFrom(String((options as { hubPath?: unknown } | undefined)?.hubPath ?? ''), home, where, config)
      if (!hub) return
      const shown = home && hub.startsWith(`${home}/`) ? `~${hub.slice(home.length)}` : hub
      let isBusy = false
      let last = ''
      // Written only when something but the time changed, so an unchanged poll does not redraw (and drop a click).
      const write = async (raw: Raw, isWorker: boolean) => {
        const key = JSON.stringify([raw, isWorker])
        if (key === last) return
        last = key
        const at = await $.clock.now()
        await update($, boardAtom, () => ({ ...raw, at, mine, hub: shown, isWorker }))
      }
      const refresh = async () => {
        if (isBusy) return
        isBusy = true
        try {
          const r = await $.process.run(['sh', kit, 'board', hub], { timeoutMs: 60_000 })
          const raw = parseBoard(r.stdout)
          if (r.exitCode !== 0) raw.errors.push(`kit.sh board 실패 (exit ${r.exitCode}): ${r.stderr.trim().split('\n')[0] || '이유 없음'}`)
          const isWorker = !!me && raw.workers.some(x => x.terminal === me)
          await write(raw, isWorker)
          // A worker session never shows the line, so it stops reading.
          if (isWorker) tick.cancel()
        } catch (err) {
          await write({ projects: [], items: [], workers: [], errors: [`kit.sh board 실행 실패: ${String(err)}`] }, false)
        } finally {
          isBusy = false
        }
      }
      const tick = $.clock.every(POLL_MS, () => void refresh())
      void refresh()
    }
    void start()
    return next(e)
  })

  on('command.run', { command: 'portfolio-board' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: '포트폴리오' })
    return { text: isPlaced ? '포트폴리오 pane 열림' : '포트폴리오 pane은 화면이 넓어지면 열린다' }
  })

  // Wraps whatever the plugins beneath drew (mods-hud's card) and adds one line under it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const b = await read($, boardAtom)
    const parts = b && !b.isWorker ? bandParts(b) : []
    if (parts.length === 0) return below
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="row" columnGap={1}>
          <Text color={parts[0]!.tone}>◆</Text>
          <Button key="portfolio-open" plain label="포트폴리오" onPress={() => void $.ui.open({ id: PANE, title: '포트폴리오' })} />
          {parts.map(p => (
            <Text key={p.label} color={p.tone}>{p.label}</Text>
          ))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const b = await read($, boardAtom)
    if (!b) return <Text dimColor>포트폴리오: hub를 찾지 못했거나 읽는 중 (설정 hubPath)</Text>
    const now = await $.clock.now()
    const label = (p: string) => (p === b.mine ? `${p} (내 프로젝트)` : p)
    const groups = groupBy(mineFirst(b.items, i => i.project, b.mine), i => i.project)
    const workers = mineFirst(b.workers, w => w.project, b.mine)
    const projects = mineFirst(b.projects, p => p.id, b.mine)
    return (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-end">{new Date(b.at).toTimeString().slice(0, 5)} 변경 · {POLL_MS / 1000}초마다 확인 · {b.hub}</Text>
        <Text> </Text>
        <Text bold>처리할 것 {b.items.length}</Text>
        {groups.length === 0 && <Text dimColor>  없음</Text>}
        {groups.map(([project, rows]) => (
          <Box key={`g-${project}`} flexDirection="column">
            <Text wrap="truncate-end">
              <Text>  {label(project)}  </Text>
              {KINDS.filter(([k]) => rows.some(r => r.kind === k)).map(([k, name, tone]) => (
                <Text key={`${project}-${k}`} color={tone}>{name} {rows.filter(r => r.kind === k).length}  </Text>
              ))}
            </Text>
            {rows.slice(0, 5).map(r => (
              <Text key={`${project}-${r.kind}-${r.id}`} dimColor wrap="truncate-end">    ⎿ {r.id} · {r.text}</Text>
            ))}
            {rows.length > 5 && <Text dimColor>    ⎿ … 외 {rows.length - 5}</Text>}
          </Box>
        ))}
        <Text> </Text>
        <Text bold>진행 중 Worker {b.workersUnknown ? '?' : b.workers.length}</Text>
        {b.workersUnknown && <Text dimColor wrap="truncate-end">  읽지 못함: {b.workersUnknown}</Text>}
        {!b.workersUnknown && workers.length === 0 && <Text dimColor>  없음</Text>}
        {workers.map((w, i) => (
          <Text key={`w-${i}-${w.terminal}`} wrap="truncate-end">
            <Text>  {label(w.project)}  {w.task}  </Text>
            <Text dimColor>{w.model} · {w.state}</Text>
          </Text>
        ))}
        <Text> </Text>
        <Text bold>전체 프로젝트 {b.projects.length}</Text>
        {projects.map(p => (
          <Box key={`p-${p.id}`} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={p.id === b.mine ? 'suggestion' : undefined}>  {p.id}</Text>
              <Text dimColor>  Task {p.open} · 체크포인트 {ago(p.observedAt, now)} · Pull {ago(p.lastPulled, now)}</Text>
            </Text>
            <Text dimColor wrap="truncate-end">    다음: {p.next}</Text>
          </Box>
        ))}
        {b.errors.map(x => (
          <Text key={`e-${x}`} color="error" wrap="truncate-end">  {x}</Text>
        ))}
      </Box>
    )
  })
}
