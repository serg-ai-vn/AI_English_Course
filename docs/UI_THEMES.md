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
