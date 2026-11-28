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
      // villagers: the house made room; training costs food and takes time; nothing arrives for free
      out.roomNotVillager = foragersIn(home).length === 1 && foragerCapacity(home) === 2;
      home.food = 200; out.trainQueued = queueVillager(home) && home.food === 150 && !queueVillager(home);
      run(S, C.VILLAGER_TIME + 1); out.trained = foragersIn(home).length === 2;
      // a villager set to wood fells it and carries it home; one set to stone works a quarry
      const [v1, v2] = foragersIn(home).sort((a, b) => a.id - b.id); v1.work = 'wood'; v2.work = 'stone'; v1.goal = v2.goal = null;
      for (const v of [v1, v2]) { v.x = home.x; v.y = home.y; v.hp = v.max; }
      const before = {wood: home.wood, stone: home.stone}; S.monsters = []; S.events = [];
      run(S, 150);
      out.woodGathered = home.wood - before.wood; out.stoneGathered = home.stone - before.stone;
      // the trickle alone over 150 s is 30 wood and 15 stone: villagers must bring clearly more
      out.villagersGather = out.woodGathered > 30 + C.CARRY.wood && out.stoneGathered > 15 + C.CARRY.stone;
      // the Hall lets you set work by clicking a villager
      h.x = home.x; h.y = home.y; openTown(home, 'Hall'); const vi = menu.items.find(i => /^Villager 1:/.test(i.label)); const w = v1.work; vi.act();
      out.hallCyclesWork = v1.work !== w && menu.items.some(i => /^Train a villager/.test(i.label)); closeMenu();
      // rival towns train villagers on their own when they have food and room
      const rival = S.towns.find(t => t.i !== h.town); rival.houses = 3; rival.food = 400; run(S, 2 * C.VILLAGER_TIME + 12);
      out.rivalsTrain = foragersIn(rival).length >= 2;
      // ages: names follow the settlement's level
      out.ages = ageOf({lvl: 1}) === 'Hamlet' && ageOf({lvl: 2}) === 'Village' && ageOf({lvl: 4}) === 'City' && ageOf({lvl: 1, outpost: true}) === 'Outpost';

      // quests on the Board: offered, taken (at most three), each step pays when its state is true
      S = __col.newGame('human', 4); h = S.you; home = S.towns[h.town]; h.x = home.x; h.y = home.y; S.headless = false;
      openTown(home, 'Board');
      out.boardOffersQuests = menu.items.some(i => i.label === 'New quest · A town of our own') && menu.items.some(i => /^Task · /.test(i.label));
      menu.items.find(i => i.label === 'New quest · A town of our own').act();
      out.taken = questOpen(h).length === 1 && h.track === 'q:charter';
      const g0 = h.gold; h.gold += 500; h.x = home.x + 150; h.y = home.y + 40; build(h, 'farm'); stepJob(h, 10); run(S, 2);
      out.stepPays = questOpen(h)[0].i >= 1 && h.gold > g0 + 500 - C.COST.farm;
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
      // nothing the feed says is lost: the message log keeps it
      toast('test message 42'); out.messageLog = msgLog.some(m => m.text === 'test message 42');
      // the resource bar shows the stockpile of your town
      paintRes(); const rb = document.getElementById('res');
      out.resourceBar = !rb.hidden && rb.textContent.includes(String(Math.floor(home.wood))) && rb.textContent.includes(ageOf(home));
      S.headless = true;
      return out;
    });
    assert.deepEqual(errors, []);
    for (const [k, v] of Object.entries(r)) if (typeof v === 'boolean') assert.ok(v, k);
    console.log(Object.keys(r).filter(k => typeof r[k] === 'boolean').length + ' economy and quest checks passed (villagers brought ' + r.woodGathered + ' wood and ' + r.stoneGathered + ' stone in 150 s)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
