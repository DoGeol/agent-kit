// Subagents: their rows, step lines, Korean lines, buttons, folding, aging off, and the rows that hung on (issue 019).
import { expect, mock, test } from 'claude-code/testing'

import { cells } from '../hooks/text'
import { NOW, BAND, world, feedOf, texts } from './world'
import type { World } from './world'

test('a subagent shows from its spawn, its row follows each tool call, and its end is 완료', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [], statuses: [] }
  world(on, w)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ toolUseId: 'tu1', prompt: 'count', description: '파일 개수 세기', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)

  const look = async () => {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    const all = await texts(ui)
    await ui.unmount()
    return all
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

test('an agent keeps its step line between calls; idle (turn ended) reads as done', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const steps = async () => {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
    const found = (await texts(ui)).filter(t => t.startsWith('→ '))
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

test('a lone agent stays shown however few rows the surface gives', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  for (const [rows, steps] of [[2, 0], [3, 1], [4, 1], [5, 1], [6, 1]] as const) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, maxRows: rows } })
    expect(await ui.find({ type: 'Text', text: /^작업 a1$/ })).toBeDefined()
    expect((await texts(ui)).filter(t => t.startsWith('→ ')).length).toBe(steps)
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
    const t = (await ui.find({ key: 'label-bg1' }))?.text
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
  // two agents fit the band: rows straight away, no fold line; a wide band spells the buttons out
  expect(await ui.find({ key: 'agents-line' })).toBeUndefined()
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('종료')
  await ui.press({ key: 'stop-a1' })
  expect(stops).toEqual([])
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('종료? 3')
  // the label counts down, then the arm lapses
  await clock.advance(1000)
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('종료? 2')
  await clock.advance(2000)
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('종료')
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

test('the fold line colors each count by its state', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  // four agents: more than MAX_AGENTS, so the group folds into its counts line
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: 'x', status: 'running' }, { id: 'a2', type: 'Plan', description: 'y', status: 'completed' }, { id: 'a3', type: 'Explore', description: 'z', status: 'running' }, { id: 'a4', type: 'Plan', description: 'w', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ type: 'Text', text: /^ 진행 중 3$/ }))?.props.color).toBe('warning')
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

test('an agent clock posts every 2 s; the answer hands it a fresh now, and debug counts the round trip', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  for (let i = 0; i < 6; i++) await ui.advance(1000)
  const dbg = await $.command.run({ command: 'mods-hud', args: 'debug', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect((dbg as { text: string }).text).toContain('시계 desktop 받음 3 · 응답 2 · Client 오류: 없음')
  await ui.unmount()
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

// Issue 019: rows that hung on as 진행 중 after their agent or session was gone.

test('an agent the engine listed and then dropped reads 완료, and the idle session no longer reads 진행 중', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.advance(2000)
  let ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect((await ui.findAll({ type: 'Text', text: /^진행 중$/ })).length).toBe(2)
  await ui.unmount()
  // the engine forgot it without a turn.complete reaching us
  w.list.length = 0
  await clock.advance(2000)
  ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await ui.find({ type: 'Text', text: /^진행 중$/ })).toBeUndefined()
  expect((await ui.findAll({ type: 'Text', text: /^완료$/ })).length).toBe(2)
  await ui.unmount()
  // a failed list read ends nothing
  w.list.push({ id: 'b1', type: 'Explore', description: '작업 b1', status: 'running' })
  await clock.advance(2000)
  w.failList = true
  await clock.advance(2000)
  ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  // two agents, both as rows: b1 still live, a1 done
  expect(await ui.find({ key: 'agent-b1' })).toBeDefined()
  expect(await ui.find({ key: 'agent-a1' })).toBeDefined()
  // b1's row, and the session line that a live agent keeps 진행 중
  expect((await ui.findAll({ type: 'Text', text: /^진행 중$/ })).length).toBe(2)
})

test('finished agents older than a minute fold into one 완료 line; its 닫기 closes them all; /mods-hud show brings them back; a narrow band keeps the marks', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }, { id: 'a2', type: 'Plan', description: '작업 a2', status: 'running' }, { id: 'a3', type: 'Explore', description: '작업 a3', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  w.list[1]!.status = 'completed'
  w.list[2]!.status = 'completed'
  await clock.advance(2000)
  let ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // just finished: still their own rows, no fold line for three agents
  expect(await ui.find({ key: 'agents-line' })).toBeUndefined()
  expect(await ui.find({ key: 'agent-a2' })).toBeDefined()
  expect(await ui.find({ key: 'done' })).toBeUndefined()
  await ui.unmount()
  await clock.advance(61_000)
  ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // a minute on: one 완료 line with the count, the live row stays, its step line too
  expect(await ui.find({ key: 'agent-a2' })).toBeUndefined()
  expect((await ui.find({ key: 'done' }))?.props.label).toBe('완료 2')
  expect(await ui.find({ key: 'agent-a1' })).toBeDefined()
  expect((await ui.find({ key: 'hide-done' }))?.props.label).toBe('닫기')
  await ui.press({ key: 'done' })
  expect(await ui.find({ key: 'agent-a2' })).toBeDefined()
  await ui.press({ key: 'done' })
  await ui.press({ key: 'hide-done' })
  expect(await ui.find({ key: 'done' })).toBeUndefined()
  expect(await ui.find({ key: 'agent-a1' })).toBeDefined()
  await ui.unmount()
  // /mods-hud show undoes every close
  const ran = await $.command.run({ command: 'mods-hud', args: 'show', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as never)
  expect(ran.text).toBe('닫았던 행 2개를 다시 보임.')
  ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ key: 'agent-a2' })).toBeDefined()
  await ui.unmount()
  // a narrow band keeps the one-cell marks
  ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 70 } })
  expect((await ui.find({ key: 'stop-a1' }))?.props.label).toBe('■')
  expect((await ui.find({ key: 'hide-a2' }))?.props.label).toBe('✕')
})

test('a background agent the engine never lists ends after 30 silent minutes while the session is idle; a call keeps it live', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [], forks: [] }
  world(on, w)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'bg1' }))
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ toolUseId: 'tu1', prompt: 'p', description: '오래 걸리는 일', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as never)
  await $.turn.complete({ answer: 'x', durationMs: 5, isAborted: false, turnId: 'm1', reason: 'answer' })
  await clock.advance(20 * 60_000)
  await $.tool.call({ tool: 'Grep', tool_use_id: 't1', agentId: 'bg1', pattern: 'x' } as never)
  await clock.advance(20 * 60_000)
  let ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  // 40 minutes since its spawn, but only 20 since its last call: still at work
  expect((await ui.findAll({ type: 'Text', text: /^진행 중$/ })).length).toBe(2)
  await ui.unmount()
  await clock.advance(11 * 60_000)
  ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: false } })
  expect(await ui.find({ type: 'Text', text: /^진행 중$/ })).toBeUndefined()
  expect(await ui.find({ key: 'agent-bg1' })).toBeDefined()
})

test('a call after an agent ended starts its time over: the row stays until 10 minutes after the new end', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  w.list[0]!.status = 'completed'
  await clock.advance(2000)
  await clock.advance(9 * 60_000)
  // woken by a message, it calls a tool again; the engine then lists it ended once more
  await $.tool.call({ tool: 'Grep', tool_use_id: 't1', agentId: 'a1', pattern: 'x' } as never)
  await clock.advance(2000)
  await clock.advance(2 * 60_000)
  // 11 minutes after the first end, 2 after the second: not aged off yet (finished over a minute ago: in the 완료 line)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'done' }))?.props.label).toBe('완료 1')
  await ui.press({ key: 'done' })
  expect(await ui.find({ key: 'agent-a1' })).toBeDefined()
})

test('a tool call writes no state: its step reaches the band through the feed region, with no redraw (issue 018)', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { list: [{ id: 'a1', type: 'Explore', description: '작업 a1', status: 'running' }], forks: [] }
  world(on, w)
  const writes: string[] = []
  on('state.set', ($, e, next) => {
    writes.push((e as unknown as { key: string }).key)
    return next(e)
  })
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await feedOf(ui)).map(l => l.text)).toEqual(['→ …'])
  writes.length = 0
  await $.tool.call({ tool: 'Grep', tool_use_id: 't1', agentId: 'a1', pattern: 'x' } as never)
  await $.tool.call({ tool: 'Read', tool_use_id: 't2', agentId: 'a1', file_path: '/a/b.ts' } as never)
  expect(writes).toEqual([])
  // the region asks each second and draws the newest step it gets back
  const drawn = async () => (await ui.findAll({ in: 'feed-step-a1', type: 'Text' })).map(t => t.text)
  expect(await drawn()).toEqual(['→ …'])
  await ui.advance(1000)
  expect(await drawn()).toEqual(['→ Read b.ts'])
  await ui.unmount()
})
