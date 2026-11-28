// Colossus: the town economy (food, wood and stone, villagers at work, materials on buildings, ages) and the quest
// Board with its collapsible tracker. Run: node tests/economy.js
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/three.min.js', r => r.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.__col);
    const r = await page.evaluate(() => {
      const out = {};
      const run = (S, sec) => { const end = S.t + sec; while (S.t < end) __col.step(1); };
      // stockpiles and quarries
      let S = __col.newGame('human', 3), h = S.you, home = S.towns[h.town];
      out.startStock = S.towns.every(t => t.food === C.START_RES.food && t.wood === C.START_RES.wood && t.stone === C.START_RES.stone);
      out.quarries = S.towns.every(t => S.quarries.filter(q => q.town === t.i).length === 2) && S.quarries.every(q => !inSolid(q.x, q.y, 60));
      // materials: a house takes wood from the nearest stockpile; without the wood it says what is missing
      h.gold = 500; h.x = home.x + 260; h.y = home.y; const w0 = home.wood;
      out.housePaysWood = build(h, 'house') && home.wood === w0 - C.RES_COST.house.wood; stepJob(h, 10);
      home.wood = 10; h.x = home.x - 260; out.noWoodNoHouse = canBuild(h, 'house') === 'Need 30 more wood' && !build(h, 'house');
      home.wood = 500;
      // settlers: a level 1 house holds 5 (owner); they walk in to it; nobody is trained or assigned
      const house = S.builds.find(b => b.k === 'house' && b.town === h.town); houseInit(house);
      out.startPop = S.towns.every(t => t.pop === C.HALL_POP) && occCap(house) === 5 && popCap(home) === C.HALL_POP + 5;
      S.monsters = []; S.events = []; run(S, 40);
      out.settlersArrive = house.occ > 0 && house.occ <= 5;
      out.noTraining = typeof queueVillager === 'undefined' && !/Train a villager/.test((openTown(home, 'Hall'), menu.items.map(i => i.label).join('|'))); closeMenu();
      // a house keeps food and water, 30 a level, starting at 30; every 10 s both drop by its occupants (owner)
      { const hb = {k: 'house', x: home.x + 900, y: home.y + 900, town: h.town, settlementId: home.id, cd: 0}; S.builds.push(hb); houseInit(hb); const start = hb.food === 30 && hb.water === 30 && houseMax(hb) === 30;
        hb.occ = 5; stepHouses(); out.houseNeeds = start && hb.food === 25 && hb.water === 25; hb.lvl = 2; out.storeGrows = houseMax(hb) === 60;
        // a house with water or food gone for long falls a level; with no food its settlers leave
        hb.water = 0; hb.food = 0; for (let k = 0; k < C.LACK_GRACE / 10; k++) stepHouses(); out.devolves = lv(hb) === 1;
        const occ0 = hb.occ; for (let k = 0; k < C.HUNGER_LEAVE / 10 + 1; k++) stepHouses(); out.hungerDrivesThemOut = hb.occ < occ0;
        S.builds = S.builds.filter(b => b !== hb); S.walkers = S.walkers.filter(w => w.k !== 'leaver'); }
      // placement: a woodcutter anywhere in town; a farm by water; a well not on high ground; a quarry by an outcrop
      const at = p => { h.x = p.x; h.y = p.y; h.job = null; };
      const spot = ok => { for (let r = home.r + 70; r < ringR(home) - 30; r += 40) for (let a = 0; a < 6.28; a += .3) { const p = {x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r}; at(p); if (ok(p)) return p; } return null; };
      const free = p => !S.builds.some(b => Math.hypot(b.x - p.x, b.y - p.y) < 60) && !inSolid(p.x, p.y, 40);
      out.woodcutterAnywhere = !!spot(p => free(p) && canBuild(h, 'woodcutter') === null);
      const dry = spot(p => free(p) && !nearWater(p.x, p.y)); out.farmNeedsWater = !dry || canBuild(h, 'farm') === 'Build it beside a river or lake';
      let high = null; for (let k = 0; k < 4000 && !high; k++) { const x = Math.random() * C.MAP, y = Math.random() * C.MAP; if (groundH(x, y) > C.MOUNTAIN_H + 20) high = {x, y}; }
      at(high); out.wellNotOnMountain = /high ground/.test(placeWhy(h, 'well') || '') && (at({x: home.x + home.r * .5, y: home.y}), placeWhy(h, 'well') == null);
      spot(p => free(p) && !outcropNear(p.x, p.y)); out.qWhy = canBuild(h, 'quarry'); out.quarryNeedsOutcrop = out.qWhy === 'Build it beside a stone outcrop';
      // every bot site passes the player's placement rule (GPTBS fc6a998c), on three seeds
      { const bad = []; const keep = __col.S; for (const seed of [1, 2, 3]) { const G = __col.newGame('human', seed); for (const t of G.towns) { const hero = G.humans.find(x => x.hero && x.town === t.i) || G.you;
          for (const k of ['farm', 'well', 'quarry', 'woodcutter', 'granary', 'market']) { const p = botSite(t, k, () => .37); if (!p) { if (k !== 'quarry') bad.push(seed + ' ' + t.name + ' ' + k + ' no site'); continue; }
            const hx = hero.x, hy = hero.y, g = hero.gold; hero.x = p.x; hero.y = p.y; hero.gold = 999; hero.job = null; const why = canBuild(hero, k); hero.x = hx; hero.y = hy; hero.gold = g; if (why) bad.push(seed + ' ' + t.name + ' ' + k + ': ' + why); } } }
        out.botSiteFails = bad.join('; '); out.botSitesPass = !bad.length; S = __col.newGame('human', 3); h = S.you; home = S.towns[h.town]; S.monsters = []; S.events = []; }
      // a farm grows 60 s, harvests 10 s, only with workers; the harvest is carried to the granary (owner)
      const fp = botSite(home, 'farm', () => .5), farm = {k: 'farm', x: fp.x, y: fp.y, town: h.town, settlementId: home.id, cd: 0, staff: 6};
      const gran = {k: 'granary', x: home.x + 60, y: home.y + 60, town: h.town, settlementId: home.id, cd: 0, staff: 5}; S.builds.push(farm, gran);
      farm.staff = 0; stepFarms(30); const idle = !farm.grow; farm.staff = 6;
      for (let k = 0; k < 59; k++) stepFarms(1); const growing = farm.harvT == null && farm.grow > 58; stepFarms(1); const harvesting = farm.harvT === 0;
      for (let k = 0; k < 10; k++) stepFarms(1); const hw = S.walkers.find(w => w.k === 'harvest');
      out.farmCycle = idle && growing && harvesting && !!hw && hw.load === C.FARM_YIELD && farm.grow === 0 && Math.hypot(hw.tx - gran.x, hw.ty - gran.y) < 1;
      const f0 = home.food = 0; for (let k = 0; k < 2000 && S.walkers.includes(hw); k++) stepWalkers(.1); out.harvestReachesGranary = home.food === C.FARM_YIELD;
      // the granary carts 80 food to a bazaar; the bazaar's trader takes up to 100 to the houses near it (owner)
      const baz = {k: 'market', x: home.x - 80, y: home.y + 40, town: h.town, settlementId: home.id, cd: 0, staff: 4, store: 0}; S.builds.push(baz); home.food = 300;
      dispatch(); const cart = S.walkers.find(w => w.k === 'grain'); const sent = !!cart && cart.load === C.CARRY_GRAIN && Math.round(home.food) === 300 - C.CARRY_GRAIN;
      for (let k = 0; k < 2000 && S.walkers.includes(cart); k++) stepWalkers(.1); out.granaryToBazaar = sent && baz.store === C.CARRY_GRAIN;
      const hn = {k: 'house', x: baz.x + 300, y: baz.y, town: h.town, settlementId: home.id, cd: 0}; S.builds.push(hn); houseInit(hn); hn.occ = 5; hn.food = 0; hn.water = 0; baz.store = 200; baz.next = 0;
      dispatch(); const trader = S.walkers.find(w => w.k === 'food'); const tSent = !!trader && trader.load === C.CARRY_FOOD && baz.store === 100;
      for (let k = 0; k < 3000 && S.walkers.includes(trader); k++) stepWalkers(.1); out.bazaarFeeds = tSent && hn.food === houseMax(hn);
      const well = {k: 'well', x: hn.x - 150, y: hn.y + 60, town: h.town, settlementId: home.id, cd: 0, staff: 2}; S.builds.push(well); dispatch();
      const wc0 = S.walkers.find(w => w.k === 'water'); const wSent = !!wc0 && wc0.load === C.CARRY_WATER;
      for (let k = 0; k < 3000 && S.walkers.includes(wc0); k++) stepWalkers(.1); out.wellCarries = wSent && hn.water === houseMax(hn);
      // a house levels up only with food and water in it (owner)
      h.crystals = 50; hn.owner = h.id; hn.food = 0; const noFood = /food/.test(canUpgrade(h, 'house', hn) || ''); hn.food = 10; out.upgradeNeedsSupply = noFood && canUpgrade(h, 'house', hn) === null;
      // nobody walks about without a purpose: every walker is a newcomer, a leaver or a carrier with a load
      run(S, 60); out.noIdleWalkers = S.walkers.every(w => ['settler', 'leaver', 'water', 'food', 'grain', 'harvest'].includes(w.k));
      // workers are where they work: a staffed building shows its workers beside it
      out.workersAtWork = workerSpots({...farm, present: 1}, 1).length === 1 && workerSpots({...farm, present: 6}, 1).length === 6 && workerSpots({...gran, present: 0}, 1).length === 0 && workerSpots({...gran, present: 5, out: {}}, 1).length === 4 && workerSpots({...gran, present: 5}, 1).every(p => Math.hypot(p.x - gran.x, p.y - gran.y) < 70);
      // woodcutters and quarries: staffed from the settlers and productive only while staffed
      const wsite = spot(p => free(p) && canBuild(h, 'woodcutter') === null); out.woodcutterBuilt = build(h, 'woodcutter'); stepJob(h, 30);
      const q0 = S.quarries.find(q => q.town === h.town); at({x: q0.x + 120, y: q0.y}); out.quarryBuilt = build(h, 'quarry'); stepJob(h, 30);
      const wc = S.builds.find(b => b.k === 'woodcutter'), qy = S.builds.find(b => b.k === 'quarry');
      home.hall = 30; allocate(home); for (const p of S.people) if (p.job) { quit(p); } for (const p of S.people) if (p.tid === home.id && !p.job) { const b = [wc, qy].find(b => b.staff < 99 && S.people.filter(q => q.job === b).length < C.JOBS[b.k]); if (b) { p.job = b; p.st = 'work'; } } countPresent(); wc.staff = S.people.filter(p => p.job === wc).length; qy.staff = S.people.filter(p => p.job === qy).length;
      out.staffedFromSettlers = wc.present > 0 && qy.present > 0;
      const tick = () => { const w = home.wood, st = home.stone; S.t = Math.floor(S.t / RENT_INTERVAL + 1) * RENT_INTERVAL + .01; stepEconomy(.02); return [home.wood - w, home.stone - st]; };
      const [dw, ds] = tick(); out.workplacesProduce = dw >= C.PROD.woodcutter.wood * wc.staff / C.JOBS.woodcutter - .01 && ds > 0;
      home.hall = 0; for (const b of S.builds) if (b.k === 'house') b.occ = 0; allocate(home); const emptied = wc.staff === 0 && qy.staff === 0; const [dw0, ds0] = tick();
      out.emptyWorkplacesIdle = emptied && dw0 < 3 && ds0 < 2; // only the hall's small trickle (2 wood, 1 stone a 10 s)
      // labour order: raising a kind in the Hall gives it workers first
      const aside = [farm, gran, baz, well]; aside.forEach(b => { b.hp = 0; });
      // one worker: the kind put first in the Hall gets it; two: each gets one before either gets a second
      home.hall = 1; home.pri = 'quarry'; allocate(home); const qFirst = qy.staff === 1 && wc.staff === 0; home.pri = 'woodcutter'; allocate(home); const wFirst = wc.staff === 1 && qy.staff === 0;
      home.hall = 2; home.pri = 'quarry'; allocate(home); out.labourPriority = qFirst && wFirst && wc.staff === 1 && qy.staff === 1; home.pri = null; home.hall = 30; allocate(home); aside.forEach(b => { delete b.hp; }); allocate(home);
      // different workplaces employ different numbers (owner)
      out.jobsDiffer = new Set(Object.values(C.JOBS)).size >= 6;
      // a staffed granary holds more food
      gran.present = 0; const capE = foodCap(home); gran.present = 5; out.granaryStores = foodCap(home) === capE + C.GRANARY_CAP;
      // fire: a building no fire station reaches can catch fire; you beat it out, or a staffed fire station does
      const p0 = C.FIRE_P; C.FIRE_P = 1; wc.risk = C.FIRE_SAFE + 1; S.you.x = home.x; S.you.y = home.y; stepFires(); C.FIRE_P = p0;
      const caught = !!wc.fire; at({x: wc.x + 40, y: wc.y}); stepFires(); stepFires(); stepFires();
      out.youBeatItOut = caught && !wc.fire;
      wc.fire = S.t; h.x = home.x; h.y = home.y; S.builds.push({k: 'firehouse', x: wc.x + 300, y: wc.y, town: h.town, settlementId: home.id, cd: 0, staff: 4}); stepFires(); stepFires(); stepFires();
      out.fireStationPutsOut = !wc.fire && covered(wc) && (stepFires(), wc.risk === 0);
      // roads: a way walked often enough by the settlers becomes a road, faster to walk on
      { const w = {x: home.x + home.r + 400, y: home.y + 37, cell: -1}, c = landCell(w.x, w.y), worn0 = S.worn || 0; for (let k = 0; k < C.ROAD_STEPS; k++) { w.cell = -1; footfall(w); }
        out.settlersWearRoads = !!S.land.road[c] && (S.worn || 0) === worn0 + 1 && onRoad(w.x, w.y); }
      // quests on the Board: offered, taken (at most three), each step pays when its state is true
      S = __col.newGame('human', 4); h = S.you; home = S.towns[h.town]; h.x = home.x; h.y = home.y; S.headless = false;
      openTown(home, 'Board');
      out.boardOffersQuests = menu.items.some(i => i.label === 'New quest · A town of our own') && menu.items.some(i => /^Task · /.test(i.label));
      menu.items.find(i => i.label === 'New quest · A town of our own').act();
      out.taken = questOpen(h).length === 1 && h.track === 'q:charter';
      const g0 = h.gold; h.gold += 500; h.x = home.x + 150; h.y = home.y + 40; h.x = home.x + home.r + 60; h.y = home.y; out.hWhy = canBuild(h, 'house'); build(h, 'house'); stepJob(h, 10); run(S, 2);
      out.stepPays = questOpen(h)[0].i >= 1 && h.gold > g0 + 500 - C.COST.house;
      takeQuest(h, 'walls'); h.qDone = {charter: 1}; home.lvl = 2; takeQuest(h, 'trade');
      openTown(home, 'Board'); const fourth = menu.items.find(i => i.label === 'New quest · The frontier');
      out.maxThree = questOpen(h).length === 3 && !!fourth && /finish or drop one/.test(fourth.why || ''); closeMenu();
      dropQuest(h, 'trade'); out.drop = questOpen(h).length === 2;
      // the tracker: collapsed it is one line; opened it lists every quest; the toggle flips it
      save.qOpen = 0; paintHud(); const g = document.getElementById('goal');
      out.collapsedOneLine = g.querySelectorAll('.jg').length === 0 && g.querySelectorAll('.qh').length === 1 && /A town of our own|Hold the walls/.test(g.textContent);
      questToggle(); paintHud();
      out.openLists = g.querySelectorAll('.jg[data-q]').length === 2 && !!save.qOpen;
      questToggle(); paintHud(); out.closesAgain = g.querySelectorAll('.jg').length === 0;
      questCycle(h); out.cycleTracks = !!h.track;
      // soldiers eat: training one takes food from the barracks' settlement, and without the food it says so
      h.x = home.x + 230; h.y = home.y - 60; h.gold += 500; build(h, 'barracks'); stepJob(h, 10);
      const bk = S.builds.find(b => b.k === 'barracks' && b.owner === h.id);
      home.food = 10; openBarracks(bk); const tItem = () => menu.items.find(i => /^Train a soldier/.test(i.label));
      const blocked = tItem().why === 'Need 30 more food'; home.food = 100; openBarracks(bk); tItem().act(); closeMenu();
      out.soldierFood = !!bk && blocked && home.food === 100 - C.SOLDIER_FOOD && bk.q === 1;
      // a market sells surplus materials for gold; without one the Hall offers no sale
      h.x = home.x; h.y = home.y; openTown(home, 'Hall'); const noMarket = !menu.items.some(i => /^Sell 100/.test(i.label)); closeMenu();
      S.builds.push({k: 'market', x: home.x + 60, y: home.y, town: h.town, owner: h.id, settlementId: home.id, cd: 0});
      home.food = 300; const gm = h.gold; openTown(home, 'Hall'); menu.items.find(i => i.label.startsWith('Sell 100 food')).act(); closeMenu();
      out.marketSells = noMarket && home.food === 200 && h.gold === gm + C.SELL.food;
      // an urgent pointer shows under the collapsed tracker; an ordinary one does not
      save.qOpen = 0; h.x = home.x + 900; h.y = home.y; h.pack.crystals = packCap(h); paintHud();
      const urgentShown = !!document.querySelector('#goal .jg.urgent'); h.pack.crystals = 0; paintHud();
      out.urgentNow = urgentShown && !document.querySelector('#goal .jg.urgent');
      // during the first day the journal holds the goal box: a quest taken then must still show there (owner: quests were not tracked)
      const F = __col.newGame('human', 6); F.tut = tutNewDay(); F.headless = false; const fh = F.you; takeQuest(fh, 'walls'); save.qOpen = 0; paintHud();
      const fg = document.getElementById('goal'); const firstDayShowsQuest = tutActive() && fg.textContent.includes('Hold the walls') && !!fg.querySelector('[data-q="q:walls"]');
      save.qOpen = 1; paintHud(); const firstDayOpenLists = fg.textContent.includes('Hold the walls'); save.qOpen = 0;
      out.firstDayQuest = firstDayShowsQuest && firstDayOpenLists; F.headless = true; __col.newGame('human', 4); S = __col.S; h = S.you; home = S.towns[h.town];
      takeQuest(h, 'charter'); takeQuest(h, 'walls'); S.headless = false;
      // nothing the feed says is lost: the message log keeps it
      toast('test message 42'); out.messageLog = msgLog.some(m => m.text === 'test message 42');
      // the resource bar shows the stockpile of your town
      paintRes(); const rb = document.getElementById('res');
      out.resourceBar = !rb.hidden && rb.textContent.includes(String(Math.floor(home.wood))) && rb.textContent.includes(ageOf(home));
      S.headless = true;
      return out;
    });
    assert.deepEqual(errors, []);
    for (const [k, v] of Object.entries(r)) if (typeof v === 'boolean') assert.ok(v, k + ' ' + JSON.stringify(Object.fromEntries(Object.entries(r).filter(([, x]) => typeof x !== 'boolean'))));
    console.log(Object.keys(r).filter(k => typeof r[k] === 'boolean').length + ' economy and quest checks passed ');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
