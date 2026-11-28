# xrndm rules

These rules bind every change. Each rule names the test that enforces it. Every test listed here was seen failing once against a deliberately broken build before it was trusted. Commit only when `node tests/core.test.js`, `node tests/browser.test.js` and `node tests/input.test.js` all exit 0. Tuning numbers live in `XR.CFG` at the top of the foe section in `core.js`; change them only with a `tests/decisions.js` run. After changing `index.html`, run `python3 tools/build-artifact.py` so the playtest page matches.

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
| 11 | Fight choices matter. At least 15% of draws are a real gamble (overload odds above 0 and below 100%), the best thinking bot wins at least 12 points more often than a naive bot (draws only at 0% risk, always Strikes), and Brace is sometimes the right call. | `tests/core.test.js` "rule 11"; report with `node tests/decisions.js 150` |

## Last balance sweep

`node tests/decisions.js 150`, after the first playtest's redesign (noise carries over, Strike and Brace, bad tokens of strength 1 to 3). The bots read exact odds; a human who reads them well should land near the thinking bots.

| Mode | Naive bot wins | Greedy bot wins | Cautious bot wins | Real gambles (greedy / cautious) |
|------|----------------|-----------------|-------------------|----------------------------------|
| Standard | 19% | 41% | 35% | 22% / 17% of draws |
| Story | 61% | 90% | 86% | 16% / 12% of draws |

Before the redesign, about 3% of draws were a real gamble and drawing the whole bag was almost always safe.
