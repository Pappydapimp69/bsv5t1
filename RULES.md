# Colossus: the owner's standing rules

Rules the owner set in conversation, kept here so later sessions do not break them. Each names the test that fails
when it is broken. Older rules still live in code comments marked "owner's rule" (see CODEMAP.md); add them here as
they come up.

## The town (owner, 2026-11-28)

1. **A city builder in the manner of the classic Nile-valley builders.** You build houses and settlers come to live
   in them. Nobody is trained or assigned by hand. (`tests/economy.js`: startPop, settlersArrive, noTraining)
2. **Workplaces employ settlers from the town's houses** and work only while staffed: farm, woodcutter, quarry,
   granary, well, watchtower, barracks, fire station; also market, smithy and stable. (`tests/economy.js`:
   staffedFromSettlers, workplacesProduce, emptyWorkplacesIdle, labourPriority, granaryStores)
3. **Fires** can break out where no staffed fire station reaches; a fire station puts them out.
   (`tests/economy.js`: youBeatItOut, fireStationPutsOut)
4. **The settlers build their own roads**: ways walked often enough become roads. (`tests/economy.js`: settlersWearRoads)
5. **The quest UI on screen stays small**: quests are picked from the town's Board; one line tracks the chosen quest
   and the full list collapses (O). This holds on the first day too. (`tests/economy.js`: collapsedOneLine, openLists,
   closesAgain, firstDayQuest, boardOffersQuests, maxThree)
6. **An uncluttered HUD**: on a 360x740 phone the HUD zones do not overlap. (`tests/load.js`, phone HUD zones)
