/* THE HAUNT — rng.js — seeded determinism (mulberry32). No Math.random anywhere in sim. */
(function (g) {
  'use strict';
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const f = mulberry32(seed);
    return {
      f,                                   // 0..1
      range(a, b) { return a + (b - a) * f(); },
      int(a, b) { return Math.floor(this.range(a, b + 1)); }, // inclusive
      pick(arr) { return arr[Math.floor(f() * arr.length) % arr.length]; },
      chance(p) { return f() < p; },
      shuffle(arr) { const c = arr.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; }
    };
  }
  g.HAUNT = g.HAUNT || {};
  g.HAUNT.makeRng = makeRng;
})(typeof globalThis !== 'undefined' ? globalThis : window);
