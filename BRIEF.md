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

## After the first playtest

The owner found no strategy. Measured: 94 to 98% of draws had a 0% chance to overload, because the starting bag could not overload and noise reset every turn. Drawing more was always better, and the blind draw (the core verb) was never discovered, because only a help page explained it.

Changes:
- **Noise carries over and cools by 1 each turn.** An overload vents it to 0.
- **Bad tokens come in three strengths:** Static (+1), Hiss (+2) and Howl (+3). The starting bag holds one Howl, one Hiss and two Static, against a limit of 4, so risk ramps up through a turn the way it does with Quacks of Quedlinburg's chips.
- **Banking means choosing Strike (damage x1.4, block x0.6) or Brace (block x1.4, damage x0.6)**, against the foe's visible intent.
- **The first fight teaches each verb where it is used.** The Draw button reads "Draw blind" with the exact overload chance, and blind tokens flip over as they land.

Open question 1 is answered: seeing everything removed the gamble. Sight now only covers the start of each turn, and the decision is how far to push past it.
