"use strict";

/* ------------------------------------------------------------------ *
 *  Constants: the coverage space, buckets, and scoring parameters.
 *  See README.md for the reasoning behind these numbers.
 * ------------------------------------------------------------------ */

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

// Turn-radius range used to normalize the Trees/Powder/Speed interest
// bias below (see INTERESTS). Spans the tightest (Rossignol Forza 70
// V-Ti, 14m) to widest-arcing (Black Crows Corvus, 25m) turn radius in
// the sourced dataset.
const RADIUS_MIN = 14;
const RADIUS_MAX = 25;

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

/* ------------------------------------------------------------------ *
 *  State
 * ------------------------------------------------------------------ */

let allSkis = [];
let quiver = []; // array of ski objects, max MAX_QUIVER_SIZE

// User-picked "what if I added this" comparison skis for the coverage
// map - independent of the quiver and of the algorithm's own
// gap-suggestions (see renderDashboard/renderCandidatePicker). Reset
// whenever "Find gaps" runs fresh (see onFindGaps), but NOT when a
// candidate is added/removed - that re-render path is renderResults().
let candidateSkis = [];
const MAX_CANDIDATES = 3;

// Optional "lean toward" interest (see INTERESTS below) - one of
// INTERESTS[].key or null for "no lean." Single-select: Trees and Speed
// pull in opposite directions (short/light vs. long/heavy), so letting
// both be active at once would muddy the bias with no clean way to
// combine them. Persists across quiver/candidate changes like quiver
// does, until the user picks a different chip or clears it - not reset
// by onFindGaps.
let selectedInterest = null;

/* ------------------------------------------------------------------ *
 *  DOM references
 * ------------------------------------------------------------------ */

const searchInput = document.getElementById("ski-search");
const searchResultsEl = document.getElementById("search-results");
const quiverListEl = document.getElementById("quiver-list");
const quiverCountEl = document.getElementById("quiver-count");
const findGapsBtn = document.getElementById("find-gaps-btn");
const resultsEl = document.getElementById("results");
const tooltipEl = document.getElementById("chart-tooltip");

/* ------------------------------------------------------------------ *
 *  Init
 * ------------------------------------------------------------------ */

init();

async function init() {
  try {
    const res = await fetch("data/skis.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (!payload || !Array.isArray(payload.skis)) {
      throw new Error("Unexpected data/skis.json format (expected a { skis: [...] } object)");
    }
    allSkis = payload.skis;
  } catch (err) {
    searchResultsEl.hidden = false;
    searchResultsEl.innerHTML = `<li class="no-match">Couldn't load data/skis.json (${escapeHtml(
      String(err.message || err)
    )}). If you opened this file directly from disk, serve it with a local server instead — see README.md.</li>`;
    return;
  }

  searchInput.addEventListener("input", onSearchInput);
  searchInput.addEventListener("focus", onSearchInput);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
      hideSearchResults();
      const candidateResultsEl = document.getElementById("candidate-search-results");
      if (candidateResultsEl) candidateResultsEl.hidden = true;
    }
  });

  // Capture phase so this also catches scroll on the chart's own
  // horizontal-scroll container, which doesn't bubble a "scroll" event
  // up to window - see checkTooltipAnchorMoved for the rest of the
  // reasoning.
  window.addEventListener("scroll", checkTooltipAnchorMoved, { capture: true, passive: true });

  findGapsBtn.addEventListener("click", onFindGaps);
  wireInterestPicker();
}

/** Single-select "lean toward" chips (see selectedInterest) - clicking
 * the already-active chip clears it back to "no lean," same toggle
 * pattern as the coverage map's info/table buttons. Lives in the
 * static index.html markup (unlike quiver/results), so it's wired once
 * here rather than re-wired on every render - live-updates results in
 * place via refreshResultsIfShown, same as a length picker change. */
function wireInterestPicker() {
  const chips = document.querySelectorAll(".interest-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.interest;
      selectedInterest = selectedInterest === key ? null : key;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.interest === selectedInterest)));
      refreshResultsIfShown();
    });
  });
}

/* ------------------------------------------------------------------ *
 *  Search / multi-select
 * ------------------------------------------------------------------ */

function onSearchInput() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedNames = new Set(quiver.map((s) => s.name));

  let matches = allSkis.filter((s) => s.name.toLowerCase().includes(query));
  matches = matches.slice(0, 8);

  searchResultsEl.innerHTML = "";

  if (matches.length === 0) {
    searchResultsEl.innerHTML = `<li class="no-match">No skis match "${escapeHtml(
      searchInput.value
    )}"</li>`;
    searchResultsEl.hidden = false;
    return;
  }

  for (const ski of matches) {
    const li = document.createElement("li");
    const alreadyAdded = selectedNames.has(ski.name);
    const quiverFull = quiver.length >= MAX_QUIVER_SIZE;
    const disabled = alreadyAdded || quiverFull;

    li.setAttribute("role", "option");
    li.setAttribute("aria-disabled", String(disabled));
    li.innerHTML = `
      <span>${escapeHtml(ski.name)}${alreadyAdded ? " ✓" : ""}</span>
      <span class="ski-spec">${ski.waist_width_mm}mm</span>
    `;

    if (!disabled) {
      li.addEventListener("click", () => {
        addToQuiver(ski);
        searchInput.value = "";
        hideSearchResults();
        searchInput.focus();
      });
    }

    searchResultsEl.appendChild(li);
  }

  searchResultsEl.hidden = false;
}

function hideSearchResults() {
  searchResultsEl.hidden = true;
}

function addToQuiver(ski) {
  if (quiver.length >= MAX_QUIVER_SIZE) return;
  if (quiver.some((s) => s.name === ski.name)) return;
  // A shallow copy, not the shared allSkis reference - each quiver slot
  // tracks its own selected_length_cm independently (see effectiveSpecs),
  // defaulting to the ski's reference length.
  quiver.push({ ...ski, selected_length_cm: ski.reference_length_cm });
  renderQuiver();
}

function removeFromQuiver(name) {
  quiver = quiver.filter((s) => s.name !== name);
  renderQuiver();
}

/** <select> of a ski's available lengths (see length_options in
 * data/SOURCING.md) - quietly absent rather than showing a picker with
 * nothing to pick, for the (currently most) skis that haven't been
 * backfilled with any yet. */
function lengthPickerHtml(ski) {
  if (!ski.length_options || ski.length_options.length === 0) return "";
  const options = ski.length_options
    .map(
      (o) =>
        `<option value="${o.length_cm}" ${
          o.length_cm === ski.selected_length_cm ? "selected" : ""
        }>${o.length_cm}cm</option>`
    )
    .join("");
  return `<select class="length-picker" data-length-for="${escapeHtml(
    ski.name
  )}" aria-label="Length for ${escapeHtml(ski.name)}">${options}</select>`;
}

/** Re-renders results in place if they're already showing (e.g. after
 * changing a length picker), without forcing results open if "Find
 * gaps" hasn't been clicked yet. */
function refreshResultsIfShown() {
  if (resultsEl.querySelector(".dashboard-card")) {
    renderResults();
  }
}

function renderQuiver() {
  quiverCountEl.textContent = `${quiver.length} / ${MAX_QUIVER_SIZE}`;

  if (quiver.length === 0) {
    quiverListEl.innerHTML = `<li class="empty-hint">No skis added yet — search above to add up to ${MAX_QUIVER_SIZE}.</li>`;
  } else {
    quiverListEl.innerHTML = "";
    for (const ski of quiver) {
      const li = document.createElement("li");
      li.className = "quiver-chip";
      li.innerHTML = `
        <span>${escapeHtml(ski.name)}</span>
        ${lengthPickerHtml(ski)}
        <button type="button" aria-label="Remove ${escapeHtml(ski.name)}">✕</button>
      `;
      li.querySelector("button").addEventListener("click", () => removeFromQuiver(ski.name));
      const picker = li.querySelector(".length-picker");
      if (picker) {
        picker.addEventListener("change", () => {
          ski.selected_length_cm = Number(picker.value);
          refreshResultsIfShown();
        });
      }
      quiverListEl.appendChild(li);
    }
  }

  findGapsBtn.disabled = quiver.length === 0;
}

/* ------------------------------------------------------------------ *
 *  Scoring
 * ------------------------------------------------------------------ */

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
 * candidate — see addToQuiver/addCandidate), looked up from its
 * length_options table (see data/SOURCING.md). Falls back to the ski's
 * own reference-length spec when it has no length_options yet (most of
 * the dataset, until backfilled) or when the selected length isn't in
 * that array — same numbers the app always showed before this existed.
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
 *  Interest bias — "Trees / Powder / Speed" (see selectedInterest,
 *  renderInterestPicker)
 *
 *  Not a new axis and not sourced data: each affinity score is a 0-1
 *  lean built entirely from specs already in every ski's record (waist
 *  width, turn radius, rocker, weight, and the existing stability
 *  score). It only nudges *which* already-qualifying ski wins a
 *  gap-bucket tiebreak (see bucketFitDistance) - it never changes which
 *  buckets count as gaps or lets a non-fitting ski into the running.
 *
 *  "Park" deliberately isn't included here - it depends on twin-tip
 *  construction and mount point, neither of which exists in the
 *  dataset, so there's no honest way to derive it (same reasoning that
 *  ruled out "stiff" for the Y-axis wording - see git history).
 * ------------------------------------------------------------------ */

function normalize01(value, min, max) {
  return clamp((value - min) / (max - min), 0, 1);
}

const INTERESTS = [
  {
    key: "trees",
    label: "Trees",
    // Quick, easy pivots: short turn radius + more rocker + lighter
    // weight. Uses effectiveSpecs so a length change (see the length
    // picker) shifts the lean too, same as every other length-aware
    // number in the app.
    affinity(ski) {
      const specs = effectiveSpecs(ski);
      const radius = normalize01(specs.turn_radius_m ?? RADIUS_MAX, RADIUS_MIN, RADIUS_MAX);
      const rocker = rockerPercent(ski) / 100;
      const weight = normalize01(specs.weight_g, WEIGHT_MIN, WEIGHT_MAX);
      return (1 - radius) * 0.5 + rocker * 0.3 + (1 - weight) * 0.2;
    },
  },
  {
    key: "powder",
    label: "Powder",
    // Float and easy surfacing: wide waist + more rocker.
    affinity(ski) {
      const waist = normalize01(ski.waist_width_mm, WAIST_MIN, WAIST_MAX);
      const rocker = rockerPercent(ski) / 100;
      return waist * 0.6 + rocker * 0.4;
    },
  },
  {
    key: "speed",
    label: "Speed",
    // Planted at pace: reuses the existing damp/charging stability
    // score (heavier, more metal, less rocker), plus a longer turn
    // radius for wide-arcing turns at speed.
    affinity(ski) {
      const specs = effectiveSpecs(ski);
      const stab = stabilityScore(ski) / 100;
      const radius = normalize01(specs.turn_radius_m ?? RADIUS_MIN, RADIUS_MIN, RADIUS_MAX);
      return stab * 0.7 + radius * 0.3;
    },
  },
];

function interestAffinity(ski, interestKey) {
  const interest = INTERESTS.find((i) => i.key === interestKey);
  return interest ? interest.affinity(ski) : 0;
}

// How much a full-affinity (1.0) match can pull a ski's bucketFitDistance
// closer to "best pick." Distances are normalized fractions of each
// axis span (see bucketFitDistance) and stay small for anything that
// overlaps a bucket at all - 0.15 is enough to flip a close tiebreak
// toward the interest-matching ski without overriding a genuinely
// better-centered one for the bucket itself.
const INTEREST_BIAS_WEIGHT = 0.15;

/* ------------------------------------------------------------------ *
 *  Temperament display
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
 * A compact "word + gauge" widget: a track with dividers at the bucket
 * boundaries, a dot marking the ski's position, and a short phrase
 * (never the bare number) as the headline. Used identically in the
 * coverage-map tooltip and the table view so temperament reads the same
 * way everywhere it appears.
 */
function renderTemperamentGauge(score) {
  const pct = clamp(score, 0, 100);
  const phrase = temperamentPhrase(score);
  return `
    <div class="temperament-gauge" role="img" aria-label="Temperament: ${escapeHtml(phrase)} (${Math.round(
    score
  )} of 100)">
      <div class="temperament-gauge-track">
        <span class="temperament-gauge-divider" style="left: 33.33%"></span>
        <span class="temperament-gauge-divider" style="left: 66.67%"></span>
        <span class="temperament-gauge-dot" style="left: ${pct.toFixed(1)}%"></span>
      </div>
      <div class="temperament-gauge-caption">
        <span class="temperament-gauge-phrase">${escapeHtml(phrase)}</span>
        <span class="temperament-gauge-value">(${Math.round(score)})</span>
      </div>
    </div>
  `;
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

/* ------------------------------------------------------------------ *
 *  Results rendering — dashboard: a TL;DR summary, a coverage map,
 *  status-coded condition cards, and the plain-language bullets tucked
 *  into a collapsible detail section.
 * ------------------------------------------------------------------ */

function onFindGaps() {
  if (quiver.length === 0) return;
  // A fresh run: any previous "what if I added this" comparison no
  // longer applies once the quiver/gaps it was being compared against
  // have changed underneath it.
  candidateSkis = [];
  renderResults();
}

/** Re-renders the results panel from the current quiver + candidateSkis
 * state, without resetting either - used both by the "Find gaps" button
 * (via onFindGaps, which resets candidateSkis first) and by the
 * candidate-picker's add/remove actions (which shouldn't reset it). */
function renderResults() {
  const grid = buildGrid(quiver);
  renderDashboard(grid, quiver);
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
 * For a gap bucket, rank every ski in the full catalog (not just the
 * quiver) by fit: its coverage region must overlap the bucket, and
 * "best fit" means closest to the bucket's center, not just marginal
 * overlap. Waist (mm) and temperament (0-100 points) are normalized by
 * their axis span before computing distance so neither axis dominates
 * just because of its raw units. Skis already in the quiver are
 * excluded explicitly as a safeguard, though a gap bucket having zero
 * quiver coverage already makes this redundant in practice.
 */
/**
 * How well a ski fits a bucket: null if its coverage region doesn't
 * overlap the bucket at all, otherwise the normalized distance from the
 * ski's own position to the bucket's center (waist and temperament are
 * each divided by their axis span first, so neither dominates just
 * because of its raw units). Shared by both the per-bucket suggestion
 * list (bullets/tooltips) and the map's cross-bucket ranking below.
 */
function bucketFitDistance(ski, waistBucket, stabBucket, interestKey = null) {
  const region = coverageRegion(ski);
  const overlaps =
    rectsOverlap({ xMin: region.xMin, xMax: region.xMax }, waistBucket) &&
    rectsOverlap({ xMin: region.yMin, xMax: region.yMax }, stabBucket);
  if (!overlaps) return null;

  const dx = (ski.waist_width_mm - bucketCenter(waistBucket)) / (WAIST_MAX - WAIST_MIN);
  const dy = (region.stab - bucketCenter(stabBucket)) / (STAB_MAX - STAB_MIN);
  let distance = Math.sqrt(dx * dx + dy * dy);

  // Tiebreak only, not a filter (see INTERESTS above) - only reachable
  // once a ski has already passed the overlap check, so this can never
  // pull a non-fitting ski into the running, only reorder among ones
  // that already qualify.
  if (interestKey) {
    distance -= interestAffinity(ski, interestKey) * INTEREST_BIAS_WEIGHT;
  }

  return distance;
}

function suggestSkisForBucket(waistBucket, stabBucket, quiverNames, limit = 2, interestKey = null) {
  return allSkis
    .filter((ski) => !quiverNames.has(ski.name))
    .map((ski) => ({ ski, distance: bucketFitDistance(ski, waistBucket, stabBucket, interestKey) }))
    .filter((c) => c.distance !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((c) => c.ski);
}

/** Plain-language phrasing for a bucket's suggestions, or the honest
 * fallback when the current catalog doesn't have a good fit yet. */
function suggestionPhrase(suggestions) {
  if (suggestions.length === 0) {
    return "Nothing in the current catalog centers on this zone yet.";
  }
  return `Consider: ${suggestions.map((s) => escapeHtml(s.name)).join(", ")}.`;
}

/**
 * Every gap bucket has its own top-2 suggestions (see
 * suggestSkisForBucket); this flattens and deduplicates across all gaps
 * for the suggestions map, since one ski can straddle more than one
 * gap bucket and should only appear once.
 */
/**
 * Cross-bucket ranking for the suggestions map, distinct from
 * suggestSkisForBucket's per-bucket top-2: a sparse quiver can have 7-8
 * gaps, and picking independently for each one produces up to 16
 * overlapping markers on a single small plot. Instead, rank every
 * candidate ski by how many *different* gaps it would fill (a ski that
 * straddles two gap buckets is a better single addition than two skis
 * that only fill one each), tie-broken by best fit, and cap the total -
 * fewer, more valuable markers rather than an exhaustive list.
 */
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
function selectTopSuggestionsForMap(gaps, quiverNames, interestKey = null) {
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

    for (const ski of allSkis) {
      if (quiverNames.has(ski.name) || used.has(ski.name)) continue;

      const covers = new Set();
      let totalDistance = 0;
      for (const cell of remaining) {
        const distance = bucketFitDistance(ski, cell.waistBucket, cell.stabBucket, interestKey);
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

function renderDashboard(grid, skis) {
  const gaps = grid.filter((c) => c.skis.length === 0);
  const redundant = grid.filter((c) => c.skis.length >= REDUNDANCY_THRESHOLD);
  const quiverNames = new Set(skis.map((s) => s.name));

  // Computed up front (not just when the map needs it) so the TL;DR
  // summary's "add this ski" line always names the same pick the map
  // shows below - one gap-filling computation, reused everywhere it's
  // mentioned. Always the algorithm's pick, regardless of whether the
  // user is currently comparing something else on the map (see below) -
  // the summary answers "what does the data recommend," the map's
  // candidate picker answers "let me check something specific."
  let gapSuggestions = [];
  let suggestionResult = null;
  if (gaps.length > 0) {
    suggestionResult = selectTopSuggestionsForMap(gaps, quiverNames, selectedInterest);
    gapSuggestions = suggestionResult.suggestions;
  }

  // The coverage map is the app's most-used visual (tester feedback), so
  // it now doubles as the answer to "what should I add": quiver (blue)
  // plus either the algorithm's own top pick(s) or a user-picked "what
  // if I added this" comparison (red), on the same chart - instead of a
  // plain map first and a separate, near-duplicate "suggestions" chart
  // further down. A user comparison always overrides the auto-suggestion
  // display when present; both read from the same rendering path.
  const usingCandidates = candidateSkis.length > 0;
  const comparisonSkis = usingCandidates ? candidateSkis : gapSuggestions;

  // Coverage details: was a 3-tile KPI row (Coverage / Coverage gaps /
  // Redundant zones) here, replaced with the TL;DR summary paragraph below.
  const sections = [
    renderQuiverSummarySection(grid, gaps, redundant, gapSuggestions),
    renderCoverageMapSection(skis, comparisonSkis, usingCandidates, suggestionResult),
    renderConditionCardsSection(grid, skis),
  ];

  sections.push(renderDetailsSection(gaps, redundant, quiverNames, selectedInterest));

  resultsEl.innerHTML = sections.join("\n");

  wireCoverageMap(skis, comparisonSkis);
}

/* ---- Coverage map (SVG scatter + region plot) ---------------------- */

// Same breakpoint the condition cards collapse to a single column at
// (see style.css) - kept consistent rather than inventing a second one.
const MAP_COMPACT_BREAKPOINT_PX = 480;

/**
 * Two complete geometry profiles, not one shrunk to fit. A phone-width
 * container (~240-260px after panel padding) rendering the same 640x380
 * canvas as desktop scales everything - including text - down to ~35-40%
 * of size, well below legible (verified: ~5px rendered text height).
 * Fitting the *content* into a genuinely narrower, taller canvas keeps
 * text/marks close to their designed physical size instead. Chosen over
 * a fixed-min-width + horizontal-scroll fix so the whole chart stays
 * visible without a scroll gesture.
 *
 * Read once per render call (not on a live resize listener) - like the
 * rest of the results panel, this reflects the viewport at the moment
 * "Find gaps" was clicked, not a continuously-responsive layout.
 */
function getMapGeometry() {
  const compact = window.innerWidth <= MAP_COMPACT_BREAKPOINT_PX;
  const W = compact ? 240 : 640;
  const H = compact ? 320 : 380;
  const MARGIN = compact ? { top: 10, right: 8, bottom: 22, left: 8 } : { top: 16, right: 16, bottom: 30, left: 16 };
  return {
    compact,
    W,
    H,
    MARGIN,
    plotW: W - MARGIN.left - MARGIN.right,
    plotH: H - MARGIN.top - MARGIN.bottom,
  };
}

function mapX(waist, geo) {
  return geo.MARGIN.left + ((waist - WAIST_MIN) / (WAIST_MAX - WAIST_MIN)) * geo.plotW;
}

function mapY(stab, geo) {
  // Inverted: higher stability score plots nearer the top.
  return geo.MARGIN.top + ((STAB_MAX - stab) / (STAB_MAX - STAB_MIN)) * geo.plotH;
}

function skiAriaLabel(ski) {
  const stab = stabilityScore(ski);
  const specs = effectiveSpecs(ski);
  const yearPart = ski.model_year ? `${ski.model_year} model, ` : "";
  return `${ski.name}: ${yearPart}${specs.length_cm}cm, ${ski.waist_width_mm}mm waist, ${
    specs.weight_g
  } grams, ${metalLabel(ski.metal_content)} metal, temperament: ${temperamentPhrase(stab)} (${Math.round(
    stab
  )} of 100)`;
}

/**
 * On-map label text only: drops the brand prefix ("Nordica Enforcer 94"
 * -> "Enforcer 94") to shrink the label's footprint in the coverage
 * map's fixed plot area, especially on the compact mobile geometry.
 * The full name is still used everywhere else - tooltip, aria-label,
 * table view - this is purely about what's drawn next to the dot.
 */
function shortSkiLabel(ski) {
  if (ski.brand && ski.name.startsWith(ski.brand + " ")) {
    return ski.name.slice(ski.brand.length + 1);
  }
  return ski.name;
}

/**
 * The shared, static part of any coverage-space SVG: plot border,
 * bucket-boundary gridlines, and axis zone labels. Identical across the
 * primary coverage map and the suggestions map so both read the same way.
 */
function renderMapChrome(geo) {
  const plotLeft = geo.MARGIN.left;
  const plotRight = geo.MARGIN.left + geo.plotW;
  const plotTop = geo.MARGIN.top;
  const plotBottom = geo.MARGIN.top + geo.plotH;

  const vx1 = mapX(89.5, geo);
  const vx2 = mapX(109.5, geo);
  const hy1 = mapY(33.33, geo);
  const hy2 = mapY(66.67, geo);

  let svg = `<rect x="${plotLeft}" y="${plotTop}" width="${geo.plotW}" height="${geo.plotH}" class="map-plot-border" />`;
  svg += `<line x1="${vx1}" y1="${plotTop}" x2="${vx1}" y2="${plotBottom}" class="map-gridline" />`;
  svg += `<line x1="${vx2}" y1="${plotTop}" x2="${vx2}" y2="${plotBottom}" class="map-gridline" />`;
  svg += `<line x1="${plotLeft}" y1="${hy1}" x2="${plotRight}" y2="${hy1}" class="map-gridline" />`;
  svg += `<line x1="${plotLeft}" y1="${hy2}" x2="${plotRight}" y2="${hy2}" class="map-gridline" />`;

  // X-axis zone labels, centered under each waist bucket. Compact mode
  // reuses the same short labels already defined on WAIST_BUCKETS
  // (WAIST_BUCKETS[].short) rather than inventing new abbreviations.
  const xLabels = geo.compact ? WAIST_BUCKETS.map((b) => b.short) : ["Narrow", "All-mountain", "Wide / powder"];
  const xCenters = [(WAIST_MIN + 89) / 2, (90 + 109) / 2, (110 + WAIST_MAX) / 2];
  xLabels.forEach((label, i) => {
    const x = mapX(xCenters[i], geo);
    svg += `<text x="${x.toFixed(1)}" y="${geo.H - (geo.compact ? 7 : 10)}" text-anchor="middle" class="map-axis-label">${escapeHtml(
      label
    )}</text>`;
  });

  // Y-axis zone labels, top-left of each stability band (charging at
  // top). Deliberately says "Charging" here rather than "Damp" (still
  // used elsewhere, e.g. temperamentPhrase's "Leans damp/charging") -
  // "damp" reads as wet snow out of ski-jargon context, where
  // "charging" doesn't need that context to land.
  const yLabels = ["Charging", "Balanced", "Playful"];
  const bandTopY = [plotTop, hy2, hy1];
  yLabels.forEach((label, i) => {
    svg += `<text x="${(plotLeft + (geo.compact ? 6 : 8)).toFixed(1)}" y="${(bandTopY[i] + (geo.compact ? 13 : 16)).toFixed(
      1
    )}" text-anchor="start" class="map-axis-label map-axis-label-y">${escapeHtml(label)}</text>`;
  });

  return svg;
}

/**
 * One mark per entry: a translucent region (opacity stacks where marks
 * overlap - the redundancy signal on the primary map) plus a solid dot
 * at the exact spec position and a direct name label. `variant` selects
 * the color: "quiver" (default, blue - identical on both maps) or
 * "suggestion" (red - see .ski-mark--suggestion in style.css).
 *
 * Direct labels are shown only when they don't collide with one already
 * placed — a quiver with several similar skis clusters tightly, and a
 * pile of overlapping text is worse than a dot with a hover/focus
 * tooltip (every ski's full spec is also in the "View as table" twin
 * and the mark's aria-label, so nothing is gated behind the label).
 * Collision tracking is shared across every entry passed in one call,
 * so quiver and suggestion labels compete for space fairly on the
 * suggestions map.
 */
function renderSkiMarks(entries, geo) {
  const plotRight = geo.MARGIN.left + geo.plotW;
  const plotTop = geo.MARGIN.top;
  // Same proportions as the original fixed 90px/18px thresholds
  // (relative to the normal-geometry plot size), generalized so they
  // scale sensibly in compact geometry too.
  const rightEdgeZone = geo.plotW * 0.148;
  const topEdgeZone = geo.plotH * 0.054;

  const placedLabelBoxes = [];
  const CHAR_W = 5.6; // px, approx. at 11px font
  const LABEL_H = 13;
  const LABEL_PAD = 4; // extra buffer so near-misses don't render edge-to-edge

  let svg = "";

  entries.forEach(({ ski, index, variant = "quiver" }) => {
    const region = coverageRegion(ski);
    const rx1 = mapX(region.xMin, geo);
    const rx2 = mapX(region.xMax, geo);
    const ry1 = mapY(region.yMax, geo);
    const ry2 = mapY(region.yMin, geo);
    const cx = mapX(ski.waist_width_mm, geo);
    const cy = mapY(region.stab, geo);

    const nearRight = cx > plotRight - rightEdgeZone;
    const nearTop = cy < plotTop + topEdgeZone;
    const labelX = nearRight ? cx - 9 : cx + 9;
    const labelY = nearTop ? cy + 18 : cy - 9;
    const anchor = nearRight ? "end" : "start";

    const shortLabel = shortSkiLabel(ski);
    const labelW = shortLabel.length * CHAR_W;
    const box = {
      left: (anchor === "end" ? labelX - labelW : labelX) - LABEL_PAD,
      right: (anchor === "end" ? labelX : labelX + labelW) + LABEL_PAD,
      top: labelY - LABEL_H - LABEL_PAD,
      bottom: labelY + LABEL_PAD,
    };
    const collides = placedLabelBoxes.some(
      (b) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top
    );

    let labelSvg = "";
    if (!collides) {
      placedLabelBoxes.push(box);
      labelSvg = `<text class="ski-mark-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(
        1
      )}" text-anchor="${anchor}">${escapeHtml(shortLabel)}</text>`;
    }

    const markClass = variant === "suggestion" ? "ski-mark ski-mark--suggestion" : "ski-mark";
    svg += `
      <g class="${markClass}" tabindex="0" role="img" data-ski-index="${index}" aria-label="${escapeHtml(
      skiAriaLabel(ski)
    )}">
        <rect class="ski-region" x="${rx1.toFixed(1)}" y="${ry1.toFixed(1)}" width="${(rx2 - rx1).toFixed(
      1
    )}" height="${(ry2 - ry1).toFixed(1)}" rx="8" />
        <circle class="ski-hit" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="15" />
        <circle class="ski-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" />
        ${labelSvg}
      </g>
    `;
  });

  return svg;
}

function renderCoverageMapSvg(skis) {
  const geo = getMapGeometry();
  const chrome = renderMapChrome(geo);
  const marks = renderSkiMarks(
    skis.map((ski, index) => ({ ski, index })),
    geo
  );
  return `<svg viewBox="0 0 ${geo.W} ${geo.H}" class="coverage-map" role="img" aria-label="Scatter map of your quiver's coverage by waist width and temperament">${chrome}${marks}</svg>`;
}

/** comparisonNames marks rows that belong to the map's red overlay
 * (auto-suggestion or user-picked candidate) with a small badge, since a
 * merged quiver+comparison table would otherwise read as one undifferentiated
 * list - see renderCoverageMapSection. */
function renderCoverageMapTable(skis, comparisonNames = new Set()) {
  const rows = skis
    .map((ski) => {
      const region = coverageRegion(ski);
      const wBucket =
        WAIST_BUCKETS.find((b) => ski.waist_width_mm >= b.min && ski.waist_width_mm <= b.max) ||
        WAIST_BUCKETS[WAIST_BUCKETS.length - 1];
      const sBucket = temperamentBucket(region.stab);
      const nameCell = comparisonNames.has(ski.name)
        ? `${escapeHtml(ski.name)} <span class="count-badge">comparing</span>`
        : escapeHtml(ski.name);
      return `<tr><td>${nameCell}</td><td>${escapeHtml(
        ski.model_year || "—"
      )}</td><td>${ski.waist_width_mm}</td><td>${escapeHtml(
        rockerProfileLabel(ski.rocker_profile)
      )} (${rockerPercent(ski)}%)</td><td>${renderTemperamentGauge(
        region.stab
      )}</td><td>${escapeHtml(wBucket.label)} + ${escapeHtml(sBucket.label)}</td></tr>`;
    })
    .join("");

  return `
    <div class="map-info-panel map-info-panel--table">${mapAxisLegendHtml()}</div>
    <table class="chart-table">
      <thead><tr><th>Ski</th><th>Year</th><th>Waist (mm)</th><th>Rocker</th><th>Temperament</th><th>Bucket</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSuggestionsMapSvg(quiverSkis, comparisonSkis) {
  const geo = getMapGeometry();
  const chrome = renderMapChrome(geo);
  const entries = [
    // Quiver: identical blue styling regardless of what's being compared.
    ...quiverSkis.map((ski, index) => ({ ski, index, variant: "quiver" })),
    // Comparison set: red, boxed too - whether it's the algorithm's
    // deliberately-chosen pick(s) (see selectTopSuggestionsForMap) or a
    // ski the user picked themselves, its coverage footprint is worth
    // showing, not just its position.
    ...comparisonSkis.map((ski, i) => ({ ski, index: quiverSkis.length + i, variant: "suggestion" })),
  ];
  const marks = renderSkiMarks(entries, geo);
  return `<svg viewBox="0 0 ${geo.W} ${geo.H}" class="coverage-map" role="img" aria-label="Your quiver's coverage, with a comparison ski shown for reference">${chrome}${marks}</svg>`;
}

/**
 * The single coverage-map section: always the plain quiver-only map,
 * except when there's something to compare it against, in which case
 * the same chart doubles as the answer to "what should I add" - quiver
 * (blue) plus either the algorithm's auto-suggestion(s) or a user-picked
 * candidate (red). comparisonSkis is empty for the plain case;
 * usingCandidates distinguishes "user picked this" from "the algorithm
 * picked this" for caption wording; suggestionResult (only present for
 * the auto-suggestion case) supplies the uncovered-gap count.
 */
/**
 * Plain-language explanation of what the two axes/buckets mean,
 * including their real ranges - built from WAIST_BUCKETS/STAB_BUCKETS
 * directly so it can never drift out of sync with the actual boundaries.
 * Shared by the on-demand info panel (see renderCoverageMapSection) and
 * the "View as table" caption (see renderCoverageMapTable) rather than
 * duplicated - on-chart labels stay uncluttered; this is for whoever
 * actually goes looking for the explanation.
 */
function mapAxisLegendHtml() {
  const widthParts = WAIST_BUCKETS.map((b) => `${escapeHtml(b.short)} ${b.min}–${b.max}mm`).join(" · ");
  const feelParts = STAB_BUCKETS.map(
    (b) => `${escapeHtml(b.short)} ${Math.round(b.min)}–${Math.round(b.max)}`
  ).join(" · ");
  return `
    <p><strong>Ski width:</strong> ${widthParts}</p>
    <p><strong>Ride feel</strong> (score out of 100): ${feelParts}</p>
  `;
}

function renderCoverageMapSection(skis, comparisonSkis, usingCandidates, suggestionResult) {
  const hasComparison = comparisonSkis.length > 0;

  let caption;
  if (usingCandidates) {
    caption = `Blue is your quiver. Red is what you're comparing — tap either for details.`;
  } else if (hasComparison) {
    const uncoveredCount = suggestionResult ? suggestionResult.uncoveredCount : 0;
    const uncoveredNote =
      uncoveredCount > 0
        ? ` ${uncoveredCount} gap${
            uncoveredCount === 1 ? "" : "s"
          } couldn't be matched to anything in the current catalog — the dataset likely needs to grow to cover ${
            uncoveredCount === 1 ? "it" : "them"
          }.`
        : "";
    const interestMeta = selectedInterest ? INTERESTS.find((i) => i.key === selectedInterest) : null;
    const interestNote = interestMeta ? ` Leaning toward ${escapeHtml(interestMeta.label)}.` : "";
    caption = `Blue is your quiver. Red (${comparisonSkis.length}) is the smallest set of
        catalog skis that covers your gaps with the least overlap.${uncoveredNote}${interestNote}`;
  } else {
    caption = `Each dot is a ski. The shaded box is the terrain/temperament range it covers —
        darker overlap means more coverage. Tap a dot for details.`;
  }

  const svg = hasComparison ? renderSuggestionsMapSvg(skis, comparisonSkis) : renderCoverageMapSvg(skis);
  const comparisonNames = new Set(comparisonSkis.map((s) => s.name));
  const table = renderCoverageMapTable([...skis, ...comparisonSkis], comparisonNames);

  return `
    <section class="panel dashboard-card">
      <div class="card-header">
        <h3>Coverage map
          <button type="button" class="info-btn" id="map-info-toggle" aria-pressed="false" aria-label="What do the axes mean?">ⓘ</button>
        </h3>
        <button type="button" class="table-toggle-btn" id="map-table-toggle" aria-pressed="false">View as table</button>
      </div>
      <p class="map-caption">${caption}</p>
      <div class="map-info-panel" id="map-info-panel" hidden>${mapAxisLegendHtml()}</div>
      <div class="chart-wrap" id="map-chart-wrap">${svg}</div>
      <div class="chart-table-wrap" id="map-table-wrap" hidden>${table}</div>
      ${renderCandidatePicker()}
    </section>
  `;
}

/** Search box for "what if I added this" - independent of the auto
 * -suggestion above, and available regardless of whether there's a gap
 * (someone might want to check a specific ski even at full coverage). */
function renderCandidatePicker() {
  const atMax = candidateSkis.length >= MAX_CANDIDATES;
  const chips = candidateSkis
    .map(
      (ski) => `
      <li class="quiver-chip">
        <span>${escapeHtml(ski.name)}</span>
        ${lengthPickerHtml(ski)}
        <button type="button" data-remove-candidate="${escapeHtml(
          ski.name
        )}" aria-label="Remove ${escapeHtml(ski.name)} from comparison">×</button>
      </li>
    `
    )
    .join("");

  return `
    <div class="candidate-picker">
      <h4>Comparing something specific?</h4>
      <p class="map-caption">
        Search any ski to see exactly where it'd land on your map${
          candidateSkis.length > 0 ? " — replaces the suggested pick above" : ""
        }.
      </p>
      <div class="search-wrap">
        <label for="candidate-search" class="visually-hidden">Search a ski to compare</label>
        <input
          type="text"
          id="candidate-search"
          class="search-input"
          placeholder="${atMax ? `Remove one to compare another (max ${MAX_CANDIDATES})` : "Search skis by name…"}"
          autocomplete="off"
          ${atMax ? "disabled" : ""}
        />
        <ul id="candidate-search-results" class="search-results" role="listbox" hidden></ul>
      </div>
      ${chips ? `<ul class="quiver-list">${chips}</ul>` : ""}
    </div>
  `;
}

function skiTooltipHtml(ski) {
  const title = document.createElement("div");
  title.className = "tooltip-title";
  title.textContent = ski.name;

  // Specs (weight, radius, etc.) drift year to year — sourced model_year
  // is shown so a tester can spot-check it against the exact ski they
  // own and flag a mismatch, without the app having to support picking
  // a specific year (see data/SOURCING.md). Length is shown alongside it
  // now too - weight/turn radius/temperament below are all *for this
  // length* (see effectiveSpecs), so it's worth being explicit about
  // which one is being described, especially once a length picker makes
  // it possible to change.
  const specs = effectiveSpecs(ski);
  const year = document.createElement("div");
  year.className = "tooltip-year";
  year.textContent = ski.model_year
    ? `${ski.model_year} model · ${specs.length_cm}cm`
    : `Model year unknown · ${specs.length_cm}cm`;

  // One fact per row, in a label/value grid — not run-on text joined by
  // "·" separators, which gets ragged the moment a value is long enough
  // to wrap inside the tooltip's narrow width.
  const specGrid = document.createElement("div");
  specGrid.className = "tooltip-spec-grid";
  specGrid.append(
    specRow("Waist", `${ski.waist_width_mm}mm`),
    specRow("Weight", `${specs.weight_g}g`),
    specRow("Turn radius", specs.turn_radius_m ? `${specs.turn_radius_m}m` : "—"),
    specRow("Metal", metalContentLabel(ski.metal_content)),
    specRow("Rocker", `${rockerProfileLabel(ski.rocker_profile)} (${rockerPercent(ski)}%)`)
  );

  // renderTemperamentGauge() only ever embeds a fixed phrase + a number,
  // both already escaped inside it - safe to insert as HTML.
  const gauge = document.createElement("div");
  gauge.className = "tooltip-gauge-wrap";
  gauge.innerHTML = renderTemperamentGauge(stabilityScore(ski));

  const wrap = document.createElement("div");
  wrap.append(title, year, specGrid, gauge);
  return wrap;
}

/** One label/value row for a tooltip spec grid (see .tooltip-spec-grid). */
function specRow(label, value) {
  const row = document.createElement("div");
  row.className = "tooltip-spec-row";

  const labelEl = document.createElement("span");
  labelEl.className = "tooltip-spec-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "tooltip-spec-value";
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  return row;
}

function metalContentLabel(metal) {
  if (metal === "none") return "None";
  if (metal === "partial") return "Partial";
  return "Full";
}

function rockerProfileLabel(profile) {
  const labels = {
    full_camber: "Full camber",
    camber_tip_rocker: "Camber + tip",
    camber_tip_tail_rocker: "Camber + tip/tail",
    flat_tip_tail_rocker: "Flat + tip/tail",
    full_rocker: "Full rocker",
  };
  return labels[profile] || "Unknown profile";
}

function wireCoverageMap(skis, comparisonSkis = []) {
  const combined = [...skis, ...comparisonSkis];
  const chartWrap = document.getElementById("map-chart-wrap");
  const tableWrap = document.getElementById("map-table-wrap");
  const toggleBtn = document.getElementById("map-table-toggle");

  toggleBtn.addEventListener("click", () => {
    const showTable = tableWrap.hidden;
    tableWrap.hidden = !showTable;
    chartWrap.hidden = showTable;
    toggleBtn.setAttribute("aria-pressed", String(showTable));
    toggleBtn.textContent = showTable ? "View as chart" : "View as table";
  });

  const infoBtn = document.getElementById("map-info-toggle");
  const infoPanel = document.getElementById("map-info-panel");
  infoBtn.addEventListener("click", () => {
    const showing = infoPanel.hidden;
    infoPanel.hidden = !showing;
    infoBtn.setAttribute("aria-pressed", String(showing));
  });

  chartWrap.querySelectorAll(".ski-mark").forEach((mark) => {
    const ski = combined[Number(mark.dataset.skiIndex)];
    const show = () => showTooltip(mark, skiTooltipHtml(ski));
    mark.addEventListener("pointerenter", show);
    mark.addEventListener("focus", show);
    mark.addEventListener("pointerleave", hideTooltip);
    mark.addEventListener("blur", hideTooltip);
  });

  const candidateSearchInput = document.getElementById("candidate-search");
  if (candidateSearchInput) {
    candidateSearchInput.addEventListener("input", onCandidateSearchInput);
    candidateSearchInput.addEventListener("focus", onCandidateSearchInput);
  }

  document.querySelectorAll("[data-remove-candidate]").forEach((btn) => {
    btn.addEventListener("click", () => removeCandidate(btn.dataset.removeCandidate));
  });

  document.querySelectorAll(".candidate-picker .length-picker").forEach((picker) => {
    const candidate = candidateSkis.find((s) => s.name === picker.dataset.lengthFor);
    if (!candidate) return;
    picker.addEventListener("change", () => {
      candidate.selected_length_cm = Number(picker.value);
      renderResults();
    });
  });
}

function onCandidateSearchInput() {
  const searchEl = document.getElementById("candidate-search");
  const candidateResultsEl = document.getElementById("candidate-search-results");
  if (!searchEl || !candidateResultsEl) return;

  const query = searchEl.value.trim().toLowerCase();
  const excludedNames = new Set([...quiver.map((s) => s.name), ...candidateSkis.map((s) => s.name)]);
  const matches = allSkis.filter((s) => s.name.toLowerCase().includes(query) && !excludedNames.has(s.name)).slice(0, 8);

  candidateResultsEl.innerHTML = "";

  if (matches.length === 0) {
    candidateResultsEl.innerHTML = `<li class="no-match">No skis match "${escapeHtml(searchEl.value)}"</li>`;
    candidateResultsEl.hidden = false;
    return;
  }

  for (const ski of matches) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.innerHTML = `
      <span>${escapeHtml(ski.name)}</span>
      <span class="ski-spec">${ski.waist_width_mm}mm</span>
    `;
    li.addEventListener("click", () => {
      addCandidate(ski);
    });
    candidateResultsEl.appendChild(li);
  }

  candidateResultsEl.hidden = false;
}

function addCandidate(ski) {
  if (candidateSkis.length >= MAX_CANDIDATES) return;
  if (candidateSkis.some((s) => s.name === ski.name)) return;
  // Shallow copy, same reasoning as addToQuiver - its own
  // selected_length_cm, independent of any other copy of this ski.
  candidateSkis.push({ ...ski, selected_length_cm: ski.reference_length_cm });
  renderResults();
}

function removeCandidate(name) {
  candidateSkis = candidateSkis.filter((s) => s.name !== name);
  renderResults();
}

/* ---- Condition cards (prototype replacement for the coverage grid) - */

/**
 * Collapsed from the original 9 waist x temperament cells down to just
 * the 3 width bands - the temperament-level split ("quick, playful
 * groomer days" vs "all-day groomer cruising with a bit of pop" vs
 * "high-speed carving on firm, hard snow") read as near-duplicates at a
 * glance, and 9 cards was too many for a quick-glance read. These 3 map
 * onto vocabulary skiers already use for "what kind of day is this."
 */
const CONDITION_GROUPS = [
  { waistKey: "narrow", title: "Groomers" },
  { waistKey: "allmtn", title: "All-Mountain" },
  { waistKey: "wide", title: "Powder" },
];

/**
 * The Park card, unlike the 3 above, isn't derived from the grid at all
 * - tail_shape is orthogonal to waist/temperament (see data/SOURCING.md),
 * so this reads the quiver's raw ski list directly instead of a bucket.
 * 3 states instead of the other cards' plain yes/no, because tail_shape
 * itself is 3-valued: a `modified_twin` genuinely has some switch
 * capability without being a park ski, and collapsing that into a
 * binary would misrepresent it either way (see the tail_shape research
 * pass - 40% of the dataset is `modified_twin`, only 4% is a true
 * `twin_tip`, so "any non-directional ski counts" would call nearly
 * half the dataset "park-covered," which overstates it just as much as
 * requiring a true twin_tip would understate it for a partial ski).
 */
function renderParkCard(quiverSkis) {
  const twinTips = quiverSkis.filter((s) => s.tail_shape === "twin_tip");
  const modifiedTwins = quiverSkis.filter((s) => s.tail_shape === "modified_twin");

  let status, detail;
  if (twinTips.length > 0) {
    status = "good";
    detail = `Covered by ${escapeHtml(twinTips.map((s) => s.name).join(", "))}`;
  } else if (modifiedTwins.length > 0) {
    status = "warning";
    detail = `Partial — ${escapeHtml(
      modifiedTwins.map((s) => s.name).join(", ")
    )} can handle some switch riding, but nothing built specifically for park.`;
  } else {
    status = "critical";
    detail = `Nothing in your quiver yet.`;
  }

  const meta = statusMeta(status);
  return `
    <div class="condition-card" data-status="${status}">
      <span class="condition-icon" aria-hidden="true">${meta.icon}</span>
      <div class="condition-body">
        <p class="condition-desc">Park</p>
        <p class="condition-detail">${detail}</p>
      </div>
    </div>
  `;
}

/**
 * Framed the way a skier actually thinks about it - "what do I grab
 * today" - instead of an abstract axis grid. Deliberately just a yes/no
 * per condition (Park excepted - see renderParkCard), no recommendations
 * on the card itself - the Suggested additions section already covers
 * "what should I add," and mixing that in here made the quick-glance
 * read too busy.
 */
function renderConditionCardsSection(grid, quiverSkis) {
  const cards = CONDITION_GROUPS.map((group) => {
    const cells = grid.filter((c) => c.waistBucket.key === group.waistKey);
    const skiNames = [...new Set(cells.flatMap((c) => c.skis.map((s) => s.name)))];
    const status = skiNames.length > 0 ? "good" : "critical";
    const meta = statusMeta(status);
    const detail = skiNames.length > 0 ? `Covered by ${escapeHtml(skiNames.join(", "))}` : `Nothing in your quiver yet.`;

    return `
      <div class="condition-card" data-status="${status}">
        <span class="condition-icon" aria-hidden="true">${meta.icon}</span>
        <div class="condition-body">
          <p class="condition-desc">${escapeHtml(group.title)}</p>
          <p class="condition-detail">${detail}</p>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="panel dashboard-card">
      <h3>What's your quiver built for?</h3>
      <p class="map-caption">The most common ski days, and which of your skis (if any) covers each.</p>
      <div class="condition-cards">${cards}${renderParkCard(quiverSkis)}</div>
    </section>
  `;
}

/* ---- Quiver summary (plain-language TL;DR paragraph) --------------- */

/**
 * The 3x3 grid sliced into "bands": 3 rows (fixed temperament, varying
 * width) and 3 columns (fixed width, varying temperament). A band that's
 * fully covered or fully empty describes as one clean span ("nothing
 * playful, at any width") instead of listing three buckets one by one -
 * used by both the strength and weakness halves of the summary below.
 */
function gridBands(grid) {
  const rows = STAB_BUCKETS.map((stabBucket) => ({
    axis: "stab",
    bucket: stabBucket,
    cells: WAIST_BUCKETS.map((wb) => grid.find((c) => c.stabBucket.key === stabBucket.key && c.waistBucket.key === wb.key)),
  }));
  const columns = WAIST_BUCKETS.map((waistBucket) => ({
    axis: "waist",
    bucket: waistBucket,
    cells: STAB_BUCKETS.map((sb) => grid.find((c) => c.waistBucket.key === waistBucket.key && c.stabBucket.key === sb.key)),
  }));
  return [...rows, ...columns];
}

function bandTotalSkis(band) {
  return band.cells.reduce((sum, c) => sum + c.skis.length, 0);
}

/** Picks the fully-covered band (every cell has >=1 ski) with the most total skis. */
function bestCoveredBand(grid) {
  const candidates = gridBands(grid).filter((band) => band.cells.every((c) => c.skis.length > 0));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => bandTotalSkis(b) - bandTotalSkis(a))[0];
}

/** Picks the fully-empty band (every cell has 0 skis), preferring the widest gap. */
function worstEmptyBand(grid) {
  const candidates = gridBands(grid).filter((band) => band.cells.every((c) => c.skis.length === 0));
  if (candidates.length === 0) return null;
  return candidates[0];
}

/** "everything from <first cell's description> to <last cell's description>" */
function describeCoveredBand(band) {
  const first = escapeHtml(bucketDescription(band.cells[0]));
  const last = escapeHtml(bucketDescription(band.cells[band.cells.length - 1]));
  return `everything from ${first} to ${last}`;
}

/** e.g. "nothing playful / light, at any width" or "nothing at all in wide / powder terrain" */
function describeEmptyBand(band) {
  const label = escapeHtml(band.bucket.label);
  if (band.axis === "stab") {
    return `nothing ${label}, at any width`;
  }
  return `nothing at all in ${label} terrain`;
}

function strengthSentence(grid) {
  const band = bestCoveredBand(grid);
  if (band) {
    return `Your quiver covers ${describeCoveredBand(band)}.`;
  }
  // No fully-covered row or column - fall back to the single deepest cell.
  const best = [...grid].sort((a, b) => b.skis.length - a.skis.length)[0];
  if (!best || best.skis.length === 0) return null;
  return `Your quiver is built for ${escapeHtml(bucketDescription(best))}.`;
}

function weaknessSentence(grid, gaps) {
  if (gaps.length === 0) return null;
  const band = worstEmptyBand(grid);
  if (band) {
    return `There's ${describeEmptyBand(band)}.`;
  }
  // Gaps are scattered rather than a clean band - name up to 2.
  const named = gaps.slice(0, 2).map((cell) => escapeHtml(bucketDescription(cell)));
  const phrase = named.length === 2 ? `${named[0]} or ${named[1]}` : named[0];
  const more = gaps.length > named.length ? `, among a few other gaps` : "";
  return `You're not covered for ${phrase}${more}.`;
}

function actionSentence(gapSuggestions) {
  if (!gapSuggestions || gapSuggestions.length === 0) return null;
  return `If you're adding one ski, the <strong>${escapeHtml(gapSuggestions[0].name)}</strong> would close the most ground.`;
}

function renderQuiverSummarySection(grid, gaps, redundant, gapSuggestions) {
  const sentences = [strengthSentence(grid)];

  if (gaps.length === 0) {
    sentences.push(
      redundant.length > 0
        ? `There are no real gaps, though a few skis overlap in coverage — worth a look if you're trying to trim down, not fill in.`
        : `There are no real gaps — every terrain and temperament combination has at least one ski built for it.`
    );
  } else {
    sentences.push(weaknessSentence(grid, gaps));
    sentences.push(actionSentence(gapSuggestions));
  }

  const text = sentences.filter(Boolean).join(" ");

  return `
    <section class="panel dashboard-card quiver-summary">
      <p class="quiver-summary-text">${text}</p>
    </section>
  `;
}

/* ---- Collapsible plain-language detail ------------------------------ */

function renderDetailsSection(gaps, redundant, quiverNames, interestKey = null) {
  const gapItems =
    gaps.length === 0
      ? `<li class="result-item ok"><span class="status-icon status-good" aria-hidden="true">✓</span><span>No gaps — every bucket has at least one ski covering it.</span></li>`
      : gaps
          .map((cell) => {
            const suggestions = suggestSkisForBucket(cell.waistBucket, cell.stabBucket, quiverNames, 2, interestKey);
            return `<li class="result-item gap"><span class="status-icon status-critical" aria-hidden="true">✕</span><span>No coverage for <strong>${escapeHtml(
              bucketLabel(cell)
            )}</strong> — nothing built for ${escapeHtml(bucketDescription(cell))}. <span class="result-suggestion">${suggestionPhrase(
              suggestions
            )}</span></span></li>`;
          })
          .join("");

  const redItems =
    redundant.length === 0
      ? `<li class="result-item ok"><span class="status-icon status-good" aria-hidden="true">✓</span><span>No buckets have ${REDUNDANCY_THRESHOLD}+ overlapping skis — your quiver looks efficiently spread out.</span></li>`
      : redundant
          .map((cell) => {
            const names = cell.skis.map((s) => s.name).join(", ");
            return `<li class="result-item redundancy"><span class="status-icon status-warning" aria-hidden="true">▲</span><span><strong>${cell.skis.length} skis</strong> overlap in <strong>${escapeHtml(
              bucketLabel(cell)
            )}</strong> — you may have redundant width/temperament here (${escapeHtml(names)}).</span></li>`;
          })
          .join("");

  return `
    <details class="result-details">
      <summary>Plain-language details</summary>
      <div class="result-group">
        <h4>Coverage gaps</h4>
        <ul class="result-list">${gapItems}</ul>
      </div>
      <div class="result-group">
        <h4>Redundancy</h4>
        <ul class="result-list">${redItems}</ul>
      </div>
    </details>
  `;
}

/* ------------------------------------------------------------------ *
 *  Shared chart tooltip
 * ------------------------------------------------------------------ */

// The tooltip is positioned once, in viewport pixels, when it opens
// (see positionTooltip) rather than tracked continuously, so once its
// anchor mark has visually moved from where it was when the tooltip
// opened, the box is no longer over the dot it describes. Close it once
// that movement passes a small, fixed, position-independent threshold -
// tracking the anchor's own getBoundingClientRect() rather than
// intersection-with-viewport handles page scroll and the chart's own
// horizontal-scroll container the same way, with one comparison.
//
// Two other approaches were tried and rejected first:
// - A plain always-on "scroll" listener closed on ANY scroll, including
//   a few px of incidental scroll a mobile browser can produce by
//   auto-scrolling a newly-focused element into view on tap - a false
//   positive.
// - Closing only once the anchor's intersection with the viewport
//   dropped below a threshold (even a generous 50%) turned out to still
//   require nearly as much scrolling as waiting for it to disappear
//   entirely, for any anchor that started mid-screen - intersection
//   can't change at all until the viewport edge reaches the anchor, so
//   the threshold barely mattered; most of the "large scroll" feeling
//   came from the anchor's distance from the edge, not the threshold.
//
// Measuring the anchor's own movement fixes both: incidental nudges are
// a few px, comfortably under the threshold, while closing no longer
// depends on where the anchor happened to be on screen.
const TOOLTIP_MOVE_CLOSE_PX = 60;
let tooltipAnchorEl = null;
let tooltipAnchorRect = null;

// Root-caused via a real device's ?debug=1 event log (see git history):
// a single tap on iOS genuinely opens, closes, and reopens the tooltip,
// not a rendering glitch. Touch has no real "hover," so pointerleave
// fires the moment the finger lifts (hideTooltip), closing it - then
// ~30-40ms later, iOS's synthesized compatibility mouse sequence for
// the same tap fires a mousedown that shifts focus onto the mark
// (focus -> showTooltip), reopening it. Both transitions are real and
// intentional on their own (pointerleave/blur genuinely should close
// it; focus genuinely should open it) - the bug is only that they
// happen back-to-back inside one physical tap, closing and reopening
// fast enough to read as a flash.
//
// Fix: don't act on hideTooltip() immediately - wait a beat, and
// cancel the pending hide if a showTooltip() (for anything) follows
// before it fires. The close-then-reopen still happens internally
// exactly as before; tooltipEl.hidden just never actually flips to
// true in between, so there's nothing to see. 100ms is comfortably
// longer than the ~30-40ms gap measured in the real device log.
const TOOLTIP_HIDE_DELAY_MS = 100;
let tooltipHideTimer = null;

function showTooltip(targetEl, contentNode) {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
  tooltipEl.innerHTML = "";
  tooltipEl.appendChild(contentNode);
  tooltipEl.hidden = false;
  positionTooltip(targetEl);
  tooltipAnchorEl = targetEl;
  tooltipAnchorRect = targetEl.getBoundingClientRect();
}

/** Wired once, on window, capture phase (see init()) - catches page
 * scroll and the chart's own horizontal-scroll container alike, since
 * "scroll" doesn't bubble but capture-phase listeners still see it. */
function checkTooltipAnchorMoved() {
  if (tooltipEl.hidden || !tooltipAnchorEl) return;
  const current = tooltipAnchorEl.getBoundingClientRect();
  const dx = Math.abs(current.left - tooltipAnchorRect.left);
  const dy = Math.abs(current.top - tooltipAnchorRect.top);
  if (dx > TOOLTIP_MOVE_CLOSE_PX || dy > TOOLTIP_MOVE_CLOSE_PX) hideTooltip();
}

function positionTooltip(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  let left = rect.left + rect.width / 2 - tw / 2;
  let top = rect.top - th - 10;
  if (top < 8) top = rect.bottom + 10;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function hideTooltip() {
  // Only the FIRST call starts the countdown - repeat calls while one's
  // already pending (e.g. one per scroll tick during an active scroll
  // gesture) must not keep pushing it back, or it never gets a clear
  // 100ms to actually fire until scrolling stops entirely. Found via a
  // real device log: dy was already 296+ (way past the 60px close
  // threshold) on every one of several consecutive scroll ticks, each
  // resetting the timer instead of counting down. Only showTooltip()
  // should be able to cancel a pending hide now.
  if (tooltipHideTimer) {
    return;
  }
  tooltipHideTimer = setTimeout(() => {
    tooltipEl.hidden = true;
    tooltipAnchorEl = null;
    tooltipAnchorRect = null;
    tooltipHideTimer = null;
  }, TOOLTIP_HIDE_DELAY_MS);
}

/* ------------------------------------------------------------------ *
 *  Utils
 * ------------------------------------------------------------------ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
