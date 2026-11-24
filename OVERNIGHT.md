# Colossus overnight expansion — working log

- Start commit: `c4be89c` (origin/colossus, "Update Colossus heroes, settlements, and giant gameplay")
- Window: 2026-11-24 20:30:41Z → cutoff 23:30:41Z (final 20 min from 23:10Z: playtest, fix, GPTBS finish, push)
- Branch: `codex/colossus-overnight-expansion`
- GPTBS: `Pappydapimp69/BS@GPTBS` 065c7e3 — `brief` ran fine (access OK). No Colossus entries existed.

## First play (baseline build)

Human: 22 s unskippable opening film, a 17-step first day (skippable), then ~45 s of walking across grass to the giant.
Climbing feels good (holds, grip, ledges), but the giant is asleep, so nothing on the body reacts to you.

Giant: "You sleep, chained." Every action reads "Asleep". A full headless run (seed 1, autoplay) shows the giant
asleep and the chains untouched until t=900 s, i.e. **the giant player has no available action for the first 15 of 25 minutes.**
Rivals only start on the chains at minute 15 (`C.CHAIN_OPEN=900`). That is the emptiness.

## Goals per role (revise as play shows otherwise)

Giant
- Do: have a real decision within the first 30 s, and every 10–20 s after: which part of the body to shudder, which chain to strain against.
- Care about: who is on you and why (hunters wedge joints, keepers brace you); your joints and Heart; the five tasks.
- Come back for: towns that remember how you treated them; a different dusk each time.

Human
- Do: gather and gear up, then climb a giant that fights back from minute one.
- Care about: your town, your grip, and whether your work on the body survives the giant's shudders.
- Come back for: the climb as a skill test against a reacting body; the dusk verdict.

## Changes (each follows the GPTBS evidence loop; details in GPTBS queue)

See sections below, appended as work lands.

### 1. The chained sleeper fights back (checkpoint 1)

- Asleep, the giant player now has **Twitch** (A; arrows pick legs / left side / right side / chest-and-head) and
  **Strain** (B). Twitch: 1.1 s warning, then everyone in that part loses 36 grip unless they held still (8), and wedges
  and ropes there can shake loose. Strain: chips a chain; before minute 15 it can only weaken a chain to 40%; after that it
  can tear chains loose, and with all four gone one more strain lets the giant **rise on its own** (no town gets the waking favour).
- From 0:45 hunters can wedge and strike the sleeper at half damage, never below 60% of a joint (no crippling asleep).
  Wedges, cannons and braces are sold from 0:45 instead of after waking.
- Bot sleeper twitches only where it *hurts* (wedges or blows in the last 4 s), and strains now and then. First version
  twitched at anyone carrying a wedge: by hand I was twitched twice in 7 s before doing anything — replaced.
- **Bug fixed:** soldiers ordered to "hunt the giant" never had wedges and never shopped, so in every baseline sim no
  hunter ever wedged the giant all game (knees and Heart stayed 100%). Hunt orders now hand each soldier one wedge.
- That exposed balance: with real hunters the awake giant died within 55 s in 3/3 seeds. Added: only three people's blows
  count on a joint at once, conscript soldiers strike stone at half strength, Heart ×1.5 (was ×2) while fallen, and bots
  read a Shake in time 65% of the time (was 100%, which made Shake useless). Sweep, giant autoplay, seeds 1–3:
  defaults → giant dead 3/3 at 19–20 min; final → reaches dusk 3/3 with 1–3 falls, min Heart 24–74%.
- Opening film skippable (any key/tap after 1.5 s; the world fast-forwards so nothing differs but the wait). Bug found by
  play: the skip left the camera facing north so "forward" walked away from the giant; it now ends facing the giant.
- Hand-played (human): bought a wedge at 0:46, walked out, climbed to the right knee by 1:53 untouched, drove the wedge,
  the legs twitched within a second, held still → "Braced", wedge stayed. Hand-played (giant): strain/aim/twitch respond, HUD
  names the aimed part and chain; body panel shows aim outline, chain bars and red-edged hunters.
- Tests: giant, heroes, barracks, land-fairness pass; new `tests/sleeper.js` (11 checks).

### 2. Time budget, roads, stars, giant feedback (checkpoint 2)

- Hand-played the awake giant (fast-forwarded a giant game to 15:30 as a test shortcut, then played by keys): tore the last
  chain and rose at 15:34; 38–53 climbers on the body (20 Corvel hunters, 36 friendly tenders from 27 barracks). Shake
  reported "0 ropes and 0 wedges" though 3 climbers fell; Swipe and Stomp said nothing. Crippled and fallen 70 s later.
  → Shake, Swipe and Twitch now report how many climbers lost their grip and how many of those were hunting you.
- Falling stars snowballed (one per 16 crystals gathered by anyone; ~10 craters on screen and 7 announcements in 35 s by
  minute 16). Now at most 2 uncollected stars, and each needs 4 more crystals gathered than the last.
- Time budget (GPTBS 0101#E97: log time per activity with a bot when the map grows). Autoplay hero, seeds 1–3, first
  15 min: **walking 86–90% of the time, never climbed**, 0–4% of walking on roads.
- Roads now speed walking. 1.5× vs 1.25× compared: 1.5× made following the road 25–40% faster to the giant on 11/15
  town routes but 30/40 lands failed the fairness check on first lay (1 never fair) once roads were counted in it;
  1.25× → 0 unfair, 10/40 relaid. Kept 1.25× and the fairness check now counts road pace.

### 3. The awake giant fights in bursts (checkpoint 3)

- Hand-played human, minute 15–18: chains broke at 15:42, Brindle woke the giant at 16:47 while I was at ~460 ft; the bot
  giant then Shook every 12 s and Swiped every ~14 s on cooldown (it always saw ≥2 hunters); I fell three times, no progress.
- Bot giant now rests 25 s after 3 shakes/swipes within 40 s (L4D build-up/peak/relax, Booth 2009 pp. 79–82).
  Same 3 seeds, giant autoplay: shakes −28%, swipes −55%; still reaches dusk 3/3, falls 2–3 (was 1–2), min Heart 493–2767.
- Re-played by hand: from 1000 ft to the chest (1345 ft) in 24 s with one shake, bracing on the warning.

### 4. A chronicle at the end, and a choice of town (checkpoint 4)

- Evidence: GPTBS test#E10 and film#E3 (opened): events in order are a chronicle, not a story; link beats with
  because/therefore. Sylvester, "The Simulation Dream" (2013, Player Model Principle): "In play, the Game Model is
  irrelevant. Players can't perceive it directly." Colossus simulates grudges, regard and armies that the player never sees.
- End screen now shows **How it went**: timestamped turning points with causes where the game knows them (first wedge into
  the sleeper, the four chains and whose work they were, who woke it and that it owes them, why it turned on a town,
  each fall and whose hunters caused it, towns destroyed and why, the dusk verdict) and **Your part** (human: highest
  climb, wedges, what you built on the giant, your standing in its regard; giant: actions used, climbers knocked loose, tasks).
- Six sim chronicles showed Corvel destroyed in every match and the player always Ashville. Title now offers
  **Play for Ashville / Brindle / Corvel** (first day stays Ashville's). Hand-checked a Corvel start.
- The Corvel end screen exposed that the player's own town kept hunting whatever the player did. Now your town's bot
  barracks follow your lead once your regard passes ±40 (else the town's habit). Same seeds 1–3, Corvel player autoplay:
  habit only → Corvel fell (1) or lost settlements (2), barracks hunted ~2400 checks vs ~800 tend; with the player keeping
  regard at 120 (simulated tending) → all 4 Corvel settlements stood 3/3 and the giant honoured the player at dusk 3/3.
  Trade-off seen: with no Corvel hunters the giant never fell (falls 0) — the drama moves to whoever still hunts.

## Window extended (owner: "Continue for another 4 hours", received 21:53Z)

- New cutoff 2026-11-25T01:53:40Z; final 20 minutes from 01:33Z.

### 5. Nightmare, earlier hunters, retuned danger (checkpoint 5)

- Hand-played the first 4 min as the giant: eight Strain presses and nothing else; no climber arrived before ~4 min.
  Strain alone is busywork (answers the open question in GPTBS de27cde1 partly: yes, early).
- **Nightmare** (X while asleep): once a town has hurt the giant (grudge ≥ 50), the sleeper dreams of it and a beast raid
  marches on that town (90 s cooldown; bot sleeper uses it at grudge ≥ 200). Same seeds 1–3: used 1–5 times per match;
  giant still reaches dusk 3/3.
- Corvel's hero now starts with a wedge and hunts the sleeper while it carries one. First hunter on the body moved from
  2:08–6:04 to 1:29–2:21 (seeds 1–4). **Regression caught by sweep:** the first version let a level-3 hero hang on the
  sleeper forever (0 wedges, 3 gold, one barracks all game) and the giant never fell in 6 matches. Heroes now climb down
  when their wedges are spent.
- Retuned conscript stone damage 0.5 → 0.7 after the Nightmare made the giant comfortable (min Heart 64–96%).
  At 0.7, 6 matches: 1 giant death, falls 0–3, min Heart 8–100%.

### 6. Reaching for holds (checkpoint 6)

- By hand I repeatedly stalled pushing up on bare stone: a reach only takes holds within ±57° of the push, else nothing
  happens and nothing is said. Now an ordinary reach falls back to the nearest hold within ±80°, the aim preview shows the
  same choice, and if there is still none a hint says to lunge (K) or go round (at most every 4 s).
- Comparable test (held W only, climber set at the right foot, seeds 11–13, 40 s): seed 12 old stuck at row 11 →
  new reaches row 81; seeds 11 and 13 unchanged (11 needs a lunge in both). Hand-played sleeping-giant policy, 3.5 min:
  first hunter at ~2:10, 8 twitches popped 3 wedges, knees stayed 100%, one Nightmare on Corvel at 2:58.
- Touch/mouse: the sleeping giant's body panel is now a picker (tap or click a part to aim the twitch); before, a touch
  giant could not aim at all because touch moves by tapping destinations. Verified with real mouse clicks: head → chest
  and head, left arm → left side, right arm → right side, shin → legs.

### 7. The first day leads with the giant (checkpoint 7)

- The first day had 17 steps and the giant — the premise — only at steps 15–17 (chain, climb, knee), after crystals,
  jobs, wolves, a house, a barracks and orders. Evidence: GPTBS sevin#E12 (a core mechanic must be met inside the flow
  the player already goes through), dbh#E5 (don't reshuffle indexes other code relies on — here every lookup is by id,
  checked), idea:65c1e2ca9702 (short sessions can't afford a slow ramp).
- New order: pick up a crystal → follow the road to the giant and strike an ankle chain → climb → reach the knee → home,
  jobs, wolves, building, barracks, orders. Card texts reworded; the "bank it" step passes silently if the crystal was
  banked on the way out; every card now has a plain **Got it** besides "Show me" (camera flight).
- Hand-played the new first day with keys, following the goal marker: crystal at 0:26, at the ankle chain at 1:12,
  climbing at 1:14, on the knee ledge (462 ft) at 1:31.
- Tests: barracks (incl. 8 tutorial checks), giant, heroes pass.
