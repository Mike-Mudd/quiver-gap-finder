"use strict";

/* ------------------------------------------------------------------ *
 *  Scroll reveals - shared by index.html and method.html.
 *
 *  IntersectionObserver rather than a scroll handler: the browser does
 *  the work off the main thread, so nothing is computed per frame while
 *  scrolling. Each element animates once and is then unobserved.
 *
 *  Extracted out of app.js so a plain content page (method.html) can
 *  get the same .reveal behaviour without loading the search/quiver
 *  logic that has nothing to do with it.
 * ------------------------------------------------------------------ */

(function wireReveals() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  // Stagger index for the zone grid, set here rather than in markup so
  // the CSS delay stays a presentational detail. No-op on pages
  // without a .zone-grid.
  document.querySelectorAll(".zone-grid li").forEach((li, i) => {
    li.style.setProperty("--i", String(i));
  });

  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    // Fires a little before the element reaches the fold, so content is
    // settled by the time it is properly in view rather than animating
    // under the reader's eye.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  items.forEach((el) => io.observe(el));
})();
