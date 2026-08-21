# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** someone who owns 1–2 skis and is deciding what to add next —
real money on the line ($600–900+ purchases), doing genuine pre-purchase
research. "What am I missing" is a live, unanswered question for this
person.

**Secondary:** someone already cross-shopping specific candidate skis, who
wants to see exactly where a model they're considering would land before
buying (served by the "Comparing something specific?" search).

**Explicitly not the primary audience:** someone auditing an established
3+ ski quiver. Real tester evidence showed this group finds the tool
"cool" but gets little practical value, since they already know their own
gaps from experience — see Evidence on Hand.

## Product Purpose

Turns "what should my next ski be?" from guesswork into a data-backed
answer. A skier adds the 1-2 skis they own (or are considering), and the
tool shows exactly which kinds of ski days they're covered for and which
they're not — then recommends specific real skis from a sourced catalog
that would close the biggest gap.

**Current goal:** the project is moving past informal validation with
friends and testers toward a public, wider launch — design and product
decisions should be made with a broader, unknown audience in mind, not
just the existing tester circle.

## Positioning

The mechanism a neighboring product couldn't truthfully copy without the
same underlying rigor: real, sourced spec data (never estimated or
guessed) mapped into an explicit 2D coverage model — waist width ×
derived "temperament" — with an algorithm that suggests actual catalog
skis to close a real, specific gap. This isn't a marketing quiz or an
affiliate content list; every number traces back to a documented source
(see `data/SOURCING.md`), and where a number can't be reliably sourced or
derived, the product deliberately omits the claim rather than fake it
(e.g. "ability level" and a "stiff" label were both considered and
rejected for exactly this reason).

## Operating Context

Runs standalone in a browser — no login, no accounts, no backend.
Everything lives in one page-load session; a built quiver doesn't persist
across reloads or devices. Deployed as a static site via GitHub Pages.

Used on both mobile and desktop in real conditions — not just
responsive-in-theory. Confirmed via real iOS Safari/Chrome usage from
actual testers (surfaced real bugs, like touch's lack of a true hover
state, that never reproduced in desktop or emulated-mobile testing).

Current testers are friends giving informal, real-world feedback — not a
formal user-research program, but feedback that has already driven real
product decisions (the 1-2-ski positioning pivot, the recent
Trees/Powder/Speed interest bias, axis-label wording).

## Capabilities and Constraints

- **Dataset:** 61 skis across 20 brands, all sourced (not estimated) from
  Blister Review measured data, manufacturer spec pages, and retail spec
  tables. Full sourcing methodology, including a mechanical-first/
  formula-fallback hybrid for per-length weight/turn-radius data, is
  documented in `data/SOURCING.md`.
- **Coverage model:** waist width (mm) × a derived 0-100 "temperament"
  score (from weight, metal content, and rocker) forms a 3×3 bucket grid.
  Each ski covers a region around its position (±7mm, ±12 temperament
  points), not just a single point.
- **Gap-finding + recommendation:** identifies buckets with zero coverage
  and greedily suggests catalog skis that close the most gaps with the
  least overlap.
- **Optional interest bias** (Trees / Powder / Speed): reweights which
  already-qualifying ski wins a recommendation tiebreak. Built entirely
  from specs already in the dataset — deliberately excludes "Park" since
  twin-tip/mount-point data doesn't exist in the dataset and can't be
  honestly derived from what's there.
- **Park/twin-tip detection:** a separate condition card based on
  `tail_shape`, orthogonal to the main waist/temperament coverage grid.
- **Explicitly not implemented:** ability-level tagging (beginner/
  intermediate/advanced/expert) — considered and rejected; not reliably
  derivable from current spec fields without a new, dedicated sourcing
  effort.
- **Partial length coverage:** per-length weight/turn-radius data
  (`length_options`) exists for 35 of 61 skis. Further backfill is
  paused for cost/time reasons, not abandoned — an open, resumable task.
- **No accounts, no persistence** — open/undecided whether a future phase
  adds either; do not assume either is coming.

## Brand Commitments

Current name is "Quiver Gap Finder." A rename is planned but **explicitly
and deliberately deferred** — it's a costlier change (breaks an
already-shared URL, GitHub repo rename, README rewrite) the user wants to
make once, with confidence, after current iteration settles — not mid-
iteration. Do not propose or force a naming decision; treat the current
name as binding until the user decides otherwise.

## Evidence on Hand

Informal, real tester feedback from friends (not a formal study, no
case studies, press, or testimonials — future work must not fabricate
any of these):

- Every tester with only 1-2 skis found the tool genuinely useful.
- The one tester with an established 3+ ski quiver called it "cool" but
  got little practical value from it.
- The coverage map specifically was the one thing every tester responded
  to, regardless of ski experience — it's the product's proven anchor.

## Product Principles

1. **Every claim traces to a real source or an honest derivation.** Never
   invent or estimate a number presented as fact. If it can't be sourced
   or reliably derived from what's already known, the product omits the
   claim rather than fake it.
2. **Design for the 1-2-ski buyer's open question, not the established
   quiver owner's audit.** That's who the evidence says this works for.
3. **Status and coverage never rely on color alone** — always paired with
   an icon and a text label. Every chart has a "View as table" twin with
   identical data.
4. **Mobile and desktop are both real, load-bearing surfaces.** Touch and
   hover are genuinely different interaction models; a pattern gets
   designed for the harder constraint first, not shrunk down from the
   other.
5. **A future visual redesign preserves full existing functionality.**
   The look can change; the coverage-gap mechanism, the sourced data
   discipline, and everything already working for testers does not get
   reset in the process.

## Accessibility & Inclusion

No user-specific accessibility requirement has been stated, but the
existing implementation already follows a consistent practice that
future work should preserve, not treat as optional polish: status/
coverage information never relies on color alone (always icon + text),
and every visual chart has an accessible table-view twin with the same
data.
