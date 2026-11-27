# Colossus code map

The game runs from `index.html`, which holds the page skeleton, the HUD markup, the Three.js CDN tag, the inline
sound-engine worklet (read as text by id) and an ordered list of classic `<script src>` files. There is no build step
and no module system: every file shares one global scope, as the single file did, so the tests and the page can call
and reassign any top-level function (`hitBeast`, `startRaid`, `__col`, ...).

**Load order matters only at load time.** A file may *call* anything at run time, but a top-level statement that runs
while loading may only use what earlier files define. The wrappers that extend functions from other files live in
`src/wire.js`, which loads after every definition.

| # | File | Lines | Top-level definitions | What it holds |
|---|---|---|---|---|
| 1 | `src/vendor/se.js` | 2 | 0 | the bundled Sound-engine (main thread); its AudioWorklet stays inline in index.html as text |
| 2 | `src/core.js` | 147 | 34 | rng and helpers, the constants C, the giant's climbable body grid, the save |
| 3 | `src/audio.js` | 195 | 37 | sound: effects, the orchestra cues, the giant's voice |
| 4 | `src/state.js` | 114 | 25 | the sim state S, omens, memory, newGame and the people in it |
| 5 | `src/land.js` | 153 | 24 | the land: heights, rivers, lakes, roads, trees, ruins, fairness |
| 6 | `src/giant.js` | 204 | 45 | messages, the giant on the ground: walking, feet, chains, waking, its actions |
| 7 | `src/humans.js` | 133 | 29 | humans: day and night, climbing on, the action buttons (humanCtx, humanAct), what can be built |
| 8 | `src/rpg/town.js` | 23 | 7 | house cap, civic buildings, prosperity and festivals |
| 9 | `src/rpg/mounts.js` | 23 | 7 | horses: buying, riding, being thrown, levels |
| 10 | `src/town.js` | 269 | 67 | territory, rent, build jobs, upgrades, towers, barracks, soldiers and their orders |
| 11 | `src/folk.js` | 294 | 51 | forager, soldier and hero goals; the foragers' economy; raids, stars, caravans, waves, stepEvents; packs; giant sites |
| 12 | `src/tutorial.js` | 79 | 16 | the guided first day and the camera flight |
| 13 | `src/rpg/world.js` | 125 | 27 | places (shrines, springs, stones, herbs, camps), merchant, travellers, deer, hound, treasure, world events, ruins |
| 14 | `src/rpg/hero.js` | 91 | 22 | levels, talents, charms, crafting, the hero sheet, skills, hits on beasts, kills |
| 15 | `src/rpg/quests.js` | 55 | 12 | board jobs, bounties, the elders' tale and the Rim Warlord, goal targets |
| 16 | `src/climb.js` | 69 | 6 | a person's step on the ground and on the giant |
| 17 | `src/combat.js` | 111 | 26 | monsters, shots, telegraphed combat, knockback |
| 18 | `src/bots.js` | 202 | 12 | bots: the giant, heroes, foragers, soldiers |
| 19 | `src/step.js` | 44 | 5 | the fixed sim step |
| 20 | `src/input.js` | 139 | 29 | keys, mouse, touch and gamepad |
| 21 | `src/menus.js` | 90 | 16 | menus: title, help, pause, army, chronicle |
| 22 | `src/rpg/meta.js` | 37 | 10 | today's goals, first-time hints, renown, What's new |
| 23 | `src/menus-town.js` | 49 | 5 | end screen, build menu, town menu, start() |
| 24 | `src/render3d.js` | 275 | 30 | camera and render; the Three.js ground view (figures, beasts, places, decor are drawn here) |
| 25 | `src/atmosphere.js` | 264 | 27 | atmosphere: haze, storm, rain, birds, wind and weather sound |
| 26 | `src/view2d.js` | 360 | 55 | the canvas 2D fallback ground view and the giant's body panel |
| 27 | `src/hud.js` | 103 | 15 | HUD, skill bar, buttons |
| 28 | `src/wire.js` | 21 | 0 | wrappers that extend functions defined across files. In the single-file build these ran |
| 29 | `src/main.js` | 34 | 6 | the frame loop, the test hook, start-up |

Styles: `src/style.css`. Tests: `tests/*.js` (Playwright, Three.js blocked, 2D fallback). `tests/fingerprint.js` hashes
four seeded runs; run it after any change that should not alter gameplay, and `--record` only when gameplay is meant
to change. `tests/load.js` checks every script loads with no errors and both roles start.

Where to look:
- **Human RPG layer** (talents, skills, charms, places, quests, civic buildings, mounts, renown): `src/rpg/`.
  Its drawing lives inside the render closures in `src/render3d.js` (figures, horses, places, decor) and in the overlay
  pass of `src/view2d.js` (labels, map, speech, effects), because those draw with the closures' instance pools.
- **The giant** (walking, chains, waking, actions): `src/giant.js`; its bot: `src/bots.js`; its panel: `src/view2d.js`.
- **The first day**: `src/tutorial.js`. **Menus**: `src/menus.js`, `src/menus-town.js`, `src/rpg/meta.js`.
- **Sim step order**: `src/step.js`. **Frame loop and test hook**: `src/main.js`.
