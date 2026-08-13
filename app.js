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
// (DPS Pagoda Tour 100) to heaviest (Volkl Katana 108) skis in the
// sourced dataset — see data/SOURCING.md.
const WEIGHT_MIN = 1550;
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
 *  Results rendering — dashboard: stat tiles, a coverage map, a
 *  status-coded heatmap grid, and the plain-language bullets tucked
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
function suggestSkisForBucket(waistBucket, stabBucket, quiverNames, limit = 2) {
  const wCenter = bucketCenter(waistBucket);
  const sCenter = bucketCenter(stabBucket);
  const wSpan = WAIST_MAX - WAIST_MIN;
  const sSpan = STAB_MAX - STAB_MIN;

  return allSkis
    .filter((ski) => !quiverNames.has(ski.name))
    .map((ski) => {
      const region = coverageRegion(ski);
      const overlaps =
        rectsOverlap({ xMin: region.xMin, xMax: region.xMax }, waistBucket) &&
        rectsOverlap({ xMin: region.yMin, xMax: region.yMax }, stabBucket);
      if (!overlaps) return null;
      const dx = (ski.waist_width_mm - wCenter) / wSpan;
      const dy = (region.stab - sCenter) / sSpan;
      return { ski, distance: Math.sqrt(dx * dx + dy * dy) };
    })
    .filter(Boolean)
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
function collectGapSuggestions(gaps, quiverNames) {
  const seen = new Map();
  for (const cell of gaps) {
    for (const ski of suggestSkisForBucket(cell.waistBucket, cell.stabBucket, quiverNames)) {
      if (!seen.has(ski.name)) seen.set(ski.name, ski);
    }
  }
  return Array.from(seen.values());
}

/**
 * Classify a bucket's ski count into one of three fixed states. These
 * map 1:1 onto the status colors defined in style.css (good/warning/
 * critical) — never assigned ad hoc, always via this function.
 */
function cellStatus(count) {
  if (count === 0) return "critical"; // gap
  if (count >= REDUNDANCY_THRESHOLD) return "warning"; // redundant
  return "good"; // covered
}

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
  const covered = grid.length - gaps.length;
  const quiverNames = new Set(skis.map((s) => s.name));

  const sections = [
    renderStatTiles({ covered, gapCount: gaps.length, redundantCount: redundant.length }),
    renderCoverageMapSection(skis),
    renderHeatmapSection(grid, quiverNames),
  ];

  // Only rendered when there's actually a gap to suggest something for -
  // no empty "Suggested additions" card when the quiver's already full
  // coverage.
  let gapSuggestions = [];
  if (gaps.length > 0) {
    gapSuggestions = collectGapSuggestions(gaps, quiverNames);
    sections.push(renderSuggestionsMapSection(skis, gapSuggestions));
  }

  sections.push(renderDetailsSection(gaps, redundant, quiverNames));

  resultsEl.innerHTML = sections.join("\n");

  wireCoverageMap(skis);
  wireHeatmap(grid, quiverNames);
  if (gaps.length > 0) {
    wireSuggestionsMap(skis, gapSuggestions);
  }
}

/* ---- Stat tiles (KPI row) ----------------------------------------- */

function renderStatTiles({ covered, gapCount, redundantCount }) {
  const gapStatus = gapCount === 0 ? "good" : "critical";
  const gapBadge = gapCount === 0 ? { icon: "✓", text: "fully covered" } : { icon: "✕", text: "needs attention" };

  const redStatus = redundantCount === 0 ? "good" : "warning";
  const redBadge =
    redundantCount === 0 ? { icon: "✓", text: "well spread out" } : { icon: "▲", text: "overlapping skis" };

  return `
    <div class="stat-row">
      <div class="stat-tile" data-status="neutral">
        <div class="stat-label">Coverage</div>
        <div class="stat-value">${covered}<span class="stat-value-total"> / 9</span></div>
        <div class="stat-badge">buckets covered</div>
      </div>
      <div class="stat-tile" data-status="${gapStatus}">
        <div class="stat-label">Coverage gaps</div>
        <div class="stat-value">${gapCount}</div>
        <div class="stat-badge"><span class="stat-icon" aria-hidden="true">${gapBadge.icon}</span>${gapBadge.text}</div>
      </div>
      <div class="stat-tile" data-status="${redStatus}">
        <div class="stat-label">Redundant zones</div>
        <div class="stat-value">${redundantCount}</div>
        <div class="stat-badge"><span class="stat-icon" aria-hidden="true">${redBadge.icon}</span>${redBadge.text}</div>
      </div>
    </div>
  `;
}

/* ---- Coverage map (SVG scatter + region plot) ---------------------- */

const MAP_W = 640;
const MAP_H = 380;
const MAP_MARGIN = { top: 16, right: 16, bottom: 30, left: 16 };
const MAP_PLOT_W = MAP_W - MAP_MARGIN.left - MAP_MARGIN.right;
const MAP_PLOT_H = MAP_H - MAP_MARGIN.top - MAP_MARGIN.bottom;

function mapX(waist) {
  return MAP_MARGIN.left + ((waist - WAIST_MIN) / (WAIST_MAX - WAIST_MIN)) * MAP_PLOT_W;
}

function mapY(stab) {
  // Inverted: higher stability score plots nearer the top.
  return MAP_MARGIN.top + ((STAB_MAX - stab) / (STAB_MAX - STAB_MIN)) * MAP_PLOT_H;
}

function skiAriaLabel(ski) {
  const stab = stabilityScore(ski);
  const yearPart = ski.model_year ? `${ski.model_year} model, ` : "";
  return `${ski.name}: ${yearPart}${ski.waist_width_mm}mm waist, ${ski.weight_g} grams, ${metalLabel(
    ski.metal_content
  )} metal, temperament: ${temperamentPhrase(stab)} (${Math.round(stab)} of 100)`;
}

/**
 * The shared, static part of any coverage-space SVG: plot border,
 * bucket-boundary gridlines, and axis zone labels. Identical across the
 * primary coverage map and the suggestions map so both read the same way.
 */
function renderMapChrome() {
  const plotLeft = MAP_MARGIN.left;
  const plotRight = MAP_MARGIN.left + MAP_PLOT_W;
  const plotTop = MAP_MARGIN.top;
  const plotBottom = MAP_MARGIN.top + MAP_PLOT_H;

  const vx1 = mapX(89.5);
  const vx2 = mapX(109.5);
  const hy1 = mapY(33.33);
  const hy2 = mapY(66.67);

  let svg = `<rect x="${plotLeft}" y="${plotTop}" width="${MAP_PLOT_W}" height="${MAP_PLOT_H}" class="map-plot-border" />`;
  svg += `<line x1="${vx1}" y1="${plotTop}" x2="${vx1}" y2="${plotBottom}" class="map-gridline" />`;
  svg += `<line x1="${vx2}" y1="${plotTop}" x2="${vx2}" y2="${plotBottom}" class="map-gridline" />`;
  svg += `<line x1="${plotLeft}" y1="${hy1}" x2="${plotRight}" y2="${hy1}" class="map-gridline" />`;
  svg += `<line x1="${plotLeft}" y1="${hy2}" x2="${plotRight}" y2="${hy2}" class="map-gridline" />`;

  // X-axis zone labels, centered under each waist bucket.
  const xLabels = ["Narrow", "All-mountain", "Wide / powder"];
  const xCenters = [(WAIST_MIN + 89) / 2, (90 + 109) / 2, (110 + WAIST_MAX) / 2];
  xLabels.forEach((label, i) => {
    const x = mapX(xCenters[i]);
    svg += `<text x="${x.toFixed(1)}" y="${MAP_H - 10}" text-anchor="middle" class="map-axis-label">${escapeHtml(
      label
    )}</text>`;
  });

  // Y-axis zone labels, top-left of each stability band (damp at top).
  const yLabels = ["Damp / charging", "Balanced", "Playful / light"];
  const bandTopY = [plotTop, hy2, hy1];
  yLabels.forEach((label, i) => {
    svg += `<text x="${plotLeft + 8}" y="${(bandTopY[i] + 16).toFixed(
      1
    )}" text-anchor="start" class="map-axis-label map-axis-label-y">${escapeHtml(label)}</text>`;
  });

  return svg;
}

/**
 * One mark per entry: a translucent region (opacity stacks where marks
 * overlap - the redundancy signal on the primary map) plus a solid dot
 * at the exact spec position and a direct name label. `muted` entries
 * (quiver-as-context on the suggestions map) render as de-emphasized
 * gray with no label - see .ski-mark--muted in style.css - and never
 * claim label space, so they can't cause collisions for the marks that
 * matter on that map.
 *
 * Direct labels are shown only when they don't collide with one already
 * placed — a quiver with several similar skis clusters tightly, and a
 * pile of overlapping text is worse than a dot with a hover/focus
 * tooltip (every ski's full spec is also in the "View as table" twin
 * and the mark's aria-label, so nothing is gated behind the label).
 */
function renderSkiMarks(entries) {
  const plotRight = MAP_MARGIN.left + MAP_PLOT_W;
  const plotTop = MAP_MARGIN.top;

  const placedLabelBoxes = [];
  const CHAR_W = 5.6; // px, approx. at 11px font
  const LABEL_H = 13;
  const LABEL_PAD = 4; // extra buffer so near-misses don't render edge-to-edge

  let svg = "";

  entries.forEach(({ ski, index, muted }) => {
    const region = coverageRegion(ski);
    const rx1 = mapX(region.xMin);
    const rx2 = mapX(region.xMax);
    const ry1 = mapY(region.yMax);
    const ry2 = mapY(region.yMin);
    const cx = mapX(ski.waist_width_mm);
    const cy = mapY(region.stab);

    let labelSvg = "";
    if (!muted) {
      const nearRight = cx > plotRight - 90;
      const nearTop = cy < plotTop + 18;
      const labelX = nearRight ? cx - 9 : cx + 9;
      const labelY = nearTop ? cy + 18 : cy - 9;
      const anchor = nearRight ? "end" : "start";

      const labelW = ski.name.length * CHAR_W;
      const box = {
        left: (anchor === "end" ? labelX - labelW : labelX) - LABEL_PAD,
        right: (anchor === "end" ? labelX : labelX + labelW) + LABEL_PAD,
        top: labelY - LABEL_H - LABEL_PAD,
        bottom: labelY + LABEL_PAD,
      };
      const collides = placedLabelBoxes.some(
        (b) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top
      );

      if (!collides) {
        placedLabelBoxes.push(box);
        labelSvg = `<text class="ski-mark-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(
          1
        )}" text-anchor="${anchor}">${escapeHtml(ski.name)}</text>`;
      }
    }

    const markClass = muted ? "ski-mark ski-mark--muted" : "ski-mark";
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
  const chrome = renderMapChrome();
  const marks = renderSkiMarks(skis.map((ski, index) => ({ ski, index, muted: false })));
  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="coverage-map" role="img" aria-label="Scatter map of your quiver's coverage by waist width and temperament">${chrome}${marks}</svg>`;
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
        Each dot is a ski's exact spec. The shaded box around it is the terrain/temperament
        range it covers — darker overlap means more than one ski covers that zone. Hover or
        focus a dot for its name and specs when labels are too close to show.
      </p>
      <div class="chart-wrap" id="map-chart-wrap">${renderCoverageMapSvg(skis)}</div>
      <div class="chart-table-wrap" id="map-table-wrap" hidden>${renderCoverageMapTable(skis)}</div>
    </section>
  `;
}

/* ---- Suggestions map (same space, quiver muted + gap-fillers highlighted) */

function renderSuggestionsMapSvg(quiverSkis, suggestedSkis) {
  const chrome = renderMapChrome();
  const entries = [
    ...quiverSkis.map((ski, index) => ({ ski, index, muted: true })),
    ...suggestedSkis.map((ski, i) => ({ ski, index: quiverSkis.length + i, muted: false })),
  ];
  const marks = renderSkiMarks(entries);
  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="coverage-map" role="img" aria-label="Suggested skis that would fill your quiver's coverage gaps, shown against your current quiver for reference">${chrome}${marks}</svg>`;
}

function renderSuggestionsMapTable(suggestedSkis) {
  const rows = suggestedSkis
    .map((ski) => {
      const region = coverageRegion(ski);
      const wBucket =
        WAIST_BUCKETS.find((b) => ski.waist_width_mm >= b.min && ski.waist_width_mm <= b.max) ||
        WAIST_BUCKETS[WAIST_BUCKETS.length - 1];
      const sBucket = temperamentBucket(region.stab);
      return `<tr><td>${escapeHtml(ski.name)}</td><td>${ski.waist_width_mm}</td><td>${renderTemperamentGauge(
        region.stab
      )}</td><td>${escapeHtml(wBucket.label)} + ${escapeHtml(sBucket.label)}</td></tr>`;
    })
    .join("");

  return `
    <table class="chart-table">
      <thead><tr><th>Ski</th><th>Waist (mm)</th><th>Temperament</th><th>Fills bucket</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSuggestionsMapSection(quiverSkis, suggestedSkis) {
  if (suggestedSkis.length === 0) {
    return `
      <section class="panel dashboard-card">
        <h3>Suggested additions</h3>
        <p class="map-caption">Nothing in the current catalog fills any of your gaps yet.</p>
      </section>
    `;
  }

  return `
    <section class="panel dashboard-card">
      <div class="card-header">
        <h3>Suggested additions</h3>
        <button type="button" class="table-toggle-btn" id="suggestions-table-toggle" aria-pressed="false">View as table</button>
      </div>
      <p class="map-caption">
        Your current quiver is faded for reference. Highlighted dots are skis from the full
        catalog that would fill one of your gaps — positioned the same way as the map above.
      </p>
      <div class="chart-wrap" id="suggestions-chart-wrap">${renderSuggestionsMapSvg(quiverSkis, suggestedSkis)}</div>
      <div class="chart-table-wrap" id="suggestions-table-wrap" hidden>${renderSuggestionsMapTable(
        suggestedSkis
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

/* ---- Heatmap grid (status-coded 3x3) -------------------------------- */

function renderHeatmapSection(grid, quiverNames) {
  const rows = [...STAB_BUCKETS].reverse(); // damp/charging at top

  let cells = `<div class="heatmap-corner" role="presentation"></div>`;
  for (const wb of WAIST_BUCKETS) {
    cells += `<div class="heatmap-colhead">${escapeHtml(wb.short)}</div>`;
  }

  let cellIndex = 0;
  const cellRefs = [];
  for (const sb of rows) {
    cells += `<div class="heatmap-rowhead">${escapeHtml(sb.short)}</div>`;
    for (const wb of WAIST_BUCKETS) {
      const cell = grid.find((c) => c.stabBucket.key === sb.key && c.waistBucket.key === wb.key);
      cellRefs.push(cell);
      const status = cellStatus(cell.skis.length);
      const meta = statusMeta(status);
      const extra = cell.skis.length
        ? ` — ${escapeHtml(cell.skis.map((s) => s.name).join(", "))}`
        : ` — ${suggestionPhrase(suggestSkisForBucket(cell.waistBucket, cell.stabBucket, quiverNames))}`;
      cells += `
        <div class="heat-tile" data-status="${status}" data-cell-index="${cellIndex}" tabindex="0"
             aria-label="${escapeHtml(bucketLabel(cell))}: ${cell.skis.length} ski${
        cell.skis.length === 1 ? "" : "s"
      }, ${meta.label}${extra}">
          <span class="heat-icon" aria-hidden="true">${meta.icon}</span>
          <span class="heat-count">${cell.skis.length}</span>
          <span class="heat-label">${meta.label}</span>
        </div>
      `;
      cellIndex++;
    }
  }

  return `
    <section class="panel dashboard-card">
      <h3>Coverage grid</h3>
      <div class="heatmap" data-cell-count="${cellRefs.length}">${cells}</div>
    </section>
  `;
}

function heatTooltipHtml(cell, quiverNames) {
  const title = document.createElement("div");
  title.className = "tooltip-title";
  title.textContent = bucketLabel(cell);

  const detail = document.createElement("div");
  detail.className = "tooltip-detail";
  detail.textContent = cell.skis.length ? cell.skis.map((s) => s.name).join(", ") : "No skis cover this zone";

  const wrap = document.createElement("div");
  wrap.append(title, detail);

  if (cell.skis.length === 0) {
    const suggestions = suggestSkisForBucket(cell.waistBucket, cell.stabBucket, quiverNames);
    const suggestion = document.createElement("div");
    suggestion.className = "tooltip-detail tooltip-suggestion";
    suggestion.textContent =
      suggestions.length > 0
        ? `Consider: ${suggestions.map((s) => s.name).join(", ")}`
        : "Nothing in the current catalog centers on this zone yet.";
    wrap.append(suggestion);
  }

  return wrap;
}

function wireHeatmap(grid, quiverNames) {
  const rows = [...STAB_BUCKETS].reverse();
  const orderedCells = [];
  for (const sb of rows) {
    for (const wb of WAIST_BUCKETS) {
      orderedCells.push(grid.find((c) => c.stabBucket.key === sb.key && c.waistBucket.key === wb.key));
    }
  }

  document.querySelectorAll(".heat-tile").forEach((tile) => {
    const cell = orderedCells[Number(tile.dataset.cellIndex)];
    const show = () => showTooltip(tile, heatTooltipHtml(cell, quiverNames));
    tile.addEventListener("pointerenter", show);
    tile.addEventListener("focus", show);
    tile.addEventListener("pointerleave", hideTooltip);
    tile.addEventListener("blur", hideTooltip);
  });
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

function showTooltip(targetEl, contentNode) {
  tooltipEl.innerHTML = "";
  tooltipEl.appendChild(contentNode);
  tooltipEl.hidden = false;
  positionTooltip(targetEl);
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
