"use strict";

/* ------------------------------------------------------------------ *
 *  Shared scoring engine — the coverage-space math, with no DOM and no
 *  framework dependency. Both the live app (index.html/app.js) and any
 *  kept exploration under v1/v2/v3/v8/v9 import from this single copy
 *  so a fix (like the zonesCovered region-overlap correction) only has
 *  to be made once. See README.md for the reasoning behind these
 *  numbers, and data/SOURCING.md for how the dataset itself is built.
 *
 *  Loaded as a plain <script> (not an ES module) so it works from a
 *  bare `python -m http.server` with no build step: everything below
 *  runs inside an IIFE and attaches only the final API onto a single
 *  global, `QuiverScoring`, which callers destructure from. Without the
 *  IIFE, every internal const here (WAIST_MIN, clamp, ...) would leak
 *  into the same top-level scope as app.js, which loads as a second
 *  plain <script> right after this one - see README.md "Running it".
 * ------------------------------------------------------------------ */

(function () {

const WAIST_MIN = 60;
const WAIST_MAX = 130;
const STAB_MIN = 0;
const STAB_MAX = 100;

// How far (in axis units) each ski's coverage region extends from its
// own position. This is what makes a ski cover a *region*, not a point.
const WAIST_RADIUS = 7; // mm
const STAB_RADIUS = 12; // stability points (0-100 scale)

// Weight range used to normalize stability score. Spans the lightest
// (Blizzard Zero G 105) to heaviest (Volkl Katana 108) skis in the
// sourced dataset — see data/SOURCING.md.
const WEIGHT_MIN = 1500;
const WEIGHT_MAX = 2360;

// Contribution of metal content to the stability score (0-1 scale).
const METAL_SCORE = { none: 0, partial: 0.5, full: 1 };

// Weighting between weight and metal content in the "base" stability
// score, before the rocker pull below is applied.
const WEIGHT_FACTOR = 0.65;
const METAL_FACTOR = 0.35;

// Rocker independently pulls a ski's stability score toward "playful,"
// regardless of weight/metal: a heavy, full-metal, heavily-rockered
// powder ski still skis loose, not damp. This is the max number of
// points a 100%-rocker ski gets pulled down by; a full-camber ski gets
// no pull at all. See README.md "Stability score" for the reasoning.
const ROCKER_PULL_MAX = 25;

// Fallback rocker_percent when a ski entry doesn't have one sourced
// directly (see data/SOURCING.md "Classifying rocker profile") - the
// midpoint of each profile's typical rocker coverage.
const ROCKER_PROFILE_DEFAULT_PERCENT = {
  full_camber: 5,
  camber_tip_rocker: 20,
  camber_tip_tail_rocker: 40,
  flat_tip_tail_rocker: 65,
  full_rocker: 90,
};

const REDUNDANCY_THRESHOLD = 3;
const MAX_QUIVER_SIZE = 6;

const WAIST_BUCKETS = [
  { key: "narrow", label: "narrow / firm-groomer", short: "Narrow", min: WAIST_MIN, max: 89 },
  { key: "allmtn", label: "all-mountain", short: "All-mtn", min: 90, max: 109 },
  { key: "wide", label: "wide / powder", short: "Wide", min: 110, max: WAIST_MAX },
];

const STAB_BUCKETS = [
  { key: "playful", label: "playful / light", short: "Playful", min: 0, max: 33.33 },
  { key: "balanced", label: "balanced", short: "Balanced", min: 33.33, max: 66.67 },
  { key: "damp", label: "damp / charging", short: "Damp", min: 66.67, max: 100 },
];

// Plain-language "what this bucket is good for" copy, used in output text.
const BUCKET_DESCRIPTIONS = {
  "narrow-playful": "quick, playful groomer days",
  "narrow-balanced": "all-day groomer cruising with a bit of pop",
  "narrow-damp": "high-speed carving on firm, hard snow",
  "allmtn-playful": "playful, easy-pivoting all-mountain days",
  "allmtn-balanced": "do-it-all all-mountain skiing — the sweet spot for most days",
  "allmtn-damp": "aggressive all-mountain charging through chopped-up, variable snow",
  "wide-playful": "surfy, playful powder days",
  "wide-balanced": "all-mountain powder days that still float but stay maneuverable",
  "wide-damp": "big powder days at speed, or big-mountain charging",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * A ski's rocker_percent if sourced directly, otherwise the midpoint
 * default for its rocker_profile category. See data/SOURCING.md.
 */
function rockerPercent(ski) {
  if (typeof ski.rocker_percent === "number") return ski.rocker_percent;
  return ROCKER_PROFILE_DEFAULT_PERCENT[ski.rocker_profile] ?? 40;
}

/**
 * A ski's weight/turn radius at its currently *selected* length
 * (ski.selected_length_cm, set when it's added to the quiver or as a
 * candidate), looked up from its length_options table (see
 * data/SOURCING.md). Falls back to the ski's own reference-length spec
 * when it has no length_options yet (most of the dataset, until
 * backfilled) or when the selected length isn't in that array.
 */
function effectiveSpecs(ski) {
  const lengthCm = ski.selected_length_cm ?? ski.reference_length_cm;
  const match = ski.length_options?.find((o) => o.length_cm === lengthCm);
  return {
    length_cm: lengthCm,
    weight_g: match ? match.weight_g : ski.weight_g,
    turn_radius_m: match ? match.turn_radius_m : ski.turn_radius_m,
  };
}

/**
 * Derive a 0-100 "stability score" from weight, metal content, and
 * rocker. Heavier + more metal => higher base score => damper/more
 * charging-oriented. Rocker then independently pulls the score back
 * toward "playful," regardless of weight/metal — a heavy, full-metal,
 * heavily-rockered powder ski still skis loose, not damp; a full-camber
 * ski gets no pull at all. Weight is the *selected-length* weight (see
 * effectiveSpecs) — a shorter or longer version of the same ski can
 * genuinely land in a different bucket.
 */
function stabilityScore(ski) {
  const weightNorm = clamp((effectiveSpecs(ski).weight_g - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN), 0, 1);
  const metalNorm = METAL_SCORE[ski.metal_content] ?? 0;
  const base = weightNorm * WEIGHT_FACTOR * 100 + metalNorm * METAL_FACTOR * 100;
  const rockerPull = (rockerPercent(ski) / 100) * ROCKER_PULL_MAX;
  return clamp(base - rockerPull, 0, 100);
}

/**
 * The rectangular coverage region a ski "occupies" in (waist, stability)
 * space, clamped to the axis bounds.
 */
function coverageRegion(ski) {
  const stab = stabilityScore(ski);
  return {
    xMin: clamp(ski.waist_width_mm - WAIST_RADIUS, WAIST_MIN, WAIST_MAX),
    xMax: clamp(ski.waist_width_mm + WAIST_RADIUS, WAIST_MIN, WAIST_MAX),
    yMin: clamp(stab - STAB_RADIUS, STAB_MIN, STAB_MAX),
    yMax: clamp(stab + STAB_RADIUS, STAB_MIN, STAB_MAX),
    stab,
  };
}

function rectsOverlap(a, b) {
  return a.xMin <= b.max && a.xMax >= b.min;
}

/* ------------------------------------------------------------------ *
 *  Temperament display helpers
 *
 *  The underlying 0-100 number (computed by stabilityScore) is never
 *  shown to the user as a bare "X / 100" — on its own that reads like a
 *  quality grade (higher = better), when really it's a spectrum with no
 *  good/bad direction: a playful ski isn't a worse ski than a damp one,
 *  just a different one. User-facing UI calls this "Temperament" and
 *  always shows it as a short phrase + a position-on-a-spectrum gauge,
 *  with the raw number kept only as a small secondary detail.
 * ------------------------------------------------------------------ */

function temperamentBucket(score) {
  return STAB_BUCKETS.find((b) => score >= b.min && score <= b.max) || STAB_BUCKETS[STAB_BUCKETS.length - 1];
}

function temperamentPhrase(score) {
  const key = temperamentBucket(score).key;
  if (key === "playful") return "Leans playful";
  if (key === "damp") return "Leans damp/charging";
  return "Balanced";
}

/**
 * Build the 3x3 grid. Each cell holds the list of skis (from the given
 * quiver) whose coverage region overlaps that bucket.
 */
function buildGrid(skis) {
  const regions = skis.map((ski) => ({ ski, region: coverageRegion(ski) }));

  const grid = [];
  for (const stabBucket of STAB_BUCKETS) {
    for (const waistBucket of WAIST_BUCKETS) {
      const coveringSkis = regions
        .filter(
          ({ region }) =>
            rectsOverlap({ xMin: region.xMin, xMax: region.xMax }, waistBucket) &&
            rectsOverlap({ xMin: region.yMin, xMax: region.yMax }, stabBucket)
        )
        .map(({ ski }) => ski);

      grid.push({
        waistBucket,
        stabBucket,
        skis: coveringSkis,
      });
    }
  }
  return grid;
}

function bucketLabel(cell) {
  return `${cell.waistBucket.label} + ${cell.stabBucket.label}`;
}

function bucketDescription(cell) {
  const key = `${cell.waistBucket.key}-${cell.stabBucket.key}`;
  return BUCKET_DESCRIPTIONS[key] || "this combination of width and temperament";
}

function bucketCenter(bucket) {
  return (bucket.min + bucket.max) / 2;
}

/**
 * How well a ski fits a bucket: null if its coverage region doesn't
 * overlap the bucket at all, otherwise the normalized distance from the
 * ski's own position to the bucket's center (waist and temperament are
 * each divided by their axis span first, so neither dominates just
 * because of its raw units). Shared by both the per-bucket suggestion
 * list (bullets/tooltips) and the map's cross-bucket ranking below.
 */
function bucketFitDistance(ski, waistBucket, stabBucket) {
  const region = coverageRegion(ski);
  const overlaps =
    rectsOverlap({ xMin: region.xMin, xMax: region.xMax }, waistBucket) &&
    rectsOverlap({ xMin: region.yMin, xMax: region.yMax }, stabBucket);
  if (!overlaps) return null;

  const dx = (ski.waist_width_mm - bucketCenter(waistBucket)) / (WAIST_MAX - WAIST_MIN);
  const dy = (region.stab - bucketCenter(stabBucket)) / (STAB_MAX - STAB_MIN);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Rank every ski in the given catalog (not just the quiver) by fit to
 * a single bucket, best first, capped at `limit`. Callers pass the
 * full dataset as `catalogSkis` since this module holds no state of
 * its own.
 */
function suggestSkisForBucket(catalogSkis, waistBucket, stabBucket, quiverNames, limit = 2) {
  return catalogSkis
    .filter((ski) => !quiverNames.has(ski.name))
    .map((ski) => ({ ski, distance: bucketFitDistance(ski, waistBucket, stabBucket) }))
    .filter((c) => c.distance !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((c) => c.ski);
}

/**
 * Greedy set-cover: repeatedly pick the single catalog ski that covers
 * the most *still-uncovered* gap buckets (ties broken by average fit
 * distance to those buckets), remove the buckets it covers, and repeat.
 * This is different from - and better than - scoring every ski
 * independently by "how many gaps does this ski alone touch": that
 * approach lets several high-scoring skis all cover the same ground,
 * which is exactly the clustering this replaces. No fixed suggestion
 * count - it naturally stops once every gap is covered, or once no
 * remaining candidate can add any new coverage (which means the catalog
 * genuinely doesn't have a fit for what's left - surfaced to the
 * caller as `uncoveredCount` rather than hidden).
 */
function selectTopSuggestionsForMap(catalogSkis, gaps, quiverNames) {
  const remaining = new Set(gaps);
  const suggestions = [];
  const used = new Set();
  // name -> the gap cells this ski was actually picked for. A ski's own
  // position can sit in an already-covered bucket while its region still
  // reaches into a real gap (regions extend ±7mm/±12pts) - this is what
  // the table view shows instead of the ski's home bucket, so it stays
  // accurate to *why* each ski was suggested.
  const coverageBySkiName = new Map();

  while (remaining.size > 0) {
    let best = null; // { ski, covers: Set<cell>, avgDistance }

    for (const ski of catalogSkis) {
      if (quiverNames.has(ski.name) || used.has(ski.name)) continue;

      const covers = new Set();
      let totalDistance = 0;
      for (const cell of remaining) {
        const distance = bucketFitDistance(ski, cell.waistBucket, cell.stabBucket);
        if (distance !== null) {
          covers.add(cell);
          totalDistance += distance;
        }
      }
      if (covers.size === 0) continue;

      const avgDistance = totalDistance / covers.size;
      if (
        !best ||
        covers.size > best.covers.size ||
        (covers.size === best.covers.size && avgDistance < best.avgDistance)
      ) {
        best = { ski, covers, avgDistance };
      }
    }

    if (!best) break; // nothing left in the catalog helps with what remains
    suggestions.push(best.ski);
    used.add(best.ski.name);
    coverageBySkiName.set(best.ski.name, Array.from(best.covers));
    for (const cell of best.covers) remaining.delete(cell);
  }

  return { suggestions, uncoveredCount: remaining.size, coverageBySkiName };
}

/**
 * Fixed icon/label per status. These map 1:1 onto the status colors
 * defined in style.css (good/warning/critical) — never assigned ad hoc,
 * always via this function.
 */
function statusMeta(status) {
  switch (status) {
    case "critical":
      return { icon: "✕", label: "Gap" };
    case "warning":
      return { icon: "▲", label: "Redundant" };
    default:
      return { icon: "✓", label: "Covered" };
  }
}

function metalLabel(metal) {
  if (metal === "none") return "no";
  if (metal === "partial") return "partial";
  return "full";
}

window.QuiverScoring = {
  // constants
  WAIST_MIN,
  WAIST_MAX,
  STAB_MIN,
  STAB_MAX,
  WAIST_RADIUS,
  STAB_RADIUS,
  WEIGHT_MIN,
  WEIGHT_MAX,
  REDUNDANCY_THRESHOLD,
  MAX_QUIVER_SIZE,
  MAX_CANDIDATES: 3,
  WAIST_BUCKETS,
  STAB_BUCKETS,
  BUCKET_DESCRIPTIONS,
  // functions
  clamp,
  rockerPercent,
  effectiveSpecs,
  stabilityScore,
  coverageRegion,
  rectsOverlap,
  temperamentBucket,
  temperamentPhrase,
  buildGrid,
  bucketLabel,
  bucketDescription,
  bucketCenter,
  bucketFitDistance,
  suggestSkisForBucket,
  selectTopSuggestionsForMap,
  statusMeta,
  metalLabel,
};

})();
