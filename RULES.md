# xrndm rules

These rules bind every change. Each rule names the test that enforces it. Every test listed here was seen failing once against a deliberately broken build before it was trusted. Commit only when `node tests/core.test.js`, `node tests/browser.test.js` and `node tests/input.test.js` all exit 0. After changing `index.html`, run `python3 tools/build-artifact.py` so the playtest page matches.

| # | Rule | Test |
|---|------|------|
| 1 | Every random draw in game logic goes through the seeded RNG. No `Math.random()` or wall-clock time in `core.js`. The UI may use them for visual noise only. | `tests/core.test.js` "rule 1" |
| 2 | Each system (map, encounters, foe moves, bag, loot, shop, events) has its own RNG stream from hash(seed, system name). An extra roll in one system must change that system and no other. | `tests/core.test.js` "rule 2" |
| 3 | A save stores the RNG state words, not seed plus roll count. Loading mid-run must give the same run as never stopping. | `tests/core.test.js` "rule 3" |
| 4 | The same seed and the same inputs give the same run. | `tests/core.test.js` "rule 4"; `tests/browser.test.js` checks the UI ends each run where the engine does |
| 5 | While a draw decision is open, the face-up tokens, the full makeup of the blind part of the bag and the exact overload odds are on screen, and they match the engine. | `tests/browser.test.js`, checked at every draw prompt of two whole runs |
| 6 | Every run can be finished: no state leaves the player without a legal action, and no fight runs forever (foes enrage after turn 18). | `tests/core.test.js` "rule 6" (both bots, 50 seeds) |
| 7 | A balance change is checked over whole runs with both bots on many seeds, using the lowest HP reached per fight, not by playing one run. | `node tests/sweep.js 150` (report). Compare it with the last sweep in this file before committing. |
| 8 | Bots read only `XR.view()`, which is what the player sees. They never see the hidden bag order. | `tests/core.test.js` "bots see only the player view" |
| 9 | Every foe, foe behaviour, event and map node type actually occurs in play. | `tests/core.test.js` "every foe, intent, event, relic and map node type occurs" |
| 10 | Every screen can be played with a controller or arrow keys alone. Focus moves by on-screen position and is always visible. The press that leaves a screen does nothing on the next one. A direction held while a screen opens must be released before it moves focus. | `tests/input.test.js` (a fake gamepad plays from the splash into a fight, plus the arrow keys) |

## Last balance sweep

`node tests/sweep.js 150`. The bots read exact odds, so a human will do worse.

| Mode | Greedy bot wins | Cautious bot wins |
|------|-----------------|-------------------|
| Standard | 44% | 53% |
| Story | 72% | 78% |

Deaths are spread across all three bosses. Normal fights end in about 2.5 turns, elites in 4 to 5, and bosses in 6 to 7.
