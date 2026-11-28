# xrndm rules

Binding rules for every change. Each rule names the test that enforces it. A rule marked "no test yet" must get one in the build that first touches it, and that test must be seen failing once before it is trusted.

| # | Rule | Test |
|---|------|------|
| 1 | Every random draw goes through the seeded RNG. No `Math.random()` or wall-clock time in game logic. | no test yet: grep the source for `Math.random` and `Date.now` |
| 2 | Each system (bag shuffle, encounters, shop, rewards) has its own RNG stream, derived from hash(seed, system name), so one added roll cannot shift other systems. | no test yet: add a roll in one system and check the others' rolls are unchanged |
| 3 | A save stores the RNG state words, not seed plus roll count. | no test yet: save mid-run, load, compare the state hash with an unbroken run |
| 4 | The same seed and the same inputs give the same run. | no test yet: run each bot twice per seed and compare final state hashes |
| 5 | The bag's full makeup and the face-up tokens are always on screen while a draw decision is open. | no test yet: browser check that both are visible at every draw prompt |
| 6 | Every run can be finished: no state leaves the player with no legal action. | no test yet: both bots finish runs on 50 seeds without stalling |
| 7 | A balance change is checked over whole runs on several seeds with both bots, not by playing one run. | no test yet: bot sweep reports win rate and run length per seed |
