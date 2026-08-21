"use strict";

/* Direction 01 — visual exploration.
   The search and the coverage readout run on the real dataset and the
   real coverage math (see ../README.md), so the page demonstrates the
   actual product rather than mocked copy. */

const WAIST = [
  { key: "narrow", label: "Narrow / firm groomer", min: 60, max: 89 },
  { key: "allmtn", label: "All-mountain", min: 90, max: 109 },
  { key: "wide", label: "Wide / powder", min: 110, max: 130 },
];
const FEEL = [
  { key: "playful", label: "playful", min: 0, max: 33.33 },
  { key: "balanced", label: "balanced", min: 33.33, max: 66.67 },
  { key: "charging", label: "charging", min: 66.67, max: 100 },
];
const METAL = { none: 0, partial: 0.5, full: 1 };
const ROCKER_DEFAULT = {
  full_camber: 5, camber_tip_rocker: 20, camber_tip_tail_rocker: 40,
  flat_tip_tail_rocker: 65, full_rocker: 90,
};

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const rocker = (s) => typeof s.rocker_percent === "number" ? s.rocker_percent : (ROCKER_DEFAULT[s.rocker_profile] ?? 40);

function feelScore(ski) {
  const w = clamp((ski.weight_g - 1500) / (2360 - 1500), 0, 1);
  const m = METAL[ski.metal_content] ?? 0;
  return clamp(w * 65 + m * 35 - (rocker(ski) / 100) * 25, 0, 100);
}

/** Which of the 9 zones this quiver leaves uncovered. Each ski covers a
 *  region (±7mm, ±12 feel points), not just its own point. */
function gaps(quiver) {
  const regions = quiver.map((s) => {
    const f = feelScore(s);
    return {
      xMin: s.waist_width_mm - 7, xMax: s.waist_width_mm + 7,
      yMin: f - 12, yMax: f + 12,
    };
  });
  const out = [];
  for (const f of FEEL) {
    for (const w of WAIST) {
      const covered = regions.some((r) =>
        r.xMin <= w.max && r.xMax >= w.min && r.yMin <= f.max && r.yMax >= f.min);
      out.push({ label: `${w.label} + ${f.label}`, covered });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */

const searchEl = document.getElementById("ski-search");
const resultsEl = document.getElementById("results");
const quiverEl = document.getElementById("quiver");
const readoutEl = document.getElementById("readout");
const readoutList = document.getElementById("readout-list");
const readoutCount = document.getElementById("readout-count");

let all = [];
let quiver = [];
let cursor = -1;

fetch("../data/skis.json")
  .then((r) => r.json())
  .then((d) => { all = d.skis; })
  .catch(() => {
    searchEl.placeholder = "Serve this folder over http to load the catalog";
    searchEl.disabled = true;
  });

function matches() {
  const q = searchEl.value.trim().toLowerCase();
  const taken = new Set(quiver.map((s) => s.name));
  return all.filter((s) => s.name.toLowerCase().includes(q) && !taken.has(s.name)).slice(0, 6);
}

function renderResults() {
  const list = matches();
  cursor = -1;
  if (!searchEl.value.trim() && !document.activeElement.isSameNode(searchEl)) {
    resultsEl.hidden = true;
    return;
  }
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
  quiver.push(ski);
  searchEl.value = "";
  resultsEl.hidden = true;
  renderQuiver();
  renderReadout();
  searchEl.focus();
}

function remove(name) {
  quiver = quiver.filter((s) => s.name !== name);
  renderQuiver();
  renderReadout();
}

function renderQuiver() {
  quiverEl.innerHTML = "";
  quiver.forEach((ski) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${ski.name}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", `Remove ${ski.name}`);
    btn.innerHTML = `<svg viewBox="0 0 12 12" width="9" height="9" fill="none" aria-hidden="true"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
    btn.addEventListener("click", () => remove(ski.name));
    li.appendChild(btn);
    quiverEl.appendChild(li);
  });
}

function renderReadout() {
  if (quiver.length === 0) { readoutEl.hidden = true; return; }
  const zones = gaps(quiver);
  const missing = zones.filter((z) => !z.covered);
  readoutCount.textContent = `${9 - missing.length} of 9 covered`;
  readoutList.innerHTML = "";

  const rows = missing.length ? missing.slice(0, 4) : [zones[0]];
  rows.forEach((z) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span class="zone">${missing.length ? z.label : "Every zone has a ski built for it"}</span>` +
      `<span class="state" data-gap="${missing.length ? "true" : "false"}">${missing.length ? "gap" : "complete"}</span>`;
    readoutList.appendChild(li);
  });
  if (missing.length > 4) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="zone">+ ${missing.length - 4} more uncovered</span><span class="state" data-gap="false">·</span>`;
    readoutList.appendChild(li);
  }
  readoutEl.hidden = false;
}

/* keyboard: a search that can't be driven from the keyboard isn't finished */
searchEl.addEventListener("input", renderResults);
searchEl.addEventListener("focus", renderResults);
searchEl.addEventListener("blur", () => setTimeout(() => { resultsEl.hidden = true; }, 120));
searchEl.addEventListener("keydown", (e) => {
  const items = [...resultsEl.querySelectorAll("li:not(.empty)")];
  if (e.key === "Escape") { resultsEl.hidden = true; searchEl.blur(); return; }
  if (!items.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    cursor = e.key === "ArrowDown"
      ? (cursor + 1) % items.length
      : (cursor - 1 + items.length) % items.length;
    items.forEach((li, i) => li.setAttribute("data-active", String(i === cursor)));
    items[cursor].scrollIntoView({ block: "nearest" });
  }
  if (e.key === "Enter" && cursor >= 0) {
    e.preventDefault();
    const name = items[cursor].firstChild.textContent;
    const ski = all.find((s) => s.name === name);
    if (ski) add(ski);
  }
});
