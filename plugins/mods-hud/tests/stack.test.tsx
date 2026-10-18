import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// The band slot is shared: mods-hud draws its card and keeps whatever the plugins beneath drew under it.

const NOW = new Date(2026, 9, 11, 12, 0).getTime()
const BAND = { hasSurvey: false, isWorking: true, maxRows: 16, bodyColumns: 120, scroll: { offset: 0, bodyRows: 12 }, view: {} } as const

const world = (on: On) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.surfaces', () => ({ value: ['desktop'] }))
  on('ui.status', () => ({ value: undefined }))
  on('classic.PostModelSwitch', () => ({}))
  on('settings.read', () => ({ value: { effortLevel: 'max', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } } }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 200000, percent: 18 }, rateLimits: [{ kind: 'five_hour', percentUsed: 63, resetsAt: new Date(2026, 9, 11, 15, 30).toISOString() }] },
  }))
  on('agent.list', () => ({ value: [] }))
  on('ui.toast', () => ({ value: undefined }))
}

// Draws its line under whatever is beneath it, as orchestration-kit does.
const under = {
  name: 'under',
  tier: 'append',
  register: (on: On) => {
    on('ui.render', { component: 'AbovePrompt' }, async (_$, e, next) => {
      const below = await next(e).catch(() => undefined)
      const line = { type: 'Text', children: ['UNDER LINE'] }
      return { type: 'Box', children: below ? [below, line] : [line] }
    })
  },
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`T1 ${surface}: the card stays and a line drawn beneath it shows under it`, { plugins: [under] }, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    world(on)
    await $.session.start({ cwd: '/tmp/x', surface, isInteractive: true })
    await clock.advance(2000)
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Box', key: 'band' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'UNDER LINE' })).toBeDefined()
    const order = (await ui.findAll({})).map(n => n.props.key ?? n.text)
    expect(order.indexOf('band')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('band')).toBeLessThan(order.indexOf('UNDER LINE'))
    await ui.unmount()
  })

  test(`T2 ${surface}: with nothing beneath, the card is drawn alone`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    world(on)
    await $.session.start({ cwd: '/tmp/x', surface, isInteractive: true })
    await clock.advance(2000)
    const ui = await $.ui.mount({ plugin: 'mods-hud', surface, component: 'AbovePrompt', props: BAND })
    const band = await ui.find({ type: 'Box', key: 'band' })
    expect(band).toBeDefined()
    expect((await ui.findAll({ type: 'Box' }))[0]).toEqual(band)
    await ui.unmount()
  })
}
