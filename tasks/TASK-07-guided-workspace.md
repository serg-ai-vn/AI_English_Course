# TASK-07 — Guided student workspace

Owner-authorized follow-up to TASK-06, 2026-11-12. Source: owner's local
`Platform Ui Redesign Spec.md` and explicit clarification in this chat. Continue
in `feat/platform-ui-themes` / PR #3; checkpoint before this work is `1fb8b2f`.

Accepted behavior:
- Each previous iteration has its own keyboard-accessible disclosure, initially
  collapsed. Opening/closing it never toggles siblings or the active task. No
  group toggle for all iterations. Work remains available during the task.
- Published text stays visible; prompt, AI draft and review have separate blocks.
- Three helper drawers replace the always-expanded rules: goal, words, language.
  Full original requirements remain available in a nested disclosure.
- L2 About Me uses its real three-stage stepper; hobbies keep their own one-query
  and optional bonus flow. Four labeled fields produce the same string contract.
- Live checks use the actual server validator, not a second approximate gate.
  Indicators never replace server validation or disable submission on their own.
- Capitalized bank words, usage highlights, six short A2/Vietnamese glosses from
  the supplied specification, larger black teaching text in Classroom Light.
- Night Lab remains selectable and functional. L4 site presets untouched.

No changes to gate values, API request schemas, provider calls, server state
transitions, progress format, exports, student-site presets or teacher workflow.
The validator gets an environment adapter only and is served at one exact public
route; its validation functions remain identical.

Verification: Node suite, shared-validator parity, both-theme browser flows,
independent disclosures during active work and after completion, retained inputs
and focus, narrow layouts, unchanged demo export, isolated smoke and CI. Review
the final PR SHA independently before merge. Do not overwrite TASK-06 baseline
screenshots: follow-up evidence belongs in its own directory.
