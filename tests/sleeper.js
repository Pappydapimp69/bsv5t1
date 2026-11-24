// Colossus: the chained sleeper can act, can be hunted gently, and hunt orders arm soldiers.
// Run: node tests/sleeper.js   (Playwright's Chromium; offline, without Three.js)
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
      const S = __col.newGame('giant', 7);
      S.t = 30;
      out.twitchAsleep = canGiant('twitch') === null;
      out.stompAsleep = canGiant('stomp') === 'Asleep';
      // strain weakens a chain but, before the chains open, never below the floor
      const ch = S.chains[0];
      for (let i = 0; i < 40; i++) { S.g.cd.strain = 0; S.g.wind = null; S.g.aim = 'legs'; giantDo('strain'); resolveWind(); }
      out.strainFloor = S.chains.every(c => c.hp >= c.max * C.STRAIN_FLOOR - 1e-6) && S.chains.some(c => c.hp < c.max);
      out.strainBlocked = canGiant('strain') !== null;
      // after the chains open, strain can break them, and once all are gone one more strain lets it rise
      S.t = C.CHAIN_OPEN + 1;
      for (let i = 0; i < 200 && !allWeak(); i++) { S.g.cd.strain = 0; S.g.wind = null; S.g.aim = null; giantDo('strain'); resolveWind(); }
      out.allBroken = allWeak();
      S.g.cd.strain = 0; S.g.wind = null; giantDo('strain'); resolveWind();
      out.rose = S.g.awake;

      // the sleeper bruises but is never crippled
      const T = __col.newGame('human', 7);
      T.t = 10;
      damageJoint('kneeL', 500, null);
      out.stoneBeforeHunt = T.joints.kneeL.hp === T.joints.kneeL.max;
      T.t = C.HUNT_OPEN + 1;
      for (let i = 0; i < 100; i++) damageJoint('kneeL', 500, null);
      const k = T.joints.kneeL;
      out.sleepFloor = Math.abs(k.hp - k.max * C.SLEEP_FLOOR) < 1e-6 && !k.crip;
      // a twitch on the legs shakes loose some wedges there
      for (let i = 0; i < 3; i++) k.wedges.push({town: 2, who: null});
      for (let i = 0; i < 3; i++) T.joints.kneeR.wedges.push({town: 2, who: null});
      const before = k.wedges.length + T.joints.kneeR.wedges.length;
      for (let i = 0; i < 6; i++) { T.g.cd.twitch = 0; T.g.wind = null; T.g.aim = 'legs'; giantDo('twitch'); resolveWind(); }
      out.twitchLoosens = k.wedges.length + T.joints.kneeR.wedges.length < before;
      out.zones = zoneAt(44, 10) === 'legs' && zoneAt(120, 4) === 'left' && zoneAt(120, 27) === 'right' && zoneAt(190, 16) === 'top';
      // crowding: past three hands on one joint, each blow counts for a share
      const U = __col.newGame('human', 3);
      U.g.awake = true;
      const hs = U.humans.slice(0, 6);
      const j = U.joints.neck, h0 = j.hp;
      for (const h of hs) damageJoint('neck', 10, h);
      out.crowding = h0 - j.hp < 60 && h0 - j.hp > 40;
      // awake with no braces the giant still walks slowly and can stomp; smash still needs towns to brace it
      const V = __col.newGame('giant', 4);
      for (const c of V.chains) c.hp = 0; V.g.awake = true; V.g.cd.stomp = 0; V.g.cd.smash = 0;
      out.ownBrace = braces() === 0 && giantSpeed() === C.G_DORMANT + C.G_PER_BRACE && canGiant('stomp') === null && canGiant('smash') === 'Needs 2 braces';
      // the giant player always has something to do: over the first five minutes no stretch longer than 30 s without a usable action
      const Wg = __col.newGame('giant', 2); Wg.autoplay = true; let last = 0, gap = 0;
      const ks = ['stomp', 'smash', 'shake', 'swipe', 'twitch', 'strain', 'dream'];
      while (Wg.t < 300) { __col.step(30); if (ks.some(k => canGiant(k) === null)) { gap = Math.max(gap, Wg.t - last); last = Wg.t } }
      out.neverIdle = Math.max(gap, Wg.t - last) <= 30;
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v, k);
    assert.deepEqual(errors, []);
    console.log(Object.keys(r).length + ' sleeper checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
