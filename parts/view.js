/* THE HAUNT — view.js — three.js (r128 UMD, window.THREE) renders the sim. No game logic lives here. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const V = {};
  let scene, camera, renderer, clock;
  let wallsGroup, guestMeshes = {}, stationMeshes = {}, nodeRings = {}, roomLights = {}, flickerT = 0;
  let alarmMode = false, strobeOff = false, reducedMotion = false;
  let polaroidWallTex = null, polaroidWallCtx = null;
  let ghostPulse = null;

  /* ---------- canvas textures ---------- */
  function plankTexture(base, seed) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    const rng = H.makeRng(seed || 7);
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) {
      const y = i * 32;
      x.fillStyle = `rgba(0,0,0,${0.12 + rng.f() * 0.1})`;
      x.fillRect(0, y, 256, 2);
      x.fillStyle = `rgba(255,255,255,${0.02 + rng.f() * 0.03})`;
      x.fillRect(0, y + 3, 256, 1);
      for (let k = 0; k < 14; k++) {
        x.fillStyle = `rgba(0,0,0,${0.05 + rng.f() * 0.08})`;
        x.fillRect(rng.f() * 256, y + 4 + rng.f() * 24, 8 + rng.f() * 30, 1);
      }
      const kx = rng.f() * 256, ky = y + 8 + rng.f() * 16;
      x.beginPath(); x.arc(kx, ky, 2.5 + rng.f() * 2, 0, 7); x.fillStyle = 'rgba(0,0,0,0.28)'; x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function faceTexture(kind) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = '#1a1208';
    if (kind === 'calm') { x.fillRect(18, 24, 7, 9); x.fillRect(39, 24, 7, 9); x.fillRect(24, 44, 16, 3); }
    else if (kind === 'worry') { x.fillRect(18, 24, 7, 11); x.fillRect(39, 24, 7, 11); x.beginPath(); x.arc(32, 48, 5, 0, 7); x.fill(); }
    else if (kind === 'scream') { x.fillRect(16, 20, 9, 13); x.fillRect(39, 20, 9, 13); x.beginPath(); x.arc(32, 47, 9, 0, 7); x.fill(); }
    else if (kind === 'joy') { x.fillRect(18, 26, 7, 5); x.fillRect(39, 26, 7, 5); x.beginPath(); x.arc(32, 42, 10, 0, Math.PI); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  const FACES = {};

  /* ---------- boot ---------- */
  V.init = function (canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(innerWidth, innerHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070510);
    scene.fog = new THREE.FogExp2(0x070510, 0.038);
    camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 220);
    clock = new THREE.Clock();
    ['calm', 'worry', 'scream', 'joy'].forEach(k => FACES[k] = faceTexture(k));
    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    buildWorld();
  };
  V.setA11y = function (opts) { strobeOff = !!opts.strobeOff; reducedMotion = !!opts.reducedMotion; };

  function mat(color, opts) { return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})); }

  function buildWorld() {
    const D = H.DATA;
    // sky: a thin moon and stars
    const stars = new THREE.Group();
    const srng = H.makeRng(99);
    for (let i = 0; i < 140; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.09 + srng.f() * 0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0xbfcfff }));
      s.position.set(srng.range(-80, 120), srng.range(18, 60), srng.range(-60, 90));
      stars.add(s);
    }
    scene.add(stars);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
    moon.position.set(-30, 34, -18); scene.add(moon);
    scene.add(new THREE.HemisphereLight(0x2a3a66, 0x141008, 0.85));

    // ground: yard dirt + grass
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x141a10));
    ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.02, 14);
    scene.add(ground);

    // barn floors
    const floorTex = plankTexture('#241708', 3); floorTex.repeat.set(6, 4);
    for (const r of D.ROOMS.concat([{ id: 'spine', x0: D.SPINE.x0, x1: D.SPINE.x1, z0: D.SPINE.z0, z1: D.SPINE.z1 }])) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), new THREE.MeshLambertMaterial({ map: floorTex, color: r.id === 'spine' ? 0x8a7a5c : 0x6b5a40 }));
      f.rotation.x = -Math.PI / 2;
      f.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
      scene.add(f);
    }

    // walls
    wallsGroup = new THREE.Group();
    const wallTex = plankTexture('#2b1c0c', 11); wallTex.repeat.set(2, 1.4);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, color: 0xb08a62 });
    for (const w of H.Barn.rects()) {
      const bw = w.x1 - w.x0, bd = w.z1 - w.z0;
      const box = new THREE.Mesh(new THREE.BoxGeometry(bw, D.BARN.wallH, bd), wallMat);
      box.position.set((w.x0 + w.x1) / 2, D.BARN.wallH / 2, (w.z0 + w.z1) / 2);
      wallsGroup.add(box);
    }
    scene.add(wallsGroup);

    // rafters
    const rafterMat = mat(0x241505);
    for (let x = 4; x <= 44; x += 5) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 26), rafterMat);
      b.position.set(x, D.BARN.wallH + 0.4, 14);
      scene.add(b);
    }

    // room lights + name of the game: pools of practical light
    for (const r of D.ROOMS) {
      const pl = new THREE.PointLight(r.light, r.lightI * 1.5, 19, 1.5);
      pl.position.set((r.x0 + r.x1) / 2, 2.7, (r.z0 + r.z1) / 2);
      scene.add(pl); roomLights[r.id] = pl;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: r.light }));
      bulb.position.copy(pl.position); scene.add(bulb);
    }
    // backstage work lights: a string of caged bulbs down the spine. yours. warm. always on.
    roomLights.spine = null;
    for (let i = 0; i < 5; i++) {
      const wx = 8 + i * 8;
      const wl = new THREE.PointLight(0xffd890, 1.05, 15, 1.15);
      wl.position.set(wx, 2.85, 14); scene.add(wl);
      if (i === 2) roomLights.spine = wl;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
      bulb.position.set(wx, 2.85, 14); scene.add(bulb);
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x584427, wireframe: true }));
      cage.position.set(wx, 2.85, 14); scene.add(cage);
    }

    // exit signs (green, emissive, code-mandated, beloved)
    const signMat = new THREE.MeshBasicMaterial({ color: 0x36ff7a });
    for (const d of D.DOORS.guest.concat(D.DOORS.chicken)) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.08), signMat);
      const o = d.o === 'ew' ? [d.x + 0.3, 2.6, d.z] : [d.x, 2.6, d.z + 0.3];
      s.position.set(o[0], o[1], o[2]);
      scene.add(s);
    }

    // peek curtains (dark red planes)
    for (const p of D.DOORS.peek) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(H.Barn.PEEK_W - 0.1, 2.6), new THREE.MeshLambertMaterial({ color: 0x481018, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      c.position.set(p.x, 1.3, p.z);
      if (p.o === 'ew') c.rotation.y = Math.PI / 2;
      scene.add(c);
    }

    // set dressing (cheap, readable)
    dressRooms();

    // node beat rings (floor)
    for (const n of D.NODES) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.02, 28), new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(n.pos[0], 0.06, n.pos[1]);
      ring.renderOrder = 5;
      scene.add(ring); nodeRings[n.id] = ring;
    }
  }

  function dressRooms() {
    const D = H.DATA;
    const grp = new THREE.Group();
    const add = (m, x, y, z, ry) => { m.position.set(x, y, z); if (ry) m.rotation.y = ry; grp.add(m); };
    // corn rows: cones
    const cornMat = mat(0x6b7a2a);
    for (let i = 0; i < 16; i++) {
      const cx = 13.5 + (i % 8) * 1.35, cz = i < 8 ? 6.6 : 8.2;
      add(new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2 + (i % 3) * 0.3, 6), cornMat), cx, 1.1, cz);
    }
    // dinner scene
    add(new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 1.6), mat(0x4a2c10)), 30, 0.95, 5.4);
    for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 0.55), mat(0x3a2008)), 28.4 + i * 1.1, 0.55, 4.4);
    for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat(0xd8cfa8)), 28.5 + i * 0.9, 1.12, 5.4);
    // surgery: table + lamp
    add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.1), mat(0x9fb4b8)), 41, 0.45, 6.5);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), mat(0xcfe0e4)), 41, 1.15, 6.5);
    // clown room: big soft shapes
    const clownColors = [0xd84a6a, 0x3a86c8, 0xd8b23a];
    for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.8 - i * 0.12, 10, 10), mat(clownColors[i])), 37 + i * 2.6, 0.8 - i * 0.12, 21.5 + (i % 2) * 1.6);
    // cellar: crates
    for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x332612)), 21.5 + (i % 3) * 1.3, 0.5 + Math.floor(i / 3) * 1.02, 24.3);
    // last laugh: a wide grin sign
    add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd23a })), 14, 2.2, 25.6);
    // hayloft hint: bales in spine
    for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.8), mat(0x8a6f2e)), 5 + i * 2.2, 0.4, 12.9);
    // ruthie's rocking chair. hayloft-adjacent. never commented on.
    const chair = new THREE.Group();
    const cm = mat(0x2e1a0a);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), cm); seat.position.y = 0.5; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.08), cm); back.position.set(0, 0.95, -0.32); chair.add(back);
    chair.position.set(42.5, 0, 13); chair.rotation.y = 0.7;
    grp.add(chair); V._chair = chair;
    // lobby polaroid wall
    const pc = document.createElement('canvas'); pc.width = 512; pc.height = 256;
    polaroidWallCtx = pc.getContext('2d');
    polaroidWallCtx.fillStyle = '#1c1208'; polaroidWallCtx.fillRect(0, 0, 512, 256);
    polaroidWallCtx.fillStyle = '#c8b890'; polaroidWallCtx.font = '22px monospace';
    polaroidWallCtx.fillText('the wall of got-got', 150, 36);
    polaroidWallTex = new THREE.CanvasTexture(pc);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), new THREE.MeshBasicMaterial({ map: polaroidWallTex }));
    wall.position.set(5, 1.6, 16.4); grp.add(wall);
    scene.add(grp);
  }

  V.pinPolaroid = function (dataUrl, idx) {
    if (!polaroidWallCtx) return;
    const img = new Image();
    img.onload = () => {
      const i = idx % 12;
      const px = 20 + (i % 6) * 80, py = 54 + Math.floor(i / 6) * 96;
      polaroidWallCtx.save();
      polaroidWallCtx.translate(px + 35, py + 42);
      polaroidWallCtx.rotate(((i * 37) % 10 - 5) * 0.03);
      polaroidWallCtx.drawImage(img, -32, -40, 64, 80);
      polaroidWallCtx.restore();
      polaroidWallTex.needsUpdate = true;
    };
    img.src = dataUrl;
  };

  /* ---------- stations ---------- */
  V.syncStations = function (buildSlots) {
    const D = H.DATA;
    for (const id of Object.keys(stationMeshes)) { scene.remove(stationMeshes[id].grp); delete stationMeshes[id]; }
    for (const slot of D.SLOTS) {
      const b = buildSlots[slot.id];
      if (!b || !b.type) continue;
      const grp = new THREE.Group();
      let mesh;
      if (b.type === 'dropPanel') mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.14), mat(0x51301c));
      else if (b.type === 'airCannon') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.1, 8), mat(0x6a707a));
      else if (b.type === 'fogBurst') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), mat(0x3d4650));
      else if (b.type === 'soundSting') mesh = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 8), mat(0x24303a));
      else if (b.type === 'lightSnap') mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), mat(0x8a8438));
      else if (b.type === 'rattleChain') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 6), mat(0x777c82));
      else mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.42), mat(0x202020)); // flashCam
      if (b.type === 'airCannon') mesh.rotation.z = Math.PI / 2;
      mesh.position.y = b.type === 'dropPanel' ? 1.1 : 1.0;
      grp.add(mesh);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x39ff70 }));
      led.position.set(0, 2.0, 0); grp.add(led);
      const tierTag = new THREE.Mesh(new THREE.BoxGeometry(0.12 * (b.tier || 1), 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffcf5a }));
      tierTag.position.set(0, 2.2, 0); grp.add(tierTag);
      grp.position.set(slot.at[0], 0, slot.at[1]);
      scene.add(grp);
      stationMeshes[slot.id] = { grp, led, type: b.type, broken: !!b.broken };
      if (b.broken) led.material.color.setHex(0xff3030);
    }
  };

  /* ---------- guests ---------- */
  function makeGuestMesh(gst) {
    const D = H.DATA;
    const arch = D.ARCHETYPES[gst.arch];
    const grp = new THREE.Group();
    const s = arch.size;
    const bodyMat = new THREE.MeshLambertMaterial({ color: arch.tint, emissive: arch.tint, emissiveIntensity: 0.18 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.3 * s, 0.9 * s, 8), bodyMat);
    body.position.y = 0.65 * s; grp.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 10, 10), mat(0xe8c8a0));
    head.position.y = 1.32 * s; grp.add(head);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3 * s, 0.3 * s), new THREE.MeshBasicMaterial({ map: FACES.calm, transparent: true }));
    face.position.set(0, 1.32 * s, 0.235 * s); grp.add(face);
    if (gst.arch === 'flannel') { const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 8), mat(0xb0402c)); hat.position.y = 1.56 * s; grp.add(hat); }
    if (gst.arch === 'grandma') { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), mat(0xdddddd)); bun.position.set(0, 1.52 * s, -0.1); grp.add(bun); }
    // nerve bar sprite
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 10;
    const bctx = bc.getContext('2d');
    const btex = new THREE.CanvasTexture(bc);
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, depthTest: false, transparent: true }));
    bar.scale.set(0.85, 0.14, 1); bar.position.y = 1.85 * s; bar.renderOrder = 9; bar.visible = false;
    grp.add(bar);
    scene.add(grp);
    return { grp, face, bar, bctx, btex, s, headBase: 1.32 * s };
  }

  V.syncGuests = function (night, xray) {
    const seen = {};
    for (const gst of night.guests) {
      if (gst.out) continue;
      seen[gst.id] = true;
      let m = guestMeshes[gst.id];
      if (!m) m = guestMeshes[gst.id] = makeGuestMesh(gst);
      const p = night.guestPos(gst);
      m.grp.position.x = p.x; m.grp.position.z = p.z;
      m.grp.rotation.y = Math.atan2(p.dirX, p.dirZ);
      // reaction posture
      let face = 'calm', yOff = 0, tilt = 0, ly = 0;
      const frac = gst.nerve / gst.pool;
      if (frac < 0.5) face = 'worry';
      if (gst.state === 'react') {
        face = 'scream';
        if (gst.reactKind === 'flinch') yOff = Math.abs(Math.sin(gst.reactT * 18)) * 0.12;
        else if (gst.reactKind === 'scream') yOff = Math.abs(Math.sin(gst.reactT * 14)) * 0.22;
        else if (gst.reactKind === 'gotem') { yOff = Math.abs(Math.sin(gst.reactT * 12)) * 0.3; tilt = 0.2; }
        else if (gst.reactKind === 'dropped') { tilt = Math.min(1.35, (2.6 - gst.reactT) * 2.2); }
        else if (gst.reactKind === 'melt') { tilt = 1.45; ly = -0.1; }
      } else if (gst.state === 'crawl') { face = 'joy'; tilt = 1.45; ly = -0.15; }
      else if (gst.state === 'distress') { face = 'worry'; ly = -0.5; }
      else if (gst.spent) face = 'joy';
      if (reducedMotion) yOff *= 0.4;
      m.grp.position.y = yOff + ly;
      m.grp.rotation.x = tilt;
      m.face.material.map = FACES[face];
      // nerve bar (backstage vision only)
      m.bar.visible = !!xray;
      if (xray) {
        const w = Math.max(0, Math.min(1, frac));
        m.bctx.clearRect(0, 0, 64, 10);
        m.bctx.fillStyle = 'rgba(10,8,4,0.8)'; m.bctx.fillRect(0, 0, 64, 10);
        m.bctx.fillStyle = w > 0.5 ? '#69d84a' : w > 0.26 ? '#e8c23a' : '#e84a3a';
        m.bctx.fillRect(1, 1, 62 * w, 8);
        if (gst.state === 'distress') { m.bctx.fillStyle = '#fff'; m.bctx.fillRect(0, 0, 64, 10); }
        m.btex.needsUpdate = true;
      }
    }
    for (const id of Object.keys(guestMeshes)) {
      if (!seen[id]) { scene.remove(guestMeshes[id].grp); delete guestMeshes[id]; }
    }
  };

  /* ---------- per-frame ---------- */
  V.update = function (night, player, buildSlots) {
    const dt = clock.getDelta();
    flickerT += dt;
    const D = H.DATA;
    // beat rings
    if (night) {
      for (const n of night.nodes) {
        const ring = nodeRings[n.id]; if (!ring) continue;
        let best = null;
        for (const grp of night.groups) {
          if (grp.mergedInto) continue;
          let lead = null;
          for (const gg of grp.guests) if (!gg.out && !gg.chicken) lead = lead === null ? gg.s : Math.max(lead, gg.s);
          if (lead === null) continue;
          const d = n.s - lead; // >0: approaching
          if (d > -n.window && d < n.window * 2.2) { if (best === null || Math.abs(d) < Math.abs(best)) best = d; }
        }
        if (best === null) { ring.material.opacity += (0 - ring.material.opacity) * 0.2; continue; }
        const closeness = 1 - Math.min(1, Math.abs(best) / (n.window * 2));
        ring.material.opacity = 0.15 + closeness * 0.75;
        const sc = 1 + Math.max(0, best) * 0.45;
        ring.scale.set(sc, sc, 1);
        ring.material.color.setHex(Math.abs(best) < 0.6 ? 0xffffff : 0xffcf5a);
      }
      // station LEDs
      for (const [slotId, sm] of Object.entries(stationMeshes)) {
        const st = night.stations[slotId];
        if (!st) continue;
        if (st.broken) sm.led.material.color.setHex(0xff3030);
        else sm.led.material.color.setHex(night.t < st.readyAt ? 0xe8a23a : 0x39ff70);
      }
    }
    // light mood
    const alarmNow = night && night.alarm.active;
    if (alarmNow !== alarmMode) {
      alarmMode = alarmNow;
      for (const [id, pl] of Object.entries(roomLights)) {
        if (alarmMode) { pl._keep = pl.intensity; pl.intensity = 1.6; pl.color.setHex(0xf8f4e8); }
        else { pl.intensity = pl._keep || pl.intensity; const r = D.ROOMS.find(rr => rr.id === id); if (r) pl.color.setHex(r.light); }
      }
      scene.fog.density = alarmMode ? 0.012 : 0.052;
    }
    if (!alarmMode && !strobeOff) {
      // gentle practical flicker
      for (const r of D.ROOMS) {
        const pl = roomLights[r.id];
        pl.intensity = r.lightI * 1.5 * (0.92 + 0.13 * Math.sin(flickerT * (3 + r.x0 * 0.13) + r.z0));
      }
    }
    if (ghostPulse) {
      ghostPulse.t -= dt;
      const pl = roomLights[ghostPulse.room];
      if (pl) pl.intensity = (ghostPulse.base || 0.3) + Math.max(0, Math.sin(ghostPulse.t * 2.4)) * 0.5;
      if (ghostPulse.t <= 0) { if (pl) pl.intensity = ghostPulse.base; ghostPulse = null; }
    }
    if (V._chair && !reducedMotion) V._chair.rotation.x = Math.sin(flickerT * 0.9) * 0.02; // it rocks. barely. no comment.
    // camera from player
    camera.position.set(player.x, player.y, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    renderer.render(scene, camera);
  };

  V.fx = function (ev) {
    if (ev.type === 'ghost') {
      const D = H.DATA;
      const node = D.NODES.find(n => n.id === ev.node);
      if (node) ghostPulse = { room: node.room, t: 3.5, base: (D.ROOMS.find(r => r.id === node.room) || {}).lightI || 0.3 };
    }
  };

  V.camera = () => camera;
  H.View = V;
})(typeof globalThis !== 'undefined' ? globalThis : window);
