// Colossus first climb: a new player's day -> night -> dawn on the giant, played through the keyboard.
// Setup moves the clock and places the player (walking there takes minutes); every action is a real key press.
// Run: node tests/first-climb.js   (needs Playwright's Chromium; runs offline, without Three.js)
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

    const feed = () => page.evaluate(() => [...document.querySelectorAll('#feed > *')].map(e => e.textContent).join(' | '));
    const goal = () => page.evaluate(() => document.getElementById('goal').textContent);
    const panelClock = () => page.evaluate(() => document.getElementById('gd').textContent);
    const climbBtn = () => page.evaluate(() => document.querySelector('.ab[data-s="B"]').textContent);
    const card = () => page.evaluate(() => document.getElementById('ov').hidden ? '' : document.getElementById('card').innerText);
    const mode = () => page.evaluate(() => __col.S.you.mode);
    const until = async (fn, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); } throw new Error('timed out waiting for ' + what); };

    // title: Play as a human; past the opening film; the first-day card's "Skip the first day"
    await page.keyboard.press('Enter');
    await page.evaluate(() => { __col.S.t = 23; });
    await until(async () => (await card()).includes('The first day'), 5000, 'first-day card');
    await page.waitForTimeout(800);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await until(async () => !(await card()), 3000, 'card closed');

    // the first day's climb step names the button in the hand the player holds
    const climbStep = await page.evaluate(() => FIRST_DAY.find(s => s.id === 'climb').text);
    ok(/press Climb \(K\)/.test(climbStep) && /dusk/.test(climbStep), 'tutorial climb step names K and dusk', climbStep);
    const perDevice = await page.evaluate(() => { const was = device, out = {}; for (const d of ['keys', 'pad', 'touch']) { device = d; out[d] = btnName('B', 'Climb'); } device = was; return out; });
    ok(perDevice.keys === 'press Climb (K)' && perDevice.pad === 'press Climb (B)' && perDevice.touch === 'tap Climb', 'climb prompt per device', JSON.stringify(perDevice));

    // stand beside the left foot carrying one ladder kit, and climb with K
    await page.evaluate(() => { const S = __col.S, h = S.you, f = S.g.feet[0]; h.x = f.x + __col.C.FOOT_R + 30; h.y = f.y; for (const k in h.kits) h.kits[k] = 0; h.kits.ladder = 1; });
    await until(async () => (await climbBtn()).startsWith('KClimb') && !(await climbBtn()).includes('Stand by'), 3000, 'Climb button live');
    await page.keyboard.press('KeyK');
    await until(async () => (await mode()) === 'climb', 2000, 'mounted');
    const grabbed = await feed();
    ok(/W, A, S and D/.test(grabbed), 'first grab says how to move', grabbed);
    ok(/Dusk in \d+:\d\d\. At nightfall the chained giant shakes everyone off, and half-built work is lost/.test(grabbed), 'first grab says what dusk does before it happens', grabbed);
    ok(!(await goal()).includes('Dusk in'), 'no dusk warning in the goal line while dusk is far');

    // W climbs
    await page.keyboard.down('KeyW'); await until(() => page.evaluate(() => __col.S.you.cl.y * 10 >= 40), 10000, 'climbing 40 ft').catch(() => {}); await page.keyboard.up('KeyW');
    const ft = await page.evaluate(() => Math.round(__col.S.you.cl.y * 10));
    ok(ft >= 20, 'W climbs', ft + ' ft');

    // under bare stone, W alone does nothing; the game says so and names a way that has a hold, and that key moves
    const deadEnd = await page.evaluate(() => { const S = __col.S, cl = S.you.cl, R = __col.C.REACH;
      for (let r = 3; r < 44; r++) for (let c = 0; c < 32; c++) { const p = {x: c + .5, y: r + .5};
        if (holdAt(c, r) && !pickHold(p, 0, 1, R) && (pickHold(p, -1, 0, R) || pickHold(p, 1, 0, R))) { cl.x = p.x; cl.y = p.y; cl.path = null; cl.move = null; S.you.grip = 100; return {r, c}; } }
      return null; });
    ok(!!deadEnd, 'found a hold with bare stone above');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
    ok(await page.evaluate(d => Math.floor(__col.S.you.cl.y) === d.r && Math.floor(__col.S.you.cl.x) === d.c, deadEnd), 'W alone cannot move off it');
    const hint = await feed(), named = /No hold that way: bare stone\. Try [a-z-]+ \(([WAD+]+)\)\./.exec(hint);
    ok(!!named, 'bare stone hint names the way round', hint);
    const keysNamed = named[1].split('+').map(k => 'Key' + k);
    for (const k of keysNamed) await page.keyboard.down(k);
    await page.waitForTimeout(600);
    for (const k of keysNamed) await page.keyboard.up(k);
    ok(await page.evaluate(d => Math.floor(__col.S.you.cl.x) !== d.c || Math.floor(__col.S.you.cl.y) !== d.r, deadEnd), 'the named keys move the climber', named[1]);

    // at the lowest build spot on this leg, J starts a ladder (5 s) late in the day; dusk comes before it is done
    await page.evaluate(() => { const S = __col.S, cl = S.you.cl; const s = S.sites.filter(q => !q.build && !q.pending && (q.c < 16) === (cl.x < 16)).sort((a, b) => a.r - b.r)[0]; cl.x = s.c + .5; cl.y = s.r + .5; cl.path = null; cl.move = null; S.t = __col.C.DUSK - 15.5; S.testSite = s; });
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyJ');
    await until(() => page.evaluate(() => !!__col.S.you.job), 2000, 'ladder underway');
    ok(await page.evaluate(() => __col.S.you.kits.ladder === 0 && __col.S.testSite.pending === __col.S.you.id), 'ladder kit spent and site reserved');
    await until(async () => /Dusk in 15 s/.test(await feed()), 3000, 'dusk warning toast');
    await page.evaluate(() => { __col.S.t = __col.C.DUSK - 3; });
    await until(async () => (await goal()).includes('Dusk in 0:0'), 2000, 'dusk warning in goal line');
    const warn = await goal();
    ok(/Dusk in 0:0\d.*finish the ladder or lose it and its kit/.test(warn), 'goal line warns the ladder will be lost', warn);
    ok(/Dusk in 15 s\. At nightfall the chained giant shakes everyone off and your unfinished ladder is lost/.test(await feed()), 'dusk warning toast', await feed());

    // nightfall: shaken off, the card names the loss and how to try again
    await until(async () => (await card()).includes('Nightfall'), 6000, 'nightfall card');
    const nc = await card();
    ok(/Lost: your half-built ladder \(\d+%\) and its kit/.test(nc), 'card names the lost ladder and kit', nc);
    ok(/Kept: every blow on the chains/.test(nc) && /Dawn comes in 60 s/.test(nc) && /press Climb \(K\)/.test(nc), 'card says what stays and how to retry at dawn', nc);
    ok(await page.evaluate(() => { const S = __col.S, h = S.you; return h.mode === 'ground' && !h.job && !S.testSite.pending && !S.testSite.build && h.kits.ladder === 0; }), 'night really took the climb and the half-built ladder');
    const tBefore = await page.evaluate(() => __col.S.t);
    await page.waitForTimeout(1000);
    ok(await page.evaluate(t => __col.S.t === t, tBefore), 'card pauses the night');
    await page.keyboard.press('Enter');
    await until(async () => !(await card()), 3000, 'card closed');

    // night: the wait is visible with a countdown, and K says when it opens
    await until(async () => (await goal()).includes('Night'), 2000, 'night goal line');
    ok(/Night.*dawn in \d:\d\d, then climb again/.test(await goal()), 'goal line counts down to dawn', await goal());
    ok(/^Dawn \d:\d\d$/.test(await panelClock()), 'panel clock counts to dawn', await panelClock());
    const c1 = await panelClock(); await page.waitForTimeout(2100);
    ok(c1 !== await panelClock(), 'night clock ticks', c1 + ' -> ' + await panelClock());
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(300);
    ok((await mode()) === 'ground', 'K cannot climb at night');
    ok(/climb again at dawn, in \d:\d\d/.test(await climbBtn()), 'Climb button says when', await climbBtn());

    // dawn: told to climb again, and the prompt waits for the player (it does not clear while idle)
    await page.evaluate(() => { __col.S.t = __col.C.DUSK + __col.C.NIGHT - 1.5; });
    await until(async () => (await feed()).includes('Dawn, day 2'), 5000, 'dawn message');
    ok(/The giant can be climbed again: press Climb \(K\) beside a planted foot/.test(await feed()), 'dawn says how to try again', await feed());
    ok(/Dawn.*climb again: press Climb \(K\)/.test(await goal()), 'dawn goal line', await goal());
    await page.waitForTimeout(3000);
    ok(/climb again/.test(await goal()), 'dawn prompt stays while idle', await goal());
    ok(/^Dusk 1\d:\d\d$/.test(await panelClock()), 'panel clock back to dusk', await panelClock());
    await page.keyboard.press('KeyK');
    await until(async () => (await mode()) === 'climb', 2000, 'climbing again at dawn');
    await page.waitForTimeout(300);
    ok(!/climb again/.test(await goal()), 'dawn prompt clears once climbing');

    // the second nightfall on the giant: a line, not the card again
    await page.evaluate(() => { const S = __col.S; S.t = 2 * (__col.C.DUSK + __col.C.NIGHT) - __col.C.NIGHT - 1; });
    await until(async () => (await feed()).includes('Night fell'), 5000, 'second nightfall line');
    await page.waitForTimeout(400);
    ok(!(await card()), 'card shows only the first time');
    ok(/Night fell at \d+ ft: the chained giant shook you off\. Climb again at dawn\./.test(await feed()), 'second nightfall line', await feed());

    ok(errors.length === 0, 'no page errors', errors.join('; '));
    console.log(passed.length + ' first-climb checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
