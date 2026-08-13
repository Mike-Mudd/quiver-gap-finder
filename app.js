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
    }
  });

  findGapsBtn.addEventListener("click", onFindGaps);
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
  quiver.push(ski);
  renderQuiver();
}

function removeFromQuiver(name) {
  quiver = quiver.filter((s) => s.name !== name);
  renderQuiver();
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
        <button type="button" aria-label="Remove ${escapeHtml(ski.name)}">✕</button>
      `;
      li.querySelector("button").addEventListener("click", () => removeFromQuiver(ski.name));
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
 * Derive a 0-100 "stability score" from weight, metal content, and
 * rocker. Heavier + more metal => higher base score => damper/more
 * charging-oriented. Rocker then independently pulls the score back
 * toward "playful," regardless of weight/metal — a heavy, full-metal,
 * heavily-rockered powder ski still skis loose, not damp; a full-camber
 * ski gets no pull at all.
 */
function stabilityScore(ski) {
  const weightNorm = clamp((ski.weight_g - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN), 0, 1);
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

function suggestSkisForBucket(waistBucket, stabBucket, quiverNames, limit = 2) {
  return allSkis
    .filter((ski) => !quiverNames.has(ski.name))
    .map((ski) => ({ ski, distance: bucketFitDistance(ski, waistBucket, stabBucket) }))
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
function selectTopSuggestionsForMap(gaps, quiverNames) {
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

function renderDashboard(grid, skis) {
  const gaps = grid.filter((c) => c.skis.length === 0);
  const redundant = grid.filter((c) => c.skis.length >= REDUNDANCY_THRESHOLD);
  const quiverNames = new Set(skis.map((s) => s.name));

  // Computed up front (not just when the suggestions map renders) so the
  // TL;DR summary's "add this ski" line always names the same pick the
  // suggestions map and its table show below - one gap-filling computation,
  // reused everywhere it's mentioned.
  let gapSuggestions = [];
  let suggestionResult = null;
  if (gaps.length > 0) {
    suggestionResult = selectTopSuggestionsForMap(gaps, quiverNames);
    gapSuggestions = suggestionResult.suggestions;
  }

  // Coverage details: was a 3-tile KPI row (Coverage / Coverage gaps /
  // Redundant zones) here, replaced with the TL;DR summary paragraph below.
  const sections = [
    renderQuiverSummarySection(grid, gaps, redundant, gapSuggestions),
    renderCoverageMapSection(skis),
    renderConditionCardsSection(grid, skis),
  ];

  // Only rendered when there's actually a gap to suggest something for -
  // no empty "Suggested additions" card when the quiver's already full
  // coverage.
  if (gaps.length > 0) {
    sections.push(
      renderSuggestionsMapSection(skis, gapSuggestions, suggestionResult.uncoveredCount, suggestionResult.coverageBySkiName)
    );
  }

  sections.push(renderDetailsSection(gaps, redundant, quiverNames));

  resultsEl.innerHTML = sections.join("\n");

  wireCoverageMap(skis);
  if (gaps.length > 0) {
    wireSuggestionsMap(skis, gapSuggestions);
  }
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
  const yearPart = ski.model_year ? `${ski.model_year} model, ` : "";
  return `${ski.name}: ${yearPart}${ski.waist_width_mm}mm waist, ${ski.weight_g} grams, ${metalLabel(
    ski.metal_content
  )} metal, temperament: ${temperamentPhrase(stab)} (${Math.round(stab)} of 100)`;
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

  // Y-axis zone labels, top-left of each stability band (damp at top).
  const yLabels = geo.compact ? ["Damp", "Balanced", "Playful"] : ["Damp / charging", "Balanced", "Playful / light"];
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

function renderCoverageMapTable(skis) {
  const rows = skis
    .map((ski) => {
      const region = coverageRegion(ski);
      const wBucket =
        WAIST_BUCKETS.find((b) => ski.waist_width_mm >= b.min && ski.waist_width_mm <= b.max) ||
        WAIST_BUCKETS[WAIST_BUCKETS.length - 1];
      const sBucket = temperamentBucket(region.stab);
      return `<tr><td>${escapeHtml(ski.name)}</td><td>${escapeHtml(
        ski.model_year || "—"
      )}</td><td>${ski.waist_width_mm}</td><td>${escapeHtml(
        rockerProfileLabel(ski.rocker_profile)
      )} (${rockerPercent(ski)}%)</td><td>${renderTemperamentGauge(
        region.stab
      )}</td><td>${escapeHtml(wBucket.label)} + ${escapeHtml(sBucket.label)}</td></tr>`;
    })
    .join("");

  return `
    <table class="chart-table">
      <thead><tr><th>Ski</th><th>Year</th><th>Waist (mm)</th><th>Rocker</th><th>Temperament</th><th>Bucket</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderCoverageMapSection(skis) {
  return `
    <section class="panel dashboard-card">
      <div class="card-header">
        <h3>Coverage map</h3>
        <button type="button" class="table-toggle-btn" id="map-table-toggle" aria-pressed="false">View as table</button>
      </div>
      <p class="map-caption">
        Each dot is a ski. The shaded box is the terrain/temperament range it covers —
        darker overlap means more coverage. Tap a dot for details.
      </p>
      <div class="chart-wrap" id="map-chart-wrap">${renderCoverageMapSvg(skis)}</div>
      <div class="chart-table-wrap" id="map-table-wrap" hidden>${renderCoverageMapTable(skis)}</div>
    </section>
  `;
}

/* ---- Suggestions map (same space, quiver muted + gap-fillers highlighted) */

function renderSuggestionsMapSvg(quiverSkis, suggestedSkis) {
  const geo = getMapGeometry();
  const chrome = renderMapChrome(geo);
  const entries = [
    // Quiver: identical blue styling to the primary map - same color on
    // both maps, full-strength, not de-emphasized.
    ...quiverSkis.map((ski, index) => ({ ski, index, variant: "quiver" })),
    // Suggestions: red, boxed too - each suggestion is a deliberately
    // chosen, high-value pick (see selectTopSuggestionsForMap), so its
    // coverage footprint is worth showing, not just its position.
    ...suggestedSkis.map((ski, i) => ({ ski, index: quiverSkis.length + i, variant: "suggestion" })),
  ];
  const marks = renderSkiMarks(entries, geo);
  return `<svg viewBox="0 0 ${geo.W} ${geo.H}" class="coverage-map" role="img" aria-label="Suggested skis that would fill your quiver's coverage gaps, shown against your current quiver for reference">${chrome}${marks}</svg>`;
}

function renderSuggestionsMapTable(suggestedSkis, coverageBySkiName) {
  const rows = suggestedSkis
    .map((ski) => {
      const region = coverageRegion(ski);
      // What it was actually picked for (may span >1 gap), not just its
      // own home bucket - see selectTopSuggestionsForMap.
      const filledCells = coverageBySkiName.get(ski.name) || [];
      const filledText = filledCells.map((cell) => bucketLabel(cell)).join("; ");
      return `<tr><td>${escapeHtml(ski.name)}</td><td>${ski.waist_width_mm}</td><td>${renderTemperamentGauge(
        region.stab
      )}</td><td>${escapeHtml(filledText)}</td></tr>`;
    })
    .join("");

  return `
    <table class="chart-table">
      <thead><tr><th>Ski</th><th>Waist (mm)</th><th>Temperament</th><th>Fills gap(s)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSuggestionsMapSection(quiverSkis, suggestedSkis, uncoveredCount, coverageBySkiName) {
  if (suggestedSkis.length === 0) {
    return `
      <section class="panel dashboard-card">
        <h3>Suggested additions</h3>
        <p class="map-caption">Nothing in the current catalog fills any of your gaps yet.</p>
      </section>
    `;
  }

  const uncoveredNote =
    uncoveredCount > 0
      ? ` ${uncoveredCount} gap${
          uncoveredCount === 1 ? "" : "s"
        } couldn't be matched to anything in the current catalog — the dataset likely needs to grow to cover ${
          uncoveredCount === 1 ? "it" : "them"
        }.`
      : "";

  return `
    <section class="panel dashboard-card">
      <div class="card-header">
        <h3>Suggested additions</h3>
        <button type="button" class="table-toggle-btn" id="suggestions-table-toggle" aria-pressed="false">View as table</button>
      </div>
      <p class="map-caption">
        Blue is your quiver, same as above. Red (${suggestedSkis.length}) is the smallest
        set of catalog skis that covers your gaps with the least overlap.${uncoveredNote}
      </p>
      <div class="chart-wrap" id="suggestions-chart-wrap">${renderSuggestionsMapSvg(quiverSkis, suggestedSkis)}</div>
      <div class="chart-table-wrap" id="suggestions-table-wrap" hidden>${renderSuggestionsMapTable(
        suggestedSkis,
        coverageBySkiName
      )}</div>
    </section>
  `;
}

function skiTooltipHtml(ski) {
  const title = document.createElement("div");
  title.className = "tooltip-title";
  title.textContent = ski.name;

  // Specs (weight, radius, etc.) drift year to year — sourced model_year
  // is shown so a tester can spot-check it against the exact ski they
  // own and flag a mismatch, without the app having to support picking
  // a specific year (see data/SOURCING.md).
  const year = document.createElement("div");
  year.className = "tooltip-year";
  year.textContent = ski.model_year ? `${ski.model_year} model` : "Model year unknown";

  // One fact per row, in a label/value grid — not run-on text joined by
  // "·" separators, which gets ragged the moment a value is long enough
  // to wrap inside the tooltip's narrow width.
  const specGrid = document.createElement("div");
  specGrid.className = "tooltip-spec-grid";
  specGrid.append(
    specRow("Waist", `${ski.waist_width_mm}mm`),
    specRow("Weight", `${ski.weight_g}g`),
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

function wireCoverageMap(skis) {
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

  chartWrap.querySelectorAll(".ski-mark").forEach((mark) => {
    const ski = skis[Number(mark.dataset.skiIndex)];
    const show = () => showTooltip(mark, skiTooltipHtml(ski));
    mark.addEventListener("pointerenter", show);
    mark.addEventListener("focus", show);
    mark.addEventListener("pointerleave", hideTooltip);
    mark.addEventListener("blur", hideTooltip);
  });
}

function wireSuggestionsMap(quiverSkis, suggestedSkis) {
  const combined = [...quiverSkis, ...suggestedSkis];
  const chartWrap = document.getElementById("suggestions-chart-wrap");
  const tableWrap = document.getElementById("suggestions-table-wrap");
  const toggleBtn = document.getElementById("suggestions-table-toggle");

  // Section renders without the chart/toggle when there are no
  // suggestions to show (see renderSuggestionsMapSection).
  if (!chartWrap || !tableWrap || !toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const showTable = tableWrap.hidden;
    tableWrap.hidden = !showTable;
    chartWrap.hidden = showTable;
    toggleBtn.setAttribute("aria-pressed", String(showTable));
    toggleBtn.textContent = showTable ? "View as chart" : "View as table";
  });

  chartWrap.querySelectorAll(".ski-mark").forEach((mark) => {
    const ski = combined[Number(mark.dataset.skiIndex)];
    const show = () => showTooltip(mark, skiTooltipHtml(ski));
    mark.addEventListener("pointerenter", show);
    mark.addEventListener("focus", show);
    mark.addEventListener("pointerleave", hideTooltip);
    mark.addEventListener("blur", hideTooltip);
  });
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

function renderDetailsSection(gaps, redundant, quiverNames) {
  const gapItems =
    gaps.length === 0
      ? `<li class="result-item ok"><span class="status-icon status-good" aria-hidden="true">✓</span><span>No gaps — every bucket has at least one ski covering it.</span></li>`
      : gaps
          .map((cell) => {
            const suggestions = suggestSkisForBucket(cell.waistBucket, cell.stabBucket, quiverNames);
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
// anchor mark scrolls away it's no longer over the dot it describes.
// Close it when that happens, using IntersectionObserver rather than a
// plain "scroll" listener: watching for the anchor to actually leave
// the viewport (crossing 0% visible) is immune to the false positive a
// scroll-event listener has here. Tapping a mark also moves focus to
// it (marks are tabindex="0" for keyboard/screen-reader access - see
// renderSkiMarks), and mobile browsers respond by auto-scrolling the
// newly-focused element fully into view - a genuine scroll, fired a
// moment (sometimes an animated few hundred ms) after the tap, that a
// scroll listener can't distinguish from the user scrolling away
// (tried that first; a fixed grace-period timeout couldn't reliably
// outlast the auto-scroll on real devices). That auto-scroll can never
// trigger a false close here, because by definition it moves the
// target toward fully visible, never across the "no longer
// intersecting" threshold this actually watches for. It also natively
// accounts for the chart's own horizontal-scroll container clipping
// the anchor, so no separate handling is needed for that case either.
let tooltipObserver = null;

function showTooltip(targetEl, contentNode) {
  tooltipEl.innerHTML = "";
  tooltipEl.appendChild(contentNode);
  tooltipEl.hidden = false;
  positionTooltip(targetEl);

  if (tooltipObserver) tooltipObserver.disconnect();
  tooltipObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) hideTooltip();
    },
    { threshold: 0 }
  );
  tooltipObserver.observe(targetEl);
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
  tooltipEl.hidden = true;
  if (tooltipObserver) {
    tooltipObserver.disconnect();
    tooltipObserver = null;
  }
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
