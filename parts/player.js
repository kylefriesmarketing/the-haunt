/* THE HAUNT — player.js — first-person: you, in the walls. Pointer lock, slide collision, context interactions. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const P = {
    x: 4, y: 1.62, z: 14, yaw: Math.PI / 2, pitch: 0,
    speed: 3.6, sprint: 5.6,
    keys: {}, locked: false, enabled: false,
    walls: null, freeRoam: false
  };

  P.init = function (canvas) {
    P.walls = H.Barn.rects();
    canvas.addEventListener('click', () => { if (P.enabled && !P.locked) canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => {
      P.locked = document.pointerLockElement === canvas;
      if (H.Game && H.Game.onLockChange) H.Game.onLockChange(P.locked);
    });
    document.addEventListener('mousemove', e => {
      if (!P.locked) return;
      P.yaw -= e.movementX * 0.0023;
      P.pitch -= e.movementY * 0.0023;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
    });
    addEventListener('keydown', e => { P.keys[e.code] = true; if (H.Game && H.Game.onKey) H.Game.onKey(e.code, e); });
    addEventListener('keyup', e => { P.keys[e.code] = false; });
  };

  P.spawnBackstage = function () { P.x = 4; P.z = 14; P.y = 1.62; P.yaw = -Math.PI / 2; P.pitch = 0; };
  P.spawnYard = function () { P.x = -4; P.z = 14; P.y = 1.62; P.yaw = -Math.PI / 2; P.pitch = 0; };

  P.update = function (dt) {
    if (!P.enabled) return;
    const fwd = (P.keys.KeyW ? 1 : 0) - (P.keys.KeyS ? 1 : 0);
    const str = (P.keys.KeyD ? 1 : 0) - (P.keys.KeyA ? 1 : 0);
    let sp = (P.keys.ShiftLeft || P.keys.ShiftRight) ? P.sprint : P.speed;
    if (fwd || str) {
      const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
      let dx = (-sy * fwd + cy * str), dz = (-cy * fwd - sy * str);
      const L = Math.hypot(dx, dz) || 1;
      dx = dx / L * sp * dt; dz = dz / L * sp * dt;
      let nx = P.x + dx, nz = P.z + dz;
      const solved = H.Barn.collide(nx, nz, 0.34, P.walls);
      P.x = solved.x; P.z = solved.z;
      // head bob, small
      P._bobT = (P._bobT || 0) + dt * sp * 1.6;
      P.y = 1.62 + Math.sin(P._bobT) * 0.028;
    }
  };

  /* what can I do from here? returns { kind, id, label, ... } or null */
  P.context = function (night, buildSlots) {
    const D = H.DATA;
    const near = (x, z, r) => { const dx = P.x - x, dz = P.z - z; return dx * dx + dz * dz < r * r; };
    // distress rescue first (highest priority): any distressed guest within 7m of an adjacent peek
    if (night) {
      for (const gst of night.guests) {
        if (gst.state !== 'distress' || gst.out) continue;
        const p = night.guestPos(gst);
        if (near(p.x, p.z, 7.5)) return { kind: 'rescue', id: gst.id, label: 'E — walk them out the quiet door (bo taught you the voice)' };
      }
    }
    // stations
    for (const slot of D.SLOTS) {
      const b = buildSlots[slot.id];
      if (!b || !b.type) continue;
      if (near(slot.at[0], slot.at[1], 2.3)) {
        const st = night && night.stations[slot.id];
        const cool = st && night.t < st.readyAt;
        const broken = b.broken;
        const def = D.STATIONS[b.type];
        return { kind: 'station', id: slot.id, label: broken ? `${def.name} — DEAD (fix it tomorrow)` : cool ? `${def.name} — resetting…` : `E — fire the ${def.name}`, cool, broken };
      }
    }
    // peek doors (body scare)
    for (const p of D.DOORS.peek) {
      if (near(p.x, p.z, 1.9)) {
        const ready = !night || night.t >= night.bodyReadyAt;
        return { kind: 'peek', id: p.id, label: ready ? 'E — THE POP (through the curtain)' : 'catching your breath…', ready };
      }
    }
    return null;
  };

  H.Player = P;
})(typeof globalThis !== 'undefined' ? globalThis : window);
