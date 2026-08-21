---
name: Quiver Gap Finder
description: A data-honest ski-gap-analysis tool with no ornamentation beyond what the data needs.
colors:
  primary: "#2a78d6"
  primary-deep: "#184f95"
  accent: "#ef8354"
  surface-bg: "#f4f7fb"
  surface-panel: "#ffffff"
  border-hairline: "#dbe4ee"
  ink: "#1c2b3a"
  ink-muted: "#5b6b7c"
  status-good: "#0ca30c"
  status-warning: "#fab219"
  status-critical: "#d03b3b"
  chart-gridline: "#e1e0d9"
  chart-muted: "#898781"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    letterSpacing: "0.03em"
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
    typography:
      fontSize: "1rem"
      fontWeight: 600
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-toggle:
    backgroundColor: "{colors.surface-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.4rem 0.7rem"
    typography:
      fontSize: "0.8rem"
  button-toggle-active:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
  chip:
    backgroundColor: "{colors.surface-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.4rem 0.35rem 0.85rem"
  input-search:
    backgroundColor: "{colors.surface-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.65rem 0.85rem"
  card-panel:
    backgroundColor: "{colors.surface-panel}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Design System: Quiver Gap Finder

## Overview

**Creative North Star: "The Instrument Panel"**

Quiver Gap Finder reads like flight-deck telemetry, not a marketing page: every number on screen earns its place, and nothing is drawn purely for decoration. There is no hero image, no marketing copy, no custom display typeface — the system font stack does all the work, and visual weight is spent almost entirely on making dense spec data (waist width, weight, turn radius, a derived "temperament" score) scannable rather than on styling for its own sake. Color is treated as a signal, not a decoration: one blue hue carries every interactive and chart-accent role, one orange is reserved for the single most important line on the results panel, and a fixed three-color status scale (good/warning/critical) is never reused for anything but literally reporting a state.

This is a quiet, precise system by deliberate choice, not by default or neglect — the restraint itself is the current design's whole personality. It is also explicitly a **snapshot of the incumbent system**, captured as a baseline ahead of a planned visual overhaul; it documents what is true today, not a target to defend.

**Key Characteristics:**
- Zero imagery, zero display typography — plain system fonts carry the entire type system
- One sequential accent hue (blue) for every interactive element and every chart mark; color is never used to distinguish individual items
- A fixed, reserved status vocabulary (green/amber/red) that means the same thing everywhere it appears and nowhere else
- Flat surfaces with a single soft ambient shadow at rest — no elevation ladder
- Every chart ships an accessible table-view twin with identical data

## Colors

Overwhelmingly neutral (cool blue-greys) with exactly two accent hues, each with one narrow, consistent job — plus a separate, deliberately distinct warm-grey pair reserved for chart chrome.

### Primary
- **Instrument Blue** (`#2a78d6` light / `#3987e5` dark): the system's only interactive/brand hue — the primary CTA, focus rings, links, and the coverage chart's sequential accent (dots, regions, the temperament gauge's marker). One hue does all of this on purpose; the map never needs per-item color because there's only ever one "your quiver" hue and one contrasting "comparison" hue (see Status below).
- **Instrument Blue, Deep** (`#184f95` light / `#7fb2e0` dark): hover/pressed state for the primary CTA only.

### Secondary
- **Beacon Orange** (`#ef8354`, same value in both themes): used in exactly one place — the left border and bolded terms of the TL;DR quiver-summary sentence at the top of results. Its scarcity is what makes it work as "the one thing to read first."

### Neutral
- **Cool Backdrop** (`#f4f7fb` light / `#10151c` dark): page background.
- **Card White** (`#ffffff` light / `#1a2230` dark): panel/card surface, one step lighter (light mode) or lighter-than-background (dark mode) than the page itself.
- **Hairline Mist** (`#dbe4ee` light / `#2b3648` dark): the border color used on essentially every bordered element in the system — panels, inputs, dropdowns, table cells, dividers.
- **Ink** (`#1c2b3a` light / `#e8edf4` dark): primary text.
- **Ink, Muted** (`#5b6b7c` light / `#9aabc0` dark): secondary/caption text — used far more than primary ink, since most visible copy in this system is captions, specs, and labels rather than primary prose.

### Status (reserved, functional — not decorative)
- **Status Good Green** (`#0ca30c`): a bucket/condition with adequate coverage.
- **Status Warning Amber** (`#fab219`): redundant coverage (3+ skis in one bucket).
- **Status Critical Red** (`#d03b3b` light / `#e66767` dark): a real coverage gap. The identical red is reused, under a separate token name (`chart-suggestion`), for the map's "what to add" overlay — a deliberate visual echo, not a coincidence: both mean "this needs attention."

### Named Rules
**The Reserved Signal Rule.** Status green/amber/red mean exactly one thing — gap/redundant/covered — everywhere they appear (condition cards, status icons, result-item backgrounds), and are never repurposed for decoration or unrelated emphasis, even when a "free" color would be convenient.

**The Reference Palette Rule.** Status colors, the chart's sequential blue, and the chart-specific greys (`chart-gridline` `#e1e0d9`, `chart-muted` `#898781`) trace to a fixed external dataviz reference palette (see `README.md`), not to this system's own neutral scale — that's why they're warm-toned while the UI's own neutrals are cool blue-grey. Don't "fix" that mismatch by re-harmonizing them to the UI palette; changing them means redoing the dataviz methodology, not a color-matching pass.

## Typography

**Body Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (system stack throughout — no webfont is loaded anywhere)

**Character:** Purely functional, one family for every role. There is no typographic "voice" distinct from the system default — hierarchy is carried entirely by size, weight, case, and color, not by a type pairing.

### Hierarchy
- **Headline** (700 — browser default, not explicitly set; 2rem; 1.2 line-height): the page `<h1>` only, appears exactly once.
- **Title** (600; 1.15rem for panel section headers like "1. Build your quiver", 1rem for dashboard-card headers like "Coverage map"; 1.3 line-height): section-level headers. Two sizes in real use, same weight and role.
- **Body** (400; nominally 1rem/1.5 line-height, but the *dominant* size actually on screen is smaller — 0.78rem–0.95rem covers specs, captions, table cells, and most result text): this is a data-dense system where "body copy" in practice means compact secondary text far more often than full-size prose.
- **Label** (600; 0.85–0.95rem; 0.03em letter-spacing; uppercase): the recurring "eyebrow" treatment for sub-headers like "MY QUIVER" and group headers in the details section — always uppercase, always muted-colored, never used for primary content.

### Named Rules
**The No-Bare-Number Rule.** The derived 0–100 temperament score is never shown alone as a standalone figure — it always appears as a short phrase ("Leans playful") plus a position-on-spectrum gauge, with the raw number kept as small secondary detail only. A bare number reads as a quality grade; this spectrum has no good/bad direction.

## Layout

Single-column, centered, max-width 780px container (`padding: 2rem 1.25rem 4rem`) — there is no multi-column desktop layout at the page level; extra desktop width is simply unused margin, not filled with a second column. Panels stack vertically with consistent 1.5rem bottom margins and 1.5rem internal padding.

Responsive behavior is deliberately **not** "shrink the same layout" — the coverage map (the system's signature visual) renders from two complete, independently-tuned geometry profiles (compact ≤480px vs. full), not one canvas scaled down, because scaling text/marks down to fit a phone made them unreadable. The 4-column condition-card grid collapses to a single column at the same 480px breakpoint. This project treats mobile as a first-class target its own layouts are designed for, not a fallback.

## Elevation & Depth

Flat by default with exactly one soft ambient shadow token, reused identically everywhere something needs to visually lift off the page (panels, the search-results dropdown, the chart tooltip) — there is no elevation ladder or multiple shadow depths. Depth is otherwise conveyed through borders and background-color steps (panel vs. page background), not shadow.

### Shadow Vocabulary
- **Ambient Lift** (`0 1px 3px rgba(20,40,70,.08), 0 1px 2px rgba(20,40,70,.06)` light / `0 1px 3px rgba(0,0,0,.4)` dark): the single shadow role in the system. Used at rest, not as a hover/interaction response.

### Named Rules
**The One Shadow Rule.** There is exactly one shadow in this system. A new component doesn't get a bespoke shadow value — it either uses Ambient Lift or stays flat.

## Shapes

A small, consistent radius scale, used by role rather than by component: **pill** (999px) marks anything actionable/toggleable (chips, badges, toggle buttons, the temperament gauge's track), **10px** is reserved for top-level panels/cards only, **8px** covers everything nested one level in (inputs, dropdowns, condition cards, result items), and **6px** is for the smallest nested elements (the chart tooltip, search-result rows). Perfect circles (50%) mark icon-only buttons and dots. Borders are consistently thin (1px, `border-hairline`) — this is a bordered-container system, not a borderless/shadow-only one.

## Components

### Buttons
- **Primary:** full-width, `{colors.primary}` background, white text, 600 weight, 8px radius, 0.75rem/1rem padding. Darkens to `{colors.primary-deep}` on hover; on disabled, drops to a flat border-colored grey with muted text (no opacity trick).
- **Toggle/Secondary** (table-toggle-btn, interest-chip, info-btn): pill-shaped (999px), page-background fill, bordered, 0.8rem text. Active/pressed state is either a full `{colors.primary}` fill with white text (interest-chip) or just a border+text color shift to primary (info-btn) — both use `aria-pressed` as the state hook, never a separate visual-only class.

### Chips
- **Style:** pill-shaped, page-background fill, 1px bordered, small circular remove-button (28×28px tap target — meets WCAG 2.2's minimum even though the visual chip is more compact) that inverts to solid red on hover.

### Cards / Containers
- **Corner Style:** 10px for top-level panels, 8px for nested cards (condition cards, the on-demand info panel).
- **Background:** panel surface color, or a tinted status-bg color (12–22% opacity of the status hue) for condition cards and result items, colored by state.
- **Shadow Strategy:** Ambient Lift on top-level panels only; nested cards are flat.
- **Border:** 1px hairline throughout, plus a 3px solid left-border accent on status-tinted cards (colored by status, or by `{colors.accent}` for the TL;DR summary specifically).

### Inputs / Fields
- **Style:** page-background fill (not panel-white — inputs sit one step "recessed" relative to their container), 1px hairline border, 8px radius.
- **Focus:** 2px solid primary-color outline, 1px offset — a real outline, not a box-shadow glow.
- **Disabled:** 0.6 opacity + not-allowed cursor.

### Coverage Map (signature component)
The system's most-used and most-tested visual: an SVG scatter/region chart where each ski is a solid dot at its exact spec position, surrounded by a translucent rectangle for the terrain/temperament range it covers — overlapping regions darken where they stack, which is the system's only use of overlapping transparency as a data signal. Exactly two hues ever appear on it: blue for "your quiver," red for "what you're comparing" (either the algorithm's own suggestion or a user-picked candidate) — never more, regardless of quiver size. Every mark is independently focusable and carries a full text `aria-label`; hovering or focusing enlarges the dot and thickens the region's stroke as the only hover feedback (no color shift). A "View as table" toggle swaps the same data into a plain `<table>` — the accessible twin, not an afterthought.

### Temperament Gauge (signature component)
A small "word + position" widget — a pill-shaped track with two faint dividers at the bucket boundaries and a solid dot marking the exact score — paired with a short phrase headline ("Leans playful") and the raw number only as small, low-opacity secondary text. Identical markup renders inside the chart tooltip and the table view, using `currentColor`/inherit for its text so it reads correctly against the tooltip's inverted (dark-on-light or light-on-dark) background without a second color variant.

## Do's and Don'ts

### Do:
- **Do** pair every status/coverage signal with an icon and a text label, never color alone (the reserved status scale is a state indicator, not a decoration — see The Reserved Signal Rule).
- **Do** give every chart an accessible table-view twin with identical underlying data.
- **Do** design mobile layouts as their own real layout (see the coverage map's two geometry profiles), not a scaled-down desktop canvas.
- **Do** treat touch and hover as genuinely different interaction models — anything that opens/closes on hover needs an equivalent tap/focus path that behaves correctly on its own, not an afterthought bolted onto hover logic.

### Don't:
- **Don't** assign arbitrary per-item color coding on the coverage map. There are exactly two roles (quiver / comparison), never a rainbow of per-ski hues.
- **Don't** show the derived temperament score as a bare, standalone number anywhere in the UI (see The No-Bare-Number Rule).
- **Don't** invent a new shadow value for a new component — this system has exactly one (see The One Shadow Rule).
- **Don't** re-harmonize the chart's warm-toned greys to match the UI's cool-toned neutrals — they trace to a different, deliberate source (see The Reference Palette Rule).
