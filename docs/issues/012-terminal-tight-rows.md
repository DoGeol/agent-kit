# 012. The terminal card cut when rows run short

- **State:** fixed

## Symptom
While the terminal's own agent list was up, the band got fewer rows. The card was then cut to its top border, with `↓ 2 more`.

## Done
Below 7 rows, the card border and usage line are left out, and only the summary and agent rows are drawn (`isTight`).
