# Source: Site Theme Presets (v2 — enriched with motion)

*Five bounded style presets, each a coordinated package: palette + font pairing + avatar particle color. Three additional motion behaviors apply uniformly to every site (not a per-student choice). Informed by two reference files: DESIGN.md (token-naming approach, warm/light palette sensibility) and Build_a_3D_Creator (motion vocabulary, renamed in plain language) — neither copied wholesale, both used as inspiration.*

## Uniform motion — same for every site, not a choice

These three apply automatically to everyone's finished site. They make the *tool* feel modern; they don't personalize any individual site.

1. **Fade & Rise** — each block gently fades in and lifts slightly into place as the visitor scrolls to it. (Plain name for "FadeIn" pattern in the reference file.)
2. **Side Slide** — blocks alternate: the first slides in from the left, the next from the right, and so on down the page. (Plain name for the alternating left/right entrance pattern.)
3. **Letter Reveal** — the student's name/tagline in the hero area appears letter by letter as the visitor scrolls past it. (Plain name for the character-by-character text reveal.)

*Build note: these three are built once, tested once, and apply identically regardless of content — lower risk than the per-theme work below, build this first.*

## Particle Assemble — the one personalized motion element

The avatar image (generated in Lesson 3) dissolves into particles and reassembles as the visitor scrolls to it — or reveals from a different angle, depending on final build choice. Particle color matches the student's chosen preset's accent color, so this one effect looks meaningfully different per student without needing five separate animation systems.

*Build note: this is the one genuinely novel, higher-effort piece — a canvas-based particle technique, not lifted from either reference file. Build and test this in isolation before wiring it into the full template.*

## The five presets

Each includes: mood words (what a student would say to get this), palette, fonts, and the Particle Assemble accent color.

### 1. Sunny Day
- Mood words: happy, warm, playful, friendly
- `--background`: #FFF8E7 · `--text`: #2B2B2B
- `--accent-primary`: #FF9F1C · `--accent-secondary`: #2EC4B6
- `--font-heading`: 'Fredoka' · `--font-body`: 'Inter'
- Particle color: #FF9F1C

### 2. Ocean Calm
- Mood words: calm, peaceful, cool, gentle
- `--background`: #EAF4F4 · `--text`: #1D3557
- `--accent-primary`: #3A86FF · `--accent-secondary`: #8ECAE6
- `--font-heading`: 'Quicksand' · `--font-body`: 'Inter'
- Particle color: #3A86FF

### 3. Forest Explorer
- Mood words: natural, adventurous, earthy, grounded
- `--background`: #F2ECE4 · `--text`: #2E2A24
- `--accent-primary`: #4C7A5D · `--accent-secondary`: #C97C4E
- `--font-heading`: 'Merriweather' · `--font-body`: 'Lato'
- Particle color: #4C7A5D

### 4. Comic Pop
- Mood words: bold, fun, loud, exciting
- `--background`: #FFFFFF · `--text`: #000000
- `--accent-primary`: #E63946 · `--accent-secondary`: #FFD60A
- `--font-heading`: 'Bangers' · `--font-body`: 'Inter'
- Particle color: #E63946

### 5. Comet Trail *(replaces the earlier dark "Neon Nights" — same energetic personality, no near-black background)*
- Mood words: energetic, techy, futuristic, exciting
- `--background`: #EAE7F5 · `--text`: #2A2640
- `--accent-primary`: #6C5CE7 · `--accent-secondary`: #00D9C0
- `--font-heading`: 'Space Grotesk' · `--font-body`: 'Inter'
- Particle color: #6C5CE7

### 6. Deep Focus *(dark option — added on request)*
- Mood words: mysterious, dramatic, focused, intense
- `--background`: #000000 · `--text`: #FFFFFF
- `--accent-primary`: #8052FF · `--accent-secondary`: #FFB829
- `--font-heading`: 'Space Grotesk' · `--font-body`: 'Inter'
- Particle color: #8052FF

## Token naming principle (from DESIGN.md)

Every color has a named role, not just a hex value — this is what DESIGN.md does well and what the build should copy as a *practice*, not its specific colors: `--accent-primary` always means "the color a visitor notices first," `--background` always means "the calm base everything sits on." Keeping roles consistent across all five presets is what makes swapping between them safe and predictable in code.
