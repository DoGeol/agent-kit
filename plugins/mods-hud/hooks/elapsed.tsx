import type { ClientModule } from 'claude-code'

// A running agent's clock, drawn in its own region: only these few cells redraw each second,
// not the band around them (a whole-band redraw every second made the app blink and drop clicks).
// Every 2 s it posts to the hooks module, which answers with a fresh `now` (issue 018, stage 0):
// `got` counts those answers, so /mods-hud debug shows whether the round trip works on this surface.
type Props = { startedAt: number; now: number; answer?: number }
type State = { seen: number; ticks: number; got: number }

const two = (n: number) => String(n).padStart(2, '0')
const dur = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(sec / 3600)
  const ms_ = `${two(Math.floor((sec % 3600) / 60))}:${two(sec % 60)}`
  return h > 0 ? `${h}:${ms_}` : ms_
}

const Elapsed: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements
  if (surface.state === undefined) {
    surface.setState({ seen: props.now, ticks: 0, got: 0 })
    // ticks count seconds since the last `now` handed in, by a redraw or an answer
    surface.every(1000, () => {
      const s = surface.state
      if (!s) return
      surface.setState({ ...s, ticks: s.ticks + 1 })
      if (s.ticks % 2 === 1) surface.post({ startedAt: props.startedAt, got: s.got })
    })
  } else if (surface.state.seen !== props.now || (props.answer ?? 0) > surface.state.got) {
    // a fresh `now`, by a redraw or an answer (`answer` numbers them): count from it
    surface.setState({ seen: props.now, ticks: 0, got: Math.max(surface.state.got, props.answer ?? 0) })
  }
  const ticks = surface.state && surface.state.seen === props.now ? surface.state.ticks : 0
  return <Text dimColor>{dur(props.now - props.startedAt + ticks * 1000)}</Text>
}

export default Elapsed
