"use strict";

/* Candidate scoring formulas for the temperament axis.
 *
 * Each returns 0-100 where higher = damper / more charging. They are
 * kept side by side so a change can be judged against the current
 * shipped model rather than argued about in the abstract.
 *
 * Shared inputs, all already in data/skis.json:
 *   weight_g          published by every manufacturer
 *   metal_content     none | partial | full  (a judgement call)
 *   rocker_percent    tip% + tail%, or a per-category midpoint
 *   waist_width_mm    only used by candidates that couple rocker to width
 */

const METAL = { none: 0, partial: 0.5, full: 1 };
const ROCKER_DEFAULT = {
  full_camber: 5, camber_tip_rocker: 20, camber_tip_tail_rocker: 40,
  flat_tip_tail_rocker: 65, full_rocker: 90,
};

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const rocker = (s) =>
  typeof s.rocker_percent === "number" ? s.rocker_percent : (ROCKER_DEFAULT[s.rocker_profile] ?? 40);
const metal = (s) => METAL[s.metal_content] ?? 0;

const FORMULAS = [
  {
    id: "current",
    name: "Current (shipped)",
    note:
      "Weight 65 / metal 35, minus up to 25 for rocker. Normalised 1500-2360g, " +
      "which is the observed range of this exact dataset.",
    score: (s) =>
      clamp(
        clamp((s.weight_g - 1500) / 860, 0, 1) * 65 +
          metal(s) * 35 -
          (rocker(s) / 100) * 25,
        0, 100
      ),
  },
  {
    id: "rebalanced",
    name: "Rebalanced",
    note:
      "Metal drops 35 -> 22 because it is a proxy for dampness, not dampness " +
      "itself; weight carries more. Wider 1400-2400g range so future heavier " +
      "skis still separate, softer rocker pull, and a +8 offset so nothing " +
      "clamps to a floor of zero.",
    score: (s) =>
      clamp(
        clamp((s.weight_g - 1400) / 1000, 0, 1) * 72 +
          metal(s) * 22 -
          (rocker(s) / 100) * 18 +
          8,
        0, 100
      ),
  },
  {
    id: "width-aware",
    name: "Width-aware rocker",
    note:
      "Same as Rebalanced, but the rocker penalty scales down as a ski gets " +
      "wider. Rocker correlates with width, so a flat penalty punishes wide " +
      "skis twice - which is why wide+charging is currently unreachable.",
    score: (s) => {
      // a 130mm ski keeps ~45% of the penalty a 60mm ski takes
      const widthRelief = 1 - clamp((s.waist_width_mm - 60) / 70, 0, 1) * 0.55;
      return clamp(
        clamp((s.weight_g - 1400) / 1000, 0, 1) * 72 +
          metal(s) * 22 -
          (rocker(s) / 100) * 18 * widthRelief +
          8,
        0, 100
      );
    },
  },
  {
    id: "density",
    name: "Weight per width",
    note:
      "Uses grams per mm of waist instead of raw grams. A 2200g/115mm powder " +
      "ski and a 2200g/85mm carver are very different skis; raw weight treats " +
      "them alike. Metal and rocker enter as before.",
    score: (s) => {
      const density = s.weight_g / s.waist_width_mm; // ~15-26 g/mm in practice
      return clamp(
        clamp((density - 15) / 11, 0, 1) * 72 +
          metal(s) * 22 -
          (rocker(s) / 100) * 18 +
          8,
        0, 100
      );
    },
  },
];

const WAIST_BUCKETS = [
  { key: "narrow", label: "Narrow", min: 60, max: 89 },
  { key: "allmtn", label: "All-mtn", min: 90, max: 109 },
  { key: "wide", label: "Wide", min: 110, max: 130 },
];
const FEEL_BUCKETS = [
  { key: "playful", label: "playful", min: 0, max: 33.33 },
  { key: "balanced", label: "balanced", min: 33.33, max: 66.67 },
  { key: "charging", label: "charging", min: 66.67, max: 100 },
];

const waistBucket = (s) =>
  WAIST_BUCKETS.find((b) => s.waist_width_mm >= b.min && s.waist_width_mm <= b.max) ||
  WAIST_BUCKETS[WAIST_BUCKETS.length - 1];
const feelBucket = (v) =>
  FEEL_BUCKETS.find((b) => v >= b.min && v < b.max) || FEEL_BUCKETS[FEEL_BUCKETS.length - 1];

if (typeof module !== "undefined") {
  module.exports = { FORMULAS, WAIST_BUCKETS, FEEL_BUCKETS, waistBucket, feelBucket, rocker, metal };
}
