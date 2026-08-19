/* THE HAUNT — game.js — the orchestrator: title → season → build day → cast call → SHOW NIGHT → the sting → endings.
   Owns the save (haunt-save, house contract), the season economy, and the event→feel mapping. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const D = () => H.DATA;
  const GAME = { state: 'boot', night: null, S: null, raf: null, lastT: 0, cueT: 0, nightAbsent: [], pendingPolaroid: null };

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
    title();
    GAME.lastT = performance.now();
    loop();
  };

  function loop() {
    GAME.raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - GAME.lastT) / 1000);
    GAME.lastT = now;
    if (GAME.state === 'night' && GAME.night) {
      H.Player.update(dt);
      GAME.night.tick(dt);
      drainEvents();
      beatCue(dt);
      const xray = H.Barn.inSpine(H.Player.x, H.Player.z);
      H.View.syncGuests(GAME.night, xray);
      H.UI.hudNight(GAME.night, GAME.S);
      H.UI.cooldowns(GAME.night);
      H.UI.prompt(H.Player.context(GAME.night, GAME.S.build.slots));
      if (GAME.night.done) return sting();
    } else if (GAME.state === 'freeroam') {
      H.Player.update(dt);
      H.UI.prompt(null);
    }
    H.View.update(GAME.night, H.Player, GAME.S ? GAME.S.build.slots : {});
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
    if (best === null) return;
    GAME.cueT -= dt;
    if (GAME.cueT <= 0) { H.Audio.cueTick(best); GAME.cueT = 0.72 - best * 0.52; }
  }

  /* ---------------- event → feel ---------------- */
  function drainEvents() {
    const N = GAME.night, V = D().VOICE;
    const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
    for (const ev of N.events) {
      switch (ev.type) {
        case 'grade': H.UI.grade(ev.label, ev.id); if (!ev.byCrew) H.Audio.grade(ev.id); break;
        case 'scare': {
          const kind = ev.melted ? 'melt' : ev.dropped ? 'dropped' : ev.gotem ? 'gotem' : ev.screams ? 'scream' : 'flinch';
          H.Audio.scareHit(kind);
          if (ev.dropped) H.UI.walkie(rnd(V.dropped));
          if (ev.melted) H.UI.walkie(rnd(V.melt));
          break;
        }
        case 'walkby': H.Audio.walkby(); break;
        case 'huh': H.UI.walkie(rnd(V.huh)); break;
        case 'polaroid': H.Audio.flash(); H.UI.flash(); break;
        case 'polaroidFull': GAME.pendingPolaroid = { size: 6 + Math.floor(Math.random() * 2) }; break;
        case 'bounty': H.UI.walkie(rnd(V.bounty)); H.UI.toast('THE BOUNTY IS PAID. $200. worth every cent.'); break;
        case 'distress': H.UI.toast('somebody’s past scared. BACK OFF — go walk them out. (E near their room)'); break;
        case 'rescue': H.UI.walkie(rnd(V.rescue)); break;
        case 'complaint': H.UI.toast('a complaint. the review will not be kind.'); break;
        case 'conga': H.UI.walkie(rnd(V.conga)); break;
        case 'alarm': H.Audio.alarm(true); H.UI.walkie(rnd(V.alarm)); H.UI.toast('THE ALARM. lights up. fog dead. breathe. reset the season’s pride tomorrow.'); break;
        case 'alarmOver': H.Audio.alarm(false); H.UI.walkie('alarm reset. the dark comes back on slow.'); break;
        case 'ghost': H.Audio.ghost(); H.View.fx(ev); setTimeout(() => H.UI.walkie(rnd(V.ghost)), 1600); break;
        case 'spawn': if (Math.random() < 0.3) H.Audio.doorCreak(); break;
        case 'comedy': H.Audio.comedy(); H.UI.walkie('bo does the wave. the room resets. bless him.'); break;
        case 'loudBreak': if (Math.random() < 0.5) H.UI.walkie('the too-cool one broke LOUDEST. they always do.'); break;
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
        <button class="btn primary" id="btnBuild">build day (shop · crew · the route)</button>
        <button class="btn" id="btnNight">skip to cast call →</button>` :
        `<button class="btn primary" id="btnEndings">the reckoning</button>`}
        <button class="btn ghostbtn" id="btnSettings2">settings</button>
        <button class="btn ghostbtn" id="btnTitle">title</button>
      </div></div>`);
    if (nd) { H.UI.on('btnBuild', buildDay); H.UI.on('btnNight', castCall); }
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
    H.View.syncStations(s.build.slots);
    H.UI.screen(null); H.UI.showHud(true);
    H.Player.enabled = true; H.Player.spawnBackstage();
    H.Audio.startNightBed();
    GAME.state = 'night';
    H.UI.walkie('doors. first car’s already parking. have a night.');
    save();
  }

  /* ---------------- input during the night ---------------- */
  GAME.onKey = function (code, e) {
    if (GAME.state === 'night') {
      if (code === 'KeyE') {
        const ctx = H.Player.context(GAME.night, GAME.S.build.slots);
        if (!ctx) return;
        if (ctx.kind === 'station' && !ctx.cool && !ctx.broken) GAME.night.triggerStation(ctx.id);
        else if (ctx.kind === 'peek' && ctx.ready) { H.Audio.pop(); GAME.night.triggerBody(ctx.id); }
        else if (ctx.kind === 'rescue') GAME.night.rescue(ctx.id);
      } else if (code === 'KeyQ') {
        GAME.night.triggerComedy();
      } else if (code === 'Escape') {
        pauseMenu();
      }
    } else if (GAME.state === 'freeroam' && code === 'Escape') seasonHub();
  };
  GAME.onLockChange = function (locked) {
    if (!locked && GAME.state === 'night') pauseMenu();
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
    H.UI.on('btnResume', () => { H.UI.screen(null); GAME.state = 'night'; H.Player.enabled = true; document.getElementById('game').requestPointerLock(); });
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
    const t = r.tally;
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
      </div></div>
      <div style="margin-top:12px;text-align:center">
        <button class="btn primary" id="btnOnward">${s.nightIdx >= D().SEASON.nights.length ? 'the reckoning →' : 'onward'}</button>
      </div>`);
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
