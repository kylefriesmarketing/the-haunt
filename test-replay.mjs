/* THE HAUNT — test-replay.mjs — the tape, headless. `node test-replay.mjs`
   The recorder rides a real night and must never touch the sim. That's the whole test. */
import './parts/rng.js';
import './parts/data.js';
import './parts/sim.js';
import './parts/replay.js';

const H = globalThis.HAUNT;
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
/* a night driven exactly like the render loop drives it: tick, drain, record */
function runWithTape(N, record) {
  let guard = 0;
  while (!N.done && guard++ < 60 * 30 * 20) {
    for (const [slotId, st] of Object.entries(N.stations)) {
      if (st.type === 'flashCam' || st.type === 'fogBurst') continue;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        const l = leaderS(grp);
        if (l !== null && Math.abs(l - st.node.s) < 0.5) { N.triggerStation(slotId); break; }
      }
    }
    N.tick(1 / 30);
    if (record) { for (const ev of N.events) if (ev.type === 'scare') H.Replay.mark(N, ev); H.Replay.record(N, 1 / 30); }
    N.events.length = 0;
  }
  return N.result;
}

console.log('\nTHE HAUNT — the tape\n===================');

console.log('\n[1] recording never changes the night');
{
  const a = runWithTape(mkNight(), false);
  H.Replay.reset();
  const b = runWithTape(mkNight(), true);
  ok(JSON.stringify(a.tally) === JSON.stringify(b.tally) && a.drawer === b.drawer,
    'a recorded night is byte-identical to an unrecorded one', `drawer $${b.drawer}`);
}

console.log('\n[2] the take');
{
  H.Replay.reset();
  const N = mkNight();
  const r = runWithTape(N, true);
  const take = H.Replay.take;
  ok(!!take, 'a night with scares leaves a tape', take ? take.roomName : 'none');
  ok(take && Math.abs(take.magnitude - r.bestScare.magnitude) < 1e-6,
    'the tape kept the BEST scare, not merely the last', take ? `mag ${Math.round(take.magnitude)} vs best ${Math.round(r.bestScare.magnitude)}` : '');
  ok(take && take.frames.length >= 30, 'the take is long enough to watch', take ? `${take.frames.length} frames / ${take.dur.toFixed(1)}s` : '');
  ok(take && take.dur <= H.DATA.REPLAY.preS + H.DATA.REPLAY.postS + 0.3, 'and no longer than its own window', take ? take.dur.toFixed(2) + 's' : '');
  ok(take && Object.keys(take.roster).length > 0 && Object.values(take.roster).every(a => !!H.DATA.ARCHETYPES[a]),
    'every guest on the tape has a real archetype to rebuild from', take ? Object.keys(take.roster).length + ' guests' : '');
  ok(take && take.hitAt > 0 && take.hitAt < take.dur, 'the scare itself lands inside the take, not at an edge', take ? `hit at ${take.hitAt.toFixed(1)}s of ${take.dur.toFixed(1)}s` : '');
}

console.log('\n[3] playback interpolation');
{
  const take = H.Replay.take;
  const mid = H.Replay.frameAt(take, take.dur / 2);
  ok(mid.length > 0, 'a mid-take frame has guests in it', `${mid.length} on screen`);
  ok(mid.every(g => isFinite(g.x) && isFinite(g.z) && isFinite(g.ry) && isFinite(g.tilt)), 'no NaNs in an interpolated frame');
  const before = H.Replay.frameAt(take, -5), after = H.Replay.frameAt(take, take.dur + 99);
  ok(before.length > 0 && after.length > 0, 'clamps past both ends instead of exploding');
  // the wrap case: interpolating yaw across ±π must take the short way round
  const fake = { frames: [{ t: 0, g: [[1, 0, 0, 0, 3.0, 0, 0]] }, { t: 1, g: [[1, 0, 0, 0, -3.0, 0, 0]] }], roster: { 1: 'chain' }, dur: 1 };
  const w = H.Replay.frameAt(fake, 0.5)[0];
  ok(Math.abs(w.ry) > 3.0, 'yaw interpolation takes the short way around the wrap', `ry=${w.ry.toFixed(2)}`);
}

console.log('\n[4] the caption');
{
  const c = H.Replay.caption(H.Replay.take);
  ok(!!c.room && !!c.who && c.mag > 0, 'the tape knows what it is', `${c.room} · ${c.who} · ${c.mag}`);
}

console.log('\n[4b] the tape carries the theatre, damped the same way the live view damps it');
{
  H.Replay.reset();
  const N = mkNight();
  let guard = 0;
  while (!N.done && guard++ < 60 * 30 * 20) {
    for (const [slotId, st] of Object.entries(N.stations)) {
      if (st.type === 'flashCam' || st.type === 'fogBurst') continue;
      for (const grp of N.groups) {
        if (grp.mergedInto) continue;
        const l = leaderS(grp);
        if (l !== null && Math.abs(l - st.node.s) < 0.5) { N.triggerStation(slotId); break; }
      }
    }
    N.tick(1 / 30);
    for (const ev of N.events) if (ev.type === 'scare') H.Replay.mark(N, ev);
    H.Replay.record(N, 1 / 30);
    N.events.length = 0;
  }
  const take = H.Replay.take;
  ok(!!take, 'a tape exists to inspect');
  const mid = H.Replay.frameAt(take, take.hitAt + 0.25);   // just after the hit: someone is bouncing
  ok(mid.every(g => g.bob !== undefined), 'every taped guest carries bob as its OWN field');
  const anyBob = mid.some(g => Math.abs(g.bob) > 0.001);
  ok(anyBob, 'and the reaction bounce actually rides in it', 'max bob ' + Math.max.apply(null, mid.map(g => Math.abs(g.bob))).toFixed(3));
  /* the whole point: bob must NOT be pre-summed into y, or renderGuests cannot damp it for
     reduced-motion and the tape plays the bounce at full amplitude. */
  const bouncing = mid.filter(g => Math.abs(g.bob) > 0.001);
  ok(bouncing.every(g => Math.abs(g.y) < 0.6 && Math.abs(g.y - g.bob) > 1e-9 || g.y === 0),
    'bob is not folded into the position channel');
  ok(mid.every(g => g.poseT >= 0 && g.poseT <= 1), 'poseT survives interpolation inside 0..1');
}

console.log('\n[4c] the dropped fall curve follows the sim duration, not a copy of it');
{
  const g0 = { nerve: 1, pool: 100, state: 'react', reactKind: 'dropped', reactT: 2.5, arch: 'chain' };   // just after the fall begins: the curve is live here, not clamped
  const base = H.Replay.poseOf(g0);
  const keep = H.DATA.POSE.durs.dropped;
  H.DATA.POSE.durs.dropped = keep * 2;                          // retune the sim's react length...
  const after = H.Replay.poseOf(g0);
  H.DATA.POSE.durs.dropped = keep;                              // ...and put it straight back
  ok(Math.abs(after.tilt - base.tilt) > 1e-6 || Math.abs(after.ly - base.ly) > 1e-6,
    'lengthen the drop and the animation lengthens with it',
    'tilt ' + base.tilt.toFixed(3) + ' -> ' + after.tilt.toFixed(3));
  ok(Math.abs(H.Replay.poseOf(g0).tilt - base.tilt) < 1e-9, 'and the restore is exact');
}

console.log('\n[5] a quiet night leaves no tape');
{
  H.Replay.reset();
  const N = mkNight({ nightIdx: 0, build: { slots: {} } });
  let guard = 0;
  while (!N.done && guard++ < 60 * 30 * 20) { N.tick(1 / 30); H.Replay.record(N, 1 / 30); N.events.length = 0; }
  ok(H.Replay.take === null, 'nothing landed, nothing kept');
}

console.log(`\n===================\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
