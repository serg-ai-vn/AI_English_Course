# Platform UI themes

Classroom Light is the default on login, student workspace and teacher console.
Night Lab remains the original fallback CSS and is selected explicitly with
`html[data-ui-theme="night-lab"]`. No lesson data migration is involved.

## Select or restore

Run in the browser console on any platform page:

```js
window.PlatformTheme.setTheme('night-lab');
window.PlatformTheme.setTheme('classroom-light');
```

The synchronous `ui-theme.js` bootstrap runs before stylesheets. It reads only
`aiEnglishCourse.uiTheme.v1` in localStorage. Missing/unknown values select light;
OS dark mode does not override the choice. `setTheme` returns the applied ID,
updates the root attribute and attempts to store that ID. Storage exceptions are
caught: startup uses light, while an in-page choice still works if writes fail.
The preference is per browser/origin, survives logout and page navigation, and is
independent of token, role, name, account and progress. It performs no fetch,
reload, render, focus or scroll operation. There is no visible switch in this release.

## Tokens and components

All light tokens and component overrides are scoped to the explicit light root.
The original Night Lab palette, Inter/Space Grotesk, gradients and stars remain
the base skin. The one shared layout fix confines an overflowing teacher table to
its own scroll area at high zoom; it adds 8px below the table to retain its shadow.

| Role / token | Classroom Light |
|---|---|
| Page / `--bg` | `#fefcf7` |
| Surface / `--card` | `#ffffff` |
| Decorative border / `--card-border` | `#e6d8b5` |
| Text / soft / dim | `#141414` / `#2b2b2b` / `#555555` |
| Input and neutral control boundary / `--line` | `#82765e` |
| Primary / `--grad` | `#ffe47a` → `#ffb703`, dark text |
| Example detail | `#fb8500` |
| Information / focus / `--teal`, `--violet`, `--focus` | `#07677d` |
| Information surface | `#eef9fc` |
| Warning / `--amber`, `--iris` | `#795000` on `#fff9e6` |
| Success / `--ok`, `--ok-bg` | `#176438` on `#eafaf0` |
| Error / `--err`, `--err-bg` | `#a32020` on `#fff2f2` |
| Neutral surface | `#f5f1e8` |
| Disabled | `#686158` on `#e9e5dc`, `#a59c8c` border, no shadow |
| Card / action shadow | `0 5px 0 #ede0c0` / `0 4px 0 #141414` |
| Card radius | 20px; login 28px |

Dark status derivatives deliberately replace the brighter presentation accents
for small text. WCAG relative-luminance ratios measured from the exact opaque
pairs: primary text on yellow **10.55:1**, dim text on cream **7.27:1**,
success **6.66:1**, error **6.91:1**, information **6.04:1**, warning **6.74:1**.
Input boundary on white **4.47:1** (target for boundaries 3:1). These measurements
are token pairs, not a claim of a complete automated accessibility audit.
Error/warning messages retain explanatory text; status labels and disabled
attributes remain visible and functional.

Poppins 400/500/600/700 uses `display=swap`, with
`system-ui, -apple-system, 'Segoe UI', sans-serif`. Body is 16px / 1.5;
inputs 16px, labels 14.4px, field headings 20px, main login heading
`clamp(26px, 3.4vw, 36px)`. Teacher table remains compact (headers 12.8px).
External Google Fonts are optional for usability; blocking them is covered by
browser tests. This does not establish offline server operation. Night Lab's
existing fonts remain in the same request. Cyrillic uses the fallback stack where
a glyph is unavailable in Poppins.

Primary actions have dark text, a dark outline and a hard lower shadow. Hover
lightens the fill; active moves down 2px. Secondary controls use quiet white
surfaces and visible boundaries. Focus is a 3px teal outline with 3px offset.
Disabled controls use a flat neutral fill and retain `disabled` behavior. Rules
are warm, AI responses informational blue, completed work green, journals white,
and errors pale red. Stars are absent in light. No new mandatory animation is
introduced; reduced-motion disables light component transitions.

## Protected boundary and future themes

`data-ui-theme` is unrelated to `SITE_DATA.theme`, `progress.theme` and the student
template's `data-theme`. L4 swatch fills and sample font families come from inline
preset values and are never overridden. All six presets, template/export files,
configs, validators, prompts, gates and progress schema remain unchanged.

For another shell theme, add a deliberately scoped token/component block, update
the bootstrap's allowed IDs, extend theme project fixtures and document defaults.
Keep `[hidden] { display: none !important; }`. Never use descendant-wide color,
background or font overrides. Any new asset needs an exact server allowlist entry.

Evidence and verification boundaries: [implementation report](history/2026-11-12-platform-ui-theme-implementation.md).

## Guided workspace follow-up (TASK-07, owner decision D13)

The owner authorized a second UI iteration in the same branch/PR. The earlier
theme-only checkpoint `1fb8b2f` is retained. [Follow-up report](history/2026-11-12-guided-workspace.md)
and [task](../tasks/TASK-07-guided-workspace.md) describe the current behavior.

Each historical iteration has its own native `details`/`summary`, initially
collapsed; opening one never closes siblings. Its native chevron shows the
state (Show/Hide labels removed in TASK-09). Current inputs/current AI result remain outside the
disclosures, and published text stays visible. There is no whole-history toggle
for fields with iterations. Open states are held in memory, per pupil/lesson/
field/iteration, across UI refreshes; they never enter progress or localStorage.
Night Lab supports the same controls with its original palette and fonts.

Three independent helper drawers show goals/steps, words and lesson-appropriate
language support. Complete requirements remain in a nested disclosure.
Present Perfect guidance is specific to L2; image lessons have review/comparison
sentence frames. L2–L5 vocabulary cards include English/Vietnamese support.

L2's four labeled prompt fields serialize to the existing labeled string API.
Prefilled accepted prompts retain their original string until the learner edits
a field. Live chips invoke the exact server `checkPrompt` from `validate.js`,
served only at `/prompt-validation.js`; no duplicate grammar heuristic. They
do not block submission or promise a complete grammar assessment. Hobbies do
not inherit About Me's two-word gate or extra AI generation. Existing counts
and server stage transitions remain authoritative.

Light teaching text (prompts, AI drafts, final text) is now 18–20px / 1.55 / 500;
card/step headings 22px; word chips 16px; helper content 18px. This supersedes
the earlier 16px input/20px heading values for the student working area only.
Published text is black on pale green; AI drafts warm yellow with orange edge;
review cards form two columns (one on narrow screens). The published badge uses
the existing darker success token for white-text contrast. These changes do not
recolor L4's preset swatches/sample fonts or student exports.

## Owner visual review (TASK-08)

Yellow is also used for instructional landmarks: field headings, iteration
summary bars and formula badges. A completed field shows a green check and one
small status beside its yellow heading. Repeated completion strips, publication
labels and fully completed steppers are removed; the result remains visible.
Direct fields show their saved value, and each historical iteration still has
its own native disclosure. Small green text on yellow uses `#12502c` (5.44:1 on
`#ffb703`). This replaces the earlier all-green completion hierarchy.

Goal cards use numbered badges, yellow/orange accents and a blue supporting
surface. Every lesson has three goal cards. Requirements retain their meaning
and configured limits in numbered, titled cards (two columns, one on mobile).
Helper summaries remain one line at 320px and wider; the label is 14px, distinct
from the larger teaching content inside. Live checks are centered, noninteractive
To do / Ready hints; their note refers to the teacher only.

Each L2 hobby is one visual card containing its existing name and description
fields. Separate save/correction endpoints and progress keys remain unchanged.
In-memory field drafts preserve an unsaved prompt while saving its name, and an
unsaved name while the other field refreshes. The L3 course question is restored
in its config from the lesson plan; a frontend fallback supports older running
pilot-1 servers whose cached L3 config omits that display property.

Current evidence and checks: [visual review report](history/2026-11-12-visual-review.md).

## Learning support and journals (TASK-09)

Words now use independently expandable branded cards: yellow header, numbered
badge, English meaning and blue Vietnamese area. The global duplicate word
strip is removed; field-level banks remain where prompts are written. The
same mechanic covers L2–L5, including L4 design-bank terms.

L2's compact Present Perfect support explains three uses, signal words and a
Past Simple contrast. L3/L4/L5 provide useful writing frames instead of generic
tips. Requirements are split into action lines without changing gate values.

Iteration summaries use green titles/status with the heading font, native
chevrons and no Show/Hide labels. Image feedback has full labels in green/red
cards beside the image, stacked below on mobile. Selected theme/justification
stay visible; Option 1/2 each have a separate prompt/preview disclosure. Inline
preset colors and font families remain authoritative in either shell theme.
The workspace loads these existing font families for the samples.

Current verification: [learning support report](history/2026-11-13-learning-support.md).
