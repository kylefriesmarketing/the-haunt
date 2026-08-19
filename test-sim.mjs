/* THE HAUNT — test-sim.mjs — headless referee. `node test-sim.mjs`
   Balance changes ship with these numbers or they don't ship. */
import './parts/rng.js';
import './parts/data.js';
import './parts/sim.js';

const H = globalThis.HAUNT;
const D = H.DATA;
let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ✔ ' + label + (detail ? `  (${detail})` : '')); }
  else { fail++; console.log('  ✘ FAIL ' + label + (detail ? `  (${detail})` : '')); }
}

function defaultBuild() {
  return { slots: {
    s_corn_a: { type: 'dropPanel', tier: 1 },
    s_din_a: { type: 'soundSting', tier: 1 },
    s_sur_a: { type: 'dropPanel', tier: 1 },
    s_pass_a: { type: 'rattleChain', tier: 1 },
    s_clown_a: { type: 'airCannon', tier: 1 },
    s_clown_b: { type: 'flashCam', tier: 1 },
    s_cel_a: { type: 'dropPanel', tier: 1 },
    s_last_a: { type: 'lightSnap', tier: 1 }
  } };
}
function mkNight(over = {}) {
  return H.Sim.createNight(Object.assign({
    seed: 1234, nightIdx: 5, build: defaultBuild(), crewAt: {}, absent: [],
    spacingId: 'standard', ticket: 18, seasonFlags: { ghostArmed: false }, softScare: false
  }, over));
}
function leaderS(N, grp) {
  let m = null;
  for (const g of grp.guests) if (!g.out && !g.chicken) m = m === null ? g.s : Math.max(m, g.s);
  return m;
}
/* brains */
function perfectBrain(N) {
  for (const [slotId, st] of Object.entries(N.stations)) {
    if (st.type === 'flashCam' || st.type === 'fogBurst') continue;
    for (const grp of N.groups) {
      if (grp.mergedInto) continue;
      const l = leaderS(N, grp);
      if (l !== null && Math.abs(l - st.node.s) < 0.5) { N.triggerStation(slotId); break; }
    }
  }
}
function chaosBrain(N) { // fires at the worst times
  for (const [slotId, st] of Object.entries(N.stations)) {
    if (N.t % 11 < 0.04) N.triggerStation(slotId);
  }
}
function runNight(N, brain) {
  let guard = 0;
  while (!N.done && guard++ < 60 * 30 * 20) {
    if (brain) brain(N);
    N.tick(1 / 30);
    N.events.length = 0; // drain
  }
  return N.result;
}

console.log('\nTHE HAUNT — sim harness\n=======================');

console.log('\n[1] determinism');
{
  const a = runNight(mkNight(), perfectBrain);
  const b = runNight(mkNight(), perfectBrain);
  ok(JSON.stringify(a.tally) === JSON.stringify(b.tally) && a.drawer === b.drawer, 'same seed → identical night', `drawer $${a.drawer}`);
  const c = runNight(mkNight({ seed: 999 }), perfectBrain);
  ok(JSON.stringify(a.tally) !== JSON.stringify(c.tally), 'different seed → different night');
}

console.log('\n[2] completion & throughput');
{
  for (const spacingId of ['tight', 'standard', 'relaxed']) {
    const N = mkNight({ spacingId, nightIdx: 11 });
    const r = runNight(N, perfectBrain);
    ok(!!r && N.guests.every(g => g.out), `night 11 completes @ ${spacingId}`, `t=${N.t.toFixed(0)}s admitted=${r.admitted}`);
  }
  const N = mkNight({ nightIdx: 0, spacingId: 'relaxed' });
  const r = runNight(N, null);
  ok(!!r, 'soft open completes with nobody at the triggers', `walkbys=${r.tally.walkby}`);
}

console.log('\n[3] the scares');
{
  const r = runNight(mkNight(), perfectBrain);
  ok(r.tally.dropped >= 6 && r.tally.dropped <= r.admitted * 0.5, 'perfect play drops a healthy band (not everyone)', `dropped=${r.tally.dropped}/${r.admitted} melted=${r.tally.melted}`);
  ok(r.tally.melted <= 6, 'melts are rare trophies', `melted=${r.tally.melted}`);
  ok(r.tally.complaints <= 2, 'perfect play stays kind', `complaints=${r.tally.complaints}`);
  ok(r.tally.delight > 40, 'fear converts to delight', `delight=${r.tally.delight.toFixed(0)}`);
  ok(r.drawer > 0, 'the drawer ends positive', `$${r.drawer}`);
  const rBad = runNight(mkNight(), chaosBrain);
  const rNone = runNight(mkNight(), null);
  ok(rNone.tally.dropped === 0 && rNone.tally.walkby === 0, 'untriggered stations never fire themselves');
  ok(r.tally.dropped > rBad.tally.dropped, 'timing matters: perfect > chaos', `${r.tally.dropped} vs ${rBad.tally.dropped}`);
}

console.log('\n[4] crew');
{
  const crewAt = { n_corn: 'marcus', n_dinner: 'priya', n_cellar: 'grace', n_last: 'bo', n_clown: 'tater', n_surgery: 'dee' };
  const r = runNight(mkNight({ crewAt }), null);
  ok(r.tally.dropped + r.tally.gotem + r.tally.scream > 6, 'a crewed barn runs itself', `dropped=${r.tally.dropped} gotem=${r.tally.gotem} scream=${r.tally.scream}`);
  const rAbsent = runNight(mkNight({ crewAt, absent: ['marcus', 'tater', 'grace'] }), null);
  ok(rAbsent.tally.dropped <= r.tally.dropped, 'absences hurt', `${rAbsent.tally.dropped} <= ${r.tally.dropped}`);
}

console.log('\n[5] soft-scare mode (birthday night)');
{
  const r = runNight(mkNight({ softScare: true }), perfectBrain);
  ok(r.tally.complaints === 0, 'soft mode: zero complaints', `delight=${r.tally.delight.toFixed(0)}`);
  ok(r.tally.melted === 0, 'soft mode: nobody melts');
}

console.log('\n[6] the alarm (fog at a detector)');
{
  const build = defaultBuild();
  build.slots.s_pass_a = { type: 'fogBurst', tier: 3 }; // tier 3 fog AT the detector. the marshal warned you.
  let alarms = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const N = mkNight({ build, seed });
    const brain = (S) => { perfectBrain(S); for (const grp of S.groups) { if (grp.mergedInto) continue; const l = leaderS(S, grp); if (l !== null && Math.abs(l - S.nodeById.n_passage.s) < 2) S.triggerStation('s_pass_a'); } };
    const r = runNight(N, brain);
    alarms += r.tally.alarms;
  }
  ok(alarms >= 2, 'tier-3 fog at the detector trips alarms across seeds', `alarms=${alarms}/6 nights`);
}

console.log('\n[7] the ’96 thread (slow nights only, kind, once)');
{
  let ghosts = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const r = runNight(mkNight({ seed, nightIdx: 6, seasonFlags: { ghostArmed: true }, build: { slots: {} }, spacingId: 'relaxed' }), null);
    ghosts += r.tally.ghost;
  }
  ok(ghosts >= 4, 'she shows up on slow nights', `ghosts=${ghosts}/8`);
  const rBusy = runNight(mkNight({ nightIdx: 13, seasonFlags: { ghostArmed: true } }), perfectBrain);
  ok(rBusy.tally.ghost === 0, 'never on the big nights');
}

console.log('\n[8] economics across the season shape');
{
  let cash = D.SEASON.startCash, guests = 0;
  const crewAt = { n_corn: 'marcus', n_dinner: 'priya', n_clown: 'tater', n_last: 'bo' };
  for (let n = 0; n < D.SEASON.nights.length; n++) {
    const N = mkNight({ nightIdx: n, seed: 400 + n, crewAt });
    const r = runNight(N, perfectBrain);
    cash += r.drawer - Object.keys(crewAt).length * 60;
    guests += r.admitted;
  }
  const noteTotal = D.SEASON.notePayments.reduce((a, p) => a + p.due, 0);
  ok(cash > noteTotal, 'a well-run season can clear the note', `cash=$${Math.round(cash)} vs note=$${noteTotal}`);
  ok(guests >= D.SEASON.guestGoal * 0.8, 'season guest volume near the goal band', `guests=${guests} goal=${D.SEASON.guestGoal}`);
}

console.log(`\n=======================\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
