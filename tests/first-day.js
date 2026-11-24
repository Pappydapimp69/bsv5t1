// Colossus first day: one card to begin, then every goal arrives in a banner while play runs on.
// Run: node tests/first-day.js   (needs Playwright's Chromium; runs offline, without Three.js)
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch();
  const passed = [];
  const ok = (cond, name, detail) => { assert.ok(cond, name + (detail ? ': ' + detail : '')); passed.push(name); };
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/three.min.js', route => route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.__col);

    const card = () => page.evaluate(() => document.getElementById('ov').hidden ? '' : document.getElementById('card').innerText);
    const banner = () => page.evaluate(() => { const e = document.getElementById('hud2'); return e.hidden ? '' : e.textContent; });
    const goal = () => page.evaluate(() => document.getElementById('goal').textContent);
    const step = () => page.evaluate(() => tutStep()?.id || 'done');
    const until = async (fn, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); } throw new Error('timed out waiting for ' + what); };

    await page.keyboard.press('Enter'); // Play as a human
    await page.evaluate(() => { __col.S.t = 23; });
    await until(async () => (await card()).includes('The first day'), 5000, 'first card');
    const first = await card();
    ok(/Walk into one to pick it up/.test(first) && /appears at the top while you play/.test(first) && /Skip the first day/.test(first), 'one opening card explains the goals to come', first);
    ok(!/Show me/.test(first), 'no camera-flight button');
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter'); // Begin
    await until(async () => !(await card()), 2000, 'card closed');
    ok(!(await page.evaluate(() => !!__col.S.fly)), 'Begin does not fly the camera away');

    // count every card from here on
    await page.evaluate(() => { window.__opens = 0; const o = openMenu; openMenu = m => { window.__opens++; return o(m); }; });

    // idle: the goal stays open and play runs
    const t0 = await page.evaluate(() => __col.S.t);
    await page.waitForTimeout(2500);
    ok((await step()) === 'crystal', 'first goal does not pass while idle');
    ok(await page.evaluate(t => __col.S.t > t + 1.5, t0), 'game runs under the first goal');
    ok(/Pick up a crystal/.test(await goal()), 'goal line names the goal', await goal());

    // finish the goal: the next one arrives in the banner, with no card and no pause
    await page.evaluate(() => { const h = __col.S.you, t = __col.S.towns[h.town]; h.x = t.x + 520; h.y = t.y; h.pack.crystals++; });
    await until(async () => (await step()) === 'home', 3000, 'second goal');
    await until(async () => /First day 2\/17/.test(await banner()), 2000, 'banner');
    ok(/Walk home into Ashville/.test(await banner()), 'banner shows the next goal', await banner());
    ok(await page.evaluate(() => window.__opens === 0 && !menu), 'no card for the second goal');
    const t1 = await page.evaluate(() => __col.S.t);
    await page.waitForTimeout(1000);
    ok(await page.evaluate(t => __col.S.t > t + .5, t1), 'play continues under the banner');

    // the banner gives way to the goal line once read; the goal line stays
    await page.evaluate(() => { __col.S.tut.goalAt -= 30; });
    await until(async () => !(await banner()), 2000, 'banner hides');
    ok(/Bank it in Ashville/.test(await goal()), 'goal line keeps the goal after the banner hides', await goal());

    // the pause menu repeats the goal
    await page.keyboard.press('Escape');
    await until(async () => (await card()).includes('Paused'), 2000, 'pause');
    ok(/First day 2\/17: Walk home into Ashville/.test(await card()), 'pause menu repeats the current goal', await card());
    await page.keyboard.press('Escape');
    await until(async () => !(await card()), 2000, 'resume');

    // every remaining goal: none opens a card, and the day ends
    await page.evaluate(() => { window.__opens = 0; });
    for (let i = 0; i < 40 && (await step()) !== 'done'; i++) {
      await page.evaluate(() => { if (__col.S.tut.shown) __col.S.tut.skipped = true; });
      await page.waitForTimeout(120);
    }
    ok((await step()) === 'done', 'the first day reaches its end');
    ok(await page.evaluate(() => window.__opens === 0), 'no goal after the first opened a card', String(await page.evaluate(() => window.__opens)));
    ok(await page.evaluate(() => __col.S.tut.done && JSON.parse(localStorage.getItem('colossus.v1')).firstDay === 1), 'finishing is remembered');

    ok(errors.length === 0, 'no page errors', errors.join('; '));
    console.log(passed.length + ' first-day checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
