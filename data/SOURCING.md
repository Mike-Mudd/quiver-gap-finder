# Data sourcing methodology

How to add or refresh a ski in `skis.json`.

**The governing principle:** spend effort where it changes what the user
sees. It was measured, not assumed. Under the app's scoring, a one-step
error in `metal_content` changes coverage for **46 of 61 skis**; a ±50g
weight error changes it for **16**; a ±10pt rocker error, for **11**.

So: take manufacturer weight, take the rocker category default, and
spend the time you save reading the construction description carefully.

```
python data/check.py
```

Run that after every change. It catches duplicate scoring inputs,
non-monotonic length tables, and lists the near-boundary skis where
precision actually pays.

---

## The three inputs that matter

Only four fields feed the scoring: `waist_width_mm`, `weight_g`,
`metal_content`, and rocker. Everything else is display or provenance.

### `metal_content` — the one to get right

`"full"` · full-length sheet(s) of metal (titanal, etc.)
`"partial"` · metal in specific zones only — underfoot, or a
binding-area reinforcement plate
`"none"` · no metal anywhere in the layup

**Read the core/construction description, not the marketing name.**
Buzzwords like "Graphene" or "Carbon" are routinely paired with a metal
reinforcement the copy doesn't lead with. Real example: the Salomon
QST 106 was recorded as `none`, but its spec sheet says *"titanal
binding reinforcement"* — that is `partial` by the definition above.

Where the answer usually lives, in order:

1. The manufacturer's construction/tech section
2. A Blister review's "Core" line — states the full layup plainly,
   e.g. *"poplar/beech + titanal (2 layers) + carbon tips"*
3. A retail spec table's construction row

If two sources disagree on the layup, note it and pick the one that
describes the actual materials rather than the marketing name.

### `weight_g` — manufacturer stated, per ski

Take the manufacturer's published figure at `reference_length_cm`. Do
not hunt for an independently measured number.

Manufacturer weights run slightly optimistic, but consistently so, and
this is a comparative tool — a uniform bias barely moves relative
positions. A previously recorded 33g correction on the Unleashed 108
changed nothing about what the app showed.

**Per ski, not per pair.** If a figure looks roughly double what's
plausible, it is probably per-pair; halve it and say so in `notes`.

### Rocker — use the category default

Classify into one of five profiles and let the app's midpoint stand.
Only source an exact tip/tail split when `check.py` flags the ski as
near-boundary.

| `rocker_profile` | Shape |
|---|---|
| `full_camber` | Classic camber, no rocker |
| `camber_tip_rocker` | Camber underfoot + tip rocker |
| `camber_tip_tail_rocker` | Camber underfoot + tip and tail rocker (most common) |
| `flat_tip_tail_rocker` | Flat underfoot + tip and tail rocker |
| `full_rocker` | Continuous rocker, no camber |

`rocker_percent` is tip% + tail% of ski length. When you do source it,
positive camber underfoot with splay at both ends is
`camber_tip_tail_rocker`; flat or reversed camber with splay is
`flat_tip_tail_rocker` or `full_rocker` by degree.

---

## Every field

| Field | Rule |
|---|---|
| `name` | Marketing name as printed, e.g. "Nordica Enforcer 94". |
| `brand` | Manufacturer. |
| `model_year` | The season these specs describe, e.g. `"2024-2025"`. Construction changes between years — the same name can be a different ski. Bump it only when the construction actually changed, not because a newer year exists. |
| `reference_length_cm` | The length the numbers below were measured at. Weight and turn radius both scale with length, so a number without one isn't comparable. Target **180cm**, or **165cm** for women's-specific lines; ±6cm is fine. Beyond that, interpolate between two real lengths of the *same* variant — never extrapolate, and never interpolate across construction variants (a standard build and a "Ti" build). If there's only one real length, keep it and say so in `notes`. |
| `womens_specific` | Only present when `true`. Marks entries using the 165cm target. |
| `waist_width_mm` | The **stated** width — the number in the model name. A "Kore 93" is `93`, even if measured at 94.2mm. Users search by the name; showing `94` reads as a bug. |
| `weight_g` | Manufacturer stated, per ski, at the reference length. See above. |
| `turn_radius_m` | At the reference length. Varies 3m+ across a size run, so take it from a length-specific table, never a generic blurb. |
| `length_options` | Optional array of `{length_cm, weight_g, turn_radius_m}`. See below. |
| `rocker_profile` | One of the five values above. |
| `rocker_percent` | Tip% + tail%. Category default is fine unless flagged near-boundary. |
| `metal_content` | `full` / `partial` / `none`. See above — this is the one that matters. |
| `tail_shape` | `directional` / `modified_twin` / `twin_tip`. Drives the separate Park signal, not the coverage grid. See below. |
| `source`, `source_url` | Where the primary numbers came from. |
| `verified_date` | ISO date this was last checked. Lets a later pass find stale entries. |
| `notes` | Anything a future editor needs — ambiguous figures, corrections made, estimates flagged. |

### `tail_shape`

| Value | Shape |
|---|---|
| `directional` | Flat, minimally rockered, or tapered tail — forward only |
| `modified_twin` | Real tail rocker but asymmetric to the tip — some switch ability |
| `twin_tip` | Symmetric tip and tail, near-centre mount — genuinely park-capable |

Mount point and tip/tail splay are the reliable signals: near-centre
(within ~3cm) with comparable splay is `twin_tip`; clearly rearward
(>8cm) with little tail rocker is `directional`. Verify per model —
shape changes across redesigns.

---

## Sources

1. **Manufacturer spec page** — first choice. Usually publishes the
   whole size run in one table, and is authoritative for stated width,
   weight, and the official rocker name.
2. **Blister Review** — best source for construction detail and layup,
   which is exactly what `metal_content` needs.
3. **Retail tables** (evo.com, skis.com) — reliable per-length data.
4. **A second reviewer** — tie-breaker when sources disagree materially.

**Fetching:** Blister and evo return HTTP 403 to automated fetches. Use
`WebSearch` against those domains, or open them in a real browser.

**JS-rendered tables:** most per-length spec tables render client-side,
so a text-only fetch sees one length or none. evo.com and skis.com
expose static tables that read fine. Otherwise use a rendered browser —
the table invisible to `WebFetch` is usually just sitting there. Say
this explicitly when delegating research to an agent; it won't know to
try a browser as a fallback.

---

## `length_options`

Optional per-length data, so the app can show how a ski shifts across
its size run instead of treating every length as the reference.

1. Check evo.com and skis.com first — both reliably expose full static
   tables. If neither lists the model, skip it.
2. Record every length with its **real published turn radius**. Never
   estimate turn radius: per-ski scaling varies over 4× (0.05–0.21
   m/cm), so no universal rate is safe. If a length has no published
   radius, leave that length out.
3. Take manufacturer weight per length where published. Where it isn't,
   estimate with the formula below and flag it in `notes`.
4. One row must match `reference_length_cm` exactly, keeping the
   top-level values. If it genuinely disagrees, treat that as a red
   flag on the **whole table** — usually it means the source describes a
   different year or variant. Resolve it before using the other rows.
5. Run `python data/check.py`.

### Weight scaling formula

```
predicted_g = reference_weight_g * (1 + rate * (target_cm - reference_cm))
```

`rate = 0.00814` (0.814%/cm) as of 2026-08-25, averaged across the 35
skis with multi-length data. Recompute as more real data lands — it has
already drifted from 0.00810 as the sample grew:

```
python -c "
import json
d = json.load(open('data/skis.json'))
rates = []
for s in d['skis']:
    opts = s.get('length_options')
    if not opts or len(opts) < 2: continue
    o = sorted(opts, key=lambda x: x['length_cm'])
    rates.append((o[-1]['weight_g'] - o[0]['weight_g']) / (o[-1]['length_cm'] - o[0]['length_cm']) / s['weight_g'])
print('rate =', round(sum(rates)/len(rates), 5), 'over', len(rates), 'skis')
"
```

Validated before adoption: leave-one-out testing averaged ~50g error
(~2.5–3%), with 1 of 21 held-out predictions landing in a different
band — and that one was already on a boundary. A blind test on a ski
outside the calibration set came in at 11g (0.6%). Re-check
periodically rather than assuming it holds forever.

---

## Adding a ski

1. Search `"<name> official specs size chart"`.
2. **Read the construction description** and set `metal_content`. If
   it's ambiguous, run one more search specifically for the layup —
   this is the field worth a second query.
3. Fill in the rest. Rocker category default is fine.
4. Set `verified_date`.
5. Run `python data/check.py`. If the new ski appears in the
   near-boundary list, verify its `metal_content` against a second
   source before moving on.

## Refreshing a ski

Same process. Update `model_year` only if the construction actually
changed — a re-skin isn't worth a new row. If nothing changed, bump
`verified_date` so the entry doesn't look untouched forever.

## Freshness audit

Periodically, per entry: does a newer model year exist, and did the
construction change enough to matter (metal content, or weight moving
far enough to cross a band)? If yes, refresh. If nothing changed, bump
`verified_date`.

## Batching

New skis carry a risk that `length_options` backfills don't: there's no
existing reference figure to catch a mislabelled source.

1. **Batch 10–15** under a newly changed process; ~25–30 once it holds.
2. **Run `check.py` against the whole file after every batch**, not
   just the new rows.
3. **Spot-check a sample against the original source.** A systemic
   problem — a units mix-up, a misread column — repeats, so a handful
   of checks catches it as reliably as reviewing all 30, and stays
   rigorous instead of becoming a skim.
4. Only start the next batch once checks are clean.
