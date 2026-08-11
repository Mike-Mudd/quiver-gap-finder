# Quiver Gap Finder

A single-page tool for skiers to find coverage gaps in their ski quiver.
Pick up to 6 skis you own (or are considering), and it tells you which
kinds of ski days you're covered for — and which you're not.

No build tooling, no backend, no framework: just `index.html`, `style.css`,
and `app.js`, plus a static `data/skis.json` dataset.

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
- **Y axis — stability score (0–100)**, a derived value (see below), split
  into 3 buckets:
  - `playful / light` (0–33.3)
  - `balanced` (33.3–66.7)
  - `damp / charging` (66.7–100)

That gives a 3×3 grid of 9 buckets, each representing a distinct kind of
ski day (e.g. "wide/powder + damp/charging" = big powder days at speed).

### 2. Stability score

Waist width is a given data field, but "stability" isn't something ski
brands publish directly — it's derived from two inputs that correlate
with how damp/composed vs. playful/light a ski feels:

- **Weight** — heavier skis are generally more stable at speed and in
  crud. Weight is normalized against a 1500–2300g range (roughly the
  lightest-to-heaviest skis in the dataset) to a 0–1 scale.
- **Metal content** — `none` / `partial` / `full` sheets of metal (usually
  titanal) in the layup add dampness and stability. This maps to a 0 / 0.5
  / 1 score.

The two are combined as a weighted sum, then scaled to 0–100:

```
stability_score = (weight_norm * 0.65 + metal_norm * 0.35) * 100
```

Weight is weighted higher than metal content because it's a continuous,
more reliable signal; metal content is a coarser 3-value proxy.

These weights and the normalization range are simple, tunable heuristics,
not a physics model — the goal is a reasonable relative ordering of skis
from "playful" to "charging," not a precise number.

### 3. Coverage regions, not points

A ski doesn't just "count" for the single bucket its exact waist width and
stability score fall into — real skis are versatile within a range around
their specs. Each ski gets a rectangular **coverage region** centered on
its (waist, stability) position:

- ±7mm on the waist width axis
- ±12 points on the stability axis

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

The results panel shows these as plain-language bullets, plus a reference
3×3 grid table with per-bucket ski counts.

## Data

`data/skis.json` contains ~30 popular all-mountain/freeride ski models
with:

| field             | meaning                                      |
| ----------------- | --------------------------------------------- |
| `name`            | model name                                    |
| `waist_width_mm`  | waist width in millimeters                    |
| `weight_g`        | per-ski weight in grams (approx., per pair/2) |
| `rocker_percent`  | approximate % of ski length in rocker/splay   |
| `turn_radius_m`   | manufacturer-stated turn radius in meters     |
| `metal_content`   | `none`, `partial`, or `full` sheet(s) of metal|

Values are realistic approximations for well-known models, not scraped
from official spec sheets — treat them as illustrative, not authoritative.

## Files

```
index.html      Page structure
style.css       Styling
app.js          Search/multi-select UI + gap-finding logic
data/skis.json  Ski dataset
README.md       This file
```
