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
      P.monsters = P.monsters.filter(m => m.camp !== camp.id); const g0 = me.gold; out.campChest = humanAct(me, 'X') && me.gold >= g0 + 80; me.cd = 0; P.t += 400; out.campNoFarm = !humanAct(me, 'X');
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
      home.houses = 2; spot(120, 40); build(c, 'farm'); stepJob(c, 10); spot(-120, 40); build(c, 'market'); stepJob(c, 12); spot(40, -130); build(c, 'smithy'); stepJob(c, 12);
      out.civicBuilt = civicIn(home, 'farm') === 1 && civicIn(home, 'market') === 1 && civicIn(home, 'smithy') === 1;
      out.prosperityUp = prosperity(home) > p0 + 25;
      spot(-40, 140); out.oneMarket = build(c, 'market') === false;
      c.x = home.x; c.y = home.y; out.smithyDiscount = nextGear(c, 'blade').g === Math.round(GEAR.blade[0].g * .8);
      const cg0 = c.gold; Ci.t = RENT_INTERVAL - .01; stepBuilds(C.DT); Ci.t = RENT_INTERVAL + .01; stepBuilds(C.DT); out.farmPays = c.gold >= cg0 + 3;
      // bot heroes build civic buildings over a match
      const Bt = __col.newGame('human', 13); Bt.autoplay = true; while (Bt.t < 900) __col.step(60);
      out.botCivic = Bt.builds.some(b => CIVIC[b.k] && b.owner !== Bt.you.id);
      // wildlife: deer graze, bolt from people, and can be hunted for a pelt and gold
      const D = __col.newGame('human', 14), dh = D.you; D.monsters = []; __col.step(2);
      out.deer = D.critters.length >= 24;
      const deer = D.critters[0]; dh.x = deer.x + 200; dh.y = deer.y; const dx0 = deer.x; __col.step(30); out.deerFlee = Math.hypot(deer.x - dh.x, deer.y - dh.y) > 200;
      dh.x = deer.x + 30; dh.y = deer.y; dh.cd = 0; const dg = dh.gold; out.hunt = humanAct(dh, 'A') && deer.dead && dh.gold === dg + 6;
      // charms: an alpha drops one and it is worn; slots fill and the rest go to the bag; the crown adds its stats
      const Ch = __col.newGame('human', 15), ch = Ch.you; __col.step(2); const alpha2 = Ch.monsters.find(m => m.elite);
      alpha2.hp = 1; hitBeast(ch, alpha2, 5); out.alphaCharm = (ch.charms || []).length === 1;
      giveCharm(ch); giveCharm(ch); out.slotsThenBag = ch.charms.length === 2 && ch.bag.length === 1;
      const a1 = ch.atk, m1 = ch.max; removeCharm(ch, ch.charms[0]); ch.bag = ch.bag.filter(k => k !== 'crown'); ch.bag.push('crown'); equipCharm(ch, 'crown');
      out.crown = ch.atk === a1 + 8 && ch.max >= m1 + 60 - 40; removeCharm(ch, 'crown'); out.crownOff = ch.atk === a1;
      // bandit archers: a bandit camp has archers and a chief; an archer aims from range and a step off the mark makes it miss
      const Ar = __col.newGame('human', 16), ah = Ar.you; __col.step(2);
      const bc = Ar.pois.find(p => p.k === 'camp' && p.bandits); out.banditCamp = !!bc && campBeasts(bc).filter(m => m.kind === 'archer').length === 4;
      const ar = campBeasts(bc)[0]; Ar.monsters = [ar]; ar.cd = 0; ar.wind = null; ah.x = ar.x + 280; ah.y = ar.y; const ahp0 = ah.hp;
      beastFight(ar, ah, C.DT); out.archerAims = !!ar.wind && Math.hypot(ar.x - ah.x, ar.y - ah.y) > 250;
      ah.x += 120; ar.wind.t = ar.wind.dur; beastBusy(ar, C.DT); out.archerMisses = ah.hp === ahp0;
      // world events: an ambushed traveller needs the wolves driven off first; a golden stag pays 60 gold
      const E = __col.newGame('human', 17), eh = E.you; __col.step(2); worldEvent('ambush');
      const amb = E.pois.find(p => p.ambush); out.ambush = !!amb && E.monsters.filter(m => m.guard === amb.id).length === 3;
      eh.x = amb.x + 40; eh.y = amb.y; out.ambushBlocked = !!poiAct(eh).why; E.monsters = E.monsters.filter(m => m.guard !== amb.id); out.ambushHelp = humanAct(eh, 'X') && amb.follow === eh.id;
      worldEvent('stag'); const stag = E.critters.find(c => c.golden); out.stag = !!stag;
      eh.x = stag.x + 30; eh.y = stag.y; eh.cd = 0; const sg = eh.gold; humanAct(eh, 'A'); out.stagPays = eh.gold >= sg + 60;
      // renown: the end of a human match pays renown; bought perks apply at the next start
      const sv = JSON.stringify(save); save.renown = 0; save.unlocks = {}; save.firstDay = 1;
      start('human', 18); const Rn = __col.S; Rn.you.lvl = 4; Rn.you.campsBroken = 2; Rn.over = {giantWon: true, text: 'x'}; openEnd(); closeMenu();
      out.renownEarned = save.renown === 8 + 6 + (Rn.you.charms || []).length;
      save.renown = 100; save.unlocks = {mare: 1, purse: 1}; start('human', 19); out.renownPerks = !!__col.S.you.horse && __col.S.you.gold >= 100;
      Object.assign(save, JSON.parse(sv)); delete save.unlocks; if (!JSON.parse(sv).renown) delete save.renown; closeMenu();
      // skill talents need the skill unlocked; a horse levels with riding
      const Sk = __col.newGame('human', 20), sk = Sk.you; out.skillTalentGated = !talentChoices(sk).some(t => t.lvl) || sk.lvl >= 2;
      sk.horse = {hp: 80, max: 80}; horseGrow(sk, 6001); out.horseLevels = sk.horse.lv === 2 && sk.horse.max === 100;
      // affixes and the spear: elites roll a trait; an armoured one takes half until below half health; the spear hits at range
      const Af = __col.newGame('human', 21), af = Af.you; __col.step(2); const el = Af.monsters.filter(m => m.elite);
      out.affixes = el.length > 0 && el.every(m => AFFIX[m.affix]);
      const arm = {id: 999, kind: 'wolf', x: af.x + 300, y: af.y, hx: 0, hy: 0, hp: 200, max: 200, atk: 1, gold: 0, xp: 0, r: 13, cd: 9, affix: 'armoured'}; Af.monsters = [arm];
      hitBeast(af, arm, 20); out.armoured = arm.hp === 190;
      af.lvl = 4; out.spear = useSkill(af, 'spear') && arm.hp < 190 && arm.rec >= .9;
      // a hound follows and bites what you fight
      const Hd = __col.newGame('human', 22), hd = Hd.you; Hd.monsters = []; hd.hound = {};
      const prey = {id: 998, kind: 'wolf', x: hd.x + 120, y: hd.y, hx: hd.x + 120, hy: hd.y, hp: 300, max: 300, atk: 1, gold: 0, xp: 0, r: 13, cd: 9}; Hd.monsters.push(prey);
      for (let i = 0; i < 120; i++) { prey.x = hd.x + 120; prey.y = hd.y; prey.cd = 9; stepHound(hd, C.DT); }
      out.hound = prey.hp < 300 && Math.hypot(hd.hound.x - prey.x, hd.hound.y - prey.y) < 60;
      // today's goals: three per match, completed from play, worth renown
      const Go = __col.newGame('human', 23), go = Go.you; const gs = matchGoals(); out.threeGoals = gs.length === 3 && new Set(gs.map(g => g.id)).size === 3;
      go.lvl = 5; go.perfects = 3; go.stat = {camp: 1, bounty: 1, hunt: 3, pray: 2, lore: 2, escort: 1, civic: 2, charm: 1}; Go.t = 10; stepGoals();
      out.goalsDone = gs.every(g => g.done); Go.over = {giantWon: true, text: 'x'}; out.goalRenown = renownEarned(go, Go.over).n >= 15;
      // crafting: your pelts go to a hide store at home; the Forge turns them into a cloak
      const Cr = __col.newGame('human', 24), cr = Cr.you, ct = Cr.towns[cr.town]; cr.pack.pelts = 4; cr.x = ct.x; cr.y = ct.y; unloadPack(cr, ct);
      out.hideStore = cr.hides === 4; const m0c = cr.max; openTown(ct, 'Forge'); const it = menu.items.find(i => /^Fur cloak/.test(i.label)); it.act(); closeMenu();
      out.crafted = cr.max === m0c + 25 && cr.hides === 0;
      // treasure: a map rings an area; X at the spot digs it up
      const Tr = __col.newGame('human', 25), tr = Tr.you; Tr.monsters = []; out.treasureMap = giveTreasure(tr) && !!tr.treasure;
      tr.x = tr.treasure.x + 30; tr.y = tr.treasure.y; const tg0 = tr.gold; out.dig = /Dig/.test(humanCtx(tr).X.l) && humanAct(tr, 'X') && tr.gold >= tg0 + 150 && !tr.treasure;
      // festival: a home settlement at 70+ prosperity holds one a day
      const Fe = __col.newGame('human', 26), fe = Fe.you, ft = Fe.towns[fe.town]; ft.houses = 6; Fe.builds.push(...['farm','farm','farm','market','smithy','stable','well'].map((k, i) => ({k, x: ft.x + i, y: ft.y, town: fe.town, settlementId: ft.id, hp: 1})));
      Fe.t = 10; const fg0 = fe.gold; stepFestival(); out.festival = prosperity(ft) >= 70 && fe.gold === fg0 + 30 && buffOf(fe, 'might');
      // a wandering champion: a duel event that pays and gives a title
      const Du = __col.newGame('human', 27), du = Du.you; __col.step(2); worldEvent('champion');
      const champ = Du.monsters.find(m => m.champion); out.champion = !!champ && champ.kind === 'knight';
      champ.hp = 1; hitBeast(du, champ, 5); out.duelWon = du.title === 'Champion';
      // review fixes: no heal from swapping charms; the tale credits stones already read; a lost Warlord returns;
      // new buildings can be destroyed; a Hero-Slayer still pays its bounty; a seed replays the same day
      const Rv = __col.newGame('human', 28), rv = Rv.you; __col.step(2); rv.hp = 20; giveCharm(rv, 'heart'); for (let i = 0; i < 3; i++) { removeCharm(rv, 'heart'); equipCharm(rv, 'heart'); }
      out.noSwapHeal = rv.hp <= 20;
      rv.lore = {0: 1, 1: 1, 2: 1}; rv.claimed = 1; rv.quest = {k: 'slay', need: 1, n: 1, done: true, gold: 1, xp: 1, text: 'x'}; const ht = Rv.towns[rv.town]; rv.x = ht.x; rv.y = ht.y; openTown(ht, 'Board'); menu.items.find(i => i.label === 'Claim quest reward').act(); closeMenu();
      out.taleCreditsStones = rv.saga && rv.saga.i === 1;
      rv.saga = {i: 3, n: 0}; Rv.monsters = Rv.monsters.filter(m => !m.warlord); Rv.t = 500; stepPois(.2); out.warlordReturns = Rv.monsters.some(m => m.warlord);
      const fb = {k: 'farm', x: ht.x + 100, y: ht.y, town: rv.town, owner: rv.id, cd: 0, settlementId: ht.id}; Rv.builds.push(fb); for (let i = 0; i < 20; i++) damageBuild(fb, 50, null);
      out.civicDestroyable = !Rv.builds.includes(fb) || fb.hp === 0;
      const al3 = Rv.monsters.find(m => m.elite && !m.champion && !m.warlord); rv.quest = {k: 'bounty', elite: al3.elite, need: 1, n: 0, gold: 1, xp: 1, text: 'b'}; rv.lastBeast = al3; killHuman(rv, 'beast'); rv.dead = 0; rv.hp = rv.max;
      al3.hp = 1; hitBeast(rv, al3, 5); out.slayerBounty = rv.quest.done;
      const run = () => { const D2 = __col.newGame('human', 29); D2.autoplay = true; while (D2.t < 240) __col.step(60); return D2.monsters.length + ':' + D2.monsters.reduce((a, m) => a + Math.round(m.x) + Math.round(m.y), 0) + ':' + D2.pois.length; };
      out.deterministic = run() === run();
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v, k);
    assert.deepEqual(errors, []);
    console.log(Object.keys(r).length + ' rpg checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
