# THE HAUNT
### the scream barn · route 9 · hazel park — a DIRTY BOY DEVS game
**v0.9.0 · 2026-08-18 · built in Cowork · design contract: `THE-HAUNT-BIBLE.md` (read it before changing anything)**

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

## DEV

- `parts/` — all source, plain namespaced scripts (window.HAUNT.*), zero build deps.
  Load order: rng → data → audio → sim → barn3d → view → player → ui → game.
- `node build.mjs` — concatenates parts + three.js r128 UMD into `the-haunt.html`.
  (Dev deps: `npm i three@0.128.0`; for the smoke test also `npm i playwright`.)
- `dev.html` — dev shell (script tags, uses node_modules/three). `index.html` is the BUILT game
  (same bytes as `the-haunt.html`) so GitHub Pages serves it at the clean URL.
- **`node test-sim.mjs` — the referee. 22 checks: determinism, throughput at all three spacings,
  drop-rate bands (perfect play ≈ 20% dropped, melts rare, complaints 0), crew autopilot,
  soft-scare safety, alarm repro, the '96 rules, season economics. Balance changes ship with
  these numbers or they don't ship. ALL TUNING LIVES IN `parts/data.js`.**
- `node smoke.mjs` — headless-Chromium run of the real build: title → season → build → cast call
  → live night (fires a real body scare) → sting → endings, screenshots, zero-console-error gate.

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
- ⬜ **M5 polish** — walk-the-barn build mode, replay theater, more set dressing per room, body-scare
  animations (monster hands), guest chatter voice pass, more walkie lines.
- ⬜ **M6 co-op crew mode** — PeerJS, 2–4, friends man the zones. Sim is already host-authoritative-ready.

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

*The barn's been dark since '99. Doors in five. Breathe. — DBD*
