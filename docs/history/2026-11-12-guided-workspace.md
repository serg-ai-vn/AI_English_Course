# Guided workspace follow-up — 2026-11-12

Branch `feat/platform-ui-themes`, same draft PR #3. Base checkpoint `1fb8b2f` is
retained both locally and on GitHub. Main remains `4a24548`. Exact final SHA and
CI status are recorded in the PR/handoff, avoiding a self-referential hash here.
Status: ready for owner review; independent acceptance and merge pending.

## Authorized scope and decisions

Owner supplied `Platform Ui Redesign Spec.md`, then explicitly authorized this
workflow and clarified that **each iteration** must expand/collapse independently.
The document was read locally; no attachment or private draft directory copied
into Git. D13 in DECISIONS and Lesson 2 records the approved replacement for the
old always-expanded-history comment. No measured learning-effect claim is made.

Implemented: three helper drawers with complete requirements reachable; L2
stepper; four prompt fields; live requirement and vocabulary indicators; capital
initials and six brief A2/Vietnamese word glosses; structured prompt rows, warm
AI draft card, two review cards; black 18–20px light teaching text; visible final
published result; separate keyboard-accessible iteration disclosures during work
and after completion. Image/rapid-image histories also get independent controls.

The active task/AI response is never enclosed in a collapsed history panel.
Opening a previous iteration does not rerender the card, clear input, trigger an
API call, toggle siblings or write progress. Native summary chevrons and Show/Hide
labels indicate state. Disclosure state is in-memory only, scoped by pupil,
lesson, field and iteration. Night Lab remains usable with its own palette.

Hobbies keep their own two-part display and optional bonus path; they do not
acquire a second prompt or About Me's vocabulary gate. L3–L5 helper content stays
lesson-appropriate rather than copying Present Perfect into every lesson.

## Impact and verification

- `app.js`, new `workspace-ui.js`, CSS and workspace script includes: presentation.
- `validate.js`: environment adapter only (IIFE and CommonJS/browser export);
  existing function bodies unchanged. Exact `/prompt-validation.js` route shares
  this implementation with browser indicators. `/validate.js` remains denied.
- Server state transitions, authentication, lesson configs, provider integration,
  teacher.js, progress schema/revisions, student presets and export unchanged.
- Current API contracts are unchanged: four fields serialize to a prompt string.
  Server gates remain authoritative; chips do not disable submission.

Windows Node 24.14.1 / Chrome / locked Playwright 1.64.1. Temporary independent
DATA_DIR per theme; no owner profile reset, no testing on the server at 3000.

| Verification | Result |
|---|---|
| `npm run check`, `git diff --check` | PASS |
| `npm test` | PASS 14/14, including browser/server validator parity on blank/partial prompts, contractions, tense false positives, field banks and prompt growth |
| `npm run smoke:isolated` | PASS 10 public routes/MIME + 5 denied paths |
| `npm run build` | PASS; SHA-256 remains `19982ef50c7f3a246c3cbd0a8c67d933b4e2ead5f01b996292101000a33125d5` |
| Browser suites | Both themes: complete existing correction/publishing routes, L2 generation/review/manual edit, independent history disclosures during input and after publication, retained focus/values/progress, helper keyboard activation and Vietnamese gloss, live-chip colors, default/storage/theme regression |
| `UI_PORT=43361 npm run test:ui` | PASS 10/10, no retries (1.9m). Follow-up L2-only run also checks the active four-field builder at 320px |
| Responsive/fallback | Both themes at 1280×900, 1366×768, 768×1024, 390×844, 320×844, Google Fonts blocked and teacher CSS zoom emulation; no page overflow |
| CI | See final PR head; previous checkpoint's success is not acceptance of this change |
| Physical devices/projector, paid AI, VPS/HTTPS | NOT_RUN; original backlog stays open |
| Independent acceptance | PENDING for the final SHA; this is an implementation report |

One new validator test initially omitted the configured V3 list in a standalone
assertion; the parity checks themselves passed. Fixed that test argument, leaving
the validator algorithm unchanged. Visual inspection found inherited brown label
and yellow used-word styles winning specificity; explicit scoped component rules
correct them, and browser tests assert the final computed colors.

## Evidence and recovery

New synthetic screenshots: [guided workspace](../ui-guided/). Original TASK-06
before/after images remain untouched. Browser output and CI artifacts include the
full viewport matrix. Screenshots marked as card captures can include the sticky
header at the top when Playwright scrolls into view.

For immediate palette return use `window.PlatformTheme.setTheme('night-lab')`.
This preserves the new interaction layout. To compare the previous interaction
layout, use checkpoint `1fb8b2f` in an isolated checkout. A code rollback would use
a separate revert commit/PR for the exact follow-up commits, without restoring old
progress over current learner work. No reset, force push or main merge performed.
