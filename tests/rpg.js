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
      out.botTalents = B.humans.filter(o => o.hero && o.lvl > 1).every(o => Object.keys(o.perks || {}).length === o.lvl - 1);
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v, k);
    assert.deepEqual(errors, []);
    console.log(Object.keys(r).length + ' rpg checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
