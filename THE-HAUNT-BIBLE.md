# THE HAUNT
### a haunted-attraction operator flagship · a DIRTY BOY DEVS game
**design bible + build contract v1.0 — 2026-08-18 — research-complete: 3 deep sweeps (the real haunt trade, 15-comp teardown, audience/market) run 2026-08-18. Every design law below traces to a finding. Built in Cowork starting this session; this file is the contract any future session builds against.**

> **You don't survive the haunted house. You RUN it.** Design the maze between weekends. Then, on show nights, get in the walls and perform it — trigger the drop panel on the beat, sprint the reset paths, play three monsters at once, and watch the camera wall to see your scares LAND. Scaring people is a trade. October is payroll. Every guest walks out laughing — that's the whole religion.

**Working title THE HAUNT** (it's what the trade actually calls an attraction). Shortlist for Kyle: **THE HAUNT · SCREAM BARN · DROPPED · DARK SINCE '99.** Strike freely.

---

## 0. LOCKED DECISIONS

| # | Decision | Call |
|---|---|---|
| 1 | Platform | Web, three.js, vanilla ES modules, no build step — the house flagship stack (FRESH CUT / TRUCK pattern) |
| 2 | Project home | `the-haunt/` at the workspace root. Repo on day one (roadmap law) |
| 3 | Shape | **First-person live-operation** on show nights + light build/manage layer between nights. NOT a top-down tycoon — that lane is ScareZone's, and it's the weak half of the fantasy (§1.3, §1.4) |
| 4 | Player fantasy | Builder-performer. You author the scares AND you're in the walls pulling triggers. The mastermind, never the janitor (§1.12) |
| 5 | Multiplayer | **Co-op PvE crew mode (2–4, PeerJS), architecture-ready day one, ships after SP** — FRESH CUT doctrine. **No PvP, ever** (§1.13) |
| 6 | Guests | AI only, per-guest visible nerve state, bulletproof pathing (§1.3, §1.8). No-touch both directions is LAW |
| 7 | Season structure | One barn, deepened across a 13-show-night October season (§1.9). Real-calendar October is a recurring ritual event, never a hard lock (§3 research) |
| 8 | Fiction | **The SCREAM BARN**, Route 9 past the fairgrounds, Hazel Park. Dark since '99. You sign the note; the town remembers '96 |
| 9 | Tone | Lowercase warm deadpan. PG-13 by iron rule. Toys don't bleed → **scares don't harm**. The McKamey line is the in-fiction moral wall (§2.5) |
| 10 | The '96 thread | A kind presence, never confirmed, never escalating, never harmful. MIRROR MIRROR restraint, verbatim (§11) |
| 11 | Sim/view split | Deterministic, seeded, headless-testable guest sim; ALL tuning in one `data.js` (LAST WATCH invariant culture) |
| 12 | Save | `haunt-save` localStorage, house contract fields from first commit (§14) |
| 13 | Audio | WebAudio synthesis only; audio is the star of the dread AND the timing game (cues are audible before they're visible) |
| 14 | Accessibility | Strobe-off + reduced-motion modes are launch requirements, not options — the real trade warns for a reason |

**The kill-gate slice, before art:** *one corridor, one drop panel, one air cannon, one group of four with visible nerve — is triggering scares on the beat from the walls, then reset-sprinting to the next position, fun for twenty minutes in graybox?* If yes, everything else is content. If no, kill it.

---

## 1. WHAT THE GENRE KNOWS — the comps digest

Fifteen games interrogated; the ones that bind, with our law under each.

**1.1 Ghost Master (2003, Metacritic 81, sold poorly, no successor for 20 years).** The be-the-scarer fantasy with a brilliant fear economy — scares raised mortals' *belief*, and belief amplified your later scares. Died of obtuse one-solution puzzle design, not of the fantasy. (A UE5 remake, *Ghost Master: Resurrection*, is in EA now — the fantasy is being revalidated as we build.)
→ **Our law:** steal the escalation economy — **landed scares prime the group; primed groups drop harder** — and keep every system sandbox-readable. No hidden formulas, no single solutions.

**1.2 Haunt the House: Terrortown (87%, ~2.4K reviews).** One possession verb + a visible scare meter = instant feedback and a genuinely cozy scare tone. Exhausted in 90 minutes.
→ **Our law:** visible per-guest nerve meters give instant feedback (the game's whole readability). But one verb is a toy — the build/perform/season braid is what makes it a game.

**1.3 Horror Tycoon (2022 EA, 62% Mixed, 90 reviews — the direct failed predecessor).** Steam review autopsy, verbatim top complaint: *"This is NOT a Tycoon game. It's Towerdefense with extra steps."* Players came for the operator fantasy and got wave defense; staff AI wouldn't walk into the haunt; guests clipped into walls; "no progression feedback or clear win/fail conditions." The positives all cling to the fantasy itself.
→ **Our law:** play the operator fantasy STRAIGHT. Real guests walking a real route, night-by-night win/loss (the drawer, the tally), and pathing that never embarrasses itself — **in a walkthrough attraction, every AI failure happens on camera.**

**1.4 ScareZone: Haunted Attraction Tycoon (announced; "drops this Fall" 2026, 9–12-month EA planned).** Closer than the store page first suggested: scare-sequence choreography, guest archetypes, actor rotation, seasonal cycles. But top-down management, single-player, disembodied — first-person exists only as a test-walk.
→ **Our law:** our moat is **embodiment and performance** — you, in the walls, live, on the beat, plus co-op crewing. Market that difference, never the build mode. The lane "first-person, run your haunt live on show night" is verifiably empty (searched Aug 2026) and won't stay empty past 2027. Move.

**1.5 Dead by Daylight, killer side (the genre's sole PvP survivor).** Killer joy = total authorship of another's panic: mindgames, corner-reads, dread control. Killer misery = PvP accountability — humiliation, taunting, "100% of the success is on you."
→ **Our law:** keep the mindgame (read the group, pick the corner, own the dread), delete the ego stakes. **AI guests give the power fantasy with zero humiliation loop** — the half of killer-side everyone wishes they could keep.

**1.6 Content Warning (6.2M free claims, 2.2M sold — then average CCU fell by half, monthly).** Film-your-friends'-scares-for-views made fear into comedy with a shareable artifact per session; retention collapsed because there was no system under the bit.
→ **Our law:** **score the performance and hand the player the artifact** — the end-of-night reel and the scare-cam polaroid (§9). And keep real depth under the bit.

**1.7 Five Nights at Freddy's.** Rigid numbered nights, short shifts, a triumphant 6 AM sting; terror lives in the anticipation window, not the jumpscare.
→ **Our law:** adopt the night structure wholesale — **short, escalating, numbered show nights with a ritual end-of-night sting** — and design every scare around the anticipation beat: **cue → glimpse → trigger** (§6).

**1.8 RollerCoaster Tycoon / Planet Coaster fear stats.** Fear-as-hidden-aggregate produced spreadsheet min-maxing and zero drama; the spooky DLC was cosmetic and inert.
→ **Our law:** fear is a **per-guest, real-time, visible state you watch spike through the wall.** Never an aggregate rating, never cosmetic.

**1.9 Two Point Museum (Metacritic 84; the modern warm-management standard).** Comedy delivered ambiently — PA voice, thought bubbles, staff quirks — and progression retuned to deepen ONE venue.
→ **Our law:** warmth through non-blocking channels (the walkie, guest thought bubbles, the crew's texts), and **one barn deepened across the season**, not venue-hopping.

**1.10 PlateUp! (1.5M+; prep phase → service rush → roguelite persistence).** The service-night bible: roles self-assign under pressure; failure is loud, shared, hilarious.
→ **Our law:** the **build-day → show-night weekend loop** is our heartbeat, and in co-op, roles emerge (trigger op, floater, live monster) — no classes. Blown scares are jokes, not punishments.

**1.11 WarioWare / Rhythm Heaven.** Every microgame is a joke: setup, ~5-second beat, punchline animation for success AND failure; tight windows feel great when the cue is audible.
→ **Our law:** **every scare is setup–beat–payoff**, the beat window is audible, and the missed scare gets real animation budget — a guest strolling past your sad late skeleton IS the punchline (§6.4).

**1.12 Dungeon Keeper / Evil Genius 2 (75 MC, "~53% positive"; "more like the evil genius' butler").** Charm can't be wallpaper over busywork.
→ **Our law:** the player is the **author of scares, never the janitor.** Every management chore gets automation, delegation, or a joke — usually delegation to a teen with a personality.

**1.13 The PvP asymmetric-horror graveyard (F13 dead 12/2024 · VHS dead 9/2023 · Propnight dead 1/2024 · TCM: 17K peak → ~374 average, updates ended 2025).** Four structural killers: queue-ratio collapse (everyone wants to be the monster), unsolvable coordinated-vs-random balance, the power role as toxicity sink, an unwinnable content treadmill against DbD. Meanwhile co-op PvE horror compounds: Phasmophobia 20M+, Lethal Company ~10M, Content Warning 8.8M players, R.E.P.O. 200K+ CCU.
→ **Our law:** **co-op PvE only.** Everyone gets to be the monster; the victims are AI and never log off. This is the escape hatch from all four killers at once, and it is final.

**1.14 Roblox haunt tycoons (~800K visits on the current one).** Kids already choose this fantasy at conveyor-clicker depth — zero scare craft.
→ **Our law:** be the first game where **the CRAFT of scaring — timing, sightlines, routes — is the actual game**, readable by a 13-year-old and a 35-year-old at once.

**1.15 The window.** Ghost Master Resurrection (consoles 3/2026), ScareZone (fall 2026), IllFonic's Halloween (9/2026) — three adjacent releases inside 12 months. Nothing occupies our exact lane.
→ **Our law:** ship the slice fast, own "you're the one behind the wall" in public before 2027.

---

## 2. WHAT THE TRADE KNOWS — the haunt-industry digest

The real industry, researched from trade sources (HauntWorld, HauntPay, Nevermore Haunt's actor manual, America Haunts, NFPA fire-code guides, working-actor interviews, *Haunters: The Art of the Scare*). This is the authenticity layer — the game's mechanics ARE the trade's mechanics.

**2.1 The craft.** Scare roles, real taxonomy: **Jump Scare** (never say "boo"), **Distraction Scare** (the setup half of a two-actor team), **Stalker** (silent following), **Creeper** (inhuman body language), **Voice**, plus queue-line **Roamers**, **Sliders** (knee-plates and gloves, sliding into guests' faces — invented at Knott's Ghost Town), **Chainsaw** (rev low by the legs — held high it fails). Misdirection is doctrine: *"one actor distracting the victims while the other one goes in."* The fallback ladder when a scare fails: direct scare → **comedic relief to reset the patron** → gross-out, last resort. Timing is everything: *"Learn when someone isn't looking at you and how quickly you can approach."* Target doctrine: skip the terrified — *"aim for the big, burly, bearded guy in flannel."* Restraint doctrine: *"Know when to quit. If you've got someone hyperventilating on the floor, back off."* Costume commandments: *"NEVER DROP CHARACTER. Ever."*
→ **Our systems:** the scare-verb families (§6.2), two-part distraction scares (§6.3), the comedy-reset fallback (§6.4), flannel-guy targeting (§7), and the restraint meter (§6.6) are all lifted straight from this.

**2.2 The operational geometry.** **"Always scare forward"** — hit from the sides and behind so guests flee TOWARD the exit; scaring backward causes **conga lines** (groups bunching into one chain — the industry's disease). Actors build a **circular reset path** — a hidden route back to position — and reset in the 30–120-second gap between groups.
→ **Our systems:** scare *direction* is mechanical (§6.5): backward-facing scares stall flow and breed conga lines on your camera wall. The **reset paths are the player's parkour** — you sprint them between groups, and designing bad reset routes hurts YOUR OWN night (§9.1). This finding is the whole movement game.

**2.3 The math.** Groups of **8–10**, spaced **30–120 seconds**; hourly capacity = (3600 ÷ spacing) × group size; at $20 tickets a good haunt clears **$10K–$30K a night**. The **$21–30 ticket** bracket is the 2025–26 standard (small-town Midwest/South averages $19.64–$22.14). A "successful" haunt draws **~8,000 guests a season** (80% of the 1,200 pro haunts draw 7,500–10,000). Actor pay: **$50–75/night** current postings. A big haunt burns **$6,500/year on makeup and fake blood** and ~$50K on insurance; owners bridge the off-season on credit lines. *"You're only making money for a month. The rest of the year you're just spending money."*
→ **Our systems:** the spacing dial IS the risk dial (§9.3) — tighter pulses = more drawer = less reset time. Season target 8,000. All dollar tuning starts from these real numbers in `data.js`.

**2.4 The rules.** Haunts are **"special amusement buildings"** under NFPA 101 — a code regime written in the blood of the 1984 Six Flags Haunted Castle fire (eight teenagers). Inspectors check: sprinklers, smoke detection, **low-level exit signs**, no dead-end pathways, flame-retardant everything, occupancy math — and the one that's pure game design: **tripping the alarm kills the soundtrack, the fog, and the strobes, and floods the room with light.** The **chicken exit** (early bail-out door) is real amusement-industry language. No-touch runs both directions. Opt-out tokens are real (Universal sold a "no-boo necklace" in 2025).
→ **Our systems:** Marshal Thursday (§5.2) is a playable checklist with real teeth; the **alarm-trip is the show-night disaster state** — fluorescent lights on a room full of guests mid-scare is the worst thing that can happen in this game, and it's TRUE (§6.7). Chicken exits are built, tracked, and judged (§9.1). Touching a guest = instant scare-fail + complaint. Always.

**2.5 The soul.** The industry's ethics line is **McKamey Manor** — the "extreme haunt" with the 40-page waiver that 80,000+ people petitioned to close; 40-year scare legend Shar Mayer: *"Anyone that you talk to in the industry... don't consider him part of the industry. I don't wanna do things to people that damage them for good."* The legitimate version of extreme has a safe word, full stop. Why actors do it: *"Adults get to scream their heads off and be like little kids"* (Jon Schnitzer, *Haunters*). Sociologist Margee Kerr (employed by ScareHouse!) found haunted houses measurably **boost mood** — voluntary fear is bonding and joy. Trophy culture is real: actors say they **"dropped"** a guest, **"got"** them; a guest who crawls out **"melts into the floor"**; one San Antonio haunt keeps a standing **$200 bounty** for making a guest soil themselves, and ScareHouse has logged at least one.
→ **Our systems:** DELIGHT is the scored outcome, not terror (§7.2); over-scaring is mechanically punished (§6.6); the $200 bounty is in the game verbatim (§9.4); and the game's thesis is Kerr's science wearing a rubber mask: **fear, done right, is a gift.**

**2.6 The calendar & the body.** March is TransWorld in St. Louis ("400,000 SCREAM feet" of props for sale) → summer install → September soft-opens → October. Voices are gone by night two without diaphragm technique; ice vests under rubber suits; fog machines are *notoriously* short-lived; owners describe "constant repairs" all season; and the last night of the season is *"always the best day of the year."*
→ **Our systems:** crew energy/voice meters (§8), fog machines that break mid-night (§9.2), and the final-night ritual (§5.3).

**2.7 Verified glossary** (terms confirmed in trade sources — use these in-fiction): *dropped them · get got · melts into the floor · sliders · scare school · conga line · chicken exit · scarecrow routine · roamer / stalker / creeper · always scare forward · reset path · drop panel · air cannon.* Community terms we could NOT verify in citable sources (use informally, never in tutorial text): *boo hole, scare pocket.* Honesty note kept on purpose — the game's credibility with real haunters is worth protecting.

---

## 3. PILLARS

1. **The scare is a joke you perform.** Setup–beat–payoff with an audible timing window. Landing one is a punchline; missing one is a different punchline. (WarioWare law + trade misdirection doctrine.)
2. **You are in the walls.** First-person, backstage, sprinting reset paths between groups. The haunt is a machine and you are its moving part. Nobody else has this seat. (The empty lane, §1.4/§1.15.)
3. **The haunt is a machine you built.** Route, sightlines, scare placement, reset corridors — build days author the level you perform at night. Your best tool is architecture. (Horror Tycoon autopsy inverted.)
4. **Warm teeth.** Every guest walks out laughing — scored, not flavor. The note is due, the marshal never smiles, October is the whole year, and the town remembers '96. (FRESH CUT softness + TRUCK economics + Kerr's science.)
5. **The show must be watched.** Nerve meters through walls, the camera wall, the end-of-night reel, the scare-cam polaroid. Watching scares land is the applause — and the share artifact. (Nightmares Fear Factory + Content Warning laws.)

## 4. THE FICTION

**Hazel Park, October.** Route 9, past the fairgrounds, where SUNDAY DRIVER's calm road runs and STARLITE's screen would glow: **the SCREAM BARN.** Aunt Ruthie ran it from 1978 to 1999 — twenty-one Octobers, and the '96 season was the one they still talk about in church parking lots. It went dark the year she died, mid-season, and the barn has sat since: tarps, dust, a marquee with three letters left. You didn't inherit it — the county was going to take it, so you **signed the note.** (FRESH CUT gets the inheritance; the TRUCK doctrine holds here: the softness transfers, the absence of stakes does not.)

**The cast, proposed** (Kyle strikes/renames freely; town kids reused per cross-lore law):
- **The crew** — six local teens, hired at $60/night or volunteering for season passes: **Marcus** (chainsaw runner; all gas, no Fridays — he has games), **Dee** (natural stalker; never leaves the hedge line, never has), **Tater** (slider; certified at scare school, insufferable about it), **Grace** (voice/creeper; quiet in the daylight, unbelievable in the dark), **Bo** (jump; big, gentle, keeps apologizing mid-scare — the guests love him), **Priya** (distraction/straight-man; reads groups like a bartender).
- **Marshal Dale Prosser**, county fire marshal. Walks the route every Thursday with a clipboard and the 1984 fire behind his eyes. Has never smiled. Is not wrong.
- **The town:** the queue is Hazel Park — FRESH CUT clients, the TRUCK's regulars, the Lanes' league night crowd on their off night. The unscareable grandma has been coming since '81 and Ruthie never got her either.
- **Ruthie** — see §11. Never say her name in a system message.

## 5. STRUCTURE & LOOP

**5.1 The season (the campaign unit):** a September soft-open tutorial night, then **13 show nights** across October — Fri/Sat/Sun weekends escalating in crowd size, plus the final week's nightly run to Halloween. FNAF's numbered-night law wearing the real trade's calendar. Between real Octobers, the whole season is always playable; when it IS real October (client clock), the in-game season syncs its dates and the house doorway glows — ritual, never lock.

**5.2 The week loop (PlateUp law):** **BUILD DAYS** — spend the drawer: new scare stations into route slots, repairs (the fog machine died again), crew scheduling around their lives, route edits, and **Marshal Thursday** (walk your own route against the checklist: exits lit, no dead ends, occupancy, flame-retardant tags — fail an item and Friday opens partial or not at all). **SHOW NIGHT** — the performance (§5.3).

**5.3 Show night anatomy:** cast call (who actually showed — §8) → doors at dusk → you set the **pulse spacing** (30–120s: the risk dial) → the night runs ~6–8 real minutes of continuous groups → last group out → **the ritual sting:** drawer count, the chalkboard (*"dropped: 4 · melted: 1 · walk-bys: 2"*), the best-scare replay, the scare-cam polaroid pinned to the lobby wall. Night 13 is the finale the trade promises: *the last night is always the best night of the year.*

## 6. THE SCARE SYSTEM — the heart

**6.1 Anatomy of a scare: SETUP → BEAT → PAYOFF.** Setup: the group approaches a zone; an audible cue rises (their chatter dips, the floorboard creak you installed). Beat: a crisp timing window (visualized backstage as a tightening ring, heard as the cue peaking — audible-first per Rhythm Heaven law). Payoff: trigger inside the window and the scare lands at full force, with the guests' reactions as the animation payoff; early = they see it coming (nerve barely moves, too-cool teen narrates it); late = the sad flop (the panel drops behind them; somebody's dad says *"huh."* — full animation budget on this, it's the punchline).

**6.2 Scare verbs.** **Stations** (built, then triggered by you or crew): drop panel, air cannon, fog burst, sound sting, lights-out snap, the rattle chain, the dinner-table animatronic. **Body scares** (performed by you, learned at scare school across the season): the pop, the stalk (match the group's pace behind them), the creep (inhuman-slow into the light), the scarecrow (pose as a prop... wait), the slider (late unlock, the showpiece), the chainsaw run (rev LOW). **Voice** (walkie-thrown sounds into unstaffed rooms).

**6.3 The distraction doctrine.** Two-part scares are the craft ceiling: anything that holds ATTENTION (a Priya monologue, a glowing prop, a fake scare that "fails" on purpose) makes the REAL scare from the other side land at multiplier force. *"One actor distracts, the other goes in."* Mechanically: attention is a per-guest facing cone; scares from outside the cone hit harder; a primed distraction locks the cone.

**6.4 The fear economy (Ghost Master law).** Landed scares raise the group's **PRIME** — primed groups startle harder, chain-react (fear is contagious down a linked-arm chain), and drop bigger. Missed scares and long quiet gaps bleed PRIME. The night is a rhythm: build the prime, spend it on the big set-piece, let the comedy beat reset them, build again. When a scare fails, the trade's fallback ladder is playable: hit the comedy button (Bo waves) → reset the room.

**6.5 Scare direction (the conga law).** Every scare pushes guests in its flee direction. Forward scares = flow. Backward scares = the group backs into the next group = **conga line** — merged mega-groups that are nearly unscareabl​e, clog your route, and wreck throughput. The camera wall shows it forming. This one real rule generates the whole spatial puzzle.

**6.6 Restraint (the soul mechanic).** Per-guest, if NERVE bottoms out past DROPPED into genuine distress (hyperventilating, sitting down, the kid who's too young): **back off NOW** — route them to a chicken exit, send Bo (he's good at this), lights up in that room. Handled well: the review says *"they took care of my friend, 10/10, screamed the whole time."* Pushed instead: the complaint, the reputation hit, and the game quietly reminds you whose industry this is. There is no McKamey ending. It's not on the tree.

**6.7 The alarm (the disaster state).** Fog too thick near a detector, a blocked exit, an overloaded circuit: the alarm trips — **soundtrack dies, fog dies, strobes die, every light comes up fluorescent** — and two hundred guests stand blinking in a plywood room looking at the zipper on Tater's costume. Real code, worst moment, completely recoverable (reset the panel, comp the tickets, the town forgives one). Nothing else in the game hurts like it, and nothing else is this true.

## 7. THE GUESTS

**7.1 Groups** of 4–8, pulsed at your spacing, walking your route. Archetypes (composable): **the flannel guy** (huge nerve pool; dropping him is the room's applause — target doctrine says he's the real prize), **the linked-arm chain** (fear conducts down it), **the too-cool teen** (narrates until they break; breaks LOUDEST), **date night** (each performs bravery for the other; scare one, both pop), **the bachelorette party** (loud, primed, chicken-exit flight risk), **the unscareable grandma** (nerve immune; DELIGHT still scores; she's been coming since '81), **the dad** ("huh."), **the birthday kid group** (soft-scare mode — delight-only scoring, Bo's shift).

**7.2 Per-guest visible state (RCT law inverted):** **NERVE** (drains under scares; thresholds: flinch → scream → GOT 'EM → **DROPPED** → melts into the floor), **PRIME** (§6.4), **DELIGHT** (the conversion of fear to joy — banked when a scared guest laughs it off in the next room; the score that matters), **ATTENTION** (facing cone). All readable through walls in backstage vision — legibility IS the game.

**7.3 Pathing law:** guests never clip, never stall against geometry, always find the exit — Horror Tycoon died of this on camera. The sim is deterministic and headless-tested (§14).

## 8. THE CREW

Six teens (§4), each with: **scare-type affinity**, **skill** (grows via scare school + reps), **energy** (drains per scare; voice gone by hour four without pacing — real), **reliability** (Marcus has games on Fridays; homecoming is night 8; someone's grounded arc), and **one personal thread** across the season (kept small, kept warm). Assign them to stations/zones pre-night; they run their zones autonomously at their skill; **you are the floater** — covering the gap when Marcus no-shows, taking the set-piece moments, sprinting the resets. The season's automation arc (MY BREW law): early nights you ARE the haunt; by night 13 you conduct it — and conducting is its own verb (the walkie: call scares, call resets, call the comedy beat).

## 9. THE BUILD, THE ECONOMY, THE SEASON

**9.1 The barn:** ground floor + hayloft + cellar + the yard (queue, ticket shed, photo wall). Route = an editable path through **scene slots** (the corn rows, the dinner scene, the surgery, the cellar stairs, the clown room nobody asked for but the town demands); each scene has station mounts, actor positions, sightline geometry, and — the player-facing wrinkle — **reset corridors you have to actually run**, so route design is also designing your own night's parkour. Chicken exits and marked exits are placeable and code-mandatory.

**9.2 Stations & repairs:** ~14 station types at launch (§13). Fog machines have real mortality (trade law) — mid-night failures create improvisation nights. Repairs cost drawer; everything's cheaper at TransWorld in the March between-seasons screen (NG+ hook).

**9.3 The dials:** ticket price ($15–$30 band, small-town data) and pulse spacing (30–120s). Spacing is the master risk dial: tight = more groups = more drawer = less reset time = more misses = conga risk. The throughput math is the REAL formula: (3600 ÷ spacing) × group size, on the chalkboard in-fiction.

**9.4 Money & season:** the note payment lands weekly (the teeth); payroll ($60/night × who showed), makeup budget, insurance line, the marshal's re-inspection fee when you fail Thursday. Season goal: **8,000 guests** and the note cleared. The **$200 bounty** stands all season (trade-verbatim); paying it out is the proudest moment of the year. Reputation runs on two public axes from reviews — **SCARY** and **FUN** — and the endings grid reads both plus the note: *sold out finale / made it / the bank letter / and the one where the town saves the barn* (earned only if FUN stayed high while SCARY grew — the Ruthie way).

**9.5 The share artifact:** the **scare-cam polaroid** — the mounted flash camera at your best station catches the group mid-scream (Nightmares Fear Factory, in-game and exportable as an actual PNG). The lobby wall fills across the season. This is the marketing engine playing itself.

## 10. CO-OP CREW MODE (post-SP, architected day one)

2–4 over PeerJS (WATER WAR pattern): friends take zones as crew, host floats/directs. Roles emerge, never assigned (PlateUp law). All PvE — the guests are the content; the comedy is shared failure (both of you hit the same corridor; the panel drops on nobody; the group walks by unscathed while four monsters argue on the walkie). No PvP, no exceptions, see §1.13. Sim stays host-authoritative; inputs are thin (trigger events + positions) — the sim/view split makes this cheap IF respected from commit one.

## 11. THE '96 THREAD — iron rules

Some slow nights, a scare lands in a room nobody staffed. The chalk tally reads one higher than you counted. The rocking chair in the hayloft is warm. Rules, absolute: **never confirmed, never named by the game, never escalates, never harms, only ever kind, only ever when the night needed it.** Guests who "meet" her leave delighted and can't say why. MIRROR MIRROR's kind-night restraint, stretched across a season. If a future session is tempted to explain it: don't. The '96 season was really something. That's the whole text.

## 12. ART & AUDIO

**Art:** the house's storybook-toybox look, after dark. Darkness is cheap and flattering in WebGL — pools of practical light (bare bulbs, exit signs, fog-scattered strobes), chunky readable guests, silhouette-first monsters, plank-and-tarp barn materials, VHS grain on replays only. Backstage vision = warm work-light + nerve-meter x-ray through walls. Generated textures/canvas art per house law; poster-pipeline art only if Kyle calls for it.

**Audio (the star):** WebAudio synthesis throughout — the cue grammar (creaks, chatter dips, the rising beat tone), stylized synth screams (goofy-formant, on-brand, never realistic), the murmur of the queue through the walls, walkie crackle, the alarm's awful fluorescent hum, and a season score that's just distant carnival organ gone slightly wrong. Mute persists. Every timing cue must work with eyes closed — that's the test.

## 13. CONTENT SCOPE (tight & deep, MY BREW law)

1 barn (4 zones, 10 scene archetypes) · 14 station types · 6 body-scare techniques · 6 crew + marshal + ~4 town cameos · 12 guest archetypes · 13-night season + soft-open + endless-October mode · 4 ending families · ~20 walkie/chalkboard voice lines per system in the house voice · scare-cam polaroid export · reduced-motion + strobe-off + soft-scare (birthday) modes.

## 14. TECH CONTRACT

- **Stack:** three.js (pinned CDN import map), vanilla ES modules, no build step, boots from `file://` where possible and any static server always.
- **Split:** `sim.js` — deterministic, seeded (mulberry32), fixed-tick, ZERO DOM/three imports, importable in Node. `view.js` renders it; `data.js` holds EVERY number (spacing bands, nerve pools, prices, energy drains — one file, the harness and the game both read it). `test-sim.mjs` — headless harness: full-night simulations, throughput/conga/nerve invariants, balance bands measured not vibed (LAST WATCH culture; balance changes ship with harness numbers or don't ship).
- **Save:** `haunt-save` = `{ started, nights, seasonBest, dropped, melted, delight, bounty, polaroids, endings:{}, reputation:{scary,fun}, crew:{} }` — monotonic where possible, never renamed after ship.
- **House contract:** collectible = **a scare-cam polaroid (the whole group mid-scream)** — earn: land a DROPPED on a full group of 6+. Doorway (Kyle's call, proposal): the Halloween box in the attic year-round; the porch jack-o'-lantern in real October. Hint: *"the barn on route 9 — the lights are on again. somebody's in the walls."* Footer: `a DIRTY BOY DEVS game`. Back-to-the-house link per contract.

## 15. KILL-GATE + BUILD ORDER

**M0 — the slice (kill-gate, §0):** one corridor, drop panel + air cannon, one 4-guest group, visible nerve, beat windows, one reset sprint, the chalk tally. *Fun for 20 minutes in graybox or kill it.*
**M1 — the night:** full pulse loop, 3 scenes, misses-as-jokes, drawer + tally + replay sting. **M2 — the barn:** all zones, route slots, build days, stations shop, Marshal Thursday. **M3 — the crew:** six teens, assignment, energy/reliability, walkie conducting. **M4 — the season:** 13 nights, note, reputation, endings, the '96 thread, finale. **M5 — polish:** polaroid export, audio pass, a11y modes, endless October. **M6 — co-op.**
Every milestone ships with harness numbers and a README update. Repo on day one.

## 16. OPEN CALLS — Kyle's

1. **Title** (shortlist §top). 2. **Doorway** placement in the house (§14 proposal). 3. **Cast names/details** — strike freely, especially Ruthie's. 4. **Destination pricing** — house 99¢ DLC like siblings, or SHORT STAFFED-style Steam-facing demo path (it's the most streamable thing in the catalog; my lean: both, house first). 5. **Co-op timing** — after SP season ships, or after M2 if the slice sings. 6. **Real-October sync details** (dates only, or decorations too).

## 17. KICKOFF PROMPT (for any future session continuing the build)

> Read `the-haunt/THE-HAUNT-BIBLE.md` top to bottom — it is the contract. Check `the-haunt/README.md` for current milestone state and TRAPS before touching anything. The stack is three.js + vanilla ESM, no build step; ALL tuning lives in `data.js`; the guest sim is deterministic and headless (`node test-sim.mjs` must pass before and after your change). Do not add gore, do not confirm Ruthie, do not add PvP, do not let a guest clip a wall on camera. Scares are setup–beat–payoff jokes; misses are punchlines; every guest walks out laughing. Build to the current milestone's Done-when in §15, run the harness, update README status, ship.

---

*The barn's been dark since '99. Sign the note. — DBD*
