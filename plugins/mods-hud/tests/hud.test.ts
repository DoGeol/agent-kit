import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { cells, detailView, summaryLine } from '../hooks/register'

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const NOW = new Date(2026, 9, 11, 12, 0).getTime()

const BAND = {
  hasSurvey: false,
  isWorking: true,
  maxRows: 16,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
} as const

type World = { failUsage?: true; usage?: typeof USAGE; agentText?: string; completes?: string[]; perModel?: Record<string, { effortLevel: string }>; five?: number; statuses?: (string | undefined)[]; model?: string; effort?: string; forkText?: string; list: { id: string; type: string; description: string; status: 'running' | 'completed' | 'idle' }[]; forks: string[] }

const world = (on: On, w: World) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.model', () => ({ value: w.model ?? 'claude-opus-5-5' }))
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
  on('agent.list', () => ({ value: w.list }))
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

test('summary line, three recent agents, a rule, then the fixed status line', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: '<agent-message>x</agent-message>', origin: { kind: 'unclassified' }, wait: false })
  await $.prompt.submit({ text: 'UI 바꿔줘', origin: { kind: 'composer' }, wait: false })

  for (const [i, id] of ['a1', 'a2', 'a3', 'a4'].entries()) {
    w.list.push({ id, type: i === 3 ? 'Plan' : 'Explore', description: `작업 ${id}`, status: 'running' })
    await clock.advance(2000)
  }
  await $.tool.call({ tool: 'Grep', tool_use_id: 't1', agentId: 'a4', pattern: 'x' } as never)
  w.list[2]!.status = 'completed'
  await clock.advance(2000)

  // before the first summary the typed prompt stands in
  const first = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await first.find({ type: 'Text', text: 'UI 바꿔줘' })).toBeDefined()
  await first.unmount()

  await $.turn.complete({ answer: '했어요', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.settle()
  expect(w.forks.length).toBe(1)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /^모니터 band 레이아웃 정리 중$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^진행 중$/ }))?.props.color).toBe('warning')
    // the agents fold into one line with their counts until unfolded
    const fold = await ui.find({ key: 'agents-line' })
    expect(fold?.text.trim()).toMatch(/^[▸▾] 서브에이전트 4  진행 중 3 · 완료 1$/)
    if (String(fold?.text.trim()).startsWith('▸')) {
      expect(await ui.find({ type: 'Text', text: /^작업 a4$/ })).toBeUndefined()
      await ui.press({ key: 'agents' })
    }
    // unfolded: live rows, then the finished one dimmed below them
    expect(await ui.find({ type: 'Text', text: /^작업 a4$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^작업 a2$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^작업 a1$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^작업 a3$/ }))?.props.dimColor).toBe(true)
    expect((await ui.findAll({ type: 'Text', text: /^완료$/ })).some(t => t.props.color === 'success')).toBe(true)
    expect(await ui.find({ type: 'Text', text: /^→ Grep "x"$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /회/ })).toBeUndefined()
    expect(await ui.find({ key: 'done' })).toBeUndefined()
    // no drawn dividers: each figure is its own cell in a bordered block
    expect(await ui.find({ type: 'Text', text: /[│|─]/ })).toBeUndefined()
    if (surface === 'terminal') {
      // one card holds the whole band in the terminal; the usage line sits inside it
      expect((await ui.find({ type: 'Box', key: 'band' }))?.props.borderStyle).toBe('round')
      expect((await ui.find({ type: 'Box', key: 'status' }))?.props.borderStyle).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /^Opus 5\.5 high$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^· 5h 63%\(15:30\)$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^· w 77%\(10\/14 12:00\)$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^· ctx 18%$/ })).toBeDefined()
    }

    await ui.unmount()
  }
})

test('a multi-line summary still draws as one line', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [], forkText: '- **목표**: 첫 줄\n- **진행**: 둘째 줄' }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /^목표: 첫 줄$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /둘째 줄/ })).toBeUndefined()
})

test('/summary pane draws the same monitor in a pane', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'UI 바꿔줘', origin: { kind: 'composer' }, wait: false })
  await clock.settle()
  const ran = await $.command.run({ command: 'mods-hud', args: 'pane', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect(ran.text).toBe('모니터 패널 열림.')
  expect(opened).toEqual(['session-monitor'])
  const ui = await $.ui.mount({
    plugin: 'mods-hud', surface: 'desktop', component: 'Pane', requestId: 'session-monitor',
    props: { title: 'Session', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 8 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: 'UI 바꿔줘' })).toBeDefined()
  // on the desktop usage lives in the app's own bar, not in the pane
  expect(await ui.find({ type: 'Text', text: /5시간 63%/ })).toBeUndefined()
})

test('a finished turn reads 완료 dimmed, a failed one 중지 red', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'UI 바꿔줘', origin: { kind: 'composer' }, wait: false })
  await $.turn.complete({ answer: '했어요', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.settle()

  const idle = { ...BAND, isWorking: false }
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: idle })
  const word = await ui.find({ type: 'Text', text: /^완료$/ })
  expect(word?.props.color).toBe('success')
  expect((await ui.find({ type: 'Text', text: /^모니터 band 레이아웃 정리 중$/ }))?.props.dimColor).toBe(true)
  await ui.unmount()

  await $.turn.complete({ answer: '', durationMs: 5, isAborted: false, turnId: 'm2', reason: 'error' })
  await clock.settle()
  const bad = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: idle })
  expect((await bad.find({ type: 'Text', text: /^중지$/ }))?.props.color).toBe('error')
})

test('model and effort changes show within a tick, before any request; states are the four words', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const idle = { ...BAND, isWorking: false }
  const look = async () => {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: idle })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
    await ui.unmount()
    return texts
  }
  expect(await look()).toContain('대기')
  expect(await look()).toContain('Opus 5.5')
  expect((await look()).some(t => t === 'Opus 5.5 high')).toBe(true)

  w.model = 'claude-fable-5-1'
  w.effort = 'xhigh'
  await clock.advance(2000)
  const after = await look()
  expect(after).toContain('Fable 5.1')
  expect(after.some(t => t === 'Fable 5.1 xhigh')).toBe(true)

  await $.classic.PostModelSwitch({ from_model: 'claude-fable-5-1', to_model: 'claude-opus-5-5', requested_model: 'opus', source: 'command', context_tokens: 0 } as never)
  expect(await look()).toContain('Opus 5.5')

  // /effort and /model save the level per model; the top-level effortLevel stays put
  w.model = 'claude-opus-5-5'
  w.perModel = { 'claude-opus-5-5': { effortLevel: 'low' }, 'claude-fable-5-1': { effortLevel: 'medium' } }
  await clock.advance(2000)
  expect((await look()).some(t => t === 'Opus 5.5 low')).toBe(true)
  w.model = 'claude-fable-5-1'
  await clock.advance(2000)
  expect((await look()).some(t => t === 'Fable 5.1 medium')).toBe(true)

  await $.turn.start({ text: 'go', turnId: 't1' })
  expect(await look()).toContain('진행 중')
  expect(await look()).toContain('Fable 5.1(medium)')
  await $.turn.complete({ answer: '', durationMs: 5, isAborted: true, turnId: 't1', reason: 'aborted' })
  expect(await look()).toContain('중지')
})

test('a long summary stays one line cut with …, with no toggle on any surface', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const long = '앱과 터미널 모두에서 모델, effort, 사용량, 서브에이전트, 진행 요약을 한눈에 보는 모니터를 다듬는 중'
  const w: World = { list: [], forks: [], forkText: long }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.settle()
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: { ...BAND, isWorking: false, bodyColumns: 70 } })
    expect((await ui.findAll({ type: 'Text' })).find(t => t.text.endsWith('…') && long.startsWith(t.text.slice(0, -1)))?.props.wrap).toBe('truncate-end')
    expect(await ui.find({ key: 'full' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the desktop bar gets usage as status; the desktop band drops the box; the terminal keeps it', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const statuses: (string | undefined)[] = []
  const w: World = { list: [], forks: [], statuses }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  expect(statuses.at(-1)).toBe('5h 63%(15:30) · w 77%(10/14 12:00) · ctx 18%')
  await clock.advance(2000)
  expect(statuses.length).toBe(1)

  const desk = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await desk.find({ type: 'Box', key: 'status' })).toBeUndefined()
  expect(await desk.find({ type: 'Text', text: /5시간/ })).toBeUndefined()
  await desk.unmount()
  const term = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await term.find({ type: 'Text', text: /^Opus 5\.5 high$/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /^· 5h 63%/ })).toBeDefined()
})

test('the desktop footer draws colored usage and nothing hidden', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const statuses: (string | undefined)[] = []
  const w: World = { list: [], forks: [], statuses }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'SessionMode', props: { modes: ['focus'] }, viewport: { columns: 140, rows: 40 } })
  await clock.advance(2000)
  expect(statuses.filter(Boolean).length).toBe(0)
  // figures carried from before any response read gray
  expect((await ui.find({ type: 'Text', text: /^63%$/ }))?.props.dimColor).toBe(true)
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  const pct = async (re: RegExp) => (await ui.findAll({ type: 'Text', text: re })).find(t => t.props.color !== undefined)
  expect((await pct(/^63%$/))?.props.color).toBe('success')
  expect((await pct(/^77%$/))?.props.color).toBe('warning')
  expect(await ui.find({ type: 'Text', text: /^· focus$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /mods-hud/ })).toBeUndefined()
  // nothing hidden in the slot: a hidden card counts into its width on the desktop
  expect(await ui.find({ type: 'Box', text: /리셋/ })).toBeUndefined()
})

test('the footer fits its fixed slot: reset dates go first, then times', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [], statuses: [], five: 6 }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'SessionMode', props: { modes: [] }, viewport: { columns: 140, rows: 40 } })
  const text = (await ui.findAll({ type: 'Text' })).filter(t => /^(· )?(5h|w|ctx) \d/.test(t.text)).map(t => t.text).join(' ')
  expect(text).toBe('5h 6%(15:30) · w 77% · ctx 18%')
  await clock.settle()
})

test('a subagent shows from its spawn, its row follows each tool call, and its end is 완료', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [], statuses: [] }
  world(on, w)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ toolUseId: 'tu1', prompt: 'count', description: '파일 개수 세기', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)

  const look = async () => {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
    await ui.unmount()
    return texts
  }
  // not in the engine's list (a background agent): still shown, from the spawn alone
  expect(await look()).toEqual(expect.arrayContaining(['Explore', '파일 개수 세기', '→ 시작']))
  // the spawn names its model
  expect(await look()).toContain('Haiku 5.5')

  await $.tool.call({ tool: 'Bash', tool_use_id: 't1', agentId: 'bg1', command: 'ls -la | wc -l', description: 'Count files' } as never)
  expect(await look()).toContain('→ Bash Count files')
  await $.tool.call({ tool: 'Read', tool_use_id: 't2', agentId: 'bg1', file_path: '/a/b/login.ts' } as never)
  const reading = await look()
  expect(reading).toContain('→ Read login.ts')
  expect(reading).toContain('Haiku 5.5')

  // the main turn ends while the background agent works: still 진행 중
  await $.turn.complete({ answer: 'waiting', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.settle()
  const forksBefore = w.forks.length
  const idleUi = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect((await idleUi.findAll({ type: 'Text', text: /^진행 중$/ })).length).toBe(2)
  expect(await idleUi.find({ type: 'Text', text: /^완료$/ })).toBeUndefined()
  await idleUi.unmount()

  await $.turn.complete({ answer: '3', durationMs: 5, isAborted: false, turnId: 'c1', reason: 'answer', agentId: 'bg1' })
  await clock.settle()
  expect(w.forks.length).toBe(forksBefore + 1)
  expect(w.forks.at(-1)).toContain('3')
  const done = await look()
  expect(done.some(t => t.includes('파일 개수 세기'))).toBe(false)
  await clock.settle()
})

test('/summary usage prints every window with its reset, the time left, and what this mod spent', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [], statuses: [] }
  on('session.messages', () => ({
    value: [
      { role: 'user', text: '로그인 고쳐줘', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'r1', tool: 'Read', input: { file_path: '/a/login.ts' }, text: 'x' }] },
    ],
  }) as never)
  w.usage = { ...USAGE, input_tokens: 1200, output_tokens: 20 }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: '고쳤어', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.settle()
  // the session line asks Haiku with the turn's ask, its calls and the answer: not the whole conversation
  expect(w.forks[0]).toContain('[요청]\n로그인 고쳐줘')
  expect(w.forks[0]).toContain('[최근 단계]\nRead login.ts')
  expect(w.forks[0]).toContain('[마지막 답변]\n고쳤어')
  const ran = await $.command.run({ command: 'mods-hud', args: 'usage', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect(ran.text).toBe(
    '5시간 한도 63% · 15:30 리셋 (3시간 30분 후)\n주간 한도 77% · 10/14(수) 12:00 리셋 (3일 0시간 후)\n컨텍스트 18%\n모델 Opus 5.5 · effort high\n\n' +
      '이 모드의 요청 (Haiku)\n세션 요약 1회 · 입력 1.2k · 출력 20 토큰\n서브에이전트 요약 0회 · 입력 0 · 출력 0 토큰\n오케스트레이션 요약 0회 · 입력 0 · 출력 0 토큰',
  )
})

test('a window past its reset reads 0% before any response', async ($, on) => {
  const clock = mock.clock(on, { now: new Date(2026, 9, 11, 16, 0).getTime() })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await clock.advance(2000)
  const ran = await $.command.run({ command: 'mods-hud', args: 'usage', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect(ran.text?.split('\n')[0]).toBe('5시간 한도 0% · 리셋 시각 없음')
})

test('a moved figure flashes blue for a moment; usage goes gray after 5 minutes without a response', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  const color = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.props.color

  w.model = 'claude-fable-5-1'
  await clock.advance(2000)
  expect(await color(/^Fable 5\.1$/)).toBe('suggestion')
  await $.session.measure({ context: { percent: 30 }, rateLimits: [{ kind: 'five_hour', percentUsed: 12 }], changed: ['rateLimits'] } as never)
  await clock.advance(2000)
  expect(await color(/^12%$/)).toBe('suggestion')
  await clock.advance(6000)
  expect(await color(/^Fable 5\.1$/)).toBeUndefined()
  expect(await color(/^12%$/)).toBe('success')
  expect(await ui.find({ type: 'Text', text: /기준$/ })).toBeUndefined()

  await clock.advance(5 * 60_000)
  expect((await ui.find({ type: 'Text', text: /^12%$/ }))?.props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^· 12:00 기준$/ })).toBeDefined()
})

test('after /effort the pick shows within a fraction of a second', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [], model: 'claude-opus-5-5' }
  // the picker answers at once; the person picks a moment later and settings take it then
  on('command.run', { command: 'effort' }, () => ({ text: '' }))
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  await $.command.run({ command: 'effort', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  await clock.advance(700)
  w.perModel = { 'claude-opus-5-5': { effortLevel: 'low' } }
  await clock.advance(200)
  expect(await ui.find({ type: 'Text', text: /^ low$/ })).toBeDefined()
})

test('a narrow band shows states as colored dots alone, agents included', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  for (const [cols, words] of [[120, 2], [70, 0]] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, bodyColumns: cols } })
    expect((await ui.findAll({ type: 'Text', text: /^진행 중$/ })).length).toBe(words)
    const dots = (await ui.findAll({ type: 'Text', text: /^●$/ })).map(t => t.props.color)
    expect(dots).toEqual(['warning', 'warning'])
    await ui.unmount()
  }
})

test('an agent keeps its step line between calls; idle (turn ended) reads as done', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const steps = async () => {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
    const found = (await ui.findAll({ type: 'Text', text: /^→ / })).map(t => t.text)
    await ui.unmount()
    return found
  }
  expect(await steps()).toEqual(['→ …'])
  await $.tool.call({ tool: 'Grep', tool_use_id: 't1', agentId: 'a1', pattern: 'x' } as never)
  expect(await steps()).toEqual(['→ Grep "x"'])
  // idle: its turn ended and it waits for a message, so it reads as done, not 진행 중
  w.list[0]!.status = 'idle'
  await clock.advance(2000)
  expect(await steps()).toEqual([])
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // a lone agent shows as its row: ✓ 완료, closable
  expect((await ui.find({ type: 'Text', text: /^완료$/ }))?.props.color).toBe('success')
  expect(await ui.find({ key: 'hide-a1' })).toBeDefined()
  await ui.unmount()
  // a message wakes it
  w.list[0]!.status = 'running'
  await clock.advance(2000)
  expect(await steps()).toEqual(['→ Grep "x"'])
  w.list[0]!.status = 'completed'
  await clock.advance(2000)
  expect(await steps()).toEqual([])
})

test('a reload keeps each agent row whole: its model stays shown', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 'spawn1', prompt: 'p', description: '파일 세기', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)
  w.list.push({ id: 'bg1', type: 'Explore', description: '파일 세기', status: 'running' })
  await clock.advance(2000)
  // the module starts over on a reload; the rows in state stay
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /^Haiku 5\.5$/ })).toBeDefined()
})

const PANE_PROPS = { title: 'd', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 10 }, view: {} } as const

test('a press on a row opens the detail pane on it, with its recent calls', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a9', type: 'Explore', description: '작업 a9', status: 'running' }], forks: [] }
  world(on, w)
  const opened: string[] = []
  on('ui.open', (_, e) => (opened.push(`${e.id}:${e.title}`), { value: { isPlaced: true } }) as never)
  on('session.messages', (_, e) => ({
    value: (e as { agentId?: string }).agentId === 'a9'
      ? [
          { role: 'assistant', text: '세는 중', toolUses: [{ tool_use_id: 'b1', tool: 'Bash', input: { command: 'ls', description: 'List files' }, text: 'ok' }] },
          { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'b2', tool: 'Grep', input: { pattern: 'x' } }] },
        ]
      : [{ role: 'assistant', text: '메인 답', toolUses: [{ tool_use_id: 'm1', tool: 'Read', input: { file_path: '/a/b.ts' }, text: 'x' }] }],
  }) as never)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const band = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'go-a9' })
  expect(opened).toEqual(['session-detail:Explore · 작업 a9'])

  const pane = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'Pane', requestId: 'session-detail', props: PANE_PROPS })
  const texts = (await pane.findAll({ type: 'Text' })).map(t => t.text)
  expect(texts).toContain('Bash List files')
  expect(texts).toContain('Grep "x"')
  expect((await pane.find({ type: 'Text', text: /^●$/ }))?.props.color).toBe('warning') // still running
  expect((await pane.find({ type: 'Text', text: /^✓$/ }))?.props.color).toBe('success')
  expect(texts).toContain('“세는 중”')
  await pane.unmount()

  await band.press({ key: 'go-session' })
  const main = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'Pane', requestId: 'session-detail', props: PANE_PROPS })
  // the main calls sit on their own tab, the agents on 현재
  await main.press({ key: 'tab-calls' })
  expect((await main.findAll({ type: 'Text' })).map(t => t.text)).toContain('Read b.ts')
  await main.press({ key: 'tab-live' })
  const mainTexts = (await main.findAll({ type: 'Text' })).map(t => t.text)
  expect(mainTexts).toContain('서브에이전트 1')
  expect((await main.find({ key: 'open-a9' }))?.text).toBe('● Explore 작업 a9')
  await main.press({ key: 'open-a9' })
  expect((await main.findAll({ type: 'Text' })).map(t => t.text)).toContain('Grep "x"')
  await main.press({ key: 'back' })
  expect((await main.findAll({ type: 'Text' })).map(t => t.text)).toContain('서브에이전트 1')
})

test('a lone agent stays shown however few rows the surface gives', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  for (const [rows, steps] of [[2, 0], [3, 1], [4, 1], [5, 1], [6, 1]] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, maxRows: rows } })
    expect(await ui.find({ type: 'Text', text: /^작업 a1$/ })).toBeDefined()
    expect((await ui.findAll({ type: 'Text', text: /^→ / })).length).toBe(steps)
    await ui.unmount()
  }
})

test('an agent gets a Korean line as it starts, a check-in every two minutes it works, and a result line when it ends; off sends none', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const completes: string[] = []
  const w: World = { list: [], forks: [], completes }
  world(on, w)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  on('session.messages', () => ({ value: [{ role: 'assistant', text: '세는 중', toolUses: [{ tool_use_id: 'b1', tool: 'Bash', input: { command: 'ls', description: 'List files' } }] }] }) as never)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'p', description: 'Count txt files', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)
  const label = async () => {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
    const t = (await ui.find({ key: 'go-bg1' }))?.text
    await ui.unmount()
    return t
  }
  const call = (n: number) => $.tool.call({ tool: 'Bash', tool_use_id: `t${n}`, agentId: 'bg1', command: 'ls', description: 'List files' } as never)

  // its task in Korean as it starts
  await clock.settle()
  expect(completes.length).toBe(1)
  expect(completes[0]).toContain('방금 시작한')
  expect(completes[0]).toContain('[작업] Count txt files')
  expect(await label()).toBe('파일 세는 중')
  // calls inside two minutes: no new line
  for (const n of [1, 2, 3]) await call(n)
  await clock.settle()
  expect(completes.length).toBe(1)
  // two minutes on, the next call brings a check-in over its recent steps
  await clock.advance(120_000)
  await call(4)
  await clock.settle()
  expect(completes.length).toBe(2)
  expect(completes[1]).toContain('Bash List files')
  // idle for two more minutes: nothing new to say, nothing asked
  await clock.advance(120_000)
  expect(completes.length).toBe(2)
  // a drifted line (issue 009) is dropped, the last one stays, and it still counts as the check-in
  w.agentText = '파일을 세고 있습니다'
  for (const n of [5, 6, 7]) await call(n)
  await clock.settle()
  expect(completes.length).toBe(3)
  expect(await label()).toBe('파일 세는 중')

  w.agentText = '텍스트 파일 653개 찾음'
  await $.turn.complete({ answer: '653', durationMs: 5, isAborted: false, turnId: 'x', reason: 'answer', agentId: 'bg1' } as never)
  await clock.settle()
  expect(completes.length).toBe(4)
  expect(completes[3]).toContain('결과')
  // the final answer from turn.complete goes in, even when the transcript lacks it
  expect(completes[3]).toContain('[마지막 말]\n653')
  expect(await label()).toBe('텍스트 파일 653개 찾음')

  await $.command.run({ command: 'mods-hud', args: 'agents off', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  await $.agent.spawn({ tool_use_id: 's2', prompt: 'p', description: 'other', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)
  await call(8)
  await call(9)
  await clock.settle()
  expect(completes.length).toBe(4)
})

test('a live agent stops on a second press; a stopped one resumes or closes; a finished one closes', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }, { id: 'a2', type: 'Plan', description: '작업 a2', status: 'completed' }], forks: [] }
  const stops: unknown[] = []
  on('tool.call', { tool: 'TaskStop' }, (_, e) => (stops.push((e as unknown as { task_id: string }).task_id), { result: 'stopped' }) as never)
  const sent: unknown[] = []
  on('tool.call', { tool: 'SendMessage' }, (_, e) => {
    const m = e as unknown as { to: string; message: string }
    sent.push({ to: m.to, message: m.message })
    return { result: 'sent' } as never
  })
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'agents-line' }))?.text.trim()).toBe('▸ 서브에이전트 2  진행 중 1 · 완료 1')
  await ui.press({ key: 'agents' })
  await ui.press({ key: 'stop-a1' })
  expect(stops).toEqual([])
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('종료?')
  // the arm lapses
  await clock.advance(3000)
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('■')
  await ui.press({ key: 'stop-a1' })
  await ui.press({ key: 'stop-a1' })
  expect(stops).toEqual(['a1'])

  expect(await ui.find({ type: 'Text', text: /^작업 a2$/ })).toBeDefined()
  await ui.press({ key: 'hide-a2' })
  expect(await ui.find({ type: 'Text', text: /^작업 a2$/ })).toBeUndefined()
  // one left: no fold line
  expect(await ui.find({ key: 'agents' })).toBeUndefined()

  // a stopped one ends: no step line; ↻ resumes it, ✕ closes it, no ■
  w.list[0]!.status = 'killed' as never
  await clock.advance(2000)
  expect(await ui.find({ key: 'hide-a1' })).toBeDefined()
  expect(await ui.find({ key: 'stop-a1' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^→ / })).toBeUndefined()
  await ui.press({ key: 'resume-a1' })
  expect(sent).toEqual([{ to: 'a1', message: '중단된 지점부터 이어서 작업을 계속해줘.' }])
  expect(await ui.find({ key: 'stop-a1' })).toBeDefined()
})

test('calls from an agent never started or listed (a fork) draw no row and keep nothing 진행 중', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await $.tool.call({ tool: 'Skill', tool_use_id: 't1', agentId: 'fork1', skill: 'caveman' } as never)
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await ui.find({ type: 'Text', text: /^agent$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^진행 중$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^완료$/ })).toBeDefined()
})

// Orchestration: other sessions this one messages.
const send = ($: Engine, to: string, message: string, agentId?: string) =>
  $.tool.call({ tool: 'SendMessage', tool_use_id: `s-${to}`, to, message, ...(agentId ? { agentId } : {}) } as never)
const peerMsg = (from: string, body: string) => `<agent-message from="${from}">${body}</agent-message>`

test('a SendMessage to another session makes a session row under its own fold line; one to a subagent makes none', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  await send($, 'a1', '계속해')
  await send($, 'worker-b', '로그인 버그를 고쳐줘\n자세한 건 아래')
  await send($, 'other [r2]', '빌드 확인 부탁')
  // a subagent's own send is not this session's orchestration
  await send($, 'zz', 'x', 'a1')
  await clock.advance(30_000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const fold = await ui.find({ key: 'sessions-line' })
  expect(fold?.text.trim()).toBe('▸ 오케스트레이션 2  대기 2')
  expect(await ui.find({ type: 'Text', text: /^worker-b$/ })).toBeUndefined()
  await ui.press({ key: 'sessions' })
  expect(await ui.find({ type: 'Text', text: /^worker-b$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^other$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^a1$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^zz$/ })).toBeUndefined()
  expect((await ui.find({ key: 'go-s-worker-b' }))?.text).toBe('로그인 버그를 고쳐줘')
  expect(await ui.find({ type: 'Text', text: /^↑ 30초 전$/ })).toBeDefined()
  // its unknown dot is dim
  expect((await ui.findAll({ type: 'Text', text: /^◇$/ })).every(t => t.props.dimColor === true)).toBe(true)
})

test('an incoming agent-message makes or updates a session row and gets a Korean line; a subagent hand-back none', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const completes: string[] = []
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [], completes, agentText: '빌드 통과 보고' }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  await send($, 'worker-b', '빌드 돌려줘')
  await clock.advance(5000)
  await $.prompt.submit({ text: peerMsg('worker-b', 'Build passed: 120 tests green.\nDetails follow.'), origin: { kind: 'peer' }, wait: false })
  await $.prompt.submit({ text: peerMsg('a1', 'done'), origin: { kind: 'peer' }, wait: false })
  await $.prompt.submit({ text: peerMsg('fresh-c', '안녕'), origin: { kind: 'peer-send-message' }, wait: false })
  await clock.settle()
  expect(completes.filter(c => c.includes('Build passed')).length).toBe(1)
  // a peer's message is not the person's typed prompt
  const ran = await $.command.run({ command: 'mods-hud', args: 'usage', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect(ran.text).toContain('오케스트레이션 요약 2회')
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 2  대기 2')
  await ui.press({ key: 'sessions' })
  expect((await ui.find({ key: 'go-s-worker-b' }))?.text).toBe('빌드 통과 보고')
  expect(await ui.find({ key: 'go-s-a1' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^↓ 0초 전$/ })).toBeDefined()
})

test('ListAgents names each session running or idle; one it no longer lists has ended; when it fails every row reads unknown', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  let listing: string | Error | { deny: string } | { sections: unknown[] } = '[running]  ·  worker-b  ·  /a  ·  started 2h ago\n[idle]  ·  worker-c  ·  /b  ·  started 1h ago'
  on('tool.call', { tool: 'ListAgents' }, () => {
    if (listing instanceof Error) throw listing
    if (typeof listing === 'object') return ('deny' in listing ? listing : { result: { listing: '', ...listing } }) as never
    return { result: { listing } } as never
  })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await send($, 'worker-b', 'a')
  await send($, 'worker-c', 'b')
  await clock.advance(10_000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 2  진행 중 1 · 대기 1')
  await ui.press({ key: 'sessions' })
  expect((await ui.find({ type: 'Text', text: /^◆$/ }))?.props.color).toBe('warning')
  expect((await ui.find({ type: 'Text', text: /^◇$/ }))?.props.color).toBe('subtle')
  listing = new Error('no such tool')
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  대기 2')
  expect((await ui.findAll({ type: 'Text', text: /^◇$/ })).map(t => t.props.dimColor)).toEqual([true, true])
  // rows, when the answer has them, count too
  listing = { sections: [{ kind: 'sessions', total: 2, rows: [{ name: 'worker-b', status: 'idle' }, { name: 'worker-c', status: 'running' }] }] }
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  진행 중 1 · 대기 1')
  listing = { deny: 'not allowed' }
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  대기 2')
  // a session the list no longer has (archived, closed) has ended: 종료, no ↻, ✕ stays
  listing = '[running]  ·  worker-b [a1b2]  ·  /a  ·  started 2h ago'
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  진행 중 1 · 종료 1')
  expect((await ui.find({ type: 'Text', text: /^■$/ }))?.props.dimColor).toBe(true)
  expect(await ui.find({ key: 'resume-s-worker-c' })).toBeUndefined()
  expect(await ui.find({ key: 'hide-s-worker-c' })).toBeDefined()
  expect(await ui.find({ key: 'resume-s-worker-b' })).toBeDefined()
})

test('↻ sends the session a one-press nudge and logs it; ✕ hides the row; a reload keeps the rows', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const sent: unknown[] = []
  on('tool.call', { tool: 'SendMessage' }, async (_, e) => {
    const m = e as unknown as { to: string; message: string }
    sent.push({ to: m.to, message: m.message })
    return { result: 'sent' } as never
  })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await send($, 'worker-b', '첫 지시')
  await send($, 'worker-c', '둘째 지시')
  // the module starts over on a reload; the rows in state stay
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await ui.press({ key: 'sessions' })
  sent.length = 0
  await ui.press({ key: 'resume-s-worker-b' })
  expect(sent).toEqual([{ to: 'worker-b', message: '이어서 진행해줘' }])
  // no stop button for a session
  expect(await ui.find({ key: 'stop-s-worker-b' })).toBeUndefined()
  await ui.press({ key: 'hide-s-worker-c' })
  expect(await ui.find({ key: 'go-s-worker-c' })).toBeUndefined()
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 1  대기 1')

  // the nudge is in the session's log
  await ui.press({ key: 'go-s-worker-b' })
  const pane = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'Pane', requestId: 'session-detail', props: PANE_PROPS })
  const texts = (await pane.findAll({ type: 'Text' })).map(t => t.text)
  expect(texts).toContain('주고받은 메시지')
  expect(texts.filter(t => /^↑ \d\d:\d\d /.test(t))).toEqual(['↑ 12:00 첫 지시', '↑ 12:00 이어서 진행해줘'])
})

test('the detail main view lists the sessions; one opens its log, newest at the bottom, and back returns', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.messages', () => ({ value: [{ role: 'assistant', text: '메인 답', toolUses: [{ tool_use_id: 'm1', tool: 'Read', input: { file_path: '/a/b.ts' }, text: 'x' }] }] }) as never)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await send($, 'worker-b', '로그 확인해줘')
  await clock.advance(60_000)
  await $.prompt.submit({ text: peerMsg('worker-b', '로그에 오류 없음'), origin: { kind: 'peer' }, wait: false })
  await clock.settle()
  const band = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'go-session' })
  const pane = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'Pane', requestId: 'session-detail', props: PANE_PROPS })
  await pane.press({ key: 'tab-calls' })
  expect((await pane.findAll({ type: 'Text' })).map(t => t.text)).toContain('Read b.ts')
  await pane.press({ key: 'tab-live' })
  const main = (await pane.findAll({ type: 'Text' })).map(t => t.text)
  expect(main).toContain('오케스트레이션 1')
  expect(main).toContain('↓ 0초 전')
  await pane.press({ key: 'open-s-worker-b' })
  const view = (await pane.findAll({ type: 'Text' })).map(t => t.text)
  expect(view).toContain('worker-b')
  expect(view).toContain('대기')
  expect(view.filter(t => /^[↑↓] \d\d:\d\d /.test(t))).toEqual(['↑ 12:00 로그 확인해줘', '↓ 12:01 로그에 오류 없음'])
  expect(view).not.toContain('Read b.ts')
  await pane.press({ key: 'back' })
  expect((await pane.findAll({ type: 'Text' })).map(t => t.text)).toContain('오케스트레이션 1')
})

test('a detail subject saved by an older build reads as the view it meant', () => {
  expect(detailView({ agentId: 'a9', at: 1 })).toEqual({ kind: 'agent', id: 'a9', at: 1 })
  expect(detailView({ agentId: null, at: 1 })).toEqual({ kind: 'main', id: null, at: 1 })
  expect(detailView({ kind: 'session', id: 'x', at: 1 })).toEqual({ kind: 'session', id: 'x', at: 1 })
  expect(detailView(null)).toBeNull()
})

test('long session names and messages stay one line on both surfaces, band and detail', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const name = 'orchestrated-session-with-a-really-long-name-for-clipping'
  const body = '아주 긴 메시지 본문이 여기 있다 '.repeat(8)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const w: World = { list: [], forks: [], agentText: '아주 긴 한국어 요약 줄이 들어와서 폭을 넘기려고 한다 '.repeat(3) }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await send($, name, body)
  await $.prompt.submit({ text: peerMsg(name, body), origin: { kind: 'peer' }, wait: false })
  await clock.settle()
  await clock.advance(2000)
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const cols of [120, 50]) {
      const ui = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: { ...BAND, bodyColumns: cols } })
      if ((await ui.find({ key: 'sessions-line' }))?.text.trim().startsWith('▸')) await ui.press({ key: 'sessions' })
      const width = cols - (surface === 'terminal' ? 4 : 0)
      const r = await ui.find({ key: `peer-${name}` })
      expect(r).toBeDefined()
      // the row's text plus its seven gaps (⎿ dot name label · meta ↻ ✕) fits the band;
      // the desktop's proportional font sets Hangul in about 1.3 cells, so its rows may count up to that much longer
      expect(cells(r!.text) + 7).toBeLessThanOrEqual(surface === 'desktop' ? Math.ceil(width * 1.3) : width)
      expect(cells((await ui.find({ key: 'sessions' }))!.text) + 2).toBeLessThanOrEqual(width)
      await ui.unmount()
    }
    const band = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: BAND })
    await band.press({ key: 'go-session' })
    const pane = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'Pane', requestId: 'session-detail', props: PANE_PROPS })
    await pane.press({ key: 'tab-live' })
    // the terminal is exact; the desktop's proportional Hangul takes about 1.3 cells, so its cut allows ×1.3
    const room = surface === 'desktop' ? Math.ceil(PANE_PROPS.bodyColumns * 1.3) : PANE_PROPS.bodyColumns
    const peer = await pane.find({ key: `peer-${name}` })
    expect(cells(peer!.text) + 3).toBeLessThanOrEqual(room)
    await pane.press({ key: `open-s-${name}` })
    for (const t of await pane.findAll({ type: 'Text' })) expect(cells(t.text)).toBeLessThanOrEqual(room)
    await pane.unmount()
    await band.unmount()
  }
})

test('the fold line colors each count by its state', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: 'x', status: 'running' }, { id: 'a2', type: 'Plan', description: 'y', status: 'completed' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ type: 'Text', text: /^ 진행 중 1$/ }))?.props.color).toBe('warning')
  expect((await ui.find({ type: 'Text', text: /^ · 완료 1$/ }))?.props.color).toBe('success')
})

test('a running agent clock ticks in its own Client region; an ended one is fixed text', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // running: a surface module draws the time, so only its cells redraw each second
  const region = await ui.find({ type: 'Client', key: 'time-a1' })
  expect(region?.props.module).toBe('hooks/elapsed.tsx')
  expect((region?.props.props as { startedAt: number }).startedAt).toBe(NOW + 2000)
  await clock.advance(64_000)
  w.list[0]!.status = 'completed'
  await clock.advance(2000)
  // ended: the time it took, frozen, as plain text
  expect(await ui.find({ type: 'Client', key: 'time-a1' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^01:06$/ })).toBeDefined()
})

test('a terminal with too few rows drops the card and the usage line instead of being cut', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await clock.advance(2000)
  for (const [rows, card] of [[12, true], [4, false]] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, maxRows: rows } })
    expect((await ui.find({ type: 'Box', key: 'band' }))?.props.borderStyle).toBe(card ? 'round' : undefined)
    expect(!!(await ui.find({ type: 'Box', key: 'status' }))).toBe(card)
    expect(await ui.find({ type: 'Text', text: /^작업 a1$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a cross-session message is keyed by its session id, shown by its name, and a reply to that id joins the row', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({
    text: '<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-session="local_ad8a" from-name="테스트 상대" from-mode="prompting">\n/usr/share 항목 수 확인 완료: 42개\n</cross-session-message>',
    origin: { kind: 'peer' },
  } as never)
  await $.tool.call({ tool: 'SendMessage', tool_use_id: 's1', to: 'local_ad8a', message: '이어서 진행해줘' } as never)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 1  대기 1')
  await ui.press({ key: 'sessions' })
  expect(await ui.find({ type: 'Text', text: /^테스트 상대$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /local_ad8a/ })).toBeUndefined()
})

test('agent time shows hours only once one is reached', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  // ends 1:02:04 after the first tick saw it
  await clock.advance(3_724_000)
  w.list[0]!.status = 'completed'
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /^1:02:0\d$/ })).toBeDefined()
})

// History: the detail main view's turn cards.
const turn = async ($: Engine, id: string, ask?: string) => {
  if (ask) await $.prompt.submit({ text: ask, origin: { kind: 'composer' }, wait: false })
  await $.turn.start({ text: ask ?? '', turnId: id })
}
const endTurn = ($: Engine, id: string, answer = '했어요') => $.turn.complete({ answer, durationMs: 5, isAborted: false, turnId: id, reason: 'answer' })
// The detail pane on the main view, opened from the band as the person would.
const openMain = async ($: Engine, surface: 'terminal' | 'desktop' = 'desktop', bodyColumns = 60) => {
  const band = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'go-session' })
  await band.unmount()
  return $.ui.mount({ plugin: 'mods-hud', surface, component: 'Pane', requestId: 'session-detail', props: { ...PANE_PROPS, bodyColumns } })
}
type Mounted = Awaited<ReturnType<typeof openMain>>
const texts = async (ui: Mounted) => (await ui.findAll({ type: 'Text' })).map(t => t.text)

test('a turn makes a history card: its ask, model, duration, and the session line as its result', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const w: World = { list: [], forks: [], forkText: '로그인 버그 수정 완료' }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await turn($, 't1', '로그인 고쳐줘')
  await clock.advance(64_000)
  const pane = await openMain($)
  expect((await pane.find({ key: 'tab-history' }))?.props.label).toBe('● 히스토리')
  // running: its clock moves and the result waits
  const live = await pane.find({ type: 'Text', text: /^─ 턴 1 / })
  expect(live?.text).toBe('─ 턴 1 · 12:00 · 01:04 · Opus 5.5(high)')
  expect(live?.props.bold).toBe(true)
  expect((await pane.find({ key: 'ask' }))?.text).toBe('  요청  로그인 고쳐줘')
  expect((await pane.find({ key: 'result' }))?.text).toBe('  결과  …')
  await endTurn($, 't1')
  await clock.settle()
  await clock.advance(30_000)
  // ended: the time it took, frozen, and Haiku's session line as its result
  expect(await texts(pane)).toContain('─ 턴 1 · 12:00 · 01:04 · Opus 5.5(high)')
  expect((await pane.find({ key: 'result' }))?.text).toBe('  결과  로그인 버그 수정 완료')
  await turn($, 't2', '테스트 추가해줘')
  expect((await texts(pane)).filter(t => t.startsWith('─ 턴'))).toEqual(['─ 턴 1 · 12:00 · 01:04 · Opus 5.5(high)', '─ 턴 2 · 12:01 · 00:00 · Opus 5.5(high)'])
})

test('an agent spawned in a turn lands in its card and stays there, its last line and time kept, after ✕ and after its row drops', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  const w: World = { list: [], forks: [], agentText: '텍스트 파일 653개 찾음' }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await turn($, 't1', '파일 세줘')
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'p', description: '파일 세기', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)
  const pane = await openMain($)
  expect((await pane.find({ key: 'h-agent-bg1' }))?.props.label).toBe('Explore  파일 세기')
  // running: when it started, fixed (the pane redraws on change only)
  expect((await pane.find({ key: 'h-a-bg1' }))?.text).toBe('    ⎿ ● Explore  파일 세기  12:00~')
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', agentId: 'bg1', command: 'ls' } as never)
  await clock.advance(46_000)
  await $.turn.complete({ answer: '653', durationMs: 5, isAborted: false, turnId: 'c1', reason: 'answer', agentId: 'bg1' } as never)
  await clock.settle()
  const done = '    ⎿ ✓ Explore  텍스트 파일 653개 찾음  00:46'
  expect((await pane.find({ key: 'h-a-bg1' }))?.text).toBe(done)

  // ✕ on the band closes the row, not the card's line
  const band = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'hide-bg1' })
  expect(await band.find({ key: 'go-bg1' })).toBeUndefined()
  await band.unmount()
  expect((await pane.find({ key: 'h-a-bg1' }))?.text).toBe(done)
  // past KEEP_DONE_MS the row is gone from state too
  await clock.advance(11 * 60_000)
  const dbg = await $.command.run({ command: 'mods-hud', args: 'debug', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect(dbg.text).toContain('에이전트: 없음')
  expect((await pane.find({ key: 'h-a-bg1' }))?.text).toBe(done)

  // a press opens its view from the snapshot; back returns to the history tab
  await pane.press({ key: 'h-agent-bg1' })
  expect(await texts(pane)).toContain('Explore  텍스트 파일 653개 찾음')
  await pane.press({ key: 'back' })
  expect((await pane.find({ key: 'tab-history' }))?.props.label).toBe('● 히스토리')
  expect((await pane.find({ key: 'h-a-bg1' }))?.text).toBe(done)
})

test('session traffic in a turn lands in its card; ListAgents moves its state there', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  let listing = '[running]  ·  worker-b  ·  /a  ·  started 2h ago'
  on('tool.call', { tool: 'ListAgents' }, () => ({ result: { listing } }) as never)
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await turn($, 't1', '빌드 맡겨')
  await send($, 'worker-b', '빌드 돌려줘\n자세한 건 아래')
  await $.prompt.submit({ text: peerMsg('worker-b', '빌드 통과\n120개'), origin: { kind: 'peer' }, wait: false })
  await clock.settle()
  const pane = await openMain($)
  expect((await pane.find({ key: 'h-sess-1-worker-b' }))?.props.label).toBe('worker-b  ↑빌드 돌려줘  ↓빌드 통과')
  await clock.advance(10_000)
  expect((await pane.find({ key: 'h-s-1-worker-b' }))?.text).toBe('    ↔ ◆ worker-b  ↑빌드 돌려줘  ↓빌드 통과')
  await endTurn($, 't1')
  await turn($, 't2', '정리해')
  await send($, 'worker-c', '문서 정리')
  expect(await pane.find({ key: 'h-sess-2-worker-c' })).toBeDefined()
  expect(await pane.find({ key: 'h-sess-1-worker-c' })).toBeUndefined()
  // ended: the list no longer has it
  listing = '[running]  ·  worker-c  ·  /a  ·  started 2h ago'
  await clock.advance(10_000)
  // two cards of four rows outgrow the pane: the first sits behind the fold
  await pane.press({ key: 'older' })
  expect((await pane.find({ key: 'h-s-1-worker-b' }))?.text).toBe('    ↔ ■ worker-b  ↑빌드 돌려줘  ↓빌드 통과')
  await pane.press({ key: 'h-sess-1-worker-b' })
  expect((await texts(pane)).filter(t => /^[↑↓] \d\d:\d\d /.test(t))).toEqual(['↑ 12:00 빌드 돌려줘', '↓ 12:00 빌드 통과'])
})

test('the tabs switch: 도구 호출 has the main calls, 현재 the live sections; back from an agent returns to the tab left', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('session.messages', (_, e) => ({
    value: (e as { agentId?: string }).agentId
      ? [{ role: 'assistant', text: '세는 중', toolUses: [{ tool_use_id: 'b1', tool: 'Grep', input: { pattern: 'x' } }] }]
      : [
          { role: 'assistant', text: '메인 답', toolUses: [{ tool_use_id: 'm1', tool: 'Read', input: { file_path: '/a/b.ts' }, text: 'x' }] },
          { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'm2', tool: 'Bash', input: { command: 'ls', description: 'List files' } }] },
        ],
  }) as never)
  const w: World = { list: [{ id: 'a9', type: 'Explore', description: '작업 a9', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await turn($, 't1', '해줘')
  await clock.advance(2000)
  const pane = await openMain($)
  const labels = async () => Promise.all(['history', 'calls', 'live'].map(async k => (await pane.find({ key: `tab-${k}` }))?.props.label))
  expect(await labels()).toEqual(['● 히스토리', '도구 호출 2', '현재'])
  // the history holds no calls and no live sections
  expect(await texts(pane)).not.toContain('Read b.ts')
  expect(await pane.find({ key: 'open-a9' })).toBeUndefined()
  expect(await pane.find({ key: 'h-agent-a9' })).toBeDefined()

  await pane.press({ key: 'tab-calls' })
  expect(await labels()).toEqual(['히스토리', '● 도구 호출 2', '현재'])
  expect(await texts(pane)).toEqual(expect.arrayContaining(['Read b.ts', 'Bash List files']))
  expect(await pane.find({ key: 'open-a9' })).toBeUndefined()

  await pane.press({ key: 'tab-live' })
  expect(await labels()).toEqual(['히스토리', '도구 호출 2', '● 현재'])
  const live = await texts(pane)
  expect(live).toEqual(expect.arrayContaining(['메인 세션', '서브에이전트 1', '“메인 답”']))
  expect(live).not.toContain('Read b.ts')
  await pane.press({ key: 'open-a9' })
  expect(await texts(pane)).toContain('Grep "x"')
  await pane.press({ key: 'back' })
  expect(await labels()).toEqual(['히스토리', '도구 호출 2', '● 현재'])

  await pane.press({ key: 'tab-calls' })
  await pane.press({ key: 'tab-history' })
  await pane.press({ key: 'h-agent-a9' })
  await pane.press({ key: 'back' })
  expect(await labels()).toEqual(['● 히스토리', '도구 호출 2', '현재'])
})

test('older turns sit behind ▸ 이전 턴 N개, which reveals them', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  for (const n of [1, 2, 3, 4, 5]) {
    await turn($, `t${n}`, `요청 ${n}`)
    await endTurn($, `t${n}`)
    await clock.settle()
  }
  const pane = await openMain($)
  const heads = async () => (await texts(pane)).filter(t => t.startsWith('─ 턴')).map(t => t.split(' · ')[0])
  // ten rows: the tabs, a gap, the fold line, then two cards of three
  expect(await heads()).toEqual(['─ 턴 4', '─ 턴 5'])
  expect((await pane.find({ key: 'older' }))?.props.label).toBe('▸ 이전 턴 3개')
  await pane.press({ key: 'older' })
  expect(await heads()).toEqual(['─ 턴 1', '─ 턴 2', '─ 턴 3', '─ 턴 4', '─ 턴 5'])
  expect((await pane.find({ key: 'older' }))?.props.label).toBe('▾ 이전 턴 3개')
})

test('a reload keeps the history, its agents as they ended, and the tab', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  const w: World = { list: [], forks: [], agentText: '파일 3개 찾음', forkText: '파일 개수 확인 완료' }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await turn($, 't1', '파일 세줘')
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'p', description: '파일 세기', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', agentId: 'bg1', command: 'ls' } as never)
  await clock.advance(20_000)
  await $.turn.complete({ answer: '3', durationMs: 5, isAborted: false, turnId: 'c1', reason: 'answer', agentId: 'bg1' } as never)
  await send($, 'worker-b', '확인해줘')
  await endTurn($, 't1')
  await clock.settle()
  // its row drops; the engine still lists it, so a reload finds it again with a fresh clock and no line
  await clock.advance(11 * 60_000)
  w.list.push({ id: 'bg1', type: 'Explore', description: '파일 세기', status: 'completed' })
  const before = await openMain($)
  await before.press({ key: 'tab-calls' })
  await before.unmount()
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const pane = await openMain($)
  expect((await pane.find({ key: 'tab-calls' }))?.props.label).toBe('● 도구 호출 0')
  await pane.press({ key: 'tab-history' })
  expect((await pane.find({ key: 'result' }))?.text).toBe('  결과  파일 개수 확인 완료')
  expect((await pane.find({ key: 'h-a-bg1' }))?.text).toBe('    ⎿ ✓ Explore  파일 3개 찾음  00:20')
  expect((await pane.find({ key: 'h-sess-1-worker-b' }))?.props.label).toBe('worker-b  ↑확인해줘')
  // the count goes on from the kept cards
  await turn($, 't2', '다음')
  expect((await texts(pane)).some(t => t.startsWith('─ 턴 2 · '))).toBe(true)
})

test('long asks, results, agents and sessions stay one line in every tab at widths 40, 60 and 100 on both surfaces', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  const long = '아주 긴 한국어 문장이 패널의 폭을 넘기려고 계속 이어진다 '.repeat(4)
  const name = 'orchestrated-session-with-a-really-long-name-for-clipping'
  on('session.messages', () => ({ value: [{ role: 'assistant', text: long, toolUses: [{ tool_use_id: 'm1', tool: 'Bash', input: { command: 'ls', description: long } }] }] }) as never)
  const w: World = { list: [], forks: [], agentText: long, forkText: long }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await turn($, 't1', long)
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'p', description: long, subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' } } as never)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', agentId: 'bg1', command: 'ls' } as never)
  await $.turn.complete({ answer: long, durationMs: 5, isAborted: false, turnId: 'c1', reason: 'answer', agentId: 'bg1' } as never)
  await send($, name, long)
  await $.prompt.submit({ text: peerMsg(name, long), origin: { kind: 'peer' }, wait: false })
  await endTurn($, 't1', long)
  await clock.settle()
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const cols of [40, 60, 100]) {
      // the terminal is exact; the desktop's proportional Hangul takes about 1.3 cells, so its cut allows ×1.3
      const room = surface === 'desktop' ? Math.ceil(cols * 1.3) : cols
      const pane = await openMain($, surface, cols)
      for (const tab of ['history', 'calls', 'live']) {
        await pane.press({ key: `tab-${tab}` })
        for (const t of await pane.findAll({ type: 'Text' })) expect(cells(t.text)).toBeLessThanOrEqual(room)
        for (const b of await pane.findAll({ type: 'Button' })) expect(cells(String(b.props.label ?? b.text))).toBeLessThanOrEqual(room)
        // a whole line (indent, dot, label, time) fits too
        for (const key of tab === 'history' ? ['tabs', 'ask', 'result', 'h-a-bg1', `h-s-1-${name}`] : ['tabs']) {
          const line = await pane.find({ key })
          expect(line).toBeDefined()
          expect(cells(line!.text)).toBeLessThanOrEqual(room)
        }
      }
      await pane.unmount()
    }
  }
})

test('a turn a notice or another session started adds no card of its own', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: '고쳐줘', turnId: 't1' })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.turn.start({ text: '<task-notification>done</task-notification>', turnId: 't2' })
  await $.turn.complete({ answer: 'y', durationMs: 5, isAborted: false, turnId: 't2', reason: 'answer' })
  await clock.settle()
  const band = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'go-session' })
  const pane = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'Pane', requestId: 'session-detail', props: PANE_PROPS })
  const heads = (await pane.findAll({ type: 'Text' })).map(t => t.text).filter(t => t.includes('턴 '))
  expect(heads.some(t => t.includes('턴 1'))).toBe(true)
  expect(heads.some(t => t.includes('턴 2'))).toBe(false)
})

// Issue 008. A fresh module is what a hot reload gives: the ids it finds in state stay off the band.
test('an agent that aged off the band stays off after a reload, though the engine still lists it', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'old', type: 'Explore', description: '예전 작업', status: 'completed' }], forks: [] }
  on('state.get', (($: unknown, e: { key: string }, next: (e: unknown) => unknown) => (e.key === 'dropped' ? { value: { value: ['old'], version: 1 } } : next(e))) as never)
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ key: 'agent-old' })).toBeUndefined()
})

test('an agent aging off the band is written to state for the next load', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업', status: 'running' }], forks: [] }
  const writes: unknown[] = []
  on('state.set', { plugin: 'mods-hud', key: 'dropped' } as never, (($: unknown, e: { value: unknown }, next: (e: unknown) => unknown) => (writes.push(e.value), next(e))) as never)
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  w.list[0]!.status = 'completed'
  await clock.advance(2000)
  expect(writes).toEqual([])
  await clock.advance(11 * 60_000)
  expect(writes.at(-1)).toEqual(['a1'])
})

// Issue 009: drifted lines are dropped, so the last good one stays.
test('a summary that echoes the ask, apologizes, ends as a sentence, or runs on when done is dropped', () => {
  expect(summaryLine('- **"로그인 버그 수정 완료"**')).toBe('로그인 버그 수정 완료')
  expect(summaryLine('파일 3개 찾음')).toBe('파일 3개 찾음')
  expect(summaryLine('라이선스 파일 세는 중')).toBe('라이선스 파일 세는 중')
  expect(summaryLine('라이선스 파일 세는 중', true)).toBe('')
  expect(summaryLine('…질문 형태로: 터미널')).toBe('')
  expect(summaryLine('주어진 정보가 부족합니다')).toBe('')
  expect(summaryLine('파일이 3개입니다')).toBe('')
  expect(summaryLine('…30자 이내로만 출력')).toBe('')
  // words that also name ordinary work stay
  expect(summaryLine('README 마크다운 정리 완료')).toBe('README 마크다운 정리 완료')
  expect(summaryLine('JSON 형태로 변환 완료')).toBe('JSON 형태로 변환 완료')
  expect(summaryLine('원인 알 수 없음 보고')).toBe('원인 알 수 없음 보고')
})

// A failed read at session start once left the meter empty for good: no model, effort or usage anywhere.
test('a usage read that fails at start still leaves the model and, after a response, the usage shown', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { list: [], forks: [], failUsage: true })
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: /^Opus 5\.5$/ })).toBeDefined()
  await $.session.measure({ context: { percent: 30 }, rateLimits: [{ kind: 'five_hour', percentUsed: 12 }], changed: ['rateLimits'] } as never)
  expect(await ui.find({ type: 'Text', text: /^12%$/ })).toBeDefined()
})
