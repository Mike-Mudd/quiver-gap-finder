# Ski Gap

A single-page tool for skiers to find coverage gaps in their ski quiver.
Pick up to 6 skis you own (or are considering), and it tells you which
kinds of ski days you're covered for — and which you're not.

No build tooling, no backend, no framework: `index.html`/`style.css`/
`app.js` for the page itself, `scoring.js`/`coverage-map.js`/
`condition-cards.js` as the shared render/scoring modules, plus a
static `data/skis.json` dataset.

## Running it

Because `app.js` loads `data/skis.json` via `fetch()`, most browsers will
block it if you open `index.html` directly from disk (`file://` URLs are
subject to CORS restrictions on local file reads). Serve the folder with
any static file server instead, for example:

```bash
python -m http.server 8000
```

or

```bash
npx serve .
```

Then visit `http://localhost:8000` (or whatever port your server prints).

## How it works

### 1. The coverage space

Every ski is placed in a 2D space:

- **X axis — waist width (mm)**, ranging 60–130mm, split into 3 buckets:
  - `narrow / firm-groomer` (60–89mm)
  - `all-mountain` (90–109mm)
  - `wide / powder` (110–130mm)
- **Y axis — temperament (0–100)**, a derived value (see below), split
  into 3 buckets:
  - `playful / light` (0–33.3)
  - `balanced` (33.3–66.7)
  - `damp / charging` (66.7–100)

That gives a 3×3 grid of 9 buckets, each representing a distinct kind of
ski day (e.g. "wide/powder + damp/charging" = big powder days at speed).

### 2. Temperament

Waist width is a given data field, but a ski's "temperament" — how
damp/composed vs. playful/light it feels — isn't something ski brands
publish directly. It's deliberately **not called "stability score"** in
the UI: a bare 0–100 number reads like a quality grade (higher = better),
but this is a spectrum with no good/bad direction — a playful ski isn't
a worse ski than a damp one, just a different one suited to different
days. Every place it's shown to the user, it's a short phrase ("Leans
playful" / "Balanced" / "Leans damp/charging") plus a small gauge marking
its position on the spectrum — never a bare number. See "Results
dashboard" below.

Under the hood it's derived from three inputs that correlate with how
damp/composed vs. playful/light a ski feels:

- **Weight** — heavier skis are generally more stable at speed and in
  crud. Weight is normalized against a 1550–2360g range (the
  lightest-to-heaviest skis in the sourced dataset) to a 0–1 scale.
- **Metal content** — `none` / `partial` / `full` sheets of metal (usually
  titanal) in the layup add dampness and stability. This maps to a 0 / 0.5
  / 1 score. `partial` covers constructions like a binding-area
  reinforcement plate or a tapered/segmented layer, as opposed to a
  full-length sheet — see `data/SOURCING.md` for how that distinction is
  drawn per ski.
- **Rocker** — independent of weight and metal. A heavy, full-metal ski
  with a lot of tip/tail rocker still skis loose in the tail and forgives
  mistakes more than its weight alone suggests (and vice versa: a light
  ski with full camber still feels locked-in and precise). Rocker doesn't
  raise the score — it only *pulls it down* toward "playful," in
  proportion to how much of the ski's length is rockered.

Weight and metal are combined into a base score, then rocker pulls that
base down:

```
base               = (weight_norm * 0.65 + metal_norm * 0.35) * 100
rocker_pull        = (rocker_percent / 100) * 25   // max 25-point pull at 100% rocker
temperament_score  = clamp(base - rocker_pull, 0, 100)
```

Weight is weighted higher than metal content in the base because it's a
continuous, more reliable signal; metal content is a coarser 3-value
proxy. The 25-point rocker pull is capped below the base's own 100-point
range so weight/metal remain the primary signal and rocker acts as a
correction, not a competing axis.

These weights, the normalization range, and the rocker pull cap are
simple, tunable heuristics, not a physics model — the goal is a
reasonable relative ordering of skis from "playful" to "charging," not a
precise number.

`rocker_percent` is sourced directly (as tip-rocker% + tail-rocker% of
the ski's length) when a source publishes that breakdown; otherwise it
falls back to a midpoint default for the ski's `rocker_profile` category.
See `data/SOURCING.md` for both.

### 3. Coverage regions, not points

A ski doesn't just "count" for the single bucket its exact waist width and
temperament fall into — real skis are versatile within a range around
their specs. Each ski gets a rectangular **coverage region** centered on
its (waist, temperament) position:

- ±7mm on the waist width axis
- ±12 points on the temperament axis

That region is clamped to the axis bounds (60–130mm, 0–100). A ski
**covers** a bucket if its coverage rectangle overlaps that bucket's area
at all — so a ski near a bucket boundary can cover two (or more) adjacent
buckets.

### 4. Union, gaps, and redundancy

For the selected quiver:

1. Compute each ski's coverage region.
2. For each of the 9 buckets, collect every ski whose region overlaps it —
   this is the union of coverage across the whole quiver.
3. **Gap**: a bucket covered by zero skis. Reported as "no coverage for
   `<bucket>` — nothing built for `<what that bucket is for>`."
4. **Redundancy**: a bucket covered by 3 or more skis. Reported as
   overlap, since that's more skis doing similar jobs than the space
   really needs.

### 5. Results dashboard

The results panel is a small dashboard, not a wall of text:

- **Stat tiles** — three KPIs at a glance: buckets covered (X/9), coverage
  gaps, and redundant zones.
- **Coverage map** — an SVG scatter/region chart on the actual waist ×
  temperament plane. Each ski is a dot at its exact spec, surrounded by a
  translucent box for its coverage region; overlapping regions darken
  where they stack, which is what visually signals redundancy. A "View as
  table" toggle swaps it for a plain data table (the accessible twin of
  the chart — same numbers, no color required to read them).
- **Temperament gauge** — hovering/focusing a ski's dot (or its row in the
  table view) shows temperament as a short phrase ("Leans playful" /
  "Balanced" / "Leans damp/charging") next to a small track-and-dot gauge
  marking its position between the two poles, with the raw 0–100 number
  kept only as a small secondary detail — never shown alone as a bare
  number that would read like a grade.
- **Coverage grid** — the same 3×3 bucket grid as a status-coded heatmap:
  red/"Gap" for zero skis, green/"Covered" for 1–2, amber/"Redundant" for
  3+. Every tile pairs its color with an icon and a text label (never
  color alone), and hovering or focusing a tile shows exactly which skis
  land there.
- **Plain-language details** — the original bullet-point gap/redundancy
  summary, kept as a collapsible section under the visuals.

Colors follow a small fixed rule set: a **single sequential hue** (blue)
for the coverage map — there's no per-ski color coding, so a quiver of 6
skis never needs 6 distinguishable hues — and a **fixed status scale**
(good/warning/critical) for anything that represents a state (gap,
covered, redundant), reused identically across the stat tiles, the
heatmap, and the bullet icons so the same color always means the same
thing everywhere on the page.

## Data

`data/skis.json` holds 61 popular all-mountain, freeride, and
frontside/carving ski models across 20 brands,
sourced (not estimated) from Blister Review's measured data, manufacturer
spec pages, and retail spec tables. The file is a versioned envelope:

```json
{
  "schema_version": 2,
  "last_updated": "2026-08-13",
  "skis": [ { "name": "...", "waist_width_mm": 95, ... }, ... ]
}
```

Each ski entry:

| field                  | meaning                                                        |
| ---------------------- | ---------------------------------------------------------------|
| `name`                 | model name, as marketed                                        |
| `brand`                | manufacturer                                                   |
| `model_year`           | the season the specs below were sourced from                   |
| `reference_length_cm`  | the specific length `weight_g`/`turn_radius_m` were measured at — both vary by length, so a number without this attached isn't comparable across skis |
| `waist_width_mm`       | waist width at the reference length                             |
| `weight_g`             | **per ski**, preferring a physically-measured figure over manufacturer-claimed weight |
| `turn_radius_m`        | at the reference length                                         |
| `rocker_profile`       | one of 5 categorical shapes (`full_camber` → `full_rocker`) — see below |
| `rocker_percent`       | tip% + tail% rocker coverage, 0–100, when a source publishes the exact split; otherwise a per-category default |
| `metal_content`        | `none` / `partial` (binding-area reinforcement or a tapered/segmented layer) / `full` (a complete sheet the length of the ski) |
| `tail_shape`            | `directional` / `modified_twin` / `twin_tip` — switch-skiability, orthogonal to the waist/stability coverage map; drives the separate "Park" condition card instead |
| `source`, `source_url` | where the entry came from                                       |
| `verified_date`        | when it was last checked against a source                       |
| `notes`                | anything a future editor should know (ambiguous figures, corrections made, etc.) |

**Why this schema, not just numbers:** the dataset is meant to keep
growing over time (30 → 50 → 61 skis and 9 → 18 → 20 brands as of this writing).
`reference_length_cm`, `model_year`,
`source`/`source_url`, and `verified_date` exist so a future pass can
tell *which* number is being compared to *what*, and refresh stale
entries without re-deriving the whole file. `data/SOURCING.md` documents
the exact, repeatable process (source priority, per-field rules, how to
classify `rocker_profile`) for adding or updating an entry — follow it
for any new ski so the dataset stays internally consistent as it grows.

**Rocker profile categories** (see `data/SOURCING.md` for the full
classification guide):

| value                    | shape                                          |
| ------------------------ | ------------------------------------------------|
| `full_camber`             | classic camber, no rocker                      |
| `camber_tip_rocker`       | camber underfoot + tip rocker only              |
| `camber_tip_tail_rocker`  | camber underfoot + rocker at tip and tail        |
| `flat_tip_tail_rocker`    | flat underfoot + tip and tail rocker             |
| `full_rocker`             | continuous rocker, no camber ("inverted camber") |

Note that this particular 30-ski dataset (deliberately curated as
all-mountain/freeride) skews heavily toward `camber_tip_tail_rocker` —
that's a real reflection of the category, not a data-quality issue. The
field becomes more differentiating once dedicated powder, park, or race
skis are added.

## Files

```
index.html         Page structure
style.css          Styling
app.js             Search/multi-select UI + gap-finding logic
data/skis.json     Ski dataset
data/SOURCING.md   Methodology for adding/refreshing a ski entry
README.md          This file
```
