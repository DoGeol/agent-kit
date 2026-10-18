import type { ClientModule } from 'claude-code'

// The time since a check, counted here once a second, so the hook draws once per check and not once per second.
// It counts ticks since the props arrived: the module has no `Date.now()` to trust, and the hook hands it `now`.
type Props = { at: number; now: number; warnAfterMs: number; prefix?: string; isError?: boolean }
type State = { ticks: number; now: number }

// Same wording as `agoText` in register.tsx (a surface module cannot import from the hooks module).
const text = (ms: number): string => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`
}

const Ago: ClientModule<Props, State> = (p, s) => {
  const { Text } = s.elements
  const st = s.state
  if (!st) {
    s.setState({ ticks: 0, now: p.now })
    s.every(1000, () => {
      const c = s.state
      if (c) s.setState({ ticks: c.ticks + 1, now: c.now })
    })
  } else if (st.now !== p.now) s.setState({ ticks: 0, now: p.now })
  const elapsed = p.now - p.at + (st && st.now === p.now ? st.ticks : 0) * 1000
  const isLate = elapsed > p.warnAfterMs
  return (
    <Text color={isLate ? 'warning' : p.isError ? 'error' : undefined} dimColor={!isLate && !p.isError}>
      {p.prefix ?? '확인 '}
      {text(elapsed)}
    </Text>
  )
}

export default Ago
