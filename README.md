# THE HAUNT
### the scream barn · route 9 · hazel park — a DIRTY BOY DEVS game
**v0.10.0 · 2026-08-19 · design contract: `THE-HAUNT-BIBLE.md` (read it before changing anything)**

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

## DEV

- `parts/` — all source, plain namespaced scripts (window.HAUNT.*), zero build deps.
  Load order: rng → data → audio → sim → barn3d → **replay** → view → player → ui → game.
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
- **`node test-replay.mjs` — the tape, 13 checks.** The load-bearing one is #1: a *recorded*
  night must be byte-identical to an unrecorded one. The recorder only ever READS the night.
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
- ⬜ **M6 co-op crew mode** — PeerJS, 2–4, friends man the zones. Sim is already host-authoritative-ready.

Not in M5 and deliberately left: replay *theater* is one take per night, held in memory only —
saving tapes across sessions would need a compact on-disk format and a save-version bump.

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

*The barn's been dark since '99. Doors in five. Breathe. — DBD*
