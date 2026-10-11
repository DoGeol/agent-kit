import type { ClientModule } from 'claude-code'

// Lines that change on every tool call (an agent's latest step, the calls list), drawn in their own region (issue 018).
// The hooks module keeps them out of $.state, so a call redraws no band or pane, and a press never lands mid-redraw (issue 001).
// Each second the region asks for its topic; the hooks module answers with new lines only when they changed.
export type FeedLine = { mark?: string; color?: string; dim?: true; text: string }
// `columns`: the cells the drawing cut lines to, the desktop's Hangul fit applied; asked with, so answers cut the same
type Props = { topic: string; columns: number; lines: FeedLine[] }

type Ask = { topic: string; columns: number }

const Feed: ClientModule<Props, Ask> = (props, surface) => {
  const { Box, Text } = surface.elements
  // what to ask with: the newest props' topic and width (a redraw after a resize hands new ones, state kept)
  const s = surface.state
  if (s === undefined) {
    surface.setState({ topic: props.topic, columns: props.columns })
    surface.every(1000, () => surface.state && surface.post(surface.state))
  } else if (s.topic !== props.topic || s.columns !== props.columns) {
    surface.setState({ topic: props.topic, columns: props.columns })
  }
  return (
    <Box flexDirection="column">
      {props.lines.map((l, i) => (
        <Box key={`l${i}`} flexDirection="row" columnGap={1}>
          {l.mark !== undefined && <Text color={l.color}>{l.mark}</Text>}
          <Text wrap="truncate-end" dimColor={l.dim}>{l.text}</Text>
        </Box>
      ))}
    </Box>
  )
}

export default Feed
