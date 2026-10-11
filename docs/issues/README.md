# Issues

Issues found while building and testing `plugins/mods-hud`.

| # | Issue | State |
|---|---|---|
| [001](001-detail-pane-missed-press.md) | Presses in the detail pane are sometimes lost | closed: pane removed (0.5.0) |
| [002](002-band-missed-press-and-flicker.md) | Band presses lost, and the app blinks | fixed; terminal checked, desktop not yet |
| [003](003-client-elapsed-clock.md) | A running clock in a Client region (partial rendering) | confirmed on desktop |
| [004](004-listagents-from-plugin.md) | Whether ListAgents works from a plugin | works (terminal) |
| [005](005-desktop-text-width.md) | Cutting text on the desktop's proportional font | guessed value, looks right |
| [006](006-desktop-native-buttons.md) | The desktop draws Buttons natively | worked around, confirmed |
| [007](007-peer-message-card-offset.md) | A turn another session starts is logged on the previous card | known limit |
| [008](008-reload-resurrects-closed-agent.md) | After a reload, a closed subagent comes back | fixed |
| [009](009-summary-wording.md) | The wording of Korean summaries drifts | mitigated, output filtered |
| [010](010-usage-staleness.md) | Usage only updates on this session's responses | engine limit |
| [011](011-band-engine-mark.md) | The `[-]` on the band's right | can't be removed |
| [012](012-terminal-tight-rows.md) | The terminal card cut when rows run short | fixed, confirmed |
| [013](013-meter-empty-after-failed-start.md) | Model, effort and usage missing from the terminal board | fixed |
| [014](014-remote-control-no-band.md) | No band in the desktop view of a Remote Control session | open, upstream (#101256) |
| [015](015-split-view-right-pane.md) | No band in a split view's right pane | open, upstream (#99265) |
| [016](016-desktop-reload-keeps-old-module.md) | `/reload-plugins` does not load a new mods-hud in a desktop session | open, upstream (#96223) |
| [017](017-detail-pane-stale-title.md) | The detail pane keeps its first title | closed: pane removed (0.5.0) |
| [018](018-detail-pane-client-regions.md) | Session detail on Client regions, with clearer tabs | closed: pane removed (0.5.0); band feed kept |
