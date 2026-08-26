# Hero images — round 3

Chosen from Unsplash after testing each candidate with the real
headline overlaid in a hero-proportioned crop (several photos that look
good standalone fail badly behind type — see the note below).

## Chosen

**G — aerial foggy mountains** (primary)
- Page: https://unsplash.com/photos/aerial-photo-of-foggy-mountains-1527pjeb6jg
- Direct download: https://unsplash.com/photos/1527pjeb6jg/download?force=true
- Sharp alpine peaks left, cloud sea running through the middle exactly
  where the headline sits, layered depth, subtle warm/cool contrast.
- Reads cleanly with **no overlay needed**, which is rare.

**H — black & white mountain range** (alternate)
- Page: https://unsplash.com/photos/a-black-and-white-photo-of-a-mountain-range-3XKoYtfmXTk
- Direct download: https://unsplash.com/photos/3XKoYtfmXTk/download?force=true
- Monochrome and austere. Removes colour as a variable, so any accent
  added later is unambiguous. Slightly busier edges; wants a little
  more separation behind the type.

> Photo IDs above are the real Unsplash page slugs (`1527pjeb6jg`,
> `3XKoYtfmXTk`), not the CDN filenames. The CDN filename
> (`photo-1506905925346-…`) is *not* a valid page URL — that mistake
> produced a broken link once already.

## Licence

Both are Unsplash Licence: free for commercial use, no attribution
required, no expiry. There is no licensing reason to replace them
later — treat them as chosen assets, not placeholders.

## Rejected, and why

Worth recording so the same ground isn't re-covered:

| | Why not |
|---|---|
| Dawn cloud sea (`photo-1765718651901…`) | Best tone of any candidate, but a hard black hillside is **baked into the right edge of the source file** — survives every crop position tested. |
| Range-in-cloud A & B, mountain-in-cloud | Bright white cumulus sits directly behind the headline. This is the single most common failure mode and it is invisible until real type is overlaid. |
| Autumn larches | Green and gold — wrong season entirely. |
| Orange sunset | Exactly what `ROUND3-PHOTO-BRIEF.md` warns against; type collides with the bright band. |
| Green alpine + water | Summer shot. |

## Preparing the file

1. Download the **Large** size from Unsplash (not Original — often 20MB+).
2. Compress at [squoosh.app](https://squoosh.app) — MozJPEG, quality ~75,
   resized to **2400px wide**. Target **under ~600KB**.
3. Save to `v7/img/hero.jpg` (and `v8/`, `v9/` as those are built).

Each layout reads the image through a single CSS variable:

```css
--hero: url("img/hero.jpg");
```

so swapping G for H, or either for something else, is a one-line change
per version.

## Type colour on snow — resolved 2026-08-25

Bright powder is the point of the site, so the type was built for white
rather than routed around it. Five strategies were tested on the same
bright snow photo, then measured:

| Type colour | Bright snow | Mid snow | Shadowed snow |
|---|---|---|---|
| **Charcoal `#101A22`** | **15.66** | 13.19 | 9.67 |
| Alpine blue `#0B3D66` | 9.97 | 8.40 | 6.15 |
| White `#FFFFFF` | **1.12** | — | — |

**Decision: dark type on snow, no scrim.**

White on bright snow measures 1.12:1 — functionally invisible against a
4.5 requirement. Charcoal clears it by more than 3x and, importantly,
stays above 4.5 even on *shadowed* snow, so the type works anywhere in
the frame without policing where it lands. Alpine blue also passes
everywhere and carries brand character if a hue is wanted.

Rejected alternatives:
- **Duotone the photo** so white type works — legible, but it throws
  away the photograph; a deep blue sky flattens to teal.
- **Local scrim** behind the text — works, but you can see it working,
  and it dims exactly the snow the site is meant to show off.
- **Solid block** behind the type — strong, but closer to the retired
  v2 energy than this direction wants.

This inverts the near-universal ski-site default of white-on-dark, and
makes snow the page ground rather than an obstacle.

## Hero image — pending reselection

The cloud-sea shot (`1527pjeb6jg`) was downloaded to `v7/img/hero.jpg`
but set aside: cloud seas read as *scenery*, while the audience is
buying skis and responds to *fresh snow they want to ride*.

Powder candidates tested so far, with type low-left:

- `photo-1664436341001-b02974ae7524` — skier carving, alps behind
- `photo-1735749328571-a705c1de6cdd` — skier, deep blue sky
- `photo-1552757666-98833dbd51fc` — skier near dark pines
- `photo-1610127685758-002974138232` — sculpted wind-carved drift
  (used for the type-colour test above; strong graphic shot, no figure)
