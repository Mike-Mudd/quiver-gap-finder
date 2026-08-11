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

// Weight range used to normalize stability score. Roughly spans the
// lightest (touring-oriented) to heaviest (charger) skis in the dataset.
const WEIGHT_MIN = 1500;
const WEIGHT_MAX = 2300;

// Contribution of metal content to the stability score (0-1 scale).
const METAL_SCORE = { none: 0, partial: 0.5, full: 1 };

// Weighting between weight and metal content in the final stability score.
const WEIGHT_FACTOR = 0.65;
const METAL_FACTOR = 0.35;

const REDUNDANCY_THRESHOLD = 3;
const MAX_QUIVER_SIZE = 6;

const WAIST_BUCKETS = [
  { key: "narrow", label: "narrow / firm-groomer", min: WAIST_MIN, max: 89 },
  { key: "allmtn", label: "all-mountain", min: 90, max: 109 },
  { key: "wide", label: "wide / powder", min: 110, max: WAIST_MAX },
];

const STAB_BUCKETS = [
  { key: "playful", label: "playful / light", min: 0, max: 33.33 },
  { key: "balanced", label: "balanced", min: 33.33, max: 66.67 },
  { key: "damp", label: "damp / charging", min: 66.67, max: 100 },
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

/* ------------------------------------------------------------------ *
 *  Init
 * ------------------------------------------------------------------ */

init();

async function init() {
  try {
    const res = await fetch("data/skis.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allSkis = await res.json();
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
 * Derive a 0-100 "stability score" from weight and metal content.
 * Heavier + more metal => higher score => damper/more charging-oriented.
 * Lighter + no metal => lower score => more playful.
 */
function stabilityScore(ski) {
  const weightNorm = clamp((ski.weight_g - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN), 0, 1);
  const metalNorm = METAL_SCORE[ski.metal_content] ?? 0;
  return weightNorm * WEIGHT_FACTOR * 100 + metalNorm * METAL_FACTOR * 100;
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
 *  Results rendering
 * ------------------------------------------------------------------ */

function onFindGaps() {
  if (quiver.length === 0) return;
  const grid = buildGrid(quiver);
  renderResults(grid);
}

function bucketLabel(cell) {
  return `${cell.waistBucket.label} + ${cell.stabBucket.label}`;
}

function bucketDescription(cell) {
  const key = `${cell.waistBucket.key}-${cell.stabBucket.key}`;
  return BUCKET_DESCRIPTIONS[key] || "this combination of width and stability";
}

function renderResults(grid) {
  const gaps = grid.filter((c) => c.skis.length === 0);
  const redundant = grid.filter((c) => c.skis.length >= REDUNDANCY_THRESHOLD);
  const covered = grid.length - gaps.length;

  const parts = [];

  parts.push(
    `<p class="results-summary">Your ${quiver.length}-ski quiver covers <strong>${covered} of 9</strong> buckets in the coverage grid.</p>`
  );

  // Gaps
  parts.push('<div class="result-group"><h3>Coverage gaps</h3>');
  if (gaps.length === 0) {
    parts.push(
      `<ul class="result-list"><li class="result-item ok"><strong>No gaps</strong> — every bucket in the grid has at least one ski covering it.</li></ul>`
    );
  } else {
    const items = gaps
      .map(
        (cell) =>
          `<li class="result-item gap">No coverage for <strong>${escapeHtml(
            bucketLabel(cell)
          )}</strong> — nothing built for ${escapeHtml(bucketDescription(cell))}.</li>`
      )
      .join("");
    parts.push(`<ul class="result-list">${items}</ul>`);
  }
  parts.push("</div>");

  // Redundancy
  parts.push('<div class="result-group"><h3>Redundancy</h3>');
  if (redundant.length === 0) {
    parts.push(
      `<ul class="result-list"><li class="result-item ok">No buckets have ${REDUNDANCY_THRESHOLD}+ overlapping skis — your quiver looks efficiently spread out.</li></ul>`
    );
  } else {
    const items = redundant
      .map((cell) => {
        const names = cell.skis.map((s) => s.name).join(", ");
        return `<li class="result-item redundancy"><strong>${cell.skis.length} skis</strong> overlap in <strong>${escapeHtml(
          bucketLabel(cell)
        )}</strong> — you may have redundant width/stability here (${escapeHtml(names)}).</li>`;
      })
      .join("");
    parts.push(`<ul class="result-list">${items}</ul>`);
  }
  parts.push("</div>");

  // Full grid table for reference
  parts.push(renderGridTable(grid));

  resultsEl.innerHTML = parts.join("\n");
}

function renderGridTable(grid) {
  // grid is ordered stab-major (damp bucket rows iterate through waist
  // buckets); STAB_BUCKETS is ordered playful->balanced->damp, so reverse
  // for a top-to-bottom "charging at top" reading of the table.
  const rows = [...STAB_BUCKETS].reverse();

  let html = '<div class="grid-table-wrap"><table class="grid-table">';
  html += "<thead><tr><th></th>";
  for (const wb of WAIST_BUCKETS) {
    html += `<th>${escapeHtml(wb.label)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const sb of rows) {
    html += `<tr><th>${escapeHtml(sb.label)}</th>`;
    for (const wb of WAIST_BUCKETS) {
      const cell = grid.find((c) => c.stabBucket.key === sb.key && c.waistBucket.key === wb.key);
      const count = cell.skis.length;
      let cls = "cell-ok";
      if (count === 0) cls = "cell-empty";
      else if (count >= REDUNDANCY_THRESHOLD) cls = "cell-redundant";
      html += `<td class="${cls}" title="${escapeHtml(cell.skis.map((s) => s.name).join(", "))}">${count}</td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  return html;
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
