# xrndm (working brief)

xrndm is a single-player browser roguelite where luck is a material you build and read, not a dice roll that judges you.

## The game in one minute

- You carry a **bag of tokens**: strikes, guards, sparks (currency) and static (bad tokens).
- Each encounter, you draw tokens one at a time and play them against a foe.
- **The next two tokens are always face up.** You decide with them in view. Drawing past them is blind.
- If the static you draw in one encounter reaches your **noise limit**, you overload: the encounter ends and you keep only what you banked.
- Between encounters you spend sparks to **add, remove or copy tokens**, raise your noise limit, or buy **lookahead** (see one more token ahead).
- A run is a fixed seed. The same seed and the same choices always give the same run.

## Why this design

Keith Burgun separates randomness the player sees before choosing (input randomness) from randomness that lands between the choice and the result (output randomness). He argues output randomness "does not increase the depth of a game" and only obscures the outcome, while "single player games require input randomness" ([Randomness and Game Design](https://www.gamedeveloper.com/design/randomness-and-game-design), 2014, sections "Imagined Depth" and "Conclusion").

xrndm makes that line something the player can move. Lookahead turns blind draws into visible ones, and the bag's makeup is always shown, so even a blind draw is a known risk. The core question is whether play gets deeper as the player buys their way from output randomness toward input randomness.

## What was built (first full version)

- **Static files with no dependencies and no build step.** All art is drawn on canvas and all sound is synthesized. It plays on desktop and phone. The brief first said one HTML file; the code is split into `core.js`, `art.js`, `audio.js` and `ui.js` so the game rules can run and be tested headlessly.
- **A run** crosses three layers of about nine floors each: the Static Fields, the Echo Halls and the Core. Each layer has a branching map and ends in a boss (the Shuffler, the Echo Queen, RNDM).
- **Story:** an intro, a cutscene between each layer and an ending. The cast is Ix, Vell the Archivist, Oma, Pell the Tinker and the three bosses.
- **Two difficulties:** Standard and Story.
- **Goals and stats:** ten goals, and run stats, are kept across runs.
- **Bots:** a greedy bot and a cautious bot play whole runs headlessly for the tests and balance sweeps. They see only what the player sees.

## Open questions

1. Does buying lookahead make runs feel more skilful, or does it remove the tension of the blind draw?
2. Is a lookahead of two the right default, or does it make the first encounters solved?
3. Should there be a daily seed? If so, rank within each day only, since the seed is shared luck.
