"use strict";

/* ------------------------------------------------------------------ *
 *  Shared condition-cards component — the "what's your quiver built
 *  for" status grid (Groomers / All-Mountain / Powder / Park) and the
 *  plain-language TL;DR summary paragraph above it. Same portability
 *  approach as coverage-map.js: pure render functions returning HTML
 *  strings against a fixed class contract (.condition-card,
 *  .quiver-summary, ...), so each visual direction supplies its own
 *  CSS for those classes rather than re-deriving the logic. See
 *  ROADMAP.md "Phase 1."
 *
 *  Depends on scoring.js (window.QuiverScoring) being loaded first.
 *  No DOM wiring needed - these are pure render functions, no
 *  interactivity (see root app.js: condition cards are static once
 *  rendered, unlike the coverage map's tooltip/toggle/picker).
 *
 *  Usage from a page:
 *    const cc = window.ConditionCards.create({ escapeHtml });
 *    section.innerHTML = cc.renderConditionCardsSection(grid, quiverSkis);
 *    summarySection.innerHTML = cc.renderQuiverSummarySection(grid, gaps, redundant, gapSuggestions);
 * ------------------------------------------------------------------ */

(function () {

const {
  WAIST_BUCKETS,
  STAB_BUCKETS,
  REDUNDANCY_THRESHOLD,
  bucketDescription,
  bucketLabel,
  suggestSkisForBucket,
  statusMeta,
} = window.QuiverScoring;

function defaultEscapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function create(opts = {}) {
  const escapeHtml = opts.escapeHtml || defaultEscapeHtml;

  /**
   * The Park card, unlike the 3 above, isn't derived from the grid at
   * all - tail_shape is orthogonal to waist/temperament (see
   * data/SOURCING.md), so this reads the quiver's raw ski list
   * directly instead of a bucket. 3 states instead of the other
   * cards' plain yes/no, because tail_shape itself is 3-valued: a
   * `modified_twin` genuinely has some switch capability without
   * being a park ski, and collapsing that into a binary would
   * misrepresent it either way.
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
   * today" - instead of an abstract axis grid. Deliberately just a
   * yes/no per condition (Park excepted - see renderParkCard), no
   * recommendations on the card itself.
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
      <h3>What's your quiver built for?</h3>
      <p class="map-caption">The most common ski days, and which of your skis (if any) covers each.</p>
      <div class="condition-cards">${cards}${renderParkCard(quiverSkis)}</div>
    `;
  }

  /**
   * The 3x3 grid sliced into "bands": 3 rows (fixed temperament,
   * varying width) and 3 columns (fixed width, varying temperament).
   * A band that's fully covered or fully empty describes as one clean
   * span ("nothing playful, at any width") instead of listing three
   * buckets one by one - used by both halves of the summary below.
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
    return `<p class="quiver-summary-text">${text}</p>`;
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
   * The original bullet-point gap/redundancy list, kept as a
   * collapsible fallback under the visual dashboard (map, condition
   * cards) - the same numbers in plain sentences, for anyone who wants
   * the raw per-bucket detail instead of the summarized view.
   */
  function renderDetailsSection(gaps, redundant, quiverNames, allSkis) {
    const gapItems =
      gaps.length === 0
        ? `<li class="result-item ok"><span class="status-icon status-good" aria-hidden="true">✓</span><span>No gaps — every bucket has at least one ski covering it.</span></li>`
        : gaps
            .map((cell) => {
              const suggestions = suggestSkisForBucket(allSkis, cell.waistBucket, cell.stabBucket, quiverNames, 2);
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

  return { renderConditionCardsSection, renderQuiverSummarySection, renderDetailsSection };
}

window.ConditionCards = { create };

})();
