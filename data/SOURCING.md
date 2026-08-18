# Data sourcing methodology

This is the repeatable process for adding or refreshing a ski's entry in
`skis.json`. Follow it for every new ski so the dataset stays internally
consistent as it grows past 30 — a hand-wavy estimate for ski #40 makes
every comparison involving it wrong in a way nothing else in the app can
catch.

**As of 2026-08-15, source priority changed for *new* data going
forward** (new skis, and the new `length_options` field on existing
skis) — manufacturer spec pages are now the primary source, not
Blister-first. See "Source priority" below for the full reasoning.
Nothing about *already-recorded* entries changes: every existing field
keeps whatever source is already on file against it (often
Blister-measured), and this document's field-by-field rules below still
describe how those entries were built. This is a going-forward change
to how new numbers get added, not a retroactive re-sourcing pass.

## Field-by-field rules

| Field | Rule |
|---|---|
| `name` | Manufacturer's marketing name, as printed (e.g. "Nordica Enforcer 94"). |
| `brand` | Manufacturer, split out for future filtering/search. |
| `model_year` | The season the sourced specs are from (e.g. `"2024-2025"`). Construction changes year to year — the same name can mean a different ski (see Nordica Enforcer 94: the 2024-2025 rebuild added a "Pulse Core" elastomer layer that materially changed its weight and flex vs. the 2020-2021 version). **Prefer the newest model year that has solid, physically-measured data (a Blister Review or equivalent) — don't jump to a newer year just because it's newer if that means falling back to unmeasured manufacturer claims.** An older `model_year` isn't automatically "stale data": many skis go multiple seasons without a construction change, and the recorded year is accurate for as long as that's true. Only bump it when the *construction itself* changed (see "Refreshing an existing ski"). |
| `reference_length_cm` | The specific length the below numbers were measured at. Weight and turn radius both scale with length — a number without a length attached isn't comparable to anything. **Target 180cm** for unisex/men's-marketed lines, **165cm for women's-specific lines** (see `womens_specific` below) — a flat 180cm target for women's models means extrapolating past sizes some of those skis aren't even sold in, which is worse than the inconsistency this rule exists to fix. ~±6cm from the target is acceptable without extra work. Beyond that, look for a second real measured length from the *same* model/variant and linearly interpolate toward the target — never extrapolate beyond the two real points, and never interpolate across two different metal/construction variants (e.g. a standard build and a "Ti" build) even if they share a name. If no second point exists, keep the closest real one and say so plainly in `notes` rather than forcing a number that isn't real. |
| `womens_specific` | Boolean, **only present when `true`** (omit entirely for unisex/men's-marketed lines — absence means false). Marks which entries use the 165cm reference-length target instead of 180cm, so the choice is self-documenting rather than tribal knowledge. |
| `waist_width_mm` | The manufacturer's stated/nominal waist width — i.e. the number in the model name (a "Kore 93" is `93`), not a third-party measured figure. Reviewers like Blister measure the actual underfoot width themselves, and it's often 1-2mm off the catalog number; that's the *right* number for weight (manufacturer claims run optimistic) but the *wrong* one here, since the model name is how a user identifies and searches for the ski — showing a "93" as `95` reads as a bug, not precision. If a source only gives a measured figure, use it, but round to match the name when they're within ~2mm of each other. |
| `weight_g` | **Per ski, not per pair.** At the reference length. For *existing* entries this preferred a source that physically weighs the ski (Blister Review does) over manufacturer-claimed weight, which runs optimistic/rounded — that preference stands for this one reference-length figure specifically (see `length_options` below for why the rest of the size run doesn't get the same treatment). |
| `turn_radius_m` | At the reference length — this is the field most likely to be wrong if pulled from a generic spec blurb instead of a length-specific table; it can vary 3m+ across a model's length range. |
| `length_options` | Optional. Array of `{length_cm, weight_g, turn_radius_m}`, one entry per length the model currently ships in, sourced manufacturer-first (see "Source priority"). Lets the app show how a ski's weight/turn radius — and therefore its stability score and map position — actually shift across its size run, instead of treating every length as identical to the reference length. Include one row that exactly matches this entry's own `reference_length_cm`/`weight_g`/`turn_radius_m` — keep that row's values as whatever's already recorded at the top level (don't overwrite it with a manufacturer number just because the rest of the array is manufacturer-sourced; see "Recording length options"). Omit the whole field for a ski that hasn't been backfilled yet — the app falls back to the single reference-length spec, exactly like before this field existed. |
| `rocker_profile` | One of the 5 categorical values below — not a free-form guess. See "Classifying rocker profile." |
| `metal_content` | `"full"` = full sheet(s) of metal (titanal, etc.) running the length of the ski. `"partial"` = metal used only in specific zones — underfoot only, or a binding-area reinforcement plate (e.g. Head's "Ti" binding reinforcement on otherwise-graphene skis). `"none"` = no metal anywhere in the layup. Don't infer this from marketing buzzwords ("Graphene," "Carbon") — those are often paired with a small metal reinforcement piece that the marketing copy doesn't lead with; check the actual core/construction description. |
| `tail_shape` | One of 3 categorical values — `"directional"` / `"modified_twin"` / `"twin_tip"`. See "Classifying tail shape." Whether a ski can be skied switch is orthogonal to waist width and stability (a twin-tip can be light or heavy, narrow or wide, rockered or not) — the app deliberately does *not* fold this into the coverage-space grid/map; it drives a separate, independent "Park" signal instead. |
| `source` | Short name of the primary source used (e.g. `"Blister Review"`, `"Manufacturer spec page"`). |
| `source_url` | URL of that source, when it's a stable, linkable page. |
| `verified_date` | The date (ISO `YYYY-MM-DD`) this entry was last checked against a source. Lets a future pass find and refresh stale entries instead of re-deriving the whole dataset. |
| `notes` | Optional. Anything a future editor should know that doesn't fit the fields above (e.g. "metal is a binding-area reinforcement plate, not a full sheet"). |

## Source priority

**For new data added from 2026-08-15 onward** (new skis, and
`length_options` on existing ones):

1. **Manufacturer's own spec/geometry page** — first choice. A ski's own
   product page almost always publishes its *entire* size run — every
   length it ships in, with weight and turn radius for each — in one
   table. That's authoritative for `waist_width_mm` and the official
   rocker profile name regardless, and for `length_options` specifically
   it's not just the cheapest source to collect (one page instead of a
   Blister-then-manufacturer decision per length), it's often the *only*
   source that covers every length: Blister only physically weighs 1-2
   sizes per ski they review, so requiring their numbers would leave
   real gaps in the size run no matter what order sources are checked in.
2. **Blister Review** (blisterreview.com) — still the best cross-check
   when available, and still the right source for anything a
   manufacturer page doesn't state plainly (rocker/camber description in
   consistent, brand-agnostic language, tip/tail splay measurements).
   No longer required before falling back to a manufacturer page, though.
3. **Retail spec tables** (evo.com, skimo.co, skiessentials.com) — fallback
   when a manufacturer's own page is missing or incomplete.
4. **realskiers.com** or a second independent reviewer — tie-breaker when
   two sources disagree materially.

*Why the switch:* the previous order put Blister first because their
weight is physically measured and manufacturer-claimed weight runs a
bit optimistic/rounded — that's still true, which is why each existing
entry's own reference-length figures aren't being redone. But this is a
*comparative* tool, not a spec-sheet reference: a small, roughly
consistent optimism bias across a whole size run distorts the relative
differences between lengths (what the app actually uses) far less than
mixing measured and claimed numbers within the same ski would. Combined
with the cost/coverage advantage above, manufacturer-first is the more
practical default for everything added going forward. Most users also
won't distinguish "independently measured" from "manufacturer-claimed"
the way an enthusiast reviewer would — the number printed on the ski's
own spec page is already what they expect to see.

**Practical note on fetching:** Blister Review and evo.com both return
HTTP 403 to direct automated fetches (bot protection) as of this writing.
`WebSearch` queries against those domains still surface accurate figures
via indexed snippets, so prefer search queries like `"<ski name> Blister
Review weight rocker camber specs"` over fetching the URL directly for
those two domains. Retail spec-table sites (skimo.co, etc.) and most
manufacturer sites generally allow direct fetches.

**Practical note on JS-rendered size tables:** most manufacturer and
retail pages render their full per-length spec table client-side from a
length-selector dropdown — a text-only fetch (`WebFetch`/`WebSearch`)
only sees whichever single length happened to be the default, or
nothing at all, even when the page allows direct fetches otherwise.
Confirmed working sources with a full static table readable without
clicking anything: **evo.com** (turn radius per length) and **skis.com**
(weight and turn radius per length) - check these first for
`length_options`. When a source needed for something else is
JS-gated, use an actual rendered browser (navigate to the page, read
its text) instead of a text-fetch tool - the same table that's
invisible to `WebFetch` is usually just sitting there in the rendered
page. **This applies to a delegated research pass (a background agent)
just as much as it does here** - say so explicitly in that pass's
instructions, since an agent won't know to try a browser tool as a
fallback unless told to.

## Classifying rocker profile

Use one of these five values — the same taxonomy manufacturers and
reviewers already use, so classification is "read the description," not
"invent a number":

| `rocker_profile` value | Shape | Typical use |
|---|---|---|
| `full_camber` | Classic camber, no rocker | Racing, downhill freestyle |
| `camber_tip_rocker` | Camber underfoot + tip rocker only | Versatile downhill/all-mountain |
| `camber_tip_tail_rocker` | Camber underfoot + rocker at both tip and tail | Versatile freeride/freestyle/backcountry — the most common all-mountain profile |
| `flat_tip_tail_rocker` | Flat (no camber) underfoot + tip and tail rocker | Freeride, powder-oriented |
| `full_rocker` | Continuous rocker, no camber anywhere ("inverted camber") | Big-mountain freeride, powder-specific, freestyle |

If a source gives exact tip/tail splay (mm) and camber-underfoot (mm)
measurements (Blister often does), record them in the optional
`rocker_tip_splay_mm` / `rocker_tail_splay_mm` / `camber_underfoot_mm`
fields — a positive camber-underfoot number with non-zero tip/tail splay
is `camber_tip_tail_rocker`; zero or negative (flat/reversed)
camber-underfoot with splay is `flat_tip_tail_rocker` or `full_rocker`
depending on degree. These numeric fields are optional and omitted when
the source doesn't report them — don't block an entry on missing them.

## Classifying tail shape

Use one of three values, matching terminology sources already use rather
than inventing new labels:

| `tail_shape` value | Shape | Notes |
|---|---|---|
| `directional` | Tail is flat, minimally rockered, or tapered — built to ski forward only | Most all-mountain/frontside/touring skis land here |
| `modified_twin` | Tail has real, measurable rocker/upturn, but is asymmetric vs. the tip (narrower tail width, shallower rocker, or a rearward mount point) — some switch capability, but not a park ski | Common on "freeride with playful DNA" skis — about 40% of this dataset as of the initial backfill |
| `twin_tip` | Tip and tail are symmetrically rockered (comparable splay, near-center mount) — genuinely park-capable | Rare outside dedicated park/freestyle lines — only 2 of 50 skis in this dataset as of the initial backfill |

A source's stated mount point (distance from true center, e.g. "-9.5cm")
and measured tip/tail splay (mm) are the most reliable signals: a
near-center mount (within ~3cm) with comparable tip/tail splay is
`twin_tip`; a clearly rearward mount (>8cm) with much shallower or no
tail rocker is `directional`; real but asymmetric tail rocker in between
is `modified_twin`. Brand-line naming is a strong hint (Dynastar's
M-Free vs. M-Pro; Fischer's twin-tip "FR" sub-line vs. directional "Ti")
but always verify per-model — some brands sell both shapes under similar
naming, and shape changes across redesigns (K2's Mindbender Ti line
moved from a more twin-ish shape to a more directional one in its
2022-23 redesign).

## Recording length options (per-length weight/turn radius)

1. Check evo.com and skis.com first (see "Practical note on JS-rendered
   size tables" above) — both have reliably exposed a full, static
   per-length table for every ski tried so far. Fall back to the
   manufacturer's own page, or another retailer, only if neither has
   the model.
2. Record every length listed, with that length's weight and turn
   radius exactly as published — no interpolation, no estimating a
   length the source doesn't list.
3. **Cross-check at least one non-reference length against a second,
   independent source** before trusting the table — don't record a
   whole size run off a single source. This is a step down from
   Blister-measured data already (see "Source priority"); a single
   unverified source compounds that.
4. **Sanity-check the weight column against a per-pair mislabel.**
   Some sites label a per-pair figure as if it were per-ski without
   saying so — caught once already: a "Ski Weight" column turned out to
   be per-pair because halving it landed exactly on an already-known
   per-ski figure. If a sourced weight is roughly double what's
   plausible for a ski that size (rough gut-check: compare against
   similar skis already in the dataset), treat it as probably per-pair,
   halve it, and say so in `notes` - or find a source that states the
   unit unambiguously.
5. One row should match the entry's existing `reference_length_cm`
   exactly. Don't overwrite that row's `weight_g`/`turn_radius_m` with
   the new source's number even if it differs slightly - the existing
   top-level fields keep whatever source they already have (often
   Blister-measured); this array exists to add the *other* lengths, not
   to re-litigate the one already sourced.
6. **If that row doesn't match** (not just a rounding difference, but a
   real disagreement), treat it as a red flag on the *entire* table, not
   just that one row - it usually means the source is describing a
   different model year or variant than the one already recorded. Don't
   use the rest of the array without resolving why it disagrees; note
   the discrepancy plainly rather than silently trusting the other rows.
7. Run the monotonicity check below - within one ski, weight and turn
   radius should both increase as length increases. A break in that
   pattern almost always means a transcription error (wrong row, mixed-
   up lengths), not a real property of the ski.
   ```
   python -c "
   import json
   d = json.load(open('data/skis.json'))
   for s in d['skis']:
       opts = s.get('length_options')
       if not opts or len(opts) < 2: continue
       ordered = sorted(opts, key=lambda o: o['length_cm'])
       for a, b in zip(ordered, ordered[1:]):
           if b['weight_g'] <= a['weight_g']:
               print(s['name'], 'weight not increasing:', a, b)
           if b['turn_radius_m'] < a['turn_radius_m']:
               print(s['name'], 'turn radius decreasing:', a, b)
   "
   ```
8. Set `verified_date` as usual.

## Adding a new ski

1. Search `"<name> official specs size chart"` (manufacturer page first,
   per the current source priority) — or `"<name> Blister Review weight
   rocker camber specs"` if a manufacturer page doesn't cover something
   (rocker/camber description, tip/tail splay).
2. If metal content or rocker profile is ambiguous from that result, run
   one follow-up search specifically for construction/core details.
3. Cross-check `waist_width_mm` and `turn_radius_m` against a second
   source if the manufacturer page didn't state them plainly for the
   reference length.
4. Fill in every field above; leave optional numeric rocker fields out
   rather than guessing them.
5. Set `verified_date` to today.
6. Check the new entry's `(waist_width_mm, weight_g, metal_content,
   rocker_percent)` tuple against every other entry - these four fields
   are the only ones the app's scoring reads, so an exact match on all
   four means two different skis will render as a single indistinguishable
   mark on the coverage map. Found once already: a manufacturer-claimed
   weight got recorded instead of Blister's measured figure for one ski,
   and it happened to exactly match a different ski's real spec on all
   four fields. A quick way to check the whole dataset at once:
   ```
   python -c "
   import json
   d = json.load(open('data/skis.json'))
   seen = {}
   for s in d['skis']:
       key = (s['waist_width_mm'], s['weight_g'], s['metal_content'], s['rocker_percent'])
       seen.setdefault(key, []).append(s['name'])
   for k, v in seen.items():
       if len(v) > 1: print(k, v)
   "
   ```

## Refreshing an existing ski

Re-run the same process; only update `model_year` if the construction
actually changed (check the source's stated model year against the
existing entry — a re-skin with no spec change isn't worth a new row).

## Freshness audit (periodic, not per-ski)

Separately from adding new skis, periodically check whether a *newer*
model year exists for entries already in the dataset, and whether it has
a solid measured source yet:

1. Search `"<name> Blister Review <current model year>"`.
2. If a newer model year has a real review with measured data, and the
   construction changed enough to matter (metal content, or weight/radius
   drifting far enough to plausibly cross a bucket boundary), refresh the
   entry per "Refreshing an existing ski" above.
3. If the newer year exists but only has manufacturer claims (no
   independent measurement yet), leave the entry as-is — the older,
   measured data is more trustworthy than the newer, unmeasured data.
4. If nothing changed, just bump `verified_date` so the entry doesn't
   look untouched forever.

## Scaling up: batching new entries

Growing the catalog by dozens or hundreds of skis at once carries a
different risk than backfilling `length_options` onto an *existing*
entry: a new ski has no already-recorded reference figure to sanity-
check a fresh source against, so nothing catches a mislabeled or
mis-scaled number the way the reference-length row does for
`length_options`. Manage that with pacing, not just per-ski care:

1. **Work in batches, not one continuous pass.** Start smaller (10-15
   skis) for the first batch or two under a newly-changed process, to
   confirm it actually holds up before committing to a larger size;
   ~25-30 per batch is reasonable once it has.
2. **Run both automated checks against the whole file after every
   batch**, not just on the skis just added - the duplicate-tuple check
   under "Adding a new ski" and the monotonicity check under "Recording
   length options." Both are cheap, catch a real class of transcription
   error automatically, and scale with the dataset for free.
3. **Spot-check a sample against the original source, not the whole
   batch.** A systemic problem (a units mix-up, a misread column, a
   research pass consistently getting one field wrong) shows up
   repeatedly and a handful of checks per batch will catch it just as
   reliably as reviewing all 25-30 would - and unlike a full review,
   spot-checking a small sample is something that stays rigorous
   instead of quietly becoming a skim after a few rounds.
4. Only start the next batch once the current one's checks are clean.
