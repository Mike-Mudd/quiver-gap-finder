"use strict";

/* ------------------------------------------------------------------ *
 *  Shared coverage-map component — the SVG scatter/region chart, its
 *  accessible table twin, the hover/focus tooltip, and the "what if I
 *  added this" candidate picker. No visual styling lives here: every
 *  element carries the same class names root's style.css already
 *  defines (.coverage-map, .ski-mark, .chart-tooltip, ...), and each
 *  visual direction supplies its own CSS for those classes. This is
 *  what makes the component portable — v7 (or any future direction)
 *  gets the real, tested behaviour (two geometry profiles, the
 *  ?debug=1-era touch fixes, label-collision avoidance, the accessible
 *  table view) by loading this file and its own stylesheet, not by
 *  re-deriving any of it. See ROADMAP.md "Phase 1."
 *
 *  Depends on scoring.js (window.QuiverScoring) being loaded first.
 *
 *  Usage from a page:
 *    const map = window.CoverageMap.create({
 *      tooltipEl: document.getElementById("chart-tooltip"),
 *      escapeHtml,             // caller supplies (root already has one)
 *    });
 *    section.innerHTML = map.renderSection(quiver, comparisonSkis, {
 *      usingCandidates, suggestionResult, allSkis, selectedInterest,
 *    });
 *    map.wire(section, quiver, comparisonSkis, { allSkis, quiver, onCandidatesChange });
 * ------------------------------------------------------------------ */

(function () {

const {
  WAIST_MIN,
  WAIST_MAX,
  STAB_MIN,
  STAB_MAX,
  WAIST_BUCKETS,
  STAB_BUCKETS,
  INTERESTS,
  MAX_CANDIDATES,
  effectiveSpecs,
  stabilityScore,
  coverageRegion,
  rockerPercent,
  temperamentBucket,
  temperamentPhrase,
  metalLabel,
} = window.QuiverScoring;

const MAP_COMPACT_BREAKPOINT_PX = 480;
const TOOLTIP_MOVE_CLOSE_PX = 60;
const TOOLTIP_HIDE_DELAY_MS = 100;

function defaultEscapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build one coverage-map instance bound to a page's tooltip element and
 * (optionally) its own escapeHtml/renderTemperamentGauge. Each call
 * site owns its own candidateSkis state - the map only renders and
 * wires DOM, it doesn't own quiver/candidate arrays itself.
 */
function create(opts = {}) {
  const tooltipEl = opts.tooltipEl;
  const escapeHtml = opts.escapeHtml || defaultEscapeHtml;
  const renderTemperamentGauge = opts.renderTemperamentGauge || defaultRenderTemperamentGauge;

  let tooltipAnchorEl = null;
  let tooltipAnchorRect = null;
  let tooltipHideTimer = null;

  function defaultRenderTemperamentGauge(score) {
    const pct = Math.min(Math.max(score, 0), 100);
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
   */
  function shortSkiLabel(ski) {
    if (ski.brand && ski.name.startsWith(ski.brand + " ")) {
      return ski.name.slice(ski.brand.length + 1);
    }
    return ski.name;
  }

  /**
   * The shared, static part of any coverage-space SVG: plot border,
   * bucket-boundary gridlines, and axis zone labels.
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

    const xLabels = geo.compact ? WAIST_BUCKETS.map((b) => b.short) : ["Narrow", "All-mountain", "Wide / powder"];
    const xCenters = [(WAIST_MIN + 89) / 2, (90 + 109) / 2, (110 + WAIST_MAX) / 2];
    xLabels.forEach((label, i) => {
      const x = mapX(xCenters[i], geo);
      svg += `<text x="${x.toFixed(1)}" y="${geo.H - (geo.compact ? 7 : 10)}" text-anchor="middle" class="map-axis-label">${escapeHtml(
        label
      )}</text>`;
    });

    // "Charging" here rather than "Damp" (still used elsewhere, e.g.
    // temperamentPhrase's "Leans damp/charging") - "damp" reads as wet
    // snow out of ski-jargon context, where "charging" doesn't need it.
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
   * at the exact spec position and a direct name label. `variant`
   * selects the color via CSS: "quiver" (default) or "suggestion" (see
   * .ski-mark--suggestion).
   *
   * Direct labels are shown only when they don't collide with one
   * already placed, tracked across every entry passed in one call so
   * quiver and suggestion labels compete for space fairly.
   */
  function renderSkiMarks(entries, geo) {
    const plotRight = geo.MARGIN.left + geo.plotW;
    const plotTop = geo.MARGIN.top;
    const rightEdgeZone = geo.plotW * 0.148;
    const topEdgeZone = geo.plotH * 0.054;

    const placedLabelBoxes = [];
    const CHAR_W = 5.6; // px, approx. at 11px font
    const LABEL_H = 13;
    const LABEL_PAD = 4;

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
   * (auto-suggestion or user-picked candidate) with a small badge. */
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
      ...quiverSkis.map((ski, index) => ({ ski, index, variant: "quiver" })),
      ...comparisonSkis.map((ski, i) => ({ ski, index: quiverSkis.length + i, variant: "suggestion" })),
    ];
    const marks = renderSkiMarks(entries, geo);
    return `<svg viewBox="0 0 ${geo.W} ${geo.H}" class="coverage-map" role="img" aria-label="Your quiver's coverage, with a comparison ski shown for reference">${chrome}${marks}</svg>`;
  }

  /**
   * Plain-language explanation of what the two axes/buckets mean,
   * including their real ranges - built from WAIST_BUCKETS/STAB_BUCKETS
   * directly so it can never drift out of sync with the actual boundaries.
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

  /**
   * <select> of a ski's available lengths (see length_options in
   * data/SOURCING.md) - quietly absent rather than showing a picker
   * with nothing to pick, for the (currently most) skis that haven't
   * been backfilled with any yet. Used on the candidate-picker's own
   * chips below; the main quiver's chips have their own copy of this
   * (see root app.js / v7 app.js) since they're rendered outside this
   * module.
   */
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

  function skiTooltipHtml(ski) {
    const title = document.createElement("div");
    title.className = "tooltip-title";
    title.textContent = ski.name;

    const specs = effectiveSpecs(ski);
    const year = document.createElement("div");
    year.className = "tooltip-year";
    year.textContent = ski.model_year
      ? `${ski.model_year} model · ${specs.length_cm}cm`
      : `Model year unknown · ${specs.length_cm}cm`;

    const specGrid = document.createElement("div");
    specGrid.className = "tooltip-spec-grid";
    specGrid.append(
      specRow("Waist", `${ski.waist_width_mm}mm`),
      specRow("Weight", `${specs.weight_g}g`),
      specRow("Turn radius", specs.turn_radius_m ? `${specs.turn_radius_m}m` : "—"),
      specRow("Metal", metalContentLabel(ski.metal_content)),
      specRow("Rocker", `${rockerProfileLabel(ski.rocker_profile)} (${rockerPercent(ski)}%)`)
    );

    const gauge = document.createElement("div");
    gauge.className = "tooltip-gauge-wrap";
    gauge.innerHTML = renderTemperamentGauge(stabilityScore(ski));

    const wrap = document.createElement("div");
    wrap.append(title, year, specGrid, gauge);
    return wrap;
  }

  function positionTooltip(targetEl) {
    if (!tooltipEl) return;
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

  function showTooltip(targetEl, contentNode) {
    if (!tooltipEl) return;
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

  function hideTooltip() {
    if (!tooltipEl) return;
    // Only the FIRST call starts the countdown - repeat calls while
    // one's already pending must not keep pushing it back. See root
    // app.js history: a real device log showed dy already past the
    // close threshold on every scroll tick, each resetting the timer.
    if (tooltipHideTimer) return;
    tooltipHideTimer = setTimeout(() => {
      tooltipEl.hidden = true;
      tooltipAnchorEl = null;
      tooltipAnchorRect = null;
      tooltipHideTimer = null;
    }, TOOLTIP_HIDE_DELAY_MS);
  }

  /** Wired once, on window, capture phase - catches page scroll and the
   * chart's own horizontal-scroll container alike, since "scroll"
   * doesn't bubble but capture-phase listeners still see it. */
  function checkTooltipAnchorMoved() {
    if (!tooltipEl || tooltipEl.hidden || !tooltipAnchorEl) return;
    const current = tooltipAnchorEl.getBoundingClientRect();
    const dx = Math.abs(current.left - tooltipAnchorRect.left);
    const dy = Math.abs(current.top - tooltipAnchorRect.top);
    if (dx > TOOLTIP_MOVE_CLOSE_PX || dy > TOOLTIP_MOVE_CLOSE_PX) hideTooltip();
  }
  if (tooltipEl) {
    window.addEventListener("scroll", checkTooltipAnchorMoved, { capture: true, passive: true });
  }

  /**
   * The full coverage-map section: quiver-only map, or (when
   * comparisonSkis is non-empty) the same chart doubling as "what
   * should I add" - quiver (blue) plus either the algorithm's
   * auto-suggestion(s) or a user-picked candidate (red).
   */
  function renderSection(skis, comparisonSkis, ctx) {
    const { usingCandidates, suggestionResult, selectedInterest, candidateSkis = [] } = ctx || {};
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
    } else if (skis.length === 0) {
      caption = `Add a ski above to see its coverage.`;
    } else {
      caption = `Each dot is a ski. The shaded box is the terrain/temperament range it covers —
          darker overlap means more coverage. Tap a dot for details.`;
    }

    const svg = hasComparison ? renderSuggestionsMapSvg(skis, comparisonSkis) : renderCoverageMapSvg(skis);
    const comparisonNames = new Set(comparisonSkis.map((s) => s.name));
    const table = renderCoverageMapTable([...skis, ...comparisonSkis], comparisonNames);

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

    const candidatePicker = `
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

    return `
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
      ${candidatePicker}
    `;
  }

  /**
   * Wire interactivity for a section rendered by renderSection() and
   * inserted into containerEl. `getAllSkis` returns the full catalog
   * for candidate search; `onCandidatesChange(nextCandidateSkis)` is
   * called whenever the candidate list changes so the caller can
   * re-render (candidateSkis state is owned by the caller, not here).
   */
  function wire(containerEl, skis, comparisonSkis, ctx) {
    const { getAllSkis, candidateSkis = [], onCandidatesChange } = ctx || {};
    const combined = [...skis, ...comparisonSkis];
    const chartWrap = containerEl.querySelector("#map-chart-wrap");
    const tableWrap = containerEl.querySelector("#map-table-wrap");
    const toggleBtn = containerEl.querySelector("#map-table-toggle");

    if (toggleBtn && chartWrap && tableWrap) {
      toggleBtn.addEventListener("click", () => {
        const showTable = tableWrap.hidden;
        tableWrap.hidden = !showTable;
        chartWrap.hidden = showTable;
        toggleBtn.setAttribute("aria-pressed", String(showTable));
        toggleBtn.textContent = showTable ? "View as chart" : "View as table";
      });
    }

    const infoBtn = containerEl.querySelector("#map-info-toggle");
    const infoPanel = containerEl.querySelector("#map-info-panel");
    if (infoBtn && infoPanel) {
      infoBtn.addEventListener("click", () => {
        const showing = infoPanel.hidden;
        infoPanel.hidden = !showing;
        infoBtn.setAttribute("aria-pressed", String(showing));
      });
    }

    if (chartWrap) {
      chartWrap.querySelectorAll(".ski-mark").forEach((mark) => {
        const ski = combined[Number(mark.dataset.skiIndex)];
        const show = () => showTooltip(mark, skiTooltipHtml(ski));
        mark.addEventListener("pointerenter", show);
        mark.addEventListener("focus", show);
        mark.addEventListener("pointerleave", hideTooltip);
        mark.addEventListener("blur", hideTooltip);
      });
    }

    const candidateSearchInput = containerEl.querySelector("#candidate-search");
    const candidateResultsEl = containerEl.querySelector("#candidate-search-results");

    function onCandidateSearchInput() {
      if (!candidateSearchInput || !candidateResultsEl || !getAllSkis) return;
      const query = candidateSearchInput.value.trim().toLowerCase();
      const excludedNames = new Set([...skis.map((s) => s.name), ...candidateSkis.map((s) => s.name)]);
      const matches = getAllSkis()
        .filter((s) => s.name.toLowerCase().includes(query) && !excludedNames.has(s.name))
        .slice(0, 8);

      candidateResultsEl.innerHTML = "";

      if (matches.length === 0) {
        candidateResultsEl.innerHTML = `<li class="no-match">No skis match "${escapeHtml(candidateSearchInput.value)}"</li>`;
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
          if (candidateSkis.length >= MAX_CANDIDATES) return;
          if (candidateSkis.some((s) => s.name === ski.name)) return;
          const next = [...candidateSkis, { ...ski, selected_length_cm: ski.reference_length_cm }];
          candidateSearchInput.value = "";
          candidateResultsEl.hidden = true;
          if (onCandidatesChange) onCandidatesChange(next);
        });
        candidateResultsEl.appendChild(li);
      }

      candidateResultsEl.hidden = false;
    }

    if (candidateSearchInput) {
      candidateSearchInput.addEventListener("input", onCandidateSearchInput);
      candidateSearchInput.addEventListener("focus", onCandidateSearchInput);
    }

    containerEl.querySelectorAll("[data-remove-candidate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = candidateSkis.filter((s) => s.name !== btn.dataset.removeCandidate);
        if (onCandidatesChange) onCandidatesChange(next);
      });
    });

    containerEl.querySelectorAll(".candidate-picker .length-picker").forEach((picker) => {
      const candidate = candidateSkis.find((s) => s.name === picker.dataset.lengthFor);
      if (!candidate) return;
      picker.addEventListener("change", () => {
        candidate.selected_length_cm = Number(picker.value);
        // Mutated in place, same candidateSkis array - re-render without
        // treating this as an add/remove (matches root's wireCoverageMap).
        if (onCandidatesChange) onCandidatesChange(candidateSkis);
      });
    });
  }

  return { renderSection, wire, renderCoverageMapSvg, renderCoverageMapTable, hideTooltip };
}

window.CoverageMap = { create };

})();
