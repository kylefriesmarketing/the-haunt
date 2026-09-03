/* THE HAUNT — replay.js — the tape. A rolling ring buffer of guest poses; the night's best scare
   survives as a "take" the sting can roll back with VHS grain on it.
   NO three.js, NO DOM, NO sim mutation — it only ever READS the night. The sim never knows it exists. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const D = () => H.DATA;
  const FACES = ['calm', 'worry', 'scream', 'joy'];
  /* the pose vocabulary — ONE authority; net.js and view.js reference this, never a copy */
  const POSES = ['walk', 'flinch', 'scream', 'gotem', 'dropped', 'melt', 'crawl', 'distress', 'joy', 'huh'];

  const R = {
    frames: [],        // ring buffer: { t, g: [ [id,x,y,z,ry,tilt,faceIdx], ... ] }
    roster: {},        // id -> archetype key (needed to rebuild the meshes at playback)
    pending: null,     // a marked scare still filling out its tail
    take: null,        // the night's best finished take
    acc: 0
  };

  R.reset = function () { R.frames = []; R.roster = {}; R.pending = null; R.take = null; R.acc = 0; };

  /* the pose a guest is striking right now — the ONE definition, shared with view.syncGuests,
     the wire, and the tape, so the three can never drift apart.
     poseT is SIM-time progress through the reaction (0→1), so the rig's snap-in is tape-true. */
  R.POSES = POSES;
  R.poseOf = function (gst) {
    let face = 'calm', yOff = 0, tilt = 0, ly = 0, pose = 'walk', poseT = 0;
    const frac = gst.nerve / gst.pool;
    if (frac < 0.5) face = 'worry';
    if (gst.state === 'react') {
      face = 'scream';
      const dur = D().POSE.durs[gst.reactKind] || 1;
      poseT = Math.max(0, Math.min(1, 1 - gst.reactT / dur));
      pose = gst.reactKind;
      if (gst.reactKind === 'flinch') {
        yOff = Math.abs(Math.sin(gst.reactT * 18)) * 0.12;
        const arch = D().ARCHETYPES[gst.arch];
        if (arch && arch.huh) { pose = 'huh'; face = 'calm'; }  // the dad. arms crossed. "huh."
      }
      else if (gst.reactKind === 'scream') yOff = Math.abs(Math.sin(gst.reactT * 14)) * 0.22;
      else if (gst.reactKind === 'gotem') { yOff = Math.abs(Math.sin(gst.reactT * 12)) * 0.3; tilt = 0.2; }
      else if (gst.reactKind === 'dropped') { tilt = Math.min(0.55, (dur - gst.reactT) * 1.1); ly = -Math.min(0.42, (dur - gst.reactT) * 0.9); } // sits like a folding chair now, not a plank
      else if (gst.reactKind === 'melt') { tilt = 1.45; ly = -0.1; }
    } else if (gst.state === 'crawl') { face = 'joy'; tilt = 1.45; ly = -0.15; pose = 'crawl'; poseT = 1; }
    else if (gst.state === 'distress') { face = 'worry'; ly = -0.34; pose = 'distress'; poseT = 1; }
    else if (gst.spent) { face = 'joy'; pose = 'joy'; poseT = 1; }
    return { face, yOff, tilt, ly, pose, poseT };
  };

  /* one captured frame — called from the render loop, never from the sim */
  R.record = function (night, dt) {
    if (!night || night.done) return;
    const C = D().REPLAY;
    R.acc += dt;
    const step = 1 / C.fps;
    if (R.acc < step) { checkPending(night); return; }
    R.acc = 0;
    const gs = [];
    for (const gst of night.guests) {
      if (gst.out) continue;
      const p = night.guestPos(gst);
      const po = R.poseOf(gst);
      R.roster[gst.id] = gst.arch;
      /* ⚠️ yOff rides its OWN slot: folded into y it bypasses the reducedMotion damping
         that renderGuests applies to bob, and the tape is the one thing you cannot look away from. */
      gs.push([gst.id, p.x, po.ly, p.z, Math.atan2(p.dirX, p.dirZ), po.tilt, FACES.indexOf(po.face),
        POSES.indexOf(po.pose), Math.round(po.poseT * 100) / 100, Math.round(po.yOff * 1000) / 1000]);
    }
    R.frames.push({ t: night.t, g: gs });
    const cutoff = night.t - C.bufferS;
    while (R.frames.length && R.frames[0].t < cutoff) R.frames.shift();
    checkPending(night);
  };

  /* a scare landed — is it the one worth keeping? */
  R.mark = function (night, ev) {
    if (!ev || !ev.magnitude) return;
    if (R.take && ev.magnitude <= R.take.magnitude) return;
    if (R.pending && ev.magnitude <= R.pending.magnitude) return;
    const node = D().NODES.find(n => n.id === ev.node);
    const room = node && D().ROOMS.find(r => r.id === node.room);
    R.pending = {
      node: ev.node, room: node ? node.room : null,
      roomName: room ? room.name : 'the barn',
      pos: node ? node.pos : [24, 14],
      source: ev.source, magnitude: ev.magnitude, dropped: ev.dropped || 0,
      melted: ev.melted || 0, gradeMult: ev.gradeMult || 1,
      /* ⚠️ an aggregate event (the chainsaw run) stamps its own START time. Centring a take
         on night.t there would centre the tape on the aftermath, not the scare. */
      t: ev.atT === undefined ? night.t : ev.atT,
      endAt: (ev.atT === undefined ? night.t : ev.atT) + D().REPLAY.postS
    };
  };

  function checkPending(night) {
    const p = R.pending;
    if (!p || night.t < p.endAt) return;
    R.pending = null;
    const C = D().REPLAY;
    const from = p.t - C.preS, to = p.t + C.postS;
    const frames = R.frames.filter(f => f.t >= from && f.t <= to);
    if (frames.length < 3) return;                       // too thin to be a take
    const roster = {};
    for (const f of frames) for (const e of f.g) roster[e[0]] = R.roster[e[0]];
    const t0 = frames[0].t;
    R.take = {
      node: p.node, room: p.room, roomName: p.roomName, pos: p.pos,
      source: p.source, magnitude: p.magnitude, dropped: p.dropped, melted: p.melted,
      gradeMult: p.gradeMult,
      hitAt: p.t - t0,
      dur: frames[frames.length - 1].t - t0,
      frames: frames.map(f => ({ t: f.t - t0, g: f.g })),
      roster
    };
  }

  /* an interpolated frame at playback time tt (seconds into the take) */
  function plain(e) {
    return { id: e[0], x: e[1], y: e[2], z: e[3], ry: e[4], tilt: e[5], face: FACES[e[6]] || 'calm', pose: POSES[e[7]] || 'walk', poseT: e[8] || 0, bob: e[9] || 0 };
  }
  R.frameAt = function (take, tt) {
    const fr = take.frames;
    if (!fr.length) return [];
    if (tt <= fr[0].t) return fr[0].g.map(plain);
    let i = 1;
    while (i < fr.length && fr[i].t < tt) i++;
    if (i >= fr.length) return fr[fr.length - 1].g.map(plain);
    const a = fr[i - 1], b = fr[i];
    const u = (tt - a.t) / Math.max(1e-5, b.t - a.t);
    const bmap = {};
    for (const e of b.g) bmap[e[0]] = e;
    const out = [];
    for (const e of a.g) {
      const n = bmap[e[0]];
      if (!n) { out.push(plain(e)); continue; }
      out.push({
        id: e[0],
        x: e[1] + (n[1] - e[1]) * u,
        y: e[2] + (n[2] - e[2]) * u,
        z: e[3] + (n[3] - e[3]) * u,
        ry: e[4] + shortAngle(e[4], n[4]) * u,
        tilt: e[5] + (n[5] - e[5]) * u,
        face: FACES[(u < 0.5 ? e[6] : n[6])] || 'calm',
        pose: POSES[(u < 0.5 ? e[7] : n[7])] || 'walk',
        poseT: (e[8] || 0) + ((n[8] || 0) - (e[8] || 0)) * u,
        bob: (e[9] || 0) + ((n[9] || 0) - (e[9] || 0)) * u
      });
    }
    return out;
  };
  function shortAngle(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* the caption the tape wears */
  R.caption = function (take) {
    const who = take.source === 'nobody' ? 'unattributed' :
      take.source === 'you' ? 'you, on the lever' :
        take.source === 'you-body' ? 'you, through the curtain' :
          take.source.startsWith('crew:') ? take.source.slice(5) : take.source;
    return { room: take.roomName, who, mag: Math.round(take.magnitude), dropped: take.dropped, melted: take.melted };
  };

  H.Replay = R;
})(typeof globalThis !== 'undefined' ? globalThis : window);
