/* THE HAUNT — view.js — three.js (r128 UMD, window.THREE) renders the sim. No game logic lives here. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const V = {};
  let scene, camera, renderer, clock;
  let wallsGroup, guestMeshes = {}, stationMeshes = {}, nodeRings = {}, roomLights = {}, flickerT = 0;
  let crewMeshes = {};                   // the other humans in the walls (co-op)
  let strobeOff = false, reducedMotion = false;
  let polaroidWallTex = null, polaroidWallCtx = null;
  let ghostPulse = null;
  const spineLights = [], cones = [], motes = [];
  let lmode = 'night', alarmT = -1, recoverT = -1, blobBaseOp = 0.42;
  const flickNow = {};
  const tmpCol = { c: null };
  const buildMarks = [];                 // build-day slot markers/labels
  const curtains = {};                   // peek curtains, by peek id — they part when you come through
  let hands = null, handAnim = null;     // the gloves. yours.
  let camOverride = null;                // the tape drives the camera instead of the player
  let hemi = null, sun = null, daylight = false, nightSky = null;  // build day happens in the morning. it should look like it.
  let dome = null, domeNight = null, domeDay = null, nightGlow = null;  // ⚠️ setDaylight writes these — module scope, not buildWorld's

  /* ---------- canvas textures ---------- */
  /* per-room floors. ⚠️ the cache key includes the repeat: texture.clone() gives each copy its
     own WebGLTexture and its own upload, so cloning per room would pay the VRAM 10 times. */
  const FLOOR_TEX = {};
  function floorTexture(style, frep) {
    const key = style + '|' + frep.join(',');
    if (FLOOR_TEX[key]) return FLOOR_TEX[key];
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d'); const rng = H.makeRng(style.length * 101 + 5);
    const plankBase = () => { const p = plankTexture('#241708', 3); x.drawImage(p.image, 0, 0); };
    if (style === 'dirt') {
      x.fillStyle = '#241c0e'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 300; i++) { x.fillStyle = 'rgba(' + (40 + rng.int(0, 30)) + ',' + (32 + rng.int(0, 22)) + ',' + (16 + rng.int(0, 12)) + ',0.5)'; x.fillRect(rng.f() * 256, rng.f() * 256, 2, 2); }
      x.strokeStyle = 'rgba(122,106,42,0.6)';
      for (let i = 0; i < 40; i++) { const sx = rng.f() * 256, sy = rng.f() * 256, a = rng.f() * 6.3; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * 10, sy + Math.sin(a) * 10); x.stroke(); }
    } else if (style === 'tile') {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#8a9a9a' : '#aab8b6'; x.fillRect(i * 32, j * 32, 31, 31); }
      x.fillStyle = 'rgba(20,24,20,0.5)';
      for (let i = 0; i < 60; i++) x.fillRect(rng.int(0, 7) * 32 + 28, rng.f() * 256, 4, 8 + rng.f() * 20);
      x.strokeStyle = 'rgba(30,30,28,0.7)';
      for (let k = 0; k < 2; k++) { const tx2 = rng.int(0, 7) * 32, ty = rng.int(0, 7) * 32; x.beginPath(); x.moveTo(tx2 + 4, ty + 26); x.lineTo(tx2 + 26, ty + 6); x.stroke(); }
    } else if (style === 'rug') {
      x.fillStyle = '#3a1c1e'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = '#c8a860'; x.lineWidth = 3; x.strokeRect(18, 18, 220, 220);
      x.strokeStyle = '#57302a'; x.lineWidth = 12; x.strokeRect(8, 8, 240, 240);
      x.save(); x.translate(128, 128); x.rotate(Math.PI / 4);
      x.strokeStyle = '#8a5a40'; x.lineWidth = 3; x.strokeRect(-34, -34, 68, 68); x.restore();
      for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(rng.f() * 256, rng.f() * 256, 2, 1); }
    } else if (style === 'concrete') {
      x.fillStyle = '#312e2a'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) {
        const gr = x.createRadialGradient(rng.f() * 256, rng.f() * 256, 2, rng.f() * 256, rng.f() * 256, 30 + rng.f() * 40);
        gr.addColorStop(0, 'rgba(14,12,10,0.25)'); gr.addColorStop(1, 'rgba(14,12,10,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
      }
      x.strokeStyle = 'rgba(12,10,8,0.6)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, 128); x.lineTo(256, 128); x.stroke();
      x.beginPath(); let cx = 40, cy = 0; x.moveTo(cx, cy);
      while (cy < 256) { cx += rng.range(-14, 14); cy += 20 + rng.f() * 18; x.lineTo(cx, cy); } x.stroke();
    } else if (style === 'paint') {
      plankBase();
      const rings = [[100, '#d84a6a'], [64, '#d8b23a']];
      for (const rr of rings) { x.strokeStyle = rr[1]; x.lineWidth = 14; x.globalAlpha = 0.5; x.beginPath(); x.arc(128, 128, rr[0], 0, 7); x.stroke(); }
      x.globalAlpha = 1; x.fillStyle = 'rgba(36,23,8,0.8)';
      for (let i = 0; i < 260; i++) x.fillRect(rng.f() * 256, rng.f() * 256, 3, 2);
    } else if (style === 'plywood') {
      x.fillStyle = '#8a7048'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i++) { x.fillStyle = 'rgba(' + (90 + rng.int(0, 60)) + ',' + (70 + rng.int(0, 40)) + ',' + (40 + rng.int(0, 20)) + ',0.25)'; x.fillRect(rng.f() * 256, rng.f() * 256, 4 + rng.f() * 8, 2); }
      x.fillStyle = 'rgba(40,28,12,0.6)'; x.fillRect(126, 0, 3, 256);
    } else if (style === 'plankworn') {
      plankBase();
      x.fillStyle = 'rgba(220,200,160,0.10)'; x.fillRect(70, 0, 110, 256);
    } else { plankBase(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(frep[0], frep[1]);
    return FLOOR_TEX[key] = t;
  }
  function signTex(lines) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#2a2014'; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#4a3a22'; x.lineWidth = 5; x.strokeRect(4, 4, 248, 120);
    x.fillStyle = '#100c06';
    x.beginPath(); x.arc(16, 14, 3, 0, 7); x.arc(240, 14, 3, 0, 7); x.fill();
    x.fillStyle = '#d0bc8e'; x.font = '19px "Courier New",monospace'; x.textAlign = 'center';
    lines.forEach(function (ln, i) { x.fillText(ln, 128, 46 + i * 26); });
    return new THREE.CanvasTexture(c);
  }
  function studTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d'); const rng = H.makeRng(55);
    x.fillStyle = '#7a6240'; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 350; i++) { x.fillStyle = 'rgba(' + (100 + rng.int(0, 50)) + ',' + (78 + rng.int(0, 34)) + ',' + (44 + rng.int(0, 18)) + ',0.3)'; x.fillRect(rng.f() * 256, rng.f() * 128, 5, 2); }
    for (let sx = 0; sx < 256; sx += 85) { x.fillStyle = 'rgba(30,20,8,0.55)'; x.fillRect(sx, 0, 5, 128); }
    x.fillStyle = 'rgba(30,22,10,0.8)'; x.font = '11px monospace';
    x.fillText('B-' + rng.int(10, 99), 12, 100);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping;
    return t;
  }
  function tapeTex(name) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 128, 64);
    x.strokeStyle = 'rgba(200,178,58,0.85)'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(18, 10); x.lineTo(110, 54); x.moveTo(110, 10); x.lineTo(18, 54); x.stroke();
    x.fillStyle = 'rgba(230,225,210,0.8)'; x.font = '13px monospace'; x.textAlign = 'center';
    x.fillText(name, 64, 34);
    return new THREE.CanvasTexture(c);
  }
  function stencilTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 64);
    x.font = 'bold 30px monospace'; x.textAlign = 'center';
    x.fillStyle = 'rgba(200,120,56,0.35)'; x.fillText('ALWAYS SCARE FORWARD', 129, 41);   // overspray
    x.fillStyle = '#c87838'; x.fillText('ALWAYS SCARE FORWARD', 128, 40);
    return new THREE.CanvasTexture(c);
  }
  function spillTex() {
    if (spillTex._t) return spillTex._t;
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,214,140,0.34)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return spillTex._t = new THREE.CanvasTexture(c);
  }
  function windowTex() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 4, 32, 32, 44);
    gr.addColorStop(0, '#ffe9b8'); gr.addColorStop(1, '#c88a3a');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#241505'; x.fillRect(29, 0, 6, 64); x.fillRect(0, 29, 64, 6);
    return new THREE.CanvasTexture(c);
  }
  function marqueeTex() {
    const Y = H.DATA.YARD;
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#14100a'; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = '#3a2c18'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 148);
    for (let i = 0; i < 24; i++) {                                   // bulb border, mostly dead
      x.fillStyle = i % 5 === 0 ? '#ffdca0' : '#4a3a24';
      x.beginPath(); x.arc(20 + i * 20.5, 18, 4, 0, 7); x.fill();
      x.beginPath(); x.arc(20 + i * 20.5, 142, 4, 0, 7); x.fill();
    }
    x.font = 'bold 58px "Courier New",monospace'; x.textAlign = 'center';
    const word = Y.marqueeWord, cw = 44, x0 = 256 - (word.length - 1) * cw / 2;
    for (let i = 0; i < word.length; i++) {
      if (Y.litLetters.indexOf(i) >= 0) { x.shadowColor = '#ffb04a'; x.shadowBlur = 16; x.fillStyle = '#ffdca0'; }
      else { x.shadowBlur = 0; x.fillStyle = 'rgba(216,206,170,0.13)'; }   // the ghosts of the dead letters
      x.fillText(word[i], x0 + i * cw, 100);
    }
    x.shadowBlur = 0;
    return new THREE.CanvasTexture(c);
  }
  function yardTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d'); const rng = H.makeRng(451);
    x.fillStyle = '#141a10'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 250; i++) { x.fillStyle = 'rgba(58,74,40,0.25)'; x.fillRect(rng.f() * 256, rng.f() * 256, 1 + rng.f(), 1 + rng.f()); }
    x.strokeStyle = 'rgba(90,80,55,0.18)'; x.lineWidth = 40;   // the trampled path to the door
    for (let k = 0; k < 3; k++) {
      x.beginPath(); x.moveTo(40 + k * 8, 256);
      x.bezierCurveTo(70, 180, 140, 140, 190 + k * 6, 30); x.stroke();
    }
    const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 3);
    return tx;
  }
  function starDotTex() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(200,215,255,0.5)');
    gr.addColorStop(1, 'rgba(200,215,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  function haloTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 6, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,242,204,0.55)'); gr.addColorStop(0.35, 'rgba(255,230,180,0.16)');
    gr.addColorStop(1, 'rgba(255,230,180,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  function skyGradTex(day) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256);
    if (day) { gr.addColorStop(0, '#a8bcd8'); gr.addColorStop(0.6, '#8ea2bc'); gr.addColorStop(1, '#c9b088'); }
    else { gr.addColorStop(0, '#040310'); gr.addColorStop(0.55, '#0a0822'); gr.addColorStop(0.82, '#181233'); gr.addColorStop(1, '#26192b'); }
    x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
    return new THREE.CanvasTexture(c);
  }
  function treelineTex(seed) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d'); const rng = H.makeRng(seed);
    x.clearRect(0, 0, 512, 128);
    x.fillStyle = '#05040a';
    let px = -10;
    while (px < 520) {
      const bw = 16 + rng.f() * 26, bh = 36 + rng.f() * 66;
      x.beginPath(); x.moveTo(px, 128); x.lineTo(px + bw / 2, 128 - bh); x.lineTo(px + bw, 128); x.fill();
      px += bw * (0.4 + rng.f() * 0.35);
    }
    x.fillRect(0, 106, 512, 22);
    const tx = new THREE.CanvasTexture(c); tx.wrapS = THREE.RepeatWrapping;
    return tx;
  }
  function shingleTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d'); const rng = H.makeRng(77);
    x.fillStyle = '#171310'; x.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 10; row++) {
      const y = row * 26, off = (row % 2) * 22;
      for (let k = -1; k < 6; k++) {
        x.fillStyle = 'rgba(' + (30 + rng.int(0, 16)) + ',' + (24 + rng.int(0, 12)) + ',' + (20 + rng.int(0, 10)) + ',1)';
        x.fillRect(off + k * 44, y, 42, 24);
      }
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, y + 24, 256, 2);
    }
    const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(6, 3);
    return tx;
  }
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
    const LFN = H.DATA.LIGHTING.FOG.night;
    scene.background = new THREE.Color(LFN.c);
    scene.fog = new THREE.FogExp2(LFN.c, LFN.d);
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

  /* the barn in the morning: work lights up, fog thin, no theatre. you can see what you're building. */
  V.setDaylight = function (on) {
    daylight = !!on;
    if (!scene) return;
    /* ⚠️ this sets the MODE and the sky. fog, hemi and every pool belong to updateLighting()
       — the single writer. Two writers of pl.intensity is how the old _keep hack was born. */
    scene.background.setHex(daylight ? 0x8ea2bc : H.DATA.LIGHTING.FOG.night.c);
    if (nightSky) nightSky.visible = !daylight;
    if (dome) dome.material.map = daylight ? domeDay : domeNight;
    if (nightGlow) nightGlow.visible = !daylight;
    if (sun) sun.intensity = daylight ? 0.85 : 0;
  };

  function mat(color, opts) { return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})); }

  /* ---------- the air: cones, motes, contact blobs ----------
     ⚠️ TWO radial sprites, not one. The blob is BLACK under NormalBlending (it darkens the
     floor); a mote is WHITE under AdditiveBlending. A black texture added to the frame
     contributes exactly zero — reuse the blob sprite for the motes and they render nothing,
     silently, with no console error to catch it. */
  function radialTex(r255, g255, b255) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(32, 32, 3, 32, 32, 30);
    const rgb = r255 + ',' + g255 + ',' + b255;
    grad.addColorStop(0, 'rgba(' + rgb + ',0.85)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  let BLOB_TEX = null, MOTE_TEX = null, BLOB_GEO = null;
  function blobMesh(scale) {
    if (!BLOB_TEX) { BLOB_TEX = radialTex(0, 0, 0); BLOB_GEO = new THREE.PlaneGeometry(1, 1); }
    const L = H.DATA.LIGHTING;
    const b = new THREE.Mesh(BLOB_GEO, new THREE.MeshBasicMaterial({
      map: BLOB_TEX, transparent: true, opacity: L.BLOB.op, depthWrite: false, fog: true }));
    b.rotation.x = -Math.PI / 2; b.renderOrder = 3;
    b.scale.setScalar(L.BLOB.r * 2 * (scale || 1));
    b.position.y = 0.02;
    /* ⚠️ scene-level, NOT a child of the body group: that group rotates on X up to 1.45 rad
       for melt/crawl, which would stand the 'contact shadow' on its edge. */
    scene.add(b);
    return b;
  }

  /* a beam you can see. two nested additive shells, opacity keyed to the fog: no fog, no beam. */
  function beamCone(gel, x, z, roomId) {
    const C = H.DATA.LIGHTING.CONE, grp = new THREE.Group(), mats = [], base = [];
    /* ⚠️ the cone runs PAST the floor by C.sink. Ending it exactly at y=0 leaves a hard
       decagon rim lying on the boards; the opaque floor clips the overshoot for free and
       the beam reads as landing instead of stopping. */
    const hCone = C.y + C.sink;
    for (const pair of [[1, C.outerOp], [0.62, C.innerOp]]) {
      const geo = new THREE.CylinderGeometry(C.topR * pair[0], C.botR * pair[0], hCone, C.segs, 1, true);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: gel, transparent: true, opacity: pair[1], blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.position.y = -hCone / 2; m.renderOrder = 2; grp.add(m);
      mats.push(m.material); base.push(pair[1]);
    }
    grp.position.set(x, C.y, z); scene.add(grp);
    cones.push({ mats, base, room: roomId || null });
  }

  /* the dust that makes the beam a volume. one Points per bulb, distance-culled to 2-3 live. */
  function moteCluster(cx, cz, gel, count) {
    const M = H.DATA.LIGHTING.MOTES;
    if (!MOTE_TEX) MOTE_TEX = radialTex(255, 255, 255);
    const pos = new Float32Array(count * 3), base = new Float32Array(count * 3);
    const rng = H.makeRng(Math.round(cx * 31 + cz * 7) + 1);
    for (let i = 0; i < count; i++) {
      const a = rng.f() * 6.283, rr = Math.sqrt(rng.f()) * 1.9;   // denser at the beam core
      base[i * 3] = cx + Math.cos(a) * rr;
      base[i * 3 + 1] = rng.f() * M.depth;
      base[i * 3 + 2] = cz + Math.sin(a) * rr;
    }
    pos.set(base);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: gel, size: M.size, transparent: true, opacity: M.op,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      map: MOTE_TEX, fog: false }));
    scene.add(pts);
    motes.push({ pts, base, cx, cz });
  }

  function buildWorld() {
    const D = H.DATA;

    /* ---------- the sky ---------- */
    /* one Points object instead of 140 sphere meshes: -139 draw calls, and fog:false stops
       FogExp2 from eating the field the way it ate the old spheres. */
    nightSky = new THREE.Group();
    const srng = H.makeRng(99);
    const SN = 320, spos = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const a = srng.range(0, Math.PI * 2), rr = srng.range(60, 130);
      spos[i * 3] = 20 + Math.cos(a) * rr;
      spos[i * 3 + 1] = srng.range(24, 95);      // ⚠️ floor 24: below that they sit behind the treeline crest
      spos[i * 3 + 2] = 14 + Math.sin(a) * rr;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    nightSky.add(new THREE.Points(sgeo, new THREE.PointsMaterial({
      color: 0xcfdcff, size: 1.5, sizeAttenuation: true, map: starDotTex(),
      transparent: true, depthWrite: false, fog: false
    })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: false }));
    moon.position.set(-30, 34, -18);
    nightSky.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
    }));
    halo.scale.set(16, 16, 1); halo.position.copy(moon.position);
    nightSky.add(halo);
    scene.add(nightSky);

    domeNight = skyGradTex(false); domeDay = skyGradTex(true);
    dome = new THREE.Mesh(
      new THREE.SphereGeometry(150, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2 + 0.18),
      new THREE.MeshBasicMaterial({ map: domeNight, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.position.set(20, -3, 14);
    scene.add(dome);

    /* the treeline. ⚠️ 1-bit silhouette: alphaTest + depthWrite, NOT transparent — a
       transparent tree sorts behind the star Points (whose sort key is its origin) and the
       stars paint straight through the pines. */
    const tlMat = new THREE.MeshBasicMaterial({ map: treelineTex(31), alphaTest: 0.5, transparent: false, fog: false });
    tlMat.map.repeat.set(3, 1);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(200, 24), tlMat);
      const a = i * Math.PI / 2 + 0.35;
      p.position.set(20 + Math.cos(a) * 105, 10, 14 + Math.sin(a) * 105);
      p.lookAt(20, 10, 14);
      scene.add(p);
    }

    const HN = H.DATA.LIGHTING.HEMI.night;
    hemi = new THREE.HemisphereLight(HN.sky, HN.ground, HN.i);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0d0, 0);   // morning through the board gaps; dark at showtime
    sun.position.set(-24, 40, -10);
    scene.add(sun);

    // ground: yard dirt + grass
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x141a10));
    ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.02, 14);
    scene.add(ground);

    /* ---------- the roof: the barn stops being a plywood maze from the yard ----------
       Front-side only, normals OUTWARD, so it is backface-culled from inside and changes
       nothing about sightlines or the replay camera. */
    const roofMat = new THREE.MeshLambertMaterial({ map: shingleTex(), color: 0x8a8078 });
    const RIDGE = 6.2, EAVE = D.BARN.wallH, HALF = 14, slopeW = Math.hypot(HALF, RIDGE - EAVE);
    for (const sgn of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(46, slopeW), roofMat);
      r.position.set(24, (EAVE + RIDGE) / 2, 14 + sgn * (HALF / 2));
      // ⚠️ no +PI term: it flips the s=-1 normal DOWN (invisible outside, visible inside)
      r.rotation.x = -Math.PI / 2 + sgn * Math.atan2(RIDGE - EAVE, HALF);
      scene.add(r);
    }
    /* ---------- and the underside of it ----------
       ⚠️ the roof above is FrontSide with normals OUTWARD, so it is invisible from inside —
       which means the barn had NO LID. Under the old hemi-0.85 wash nobody noticed; the
       moment the room went dark you were standing in the surgery looking up at STARS.
       Same two slopes, wound inward, dark: the light now has a ceiling to land on. */
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0x1d1409, side: THREE.BackSide });
    for (const sgn of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(46, slopeW), ceilMat);
      r.position.set(24, (EAVE + RIDGE) / 2 - 0.03, 14 + sgn * (HALF / 2));
      r.rotation.x = -Math.PI / 2 + sgn * Math.atan2(RIDGE - EAVE, HALF);
      scene.add(r);
    }
    // gable ends — wound OUTWARD, and reaching the real eaves at z 0 / 28
    for (const [gx, sgn] of [[2, -1], [46, 1]]) {
      const geo = new THREE.BufferGeometry();
      const tri = sgn > 0
        ? [gx, EAVE, 28, gx, EAVE, 0, gx, RIDGE, 14]
        : [gx, EAVE, 0, gx, EAVE, 28, gx, RIDGE, 14];
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3));
      geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x241a10 })));
      scene.add(new THREE.Mesh(geo, ceilMat));   // the same triangle, seen from in here
    }
    // the hayloft window. on every night. nothing ever mentions it.
    const loft = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0x8a6a3a, fog: false }));
    loft.position.set(1.97, 5.0, 14); loft.rotation.y = -Math.PI / 2;
    scene.add(loft);
    // barn floors — every room gets its own treatment
    for (const r of D.ROOMS.concat([{ id: 'spine', floor: 'plywood', frep: [8, 1.4], x0: D.SPINE.x0, x1: D.SPINE.x1, z0: D.SPINE.z0, z1: D.SPINE.z1 }])) {
      const tex = floorTexture(r.floor || 'plank', r.frep || [6, 4]);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0),
        new THREE.MeshLambertMaterial({ map: tex, color: r.id === 'spine' ? 0xcbb894 : 0x9a8868 }));
      fl.rotation.x = -Math.PI / 2;
      fl.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
      scene.add(fl);
    }

    // walls
    wallsGroup = new THREE.Group();
    const wallMats = [11, 12, 13].map(sd => new THREE.MeshLambertMaterial({
      map: (function () { const t = plankTexture('#2b1c0c', sd); t.repeat.set(2, 1.4); return t; })(),
      color: 0xb08a62
    }));
    for (const w of H.Barn.rects()) {
      const bw = w.x1 - w.x0, bd = w.z1 - w.z0;
      const wallMat = wallMats[Math.abs(Math.round(w.x0 * 7 + w.z0 * 13)) % 3];   // stable everywhere
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

    // room lights + name of the game: POOLS of practical light. the dark between them is the product.
    const LG = D.LIGHTING;
    for (const r of D.ROOMS) {
      const cfg = LG.ROOM[r.id] || LG.ROOM.entry;
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const pl = new THREE.PointLight(cfg.gel, cfg.i, cfg.dist, LG.DECAY);
      pl.position.set(cx, LG.CONE.y, cz);
      scene.add(pl); roomLights[r.id] = pl;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: cfg.gel }));
      bulb.position.copy(pl.position); scene.add(bulb);
      beamCone(cfg.gel, cx, cz, r.id);
      moteCluster(cx, cz, cfg.gel, LG.MOTES.perRoom);
    }
    // backstage work lights: a string of caged bulbs down the spine. yours. warm. always on.
    roomLights.spine = null;
    for (let i = 0; i < 5; i++) {
      const wx = 8 + i * 8;
      const wl = new THREE.PointLight(LG.SPINE.gel, LG.SPINE.i, LG.SPINE.dist, LG.SPINE.decay);
      wl.position.set(wx, 2.85, 14); scene.add(wl);
      spineLights.push(wl);            // ⚠️ ALL FIVE. four of them used to be anonymous, so the alarm never reached them.
      beamCone(LG.SPINE.gel, wx, 14, null);
      moteCluster(wx, 14, LG.SPINE.gel, LG.MOTES.perSpine);
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

    // peek curtains (dark red planes) — two halves, so they can PART when you come through
    for (const p of D.DOORS.peek) {
      const halves = [];
      for (const side of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry((H.Barn.PEEK_W - 0.1) / 2, 2.6),
          new THREE.MeshLambertMaterial({ color: 0x481018, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
        const off = side * (H.Barn.PEEK_W - 0.1) / 4;
        c.position.set(p.o === 'ew' ? p.x : p.x + off, 1.3, p.o === 'ew' ? p.z + off : p.z);
        if (p.o === 'ew') c.rotation.y = Math.PI / 2;
        c.userData.home = c.position.clone();
        c.userData.side = side;
        c.userData.axis = p.o === 'ew' ? 'z' : 'x';
        scene.add(c); halves.push(c);
      }
      curtains[p.id] = halves;
    }

    // set dressing (cheap, readable)
    dressRooms();

    // the gloves ride the camera, so the camera has to live in the scene
    hands = buildHands();
    camera.add(hands.grp);
    scene.add(camera);

    // node beat rings (floor)
    for (const n of D.NODES) {
      /* additive, not paint: in a dark room a flat opaque ring reads as a sticker on the
         floor and outshines the practical it is sitting under. */
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.02, 28), new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(n.pos[0], 0.06, n.pos[1]);
      ring.renderOrder = 5;
      scene.add(ring); nodeRings[n.id] = ring;
    }
  }

  /* how close is a point to the guest route? solid props stay off it so nobody walks through a table. */
  function nearRoute(x, z, m) {
    const R = H.DATA.ROUTE;
    for (let i = 1; i < R.length; i++) {
      const ax = R[i - 1][0], az = R[i - 1][1], bx = R[i][0], bz = R[i][1];
      const dx = bx - ax, dz = bz - az;
      const L2 = dx * dx + dz * dz || 1e-6;
      let t = ((x - ax) * dx + (z - az) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, pz = az + dz * t;
      if ((px - x) ** 2 + (pz - z) ** 2 < m * m) return true;
    }
    return false;
  }

  /* ---------- set dressing: the barn is a place somebody built by hand ---------- */
  function dressRooms() {
    const D = H.DATA;
    const grp = new THREE.Group();
    const rng = H.makeRng(4271);
    const add = (m, x, y, z, ry) => { m.position.set(x, y, z); if (ry) m.rotation.y = ry; grp.add(m); return m; };
    const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    const cyl = (rt, rb, h, s, c) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat(c));
    const sph = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat(c));
    const cone = (r, h, s, c) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), mat(c));
    const glow = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), new THREE.MeshBasicMaterial({ color: c }));
    const sheet = (w, h, c, o) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: o === undefined ? 1 : o }));
    /* solid props refuse to stand on the walking route */
    const put = (m, x, y, z, ry, clear) => { if (nearRoute(x, z, clear === undefined ? 1.15 : clear)) return null; return add(m, x, y, z, ry); };
    V._sway = [];
    const Y = D.YARD;
    const sway = (m, kind, amp) => { V._sway.push({ m, kind, amp, ph: rng.range(0, 6.28), base: m.rotation.z, y0: m.position.y }); return m; };

    /* ===== the yard: what you see coming up route 9 =====
       ⚠️ ZERO new lights. The barn already forward-lights 14 point lights through Lambert and
       cannot afford more — every glow here is emissive fakery plus an additive ground spill. */
    nightGlow = new THREE.Group(); grp.add(nightGlow);
    const spill = (x, z, sc, hex) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshBasicMaterial({
        map: spillTex(), blending: THREE.AdditiveBlending, depthWrite: false,
        transparent: true, opacity: 1, fog: false      // ⚠️ transparent, or it lands in the OPAQUE list
      }));
      if (hex) m.material.color.setHex(hex);
      m.position.set(x, 0.015, z); m.rotation.x = -Math.PI / 2; m.scale.setScalar(sc);
      m.renderOrder = 3; nightGlow.add(m); return m;
    };
    // queue posts + rope
    for (let i = 0; i < 5; i++) add(box(0.14, 1.05, 0.14, 0x3a2c18), -2.5, 0.52, 5 + i * 2.4);
    for (let i = 0; i < 4; i++) add(box(0.05, 0.05, 2.4, 0x6a1a1a), -2.5, 0.92, 6.2 + i * 2.4);
    // the ticket shed, lit from inside
    add(box(2.4, 1.9, 1.6, 0x3d2a14), -4.4, 0.95, 12.6);
    add(box(2.0, 0.12, 1.4, 0x24180a), -4.4, 1.94, 12.6);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), new THREE.MeshBasicMaterial({ map: windowTex(), fog: false }));
    win.position.set(Y.shedWindow[0], Y.shedWindow[1], Y.shedWindow[2]); win.rotation.y = Math.PI;
    nightGlow.add(win);
    spill(-4.4, 11.2, 1.0);
    // THE MARQUEE — most of the bulbs are dead and two letters never come back
    const marquee = add(box(5.4, 1.8, 0.3, 0x2a1c10), Y.marqueeAt[0], Y.marqueeAt[1], Y.marqueeAt[2]);
    marquee.rotation.y = 0.1;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.56), new THREE.MeshBasicMaterial({ map: marqueeTex(), fog: false, transparent: true }));
    face.position.z = 0.17; marquee.add(face);
    for (const px of [-2.2, 2.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.18), mat(0x241a10)); post.position.set(px, -1.7 - 0.9, 0); marquee.add(post); }
    // the one letter that still tries: a tired fade, not a strobe
    const buzz = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.9), new THREE.MeshBasicMaterial({
      color: 0xffdca0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    buzz.position.set(-2.5 + Y.buzzLetter * 0.44, 0.06, 0.19); marquee.add(buzz);
    sway(buzz, 'buzz', 1);
    spill(Y.marqueeAt[0], Y.marqueeAt[2] + 1.2, 1.3);
    // string lights down the queue — one instanced draw call
    const bulbGeo = new THREE.SphereGeometry(0.05, 5, 4);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 40);
    const m4 = new THREE.Matrix4(); let bi = 0;
    for (const span of Y.lightSpans) {
      const ax = span[0], ay = span[1], az = span[2], bx = span[3], by = span[4], bz = span[5], cnt = span[6];
      const pts = [];
      for (let i = 0; i <= cnt; i++) {
        const tt = i / cnt, sag = Math.sin(tt * Math.PI) * 0.32;
        const p = new THREE.Vector3(ax + (bx - ax) * tt, ay + (by - ay) * tt - sag, az + (bz - az) * tt);
        pts.push(p);
        if (i < cnt && bi < 40) { m4.setPosition(p.x, p.y - 0.05, p.z); bulbs.setMatrixAt(bi++, m4); }
      }
      nightGlow.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x14100a })));
    }
    bulbs.count = bi; bulbs.instanceMatrix.needsUpdate = true; nightGlow.add(bulbs);
    // the fence along route 9, and two trucks that say people are already inside
    const F = Y.fence;
    const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    const posts = new THREE.InstancedMesh(postGeo, mat(0x2a2014), F.posts);
    const prng = H.makeRng(613);
    for (let i = 0; i < F.posts; i++) {
      const z = F.z0 + (F.z1 - F.z0) * (i / (F.posts - 1));
      m4.makeRotationZ(prng.range(-0.08, 0.08)); m4.setPosition(F.x, 0.55, z);
      posts.setMatrixAt(i, m4);
    }
    posts.instanceMatrix.needsUpdate = true; grp.add(posts);
    for (const zz of [[F.z0, F.gapAt - F.gapW / 2], [F.gapAt + F.gapW / 2, F.z1]]) {
      const len = zz[1] - zz[0];
      if (len > 0.5) add(box(0.06, 0.05, len, 0x2a2014), F.x, 0.95, (zz[0] + zz[1]) / 2);
    }
    for (const tk of [[-11, 3], [-12, 24]]) {
      add(box(1.8, 1.1, 4.2, 0x11141a), tk[0], 0.55, tk[1]);
      add(box(1.7, 0.5, 1.6, 0x0d1016), tk[0], 1.35, tk[1] - 0.6);
    }
    // the ground the queue has been standing on for weeks
    const yardG = new THREE.Mesh(new THREE.PlaneGeometry(16, 30), new THREE.MeshLambertMaterial({ map: yardTex(), color: 0xa89878 }));
    yardG.rotation.x = -Math.PI / 2; yardG.position.set(-5, -0.01, 14); grp.add(yardG);

    /* ===== entry hall ===== */
    for (let i = 0; i < 4; i++) put(box(1.5, 0.85, 0.85, 0x8a6f2e), 3.4 + i * 0.2, 0.42, 3.2 + i * 0.95, rng.range(-0.3, 0.3), 1.4);
    const rack = add(box(0.08, 0.08, 2.2, 0x4a3a20), 3.2, 1.9, 10.6);                                      // coat rack + coats
    for (let i = 0; i < 4; i++) put(box(0.42, 0.9, 0.16, [0x40303a, 0x2c3a30, 0x3a2c26, 0x33303f][i]), 3.3, 1.35, 9.8 + i * 0.5, 0, 0.9);
    for (let i = 0; i < 6; i++) put(sph(0.26 + rng.f() * 0.12, 0xc8641a), 4.6 + rng.range(0, 6), 0.26, 3.0 + rng.range(0, 1.2), 0, 1.1);  // pumpkins
    const sign = put(box(1.3, 0.9, 0.08, 0x2e2418), 9.6, 0.9, 3.4, -0.5, 1.2);                             // sandwich board
    if (sign) add(box(1.1, 0.14, 0.02, 0xd8b23a), 9.6, 1.05, 3.36, -0.5);

    /* ===== corn rows: the first room that touches you back =====
       thin stalks with leaves, not cones — a cone at this scale reads as a traffic pylon. */
    const cornMat = mat(0x46561e), cornDry = mat(0x6a6428), leafMat = new THREE.MeshLambertMaterial({ color: 0x4e5f22, side: THREE.DoubleSide });
    const leafGeo = new THREE.PlaneGeometry(0.16, 0.95);
    for (let i = 0; i < 34; i++) {
      const cx = 12.9 + (i % 9) * 1.24 + rng.range(-0.15, 0.15);
      const cz = 4.3 + Math.floor(i / 9) * 1.85 + rng.range(-0.3, 0.3);
      const h = 1.75 + rng.f() * 0.55;
      const stalk = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, h, 5), i % 5 === 0 ? cornDry : cornMat);
      body.position.y = h / 2; stalk.add(body);
      for (let k = 0; k < 3; k++) {
        const lf = new THREE.Mesh(leafGeo, leafMat);
        lf.position.set(0, h * (0.42 + k * 0.16), 0);
        lf.rotation.set(rng.range(0.5, 1.0), k * 2.1 + rng.range(0, 0.6), rng.range(-0.5, 0.5));
        stalk.add(lf);
      }
      const tas = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 4), cornDry);
      tas.position.y = h + 0.1; stalk.add(tas);
      stalk.rotation.z = rng.range(-0.09, 0.09);
      sway(add(stalk, cx, 0, cz), 'stalk', 0.045);
    }
    for (let i = 0; i < 10; i++) put(box(0.3, 0.03, 0.12, 0x7a6a2a), 13 + rng.range(0, 10), 0.02, 3 + rng.range(0, 8), rng.range(0, 3), 0.5);
    const post = add(box(0.14, 2.6, 0.14, 0x3a2a14), 22.4, 1.3, 3.4);                                      // the scarecrow
    add(box(1.7, 0.12, 0.12, 0x3a2a14), 22.4, 2.05, 3.4);
    add(box(0.62, 0.95, 0.34, 0x6a4a28), 22.4, 1.75, 3.4);
    add(sph(0.28, 0xb89a52), 22.4, 2.45, 3.4);
    for (const lx of [14.2, 20.6]) { add(box(0.1, 2.1, 0.1, 0x2a2014), lx, 1.05, 10.9); add(glow(0.13, 0xffb04a), lx, 2.1, 10.9); }

    /* ===== the dinner scene ===== */
    put(box(4.4, 0.18, 1.6, 0x4a2c10), 30, 0.95, 4.6, 0, 0.9);
    for (let i = 0; i < 4; i++) put(box(0.5, 1.05, 0.5, 0x3a2008), 28.4 + i * 1.1, 0.52, 3.6, 0, 0.8);
    for (let i = 0; i < 5; i++) put(cyl(0.17, 0.17, 0.04, 10, 0xd8cfa8), 28.5 + i * 0.9, 1.06, 4.6, 0, 0.8);
    for (const cx of [28.9, 31.3]) {                                                                        // candles that actually flicker
      put(cyl(0.05, 0.06, 0.3, 6, 0xe8e0c8), cx, 1.19, 4.6, 0, 0.8);
      const fl = put(cone(0.05, 0.16, 5, 0xffb43a), cx, 1.42, 4.6, 0, 0.8);
      if (fl) { fl.material = new THREE.MeshBasicMaterial({ color: 0xffb43a }); sway(fl, 'flame', 1); }
    }
    const host = put(box(0.55, 1.0, 0.4, 0x51402c), 26.8, 1.0, 4.6, 0, 0.8);                                // the one who never eats
    if (host) { add(sph(0.24, 0xcbb08a), 26.8, 1.72, 4.6); add(box(0.5, 1.05, 0.5, 0x3a2008), 26.8, 0.52, 4.6); }
    put(box(1.6, 2.2, 0.6, 0x33220e), 34.6, 1.1, 3.1, 0, 1.0);                                              // the hutch
    for (let i = 0; i < 5; i++) put(cyl(0.09, 0.09, 0.22, 7, 0xbcae8c), 34.0 + i * 0.32, 1.65, 3.1, 0, 0.9);
    const chand = add(cyl(0.5, 0.62, 0.14, 10, 0x2a2018), 30, 2.9, 6.2);                                    // chandelier
    for (let i = 0; i < 5; i++) add(glow(0.07, 0xffc878), 30 + Math.cos(i * 1.257) * 0.55, 2.86, 6.2 + Math.sin(i * 1.257) * 0.55);

    /* ===== the surgery ===== */
    put(box(2.6, 0.9, 1.1, 0x9fb4b8), 41, 0.45, 6.5, 0, 0.9);
    add(sph(0.34, 0xcfe0e4), 41, 1.15, 6.5);
    add(box(0.1, 1.5, 0.1, 0x8a969a), 41.9, 0.75, 5.3); add(glow(0.16, 0xdff2ff), 41.9, 1.55, 5.3);         // the lamp on its pole
    put(box(0.7, 0.06, 0.5, 0xb8c4c8), 39.4, 0.85, 6.4, 0, 0.9);                                            // instrument tray
    for (let i = 0; i < 4; i++) put(box(0.28, 0.02, 0.05, 0xdfe8ea), 39.2 + i * 0.14, 0.89, 6.4, rng.range(0, 1), 0.8);
    put(box(0.06, 0.85, 0.06, 0x99a4a8), 39.4, 0.42, 6.4, 0, 0.8);
    add(box(2.2, 0.1, 0.5, 0x6a7478), 44.6, 2.0, 4.4, Math.PI / 2);                                          // the jar shelf
    for (let i = 0; i < 5; i++) add(cyl(0.14, 0.14, 0.34, 8, [0x9fd8b0, 0xd8b09f, 0xb0c8d8, 0xd8d09f, 0xc8a0c0][i]), 44.6, 2.22, 3.3 + i * 0.55);
    for (let i = 0; i < 9; i++) sway(add(sheet(0.24, 2.3, 0xdce8ea, 0.5), 38.2, 1.15, 3.2 + i * 0.9), 'strip', 0.06);

    /* ===== the squeeze: foam walls, both sides, no room to be brave ===== */
    for (let i = 0; i < 8; i++) {
      sway(add(sheet(0.3, 2.4, 0x2a1418, 0.92), 44.6, 1.2, 12.4 + i * 0.46, Math.PI / 2), 'strip', 0.07);
      sway(add(sheet(0.3, 2.4, 0x2a1418, 0.92), 45.7, 1.2, 12.2 + i * 0.46, Math.PI / 2), 'strip', 0.07);
    }

    /* ===== the clown room nobody asked for but the town demands ===== */
    const clownColors = [0xd84a6a, 0x3a86c8, 0xd8b23a, 0x5ac86a, 0xc86ad8];
    for (let i = 0; i < 7; i++) {
      const bx = 35.4 + rng.range(0, 9.6), bz = 17.2 + rng.range(0, 7.6);
      const b = add(sph(0.34, clownColors[i % 5]), bx, 2.1 + rng.f() * 0.5, bz);
      add(box(0.02, 1.3, 0.02, 0xd8d0c0), bx, b.position.y - 0.75, bz);
      sway(b, 'balloon', 0.16);
    }
    for (let i = 0; i < 4; i++) {                                                                            // striped poles
      const px = 35.2 + i * 3.2;
      add(cyl(0.14, 0.14, 3.0, 8, 0xf0e8e0), px, 1.5, 25.4);
      for (let k = 0; k < 5; k++) add(cyl(0.146, 0.146, 0.22, 8, 0xd83a4a), px, 0.4 + k * 0.6, 25.4);
    }
    const horse = put(box(1.3, 0.7, 0.5, 0xf0e2d0), 43.2, 1.5, 18.4, 0.4, 1.2);                              // the carousel horse
    if (horse) { add(cyl(0.06, 0.06, 3.2, 6, 0xd8b23a), 43.2, 1.6, 18.4); add(box(0.5, 0.5, 0.4, 0xf0e2d0), 43.8, 1.85, 18.1, 0.4); }
    const mirror = add(sheet(1.6, 2.4, 0xb8c8d8, 0.72), 34.4, 1.4, 20.2, Math.PI / 2);                       // the funhouse mirror
    mirror.material.emissive = new THREE.Color(0x223040); mirror.material.emissiveIntensity = 0.5;
    for (let i = 0; i < 26; i++) put(box(0.12, 0.01, 0.12, clownColors[i % 5]), 35 + rng.range(0, 10), 0.01, 17 + rng.range(0, 8), rng.range(0, 3), 0.35);

    /* ===== the cellar pass ===== */
    for (let i = 0; i < 6; i++) put(box(1, 1, 1, 0x332612), 21.5 + (i % 3) * 1.3, 0.5 + Math.floor(i / 3) * 1.02, 24.3, rng.range(-0.2, 0.2), 1.0);
    add(box(3.4, 0.08, 0.5, 0x2e2416), 24.5, 1.5, 25.6); add(box(3.4, 0.08, 0.5, 0x2e2416), 24.5, 2.1, 25.6);
    for (let i = 0; i < 7; i++) add(cyl(0.11, 0.11, 0.3, 7, [0x7f9f6f, 0x9f7f6f, 0x6f7f9f][i % 3]), 23.2 + i * 0.44, 1.69, 25.6);
    for (let i = 0; i < 3; i++) add(cyl(0.1, 0.1, 12, 6, 0x4a4038), 27, 3.1 - i * 0.22, 17.4 + i * 0.3, Math.PI / 2);  // pipes overhead
    const furnace = add(box(1.5, 2.0, 1.0, 0x2a2420), 32.6, 1.0, 25.2);                                       // the furnace
    const grate = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ color: 0xff7a2a })), 32.6, 0.8, 24.68);
    sway(grate, 'ember', 1);
    for (let i = 0; i < 5; i++) {                                                                             // cobwebs in the corners
      const w = add(sheet(1.3, 1.3, 0xd8d8d0, 0.14), 20.6 + i * 3.2, 2.7, 16.5 + (i % 2) * 9);
      w.rotation.x = -Math.PI / 2.4;
    }
    add(cyl(0.03, 0.03, 1.4, 5, 0x8a8278), 30.2, 2.4, 21.6);

    /* ===== the last laugh ===== */
    add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd23a })), 14, 2.2, 25.6);
    add(box(0.16, 2.8, 0.16, 0x4a3418), 9.4, 1.4, 21.2); add(box(0.16, 2.8, 0.16, 0x4a3418), 9.4, 1.4, 18.2);
    add(box(0.16, 0.16, 3.2, 0x4a3418), 9.4, 2.8, 19.7);                                                      // the arch out
    for (let i = 0; i < 9; i++) add(sph(0.09, [0xd83a4a, 0xd8b23a, 0x5ac86a][i % 3]), 9.4, 2.66, 18.3 + i * 0.36);
    put(box(1.8, 0.12, 0.5, 0x5a4222), 17.6, 0.5, 17.2, 0, 1.0);                                              // a bench for the shaky ones
    put(box(0.16, 0.5, 0.4, 0x5a4222), 16.9, 0.25, 17.2, 0, 1.0);
    put(box(0.16, 0.5, 0.4, 0x5a4222), 18.3, 0.25, 17.2, 0, 1.0);
    for (let i = 0; i < 14; i++) sway(add(sheet(0.1, 0.9, [0xd83a4a, 0xd8b23a, 0x5ac86a, 0x3a86c8][i % 4], 0.9), 10.5 + i * 0.62, 2.5, 24.9), 'strip', 0.1);

    /* ===== the exit lobby: cocoa, a jar, and the wall ===== */
    put(box(1.6, 0.1, 0.7, 0x5a4222), 4.4, 0.9, 19.4, 0, 0.9);
    put(box(0.12, 0.9, 0.12, 0x3a2a14), 3.7, 0.45, 19.4, 0, 0.8);
    put(box(0.12, 0.9, 0.12, 0x3a2a14), 5.1, 0.45, 19.4, 0, 0.8);
    for (let i = 0; i < 5; i++) put(cyl(0.08, 0.07, 0.17, 7, 0xf0e8dc), 3.9 + i * 0.28, 1.04, 19.3, 0, 0.7);
    const jar = put(cyl(0.2, 0.2, 0.42, 10, 0xcfe0d8), 5.6, 1.16, 19.4, 0, 0.8);
    if (jar) { jar.material.transparent = true; jar.material.opacity = 0.55; add(glow(0.12, 0xd8b23a), 5.6, 1.04, 19.4); }
    const tally = add(box(1.6, 1.1, 0.06, 0x1a2018), 2.35, 1.7, 21.4, Math.PI / 2);                            // the chalkboard
    for (let i = 0; i < 12; i++) add(box(0.02, 0.22, 0.01, 0xd8e8d0), 2.42, 1.8 - Math.floor(i / 6) * 0.4, 20.9 + (i % 6) * 0.16, Math.PI / 2);

    /* ===== the spine: YOUR corridor. the guests never see any of this. ===== */
    for (let i = 0; i < 4; i++) add(box(1.4, 0.8, 0.8, 0x8a6f2e), 5 + i * 2.2, 0.4, 12.9);                     // bales
    add(box(2.6, 0.08, 0.6, 0x3a2c18), 13.6, 1.5, 12.6); add(box(2.6, 0.08, 0.6, 0x3a2c18), 13.6, 2.1, 12.6);  // prop shelf
    const junk = [0xd83a4a, 0x6a7a2a, 0x9fb4b8, 0xd8b23a, 0x51402c, 0x3a86c8];
    for (let i = 0; i < 8; i++) add(box(0.24 + rng.f() * 0.2, 0.24, 0.24, junk[i % 6]), 12.6 + i * 0.28, 1.66 + (i % 2) * 0.6, 12.6);
    for (let i = 0; i < 3; i++) add(cyl(0.42, 0.42, 0.3, 12, 0x2e2418), 21 + i * 0.9, 0.15, 12.7, 0, 0);       // cable spools
    add(box(0.9, 0.5, 0.5, 0x3d4650), 24.4, 0.25, 12.7);                                                       // the spare fog machine
    add(cyl(0.06, 0.06, 1.2, 6, 0x2a2a2a), 24.4, 1.05, 12.7);
    const fan = add(cyl(0.34, 0.34, 0.12, 12, 0x6a7078), 28.2, 1.9, 12.7, 0);                                   // box fan, always on
    fan.rotation.x = Math.PI / 2; sway(fan, 'fan', 1);
    add(box(0.06, 0.9, 0.06, 0x4a5058), 28.2, 1.3, 12.7);
    const rackBar = add(box(0.06, 0.06, 3.0, 0x5a5048), 33, 2.2, 12.8);                                         // the costume rack
    for (let i = 0; i < 6; i++) sway(add(sheet(0.5, 1.3, [0x2c2c33, 0x3a2c26, 0x24302c, 0x33262e, 0x2e2a1e, 0x282838][i], 0.95), 33, 1.45, 11.6 + i * 0.5), 'strip', 0.05);
    for (let i = 0; i < 4; i++) add(cyl(0.11, 0.11, 0.06, 10, 0x4a4a4a), 36.4 + i * 0.3, 1.56, 12.7);           // gaff tape
    add(cyl(0.1, 0.1, 0.28, 8, 0xb8322a), 37.8, 1.68, 12.7);                                                    // the thermos
    add(box(1.2, 0.06, 0.5, 0x3a2c18), 36.9, 1.5, 12.7);

    /* ===== the rooms speak ===== */
    for (const sg of D.SIGNS) {
      // a real guard, not a claim: a board in a doorway is a board guests walk through
      if (nearRoute(sg.at[0], sg.at[2], 0.8)) { console.warn('THE HAUNT: sign too close to the route', sg.lines[0]); continue; }
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshLambertMaterial({ map: signTex(sg.lines), transparent: true }));
      p.position.set(sg.at[0], sg.at[1], sg.at[2]); p.rotation.y = sg.ry;
      p.rotation.z = ((sg.at[0] * 7) % 5 - 2) * 0.012;         // nothing in this barn hangs straight
      grp.add(p);
    }

    /* ===== the spine reads BACKSTAGE: raw plywood, honest labels, warm bulbs ===== */
    const st = studTex();
    for (const w of H.Barn.rects()) {
      if (!w.run || (w.run.z !== 12 && w.run.z !== 16)) continue;
      if (w.x0 >= D.SPINE.x1) continue;                        // ⚠️ the squeeze is a SHOW room, not the spine
      const x1c = Math.min(w.x1, D.SPINE.x1);
      const len = x1c - w.x0; if (len < 0.6) continue;
      const t2 = st.clone(); t2.needsUpdate = true; t2.repeat.set(len / 2.2, 1);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len, D.BARN.wallH - 0.15), new THREE.MeshLambertMaterial({ map: t2 }));
      const facez = w.run.z === 12 ? w.z1 + 0.02 : w.z0 - 0.02;
      p.position.set((w.x0 + x1c) / 2, (D.BARN.wallH - 0.15) / 2, facez);
      if (w.run.z === 16) p.rotation.y = Math.PI;
      grp.add(p);
    }
    // spike tape + a chalked room name at every peek door: dressing AND lane markings
    for (const pk of D.DOORS.peek) {
      const room = D.ROOMS.find(r => r.id === pk.room);
      const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: tapeTex(room ? room.name : ''), transparent: true }));
      dec.rotation.x = -Math.PI / 2;
      dec.position.set(pk.x, 0.012, pk.z + (pk.z <= 12 ? 0.75 : -0.75));
      dec.renderOrder = 2; grp.add(dec);
    }
    // ruthie painted this and the trade means it. the only uppercase text in the barn.
    const sten = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: stencilTex(), transparent: true }));
    sten.position.set(6, 2.85, 12.03); grp.add(sten);
    // ruthie's rocking chair. hayloft-adjacent. never commented on.
    const chair = new THREE.Group();
    const cm = mat(0x2e1a0a);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), cm); seat.position.y = 0.5; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.08), cm); back.position.set(0, 0.95, -0.32); chair.add(back);
    for (const sx of [-0.3, 0.3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), cm); leg.position.set(sx, 0.25, 0.28); chair.add(leg); }
    chair.position.set(42.5, 0, 13); chair.rotation.y = 0.7;
    grp.add(chair); V._chair = chair;

    /* the two boards you walk up to on build day */
    const P = D.PROPS;
    const cs = add(box(2.2, 1.3, 0.08, 0xb0aca0), P.callSheet[0], 1.75, P.callSheet[1]);
    cs.material = new THREE.MeshLambertMaterial({ color: 0xb0aca0 });
    for (let i = 0; i < 6; i++) add(box(1.5, 0.05, 0.01, 0x4a5a7a), P.callSheet[0] - 0.1, 2.15 - i * 0.17, P.callSheet[1] + 0.05);
    add(box(2.4, 0.1, 0.14, 0x3a2c18), P.callSheet[0], 1.05, P.callSheet[1]);
    const cl = add(box(0.7, 0.95, 0.06, 0xd8c8a0), P.dials[0], 1.6, P.dials[1]);
    add(box(0.74, 0.14, 0.1, 0x8a8278), P.dials[0], 2.02, P.dials[1]);
    V._boards = { cs, cl };

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

  /* the props that breathe. cheap, deterministic-free (view only), skipped under reduced motion. */
  function updateSway(dt) {
    if (!V._sway) return;
    for (const s of V._sway) {
      const w = flickerT + s.ph;
      if (s.kind === 'fan') { s.m.rotation.z += dt * (reducedMotion ? 2 : 9); continue; }
      if (s.kind === 'buzz') {          // ⚠️ above the reducedMotion guard, or its clamp is unreachable
        s.m.material.opacity = (strobeOff || reducedMotion) ? 0.3
          : 0.08 + Math.max(0, Math.sin(w * 1.3)) * 0.34 + Math.max(0, Math.sin(w * 7.7)) * 0.08;
        continue;
      }
      if (reducedMotion) continue;
      if (s.kind === 'balloon') { s.m.position.y = s.y0 + Math.sin(w * 0.9) * s.amp; }
      else if (s.kind === 'flame') { const k = 0.85 + Math.sin(w * 11) * 0.15 + Math.sin(w * 27) * 0.08; s.m.scale.set(k, k * 1.15, k); }
      else if (s.kind === 'ember') { s.m.material.color.setRGB(1, 0.36 + Math.sin(w * 1.7) * 0.1, 0.12); }
      else s.m.rotation.z = s.base + Math.sin(w * 1.4) * s.amp;
    }
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

  /* ---------- guests: the little people ----------
     Seven shared geometries, a pooled material set, and a gait driven by DISTANCE TRAVELED —
     never wall-clock — so the walk is identical live, on the co-op wire, and on the tape
     (including a paused tape: dist 0 means everybody stands still). */

  function mergeGeo(list) {          // r128-safe: BufferGeometryUtils is an examples module, not bundled
    const pos = [], norm = [];
    for (const g0 of list) {
      const g1 = g0.toNonIndexed();
      pos.push.apply(pos, g1.attributes.position.array);
      norm.push.apply(norm, g1.attributes.normal.array);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    return out;
  }
  let RIG_GEO = null;
  function rigGeo() {
    if (RIG_GEO) return RIG_GEO;
    const R = H.DATA.RIG;
    const leg = new THREE.BoxGeometry(R.legW, R.legH, R.legW + 0.01); leg.translate(0, -R.legH / 2, 0);
    const foot = new THREE.BoxGeometry(R.legW, 0.09, R.footL); foot.translate(0, -R.legH + 0.045, R.footL * 0.22);
    const arm = new THREE.BoxGeometry(R.armW, R.armH, R.armW + 0.01); arm.translate(0, -R.armH / 2, 0);
    RIG_GEO = {
      leg: mergeGeo([leg, foot]),                                   // origin at the hip
      arm,                                                          // origin at the shoulder
      torso: new THREE.BoxGeometry(1, 1, 1),                        // scaled per build
      head: new THREE.SphereGeometry(R.headR, 10, 8),
      hair: new THREE.SphereGeometry(R.headR * 1.06, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
      face: new THREE.PlaneGeometry(0.3, 0.3),
      phone: new THREE.PlaneGeometry(0.09, 0.13),
      cap: new THREE.CylinderGeometry(R.capR[0], R.capR[1], R.capR[2], 8),
      bun: new THREE.SphereGeometry(R.bunR, 6, 6)
    };
    return RIG_GEO;
  }

  const MAT_POOL = new Map();
  function pmat(hex, eHex, eI) {
    const key = hex + '|' + (eHex || 0) + '|' + (eI || 0);
    let m = MAT_POOL.get(key);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: hex, emissive: eHex || 0x000000, emissiveIntensity: eI || 0 }); MAT_POOL.set(key, m); }
    return m;
  }
  function shadeHex(hex, f) {
    const r = Math.min(255, ((hex >> 16) & 255) * f) | 0, g2 = Math.min(255, ((hex >> 8) & 255) * f) | 0, b = Math.min(255, (hex & 255) * f) | 0;
    return (r << 16) | (g2 << 8) | b;
  }

  function makeGuestMesh(archKey, id) {
    const D = H.DATA, R = D.RIG, G = rigGeo();
    const arch = D.ARCHETYPES[archKey] || D.ARCHETYPES.chain;
    const B = D.ARCH_BUILD[archKey] || {};
    const s = arch.size;
    const rng = H.makeRng((((id || 1) * 2654435761) ^ 0x9e3779b9) >>> 0);   // seeded by guest id: same look live, on the wire, on the tape
    const skin = D.LOOK.skins[rng.int(0, D.LOOK.skins.length - 1)];
    const hairC = D.LOOK.hairs[rng.int(0, D.LOOK.hairs.length - 1)];
    const tint = shadeHex(arch.tint, D.LOOK.outfitShades[rng.int(0, 2)]);
    const pants = D.LOOK.pants[rng.int(0, D.LOOK.pants.length - 1)];

    const grp = new THREE.Group(); grp.scale.setScalar(s);
    const legL = new THREE.Mesh(G.leg, pmat(pants)); legL.position.set(-R.torsoW * 0.28, R.legH, 0); grp.add(legL);
    const legR = new THREE.Mesh(G.leg, pmat(pants)); legR.position.set(R.torsoW * 0.28, R.legH, 0); grp.add(legR);
    const chest = new THREE.Group(); chest.position.y = R.legH; grp.add(chest);
    const torso = new THREE.Mesh(G.torso, pmat(tint, tint, 0.18));
    torso.scale.set(R.torsoW * (B.shoulders || 1), R.torsoH, R.torsoD * (B.belly || 1));
    torso.position.y = R.torsoH / 2; chest.add(torso);
    const head = new THREE.Mesh(G.head, pmat(skin));
    head.position.y = R.headY; head.scale.setScalar(B.head || 1); chest.add(head);
    const face = new THREE.Mesh(G.face, new THREE.MeshBasicMaterial({ map: FACES.calm, transparent: true }));
    face.position.z = R.headR * 0.98; head.add(face);
    let hairMesh;
    if (B.hat === 'cap') { hairMesh = new THREE.Mesh(G.cap, pmat(D.LOOK.capColor)); hairMesh.position.y = R.headR * 0.9; }
    else if (B.hair === 'bun') { hairMesh = new THREE.Mesh(G.bun, pmat(D.LOOK.bunColor)); hairMesh.position.set(0, R.headR * 0.7, -R.headR * 0.6); }
    else { hairMesh = new THREE.Mesh(G.hair, pmat(hairC)); if (B.hair === 'long') hairMesh.scale.y = 1.7; }
    head.add(hairMesh);
    const shoulderX = (R.torsoW * (B.shoulders || 1)) / 2 + R.armW / 2;
    const armL = new THREE.Mesh(G.arm, pmat(tint, tint, 0.12)); armL.position.set(-shoulderX, R.torsoH * 0.94, 0); chest.add(armL);
    const armR = new THREE.Mesh(G.arm, pmat(tint, tint, 0.12)); armR.position.set(shoulderX, R.torsoH * 0.94, 0); chest.add(armR);
    let phone = null;
    if (B.phone) { phone = new THREE.Mesh(G.phone, new THREE.MeshBasicMaterial({ color: 0xbcd8ff })); phone.position.set(0.1, R.torsoH * 0.72, R.torsoD * 0.9); phone.rotation.x = -0.5; chest.add(phone); }
    if (B.sash) { const sash = new THREE.Mesh(G.torso, pmat(0xf0e0a0, 0xf0e0a0, 0.25)); sash.scale.set(R.torsoW * 1.06, 0.07, R.torsoD * 1.08); sash.position.y = R.torsoH * 0.62; sash.rotation.z = 0.5; chest.add(sash); }
    // nerve bar — unchanged mechanics; scale compensated so body scale never shrinks the bar
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 10;
    const bctx = bc.getContext('2d');
    const btex = new THREE.CanvasTexture(bc);
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, depthTest: false, transparent: true }));
    bar.scale.set(0.85 / s, 0.14 / s, 1); bar.position.y = R.barY; bar.renderOrder = 9; bar.visible = false;
    grp.add(bar);
    scene.add(grp);
    const blob = blobMesh(s);
    return {
      grp, chest, head, face, hairMesh, armL, armR, legL, legR, phone, bar, bctx, btex, s, blob,
      stoop: B.stoop || 0, slouch: B.slouch || 0,
      lx: null, lz: null, walkD: ((id || 1) % 7) * 0.21, spd: 0, blend: 0, _far: null,
      distAcc: 0, timeAcc: 0, fresh: true, _barKey: null
    };
  }

  /* the gait and the poses. phase is pure distance; dt only shapes amplitude and the release blend. */
  function applyRig(m, e, dt) {
    const R = H.DATA.RIG;
    if (m.lx === null) { m.lx = e.x; m.lz = e.z; }
    const dist = Math.hypot(e.x - m.lx, e.z - m.lz);
    m.lx = e.x; m.lz = e.z;
    m.walkD += dist;
    m.distAcc += dist; m.timeAcc += dt;
    if (m.timeAcc >= R.speedWinS) { m.spd = Math.min(3.4, m.distAcc / m.timeAcc); m.distAcc = 0; m.timeAcc = 0; }
    const ph = (m.walkD / R.stride) * Math.PI * 2;
    const mo = reducedMotion ? 0.4 : 1;
    const gait = Math.min(1, m.spd / 1.15) * mo;
    const joy = e.pose === 'joy';
    // a melting guest is stationary, so the distance phase is frozen — drive the writhe off poseT
    const mThrash = Math.sin((e.poseT || 0) * 18) * R.meltThrash * mo;
    const aSw = (joy ? R.joyArm : 1) * R.swingArm * gait, lSw = R.swingLeg * gait;
    let aLx = Math.sin(ph) * aSw, aRx = -Math.sin(ph) * aSw, aLz = 0.06, aRz = -0.06;
    let lLx = -Math.sin(ph) * lSw, lRx = Math.sin(ph) * lSw;
    let hx = m.stoop, cx = m.stoop + m.slouch;
    let bob = Math.abs(Math.sin(ph)) * (joy ? R.joyBob : R.bobAmp) * gait;
    const T = {
      flinch:   { aLx: -1.2, aRx: -1.2, aLz: 0.55, aRz: -0.55, hx: -0.25 },
      scream:   { aLx: -2.95, aRx: -2.95, aLz: 0.34, aRz: -0.34, hx: -0.4 },
      gotem:    { aLx: -2.1, aRx: -1.3, aLz: 0.4, aRz: -0.2, hx: -0.3, lLx: -0.6 },
      dropped:  { aLx: 0.6, aRx: 0.55, aLz: 1.15, aRz: -1.15, lLx: -1.35, lRx: -1.2, hx: -0.2 },
      melt:     { aLx: -1.4 + mThrash, aRx: -1.4 - mThrash, lLx: 0.9, lRx: 0.9, hx: -0.9 },
      crawl:    { aLx: -1.5 + Math.sin(ph * 2) * R.crawlReach * mo, aRx: -1.5 - Math.sin(ph * 2) * R.crawlReach * mo, lLx: 0.9, lRx: 0.9, hx: -0.9 },
      distress: { lLx: -2.15, lRx: -2.15, aLx: -1.85, aRx: -1.85, aLz: 0.85, aRz: -0.85, hx: 0.5 },
      huh:      { aLx: -0.55, aRx: -0.55, aLz: 1.05, aRz: -1.05 }
    }[e.pose];
    const want = T ? Math.min(1, (e.poseT || 0) * R.snapIn) : 0;   // snap-in rides SIM time, so the tape matches
    if (m.fresh) { m.blend = want; m.fresh = false; }        // tape restart / fresh join: strike it immediately
    else m.blend += (want - m.blend) * Math.min(1, dt * R.release);
    const k = m.blend, mix = (a, b) => a + (b - a) * k;
    if (T) {
      aLx = mix(aLx, T.aLx !== undefined ? T.aLx : 0); aRx = mix(aRx, T.aRx !== undefined ? T.aRx : 0);
      aLz = mix(aLz, T.aLz !== undefined ? T.aLz : 0.06); aRz = mix(aRz, T.aRz !== undefined ? T.aRz : -0.06);
      lLx = mix(lLx, T.lLx !== undefined ? T.lLx : 0); lRx = mix(lRx, T.lRx !== undefined ? T.lRx : 0);
      hx = mix(hx, (T.hx || 0) + m.stoop); bob *= (1 - k);
    }
    m.armL.rotation.set(aLx, 0, aLz); m.armR.rotation.set(aRx, 0, aRz);
    m.legL.rotation.x = lLx; m.legR.rotation.x = lRx;
    m.head.rotation.x = hx * 0.6;
    m.chest.rotation.x = cx * 0.5 + (T ? k * (T.hx || 0) * 0.3 : 0);
    if (m.phone) m.phone.visible = !T;                             // the too-cool teen pockets it when they break
    return bob;
  }

  /* THE one place guests get drawn. Three callers feed it the same shape:
     the live sim (syncGuests), the tape (replayFrame), and the wire (a co-op guest's snapshot).
     entry: { id, arch, x, y, z, ry, tilt, face, bob?, nerve?, distress? } */
  V.renderGuests = function (list, xray, dtIn) {
    const dt = dtIn === undefined ? 0.016 : Math.max(0.0005, Math.min(0.1, dtIn));
    const seen = {};
    for (const g of list) {
      seen[g.id] = true;
      let m = guestMeshes[g.id];
      if (!m) m = guestMeshes[g.id] = makeGuestMesh(g.arch || 'chain', g.id);
      const bob = reducedMotion ? (g.bob || 0) * 0.4 : (g.bob || 0);
      const rigBob = applyRig(m, g, dt);
      m.grp.position.set(g.x, bob + rigBob + (g.y || 0), g.z);
      m.grp.rotation.y = g.ry; m.grp.rotation.x = g.tilt || 0;
      /* the shadow stays on the floor and lightens as the body leaves it. it reads the SAME
         lift the group got (bob + rigBob + y), so a hop and a faint both show. */
      const lift = bob + rigBob + (g.y || 0);
      m.blob.position.set(g.x, 0.02, g.z);
      m.blob.material.opacity = blobBaseOp * Math.max(0.15, 1 - Math.min(1, lift * 2));
      m.face.material.map = FACES[g.face] || FACES.calm;
      // LOD: past RIG.lodM the limbs and the nerve bar stop drawing; torso+head+face carry the read
      const far = camera.position.distanceTo(m.grp.position) > H.DATA.RIG.lodM;
      if (far !== m._far) {
        m._far = far;
        m.armL.visible = m.armR.visible = m.legL.visible = m.legR.visible = !far;
        if (m.hairMesh) m.hairMesh.visible = !far;
      }
      const showBar = !!xray && g.nerve !== undefined && g.nerve !== null && !far;
      m.bar.visible = showBar;
      if (showBar) {
        const w = Math.max(0, Math.min(1, g.nerve));
        const barKey = (Math.round(w * 62) | 0) + (g.distress ? 512 : 0);
        if (barKey !== m._barKey) {                          // only redraw when it actually changed
          m._barKey = barKey;
          m.bctx.clearRect(0, 0, 64, 10);
          m.bctx.fillStyle = 'rgba(10,8,4,0.8)'; m.bctx.fillRect(0, 0, 64, 10);
          m.bctx.fillStyle = w > 0.5 ? '#69d84a' : w > 0.26 ? '#e8c23a' : '#e84a3a';
          m.bctx.fillRect(1, 1, 62 * w, 8);
          if (g.distress) { m.bctx.fillStyle = '#fff'; m.bctx.fillRect(0, 0, 64, 10); }
          m.btex.needsUpdate = true;
        }
      }
    }
    for (const id of Object.keys(guestMeshes)) {
      if (!seen[id]) { disposeGuest(guestMeshes[id]); delete guestMeshes[id]; }
    }
  };

  /* only what is per-guest: the two canvas-backed materials. geometry and body mats are shared. */
  function disposeGuest(m) {
    try { m.btex.dispose(); m.bar.material.dispose(); m.face.material.dispose(); } catch (e) { }
    scene.remove(m.grp);
    if (m.blob) { scene.remove(m.blob); try { m.blob.material.dispose(); } catch (e) { } }
  }

  /* the live sim's view of the room */
  V.syncGuests = function (night, xray, dt) {
    const list = [];
    for (const gst of night.guests) {
      if (gst.out) continue;
      const p = night.guestPos(gst);
      const po = H.Replay.poseOf(gst);
      list.push({
        id: gst.id, arch: gst.arch, x: p.x, y: po.ly, z: p.z,
        ry: Math.atan2(p.dirX, p.dirZ), tilt: po.tilt, face: po.face, bob: po.yOff,
        pose: po.pose, poseT: po.poseT,
        nerve: gst.nerve / gst.pool, distress: gst.state === 'distress'
      });
    }
    V.renderGuests(list, xray, dt);
  };

  V.clearGuests = function () {
    for (const id of Object.keys(guestMeshes)) { disposeGuest(guestMeshes[id]); delete guestMeshes[id]; }
  };

  /* ---------- the other monsters (co-op): silhouette first, name over the hood ---------- */
  function makeCrewMesh(name) {
    const grp = new THREE.Group();
    const cloth = new THREE.MeshLambertMaterial({ color: 0x2a3226, emissive: 0x0a0e08, emissiveIntensity: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 1.25, 7), cloth);
    body.position.y = 0.62; grp.add(body);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.27, 9, 8), cloth);
    hood.position.y = 1.4; grp.add(hood);
    const dark = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 7), new THREE.MeshBasicMaterial({ color: 0x070806 }));
    dark.position.set(0, 1.38, 0.13); grp.add(dark);          // where the face isn't
    const glove = new THREE.MeshLambertMaterial({ color: 0x46503a });
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), glove);
      arm.position.set(s * 0.3, 0.82, 0.06); arm.rotation.z = s * 0.18; grp.add(arm);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.06, 4), new THREE.MeshLambertMaterial({ color: 0xd8cfb0 }));
        c.position.set(s * 0.3 + (i - 1) * 0.04, 0.53, 0.06); c.rotation.x = Math.PI; grp.add(c);
      }
    }
    const tag = labelSprite(name, null, '#9fd8a8');
    tag.scale.set(1.5, 0.42, 1); tag.position.y = 2.0; grp.add(tag);
    scene.add(grp);
    return { grp, tag, blob: blobMesh(1.1) };
  }

  V.syncCrew = function (list) {
    const seen = {};
    for (const c of list || []) {
      seen[c.id] = true;
      let m = crewMeshes[c.id];
      if (!m) m = crewMeshes[c.id] = makeCrewMesh(c.name || 'a monster');
      m.grp.position.set(c.x, 0, c.z);
      m.grp.rotation.y = c.yaw || 0;
      if (m.blob) { m.blob.position.set(c.x, 0.02, c.z); m.blob.material.opacity = blobBaseOp; }
    }
    for (const id of Object.keys(crewMeshes)) {
      if (!seen[id]) {
        const m = crewMeshes[id];
        if (m.tag && m.tag.material.map) m.tag.material.map.dispose();
        if (m.blob) { scene.remove(m.blob); try { m.blob.material.dispose(); } catch (e) { } }
        scene.remove(m.grp); delete crewMeshes[id];
      }
    }
  };
  V.clearCrew = function () { V.syncCrew([]); };

  /* ---------- the tape: rebuild the room from a recorded frame ---------- */
  V.replayFrame = function (take, guests, dt) {
    V.renderGuests(guests.map(gr => ({
      id: gr.id, arch: take.roster[gr.id] || 'chain',
      x: gr.x, y: gr.y, z: gr.z, ry: gr.ry, tilt: gr.tilt, face: gr.face,
      pose: gr.pose, poseT: gr.poseT
    })), false, dt);
    for (const id of Object.keys(nodeRings)) nodeRings[id].material.opacity = 0;   // no HUD furniture on the tape
  };

  /* the cinematic: a slow arc around the scare, kept honestly inside the room's four walls */
  V.setReplayCam = function (take, tt) {
    const C = H.DATA.REPLAY;
    const room = H.DATA.ROOMS.find(r => r.id === take.room);
    const cx = take.pos[0], cz = take.pos[1];
    const a = 2.3 + tt * C.orbit;
    let px = cx + Math.cos(a) * C.radius, pz = cz + Math.sin(a) * C.radius;
    if (room) {
      const m = 1.1;
      px = Math.max(room.x0 + m, Math.min(room.x1 - m, px));
      pz = Math.max(room.z0 + m, Math.min(room.z1 - m, pz));
    }
    camOverride = { px, py: C.height, pz, tx: cx, ty: 1.15, tz: cz };
  };
  V.clearReplayCam = function () { camOverride = null; };

  /* ---------- build day: the slots, marked and labelled ---------- */
  function labelSprite(text, sub, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 72;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(12,9,5,0.82)'; x.fillRect(0, 0, 256, 72);
    x.strokeStyle = color || '#b8924a'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 69);
    x.fillStyle = color || '#f0dca0'; x.font = 'bold 26px "Courier New",monospace'; x.textAlign = 'center';
    x.fillText(text, 128, 34);
    if (sub) { x.fillStyle = '#a89878'; x.font = '18px "Courier New",monospace'; x.fillText(sub, 128, 58); }
    const t = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    sp.scale.set(2.4, 0.68, 1); sp.renderOrder = 20;
    return sp;
  }

  V.setBuildMode = function (on, buildSlots) {
    for (const m of buildMarks) { scene.remove(m); if (m.material && m.material.map) m.material.map.dispose(); }
    buildMarks.length = 0;
    if (!on) return;
    const D = H.DATA;
    for (const slot of D.SLOTS) {
      const b = buildSlots[slot.id];
      const node = D.NODES.find(n => n.id === slot.node);
      const room = D.ROOMS.find(r => r.id === node.room);
      const filled = b && b.type;
      const label = filled ? (b.broken ? D.STATIONS[b.type].name + ' — DEAD' : D.STATIONS[b.type].name)
        : 'empty slot';
      const sub = filled ? (b.broken ? 'E — fix it' : 'tier ' + b.tier + ' · E') : room.name + ' · E';
      const sp = labelSprite(label, sub, filled ? (b.broken ? '#e86848' : '#8fd868') : '#e8b23a');
      sp.position.set(slot.at[0], D.BUILD_MODE.markerY, slot.at[1]);
      scene.add(sp); buildMarks.push(sp);
      if (!filled) {
        const ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 1.1),
          new THREE.MeshBasicMaterial({ color: 0xe8b23a, wireframe: true, transparent: true, opacity: 0.32 }));
        ghostBox.position.set(slot.at[0], 0.9, slot.at[1]);
        scene.add(ghostBox); buildMarks.push(ghostBox);
      }
    }
    const P = D.PROPS;
    const a = labelSprite('the call sheet', 'who works where · E', '#c8a868');
    a.position.set(P.callSheet[0], 2.55, P.callSheet[1] + 0.35); scene.add(a); buildMarks.push(a);
    const b2 = labelSprite('the dials', 'spacing · ticket · E', '#c8a868');
    b2.position.set(P.dials[0], 2.45, P.dials[1] - 0.35); scene.add(b2); buildMarks.push(b2);
  };

  /* ---------- the hands: what the guests see, from your side of the curtain ---------- */
  function buildHands() {
    const grp = new THREE.Group();
    const glove = new THREE.MeshLambertMaterial({ color: 0x46503a, emissive: 0x141a10, emissiveIntensity: 0.6 });
    const claw = new THREE.MeshLambertMaterial({ color: 0xd8cfb0, emissive: 0x2a2618, emissiveIntensity: 0.5 });
    function hand(sign) {
      /* the HAND is the read, not the arm — keep the forearm short or it fills the screen with log */
      const h = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.082, 0.3, 7), glove);
      arm.rotation.x = Math.PI / 2; arm.position.z = 0.2; h.add(arm);
      for (let i = 0; i < 3; i++) {   // ragged sleeve
        const r = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshLambertMaterial({ color: 0x2e3626, side: THREE.DoubleSide }));
        r.position.set(0, -0.02 - i * 0.02, 0.27 + i * 0.045); r.rotation.x = 0.5 + i * 0.2; h.add(r);
      }
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.085, 0.24), glove);
      palm.position.z = -0.04; h.add(palm);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.06, 0.2), glove);
        f.position.set((-0.085 + i * 0.057) * sign, 0.012, -0.24);
        f.rotation.x = -0.26 - i * 0.04; h.add(f);
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.085, 5), claw);
        c.position.set(f.position.x, 0.04, -0.36); c.rotation.x = -Math.PI / 2 - 0.24; h.add(c);
      }
      const th = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.145), glove);
      th.position.set(0.13 * sign, -0.008, -0.11); th.rotation.y = 0.55 * sign; h.add(th);
      const tc = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 5), claw);
      tc.position.set(0.185 * sign, 0.01, -0.18); tc.rotation.x = -Math.PI / 2 - 0.24; h.add(tc);
      return h;
    }
    const L = hand(-1), R = hand(1);
    grp.add(L); grp.add(R);
    grp.visible = false;
    return { grp, L, R };
  }

  V.popHands = function (peekId) { handAnim = { kind: 'pop', t: 0, dur: H.DATA.HANDS.popS, peek: peekId || null }; };
  V.leverHand = function () { handAnim = { kind: 'lever', t: 0, dur: H.DATA.HANDS.leverS }; };
  V.handsIdle = function () { handAnim = null; if (hands) hands.grp.visible = false; };

  /* the curtain you came through — parted while the hands are out, closed again after */
  function updateCurtains() {
    const open = handAnim && handAnim.kind === 'pop' ? handAnim.peek : null;
    const f = open ? Math.min(1, handAnim.t / (handAnim.dur * 0.34)) : 0;
    for (const id of Object.keys(curtains)) {
      const amt = id === open ? f : 0;
      for (const c of curtains[id]) {
        const home = c.userData.home;
        const push = c.userData.side * amt * 0.42;
        c.position[c.userData.axis] = home[c.userData.axis] + push;
        c.material.opacity = 0.92 - amt * 0.55;
        c.rotation.z = -c.userData.side * amt * 0.24;
      }
    }
  }

  function updateHands(dt) {
    if (!hands) return;
    if (!handAnim) { hands.grp.visible = false; updateCurtains(); return; }
    handAnim.t += dt;
    const f = Math.min(1, handAnim.t / handAnim.dur);
    hands.grp.visible = true;
    const ease = f < 0.34 ? Math.pow(f / 0.34, 0.55) : 1 - Math.pow((f - 0.34) / 0.66, 1.7);
    const k = reducedMotion ? ease * 0.6 : ease;
    if (handAnim.kind === 'pop') {
      for (const [h, sign] of [[hands.L, -1], [hands.R, 1]]) {
        h.visible = true;
        h.position.set(sign * (0.30 - k * 0.06), -0.86 + k * 0.62, -0.34 - k * 0.52);
        h.rotation.set(-0.9 + k * 1.05, sign * (0.5 - k * 0.42), sign * (-0.5 + k * 0.34));
        h.scale.setScalar(0.55 + k * 0.16);
      }
    } else {
      hands.L.visible = false;
      const h = hands.R;
      h.visible = true;
      h.position.set(0.28 - k * 0.05, -0.78 + k * 0.32, -0.4 - k * 0.36);
      h.rotation.set(-0.5 + k * 0.85, -0.3, 0.2 - k * 0.5);
      h.scale.setScalar(0.6);
    }
    updateCurtains();
    if (f >= 1) handAnim = null;
  }

  /* ---------- LIGHT & AIR: the ONE writer of intensity, colour and fog ----------
     Everything below is view-only; the sim never reads a single number of it, and a co-op
     guest derives the identical barn from alarm state already on the wire. */

  /* deterministic, because view.js has no Math.random in it and a flicker that differs
     between the night and its own tape is a bug you cannot photograph twice. */
  function hash01(v) {
    let x = v | 0;
    x = (x ^ 61) ^ (x >>> 16); x = x + (x << 3) | 0; x = x ^ (x >>> 4);
    x = Math.imul(x, 0x27d4eb2d); x = x ^ (x >>> 15);
    return ((x >>> 0) % 100000) / 100000;
  }

  function flickFactor(f, seed) {
    const L = H.DATA.LIGHTING;
    if (!f) return 1;
    const ph = flickerT + seed * 0.7;                     // no two rooms breathe together
    let amp = (f.a || 0) * Math.sin(ph * (f.fa || 1) * 6.283) +
              (f.b || 0) * Math.sin(ph * (f.fb || 1) * 6.283);
    if (strobeOff) return 1 + Math.max(-L.STROBE_SAFE.ampCap, Math.min(L.STROBE_SAFE.ampCap, amp));
    const tk = f.tick;
    if (tk) {
      const b = Math.floor(flickerT / tk.gapS);           // one possible dropout per bucket
      if (hash01(seed * 131 + b * 7919) < tk.chance) {
        const st = (b + hash01(seed * 977 + b * 31) * 0.8) * tk.gapS;
        if (flickerT >= st && flickerT < st + tk.lenS) amp -= tk.depth;
      }
    }
    return 1 + amp;
  }

  /* a tube stuttering awake. strobeOff gets a plain ramp instead — the law, not a nicety. */
  function strikeEnv(t) {
    const A = H.DATA.LIGHTING.ALARM;
    if (strobeOff) return Math.min(1, Math.max(0, t) / 0.6);
    if (t >= A.strikeS) return 1;
    const i = Math.min(A.strike.length - 1, Math.max(0, Math.floor(t / A.strikeS * A.strike.length)));
    return A.strike[i];
  }

  function setI(pl, target, dt, slow) {
    const L = H.DATA.LIGHTING, dI = target - pl.intensity;
    if (strobeOff) { const c = L.STROBE_SAFE.slew * dt; pl.intensity += Math.max(-c, Math.min(c, dI)); return; }
    /* flicker is written STRAIGHT: a lerp here would smother the 0.1s fluorescent dropout.
       only the alarm recovery crawls — that is the whole point of the recovery. */
    pl.intensity += slow ? dI * Math.min(1, dt / L.ALARM.recoverS * 2.2) : dI;
  }

  function updateMotes() {
    const L = H.DATA.LIGHTING, M = L.MOTES, cull = M.cullM * M.cullM, y0 = L.CONE.y - M.depth;
    for (const p of motes) {
      const dx = camera.position.x - p.cx, dz = camera.position.z - p.cz;
      const vis = lmode !== 'alarm' && (dx * dx + dz * dz) < cull;   // ⚠️ explicit cx/cz: userData has no .x/.y/.z
      p.pts.visible = vis;
      if (!vis || reducedMotion) continue;                            // reduced motion: still dust, just still
      const a = p.pts.geometry.attributes.position, b = p.base;
      for (let i = 0; i < a.count; i++) {
        const y = ((b[i * 3 + 1] - flickerT * M.fall + i * 0.37) % M.depth + M.depth) % M.depth;
        a.array[i * 3 + 1] = y + y0;
        a.array[i * 3] = b[i * 3] + Math.sin(flickerT * 0.6 + i) * M.wobble;
      }
      a.needsUpdate = true;
    }
  }

  function updateLighting(dt, N) {
    if (!scene || !hemi) return;
    const D = H.DATA, L = D.LIGHTING;
    if (!tmpCol.c) tmpCol.c = new THREE.Color();
    const c = tmpCol.c;
    const alarmNow = !!(N && N.alarm && N.alarm.active);
    /* the tape plays the night back AS NIGHT, whatever the barn is doing now — otherwise a
       night whose alarm trips in its last 20s replays flat white with no beams. */
    const want = camOverride ? 'night' : daylight ? 'day' : alarmNow ? 'alarm' : 'night';
    if (want !== lmode) {
      if (want === 'alarm') alarmT = 0;
      if (lmode === 'alarm' && want === 'night') recoverT = 0;
      lmode = want;
    }
    if (alarmT >= 0) alarmT += dt;
    if (recoverT >= 0) { recoverT += dt; if (recoverT > L.ALARM.recoverS) recoverT = -1; }
    const slow = recoverT >= 0;
    const k = slow ? Math.min(1, dt / L.ALARM.recoverS * 1.8) : Math.min(1, dt * 6);

    const F = L.FOG[lmode], HM = L.HEMI[lmode];
    scene.fog.color.lerp(c.setHex(F.c), k);
    scene.fog.density += (F.d - scene.fog.density) * k;
    hemi.color.lerp(c.setHex(HM.sky), k);
    hemi.groundColor.lerp(c.setHex(HM.ground), k);
    hemi.intensity += (HM.i - hemi.intensity) * k;

    if (ghostPulse) { ghostPulse.t -= dt; if (ghostPulse.t <= 0) ghostPulse = null; }

    for (const r of D.ROOMS) {
      const pl = roomLights[r.id]; if (!pl) continue;
      const cfg = L.ROOM[r.id] || L.ROOM.entry;
      let target, gel, fl = 1;
      if (lmode === 'alarm') { gel = L.ALARM.gel; pl.distance = L.ALARM.roomDist; target = L.ALARM.roomI * strikeEnv(alarmT); }
      else if (lmode === 'day') { gel = L.DAY.gel; pl.distance = cfg.dist; target = L.DAY.i; }
      else {
        gel = cfg.gel; pl.distance = cfg.dist;
        fl = flickFactor(cfg.flick, r.x0);
        target = cfg.i * fl;
        if (ghostPulse && ghostPulse.room === r.id)          // her: warm, additive, never a strobe
          target += Math.max(0, Math.sin(ghostPulse.t * 2.4)) * L.GHOST.lift;
      }
      flickNow[r.id] = fl;
      pl.color.lerp(c.setHex(gel), Math.min(1, dt * 5));
      setI(pl, target, dt, slow);
    }
    for (const wl of spineLights) {
      const al = lmode === 'alarm';
      wl.distance = al ? L.ALARM.roomDist : L.SPINE.dist;
      wl.color.lerp(c.setHex(al ? L.ALARM.gel : L.SPINE.gel), Math.min(1, dt * 5));
      setI(wl, al ? L.ALARM.roomI * strikeEnv(alarmT) : lmode === 'day' ? L.DAY.i : L.SPINE.i, dt, slow);
    }

    /* the beams live in the fog. the alarm kills the fog, so the alarm kills the beams —
       fluorescent light has no volume, and that is exactly WHY it is the horror state. */
    const fogRatio = Math.max(0, Math.min(1, scene.fog.density / L.FOG.night.d));
    for (const cn of cones) {
      let f = cn.room ? (flickNow[cn.room] === undefined ? 1 : flickNow[cn.room]) : 1;
      if (ghostPulse && cn.room === ghostPulse.room) f *= 1 + L.GHOST.coneLift;
      for (let i = 0; i < cn.mats.length; i++) cn.mats[i].opacity = cn.base[i] * fogRatio * f;
    }
    blobBaseOp = lmode === 'alarm' ? L.BLOB.opAlarm : lmode === 'day' ? L.BLOB.opDay : L.BLOB.op;
    updateMotes();
  }

  /* ---------- per-frame ---------- */
  V.update = function (night, player, buildSlots, dtIn, deltas) {
    const dt = dtIn === undefined ? clock.getDelta() : (clock.getDelta(), dtIn);   // keep the clock in step either way
    flickerT += dt;
    const D = H.DATA;
    // beat rings — driven by node deltas so a co-op guest reads the same beat off the wire
    if (deltas) {
      for (const n of D.NODES) {
        const ring = nodeRings[n.id]; if (!ring) continue;
        let best = deltas[n.id];
        if (best === null || best === undefined || best <= -n.window || best >= n.window * 2.2) {
          ring.material.opacity += (0 - ring.material.opacity) * 0.2; continue;
        }
        const closeness = 1 - Math.min(1, Math.abs(best) / (n.window * 2));
        ring.material.opacity = 0.15 + closeness * 0.75;
        const sc = 1 + Math.max(0, best) * 0.45;
        ring.scale.set(sc, sc, 1);
        ring.material.color.setHex(Math.abs(best) < 0.6 ? 0xffffff : 0xffcf5a);
      }
    }
    if (night) {
      // station LEDs
      for (const [slotId, sm] of Object.entries(stationMeshes)) {
        const st = night.stations[slotId];
        if (!st) continue;
        if (st.broken) sm.led.material.color.setHex(0xff3030);
        else sm.led.material.color.setHex(night.t < st.readyAt ? 0xe8a23a : 0x39ff70);
      }
    }
    updateLighting(dt, night);
    if (V._chair && !reducedMotion) V._chair.rotation.x = Math.sin(flickerT * 0.9) * 0.02; // it rocks. barely. no comment.
    updateSway(dt);
    updateHands(dt);
    // camera: the player, unless the tape has taken the wheel
    if (camOverride) {
      hands.grp.visible = false;
      camera.position.set(camOverride.px, camOverride.py, camOverride.pz);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(camOverride.tx, camOverride.ty, camOverride.tz);
    } else {
      camera.position.set(player.x, player.y, player.z);
      camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    }
    renderer.render(scene, camera);
  };

  V.fx = function (ev) {
    if (ev.type === 'ghost') {
      const D = H.DATA;
      const node = D.NODES.find(n => n.id === ev.node);
      if (node) ghostPulse = { room: node.room, t: 3.5 };   // additive. updateLighting ticks and expires it.
    }
  };

  V.camera = () => camera;

  /* dev: the page photographs itself. render + toDataURL must happen in ONE synchronous task —
     a WebGL drawing buffer is cleared on composite, and this pane never composites.
     `fetch('/shot?name=x',{method:'POST',body:HAUNT.View.shot(1280,720)})` with serve.mjs running. */
  V.shot = function (w, h) {
    const c = renderer.domElement, ow = c.width, oh = c.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const url = c.toDataURL('image/png');
    renderer.setSize(ow, oh, false);
    camera.aspect = ow / oh; camera.updateProjectionMatrix();
    return url;
  };

  H.View = V;
})(typeof globalThis !== 'undefined' ? globalThis : window);
