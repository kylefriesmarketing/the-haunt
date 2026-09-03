# THE HAUNT
### the scream barn · route 9 · hazel park — a DIRTY BOY DEVS game
**v0.11.0 · 2026-09-01 · design contract: `THE-HAUNT-BIBLE.md` (read it before changing anything)**

> You don't survive the haunted house. You RUN it. Design the maze between weekends, then get in
> the walls on show nights — drop the panel on the beat, sprint the reset paths, and watch the
> town walk out laughing. The note is due by Halloween.

## PLAY

**Live link (shareable):** https://kylefriesmarketing.github.io/the-haunt/ — after the first
`PUSH-HAUNT.bat` run (see DEPLOY below). Or **double-click `the-haunt.html`** — single file, no
server, no internet. Saves live in your browser under the key `haunt-save`.

**Controls:** WASD move · SHIFT run · mouse look (click to lock) · **E** fire the station / THE POP
(through a peek curtain) / walk a too-scared guest out · **Q** the comedy beat (resets a rattled
room, costs prime) · ESC menu.

**How a night works:** you live in the SPINE — the backstage corridor the guests never see. Watch
their nerve bars through the walls (backstage vision), listen for the beat (the cue ticks faster
as a group closes on a scare node — the whole game is playable by ear), and fire inside the window:
PERFECT > good > early > late. Landed scares PRIME the group; primed groups drop harder; misses
are punchlines ("huh." — somebody's dad). Dropped guests convert fear to DELIGHT — the score that
matters. Someone past scared? BACK OFF and walk them out (E) — every guest leaves laughing, that's
the house religion, and the reviews know the difference.

**The season:** soft open + 13 October nights. Between nights: buy/upgrade/repair stations, assign
the six teens to zones (they have lives — Fridays, homecoming, no-shows), set ticket price and
pulse spacing (tight = more money, less reset time, conga-line risk), and mind **Marshal Thursday**
— tier-3 fog at a smoke detector WILL get shut off, and if it trips mid-night the alarm kills the
fog, the soundtrack, and the dark, all at once. Endings depend on the note, SCARY, and FUN.
The $200 bounty stands all season. The scare-cam polaroids pin to the lobby wall and export as PNGs.

**Build day, walked.** Pick *build day — walk the barn* and you're on your own porch in the
morning light. Walk the route, stand at a slot and **E** to build/upgrade/repair/haul-out, read
**the call sheet** on the spine wall to assign the teens, and the **clipboard** by the lobby for
spacing and ticket price. **C** for the old menus, **ENTER** for cast call, **ESC** for the menu.
Everything you can do from a chair you can do standing in the room it happens in.

**The tape.** At the drawer count, hit **▶ roll the tape** — the night's biggest scare plays back
on a slow cinematic arc with VHS grain, timecode and the room's name. Any key stops it.

**The crew (co-op, 2–4).** 🕯️ on the title screen. One of you hosts — it's their barn, their note,
their build — and reads out a four-letter code; everyone else knocks. Then you're all in the walls
together: you'll see each other backstage as hooded silhouettes with name tags, you'll hit the same
corridor at the same time, and a panel will drop on nobody at least once. The host opens the doors
and everybody comes in; when the last group's out, the crew sees the chalkboard and waits for the
next night. Drop in mid-show, leave whenever — the barn keeps running either way. **PvE only.**

## DEV

- `parts/` — all source, plain namespaced scripts (window.HAUNT.*), zero build deps.
  Load order: rng → data → audio → sim → barn3d → **replay** → **net** → view → player → ui → game.
  ⚠️ PeerJS is fetched from a CDN **lazily, only when somebody opens the co-op lobby** — single
  player keeps its "boots from file:// with no network" property. Don't move that to a `<script>` tag.
- `node build.mjs` — concatenates parts + three.js r128 UMD into `the-haunt.html`.
  (Dev deps: `npm i three@0.128.0`; for the smoke test also `npm i playwright`.)
  ⚠️ no `node_modules`? recover three.min.js from the shipped file — it's the first inline
  `<script>` in `index.html`, byte-for-byte the r128 UMD build. No network needed.
- `node serve.mjs 8478` — static server for `dev.html` (and the shot receiver, below).
  `dev.html` is the dev shell; `index.html` is the BUILT game (same bytes as `the-haunt.html`)
  so GitHub Pages serves it at the clean URL.
- **`node test-sim.mjs` — the referee. 22 checks: determinism, throughput at all three spacings,
  drop-rate bands (perfect play ≈ 20% dropped, melts rare, complaints 0), crew autopilot,
  soft-scare safety, alarm repro, the '96 rules, season economics. Balance changes ship with
  these numbers or they don't ship. ALL TUNING LIVES IN `parts/data.js`.**
- **`node test-replay.mjs` — the tape, 20 checks.** The load-bearing one is #1: a *recorded*
  night must be byte-identical to an unrecorded one. The recorder only ever READS the night.
- **`node test-net.mjs` — co-op, 53 checks.** Drives the REAL `net.js` over in-memory wires
  (`Net.test.pair()`, whose `send()` round-trips through JSON like the real transport) against a
  REAL night. The load-bearing one is §5: **a watched night is byte-identical to an unwatched
  one** — broadcasting must never perturb the sim. Also proves seats, per-monster cooldowns,
  snapshot fidelity, that the host refuses junk off the wire, and that a mid-night drop doesn't
  stall the barn.
- `node smoke.mjs` — headless-Chromium run of the real build: title → season → walk-the-barn
  build (installs a station in-world) → clipboard → cast call → live night (fires a real body
  scare) → sting → the tape → endings, screenshots, zero-console-error gate.
- **`HAUNT.Game.step(dt)` runs ONE frame** exactly as the render loop does (sim + tape + view).
  Use it to drive the game headlessly — a browser pane suspends `requestAnimationFrame`, so
  without it nothing advances and the night looks frozen at t=0.
- **Screenshots:** the page photographs itself. With `serve.mjs` running:
  `fetch('/shot?name=x',{method:'POST',body:HAUNT.View.shot(1280,720)})` → `shots/x.png`.
  Render + `toDataURL` happen in ONE synchronous task on purpose — a WebGL drawing buffer is
  cleared on composite, and the preview pane never composites. Never pipe the base64 back
  through a tool result.

## DEPLOY

**Double-click `PUSH-HAUNT.bat`.** First run: creates the private→public repo
`kylefriesmarketing/the-haunt`, pushes, turns on GitHub Pages. Every run after: commits whatever
changed and pushes — the live link updates itself in ~a minute. Pure .bat (no PowerShell, per
workspace law). Live at **https://kylefriesmarketing.github.io/the-haunt/**.

## STATUS (bible §15 milestones)

- ✅ **M0 the slice** — beat windows, the pop, reset sprints, visible nerve: it's fun in graybox.
- ✅ **M1 the night** — full pulse loop, grades, misses-as-jokes, drawer + chalkboard + best-scare.
- ✅ **M2 the barn (menu build)** — 10 slots / 7 station types / tiers, dials, Marshal Thursday.
- ✅ **M3 the crew** — six teens, zone assignment, absences (Fridays, homecoming), energy, Priya's
  distraction, Bo's rescues, Dee's aura.
- ✅ **M4 the season** — 14 nights, the note, SCARY/FUN, 4 endings, the '96 thread, endless October,
  fog mortality, polaroid wall + PNG export, soft-scare family hour, strobe-off + reduced motion.
- ✅ **M5 polish** — walk-the-barn build mode (in-world slots, call sheet, dials, morning light),
  the replay theater (VHS tape of the night's best scare), a full set-dressing pass (~620 meshes:
  corn with leaves, a laid dinner table with lit candles, the squeeze's foam strips, balloons and
  a funhouse mirror, the cellar furnace, the backstage prop shelves), monster hands with a peek
  curtain that parts when you come through, the crowd murmur that DIPS as they close on a scare
  (bible §6.1's setup cue, audible), chatter/laugh/shush blips, and ~40 new walkie lines with
  real triggers (first drop, three-perfect streak, lulls, walk-by runs, per-crew banter, the hour).
- ✅ **M9 the first impression & the ceremony** — the title screen is a painted one-sheet (barn,
  moon, the marquee with its three surviving letters, ONE lit window because somebody is in the
  walls), every screen change crossfades through a veil instead of hard-cutting, DOORS is its own
  timecard beat, the chalkboard writes itself a line at a time while the drawer counts up under a
  chime, DELIGHT finally shows on the night HUD, the crosshair reads the beat, and each grade gets
  a plain-language body ("the panel dropped on nobody").
- ✅ **M8 set & skin** — the barn from the yard was a black void with two dots; it now has a gradient
  sky dome, a 320-star `Points` field (140 meshes → 1: the perf win that pays for the rest), a
  moon halo, treeline silhouettes, a real ROOF (backface-culled, so the interior is untouched),
  the marquee with its three surviving letters and one that buzzes, sagging string lights, a lit
  ticket shed, a fence and two trucks in the lot. Inside: per-room floors (dirt / rug / tile /
  concrete / circus paint / worn plank), three position-hashed wall variants, nine painted signs
  in the house voice, and a spine lined in raw plywood with penciled panel numbers, spike-tape
  lane markings at every peek door, and ruthie’s ALWAYS SCARE FORWARD stencil. **Zero new lights**
  — every glow is emissive plus an additive ground spill.
- ✅ **M7 the little people** — guests are rigged: torso/arms/legs/head, seeded skin+hair+outfit per
  guest id, a walk cycle driven by DISTANCE TRAVELED (so it is identical live, on the co-op wire
  and on the tape, including a paused tape), and eight reaction poses that read at 10 m — flinch,
  arms-overhead scream, got-em recoil, DROPPED folding-chair, melt-crawl, distress hugging knees,
  a loose joy walk-out, and the dad crossing his arms for "huh." Seven shared geometries, ~44
  pooled materials, 20 m limb LOD.
- ✅ **M6 co-op crew mode** — 2–4 monsters in one barn over PeerJS, **host-authoritative** (bible §10:
  the host runs the one true sim, guests are renderers that send thin intents). Room code, roster,
  seats capped at 4, per-monster pop/comedy cooldowns, you see each other backstage as hooded
  silhouettes with name tags, shared walkie feed with attribution, drop-in mid-night, and a guest
  leaving never touches the barn. PvE only — there is no PvP path in the code.

Not shipped and deliberately left: replay *theater* is one take per night, held in memory only
(saving tapes would need an on-disk format and a save-version bump); co-op guests can't build —
it's the host's barn, their note, their drawer.

## TRAPS (read before touching)

1. **The sim is sacred.** `parts/sim.js` imports nothing, touches no DOM, and must stay
   deterministic (seeded rng only — no Math.random, no Date.now). `node test-sim.mjs` before AND
   after your change.
2. **All numbers live in `parts/data.js`.** If you're typing a constant anywhere else, stop.
3. **Never confirm Ruthie.** The ghost event is kind, slow-nights-only, unexplained, and the walkie
   lines never name her. This is bible §11 iron law.
4. **No gore, no PvP, no touching guests.** House law + bible §0. The distress→rescue loop is the
   soul mechanic — don't optimize it away.
5. **The single file is the product.** After any change: `node build.mjs`, then open
   `the-haunt.html` fresh (hard-reload — old saves persist by design).
6. **three.js is pinned at r128 UMD** on purpose (window.THREE, works from file://). Don't upgrade
   casually — r160+ drops the UMD build the single-file packaging depends on.
7. **The tape only READS the night.** `parts/replay.js` must never call into the sim or mutate a
   guest. `test-replay.mjs` check #1 is the guard; if it ever fails, the recorder grew a side
   effect and every balance number in the game is suspect.
8. **The pose lives in ONE place.** `Replay.poseOf(guest)` is what both the live view and the tape
   read. Duplicate it and the replay silently stops matching what the player saw.
9. **Pointer lock needs both guards.** `wantLock` (our intent) *and* the 400 ms `lockAt` grace, or
   the browser's own delayed `pointerlockchange` echo pops the build menu behind a panel you just
   closed. Every lock request goes through `Player.lock()`, which swallows the promise rejection.
10. **Anything on `view.group` that build mode adds, night mode must clear** — `setBuildMode(false)`
   and `setDaylight(false)` are called on BOTH exits (cast call and leaving the walk).
11. **Co-op is host-authoritative, NOT lockstep.** There is exactly one sim, on the host. A guest
   holds a `GAME.shadow` — a read-only stand-in shaped enough that the HUD, the prompt and
   `Player.context` work unchanged — and sends intents. Never add a second sim; never make a
   guest "predict" a scare. If you find yourself needing determinism across clients, you've
   drifted from the design.
12. **The host trusts nothing off the wire.** `hostApplyCmd` checks every id against the real barn
   before it touches the sim (`test-net.mjs` §6). Keep it that way.
13. **`Player.actor` is who you are** — `'you'` solo, `'s0'`…`'s3'` in co-op. Cooldowns and scare
   attribution key off it. If it's wrong, one monster gags another and the sting credits a ghost.

*The barn's been dark since '99. Doors in five. Breathe. — DBD*

## Trap 14 — the barn has no shadow maps, and that is a decision (v0.12.0)

r128 `MeshLambertMaterial` multiplies **all** direct light by ONE global `getShadowMask()`.
Every floor, wall and prop here is Lambert, so a single shadow-casting light would not *rake*
a light pool — it would **delete** every practical at once wherever a caster stood, punching a
black hole through the room. The designed "conspirator" spot and the build-day sun were both
cut for exactly this reason. Grounding comes from **blob contact discs** instead (one flat
additive-free quad per body, scene-parented, `y = 0.02`).

If you ever want real shadows: move the *receiving* surfaces to `MeshPhongMaterial({shininess:0})`
first — Phong is per-light — and shot-test 17 per-fragment lights on an iGPU before you ship it.

Two smaller r128 facts from the same audit, so nobody re-derives them:
`SpotLightShadow.updateMatrices` overwrites `camera.far` from `light.distance` every frame (the
"idle a light by collapsing its frustum" trick is a no-op — use `shadow.autoUpdate = false`), and
a **black** texture under `AdditiveBlending` renders nothing at all, silently.

## Trap 15 — `updateLighting()` is the ONLY writer of light intensity, colour and fog

`V.setDaylight` sets a flag and swaps the sky; it no longer touches a single light. The old
alarm `_keep` store/restore, the global flicker sinusoid and the direct-write ghost pulse were
three writers fighting over `pl.intensity` — that is how the `_keep` hack was born. Add a
fourth and they will fight again.

⚠️ **The alarm is held by `night.alarm.until`, not by `active`.** `sim.tick` clears `active` on
the next tick, so a test that writes `alarm.active = true` every frame makes the mode ping-pong
night↔alarm and never settles — it looks exactly like a broken strike envelope. Set
`alarm.until = night.t + 60` to hold it.

## Trap 16 — the six trade verbs, and why the CREEP KEY is a mechanic (v0.13.0)

`D.TECHNIQUES` finally has a kernel behind it. `parts/sim.js` gained `N.setActor` /
`N.setTechnique` / `N.triggerTech` / `N.holdStart` / `N.holdEnd` / `N.dropActor` and an
`actorTick()` that runs once per sim tick, right after `crewTick()`.

**Actor kinematics are INPUTS, exactly like `triggerStation`** — same seed plus the same
input script is the same night. Run `node test-tech.mjs` after ANY edit in that block.

⚠️ **`D.PLAYER.creep` (Ctrl, 1.05 m/s) is load-bearing, not a comfort feature.** The stalk
demands you match guest pace (1.15 ± `paceTol`) and the creep demands you stay under
`speedMax` 1.3. A player who can only walk 3.6 or sprint 5.6 satisfies neither, and two of
the six verbs ship as pure decoration. Any change to those speeds must be checked against
both gates.

⚠️ **THE NO-RNG LAW.** Nothing in the technique kernel may consume `rng`. A charge is pure
skill, so an actor who charges to full all night and never fires must leave the tally and the
drawer byte-identical (`test-tech.mjs` T13 is the guard). Break this and every replay bottle
and every co-op session desyncs the moment somebody holds a charge.

⚠️ **`setActor` records the WANTED position, never the accepted one.** `actorTick` clamps it
into `D.BARN` and rate-limits the step to `TECH.posSpeedMax` on the 30 Hz sim clock, then
derives speed from the accepted step. Two reasons, both load-bearing: the host must not trust
a position off the wire (trap 12 — a seat could otherwise pose itself inside a group from
anywhere), and host and guests have to measure speed on ONE clock. Deriving it from render
`dt` on one side and snapshot arrival on the other makes the same run pass a gate for one seat
and fail for another. For the same reason `sprinting` is NOT sent: it is derived.

⚠️ **`hitGuest`'s `floor` argument.** A discrete hit floors at 1 damage. A continuous drain
(the chainsaw, 30 ticks a second) passes **0** — with a floor of 1 the saw would deal 30/s to
exactly the guests the soft-scare and immune clamps exist to protect. `test-tech.mjs` T11 is
the guard: family hour must survive a full saw run at zero complaints.

⚠️ **A held technique's magnitude is an INTEGRAL over seconds.** `endHold` divides by
`TECH.holdMagDiv` before it competes with instantaneous pops, or one chainsaw run wins
best-scare and the tape every single night. It also stamps `atT` with the run's START — `R.mark`
centres a take on the stamped time, and stamping the end centres the tape on the aftermath.

⚠️ **Cooldowns are now keyed `who + ':' + techKey`.** The wire field (`bd`) is unchanged, only
the keys got richer. If you ever read `bodyReadyAt[actor]` with a bare actor id again, it will
silently always be ready.

⚠️ **`V.reducedMotion` is a GETTER.** A plain `V.reducedMotion = reducedMotion` at module scope
captures `false` at load and every later toggle is ignored forever.
