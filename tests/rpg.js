// Colossus: the human side's RPG layer (mounts, skills, places, quests, combat, city). Run: node tests/rpg.js
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
      // mounts: no horse, no riding; a bought horse rides faster, hard hits throw you, a worn-out horse bolts
      const S = __col.newGame('human', 3), h = S.you; S.monsters = [];
      out.needHorse = !toggleRide(h) && !h.riding;
      h.horse = {hp: C.HORSE_HP, max: C.HORSE_HP};
      out.rides = toggleRide(h) && h.riding;
      const x0 = h.x; h.tx = h.x + 5000; h.ty = h.y; const t0 = S.t; __col.step(60);
      const rode = h.x - x0; h.riding = false; h.x = x0; h.tx = h.x + 5000; __col.step(60); const walked = h.x - x0;
      out.faster = rode > walked * 1.5;
      h.riding = true; horseHurt(h, 20); out.hardHitThrows = !h.riding;
      h.riding = true; h.horse.hp = 1; horseHurt(h, 5); out.bolts = !h.riding && h.horse.away > S.t && rideWhy(h) !== null;
      h.horse.away = 0; h.mode = 'climb'; out.noRideOnGiant = rideWhy(h) !== null; h.mode = 'ground';
      // talents: a level gives one pick of three; taking one applies at once
      const T = __col.newGame('human', 4), y = T.you; T.monsters = [];
      y.xp = 0; gainXp(y, 50); out.levelGivesPick = y.lvl === 2 && y.picks === 1 && talentChoices(y).length === 3;
      const a0 = y.atk; takeTalent(y, TALENTS.find(t => t.id === 'brawler')); out.brawler = y.atk === a0 + 4 && y.picks === 0;
      // skills: locked by level, cooldown after use, whirlwind hits every beast in reach
      out.lockedMend = skillWhy(y, SKILLS[2]) !== null;
      gainXp(y, 100); const w = [0, 1, 2].map(k => ({id: T.nextId++, kind: 'wolf', x: y.x + 30 + k * 10, y: y.y, hx: y.x, hy: y.y, hp: 300, max: 300, atk: 1, gold: 1, xp: 1, r: 13, cd: 9}));
      T.monsters.push(...w); out.whirl = useSkill(y, 'whirl') && w.every(m => m.hp < 300) && skillWhy(y, SKILLS[1]) !== null;
      out.cry = useSkill(y, 'cry') && y.cryT > T.t;
      // bot heroes pick talents on their own
      const B = __col.newGame('human', 6); B.autoplay = true; while (B.t < 480) __col.step(60);
      out.botTalents = B.humans.filter(o => o.hero && o.lvl > 1).every(o => Object.values(o.perks || {}).reduce((a, b) => a + b, 0) === o.lvl - 1);
      // places: laid out at the first step, each usable from its X button with its own reward
      const P = __col.newGame('human', 8), me = P.you; __col.step(2);
      const kinds = k => P.pois.filter(p => p.k === k);
      out.poisLaid = kinds('shrine').length >= 4 && kinds('camp').length >= 3 && kinds('spring').length >= 2 && kinds('stones').length >= 3 && kinds('herb').length >= 10;
      const at = p => { me.x = p.x + 40; me.y = p.y; me.cd = 0; };
      const sh = kinds('shrine').find(p => p.sub === 'might'); at(sh); out.shrine = humanAct(me, 'X') && buffOf(me, 'might');
      const sp = kinds('spring')[0]; at(sp); const m0 = me.max; humanAct(me, 'X'); out.spring = me.max === m0 + 10;
      const camp = kinds('camp')[0]; at(camp); out.campGuarded = campBeasts(camp).length === 4 && !humanAct(me, 'X');
      P.monsters = P.monsters.filter(m => m.camp !== camp.id); const g0 = me.gold; out.campChest = humanAct(me, 'X') && me.gold >= g0 + 80;
      me.lore = {}; for (const st of kinds('stones')) { at(st); humanAct(me, 'X'); closeMenu(); }
      out.lore = Object.keys(me.lore).length === kinds('stones').length;
      me.potions = 0; me.herbs = 0; for (const hb of kinds('herb').slice(0, 3)) { at(hb); humanAct(me, 'X'); } out.herbs = me.potions === 1;
      // quests: a bounty names a live alpha and pays on its death; the tale starts after two jobs and steps on
      const Q = __col.newGame('human', 9), q = Q.you; __col.step(2); q.quest = null;
      const bq = newQuest(q, 'bounty'); out.bountyNamed = bq.k === 'bounty' && liveAlphas().some(m => m.elite === bq.elite);
      q.quest = bq; const alpha = Q.monsters.find(m => m.elite === bq.elite); out.bountyTarget = !!questTarget(q) && questTarget(q).x === alpha.x;
      alpha.hp = 1; hitBeast(q, alpha, 5); out.bountyDone = q.quest.done;
      q.saga = {i: 0, n: 0}; q.lore = {}; for (const st of Q.pois.filter(p => p.k === 'stones').slice(0, 2)) usePoi(q, st); closeMenu();
      out.sagaSteps = q.saga.i === 1;
      q.saga.i = 3; q.saga.n = 0; SAGA[3].start(q); const wl = Q.monsters.find(m => m.warlord); out.warlord = !!wl && questTarget(q).x === wl.x;
      const g1 = q.gold; wl.hp = 1; hitBeast(q, wl, 5); out.sagaEnds = q.saga.done && q.gold >= g1 + 300;
      // nemesis: an alpha that kills you takes a name and grows
      const N = __col.newGame('human', 9), n = N.you; __col.step(2); const al = N.monsters.find(m => m.elite); const hp0 = al.max;
      n.lastBeast = al; killHuman(n, 'beast'); out.nemesis = /Hero-Slayer/.test(al.elite) && al.max > hp0;
      // combat: the third strike in a row lands harder and knocks back; a perfect dodge sets up a crit; boars roam the open land
      const K = __col.newGame('human', 10), k = K.you; K.monsters = []; k.atk = 10;
      const dummy = {id: K.nextId++, kind: 'troll', x: k.x + 25, y: k.y, hx: k.x, hy: k.y, hp: 9999, max: 9999, atk: 1, gold: 0, xp: 0, r: 22, cd: 9}; K.monsters.push(dummy);
      const blows = []; const rr0 = rnd; for (let i = 0; i < 3; i++) { k.cd = 0; const before = dummy.hp; rnd = () => .99; humanAct(k, 'A'); rnd = rr0; blows.push(before - dummy.hp); dummy.kb = null; dummy.x = k.x + 25; dummy.y = k.y; }
      out.comboFinisher = blows[2] > blows[0] * 1.5;
      k.dodge = {t: .05, x: 1, y: 0}; const W = {t: 0, dur: .7, x: k.x, y: k.y, R: 46, id: k.id}; beastStrike(dummy, W, k); out.perfectDodge = k.critNext === 1 && dummy.rec >= 1.4;
      k.dodge = null; k.cd = 0; k.combo = 0; k.comboT = -9; const b0 = dummy.hp; humanAct(k, 'A'); out.critAfterPerfect = b0 - dummy.hp >= 17 && !k.critNext;
      const Bo = __col.newGame('human', 11); out.boars = Bo.monsters.some(m => m.kind === 'boar');
      // city: civic buildings go up inside a settlement, raise prosperity, and pay off (farm harvest, market rent, smithy prices)
      const Ci = __col.newGame('human', 12), c = Ci.you, home = Ci.towns[c.town]; Ci.monsters = []; c.gold = 2000; home.lvl = 2;
      const p0 = prosperity(home); const spot = (dx, dy) => { c.x = home.x + dx; c.y = home.y + dy; c.job = null; };
      spot(120, 40); build(c, 'farm'); stepJob(c, 10); spot(-120, 40); build(c, 'market'); stepJob(c, 12); spot(40, -130); build(c, 'smithy'); stepJob(c, 12);
      out.civicBuilt = civicIn(home, 'farm') === 1 && civicIn(home, 'market') === 1 && civicIn(home, 'smithy') === 1;
      out.prosperityUp = prosperity(home) > p0 + 25;
      spot(-40, 140); out.oneMarket = build(c, 'market') === false;
      c.x = home.x; c.y = home.y; out.smithyDiscount = nextGear(c, 'blade').g === Math.round(GEAR.blade[0].g * .8);
      const cg0 = c.gold; Ci.t = RENT_INTERVAL - .01; stepBuilds(C.DT); Ci.t = RENT_INTERVAL + .01; stepBuilds(C.DT); out.farmPays = c.gold >= cg0 + 3;
      // bot heroes build civic buildings over a match
      const Bt = __col.newGame('human', 13); Bt.autoplay = true; while (Bt.t < 900) __col.step(60);
      out.botCivic = Bt.builds.some(b => CIVIC[b.k] && b.owner !== Bt.you.id);
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v, k);
    assert.deepEqual(errors, []);
    console.log(Object.keys(r).length + ' rpg checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
