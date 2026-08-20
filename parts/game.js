/* THE HAUNT — game.js — the orchestrator: title → season → build day → cast call → SHOW NIGHT → the sting → endings.
   Owns the save (haunt-save, house contract), the season economy, and the event→feel mapping. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const D = () => H.DATA;
  const GAME = {
    state: 'boot', night: null, S: null, raf: null, lastT: 0, cueT: 0, nightAbsent: [], pendingPolaroid: null,
    /* M5 bookkeeping — all view/voice side, none of it touches the sim */
    lastCue: 0, chatT: 3, voiceT: 0, perfectRun: 0, walkbyRun: 0, firstDrop: false,
    quietT: 0, saidLate: false, saidLast: false, chickenSeen: 0, replay: null, stingData: null,
    wantLock: false, lockAt: 0
  };

  /* ---------------- save ---------------- */
  function freshSeason() {
    return {
      started: true, version: D().VERSION,
      cash: D().SEASON.startCash, nightIdx: 0,
      rep: { scary: 20, fun: 30 },
      build: { slots: { s_corn_a: { type: 'dropPanel', tier: 1 } } },   // ruthie's old panel. still works.
      crewAssign: {}, spacingId: 'standard', ticket: D().SEASON.ticket.base,
      noteOwed: 0, notePaidAll: true, paymentsDone: 0,
      nights: 0, seasonGuests: 0, dropped: 0, melted: 0, delight: 0, polaroids: [],
      bounty: false, ghostArmed: true, ghostSeen: 0, endings: {}, endless: 0,
      marshalFails: 0, seasonSeed: 7411, softNext: false,
      settings: { muted: false, strobeOff: false, reducedMotion: false }
    };
  }
  function save() {
    try { localStorage.setItem(D().SAVE_KEY, JSON.stringify(GAME.S)); } catch (e) { }
  }
  function load() {
    try {
      const raw = localStorage.getItem(D().SAVE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.started) return Object.assign(freshSeason(), s); }
    } catch (e) { }
    return null;
  }

  /* ---------------- boot ---------------- */
  GAME.boot = function () {
    const canvas = document.getElementById('game');
    H.UI.init();
    H.View.init(canvas);
    H.Player.init(canvas);
    GAME.S = load() || freshSeason();
    H.Audio.init(GAME.S.settings.muted);
    H.View.setA11y(GAME.S.settings);
    document.addEventListener('mousedown', () => { if (GAME.state === 'replay') stopTape(); });
    title();
    GAME.lastT = performance.now();
    loop();
  };

  function loop() {
    GAME.raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - GAME.lastT) / 1000);
    GAME.lastT = now;
    GAME.step(dt);
  }

  /* ONE frame, exactly as the loop draws it. Public so a harness (or a browser pane that
     suspends requestAnimationFrame) can drive the whole game a frame at a time. */
  GAME.step = function (dt) {
    if (GAME.state === 'night' && GAME.night) {
      H.Player.update(dt);
      GAME.night.tick(dt);
      drainEvents();
      beatCue(dt);
      H.Replay.record(GAME.night, dt);
      crowdAudio(dt);
      ambientVoice(dt);
      const xray = H.Barn.inSpine(H.Player.x, H.Player.z);
      H.View.syncGuests(GAME.night, xray);
      H.UI.hudNight(GAME.night, GAME.S);
      H.UI.cooldowns(GAME.night);
      H.UI.prompt(H.Player.context(GAME.night, GAME.S.build.slots));
      if (GAME.night.done) return sting();
    } else if (GAME.state === 'build3d') {
      H.Player.update(dt);
      H.UI.prompt(H.UI.panelOpen() ? null : H.Player.buildContext(GAME.S.build.slots));
    } else if (GAME.state === 'replay') {
      stepTape(dt);
    } else if (GAME.state === 'freeroam') {
      H.Player.update(dt);
      H.UI.prompt(null);
    }
    H.View.update(GAME.night, H.Player, GAME.S ? GAME.S.build.slots : {}, dt);
  };

  /* the crowd you hear through the wall — and the DIP that means they're nearly on you (bible §6.1) */
  function crowdAudio(dt) {
    const N = GAME.night, C = D().CHATTER;
    let level = 0;
    for (const gst of N.guests) {
      if (gst.out) continue;
      const p = N.guestPos(gst);
      const d = Math.hypot(p.x - H.Player.x, p.z - H.Player.z);
      if (d < C.hearM) level += 1 - d / C.hearM;
    }
    level = Math.min(1, level / 4.5);
    H.Audio.setCrowd(level, GAME.lastCue);
    GAME.chatT -= dt;
    if (GAME.chatT <= 0) {
      GAME.chatT = C.blipGap[0] + Math.random() * (C.blipGap[1] - C.blipGap[0]);
      if (level > 0.12 && !N.alarm.active) H.Audio.chatterBlip(GAME.lastCue > 0.55 ? 'shush' : 'talk');
    }
  }

  /* ---------------- the tape (M5 replay theater) ---------------- */
  function rollTape() {
    const take = H.Replay.take;
    if (!take) return H.UI.toast('no tape tonight — nothing landed hard enough to keep.');
    GAME.replay = { t: 0, take };
    GAME.state = 'replay';
    H.UI.screen(null); H.UI.showHud(false);
    H.View.clearGuests();
    H.UI.vhs(true, H.Replay.caption(take));
    H.Audio.tape(true);
  }
  function stepTape(dt) {
    const R = GAME.replay;
    if (!R) return;
    R.t += dt;
    const take = R.take;
    const tt = Math.min(R.t, take.dur);
    H.View.replayFrame(take, H.Replay.frameAt(take, tt));
    H.View.setReplayCam(take, tt);
    H.UI.vhsTick(tt, take.dur);
    if (R.t > take.dur + D().REPLAY.holdS) stopTape();
  }
  function stopTape() {
    if (GAME.state !== 'replay') return;
    H.UI.vhs(false);
    H.Audio.tape(false);
    H.View.clearReplayCam();
    H.View.clearGuests();
    GAME.replay = null;
    GAME.state = 'sting';
    stingCard();
  }

  /* the audible beat: the nearest hot node ticks faster as the group closes. eyes-shut playable. */
  function beatCue(dt) {
    const N = GAME.night;
    let best = null;
    for (const n of N.nodes) {
      const dx = H.Player.x - n.pos[0], dz = H.Player.z - n.pos[1];
      if (dx * dx + dz * dz > 140) continue;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        let lead = null;
        for (const gg of grp.guests) if (!gg.out && !gg.chicken) lead = lead === null ? gg.s : Math.max(lead, gg.s);
        if (lead === null) continue;
        const d = n.s - lead;
        if (d > -2 && d < 9) { const u = 1 - Math.min(1, Math.abs(d) / 9); if (!best || u > best) best = u; }
      }
    }
    GAME.lastCue = best === null ? Math.max(0, GAME.lastCue - dt * 1.6) : best;
    if (best === null) return;
    GAME.cueT -= dt;
    if (GAME.cueT <= 0) { H.Audio.cueTick(best); GAME.cueT = 0.72 - best * 0.52; }
  }

  /* the walkie is warmth, not spam: routine lines wait their turn, real news never does */
  function walkieSay(msg, force) {
    const t = performance.now() / 1000;
    if (!force && t - GAME.voiceT < D().WALKIE_GAP) return;
    GAME.voiceT = t; H.UI.walkie(msg);
  }
  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

  /* things the feed notices on its own: the lulls, the hour, the quiet door */
  function ambientVoice(dt) {
    const N = GAME.night, V = D().VOICE;
    GAME.quietT += dt;
    const inside = N.guests.some(gst => !gst.out);
    if (GAME.quietT > 45 && inside && !N.alarm.active) { GAME.quietT = 0; walkieSay(rnd(V.quiet)); }
    if (!GAME.saidLate && N.clock().startsWith('11:') && N.clock().endsWith('pm')) { GAME.saidLate = true; walkieSay(rnd(V.lateNight)); }
    if (!GAME.saidLast && N.spawned >= N.nightDef.groups && inside) { GAME.saidLast = true; walkieSay(rnd(V.lastGroup)); }
    if (N.tally.chickened > GAME.chickenSeen) { GAME.chickenSeen = N.tally.chickened; walkieSay(rnd(V.chicken)); }
  }

  /* ---------------- event → feel ---------------- */
  function drainEvents() {
    const N = GAME.night, V = D().VOICE;
    for (const ev of N.events) {
      switch (ev.type) {
        case 'grade':
          H.UI.grade(ev.label, ev.id); if (!ev.byCrew) H.Audio.grade(ev.id);
          if (ev.id === 'perfect') {
            GAME.perfectRun++; GAME.walkbyRun = 0;
            if (GAME.perfectRun === 3) walkieSay(rnd(V.streak), true);
            else if (Math.random() < 0.22) walkieSay(rnd(V.perfect));
          } else GAME.perfectRun = 0;
          break;
        case 'scare': {
          const kind = ev.melted ? 'melt' : ev.dropped ? 'dropped' : ev.gotem ? 'gotem' : ev.screams ? 'scream' : 'flinch';
          H.Audio.scareHit(kind);
          H.Replay.mark(N, ev);                       // the tape decides for itself what was worth keeping
          GAME.quietT = 0; GAME.walkbyRun = 0;
          if (ev.dropped && !GAME.firstDrop) { GAME.firstDrop = true; walkieSay(rnd(V.firstDrop), true); }
          else if (ev.dropped) walkieSay(rnd(V.dropped));
          if (ev.melted) walkieSay(rnd(V.melt), true);
          if ((ev.dropped || ev.gotem) && Math.random() < D().CHATTER.laughChance) {
            setTimeout(() => { if (GAME.state === 'night') H.Audio.chatterBlip('laugh'); }, 2100);
          }
          break;
        }
        case 'walkby':
          H.Audio.walkby(); GAME.walkbyRun++;
          if (GAME.walkbyRun >= 3) { GAME.walkbyRun = 0; walkieSay(rnd(V.walkbyBad)); }
          break;
        case 'huh': walkieSay(rnd(V.huh)); H.Audio.chatterBlip('nervous'); break;
        case 'polaroid':
          H.Audio.flash(); H.UI.flash();
          if (Math.random() < 0.5) walkieSay(rnd(V.polaroid));
          break;
        case 'polaroidFull': GAME.pendingPolaroid = { size: 6 + Math.floor(Math.random() * 2) }; break;
        case 'bounty': walkieSay(rnd(V.bounty), true); H.UI.toast('THE BOUNTY IS PAID. $200. worth every cent.'); break;
        case 'distress': H.UI.toast('somebody’s past scared. BACK OFF — go walk them out. (E near their room)'); break;
        case 'rescue': walkieSay(rnd(V.rescue), true); break;
        case 'complaint': H.UI.toast('a complaint. the review will not be kind.'); break;
        case 'conga': walkieSay(rnd(V.conga), true); break;
        case 'alarm': H.Audio.alarm(true); walkieSay(rnd(V.alarm), true); H.UI.toast('THE ALARM. lights up. fog dead. breathe. reset the season’s pride tomorrow.'); break;
        case 'alarmOver': H.Audio.alarm(false); walkieSay('alarm reset. the dark comes back on slow.', true); break;
        case 'ghost': H.Audio.ghost(); H.View.fx(ev); setTimeout(() => walkieSay(rnd(V.ghost), true), 1600); break;
        case 'spawn':
          if (Math.random() < 0.3) H.Audio.doorCreak();
          H.Audio.chatterBlip('talk');
          if (N.softScare && ev.group === 1) walkieSay(rnd(V.kidGroup), true);
          break;
        case 'comedy': H.Audio.comedy(); walkieSay('bo does the wave. the room resets. bless him.', true); break;
        case 'loudBreak': if (Math.random() < 0.5) walkieSay('the too-cool one broke LOUDEST. they always do.'); break;
        case 'crewScare': {
          const lines = V.crew[ev.crew];
          if (lines && ev.grade === 0 && Math.random() < 0.5) walkieSay(rnd(lines));
          break;
        }
        case 'distract': if (Math.random() < 0.35) walkieSay(rnd(V.crew.priya)); break;
      }
    }
    N.events.length = 0;
  }

  /* ---------------- screens ---------------- */
  function title() {
    GAME.state = 'title';
    H.UI.showHud(false); H.Player.enabled = false;
    const s = GAME.S;
    const cont = s && s.nights > 0;
    H.UI.screen(`
      <h1>${D().TITLE}</h1>
      <h2>${D().SUBTITLE} · a DIRTY BOY DEVS game</h2>
      <p>the scream barn went dark in ’99. twenty-one octobers, then none.<br>
      you didn’t inherit it — the county was going to take it. <b>you signed the note.</b></p>
      <p style="color:#8a7a58">design the maze between weekends. then get in the walls and RUN it —<br>
      drop the panel on the beat, sprint the reset paths, and watch the town walk out laughing.</p>
      <div style="margin-top:18px">
        ${cont ? '<button class="btn primary" id="btnContinue">continue the season (night ' + (s.nightIdx + 1) + ')</button>' : ''}
        <button class="btn ${cont ? '' : 'primary'}" id="btnNew">${cont ? 'start over' : 'sign the note'}</button>
        <button class="btn ghostbtn" id="btnSettings">settings</button>
      </div>
      <p style="font-size:11px;color:#5a4c34;margin-top:16px">every guest walks out laughing. that’s the whole religion.</p>`);
    H.UI.on('btnContinue', () => seasonHub());
    H.UI.on('btnNew', () => {
      if (cont && !confirm('start the season over? the wall of got-got comes down.')) return;
      GAME.S = freshSeason(); save(); intro();
    });
    H.UI.on('btnSettings', () => settings(title));
  }

  function intro() {
    H.UI.screen(`
      <h2>route 9, past the fairgrounds</h2>
      <p>aunt ruthie ran the SCREAM BARN from ’78 to ’99. the ’96 season is the one they still
      talk about in church parking lots. it went dark the year she died, mid-october, and the barn
      has sat since — tarps, dust, a marquee with three letters left.</p>
      <p>the bank gave you until halloween. the note is <b>$${D().SEASON.notePayments.reduce((a, p) => a + p.due, 0)}</b>, in four payments.
      the fire marshal walks the route thursdays. six local teens answered the flyer.</p>
      <p class="warn">house rules, non-negotiable: nobody gets touched. nobody gets harmed.
      everybody — <i>everybody</i> — walks out laughing.</p>
      <button class="btn primary" id="btnGo">open the doors</button>`);
    H.UI.on('btnGo', () => seasonHub());
  }

  function seasonHub() {
    GAME.state = 'season';
    H.UI.showHud(false); H.Player.enabled = false;
    const s = GAME.S;
    const nights = D().SEASON.nights;
    const idx = Math.min(s.nightIdx, nights.length - 1);
    const nd = s.nightIdx < nights.length ? nights[s.nightIdx] : null;
    const owedNow = noteOwedNow();
    const rows = nights.map((n, i) => {
      const done = i < s.nightIdx;
      const cur = i === s.nightIdx;
      return `<tr style="${cur ? 'color:#ffe9b0' : done ? 'opacity:.45' : 'opacity:.8'}">
        <td>${done ? '✔' : cur ? '▶' : ''}</td><td>${n.label}</td><td>${n.groups} groups</td>
        <td>${n.fri ? '<span class="tag">marshal thursday</span>' : ''}${n.homecoming ? '<span class="tag">homecoming</span>' : ''}${n.finale ? '<span class="tag">THE FINALE</span>' : ''}</td></tr>`;
    }).join('');
    H.UI.screen(`
      <h1 style="font-size:26px">the season</h1>
      <h2>cash $${Math.round(s.cash)} · scary ${Math.round(s.rep.scary)} · fun ${Math.round(s.rep.fun)} · guests so far ${s.seasonGuests}
      ${owedNow > 0 ? ` · <span class="bad">note due: $${owedNow}</span>` : s.paymentsDone >= 4 ? ' · <span class="good">NOTE PAID</span>' : ''}</h2>
      <div class="row"><div class="col" style="max-height:300px;overflow:auto"><table>${rows}</table></div>
      <div class="col">
        <h3>${nd ? 'next: ' + nd.label : 'the season is over'}</h3>
        ${nd ? `<div class="stat">expected crowd: <b>${nd.groups} groups</b></div>
        <div class="stat">stations live: <b>${Object.values(s.build.slots).filter(b => b && b.type && !b.broken).length}</b> · crew assigned: <b>${Object.keys(s.crewAssign).length}</b></div>
        <button class="btn primary" id="btnWalk">build day — walk the barn</button>
        <button class="btn" id="btnBuild">the clipboard (do it from a chair)</button>
        <button class="btn" id="btnNight">skip to cast call →</button>` :
        `<button class="btn primary" id="btnEndings">the reckoning</button>`}
        <button class="btn ghostbtn" id="btnSettings2">settings</button>
        <button class="btn ghostbtn" id="btnTitle">title</button>
      </div></div>`);
    if (nd) { H.UI.on('btnWalk', buildWalk); H.UI.on('btnBuild', buildDay); H.UI.on('btnNight', castCall); }
    else H.UI.on('btnEndings', endings);
    H.UI.on('btnSettings2', () => settings(seasonHub));
    H.UI.on('btnTitle', title);
  }

  function noteOwedNow() {
    const s = GAME.S;
    let due = 0;
    D().SEASON.notePayments.forEach((p, i) => { if (s.nightIdx > p.afterNight && i >= s.paymentsDone) due += p.due; });
    return due;
  }
  function tryPayNote() {
    const s = GAME.S;
    D().SEASON.notePayments.forEach((p, i) => {
      if (s.nightIdx > p.afterNight && i >= s.paymentsDone) {
        if (s.cash >= p.due) { s.cash -= p.due; s.paymentsDone = i + 1; H.UI.toast(`note payment made: $${p.due}. the bank says nothing. the bank never says anything.`); H.Audio.cash(); }
      }
    });
  }

  /* ---------------- build day ---------------- */
  function buildDay() {
    GAME.state = 'build';
    const s = GAME.S;
    const nd = D().SEASON.nights[s.nightIdx];
    const slotRows = D().SLOTS.map(slot => {
      const b = s.build.slots[slot.id];
      const node = D().NODES.find(n => n.id === slot.node);
      const room = D().ROOMS.find(r => r.id === node.room);
      const opts = slot.types.map(t => `<option value="${t}" ${b && b.type === t ? 'selected' : ''}>${D().STATIONS[t].name} $${D().STATIONS[t].cost[0]}</option>`).join('');
      const owned = b && b.type;
      return `<tr>
        <td>${room.name}${node.detector ? ' <span class="tag" title="smoke detector here">detector</span>' : ''}</td>
        <td>${owned ? `<b>${D().STATIONS[b.type].name}</b> t${b.tier}${b.broken ? ' <span class="bad">DEAD</span>' : ''}` : '<span style="opacity:.5">empty slot</span>'}</td>
        <td>${owned ?
          (b.broken ? `<button class="btn" data-fix="${slot.id}">fix $${D().SEASON.repairCost}</button>` :
            (b.tier < 3 ? `<button class="btn" data-up="${slot.id}">tier ${b.tier + 1} $${D().STATIONS[b.type].cost[b.tier]}</button>` : '<span class="tag">maxed</span>')) :
          `<select id="sel_${slot.id}">${opts}</select> <button class="btn" data-buy="${slot.id}">install</button>`}</td></tr>`;
    }).join('');
    const crewRows = D().CREW.map(c => {
      const at = Object.entries(s.crewAssign).find(([n, id]) => id === c.id);
      const nodeOpts = ['<option value="">— off tonight —</option>'].concat(D().NODES.map(n => {
        const room = D().ROOMS.find(r => r.id === n.room);
        const taken = s.crewAssign[n.id] && s.crewAssign[n.id] !== c.id;
        return `<option value="${n.id}" ${at && at[0] === n.id ? 'selected' : ''} ${taken ? 'disabled' : ''}>${room.name}${taken ? ' (taken)' : ''}</option>`;
      })).join('');
      return `<div class="crewline"><span class="dot" style="background:#${(D().ARCHETYPES.flannel, c.id === 'marcus' ? 'c85a3a' : c.id === 'dee' ? '6a8ac8' : c.id === 'tater' ? 'c8a83a' : c.id === 'grace' ? '9a6ac8' : c.id === 'bo' ? '6ac87a' : 'e88aa8')}"></span>
        <b style="width:64px;display:inline-block">${c.name}</b>
        <span style="width:88px;display:inline-block;color:#8a7856">${c.style}</span>
        <select data-crew="${c.id}">${nodeOpts}</select>
        <span style="font-size:11px;color:#6a5c40">$${c.wage}/night · ${c.line}</span></div>`;
    }).join('');
    const spacingOpts = D().SPACING.map(sp => `<option value="${sp.id}" ${s.spacingId === sp.id ? 'selected' : ''}>${sp.label}</option>`).join('');
    const marshal = nd.fri ? marshalReport() : null;
    H.UI.screen(`
      <h1 style="font-size:24px">build day</h1>
      <h2>cash $${Math.round(s.cash)} · before ${nd.label}</h2>
      <div class="row">
        <div class="col">
          <h3>the route (stations)</h3>
          <div style="max-height:240px;overflow:auto"><table>${slotRows}</table></div>
          <h3>the dials</h3>
          <div class="stat">pulse spacing <select id="selSpacing">${spacingOpts}</select></div>
          <div class="stat">ticket $<input id="inTicket" type="number" min="${D().SEASON.ticket.min}" max="${D().SEASON.ticket.max}" value="${s.ticket}" style="width:60px;background:#241808;color:#f0e0b8;border:1px solid #5a4420;border-radius:4px;padding:3px"> <span style="color:#6a5c40">(small-town band: $${D().SEASON.ticket.min}–$${D().SEASON.ticket.max})</span></div>
        </div>
        <div class="col">
          <h3>cast (assign zones)</h3>
          ${crewRows}
          ${marshal ? `<h3>marshal thursday</h3>${marshal}` : ''}
          <div style="margin-top:14px">
            <button class="btn primary" id="btnToCast">cast call →</button>
            <button class="btn" id="btnWalkFromMenu">walk the barn instead</button>
            <button class="btn ghostbtn" id="btnBackSeason">back</button>
          </div>
        </div>
      </div>`);
    // wire
    document.querySelectorAll('[data-buy]').forEach(btn => btn.onclick = () => {
      const slotId = btn.getAttribute('data-buy');
      const sel = document.getElementById('sel_' + slotId);
      const type = sel.value; const cost = D().STATIONS[type].cost[0];
      if (s.cash < cost) return H.UI.toast('the drawer says no. (not enough cash)');
      s.cash -= cost; s.build.slots[slotId] = { type, tier: 1 };
      H.Audio.cash(); save(); buildDay();
    });
    document.querySelectorAll('[data-up]').forEach(btn => btn.onclick = () => {
      const slotId = btn.getAttribute('data-up');
      const b = s.build.slots[slotId]; const cost = D().STATIONS[b.type].cost[b.tier];
      if (s.cash < cost) return H.UI.toast('the drawer says no.');
      s.cash -= cost; b.tier++;
      H.Audio.cash(); save(); buildDay();
    });
    document.querySelectorAll('[data-fix]').forEach(btn => btn.onclick = () => {
      const slotId = btn.getAttribute('data-fix');
      if (s.cash < D().SEASON.repairCost) return H.UI.toast('the drawer says no.');
      s.cash -= D().SEASON.repairCost; s.build.slots[slotId].broken = false;
      H.Audio.cash(); save(); buildDay();
    });
    document.querySelectorAll('[data-crew]').forEach(sel => sel.onchange = () => {
      const cid = sel.getAttribute('data-crew');
      for (const k of Object.keys(s.crewAssign)) if (s.crewAssign[k] === cid) delete s.crewAssign[k];
      if (sel.value) s.crewAssign[sel.value] = cid;
      save(); buildDay();
    });
    const selSp = document.getElementById('selSpacing');
    if (selSp) selSp.onchange = () => { s.spacingId = selSp.value; save(); };
    const inT = document.getElementById('inTicket');
    if (inT) inT.onchange = () => { s.ticket = Math.max(D().SEASON.ticket.min, Math.min(D().SEASON.ticket.max, +inT.value || D().SEASON.ticket.base)); save(); };
    H.UI.on('btnToCast', castCall);
    H.UI.on('btnWalkFromMenu', buildWalk);
    H.UI.on('btnBackSeason', seasonHub);
  }

  function marshalReport() {
    const s = GAME.S;
    const issues = [];
    for (const [slotId, b] of Object.entries(s.build.slots)) {
      if (!b || !b.type) continue;
      const slot = D().SLOTS.find(sl => sl.id === slotId);
      const node = D().NODES.find(n => n.id === slot.node);
      if (b.type === 'fogBurst' && node.detector && b.tier > D().ALARM.fogThreshold)
        issues.push(`<div class="stat bad">✘ tier-${b.tier} fog at a detector (${node.id.replace('n_', '')}). he taps the clipboard. drop the tier or move it.</div>`);
      if (b.broken) issues.push(`<div class="stat warn">✘ a dead ${D().STATIONS[b.type].name} on the route. fix it or he fails the walk.</div>`);
    }
    if (!issues.length) return `<div class="stat good">✔ the walk is clean. he says nothing. from him, that’s a parade.</div><div class="stat" style="color:#6a5c40">${D().MARSHAL.quote}</div>`;
    return issues.join('') + `<div class="stat" style="color:#6a5c40">unfixed violations get their station shut off friday, plus the $${D().SEASON.marshalFee} re-inspection.</div>`;
  }

  /* ---------------- build day, WALKED (M5) — the barn in the daylight, and it's yours ---------------- */
  function buildWalk() {
    const s = GAME.S;
    GAME.state = 'build3d';
    H.UI.screen(null); H.UI.panel(null);
    H.View.syncStations(s.build.slots);
    H.View.setBuildMode(true, s.build.slots);
    H.View.setDaylight(true);
    H.View.handsIdle();
    H.Player.enabled = true; H.Player.spawnPorch();
    H.UI.showHud(true); H.UI.hudNight(null, s); H.UI.cooldowns(null);
    H.UI.keysHelp('wasd move · shift run · E work the slot · C the clipboard · ENTER cast call · esc menu');
    buildBar();
    walkieSay(rnd(D().VOICE.build), true);
    grabLock();
  }
  function buildBar() {
    const s = GAME.S;
    const nd = D().SEASON.nights[s.nightIdx];
    H.UI.buildBar(
      `the scream barn · daylight · before <b>${nd.label}</b> &nbsp;·&nbsp; drawer <b>$${Math.round(s.cash)}</b>` +
      ` &nbsp;·&nbsp; stations <b>${Object.values(s.build.slots).filter(b => b && b.type && !b.broken).length}</b>` +
      ` · crew <b>${Object.keys(s.crewAssign).length}</b><br>` +
      `<span class="k">E</span> work a slot <span class="k">C</span> the clipboard <span class="k">ENTER</span> cast call <span class="k">ESC</span> menu`);
  }
  /* pointer-lock bookkeeping: `wantLock` is our INTENT, `lockAt` swallows the browser's own
     echo of a lock change we asked for — without both, closing a panel can pop the menu behind it. */
  function grabLock() {
    GAME.wantLock = true; GAME.lockAt = performance.now();
    H.Player.lock();
  }
  function dropLock() {
    GAME.wantLock = false; GAME.lockAt = performance.now();
    if (document.exitPointerLock) document.exitPointerLock();
  }
  function leaveBuildWalk() {
    H.View.setBuildMode(false, GAME.S.build.slots);
    H.View.setDaylight(false);
    H.UI.buildBar(null); H.UI.panel(null); H.UI.showHud(false); H.UI.prompt(null);
    H.UI.keysHelp('wasd move · shift run · mouse look · E act · Q the comedy beat · esc menu');
    H.Player.enabled = false;
    dropLock();
  }
  function closePanel() {
    H.UI.panel(null);
    if (GAME.state === 'build3d') { H.Player.enabled = true; grabLock(); }
  }
  function openPanel(html) {
    H.Player.enabled = false;
    H.UI.panel(html);
    dropLock();
  }
  function refreshWalk() {
    H.View.syncStations(GAME.S.build.slots);
    H.View.setBuildMode(true, GAME.S.build.slots);
    buildBar(); save();
  }

  function slotPanel(ctx) {
    const s = GAME.S, slot = ctx.slot, b = ctx.b;
    const node = D().NODES.find(n => n.id === slot.node);
    let body;
    if (b && b.type) {
      const def = D().STATIONS[b.type];
      const rows = [];
      if (b.broken) rows.push(`<button class="opt" data-act="fix">fix it — the fog machine's revenge<span class="price">$${D().SEASON.repairCost}</span></button>`);
      if (!b.broken && b.tier < 3) rows.push(`<button class="opt" data-act="up">upgrade to tier ${b.tier + 1} — hits ${Math.round((D().TIER_MULT[b.tier] / D().TIER_MULT[b.tier - 1] - 1) * 100)}% harder<span class="price">$${def.cost[b.tier]}</span></button>`);
      if (!b.broken && b.tier >= 3) rows.push(`<button class="opt" disabled>tier 3. this is as mean as it gets.</button>`);
      rows.push(`<button class="opt" data-act="pull">haul it out — half the tier-1 price back<span class="price">+$${Math.round(def.cost[0] * D().SEASON.salvage)}</span></button>`);
      body = `<div class="stat">${def.desc}</div>
        <div class="stat">tier <b>${b.tier}</b> · power <b>${Math.round(def.power * D().TIER_MULT[b.tier - 1])}</b> · resets in <b>${def.resetS}s</b>${b.broken ? ' · <span class="bad">DEAD</span>' : ''}</div>
        ${node.detector ? '<div class="stat warn">⚠ there is a smoke detector in this room. tier-3 fog here trips the alarm and the marshal knows it.</div>' : ''}
        ${rows.join('')}`;
    } else {
      body = `<div class="stat">an empty mount. ${node.detector ? '<span class="warn">smoke detector in this room — keep fog at tier 2 or under.</span>' : 'nothing here but a bracket ruthie left.'}</div>` +
        slot.types.map(t => {
          const def = D().STATIONS[t];
          const afford = s.cash >= def.cost[0];
          return `<button class="opt" data-buy="${t}" ${afford ? '' : 'disabled'}>${def.name} — ${def.desc}<span class="price">$${def.cost[0]}</span></button>`;
        }).join('');
    }
    openPanel(`<h2 style="margin-bottom:10px">${ctx.room.name}</h2>${body}
      <div style="margin-top:12px"><button class="btn ghostbtn" id="btnPanelBack">back to the barn</button></div>`);
    document.querySelectorAll('[data-buy]').forEach(btn => btn.onclick = () => {
      const t = btn.getAttribute('data-buy'), cost = D().STATIONS[t].cost[0];
      if (s.cash < cost) return H.UI.toast('the drawer says no.');
      s.cash -= cost; s.build.slots[slot.id] = { type: t, tier: 1 };
      H.Audio.hammer(); refreshWalk(); closePanel(); walkieSay(rnd(D().VOICE.installed), true);
    });
    document.querySelectorAll('[data-act]').forEach(btn => btn.onclick = () => {
      const act = btn.getAttribute('data-act'), cur = s.build.slots[slot.id];
      if (act === 'fix') {
        if (s.cash < D().SEASON.repairCost) return H.UI.toast('the drawer says no.');
        s.cash -= D().SEASON.repairCost; cur.broken = false; H.Audio.hammer();
      } else if (act === 'up') {
        const cost = D().STATIONS[cur.type].cost[cur.tier];
        if (s.cash < cost) return H.UI.toast('the drawer says no.');
        s.cash -= cost; cur.tier++; H.Audio.hammer();
      } else if (act === 'pull') {
        s.cash += Math.round(D().STATIONS[cur.type].cost[0] * D().SEASON.salvage);
        delete s.build.slots[slot.id]; H.Audio.cash();
      }
      refreshWalk(); closePanel();
    });
    const back = document.getElementById('btnPanelBack');
    if (back) back.onclick = () => { H.Audio.click(); closePanel(); };
  }

  function callSheetPanel() {
    const s = GAME.S;
    const rows = D().CREW.map(c => {
      const at = Object.entries(s.crewAssign).find(([n, id]) => id === c.id);
      const opts = ['<option value="">— off tonight —</option>'].concat(D().NODES.map(n => {
        const room = D().ROOMS.find(r => r.id === n.room);
        const taken = s.crewAssign[n.id] && s.crewAssign[n.id] !== c.id;
        return `<option value="${n.id}" ${at && at[0] === n.id ? 'selected' : ''} ${taken ? 'disabled' : ''}>${room.name}${taken ? ' (taken)' : ''}</option>`;
      })).join('');
      return `<div class="crewline"><b style="width:62px;display:inline-block">${c.name}</b>
        <span style="width:86px;display:inline-block;color:#8a7856">${c.style}</span>
        <select data-crew="${c.id}">${opts}</select></div>
        <div class="stat" style="margin:0 0 6px 62px;font-size:11px">${c.line}</div>`;
    }).join('');
    openPanel(`<h2 style="margin-bottom:10px">the call sheet</h2>
      <div class="stat">$${D().CREW[0].wage} a night each, and they only get paid if they show.</div>${rows}
      <div style="margin-top:12px"><button class="btn ghostbtn" id="btnPanelBack">back to the barn</button></div>`);
    document.querySelectorAll('[data-crew]').forEach(sel => sel.onchange = () => {
      const cid = sel.getAttribute('data-crew');
      for (const k of Object.keys(s.crewAssign)) if (s.crewAssign[k] === cid) delete s.crewAssign[k];
      if (sel.value) s.crewAssign[sel.value] = cid;
      save(); buildBar();
    });
    document.getElementById('btnPanelBack').onclick = () => { H.Audio.click(); closePanel(); };
  }

  function dialsPanel() {
    const s = GAME.S;
    const spacingOpts = D().SPACING.map(sp => `<option value="${sp.id}" ${s.spacingId === sp.id ? 'selected' : ''}>${sp.label}</option>`).join('');
    openPanel(`<h2 style="margin-bottom:10px">the dials</h2>
      <div class="stat">pulse spacing <select id="pSpacing">${spacingOpts}</select></div>
      <div class="stat" style="color:#6a5c40">tighter pulses = more heads through the door = less time to reset. that's the whole trade.</div>
      <div class="stat" style="margin-top:10px">ticket $<input id="pTicket" type="number" min="${D().SEASON.ticket.min}" max="${D().SEASON.ticket.max}" value="${s.ticket}" style="width:60px;background:#241808;color:#f0e0b8;border:1px solid #5a4420;border-radius:4px;padding:3px"></div>
      <div class="stat" style="color:#6a5c40">the small-town band is $${D().SEASON.ticket.min}–$${D().SEASON.ticket.max}. charge like a barn, not like a theme park.</div>
      <div style="margin-top:12px"><button class="btn ghostbtn" id="btnPanelBack">back to the barn</button></div>`);
    document.getElementById('pSpacing').onchange = e => { s.spacingId = e.target.value; save(); };
    document.getElementById('pTicket').onchange = e => {
      s.ticket = Math.max(D().SEASON.ticket.min, Math.min(D().SEASON.ticket.max, +e.target.value || D().SEASON.ticket.base)); save();
    };
    document.getElementById('btnPanelBack').onclick = () => { H.Audio.click(); closePanel(); };
  }

  function buildMenuPanel() {
    const nd = D().SEASON.nights[GAME.S.nightIdx];
    openPanel(`<h2 style="margin-bottom:10px">the barn, in the daylight</h2>
      <div class="stat">${nd.label} opens tonight. ${nd.fri ? 'the marshal walks it first.' : ''}</div>
      <button class="opt" id="bmResume">keep walking</button>
      <button class="opt" id="bmClip">the clipboard (menus · marshal thursday)</button>
      <button class="opt" id="bmCast">cast call →</button>
      <button class="opt" id="bmSeason">back to the season</button>`);
    document.getElementById('bmResume').onclick = () => { H.Audio.click(); closePanel(); };
    document.getElementById('bmClip').onclick = () => { H.Audio.click(); leaveBuildWalk(); buildDay(); };
    document.getElementById('bmCast').onclick = () => { H.Audio.click(); leaveBuildWalk(); castCall(); };
    document.getElementById('bmSeason').onclick = () => { H.Audio.click(); leaveBuildWalk(); seasonHub(); };
  }

  /* ---------------- cast call & the night ---------------- */
  function castCall() {
    GAME.state = 'cast';
    const s = GAME.S;
    const nd = D().SEASON.nights[s.nightIdx];
    // roll absences (deterministic per night)
    const rng = H.makeRng(s.seasonSeed * 1000 + s.nightIdx * 7 + 3);
    GAME.nightAbsent = [];
    for (const c of D().CREW) {
      if (!Object.values(s.crewAssign).includes(c.id)) continue;
      let absent = false;
      if (nd.homecoming && ['marcus', 'tater', 'grace'].includes(c.id)) absent = true;
      else if (nd.fri && rng.chance(c.friAbsent)) absent = true;
      else if (rng.chance(1 - c.rel)) absent = true;
      if (absent) GAME.nightAbsent.push(c.id);
    }
    // marshal enforcement on fridays
    let marshalNote = '';
    if (nd.fri) {
      for (const [slotId, b] of Object.entries(s.build.slots)) {
        if (!b || !b.type) continue;
        const slot = D().SLOTS.find(sl => sl.id === slotId);
        const node = D().NODES.find(n => n.id === slot.node);
        if (b.type === 'fogBurst' && node.detector && b.tier > D().ALARM.fogThreshold && !b.broken) {
          b.broken = true; s.cash -= D().SEASON.marshalFee; s.marshalFails++;
          marshalNote = `<p class="bad">the marshal shut off your fog at the detector and left a $${D().SEASON.marshalFee} bill. he did not smile.</p>`;
        }
      }
    }
    const here = Object.entries(s.crewAssign).filter(([n, id]) => !GAME.nightAbsent.includes(id));
    const gone = GAME.nightAbsent;
    H.UI.screen(`
      <h1 style="font-size:24px">cast call · ${nd.label}</h1>
      <h2>${nd.groups} groups on the books · spacing: ${D().SPACING.find(x => x.id === s.spacingId).fiction} pulses · $${s.ticket} a head</h2>
      ${marshalNote}
      <h3>who showed</h3>
      ${here.length ? here.map(([n, id]) => { const c = D().CREW.find(x => x.id === id); const room = D().ROOMS.find(r => r.id === D().NODES.find(nn => nn.id === n).room); return `<div class="stat good">✔ ${c.name} — ${room.name}</div>`; }).join('') : '<div class="stat warn">nobody. the barn is all yours tonight.</div>'}
      ${gone.length ? '<h3>who didn’t</h3>' + gone.map(id => { const c = D().CREW.find(x => x.id === id); return `<div class="stat bad">✘ ${c.name} — ${nd.homecoming ? 'homecoming.' : nd.fri && c.friAbsent > 0.5 ? 'he has games.' : 'no text. nothing.'}</div>`; }).join('') : ''}
      ${s.softNext ? '<p class="warn">family hour tonight: soft scares only, everyone leaves glowing.</p>' : ''}
      <p style="color:#8a7a58">${D().VOICE.open[s.nightIdx % D().VOICE.open.length]}${nd.finale ? '<br><b>' + D().VOICE.finale[0] + '</b>' : ''}</p>
      <button class="btn primary" id="btnDoors">DOORS · get in the walls</button>
      <button class="btn ghostbtn" id="btnBackBuild">wait, the build</button>`);
    H.UI.on('btnDoors', startNight);
    H.UI.on('btnBackBuild', buildDay);
  }

  function startNight() {
    const s = GAME.S;
    H.Audio.unlock();
    const nd = D().SEASON.nights[s.nightIdx];
    GAME.night = H.Sim.createNight({
      seed: s.seasonSeed * 100 + s.nightIdx + s.endless * 977,
      nightIdx: s.nightIdx,
      build: s.build, crewAt: s.crewAssign, absent: GAME.nightAbsent,
      spacingId: s.spacingId, ticket: s.ticket,
      seasonFlags: { ghostArmed: s.ghostArmed && !s.ghostSeen },
      softScare: s.softNext
    });
    GAME.pendingPolaroid = null;
    // fresh night, fresh tape, fresh feed
    H.Replay.reset();
    Object.assign(GAME, { lastCue: 0, chatT: 3, voiceT: 0, perfectRun: 0, walkbyRun: 0, firstDrop: false, quietT: 0, saidLate: false, saidLast: false, chickenSeen: 0 });
    H.View.setBuildMode(false, s.build.slots);
    H.View.setDaylight(false);
    H.View.syncStations(s.build.slots);
    H.View.handsIdle();
    H.UI.buildBar(null);
    H.UI.keysHelp('wasd move · shift run · mouse look · E act · Q the comedy beat · esc menu');
    H.UI.screen(null); H.UI.showHud(true);
    H.Player.enabled = true; H.Player.spawnBackstage();
    H.Audio.startNightBed();
    GAME.state = 'night';
    H.UI.walkie('doors. first car’s already parking. have a night.');
    save();
  }

  /* ---------------- input during the night ---------------- */
  GAME.onKey = function (code, e) {
    if (GAME.state === 'replay') { stopTape(); return; }
    if (GAME.state === 'night') {
      if (code === 'KeyE') {
        const ctx = H.Player.context(GAME.night, GAME.S.build.slots);
        if (!ctx) return;
        if (ctx.kind === 'station' && !ctx.cool && !ctx.broken) { H.View.leverHand(); H.Audio.lever(); GAME.night.triggerStation(ctx.id); }
        else if (ctx.kind === 'peek' && ctx.ready) { H.Audio.pop(); H.Audio.cloth(); H.View.popHands(ctx.id); GAME.night.triggerBody(ctx.id); }
        else if (ctx.kind === 'rescue') GAME.night.rescue(ctx.id);
      } else if (code === 'KeyQ') {
        GAME.night.triggerComedy();
      } else if (code === 'Escape') {
        pauseMenu();
      }
    } else if (GAME.state === 'build3d') {
      if (H.UI.panelOpen()) return;                       // the panel owns the keyboard while it's up
      if (code === 'KeyE') {
        const ctx = H.Player.buildContext(GAME.S.build.slots);
        if (!ctx) return;
        if (ctx.kind === 'slot') slotPanel(ctx);
        else if (ctx.kind === 'callsheet') callSheetPanel();
        else if (ctx.kind === 'dials') dialsPanel();
      } else if (code === 'KeyC') { leaveBuildWalk(); buildDay(); }
      else if (code === 'Enter' || code === 'NumpadEnter') { leaveBuildWalk(); castCall(); }
      else if (code === 'Escape') buildMenuPanel();
    } else if (GAME.state === 'freeroam' && code === 'Escape') seasonHub();
  };
  GAME.onLockChange = function (locked) {
    if (locked) return;
    if (GAME.state === 'night') pauseMenu();
    else if (GAME.state === 'build3d') {
      if (!GAME.wantLock || H.UI.panelOpen()) return;              // we let go of the mouse on purpose
      if (performance.now() - GAME.lockAt < 400) return;           // ...or the browser is echoing us
      buildMenuPanel();
    }
  };

  function pauseMenu() {
    if (GAME.state !== 'night') return;
    GAME.state = 'paused';
    H.Player.enabled = false;
    H.UI.screen(`
      <h2>paused · the guests keep walking in your heart only</h2>
      <button class="btn primary" id="btnResume">back to the walls</button>
      <button class="btn" id="btnSettings3">settings</button>
      <button class="btn ghostbtn" id="btnBail">abandon the night (comp everyone)</button>`);
    H.UI.on('btnResume', () => { H.UI.screen(null); GAME.state = 'night'; H.Player.enabled = true; H.Player.lock(); });
    H.UI.on('btnSettings3', () => settings(() => { H.UI.screen(null); GAME.state = 'night'; H.Player.enabled = true; }));
    H.UI.on('btnBail', () => {
      H.Audio.stopBeds();
      GAME.night = null; GAME.state = 'season';
      H.UI.toast('night abandoned. the town is confused but forgiving. once.');
      seasonHub();
    });
  }

  /* ---------------- the sting ---------------- */
  function sting() {
    const s = GAME.S;
    const r = GAME.night.result;
    GAME.state = 'sting';
    H.Player.enabled = false; H.UI.showHud(false);
    H.Audio.stopBeds();
    document.exitPointerLock && document.exitPointerLock();
    // money
    const wages = Object.entries(s.crewAssign).filter(([n, id]) => !GAME.nightAbsent.includes(id)).length * 60;
    s.cash += r.drawer - wages;
    // rep, clamped ±12 a night
    const dS = Math.max(-12, Math.min(12, r.rep.scary));
    const dF = Math.max(-12, Math.min(12, r.rep.fun));
    s.rep.scary = Math.max(0, Math.min(100, s.rep.scary + dS));
    s.rep.fun = Math.max(0, Math.min(100, s.rep.fun + dF));
    // season aggregates
    s.nights++; s.seasonGuests += r.admitted; s.dropped += r.tally.dropped; s.melted += r.tally.melted;
    s.delight += Math.round(r.tally.delight);
    if (r.tally.bounty) s.bounty = true;
    if (r.tally.ghost) { s.ghostSeen = (s.ghostSeen || 0) + 1; }
    s.softNext = false;
    // polaroid
    let polHtml = '';
    if (GAME.pendingPolaroid || r.tally.polaroids > 0) {
      const info = { size: (GAME.pendingPolaroid && GAME.pendingPolaroid.size) || 4, caption: `the scream barn · ${D().SEASON.nights[s.nightIdx].label}`, sub: '"AAAAAA" — everyone, in unison' };
      const url = H.UI.makePolaroid(info, s.seasonSeed + s.nightIdx * 13);
      s.polaroids.push(url); if (s.polaroids.length > 10) s.polaroids.shift();
      H.View.pinPolaroid(url, s.polaroids.length - 1);
      polHtml = `<div style="text-align:center;margin:10px 0"><img class="pol" src="${url}" width="128"><br>
        <a class="btn" href="${url}" download="scream-barn-polaroid.png" style="margin-top:8px">keep the polaroid</a></div>`;
    }
    // fog mortality
    let fogNote = '';
    const rng = H.makeRng(s.seasonSeed * 31 + s.nightIdx);
    for (const [slotId, b] of Object.entries(s.build.slots)) {
      if (b && b.type === 'fogBurst' && !b.broken && rng.chance(D().SEASON.fogMortality)) {
        b.broken = true; fogNote = `<div class="stat warn">the fog machine died mid-clean. they always do. ($${D().SEASON.repairCost} tomorrow)</div>`;
      }
    }
    // advance
    s.nightIdx++;
    tryPayNote();
    const owed = noteOwedNow();
    s.notePaidAll = owed === 0 && s.paymentsDone >= Math.min(4, D().SEASON.notePayments.filter(p => s.nightIdx > p.afterNight).length);
    save();
    GAME.stingData = { r, wages, dS, dF, owed, polHtml, fogNote };
    stingCard();
  }

  /* the card itself — re-rendered when the tape finishes rolling */
  function stingCard() {
    const s = GAME.S;
    const { r, wages, dS, dF, owed, polHtml, fogNote } = GAME.stingData;
    const t = r.tally;
    const take = H.Replay.take;
    H.UI.screen(`
      <h1 style="font-size:24px">the drawer, counted</h1>
      <h2>${D().SEASON.nights[s.nightIdx - 1].label}</h2>
      <div class="row"><div class="col"><div class="chalk">
        guests through: <b>${r.admitted}</b><br>
        dropped: <b>${t.dropped}</b> · melted into the floor: <b>${t.melted}</b><br>
        got ’em: <b>${t.gotem}</b> · screams: <b>${t.scream}</b> · walk-bys: <b>${t.walkby}</b><br>
        delight banked: <b>${Math.round(t.delight)}</b> · rescues: <b>${t.rescues}</b> · complaints: <b>${t.complaints}</b><br>
        ${t.ghost ? 'tally says one more than we counted. leaving it. —<br>' : ''}
        drawer: <b class="good">$${r.drawer}</b> · wages: <b>-$${wages}</b>
      </div>
      <div class="stat" style="margin-top:8px">scary ${dS >= 0 ? '+' : ''}${Math.round(dS)} → <b>${Math.round(s.rep.scary)}</b> · fun ${dF >= 0 ? '+' : ''}${Math.round(dF)} → <b>${Math.round(s.rep.fun)}</b></div>
      ${owed > 0 ? `<div class="stat bad">the note wants $${owed}. it can wait exactly one more night.</div>` : ''}
      ${fogNote}
      </div><div class="col">
      ${polHtml || '<p style="color:#6a5c40;text-align:center;margin-top:40px">no polaroid tonight.<br>drop a full group at the scare-cam<br>and the wall gets its next frame.</p>'}
      ${r.bestScare ? `<div class="stat" style="text-align:center">best scare: <b>${r.bestScare.source === 'nobody' ? 'unattributed' : r.bestScare.source.replace('crew:', '')}</b> in ${r.bestScare.node.replace('n_', 'the ')} — magnitude ${Math.round(r.bestScare.magnitude)}</div>` : ''}
      ${take ? `<div style="text-align:center;margin-top:8px"><button class="btn" id="btnTape">▶ roll the tape</button></div>` : ''}
      </div></div>
      <div style="margin-top:12px;text-align:center">
        <button class="btn primary" id="btnOnward">${s.nightIdx >= D().SEASON.nights.length ? 'the reckoning →' : 'onward'}</button>
      </div>`);
    if (take) H.UI.on('btnTape', () => { walkieSay(D().VOICE.tape[0], true); rollTape(); });
    H.UI.on('btnOnward', () => { GAME.night = null; s.nightIdx >= D().SEASON.nights.length ? endings() : seasonHub(); });
  }

  /* ---------------- endings ---------------- */
  function endings() {
    const s = GAME.S;
    GAME.state = 'endings';
    const st = { notePaid: s.paymentsDone >= 4, rep: s.rep };
    const ending = D().ENDINGS.find(e => e.test(st));
    s.endings[ending.id] = 1;
    save();
    const flavor = {
      soldout: 'cars down route 9 both directions. the marshal came off-duty, paid full price, and — no. almost. you saw it though.',
      ruthie: 'the note came up short. then the town heard. jars on counters, a fish-fry, the lanes ran a league night for the barn. the bank got its money and never learned who from. fun AND scary — that was always her math.',
      madeit: 'the note is paid. the barn is yours. ruthie’s marquee gets its letters back in the spring.',
      bankletter: 'the letter came on bank paper, polite as a trap. the barn goes quiet again — but the wall of got-got comes home with you, and next october is a long way off. (endless mode keeps the lights on.)'
    };
    H.UI.screen(`
      <h1 style="font-size:30px">${ending.name}</h1>
      <h2>season one of the new scream barn</h2>
      <p>${flavor[ending.id]}</p>
      <div class="chalk">
        the season: <b>${s.seasonGuests}</b> guests · <b>${s.dropped}</b> dropped · <b>${s.melted}</b> melted ·
        delight <b>${s.delight}</b><br>
        final word of mouth: scary <b>${Math.round(s.rep.scary)}</b> · fun <b>${Math.round(s.rep.fun)}</b><br>
        ${s.bounty ? 'the $200 bounty: <b>PAID.</b> proudest expense of the year.<br>' : ''}
        ${s.ghostSeen ? 'and one scare all season that nobody staffed. the chalk stays as written. —' : ''}
      </div>
      <div style="margin-top:14px">
        <button class="btn primary" id="btnEndless">endless october (keep the barn running)</button>
        <button class="btn" id="btnNewSeason">new season (fresh note, fresh barn)</button>
        <button class="btn ghostbtn" id="btnTitle2">title</button>
      </div>`);
    H.UI.on('btnEndless', () => {
      s.endless++; s.nightIdx = D().SEASON.nights.length - 1; // replay the halloween-scale night, forever
      save(); seasonHub();
    });
    H.UI.on('btnNewSeason', () => {
      const keep = { polaroids: s.polaroids, endings: s.endings, settings: s.settings };
      GAME.S = Object.assign(freshSeason(), keep, { seasonSeed: s.seasonSeed + 1 });
      save(); seasonHub();
    });
    H.UI.on('btnTitle2', title);
  }

  /* ---------------- settings ---------------- */
  function settings(back) {
    const s = GAME.S;
    H.UI.screen(`
      <h2>settings</h2>
      <div class="stat"><label><input type="checkbox" id="cbMute" ${s.settings.muted ? 'checked' : ''}> mute everything</label></div>
      <div class="stat"><label><input type="checkbox" id="cbStrobe" ${s.settings.strobeOff ? 'checked' : ''}> strobe-off / steady lights (photosensitivity)</label></div>
      <div class="stat"><label><input type="checkbox" id="cbMotion" ${s.settings.reducedMotion ? 'checked' : ''}> reduced motion</label></div>
      <div class="stat"><label><input type="checkbox" id="cbSoft" ${s.softNext ? 'checked' : ''}> family hour next night (soft scares, delight only)</label></div>
      <p style="font-size:11px;color:#5a4c34">save lives in your browser (${D().SAVE_KEY}). the wall of got-got survives reloads.</p>
      <button class="btn primary" id="btnBackSet">back</button>`);
    const wire = (id, fn) => { const el = document.getElementById(id); el.onchange = () => { fn(el.checked); save(); }; };
    wire('cbMute', v => { s.settings.muted = v; H.Audio.setMuted(v); });
    wire('cbStrobe', v => { s.settings.strobeOff = v; H.View.setA11y(s.settings); });
    wire('cbMotion', v => { s.settings.reducedMotion = v; H.View.setA11y(s.settings); });
    wire('cbSoft', v => { s.softNext = v; });
    H.UI.on('btnBackSet', back);
  }

  H.Game = GAME;
  // boot when the DOM is ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => GAME.boot());
  else GAME.boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
