import type { ClientModule } from 'claude-code'

// A running agent's clock, drawn in its own region: only these few cells redraw each second,
// not the band around them (a whole-band redraw every second made the app blink and drop clicks).
type Props = { startedAt: number; now: number }
type State = { seen: number; ticks: number }

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
    surface.setState({ seen: props.now, ticks: 0 })
    // ticks count seconds since the band last handed a `now`
    surface.every(1000, () => {
      const s = surface.state
      if (s) surface.setState({ seen: s.seen, ticks: s.ticks + 1 })
    })
  } else if (surface.state.seen !== props.now) {
    // the band redrew with a fresh `now`: count from it
    surface.setState({ seen: props.now, ticks: 0 })
  }
  const ticks = surface.state && surface.state.seen === props.now ? surface.state.ticks : 0
  return <Text dimColor>{dur(props.now - props.startedAt + ticks * 1000)}</Text>
}

export default Elapsed
