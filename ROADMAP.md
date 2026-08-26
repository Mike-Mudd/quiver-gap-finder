# Roadmap

**Goal:** a polished tool that skiers share organically — good enough that
people pass it around ski forums and to friends. Not a revenue product, not
a platform. That bar is what makes several popular ideas *not* worth
building; see "Deliberately not doing" below.

**Capacity assumed:** a few hours across evenings and weekends. Estimates
below are in "focused weekend-equivalents" — at this pace expect roughly
2–3× that in calendar time.

**Where things stand (2026-08-25):** positioning is validated. The 1–2 ski
owner deciding on their next pair is the audience, they've used it, and
they like it. Everything here assumes that stays true.

---

## The core problem right now

Two halves that don't touch:

- **The shipped app** (repo root) works but has no visual identity.
  20 render functions: coverage map, condition cards, candidate
  comparison, interest bias, length pickers, details section.
- **v7** has the identity but almost no product. 4 functions: search,
  chips, and a one-line readout.

The scoring engine is the asset that survives all of this. Seven pure
functions — `effectiveSpecs`, `stabilityScore`, `coverageRegion`,
`interestAffinity`, `buildGrid`, `bucketFitDistance`,
`selectTopSuggestionsForMap` — with no DOM and no framework. They port
untouched into any future UI.

---

## Phase 1 — Migrate the product into v7

**Nothing else starts until this is done.** Everything below assumes one
coherent site rather than two prototypes.

Port into v7's charcoal-on-snow system:

1. **Coverage map** — the hard one, and the feature every tester
   responded to. Two SVG geometry profiles (compact + full), the
   `?debug=1`-era touch fixes, and the accessible table twin. Do not
   rebuild these behaviours from scratch; they cost real debugging.
2. **Condition cards** — the status-coded grid, plus the separate Park
   card driven by `tail_shape`.
3. **Candidate comparison** — "what if I added this" search.
4. **Interest bias chips** — Trees / Powder / Speed.
5. **Length pickers** — per-ski, feeding `effectiveSpecs`.
6. **Details section** — the plain-language gap and redundancy list.

Re-theming, not re-logic. The charcoal/paper palette replaces the
status-tint system, which needs care: status colour currently carries
meaning (see `DESIGN.md`, The Reserved Signal Rule), and that rule has
to survive the move.

**~2–3 weekends.**

---

## Phase 2 — Shareable quivers, no backend

The highest-value request, and it does **not** need accounts.

- **Encode the quiver in the URL** — `?skis=nordica-enforcer-94,atomic-bent-110`.
  Gives shareable links, bookmarkable state, and back-button history for
  free. No database, no login, no privacy policy.
- **`localStorage`** so a returning visitor keeps their quiver without
  needing the link.

This covers the real jobs people described: "send my quiver to a friend"
and "don't make me type it in again."

**~1 weekend.**

---

## Phase 3 — Where to buy

Link out per ski to a retailer (evo, Skis.com), affiliate-tagged.

**Deliberately not showing prices.** Prices change weekly, go on sale,
and sell out by size. The dataset has no price field today, and a stale
price is worse than none — it directly undermines the sourcing
discipline that makes this tool credible. A link answers "where do I buy
this" without claiming a number that can rot.

**~1 weekend.**

---

## Phase 4 — The dataset (the real bottleneck)

61 skis across 20 brands is thin for a buyer doing serious research. The
failure mode is specific: someone searches a ski you don't have, and
leaves.

- **Grow toward ~120–150 skis.** Prioritise by what people search for
  rather than by brand completeness.
- **Freshness matters as much as size.** `verified_date` exists because
  specs change every season. A tool claiming "sourced, never estimated"
  with three-year-old specs is broken in the way that matters most.

This is the least glamorous item and the most important. It is also the
one that resists being sped up — batch 1 cost ~278k tokens for 12 skis,
and the mechanical+formula hybrid in `data/SOURCING.md` exists because
of that.

**Ongoing. Weeks of calendar time, not a weekend.**

---

## Worth adding, not yet requested

- **"Why this ski"** — the recommendation names a pick without showing
  its reasoning. This audience is research-minded and the data to
  explain it already exists (`bucketFitDistance`, the gap it fills).
- **Honest empty states** — when the catalog genuinely can't fill a gap,
  say so. `selectTopSuggestionsForMap` already returns `uncoveredCount`;
  it just isn't surfaced prominently.
- **The rename.** Still deferred (see `PRODUCT.md`). "Quiver" presupposes
  a collection, which works against the 1–2 ski audience at the very
  first touchpoint. Worth resolving before any wider push, since it's
  cheapest to change before people have bookmarked and shared links.

---

## Deliberately not doing

Each of these is a reasonable idea that the stated goal rules out:

- **Accounts / login.** Auth, a database, GDPR, password resets, and
  support burden — for a tool used a few times a season. URL sharing plus
  `localStorage` delivers the actual benefit. Revisit only if people ask
  specifically for cross-device access *without* a link.
- **Live prices.** An ongoing data operation, not a feature. Needs a
  retailer API or scraping plus a refresh job, and a wrong price costs
  more credibility than it earns clicks.
- **Community submissions / public profiles.** Moderation, trust systems,
  and a backend. A different product.

---

## Timeline

| | Weekend-equivalents |
|---|---|
| Phase 1 — migrate product into v7 | 2–3 |
| Phase 2 — URL + localStorage sharing | 1 |
| Phase 3 — affiliate retailer links | 1 |
| Phase 4 — dataset to ~120 skis | ongoing |
| **To a shareable public launch** | **5–7, plus dataset** |

At a few hours a week, that's roughly **3–4 months of calendar time** to
a launch worth sharing — with the dataset continuing past it.

The sequencing matters more than the estimates: Phase 1 unblocks
everything, Phase 4 runs in parallel from the start, and Phases 2–3 are
small enough to slot in whenever.
