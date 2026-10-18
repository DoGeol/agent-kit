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

type World = { terminal?: string; where?: string; config?: string; opened?: string[]; exit?: number; stderr?: string; boards?: string[] }

const world = (on: On, board: string, w: World = {}) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : e.name === 'ORCA_TERMINAL_HANDLE' ? w.terminal : undefined }))
  on('process.run', (_, e) => {
    const isWhere = e.argv.includes('where')
    if (!isWhere) w.boards?.push(e.argv.join(' '))
    return {
      value: {
        exitCode: isWhere ? 0 : (w.exit ?? 0), stdout: isWhere ? (w.where ?? 'shared\t/h/hub\n') : board, stderr: isWhere ? '' : (w.stderr ?? ''),
        isStdoutTruncated: false, isStderrTruncated: false,
      },
    }
  })
  on('fs.read', () => ({ value: w.config ?? 'role: portfolio\n' }))
  on('ui.open', (_, e) => {
    w.opened?.push(e.id)
    return { value: { isPlaced: true } }
  })
  // stands for mods-hud's card or the engine's own band beneath this plugin
  on('ui.render', () => ({ type: 'Text', children: ['HUD card'] }))
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

  test(`band line on ${surface}: counts shown under the card beneath`, async ($, on) => {
    await boot($, on, surface, BOARD)
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: 'HUD card' })).toBeDefined()
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

  test(`band line on ${surface}: nothing when all clear`, async ($, on) => {
    await boot($, on, surface, ['project', 'app', 'shared', '0', '-', '-', '-'].join(T))
    const band = await $.ui.mount({ plugin: 'orchestration-kit', surface, component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: '◆' })).toBeUndefined()
    expect(await band.find({ type: 'Text', text: 'HUD card' })).toBeDefined()
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
