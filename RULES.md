# Colossus: the owner's standing rules

Rules the owner set in conversation, kept here so later sessions do not break them. Each names the test that fails
when it is broken. Older rules still live in code comments marked "owner's rule" (see CODEMAP.md); add them here as
they come up.

## The town (owner, 2026-11-28)

1. **A city builder in the manner of the classic Nile-valley builders.** You build houses and settlers come to live
   in them. Nobody is trained or assigned by hand. (`tests/economy.js`: startPop, settlersArrive, noTraining)
2. **Workplaces employ settlers from the town's houses** (each kind a different number) and produce nothing without them: farm, woodcutter, quarry,
   granary, well, watchtower, barracks, fire station; also market, smithy and stable. (`tests/economy.js`:
   staffedFromSettlers, workplacesProduce, emptyWorkplacesIdle, labourPriority, granaryStores)
3. **Fires** can break out where no staffed fire station reaches; a fire station puts them out.
   (`tests/economy.js`: youBeatItOut, fireStationPutsOut)
4. **The settlers build their own roads**: ways walked often enough become roads. (`tests/economy.js`: settlersWearRoads)
5. **The quest UI on screen stays small**: quests are picked from the town's Board; one line tracks the chosen quest
   and the full list collapses (O). This holds on the first day too. (`tests/economy.js`: collapsedOneLine, openLists,
   closesAgain, firstDayQuest, boardOffersQuests, maxThree)
6. **An uncluttered HUD**: on a 360x740 phone the HUD zones do not overlap. (`tests/load.js`, phone HUD zones)

## Houses, food and water (owner, 2026-11-28, second pass)

7. A level 1 house holds 5 people. Each house keeps food and water, 30 a level, starting at 30; every 10 s both
   drop by its occupants. (`tests/economy.js`: houseNeeds)
8. Wells and bazaars send carriers with at most 100 water or food, who refill houses they pass within range; granary
   carts carry 80 food from the granary to bazaars. (`tests/economy.js`: wellCarries, granaryToBazaar, bazaarFeeds)
9. A house needs food and water to level up. (`tests/economy.js`: upgradeNeedsSupply)
10. Farms are built beside water; wells not on mountains; a woodcutter anywhere in town. (`tests/economy.js`:
    farmNeedsWater, wellNotOnMountain, woodcutterAnywhere, botSitesPass)
11. Farms grow for 60 s (animated from bare field to ripe wheat), harvest for 10 s (animated), and the harvest is
    carried to the granary. (`tests/economy.js`: farmCycle)
12. Workers stay at their workplace and are drawn working there; nobody walks about without a purpose.
    (`tests/economy.js`: noIdleWalkers)

## Workers, demolition and materials (owner, 2026-11-28, third pass)

13. Workers come from homes within 3000 paces. Within 1000 there is no penalty; beyond it a worker walks in before
    starting and walks home and back every few minutes, absent all the while. (`tests/labour.js`: nearStartsAtOnce,
    farWalksIn, farTripsHome, nearNoTrips, outOfRange)
14. Every workplace gets a first worker before any gets a second, in priority order; a worker moves to a closer job of
    equal or higher priority, never down. (`tests/labour.js`: roundsSpread, priorityFirst, movesCloser, noMoveDown)
15. A building shows only the workers present. Farms, woodcutters and quarries make less when short-handed, on the same
    timer; wells, bazaars and granaries carry full loads and reload more slowly (10 s full crew, a well with 1 of 2
    takes 20 s). (`tests/labour.js`: drawnMatchesPresent, farmHalfCrewHalfYield, woodcutterThirdCrewThird, reloadByCrew)
16. Demolish your own buildings with a confirming second press; nothing comes back and what they held is lost. A
    house's people become homeless and take free places in other houses, else leave; the same when a house burns,
    is crushed or falls a level. (`tests/labour.js`: demolishConfirms, demolishRefundsNothing, homelessRehoused,
    homelessMoveIn, burnedHouseRehoused, downgradeRehoused)
17. Wood and stone for the hero: buy at your bazaar (the price rises and eases) or from the merchant; tasks, quest
    steps and camp stockpiles pay materials; standing at a staffed workplace (the overseer) adds half again.
    (`tests/labour.js`: buyPriceRisesAndEases, merchantTimber, taskMaterials, campStockpile, overseerHalfAgain)
18. Each building has its own design; the granary shows how full it is; houses show water jars and a grain basket
    while supplied; wells, bazaars and the 1000-pace reach of homes show as rings while building.
    (`tests/labour.js`: uniqueDesigns, granaryShowsFill, houseShowsNeeds, rangeNotes)
19. During the guided first day rival cannons hold their fire on your town and people. (`tests/labour.js`:
    firstDayNoShelling)
