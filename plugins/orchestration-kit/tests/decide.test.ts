import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Item } from '../types'
import { answerOf, answerText, isGuardedWrite, nextRequest, parseRequest, toNotify } from '../hooks/decide'

const NOW = Date.parse('2026-10-18T12:00:00+09:00')
const H = '/h/hub'
const REQ = `---
schema: user-decision/v1
decisionId: SAMPLE-0001-d01
projectId: sample-app
projectTaskId: SAMPLE-0001
createdAt: 2026-10-18T09:00:00+09:00
irreversible: true
---

# Worker 계획과 PR 생성 승인

## 배경
계획이 정해져야 첫 Worker를 시작할 수 있다.

## 질문 1: Worker 계획
Worker를 몇 개로 나눌지 정한다.

1. 계획대로 (추천) — 결과: 병렬 / 되돌림: 가능 / 비용: 보통
2. Worker 1개로 줄이기 — 결과: 순차 / 되돌림: 가능 / 비용: 낮음

## 질문 2: PR 생성
지금 PR을 열지 정한다.

1. 지금 Push하고 PR 열기 (추천) — 결과: 브랜치가 올라감
2. 보류 — 결과: 로컬에 둔다

## 실행 내용 (질문 2의 1번)
- 명령:
  \`\`\`sh
  git push -u origin feature/status-view
  \`\`\`
`

const T = '\t'
const item = (over: Partial<Item> = {}): Item => ({
  kind: 'decision', project: 'sample-app', id: 'SAMPLE-0001-d01', text: '', state: 'waiting', createdAt: '2026-10-18T09:00:00+09:00',
  file: '/r/sample-app/.ai/user-decisions/SAMPLE-0001-d01.md', answerDir: `${H}/handoffs/user-decisions/sample-app`, ...over,
})
/** The `kit.sh board` line of a request. */
const line = (i: Item, title = 'Worker 계획과 PR 생성 승인') => ['decision', i.project, i.id, i.state, i.createdAt, title, i.file, i.answerDir].join(T)
const TSV = (items: Item[]) => items.map(i => line(i)).join('\n')

type World = {
  /** every process.run argv and fs.write path, in order */
  log?: string[]
  /** files by path; fs.read answers from here */
  files?: Record<string, string>
  /** what the question dialog answers: question text -> answer; undefined dismisses it */
  answer?: (questions: { question: string; options: { label: string }[] }[]) => Record<string, string> | undefined
  /** the dialog result as a whole, replacing `answer` */
  result?: Record<string, unknown>
  /** every dialog opened, with its questions */
  dialogs?: { question: string; options: { label: string }[] }[][]
  /** while true, `mkdir <marker>` fails as if the marker existed */
  markerTaken?: () => boolean
  /** fs.exists answers true for these */
  exists?: string[]
  /** the board `kit.sh board` prints, and what `kit.sh where` and the state folder's config say (a Portfolio session by default) */
  board?: string
  where?: string
  config?: string
  /** every prompt a plugin submitted */
  prompts?: string[]
  terminal?: string
  /** the sha256 shasum prints, per call */
  sha?: () => string
  /** while true, writing a file fails */
  writeFails?: boolean
  /** the dialog waits for this */
  gate?: Promise<void>
  /** the tools that reached the engine (the model's calls the guard let through) */
  reached?: string[]
  /** every transcript line a plugin logged */
  logs?: string[]
  /** this session's id */
  session?: string
}

const world = (on: On, w: World = {}) => {
  w.log ??= []
  w.files ??= {}
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/h' : e.name === 'ORCA_TERMINAL_HANDLE' ? w.terminal : undefined }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.log', (_, e) => {
    w.logs?.push(e.text)
    return { value: undefined }
  })
  on('session.id', () => ({ value: w.session ?? 'sess-1' }))
  on('ui.render', () => ({ type: 'Text', children: ['core band'] }))
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.ai/ORCHESTRATION.md')) return { value: w.config ?? 'role: portfolio\n' }
    const f = w.files![e.path]
    if (f === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: f }
  })
  on('fs.exists', (_, e) => ({ value: (w.exists ?? []).includes(e.path) }))
  on('fs.write', (_, e) => {
    if (w.writeFails && e.path.endsWith('.tmp')) throw new Error('disk full')
    w.log!.push(`write ${e.path}`)
    w.files![e.path] = e.text
    return { value: undefined }
  })
  const out = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_, e) => {
    w.log!.push(e.argv.join(' '))
    if (e.argv.includes('where')) return out(0, w.where ?? `shared\t${H}\n`)
    if (e.argv.includes('board')) return out(0, w.board ?? '')
    if (e.argv.includes('audit')) return out(0, '')
    if (e.argv[0] === 'git') return out(1, '', 'not a repository')
    if (e.argv[0] === 'shasum') return out(0, `${w.sha ? w.sha() : 'ab'.repeat(32)}  ${e.argv[3]}\n`)
    if (e.argv[0] === 'mkdir' && e.argv[1] !== '-p') return w.markerTaken?.() ? out(1, '', 'File exists') : out(0)
    if (e.argv[0] === 'mv') {
      w.files![e.argv[3]!] = w.files![e.argv[2]!]!
      return out(0)
    }
    return out(0)
  })
  on('prompt.submit', (_, e) => {
    w.prompts?.push(e.text)
    return { text: e.text }
  })
  on('tool.call', async (_, e) => {
    // beneath the plugins: the engine's tools. Only the question dialog is of interest; the rest says it ran.
    if (e.tool !== 'AskUserQuestion') {
      w.reached?.push(String(e.tool))
      return { result: 'ran' }
    }
    await w.gate
    const qs = (e as unknown as { questions: { question: string; options: { label: string }[] }[] }).questions
    w.dialogs?.push(qs)
    if (w.result) return { result: w.result }
    const answers = w.answer?.(qs)
    if (!answers) throw new Error('dialog dismissed')
    return { result: { questions: qs, answers } }
  })
}

const boot = async ($: Parameters<TestBody>[0], on: On, w: World = {}) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, w)
  await $.session.start({ cwd: '/h/hub', surface: 'terminal', isInteractive: true })
  await clock.advance(10)
  return clock
}

const run = ($: Parameters<TestBody>[0], origin: { kind: string } = { kind: 'composer' }) =>
  $.command.run({ command: 'decide', args: '', origin, presentation: { isFullscreen: false, columns: 100 } } as never)

test('step 11: /decide asks each question in the engine dialog ($.ui.ask), with the option texts in the question, and keeps the answers', async ($, on) => {
  const w: World = { files: { '/r/sample-app/.ai/user-decisions/SAMPLE-0001-d01.md': REQ }, dialogs: [], log: [], board: TSV([item()]), answer: qs => Object.fromEntries(qs.map(q => [q.question, q.options[0]!.label])) }
  await boot($, on, w)
  const r = await run($)
  expect(r.text).toBe('기록: SAMPLE-0001-d01')
  expect(w.dialogs!.length).toBe(2)
  expect(w.dialogs![0]![0]!.question).toContain('질문 1/2: Worker 계획')
  expect(w.dialogs![0]![0]!.question).toContain('2. Worker 1개로 줄이기 — 결과: 순차')
  const answer = w.files![`${H}/handoffs/user-decisions/sample-app/SAMPLE-0001-d01.answer.md`]!
  expect(answer).toContain('recordedBy: dialog')
  expect(answer).toContain('- 질문 1: 계획대로 (추천)')
  expect(answer).toContain('- 질문 2: 지금 Push하고 PR 열기 (추천)')
})

const REQ_PATH = '/r/sample-app/.ai/user-decisions/SAMPLE-0001-d01.md'
const ANS_PATH = `${H}/handoffs/user-decisions/sample-app/SAMPLE-0001-d01.answer.md`
const first = (qs: { question: string; options: { label: string }[] }[]) => Object.fromEntries(qs.map(q => [q.question, q.options[0]!.label]))
const base = (over: World = {}): World => ({ files: { [REQ_PATH]: REQ }, dialogs: [], log: [], logs: [], prompts: [], board: TSV([item()]), answer: first, ...over })

test('T12 nextRequest: arrival order; the project just asked goes on with its next one; only waiting ones count', () => {
  const a1 = item({ project: 'a', id: 'A-0001-d01', createdAt: '2026-10-18T09:00:00+09:00' })
  const b1 = item({ project: 'b', id: 'B-0001-d01', createdAt: '2026-10-18T09:01:00+09:00' })
  const a2 = item({ project: 'a', id: 'A-0001-d02', createdAt: '2026-10-18T09:02:00+09:00' })
  expect(nextRequest([a2, b1, a1])?.id).toBe('A-0001-d01')
  expect(nextRequest([b1, a2], 'a')?.id).toBe('A-0001-d02')
  expect(nextRequest([b1, a2], 'b')?.id).toBe('B-0001-d01')
  expect(nextRequest([b1, a2], 'c')?.id).toBe('B-0001-d01')
  expect(nextRequest([{ ...a1, state: 'asking' }, { ...b1, state: 'answered' }, { ...a2, state: 'conflict' }])).toBeUndefined()
  // 05:00 UTC is later than 10:00 +09:00 though it is written first
  const late = item({ project: 'b', id: 'B-0001-d02', createdAt: '2026-10-18T05:00:00+00:00' })
  const early = item({ project: 'a', id: 'A-0001-d03', createdAt: '2026-10-18T10:00:00+09:00' })
  expect(nextRequest([late, early])?.id).toBe('A-0001-d03')
  expect(nextRequest([])).toBeUndefined()
})

test('T12 parseRequest reads the questions, their options and the run section; bad requests say why', () => {
  const r = parseRequest(REQ)
  if ('error' in r) throw new Error(r.error)
  expect(r.id).toBe('SAMPLE-0001-d01')
  expect(r.irreversible).toBe(true)
  expect(r.questions.map(q => q.name)).toEqual(['Worker 계획', 'PR 생성'])
  expect(r.questions[0]!.options.map(o => o.label)).toEqual(['계획대로 (추천)', 'Worker 1개로 줄이기'])
  expect(r.questions[0]!.options[0]!.description).toBe('결과: 병렬 / 되돌림: 가능 / 비용: 보통')
  expect(r.run).toContain('git push -u origin feature/status-view')
  expect(parseRequest(REQ.replace('user-decision/v1', 'other'))).toEqual({ error: 'schema가 user-decision/v1이 아님' })
  expect(parseRequest(REQ.replace('2. 보류 — 결과: 로컬에 둔다\n', ''))).toEqual({ error: '질문 2의 선택지가 1개 (2~4개여야 함)' })
  expect(parseRequest(REQ.replace(/## 실행 내용[\s\S]*$/, ''))).toEqual({ error: 'irreversible인데 실행 내용이 없음' })
  expect(parseRequest('no front matter')).toEqual({ error: '머리말이 없음' })
  const five = REQ + [3, 4, 5].map(n => `\n## 질문 ${n}: x\nx\n\n1. a — b\n2. c — d\n`).join('')
  expect(parseRequest(five)).toEqual({ error: '질문이 5개 (1~4개여야 함)' })
})

test('T12 answerOf and answerText: an option name stays itself, anything else is typed text; the file carries who, where, and which request', () => {
  const q = { name: 'x', prompt: '', options: [{ label: '계획대로 (추천)', description: '' }, { label: '보류', description: '' }] }
  expect(answerOf(q, '보류')).toBe('보류')
  expect(answerOf(q, '내일 하자\n오늘은 Push만')).toBe('직접 입력: 내일 하자 오늘은 Push만')
  expect(answerText({ id: 'SAMPLE-0001-d01', project: 'sample-app' }, ['보류', '직접 입력: 내일'], {
    at: '2026-10-18T03:00:00Z', origin: 'composer', where: 'portfolio', session: 'sess-1', digest: 'abc',
  })).toBe([
    '---', 'schema: user-decision-answer/v1', 'decisionId: SAMPLE-0001-d01', 'projectId: sample-app', 'answeredAt: 2026-10-18T03:00:00Z', 'recordedBy: dialog',
    'origin: composer', 'where: portfolio', 'session: sess-1', 'requestDigest: sha256:abc', '---', '', '- 질문 1: 보류', '- 질문 2: 직접 입력: 내일', '',
  ].join('\n'))
})

test('T12 isGuardedWrite: answer, done and asking files are guarded; requests, results and reads are not', () => {
  const U = '/r/sample-app/.ai/user-decisions'
  const hub = `${H}/handoffs/user-decisions/sample-app`
  for (const t of ['Write', 'Edit', 'NotebookEdit']) {
    expect(isGuardedWrite(t, { file_path: `${U}/X-0001-d01.answer.md` })).toBe(true)
    expect(isGuardedWrite(t, { file_path: `${hub}/X-0001-d01.answer.md` })).toBe(true)
    expect(isGuardedWrite(t, { file_path: `${U}/X-0001-d01.done.md` })).toBe(true)
    expect(isGuardedWrite(t, { file_path: `${hub}/X-0001-d01.asking/owner` })).toBe(true)
    expect(isGuardedWrite(t, { file_path: `${U}/X-0001-d01.md` })).toBe(false)
    expect(isGuardedWrite(t, { file_path: `${U}/X-0001-d01.result.md` })).toBe(false)
    expect(isGuardedWrite(t, { file_path: `${U}/.X-0001-d01.md.tmp` })).toBe(false)
    expect(isGuardedWrite(t, { file_path: '/r/sample-app/notes/a.answer.md' })).toBe(false)
  }
  expect(isGuardedWrite('Read', { file_path: `${U}/X-0001-d01.answer.md` })).toBe(false)
  expect(isGuardedWrite('Bash', { command: `printf a > ${U}/X-0001-d01.answer.md` })).toBe(true)
  expect(isGuardedWrite('Bash', { command: `rm ${U}/X-0001-d01.done.md` })).toBe(true)
  expect(isGuardedWrite('Bash', { command: `mkdir ${hub}/X-0001-d01.asking` })).toBe(true)
  expect(isGuardedWrite('Bash', { command: `cp /tmp/a ${U}/X-0001-d01.answer.md` })).toBe(true)
  expect(isGuardedWrite('Bash', { command: `sed -i 's/a/b/' ${U}/X-0001-d01.answer.md` })).toBe(true)
  expect(isGuardedWrite('Bash', { command: `cat ${U}/X-0001-d01.md` })).toBe(false)
  expect(isGuardedWrite('Bash', { command: `cat ${U}/X-0001-d01.answer.md` })).toBe(false)
  expect(isGuardedWrite('Bash', { command: `mv ${U}/.X-0001-d01.md.tmp ${U}/X-0001-d01.md` })).toBe(false)
  expect(isGuardedWrite('Bash', { command: `git add handoffs/user-decisions && git commit -m checkpoint` })).toBe(false)
  expect(isGuardedWrite('Bash', { command: `sh kit.sh decision-take . X-0001-d01` })).toBe(false)
  expect(isGuardedWrite('Glob', { pattern: '*.answer.md' })).toBe(false)
})

test('T12 toNotify: only this project\'s answered requests, never in a Worker session or before a good read', () => {
  const b = (over = {}, items: Item[] = [item({ state: 'answered' }), item({ id: 'SAMPLE-0001-d02', state: 'waiting' }), item({ project: 'other', id: 'O-0001-d01', state: 'answered' })]) =>
    ({ changedAt: NOW, checkedAt: NOW, okAt: NOW, projects: [], items, workers: [], errors: [], isWorker: false, hub: H, mine: 'sample-app', ...over }) as never
  expect(toNotify(b(), []).map(i => i.id)).toEqual(['SAMPLE-0001-d01'])
  expect(toNotify(b(), ['sample-app/SAMPLE-0001-d01'])).toEqual([])
  expect(toNotify(b({ isWorker: true }), [])).toEqual([])
  expect(toNotify(b({ mine: undefined }), [])).toEqual([])
  expect(toNotify(b({ okAt: null }), [])).toEqual([])
  expect(toNotify(b({ workersUnknown: 'orca 없음' }), [])).toEqual([])
  expect(toNotify(null, [])).toEqual([])
})

test('T13 /decide: one answer file with who, where and which request; the marker is made and released; one transcript line', async ($, on) => {
  const w = base()
  await boot($, on, w)
  const r = await run($)
  expect(r.text).toBe('기록: SAMPLE-0001-d01')
  const a = w.files![ANS_PATH]!
  expect(a).toContain(`requestDigest: sha256:${'ab'.repeat(32)}`)
  expect(a).toContain('origin: composer')
  expect(a).toContain('where: portfolio')
  expect(a).toContain('session: sess-1')
  const marker = `${H}/handoffs/user-decisions/sample-app/SAMPLE-0001-d01.asking`
  const log = w.log!
  expect(log.indexOf(`mkdir ${marker}`)).toBeGreaterThan(-1)
  expect(log.indexOf(`rmdir ${marker}`)).toBeGreaterThan(log.indexOf(`write ${ANS_PATH}.tmp`.replace('/SAMPLE', '/.SAMPLE')))
  expect(w.files![`${marker}/owner`]).toContain('session: sess-1')
  expect(w.logs!.filter(l => l.startsWith('결정 기록: SAMPLE-0001-d01'))).toHaveLength(1)
  expect(w.logs![0]).toContain('git push -u origin feature/status-view')
  // the answer is written through a temp name and renamed, so a cut-off write is never read
  expect(log).toContain(`mv -f ${H}/handoffs/user-decisions/sample-app/.SAMPLE-0001-d01.answer.md.tmp ${ANS_PATH}`)
})

test('T13 /decide: a typed answer is recorded as typed text; a dismissed dialog writes nothing and frees the marker', async ($, on) => {
  const typed = base({ answer: qs => ({ [qs[0]!.question]: qs[0]!.options[0]!.label, ...(qs[0]!.question.includes('2/2') ? { [qs[0]!.question]: 'PR은 내일 열고 오늘은 Push만' } : {}) }) })
  await boot($, on, typed)
  await run($)
  expect(typed.files![ANS_PATH]).toContain('- 질문 2: 직접 입력: PR은 내일 열고 오늘은 Push만')
})

test('T9 /decide: closing the dialog (also at the second question) writes no answer and frees the marker', async ($, on) => {
  const w = base({ answer: qs => (qs[0]!.question.includes('2/2') ? undefined : first(qs)) })
  await boot($, on, w)
  const r = await run($)
  expect(r.text).toContain('기록하지 않았습니다')
  expect(w.files![ANS_PATH]).toBeUndefined()
  expect(w.log!.some(l => l.startsWith('rmdir ') && l.endsWith('.asking'))).toBe(true)
  expect(w.log!.some(l => l.startsWith('write ') && l.includes('.answer.md'))).toBe(false)
})

test('T13 /decide: an answer from the dialog is not taken when it is empty, and a failed write shows the answer and frees the marker', async ($, on) => {
  const empty = base({ answer: qs => Object.fromEntries(qs.map(q => [q.question, '  '])) })
  await boot($, on, empty)
  expect((await run($)).text).toContain('기록하지 않았습니다')
  expect(empty.files![ANS_PATH]).toBeUndefined()
})

for (const kind of ['peer', 'plugin', 'sdk', 'scheduled-trigger', 'task-notification', 'unclassified', 'history']) {
  test(`T5 origin ${kind}: /decide refuses, opens no dialog, writes nothing`, async ($, on) => {
    const w = base()
    await boot($, on, w)
    const r = await run($, { kind })
    expect(r.text).toContain(`origin: ${kind}`)
    expect(w.dialogs).toHaveLength(0)
    expect(w.log!.filter(l => l.startsWith('mkdir ') || l.startsWith('write ') || l.startsWith('mv '))).toEqual([])
  })
}

for (const kind of ['composer', 'bridge']) {
  test(`T5 origin ${kind}: a person's own input is accepted and the origin is recorded`, async ($, on) => {
    const w = base()
    await boot($, on, w)
    expect((await run($, { kind })).text).toBe('기록: SAMPLE-0001-d01')
    expect(w.files![ANS_PATH]).toContain(`origin: ${kind}`)
  })
}

test('T2 /decide: a marker another session already made stops this one before any dialog', async ($, on) => {
  const w = base({ markerTaken: () => true })
  await boot($, on, w)
  expect((await run($)).text).toContain('다른 세션이 이미 묻는 중')
  expect(w.dialogs).toHaveLength(0)
  expect(w.log!.some(l => l.startsWith('write '))).toBe(false)
})

test('T2 DR-ASK: while the dialog is open a new request only waits; the answer belongs to the request that was opened', async ($, on) => {
  let release = () => {}
  const w = base({ gate: new Promise<void>(r => { release = r }) })
  const second = item({ id: 'SAMPLE-0001-d02', createdAt: '2026-10-18T09:05:00+09:00', file: '/r/sample-app/.ai/user-decisions/SAMPLE-0001-d02.md' })
  w.files!['/r/sample-app/.ai/user-decisions/SAMPLE-0001-d02.md'] = REQ.replace('d01', 'd02')
  const clock = await boot($, on, w)
  const pending = run($)
  await clock.advance(5)
  // the board now shows the first as asking and a newly made second as waiting
  w.board = TSV([item({ state: 'asking' }), second])
  await clock.advance(10_000)
  release()
  expect((await pending).text).toBe('기록: SAMPLE-0001-d01')
  expect(w.files![ANS_PATH]).toContain('decisionId: SAMPLE-0001-d01')
  expect(w.files![ANS_PATH.replace('d01', 'd02')]).toBeUndefined()
  // the next /decide asks the second one
  w.board = TSV([item({ state: 'answered' }), second])
  await clock.advance(10_000)
  expect((await run($)).text).toBe('기록: SAMPLE-0001-d02')
})

test('Q6 /decide: a marker another session left more than 30 minutes ago can be asked again; a younger one cannot', async ($, on) => {
  const marker = `${H}/handoffs/user-decisions/sample-app/SAMPLE-0001-d01.asking`
  const old = base({ board: TSV([item({ state: 'asking' })]), answer: qs => (qs[0]!.question.includes('끊긴') ? { [qs[0]!.question]: '끊긴 질문 다시 묻기' } : first(qs)) })
  old.files![`${marker}/owner`] = 'session: sess-dead\nstartedAt: 2026-10-18T02:29:00Z\n'
  await boot($, on, old)
  expect((await run($)).text).toBe('기록: SAMPLE-0001-d01')
  expect(old.log!).toContain(`rmdir ${marker}`)
  expect(old.dialogs![0]![0]!.question).toContain('끊긴 질문')
})

test('Q6 /decide: a marker younger than 30 minutes is left alone', async ($, on) => {
  const marker = `${H}/handoffs/user-decisions/sample-app/SAMPLE-0001-d01.asking`
  const young = base({ board: TSV([item({ state: 'asking' })]) })
  young.files![`${marker}/owner`] = 'session: sess-other\nstartedAt: 2026-10-18T02:31:00Z\n'
  await boot($, on, young)
  expect((await run($)).text).toContain('결정 대기 없음')
  expect(young.dialogs).toHaveLength(0)
})

test('FM-5 /decide: a request that was closed after the board was read is not asked', async ($, on) => {
  const w = base({ exists: ['/r/sample-app/.ai/user-decisions/SAMPLE-0001-d01.done.md'] })
  await boot($, on, w)
  expect((await run($)).text).toContain('이미 끝난 요청')
  expect(w.dialogs).toHaveLength(0)
})

test('FM-5 /decide: a request that changes while it is read is not asked', async ($, on) => {
  let n = 0
  const w = base({ sha: () => String(n++ % 10).repeat(64) })
  await boot($, on, w)
  expect((await run($)).text).toContain('읽는 도중 요청이 바뀌었습니다')
  expect(w.dialogs).toHaveLength(0)
})

test('FM-8 /decide: when the answer cannot be written the chosen answers are shown and the marker is freed', async ($, on) => {
  const w = base({ writeFails: true })
  await boot($, on, w)
  const r = await run($)
  expect(r.text).toContain('답을 쓰지 못했습니다')
  expect(r.text).toContain('계획대로 (추천) / 지금 Push하고 PR 열기 (추천)')
  expect(w.log!.some(l => l.startsWith('rmdir ') && l.endsWith('.asking'))).toBe(true)
  expect(w.files![ANS_PATH]).toBeUndefined()
})

test('D6 /decide in a Project session: only its own project, the answer goes next to the request as a direct answer', async ($, on) => {
  const w = base({
    where: 'personal\t/h/hub/projects/sample-app\n', config: 'role: project\nprojectId: sample-app\n',
    board: TSV([item({ project: 'other', id: 'O-0001-d01', createdAt: '2026-10-18T08:00:00+09:00', file: '/r/other/.ai/user-decisions/O-0001-d01.md' }), item()]),
  })
  await boot($, on, w)
  expect((await run($)).text).toBe('기록: SAMPLE-0001-d01')
  const direct = '/r/sample-app/.ai/user-decisions/SAMPLE-0001-d01.answer.md'
  expect(w.files![direct]).toContain('where: project')
  expect(w.log!.some(l => l.includes('/handoffs/'))).toBe(false)
})

test('/decide: nothing waiting says so; a path that is not a request path is not asked', async ($, on) => {
  const none = base({ board: '' })
  await boot($, on, none)
  expect((await run($)).text).toBe('결정 대기 없음')
})

test('/decide: a request path outside .ai/user-decisions is not asked or written', async ($, on) => {
  const w = base({ board: TSV([item({ file: '/r/sample-app/elsewhere/SAMPLE-0001-d01.md' })]) })
  await boot($, on, w)
  expect((await run($)).text).toContain('경로가 이상해서')
  expect(w.dialogs).toHaveLength(0)
})

test('/decide: a Worker session asks nothing', async ($, on) => {
  const w = base({ terminal: 'term_w', board: [['worker', 'sample-app', '-', 'run_x', 'ready', 'claude/haiku', 'term_w'].join(T), TSV([item()])].join('\n') })
  await boot($, on, w)
  expect((await run($)).text).toContain('Worker')
  expect(w.dialogs).toHaveLength(0)
})

test('T10 a Project session is told once when its answer is there; not in a Worker or a Portfolio session', async ($, on) => {
  const answered = TSV([item({ state: 'answered' })])
  const w = base({ where: 'personal\t/h/hub/projects/sample-app\n', config: 'role: project\nprojectId: sample-app\n', board: answered })
  const clock = await boot($, on, w)
  await clock.advance(10_000)
  expect(w.prompts).toHaveLength(1)
  expect(w.prompts![0]).toContain('SAMPLE-0001-d01')
  expect(w.prompts![0]).toContain('decision-take')
  await clock.advance(60_000)
  expect(w.prompts).toHaveLength(1)
  // a second answer is a second notice, the first is not repeated
  w.board = TSV([item({ state: 'answered' }), item({ id: 'SAMPLE-0001-d02', state: 'answered', file: '/r/sample-app/.ai/user-decisions/SAMPLE-0001-d02.md' })])
  await clock.advance(20_000)
  expect(w.prompts).toHaveLength(2)
  expect(w.prompts![1]).toContain('SAMPLE-0001-d02')
})

test('T10 no notice in a Worker session, a Portfolio session, or for a request that still waits', async ($, on) => {
  const worker = base({ terminal: 'term_w', where: 'personal\t/h/hub/projects/sample-app\n', config: 'role: project\nprojectId: sample-app\n',
    board: [['worker', 'sample-app', '-', 'run_x', 'ready', 'claude/haiku', 'term_w'].join(T), TSV([item({ state: 'answered' })])].join('\n') })
  const clock = await boot($, on, worker)
  await clock.advance(60_000)
  expect(worker.prompts).toHaveLength(0)
})

test('T10 no notice in a Portfolio session or for a waiting request', async ($, on) => {
  const portfolio = base({ board: TSV([item({ state: 'answered' })]) })
  const clock = await boot($, on, portfolio)
  await clock.advance(60_000)
  expect(portfolio.prompts).toHaveLength(0)
})

test('T10 no notice for a request that still waits', async ($, on) => {
  const waiting = base({ where: 'personal\t/h/hub/projects/sample-app\n', config: 'role: project\nprojectId: sample-app\n', board: TSV([item({ state: 'waiting' })]) })
  const clock = await boot($, on, waiting)
  await clock.advance(60_000)
  expect(waiting.prompts).toHaveLength(0)
})

test('T5 guard: the model cannot make an answer, done or asking file with Write, Edit or Bash; reads and requests go through', async ($, on) => {
  const w = base({ reached: [] })
  await boot($, on, w)
  const call = (tool: string, input: object) => $.tool.call({ tool, ...input } as never) as Promise<{ deny?: string }>
  const U = '/r/sample-app/.ai/user-decisions'
  const hub = `${H}/handoffs/user-decisions/sample-app`
  const denied = [
    await call('Write', { file_path: `${hub}/SAMPLE-0001-d01.answer.md`, content: 'x' }),
    await call('Edit', { file_path: `${U}/SAMPLE-0001-d01.answer.md`, old_string: 'a', new_string: 'b' }),
    await call('NotebookEdit', { notebook_path: `${U}/SAMPLE-0001-d01.done.md`, new_source: 'x' }),
    await call('Bash', { command: `printf a > ${hub}/SAMPLE-0001-d01.answer.md` }),
    await call('Bash', { command: `rm ${U}/SAMPLE-0001-d01.done.md` }),
    await call('Bash', { command: `mkdir ${hub}/SAMPLE-0001-d01.asking` }),
  ]
  for (const d of denied) expect(d.deny).toContain('/decide')
  expect(w.reached).toEqual([])
  const passed = [
    await call('Read', { file_path: `${hub}/SAMPLE-0001-d01.answer.md` }),
    await call('Write', { file_path: `${U}/SAMPLE-0001-d01.md`, content: 'x' }),
    await call('Write', { file_path: `${U}/SAMPLE-0001-d01.result.md`, content: 'x' }),
    await call('Bash', { command: `cat ${U}/SAMPLE-0001-d01.md` }),
    await call('Bash', { command: `mv ${U}/.SAMPLE-0001-d01.md.tmp ${U}/SAMPLE-0001-d01.md` }),
  ]
  for (const p of passed) expect(p.deny).toBeUndefined()
  expect(w.reached).toEqual(['Read', 'Write', 'Write', 'Bash', 'Bash'])
})

test('T5 guard: a call it cannot read is refused, not let through (the hook fails, its .catch refuses)', async ($, on) => {
  const w = base({ reached: [] })
  await boot($, on, w)
  const r = (await $.tool.call({ tool: 'Bash', command: 7 } as never)) as { deny?: string }
  expect(r.deny).toContain('가드가 실패해 거부')
  expect(w.reached).toEqual([])
})
