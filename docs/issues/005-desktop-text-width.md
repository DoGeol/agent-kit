# 005. Cutting text on the desktop's proportional font

- **State:** fixed (mods-hud 0.7.0); the Hangul width is still a tuned value
- **Where:** `cells` and `clipCells` in `hooks/text.ts`, called with the surface's width from the band

## Symptom
Cutting by terminal cells (Hangul = 2) left about a third of a desktop row empty before the cut.

## First fix (0.3)
Text on the desktop was cut at budget × 1.3 (`fit`). That widened the budget for every script, so long all-Latin text (session names, file paths) could run past the band by up to 30%, since a Latin glyph takes about one cell there too.

## Fix (0.7.0)
Width is measured per character class and per surface. `cells(text, wide)` counts a Hangul or CJK glyph as `wide` cells and anything else as one; the band passes `wide = 2` on a terminal and `DESKTOP_WIDE = 1.5` on the desktop, and every label, button and feed line is cut with it. The step-line feed region carries `wide` with each ask, so its answers are cut the same.

1.5 matches where the 1.3 factor cut Hangul-only lines (2 ÷ 1.3 ≈ 1.54), so Hangul rows look as before and Latin rows now fit.

## Tests
`tests/peers.test.ts` "long session names and messages stay one line on both surfaces": a Hangul row measured with its surface's width fits the band, and an all-Latin summary on the desktop fits without the Hangul allowance.

## Remaining issue
- 1.5 is tuned by eye for the desktop's font. Symbols (`·`, `→`, `▸`) and capitals are counted as one cell; a row of mostly capitals may still run a little long.

## Checked
- **Desktop (2026-10-12):** long summary lines are cut at a fitting place (checked by eye, with the 1.3 factor).
- **Desktop with 1.5:** not yet checked by eye.
