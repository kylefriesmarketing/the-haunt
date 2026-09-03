/* THE HAUNT — test-tech.mjs — the referee for the six trade verbs (bible §6.2).
   Everything here is scripted through N.setActor, so it is deterministic, headless and DOM-free.
   Run: node test-tech.mjs   (and after ANY edit to the technique kernel in sim.js) */
import './parts/rng.js';
import './parts/data.js';
import './parts/sim.js';
import './parts/replay.js';

const H = globalThis.HAUNT, D = H.DATA;
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✔ ' + name + (extra ? '  (' + extra + ')' : '')); }
  else { fail++; console.log('  ✘ ' + name + (extra ? '  (' + extra + ')' : '')); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function night(over) {
  return H.Sim.createNight(Object.assign({
    seed: 4242, nightIdx: 12, build: { slots: {} }, crewAt: {}, absent: [],
    spacingId: 'standard', ticket: 12, seasonFlags: {}, softScare: false
  }, over || {}));
}
function run(N, secs) { for (let i = 0; i < Math.round(secs * 30); i++) N.tick(1 / 30); }
function puppet(N, who, s) {
  N.setActor(who, Object.assign({ x: 0, z: 0, inRoom: false, pitch: 0 }, s));
}
/* the route in world space, so a puppet can be placed BEHIND a group honestly */
const route = H.Sim.buildRoute();
function liveGroup(N) { return N.groups.find(g => !g.mergedInto && g.guests.some(x => !x.out && !x.chicken)) || null; }
function tailOf(g) { let m = null; for (const x of g.guests) if (!x.out && !x.chicken) m = m === null ? x.s : Math.min(m, x.s); return m; }
function leadOf(g) { let m = null; for (const x of g.guests) if (!x.out && !x.chicken) m = m === null ? x.s : Math.max(m, x.s); return m; }

/* walk a puppet along the route, `back` metres behind the group's tail, one sim tick at a time */
function shadow(N, who, secs, back, tech) {
  const steps = Math.round(secs * 30);
  for (let i = 0; i < steps; i++) {
    const g = liveGroup(N);
    if (g) {
      const t = tailOf(g);
      if (t !== null) {
        const p = route.pointAt(Math.max(0, t - back));
        puppet(N, who, { x: p.x, z: p.z, inRoom: true });
      }
    }
    if (tech && N.actors[who] && N.actors[who].tech !== tech) N.setTechnique(who, tech);
    N.tick(1 / 30);
  }
}

console.log('\nTHE TRADE — the six verbs');

/* T1 determinism with a scripted actor */
{
  const fp = () => {
    const N = night();
    run(N, 40);
    N.setActor('you', { x: 20, z: 8, inRoom: true, pitch: 0 });
    N.setTechnique('you', 'stalk');
    shadow(N, 'you', 12, 2.0, 'stalk');
    N.triggerTech('you');
    run(N, 30);
    return JSON.stringify(N.tally) + '|' + Math.round(N.drawer);
  };
  ok('T1 same script twice is the same night', fp() === fp());
}

/* T2/T3/T4 the stalk */
{
  const N = night(); run(N, 45);
  N.setActor('you', { x: 20, z: 8, inRoom: true });
  N.setTechnique('you', 'stalk');
  shadow(N, 'you', 6.0, 2.0, 'stalk');
  const charged = N.actors.you.charge;
  ok('T2 stalk charges from behind at their pace', charged >= 2.5, 'charge=' + charged.toFixed(2));

  const N2 = night(); run(N2, 45);
  N2.setActor('you', { x: 20, z: 8, inRoom: true });
  N2.setTechnique('you', 'stalk');
  for (let i = 0; i < 30 * 5; i++) {                      // walk AHEAD of the leader, same distance
    const g = liveGroup(N2);
    if (g) { const l = leadOf(g); if (l !== null) { const p = route.pointAt(l + 2.0); puppet(N2, 'you', { x: p.x, z: p.z, inRoom: true }); } }
    N2.tick(1 / 30);
  }
  ok('T3 in front of them it never charges', N2.actors.you.charge === 0, 'charge=' + N2.actors.you.charge.toFixed(2));

  const before = N.actors.you.charge;
  puppet(N, 'you', { x: 4, z: 14, inRoom: false });        // step away into the spine
  run(N, 3.0);
  ok('T4 walking away decays it', N.actors.you.charge <= 0.1, before.toFixed(2) + ' -> ' + N.actors.you.charge.toFixed(2));
}

/* T5 the verbs are actually different */
{
  const mk = (tech, mover) => {
    const N = night(); run(N, 45);
    const g = liveGroup(N); const p = route.pointAt(Math.max(0, leadOf(g) - 1.5));
    N.setActor('you', { x: p.x, z: p.z, inRoom: true });
    N.setTechnique('you', tech);
    for (let i = 0; i < 30 * 4; i++) { mover(N, i); N.tick(1 / 30); }
    return N.actors.you.charge;
  };
  // creep: hold a slow drift beside the group
  const creepOk = mk('creep', (N, i) => {
    const g = liveGroup(N); if (!g) return;
    const p = route.pointAt(Math.max(0, leadOf(g) - 1.5));
    puppet(N, 'you', { x: p.x + 0.03, z: p.z, inRoom: true });
  });
  const creepFast = mk('creep', (N, i) => {
    const g = liveGroup(N); if (!g) return;
    const p = route.pointAt(Math.max(0, leadOf(g) - 1.5));
    puppet(N, 'you', { x: p.x + (i % 2 ? 0.12 : -0.12), z: p.z, inRoom: true });   // 3.6 m/s jitter
  });
  ok('T5a creep charges on a slow drift', creepOk > 1.5, 'charge=' + creepOk.toFixed(2));
  ok('T5b creep dies the moment you hurry', creepFast < 0.4, 'charge=' + creepFast.toFixed(2));

  const crowStill = mk('scarecrow', (N) => {
    const g = liveGroup(N); if (!g) return;
    const p = route.pointAt(Math.max(0, leadOf(g) - 2.0));
    if (!N.actors.you._parked) { puppet(N, 'you', { x: p.x, z: p.z, inRoom: true }); N.actors.you._parked = 1; }
  });
    // 4 s of stillness at chargeRate 0.5 is ~2.0 — assert the RATE, not a round number
  ok('T5c scarecrow charges when dead still in the room', crowStill > 1.8, 'charge=' + crowStill.toFixed(2));

  const crowBackstage = mk('scarecrow', (N) => {
    if (!N.actors.you._parked) { const g = liveGroup(N); if (!g) return; const p = route.pointAt(Math.max(0, leadOf(g) - 2.0)); puppet(N, 'you', { x: p.x, z: p.z, inRoom: false }); N.actors.you._parked = 1; }
  });
  ok('T5d scarecrow does NOT charge from backstage', crowBackstage === 0, 'charge=' + crowBackstage.toFixed(2));
}

/* T6 a charged fire beats an uncharged one */
{
  const fire = (chargeSecs) => {
    const N = night(); run(N, 45);
    N.setActor('you', { x: 20, z: 8, inRoom: true });
    N.setTechnique('you', 'stalk');
    if (chargeSecs > 0) shadow(N, 'you', chargeSecs, 2.0, 'stalk');
    else { const g = liveGroup(N); const p = route.pointAt(Math.max(0, tailOf(g) - 2.0)); puppet(N, 'you', { x: p.x, z: p.z, inRoom: true }); N.tick(1 / 30); }
    const r = N.triggerTech('you');
    return r.res ? r.res.magnitude : 0;
  };
  const cold = fire(0), hot = fire(6.5);
  ok('T6 a full stalk lands far harder than a cold one', hot > cold * 2.5, cold.toFixed(1) + ' -> ' + hot.toFixed(1));
}

/* T7 cooldowns are per actor AND per technique */
{
  const N = night(); run(N, 45);
  N.setActor('s0', { x: 20, z: 8, inRoom: true }); N.setTechnique('s0', 'stalk');
  N.setActor('s1', { x: 20, z: 8, inRoom: true }); N.setTechnique('s1', 'stalk');
  shadow(N, 's0', 6.0, 2.0, 'stalk');
  N.triggerTech('s0');
  ok('T7a s0 stalk is now cooling', N.triggerTech('s0').cooldown === true);
  N.setTechnique('s0', 'creep');
  ok('T7b s0 creep is untouched', N.triggerTech('s0').ok === true);
  N.setTechnique('s1', 'stalk');
  ok('T7c s1 stalk is untouched', N.triggerTech('s1').ok === true);
}

/* T8 a miss is a punchline, a refusal costs nothing */
{
  const N = night(); run(N, 45);
  N.setActor('you', { x: 2.5, z: 26.5, inRoom: false });   // a corner nobody walks
  N.setTechnique('you', 'stalk');
  const wb = N.tally.walkby;
  const r = N.triggerTech('you');
  ok('T8a firing into an empty hallway is a walkby', N.tally.walkby === wb + 1 && r.grade.id === 'miss');

  const N2 = night({ nightIdx: 12 }); run(N2, 45);
  const g = liveGroup(N2); const p = route.pointAt(Math.max(0, leadOf(g) - 2));
  N2.setActor('you', { x: p.x, z: p.z, inRoom: true }); N2.setTechnique('you', 'slider');
  N2.tick(1 / 30);
  const refused = N2.triggerTech('you');
  ok('T8b the slider refuses without a runway', refused.ok === false && refused.needSprint === true);
  ok('T8c ...and a refusal burns no cooldown', (N2.bodyReadyAt['you:slider'] || 0) === 0);
}

/* T9 / T10 the chainsaw */
{
  const sawRun = (pitch) => {
    const N = night(); run(N, 45);
    const g = liveGroup(N); const p = route.pointAt(Math.max(0, leadOf(g) - 1.2));
    N.setActor('you', { x: p.x, z: p.z, inRoom: true, pitch });
    N.setTechnique('you', 'chainsaw');
    N.tick(1 / 30);
    const nerveBefore = g.guests.reduce((a, x) => a + x.nerve, 0);
    const sBefore = leadOf(g);
    N.holdStart('you');
    for (let i = 0; i < 30 * 5; i++) {                      // past maxHoldS: it must auto-end
      const gg = liveGroup(N);
      if (gg) { const q = route.pointAt(Math.max(0, leadOf(gg) - 1.2)); puppet(N, 'you', { x: q.x, z: q.z, inRoom: true, pitch }); }
      N.tick(1 / 30);
    }
    const scares = N.events.filter(e => e.type === 'scare' && e.tech === 'chainsaw');
    return { N, g, drained: nerveBefore - g.guests.reduce((a, x) => a + x.nerve, 0),
      pushed: leadOf(g) - sBefore, scares, highs: N.events.filter(e => e.type === 'chainsawHigh').length };
  };
  const low = sawRun(-0.1);
  ok('T9a held LOW it drains them', low.drained > 30, 'nerve drained ' + low.drained.toFixed(1));
  ok('T9b it herds the room forward', low.pushed > 4, 'leader +' + low.pushed.toFixed(2) + 'm');
  ok('T9c exactly ONE aggregate scare for the run', low.scares.length === 1, low.scares.length + ' events');
  ok('T9d the run auto-ends and starts a cooldown', low.N.actors.you.hold === null && (low.N.bodyReadyAt['you:chainsaw'] || 0) > low.N.t);
  ok('T9e no chainsawHigh when it is aimed low', low.highs === 0);

  const high = sawRun(0.2);
  ok('T10a held HIGH it drains nothing', high.drained < 12, 'nerve drained ' + high.drained.toFixed(1));
  ok('T10b exactly one chainsawHigh call-out', high.highs === 1, high.highs + ' events');
}

/* T11 soft-scare safety: the clamps are SHARED, so no verb can route around them */
{
  const N = night({ softScare: true }); run(N, 45);
  const g = liveGroup(N); const p = route.pointAt(Math.max(0, leadOf(g) - 1.2));
  N.setActor('you', { x: p.x, z: p.z, inRoom: true, pitch: -0.1 });
  N.setTechnique('you', 'chainsaw');
  N.holdStart('you');
  for (let i = 0; i < 30 * 5; i++) {
    const gg = liveGroup(N);
    if (gg) { const q = route.pointAt(Math.max(0, leadOf(gg) - 1.2)); puppet(N, 'you', { x: q.x, z: q.z, inRoom: true, pitch: -0.1 }); }
    N.tick(1 / 30);
  }
  run(N, 40);
  ok('T11 family hour survives a full saw run', N.tally.complaints === 0 && N.tally.melted === 0,
    'complaints=' + N.tally.complaints + ' melts=' + N.tally.melted);
}

/* T12 the unlock gate */
{
  const early = night({ nightIdx: 2 });
  early.setActor('you', { x: 20, z: 8, inRoom: true });
  ok('T12a night 2 cannot take out the slider', early.setTechnique('you', 'slider').ok === false);
  ok('T12b ...and the stalk is already in the bag', early.setTechnique('you', 'stalk').ok === true);
  const pinned = night({ nightIdx: 12, techs: ['pop', 'creep'] });
  pinned.setActor('you', { x: 20, z: 8, inRoom: true });
  ok('T12c an explicit techs list wins', pinned.setTechnique('you', 'slider').ok === false && pinned.setTechnique('you', 'creep').ok === true);
  ok('T12d junk off the wire is refused', pinned.setTechnique('you', 'nonsense').ok === false);
}

/* T13 THE NO-RNG LAW — charging must not consume a single draw */
{
  const bare = night(); run(bare, 70);
  const withActor = night();
  run(withActor, 45);
  withActor.setActor('you', { x: 20, z: 8, inRoom: true });
  withActor.setTechnique('you', 'stalk');
  shadow(withActor, 'you', 25, 2.0, 'stalk');              // charges to full 3x over and over, never fires
  ok('T13 an actor who never fires leaves the night byte-identical',
    JSON.stringify(bare.tally) === JSON.stringify(withActor.tally) && Math.round(bare.drawer) === Math.round(withActor.drawer),
    JSON.stringify(bare.tally) === JSON.stringify(withActor.tally) ? 'tally equal' : 'TALLY MOVED');
}

/* T14 the slider's runway, and the alarm breaking every spell */
{
  const N = night(); run(N, 45);
  const g = liveGroup(N); const p = route.pointAt(Math.max(0, leadOf(g) - 2));
  // a real sprint: 5.6 m/s for 1.4 s, straight at them
  N.setActor('you', { x: p.x - 7.8, z: p.z, inRoom: true });
  N.setTechnique('you', 'slider');
  for (let i = 0; i < 42; i++) { const q = route.pointAt(Math.max(0, leadOf(liveGroup(N)) - 2)); puppet(N, 'you', { x: q.x - 7.8 + i * 0.186, z: q.z, inRoom: true }); N.tick(1 / 30); }
  const sprinted = N.actors.you.sprintT;
  const r = N.triggerTech('you');
  ok('T14a a real runway earns PERFECT', sprinted >= 1.2 && r.ok && r.grade.id === 'perfect', 'sprintT=' + sprinted.toFixed(2) + ' grade=' + (r.grade && r.grade.id));

  const N2 = night(); run(N2, 45);
  N2.setActor('you', { x: 20, z: 8, inRoom: true }); N2.setTechnique('you', 'stalk');
  shadow(N2, 'you', 6, 2.0, 'stalk');
  N2.alarm.active = true; N2.alarm.until = N2.t + 30;
  const refused = N2.triggerTech('you');
  run(N2, 3);
  ok('T14b the alarm refuses every technique', refused.ok === false);
  ok('T14c ...and the fluorescent light decays the charge', N2.actors.you.charge < 0.2, 'charge=' + N2.actors.you.charge.toFixed(2));
}

/* T15 a seat that leaves mid-run does not leave a ghost saw behind */
{
  const N = night(); run(N, 45);
  const g = liveGroup(N); const p = route.pointAt(Math.max(0, leadOf(g) - 1.2));
  N.setActor('s1', { x: p.x, z: p.z, inRoom: true, pitch: -0.1 });
  N.setTechnique('s1', 'chainsaw');
  N.holdStart('s1');
  N.dropActor('s1');
  run(N, 6);
  ok('T15 dropping a seat ends its hold', !N.actors.s1 && (N.bodyReadyAt['s1:chainsaw'] || 0) > 0);
}

console.log('\n' + '='.repeat(23));
console.log(pass + ' passed, ' + fail + ' failed\n');
if (fail) process.exit(1);
