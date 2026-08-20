/* THE HAUNT — ui.js — every DOM surface: HUD, walkie, menus, the chalkboard, the polaroid. Lowercase, warm, deadpan. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const U = { root: null, els: {} };

  const CSS = `
  #ui{position:fixed;inset:0;pointer-events:none;font-family:'Courier New',monospace;color:#e8dcc0;z-index:10}
  #ui *{box-sizing:border-box}
  .panel{pointer-events:auto;background:rgba(14,10,6,.93);border:1px solid #4a3820;border-radius:10px;box-shadow:0 12px 60px rgba(0,0,0,.7)}
  .full{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 30%,rgba(30,18,10,.6),rgba(4,3,2,.96))}
  .card{max-width:760px;width:92%;max-height:92vh;overflow:auto;padding:28px 34px}
  h1{font-size:44px;letter-spacing:6px;margin:0 0 2px;color:#f4e8c8;text-shadow:0 0 18px rgba(255,180,60,.25)}
  h2{font-size:15px;font-weight:normal;letter-spacing:3px;color:#b89858;margin:0 0 18px}
  h3{font-size:14px;letter-spacing:2px;color:#d8b878;margin:18px 0 8px;border-bottom:1px solid #3a2c16;padding-bottom:5px}
  p{font-size:13px;line-height:1.55;color:#c8b898}
  .btn{display:inline-block;background:#2a1c0c;border:1px solid #6a5028;color:#f0e0b8;padding:9px 18px;margin:5px 6px 5px 0;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;letter-spacing:1px}
  .btn:hover{background:#3d2a12;border-color:#b8924a}
  .btn.primary{background:#4a2c0e;border-color:#c89a3a;color:#ffe9b0}
  .btn.ghostbtn{opacity:.65}
  .btn:disabled{opacity:.35;cursor:default}
  .row{display:flex;gap:14px;flex-wrap:wrap}
  .col{flex:1;min-width:200px}
  .stat{font-size:12px;color:#a89878;margin:2px 0}
  .stat b{color:#f0dca0}
  .good{color:#8fd868}.bad{color:#e86848}.warn{color:#e8b23a}
  #hud{position:absolute;inset:0;display:none}
  #hudTop{position:absolute;top:14px;left:50%;transform:translateX(-50%);text-align:center;font-size:13px;letter-spacing:2px;color:#d8c08a;text-shadow:0 1px 4px #000}
  #hudDrawer{position:absolute;top:14px;right:18px;font-size:14px;color:#ffe9b0;text-shadow:0 1px 4px #000;text-align:right}
  #hudNight{position:absolute;top:14px;left:18px;font-size:12px;color:#b8a070;text-shadow:0 1px 4px #000}
  #walkie{position:absolute;left:18px;bottom:70px;width:340px;font-size:12px;line-height:1.5}
  #walkie div{background:rgba(10,8,5,.72);border-left:2px solid #b8924a;margin-top:4px;padding:4px 8px;color:#e0d0a8;opacity:0;transition:opacity .2s}
  #prompt{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);font-size:14px;letter-spacing:1px;color:#ffe9b0;background:rgba(12,8,4,.8);padding:8px 16px;border-radius:6px;border:1px solid #5a4420;display:none}
  #gradeFlash{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-size:38px;letter-spacing:6px;color:#fff;opacity:0;text-shadow:0 0 24px rgba(255,200,80,.8);transition:opacity .12s, transform .12s;pointer-events:none}
  #crosshair{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2px;border-radius:50%;background:rgba(240,220,170,.85)}
  #vignette{position:absolute;inset:0;box-shadow:inset 0 0 180px rgba(0,0,0,.85);pointer-events:none}
  #flashWhite{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
  #cooldowns{position:absolute;right:18px;bottom:70px;font-size:11px;color:#b8a070;text-align:right;text-shadow:0 1px 3px #000}
  #keysHelp{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);font-size:11px;letter-spacing:1px;color:#887650;text-shadow:0 1px 3px #000}
  table{border-collapse:collapse;width:100%;font-size:12px}
  td,th{padding:5px 8px;border-bottom:1px solid #2c2010;text-align:left;color:#c8b48c}
  th{color:#8a7648;font-weight:normal;letter-spacing:1px}
  select{background:#241808;color:#f0e0b8;border:1px solid #5a4420;padding:5px 8px;border-radius:4px;font-family:inherit}
  .chalk{background:#1a2018;border:6px solid #4a3418;border-radius:6px;padding:18px 22px;font-size:14px;line-height:1.9;color:#d8e8d0;font-family:'Comic Sans MS','Courier New',cursive}
  .chalk b{color:#fff}
  .pol{image-rendering:pixelated;border:none;transform:rotate(-2deg);box-shadow:0 8px 24px rgba(0,0,0,.6)}
  .tag{display:inline-block;background:#2a2010;border:1px solid #4a3820;border-radius:4px;padding:1px 7px;font-size:11px;color:#c8a868;margin-left:6px}
  .crewline{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12px;color:#c8b48c}
  .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  #toast{position:absolute;top:70px;left:50%;transform:translateX(-50%);font-size:13px;color:#ffe9b0;background:rgba(20,12,6,.9);border:1px solid #6a5028;padding:8px 18px;border-radius:6px;opacity:0;transition:opacity .3s;letter-spacing:1px}
  .barwrap{background:#241a0c;border:1px solid #3a2c16;border-radius:4px;height:10px;width:120px;display:inline-block;vertical-align:middle;margin-left:8px}
  .barfill{height:100%;border-radius:3px;background:#b8924a}
  /* --- M5: walking the barn on build day --- */
  #buildBar{position:absolute;top:0;left:0;right:0;padding:12px 20px 26px;display:none;
    background:linear-gradient(rgba(10,7,4,.92),rgba(10,7,4,0));font-size:13px;letter-spacing:1px;color:#d8c69a;text-shadow:0 1px 4px #000}
  #buildBar b{color:#ffe9b0}
  #buildBar .k{display:inline-block;border:1px solid #6a5028;border-radius:4px;padding:1px 6px;color:#ffe9b0;margin:0 3px}
  #panelWrap{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,4,2,.55)}
  #panelCard{max-width:540px;width:88%;max-height:82vh;overflow:auto;padding:20px 24px}
  .opt{display:block;width:100%;text-align:left;background:#241808;border:1px solid #5a4420;color:#f0e0b8;
    padding:9px 14px;margin:5px 0;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px}
  .opt:hover{background:#3d2a12;border-color:#b8924a}
  .opt:disabled{opacity:.38;cursor:default}
  .opt .price{float:right;color:#c8a868}
  /* --- M5: the tape --- */
  #vhs{position:absolute;inset:0;display:none}
  #vhsScan{position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(0,0,0,.26) 0 1px,rgba(255,255,255,.03) 1px 3px)}
  #vhsGrain{position:absolute;inset:-24px;opacity:.17;background-repeat:repeat}
  #vhsBand{position:absolute;left:0;right:0;height:64px;top:-100px;filter:blur(1px);
    background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,.11) 45%,rgba(255,255,255,0))}
  #vhsEdge{position:absolute;inset:0;box-shadow:inset 0 0 150px rgba(0,0,0,.8)}
  #vhsTop{position:absolute;top:24px;left:28px;font-size:15px;letter-spacing:4px;color:#f4f0e0;text-shadow:0 0 10px rgba(0,0,0,.95)}
  #vhsRec{color:#ff5a4a}
  #vhsBottom{position:absolute;bottom:28px;left:28px;font-size:14px;letter-spacing:2px;color:#f4f0e0;text-shadow:0 0 10px rgba(0,0,0,.95);line-height:1.6}
  #vhsBottom span{color:#c8bca0;font-size:12px}
  #vhsHint{position:absolute;bottom:28px;right:28px;font-size:12px;letter-spacing:2px;color:#c0b498;text-shadow:0 0 10px #000}
  `;

  U.init = function () {
    const style = document.createElement('style');
    style.textContent = CSS; document.head.appendChild(style);
    U.root = document.createElement('div'); U.root.id = 'ui'; document.body.appendChild(U.root);
    U.root.innerHTML = `
      <div id="hud">
        <div id="hudTop"></div><div id="hudNight"></div><div id="hudDrawer"></div>
        <div id="walkie"></div><div id="prompt"></div><div id="gradeFlash"></div>
        <div id="crosshair"></div><div id="cooldowns"></div>
        <div id="keysHelp">wasd move · shift run · mouse look · E act · Q the comedy beat · esc menu</div>
      </div>
      <div id="buildBar"></div>
      <div id="vignette"></div><div id="flashWhite"></div><div id="toast"></div>
      <div id="vhs">
        <div id="vhsScan"></div><div id="vhsGrain"></div><div id="vhsBand"></div><div id="vhsEdge"></div>
        <div id="vhsTop"><span id="vhsRec">●</span> REC <span id="vhsTime">00:00:00</span></div>
        <div id="vhsBottom"></div><div id="vhsHint">any key — stop the tape</div>
      </div>
      <div id="panelWrap"><div class="panel" id="panelCard"></div></div>
      <div id="screen" class="full" style="display:none"><div class="panel card" id="screenCard"></div></div>`;
    ['hud', 'hudTop', 'hudNight', 'hudDrawer', 'walkie', 'prompt', 'gradeFlash', 'cooldowns', 'screen', 'screenCard',
      'flashWhite', 'toast', 'buildBar', 'panelWrap', 'panelCard', 'vhs', 'vhsGrain', 'vhsBand', 'vhsTime', 'vhsBottom', 'vhsRec']
      .forEach(id => U.els[id] = document.getElementById(id));
    U.els.vhsGrain.style.backgroundImage = `url(${grainTexture()})`;
  };

  /* a little static, baked once */
  function grainTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d');
    const img = x.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  U.showHud = v => { U.els.hud.style.display = v ? 'block' : 'none'; };
  U.keysHelp = t => { const el = document.getElementById('keysHelp'); if (el) el.textContent = t; };
  U.screen = html => {
    if (html === null) { U.els.screen.style.display = 'none'; return; }
    U.els.screen.style.display = 'flex';
    U.els.screenCard.innerHTML = html;
  };
  U.on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = e => { H.Audio.unlock(); H.Audio.click(); fn(e); }; };

  U.toast = (msg) => {
    U.els.toast.textContent = msg; U.els.toast.style.opacity = 1;
    clearTimeout(U._toastT); U._toastT = setTimeout(() => U.els.toast.style.opacity = 0, 2600);
  };
  U.walkie = (msg) => {
    const d = document.createElement('div');
    d.textContent = '» ' + msg;
    U.els.walkie.appendChild(d);
    requestAnimationFrame(() => d.style.opacity = 1);
    while (U.els.walkie.children.length > 5) U.els.walkie.removeChild(U.els.walkie.firstChild);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 400); }, 6000);
  };
  U.grade = (label, id) => {
    const el = U.els.gradeFlash;
    el.textContent = label;
    el.style.color = id === 'perfect' ? '#ffe9a0' : id === 'good' ? '#c8e8a0' : '#c89078';
    el.style.opacity = 1; el.style.transform = 'translate(-50%,-50%) scale(1.15)';
    clearTimeout(U._gt);
    U._gt = setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translate(-50%,-50%) scale(1)'; }, 700);
  };
  U.flash = () => {
    const f = U.els.flashWhite;
    f.style.transition = 'none'; f.style.opacity = 0.9;
    requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; });
  };
  U.hudNight = (night, S) => {
    U.els.hudTop.textContent = night ? `${night.clock()} · ${night.nightDef.label}` : '';
    U.els.hudDrawer.innerHTML = night ? `$${night.drawer}<div style="font-size:10px;color:#a08858">the drawer</div>` : '';
    const left = night ? Math.max(0, night.nightDef.groups - night.spawned) : 0;
    const inside = night ? night.guests.filter(x => !x.out).length : 0;
    U.els.hudNight.innerHTML = night ? `groups still coming: ${left}<br>inside: ${inside}<br><span style="color:#7a6a48">dropped tonight: ${night.tally.dropped}</span>` : '';
  };
  U.prompt = (ctx) => {
    if (!ctx) { U.els.prompt.style.display = 'none'; return; }
    U.els.prompt.style.display = 'block';
    U.els.prompt.textContent = ctx.label;
  };
  U.cooldowns = (night) => {
    if (!night) { U.els.cooldowns.innerHTML = ''; return; }
    const body = Math.max(0, night.bodyReadyAt - night.t);
    const com = Math.max(0, night.comedyReadyAt - night.t);
    U.els.cooldowns.innerHTML =
      (body > 0 ? `the pop: ${body.toFixed(0)}s<br>` : `the pop: <span class="good">ready</span><br>`) +
      (com > 0 ? `comedy beat: ${com.toFixed(0)}s` : `comedy beat: <span class="good">ready</span>`);
  };

  /* ---------- M5: build day, walked ---------- */
  U.buildBar = (html) => {
    if (html === null) { U.els.buildBar.style.display = 'none'; return; }
    U.els.buildBar.style.display = 'block';
    U.els.buildBar.innerHTML = html;
  };
  /* a lighter modal than U.screen — you can still see the barn behind it */
  U.panel = (html) => {
    if (html === null) { U.els.panelWrap.style.display = 'none'; U.els.panelCard.innerHTML = ''; return; }
    U.els.panelWrap.style.display = 'flex';
    U.els.panelCard.innerHTML = html;
  };
  U.panelOpen = () => U.els.panelWrap.style.display === 'flex';

  /* ---------- M5: the tape (VHS grain lives here and NOWHERE else — bible §12) ---------- */
  U.vhs = (on, info) => {
    U.els.vhs.style.display = on ? 'block' : 'none';
    const canvas = document.getElementById('game');
    if (canvas) canvas.style.filter = on ? 'saturate(1.22) contrast(1.06) brightness(1.04)' : '';
    if (on && info) {
      U.els.vhsBottom.innerHTML =
        `${info.room.toUpperCase()}<br><span>${info.who} · magnitude ${info.mag}` +
        `${info.dropped ? ' · ' + info.dropped + ' dropped' : ''}${info.melted ? ' · ' + info.melted + ' MELTED' : ''}</span>`;
    }
  };
  U.vhsTick = (t, dur) => {
    const cs = Math.floor((t * 100) % 100), s = Math.floor(t) % 60, m = Math.floor(t / 60);
    U.els.vhsTime.textContent =
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
    U.els.vhsRec.style.opacity = (Math.floor(t * 2) % 2) ? 0.25 : 1;
    U.els.vhsGrain.style.backgroundPosition = `${Math.floor(Math.random() * 96)}px ${Math.floor(Math.random() * 96)}px`;
    const band = ((t * 0.34) % 1.35) * (innerHeight + 160) - 120;
    U.els.vhsBand.style.top = band + 'px';
  };

  /* ---------- the polaroid ---------- */
  U.makePolaroid = function (info, seed) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160;
    const x = c.getContext('2d');
    const rng = H.makeRng(seed || 1);
    x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 128, 160);          // frame
    x.fillStyle = '#0c0a14'; x.fillRect(8, 8, 112, 112);          // the dark
    const grad = x.createRadialGradient(64, 66, 6, 64, 66, 78);   // the flash
    grad.addColorStop(0, 'rgba(255,252,240,.95)'); grad.addColorStop(0.5, 'rgba(210,190,160,.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grad; x.fillRect(8, 8, 112, 112);
    // the group, mid-scream
    const n = Math.min(6, info.size || 4);
    for (let i = 0; i < n; i++) {
      const gx = 24 + i * (80 / Math.max(1, n - 1) || 0) + rng.range(-4, 4);
      const gy = 74 + rng.range(-8, 8);
      const s = 0.8 + rng.f() * 0.5;
      const tones = ['#3a2c4a', '#4a2c2c', '#2c3a4a', '#42304a', '#4a3a2c'];
      x.fillStyle = tones[i % tones.length];
      x.fillRect(gx - 7 * s, gy - 6 * s, 14 * s, 34 * s);          // body
      x.fillStyle = '#d8b894';
      x.beginPath(); x.arc(gx, gy - 14 * s, 8 * s, 0, 7); x.fill(); // head
      x.fillStyle = '#181008';
      x.beginPath(); x.arc(gx, gy - 12 * s, 3.4 * s, 0, 7); x.fill(); // THE MOUTH
      x.fillRect(gx - 5 * s, gy - 19 * s, 3 * s, 3.4 * s); x.fillRect(gx + 2 * s, gy - 19 * s, 3 * s, 3.4 * s);
      // arms up
      x.strokeStyle = '#d8b894'; x.lineWidth = 3 * s;
      x.beginPath(); x.moveTo(gx - 7 * s, gy); x.lineTo(gx - 14 * s, gy - 16 * s); x.stroke();
      x.beginPath(); x.moveTo(gx + 7 * s, gy); x.lineTo(gx + 14 * s, gy - 15 * s); x.stroke();
    }
    // grain
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${rng.f() * 0.06})`; x.fillRect(8 + rng.f() * 112, 8 + rng.f() * 112, 1, 1); }
    x.fillStyle = '#3a3428'; x.font = '10px cursive';
    x.fillText(info.caption || 'the scream barn', 12, 136);
    x.font = '9px cursive'; x.fillStyle = '#6a6252';
    x.fillText(info.sub || '"AAAAAA" — everyone', 12, 150);
    return c.toDataURL('image/png');
  };

  H.UI = U;
})(typeof globalThis !== 'undefined' ? globalThis : window);
