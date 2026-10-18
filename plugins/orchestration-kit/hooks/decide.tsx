import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Board, Item } from '../types'
import { register as registerBoard } from './register'

// The entry module of the plugin (hooks.json names only this one): it starts the portfolio board (register.tsx, read-only) and adds what writes.
// /decide asks the first waiting user decision request in the engine's own question dialog and writes the answer file; nothing else writes one.
// A guard keeps the model's Write, Edit and Bash from making answer, done or asking files. A Project session is told once when its answer is there.

const boardAtom = atom({ plugin: 'orchestration-kit', key: 'board' } as const, null as Board | null)
const lastAtom = atom({ plugin: 'orchestration-kit', key: 'decideLast' } as const, '')
const notifiedAtom = atom({ plugin: 'orchestration-kit', key: 'decideNotified' } as const, [] as string[])

/** Only a person's own input may open the dialog: the terminal (composer) or Remote Control (bridge). Anything else, including kinds added later, is refused. */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge'])
/** A marker another session left this long ago is taken to be abandoned. */
export const STALE_ASKING_MS = 30 * 60_000
/** How often the board is looked at for an answer that has come. */
const NOTIFY_MS = 10_000

export type Option = { label: string; description: string }
export type Question = { name: string; prompt: string; options: Option[] }
export type Request = { id: string; project: string; irreversible: boolean; title: string; background: string; questions: Question[]; run: string }

const frontValue = (fm: string, key: string): string => new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(fm)?.[1] ?? ''

/** A request file (user-decision/v1) as data, or why it is not one. kit.sh checks the same rules; this only has to read what it was given. */
export const parseRequest = (md: string): Request | { error: string } => {
  const text = md.replace(/\r/g, '')
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (!m) return { error: '머리말이 없음' }
  const [, fm = '', body = ''] = m
  if (frontValue(fm, 'schema') !== 'user-decision/v1') return { error: 'schema가 user-decision/v1이 아님' }
  const sections: { head: string; lines: string[] }[] = []
  let title = ''
  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) sections.push({ head: line.slice(3), lines: [] })
    else if (line.startsWith('# ') && !title && sections.length === 0) title = line.slice(2).trim()
    else sections.at(-1)?.lines.push(line)
  }
  const questions: Question[] = []
  for (const s of sections.filter(x => /^질문 \d+/.test(x.head))) {
    const options: Option[] = []
    const prompt: string[] = []
    for (const line of s.lines) {
      const o = /^\d+\. (.+)$/.exec(line)
      if (o) {
        const [label = '', ...rest] = o[1]!.split(' — ')
        options.push({ label: label.trim(), description: rest.join(' — ').trim() })
      } else if (options.length === 0 && line.trim()) prompt.push(line.trim())
    }
    questions.push({ name: s.head.replace(/^질문 \d+:?\s*/, '').trim(), prompt: prompt.join(' '), options })
  }
  if (questions.length < 1 || questions.length > 4) return { error: `질문이 ${questions.length}개 (1~4개여야 함)` }
  const bad = questions.findIndex(q => q.options.length < 2 || q.options.length > 4)
  if (bad >= 0) return { error: `질문 ${bad + 1}의 선택지가 ${questions[bad]!.options.length}개 (2~4개여야 함)` }
  const run = sections.find(x => x.head.startsWith('실행 내용'))
  const irreversible = frontValue(fm, 'irreversible') === 'true'
  if (irreversible && !run?.lines.some(l => l.trim())) return { error: 'irreversible인데 실행 내용이 없음' }
  return {
    id: frontValue(fm, 'decisionId'),
    project: frontValue(fm, 'projectId'),
    irreversible,
    title,
    background: sections.find(x => x.head === '배경')?.lines.join('\n').trim() ?? '',
    questions,
    run: run ? `## ${run.head}\n${run.lines.join('\n').trim()}` : '',
  }
}

/** The request to ask next: the first waiting one, but a project just asked about goes on with its own next one first. Rows are in the order they were made. */
export const nextRequest = (rows: readonly Item[], lastProject?: string): Item | undefined => {
  const waiting = rows
    .filter(r => r.kind === 'decision' && r.state === 'waiting')
    .sort((a, b) => (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0) || a.project.localeCompare(b.project) || a.id.localeCompare(b.id))
  return (lastProject ? waiting.find(r => r.project === lastProject) : undefined) ?? waiting[0]
}

/** The line one answer becomes: the option's name if the dialog gave exactly it, else what the person typed. */
export const answerOf = (q: Question, raw: string): string =>
  q.options.some(o => o.label === raw) ? raw : `직접 입력: ${raw.replace(/\s*\n\s*/g, ' ').trim()}`

export type Meta = { at: string; origin: string; where: 'portfolio' | 'project'; session: string; digest: string }

/** The answer file (user-decision-answer/v1). */
export const answerText = (req: Pick<Request, 'id' | 'project'>, answers: readonly string[], meta: Meta): string =>
  [
    '---', 'schema: user-decision-answer/v1', `decisionId: ${req.id}`, `projectId: ${req.project}`, `answeredAt: ${meta.at}`,
    'recordedBy: dialog', `origin: ${meta.origin}`, `where: ${meta.where}`, `session: ${meta.session}`, `requestDigest: sha256:${meta.digest}`, '---', '',
    ...answers.map((a, i) => `- 질문 ${i + 1}: ${a}`), '',
  ].join('\n')

const GUARDED_PATH = /\/user-decisions\/(?:[^/]+\/)*(?:[^/]*\.(?:answer|done)\.md$|[^/]*\.asking(?:\/|$))/
const GUARDED_NAME = /\.(?:answer|done)\.md\b|\.asking\b/
// shortcut: a text match on the command, so a variable, a script file or an encoded string gets by; a person or the dialog's own code is the only writer that counts.
const WRITE_VERB = />|\b(?:tee|cp|mv|mkdir|rmdir|rm|ln|touch|dd|install|truncate)\b|\b(?:sed|perl)\b[^|;&]*\s-[a-zA-Z]*i/

/** True when a model's tool call would make or change an answer, done or asking file. Reading them, and writing requests and results, is not guarded. */
export const isGuardedWrite = (tool: string, input: unknown): boolean => {
  const i = (input ?? {}) as Record<string, unknown>
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit' || tool === 'MultiEdit') {
    return [i.file_path, i.notebook_path, i.path].some(p => typeof p === 'string' && GUARDED_PATH.test(p))
  }
  if (tool === 'Bash') {
    // A call that cannot be read is refused by the hook's .catch, not let through.
    if (typeof i.command !== 'string') throw new Error('Bash call without a command text')
    return GUARDED_NAME.test(i.command) && WRITE_VERB.test(i.command)
  }
  return false
}

/** Answered requests of this project that its session has not been told about yet. */
export const toNotify = (b: Board | null, notified: readonly string[]): Item[] =>
  !b || b.isWorker || b.okAt === null || b.workersUnknown || !b.mine
    ? []
    : b.items.filter(i => i.kind === 'decision' && i.state === 'answered' && i.project === b.mine && !notified.includes(`${i.project}/${i.id}`))

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/'))
const isoOf = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')

export const register: Register = (on, options) => {
  registerBoard(on, options)


  on('command.run', { command: 'decide' }, async ($, e) => {
    if (!ALLOWED_ORIGINS.has(e.origin.kind)) return { text: `/decide는 사용자 입력으로만 실행됩니다 (origin: ${e.origin.kind}). 답을 쓰지 않았습니다.` }
    const b = await read($, boardAtom)
    if (!b) return { text: '결정 대기를 읽지 못했습니다 (hub를 아직 찾지 못했거나 첫 읽기 전).' }
    if (b.isWorker) return { text: '이 세션은 Worker라 결정을 받지 않습니다.' }
    const where = b.mine ? 'project' : 'portfolio'
    const rows = b.items.filter(i => i.kind === 'decision' && (!b.mine || i.project === b.mine))
    const now = await $.clock.now()
    const session = String(await $.session.id())

    // Nothing waits but a marker another session left long ago: offer to ask it again.
    let row = nextRequest(rows, await read($, lastAtom))
    if (!row) {
      for (const r of rows.filter(x => x.state === 'asking' && x.file && x.answerDir)) {
        const marker = `${where === 'project' ? dirOf(r.file!) : r.answerDir!}/${r.id}.asking`
        const other = `${where === 'project' ? r.answerDir! : dirOf(r.file!)}/${r.id}.asking`
        for (const m of [marker, other]) {
          const owner = await $.fs.read(`${m}/owner`).catch(() => null)
          if (owner === null) continue
          const at = Date.parse(/^startedAt:\s*(\S+)/m.exec(owner)?.[1] ?? '')
          const who = /^session:\s*(\S+)/m.exec(owner)?.[1]
          if (who === session || !Number.isFinite(at) || now - at <= STALE_ASKING_MS) continue
          const pick = await $.ui.ask(`${r.id}를 ${Math.round((now - at) / 60_000)}분 전에 묻기 시작했지만 답이 없습니다. 끊긴 질문을 다시 물을까요?`, ['끊긴 질문 다시 묻기', '건너뛰기']).catch(() => '건너뛰기')
          if (pick !== '끊긴 질문 다시 묻기') return { text: '건너뜀' }
          await $.process.run(['rm', '-f', `${m}/owner`])
          await $.process.run(['rmdir', m])
          row = { ...r, state: 'waiting' }
        }
        if (row) break
      }
    }
    if (!row) {
      const asking = rows.filter(x => x.state === 'asking').length
      return { text: asking > 0 ? `결정 대기 없음 (묻는 중 ${asking}건은 다른 세션이 열어 둠)` : '결정 대기 없음' }
    }

    // The board may be ten seconds old: look at the request itself before asking.
    const file = row.file ?? ''
    const ansDir = row.answerDir ?? ''
    const idOk = file.endsWith(`/.ai/user-decisions/${row.id}.md`) && ansDir.endsWith(`/handoffs/user-decisions/${row.project}`)
    if (!idOk) return { text: `${row.id}: 경로가 이상해서 묻지 않았습니다.` }
    const stateDir = dirOf(file)
    if (await $.fs.exists(`${stateDir}/${row.id}.done.md`)) return { text: `${row.id}는 이미 끝난 요청입니다.` }
    const sha = async () => {
      const r = await $.process.run(['shasum', '-a', '256', file]).catch(() => null)
      const out = r && r.exitCode === 0 ? r : await $.process.run(['sha256sum', file])
      return out.stdout.trim().split(/\s+/)[0] ?? ''
    }
    const digest = await sha()
    const md = await $.fs.read(file)
    if ((await sha()) !== digest) return { text: `${row.id}: 읽는 도중 요청이 바뀌었습니다. 다시 /decide를 치세요.` }
    const req = parseRequest(md)
    if ('error' in req) return { text: `${row.id}: 요청 형식 오류: ${req.error}` }

    // One asker per request: mkdir is atomic, the loser is told and nothing else happens.
    const dir = where === 'project' ? stateDir : ansDir
    const marker = `${dir}/${row.id}.asking`
    await $.process.run(['mkdir', '-p', dir])
    const made = await $.process.run(['mkdir', marker])
    if (made.exitCode !== 0) return { text: `${row.id}: 다른 세션이 이미 묻는 중입니다.` }
    const release = async () => {
      await $.process.run(['rm', '-f', `${marker}/owner`])
      await $.process.run(['rmdir', marker])
    }
    try {
      await $.fs.write(`${marker}/owner`, `session: ${session}\nstartedAt: ${isoOf(now)}\n`)
      $.ui.log([`[${req.id}] ${req.title}`, req.background, req.run].filter(Boolean).join('\n\n'))
      // The engine opens AskUserQuestion only through $.ui.ask (a plugin's $.tool.call of it is refused), which takes labels alone:
      // each question is one dialog, and the option texts (result, undo, cost) ride in the question.
      const lines: string[] = []
      try {
        for (const [n, q] of req.questions.entries()) {
          const text = [`질문 ${n + 1}/${req.questions.length}: ${q.name}${q.prompt ? ` — ${q.prompt}` : ''}`, ...q.options.map((o, k) => `${k + 1}. ${o.label}${o.description ? ` — ${o.description}` : ''}`)].join('\n')
          const given = (await $.ui.ask(text, { options: q.options.map(o => o.label), header: `질문 ${n + 1}/${req.questions.length}` })).trim()
          if (!given) throw new Error('빈 답')
          lines.push(given)
        }
      } catch (err) {
        // A dismissed dialog, or none answered: nothing is written, and the request waits again.
        await release()
        return { text: `${req.id}: 모든 질문에 답하지 않아 기록하지 않았습니다 (${String(err)}).` }
      }
      const text = answerText(req, lines.map((l, n) => answerOf(req.questions[n]!, l)), { at: isoOf(now), origin: e.origin.kind, where, session, digest })
      const tmp = `${dir}/.${req.id}.answer.md.tmp`
      try {
        await $.fs.write(tmp, text)
        const mv = await $.process.run(['mv', '-f', tmp, `${dir}/${req.id}.answer.md`])
        if (mv.exitCode !== 0) throw new Error(mv.stderr.trim() || 'mv 실패')
      } catch (err) {
        await release()
        return { text: `${req.id}: 답을 쓰지 못했습니다 (${String(err)}). 고른 답: ${lines.join(' / ')}` }
      }
      await release()
      await update($, lastAtom, () => req.project)
      $.ui.log(`결정 기록: ${req.id} (${req.project}) ${where} ${e.origin.kind} sha256:${digest.slice(0, 12)}`)
      return { text: `기록: ${req.id}` }
    } catch (err) {
      await release()
      return { text: `${row.id}: 중단됨 (${String(err)})` }
    }
  })

  // The model may not make answer, done or asking files. A guard that fails refuses.
  on('tool.call', async ($, e, next) => {
    if (isGuardedWrite(String(e.tool), e)) return { deny: '사용자 결정 답·완료·묻는 중 표지는 결정 명령(/decide)과 kit.sh decision-take만 만든다. 이 파일을 쓰지 않는다.' }
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: '사용자 결정 파일 가드가 실패해 거부했다.' }))

  // One hook for the session start: the board module (register.tsx) already has the one without a matcher, and the engine allows a second only with a matcher.
  // A Project session is told once, when the board first shows an answer for it. The file is the record; the turn only says where to look.
  // A timer, not a hook on the board's write: the prompt waits for an idle session, and a write must not wait for that.
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    await $.command.register({ name: 'decide', description: '사용자 결정 요청을 순서대로 하나 묻고 답을 기록 (Portfolio·Project 세션)' })
    $.clock.every(NOTIFY_MS, async () => {
      try {
        const fresh = toNotify(await read($, boardAtom), await read($, notifiedAtom))
        if (fresh.length === 0) return
        await update($, notifiedAtom, d => [...d, ...fresh.map(i => `${i.project}/${i.id}`)])
        for (const i of fresh) {
          void $.prompt.submit({ text: `사용자 결정이 도착했습니다: ${i.id}. 셸에서 \`sh ${$.plugin.root}/scripts/kit.sh decision-take . ${i.id}\`로 받아 진행합니다 (exit 0일 때만).` }).catch(() => undefined)
        }
      } catch (err) {
        $.ui.log(`orchestration-kit: 결정 알림 실패: ${String(err)}`, { to: 'debug' })
      }
    })
    return next(e)
  })
}
