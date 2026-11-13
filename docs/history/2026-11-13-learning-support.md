# Learning support and journals — 2026-11-13

Same branch `feat/platform-ui-themes`, draft PR #3. Checkpoint `592a534` remains
in history. Final SHA and current CI belong in the PR. No merge or independent
acceptance is claimed.

## Owner's six comments

| Comment | Result |
|---|---|
| 1 | Branded yellow word-card headers, numbered badges, English meaning and blue Vietnamese area. Independent disclosures in L2–L4. No duplicate global strip; contextual field banks stay. L2 retains six About Me words, L3 has ten, L4 includes all eighteen target/design-bank terms. L5 uses the same rendering. |
| 2 | Present Perfect formula, three use cards/examples/signal words, duration timeline, Past Simple contrast. Signal words are clues; meaning decides the tense. |
| 3 | L3 Review phrases, L4 Compare & explain, L5 Reflection phrases contain actual sentence frames and examples, rather than duplicate goals. |
| 4 | No Show/Hide text or CSS labels. Green title/status in yellow summaries, platform heading font. Full What I like / What needs to change labels in green/red cards, right of images and below on mobile. Separate change/best/worst reasons. Active L3 review inputs use the same hierarchy. |
| 5 | Short action lines and separate steps; explicitly include two different vocabulary words in both About Me prompts. Numeric thresholds remain config-derived. |
| 6 | Selected theme, palette, font sample and justification visible. Option 1/2 each have their own prompt/preview disclosure and Selected/Saved state. No invented theme iteration schema. |

## Scope

Changed: student rendering/helpers/CSS, workspace font link (loads already
configured preset font families), tests/docs. New student content uses
textContent. Requirement markup contains only authored copy and numeric config.

Untouched: server/auth, teacher UI, provider, validators, lesson configs, stage
transitions, save/correction contracts, progress schema, student template,
preset values and export. Language frames do not insert text or add gates.
Disclosure state stays in memory and does not write progress. Current tasks and
results remain available. No reset, restore or migration.

## Verification

Windows Chrome, Node 24.14.1, locked dependencies. Separate synthetic temporary
DATA_DIR per theme; owner preview data excluded.

- PASS: syntax/JSON/contracts and whitespace check.
- PASS: Node 15/15, including glossary coverage against configured vocabulary.
- PASS: isolated HTTP smoke, ten public routes plus five denied private paths.
- PASS: build, unchanged demo export SHA-256:
  `19982ef50c7f3a246c3cbd0a8c67d933b4e2ead5f01b996292101000a33125d5`.
- PASS: complete browser suite, 14/14 in both themes (3.2m), including L2
  generation/review/edit, L3–L5 publishing/build/download and correction revocation.
- PASS: focused final-copy rerun, 2/2 (52.8s), after retaining the complete
  Operator checklist in the simplified L3 requirement card.
- Focused cases passed in both themes: independent word/option disclosures,
  complete translations, no duplicate strip, language frames, requirement lines,
  image review columns/mobile stacking, no Show/Hide generated text, unchanged
  L4 inline colors/fonts across theme switches, identical progress before/after
  viewing. Full workflows also exercise active review/save controls.
- Independent acceptance / owner's approval: PENDING.
- Paid AI, physical devices/projector, VPS/HTTPS: NOT_RUN. Existing backlog
  boundaries remain unchanged.

Evidence: [synthetic screenshots](../ui-support/). Card captures crop real
full-page screenshots at scroll top to keep sticky navigation off the headings;
product styles are not altered. Older evidence folders remain historical.

Visual inspection covered branded vocabulary, grammar, full image-feedback
labels and columns, requirement lines, theme choices and mobile stacking in
Classroom Light, plus retained Night Lab colors. This is not a complete
accessibility audit. Implementation commit: `69a38cf`.

## Preview and recovery

Preview: `http://127.0.0.1:3001/workspace.html`, existing separate runtime-data
copy. Ctrl+F5 refreshes static files from this working copy. No unknown Node
process is stopped/replaced. Night Lab:
`window.PlatformTheme.setTheme('night-lab')`.
HTTP readback returned 200 and matching SHA-256 bytes for app.js,
workspace-ui.js, platform.css and workspace.html.

Rollback uses explicit revert commits in a separate PR after checking
dependencies. Do not reset/force push history or restore old progress over new
student work. Main is unchanged.
