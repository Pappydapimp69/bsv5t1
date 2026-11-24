// Colossus human match end to end: day 1 the chains hold, day 2 they open (ankles at dawn, wrists at noon), you wake
// the giant with a horn, it judges at the first dusk it has been awake half a day, and the end card tells the match.
// Setup moves the clock and places the player (a real match takes about 45 minutes); actions are key presses.
// Run: node tests/match.js   (needs Playwright's Chromium; runs offline, without Three.js)
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
    const feed = () => page.evaluate(() => [...document.querySelectorAll('#feed > *')].map(e => e.textContent).join(' | '));
    const title = () => page.evaluate(() => document.getElementById('gt').textContent);
    const goal = () => page.evaluate(() => document.getElementById('goal').textContent);
    const banner = () => page.evaluate(() => { const e = document.getElementById('hud2'); return e.hidden ? '' : e.textContent; });
    const until = async (fn, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await page.waitForTimeout(100); } throw new Error('timed out waiting for ' + what); };
    const setT = t => page.evaluate(t => { __col.S.t = t; }, t);
    const C = await page.evaluate(() => ({DUSK: __col.C.DUSK, NIGHT: __col.C.NIGHT, OPEN: __col.C.CHAIN_OPEN, WAKE_ROW: __col.C.WAKE_ROW, LAST: __col.C.LAST_DAY}));
    const day = C.DUSK + C.NIGHT;

    // start, skip the first day
    await page.keyboard.press('Enter');
    await setT(23);
    await until(async () => (await card()).includes('The first day'), 5000, 'first card');
    await page.waitForTimeout(800);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await until(async () => !(await card()), 2000, 'card closed');

    // day 1: the chains hold
    await until(async () => /Day 1 · The Chains Hold/.test(await title()), 3000, 'day 1 title');
    ok(true, 'panel names day 1 and its phase');
    ok(/The Chains Hold.*chains open at dawn/.test(await goal()), 'goal line gives the phase objective', await goal());
    await until(async () => /contracts for day 1/.test(await feed()), 4000, 'contracts posted');
    await page.keyboard.press('Escape');
    await until(async () => (await card()).includes('Paused'), 2000, 'pause');
    const pause1 = await card();
    ok(/Day 1 · The Chains Hold\./.test(pause1) && /forge a wake horn/.test(pause1), 'pause menu explains the phase', pause1);
    ok((pause1.match(/ gold \(/g) || []).length === 3, 'three open contracts listed with progress', pause1);
    await page.keyboard.press('Escape');
    await until(async () => !(await card()), 2000, 'resume');

    // a contract pays when its count is reached
    const c0 = await page.evaluate(() => { const h = __col.S.you, c = __col.S.contracts[0]; const gold = h.gold;
      if (c.stat === 'maxFt') h.maxFt = c.need; else if (c.stat === 'horn') h.horn = 1; else if (c.stat === 'built') { for (let i = 0; i < c.need; i++) __col.S.builds.push({k: 'house', x: -9999, y: -9999, town: h.town, owner: h.id}); } else h[c.stat] = (h[c.stat] || 0) + c.need;
      return {text: c.text, gold, pay: c.gold}; });
    await until(async () => (await feed()).includes('Contract done: ' + c0.text), 3000, 'contract done');
    ok(await page.evaluate(c => __col.S.you.gold >= c.gold + c.pay, c0), 'contract pays its gold');

    // beside the left foot, J on the ankle chain: it rings but holds on day 1
    await page.evaluate(() => { const S = __col.S, h = S.you, f = S.g.feet[0]; h.x = f.x - __col.C.FOOT_R - 30; h.y = f.y; });
    await page.waitForTimeout(300);
    const hp0 = await page.evaluate(() => __col.S.chains.find(c => c.id === 'ankleL').hp);
    await page.keyboard.press('KeyJ'); await page.waitForTimeout(300);
    ok(await page.evaluate(hp => __col.S.chains.find(c => c.id === 'ankleL').hp === hp, hp0), 'day 1: chain takes no damage');
    ok(/rings but holds: the chains hold until dawn on day 2/.test(await feed()), 'day 1: told why', await feed());

    // dawn, day 2: the waking; ankles open, wrists not yet
    await setT(day - 1);
    await until(async () => /Day 2 · The Waking/.test(await title()), 5000, 'day 2 title');
    await until(async () => /The Waking/.test(await banner()), 3000, 'phase banner');
    ok(/wrist chains loosen at noon/.test(await banner()), 'banner announces the waking and the schedule', await banner());
    ok(/Break the chains: 0 of 4 broken/.test(await goal()), 'goal line counts the chains', await goal());
    await page.evaluate(() => { const h = __col.S.you, f = __col.S.g.feet[0]; h.x = f.x - __col.C.FOOT_R - 30; h.y = f.y; h.cd = 0; });
    const hp1 = await page.evaluate(() => __col.S.chains.find(c => c.id === 'ankleL').hp);
    await page.keyboard.press('KeyJ'); await page.waitForTimeout(300);
    ok(await page.evaluate(hp => __col.S.chains.find(c => c.id === 'ankleL').hp < hp, hp1), 'day 2: J wears the ankle chain');
    ok(await page.evaluate(() => !wristsOpen() && chainOpenFor(__col.S.chains[0]) && !chainOpenFor(__col.S.chains[2])), 'wrists still closed before noon');
    await setT(day + C.DUSK / 2 + 1);
    await until(async () => /Noon: the wrist chains loosen/.test(await feed()), 3000, 'noon');
    ok(await page.evaluate(() => wristsOpen()), 'wrists open at noon');

    // the chains go (the rivals' work, set here); you carry a horn to the head and J sounds it
    const wakeAt = day + C.DUSK / 2 + 120;
    await page.evaluate(([t, row]) => { const S = __col.S, h = S.you; S.t = t; for (const c of S.chains) c.hp = 0; h.horn = 1;
      mount(h, 0); h.cl.grab = null; let cell = null; for (let r = row; r < 200 && !cell; r++) for (let c = 10; c <= 21 && !cell; c++) if (holdAt(c, r) && restful(cellT(c, r))) cell = [r, c];
      h.cl.y = cell[0] + .5; h.cl.x = cell[1] + .5; h.grip = 200; h.cl.path = null; }, [wakeAt, C.WAKE_ROW]);
    await until(async () => /Sound a wake horn/.test(await goal()) || (await page.evaluate(() => /Sound the wake horn/.test(document.querySelector('.ab[data-s="A"]').textContent))), 3000, 'horn prompt');
    await page.keyboard.press('KeyJ');
    await until(async () => page.evaluate(() => __col.S.g.awake), 20000, 'giant wakes');
    ok(/You have woken and freed the giant/.test(await feed()), 'you woke the giant', await feed());
    await until(async () => /The Judgement/.test(await title()), 3000, 'judgement title');
    const judgeDay = await page.evaluate(() => __col.S.t - __col.S.wokeAt < __col.C.JUDGE_AWAKE ? 3 : 2);
    ok(/Earn its regard before dusk on day/.test(await goal()), 'goal line names the judgement', await goal());

    // its first dusk: awake under half a day, it waits for the next
    await page.evaluate(() => { const h = __col.S.you; if (h.mode === 'climb') leaveClimb(h); });
    await setT(day + C.DUSK - 1);
    await until(async () => /chooses its favourite at dusk on day 3/.test(await feed()), 5000, 'judgement deferred');
    ok(judgeDay === 3 && !(await page.evaluate(() => !!__col.S.over)), 'woke late on day 2: no verdict that night');
    ok(/before dusk on day 3/.test(await page.evaluate(() => matchPhase().short)), 'the judgement day is day 3');

    // dusk on day 3: the verdict and the end card
    await setT(2 * day + C.DUSK - 1);
    await until(async () => /Victory|Defeat/.test(await card()), 8000, 'end card');
    const end = await card();
    ok(/At dusk the giant honours/.test(end), 'verdict at dusk on day 3', end);
    ok(/Days\s+3/.test(end) && /Chain blows\s+\d+/.test(end) && /Contracts\s+[1-9]/.test(end) && /Highest climb\s+\d+ ft/.test(end), 'end card shows your numbers', end);
    ok(/How it went/.test(end) && /You sounded the horn and woke the giant/.test(end) && /The wrist chains loosened at noon/.test(end), 'end card tells the match', end);
    ok(/Play again/.test(end), 'end card offers another match');

    // a giant nobody wakes: dusk on the last day judges anyway, so every match ends
    const slept = await page.evaluate(last => { const S = __col.newGame('human', 7); const C = __col.C; S.t = (last - 1) * (C.DUSK + C.NIGHT) + C.DUSK - C.DT; S.day = last; __col.step(3); return S.over && S.over.text; }, C.LAST);
    ok(/never woke; still, it chooses/.test(slept || ''), 'a sleeping giant still judges on the last day', slept);

    ok(errors.length === 0, 'no page errors', errors.join('; '));
    console.log(passed.length + ' match checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
