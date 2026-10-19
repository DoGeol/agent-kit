import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'

import { ago, bandParts, dotOf, hubFrom, mineFirst, parseBoard, workItems } from '../hooks/register'

const T = '\t'
const NOW = Date.parse('2026-10-18T12:00:00+09:00')
const MIN = 60_000
const BOARD = [
  ['blocked', 'portfolio', 'PORT-0003', 'API 계약 결정'],
  ['project', 'app', 'shared', '2', '2026-10-18T05:00:00+09:00', '2026-10-18T09:00:00+09:00', 'README 실행 절'],
  ['review', 'app', 'APP-0002', '상태 화면', 'run_x / PR #4'],
  ['handoff', 'app', 'PORT-0004', '영문화'],
  ['project', 'api', 'personal', '0', '-', '-', '-'],
  ['pending', 'api', 'api-API-0001-r01', 'completed', 'hub@HEAD:projects/api/.ai/reports/api-API-0001-r01.md'],
  ['invalid', 'api', '.ai/reports/x.md', '모르는 status'],
  ['error', 'gone', '-', 'ORCHESTRATION.md 없음'],
  ['worker', 'app', 'APP-0003', 'run_x', 'ready', 'claude/haiku', 'term_w'],
  ['future-kind', 'x'],
].map(r => r.join(T)).join('\n')

test('parseBoard reads every kind and skips unknown ones', () => {
  const b = parseBoard(BOARD)
  expect(b.projects.map(p => `${p.id}:${p.mode}:${p.open}`)).toEqual(['app:shared:2', 'api:personal:0'])
  expect(b.items.map(i => `${i.kind}:${i.project}:${i.id}`)).toEqual([
    'blocked:portfolio:PORT-0003', 'review:app:APP-0002', 'handoff:app:PORT-0004', 'pending:api:api-API-0001-r01', 'pending:api:.ai/reports/x.md',
  ])
  expect(b.items[1]!.text).toBe('상태 화면 · run_x / PR #4')
  expect(b.errors).toEqual(['gone: ORCHESTRATION.md 없음'])
  expect(b.workers[0]!.terminal).toBe('term_w')
  expect(b.workersUnknown).toBeUndefined()
  expect(parseBoard(`workers${T}unknown${T}orca 응답 없음`).workersUnknown).toBe('orca 응답 없음')
})

test('bandParts: blocker first, zero counts hidden, progress last, nothing to handle when all clear', () => {
  const b = parseBoard(BOARD)
  expect(bandParts(b, NOW).map(p => `${p.label}/${p.tone}`)).toEqual(['블로커 1/error', '보고 대기 2/warning', '위임 미수락 1/warning', '검토 필요 1/warning', '진행 1/suggestion'])
  expect(bandParts({ items: [], workers: [] }, NOW).map(p => `${p.kind}:${p.label}`)).toEqual(['progress:진행 0'])
})

test('hubFrom: option, then Portfolio session, then personal project; shared project without option has none', () => {
  const project = 'role: project\nprojectId: api\n'
  expect(hubFrom('~/hub', '/h', 'shared\t/r/api\n', project)).toEqual({ hub: '/h/hub', mine: 'api' })
  expect(hubFrom('', '/h', 'shared\t/h/hub\n', 'role: portfolio\n')).toEqual({ hub: '/h/hub', mine: undefined })
  expect(hubFrom('', '/h', 'personal\t/h/hub/projects/api\n', project)).toEqual({ hub: '/h/hub', mine: 'api' })
  expect(hubFrom('', '/h', 'shared\t/r/api\n', project)).toEqual({ hub: '', mine: 'api' })
  expect(hubFrom('', '/h', null, null)).toEqual({ hub: '', mine: undefined })
})

test('mineFirst and ago', () => {
  expect(mineFirst(['a', 'b', 'c'], x => x, 'b')).toEqual(['b', 'a', 'c'])
  expect(mineFirst(['a', 'b'], x => x)).toEqual(['a', 'b'])
  const now = Date.parse('2026-10-18T12:00:00+09:00')
  expect(ago('2026-10-18T11:30:00+09:00', now)).toBe('30분 전')
  expect(ago('2026-10-18T06:00:00+09:00', now)).toBe('6시간 전')
  expect(ago('2026-10-16T12:00:00+09:00', now)).toBe('2일 전')
  expect(ago('-', now)).toBe('-')
})

const BAND = { hasSurvey: false, isWorking: false, maxRows: 16, bodyColumns: 120, scroll: { offset: 0, bodyRows: 12 }, view: {} } as const

type World = {
  terminal?: string; where?: string; config?: string; opened?: string[]; exit?: number; stderr?: string; boards?: string[]
  /** every kit.sh and git call, by kind */
  calls?: string[]
  /** while true, `kit.sh where` and git fail: a folder that is no project yet */
  whereFails?: () => boolean
  /** what `kit.sh hub` prints; it fails when absent */
  hub?: string
  /** the board answer waits for this */
  gate?: Promise<void>
  /** replaces the board answer while set */
  board?: string
  /** what `kit.sh audit` prints; its exit code */
  audit?: string
  auditExit?: number
  /** what `git rev-parse` prints; it fails when absent */
  git?: string
}

const world = (on: On, board: string, w: World = {}) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : e.name === 'ORCA_TERMINAL_HANDLE' ? w.terminal : undefined }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('process.run', async (_, e) => {
    const kind = e.argv.includes('where') ? 'where' : e.argv.includes('hub') ? 'hub' : e.argv.includes('audit') ? 'audit' : e.argv[0] === 'git' ? 'git' : 'board'
    w.calls?.push(kind)
    const out = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
    if (kind === 'board') {
      w.boards?.push(e.argv.join(' '))
      await w.gate
      return out(w.exit ?? 0, w.board ?? board, w.stderr ?? '')
    }
    if (kind === 'audit') return out(w.auditExit ?? 0, w.audit ?? '', w.auditExit ? 'audit 실패' : '')
    if (kind === 'git' && w.git !== undefined) return out(0, w.git)
    if (kind === 'git' || (kind === 'where' && w.whereFails?.())) return out(1, '', 'kit.sh: 초기화되지 않음')
    if (kind === 'hub') return w.hub === undefined ? out(1, '', 'kit.sh: hub 포인터 없음') : out(0, w.hub)
    return out(0, w.where ?? 'shared\t/h/hub\n')
  })
  on('fs.read', () => ({ value: w.config ?? 'role: portfolio\n' }))
  on('ui.open', (_, e) => {
    w.opened?.push(e.id)
    return { value: { isPlaced: true } }
  })
  // stands for the engine's own band beneath every plugin
  on('ui.render', () => ({ type: 'Text', children: ['core band'] }))
}

// Starts the session and lets the first read land.
const boot = async ($: Parameters<TestBody>[0], on: On, surface: 'terminal' | 'desktop', board: string, w: World = {}) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
  world(on, board, w)
  await $.session.start({ cwd: '/h/hub', surface, isInteractive: true })
  await clock.advance(10)
  return clock
}

const PANE = { title: '포트폴리오', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pane on ${surface}: my project first, the three sections, the press opens it`, async ($, on) => {
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    const opened: string[] = []
    world(on, BOARD, { opened, where: 'personal\t/h/hub/projects/api\n', config: 'role: project\nprojectId: api\n' })
    await $.session.start({ cwd: '/h/api', surface, isInteractive: true })
    await clock.advance(10)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    await band.press({ key: 'portfolio-open' })
    expect(opened).toContain('portfolio-board')
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: '처리할 것 5' })).toBeDefined()
    expect((await pane.find({ key: 'pane-progress' }))?.text).toBe('진행 중 1')
    expect((await pane.find({ key: 'pane-projects' }))?.text).toBe('프로젝트 2 (active)')
    expect(await pane.find({ type: 'Text', text: '  api (내 프로젝트)  ' })).toBeDefined()
    await pane.unmount()
  })

  test(`band line on ${surface}: counts shown under what is beneath`, async ($, on) => {
    await boot($, on, surface, BOARD)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: 'core band' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '보고 대기 2' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: '블로커 1' })).toBeDefined()
    await band.unmount()
  })

  test(`band line on ${surface}: quiet in a worker session`, async ($, on) => {
    const boards: string[] = []
    const clock = await boot($, on, surface, BOARD, { terminal: 'term_w', boards })
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: '보고 대기 2' })).toBeUndefined()
    await band.unmount()
    await clock.advance(61_000)
    expect(boards).toHaveLength(1)
  })

  test(`T6 band line on ${surface}: a quiet board still shows the line, with the session's own project`, async ($, on) => {
    const CLEAR = ['project', 'api', 'personal', '3', '-', '-', '-'].join(T)
    await boot($, on, surface, CLEAR)
    const hubBand = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await hubBand.find({ type: 'Text', text: '◆' })).toBeDefined()
    expect(await hubBand.find({ key: 'portfolio-open' })).toBeDefined()
    expect(await hubBand.find({ key: 'portfolio-clear' })).toBeDefined()
    expect(await hubBand.find({ key: 'portfolio-projects' })).toBeDefined()
    expect(await hubBand.find({ key: 'portfolio-mine' })).toBeUndefined()
    expect(await hubBand.find({ type: 'Text', text: 'core band' })).toBeDefined()
    await hubBand.unmount()
  })

  test(`T6 band line on ${surface}: a project session names its own project first`, async ($, on) => {
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, ['project', 'api', 'personal', '3', '-', '-', '-'].join(T), { where: 'personal\t/h/hub/projects/api\n', config: 'role: project\nprojectId: api\n' })
    await $.session.start({ cwd: '/h/api', surface, isInteractive: true })
    await clock.advance(10)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ key: 'portfolio-mine' }))?.text).toMatch(/api Task 3/)
    expect(await band.find({ key: 'portfolio-clear' })).toBeDefined()
    expect(await band.find({ key: 'portfolio-projects' })).toBeUndefined()
    await band.unmount()
  })

  test(`pane on ${surface}: a failed read shows why`, async ($, on) => {
    await boot($, on, surface, '', { exit: 1, stderr: 'kit.sh: /h/hub: role이 portfolio가 아님\n' })
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: /role이 portfolio가 아님/ })).toBeDefined()
    await pane.unmount()
  })
}

// Inline plugins run beside the one under test: `prepend` sits outside it, `append` inside. Neither may close over this file.
const outerCard = {
  name: 'outer-card',
  tier: 'prepend',
  register: (on: On) => {
    on('ui.render', { component: 'AbovePrompt' }, async (_$, e, next) => {
      const below = await next(e)
      return { type: 'Box', children: [{ type: 'Text', children: ['CARD'] }, below] }
    })
  },
} as const
const innerCard = {
  name: 'inner-card',
  tier: 'append',
  register: (on: On) => {
    on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Text', children: ['CARD'] }))
  },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  for (const [name, card] of [['outside', outerCard], ['inside', innerCard]] as const) {
    test(`T3 band line on ${surface}: shown whether the card is ${name} this plugin`, { plugins: [card] }, async ($, on) => {
      await boot($, on, surface, BOARD)
      const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
      expect(await band.find({ type: 'Text', text: 'CARD' })).toBeDefined()
      expect(await band.find({ key: 'portfolio-open' })).toBeDefined()
      await band.unmount()
    })
  }

  test(`T4 ${surface}: a hub that appears mid-session is found at turn end, and never looked for again`, async ($, on) => {
    const flag = { ready: false }
    const calls: string[] = []
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, BOARD, { calls, whereFails: () => !flag.ready })
    await $.session.start({ cwd: '/h/hub', surface, isInteractive: true })
    await clock.advance(120_000)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ key: 'pane-empty-not-kit' })).toBeDefined()
    await pane.unmount()
    flag.ready = true
    await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
    await clock.advance(10)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ key: 'portfolio-open' })).toBeDefined()
    await band.unmount()
    const looks = calls.filter(c => c === 'where').length
    await clock.advance(120_000)
    await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm2', reason: 'answer' })
    await clock.advance(10)
    expect(calls.filter(c => c === 'where')).toHaveLength(looks)
  })

  test(`T4 ${surface}: opening the pane looks for a hub that appeared mid-session`, async ($, on) => {
    const flag = { ready: false }
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, BOARD, { whereFails: () => !flag.ready })
    await $.session.start({ cwd: '/h/hub', surface, isInteractive: true })
    await clock.advance(10)
    flag.ready = true
    await $.command.run({ command: 'portfolio-board', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
    await clock.advance(10)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: '처리할 것 5' })).toBeDefined()
    await pane.unmount()
  })

  test(`T5 ${surface}: a shared-mode project finds its hub through kit.sh hub`, async ($, on) => {
    const boards: string[] = []
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, BOARD, { boards, where: 'shared\t/r/api\n', config: 'role: project\nprojectId: api\n', hub: '/h/hub\n' })
    await $.session.start({ cwd: '/r/api', surface, isInteractive: true })
    await clock.advance(10)
    expect(boards.some(b => b.endsWith('board /h/hub'))).toBe(true)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ key: 'portfolio-mine' })).toBeDefined()
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: '  api (내 프로젝트)  ' })).toBeDefined()
    await pane.unmount()
  })

  test(`T5 ${surface}: with no hub pointer a shared-mode project shows no line, and the pane says what to do`, async ($, on) => {
    const boards: string[] = []
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, BOARD, { boards, where: 'shared\t/r/api\n', config: 'role: project\nprojectId: api\n' })
    await $.session.start({ cwd: '/r/api', surface, isInteractive: true })
    await clock.advance(10)
    expect(boards).toHaveLength(0)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: '◆' })).toBeUndefined()
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ key: 'pane-empty-no-hub' })).toBeDefined()
    expect((await pane.find({ key: 'pane-empty-no-hub' }))?.text).toMatch(/^api: hub를 찾지 못함/)
    await pane.unmount()
  })

  test(`T7 pane on ${surface}: reading, not a Kit repository`, async ($, on) => {
    let release = () => {}
    const gate = new Promise<void>(r => (release = r))
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, BOARD, { gate })
    await $.session.start({ cwd: '/h/hub', surface, isInteractive: true })
    await clock.advance(10)
    const waiting = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await waiting.find({ key: 'pane-empty-reading' })).toBeDefined()
    await waiting.unmount()
    release()
    await clock.advance(10)
    const done = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await done.find({ key: 'pane-empty-reading' })).toBeUndefined()
    await done.unmount()
  })

  test(`T7 pane on ${surface}: a folder that is no Kit project`, async ($, on) => {
    const clock = mock.clock(on, { now: Date.parse('2026-10-18T12:00:00+09:00') })
    world(on, BOARD, { whereFails: () => true })
    await $.session.start({ cwd: '/tmp/x', surface, isInteractive: true })
    await clock.advance(10)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ key: 'pane-empty-not-kit' })).toBeDefined()
    await pane.unmount()
  })
}

// A 13-column worker line; `age` is how long ago Orca last saw the Worker (default 1 minute, null: never).
const wrow = (o: { project?: string; task?: string; term?: string; port?: string; title?: string; model?: string; live?: string; age?: number | null; act?: string; att?: string } = {}) =>
  ['worker', o.project ?? 'app', o.task ?? '-', 'run_x', 'ready', o.model ?? 'claude/haiku', o.term ?? 'term_w', o.port ?? '-', o.title ?? '-', o.live ?? 'live',
    o.age === null ? '-' : String(NOW - (o.age ?? MIN)), o.act ?? 'working', o.att ?? '-'].join(T)
const PROJ = ['project', 'app', 'shared', '1', '-', '-', '-'].join(T)
const boardOf = (...rows: string[]) => [PROJ, ...rows].join('\n')
const wk = (o: Parameters<typeof wrow>[0] = {}) => parseBoard(wrow(o)).workers[0]!

test('W1 parseBoard: 13 columns, 7 columns, partial reads', () => {
  const b = parseBoard([wrow({ port: 'P1', title: '제목', age: 2 * MIN, att: 'input,failure' }), BOARD.split('\n').find(l => l.startsWith('worker'))!,
    `workers${T}partial${T}run_x: 응답 없음`, `workers${T}partial${T}run_y: 한 쪽을 넘는 Worker가 있음`].join('\n'))
  expect(b.workers[0]).toMatchObject({ project: 'app', port: 'P1', title: '제목', liveness: 'live', observedAt: NOW - 2 * MIN, activity: 'working', attention: ['input', 'failure'] })
  expect(b.workers[1]!.terminal).toBe('term_w')
  expect(b.workers[1]!.liveness).toBeUndefined()
  expect(b.workers[1]!.observedAt).toBeUndefined()
  expect(b.workersPartial).toBe('run_x: 응답 없음; run_y: 한 쪽을 넘는 Worker가 있음')
  expect(b.workersUnknown).toBeUndefined()
  const bare = wk({ age: null, act: '-', live: 'unverifiable:missing_status' })
  expect(bare.observedAt).toBeUndefined()
  expect(bare.activity).toBeUndefined()
  expect(bare.attention).toEqual([])
})

test('W2 workItems: one item per task, projects and links told apart', () => {
  const items = workItems([
    wk({ port: 'P1', title: '제목', model: 'claude/haiku', term: 'a' }), wk({ port: 'P1', title: '제목', model: 'codex/gpt', term: 'b' }), wk({ port: 'P1', model: 'claude/opus', term: 'c' }),
    wk({ task: 'APP-9', term: 'd' }), wk({ term: 'e' }), wk({ project: '-', term: 'f' }),
  ], NOW)
  expect(items.map(i => `${i.label}|${i.workers}|${i.providers.join(',')}`)).toEqual([
    'app / P1|3|claude,codex', 'app / APP-9|1|claude', 'app / 업무 연결 모름|1|claude', '프로젝트 모름 / 업무 연결 모름|1|claude',
  ])
  expect(items[0]!.title).toBe('제목')
})

test('W3 dotOf: the 5 and 15 minute lines, stale, unknown, waiting for an answer, waiting for a person', () => {
  const dot = (o: Parameters<typeof wrow>[0]) => dotOf(wk(o), NOW)
  expect([4 * MIN + 59_000, 5 * MIN, 5 * MIN + 1000, 15 * MIN, 15 * MIN + 1000].map(age => dot({ age }))).toEqual(['green', 'green', 'yellow', 'yellow', 'red'])
  expect(dot({ live: 'unverifiable:stale_status', age: 31 * MIN })).toBe('red')
  expect(dot({ live: 'unverifiable:missing_status', age: null })).toBe('unknown')
  expect(dot({ age: null })).toBe('unknown')
  expect(dot({ att: 'input', age: 20 * MIN })).toBe('gray')
  expect(dot({ act: 'blocked', age: 20 * MIN })).toBe('input')
  expect(dot({ att: 'approval', age: MIN })).toBe('input')
  const old = parseBoard(BOARD.split('\n').find(l => l.startsWith('worker'))!).workers[0]!
  expect(dotOf(old, NOW)).toBe('unknown')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`W4 ${surface}: a read that failed is shown as ?, never as 0 or none`, async ($, on) => {
    await boot($, on, surface, boardOf(['blocked', 'app', 'APP-1', '결정'].join(T), `workers${T}unknown${T}orca 응답 없음`))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    const progress = (await band.find({ key: 'portfolio-progress' }))?.text ?? ''
    expect(progress).toContain('?')
    expect(progress).not.toContain('0')
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect((await pane.find({ key: 'pane-progress' }))?.text).toContain('?')
    expect(await pane.find({ type: 'Text', text: /읽지 못함: orca 응답 없음/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '  없음' })).toBeUndefined()
    await pane.unmount()
  })

  test(`W4 ${surface}: a partial read keeps what was read and marks it with ?`, async ($, on) => {
    await boot($, on, surface, boardOf(wrow({ port: 'P1' }), `workers${T}partial${T}run_y: 응답 없음`))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ key: 'portfolio-progress' }))?.text).toContain('1?')
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: /일부 읽지 못함: run_y: 응답 없음/ })).toBeDefined()
    expect(await pane.find({ key: 'work-app-P1-green' })).toBeDefined()
    await pane.unmount()
  })

  test(`W4 ${surface}: a board command that failed says so, and keeps the last good data`, async ($, on) => {
    const w: World = {}
    const clock = await boot($, on, surface, boardOf(wrow({ port: 'P1' })), w)
    w.exit = 1; w.stderr = 'kit.sh: 실패\n'; w.board = ''
    await clock.advance(10_000)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ key: 'portfolio-checked' }))?.text).toContain('확인 실패')
    expect((await band.find({ key: 'portfolio-progress' }))?.text).toContain('1')
    await band.unmount()
  })

  test(`W4 ${surface}: a failed check on the band says how long ago the last good one was`, async ($, on) => {
    const w: World = {}
    const clock = await boot($, on, surface, boardOf(wrow({ port: 'P1' })), w)
    w.exit = 1; w.stderr = 'kit.sh: 실패\n'; w.board = ''
    await clock.advance(2 * MIN)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ key: 'portfolio-checked' }))?.text).toContain('마지막 성공')
    expect((await band.find({ type: 'Text', in: 'portfolio-checked-ok' }))?.text).toBe('2분 전')
    await band.unmount()
  })

  test(`W8 ${surface}: audit lines do not count as stalled; they sit under their own Run 점검 heading with their own counts`, async ($, on) => {
    const audit = [['run', 'app', 'run_q', '2026-10-02T00:00:00+09:00', 'gone', 'blocked=4'].join(T), ['run', 'app', 'run_r', '2026-10-03T00:00:00+09:00', 'gone', 'blocked=1'].join(T), ...Array.from({ length: 15 }, (_, i) => ['drift', 'app', 'unreported', `T${i}`].join(T))].join('\n')
    const clock = await boot($, on, surface, boardOf(wrow({ port: 'P1' })), { audit })
    await $.command.run({ command: 'portfolio-board', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
    await clock.advance(10)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect((await pane.find({ key: 'pane-stalled' }))?.text).toBe('멈춤·이상 0')
    expect((await pane.find({ key: 'pane-audit' }))?.text).toBe('Run 점검 2 · 상태 어긋남 15')
    await pane.unmount()
  })

  test(`W5 ${surface}: the time since the last check counts up, restarts on a new check, turns late`, async ($, on) => {
    const clock = await boot($, on, surface, boardOf(wrow({ port: 'P1' })))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    const ago = async () => band.find({ type: 'Text', in: 'portfolio-checked' })
    expect((await ago())?.text).toBe('확인 0초 전')
    expect((await ago())?.props.color).toBeUndefined()
    await band.advance(3000)
    expect((await ago())?.text).toBe('확인 3초 전')
    await band.advance(60_000)
    expect((await ago())?.text).toBe('확인 1분 전')
    expect((await ago())?.props.color).toBe('warning')
    await clock.advance(10_000)
    expect((await ago())?.text).toBe('확인 0초 전')
    expect((await ago())?.props.color).toBeUndefined()
    await band.unmount()
  })

  test(`W6 ${surface}: a Worker silent for 16 minutes is stalled; a task with one live Worker is not; waiting for an answer is not`, async ($, on) => {
    await boot($, on, surface, boardOf(wrow({ port: 'P1', age: 16 * MIN })))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ key: 'portfolio-stalled' }))?.text).toBe('멈춤 1')
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect((await pane.find({ key: 'pane-stalled' }))?.text).toBe('멈춤·이상 1')
    expect(await pane.find({ key: 'stalled-app-P1' })).toBeDefined()
    await pane.unmount()
  })

  test(`W6 ${surface}: only one of two Workers stalled leaves the task running, with a line under it`, async ($, on) => {
    await boot($, on, surface, boardOf(wrow({ port: 'P1', age: 16 * MIN, term: 'a' }), wrow({ port: 'P1', age: MIN, term: 'b' }), wrow({ port: 'P2', age: 20 * MIN, att: 'input', term: 'c' })))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ key: 'portfolio-stalled' })).toBeUndefined()
    expect((await band.find({ key: 'portfolio-progress' }))?.text).toContain('2')
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ key: 'work-app-P1-green' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /멈춤 의심 Worker 1/ })).toBeDefined()
    expect(await pane.find({ key: 'work-app-P2-gray' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /답 기다림/ })).toBeDefined()
    expect((await pane.find({ key: 'pane-stalled' }))?.text).toBe('멈춤·이상 0')
    await pane.unmount()
  })

  test(`W6 ${surface}: a Worker that waits for a person counts as stalled and says what it needs`, async ($, on) => {
    await boot($, on, surface, boardOf(wrow({ port: 'P1', act: 'blocked' })))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect((await band.find({ key: 'portfolio-stalled' }))?.text).toBe('멈춤 1')
    await band.unmount()
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: /사람 입력 필요/ })).toBeDefined()
    await pane.unmount()
  })

  test(`W7 ${surface}: the check time moves on every check, the data change time only when the data changes`, async ($, on) => {
    const w: World = {}
    const clock = await boot($, on, surface, boardOf(wrow({ port: 'P1' })), w)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    const read = async () => [(await pane.find({ key: 'pane-checked-at' }))?.text, (await pane.find({ key: 'pane-changed' }))?.text]
    const [checked, changed] = await read()
    expect(changed).toMatch(/데이터 변경 \d\d:\d\d/)
    await clock.advance(61_000)
    const [checked2, changed2] = await read()
    expect(checked2).not.toBe(checked)
    expect(changed2).toBe(changed)
    // Orca seeing the Worker again moves lastObservedAt every time: that is not a change
    w.board = boardOf(wrow({ port: 'P1', age: 10_000 }))
    await clock.advance(61_000)
    expect((await read())[1]).toBe(changed)
    w.board = boardOf(wrow({ port: 'P1' }), wrow({ port: 'P2', term: 'b' }))
    await clock.advance(61_000)
    expect((await read())[1]).not.toBe(changed)
    await pane.unmount()
  })

  test(`W8 ${surface}: audit runs only once the pane is opened, then every 5 minutes; its findings and failure show in the pane`, async ($, on) => {
    const calls: string[] = []
    const w: World = { calls, audit: [['run', 'app', 'run_q', '2026-10-02T00:00:00+09:00', 'gone', 'blocked=4'].join(T), ['drift', 'app', 'unreported', 'APP-0001'].join(T)].join('\n') }
    const clock = await boot($, on, surface, BOARD, w)
    const audits = () => calls.filter(c => c === 'audit').length
    await clock.advance(120_000)
    expect(audits()).toBe(0)
    await $.command.run({ command: 'portfolio-board', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
    await clock.advance(10)
    expect(audits()).toBe(1)
    await clock.advance(299_000)
    expect(audits()).toBe(1)
    await clock.advance(2_000)
    expect(audits()).toBe(2)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: /Coordinator 없는 Run: run_q/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /상태 어긋남: app/ })).toBeDefined()
    await pane.unmount()
    w.auditExit = 1
    await clock.advance(300_000)
    const failed = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await failed.find({ type: 'Text', text: /Run 점검 못 함/ })).toBeDefined()
    await failed.unmount()
  })

  for (const [name, git, expected] of [['a Kit-less repository top', '/h/x\n\n', 1], ['a Kit-less repository subfolder', '/h/x\nsub/\n', 2]] as const) {
    test(`W9 ${surface}: ${name}: kit.sh where runs ${expected} time(s) per turn`, async ($, on) => {
      const calls: string[] = []
      const clock = mock.clock(on, { now: NOW })
      world(on, BOARD, { calls, whereFails: () => true, git })
      await $.session.start({ cwd: '/h/x', surface, isInteractive: true })
      await clock.advance(10)
      const before = calls.filter(c => c === 'where').length
      await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
      await clock.advance(10)
      expect(calls.filter(c => c === 'where').length - before).toBe(expected)
    })
  }
}

// User decision requests: kit.sh adds a `decision` line per open request; the line, the pane and the command it points at.
const DECISIONS = [
  ['decision', 'app', 'APP-0001-d01', 'waiting', '2026-10-18T09:00:00+09:00', 'Worker 계획 승인', '/r/app/.ai/user-decisions/APP-0001-d01.md', '/h/hub/handoffs/user-decisions/app'],
  ['decision', 'api', 'API-0002-d01', 'answered', '2026-10-18T09:10:00+09:00', '범위 결정', '/r/api/.ai/user-decisions/API-0002-d01.md', '/h/hub/handoffs/user-decisions/api'],
  ['decision', 'api', 'API-0003-d01', 'asking', '2026-10-18T09:20:00+09:00', '배포 승인', '/r/api/.ai/user-decisions/API-0003-d01.md', '/h/hub/handoffs/user-decisions/api'],
  ['decision', 'api', 'API-0004-d01', 'bogus', '2026-10-18T09:30:00+09:00', '모르는 상태', '/r/api/.ai/user-decisions/API-0004-d01.md', '/h/hub/handoffs/user-decisions/api'],
  ['decision', 'api', 'API-0005-d01', 'waiting'],
].map(r => r.join(T)).join('\n')

test('parseBoard reads decision lines with their state, time and paths; an unknown state or a short line is skipped', () => {
  const b = parseBoard(DECISIONS)
  expect(b.items.map(i => `${i.kind}:${i.project}:${i.id}:${i.state}`)).toEqual(['decision:app:APP-0001-d01:waiting', 'decision:api:API-0002-d01:answered', 'decision:api:API-0003-d01:asking'])
  expect(b.items[0]).toEqual({
    kind: 'decision', project: 'app', id: 'APP-0001-d01', text: '대기 · Worker 계획 승인', state: 'waiting', createdAt: '2026-10-18T09:00:00+09:00',
    file: '/r/app/.ai/user-decisions/APP-0001-d01.md', answerDir: '/h/hub/handoffs/user-decisions/app',
  })
  expect(b.items.map(i => i.text)).toEqual(['대기 · Worker 계획 승인', '답 도착 · 범위 결정', '묻는 중 · 배포 승인'])
})

test('bandParts: waiting decisions are counted after the blockers and before the reports', () => {
  const parts = bandParts(parseBoard(`${BOARD}\n${DECISIONS}`), NOW).map(p => `${p.label}/${p.tone}`)
  expect(parts).toEqual(['블로커 1/error', '결정 대기 3/warning', '보고 대기 2/warning', '위임 미수락 1/warning', '검토 필요 1/warning', '진행 1/suggestion'])
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pane on ${surface}: decisions show their state and the first waiting one points at /decide`, async ($, on) => {
    await boot($, on, surface, DECISIONS)
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    expect(await pane.find({ type: 'Text', text: /APP-0001-d01 · 대기 · Worker 계획 승인 {2}→ \/decide/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /API-0002-d01 · 답 도착 · 범위 결정$/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /API-0003-d01 · 묻는 중 · 배포 승인$/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /결정 대기 1/ })).toBeDefined()
    await pane.unmount()
  })
}
