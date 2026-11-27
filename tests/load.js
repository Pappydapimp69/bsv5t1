// Colossus: the page loads cleanly (every script, no errors), reaches the title menu, and both roles start and run.
// Run: node tests/load.js
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => { if (!/three\.min\.js/.test(r.url())) failed.push(r.url()); });
    await page.route('**/three.min.js', r => r.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.__col);
    const r = await page.evaluate(() => {
      const out = {scripts: [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')).filter(s => !/three/.test(s))};
      out.title = !!menu && menu.title === 'Colossus';
      save.firstDay = 1; start('human', 5); for (let i = 0; i < 10; i++) __col.step(60); out.human = __col.S.role === 'human' && __col.S.t > 5;
      start('giant', 6); for (let i = 0; i < 10; i++) __col.step(60); out.giant = __col.S.role === 'giant' && __col.S.t > 5;
      return out;
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    assert.ok(r.title, 'title menu'); assert.ok(r.human, 'human start'); assert.ok(r.giant, 'giant start');
    console.log('page loads (' + r.scripts.length + ' local scripts), title menu, human and giant start');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
