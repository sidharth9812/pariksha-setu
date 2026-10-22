---
name: Aspirant Neo
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e6'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2ff'
  surface-container: '#eeecfa'
  surface-container-high: '#e8e7f5'
  surface-container-highest: '#e2e1ef'
  on-surface: '#1a1b24'
  on-surface-variant: '#444656'
  inverse-surface: '#2f303a'
  inverse-on-surface: '#f1effd'
  outline: '#747687'
  outline-variant: '#c4c5d9'
  surface-tint: '#2049ee'
  primary: '#0f40e6'
  on-primary: '#ffffff'
  primary-container: '#395dff'
  on-primary-container: '#f4f2ff'
  inverse-primary: '#bac3ff'
  secondary: '#4b59a1'
  on-secondary: '#ffffff'
  secondary-container: '#a1affd'
  on-secondary-container: '#313f86'
  tertiary: '#9e3100'
  on-tertiary: '#ffffff'
  tertiary-container: '#c4440e'
  on-tertiary-container: '#fff1ed'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee1ff'
  primary-fixed-dim: '#bac3ff'
  on-primary-fixed: '#001159'
  on-primary-fixed-variant: '#0031c5'
  secondary-fixed: '#dee1ff'
  secondary-fixed-dim: '#b9c3ff'
  on-secondary-fixed: '#001159'
  on-secondary-fixed-variant: '#334188'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59c'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832700'
  background: '#fbf8ff'
  on-background: '#1a1b24'
  surface-variant: '#e2e1ef'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered specifically for competitive examination aspirants preparing for rigorous, career-defining state and national tests. The brand personality balances disciplined focus with dynamic momentum: serious enough to instill calm under pressure, yet modern and encouraging enough to sustain grueling study routines over months.

The aesthetic fuses **Modern Contemporary UI** with high-clarity **Tactile Micro-affordances**:
- **Clarity Over Clutter:** Zero visual noise during active test-taking. High-density data (scorecards, question lists) is structured into clear visual hierarchies that prevent mental fatigue.
- **Optimism & Discipline:** Crisp, light surfaces contrast with confident royal blue accents, replacing traditional grim examination software with an energizing coaching space.
- **Urgency without Panic:** Critical countdown timers and review statuses use assertive warm tones, engineered to draw immediate attention without inducing test anxiety.

## Colors

The palette directly addresses cognitive states experienced during examination prep and timed simulation:

- **Primary (`#395DFF`):** Vibrant Royal Blue represents mental stamina, analytical clarity, and focus. Used for primary interactive triggers, active navigation tabs, and confident progression indicators.
- **Accent / Urgent (`#B53900`):** Rust Orange is reserved for urgent temporal elements—live test countdowns, time-remaining warnings, ranking alerts, and CTA badges.
- **Exam Status System:**
  - **Answered / Correct (`#10B981`):** Mint Green signifies confirmed response and validated accuracy.
  - **Wrong / Negative (`#F43F5E`):** Crisp Rose Red flags incorrect attempts and critical errors without harshness.
  - **Marked for Review (`#6472bc`):** Slate Indigo creates an unmistakable distinct status for questions flagged for re-evaluation.
  - **Unattempted / Not Visited (`#767682`):** Muted Neutral marks skipped questions and unvisited test nodes.
- **Neutral & Canvas Surfaces:** Crisp white (`#FFFFFF`) surfaces float on tinted backgrounds (`#F8F9FF`). Typography uses dark structured tones for high-contrast readability against both white and tinted card backs.

## Typography

The typographic system utilizes **Plus Jakarta Sans** for structural UI chrome (headers, metrics, tab labels, timer readouts) and **Inter** for all prose and question/answer content.

### Reading Performance & Bilingual Support
- **Question Stems:** Inter delivers neutral, distraction-free geometry with expansive language support, rendering English queries and complex Hindi Devanagari test strings with consistent line metrics.
- **Vertical Spacing:** Line-height for question cards is set to a minimum of 1.6x (`body-lg` at 26px line height for 16px font) to accommodate Devanagari vowel marks (matras) without clipping.
- **Numeral Readouts:** Timer countdowns, question numbers, and scorecards use tabular numerals (`tnum`) to eliminate layout jitter during active countdowns.

## Layout & Spacing

This design system is tailored for high-density mobile viewports (360px to 428px standard device widths) with a fluid single-column model.

- **Base Rhythm:** Spacing is rooted in a strict 4px / 8px incremental scale.
- **Margins & Safe Zones:** Canvas borders enforce a fixed 16px (`margin: 1rem`) horizontal margin to prevent thumb interference, expanding to 20px on larger devices.
- **Touch-First Hit Targets:** All interactive assessment components (option selection rows, question palette nodes, navigation triggers) conform to a strict minimum touch boundary of 48px × 48px.
- **Vertical Chunking:** Spacing between the question header, stem, option groups, and the sticky bottom action strip adheres to `space-md` (16px) and `space-lg` (20px) to prevent cognitive overload.

## Elevation & Depth

Visual hierarchy uses a refined multi-layer surface model with subtle ambient tinting:

- **Level 0 (Canvas Base):** Flat `#F8F9FF`. Houses background page context and unselected list groupings.
- **Level 1 (Card & Section Containers):** Pure `#FFFFFF` surface with a crisp 1px border and an ambient tinted drop shadow. Used for question boxes and diagnostic result cards.
- **Level 2 (Interactive Floating Bars & Option Cards Active):** Elevated during interaction with dynamic shadow profiles linked to primary accent cues.
- **Level 3 (Modal Sheets & Question Palettes):** Bottom sheets slide up with backdrop scrim with an elevation shadow of `0 -8px 32px 0 rgba(11, 28, 48, 0.12)`.

## Shapes

The geometric identity relies on consistent, rounded shapes that feel approachable and modern:

- **Containers & Cards:** Styled with a standardized radius (`rounded-lg`), creating friendly cards that organize complex question layouts.
- **Interactive Buttons & Badges:** Primary and secondary actions utilize either medium radii or full pill curves (`rounded-full`) for status badges, tags, and palette jump indicators.
- **Option Selection Tiles:** Styled with comfortable border radii, producing touch targets that clearly differentiate from square outer layout cards.

## Components

### 1. High-Touch Option Cards (Radio & Multiple Choice)
- **Base State:** Surface `#FFFFFF`, 1px solid border, standard radius, comfortable padding. Left-aligned alphabetical pill index (A, B, C, D) in neutral tone.
- **Selected State:** Border switches to primary royal blue (`#395DFF`), surface tinted accordingly. Option index pill transitions to solid primary with white text.
- **Review / Post-Submission State:**
  - *Correct Selection:* Border 2px solid `#10B981`, checkmark indicator.
  - *Wrong Selection:* Border 2px solid `#F43F5E`, cross indicator.

### 2. Modern Bottom-Sheet Question Palette
- Accessible via a floating pull handle and header icon. Expands smoothly to 70% viewport height.
- Contains a status filter bar: Answered (Green), Marked for Review (Indigo), Not Visited (Gray).
- Renders a 5-column grid of numbered 44px circular or rounded-square pills. Each node displays its exact state through color fills and icon pips.

### 3. Exam Timer & Action Dock
- **Timer Banner:** Fixed pill at top-right with tabular digits. Under 5 minutes, surface shifts to accent tint with warning text and subtle pulse animation.
- **Bottom Navigation Dock:** Fixed-bottom strip with glassmorphic backing. Contains secondary review buttons, clear actions, and primary action controls.

### 4. Pill Badges & Progress Indicators
- Status pills use `label-sm` in all caps with letter spacing, height 24px, pill-radius (9999px), with low-opacity matching background tints.
- Test progress is visualized via a segmented top bar displaying attempted vs. total questions in real-time.

### 5. Result Summary vs. Answer Key Architecture
- **Result Summary View:** Hero score card with circular accuracy gauge, net positive/negative marks breakdown, exam percentile, and time spent per question. Focuses on performance analytics without inline solutions.
- **Answer Key / Solution View:** Distinct tabbed mode with question-by-question explanations, side-by-side display of user attempt versus correct answer, and toggleable bilingual solution notes.