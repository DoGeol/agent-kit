# 005. Cutting text on the desktop's proportional font

- **State:** a guessed value applied, looks right on the desktop
- **Where:** `fit()` in the band, the pane and the history

## Symptom
Cutting by terminal cells (Hangul = 2) left about a third of a desktop row empty before the cut.

## Done
Text on the desktop is cut at budget × 1.3 (`fit`). The terminal stays exact.

## Remaining issue
- 1.3 is a guess tuned for Hangul. Long all-Latin text (session names, file paths) may overflow, since Latin glyphs take about one cell.
- An improvement: estimate width per character class (Hangul / Latin / symbol).

## Checked
- **Desktop (2026-10-12):** long summary lines are cut at a fitting place (checked by eye).
