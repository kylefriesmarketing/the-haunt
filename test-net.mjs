/* THE HAUNT — test-net.mjs — co-op, headless. `node test-net.mjs`
   Drives the REAL net.js over in-memory wires (send() round-trips through JSON, exactly like
   the real transport) against a REAL night. Host-authoritative means there is only ever one
   sim, so what this proves is: guest intents land, snapshots reproduce the host's room, and
   nothing a guest does can corrupt or stall the barn. */
import './parts/rng.js';
import './parts/data.js';
import './parts/sim.js';
import './parts/replay.js';
import './parts/net.js';

const H = globalThis.HAUNT;
const D = H.DATA;
let pass = 0, fail = 0;
const ok = (c, label, detail) => {
  if (c) { pass++; console.log('  ✔ ' + label + (detail ? `  (${detail})` : '')); }
  else { fail++; console.log('  ✘ FAIL ' + label + (detail ? `  (${detail})` : '')); }
};

function build() {
  return { slots: {
    s_corn_a: { type: 'dropPanel', tier: 1 }, s_din_a: { type: 'soundSting', tier: 1 },
    s_sur_a: { type: 'dropPanel', tier: 1 }, s_clown_a: { type: 'airCannon', tier: 1 },
    s_cel_a: { type: 'dropPanel', tier: 1 }, s_last_a: { type: 'lightSnap', tier: 1 }
  } };
}
function mkNight(over = {}) {
  return H.Sim.createNight(Object.assign({
    seed: 1234, nightIdx: 5, build: build(), crewAt: {}, absent: [],
    spacingId: 'standard', ticket: 18, seasonFlags: { ghostArmed: false }, softScare: false
  }, over));
}
function leaderS(grp) {
  let m = null;
  for (const g of grp.guests) if (!g.out && !g.chicken) m = m === null ? g.s : Math.max(m, g.s);
  return m;
}
function nodeDeltas(N) {
  const out = {};
  for (const n of N.nodes) {
    let best = null;
    for (const grp of N.groups) {
      if (grp.mergedInto) continue;
      const lead = leaderS(grp);
      if (lead === null) continue;
      const d = n.s - lead;
      if (best === null || Math.abs(d) < Math.abs(best)) best = Math.round(d * 100) / 100;
    }
    out[n.id] = best;
  }
  return out;
}

/* stand up a host + N guests over fake wires, no peerjs anywhere */
function room(nGuests, onCmd) {
  H.Net.test.reset();
  const cmds = [];
  H.Net.test.hostLocal('the boss', (type, msg) => {
    if (type === 'cmd') { cmds.push(msg); if (onCmd) onCmd(msg); }
    if (type === 'pos') (room.pos = room.pos || {})[msg.seat] = msg;
  });
  const guests = [];
  for (let i = 0; i < nGuests; i++) {
    const [hostEnd, guestEnd] = H.Net.test.pair('g' + i);
    H.Net.test.acceptGuest(hostEnd);
    guests.push(H.Net.test.guestLocal(guestEnd, 'monster' + (i + 1)));
  }
  return { guests, cmds };
}

console.log('\nTHE HAUNT — co-op\n=================');

console.log('\n[1] the room fills up');
{
  const { guests } = room(3);
  ok(guests.every(g => g.seat !== null), 'every guest got a seat', guests.map(g => g.seat).join(','));
  ok(new Set(guests.map(g => g.seat)).size === 3, 'seats are unique');
  ok(guests[0].seat === 1 && guests[2].seat === 3, 'the host keeps seat 0', 'seats 1..3');
  ok(H.Net.roster.length === 4, 'the roster reaches everyone', H.Net.roster.map(r => r.name).join(' · '));
  ok(guests[2].roster.length === 4, 'a late joiner sees the whole crew');
  // a fifth monster is one too many for the fire code
  const [he, ge] = H.Net.test.pair('g4');
  H.Net.test.acceptGuest(he);
  let refused = false;
  ge.on('data', m => { if (m.t === 'full') refused = true; });
  ge.send({ t: 'hello', name: 'one too many' });
  ok(refused, 'the fifth is turned away', 'max ' + D.NET.maxSeats);
}

console.log('\n[2] a guest\'s hands reach the host\'s barn');
{
  const N = mkNight();
  const { guests, cmds } = room(2, msg => {
    const who = H.Net.actorOf(msg.seat);
    if (msg.c.k === 'station' && N.stations[msg.c.id]) N.triggerStation(msg.c.id, false, who);
    else if (msg.c.k === 'body') N.triggerBody(msg.c.id, who);
    else if (msg.c.k === 'comedy') N.triggerComedy(who);
  });
  // run to where a group is sitting on the corn node, then let seat 1 pull the lever
  let guard = 0, fired = false;
  while (!N.done && guard++ < 60 * 30 * 20 && !fired) {
    N.tick(1 / 30); N.events.length = 0;
    for (const grp of N.groups) {
      if (grp.mergedInto) continue;
      const l = leaderS(grp);
      if (l !== null && Math.abs(l - N.nodeById.n_corn.s) < 0.4) { guests[0].cmd({ k: 'station', id: 's_corn_a' }); fired = true; break; }
    }
  }
  ok(cmds.length === 1 && cmds[0].seat === 1, 'the command arrived, stamped with its seat');
  ok(N.tally.flinch + N.tally.scream + N.tally.gotem + N.tally.dropped > 0, 'and it actually scared somebody',
    `flinch ${N.tally.flinch} scream ${N.tally.scream} gotem ${N.tally.gotem}`);
  const src = N.bestScare && N.bestScare.source;
  ok(src === 'hand:s1', 'the barn knows whose hand it was', src);
}

console.log('\n[3] two monsters, two breaths');
{
  const N = mkNight();
  // the pop cooldown is PER ACTOR — one guest popping must not gag another
  while (N.t < 30) { N.tick(1 / 30); N.events.length = 0; }
  const a = N.triggerBody('p_corn', 's1');
  const b = N.triggerBody('p_corn', 's2');
  const again = N.triggerBody('p_corn', 's1');
  ok(a.ok === true, 'seat 1 pops');
  ok(b.ok === true, 'seat 2 pops in the same breath');
  ok(again.ok === false, 'but seat 1 has to catch their breath');
  const c1 = N.triggerComedy('s1'), c2 = N.triggerComedy('s2'), c3 = N.triggerComedy('s1');
  ok(c1.ok && c2.ok && !c3.ok, 'the comedy beat is per-monster too');
}

console.log('\n[4] the snapshot rebuilds the host\'s room');
{
  const N = mkNight();
  let guard = 0;
  while (!N.done && guard++ < 900) { N.tick(1 / 30); N.events.length = 0; }
  const live = N.guests.filter(g => !g.out);
  const snap = H.Net.snapshot(N, nodeDeltas(N), [{ id: 's0', name: 'the boss', x: 4, z: 14, yaw: 0 }]);
  const wire = JSON.parse(JSON.stringify(snap));            // through the wire, verbatim
  const rebuilt = H.Net.readGuests(wire);
  ok(rebuilt.length === live.length, 'every guest in the room is on the wire', `${rebuilt.length} of ${live.length}`);
  let worst = 0, archOk = true;
  for (const g of live) {
    const r = rebuilt.find(x => x.id === g.id);
    if (!r) { archOk = false; continue; }
    if (r.arch !== g.arch) archOk = false;
    const p = N.guestPos(g);
    worst = Math.max(worst, Math.abs(p.x - r.x), Math.abs(p.z - r.z));
  }
  ok(archOk, 'archetypes survive the trip (a flannel guy is still a flannel guy)');
  ok(worst <= 0.005, 'positions land within the wire\'s rounding', `worst ${worst.toFixed(4)}m`);
  const poses = rebuilt.filter(r => r.face !== 'calm').length;
  ok(rebuilt.every(r => isFinite(r.x) && isFinite(r.ry) && r.face), 'no holes in a rebuilt frame', `${poses} mid-reaction`);
  ok(JSON.stringify(wire.tal) === JSON.stringify(N.tally), 'the chalkboard travels');
  ok(Object.keys(wire.st).length === Object.keys(N.stations).length, 'so do the station cooldowns');
  const nd = wire.nd;
  ok(Object.keys(nd).length === D.NODES.length, 'and the beat every client reads off', `${Object.keys(nd).length} nodes`);
}

console.log('\n[5] the barn does not care who is watching');
{
  // a night run with a full room broadcasting must be IDENTICAL to one run alone
  const solo = mkNight();
  let guard = 0;
  while (!solo.done && guard++ < 60 * 30 * 20) { perfect(solo); solo.tick(1 / 30); solo.events.length = 0; }

  const N = mkNight();
  const { guests } = room(3);
  guard = 0;
  let snaps = 0;
  while (!N.done && guard++ < 60 * 30 * 20) {
    perfect(N);
    N.tick(1 / 30);
    if (guard % 2 === 0) { H.Net.broadcast(H.Net.snapshot(N, nodeDeltas(N), [])); snaps++; }
    if (N.events.length) H.Net.broadcast({ t: 'ev', evs: N.events.slice() });
    N.events.length = 0;
    guests.forEach(g => g.pos(4, 14, 0));
  }
  ok(JSON.stringify(solo.result.tally) === JSON.stringify(N.result.tally) && solo.result.drawer === N.result.drawer,
    'a watched night is the same night', `drawer $${N.result.drawer}, ${snaps} snapshots sent`);
  ok(guests.every(g => g.snaps === snaps), 'every guest got every snapshot', `${guests[0].snaps} each`);
  ok(guests.every(g => g.events.length > 0), 'and the feel events too', `${guests[0].events.length} events`);
}
function perfect(N) {
  for (const slotId of Object.keys(N.stations)) {
    const st = N.stations[slotId];
    if (st.type === 'flashCam' || st.type === 'fogBurst') continue;
    for (const grp of N.groups) {
      if (grp.mergedInto) continue;
      const l = leaderS(grp);
      if (l !== null && Math.abs(l - st.node.s) < 0.5) { N.triggerStation(slotId); break; }
    }
  }
}

console.log('\n[6] nothing off the wire is trusted');
{
  const N = mkNight();
  while (N.t < 20) { N.tick(1 / 30); N.events.length = 0; }
  const before = JSON.stringify(N.tally);
  // the host's own guard, mirrored from game.js hostApplyCmd
  const apply = c => {
    if (c.k === 'station') { if (!N.stations[c.id]) return 'rejected'; N.triggerStation(c.id, false, 's1'); return 'ok'; }
    if (c.k === 'body') { if (!D.DOORS.peek.some(p => p.id === c.id)) return 'rejected'; N.triggerBody(c.id, 's1'); return 'ok'; }
    return 'rejected';
  };
  ok(apply({ k: 'station', id: 's_nope' }) === 'rejected', 'a station that does not exist is refused');
  ok(apply({ k: 'body', id: '../../etc' }) === 'rejected', 'a junk peek id is refused');
  ok(apply({ k: 'burn_it_down' }) === 'rejected', 'an invented verb is refused');
  ok(JSON.stringify(N.tally) === before, 'and none of it moved the chalkboard');
}

console.log('\n[7] a monster can always walk out');
{
  const N = mkNight();
  const { guests } = room(3);
  guests[1].conn.close();                                    // seat 2 drops mid-night
  let guard = 0;
  while (!N.done && guard++ < 60 * 30 * 20) {
    perfect(N); N.tick(1 / 30);
    if (guard % 4 === 0) H.Net.broadcast(H.Net.snapshot(N, nodeDeltas(N), []));
    N.events.length = 0;
  }
  ok(!!N.result, 'the night finishes anyway', `t=${N.t.toFixed(0)}s`);
  ok(H.Net.roster.length === 3, 'the roster closes over them', H.Net.roster.map(r => r.seat).join(','));
  ok(guests[0].snaps > 0 && guests[2].snaps > 0, 'the ones still there keep getting the room');
  ok(guests[1].snaps < guests[0].snaps, 'the one who left stops getting it');
}

console.log('\n[8] the lost hello (the bug Kyle hit: a lobby with nobody in it)');
{
  /* the real failure: the guest's hello lands BEFORE the host has a data listener on that
     connection. PeerJS drops it, the guest sits in a lobby, the host sees an empty room, and
     broadcast — which skips seatless connections — never reaches them again. */
  H.Net.test.reset();
  H.Net.test.hostLocal('the boss', () => { });
  const [hostEnd, guestEnd] = H.Net.test.pair('late');
  // guest knocks into the void: nothing is listening on the host end yet
  guestEnd.send({ t: 'hello', name: 'tater' });
  let seat = null, welcomes = 0;
  guestEnd.on('data', m => { if (m.t === 'welcome') { seat = m.seat; welcomes++; } });
  H.Net.test.acceptGuest(hostEnd);                     // host wires up a beat too late
  ok(seat === null, 'the first knock really is lost (the bug reproduces)');
  ok(H.Net.roster.length === 1, 'and the host\'s room looks empty', H.Net.roster.length + ' seat');
  // the fix: the guest keeps knocking, so the next one lands
  guestEnd.send({ t: 'hello', name: 'tater' });
  ok(seat === 1, 'a second knock gets them seated', 'seat ' + seat);
  ok(H.Net.roster.length === 2, 'and the host sees them', H.Net.roster.map(r => r.name).join(' · '));
  // and a THIRD knock (the retry timer fires again before the welcome is processed) is idempotent
  guestEnd.send({ t: 'hello', name: 'tater' });
  ok(H.Net.roster.length === 2, 'a repeat knock does not burn a second seat', H.Net.roster.length + ' seats');
  ok(welcomes === 2, 'it just gets answered again', welcomes + ' welcomes');
  // and now broadcast actually reaches them
  let got = 0;
  guestEnd.on('data', m => { if (m.t === 'start') got++; });
  H.Net.broadcast({ t: 'start', nightIdx: 1, slots: {} });
  ok(got === 1, 'and the doors open for them', 'start received');
}

console.log('\n[8b] the theatre survives the wire (poses, not just positions)');
{
  const N = mkNight();
  let guard = 0, sawReact = false, snap = null;
  while (!N.done && guard++ < 60 * 30 * 20) {
    for (const slotId of Object.keys(N.stations)) {
      const st = N.stations[slotId];
      if (st.type === 'flashCam' || st.type === 'fogBurst') continue;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        const l = leaderS(grp);
        if (l !== null && Math.abs(l - st.node.s) < 0.5) { N.triggerStation(slotId); break; }
      }
    }
    N.tick(1 / 30); N.events.length = 0;
    if (N.guests.some(g => !g.out && g.state === 'react')) {
      snap = JSON.parse(JSON.stringify(H.Net.snapshot(N, {}, [])));   // through the wire, verbatim
      sawReact = true; break;
    }
  }
  ok(sawReact, 'caught the room mid-reaction');
  const rebuilt = H.Net.readGuests(snap);
  const live = N.guests.filter(g => !g.out);
  let poseMatches = true, sawNonWalk = false, badT = false;
  for (const g of live) {
    const r = rebuilt.find(x => x.id === g.id);
    if (!r) { poseMatches = false; continue; }
    const want = H.Replay.poseOf(g);
    if (r.pose !== want.pose) poseMatches = false;
    if (r.pose !== 'walk') sawNonWalk = true;
    if (!(r.poseT >= 0 && r.poseT <= 1)) badT = true;
  }
  ok(poseMatches, 'every guest arrives on the wire striking the pose the host sees');
  ok(sawNonWalk, 'and at least one of them is mid-scare', rebuilt.map(r => r.pose).filter(p => p !== 'walk').join(','));
  ok(!badT, 'poseT stays inside 0..1 after the round trip');
  ok(H.Replay.POSES.length === 10, 'the pose vocabulary is the single shared authority', H.Replay.POSES.length + ' poses');
  // an OLD client reading a NEW snapshot must degrade, never throw
  const trimmed = { g: snap.g.map(e => e.slice(0, 11)) };
  const old = H.Net.readGuests(trimmed);
  ok(old.length === rebuilt.length && old.every(o => o.pose === 'walk'),
    'a stale client just sees everyone walking instead of crashing');
}

console.log('\n[9] stale builds get named, not suffered');
{
  H.Net.test.reset();
  let skews = [];
  H.Net.test.hostLocal('the boss', (type, msg) => { if (type === 'versionSkew') skews.push(msg); });
  const [hostEnd, guestEnd] = H.Net.test.pair('skew');
  H.Net.test.acceptGuest(hostEnd);
  let welcomeV = null;
  guestEnd.on('data', m => { if (m.t === 'welcome') welcomeV = m.v; });
  guestEnd.send({ t: 'hello', name: 'old tater', v: '0.9.0' });          // a cached build knocks
  ok(skews.length === 1 && skews[0].theirs === '0.9.0', 'the host flags the mismatch', JSON.stringify(skews[0]));
  ok(welcomeV === D.VERSION, 'and still answers with its own version so the guest can flag it too', welcomeV);
  ok(H.Net.roster.length === 2, 'the stale guest is seated anyway — a warning, not a ban');
  const [h2, g2] = H.Net.test.pair('same');
  H.Net.test.acceptGuest(h2);
  g2.send({ t: 'hello', name: 'fresh', v: D.VERSION });                  // matching build
  ok(skews.length === 1, 'matching builds raise nothing');
}

console.log('\n[10] the heartbeat bookkeeping');
{
  H.Net.test.reset();
  H.Net.test.hostLocal('the boss', () => { });
  const [hostEnd, guestEnd] = H.Net.test.pair('hb');
  H.Net.test.acceptGuest(hostEnd);
  guestEnd.send({ t: 'hello', name: 'tater', v: D.VERSION });
  const entry = H.Net.conns.find(c => c.seat === 1);
  const t0 = entry.heard;
  guestEnd.send({ t: 'hb' });
  ok(entry.heard >= t0, 'an hb pulse refreshes when the host last heard them');
  const lines = H.Net.lines();
  ok(lines.length === 1 && lines[0].seat === 1 && typeof lines[0].quietS === 'number',
    'the lobby can read the line table', JSON.stringify(lines[0]));
}

console.log('\n[11] names');
{
  H.Net.test.reset();
  room(2);
  ok(H.Net.nameOf('s1') === 'monster1', 'a seat resolves to a name', H.Net.nameOf('s1'));
  ok(H.Net.nameOf('s0') === 'you', 'and your own seat is just "you"');
  ok(H.Net.nameOf('you') === 'you', 'solo play still says "you"');
}

console.log(`\n=================\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
