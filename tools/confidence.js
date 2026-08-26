"use strict";

/* Turning a continuous temperament score into an honest label.
 *
 * The problem this solves: only ~21% of the catalog sits confidently
 * inside a bucket. 26% are within 5 points of a boundary, where a
 * 1-point input change flips the word shown to the user. Rendering that
 * as one confident word out of three is over-precise for the data.
 *
 * These helpers keep the same buckets and the same maths, and change
 * only what gets *said* about a score.
 */

const BANDS = [
  { key: "playful",  label: "playful",  min: 0,     max: 33.33 },
  { key: "balanced", label: "balanced", min: 33.33, max: 66.67 },
  { key: "charging", label: "charging", min: 66.67, max: 100 },
];

// Inside this many points of a boundary, the label is not trustworthy
// enough to state on its own. 5 points is roughly 66g of weight or a
// third of a metal step — i.e. within normal sourcing error.
const UNSURE_PTS = 5;

function band(v) {
  return BANDS.find((b) => v >= b.min && v < b.max) || BANDS[BANDS.length - 1];
}

function neighbour(v) {
  const boundaries = [33.33, 66.67];
  let nearest = null, dist = Infinity;
  boundaries.forEach((b) => {
    const d = Math.abs(v - b);
    if (d < dist) { dist = d; nearest = b; }
  });
  const here = band(v);
  const other = v < nearest ? BANDS[BANDS.indexOf(here) + 1] : BANDS[BANDS.indexOf(here) - 1];
  return { dist, other: other || null };
}

/** How much to trust the single-word label. */
function confidence(v) {
  const { dist } = neighbour(v);
  if (dist >= 15) return "high";
  if (dist >= UNSURE_PTS) return "medium";
  return "low";
}

/** The phrase to actually show a user. */
function phrase(v) {
  const here = band(v);
  const { dist, other } = neighbour(v);
  if (dist >= 15) return `Clearly ${here.label}`;
  if (dist >= UNSURE_PTS) return `Leans ${here.label}`;
  if (!other) return `Leans ${here.label}`;
  // always read low-to-high, so the phrase does not flip depending on
  // which side of the boundary the score happens to fall
  const [lo, hi] = BANDS.indexOf(other) < BANDS.indexOf(here) ? [other, here] : [here, other];
  return `Between ${lo.label} and ${hi.label}`;
}

/** Which zones a ski covers.
 *
 *  An earlier version of this switched on `dist < UNSURE_PTS`, which
 *  simply relocated the cliff: a ski drifting from 6 points off a
 *  boundary to 4 gained an entire zone in one step. That is the same
 *  brittleness the buckets already had.
 *
 *  The coverage map solved this properly a long time ago by giving each
 *  ski a ±12pt REGION rather than a point, so a ski near a line
 *  genuinely overlaps both sides and nothing snaps. This reuses that
 *  idea, so the label and the map agree by construction. */
const FEEL_RADIUS = 12; // matches STAB_RADIUS in the shipped app

function zonesCovered(v) {
  const lo = v - FEEL_RADIUS, hi = v + FEEL_RADIUS;
  return BANDS.filter((b) => lo <= b.max && hi >= b.min).map((b) => b.key);
}

/** Plain facts from the inputs — unarguable, unlike the label. */
function because(s, rocker) {
  const bits = [];
  if (s.weight_g >= 2050) bits.push("heavy");
  else if (s.weight_g <= 1750) bits.push("light");
  else bits.push("mid-weight");

  if (s.metal_content === "full") bits.push("full metal");
  else if (s.metal_content === "partial") bits.push("some metal");
  else bits.push("no metal");

  const r = rocker(s);
  if (r >= 55) bits.push("heavily rockered");
  else if (r <= 25) bits.push("low rocker");
  else bits.push("moderate rocker");
  return bits.join(", ");
}

if (typeof module !== "undefined") {
  module.exports = { BANDS, UNSURE_PTS, band, neighbour, confidence, phrase, zonesCovered, because };
}
