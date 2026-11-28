// Colossus: the workforce (workers come from homes; commute penalty beyond 1000 paces; hiring rounds by priority;
// moving to closer work), demolition and the homeless, buying materials and material rewards, the overseer, what
// houses and granaries show, and the range notes while building. Run: node tests/labour.js
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
      let S, h, t;
      const fresh = seed => { S = __col.newGame('human', seed); S.monsters = []; S.events = []; h = S.you; t = S.towns[h.town]; t.hall = 0; S.people = []; S.walkers = []; };
      const mk = (k, dx, dy, extra) => { const b = {k, x: t.x + dx, y: t.y + dy, town: h.town, settlementId: t.id, cd: 0, ...extra}; S.builds.push(b); return b; };
      const house = (dx, dy, occ, extra) => { const b = mk('house', dx, dy, extra); houseInit(b); b.occ = occ; return b; };
      const crewAt = b => S.people.filter(p => p.job === b);
      // within 1000 paces of home a worker starts at once
      fresh(31); const hA = house(300, 0, 1), farm = mk('farm', 600, 0); allocate(t);
      out.nearStartsAtOnce = crewAt(farm).length === 1 && crewAt(farm)[0].st === 'work' && farm.present === 1;
      // beyond 1000 the worker walks in first and the building has nobody until they arrive
      fresh(32); const hB = house(0, 400, 1), wood = mk('woodcutter', 1500, 400); allocate(t); const p1 = crewAt(wood)[0];
      const walking = p1 && p1.st === 'to' && wood.present === 0 && S.walkers.some(w => w.k === 'commute' && w.person === p1);
      let secs = 0; while (p1.st !== 'work' && secs < 120) { stepWalkers(.1); secs += .1; } countPresent();
      out.farWalksIn = walking && wood.present === 1 && secs > 18 && secs < 40; out.walkInSecs = Math.round(secs);
      // and walks home and back now and then, absent all the while
      p1.next = S.t - 1; stepPeople(); out.farTripsHome = p1.st === 'away' && wood.present === 0 && S.walkers.some(w => w.leg === 'home' && w.person === p1);
      fresh(33); house(300, 0, 1); const nearW = mk('woodcutter', 500, 0); allocate(t); const p2 = crewAt(nearW)[0]; p2.next = S.t - 1; stepPeople(); out.nearNoTrips = p2.st === 'work';
      // beyond 3000 nobody comes
      fresh(34); house(0, 300, 2); const lone = mk('quarry', 3600, 300); allocate(t); out.outOfRange = lone.staff === 0 && lone.far === true;
      // each workplace one worker before any gets two, in priority order
      fresh(35); house(300, 0, 3); const fa = mk('farm', 500, 100), wc = mk('woodcutter', 500, -100), qu = mk('quarry', 300, 250); allocate(t);
      out.roundsSpread = fa.staff === 1 && wc.staff === 1 && qu.staff === 1;
      fresh(36); house(300, 0, 1); const fb = mk('farm', 500, 100), wb = mk('woodcutter', 500, -100); allocate(t); out.priorityFirst = fb.staff === 1 && wb.staff === 0;
      // a closer building of the same kind draws its worker; a closer lower-priority one does not
      fresh(37); const hC = house(0, 0, 1); const farW = mk('woodcutter', 1500, 0); allocate(t); const was = crewAt(farW).length === 1;
      const nearW2 = mk('woodcutter', 300, 0); S.t = 20.5; allocate(t); out.movesCloser = was && crewAt(nearW2).length === 1 && crewAt(farW).length === 0;
      fresh(38); house(0, 0, 1); const farF = mk('farm', 1500, 0); allocate(t); mk('woodcutter', 300, 0); S.t = 30.5; allocate(t); out.noMoveDown = crewAt(farF).length === 1;
      // a building shows only the workers present, minus one out carrying
      out.drawnMatchesPresent = workerSpots({...farm, present: 1}, 1).length === 1 && workerSpots({k: 'well', x: 0, y: 0, present: 2, out: {}}, 1).length === 1;
      // less, not slower: a half-crewed farm keeps its 60 s + 10 s and harvests half
      fresh(39); const f2 = mk('farm', 400, 0, {present: 3}); for (let k = 0; k < 70; k++) stepFarms(1); const hv = S.walkers.find(w => w.k === 'harvest');
      out.farmHalfCrewHalfYield = !!hv && hv.load === Math.round(C.FARM_YIELD / 2);
      const w2 = mk('woodcutter', 400, 200, {present: 1}); const wood0 = t.wood; S.t = Math.floor(S.t / RENT_INTERVAL + 1) * RENT_INTERVAL + .01; stepEconomy(.02);
      out.woodcutterThirdCrewThird = Math.abs((t.wood - wood0) - (C.PROD.woodcutter.wood / 3 + (Math.floor(S.t / 10) !== Math.floor((S.t - .02) / 10) ? 2 : 0))) < .05;
      // carriers keep full loads and reload more slowly when short-handed (owner: 10 s full; a well with 1 of 2, 20 s)
      const well = mk('well', 300, 300, {present: 1}), baz = mk('market', 200, 300, {present: 1}), gr = mk('granary', 100, 300, {present: 2});
      out.reloadByCrew = reloadGap(well) === 20 && reloadGap(baz) === 40 && reloadGap(gr) === 25 && (well.present = 2, reloadGap(well) === 10);
      const wk = {src: well}; well.out = wk; goBack(wk, true); out.reloadAfterReturn = well.next === S.t + 10 && !well.out;
      // the overseer: standing at a staffed workplace, half again the work
      h.x = f2.x + 40; h.y = f2.y; h.mode = 'ground'; h.dead = 0; f2.present = 6; f2.grow = 0; f2.harvT = null; f2.work = 0; f2.workT = 0; S.walkers = [];
      for (let k = 0; k < 70; k++) stepFarms(1); const hv2 = S.walkers.find(w => w.k === 'harvest'); out.overseerHalfAgain = overseen(f2) && !!hv2 && hv2.load === Math.round(C.FARM_YIELD * C.OVERSEE);
      // demolish: a second press (not the same one) is needed; nothing comes back; what it held is lost
      fresh(40); h.x = t.x + 400; h.y = t.y; h.gold = 500; const stall = mk('market', 420, 0, {store: 150}); const before = [t.food, t.wood, t.stone, h.gold].join();
      const press = () => { const it = demolishItem(h)[0]; if (it) it.act(); }; press(); const armedOnly = S.builds.includes(stall); press(); const sameTooSoon = S.builds.includes(stall); if (demoArm) demoArm.at -= 1000; press();
      out.demolishConfirms = armedOnly && sameTooSoon && !S.builds.includes(stall); out.demolishRefundsNothing = [t.food, t.wood, t.stone, h.gold].join() === before; closeMenu();
      // the homeless take free places in other houses, else leave; immigrants cannot take the places held for them
      fresh(41); const hx = house(300, 0, 5), hy = house(-300, 0, 2); const r1 = demolish(hx);
      out.homelessRehoused = r1.moved === 3 && r1.left === 2 && hy.inc === 3 && S.walkers.filter(w => w.k === 'settler' && w.homeless).length === 3 && S.walkers.filter(w => w.k === 'leaver').length === 2;
      for (let k = 0; k < 400 && S.walkers.some(w => w.k === 'settler'); k++) stepWalkers(.1); out.homelessMoveIn = hy.occ === 5 && hy.inc === 0;
      fresh(42); const hz = house(300, 0, 4), hw = house(-300, 0, 0); destroyBuild(hz); S.builds = S.builds.filter(b => b !== hz); out.burnedHouseRehoused = hw.inc === 4;
      fresh(43); const hd = house(300, 0, 7, {lvl: 2}), hf = house(-300, 0, 0); hd.water = 0; for (let k = 0; k < C.LACK_GRACE / 10; k++) stepHouses(); out.downgradeRehoused = lv(hd) === 1 && hd.occ <= 5 && hf.inc >= 2;
      // buying at your bazaar: the price rises with each purchase and eases back
      fresh(44); h.gold = 1000; const bz = mk('market', 200, 0); let items = buyItems(h, t, () => {}); const p0 = +items[0].label.match(/(\d+) gold/)[1]; const w0 = t.wood; items[0].act();
      items = buyItems(h, t, () => {}); const p1b = +items[0].label.match(/(\d+) gold/)[1]; for (let k = 0; k < 40; k++) easePrices(); const p2b = +buyItems(h, t, () => {})[0].label.match(/(\d+) gold/)[1];
      out.buyPriceRisesAndEases = p0 === C.BUY.wood && t.wood === w0 + C.BUY_N && p1b > p0 && p2b === p0;
      // tasks for you sometimes pay materials your town lacks; paying them fills the stockpile
      let withMat = 0; for (let k = 0; k < 40; k++) if (newQuest(h).mat) withMat++; const st0 = t.stone; payMat(h, {mat: {k: 'stone', n: 33}});
      out.taskMaterials = withMat > 5 && withMat < 35 && t.stone === st0 + 33;
      // the merchant sells materials, delivered home
      const m = {k: 'merchant', x: h.x, y: h.y}; openMerchant(h, m); const timber = menu.items.find(i => /^Timber/.test(i.label)); const w1 = t.wood; timber.act(); closeMenu();
      out.merchantTimber = t.wood === w1 + 60;
      // a cleared camp's stockpile goes to your town
      layPois(); const camp = S.pois.find(p => p.k === 'camp'); S.monsters = []; camp.alive = true; h.x = camp.x; h.y = camp.y; h.hero = true; const cw = t.wood; usePoi(h, camp); closeMenu(); out.campStockpile = t.wood === cw + 40;
      // what houses and granaries show
      const hs = house(0, 600, 3); hs.water = 0; hs.food = 25; const a = houseShows(hs); hs.water = 25; hs.food = 0; const b2 = houseShows(hs);
      out.houseShowsNeeds = a.jars === 0 && a.basket > 0 && b2.jars === 2 && b2.basket === 0;
      const g2 = mk('granary', 0, 700, {present: 5}); t.food = foodCap(t) / 2; out.granaryShowsFill = Math.abs(granaryFill(g2) - .5) < .01;
      // every kind has its own design
      const noop = () => {}; out.uniqueDesigns = ['house', 'granary', 'market', 'well', 'woodcutter', 'quarry', 'firehouse', 'tower', 'barracks'].every(k => drawEconBuild({k, x: 0, y: 0, town: h.town, settlementId: t.id, lvl: 1}, 0, noop, noop, '#fff', 1));
      // range notes while building, and the rings shown with the Build menu
      fresh(45); house(300, 0, 1); h.x = t.x + 300; h.y = t.y + 150; const n0 = spotNotes(h); mk('well', 300, 300); mk('market', 250, 250); const n1 = spotNotes(h);
      h.x = t.x + 1700; const n2 = spotNotes(h); h.gold = 500; h.x = t.x + 300; openBuild(); const shown = ringsShown(); closeMenu();
      out.rangeNotes = /no well reaches here/.test(n0.house) && /water ✓/.test(n1.house) && /food ✓/.test(n1.house) && /no commute penalty/.test(n1.work) && /far from homes/.test(n2.work) && shown;
      // during the guided first day rival cannons hold their fire on your town and on your people
      fresh(46); S.tut = tutNewDay(); const yours = t; S.g.x = yours.x + yours.r + 200; S.g.y = yours.y; h.x = S.g.x + 100; h.y = S.g.y; h.mode = 'ground'; h.dead = 0;
      const rival = [0, 1, 2].find(i => i !== h.town); const during = cannonTarget(rival); S.tut.done = true; const after = cannonTarget(rival);
      out.firstDayNoShelling = during !== yours && during !== h && (after === yours || after === h);
      return out;
    });
    assert.deepEqual(errors, []);
    for (const [k, v] of Object.entries(r)) if (typeof v === 'boolean') assert.ok(v, k + ' ' + JSON.stringify(r));
    console.log(Object.keys(r).filter(k => typeof r[k] === 'boolean').length + ' workforce, demolition and supply checks passed (a 1500-pace walk-in took ' + r.walkInSecs + ' s)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
