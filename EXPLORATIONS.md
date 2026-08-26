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

## Round 2 — v2 plus a hero photograph (2026-08-20, removed)

`v4`/`v5`/`v6` explored how a hero photograph could coexist with v2's
flat orange plate: as a duotone *inside* the plate, as a full-bleed
ground with the orange moved entirely into the type, and as a hard
split between photo and solid colour.

**Deleted during cleanup.** They were superseded by round 3, their
premise (the orange accent) is retired, and they never received a real
photograph — each referenced an `img/hero.jpg` that was never added, so
all three silently fell back to a CSS stand-in. Recoverable from git
history at `ba2790f` if the approach is ever worth revisiting.

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
rather than generated — see `ROUND3-PHOTO-BRIEF.md` and `IMAGES.md`.

The chosen hero lives once at `assets/hero.jpg` and is shared by every
version, rather than duplicated per folder.
