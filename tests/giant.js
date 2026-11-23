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

    const stateChanges = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const waker = state.humans.find(h => !h.you);
      const site = state.sites[0];
      state.t = C.DUSK - 1;
      mount(player, 0);
      player.kits.ladder = 1;
      const workStarted = placeOnSite(player, site, 'ladder');
      mount(waker, 0);
      waker.cl.y = C.WAKE_ROW + 1;
      waker.horn = 1;
      for (const chain of state.chains) chain.hp = 0;
      const hornStarted = humanAct(waker, 'A');
      state.wakeT = 7;

      state.t = C.DUSK;
      stepDays(C.DT);
      const duskReleasesSite = workStarted && !player.job && !site.pending && !site.build;
      const duskReleasesHorn = hornStarted && !waker.waking && !state.waker && state.wakeT === 4;
      const nightBlocksRemount = !mount(waker, 0) && waker.mode === 'ground';

      state.t = C.DUSK + C.NIGHT + C.DT;
      stepDays(C.DT);
      const canResumeAtDawn = mount(waker, 0);
      waker.cl.y = C.WAKE_ROW + 1;
      const canRestartHorn = humanAct(waker, 'A');
      killHuman(waker, 'beast');
      const deathReleasesHorn = canRestartHorn && !waker.waking && !state.waker;
      return {duskReleasesSite, duskReleasesHorn, nightBlocksRemount, canResumeAtDawn, deathReleasesHorn};
    });
    for (const [check, passed] of Object.entries(stateChanges)) assert.ok(passed, check);

    const limits = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const a = state.you;
      const b = state.humans.find(h => !h.you && h.town === a.town);
      for (const site of state.sites.slice(0, BRACES_MAX - 1)) site.build = {k: 'brace'};
      const lastBrace = state.sites[BRACES_MAX - 1];
      const otherSite = state.sites[BRACES_MAX];
      a.kits.brace = b.kits.brace = 1;
      const reservedBrace = placeOnSite(a, lastBrace, 'brace');
      const concurrentBraceRejected = !placeOnSite(b, otherSite, 'brace') && b.kits.brace === 1 && !otherSite.pending;
      dropJob(a);
      const braceSlotReused = placeOnSite(b, otherSite, 'brace');
      stepJob(b, BUILD_TIME.brace);
      const braceLimitRespected = braces() === BRACES_MAX;

      const cannonSite = state.sites[BRACES_MAX + 1];
      const pendingCannon = state.sites[BRACES_MAX + 2];
      const spareSite = state.sites[BRACES_MAX + 3];
      cannonSite.build = {k: 'cannon', town: a.town};
      a.kits.cannon = b.kits.cannon = 1;
      const reservedCannon = placeOnSite(a, pendingCannon, 'cannon');
      const concurrentCannonRejected = !placeOnSite(b, spareSite, 'cannon') && b.kits.cannon === 1 && !spareSite.pending;
      return {reservedBrace, concurrentBraceRejected, braceSlotReused, braceLimitRespected, reservedCannon, concurrentCannonRejected};
    });
    for (const [check, passed] of Object.entries(limits)) assert.ok(passed, check);

    const chains = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const town = state.towns[1];
      const builder = state.humans.find(h => h.hero && h.town === town.i);
      builder.gold = C.COST.barracks;
      builder.x = town.x + 200;
      builder.y = town.y;
      build(builder, 'barracks');
      stepJob(builder, BUILD_TIME.barracks);
      const barracks = barracksOf(town.i, town)[0];
      trainSoldier(barracks);
      const soldier = soldiersOf(barracks)[0];
      giveOrder(barracks, 'tend');
      soldier.x = state.g.feet[1].x;
      soldier.y = state.g.feet[1].y;
      state.monsters = [];
      const right = state.chains.find(chain => chain.id === 'ankleR');
      const before = right.hp;
      state.t = C.CHAIN_OPEN;
      botHuman(soldier, C.DT);
      const struckFromGround = soldier.mode === 'ground' && right.hp === before - soldier.atk && soldier.chainHits === 1;
      const rejectedHitsNotCounted = !strikeChain(soldier, right) && soldier.chainHits === 1;
      for (const chain of state.chains) chain.hp = 0;
      soldier.horn = 1;
      const raid = {k: 'raid', i: town.i, town: town.id, go: state.t};
      state.events = [raid];
      state.monsters = [{x: soldier.x + 100, y: soldier.y, raid}];
      const hornTakesPriority = pickGoalSol(soldier)?.k === 'foot';
      soldier.ord = null;
      const hornCarrierNotAssignedEscort = !canEscort(soldier, {from: town.id});
      return {struckFromGround, rejectedHitsNotCounted, hornTakesPriority, hornCarrierNotAssignedEscort};
    });
    for (const [check, passed] of Object.entries(chains)) assert.ok(passed, check);

    const horn = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const keeper = state.humans.find(h => h.town === 1);
      keeper.role = 'keeper';
      keeper.horn = 1;
      state.t = C.CHAIN_OPEN;
      for (const chain of state.chains) chain.hp = 0;
      mount(keeper, 0);
      const row = C.WAKE_ROW;
      const col = 15;
      state.body.g[row * COLS + col] = HOLD;
      state.body.h[row * COLS + col] = 3;
      keeper.cl.x = col + .5;
      keeper.cl.y = row + .5;
      keeper.rest = true;
      keeper.grip = 60;
      botClimb(keeper);
      const last = keeper.cl.path?.at(-1);
      const leavesUnstableHold = !keeper.waking && !keeper.rest && !!last && wakeLedge(...last);

      keeper.cl.y = last[0] + .5;
      keeper.cl.x = last[1] + .5;
      botClimb(keeper);
      const startsHornOnLedge = keeper.waking && state.waker === keeper;
      keeper.cl.path = [[last[0] - 1, last[1]]];
      for (let i = 0; i < Math.ceil(C.WAKE_TIME / C.DT) + 1 && !state.g.awake; i++) {
        botClimb(keeper);
        stepClimb(keeper, C.DT, {x: 0, y: 0});
      }
      const finishesHornWithoutMoving = state.g.awake && !keeper.horn && keeper.cl.y === last[0] + .5;
      return {leavesUnstableHold, startsHornOnLedge, finishesHornWithoutMoving};
    });
    for (const [check, passed] of Object.entries(horn)) assert.ok(passed, check);

    const combat = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const home = state.towns[player.town];
      const [sheltered, outside] = state.humans.filter(h => h.town !== player.town);
      player.x = home.x + home.r + 24;
      player.y = home.y;
      sheltered.x = home.x + home.r + 18;
      sheltered.y = player.y;
      sheltered.hp = 1;
      outside.x = player.x + 28;
      outside.y = player.y;
      outside.hp = 15;
      const wolf = {x: player.x + 38, y: player.y, r: 12, hp: 30};
      const troll = {x: player.x + 50, y: player.y, r: 28, hp: 80};
      state.monsters = [wolf, troll];
      const nearestBeastUsesBodyEdge = nearMonster(player, 60) === troll;
      const filtersBeasts = nearMonster(player, 60, m => m !== troll) === wolf;
      const wallsProtectRival = rivalNear(player, 60) === outside && attackTarget(player) === outside;
      player.x = home.x + home.r + 19;
      const playerProtectedInside = townAt(player) === home && rivalNear(player, 60) === null;
      player.x += 1;
      const exactBoundaryOutside = townAt(player) === null;
      return {nearestBeastUsesBodyEdge, filtersBeasts, wallsProtectRival, playerProtectedInside, exactBoundaryOutside};
    });
    for (const [check, passed] of Object.entries(combat)) assert.ok(passed, check);

    const climbing = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const player = state.you;
      const heading = fwd(state.g);
      const foot = state.g.feet[0];
      const offset = p => (p.x - foot.x) * heading.x + (p.y - foot.y) * heading.y;
      player.x = foot.x + heading.x * 120;
      player.y = foot.y + heading.y * 120;
      const frontStart = {x: player.x, y: player.y};
      const grabbedFront = mount(player, 0) && player.cl.face === 1;
      const startsWherePlayerStood = distSq(climberWorld(player), frontStart) < .001;
      const reachable = bfs(Math.floor(player.cl.y), Math.floor(player.cl.x), r => r >= 46);
      const canClimbFromFirstHold = !!reachable;
      state.t += GRAB_TIME + C.DT;
      stepClimb(player, C.DT, {x: 0, y: 1});
      const climbsOnFront = player.cl.move?.ty > player.cl.y && offset(climberWorld(player)) > 0;
      G3.active = true;
      const screenRightOnFront = climbInput(player, {x: 1, y: -1}).x === -1;
      G3.active = false;
      const flatMapControlsUnchanged = climbInput(player, {x: 1, y: -1}).x === 1;
      dismount(player, 0);
      const stepsOffOnFront = player.mode === 'ground' && offset(player) > 0;

      player.x = foot.x - heading.x * 120;
      player.y = foot.y - heading.y * 120;
      const grabsBackWhenApproached = mount(player, 0) && player.cl.face === -1 && offset(bodyWorld(player.cl.x, player.cl.y, player.cl.face)) < 0;
      leaveClimb(player);
      const otherFoot = state.g.feet[1];
      player.x = otherFoot.x + heading.x * 100 - heading.y * 60;
      player.y = otherFoot.y + heading.y * 100 + heading.x * 60;
      mount(player, 1);
      const skipsIsolatedOutsideHold = player.cl.x < 25.5 && !!bfs(1, Math.floor(player.cl.x), (r, c) => r >= 46 && c >= COLS / 2);
      return {grabbedFront, startsWherePlayerStood, canClimbFromFirstHold, climbsOnFront,
        screenRightOnFront, flatMapControlsUnchanged, stepsOffOnFront, grabsBackWhenApproached, skipsIsolatedOutsideHold};
    });
    for (const [check, passed] of Object.entries(climbing)) assert.ok(passed, check);

    const wolves = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const wildWolf = () => state.monsters.find(m => m.wild && m.kind === 'wolf');
      const eventWolf = () => ({...wildWolf(), id: state.nextId++, wild: false});
      const extra = eventWolf();
      state.monsters.push(extra);
      killMonster(wildWolf(), null);
      const immediateWildWolfRefill = state.monsters.length === C.MONSTERS + 1 &&
        state.monsters.at(-1).wild && state.monsters.at(-1).kind === 'wolf';
      wildWolf().hp = 0;
      stepMonsters(C.DT);
      const environmentalKillsAlsoRefill = state.monsters.length === C.MONSTERS + 1 &&
        state.monsters.at(-1).wild && state.monsters.at(-1).kind === 'wolf';
      killMonster(extra, null);
      const eventWolvesDoNotRefill = state.monsters.length === C.MONSTERS;
      state.monsters.push(eventWolf());
      killMonster(state.monsters.find(m => m.kind === 'troll'), null);
      const trollsUseOrdinaryPool = state.monsters.length === C.MONSTERS;
      while (state.monsters.length <= WOLF_REFILL_LIMIT) state.monsters.push(eventWolf());
      killMonster(wildWolf(), null);
      const refillHeadroomCapped = state.monsters.length === WOLF_REFILL_LIMIT && WOLF_REFILL_LIMIT === 184;
      return {immediateWildWolfRefill, environmentalKillsAlsoRefill, eventWolvesDoNotRefill,
        trollsUseOrdinaryPool, refillHeadroomCapped};
    });
    for (const [check, passed] of Object.entries(wolves)) assert.ok(passed, check);

    const trolls = await page.evaluate(() => {
      const state = __col.newGame('human', 1);
      const wild = state.monsters.filter(m => m.kind === 'troll');
      const wildSpawnsRespectLimit = wild.length > 0 && wild.every(m =>
        wild.filter(other => distSq(m, other) <= TROLL_LOCAL_RADIUS ** 2).length <= TROLL_LOCAL_LIMIT);
      const town = state.towns[0];
      const ruin = {x: town.x + 2000, y: town.y};
      state.monsters = [{...ruin, kind: 'troll', hp: 90}];
      startRaid(town, 'Ruin raid', ruin);
      const raiders = state.monsters.filter(m => m.raid);
      const raidUsesTwoTrollsAndWolf = raiders.length === 3 && raiders.filter(m => m.kind === 'troll').length === 2;
      const fullAreaBlocksMoreTrolls = !canSpawnTroll(ruin.x, ruin.y);
      const distantAreaAllowsTrolls = canSpawnTroll(ruin.x + TROLL_LOCAL_RADIUS * 2, ruin.y);

      const ambushX = town.x + 1050;
      state.monsters = [-10, 0, 10].map(dx => ({x: ambushX + dx, y: town.y, kind: 'troll', hp: 90}));
      const originalVillageSite = villageSite;
      villageSite = () => ({x: town.x + 3000, y: town.y});
      try { startCaravan(town); } finally { villageSite = originalVillageSite; }
      const ambush = state.monsters.filter(m => m.ambush);
      const crowdedAmbushUsesWolves = ambush.length === 3 && ambush.every(m => m.kind === 'wolf');
      return {wildSpawnsRespectLimit, raidUsesTwoTrollsAndWolf, fullAreaBlocksMoreTrolls, distantAreaAllowsTrolls, crowdedAmbushUsesWolves};
    });
    for (const [check, passed] of Object.entries(trolls)) assert.ok(passed, check);

    assert.deepEqual(errors, []);
    const checks = [stateChanges, limits, chains, horn, combat, climbing, wolves, trolls].reduce((n, group) => n + Object.keys(group).length, 0);
    console.log(`${checks} giant, combat, climbing, and respawn checks passed`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
