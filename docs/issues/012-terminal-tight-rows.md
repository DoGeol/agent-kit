# 012. The terminal card cut when rows run short

- **State:** fixed, confirmed on the terminal

## Symptom
While the terminal's own agent list was up, the band got fewer rows. The card was then cut to its top border, with `↓ 2 more`.

## Done
Below 7 rows, the card border and usage line are left out, and only the summary and agent rows are drawn (`isTight`).

## Checked
- **Terminal (2026-10-11):** a 16-row terminal gave the band 1 row. No border was drawn, only the summary line with the branch.
