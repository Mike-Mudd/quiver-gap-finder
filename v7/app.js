"use strict";

/* Direction 07 — visual exploration.
   Search and coverage readout run on the real dataset and the real
   coverage math from ../scoring.js (see ../README.md for the
   reasoning) rather than a re-derived copy — this used to carry its
   own feelScore/zones, which had already drifted from root's coverage
   math (a flat boundary check, missing the region-overlap fix in
   scoring.js's buildGrid). Loading order matters: index.html pulls in
   scoring.js before this file. */

const { buildGrid, selectTopSuggestionsForMap, REDUNDANCY_THRESHOLD } = window.QuiverScoring;

// Short zone labels for the readout copy ("Narrow" / "playful"), kept
// separate from scoring.js's own bucket.label ("narrow / firm-groomer")
// so this direction's voice doesn't change just by sharing the math.
const WAIST_SHORT = { narrow: "Narrow", allmtn: "All-mountain", wide: "Wide" };
const FEEL_SHORT = { playful: "playful", balanced: "balanced", damp: "charging" };

function zones(quiver) {
  return buildGrid(quiver).map((cell) => ({
    label: `${WAIST_SHORT[cell.waistBucket.key]} + ${FEEL_SHORT[cell.stabBucket.key]}`,
    covered: cell.skis.length > 0,
  }));
}

/* ------------------------------------------------------------------ */

const searchEl = document.getElementById("ski-search");
const resultsEl = document.getElementById("results");
const quiverEl = document.getElementById("quiver");
const readoutEl = document.getElementById("readout");
const mapSectionEl = document.getElementById("map-section");
const mapContentEl = document.getElementById("map-content");
const summaryContentEl = document.getElementById("summary-content");
const conditionContentEl = document.getElementById("condition-content");
const detailsContentEl = document.getElementById("details-content");

let all = [];
let quiver = [];
let cursor = -1;
let candidateSkis = []; // "what if I added this" — see coverage-map.js

const coverageMap = window.CoverageMap.create({
  tooltipEl: document.getElementById("chart-tooltip"),
});
const conditionCards = window.ConditionCards.create();

/* The catalog is the whole product, so a failure here is total. Say so in
 * the reader's terms and keep the cause in the console for whoever is
 * debugging - a visitor cannot act on an HTTP status, and this page is
 * live. */
fetch("../data/skis.json")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((d) => {
    if (!d || !Array.isArray(d.skis)) throw new Error("unexpected format");
    all = d.skis;
  })
  .catch((err) => {
    console.error("Could not load data/skis.json:", err);
    searchEl.placeholder = "Catalog unavailable";
    searchEl.disabled = true;
    readoutEl.textContent =
      "The ski catalog didn't load. Refreshing usually fixes it — if it keeps happening, something's wrong on our end.";
  });

function matches() {
  const q = searchEl.value.trim().toLowerCase();
  const taken = new Set(quiver.map((s) => s.name));
  return all.filter((s) => s.name.toLowerCase().includes(q) && !taken.has(s.name)).slice(0, 6);
}

function renderResults() {
  const list = matches();
  cursor = -1;
  resultsEl.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = `Nothing matches "${searchEl.value.trim()}"`;
    resultsEl.appendChild(li);
  } else {
    list.forEach((ski) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.innerHTML = `<span>${ski.name}</span><span class="spec">${ski.waist_width_mm}mm</span>`;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); add(ski); });
      resultsEl.appendChild(li);
    });
  }
  resultsEl.hidden = false;
}

function add(ski) {
  if (quiver.some((s) => s.name === ski.name)) return;
  // A shallow copy, not the shared `all` reference - each quiver slot
  // tracks its own selected_length_cm independently (see
  // scoring.js effectiveSpecs), defaulting to the ski's reference
  // length. Matches root's addToQuiver.
  quiver.push({ ...ski, selected_length_cm: ski.reference_length_cm });
  searchEl.value = "";
  resultsEl.hidden = true;
  renderQuiver();
  renderReadout();
  renderMap();
  searchEl.focus();
}

function remove(name) {
  quiver = quiver.filter((s) => s.name !== name);
  // A stale comparison no longer applies once the quiver it was being
  // compared against has changed underneath it — same reasoning as
  // root's onFindGaps resetting candidateSkis on a fresh run.
  candidateSkis = [];
  renderQuiver();
  renderReadout();
  renderMap();
}

/**
 * <select> of a ski's available lengths (see length_options in
 * data/SOURCING.md) - quietly absent rather than showing a picker with
 * nothing to pick, for the (currently most) skis that haven't been
 * backfilled with any yet. Matches root's lengthPickerHtml.
 */
function lengthPickerHtml(ski) {
  if (!ski.length_options || ski.length_options.length === 0) return "";
  const options = ski.length_options
    .map((o) => `<option value="${o.length_cm}" ${o.length_cm === ski.selected_length_cm ? "selected" : ""}>${o.length_cm}cm</option>`)
    .join("");
  return `<select class="length-picker" aria-label="Length for ${ski.name}">${options}</select>`;
}

function renderQuiver() {
  quiverEl.innerHTML = "";
  quiver.forEach((ski) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${ski.name}</span>${lengthPickerHtml(ski)}`;
    const picker = li.querySelector(".length-picker");
    if (picker) {
      picker.addEventListener("change", () => {
        ski.selected_length_cm = Number(picker.value);
        renderMap();
      });
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", `Remove ${ski.name}`);
    btn.innerHTML = `<svg viewBox="0 0 12 12" width="9" height="9" fill="none" aria-hidden="true"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    btn.addEventListener("click", () => remove(ski.name));
    li.appendChild(btn);
    quiverEl.appendChild(li);
  });
}

function renderReadout() {
  if (quiver.length === 0) {
    readoutEl.textContent = "";
    return;
  }
  const z = zones(quiver);
  const missing = z.filter((x) => !x.covered);
  readoutEl.innerHTML = missing.length === 0
    ? "9 of 9 zones covered — nothing missing."
    : `${9 - missing.length} of 9 covered · <span class="gap">biggest gap: ${missing[0].label}</span>`;
}

/**
 * The coverage map, TL;DR summary, and condition cards all live in one
 * section below the hero and live-update with the quiver — no "Find
 * gaps" button, matching this direction's no-friction feel (see
 * readout above). When the quiver has gaps and nothing is being
 * manually compared, the map doubles as "what should I add" using the
 * same greedy-suggestion algorithm as root (selectTopSuggestionsForMap)
 * — see coverage-map.js/condition-cards.js/scoring.js. grid/gaps are
 * computed once here and reused across all three, same as root's
 * renderResults -> renderDashboard.
 */
function renderMap() {
  if (quiver.length === 0) {
    mapSectionEl.hidden = true;
    // is-in survives on these wrapper nodes even though the section is
    // hidden - the early return here never reaches the innerHTML writes
    // below that would otherwise refresh them. Clear it explicitly so
    // the stagger plays again next time the section is reached from
    // empty, rather than only once per page load.
    mapSectionEl.querySelectorAll(".stage").forEach((el) => el.classList.remove("is-in"));
    return;
  }
  const firstReveal = mapSectionEl.hidden;
  mapSectionEl.hidden = false;

  const grid = buildGrid(quiver);
  const gaps = grid.filter((c) => c.skis.length === 0);
  const redundant = grid.filter((c) => c.skis.length >= REDUNDANCY_THRESHOLD);

  const quiverNames = new Set(quiver.map((s) => s.name));
  const usingCandidates = candidateSkis.length > 0;
  let comparisonSkis = candidateSkis;
  let suggestionResult = null;

  if (!usingCandidates && gaps.length > 0) {
    suggestionResult = selectTopSuggestionsForMap(all, gaps, quiverNames);
    comparisonSkis = suggestionResult.suggestions;
  }

  summaryContentEl.innerHTML = conditionCards.renderQuiverSummarySection(
    grid,
    gaps,
    redundant,
    suggestionResult ? suggestionResult.suggestions : null
  );
  conditionContentEl.innerHTML = conditionCards.renderConditionCardsSection(grid, quiver);
  detailsContentEl.innerHTML = conditionCards.renderDetailsSection(gaps, redundant, quiverNames, all);

  mapContentEl.innerHTML = coverageMap.renderSection(quiver, comparisonSkis, {
    usingCandidates,
    suggestionResult,
    candidateSkis,
  });
  coverageMap.wire(mapContentEl, quiver, comparisonSkis, {
    getAllSkis: () => all,
    candidateSkis,
    onCandidatesChange: (next) => {
      candidateSkis = next;
      renderMap();
    },
  });

  if (firstReveal) {
    playMapReveal();
  } else {
    // Every renderMap() after the first replaces these nodes wholesale
    // (innerHTML), which drops the is-in class fresh HTML starts
    // without. Re-apply immediately so a chip toggle or length change
    // doesn't fade content back in that the reader is already looking
    // at - the stagger is a one-time intro, not a per-update effect.
    mapSectionEl.querySelectorAll(".stage").forEach((el) => el.classList.add("is-in"));
  }
}

/**
 * The summary sentence, then the map + condition cards together, then
 * the details fallback - three beats instead of one instant dump, so
 * the reader gets the headline before the evidence and the evidence
 * before the deep-dive (see the v7 critique, P1: five surfaces
 * revealing simultaneously). Runs once per reveal, not on every
 * renderMap() call - a chip toggle or length change should not
 * re-animate content the reader is already looking at.
 */
function playMapReveal() {
  const stages = mapSectionEl.querySelectorAll(".stage");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    stages.forEach((el) => el.classList.add("is-in"));
    return;
  }
  requestAnimationFrame(() => {
    stages.forEach((el) => {
      const stage = Number(el.dataset.stage || 1);
      setTimeout(() => el.classList.add("is-in"), (stage - 1) * 160);
    });
  });
}

searchEl.addEventListener("input", renderResults);
searchEl.addEventListener("focus", renderResults);
searchEl.addEventListener("blur", () => setTimeout(() => { resultsEl.hidden = true; }, 120));
searchEl.addEventListener("keydown", (e) => {
  const items = [...resultsEl.querySelectorAll("li:not(.empty)")];
  if (e.key === "Escape") { resultsEl.hidden = true; searchEl.blur(); return; }
  if (!items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    cursor = e.key === "ArrowDown" ? (cursor + 1) % items.length : (cursor - 1 + items.length) % items.length;
    items.forEach((li, i) => li.setAttribute("data-active", String(i === cursor)));
    items[cursor].scrollIntoView({ block: "nearest" });
  }
  if (e.key === "Enter" && cursor >= 0) {
    e.preventDefault();
    const ski = all.find((s) => s.name === items[cursor].firstChild.textContent);
    if (ski) add(ski);
  }
});

/* Scroll reveals - see reveal.js, loaded separately below so
   method.html can share the same behaviour without pulling in
   everything above this point. */

/* The scroll cue is fixed to the viewport, so it has to retire itself
   once the reader has started scrolling — otherwise it follows them
   down the whole page telling them to do what they are already doing. */
(function wireScrollCue() {
  const cue = document.querySelector(".scroll-cue");
  if (!cue) return;
  let ticking = false;
  const update = () => {
    cue.dataset.hidden = String(window.scrollY > 80);
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();
})();
