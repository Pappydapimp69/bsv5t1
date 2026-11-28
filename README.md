# XRNDM

A bag-building roguelite about reading the odds. Every picture and every sound is generated in code, so there are no asset files.

## Play

Open `index.html` in a desktop or phone browser. To run it from a local server instead:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Click the splash screen to start the sound.

- **Keyboard:** arrow keys move, Enter chooses, Space or D draws, B banks, 1 to 4 pick, and Esc opens the menu.
- **Controller:** the D-pad or left stick moves, A chooses, B goes back (Brace in a fight), X draws, Y strikes, Start opens the menu (and skips cutscenes), and Select shows your bag.
- **Mouse and touch** work everywhere. Choose **Story** difficulty to see the whole tale, or **Standard** for the real game.

## The game

The Generator used to deal every chance in the world. It broke, and its noise took a name: RNDM. You play Ix, a Reader who can see two moments ahead. You cross three layers (the Static Fields, the Echo Halls and the Core) to give the world its seed back.

- **Bag:** you draw tokens one at a time onto your line. Strikes deal damage, Guards give block, Sparks give bits, and Static, Hiss and Howl add 1, 2 and 3 noise.
- **Push your luck:** the next couple of tokens each turn are face up. After that you keep drawing blind, with your exact chance to overload on the Draw button.
- **Noise:** go over your limit (4 at first) and you overload. The whole line fizzles and the foe acts. Noise carries into the next turn and cools by 1, and an overload vents it to 0.
- **Strike or Brace:** when you bank, Strike gives more damage and less block, Brace more block and less damage. You always see what the foe will do next.
- **Teaching:** the first fight teaches drawing, blind draws, carried noise and stances with tips where you act. You can turn them back on in Settings.
- **Map:** each layer is a branching map of fights, elites, events, shops, quiet spots, caches and a boss.
- **Growing stronger:** you gain 18 kinds of tokens, 15 relics, 11 events, upgrades, and shop services that buy more sight or a higher noise limit.
- **Goals:** ten achievements are tracked across runs.
- **Seeds:** the same seed always deals the same world, so you can share one.

The design premise and its source are in `BRIEF.md`. The binding rules and their tests are in `RULES.md`.

## Files

| File | What it holds |
|------|---------------|
| `core.js` | All game rules, content and bots. No DOM. Runs in Node and the browser. |
| `art.js` | Procedural canvas art: characters, 21 foes, backgrounds, token and relic icons, cutscene scenes, logo. |
| `audio.js` | Web Audio synthesis: 27 sound effects and 10 music tracks. |
| `ui.js` | Screens, input, cutscenes, effects, saving (localStorage). |
| `index.html` | Page and styles. |
| `tests/core.test.js` | Headless rule tests (RULES 1 to 4, 6, 8, 9). |
| `tests/browser.test.js` | Plays two whole runs through the real UI at desktop and phone sizes (RULES 4, 5). |
| `tests/sweep.js` | Balance report over many seeds (RULES 7). |
| `tests/decisions.js` | Decision report: real gambles, stance use, naive bot against thinking bots (RULES 11). |
| `tests/input.test.js` | Plays from the splash into a fight with a fake gamepad and the arrow keys (RULES 10). |
| `tools/build-artifact.py` | Rebuilds `artifact/xrndm.html`, the playtest artifact page, from `index.html`. |

## Tests

```sh
node tests/core.test.js
node tests/browser.test.js [screenshot-dir]   # needs Playwright with Chromium
node tests/input.test.js
node tests/sweep.js 150
node tests/decisions.js 150
```
