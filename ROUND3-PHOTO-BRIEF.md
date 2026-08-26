# Round 3 — hero photo brief

What to look for when picking the mountain shot. This direction depends
on the photograph more than any previous round: layout cannot rescue a
weak image here, so it's worth being fussy.

Drop chosen files in `v7/img/`, `v8/img/`, `v9/img/` as `hero.jpg`.
Each version reads one line (`--hero`), so swapping is trivial.

## Where to look

- **Unsplash** — unsplash.com/s/photos/ski-mountain · alpine-ridge · ski-touring
- **Pexels** — pexels.com/search/snow%20mountain/
- Both are free for commercial use with no attribution required
  (Unsplash License / Pexels License). Worth a glance at the licence on
  the specific photo anyway.

## Search terms that actually work

Ranked by how often they return usable *hero* crops rather than
portrait-orientation or over-processed shots:

1. `alpine ridge above clouds`
2. `ski touring skyline`
3. `mountain range aerial winter`
4. `snowy peaks fog`
5. `backcountry ski panorama`

Avoid: "ski resort" (returns lifts, crowds, buildings), "skier"
(usually close-up action, wrong for this), "winter" (too broad).

## What the layout needs from the image

**Composition — the part most people get wrong.**

- **Landscape orientation, wide.** 3:2 minimum, 16:9 or wider is better.
  Portrait shots cannot be cropped into a full-bleed hero without
  losing the subject.
- **A quiet zone for the headline.** The reference puts the headline
  across the middle third. The photo needs a band there that is
  relatively even in tone — sky, cloud bank, or an unbroken snowfield.
  A busy, high-contrast rock face behind the type kills legibility no
  matter how the overlay is tuned.
- **The horizon off-centre.** A ridgeline sitting dead through the
  middle competes with the headline. Upper or lower third is better.
- **Depth.** Layered ridges receding into haze read far better than one
  flat wall of mountain — that's what makes the reference feel
  atmospheric rather than like a postcard.

**Tone.**

- **Cool and desaturated beats vivid.** The reference palette is
  blue-grey (`#1B2A3D` `#8FA8C2` `#3E5A78`). A punchy saturated
  bluebird shot will fight white type.
- **Overcast, fog, or blue-hour light** works better than harsh midday
  sun, which creates blown-out white snow that white text disappears
  into.
- **Avoid heavy HDR.** Over-processed stock is explicitly out per the
  project guardrails, and it looks dated fast.

**Practical.**

- **Download the largest size offered**, then let CSS scale it down.
  Upscaling a small file will look soft on a hero.
- **Under ~600KB after compression** if possible — this is the
  first thing every visitor loads. Squoosh.app handles this well.
- **No recognisable faces or logos**, which sidesteps release questions
  entirely.

## Good sign / bad sign, at a glance

| Good | Bad |
|---|---|
| Layered ridges fading into haze | One flat mountain wall |
| Even sky or cloud band mid-frame | Jagged high-contrast rock mid-frame |
| Cool blue-grey cast | Saturated orange sunset |
| Horizon in upper or lower third | Horizon dead centre |
| Soft overcast or blue-hour light | Harsh midday sun, blown highlights |

## A note on how many

Two or three candidates is plenty. Because `--hero` is one line, the
fastest way to choose is to build the layouts once and swap the photo
through them — the same shot can look strong in one composition and
weak in another, and that is only visible in place.
