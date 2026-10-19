import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Audit, Board, Discovery, Dot, Item, WorkItem, WorkerRow } from '../types'

// One line above the prompt with what needs someone across the Portfolio, and a pane with the details.
// Read-only: every value comes from `kit.sh board` (and `kit.sh audit` once the pane is open); nothing is written and no model is called.

const PANE = 'portfolio-board'
const POLL_MS = 10_000
const AUDIT_MS = 300_000
/** A Worker Orca saw within this long ago is green, within STALL_MS yellow, longer ago red (a suspected stall). */
const ACTIVE_MS = 5 * 60_000
const STALL_MS = 15 * 60_000
/** The time since the last check turns warning-coloured past this (three checks). */
const LATE_MS = 30_000
const MAX_DOTS = 8
const boardAtom = atom({ plugin: 'orchestration-kit', key: 'board' } as const, null as Board | null)
const discoveryAtom = atom({ plugin: 'orchestration-kit', key: 'discovery' } as const, { state: 'searching' } as Discovery)
const auditAtom = atom({ plugin: 'orchestration-kit', key: 'audit' } as const, null as Audit | null)

type Raw = Pick<Board, 'projects' | 'items' | 'workers' | 'workersUnknown' | 'workersPartial' | 'errors'>
type Tone = 'error' | 'warning' | 'suggestion'
type Part = { label: string; tone?: Tone; kind: 'item' | 'progress' | 'stalled' }

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
      const w: WorkerRow = { project: a[1]!, task: a[2]!, run: a[3]!, state: a[4]!, model: a[5]!, terminal: a[6]! }
      // Columns 8-13 come from a kit.sh that reports activity; an older one stops at 7 and they stay absent.
      if (a.length >= 13) {
        const at = Number(a[10])
        const some = (v: string) => (v === '-' ? undefined : v)
        Object.assign(w, {
          port: some(a[7]!), title: some(a[8]!), liveness: a[9]!, observedAt: a[10] !== '-' && Number.isFinite(at) ? at : undefined,
          activity: some(a[11]!), attention: a[12] === '-' ? [] : a[12]!.split(','),
        })
      }
      out.workers.push(w)
    } else if (k === 'workers' && a[1] === 'unknown') {
      out.workersUnknown = a[2] || 'unknown'
    } else if (k === 'workers' && a[1] === 'partial') {
      out.workersPartial = [out.workersPartial, a[2] || 'partial'].filter(Boolean).join('; ')
    }
  }
  return out
}

/** `kit.sh audit` lines: Runs whose Coordinator is gone, and per project how many tasks and checkpoints have drifted. */
export const parseAudit = (tsv: string): Pick<Audit, 'gone' | 'drift' | 'error'> => {
  const out: Pick<Audit, 'gone' | 'drift' | 'error'> = { gone: [], drift: [] }
  for (const line of tsv.split('\n')) {
    const a = line.split('\t')
    if (a[0] === 'run' && a[4] === 'gone') out.gone.push({ project: a[1]!, run: a[2]!, createdAt: a[3]!, status: a[5] ?? '-' })
    else if (a[0] === 'drift' && a.length >= 3) {
      const d = out.drift.find(x => x.project === a[1] && x.kind === a[2])
      if (d) d.count += 1
      else out.drift.push({ project: a[1]!, kind: a[2]!, count: 1 })
    } else if (a[0] === 'runs' && a[1] === 'unknown') out.error = a[2] || 'unknown'
  }
  return out
}

/** The colour of one Worker's dot, from what Orca saw of it and how long ago. */
export const dotOf = (w: WorkerRow, now: number): Dot => {
  // An answer is awaited (ask): intended, not a stall. A prompt is awaited from a person: a stall nobody else will fix.
  if (w.attention?.includes('input')) return 'gray'
  if (w.activity === 'blocked' || w.attention?.includes('approval')) return 'input'
  if (w.observedAt === undefined) return 'unknown'
  const age = Math.max(0, now - w.observedAt)
  return age <= ACTIVE_MS ? 'green' : age <= STALL_MS ? 'yellow' : 'red'
}

const unknownWhy = (w: WorkerRow): string => (w.liveness === undefined ? 'kit.sh가 활동을 주지 않음' : (w.liveness.split(':')[1] ?? '시각 없음'))

/** Workers grouped by the task they work on (the Portfolio task, else the project task, else none), with one colour per task. */
export const workItems = (workers: readonly WorkerRow[], now: number): WorkItem[] => {
  const groups = new Map<string, WorkerRow[]>()
  for (const w of workers) {
    const key = `${w.project}\0${w.port ?? (w.task !== '-' ? w.task : '')}`
    groups.set(key, [...(groups.get(key) ?? []), w])
  }
  return [...groups.values()].map(ws => {
    const first = ws[0]!
    const key = first.port ?? (first.task !== '-' ? first.task : '')
    const dots = ws.map(w => dotOf(w, now))
    // An answer to a person comes first; else the task is as alive as its most recently seen Worker; else it waits, else nobody knows.
    const seen = ws.flatMap((w, i) => (dots[i] === 'green' || dots[i] === 'yellow' || dots[i] === 'red' ? [{ at: w.observedAt!, dot: dots[i]! }] : []))
    const latest = seen.reduce<(typeof seen)[number] | undefined>((a, b) => (!a || b.at > a.at ? b : a), undefined)
    const dot: Dot = dots.includes('input') ? 'input' : (latest?.dot ?? (dots.includes('gray') ? 'gray' : 'unknown'))
    const times = ws.flatMap(w => (w.observedAt === undefined ? [] : [w.observedAt]))
    return {
      project: first.project,
      key,
      label: `${first.project === '-' ? '프로젝트 모름' : first.project} / ${key || '업무 연결 모름'}`,
      title: ws.find(w => w.title)?.title ?? '',
      dot,
      workers: ws.length,
      providers: [...new Set(ws.map(w => w.model.split('/')[0]!))],
      observedAt: times.length > 0 ? Math.max(...times) : undefined,
      stalledWorkers: dots.filter(d => d === 'red').length,
      reason: dot === 'unknown' ? unknownWhy(ws[0]!) : undefined,
      runs: [...new Set(ws.map(w => w.run))],
    }
  })
}

const KINDS: readonly (readonly [Item['kind'], string, Tone])[] = [
  ['blocked', '블로커', 'error'],
  ['pending', '보고 대기', 'warning'],
  ['handoff', '위임 미수락', 'warning'],
  ['review', '검토 필요', 'warning'],
]

const isStalled = (i: WorkItem) => i.dot === 'red' || i.dot === 'input'

/** The band's counts, in the order they matter; zero counts of what needs someone are left out. Progress counts tasks, not Workers. */
export const bandParts = (b: Pick<Board, 'items' | 'workers' | 'workersUnknown' | 'workersPartial'>, now: number): Part[] => {
  const parts: Part[] = []
  for (const [kind, label, tone] of KINDS) {
    const n = b.items.filter(i => i.kind === kind).length
    if (n > 0) parts.push({ label: `${label} ${n}`, tone, kind: 'item' })
  }
  if (b.workersUnknown) {
    parts.push({ label: '진행 ?', tone: 'warning', kind: 'progress' })
    return parts
  }
  const items = workItems(b.workers, now)
  parts.push({ label: `진행 ${items.length}${b.workersPartial ? '?' : ''}`, tone: b.workersPartial ? 'warning' : items.length > 0 ? 'suggestion' : undefined, kind: 'progress' })
  const stalled = items.filter(isStalled).length
  if (stalled > 0) parts.push({ label: `멈춤 ${stalled}`, tone: 'error', kind: 'stalled' })
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

/** Seconds, minutes, hours since; the same wording as hooks/ago.tsx counts up by itself. */
const agoText = (ms: number): string => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`
}

const clockOf = (ms: number): string => new Date(ms).toTimeString().slice(0, 8)

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

const DOT_COLOR = { green: 'success', yellow: 'warning', red: 'error', gray: 'inactive', input: 'error', unknown: undefined } as const
const glyph = (d: Dot) => (d === 'unknown' ? '?' : '●')

/** What the pane says under a task: the sighting, why it is coloured so, the Workers. */
const detail = (it: WorkItem, now: number): string => {
  const seen = it.observedAt === undefined ? [] : [`활동 ${agoText(now - it.observedAt)}`]
  const head =
    it.dot === 'gray' ? ['답 기다림 (ask)', ...seen] :
    it.dot === 'input' ? ['사람 입력 필요 (승인·선택 프롬프트)', ...seen] :
    it.dot === 'unknown' ? [`활동 모름 (${it.reason})`] :
    it.dot === 'red' ? [`${seen[0]} (멈춤 의심)`] : seen
  return [
    ...head,
    `Worker ${it.workers} (${it.providers.join(', ')})`,
    ...(it.key === '' ? [it.runs[0]!] : []),
    ...(it.stalledWorkers > 0 && it.dot !== 'red' ? [`멈춤 의심 Worker ${it.stalledWorkers}`] : []),
  ].join(' · ')
}

export const register: Register = (on, options) => {
  // Looks for the hub again (turn end, pane open) until it is found; null before the session starts and once found.
  let rediscover: (() => Promise<void>) | null = null
  // Starts reading `kit.sh audit` (once the pane has been opened); null until the hub is found.
  let startAudit: (() => void) | null = null
  // The Client that counts the time since a check failed once: the line then shows the clock time of the check.
  let isAgoBroken = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'portfolio-board', description: '포트폴리오 현황 pane 열기: 처리할 것, 진행 중 업무, 멈춤·이상, 프로젝트' })
    const start = async () => {
      const kit = `${$.plugin.root}/scripts/kit.sh`
      const home = (await $.env.get('HOME')) ?? ''
      const me = await $.env.get('ORCA_TERMINAL_HANDLE')
      const whereOf = async (dir: string) => {
        const w = await $.process.run(['sh', kit, 'where', dir]).catch(() => null)
        return w && w.exitCode === 0 ? w.stdout : null
      }
      const poll = (hub: string, mine: string | undefined) => {
        const shown = home && hub.startsWith(`${home}/`) ? `~${hub.slice(home.length)}` : hub
        let isBusy = false
        let last = ''
        let board: Board | null = null
        // The data's own change time moves only when the data does: Orca seeing a Worker again changes lastObservedAt every time.
        const keyOf = (raw: Raw, isWorker: boolean) => JSON.stringify([{ ...raw, workers: raw.workers.map(w => ({ ...w, observedAt: undefined })) }, isWorker])
        const write = async (raw: Raw | null, isWorker: boolean, failed?: string) => {
          const checkedAt = await $.clock.now()
          let fresh: Board
          if (raw) {
            const key = keyOf(raw, isWorker)
            const changedAt = board && key === last ? board.changedAt : checkedAt
            last = key
            fresh = { ...raw, changedAt, checkedAt, okAt: checkedAt, mine, hub: shown, isWorker }
          } else if (board) {
            // A failed check keeps the last good data and says it failed.
            fresh = { ...board, checkedAt, failed }
          } else {
            fresh = { projects: [], items: [], workers: [], errors: [], changedAt: checkedAt, checkedAt, okAt: null, failed, mine, hub: shown, isWorker: false }
          }
          board = fresh
          await update($, boardAtom, () => fresh)
        }
        const refresh = async () => {
          if (isBusy) return
          isBusy = true
          try {
            const r = await $.process.run(['sh', kit, 'board', hub], { timeoutMs: 60_000 })
            if (r.exitCode !== 0) {
              await write(null, board?.isWorker ?? false, `kit.sh board 실패 (exit ${r.exitCode}): ${r.stderr.trim().split('\n')[0] || '이유 없음'}`)
              return
            }
            const raw = parseBoard(r.stdout)
            const isWorker = !!me && raw.workers.some(x => x.terminal === me)
            await write(raw, isWorker)
            // A worker session never shows the line, so it stops reading.
            if (isWorker) tick.cancel()
          } catch (err) {
            await write(null, board?.isWorker ?? false, `kit.sh board 실행 실패: ${String(err)}`)
          } finally {
            isBusy = false
          }
        }
        const tick = $.clock.every(POLL_MS, () => void refresh())
        void refresh()

        // shortcut: audit keeps running after the pane closes, bounded by one slow read per 5 minutes; stop it with the pane when the API says so.
        let isAuditing = false
        let isAuditStarted = false
        const audit = async () => {
          if (isAuditing) return
          isAuditing = true
          const at = await $.clock.now()
          try {
            const r = await $.process.run(['sh', kit, 'audit', hub], { timeoutMs: 120_000 })
            const a = r.exitCode === 0 ? parseAudit(r.stdout) : { gone: [], drift: [], error: `kit.sh audit 실패 (exit ${r.exitCode}): ${r.stderr.trim().split('\n')[0] || '이유 없음'}` }
            await update($, auditAtom, () => ({ at, ...a }))
          } catch (err) {
            await update($, auditAtom, () => ({ at, gone: [], drift: [], error: `kit.sh audit 실행 실패: ${String(err)}` }))
          } finally {
            isAuditing = false
          }
        }
        startAudit = () => {
          if (isAuditStarted) return
          isAuditStarted = true
          $.clock.every(AUDIT_MS, () => void audit())
          void audit()
        }
      }
      let isFinding = false
      const find = async () => {
        if (isFinding) return
        isFinding = true
        try {
          // A session started in a subfolder finds its project through the repository root.
          let where = await whereOf('.')
          if (!where) {
            const g = await $.process.run(['git', 'rev-parse', '--show-toplevel', '--show-prefix']).catch(() => null)
            const [top = '', prefix = ''] = g && g.exitCode === 0 ? g.stdout.split('\n').map(x => x.trim()) : []
            // At the top of the repository the root is this very folder, which was just tried.
            if (top && prefix) where = await whereOf(top)
          }
          const root = where?.trim().split('\t')[1]
          const config = root ? await $.fs.read(`${root}/.ai/ORCHESTRATION.md`).catch(() => null) : null
          let { hub, mine } = hubFrom(String((options as { hubPath?: unknown } | undefined)?.hubPath ?? ''), home, where, config)
          // A shared-mode project has no state path to follow; `register` left a pointer that `kit.sh hub` reads.
          if (!hub && root && mine) {
            const h = await $.process.run(['sh', kit, 'hub', root]).catch(() => null)
            if (h && h.exitCode === 0) hub = h.stdout.trim()
          }
          const found: Discovery = { state: hub ? 'found' : mine ? 'no-hub' : 'not-kit', mine }
          // Written only when it changed: an idle session writes no state.
          if (JSON.stringify(found) !== JSON.stringify(await read($, discoveryAtom))) await update($, discoveryAtom, () => found)
          if (!hub) return
          rediscover = null
          poll(hub, mine)
        } finally {
          isFinding = false
        }
      }
      rediscover = find
      await find()
    }
    void start()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    void rediscover?.().catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'portfolio-board' }, async $ => {
    await rediscover?.().catch(() => undefined)
    startAudit?.()
    const { isPlaced } = await $.ui.open({ id: PANE, title: '포트폴리오' })
    return { text: isPlaced ? '포트폴리오 pane 열림' : '포트폴리오 pane은 화면이 넓어지면 열린다' }
  })

  on('ui.fault', async ($, e, next) => {
    if (e.module.endsWith('ago.tsx')) isAgoBroken = true
    $.ui.log(`orchestration-kit: ${e.module} ${e.phase}: ${e.reason}`)
    return next(e)
  })

  // The band slot is shared: draw one line under whatever the plugins beneath drew, whether or not another band is outside.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const b = await read($, boardAtom)
    if (!b || b.isWorker) return below
    const now = await $.clock.now()
    // Before the first good read nothing is known: that is not "nothing to do".
    const isNeverRead = b.okAt === null
    const parts = bandParts(isNeverRead ? { ...b, workersUnknown: b.failed ?? '아직 읽지 못함' } : b, now)
    const items = workItems(b.workers, now)
    const mine = b.mine ? b.projects.find(p => p.id === b.mine) : undefined
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const Client = 'Client' in els && !isAgoBroken ? els.Client : undefined
    const since = (at: number, props: { prefix?: string; isError?: boolean }, key: string) =>
      Client ? <Client key={key} module="./ago.tsx" props={{ at, now, warnAfterMs: LATE_MS, ...props }} /> : <Text key={key} dimColor>{props.prefix ?? '확인 '}{clockOf(at)}</Text>
    const lead = parts.find(p => p.kind !== 'progress')?.tone
    const hasItems = parts.some(p => p.kind === 'item')
    const nodes = parts.map(p =>
      p.kind === 'progress' ? (
        <Box key="portfolio-progress" flexDirection="row" columnGap={1}>
          <Text color={p.tone} dimColor={!p.tone}>{p.label}</Text>
          {!b.workersUnknown && items.length > 0 && (
            <Box flexDirection="row">
              {items.slice(0, MAX_DOTS).map((it, i) => <Text key={`dot-${i}`} color={DOT_COLOR[it.dot]} dimColor={it.dot === 'unknown'}>{glyph(it.dot)}</Text>)}
            </Box>
          )}
          {items.length > MAX_DOTS && <Text dimColor>+{items.length - MAX_DOTS}</Text>}
        </Box>
      ) : p.kind === 'stalled' ? (
        <Box key="portfolio-stalled"><Text color="error">{p.label}</Text></Box>
      ) : (
        <Text key={p.label} color={p.tone}>{p.label}</Text>
      ),
    )
    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="row" columnGap={1}>
          <Text color={lead} dimColor={!lead}>◆</Text>
          <Button key="portfolio-open" plain label="포트폴리오" onPress={() => void $.ui.open({ id: PANE, title: '포트폴리오' })} />
          {b.mine && <Box key="portfolio-mine"><Text color="suggestion">{b.mine}{mine ? ` Task ${mine.open}` : ''}</Text></Box>}
          {b.mine && <Text dimColor>·</Text>}
          {!hasItems && <Box key="portfolio-clear"><Text dimColor={!isNeverRead} color={isNeverRead ? 'warning' : undefined}>처리할 것 {isNeverRead ? '?' : '없음'}</Text></Box>}
          {nodes.flatMap((n, i) => (i === 0 && hasItems ? [n] : i === 0 ? [<Text key="sep-clear" dimColor>·</Text>, n] : [<Text key={`sep-${i}`} dimColor>·</Text>, n]))}
          {!b.mine && <Box key="portfolio-projects"><Text dimColor>· 프로젝트 {isNeverRead ? '?' : b.projects.length}</Text></Box>}
          <Text dimColor>·</Text>
          {b.failed ? (
            <Box key="portfolio-checked" flexDirection="row">
              <Text color="error">확인 실패</Text>
              {b.okAt !== null && <Text dimColor> · 마지막 성공 </Text>}
              {b.okAt !== null && since(b.okAt, { prefix: '' }, 'portfolio-checked-ok')}
            </Box>
          ) : since(b.checkedAt, {}, 'portfolio-checked')}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    startAudit?.()
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const b = await read($, boardAtom)
    if (!b) {
      const d = await read($, discoveryAtom)
      // keyed on a Box: a key on the root element is not kept
      if (d.state === 'not-kit') return <Box key="pane-empty-not-kit"><Text dimColor>이 저장소는 orchestration-kit 프로젝트가 아님 (hub를 보려면 hubPath 설정)</Text></Box>
      if (d.state === 'no-hub') return <Box key="pane-empty-no-hub"><Text dimColor>{d.mine}: hub를 찾지 못함. hub에서 kit.sh register를 다시 실행하거나 hubPath 설정</Text></Box>
      return <Box key="pane-empty-reading"><Text dimColor>포트폴리오: 읽는 중</Text></Box>
    }
    const now = await $.clock.now()
    const audit = await read($, auditAtom)
    const Client = 'Client' in els && !isAgoBroken ? els.Client : undefined
    const isNeverRead = b.okAt === null
    const unknown = b.workersUnknown ?? (isNeverRead ? (b.failed ?? '아직 읽지 못함') : undefined)
    const label = (p: string) => (p === b.mine ? `${p} (내 프로젝트)` : p)
    const groups = groupBy(mineFirst(b.items, i => i.project, b.mine), i => i.project)
    const items = mineFirst(workItems(b.workers, now), i => i.project, b.mine)
    const stalled = items.filter(isStalled)
    const projects = mineFirst(b.projects, p => p.id, b.mine)
    const stale = !!b.failed
    const idOf = (it: WorkItem) => `${it.project}-${it.key || 'unlinked'}`
    const anomalies = unknown ? 0 : stalled.length
    const hasAudit = !unknown && !!audit && !audit.error
    return (
      <Box flexDirection="column">
        {b.failed ? (
          <Box key="pane-checked" flexDirection="row">
            <Box key="pane-checked-at"><Text color="error">확인 실패 {clockOf(b.checkedAt)}</Text></Box>
            <Text dimColor> · 마지막 성공 {b.okAt === null ? '없음' : `${clockOf(b.okAt)} (${agoText(now - b.okAt)})`} · {POLL_MS / 1000}초마다 확인 · {b.hub}</Text>
          </Box>
        ) : (
          <Box key="pane-checked" flexDirection="row">
            <Box key="pane-checked-at"><Text dimColor>확인 {clockOf(b.checkedAt)}</Text></Box>
            {Client && <Text dimColor> (</Text>}
            {Client && <Client key="pane-ago" module="./ago.tsx" props={{ at: b.checkedAt, now, warnAfterMs: LATE_MS, prefix: '' }} />}
            {Client && <Text dimColor>)</Text>}
            <Box key="pane-changed"><Text dimColor> · 데이터 변경 {new Date(b.changedAt).toTimeString().slice(0, 5)}</Text></Box>
            <Text dimColor> · {POLL_MS / 1000}초마다 확인 · {b.hub}</Text>
          </Box>
        )}
        <Text> </Text>
        <Text bold>처리할 것 {isNeverRead ? '?' : b.items.length}</Text>
        {!isNeverRead && groups.length === 0 && <Text dimColor>  없음</Text>}
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
        <Box key="pane-progress"><Text bold>진행 중 {unknown ? '?' : `${items.length}${b.workersPartial ? '?' : ''}`}</Text></Box>
        {unknown && <Text dimColor wrap="truncate-end">  읽지 못함: {unknown}</Text>}
        {!unknown && b.workersPartial && <Text color="warning" wrap="truncate-end">  일부 읽지 못함: {b.workersPartial}</Text>}
        {!unknown && !b.workersPartial && items.length === 0 && <Text dimColor>  없음</Text>}
        {!unknown && items.map(it => (
          <Box key={`work-${idOf(it)}-${it.dot}`} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={DOT_COLOR[it.dot]} dimColor={stale || it.dot === 'unknown'}>  {glyph(it.dot)} </Text>
              <Text dimColor={stale}>{it.label}  </Text>
              <Text dimColor>{it.title}</Text>
            </Text>
            <Text dimColor wrap="truncate-end">      {detail(it, now)}</Text>
          </Box>
        ))}
        <Text> </Text>
        <Box key="pane-stalled"><Text bold>멈춤·이상 {unknown ? '?' : anomalies}</Text></Box>
        {!unknown && stalled.map(it => (
          <Box key={`stalled-${idOf(it)}`}><Text color={DOT_COLOR[it.dot]} wrap="truncate-end">  {glyph(it.dot)} {it.label}  {detail(it, now)}</Text></Box>
        ))}
        {hasAudit && <Box key="pane-audit"><Text bold>Run 점검 {audit.gone.length} · 상태 어긋남 {audit.drift.reduce((n, d) => n + d.count, 0)}</Text></Box>}
        {!unknown && audit?.gone.map(g => (
          <Text key={`gone-${g.run}`} dimColor wrap="truncate-end">  Coordinator 없는 Run: {g.run} ({g.status}, {g.createdAt.slice(0, 10)})</Text>
        ))}
        {!unknown && audit?.drift.map(d => (
          <Text key={`drift-${d.project}-${d.kind}`} dimColor wrap="truncate-end">  상태 어긋남: {d.project} {d.kind === 'unreported' ? '보고서 없는 completed' : '체크포인트 어긋남'} {d.count}</Text>
        ))}
        {!audit && <Text key="audit-reading" dimColor>  Run 점검 중</Text>}
        {audit?.error && <Text key="audit-error" color="warning" wrap="truncate-end">  Run 점검 못 함: {audit.error}</Text>}
        <Text> </Text>
        <Box key="pane-projects"><Text bold>프로젝트 {isNeverRead ? '?' : b.projects.length} (active)</Text></Box>
        {projects.map(p => (
          <Box key={`p-${p.id}`} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={p.id === b.mine ? 'suggestion' : undefined}>  {p.id}</Text>
              <Text dimColor>  Task {p.open} · 체크포인트 {ago(p.observedAt, now)} · Pull {ago(p.lastPulled, now)}</Text>
            </Text>
            <Text dimColor wrap="truncate-end">    다음: {p.next}</Text>
          </Box>
        ))}
        {b.failed && <Text color="error" wrap="truncate-end">  {b.failed}</Text>}
        {b.errors.map(x => (
          <Text key={`e-${x}`} color="error" wrap="truncate-end">  {x}</Text>
        ))}
      </Box>
    )
  })
}
