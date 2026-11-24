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
