/* THE HAUNT — sim.js — the deterministic night simulation.
   ZERO DOM. ZERO three.js. Imports nothing. Reads HAUNT.DATA, uses HAUNT.makeRng.
   The view renders this; the harness (test-sim.mjs) interrogates it headless.
   Fixed tick. Seeded. Every balance claim about this game is a number from here. */
(function (g) {
  'use strict';
  const H = g.HAUNT;
  const D = () => H.DATA;

  /* ---------- route math ---------- */
  function buildRoute() {
    const pts = D().ROUTE.map(p => ({ x: p[0], z: p[1] }));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z;
      cum.push(cum[i - 1] + Math.hypot(dx, dz));
    }
    const total = cum[cum.length - 1];
    function pointAt(s) {
      s = Math.max(0, Math.min(total, s));
      let i = 1;
      while (i < cum.length && cum[i] < s) i++;
      if (i >= cum.length) i = cum.length - 1;
      const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t,
        dirX: (pts[i].x - pts[i - 1].x) / Math.max(1e-6, cum[i] - cum[i - 1]),
        dirZ: (pts[i].z - pts[i - 1].z) / Math.max(1e-6, cum[i] - cum[i - 1])
      };
    }
    function sNear(x, z) { // closest route distance for a world point (coarse)
      let best = 0, bd = 1e9;
      for (let s = 0; s <= total; s += 0.5) {
        const p = pointAt(s); const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }
    return { pts, cum, total, pointAt, sNear };
  }

  /* ---------- night ---------- */
  function createNight(cfg) {
    // cfg: { seed, nightIdx, build:{slots:{slotId:{type,tier,broken}}}, crewAt:{nodeId:crewId}, absent:[crewId],
    //        spacingId, ticket, seasonFlags:{ghostArmed}, softScare }
    const data = D();
    const rng = H.makeRng(cfg.seed);
    const route = buildRoute();
    const nightDef = data.SEASON.nights[cfg.nightIdx];
    const spacing = data.SPACING.find(s => s.id === cfg.spacingId) || data.SPACING[1];

    const nodes = data.NODES.map(n => ({
      ...n,
      s: route.sNear(n.routeAt[0], n.routeAt[1]),
      fog: 0
    }));
    const nodeById = {}; nodes.forEach(n => nodeById[n.id] = n);

    // stations resolved: slotId -> {def, tier, node, ready(t), broken}
    const stations = {};
    for (const slot of data.SLOTS) {
      const b = cfg.build.slots[slot.id];
      if (!b || !b.type) continue;
      stations[slot.id] = {
        slot, type: b.type, tier: b.tier || 1, broken: !!b.broken,
        def: data.STATIONS[b.type], node: nodeById[slot.node], readyAt: 0
      };
    }
    const crewAt = { ...cfg.crewAt };
    for (const cid of (cfg.absent || [])) {
      for (const k of Object.keys(crewAt)) if (crewAt[k] === cid) delete crewAt[k];
    }
    const crewState = {};
    data.CREW.forEach(c => crewState[c.id] = { energy: c.energy, fires: 0, def: c });

    const N = {
      t: 0, done: false, rng, route, nodes, nodeById, stations, crewAt, crewState,
      spacing, ticket: cfg.ticket, nightDef, softScare: !!cfg.softScare,
      groups: [], guests: [], nextGuestId: 1, nextGroupId: 1,
      spawned: 0, admitted: 0, exited: 0,
      alarm: { active: false, used: false, until: 0 },
      events: [],            // drained by view/audio each frame
      tally: { flinch: 0, scream: 0, gotem: 0, dropped: 0, melted: 0, walkby: 0, complaints: 0, rescues: 0, chickened: 0, delight: 0, polaroids: 0, bounty: false, ghost: 0, conga: 0, alarms: 0 },
      drawer: 0, comped: 0,
      /* per-ACTOR cooldowns: in co-op two monsters must not share one breath (bible §10).
         keyed by actor id; 'you' is the local/solo performer. */
      bodyReadyAt: {}, comedyReadyAt: {},
      ghostPlanned: null, lastSpawnT: -999,
      bestScare: null,
      /* the performers. Actor kinematics are INPUTS, exactly like triggerStation — same seed
         plus the same input script is the same night. NOTHING in the technique kernel consumes
         rng: a charge is pure skill, so an actor who charges all night and never fires must
         leave the tally byte-identical (test-sim T13 is the guard). */
      actors: {}
    };
    const techByKey = {}; data.TECHNIQUES.forEach(t => techByKey[t.key] = t);
    N.techsAllowed = cfg.techs || data.TECHNIQUES.filter(t => t.unlock <= (cfg.nightIdx || 0)).map(t => t.key);

    // plan the '96 moment (iron rules: slow nights only, once, kind, unexplained)
    if (cfg.seasonFlags && cfg.seasonFlags.ghostArmed &&
        cfg.nightIdx >= data.GHOST.minNight &&
        nightDef.groups <= data.GHOST.maxGroupsForSlowNight &&
        rng.chance(data.GHOST.chancePerSeason)) {
      N.ghostPlanned = { at: rng.range(60, 150), done: false };
    }

    N.emit = (type, payload) => { N.events.push({ type, t: N.t, ...payload }); };

    /* ---- spawning ---- */
    function makeGroup() {
      const size = rng.int(data.GROUP_SIZE[0], data.GROUP_SIZE[1]);
      const gid = N.nextGroupId++;
      const group = { id: gid, guests: [], prime: 0, distractedUntil: 0, congaOf: null, mergedInto: null, spawnT: N.t, scaredAtNode: {} };
      const archKeys = Object.keys(data.ARCHETYPES);
      // archetype composition: weighted, rares checked, kid groups only if softScare or rare
      for (let i = 0; i < size; i++) {
        let key;
        const roll = rng.f();
        if (roll < 0.04 && !N.softScare) key = 'grandma';
        else if (roll < 0.07) key = 'dad';
        else key = rng.pick(['flannel', 'chain', 'chain', 'toocool', 'date', 'date', 'bachelorette', 'toocool']);
        if (N.softScare) key = rng.pick(['kid', 'kid', 'date', 'dad']);
        const arch = data.ARCHETYPES[key];
        const guest = {
          id: N.nextGuestId++, groupId: gid, arch: key,
          pool: arch.pool * rng.range(0.9, 1.1), nerve: 0,
          s: -1.4 * i - rng.range(0, 0.6), lat: rng.range(-0.55, 0.55),
          state: 'walk', reactT: 0, reactKind: null, delightPend: 0,
          distressT: 0, chicken: false, out: false, lowest: 1
        };
        guest.nerve = guest.pool;
        group.guests.push(guest); N.guests.push(guest);
      }
      N.groups.push(group);
      N.spawned++; N.admitted += size;
      N.drawer += size * N.ticket;
      N.emit('spawn', { group: gid, size });
      return group;
    }

    /* ---- scare resolution ---- */
    /* ONE place a scare becomes nerve loss. Stations, the pop, every technique and the
       chainsaw's per-tick drain all pass through here — which is what makes the soft-scare,
       immune, spent and angry clamps impossible to route around by adding a new verb.
       `floor` is the minimum a DISCRETE hit lands (1). A continuous drain passes 0: at 30 Hz
       a floor of 1 would deal 30/s to exactly the guests the clamps exist to protect. */
    function hitGuest(gst, group, pwIn, gradeMult, c, nodeId, floor) {
      {
        const arch = D().ARCHETYPES[gst.arch];
        let pw = pwIn;
        pw *= Math.pow(0.72, gst.hits || 0);            // habituation: the same guest startles less each time
        if (gst.spent) pw = Math.min(pw, 4);            // they already dropped tonight. they're riding the high.
        if (gst.angry) pw = 1;                          // complained. arms crossed. done.
        if (N.softScare || arch.soft) pw = Math.min(pw, gst.nerve - gst.pool * 0.35); // soft mode: never below comfy
        if (arch.immune) pw = Math.min(pw, 2);
        if (pw <= 0) { if (floor === 0) return; pw = 1; }
        const before = gst.nerve / gst.pool;
        gst.nerve = Math.max(gst.nerve - pw, -0.4 * gst.pool);
        c.magnitudeSum += pw;
        const after = gst.nerve / gst.pool;
        gst.lowest = Math.min(gst.lowest, after);
        const R = D().REACT;
        let kind = null;
        if (before > R.dropped && after <= R.dropped) kind = 'dropped';
        else if (before > R.gotem && after <= R.gotem) kind = 'gotem';
        else if (before > R.scream && after <= R.scream) kind = 'scream';
        else if (before > R.flinch && after <= R.flinch) kind = 'flinch';
        else if (pw > 6) kind = 'flinch';
        if (kind) {
          gst.state = 'react'; gst.reactKind = kind;
          gst.reactT = D().POSE.durs[kind] || 0.7;
          gst.delightPend += pw * D().GUEST.delightConvert * arch.delightM;
          if (kind) gst.hits = (gst.hits || 0) + 1;
          if (kind === 'dropped') {
            c.dropped++; N.tally.dropped++; gst.spent = true;
            group.prime = Math.min(100, group.prime + D().GUEST.primeOnDrop);
            if (gradeMult >= 1.35 && gst.nerve < gst.pool * R.dropped - 24 && !arch.soft) { gst.reactKind = 'melt'; gst.reactT = D().POSE.durs.melt; c.melted++; N.tally.melted++; }
          } else if (kind === 'gotem') { c.gotem++; N.tally.gotem++; group.prime = Math.min(100, group.prime + D().GUEST.primeOnScream); }
          else if (kind === 'scream') { c.screams++; N.tally.scream++; group.prime = Math.min(100, group.prime + D().GUEST.primeOnScream); }
          else { c.flinches++; N.tally.flinch++; }
          if (arch.loudBreak && (kind === 'scream' || kind === 'gotem' || kind === 'dropped')) N.emit('loudBreak', { guest: gst.id });
          if (arch.huh && kind === 'flinch') N.emit('huh', { guest: gst.id });
        }
        // distress check: a too-hard single hit on someone already deep. rare by design. never soft, never grandma, never twice.
        if (!N.softScare && !arch.immune && !gst.spent && !gst.angry && pw >= 40 && gst.nerve < D().GUEST.distressAt * gst.pool) {
          gst.state = 'distress'; gst.distressT = D().GUEST.distressGraceS;
          N.emit('distress', { guest: gst.id, node: nodeId });
        }
      }
    }

    /* the group-direct resolution. `applyScare` (node + beat window) is now a thin wrapper on it,
       so a technique fired mid-room and a station fired on the beat resolve through one body. */
    function applyScareToGroup(group, source, powerBase, gradeMult, opts) {
      opts = opts || {};
      const behind = opts.fromBehind !== false; // our nodes are authored to hit from cover
      const distracted = N.t < group.distractedUntil;
      const primeMult = 1 + group.prime / 180;
      const congaMult = group.guests.length > 10 ? D().GUEST.congaResist : 1;
      const nodeId = opts.node ? opts.node.id : nearestNodeId(group);
      const c = { magnitudeSum: 0, dropped: 0, melted: 0, gotem: 0, screams: 0, flinches: 0 };
      for (const gst of group.guests) {
        if (gst.out || gst.state === 'distress' || gst.state === 'chicken') continue;
        const arch = D().ARCHETYPES[gst.arch];
        let pw = powerBase * gradeMult * primeMult * congaMult * (arch.resist);
        pw *= (behind || distracted) ? D().GUEST.behindMult : D().GUEST.frontMult;
        hitGuest(gst, group, pw, gradeMult, c, nodeId, 1);
      }
      // contagion: everyone in a chain group tightens
      group.prime = Math.min(100, group.prime + D().GUEST.primeContagion * (c.screams + c.dropped > 0 ? 1 : 0));
      const result = { node: nodeId, source, dropped: c.dropped, melted: c.melted, gotem: c.gotem, screams: c.screams, flinches: c.flinches, magnitude: c.magnitudeSum, group: group.id, gradeMult };
      if (opts.tech) result.tech = opts.tech;
      N.emit('scare', result);
      if (!N.bestScare || result.magnitude > N.bestScare.magnitude) N.bestScare = { ...result, t: N.t };
      /* flash cam capture. A node fire keeps the EXACT old same-node test; a group-direct fire
         asks the physically-true question instead: is this group in that camera's own window? */
      const flash = Object.values(N.stations).find(st => st.type === 'flashCam' && !st.broken &&
        (opts.node ? st.node.id === opts.node.id : groupInWindow(st.node) === group));
      if (flash && c.dropped > 0 && gradeMult >= 1.1) {
        N.tally.polaroids++;
        N.drawer += D().SEASON.photoSale * c.dropped;
        N.emit('polaroid', { node: nodeId, dropped: c.dropped, group: group.id, size: group.guests.length });
        if (group.guests.length >= 6 && c.dropped >= 1) N.emit('polaroidFull', { group: group.id });
      }
      // the bounty: melt a flannel guy at PERFECT
      if (c.melted > 0 && gradeMult >= 1.4 && !N.tally.bounty && group.guests.some(x => x.arch === 'flannel' && x.reactKind === 'melt')) {
        N.tally.bounty = true; N.drawer -= D().BOUNTY; N.emit('bounty', {});
      }
      return result;
    }
    function applyScare(node, source, powerBase, gradeMult, opts) {
      const group = groupInWindow(node);
      if (!group) { N.emit('scareMiss', { node: node.id, source }); return null; }
      return applyScareToGroup(group, source, powerBase, gradeMult, Object.assign({}, opts || {}, { node }));
    }
    function nearestNodeId(group) {
      const l = leaderS(group); let best = nodes[0];
      if (l === null) return best.id;
      for (const nd of nodes) if (Math.abs(l - nd.s) < Math.abs(l - best.s)) best = nd;
      return best.id;
    }

    function groupInWindow(node, mult) {
      const w = node.window * (mult || 1);
      let best = null, bd = 1e9;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        const lead = leaderS(grp);
        if (lead === null) continue;
        const d = Math.abs(lead - node.s);
        if (d < w && d < bd) { bd = d; best = grp; }
      }
      return best;
    }
    function leaderS(grp) {
      let m = null;
      for (const gst of grp.guests) if (!gst.out && !gst.chicken) m = m === null ? gst.s : Math.max(m, gst.s);
      return m;
    }
    function gradeFor(node, wmult) {
      const grp = groupInWindow(node, wmult);
      if (!grp) return { mult: 0, label: 'MISS', id: 'miss' };
      const toff = (leaderS(grp) - node.s) / D().GUEST.speed; // negative = early
      const adt = Math.abs(toff);
      const G = D().GRADES;
      if (adt <= G[0].within) return { mult: G[0].mult, label: G[0].label, id: 'perfect' };
      if (adt <= G[1].within) return { mult: G[1].mult, label: G[1].label, id: 'good' };
      if (toff < 0 && adt <= G[2].within) return { mult: G[2].mult, label: G[2].label, id: 'early' };
      return { mult: G[3].mult, label: G[3].label, id: 'late' };
    }

    /* ---- public triggers (player + crew call these) ---- */
    N.triggerStation = function (slotId, byCrew, who) {
      const st = N.stations[slotId];
      if (!st || st.broken || N.alarm.active) return { ok: false };
      if (N.t < st.readyAt) return { ok: false, cooldown: true };
      st.readyAt = N.t + st.def.resetS;
      const grade = gradeFor(st.node);
      if (st.type === 'fogBurst') {
        st.node.fog = Math.min(4, st.node.fog + st.tier);
        if (st.node.detector && st.tier > D().ALARM.fogThreshold && rng.chance(D().ALARM.chance)) startAlarm();
      }
      if (grade.mult === 0) { N.tally.walkby++; N.emit('walkby', { slot: slotId, node: st.node.id }); N.groupPrimeLoss(st.node); return { ok: true, grade }; }
      const power = st.def.power * D().TIER_MULT[st.tier - 1];
      const src = byCrew ? 'crew' : (who && who !== 'you' ? 'hand:' + who : 'you');
      const res = applyScare(st.node, src, power, grade.mult, {});
      N.emit('grade', { label: grade.label, id: grade.id, slot: slotId, byCrew: byCrew || null, who: who || 'you' });
      return { ok: true, grade, res };
    };
    N.groupPrimeLoss = function (node) {
      const grp = nearestGroup(node); if (grp) grp.prime = Math.max(0, grp.prime - D().MISS_PRIME_LOSS);
    };
    function nearestGroup(node) {
      let best = null, bd = 1e9;
      for (const grp of N.groups) { if (grp.mergedInto) continue; const l = leaderS(grp); if (l === null) continue; const d = Math.abs(l - node.s); if (d < bd) { bd = d; best = grp; } }
      return best;
    }
    /* cooldowns are per actor AND per technique: firing the stalk as s0 gates neither s1's
       stalk nor s0's creep. The wire field name (`bd`) is unchanged — only the keys got richer. */
    const ready = (who, key) => N.bodyReadyAt[who + ':' + key] || 0;
    const setReady = (who, key, t) => { N.bodyReadyAt[who + ':' + key] = t; };
    N.triggerBody = function (peekId, who) {
      who = who || 'you';
      if (N.t < ready(who, 'pop') || N.alarm.active) return { ok: false };
      const peek = D().DOORS.peek.find(p => p.id === peekId);
      if (!peek) return { ok: false };
      setReady(who, 'pop', N.t + techByKey.pop.cooldown);
      const node = nodeById[peek.node];
      const grade = gradeFor(node);
      if (grade.mult === 0) { N.tally.walkby++; N.emit('walkby', { node: node.id, body: true, who }); return { ok: true, grade }; }
      const res = applyScare(node, who === 'you' ? 'you-body' : 'body:' + who, techByKey.pop.power, grade.mult, { fromBehind: true });
      N.emit('grade', { label: grade.label, id: grade.id, body: true, who });
      return { ok: true, grade, res };
    };
    /* ---------------- the trade: the six verbs (bible §6.2) ----------------
       pop = the beat (triggerBody, unchanged) · stalk/creep/scarecrow = patience (charge)
       chainsaw = steering (a held drain) · slider = movement (a real sprint runway). */

    N.setActor = function (who, sIn) {
      const a = N.actors[who] || (N.actors[who] = {
        x: +sIn.x || 0, z: +sIn.z || 0, wx: +sIn.x || 0, wz: +sIn.z || 0,
        speed: 0, inRoom: false, pitch: 0,
        tech: N.techsAllowed[0] || 'pop', charge: 0, sprintT: 0, sprintStopT: -99,
        hold: null, holdCounts: null, holdHighSaid: false
      });
      /* ⚠️ this records the WANTED position, never the accepted one. actorTick rate-limits it
         to TECH.posSpeedMax on the SIM clock and derives speed from the accepted step. Two
         reasons, both load-bearing: the host must not trust a position off the wire (a seat
         could otherwise pose itself inside a group from anywhere), and host and guests have to
         measure one speed on ONE clock — deriving it from render dt on one side and snapshot
         arrival on the other makes the same run pass a gate for one seat and fail for another. */
      a.wx = +sIn.x || 0; a.wz = +sIn.z || 0;
      a.inRoom = !!sIn.inRoom; a.pitch = +sIn.pitch || 0;
    };
    N.setTechnique = function (who, key) {
      const a = N.actors[who]; if (!a) return { ok: false };
      if (!techByKey[key] || !N.techsAllowed.includes(key)) return { ok: false, locked: !!techByKey[key] };
      if (a.tech === key) return { ok: true };
      if (a.hold) endHold(who, a);          // switching away kills a live hold
      a.tech = key; a.charge = 0;           // and throws the charge. selection is a commitment.
      return { ok: true, key };
    };
    N.dropActor = function (who) {          // a co-op seat leaves: never leave a ghost saw running
      const a = N.actors[who]; if (!a) return;
      if (a.hold) endHold(who, a);
      delete N.actors[who];
    };

    function targetGroup(a, rangeM) {       // nearest group, by its nearest live guest
      let best = null;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        let d = 1e9;
        for (const gst of grp.guests) {
          if (gst.out || gst.chicken) continue;
          const p = N.guestPos(gst);
          const dd = Math.hypot(p.x - a.x, p.z - a.z);
          if (dd < d) d = dd;
        }
        if (d <= rangeM && (!best || d < best.d)) best = { grp, d };
      }
      return best;
    }

    function actorTick() {
      const T = D(), B = T.BARN, cap = T.TECH.posSpeedMax * DT;
      for (const who of Object.keys(N.actors)) {
        const a = N.actors[who];
        let tx = Math.max(B.x0, Math.min(B.x1, a.wx)), tz = Math.max(B.z0, Math.min(B.z1, a.wz));
        const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
        if (d > cap) { tx = a.x + dx / d * cap; tz = a.z + dz / d * cap; }
        a.speed = Math.hypot(tx - a.x, tz - a.z) / DT;
        a.x = tx; a.z = tz;
        /* the runway. Derived from the accepted step, never from a 'sprinting' flag a client
           could simply assert — the slider has to be EARNED by moving. */
        if (a.speed >= T.TECH.sprintMin) a.sprintT += DT;
        else { if (a.sprintT > 0) a.sprintStopT = N.t; a.sprintT = 0; }
        /* ONE definition of "do I have a runway", derived here so the fire gate, the prompt and
           a co-op guest reading it off the wire can never disagree about the same instant. */
        const sl = techByKey.slider;
        a.sprintReady = !!(sl && (a.sprintT >= sl.sprintNeedS || (a.sprintStopT >= 0 && N.t - a.sprintStopT <= sl.sprintGraceS)));
        const tech = techByKey[a.tech];
        if (tech && tech.kind === 'charge') {
          let on = false;
          if (!N.alarm.active) {                          // fluorescent light breaks every spell
            const tgt = targetGroup(a, tech.behindM || tech.nearM);
            if (tgt) {
              if (a.tech === 'stalk') {
                const actorS = route.sNear(a.x, a.z);
                const tail = tailS(tgt.grp);
                /* ⚠️ tailTolM must stay clear of sNear's 0.5 m sampling lattice, or this gate
                   chatters on and off as you walk and chops the charge unpredictably. */
                on = tail !== null && actorS <= tail + T.TECH.tailTolM
                  && Math.abs(a.speed - T.GUEST.speed) <= tech.paceTol
                  && a.speed > T.TECH_STILL;
              } else if (a.tech === 'creep') {
                on = a.speed > T.TECH_STILL && a.speed <= tech.speedMax;   // slow MOTION. stillness is the scarecrow's job.
              } else if (a.tech === 'scarecrow') {
                on = a.inRoom && a.speed <= T.TECH_STILL;                  // dead still, IN the room with them
              }
            }
          }
          a.charge = on ? Math.min(tech.chargeMax, a.charge + tech.chargeRate * DT)
                        : Math.max(0, a.charge - tech.decay * DT);
        }
        if (a.hold) chainsawTick(who, a);
      }
    }

    function chargeBand(frac) { const B = D().TECH_BANDS; for (const b of B) if (frac >= b.at) return b; return B[B.length - 1]; }

    N.triggerTech = function (who) {
      who = who || 'you';
      const a = N.actors[who]; if (!a || N.alarm.active) return { ok: false };
      const tech = techByKey[a.tech];
      if (!tech || tech.key === 'pop' || tech.kind === 'hold') return { ok: false };   // pop = triggerBody; the saw is a hold pair
      if (N.t < ready(who, tech.key)) return { ok: false, cooldown: true };
      if (tech.needSprint && !a.sprintReady) return { ok: false, needSprint: true };   // a refusal burns NOTHING
      setReady(who, tech.key, N.t + tech.cooldown);            // armed and thrown — from here it burns
      const tgt = targetGroup(a, tech.behindM || tech.nearM);
      if (!tgt) {                                              // fired into an empty hallway: the punchline
        N.tally.walkby++; a.charge = 0;
        N.emit('walkby', { body: true, who, tech: tech.key });
        return { ok: true, grade: { mult: 0, label: 'MISS', id: 'miss' } };
      }
      let grade, power;
      if (tech.kind === 'charge') {
        grade = chargeBand(a.charge / tech.chargeMax);          // the band comes from charge %…
        power = tech.power * (1 + a.charge);                    // …and the power scales 1x..(1+chargeMax)x
      } else {
        const G = D().GRADES;                                   // slider: the grade IS the runway length
        grade = a.sprintT >= tech.sprintPerfectS ? G[0] : G[1];
        power = tech.power;
      }
      /* every technique resolves fromBehind. The charge, the beat or the runway IS the skill
         test — double-taxing the creep (which walks into the light on purpose) with the front
         cone would punish the fiction. */
      const res = applyScareToGroup(tgt.grp, who === 'you' ? 'you-body' : 'body:' + who,
        power, grade.mult, { fromBehind: true, tech: tech.key });
      a.charge = 0;
      N.emit('grade', { label: grade.label, id: grade.id, body: true, who, tech: tech.key });
      return { ok: true, grade, res };
    };

    N.holdStart = function (who) {
      who = who || 'you';
      const a = N.actors[who]; if (!a || N.alarm.active) return { ok: false };
      const tech = techByKey[a.tech];
      if (!tech || tech.kind !== 'hold') return { ok: false };
      if (a.hold) return { ok: true };
      if (N.t < ready(who, tech.key)) return { ok: false, cooldown: true };
      a.hold = { until: N.t + tech.maxHoldS, startT: N.t };
      a.holdHighSaid = false;
      a.holdCounts = { magnitudeSum: 0, dropped: 0, melted: 0, gotem: 0, screams: 0, flinches: 0 };
      if (D().TECH.revSpike && a.pitch <= tech.lowPitch) {      // the rev jump — only if it is aimed low
        const tgt = targetGroup(a, tech.nearM);
        if (tgt) for (const gst of tgt.grp.guests) {
          if (gst.out || gst.chicken || gst.state === 'distress') continue;
          const p = N.guestPos(gst);
          if (Math.hypot(p.x - a.x, p.z - a.z) > tech.nearM) continue;
          hitGuest(gst, tgt.grp, tech.power * D().ARCHETYPES[gst.arch].resist * D().GUEST.behindMult,
            1.0, a.holdCounts, nearestNodeId(tgt.grp), 1);
        }
      }
      return { ok: true };
    };
    N.holdEnd = function (who) { who = who || 'you'; const a = N.actors[who]; if (a && a.hold) endHold(who, a); return { ok: true }; };

    function chainsawTick(who, a) {
      const tech = techByKey.chainsaw;
      if (N.alarm.active || N.t >= a.hold.until) return endHold(who, a);
      if (a.pitch > tech.lowPitch) {                            // held HIGH: it fails, and everyone knows it
        if (!a.holdHighSaid) {
          a.holdHighSaid = true;
          N.emit('chainsawHigh', { who });
          const t2 = targetGroup(a, tech.nearM);
          if (t2) t2.grp.prime = Math.max(0, t2.grp.prime - D().CHAINSAW_HIGH_PRIME_LOSS);
        }
        return;                                                 // no drain — but the clock keeps running
      }
      a.holdHighSaid = false;
      const tgt = targetGroup(a, tech.nearM);
      if (!tgt) return;
      const primeMult = 1 + tgt.grp.prime / 180;
      const nodeId = nearestNodeId(tgt.grp);
      for (const gst of tgt.grp.guests) {
        if (gst.out || gst.chicken || gst.state === 'distress') continue;
        const p = N.guestPos(gst);
        if (Math.hypot(p.x - a.x, p.z - a.z) > tech.nearM) continue;
        const arch = D().ARCHETYPES[gst.arch];
        hitGuest(gst, tgt.grp, tech.drainPerS * DT * arch.resist * primeMult * D().GUEST.behindMult,
          1.0, a.holdCounts, nodeId, 0);
        /* THE HERD. This is the point of the saw, and the emergence is deliberate: overusing it
           closes the gap to the group ahead, i.e. the chainsaw MANUFACTURES conga lines. */
        if (gst.state === 'walk') gst.s += tech.pushPerS * DT;
      }
    }
    function endHold(who, a) {
      const tech = techByKey.chainsaw;
      setReady(who, tech.key, N.t + tech.cooldown);
      const c = a.holdCounts;
      if (c && c.magnitudeSum > 0.5) {
        const tgt = targetGroup(a, tech.nearM + 4);
        const grp = tgt ? tgt.grp : null;
        /* ONE aggregate event, so the tape, bestScare and the walkie see one chainsaw RUN
           rather than 135 ticks. ⚠️ `atT` is the run's START: R.mark centres a take on the
           stamped time, and stamping the END would centre the tape on the aftermath.
           ⚠️ magnitude is an INTEGRAL over seconds — divided before it competes with
           instantaneous pops, or one saw run wins best-scare every single night. */
        const result = { node: grp ? nearestNodeId(grp) : nodes[0].id,
          source: who === 'you' ? 'you-body' : 'body:' + who,
          dropped: c.dropped, melted: c.melted, gotem: c.gotem, screams: c.screams, flinches: c.flinches,
          magnitude: c.magnitudeSum / D().TECH.holdMagDiv, group: grp ? grp.id : 0,
          gradeMult: 1.0, tech: 'chainsaw', atT: a.hold ? a.hold.startT : N.t };
        N.emit('scare', result);
        if (!N.bestScare || result.magnitude > N.bestScare.magnitude) N.bestScare = { ...result, t: result.atT };
      }
      a.hold = null; a.holdCounts = null;
    }

    N.triggerComedy = function (who) {
      who = who || 'you';
      if (N.t < (N.comedyReadyAt[who] || 0)) return { ok: false };
      N.comedyReadyAt[who] = N.t + D().COMEDY_RESET.cooldown;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        grp.prime = Math.max(0, grp.prime - D().COMEDY_RESET.primeCost);
        for (const gst of grp.guests) {
          if (gst.state === 'distress') { rescueGuest(gst, 'comedy'); }
          gst.nerve = Math.min(gst.pool, gst.nerve + D().COMEDY_RESET.nerveHeal);
        }
      }
      N.emit('comedy', {});
      return { ok: true };
    };
    N.rescue = function (guestId) {
      const gst = N.guests.find(x => x.id === guestId);
      if (!gst || gst.state !== 'distress') return { ok: false };
      rescueGuest(gst, 'you');
      return { ok: true };
    };
    function rescueGuest(gst, by) {
      gst.state = 'chicken'; gst.chicken = true;
      N.tally.rescues++; N.emit('rescue', { guest: gst.id, by });
    }
    function startAlarm() {
      if (N.alarm.used) return;
      N.alarm.active = true; N.alarm.used = true; N.alarm.until = N.t + D().ALARM.lightsUpS;
      N.tally.alarms++; N.comped = N.drawer * D().SEASON.compOnAlarm;
      N.emit('alarm', {});
    }

    /* ---- crew auto behavior ---- */
    function crewTick() {
      for (const [nodeId, crewId] of Object.entries(crewAt)) {
        const cs = crewState[crewId]; if (!cs) continue;
        const cdef = cs.def; const node = nodeById[nodeId];
        if (!node) continue;
        if (cdef.distract) { // priya: locks attention when a group hits her window
          const grp = groupInWindow(node);
          if (grp && N.t >= (cs.nextAt || 0)) { grp.distractedUntil = N.t + 2.8; cs.nextAt = N.t + 6; N.emit('distract', { node: nodeId }); }
          continue;
        }
        if (cdef.style === 'stalker') { // dee: passive drain in her room
          const grp = groupInWindow(node);
          if (grp) for (const gst of grp.guests) { if (!gst.out && gst.state === 'walk') gst.nerve -= 1.5 * DT; }
          continue;
        }
        if (cdef.comfort) { // bo: rescues distress at his node
          for (const gst of N.guests) {
            if (gst.state === 'distress' && Math.abs(gst.s - node.s) < 8) { rescueGuest(gst, 'bo'); }
          }
        }
        // firing crew (marcus/tater/grace/bo): body-scare their node when window is hot
        const grp = groupInWindow(node);
        if (grp && N.t >= (cs.nextAt || 0)) {
          const tired = cs.energy < D().CREW_TIRED_AT;
          const odds = tired ? D().CREW_GRADES.tired : D().CREW_GRADES.fresh;
          const r = rng.f(); let gi = 0, acc = 0;
          for (let i = 0; i < 4; i++) { acc += odds[i]; if (r <= acc) { gi = i; break; } gi = i; }
          const gmult = [1.5, 1.15, 0.55, 0.3][gi];
          let power = cdef.power;
          if (cdef.comfort) power = Math.min(power, 16); // bo never breaks anyone
      const res = applyScare(node, 'crew:' + crewId, power, gmult, { fromBehind: true });
          if (res && cdef.style === 'slider' && rng.chance(cdef.skill * 0.5)) { applyScare(node, 'crew:' + crewId, power * 0.5, 1.0, { fromBehind: true }); }
          cs.energy = Math.max(0, cs.energy - D().CREW_ENERGY_PER_SCARE);
          cs.fires++;
          cs.nextAt = N.t + 7.5;
          N.emit('crewScare', { crew: crewId, node: nodeId, grade: gi });
        }
      }
    }

    /* ---- the tick ---- */
    const DT = 1 / 30;
    let acc = 0;
    N.tick = function (dt) {
      if (N.done) return;
      acc += Math.min(dt, 0.25);
      while (acc >= DT) { step(); acc -= DT; }
    };
    function step() {
      N.t += DT;
      const data = D();
      // alarm expiry
      if (N.alarm.active && N.t >= N.alarm.until) { N.alarm.active = false; N.emit('alarmOver', {}); }
      // spawn pulses
      if (N.spawned < nightDef.groups && N.t > data.NIGHT.leadInS && N.t - N.lastSpawnT >= spacing.s) {
        N.lastSpawnT = N.t; makeGroup();
      }
      // ghost
      if (N.ghostPlanned && !N.ghostPlanned.done && N.t >= N.ghostPlanned.at) {
        const unstaffed = nodes.filter(n => !crewAt[n.id] && !Object.values(N.stations).some(st => st.node.id === n.id && !st.broken));
        for (const node of unstaffed) {
          if (groupInWindow(node)) {
            N.ghostPlanned.done = true;
            const res = applyScare(node, 'nobody', 26, 1.5, { fromBehind: true });
            if (res) { N.tally.ghost = 1; N.emit('ghost', { node: node.id }); }
            break;
          }
        }
        if (N.t > N.ghostPlanned.at + 240) N.ghostPlanned.done = true; // she keeps her own hours
      }
      crewTick();
      actorTick();
      // guests
      for (const gst of N.guests) {
        if (gst.out) continue;
        const grp = N.groups.find(gr => gr.id === gst.groupId);
        const real = grp.mergedInto ? N.groups.find(gr => gr.id === grp.mergedInto) : grp;
        if (gst.state === 'react') {
          gst.reactT -= DT;
          if (gst.reactKind === 'dropped' || gst.reactKind === 'melt') { /* on the floor */ }
          else gst.s += D().GUEST.speedScared * DT * 0.6; // flee forward
          if (gst.reactT <= 0) {
            if (gst.delightPend > 0 && gst.state !== 'distress') { N.tally.delight += gst.delightPend; gst.delightPend = 0; }
            gst.state = gst.reactKind === 'melt' ? 'crawl' : 'walk';
            gst.reactKind = null;
          }
        } else if (gst.state === 'distress') {
          gst.distressT -= DT;
          if (gst.distressT <= 0) { gst.state = 'walk'; N.tally.complaints++; gst.angry = true; N.emit('complaint', { guest: gst.id }); }
        } else if (gst.state === 'chicken') {
          gst.s += D().GUEST.speedScared * DT; // hustled to the quiet door (abstracted forward)
          if (gst.s >= route.total - 1) exitGuest(gst);
        } else { // walk / crawl
          const spd = (gst.state === 'crawl' ? 0.55 : D().GUEST.speed) * (N.alarm.active ? 2.0 : 1) * (real.guests.length > 10 ? 0.85 : 1);
          // follow spacing inside group
          const ahead = real.guests.filter(x => !x.out && x.s > gst.s + 0.01);
          const gap = ahead.length ? Math.min(...ahead.map(x => x.s)) - gst.s : 99;
          gst.s += (gap < 0.8 ? spd * 0.4 : spd) * DT;
          if (gst.state === 'crawl' && gst.reactT !== undefined) { /* crawl persists to exit */ }
          if (gst.s >= route.total - 1) exitGuest(gst);
          gst.nerve = Math.min(gst.pool, gst.nerve + D().GUEST.nerveRegen * DT);
        }
      }
      // group prime decay + conga detection
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        grp.prime = Math.max(0, grp.prime - D().GUEST.primeDecay * DT);
        // conga: our tail vs the group ahead's tail
        for (const other of N.groups) {
          if (other === grp || other.mergedInto || grp.mergedInto) continue;
          const lead = leaderS(grp), otherTail = tailS(other);
          if (lead === null || otherTail === null) continue;
          if (otherTail > lead && otherTail - lead < D().GUEST.congaGapM) {
            grp.congaTimer = (grp.congaTimer || 0) + DT;
            if (grp.congaTimer > D().GUEST.congaAfterS) {
              // merge grp into other
              grp.mergedInto = other.id;
              for (const gst of grp.guests) { gst.groupId = other.id; other.guests.push(gst); }
              grp.guests = [];
              N.tally.conga++; N.emit('conga', { into: other.id });
            }
          } else grp.congaTimer = 0;
        }
      }
      // fog decay
      for (const n of nodes) n.fog = Math.max(0, n.fog - 0.06 * DT);
      // night end
      if (N.spawned >= nightDef.groups && N.guests.every(gst => gst.out)) {
        finish();
      }
      if (N.t > 60 * 18) finish(); // hard safety
    }
    function tailS(grp) {
      let m = null;
      for (const gst of grp.guests) if (!gst.out && !gst.chicken) m = m === null ? gst.s : Math.min(m, gst.s);
      return m;
    }
    function exitGuest(gst) {
      gst.out = true; N.exited++;
      if (gst.chicken) N.tally.chickened++;
      if (gst.delightPend > 0) { N.tally.delight += gst.delightPend; gst.delightPend = 0; }
    }
    function finish() {
      if (N.done) return;
      N.done = true;
      const data = D();
      N.drawer = Math.max(0, Math.round(N.drawer - N.comped - data.SEASON.makeupPerNight));
      const rep = {
        scary: N.tally.dropped * data.REP.scaryPerDrop + N.tally.gotem * data.REP.scaryPerGotem + N.tally.walkby * data.REP.scaryPerWalkby,
        fun: N.tally.delight * data.REP.funPerDelight + N.tally.complaints * data.REP.funPerComplaint + N.tally.rescues * data.REP.funPerRescue + (N.tally.bounty ? data.REP.funPerBounty : 0)
      };
      N.result = { tally: { ...N.tally }, drawer: N.drawer, comped: Math.round(N.comped), admitted: N.admitted, rep, bestScare: N.bestScare, night: cfg.nightIdx };
      N.emit('nightOver', { result: N.result });
    }

    /* view helpers */
    N.guestPos = function (gst) {
      const p = route.pointAt(gst.s);
      return { x: p.x - p.dirZ * gst.lat, z: p.z + p.dirX * gst.lat, dirX: p.dirX, dirZ: p.dirZ };
    };
    N.clock = function () {
      const m = D().NIGHT.clockStart + N.t * D().NIGHT.clockPerRealS;
      const h24 = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
      const h12 = ((h24 + 11) % 12) + 1;
      return `${h12}:${String(mm).padStart(2, '0')} ${h24 >= 12 ? 'pm' : 'am'}`;
    };
    return N;
  }

  H.Sim = { createNight, buildRoute };
})(typeof globalThis !== 'undefined' ? globalThis : window);
