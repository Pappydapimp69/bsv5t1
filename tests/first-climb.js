// The first climb's day, night and dawn, played in real time through the keyboard: walk to a planted foot, press
// Climb, climb, start a build that dusk will cut short, read the nightfall card, fail to climb at night, then climb again
// at dawn. Only the clock (set close to dusk) and one move onto a build spot are set up directly; the rest is key presses.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const shots = process.env.SHOTS;

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 1100, height: 720}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (!process.env.WITH_3D) await page.route('**/three.min.js', route => route.abort());
    await page.addInitScript(() => localStorage.setItem('colossus.v1', JSON.stringify({v: 1, firstDay: 1})));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const wait = ms => page.waitForTimeout(ms);
    // every toast is logged, since the on-screen feed keeps only the last three
    const feedHas = re => page.evaluate(src => window.__toasts.some(t => new RegExp(src).test(t)), re.source);
    const until = async (fn, ms, what) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { if (await page.evaluate(fn)) return; await wait(100); }
      assert.fail('timed out waiting for ' + what);
    };
    const shot = async name => { if (shots) await page.screenshot({path: path.join(shots, name + '.png')}); };
    const checks = {};

    // title: Play as a human (the first item)
    await page.keyboard.press('Enter');
    await until(() => !!(window.__col.S && S.you), 5000, 'the game to start');
    await page.evaluate(() => { window.__toasts = []; const t = window.toast; window.toast = s => { window.__toasts.push(s); t(s); }; });
    // setup: skip the opening film to 75 s before dusk and stand a short walk from the left foot
    await page.evaluate(() => {
      S.t = C.DUSK - 75;
      const f = S.g.feet[0], h = S.you;
      h.x = f.x + C.FOOT_R + 220; h.y = f.y; h.goal = null; h.tx = h.ty = null;
    });

    // walk to the foot with the movement keys, picking the camera-relative key that points at it
    const walkEnd = Date.now() + 15000;
    let held = null;
    while (!(await page.evaluate(() => nearFoot(S.you) >= 0)) && Date.now() < walkEnd) {
      const key = await page.evaluate(() => {
        const h = S.you, f = S.g.feet[0], dx = f.x - h.x, dy = f.y - h.y;
        let best = 'KeyW', bd = -1e9;
        for (const [k, m] of [['KeyW', {x: 0, y: -1}], ['KeyS', {x: 0, y: 1}], ['KeyA', {x: -1, y: 0}], ['KeyD', {x: 1, y: 0}]]) {
          const w = camRelative(m), d = w.x * dx + w.y * dy;
          if (d > bd) { bd = d; best = k; }
        }
        return best;
      });
      if (key !== held) { if (held) await page.keyboard.up(held); await page.keyboard.down(key); held = key; }
      await wait(120);
    }
    if (held) await page.keyboard.up(held);
    checks.walkedToFoot = await page.evaluate(() => nearFoot(S.you) >= 0);
    checks.footHint = await feedHas(/foot\. Press Climb/);
    checks.climbButtonReady = await page.evaluate(() => humanCtx(S.you).B.l === 'Climb' && !humanCtx(S.you).B.why);

    // Climb (K), then climb up with W
    await page.keyboard.press('KeyK');
    await until(() => S.you.mode === 'climb', 2000, 'the climb to start');
    checks.mounted = true;
    await wait(600);
    const y0 = await page.evaluate(() => S.you.cl.y);
    await page.keyboard.down('KeyW'); await wait(2500); await page.keyboard.up('KeyW');
    checks.climbedUp = await page.evaluate(y0 => S.you.cl.y > y0 + 1, y0);
    await until(() => toDusk() <= 60, 20000, 'a minute before dusk');
    await wait(200);
    checks.duskWarning = await feedHas(/Dusk in a minute/);
    checks.clockUrgent = await page.evaluate(() => document.getElementById('gd').classList.contains('soon'));
    await shot('1-dusk-warning');

    // setup: put the climber at the left thigh build spot, then wait until 3 s before dusk and start a ladder (J)
    await page.evaluate(() => { const s = SITES.find(x => x.id === 'thighL'), cl = S.you.cl; cl.x = s.c + .5; cl.y = s.r + .5; cl.move = null; cl.path = null; S.you.grip = maxGrip(S.you); });
    await until(() => toDusk() <= 3.2, 70000, '3 s before dusk');
    await page.keyboard.press('KeyJ');
    await wait(150);
    checks.buildStarted = await page.evaluate(() => S.you.job && S.you.job.k === 'ladder' && S.you.kits.ladder === 0);
    checks.buildWarning = await feedHas(/Dusk falls before this ladder/);

    // nightfall: thrown off, the ladder lost, the card says what happened and how to try again
    await until(() => S.night && !!menu, 6000, 'nightfall and its card');
    const card = await page.evaluate(() => document.getElementById('card').innerText);
    checks.thrownOff = await page.evaluate(() => S.you.mode === 'ground' && !S.you.job && !S.sites.find(s => s.id === 'thighL').pending && S.you.kits.ladder === 0);
    checks.cardTitle = /Nightfall/.test(card);
    checks.cardLostWork = /ladder was not finished, so it is lost with its kit/.test(card);
    checks.cardKept = /What you finished stays/.test(card);
    checks.cardDawn = /At dawn, in \d+ s, walk to a planted foot and press Climb \(K\)/.test(card);
    await shot('2-nightfall-card');
    await wait(800); // a card holds its first 700 ms against stray presses
    await page.keyboard.press('Enter');
    await until(() => !menu, 2000, 'the card to close');

    // night: the goal line and the Climb button count down to dawn; pressing Climb does nothing
    await wait(300);
    checks.goalNight = await page.evaluate(() => /Night.*dawn in \d+ s/.test(document.getElementById('goal').innerText));
    checks.panelDawn = await page.evaluate(() => /dawn in \d:\d\d/.test(document.getElementById('gd').textContent));
    await page.keyboard.press('KeyK');
    await wait(200);
    checks.nightRefuses = await page.evaluate(() => S.you.mode === 'ground') && await feedHas(/climb again at dawn, in \d+ s/);
    await shot('3-night');

    // dawn: called back to the foot; Climb works again
    await until(() => !S.night, 70000, 'dawn');
    await wait(200);
    checks.dawnToast = await feedHas(/Dawn\. The giant can be climbed again/);
    checks.goalDawn = await page.evaluate(() => /Dawn.*planted foot.*Climb/.test(document.getElementById('goal').innerText));
    await shot('4-dawn');
    await page.keyboard.press('KeyK');
    await until(() => S.you.mode === 'climb', 2000, 'the dawn climb');
    checks.climbsAtDawn = true;
    await wait(300);
    checks.goalCleared = await page.evaluate(() => !/Dawn/.test(document.getElementById('goal').innerText));
    checks.cardOnce = await page.evaluate(() => JSON.parse(localStorage.getItem('colossus.v1')).nightSeen === 1);

    // the first day ends on the dusk card
    checks.firstDayCard = await page.evaluate(() => {
      const st = FIRST_DAY[FIRST_DAY.length - 1];
      return st.id === 'night' && st.info && /dusk/.test(st.text) && /dawn/.test(st.text);
    });

    for (const [check, passed] of Object.entries(checks)) assert.ok(passed, check);
    assert.deepEqual(errors, []);
    console.log(Object.keys(checks).length + ' first-climb day, night and dawn checks passed');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
