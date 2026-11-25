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
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v, k);
    assert.deepEqual(errors, []);
    console.log(Object.keys(r).length + ' rpg checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
