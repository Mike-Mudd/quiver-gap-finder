---
name: Quiver Gap Finder
description: A photo-led editorial system where a full-bleed powder photograph is the page ground, not a decorated backdrop.
colors:
  ink: "#101A22"
  ink-soft: "#2E4152"
  ink-faint: "#5B7086"
  paper: "#F4F7FA"
  paper-raised: "#FFFFFF"
  line: "rgba(16, 26, 34, 0.16)"
  jacket-red: "#C1372B"
  status-good: "#0ca30c"
  status-warning: "#b8860b"
  status-critical: "#C1372B"
  chart-accent: "#2E4152"
  chart-gridline: "rgba(16, 26, 34, 0.1)"
typography:
  display:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(2.9rem, 6.4vw, 5.6rem)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "0.004em"
  display-mobile:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(2.5rem, 11.5vw, 3.4rem)"
    fontWeight: 300
    lineHeight: 1.02
  headline-lg:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(2rem, 4.2vw, 3.4rem)"
    fontWeight: 300
    lineHeight: 1.06
  headline-md:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)"
    fontWeight: 300
    lineHeight: 1.08
  headline-stat:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.7rem, 3.4vw, 2.6rem)"
    fontWeight: 300
    lineHeight: 1
  headline-sm:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.5rem, 3.2vw, 2.6rem)"
    fontWeight: 300
    lineHeight: 1.34
  headline-lead:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.4rem, 2.7vw, 2.15rem)"
    fontWeight: 300
    lineHeight: 1.36
  headline-zone:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "clamp(1.15rem, 2vw, 1.5rem)"
    fontWeight: 400
    lineHeight: 1.1
  title:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.2
  title-sm:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.3
  title-xs:
    fontFamily: "'Cormorant Garamond', Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.5
  body-input:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  body-input-sm:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.625rem"
    fontWeight: 500
    letterSpacing: "0.2em"
    lineHeight: 1.4
  label-sm:
    fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.5625rem"
    fontWeight: 500
    letterSpacing: "0.2em"
    lineHeight: 1.4
rounded:
  sm: "4px"
  row: "8px"
  row-lg: "9px"
  md: "10px"
  panel: "12px"
  lg: "14px"
  pill: "100px"
components:
  button-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "0.4rem 0.8rem"
    typography:
      fontFamily: "{typography.label.fontFamily}"
      fontSize: "0.625rem"
  button-toggle-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.3rem 0.3rem 0.75rem"
  input-search:
    backgroundColor: "rgba(255, 255, 255, 0.9)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1rem"
  card-panel:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.sm}"
    padding: "0.9rem 1rem"
---

# Design System: Quiver Gap Finder

## Overview

**Creative North Star: "The Editorial Ground"**

The full-bleed powder photograph isn't a hero image sitting on top of the page — it *is* the page ground. Charcoal serif type sits directly on the snow with no scrim, no gradient overlay, no darkening filter: the composition is chosen (crop, subject placement, copy column position) so the photo's own contrast carries the text, measured against the actual pixels rather than assumed. That single technical move — treating the photograph as substrate rather than decoration — is what separates this from a conventional "hero image + headline" web pattern and gives the whole system its editorial, print-magazine register rather than a software-product one.

Everything below the fold continues that voice: slender serif display type (Cormorant Garamond) that mixes upright and italic within a single line for emphasis, paired with a small, restrained monospace (IBM Plex Mono) for every functional and labeling role — search input, buttons, captions, data. The pairing does real work: serif is reserved for anything meant to be *read* (headlines, leads, condition-card names), mono is reserved for anything meant to be *scanned or acted on* (labels, buttons, specs, status). Motion is used deliberately and sparingly — a staged arrival on first load, then scroll-triggered reveals as the reader descends the page — so the page feels considered rather than static, without becoming busy.

This is explicitly a photo-led, editorial-first system, built as a deliberate alternative to root's data-dense "Instrument Panel" world (see git history / `EXPLORATIONS.md`) — the same coverage-map product, sourced-data discipline, and accessible-twin requirements carried over unchanged (see `PRODUCT.md`), wrapped in a voice built for a wider public audience rather than the informal tester circle it started with.

**Key Characteristics:**
- The photograph is page ground, not hero decoration — text sits directly on it with no scrim, contrast-checked against real pixels
- Two-typeface system with a strict division of labor: serif (Cormorant Garamond) for reading, mono (IBM Plex Mono) for scanning/acting
- Near-flat elevation — depth comes from ink/paper contrast and hairline borders, not shadows; the exception is a small set of floating elements (search dropdowns, tooltip) that use frosted glass (backdrop-blur) plus a soft shadow, reserved for things that hover over content
- One accent color (Jacket Red, drawn from the photograph itself) used sparingly for the single most important word or number on a given screen
- The same reserved status vocabulary (good/warning/critical) as the incumbent system, re-expressed in this palette rather than reinvented
- Pill shapes everywhere something is actionable or a chip; small, sharp corners (4px) everywhere something is a static card

## Colors

Near-monochrome ink-on-paper, built from one neutral ramp (ink → ink-soft → ink-faint → paper) plus exactly one accent, pulled directly from the hero photograph rather than chosen abstractly.

### Primary
- **Ink** (`#101A22`): the system's primary color for text, primary buttons/chips (dark fill), and the footer/method-section background. Measures 13.6:1 against the hero photo's snow — chosen because it held that contrast, not adjusted to match a brand color.
- **Ink, Soft** (`#2E4152`): secondary text — captions, nav links, sub-headers, the coverage map's own accent hue (dots, regions). Measures 9.4:1 on the photo.
- **Ink, Faint** (`#5B7086`): tertiary/least-emphasis text — placeholder text, spec values, chart axis labels.

### Secondary
- **Jacket Red** (`#C1372B`): drawn directly from the skier's jacket in the hero photograph, not picked abstractly. Used in exactly one role at a time on any given screen — the search caret, the one word that matters in the readout ("biggest gap: ..."), the summary's highlighted ski name, the coverage map's "comparison" hue. Its scarcity is the point, same discipline as the incumbent system's Beacon Orange.

### Neutral
- **Paper** (`#F4F7FA`): page background below the hero, and the color type sits on top of the photograph reads as reversed against.
- **Paper, Raised** (`#FFFFFF`): the one step "lifted" surface — dropdown panels, info panels, the candidate-search input — used sparingly since most of the system stays flat against Paper.
- **Hairline** (`rgba(16, 26, 34, 0.16)`): the border/divider color used everywhere something needs a quiet edge — section borders, card borders, the zone-grid's hairline grid lines.

### Status (reserved, functional — not decorative, carried over from the incumbent system)
- **Status Good** (`#0ca30c`): adequate coverage — unchanged from root, since these trace to the dataviz reference palette, not either direction's own UI palette (see Named Rules below).
- **Status Warning** (`#b8860b`): redundant coverage — re-picked from root's `#fab219` to a darker gold, since the original amber failed contrast against Paper's lighter background at normal text sizes; the role and meaning are identical.
- **Status Critical** (`#C1372B`): a real coverage gap — deliberately the *same* hex as Jacket Red. Unlike root (which keeps its accent and its critical-status red as two separate, coincidentally-similar tokens), this system merges them into one token used for both roles, since both already mean "the one thing that needs attention" — a decision that's still cheap to unwind later.

### Named Rules
**The Photograph-as-Ground Rule.** The hero photograph is never darkened, scrimmed, or gradient-overlaid to force contrast — text placement and color are chosen so the photo's own pixels already carry the required contrast, verified per-composition (see `IMAGES.md`). A new hero image or crop is evaluated the same way, not patched with an overlay.

**The Reference Palette Rule** (carried over from root). Status colors trace to a fixed external dataviz reference palette, not to this system's own ink/paper scale. Don't re-harmonize them to match; changing them means redoing the dataviz methodology, not a color-matching pass.

## Typography

**Display/Headline Font:** `"Cormorant Garamond", Georgia, serif` — a slender, classical serif loaded at weights 300/400/500 (roman) and 300/400 (italic).

**Body/Label Font:** `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace` — used for everything that isn't a headline or lead paragraph, including body copy, which is a deliberate departure from a typical serif/sans-serif editorial pairing.

**Character:** A strict two-voice system, not a scale. Serif is reserved for anything meant to be read at a normal reading pace — page headline, section leads, condition-card names, the quiver-summary sentence, tooltip titles. Mono is reserved for anything meant to be scanned, labeled, or acted on — nav, buttons, captions, specs, form inputs, status text. The two never trade roles; a reader can tell "this is prose" vs. "this is data/UI" by typeface alone, before reading a word.

### Hierarchy

Serif sizes are **fluid, not fixed** — every serif heading and lead is its own `clamp(min, preferred-vw, max)` pair, independently tuned to that element's role and length rather than pulled from one shared scale. This is a real, deliberate departure from a fixed type ramp: a 9-word `<h1>` and a 4-word section headline earn different min/max anchors, not the same step scaled down. Treat the ranges below as the honest *bounds* real headings fall inside, not a five-step scale to snap new sizes onto.

- **Display** (300 weight; `clamp(2.9rem, 6.4vw, 5.6rem)` desktop, `clamp(2.5rem, 11.5vw, 3.4rem)` mobile; 1.02 line-height): the page's single `<h1>` only. Mixes upright and italic within one line (e.g. "can't *ski*") — the one recurring emphasis device in the whole system, used once per major heading.
- **Headline** (300 weight; fluid clamps ranging roughly `1.4rem–3.4rem` at the low/high end depending on section — e.g. `clamp(1.8rem, 3.4vw, 2.6rem)` for "Where you're covered," `clamp(2rem, 4.2vw, 3.4rem)` for "Nine kinds of ski day," `clamp(1.5rem, 3.2vw, 2.6rem)` for the closing method lead; 1.06–1.36 line-height, looser as the size drops): section-level headers and leads. Each section picks its own clamp against its own column width and word count — this is the system's largest size *class*, not a single value.
- **Title** (400 weight; 1rem–1.3rem, fixed not fluid — condition-card names at 1.3rem, the candidate-picker heading and tooltip title at 1.05rem, the details section's "Coverage gaps"/"Redundancy" sub-heads at 1rem): component-level headers, still serif — this system treats "title" as a reading moment, not a label. Small enough that a fluid clamp isn't needed; these don't reflow enough across viewports to warrant one.
- **Body** (400 weight, mono not serif; ranges `0.6875rem–0.9rem`, with `0.875rem` as the one outsized case — the hero search input, sized up for actual typing comfort): specs, captions, table cells, result text, form inputs. This is a compact, caption-dense system like the incumbent, just rendered in mono instead of the system sans stack — most "body" text on screen sits nearer 0.7rem than a full 1rem.
- **Label** (500 weight; `0.5625rem–0.7rem`, most commonly `0.625rem`; 0.02–0.24em letter-spacing, wider on shorter labels; uppercase mono): the recurring small-caps treatment for nav links, the brand mark, section eyebrows, chart axis labels, and every button/chip/toggle's text. The letter-spacing widens as the text gets shorter (nav links at 0.18em vs. chart labels at 0.02em) to keep short all-caps words from feeling cramped.

### Named Rules
**The Tuned-Clamp Rule.** Headings and leads don't share a fixed size scale — each gets its own `clamp()` tuned to its column width, word count, and role. A new heading is sized by eye against its own content and viewport range, not by picking the "closest" existing value from another section.

### Named Rules
**The Two-Voice Rule.** Serif reads; mono scans and acts. A new component's copy defaults to mono unless it is genuinely prose meant to be read start-to-finish, in which case it's serif — never a third typeface, never sans-serif.

**The No-Bare-Number Rule** (carried over from root). The derived temperament score is never shown as a bare figure — always a short phrase plus a position-on-spectrum gauge, with the raw number kept as small secondary detail.

## Layout

Full-width sections stacked vertically, each with its own background/contrast treatment (photograph, Paper, Ink) rather than one continuous container — the page reads as a sequence of distinct "spreads," a print-editorial layout habit rather than a single scrolling app canvas. Content within each section is capped at a max-width (560px for the hero's copy column, 1080px for everything below) and centered, with generous vertical padding (`clamp()`-based, roughly 3–7rem depending on section) that scales with viewport height, not just width.

The hero is viewport-height (`100svh`) with the copy column pinned left and the photograph's subject anchored right, a composition choice that holds at every width rather than requiring per-breakpoint tuning until the 680px mobile breakpoint, where the layout switches to a stacked photo-above-type composition with its own independently-tuned crop (see Do's and Don'ts). The coverage map, condition cards, and details section all live inside one `<section>` directly below the hero, live-updating with the quiver rather than gated behind a button — reveal-as-you-go rather than a multi-step flow.

Motion is structural, not decorative: page elements arrive with a staged fade/lift on first load (`animation: lift`), and content below the fold animates in via `IntersectionObserver` as the reader scrolls to it (`.reveal`/`.is-in`), respecting `prefers-reduced-motion` throughout.

## Elevation & Depth

Flat by default — most of the system conveys depth through ink/paper contrast and hairline borders, not shadow, matching the incumbent system's restraint even though the visual language is otherwise very different. The exception is a small set of elements that genuinely float *over* content rather than sitting flat within the page flow: the search-results dropdown, the coverage map's hover tooltip, and the candidate-picker's search results. These use frosted glass (`backdrop-filter: blur()` plus a translucent white fill) combined with a soft, wide-spread shadow — reserved specifically for the floating-over-content case, never applied to a card that sits flat in the page.

### Shadow Vocabulary
- **Glass Float** (`0 18px 40px -18px rgba(16, 26, 34, 0.38)` for the hero's search results; `0 14px 32px -16px rgba(16, 26, 34, 0.3)` for the candidate picker's — same role, tuned per-context): the floating-panel shadow, always paired with backdrop blur.
- **Tooltip Lift** (`0 18px 40px -16px rgba(16, 26, 34, 0.5)`): the coverage-map tooltip's shadow — deeper than Glass Float since the tooltip sits on inverted (dark) ground and needs more separation from the page beneath it.

### Named Rules
**The Flat-With-Glass Rule.** Nothing that sits in the normal page flow gets a shadow — depth there comes from ink/paper contrast alone. Shadow is reserved for elements that float over content (dropdowns, tooltips) and is always paired with backdrop blur on those, never used alone.

## Shapes

Three shapes carry the whole system: **pill** (100px) marks anything actionable or chip-like (buttons, toggles, search fields, quiver/candidate chips, length pickers), a small **4px** radius marks anything that's a static card or panel (condition cards, info panels, result items), and **9–14px** ("soft container") marks anything that floats over content — the search-results dropdown (14px), its rows (9px), the candidate-picker's results (12px), and the tooltip (10px) — a tighter, third step between the other two rather than a loose range around one value. There is no radius outside those three roles; a new component picks the role it belongs to (actionable, static-card, or floating-panel), not an arbitrary value in between. Two radii exist outside this system entirely, at the browser-chrome level rather than the content level: a 2px corner on the focus-visible outline itself, and 99px on the custom scrollbar thumb — neither is a designed surface and neither should be reused as if it were a fourth content-level step. Borders are thin (1px) and low-contrast (`rgba(16,26,34,0.16)`) throughout — quieter than the incumbent system's more visible hairline, in keeping with this system's overall lower-contrast, photograph-forward restraint.

## Components

### Buttons / Toggles
- **Toggle/Secondary** (table-toggle-btn, info-btn): pill-shaped, transparent/no-fill at rest with a hairline border, mono uppercase label text. Hover state darkens the border and text to Ink without a fill change. Uses `aria-pressed` as the sole state hook.

### Chips
- **Quiver chip:** pill-shaped, solid Ink fill, Paper text — the one place in the system a component is filled dark by default rather than flat/outlined, since it represents something the user has actively committed to (added to their quiver). Its remove-button and embedded length-picker both use a translucent-white-on-ink treatment to stay legible against the dark fill.
- **Candidate chip:** same pill shape, but filled with the Jacket-Red-tinted background instead of solid ink — visually distinct from a committed quiver ski, signaling "comparison, not commitment."

### Cards / Containers
- **Corner Style:** 4px for condition cards, info panels, and result items — deliberately smaller than the incumbent system's, reinforcing this system's flatter, more architectural (less "app card") feel.
- **Background:** Paper-Raised for neutral floating panels; a tinted status-bg color (10–14% opacity of the status hue) for condition cards and result items, colored by state — same discipline as root, different opacity tuning for this lighter background.
- **Border:** condition cards use a 3px solid left-border in the status color (the one place a colored border survives from root's card language); everything else is either borderless or uses the quiet 1px hairline.

### Inputs / Fields
- **Style:** frosted glass at rest (translucent white + backdrop-blur) for the hero search field specifically, since it sits directly on the photograph and needs to separate from it without becoming an opaque block; solid Paper-Raised fill with a hairline border for every other input (candidate search, length pickers).
- **Focus:** a 3px soft box-shadow ring in ink at low opacity, plus a border-color shift to full Ink — a glow rather than root's hard 2px outline, consistent with this system's overall softer edge treatment.
- **Disabled:** 0.6 opacity + not-allowed cursor (same as root).

### Coverage Map (signature component, shared with root)
Identical mechanism to the incumbent system (see `coverage-map.js`) — an SVG scatter/region chart, hover/focus tooltip, accessible table twin — re-skinned into this palette: the "your quiver" hue becomes Ink-Soft instead of root's blue, and the "comparison" hue is Jacket Red instead of root's separate critical-red token (the two are now the same color in this system — see Colors above). Region-overlap darkening, the two-hue-only rule, and the table-view twin all carry over unchanged.

### Temperament Gauge (signature component, shared with root)
Same word-plus-position mechanism as root, restyled: the track uses the quiet Hairline color, the dot uses Ink-Soft (or Paper, inside the inverted tooltip), and the caption text runs in mono instead of the system sans stack — otherwise identical behavior, including never showing the raw score as a bare number.

## Do's and Don'ts

### Do:
- **Do** verify a hero photograph's contrast against its actual pixels before committing a text color — no scrim or overlay is a fallback for a composition that doesn't hold contrast on its own (see The Photograph-as-Ground Rule).
- **Do** keep serif for reading and mono for scanning/acting — never blend the two roles on the same element (see The Two-Voice Rule).
- **Do** reserve shadow for elements that float over content, always paired with backdrop blur (see The Flat-With-Glass Rule).
- **Do** design the mobile hero as its own independently-composed crop, not a scaled-down version of the desktop composition — see the 680px breakpoint's separate `background-position`/gradient handling for the hero photo.
- **Do** carry over every accessibility and coverage-model invariant from root's system unchanged (icon+text status, table-view twins, region-based coverage) — this is a re-skin of the product, not a re-design of it.

### Don't:
- **Don't** add a scrim, gradient overlay, or darkening filter to the hero photograph to force text contrast — recompose or recrop instead.
- **Don't** use a third typeface, or use the serif for functional/label text or the mono for reading-prose text.
- **Don't** apply a shadow to a component that sits flat in the page flow (condition cards, chips, section panels) — only floating-over-content elements get one.
- **Don't** re-harmonize the status colors to this system's ink/paper palette — they're pinned to the external dataviz reference (see The Reference Palette Rule).
- **Don't** widen the corner-radius scale beyond pill/4px/10-14px without a real new use case — the binary is deliberate.
