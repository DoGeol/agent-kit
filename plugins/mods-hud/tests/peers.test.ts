// Orchestration: the other sessions this one messages, their rows and ListAgents.
import { expect, mock, test } from 'claude-code/testing'

import { cells, DESKTOP_WIDE } from '../hooks/text'
import { NOW, BAND, world, send, peerMsg } from './world'
import type { World } from './world'

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
  expect(fold?.text.trim()).toBe('▸ 오케스트레이션 2  확인 중 2')
  expect(await ui.find({ type: 'Text', text: /^worker-b$/ })).toBeUndefined()
  await ui.press({ key: 'sessions' })
  expect(await ui.find({ type: 'Text', text: /^worker-b$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^other$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^a1$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^zz$/ })).toBeUndefined()
  expect((await ui.find({ key: 'label-s-worker-b' }))?.text).toBe('로그인 버그를 고쳐줘')
  expect(await ui.find({ type: 'Text', text: /^↑ 30초 전$/ })).toBeDefined()
  // an unknown row reads 확인 중 with a dim ? for its dot
  expect((await ui.findAll({ type: 'Text', text: /^\?$/ })).every(t => t.props.dimColor === true)).toBe(true)
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
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 2  확인 중 2')
  await ui.press({ key: 'sessions' })
  expect((await ui.find({ key: 'label-s-worker-b' }))?.text).toBe('빌드 통과 보고')
  expect(await ui.find({ key: 'label-s-a1' })).toBeUndefined()
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
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  확인 중 2')
  expect((await ui.findAll({ type: 'Text', text: /^\?$/ })).map(t => t.props.dimColor)).toEqual([true, true])
  // rows, when the answer has them, count too
  listing = { sections: [{ kind: 'sessions', total: 2, rows: [{ name: 'worker-b', status: 'idle' }, { name: 'worker-c', status: 'running' }] }] }
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  진행 중 1 · 대기 1')
  listing = { deny: 'not allowed' }
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 2  확인 중 2')
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
  expect(await ui.find({ key: 'label-s-worker-c' })).toBeUndefined()
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▾ 오케스트레이션 1  확인 중 1')
})

test('long session names and messages stay one line on both surfaces', async ($, on) => {
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
      // the row's text plus its seven gaps (⎿ dot name label · meta ↻ ✕) fits the band, measured as its surface
      // sets the text: the desktop's proportional font gives Hangul about 1.5 cells, the terminal two (issue 005)
      const wide = surface === 'desktop' ? DESKTOP_WIDE : 2
      expect(cells(r!.text, wide) + 7).toBeLessThanOrEqual(width)
      expect(cells((await ui.find({ key: 'sessions' }))!.text) + 2).toBeLessThanOrEqual(width)
      await ui.unmount()
    }
  }
  // an all-Latin line (a path, a session name) takes a cell a glyph on the desktop too: it gets no Hangul allowance
  const latin = 'latin-only-session'
  w.agentText = 'rewriting the long latin summary line that must not run past the band '.repeat(3)
  await $.prompt.submit({ text: peerMsg(latin, 'see the attached long report on the build pipeline'), origin: { kind: 'peer' }, wait: false })
  await clock.settle()
  for (const cols of [120, 50]) {
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, bodyColumns: cols } })
    if ((await ui.find({ key: 'sessions-line' }))?.text.trim().startsWith('▸')) await ui.press({ key: 'sessions' })
    const r = await ui.find({ key: `peer-${latin}` })
    expect(r).toBeDefined()
    expect(r!.text).toContain('rewriting')
    expect(cells(r!.text, DESKTOP_WIDE) + 7).toBeLessThanOrEqual(cols)
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
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 1  확인 중 1')
  await ui.press({ key: 'sessions' })
  expect(await ui.find({ type: 'Text', text: /^테스트 상대$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /local_ad8a/ })).toBeUndefined()
})

test('ListAgents answering with no sessions ends every row; an ended row ages off after 10 minutes; new traffic brings it back', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  let listing = '[running]  ·  worker-b  ·  /a  ·  started 2h ago'
  on('tool.call', { tool: 'ListAgents' }, () => ({ result: { listing } }) as never)
  const w: World = { list: [], forks: [] }
  world(on, w)
  await $.session.start({ cwd: '/tmp/x', surface: 'desktop', isInteractive: true })
  await send($, 'worker-b', 'a')
  await clock.advance(10_000)
  const ui = await $.ui.mount({ plugin: 'mods-hud', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 1  진행 중 1')
  // every session closed: the list is readable and empty
  listing = ''
  await clock.advance(10_000)
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 1  종료 1')
  // ten minutes later the ended row is gone from the band
  await clock.advance(11 * 60_000)
  expect(await ui.find({ key: 'sessions-line' })).toBeUndefined()
  // a message from it means it lives again: back as 대기 until the list places it
  await $.prompt.submit({ text: peerMsg('worker-b', '다시 시작'), origin: { kind: 'peer' }, wait: false })
  await clock.settle()
  expect((await ui.find({ key: 'sessions-line' }))?.text.trim()).toBe('▸ 오케스트레이션 1  확인 중 1')
})
