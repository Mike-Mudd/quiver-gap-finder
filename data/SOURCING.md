# Data sourcing methodology

This is the repeatable process for adding or refreshing a ski's entry in
`skis.json`. Follow it for every new ski so the dataset stays internally
consistent as it grows past 30 — a hand-wavy estimate for ski #40 makes
every comparison involving it wrong in a way nothing else in the app can
catch.

## Field-by-field rules

| Field | Rule |
|---|---|
| `name` | Manufacturer's marketing name, as printed (e.g. "Nordica Enforcer 94"). |
| `brand` | Manufacturer, split out for future filtering/search. |
| `model_year` | The season the sourced specs are from (e.g. `"2024-2025"`). Construction changes year to year — the same name can mean a different ski (see Nordica Enforcer 94: the 2024-2025 rebuild added a "Pulse Core" elastomer layer that materially changed its weight and flex vs. the 2020-2021 version). Always record which year's specs you used; prefer the current or most recent model year. |
| `reference_length_cm` | The specific length the below numbers were measured at. Weight and turn radius both scale with length — a number without a length attached isn't comparable to anything. Pick the length closest to ~180-186cm that the source actually tested/measured (don't interpolate). |
| `waist_width_mm` | The manufacturer's stated/nominal waist width — i.e. the number in the model name (a "Kore 93" is `93`), not a third-party measured figure. Reviewers like Blister measure the actual underfoot width themselves, and it's often 1-2mm off the catalog number; that's the *right* number for weight (manufacturer claims run optimistic) but the *wrong* one here, since the model name is how a user identifies and searches for the ski — showing a "93" as `95` reads as a bug, not precision. If a source only gives a measured figure, use it, but round to match the name when they're within ~2mm of each other. |
| `weight_g` | **Per ski, not per pair.** Prefer a source that physically weighs the ski (Blister Review does) over manufacturer-claimed weight, which runs optimistic/rounded. |
| `turn_radius_m` | At the reference length — this is the field most likely to be wrong if pulled from a generic spec blurb instead of a length-specific table; it can vary 3m+ across a model's length range. |
| `rocker_profile` | One of the 5 categorical values below — not a free-form guess. See "Classifying rocker profile." |
| `metal_content` | `"full"` = full sheet(s) of metal (titanal, etc.) running the length of the ski. `"partial"` = metal used only in specific zones — underfoot only, or a binding-area reinforcement plate (e.g. Head's "Ti" binding reinforcement on otherwise-graphene skis). `"none"` = no metal anywhere in the layup. Don't infer this from marketing buzzwords ("Graphene," "Carbon") — those are often paired with a small metal reinforcement piece that the marketing copy doesn't lead with; check the actual core/construction description. |
| `source` | Short name of the primary source used (e.g. `"Blister Review"`, `"Manufacturer spec page"`). |
| `source_url` | URL of that source, when it's a stable, linkable page. |
| `verified_date` | The date (ISO `YYYY-MM-DD`) this entry was last checked against a source. Lets a future pass find and refresh stale entries instead of re-deriving the whole dataset. |
| `notes` | Optional. Anything a future editor should know that doesn't fit the fields above (e.g. "metal is a binding-area reinforcement plate, not a full sheet"). |

## Source priority

1. **Blister Review** (blisterreview.com) — first choice. They physically
   weigh every ski and describe rocker/camber profile in consistent,
   brand-agnostic language across every model, which is exactly what the
   categorical `rocker_profile` field needs. Covers nearly every ski in
   this dataset's price/popularity tier.
2. **Manufacturer's own spec/geometry page** — authoritative for
   `waist_width_mm`, `turn_radius_m`, and the official rocker profile
   name. Treat manufacturer-claimed `weight_g` with more skepticism than
   Blister's measured figure.
3. **Retail spec tables** (evo.com, skimo.co, skiessentials.com) — good
   fallback when Blister hasn't reviewed a specific model, or to
   cross-check a manufacturer number.
4. **realskiers.com** or a second independent reviewer — tie-breaker when
   two sources disagree materially.

**Practical note on fetching:** Blister Review and evo.com both return
HTTP 403 to direct automated fetches (bot protection) as of this writing.
`WebSearch` queries against those domains still surface accurate figures
via indexed snippets, so prefer search queries like `"<ski name> Blister
Review weight rocker camber specs"` over fetching the URL directly for
those two domains. Retail spec-table sites (skimo.co, etc.) generally
allow direct fetches.

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

## Adding a new ski

1. Search `"<name> Blister Review weight rocker camber specs"`.
2. If metal content or rocker profile is ambiguous from that result, run
   one follow-up search specifically for construction/core details.
3. Cross-check `waist_width_mm` and `turn_radius_m` against a second
   source if Blister didn't state them plainly for the reference length.
4. Fill in every field above; leave optional numeric rocker fields out
   rather than guessing them.
5. Set `verified_date` to today.

## Refreshing an existing ski

Re-run the same process; only update `model_year` if the construction
actually changed (check the source's stated model year against the
existing entry — a re-skin with no spec change isn't worth a new row).
