# TASK-07 synthetic screenshots

Windows Chrome; isolated mock demo profiles; no owner data. Prefix identifies the
platform theme. Source commands and limits: [implementation report](../history/2026-11-12-guided-workspace.md).

- `L2-1280`, `L2-320`: 1280×900 / 320×844 viewport captures of the completed Lumi
  fixture; compact helper bar at the top, iteration histories initially collapsed.
- `L2-provider-error`: card capture, four-field form and live chips after a
  deliberately simulated provider error, input preserved.
- `L2-eval-2`: current second AI response/review stays available while the previous
  saved iteration is individually collapsed.
- `L2-completed-journal`: published result visible; first iteration closed and
  second iteration open. Both can also be opened simultaneously.
- `L2-builder-320`: active form at 320×844, no page overflow.
- `L4-comparison-320`: preset swatches and sample fonts retain their own values.

Card screenshots can contain the sticky header while Playwright scrolls the card
into view. The older theme-only baseline is retained unchanged in `../ui-themes/`.
