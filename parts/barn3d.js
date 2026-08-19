/* THE HAUNT — barn3d.js — the barn's wall geometry, shared by the renderer and player collision.
   Walls are authored runs with door gaps; emits AABB rects the view extrudes and the player slides against. */
(function (g) {
  'use strict';
  const H = g.HAUNT;

  const DOOR_W = 1.7, PEEK_W = 1.4, T = 0.36;

  /* wall runs: {x: X, z0, z1, gaps:[z...]} vertical | {z: Z, x0, x1, gaps:[x...]} horizontal
     gap entries: {at, w, kind} */
  function runs() {
    const D = H.DATA;
    const gd = id => D.DOORS.guest.find(d => d.id === id);
    const pk = id => D.DOORS.peek.find(d => d.id === id);
    const ck = id => D.DOORS.chicken.find(d => d.id === id);
    const bd = id => D.DOORS.backstage.find(d => d.id === id);
    return [
      // shell
      { z: 2, x0: 2, x1: 46, gaps: [] },
      { z: 26, x0: 2, x1: 46, gaps: [{ at: ck('chx2').x, w: DOOR_W, kind: 'chicken' }] },
      { x: 2, z0: 2, z1: 26, gaps: [{ at: gd('front').z, w: DOOR_W, kind: 'guest' }, { at: bd('bdoor').z, w: DOOR_W, kind: 'backstage' }, { at: gd('out').z, w: DOOR_W, kind: 'guest' }] },
      { x: 46, z0: 2, z1: 26, gaps: [{ at: ck('chx1').z, w: DOOR_W, kind: 'chicken' }] },
      // row A partitions
      { x: 12, z0: 2, z1: 12, gaps: [{ at: gd('d_ec').z, w: DOOR_W, kind: 'guest' }] },
      { x: 24, z0: 2, z1: 12, gaps: [{ at: gd('d_cd').z, w: DOOR_W, kind: 'guest' }] },
      { x: 36, z0: 2, z1: 12, gaps: [{ at: gd('d_ds').z, w: DOOR_W, kind: 'guest' }] },
      // spine north wall (z=12): peeks + the surgery->squeeze door
      { z: 12, x0: 2, x1: 46, gaps: [
        { at: pk('p_corn').x, w: PEEK_W, kind: 'peek' }, { at: pk('p_din').x, w: PEEK_W, kind: 'peek' },
        { at: pk('p_sur').x, w: PEEK_W, kind: 'peek' }, { at: gd('d_sp').x, w: DOOR_W, kind: 'guest' }] },
      // spine south wall (z=16): peeks + squeeze->clown door
      { z: 16, x0: 2, x1: 46, gaps: [
        { at: pk('p_last').x, w: PEEK_W, kind: 'peek' }, { at: pk('p_cel').x, w: PEEK_W, kind: 'peek' },
        { at: pk('p_clown').x, w: PEEK_W, kind: 'peek' }, { at: gd('d_pc').x, w: DOOR_W, kind: 'guest' }] },
      // the squeeze west wall (seals spine from the passage)
      { x: 44, z0: 12, z1: 16, gaps: [] },
      // row B partitions
      { x: 34, z0: 16, z1: 26, gaps: [{ at: gd('d_cc').z, w: DOOR_W, kind: 'guest' }] },
      { x: 20, z0: 16, z1: 26, gaps: [{ at: gd('d_cl').z, w: DOOR_W, kind: 'guest' }] },
      { x: 8, z0: 16, z1: 26, gaps: [{ at: gd('d_ll').z, w: DOOR_W, kind: 'guest' }] }
    ];
  }

  /* explode runs into AABB rects, skipping gaps */
  function rects() {
    const out = [];
    for (const r of runs()) {
      if (r.x !== undefined) {
        const gaps = (r.gaps || []).slice().sort((a, b) => a.at - b.at);
        let z = r.z0;
        for (const gp of gaps) {
          const a = gp.at - gp.w / 2;
          if (a > z + 0.01) out.push({ x0: r.x - T / 2, x1: r.x + T / 2, z0: z, z1: a, run: r });
          z = gp.at + gp.w / 2;
        }
        if (r.z1 > z + 0.01) out.push({ x0: r.x - T / 2, x1: r.x + T / 2, z0: z, z1: r.z1, run: r });
      } else {
        const gaps = (r.gaps || []).slice().sort((a, b) => a.at - b.at);
        let x = r.x0;
        for (const gp of gaps) {
          const a = gp.at - gp.w / 2;
          if (a > x + 0.01) out.push({ x0: x, x1: a, z0: r.z - T / 2, z1: r.z + T / 2, run: r });
          x = gp.at + gp.w / 2;
        }
        if (r.x1 > x + 0.01) out.push({ x0: x, x1: r.x1, z0: r.z - T / 2, z1: r.z + T / 2, run: r });
      }
    }
    return out;
  }

  /* circle vs rects slide-resolve for the player */
  function collide(x, z, radius, walls) {
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const w of walls) {
        const cx = Math.max(w.x0, Math.min(x, w.x1));
        const cz = Math.max(w.z0, Math.min(z, w.z1));
        const dx = x - cx, dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          const d = Math.sqrt(Math.max(1e-6, d2));
          const push = radius - d;
          if (d > 1e-4) { x += (dx / d) * push; z += (dz / d) * push; }
          else { x += push; }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    return { x, z };
  }

  function inSpine(x, z) {
    const S = H.DATA.SPINE;
    return x >= S.x0 - 0.5 && x <= S.x1 + 0.5 && z >= S.z0 - 0.3 && z <= S.z1 + 0.3;
  }

  H.Barn = { runs, rects, collide, inSpine, DOOR_W, PEEK_W, T };
})(typeof globalThis !== 'undefined' ? globalThis : window);
