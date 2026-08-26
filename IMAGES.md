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
