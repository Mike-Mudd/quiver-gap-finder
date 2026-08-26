# Landing-page explorations

Visual explorations only. **The shipped app is at the repo root**
(`index.html`, `style.css`, `app.js`) and none of these touch it.

Each folder is self-contained and commits fully to one aesthetic. They
are kept rather than deleted because a rejected direction is evidence:
knowing *what didn't work and why* is worth more than a tidy folder
list, and `DESIGN.md` already treats the incumbent look the same way.

All versions run the real 61-ski dataset and the real coverage math, so
the search and gap readout in each are genuine, not mocked.

## Round 1 — three unrelated directions (2026-08-20)

| | Direction | Outcome |
|---|---|---|
| `v1` | **Glass over the ridge** — glassmorphism, frosted panels over a layered alpine scene, annotation pins, amber accent. Archivo Black + JetBrains Mono. | Not chosen |
| `v2` | **Collage** — huge condensed all-caps colliding with a solid-orange plate, scattered ungridded glyphs, misaligned card cluster. Anton + Space Mono. | **Chosen from round 1** |
| `v3` | **Inset** — one rounded inset card, sky gradient blending seamlessly into ridge, oversized wordmark as texture, measurement leader lines. Jost + IBM Plex Mono. | Not chosen |

**What the user liked about `v2`:** the colours "really pop" and the
large bold text.

## Round 2 — v2 plus a hero photograph (2026-08-20)

Built to resolve one open question: how a hero mountain photo should
coexist with v2's flat orange plate. Each answers it differently.

| | Direction | Outcome |
|---|---|---|
| `v4` | **Duotone plate** — the photo *is* the orange; image mapped into the maroon→orange ramp inside the plate shape. | Retired |
| `v5` | **Full bleed, orange as voice** — photo edge-to-edge but crushed to near-monochrome ground; the accent belongs entirely to the type. | Retired |
| `v6` | **Split field** — hard horizontal seam, photo above and solid orange below, headline spanning the boundary. | Retired |

**Never resolved:** no hero photograph was ever generated. Higgsfield's
free plan gates `soul_location` ("Requires basic plan or higher") — the
model actually built for landscapes — leaving `z_image`, whose jobs
stayed queued indefinitely. So `v4`–`v6` ship pure-CSS stand-in ridges
behind a `--hero` variable; dropping in a real photo is one line each.

## Round 3 — photo-led mountain hero (current)

**The orange/collage direction is retired.** After looking at more
references the user moved toward full-bleed mountain photography with
type sitting over it — cool and atmospheric rather than loud and
graphic. Closest library reference: *"Alpine ski-touring — editorial
serif hero over full-bleed peaks"* (cool blue-grey monochrome, slender
serif mixing upright and italic, type quiet over the photo).

This is close to the exact inverse of `v2` on every axis — palette,
type voice, and whether the type competes with the image or sits in it.

**Hard dependency:** this direction lives or dies on photo quality in a
way the orange versions did not. A mediocre photo cannot be rescued by
layout. Photos are being sourced from free stock (Unsplash/Pexels)
rather than generated — see `ROUND3-PHOTO-BRIEF.md`.
