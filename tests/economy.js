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
      // settlers: a house makes room for six; they walk in while there is food, and nobody is trained or assigned
      out.startPop = S.towns.every(t => t.pop === C.HALL_POP) && popCap(home) === C.HALL_POP + C.HOUSE_POP;
      S.monsters = []; S.events = []; home.food = 300; run(S, 40);
      out.settlersArrive = home.pop > C.HALL_POP && home.pop <= popCap(home);
      out.noTraining = typeof queueVillager === 'undefined' && !/Train a villager/.test((openTown(home, 'Hall'), menu.items.map(i => i.label).join('|'))); closeMenu();
      // workplaces: placed by what they need, staffed from the settlers, and productive only while staffed
      const at = p => { h.x = p.x; h.y = p.y; h.job = null; };
      at(S.quarries.find(q => q.town === h.town)); h.x += 150; out.woodcutterNeedsForest = canBuild(h, 'woodcutter') !== null || treesNear(h.x, h.y, C.FOREST_R) >= C.FOREST_N;
      for (let a = 0; a < 6.28; a += .5) { at({x: home.x + Math.cos(a) * (home.r + 90), y: home.y + Math.sin(a) * (home.r + 90)}); if (canBuild(h, 'quarry') !== 'Too close to another building' && !outcropNear(h.x, h.y)) break; } out.qWhy = canBuild(h, 'quarry'); out.quarryNeedsOutcrop = out.qWhy === 'Build it beside a stone outcrop';
      const wsite = botSite(home, 'woodcutter', () => .5); at(wsite); out.woodcutterBuilt = build(h, 'woodcutter'); stepJob(h, 30);
      const q0 = S.quarries.find(q => q.town === h.town); at({x: q0.x + 120, y: q0.y}); out.quarryBuilt = build(h, 'quarry'); stepJob(h, 30);
      const wc = S.builds.find(b => b.k === 'woodcutter'), qy = S.builds.find(b => b.k === 'quarry');
      allocate(home); out.staffedFromSettlers = wc.staff > 0 && qy.staff > 0 && home.employed <= home.pop && home.employed + home.idle === Math.floor(home.pop);
      const tick = () => { const w = home.wood, st = home.stone; S.t = Math.floor(S.t / RENT_INTERVAL + 1) * RENT_INTERVAL + .01; stepEconomy(.02); return [home.wood - w, home.stone - st]; };
      const [dw, ds] = tick(); out.workplacesProduce = dw >= C.PROD.woodcutter.wood * wc.staff / C.JOBS.woodcutter - .01 && ds > 0;
      const pop = home.pop; home.pop = 0; allocate(home); const emptied = wc.staff === 0 && qy.staff === 0; const [dw0, ds0] = tick(); home.pop = pop; allocate(home);
      out.emptyWorkplacesIdle = emptied && dw0 < 3 && ds0 < 2; // only the hall's small trickle (2 wood, 1 stone a 10 s)
      // labour order: raising a kind in the Hall gives it workers first
      home.pop = 5; home.pri = 'quarry'; allocate(home); const qFirst = qy.staff === 5 && wc.staff === 0; home.pri = 'woodcutter'; allocate(home);
      out.labourPriority = qFirst && wc.staff === 4 && qy.staff === 1; home.pri = null; home.pop = pop; allocate(home);
      // a granary (staffed) holds more food
      const cap0 = foodCap(home); S.builds.push({k: 'granary', x: home.x + 40, y: home.y + 80, town: h.town, settlementId: home.id, cd: 0, staff: 3});
      out.granaryStores = foodCap(home) === cap0 + C.GRANARY_CAP;
      // fire: a building no fire station reaches can catch fire; you beat it out, or a staffed fire station does
      const p0 = C.FIRE_P; C.FIRE_P = 1; wc.risk = C.FIRE_SAFE + 1; S.you.x = home.x; S.you.y = home.y; stepFires(); C.FIRE_P = p0;
      const caught = !!wc.fire; at({x: wc.x + 40, y: wc.y}); stepFires(); stepFires(); stepFires();
      out.youBeatItOut = caught && !wc.fire;
      wc.fire = S.t; h.x = home.x; h.y = home.y; S.builds.push({k: 'firehouse', x: wc.x + 300, y: wc.y, town: h.town, settlementId: home.id, cd: 0, staff: 3}); stepFires(); stepFires(); stepFires();
      out.fireStationPutsOut = !wc.fire && covered(wc) && (stepFires(), wc.risk === 0);
      // roads: settlers walking to work wear the land into roads, which are faster to walk
      run(S, 240); out.settlersWearRoads = (S.worn || 0) > 0 && S.land.road.some((v, i) => v && S.foot && S.foot[i] >= C.ROAD_STEPS);
      // with no food the settlers leave
      home.food = 0; for (const t of S.towns) if (t !== home) { t.food = 0; } const leave0 = home.pop; S.t = Math.floor(S.t / C.SETTLER_EVERY + 1) * C.SETTLER_EVERY + .01; stepEconomy(.02);
      out.hungerDrivesThemOut = home.pop === leave0 - 1;
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
