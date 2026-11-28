const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

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
      const start = state.towns.map(town => ({
        foragers: foragersIn(town).length,
        heroes: state.humans.filter(person => person.hero && person.town === town.i).length
      }));
      const heroes = state.humans.filter(person => person.hero);
      const kitParity = heroes.every(hero => hero.gold === 40 && hero.kits.anchor === 3 &&
        hero.kits.ladder === 1 && hero.potions === 1 && hero.atk === 10 && hero.hp === 100);
      const [ashville, brindle, corvel] = heroes;
      const ashvilleForager = foragersIn(state.towns[0])[0];
      const soldier = mkHuman(0, false, 'warden');
      const cache = state.caches[0];
      Object.assign(ashvilleForager, { x: cache.x, y: cache.y });
      Object.assign(soldier, { x: cache.x, y: cache.y });
      const blocked = [ashvilleForager, soldier].every(person =>
        !searchCache(person, cache) && !humanAct(person, 'X') && cache.ready === 0 && person.gold === 30);
      const foragerJobs = Array.from({ length: 30 }, () => foragerQuest(ashvilleForager, state.towns[0]).k);

      Object.assign(ashville, { x: cache.x, y: cache.y });
      const ashvilleLoot = humanAct(ashville, 'X') && ashville.gold > 40 && cache.ready > state.t;
      Object.assign(brindle, { x: cache.x, y: cache.y });
      const noDoubleLoot = !searchCache(brindle, cache) && brindle.gold === 40;
      state.t = cache.ready;
      state.monsters = [];
      brindle.quest = newQuest(brindle, 'search');
      botHuman(brindle, C.DT);
      const brindleLoot = brindle.quest.done && brindle.gold > 40 && cache.ready > state.t;
      Object.assign(ashville, { x: state.towns[0].x, y: state.towns[0].y });
      Object.assign(ashvilleForager, { x: ashville.x, y: ashville.y });
      const troll = { x: brindle.x + 40, y: brindle.y, kind: 'troll', r: 30, hp: 100, cd: 0 };
      state.monsters = [troll];
      for (let i = 0; i <= Math.ceil(CB.CHARGE_FULL / C.DT); i++) botGroundStrike(brindle, troll, C.DT);
      const rivalHeavyAttack = troll.hp === 100 - Math.round(brindle.atk * 2.5);
      state.monsters = [];

      Object.assign(corvel, { x: state.towns[2].x, y: state.towns[2].y, gold: 200, crystals: C.HORN_CRYSTALS });
      botShop(corvel);
      const rivalShop = corvel.horn === 1 && corvel.gear.blade > 0 && corvel.atk > ashville.atk;
      for (const chain of state.chains) chain.hp = 0;
      const rivalClimb = pickGoalHero(corvel).k === 'foot' && mount(corvel, 0) &&
        botGoalCells(corvel).kind === 'wake';
      corvel.cl.y = C.WAKE_ROW + .5;
      corvel.cl.grab = null;
      const rivalHorn = humanAct(corvel, 'A') && state.waker === corvel;
      interruptWake(corvel);
      const site = state.sites[0];
      Object.assign(corvel.cl, { y: site.r + .5, x: site.c + .5 });
      state.g.awake = true;
      botClimb(corvel);
      const rivalBuildsOnGiant = corvel.job?.k === 'ladder' && site.pending === corvel.id;
      dropJob(corvel);
      Object.assign(corvel.cl, { y: 30.5, x: 10.5, path: [[33, 10]], move: null });
      const grip = corvel.grip;
      stepClimb(corvel, C.DT, { x: 0, y: 0 });
      const rivalLunges = corvel.cl.move?.lunge && corvel.grip <= grip - C.LUNGE_GRIP;

      const town = state.towns[0];
      for (let i = 0; i < 3; i++) {
        Object.assign(ashville, { x: town.x + 100 + i * 60, y: town.y });
        finishBuild0(ashville, 'house');
      }
      const roomOnly = foragersIn(town).length === 1 && foragerCapacity(town) === 4;
      town.food = 999; for (let i = 0; i < 3; i++) queueVillager(town);
      for (let k = 0; k < 3 * C.VILLAGER_TIME + 2; k++) { state.t += 1; stepEconomy(1); }
      const grown = roomOnly ? foragersIn(town).length : -1;
      const giantGame = __col.newGame('giant', 1);
      return {
        start, kitParity, ashvilleIsPlayer: ashville === state.you,
        blocked, foragerJobs, ashvilleLoot, noDoubleLoot, brindleLoot, rivalHeavyAttack, rivalShop, rivalClimb,
        rivalHorn, rivalBuildsOnGiant, rivalLunges,
        grown, giantModeHeroes: giantGame.humans.filter(person => person.hero).length
      };
    });

    assert.deepEqual(errors, []);
    assert.deepEqual(results.start, Array.from({ length: 3 }, () => ({ foragers: 1, heroes: 1 })));
    assert.equal(results.grown, 4);
    assert.equal(results.giantModeHeroes, 3);
    assert.ok(!results.foragerJobs.includes('search'));
    for (const key of ['kitParity', 'ashvilleIsPlayer', 'blocked', 'ashvilleLoot', 'noDoubleLoot', 'brindleLoot',
      'rivalHeavyAttack', 'rivalShop', 'rivalClimb', 'rivalHorn', 'rivalBuildsOnGiant', 'rivalLunges']) {
      assert.equal(results[key], true, key);
    }
    console.log('Hero, chest access, and starting population checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
