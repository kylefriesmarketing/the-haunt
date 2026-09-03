/* THE HAUNT — data.js — EVERY number lives here. The sim, the view, and the harness all read this file.
   Balance changes happen HERE and ship with harness numbers (node test-sim.mjs). */
(function (g) {
  'use strict';
  const D = {};

  /* ---------------- identity ---------------- */
  D.TITLE = 'THE HAUNT';
  D.SUBTITLE = 'the scream barn · route 9 · hazel park';
  D.SAVE_KEY = 'haunt-save';
  D.VERSION = '0.12.0';

  /* ---------------- the barn (meters, y-up; x east, z south) ----------------
     Guests snake: row A east, cross the east passage, row B west, out.
     The spine (z 12..16) is BACKSTAGE — yours. Guests never see it. */
  D.BARN = { x0: 0, x1: 48, z0: 0, z1: 28, wallH: 3.4, wallT: 0.36 };

  D.ROOMS = [
    { id: 'entry',   name: 'the entry hall',  x0: 2,  x1: 12, z0: 2,  z1: 12, light: 0xffd9a0, lightI: 0.55, floor: 'plank', frep: [6, 4] },
    { id: 'corn',    name: 'the corn rows',   x0: 12, x1: 24, z0: 2,  z1: 12, light: 0xffc078, lightI: 0.34, floor: 'dirt', frep: [4, 3] },
    { id: 'dinner',  name: 'the dinner scene',x0: 24, x1: 36, z0: 2,  z1: 12, light: 0xffb060, lightI: 0.30, floor: 'rug', frep: [1, 1] },
    { id: 'surgery', name: 'the surgery',     x0: 36, x1: 46, z0: 2,  z1: 12, light: 0xbfe8ff, lightI: 0.26, floor: 'tile', frep: [3, 2.5] },
    { id: 'passage', name: 'the squeeze',     x0: 44, x1: 46, z0: 12, z1: 16, light: 0xff8888, lightI: 0.22, floor: 'plank', frep: [1, 2] },
    { id: 'clown',   name: 'the clown room',  x0: 34, x1: 46, z0: 16, z1: 26, light: 0xffa8d8, lightI: 0.34, floor: 'paint', frep: [1, 1] },
    { id: 'cellar',  name: 'the cellar pass', x0: 20, x1: 34, z0: 16, z1: 26, light: 0x9fb8ff, lightI: 0.20, floor: 'concrete', frep: [3, 2] },
    { id: 'last',    name: 'the last laugh',  x0: 8,  x1: 20, z0: 16, z1: 26, light: 0xffe0a8, lightI: 0.45, floor: 'plank', frep: [4, 3] },
    { id: 'lobby',   name: 'the exit lobby',  x0: 2,  x1: 8,  z0: 16, z1: 26, light: 0xffe9c0, lightI: 0.8, floor: 'plankworn', frep: [2, 3] }
  ];
  D.SPINE = { x0: 2, x1: 44, z0: 12, z1: 16 }; // backstage. yours.

  /* doorways: [x, z, 'ns'|'ew'] — ns = opening in an east-west wall (guests pass north<->south) */
  D.DOORS = {
    guest: [
      { id: 'front',    x: 2,  z: 7,  o: 'ew' },   // porch -> entry
      { id: 'd_ec',     x: 12, z: 9,  o: 'ew' },   // entry -> corn
      { id: 'd_cd',     x: 24, z: 5,  o: 'ew' },   // corn -> dinner
      { id: 'd_ds',     x: 36, z: 9,  o: 'ew' },   // dinner -> surgery
      { id: 'd_sp',     x: 45, z: 12, o: 'ns' },   // surgery -> squeeze
      { id: 'd_pc',     x: 45, z: 16, o: 'ns' },   // squeeze -> clown
      { id: 'd_cc',     x: 34, z: 23, o: 'ew' },   // clown -> cellar
      { id: 'd_cl',     x: 20, z: 19, o: 'ew' },   // cellar -> last laugh
      { id: 'd_ll',     x: 8,  z: 23, o: 'ew' },   // last laugh -> lobby
      { id: 'out',      x: 2,  z: 21, o: 'ew' }    // lobby -> yard
    ],
    chicken: [
      { id: 'chx1', x: 46, z: 14, o: 'ew', from: 'passage' },  // the squeeze bail-out
      { id: 'chx2', x: 14, z: 26, o: 'ns', from: 'last' }      // last-laugh bail-out
    ],
    backstage: [
      { id: 'bdoor', x: 2, z: 14, o: 'ew' }                    // yard -> spine
    ],
    /* peek doors: player/crew pop-out points, spine <-> room */
    peek: [
      { id: 'p_corn',  x: 18, z: 12, o: 'ns', room: 'corn',   node: 'n_corn' },
      { id: 'p_din',   x: 30, z: 12, o: 'ns', room: 'dinner', node: 'n_dinner' },
      { id: 'p_sur',   x: 40, z: 12, o: 'ns', room: 'surgery',node: 'n_surgery' },
      { id: 'p_clown', x: 38, z: 16, o: 'ns', room: 'clown',  node: 'n_clown' },
      { id: 'p_cel',   x: 26, z: 16, o: 'ns', room: 'cellar', node: 'n_cellar' },
      { id: 'p_last',  x: 14, z: 16, o: 'ns', room: 'last',   node: 'n_last' }
    ]
  };

  /* the guest route — polyline through the barn (spawn to despawn) */
  D.ROUTE = [
    [-7, 7], [0, 7], [4, 7], [7, 7], [10, 9], [12, 9],
    [15, 9], [18, 5], [21, 9], [24, 5],
    [26, 5], [30, 7], [34, 9], [36, 9],
    [38, 9], [41, 6], [44, 8], [45, 10], [45, 12],
    [45, 14], [45, 16],
    [43, 20], [40, 18], [37, 23], [34, 23],
    [31, 23], [27, 19], [23, 23], [20, 19],
    [17, 19], [14, 22], [11, 19], [8, 23],
    [5, 22], [2, 21], [-5, 21]
  ];

  /* scare nodes — s = approx distance along route (computed at boot), pos for the room hit */
  D.NODES = [
    { id: 'n_corn',    room: 'corn',    pos: [18, 7],  routeAt: [18, 5],  window: 5.0, fleeFwd: true },
    { id: 'n_dinner',  room: 'dinner',  pos: [30, 6],  routeAt: [30, 7],  window: 5.0, fleeFwd: true },
    { id: 'n_surgery', room: 'surgery', pos: [41, 7],  routeAt: [41, 6],  window: 5.0, fleeFwd: true },
    { id: 'n_passage', room: 'passage', pos: [45, 14], routeAt: [45, 14], window: 4.0, fleeFwd: true, detector: true },
    { id: 'n_clown',   room: 'clown',   pos: [40, 19], routeAt: [40, 18], window: 5.0, fleeFwd: true },
    { id: 'n_cellar',  room: 'cellar',  pos: [27, 20], routeAt: [27, 19], window: 5.0, fleeFwd: true, detector: true },
    { id: 'n_last',    room: 'last',    pos: [14, 20], routeAt: [14, 22], window: 5.5, fleeFwd: true }
  ];

  /* station slots: what can be mounted where (slot -> node) */
  D.SLOTS = [
    { id: 's_corn_a',  node: 'n_corn',    at: [18, 3.2],  types: ['dropPanel', 'airCannon', 'soundSting'] },
    { id: 's_corn_b',  node: 'n_corn',    at: [21.5, 7],  types: ['airCannon', 'rattleChain', 'fogBurst'] },
    { id: 's_din_a',   node: 'n_dinner',  at: [30, 3.2],  types: ['dropPanel', 'soundSting', 'lightSnap'] },
    { id: 's_din_b',   node: 'n_dinner',  at: [33.5, 7],  types: ['airCannon', 'rattleChain'] },
    { id: 's_sur_a',   node: 'n_surgery', at: [41, 3.2],  types: ['dropPanel', 'lightSnap', 'soundSting'] },
    { id: 's_pass_a',  node: 'n_passage', at: [44.4, 13], types: ['rattleChain', 'fogBurst', 'soundSting'] },
    { id: 's_clown_a', node: 'n_clown',   at: [40, 24.8], types: ['airCannon', 'dropPanel', 'soundSting'] },
    { id: 's_clown_b', node: 'n_clown',   at: [36, 19],   types: ['flashCam'] },
    { id: 's_cel_a',   node: 'n_cellar',  at: [27, 24.8], types: ['dropPanel', 'fogBurst', 'rattleChain'] },
    { id: 's_last_a',  node: 'n_last',    at: [14, 24.8], types: ['soundSting', 'lightSnap', 'airCannon'] }
  ];

  /* ---------------- stations ---------------- */
  D.STATIONS = {
    dropPanel:   { name: 'drop panel',   power: 30, cost: [220, 180, 260], resetS: 7,  desc: 'a wall that stops being a wall. the classic.' },
    airCannon:   { name: 'air cannon',   power: 24, cost: [180, 150, 220], resetS: 5,  desc: 'a cough of air at ankle height. undefeated.' },
    fogBurst:    { name: 'fog burst',    power: 12, cost: [140, 90, 160],  resetS: 9,  desc: 'instant weather. mind the detectors. seriously.' },
    soundSting:  { name: 'sound sting',  power: 16, cost: [120, 80, 140],  resetS: 4,  desc: 'a noise with opinions, thrown anywhere.' },
    lightSnap:   { name: 'light snap',   power: 20, cost: [160, 110, 190], resetS: 8,  desc: 'darkness, on cue. the oldest trick in the barn.' },
    rattleChain: { name: 'rattle chain', power: 18, cost: [130, 90, 150],  resetS: 5,  desc: 'chains that shake the wall. rude. effective.' },
    flashCam:    { name: 'scare-cam',    power: 6,  cost: [300, 200, 380], resetS: 10, desc: 'the flash catches the whole group mid-scream. lobby wall material.' }
  };
  D.TIER_MULT = [1, 1.35, 1.8];        // power multiplier by tier
  D.BODY_SCARE = { power: 30, cooldown: 9, energyCost: 9 };  // your pop-out from a peek door

  /* ---------------- scare school (bible §6.2) ----------------
     Six techniques the trade actually names, learned across the season. Each is a DIFFERENT
     verb, not a reskin: what you do with your body between scares is the technique.
       instant — press it in the window (the pop, the slider)
       charge  — a condition you hold in the room, banked and spent (stalk, creep, scarecrow)
       hold    — a sustained chase you steer (the chainsaw)
     `unlock` is the night index it's taught on. */
  D.TECHNIQUES = [
    {
      key: 'pop', name: 'the pop', icon: '!', unlock: 0, kind: 'instant',
      power: 30, cooldown: 9,
      desc: 'through the curtain, on the beat. never say boo.',
      how: 'stand at a peek door and fire in the window.'
    },
    {
      key: 'stalk', name: 'the stalk', icon: '⟶', unlock: 2, kind: 'charge',
      power: 15, cooldown: 12, chargeRate: 0.55, chargeMax: 3.0, decay: 1.1, behindM: 7.5,
      desc: 'match their pace, stay behind them, let it get unbearable.',
      how: 'follow a group from BEHIND. the longer they feel watched, the harder it lands.'
    },
    {
      key: 'creep', name: 'the creep', icon: '◡', unlock: 4, kind: 'charge',
      power: 17, cooldown: 12, chargeRate: 0.7, chargeMax: 2.6, decay: 2.4, speedMax: 1.3, nearM: 9,
      desc: 'inhuman-slow, into the light, wrong at every joint.',
      how: 'move SLOWLY near them. any hurry and the spell breaks.'
    },
    {
      key: 'scarecrow', name: 'the scarecrow', icon: '†', unlock: 6, kind: 'charge',
      power: 20, cooldown: 16, chargeRate: 0.5, chargeMax: 3.6, decay: 4.0, nearM: 9, mustBeInRoom: true,
      desc: 'be a prop. be furniture. wait. (the trade calls it the scarecrow routine.)',
      how: 'stand DEAD STILL in the room with them — not backstage — and do not twitch.'
    },
    {
      key: 'chainsaw', name: 'the chainsaw run', icon: '⚙', unlock: 8, kind: 'hold',
      power: 9, cooldown: 20, drainPerS: 8, maxHoldS: 4.5, nearM: 7, pushPerS: 0.9, lowPitch: -0.04,
      desc: 'rev LOW, by the legs. held high it fails and everyone knows it.',
      how: 'hold E near them and AIM DOWN. it herds them forward — that is the point.'
    },
    {
      key: 'slider', name: 'the slider', icon: '↘', unlock: 11, kind: 'instant',
      power: 34, cooldown: 22, needSprint: true, wide: true, nearM: 8,
      desc: 'knee-plates. in at their feet. knott\'s invented it and never apologised.',
      how: 'SPRINT, then fire — it takes the whole group at once. the showpiece.'
    }
  ];
  D.TECH_STILL = 0.12;               // m/s under which you count as not moving at all
  D.COMEDY_RESET = { cooldown: 16, nerveHeal: 18, primeCost: 25 }; // the walkie gag (Q)

  /* ---------------- the little people: rig, look, poses. View-only except POSE.durs (sim reads those). ---------------- */
  D.RIG = {
    legH: 0.52, legW: 0.15, footL: 0.30,          // leg pivots at hip; foot merged into leg geo
    torsoW: 0.36, torsoH: 0.50, torsoD: 0.21,
    armH: 0.46, armW: 0.11,
    headR: 0.23, headY: 0.80,                     // head center, local to chest group
    barY: 1.85,                                   // nerve bar height
    stride: 1.35,                                 // meters of travel per full gait cycle
    swingLeg: 0.55, swingArm: 0.38, bobAmp: 0.028,// radians / radians / meters at full walk speed
    snapIn: 6,                                    // pose reaches full at poseT = 1/snapIn (sim-time, tape-true)
    release: 10,                                  // view-side blend chase rate out of a pose
    lodM: 20,                                     // beyond this, limbs+hair stop drawing
    joyArm: 1.6, joyBob: 0.05, crawlReach: 0.9, meltThrash: 0.5,
    capR: [0.2, 0.26, 0.16], bunR: 0.1,          // shared geometry, not per-guest (GC)
    speedWinS: 0.2                                // speed is averaged over a window, so a 15Hz
                                                  // co-op snapshot rate cannot pulse the gait
  };
  D.LOOK = {
    skins:  [0xf0cfa8, 0xe8c8a0, 0xd9b088, 0xc49a6c, 0xa8764e, 0x8a5c3a],
    hairs:  [0x2a1c10, 0x483020, 0x6a4a28, 0x8a6a3a, 0xb89858, 0x3a3a42, 0xd8d8d8, 0x7a2c1c],
    outfitShades: [0.78, 1.0, 1.22],              // quantized so materials pool
    pants:  [0x2e3440, 0x3a3226, 0x4a3a2c, 0x263042, 0x3c2e3a, 0x35402e],
    capColor: 0xb0402c, bunColor: 0xdddddd
  };
  D.ARCH_BUILD = {                                 // per-archetype silhouette, multiplies D.RIG
    flannel:      { shoulders: 1.30, belly: 1.12, hat: 'cap' },
    dad:          { shoulders: 1.05, belly: 1.18 },
    grandma:      { shoulders: 0.82, stoop: 0.16, hair: 'bun' },
    kid:          { shoulders: 0.90, head: 1.30 },
    toocool:      { slouch: 0.10, phone: true },
    bachelorette: { hair: 'long', sash: true },
    chain: {}, date: {}
  };
  D.POSE = {
    durs: { flinch: 0.7, scream: 1.2, gotem: 1.6, dropped: 2.6, melt: 4.2 }  // sim reactT — sim.js reads these
  };

  /* timing grades (beat window, seconds from perfect center) */
  D.GRADES = [
    { id: 'perfect', within: 0.55, mult: 1.5, label: 'PERFECT' },
    { id: 'good',    within: 1.25, mult: 1.15, label: 'good' },
    { id: 'early',   within: 2.6,  mult: 0.55, label: 'early…' },
    { id: 'late',    within: 99,   mult: 0.3,  label: 'late.' }
  ];
  D.MISS_PRIME_LOSS = 8;

  /* ---------------- guests ---------------- */
  D.GUEST = {
    speed: 1.15, speedScared: 2.3, speedScaredS: 2.2, follow: 0.9,
    nerveRegen: 2.0,             // per second, toward pool max
    primeDecay: 1.6,             // group prime decay per second
    primeOnScream: 9, primeOnDrop: 12, primeContagion: 6,
    delightConvert: 0.42,        // fraction of scare magnitude banked as delight on recovery
    distressAt: -0.22,           // fraction of pool below zero => distress risk on a hard hit
    distressGraceS: 18,          // back off / rescue window
    congaGapM: 2.2, congaAfterS: 4.5, congaResist: 0.6,
    behindMult: 1.2, frontMult: 0.72,  // attention cone: scares from behind land harder
    chickenAt: 8                 // nerve below this near a chicken exit => bail chance
  };
  D.ARCHETYPES = {
    flannel:  { name: 'the flannel guy',   pool: 140, resist: 0.7, delightM: 1.5, size: 1.18, tint: 0xb0402c, rare: 0 },
    chain:    { name: 'the linked chain',  pool: 85, resist: 1.0, delightM: 1.1, size: 0.98, tint: 0x7fa0d0, rare: 0, linked: true },
    toocool:  { name: 'the too-cool teen', pool: 105, resist: 0.55,delightM: 1.0, size: 1.0,  tint: 0x556b5e, rare: 0, loudBreak: true },
    date:     { name: 'date night',        pool: 92, resist: 1.0, delightM: 1.2, size: 1.0,  tint: 0xc08ad0, rare: 0, paired: true },
    bachelorette:{ name: 'the bachelorette party', pool: 75, resist: 1.25, delightM: 1.3, size: 0.96, tint: 0xe6a4b8, rare: 0, flighty: true },
    dad:      { name: 'the dad',           pool: 130, resist: 0.5, delightM: 0.7, size: 1.08, tint: 0x8a7a5a, rare: 0, huh: true },
    grandma:  { name: 'the unscareable grandma', pool: 999, resist: 0.06, delightM: 2.2, size: 0.85, tint: 0xd8d0e8, rare: 0.06, immune: true },
    kid:      { name: 'the birthday kid',  pool: 48, resist: 1.3, delightM: 1.6, size: 0.7,  tint: 0xf0d060, rare: 0.1, soft: true }
  };
  D.GROUP_SIZE = [3, 7];
  D.SPACING = [                   // the risk dial (real seconds between pulses; fiction labels)
    { id: 'tight',    s: 9,  label: '30s pulses — pack the route',  fiction: '30s' },
    { id: 'standard', s: 14, label: '60s pulses — the house shot',  fiction: '60s' },
    { id: 'relaxed',  s: 20, label: '120s pulses — room to breathe', fiction: '120s' }
  ];

  /* thresholds on nerve (fraction of pool remaining) */
  D.REACT = { flinch: 0.75, scream: 0.5, gotem: 0.26, dropped: 0.06 }; // melt handled on dropped+overkill

  /* ---------------- the crew ---------------- */
  D.CREW = [
    { id: 'marcus', name: 'marcus',  style: 'chainsaw',   power: 30, skill: 0.62, energy: 80, wage: 60, rel: 0.72, friAbsent: 0.65, line: 'all gas. no fridays. he has games.' },
    { id: 'dee',    name: 'dee',     style: 'stalker',    power: 20, skill: 0.8,  energy: 95, wage: 60, rel: 0.95, friAbsent: 0.05, line: 'never leaves the hedge line. never has.' },
    { id: 'tater',  name: 'tater',   style: 'slider',     power: 34, skill: 0.7,  energy: 70, wage: 60, rel: 0.85, friAbsent: 0.1,  line: 'scare school certified. insufferable about it.' },
    { id: 'grace',  name: 'grace',   style: 'creeper',    power: 26, skill: 0.85, energy: 85, wage: 60, rel: 0.9,  friAbsent: 0.1,  line: 'quiet in the daylight. unbelievable in the dark.' },
    { id: 'bo',     name: 'bo',      style: 'jump',       power: 24, skill: 0.6,  energy: 90, wage: 60, rel: 0.92, friAbsent: 0.08, line: 'keeps apologizing mid-scare. the guests love him.', comfort: true },
    { id: 'priya',  name: 'priya',   style: 'distraction',power: 8,  skill: 0.9,  energy: 88, wage: 60, rel: 0.93, friAbsent: 0.12, line: 'reads groups like a bartender.', distract: true }
  ];
  D.CREW_ENERGY_PER_SCARE = 7;
  D.CREW_TIRED_AT = 25;            // below this, grades sag
  D.CREW_GRADES = { fresh: [0.25, 0.55, 0.15, 0.05], tired: [0.06, 0.3, 0.34, 0.3] }; // perfect/good/early/late odds

  /* ---------------- the season ---------------- */
  D.SEASON = {
    nights: [
      { id: 0,  label: 'soft open',   groups: 5,  fri: false },
      { id: 1,  label: 'oct 2 · fri', groups: 8,  fri: true },
      { id: 2,  label: 'oct 3 · sat', groups: 10, fri: false },
      { id: 3,  label: 'oct 4 · sun', groups: 7,  fri: false },
      { id: 4,  label: 'oct 9 · fri', groups: 11, fri: true },
      { id: 5,  label: 'oct 10 · sat',groups: 13, fri: false },
      { id: 6,  label: 'oct 11 · sun',groups: 9,  fri: false },
      { id: 7,  label: 'oct 16 · fri',groups: 14, fri: true },
      { id: 8,  label: 'oct 17 · sat',groups: 16, fri: false, homecoming: true },
      { id: 9,  label: 'oct 18 · sun',groups: 11, fri: false },
      { id: 10, label: 'oct 23 · fri',groups: 17, fri: true },
      { id: 11, label: 'oct 24 · sat',groups: 19, fri: false },
      { id: 12, label: 'oct 30 · devil’s night', groups: 21, fri: false },
      { id: 13, label: 'oct 31 · HALLOWEEN', groups: 24, fri: false, finale: true }
    ],
    notePayments: [ { afterNight: 3, due: 900 }, { afterNight: 6, due: 900 }, { afterNight: 9, due: 1100 }, { afterNight: 12, due: 1300 } ],
    noteTotal: 4200,
    startCash: 650,
    ticket: { min: 12, base: 18, max: 28 },
    makeupPerNight: 25,
    photoSale: 6,                   // per dropped-with-flashcam
    compOnAlarm: 0.5,               // fraction of that night's drawer comped
    marshalFee: 75,                 // re-inspection when you fail thursday
    fogMortality: 0.16,             // per night, per fog station: chance it dies
    repairCost: 45,
    salvage: 0.5,                   // haul a station back out of a slot, get half the tier-1 price back
    guestGoal: 800                  // season guests target (our 8,000, scaled 1:10)
  };

  /* reputation deltas (per night, computed from tally) */
  D.REP = {
    scaryPerDrop: 2.2, scaryPerGotem: 0.8, scaryPerWalkby: -0.9,
    funPerDelight: 0.16, funPerComplaint: -6, funPerRescue: 2.5, funPerBounty: 8,
    max: 100
  };
  D.BOUNTY = 200;                   // the standing $200. trade-verbatim.

  /* endings: evaluated after night 13 */
  D.ENDINGS = [
    { id: 'soldout',  name: 'THE SOLD-OUT FINALE', test: s => s.notePaid && s.rep.scary >= 62 && s.rep.fun >= 62 },
    { id: 'ruthie',   name: 'THE RUTHIE WAY',      test: s => !s.notePaid && s.rep.fun >= 70 && s.rep.scary >= 55, town: true },
    { id: 'madeit',   name: 'MADE IT',             test: s => s.notePaid },
    { id: 'bankletter', name: 'THE BANK LETTER',   test: () => true }
  ];

  /* marshal thursday checklist */
  D.MARSHAL = {
    checks: [
      { id: 'exits',    label: 'exit signs lit, both chicken doors clear', costWeekly: 30 },
      { id: 'fog',      label: 'fog sources 6m+ from detectors, tier 2 max at detector nodes' },
      { id: 'route',    label: 'no dead stations blocking the route' }
    ],
    quote: 'the marshal has never smiled. the marshal is not wrong.'
  };
  D.ALARM = { fogThreshold: 2, chance: 0.5, lightsUpS: 20 };   // fog tier > threshold at detector node when fired

  /* the '96 thread — iron rules in the bible. never name her in a system message. */
  D.GHOST = { maxGroupsForSlowNight: 9, chancePerSeason: 0.9, minNight: 4 };

  /* night pacing */
  D.NIGHT = { leadInS: 6, tailS: 8, clockStart: 19 * 60, clockPerRealS: 3.2 }; // fiction minutes per real second

  /* ---------------- M5: the polish layer. view-only knobs — the sim never reads these. ---------------- */
  D.BUILD_MODE = { reach: 2.6, boardReach: 2.6, markerY: 2.5 };
  D.PROPS = { callSheet: [7.5, 12.34], dials: [4.2, 15.66] };   // the boards you walk up to on build day
  D.REPLAY = { fps: 12, preS: 3.4, postS: 2.8, holdS: 1.0, bufferS: 14, orbit: 0.38, radius: 5.4, height: 2.5 };
  D.CHATTER = { hearM: 18, dip: 0.62, blipGap: [2.6, 7.0], laughChance: 0.55 };
  D.HANDS = { popS: 0.78, leverS: 0.42 };
  D.WALKIE_GAP = 3.4;              // minimum seconds between ambient walkie lines (the feed is warmth, not spam)

  /* ---------------- game feel (view/UI only — the sim never reads this) ---------------- */
  D.FEEL = { veilMs: 420, doorsHoldMs: 1400, crossMax: 1.9 };
  D.STING = { countMs: 900, chimeDelayMs: 500 };
  /* ---------------- LIGHT & AIR — view-only. the sim never reads this block. ----------------
     ⚠️ NO SHADOW MAPS, ON PURPOSE. r128 MeshLambertMaterial multiplies ALL direct light by ONE
     global getShadowMask(), so a single shadow caster would DELETE every practical pool at once
     instead of raking it — a black hole punched through the room, not a rake. The grounding
     comes from BLOB contact discs instead. Do not add castShadow here without moving the
     receiving surfaces to Phong first, and shot-testing 17 per-fragment lights on an iGPU. */
  D.LIGHTING = {
    HEMI: { night: { sky: 0x232f52, ground: 0x1c150e, i: 0.44 },
            day:   { sky: 0xa8bcd8, ground: 0x8a7a5c, i: 1.05 },
            alarm: { sky: 0xeef2f8, ground: 0x767c84, i: 1.15 } },
    FOG:  { night: { c: 0x060410, d: 0.055 }, day: { c: 0x8ea2bc, d: 0.010 },
            alarm: { c: 0x30343a, d: 0.012 } },
    /* per-room gels. i = point intensity, dist confines the pool (a point light with no shadow
       shines THROUGH walls — a short throw is the only wall we can afford).
       flick = { a,fa: slow sine | b,fb: fast sine | tick: {chance,depth,lenS,gapS} } */
    ROOM: {
      entry:   { gel: 0xffd9a0, i: 1.90, dist: 9,   flick: { a: .04, fa: .40 } },
      corn:    { gel: 0xff9d4a, i: 1.47, dist: 8.5, flick: { a: .10, fa: .27 } },                  // breathing
      dinner:  { gel: 0xff9a3e, i: 1.33, dist: 8,   flick: { a: .07, fa: 1.1, b: .05, fb: 6.3 } }, // candle waver
      surgery: { gel: 0x9fd4ff, i: 1.26, dist: 8.5, flick: { a: .02, fa: .9,
                 tick: { chance: .45, depth: .55, lenS: .10, gapS: 3.0 } } },                      // fluorescent dropout
      passage: { gel: 0xff5a4a, i: 0.98, dist: 5,   flick: { a: .18, fa: .50 } },                  // dying red sag
      clown:   { gel: 0xff8fd0, i: 1.47, dist: 9,   flick: { a: .08, fa: .90 } },                  // wrong-cheerful bounce
      cellar:  { gel: 0x7f9aff, i: 1.09, dist: 8,   flick: { a: .12, fa: .33 } },                  // furnace throb
      last:    { gel: 0xffd98f, i: 1.82, dist: 10,  flick: { a: .03, fa: .5 } },                   // warm relief
      lobby:   { gel: 0xffe9c0, i: 2.24, dist: 11,  flick: { a: .02, fa: .4 } }                    // rock steady. safe.
    },
    SPINE: { gel: 0xffd890, i: 1.45, dist: 10, decay: 1.3 },   // yours. warm. never scary.
    DECAY: 2,
    DAY:   { gel: 0xfff0d8, i: 0.5 },
    ALARM: { roomI: 1.7, roomDist: 26, gel: 0xf4f8ff,
             strike: [0, .35, .1, .8, .25, 1], strikeS: 0.9,   // a fluorescent tube stuttering awake
             recoverS: 2.5 },                                  // "the dark comes back on slow" — literally
    STROBE_SAFE: { ampCap: 0.05, slew: 1.2 },   // strobeOff: max flicker amp; max |dI/dt| per second
    CONE: { topR: 0.14, botR: 2.1, segs: 14, innerOp: 0.055, outerOp: 0.028, y: 2.7, sink: 0.9 },
    BLOB: { r: 0.42, op: 0.42, opAlarm: 0.15, opDay: 0.25 },
    MOTES: { perRoom: 44, perSpine: 22, size: 0.045, op: 0.5, fall: 0.08, wobble: 0.05,
             cullM: 22, depth: 2.6 },
    GHOST: { lift: 0.5, coneLift: 0.6 }         // her pulse is warm, not scary. bible §11.
  };


  /* view-only: hand-painted boards on the guest side, in the house voice.
     ⚠️ every 'at' sits on a REAL wall face (inner faces: z 2.18 / z 25.82 / x 45.82) and clear of
     D.ROUTE — dressRooms asserts both at boot and warns rather than shipping a sign in a doorway. */
  D.SIGNS = [
    { at: [6.5, 1.9, 2.2],   ry: 0,          lines: ['no touching.', 'either direction.', 'house rule.'] },
    { at: [16, 1.9, 2.2],    ry: 0,          lines: ['please stay out', 'of the corn.', 'the corn was here first.'] },
    { at: [27.5, 1.9, 2.2],  ry: 0,          lines: ['dinner is served', 'nightly. it is', 'never finished.'] },
    { at: [38.5, 1.9, 2.2],  ry: 0,          lines: ['the doctor is in.', 'the doctor has', 'always been in.'] },
    { at: [40, 1.9, 25.78],  ry: Math.PI,    lines: ['the town asked', 'for this room.', 'the town knows what it did.'] },
    { at: [27, 1.9, 25.78],  ry: Math.PI,    lines: ['mind the step.', 'the step minds you.'] },
    { at: [14, 1.9, 16.22],  ry: 0,          lines: ['you made it.', 'everyone makes it.', 'that’s the point.'] },
    { at: [3.5, 1.9, 16.22], ry: 0,          lines: ['cocoa is free.', 'the jar takes tips.', 'bo says hi.'] },
    { at: [-3.1, 0.95, 11.75], ry: Math.PI,  lines: ['tickets. scares included.', 'courage not sold separately.'] }
  ];

  /* ---------------- the yard: what you see coming up route 9 (view-only) ---------------- */
  D.YARD = {
    marqueeAt: [-1.2, 3.1, 7], marqueeWord: 'SCREAM BARN', litLetters: [0, 1, 5], buzzLetter: 2,
    lightSpans: [                       // string lights: [x0,y0,z0, x1,y1,z1, bulbs]
      [-1.2, 2.9, 7, -4.4, 2.1, 11.9, 8],
      [-4.4, 2.1, 12.6, -2.5, 1.6, 14.6, 6],
      [-2.5, 1.6, 14.6, -2.5, 1.6, 5, 14]
    ],
    fence: { x: -8.5, z0: 1, z1: 27, gapAt: 21, gapW: 3, posts: 12 },
    shedWindow: [-4.4, 1.35, 11.79]
  };

  /* ---------------- M6: co-op crew mode (bible §10) ---------------- */
  D.NET = { snapHz: 15, posHz: 10, maxSeats: 4 };

  /* ---------------- voice — lowercase, deadpan, warm ---------------- */
  D.VOICE = {
    walkboys: ['copy.', 'on it.', 'resetting.', 'in position.', 'they’re coming to you.'],
    huh: ['“huh.” — somebody’s dad', '“neat.” — the dad, devastating', '“is that it?” — a teen, lying',
      '“i seen worse at the mall.” — a man who has not', '“that’s good craftsmanship.” — the dad, appraising the panel'],
    dropped: ['DROPPED. the room applauds with its lungs.', 'down. gone. floor. beautiful.', 'that one’s going on the wall.',
      'straight down like a folding chair. perfect.', 'got got. GOT GOT.', 'that noise came from somewhere ancient.'],
    melt: ['they’re crawling. they’re CRAWLING. (they’re fine. they’re laughing.)',
      'melted into the floor. hall of fame. help them up in a second.',
      'that’s a puddle with a wristband. legendary.'],
    rescue: ['bo’s got them. lights up. cocoa’s on the house.', 'walked out the quiet door. still got a high five.',
      'quiet door, warm hand, no fuss. that’s the job.', 'they’re okay. they’re laughing already. that’s the whole religion.'],
    conga: ['conga line forming — they’ve merged. scare FORWARD, people.', 'that’s one giant unscareable organism now. nice work.',
      'two groups became one group. nobody’s scared of a parade.'],
    alarm: ['ALARM. lights up. fog dead. two hundred people looking at tater’s zipper.', 'the marshal was right. the marshal is always right.'],
    ghost: ['…nobody’s posted at that room. nice one, whoever that was.', 'chalk says one more than we counted. leaving it.'],
    grandma: ['she’s been coming since ’81. ruthie never got her either.'],
    bounty: ['THE BOUNTY. two hundred dollars. get the polaroid. get TWO.'],
    open: ['doors in five. breathe.', 'cast call: whoever’s here is the show. that’s always been the rule.'],
    finale: ['last night of the season. best night of the year. it always is.'],

    /* --- M5 additions: the feed finally talks about the night you’re actually having --- */
    perfect: ['on the beat. right on the BEAT.', 'that’s the one. do that eleven more times.', 'clean. surgical. rude.'],
    streak: ['three on the beat in a row. somebody’s in the pocket.', 'you’re conducting now. the barn is an instrument.'],
    firstDrop: ['first one down. the night has a pulse.', 'that’s one. the chalk gets its first mark.'],
    quiet: ['it’s gone quiet out there. quiet is where they get brave.', 'nothing in four rooms. let’s put a noise somewhere.',
      'the barn hums when nobody’s screaming. don’t let it hum.'],
    walkbyBad: ['three walk-bys. the panel is dropping on empty hallway.', 'we’re scaring the plywood. wait for the leader.'],
    polaroid: ['flash caught the whole row of them. that’s wall material.', 'got the picture. their grandkids will see that face.'],
    chicken: ['someone took the quiet door. no shame in the quiet door.'],
    fogDead: ['fog machine’s down again. they always are. it’s in their nature.'],
    lateNight: ['past eleven. the crowd gets braver and the crew gets funnier.', 'late shift. this is when the good screams happen.'],
    lastGroup: ['last group of the night is inside. make it count.'],
    kidGroup: ['little ones in this batch. soft hands. big smiles. bo’s got the room.'],
    crew: {
      marcus: ['marcus revved LOW. he listens. sometimes.', 'that chainsaw came in at knee height. textbook.'],
      dee: ['dee never moved and they still felt watched. that’s the craft.', 'nobody saw dee. everybody felt dee.'],
      tater: ['tater slid. tater will tell you about it for a week.', 'the slider hit and the whole row went sideways.'],
      grace: ['grace did the slow one. the room forgot how to breathe.', 'grace is quiet in the daylight. this is not the daylight.'],
      bo: ['bo got one and apologized. they loved it.', 'bo scared them AND checked on them. what a guy.'],
      priya: ['priya’s got their eyes. hit the other side. NOW.', 'she’s holding their attention like a hostage. go.']
    },

    /* --- build day, walking the barn --- */
    build: ['the barn in the daylight. smaller. dustier. yours.',
      'route’s clear. slots are marked. spend the drawer.',
      'ruthie kept the good drop panel in the corn. it still works.'],
    installed: ['bolted in. give it a tap. it’ll hold.', 'that’s live now. mind your fingers on show night.'],
    tape: ['rolling the tape. the good one.']
  };

  g.HAUNT = g.HAUNT || {};
  g.HAUNT.DATA = D;
})(typeof globalThis !== 'undefined' ? globalThis : window);
