import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'

import { ago, bandParts, hubFrom, mineFirst, parseBoard } from '../hooks/register'

const T = '\t'
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

test('bandParts: blocker first, zero counts hidden, nothing when all clear', () => {
  const b = parseBoard(BOARD)
  expect(bandParts(b).map(p => `${p.label}/${p.tone}`)).toEqual(['블로커 1/error', '보고 대기 2/warning', '위임 미수락 1/warning', '검토 필요 1/warning', 'Worker 1 진행/suggestion'])
  expect(bandParts({ items: [], workers: [] })).toEqual([])
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
}

const world = (on: On, board: string, w: World = {}) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : e.name === 'ORCA_TERMINAL_HANDLE' ? w.terminal : undefined }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('process.run', async (_, e) => {
    const kind = e.argv.includes('where') ? 'where' : e.argv.includes('hub') ? 'hub' : e.argv[0] === 'git' ? 'git' : 'board'
    w.calls?.push(kind)
    const out = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
    if (kind === 'board') {
      w.boards?.push(e.argv.join(' '))
      await w.gate
      return out(w.exit ?? 0, board, w.stderr ?? '')
    }
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
    for (const text of ['처리할 것 5', '진행 중 Worker 1', '전체 프로젝트 2']) expect(await pane.find({ type: 'Text', text })).toBeDefined()
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

  test(`pane on ${surface}: an unchanged board keeps its time`, async ($, on) => {
    const boards: string[] = []
    const clock = await boot($, on, surface, BOARD, { boards })
    const pane = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'Pane', requestId: 'portfolio-board', props: PANE } as never)
    const head = (await pane.find({ type: 'Text', text: /변경 · / }))?.text
    expect(head).toContain('~/hub')
    await clock.advance(61_000)
    expect(boards.length).toBeGreaterThan(1)
    expect((await pane.find({ type: 'Text', text: /변경 · / }))?.text).toBe(head)
    await pane.unmount()
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
