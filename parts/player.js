/* THE HAUNT — player.js — first-person: you, in the walls. Pointer lock, slide collision, context interactions. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const P = {
    x: 4, y: 1.62, z: 14, yaw: Math.PI / 2, pitch: 0,
    speed: 3.6, sprint: 5.6,        // fallbacks only — D.PLAYER is the authority (trap 2)
    keys: {}, locked: false, enabled: false,
    walls: null, freeRoam: false,
    actor: 'you'                      // which performer this client IS (co-op seats get their own id)
  };

  /* requestPointerLock returns a promise in current chrome; a refusal must not land in the
     console as an unhandled rejection. every lock request in the game goes through here. */
  P.lock = function () {
    const cv = P.canvas || document.getElementById('game');
    if (!cv || !cv.requestPointerLock) return;
    try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
  };

  P.init = function (canvas) {
    P.walls = H.Barn.rects();
    P.canvas = canvas;
    canvas.addEventListener('click', () => { if (P.enabled && !P.locked) P.lock(); });
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
    addEventListener('keyup', e => { P.keys[e.code] = false; if (H.Game && H.Game.onKeyUp) H.Game.onKeyUp(e.code); });
    /* ⚠️ alt-tabbing away with E held would leave the saw revving into its own cooldown */
    addEventListener('blur', () => { P.keys = {}; if (H.Game && H.Game.onKeyUp) H.Game.onKeyUp('KeyE'); });
  };

  P.spawnBackstage = function () { P.x = 4; P.z = 14; P.y = 1.62; P.yaw = -Math.PI / 2; P.pitch = 0; };
  P.spawnYard = function () { P.x = -4; P.z = 14; P.y = 1.62; P.yaw = -Math.PI / 2; P.pitch = 0; };
  /* build day starts on the porch, facing your own front door, like a paying customer */
  P.spawnPorch = function () { P.x = -0.6; P.z = 7; P.y = 1.62; P.yaw = -Math.PI / 2; P.pitch = 0; };

  P.update = function (dt) {
    if (!P.enabled) return;
    const fwd = (P.keys.KeyW ? 1 : 0) - (P.keys.KeyS ? 1 : 0);
    const str = (P.keys.KeyD ? 1 : 0) - (P.keys.KeyA ? 1 : 0);
    /* ⚠️ THE CREEP IS A MECHANIC, NOT A COMFORT. The stalk demands you match guest pace
       (1.15 m/s) and the creep demands you stay under 1.3 — a player who can only walk 3.6
       or sprint 5.6 can never satisfy either, and two of the six trade verbs would be
       unreachable decoration. Hold Ctrl. */
    const PL = (H.DATA && H.DATA.PLAYER) || { walk: P.speed, sprint: P.sprint, creep: 1.05 };
    const creeping = !!(P.keys.ControlLeft || P.keys.ControlRight);
    let sp = (P.keys.ShiftLeft || P.keys.ShiftRight) ? PL.sprint : creeping ? PL.creep : PL.walk;
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
    /* the trade verbs. Read uniformly off `night.actors` — which works on the real night AND on
       a co-op guest's shadow, because applySnap decodes the wire's `ac` block into the same
       {tech, charge, hold} shape. Guests render snapshots; they never predict. */
    const a = (night && night.actors && night.actors[P.actor]) || null;
    const tech = a && D.TECHNIQUES.find(t => t.key === a.tech);
    if (night && a && tech && tech.key !== 'pop') {
      const inRange = (r) => {
        for (const gst of night.guests) {
          if (gst.out || gst.chicken) continue;
          const p = night.guestPos(gst);
          if (near(p.x, p.z, r)) return true;
        }
        return false;
      };
      const cool = night.t < ((night.bodyReadyAt || {})[P.actor + ':' + tech.key] || 0);
      if (tech.kind === 'hold' && !cool && inRange(tech.nearM)) {
        return { kind: 'saw', label: P.pitch <= tech.lowPitch
          ? 'HOLD E — rev low, walk them forward'
          : 'HOLD E — and AIM DOWN. knees.' };
      }
      if (tech.kind === 'charge' && !cool && a.charge / tech.chargeMax >= D.TECH.fireMinFrac && inRange(tech.behindM || tech.nearM)) {
        return { kind: 'tech', label: `E — spring the ${tech.name.replace('the ', '')} (${Math.round(100 * a.charge / tech.chargeMax)}%)` };
      }
      if (tech.needSprint && !cool && inRange(tech.nearM)) {
        const ready = a.sprintReady === undefined ? true : !!a.sprintReady;
        return ready
          ? { kind: 'tech', label: 'E — SLIDE. take the whole row.' }
          : { kind: 'peekinfo', label: 'the slider needs a running start (SPRINT first)' };
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
        if (a && a.tech && a.tech !== 'pop')
          return { kind: 'peekinfo', label: 'the curtain wants the pop — press 1' };
        const ready = !night || night.t >= ((night.bodyReadyAt || {})[P.actor + ':pop'] || 0);
        return { kind: 'peek', id: p.id, label: ready ? 'E — THE POP (through the curtain)' : 'catching your breath…', ready };
      }
    }
    return null;
  };

  /* build day: what's within arm's reach of the slot you're standing at? */
  P.buildContext = function (buildSlots) {
    const D = H.DATA;
    const B = D.BUILD_MODE;
    const near = (x, z, r) => { const dx = P.x - x, dz = P.z - z; return dx * dx + dz * dz < r * r; };
    let best = null, bd = 1e9;
    for (const slot of D.SLOTS) {
      const dx = P.x - slot.at[0], dz = P.z - slot.at[1];
      const d = dx * dx + dz * dz;
      if (d < B.reach * B.reach && d < bd) {
        const b = buildSlots[slot.id];
        const node = D.NODES.find(n => n.id === slot.node);
        const room = D.ROOMS.find(r => r.id === node.room);
        bd = d;
        best = {
          kind: 'slot', id: slot.id, slot, b, room,
          label: b && b.type
            ? (b.broken ? `E — the ${D.STATIONS[b.type].name} is DEAD. fix it.` : `E — work on the ${D.STATIONS[b.type].name} (tier ${b.tier})`)
            : `E — an empty slot in ${room.name}. build something.`
        };
      }
    }
    if (best) return best;
    if (near(D.PROPS.callSheet[0], D.PROPS.callSheet[1], B.boardReach)) return { kind: 'callsheet', label: 'E — the call sheet (who works where)' };
    if (near(D.PROPS.dials[0], D.PROPS.dials[1], B.boardReach)) return { kind: 'dials', label: 'E — the dials (spacing · ticket)' };
    return null;
  };

  H.Player = P;
})(typeof globalThis !== 'undefined' ? globalThis : window);
