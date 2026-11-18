# TASK-06 implementation — 2026-11-12

Status: implementation submitted for review, **not accepted, merged or deployed**.
Branch: `feat/platform-ui-themes`. Planning base: `cae6c35` (included intentionally).
Fresh GitHub main readback: `4a24548fdf6abd9e71226be21a2def4b44093433`.
The exact implementation SHA is the draft PR head and is reported in the handoff;
this document is part of that commit and cannot embed its own hash.

## Changes and impact

- One scoped Classroom Light skin in platform.css; existing Night Lab stays the
  fallback. Warm surfaces, Poppins, yellow primary actions, distinct rule/draft/
  journal/status surfaces and visible focus/boundaries. Final values and measured
  contrast pairs: [UI_THEMES](../UI_THEMES.md).
- Synchronous ui-theme.js, one distinct preference key and public setTheme API;
  installed before stylesheets on all three pages. Exact server allowlist adds
  only `ui-theme.js`. Storage errors cannot break theme startup or application.
- Teacher table gets local horizontal scrolling at high zoom in both themes
  and 8px bottom space for its shadow. This is a deliberate small shared layout
  correction, not a change to Night Lab's palette or type.
- app.js and teacher.js untouched. Config, validator, lesson specs, methodology,
  server authorization/state transitions, schemaVersion/courseVersion, template,
  builder and student-site presets untouched. Server change is one static name.
- Existing private-drafts ignore rule was already present. `git ls-files
  '*Создание*'` is empty. Reference HTML/standard and embedded images were read
  locally, not copied into the repository or exposed by the server.

## Baseline and verification

Windows; Node **24.14.1**; installed locked dependencies; Chrome via Playwright
1.64.1. Every server uses temporary synthetic DATA_DIR and its own port. Port
3000 and owner profiles/processes were not used or stopped.

| Check | Result / scope |
|---|---|
| Baseline `npm run check` | PASS |
| Baseline `npm test` | PASS 13/13 outside sandbox networking restriction |
| Baseline `npm run test:ui` | PASS 1/1 using UI_PORT=43319 |
| Final `npm run check` | PASS |
| Final `npm test` | PASS 13/13; includes complete L2–L5 API flow, permissions, corrections, revocation, export, restart, provider failures |
| `npm run smoke:isolated` | PASS: 8 public routes, JS MIME, three default attributes; 4 private/arbitrary paths denied |
| `npm run build` | PASS; fixed demo export SHA-256 before/after identical: `19982ef50c7f3a246c3cbd0a8c67d933b4e2ead5f01b996292101000a33125d5` |
| Browser regression | Corrections workflow in both themes, isolated per-theme server/fixtures; same original assertions retained |
| Final `UI_PORT=43347 npm run test:ui` | PASS **10/10** (2.0m); five scenarios per theme, no retries |
| Browser publishing route | Both themes: synthetic pilot-1 Nia fixture resumes after L2; L3 three generated/rated versions for each image, best/worst reasons, accept; teacher unlock L4, each hobby image generation/regeneration/reason/earlier-version publish; two theme prompts/compare/choice/justification; teacher build and browser preview; unlock L5/audit/six reflections; teacher publish/download; correction via grant/form and old preview 403/publication 404 verified over HTTP |
| New browser scenarios | Both themes: default/invalid preference, saved dark, reload/navigation/logout, OS dark preference ignored, blocked storage reads/writes; keyboard focus; L2 full About Me cycle, validation, simulated 503, loading, review/edit/completion/journal; correction draft focus and value retention, unchanged progress/revision and no write requests during theme changes |
| L4 independence | Two-option comparison presentation fixture; exact computed swatch fills, inline styles and sample font families identical after changing shell; existing correction test selects/saves alternate option |
| Responsive / font fallback | Both themes: login, L2–L5, L4 comparison, teacher at 1280×900, 1366×768, 768×1024, 390×844, 320×844; no page overflow. Google Fonts blocked. Teacher CSS zoom 200% (emulation, not physical device/native browser zoom) |
| JS / static assets | No pageerror or same-origin asset 404 in responsive browser routes |
| Independent acceptance / owner visual approval | PENDING, no independent acceptance record fabricated |
| CI / main synchronization | Check draft PR. No merge/deploy/main synchronization performed |
| Real paid AI / devices / projector / VPS HTTPS | NOT_RUN; existing backlog remains open |

Initial sandbox runs produced loopback EACCES, not application failures; tests
were rerun with loopback access. Default Playwright port was occupied during one
baseline attempt; a different port was used without stopping that process.
During development, new tests initially selected nonexistent completed-stage L4
swatches and all AI drafts rather than the current draft; the fixture/locator was
corrected, without weakening existing assertions. The 200% table overflow was
reproduced and fixed. All results refer to corrected final scenarios.

## Visual evidence

Only synthetic demo profiles. Reproduce with `node tools/ui-theme-evidence.js
before` and `node tools/ui-theme-evidence.js after`. `before` serves the original
CSS from planning commit `cae6c35` through a browser route; it does not check out or
overwrite repository files. Both runs unlock fixture L5 through the teacher API.
Chrome viewport 1280×900, actual font readiness awaited. Original-vs-new Night Lab
screens preserve the palette, geometry and typography. Six pairs (login, teacher
login, L2–L5) are pixel-identical in the final capture. Teacher's intentional 8px
scroll-container space is documented above; its image height changes from 2027 to
2035 pixels and is assessed visually.

| Screen | Original Night Lab | Retained Night Lab | Classroom Light |
|---|---|---|---|
| Login | [before](../ui-themes/before/night-lab-login.png) | [dark](../ui-themes/after/night-lab-login.png) | [light](../ui-themes/after/classroom-light-login.png) |
| Teacher login | [before](../ui-themes/before/night-lab-login-teacher.png) | [dark](../ui-themes/after/night-lab-login-teacher.png) | [light](../ui-themes/after/classroom-light-login-teacher.png) |
| L2 | [before](../ui-themes/before/night-lab-L2.png) | [dark](../ui-themes/after/night-lab-L2.png) | [light](../ui-themes/after/classroom-light-L2.png) |
| L3 | [before](../ui-themes/before/night-lab-L3.png) | [dark](../ui-themes/after/night-lab-L3.png) | [light](../ui-themes/after/classroom-light-L3.png) |
| L4 | [before](../ui-themes/before/night-lab-L4.png) | [dark](../ui-themes/after/night-lab-L4.png) | [light](../ui-themes/after/classroom-light-L4.png) |
| L5 | [before](../ui-themes/before/night-lab-L5.png) | [dark](../ui-themes/after/night-lab-L5.png) | [light](../ui-themes/after/classroom-light-L5.png) |
| Teacher table | [before](../ui-themes/before/night-lab-teacher.png) | [dark](../ui-themes/after/night-lab-teacher.png) | [light](../ui-themes/after/classroom-light-teacher.png) |

Viewport/fallback, correction forms and intermediate state screenshots are emitted
by `npm run test:ui` into ignored `test-results/` (also CI artifacts). Key extra
synthetic screenshots are retained in [states](../ui-themes/states/).
Agent visual inspection covered main light/dark screenshots and selected narrow
and intermediate views; it is not owner acceptance or a complete accessibility
audit. Original Night Lab's dim decorative text was retained; the measured light
token ratios do not claim to certify every legacy dark label.

## Remaining acceptance work and recovery

Browser tests cover L2 About Me and L3–L5 through publication using mock generation;
L2's other saved fields in the resumed Nia fixture originate from synthetic Lumi.
Revocation is triggered through browser controls and verified with HTTP requests.
Long-content variants, full keyboard traversal and Vietnamese/Cyrillic glyph
inspection across all screens also need acceptance. These are explicit review
gaps; do not mark TASK-06 complete based only on the green checks.

Independent reviewer must review the exact final PR SHA; owner must see both
themes and authorize release. Keep PR draft until that stage. No acceptance
history file is authored by the implementer. After authorized merge, follow
TASK-06 section 11 for ff-only main update and fresh remote readback.

Immediate visual return: `window.PlatformTheme.setTheme('night-lab')`; back to light:
`window.PlatformTheme.setTheme('classroom-light')`. No backup restore or progress
reset is needed. If a release later needs reverting, identify its actual merge
SHA, then use a separate revert branch/PR; no speculative revert SHA is supplied.
