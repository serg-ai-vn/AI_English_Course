# Owner visual review — 2026-11-12

Same `feat/platform-ui-themes` branch / draft PR #3. Base checkpoint `4be20ad`
remains in history. Final SHA and current CI result are recorded in the PR and
handoff. No main merge or independent acceptance is claimed here.

## Disposition of the nine screenshot comments

| Comments | Result |
|---|---|
| 1 | Numbered, titled goal cards with brand colors; helper labels use one line, including Grammar: Present Perfect |
| 2–3 | Yellow headings for field names. Centered checks explicitly say To do / Ready; teacher-only note, no server jargon |
| 4 | Each hobby has one outer visual card, containing the existing name field and description workflow. IDs, saves, corrections and gates stay separate internally |
| 5 | Iteration summary bars and Role/Context/Task/Format (also Subject/Style/Framing/Lighting) badges use yellow |
| 6 | Yellow heading + green check + one small semantic completion label. No duplicate strips, publication badges or completed steppers. Final text stays visible |
| 7 | Each requirement keeps its full text in a numbered card with a short heading and alternating warm/blue surfaces |
| 8 | L3 config was missing drivingQuestion; restored the exact existing course question from Lesson_3.md. All L2–L5 now have three goal cards; older cached L3 API configs work with the frontend fallback |
| 9 | Same heading/status/formula hierarchy for L3 and L4. Historical image previews use contain rather than cropping away image details |

Each iteration remains separately expandable. Native disclosure keyboard behavior
is preserved. No whole-history toggle was introduced. Draft caches are in-memory,
scoped to the learner/field/stage: saving the hobby name does not erase a prompt
already typed in the unified card. No autosave, new field or data migration.

Changed layers: app.js / workspace-ui.js / platform.css, L3 display metadata,
browser tests and documentation. Server code, validator, AI/provider, auth,
progress schema, lesson gate values, teacher workflow, student presets and export
code are unchanged. New lesson goal summaries paraphrase existing approved rules;
the complete original requirements remain available, without changing limits.

## Verification

Windows Chrome, Node 24.14.1, locked dependencies. Synthetic per-theme temporary
DATA_DIR; owner preview data not used for regression tests.

- PASS: check and whitespace validation.
- PASS: Node 14/14, isolated smoke (10 public routes/MIME, 5 denied paths), build.
- PASS: complete two-theme browser suite, 12/12 (1.9m), including corrections,
  L2 generation/review/edit, L3–L5 generation/choices/teacher publishing, revocation,
  retained drafts/focus, L4 presets, responsive and font fallback regressions.
- PASS: focused review scenarios in both themes also cover one-line helpers at
  320px, three goal cards per L2–L4, restored question, numbered requirement cards,
  no duplicate completion cues and hobby-name save retaining the prompt draft.
  An additional presentation fixture omits L3 drivingQuestion to test compatibility
  with the older running preview server.
- Fixed demo export hash remains
  `19982ef50c7f3a246c3cbd0a8c67d933b4e2ead5f01b996292101000a33125d5`.
- Visual inspection: completed About Me, unified hobby, L3 goals/requirements,
  image history and yellow/green hierarchy. Green `#12502c` on yellow `#ffb703`
  measures 5.44:1. No claim of a complete accessibility or pedagogical audit.
- CI: use current final PR head, not a previous checkpoint's run.
- Independent acceptance / owner approval: PENDING.
- Physical devices/projector, paid AI, VPS/HTTPS: NOT_RUN; backlog unchanged.

Evidence: [synthetic screenshots](../ui-review/). Card images are crops of a real
full-page screenshot taken at scroll top, so sticky navigation does not obscure
their headings; product styles are not altered for capture. Old theme-only and
guided-workspace screenshots remain historical evidence, not overwritten.

## Local preview and recovery

The existing preview at `http://127.0.0.1:3001/workspace.html` serves the new CSS and
JavaScript; use a full browser refresh. It retains its separate runtime data copy.
Its process was not replaced: a startup probe found the port occupied, so the
frontend compatibility fallback handles its old cached L3 config. No reset or
restore was performed on owner progress. Runtime files/logs remain ignored.

Night Lab remains available through `window.PlatformTheme.setTheme('night-lab')`.
For the preceding interaction layout, checkpoint `4be20ad` remains available.
Any code rollback should use exact follow-up commits in a separate revert PR,
without restoring old data over new learner work. No reset/force push/main merge.
