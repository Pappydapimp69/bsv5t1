// Colossus: behaviour fingerprint. Plays fixed seeds headless and hashes the sim state, so a refactor that must not
// change gameplay (like splitting index.html into src/ files) can prove it. Run: node tests/fingerprint.js
// Record new baselines (only when gameplay is meant to change): node tests/fingerprint.js --record
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const BASE = path.join(__dirname, 'fingerprint.json');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/three.min.js', r => r.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.__col);
    const runs = [['human', 7], ['human', 22], ['human', 32], ['giant', 41]];
    const got = {};
    for (const [role, seed] of runs) {
      got[role + ':' + seed] = await page.evaluate(([role, seed]) => {
        const S = __col.newGame(role, seed); S.autoplay = true;
        while (S.t < 300 && !S.over) __col.step(60);
        const r = v => Math.round(v * 100) / 100;
        const state = {
          t: r(S.t), over: S.over ? S.over.text : null,
          monsters: S.monsters.map(m => [m.kind, r(m.x), r(m.y), r(m.hp)]),
          humans: S.humans.map(h => [h.town, r(h.x), r(h.y), r(h.hp), h.gold, h.lvl, h.xp, h.mode]),
          towns: S.towns.map(t => [t.id, r(t.hp), t.lvl || 1, t.alive]),
          builds: S.builds.map(b => [b.k, r(b.x), r(b.y), b.town]),
          pois: (S.pois || []).map(p => [p.k, r(p.x), r(p.y), r(p.ready || 0)]),
          events: S.events.map(e => [e.k, r(e.x || 0), r(e.y || 0)]),
          giant: [r(S.g.x), r(S.g.y), !!S.g.awake], chains: S.chains.map(c => r(c.hp)), next: rnd()
        };
        const s = JSON.stringify(state); let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        return h.toString(16) + ' t=' + state.t + ' len=' + s.length;
      }, [role, seed]);
    }
    assert.deepEqual(errors, []);
    if (process.argv.includes('--record')) { fs.writeFileSync(BASE, JSON.stringify(got, null, 1) + '\n'); console.log('recorded', got); return; }
    const want = JSON.parse(fs.readFileSync(BASE, 'utf8'));
    for (const k of Object.keys(want)) assert.equal(got[k], want[k], 'fingerprint ' + k);
    console.log(Object.keys(want).length + ' fingerprints match');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
