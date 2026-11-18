# Synthetic browser state evidence

Captured by Playwright in Chrome on Windows, 2026-11-12. Prefixes identify the
shell theme. Fixture data only; no owner profiles or real student information.
Main screenshots and verification boundaries: [implementation report](../../history/2026-11-12-platform-ui-theme-implementation.md).

- `student-correction`, `teacher-grant-form`: existing correction workflow,
  1280×900; preserved drafts and validation. The teacher context uses Playwright's
  default 1280×720 viewport.
- `L2-provider-error`, `L2-eval-2`, `L2-completed-journal`: card captures during the
  complete About Me browser workflow, page viewport 1280×900.
- `L4-comparison-320`, `teacher-320`: 320×844, Google Fonts blocked, presentation
  fixture for L4 comparison. No overflow assertion is relaxed for narrow screens.

Card captures can include the sticky header as Playwright scrolls the card into
view. Full-page comparisons in `../before` and `../after` show normal page context.
