// The band and the pane: the session line, its states, the usage block, the model and effort, the branch,
// and the polls behind them.
import { expect, mock, test } from 'claude-code/testing'

import { branchLabel, summaryLine } from '../hooks/text'
import { USAGE, NOW, BAND, world, texts } from './world'
import type { World } from './world'

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
    expect(await texts(ui)).toContain('→ Grep "x"')
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
    const all = await texts(ui)
    await ui.unmount()
    return all
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

test('branch label marks a linked worktree', async () => {
  expect(branchLabel('main\n/r/.git\n/r/.git\n')).toBe('⎇ main')
  expect(branchLabel('feat\n/r/.git/worktrees/wt\n/r/.git\n')).toBe('⎇ feat (워크트리)')
  expect(branchLabel('')).toBe('')
})

test('the band shows the branch, marked in a worktree, on the desktop and in a terminal', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { list: [], forks: [] })
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'feat\n/r/.git/worktrees/wt\n/r/.git\n', stderr: '' } }))
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'UI 바꿔줘', origin: { kind: 'composer' }, wait: false })
  await clock.settle()
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: /⎇ feat \(워크트리\)/ })).toBeDefined()
  }
})

test('an idle session writes no state, so nothing redraws and no press lands mid-redraw (issue 001)', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { list: [], forks: [] })
  const writes: string[] = []
  on('state.set', ($, e, next) => {
    writes.push((e as unknown as { key: string }).key)
    return next(e)
  })
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(10_000)
  await clock.settle()
  writes.length = 0
  await clock.advance(20_000)
  await clock.settle()
  expect(writes).toEqual([])
})

test('a session idle for ten minutes is looked at every 30 s instead of every tick; a prompt or /model brings the tick back', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  on('command.run', { command: 'model' }, () => ({ text: '' }))
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ answer: '끝', durationMs: 5, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.settle()
  // busy: the model is read every 2 s
  w.looks = 0
  await clock.advance(60_000)
  expect(w.looks).toBeGreaterThanOrEqual(25)
  // idle for ten minutes: a read every 30 s
  await clock.advance(10 * 60_000)
  w.looks = 0
  await clock.advance(60_000)
  expect(w.looks).toBeLessThanOrEqual(3)
  expect(w.looks).toBeGreaterThanOrEqual(1)
  // a /model pick is still read within a fraction of a second
  w.looks = 0
  await $.command.run({ command: 'model', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  w.model = 'claude-fable-5-1'
  await clock.advance(400)
  expect(w.looks).toBeGreaterThanOrEqual(2)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await texts(ui)).toContain('Fable 5.1')
  await ui.unmount()
  // after the rush ends the session is idle again; a prompt wakes it and the tick is back
  await clock.advance(20_000)
  await clock.advance(10 * 60_000)
  w.looks = 0
  await clock.advance(60_000)
  expect(w.looks).toBeLessThanOrEqual(3)
  await $.prompt.submit({ text: '다시 가자', origin: { kind: 'user' }, wait: false })
  await $.turn.start({ text: '다시 가자', turnId: 't2' })
  w.looks = 0
  await clock.advance(10_000)
  expect(w.looks).toBeGreaterThanOrEqual(4)
})
