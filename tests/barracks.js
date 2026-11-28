const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/three.min.js', route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);

    const results = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const town = state.towns[player.town];
      const village = foundVillage(player.town, town.x + 2000, town.y);
      const villager = state.humans.find(h => !h.you && h.town === player.town);
      player.gold = 10 * C.COST.barracks;
      state.prints = [];

      function startAt(builder, settlement, offset) {
        builder.x = settlement.x + offset;
        builder.y = settlement.y;
        return build(builder, 'barracks');
      }

      const startedAtTown = startAt(player, town, 120);
      stepJob(player, 8);
      const rejectedSecondAtTown = !startAt(player, town, 220);
      const startedAtVillage = startAt(player, village, 120);
      stepJob(player, 8);
      const completedBoth = barracksOf(player.town).length === 2;

      villager.gold = 10 * C.COST.barracks;
      villager.x = town.x;
      villager.y = town.y;
      const villagerHasHome = homeOf(villager) === town;
      const villagerPlansBarracksWork = pickGoalFolk(villager)?.k === 'maintain';
      const villagerCannotBuildBarracks = !startAt(villager, town, 220) && !villager.job && villager.gold === 10 * C.COST.barracks;
      const villagerCannotBuildHouse = !build(villager, 'house') && !villager.job && villager.gold === 10 * C.COST.barracks;

      village.lvl = 2;
      const goldBefore = player.gold;
      const startedAtUpgradedVillage = startAt(player, village, 220);
      village.alive = false;
      stepJob(player, 8);
      const refundedAfterVillageLost = player.gold === goldBefore && barracksOf(player.town).length === 2;

      return {startedAtTown, rejectedSecondAtTown, startedAtVillage, completedBoth,
        villagerHasHome, villagerPlansBarracksWork, villagerCannotBuildBarracks, villagerCannotBuildHouse,
        startedAtUpgradedVillage, refundedAfterVillageLost};
    });

    for (const [check, passed] of Object.entries(results)) assert.ok(passed, check);
    const placement = await page.evaluate(() => {
      let state = __col.newGame('human', 1);
      let player = state.you;
      let town = state.towns[player.town];
      player.gold = 500;
      player.x = town.x + 300;
      player.y = town.y;
      const originalLimit = ringR(town);
      build(player, 'house');
      stepJob(player, 6);
      player.x = town.x + originalLimit + 5;
      const houseGrewCityLimits = withinLimits(town, player.x, player.y) && canBuild(player, 'barracks') === null;
      player.x = town.x + 550;
      openBuild();
      let index = menu.items.findIndex(item => item.label.startsWith('Barracks'));
      const allowedInHouseTerritory = !withinLimits(town, player.x, player.y) && !menu.items[index].why;
      activate(index);
      const reservedHouseTerritory = player.job?.settlementId === town.id;
      stepJob(player, 8);
      const finishedInHouseTerritory = barracksOf(player.town, town).length === 1;
      player.x = town.x + 650;
      openBuild();
      index = menu.items.findIndex(item => item.label.startsWith('Barracks'));
      const disabledOutsideTerritory = menu.items[index].why === 'Outside your settlement’s build territory';
      const before = player.gold;
      activate(index);
      const rejectedWithoutSpending = !build(player, 'barracks') && player.gold === before && !player.job;
      closeMenu();

      state = __col.newGame('human', 1);
      player = state.you;
      town = state.towns[player.town];
      const outpost = foundVillage(player.town, town.x + 1000, town.y);
      town.lvl = 2;
      player.gold = 500;
      state.t = 119.9;
      player.x = town.x + 570;
      player.y = town.y;
      build(player, 'barracks');
      stepJob(player, 8);
      player.x = town.x + 565;
      player.y = town.y + 50;
      build(player, 'barracks');
      state.t = 128;
      const overlappingAfterGrowth = withinLimits(outpost, player.x, player.y);
      stepJob(player, 8);
      const bothStayedWithTown = barracksOf(player.town, town).length === 2;

      outpost.lvl = 2;
      player.x = town.x + 490;
      player.y = town.y - 70;
      const overlapUsesSlotAtOutpost = dist(town, player) < dist(outpost, player) &&
        build(player, 'barracks') && player.job.settlementId === outpost.id;
      stepJob(player, 8);
      const finishedAtOutpost = barracksOf(player.town, outpost).length === 1;
      return {houseGrewCityLimits, allowedInHouseTerritory, reservedHouseTerritory, finishedInHouseTerritory,
        disabledOutsideTerritory, rejectedWithoutSpending,
        overlappingAfterGrowth, bothStayedWithTown, overlapUsesSlotAtOutpost, finishedAtOutpost};
    });

    for (const [check, passed] of Object.entries(placement)) assert.ok(passed, check);
    const promotion = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const capital = state.towns[player.town];
      const outpost = foundVillage(player.town, capital.x + 2000, capital.y);
      player.x = outpost.x;
      player.y = outpost.y;
      capital.alive = false;
      const outpostDoesNotKeepFactionAlive = !factionAlive(player.town);
      capital.alive = true;

      openTown(outpost, 'Hall');
      const choice = menu.items.find(item => item.label.startsWith('Raise outpost to town'));
      const requiresCrystals = choice.why === 'Need 8 more crystals';
      player.crystals = 8;
      openTown(outpost, 'Hall');
      menu.items.find(item => item.label.startsWith('Raise outpost to town')).act();
      const promotedInPlace = !outpost.outpost && lv(outpost) === 2 && outpost.max === 2100 && player.crystals === 0;
      const showsTownUpgrade = upgradeTarget(player).label === 'town (16)';
      const promotionOnlyOnce = !menu.items.some(item => item.label.startsWith('Raise outpost to town'));
      closeMenu();

      capital.alive = false;
      checkEnd();
      const promotedTownKeepsFactionAlive = standingTown(player.town) === outpost && state.over === null;
      return {outpostDoesNotKeepFactionAlive, requiresCrystals, promotedInPlace, showsTownUpgrade,
        promotionOnlyOnce, promotedTownKeepsFactionAlive};
    });

    for (const [check, passed] of Object.entries(promotion)) assert.ok(passed, check);
    const expansion = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const startingTown = state.towns[state.you.town].name;
      const rivals = [1, 2].map(i => {
        const town = state.towns[i];
        const villager = foragersIn(town)[0];
        const hero = state.humans.find(h => h.hero && h.town === i);
        hero.gold = C.COST.barracks;
        hero.x = town.x + 200;
        hero.y = town.y;
        build(hero, 'barracks');
        stepJob(hero, 8);
        const barracks = barracksOf(i, town)[0];
        trainSoldier(barracks);
        villager.x = town.x;
        villager.y = town.y;
        town.crystals = 5;
        botFolkShop(villager);
        const savedCrystals = town.crystals === 5 && villager.crystals === 0;
        villager.pack.crystals = 3;
        const returnsWithPartialPack = pickGoalFolk(villager)?.k === 'shop';
        unloadPack(villager);
        botFolkShop(villager);
        // owner's note: foragers raise their town with the town's crystals (it used to wait for the hero)
        const foragersRaiseTown = lv(town) === 2;
        hero.x = town.x;
        hero.y = town.y;
        botHeroShop(hero, town);
        // owner's rule: raising a town sends a trade caravan; only heroes found outposts (by staking a site)
        const caravan = state.events.find(e => e.k === 'caravan' && e.i === i);
        stepEvents(0);
        const assignedEscort = caravan?.escort === villager;
        const raisedAndSentSettlers = lv(town) === 2 && Boolean(caravan) && !caravan.site;
        const foundedVillage = !state.towns.some(t => t.i === i && t.outpost);
        return {name: town.name, savedCrystals, returnsWithPartialPack, foragersRaiseTown, assignedEscort, raisedAndSentSettlers, foundedVillage};
      });
      return {startingTown, rivals};
    });

    assert.equal(expansion.startingTown, 'Ashville');
    for (const {name, ...checks} of expansion.rivals) {
      for (const [check, passed] of Object.entries(checks)) assert.ok(passed, `${name} ${check}`);
    }
    const economy = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const capital = state.towns[player.town];
      const folk = state.humans.filter(isForager);
      const oneForagerPerCity = folk.length === 3 && state.towns.every(t => folk.filter(h => h.homeId === t.id).length === 1);
      const forager = folk.find(h => h.homeId === capital.id);
      player.gold = 500;
      player.x = capital.x + 2000;
      player.y = capital.y;
      build(player, 'outpost');
      stepJob(player, 15);
      // owner's rule: the hero stakes the site and settlers walk there from the first town
      const settlers = state.events.find(e => e.k === 'caravan' && e.site);
      const staked = !!settlers && settlers.from === capital.id && state.towns.length === 3;
      settlers.x = settlers.site.x; settlers.y = settlers.site.y; state.monsters = []; stepEvents(C.DT);
      const outpost = state.towns.at(-1);
      if (!staked) throw new Error('outpost did not send settlers from the first town');
      const oneNewForager = outpost.outpost && state.humans.filter(h => isForager(h) && h.homeId === outpost.id).length === 1;
      forager.x = outpost.x + 220;
      forager.y = outpost.y;
      forager.gold = C.COST.barracks;
      const foragerCannotUseOtherLimits = !build(forager, 'barracks') && forager.gold === C.COST.barracks && !forager.job;

      forager.pack.crystals = 4;
      forager.x = outpost.x;
      forager.y = outpost.y;
      unloadPack(forager);
      const onlyUnloadsAtHome = forager.pack.crystals === 4 && outpost.crystals === 0;
      forager.x = capital.x;
      forager.y = capital.y;
      unloadPack(forager);
      const banksAtHome = forager.pack.crystals === 0 && capital.crystals === 4 && forager.crystals === 0 && player.crystals === 0;
      player.x = capital.x;
      player.y = capital.y;
      openTown(capital, 'Hall');
      activate(menu.items.findIndex(item => item.label === 'Withdraw crystals'));
      closeMenu();
      const hallWithdraws = player.crystals === 4 && capital.crystals === 0;
      openTown(state.towns[1], 'Hall');
      const foreignStockpileHidden = !menu.items.some(item => item.label === 'Withdraw crystals');
      closeMenu();
      player.x = outpost.x;
      player.y = outpost.y;
      openTown(outpost, 'Hall');
      activate(menu.items.findIndex(item => item.label === 'Build here'));
      const canBuildFromOutpostHall = menu.title === 'Build here' && !menu.items.find(item => item.label.startsWith('Barracks')).why;
      closeMenu();

      player.x = forager.x = capital.x + 220;
      player.y = forager.y = capital.y;
      player.gold = C.COST.barracks;
      build(player, 'barracks');
      stepJob(player, 8);
      const barracks = barracksOf(player.town, capital)[0];
      state.monsters = [];
      const before = player.gold;
      forager.gold = 0;
      botHuman(forager, C.DT);
      const neverChargesPlayer = player.gold === before && barracks.q === 0;
      forager.gold = 150;
      forager.goal = null;
      botHuman(forager, C.DT);
      const paysFromLocalForager = player.gold === before && forager.gold === 120 && barracks.q === 1;
      // the first day reserves the first recruit for the player's training goal (Your town chapter, soldier not done)
      state.tut = Object.assign(tutNewDay(), {ch: 2, chT: 1});
      const reservesTutorialTraining = !tendBarracks(forager, barracks) && barracks.q === 1;
      state.tut = null;
      const outpostForager = foragersIn(outpost)[0];
      Object.assign(outpostForager, {x: barracks.x, y: barracks.y, gold: 200});
      const foreignForagerCannotSponsor = !tendBarracks(outpostForager, barracks) && outpostForager.gold === 200;
      stepArmy(C.DT);
      stepArmy(ARMY.TRAIN);
      const recruitFinishesTraining = barracks.sol.length === 1 && barracks.q === 0 && barracks.train === 0;
      while (barracks.sol.length < ARMY.CAP) trainSoldier(barracks);
      const member = readySoldiers(barracks)[0];
      const soldierGold = member.gold, soldierAttack = member.atk;
      const upgradesFromForagerGold = tendBarracks(forager, barracks) && forager.gold === 120 - GEAR.blade[0].g &&
        member.gold === soldierGold && member.atk === soldierAttack + GEAR.blade[0].v && member.gear.blade === 1;
      const noAutomaticGoldGifts = player.gold === before;

      state.marks = [];
      forager.x = capital.x + C.FORAGE_RANGE - 1;
      forager.y = capital.y;
      const crystal = {id: state.nextId++, x: forager.x + 2, y: forager.y};
      state.crystals = [crystal];
      stepHuman(forager, C.DT, {x: 1, y: 0});
      const rangeBlocksMovementAndPickup = inForageRange(capital, forager) && state.crystals.includes(crystal) && forager.returnHome;

      state.t = 10.01;
      state.prints = [capital, outpost].flatMap(t => [20, 40, 60].map(dx => ({x: t.x + dx, y: t.y, t: 0})));
      stepBuilds(C.DT);
      const lakeIncomeCapped = player.gold - before === C.LAKE_GOLD;
      return {oneForagerPerCity, oneNewForager, foragerCannotUseOtherLimits, onlyUnloadsAtHome, banksAtHome, hallWithdraws,
        foreignStockpileHidden, canBuildFromOutpostHall, neverChargesPlayer, paysFromLocalForager, reservesTutorialTraining,
        foreignForagerCannotSponsor, recruitFinishesTraining, upgradesFromForagerGold, noAutomaticGoldGifts,
        rangeBlocksMovementAndPickup, lakeIncomeCapped};
    });

    for (const [check, passed] of Object.entries(economy)) assert.ok(passed, check);
    const logistics = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const town = state.towns[1];
      const forager = state.humans.find(h => h.homeId === town.id);
      const hero = state.humans.find(h => h.hero && h.town === town.i);
      hero.gold = C.COST.barracks;
      hero.x = town.x + 220;
      hero.y = town.y;
      build(hero, 'barracks');
      stepJob(hero, 8);
      const barracks = barracksOf(town.i, town)[0];
      trainSoldier(barracks);
      const soldier = soldiersOf(barracks)[0];
      const distant = state.towns[2];
      const caravan = {k: 'caravan', i: town.i, from: town.id, to: distant.id, x: town.x, y: town.y, hp: 300};
      state.events = [caravan];
      state.monsters = [];
      stepEvents(0);
      const startsWithHomeForager = caravan.escort === forager;
      caravan.x -= C.FORAGE_RANGE + 1;
      stepEvents(0);
      const soldierTakesOver = caravan.escort === soldier && readySoldiers(barracks).length === 0;
      soldier.dead = 1;
      stepEvents(0);
      const continuesWithoutEscort = !caravan.escort && state.events.includes(caravan);

      const occupied = foundVillage(town.i, town.x - 2000, town.y);
      const settler = {...caravan, to: null, x: occupied.x, y: occupied.y, site: {x: occupied.x, y: occupied.y}};
      const count = state.towns.length;
      state.events = [settler];
      stepEvents(0);
      const occupiedSiteRejected = state.towns.length === count && !state.events.includes(settler);

      const target = state.towns[0];
      const otherTarget = foundVillage(target.i, target.x + 2000, target.y);
      target.crystals = 100;
      otherTarget.crystals = 30;
      hurtWalls(target, soldier, 600);
      const siegeLootsOnlyLocalStockpile = target.crystals === 90 && otherTarget.crystals === 30 && hero.crystals === 10;

      hurtTown(town, town.hp);
      const displacedDoesNotDuplicateForagers = !foragerHome(forager) && state.humans.filter(h => h.homeId === occupied.id).length === 1;
      barracks.train = 1;
      barracks.q = 1;
      stepArmy(0);
      const fallenHomeStopsRecruiting = barracks.train === 0 && barracks.q === 0 && barracks.sol.length === 1;
      return {startsWithHomeForager, soldierTakesOver, continuesWithoutEscort, occupiedSiteRejected,
        siegeLootsOnlyLocalStockpile, displacedDoesNotDuplicateForagers, fallenHomeStopsRecruiting};
    });

    for (const [check, passed] of Object.entries(logistics)) assert.ok(passed, check);

    const lesson = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const town = state.towns[player.town];
      player.x = town.x + 200;
      player.y = town.y;
      player.gold = 500;
      build(player, 'barracks');
      stepJob(player, 8);
      const barracks = tutBarracks(player);
      trainSoldier(barracks);
      state.t = OPENING.len + 2;
      // the first day's goals (open chapters): the map goal names both rivals and completes when the map opens;
      // Defend giant completes the order goal, an attack order neither completes nor breaks it
      state.tut = Object.assign(tutNewDay(), {ch: 2, chT: state.t});
      const mapGoal = tutGoal('map');
      const namesBothRivals = mapGoal.hint.includes('Brindle') && mapGoal.hint.includes('Corvel');
      tutOpenGoal(mapGoal, player, true); state.tut.mapOpened = true; stepTutorial(C.DT);
      const showsRivalOnMap = tutDone('map');
      state.tut.ch = 3; tutOpenGoal(tutGoal('order'), player, true);
      const teachesAttack = tutOpen('order') && tutGoal('order').hint.includes('Defend giant');
      openBarracks(barracks);
      activate(menu.items.findIndex(item => item.label === 'Attack Brindle'));
      stepTutorial(C.DT);
      const attackAdvancesLesson = tutOpen('order') && soldiersOf(barracks)[0].ord?.k === 'attack';
      openBarracks(barracks);
      activate(menu.items.findIndex(item => item.label === 'Defend giant'));
      stepTutorial(C.DT);
      const acceptsQueuedDefense = tutDone('order');
      const noBarracksNoOrderGoal = !tutGoal('order').only({...player, id: -1});
      const attackCanBeSkipped = noBarracksNoOrderGoal && barracks.order.k === 'giant';
      state.tut = null;

      player.x = town.x + 300;
      build(player, 'house');
      stepJob(player, 6);
      player.x = town.x + 400;
      build(player, 'house');
      stepJob(player, 6);
      const soldier = soldiersOf(barracks)[0];
      const forager = state.humans.find(h => h.homeId === town.id);
      const rival = state.humans.find(h => h.town !== town.i);
      for (const h of [soldier, forager, rival, player]) {
        h.x = town.x + 550;
        h.y = town.y;
        h.hp = 50;
      }
      state.crystals = [];
      for (const h of [soldier, forager, rival, player]) stepHuman(h, 1, {x: 0, y: 0});
      const localRecoveryForBothUnits = soldier.hp === 52 && forager.hp === 52 && rival.hp === 50 && player.hp === 50;
      hurtHuman(forager, 4, 'beast');
      const afterHit = forager.hp;
      stepHuman(forager, 1, {x: 0, y: 0});
      const recoveryPausesAfterDamage = forager.hp === afterHit;
      return {namesBothRivals, showsRivalOnMap, teachesAttack, attackAdvancesLesson, acceptsQueuedDefense,
        attackCanBeSkipped, localRecoveryForBothUnits, recoveryPausesAfterDamage};
    });
    for (const [check, passed] of Object.entries(lesson)) assert.ok(passed, check);

    const housing = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const town = state.towns[player.town];
      const outpost = foundVillage(town.i, town.x + 2000, town.y);
      const initialHousing = foragersIn(town).length === 1 && foragersIn(outpost).length === 1;
      player.gold = 500;
      player.crystals = 20;
      const startHouse = (t, offset) => {
        player.x = t.x + offset;
        player.y = t.y;
        build(player, 'house');
      };
      startHouse(town, 250);
      const completionRequired = foragersIn(town).length === 1;
      stepJob(player, 6);
      const capacityIncreasesOnCompletion = foragersIn(town).length === 2 && foragerCapacity(town) === 2;
      upgrade(player, 'house', state.builds[0]);
      const upgradingKeepsSameForagerCount = foragersIn(town).length === 2;
      town.lvl = 2; // owner's rule: three houses at level 1 and two more per level
      for (const offset of [310, 370, 430]) { startHouse(town, offset); stepJob(player, 6); }
      const cappedAtFour = town.houses === 4 && foragersIn(town).length === 4;
      startHouse(outpost, 250);
      stepJob(player, 6);
      const outpostHasOwnCapacity = foragersIn(outpost).length === 2 && foragersIn(town).length === 4;
      const first = state.builds[0];
      const second = state.builds[1];
      destroyBuild(first);
      const surplusHouseLossKeepsForagers = foragersIn(town).length === 4;
      const headcount = state.humans.length;
      destroyBuild(second);
      const displaced = state.humans.find(h => isForager(h) && h.homeId == null);
      const housingLossDisplacesForager = !!displaced && foragersIn(town).length === 3 && state.humans.length === headcount;
      startHouse(town, 310);
      stepJob(player, 6);
      const rebuildRehousesForager = displaced?.homeId === town.id && foragersIn(town).length === 4 && state.humans.length === headcount;
      openTown(town, 'Hall');
      const hallShowsHousing = menu.body.includes('4/4 foragers');
      closeMenu();
      return {initialHousing, completionRequired, capacityIncreasesOnCompletion, upgradingKeepsSameForagerCount,
        cappedAtFour, outpostHasOwnCapacity, surplusHouseLossKeepsForagers, housingLossDisplacesForager,
        rebuildRehousesForager, hallShowsHousing};
    });
    for (const [check, passed] of Object.entries(housing)) assert.ok(passed, check);

    const rent = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const town = state.towns[player.town];
      const forager = foragersIn(town)[0];
      player.gold = forager.gold = 100;
      player.x = town.x + 250;
      player.y = town.y;
      forager.x = town.x + 320;
      forager.y = town.y;
      openBuild();
      const buildMenuShowsRent = menu.items.find(item => item.label.startsWith('House')).sub.includes('2 gold every 15 s');
      closeMenu();
      build(player, 'house');
      stepJob(player, 6);
      player.x = town.x + 320;
      build(player, 'house');
      stepJob(player, 6);
      const [house, otherHouse] = state.builds;
      const goldBefore = player.gold;
      const foragerGoldBefore = forager.gold;
      state.t = RENT_INTERVAL - .01;
      stepBuilds(C.DT);
      const noEarlyRent = player.gold === goldBefore && forager.gold === foragerGoldBefore;
      state.t = RENT_INTERVAL + .01;
      stepBuilds(C.DT);
      const heroGetsRent = player.gold === goldBefore + 4 && forager.gold === foragerGoldBefore;
      const playerSeesPayout = feed.some(item => item.text === 'House rent: +4 gold.');
      town.crystals = 3;
      const outpost = foundVillage(town.i, town.x + 2000, town.y);
      const distantForager = foragersIn(outpost)[0];
      const requiresLocalHeroHouse = !!canUpgrade(distantForager, 'house', house, 3) &&
        !!canUpgrade(forager, 'house', {...house, owner: forager.id}, 3);
      const playerCrystals = player.crystals;
      forager.x = house.x;
      forager.y = house.y;
      state.monsters = [];
      botHuman(forager, C.DT);
      const foragerUpgradesHouse = lv(house) === 2 && town.crystals === 0 &&
        player.crystals === playerCrystals && house.owner === player.id;
      damageBuild(otherHouse, 999, null);
      state.t = RENT_INTERVAL * 2 + .01;
      stepBuilds(C.DT);
      const upgradedRentPaysMore = player.gold === goldBefore + 8;
      // owner's rule: a house a forager built in the player's town pays the player, not the forager
      const fHouse = {k: 'house', x: town.x - 300, y: town.y, town: town.i, owner: forager.id, cd: 0, hp: C.HOUSE_HP, max: C.HOUSE_HP};
      state.builds.push(fHouse); const pg = player.gold, fg = forager.gold;
      state.t = RENT_INTERVAL * 3 + .01; stepBuilds(C.DT);
      const foragerHousePaysPlayer = player.gold === pg + 4 + Math.round(HOUSE_RENT * .5) && forager.gold === fg; // houses you did not build pay half
      return {foragerHousePaysPlayer, buildMenuShowsRent, noEarlyRent, heroGetsRent, playerSeesPayout, requiresLocalHeroHouse, foragerUpgradesHouse, upgradedRentPaysMore};
    });
    for (const [check, passed] of Object.entries(rent)) assert.ok(passed, check);

    const supplies = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const town = state.towns[player.town];
      player.gold = 300;
      player.x = town.x + 220;
      player.y = town.y;
      build(player, 'barracks');
      stepJob(player, 8);
      const barracks = tutBarracks(player);
      const supplyIndex = () => menu.items.findIndex(item => item.label.startsWith('Supply a brace kit'));
      openBarracks(barracks);
      const unavailableBeforeTraining = menu.items[supplyIndex()].why === 'Train a soldier first';
      trainSoldier(barracks);
      trainSoldier(barracks);
      const [first, second] = soldiersOf(barracks);
      const before = player.gold;
      openBarracks(barracks);
      activate(supplyIndex());
      const equipsSoldierWithoutTakingTheirGold = player.gold === before - C.COST.brace && first.kits.brace === 1 && first.gold === ARMY.SOL_GOLD;
      player.kits.brace = 1;
      openBarracks(barracks);
      activate(supplyIndex());
      const usesCarriedKit = player.kits.brace === 0 && player.gold === before - C.COST.brace && second.kits.brace === 1;
      const cannotDoubleSupply = !!menu.items[supplyIndex()].why;
      activate(menu.items.findIndex(item => item.label === 'Tend the giant'));
      stepArmy(C.DT);
      state.monsters = [];
      state.crystals = [];
      first.x = state.g.feet[0].x;
      first.y = state.g.feet[0].y;
      for (let tick = 0; tick < 1800 && !braces(); tick++) {
        state.t += C.DT;
        stepHuman(first, C.DT, botHuman(first, C.DT));
      }
      const buildsWithoutFighting = state.sites.some(site => site.build?.k === 'brace' && site.build.owner === first.id) && first.gold === ARMY.SOL_GOLD;
      return {unavailableBeforeTraining, equipsSoldierWithoutTakingTheirGold, usesCarriedKit, cannotDoubleSupply, buildsWithoutFighting};
    });
    for (const [check, passed] of Object.entries(supplies)) assert.ok(passed, check);
    assert.deepEqual(errors, []);
    console.log(`${Object.keys(results).length} barracks checks passed`);
    console.log(`${Object.keys(placement).length} barracks placement checks passed`);
    console.log(`${Object.keys(promotion).length} outpost promotion checks passed`);
    console.log('Ashville start and both rival towns’ expansion checks passed');
    console.log(`${Object.keys(economy).length} forager economy checks passed`);
    console.log(`${Object.keys(logistics).length} settlement logistics checks passed`);
    console.log(`${Object.keys(lesson).length} tutorial and house recovery checks passed`);
    console.log(`${Object.keys(housing).length} forager housing checks passed`);
    console.log(`${Object.keys(rent).length} house rent checks passed`);
    console.log(`${Object.keys(supplies).length} soldier supply checks passed`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
