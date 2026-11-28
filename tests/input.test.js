// Controller and keyboard navigation test (RULES.md 10).
// A fake standard-mapping gamepad replaces navigator.getGamepads, then the test
// moves through menus, a cutscene, the map and a fight with it, and checks the
// arrow keys do the same. Run: node tests/input.test.js
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('FAIL ' + msg); } else console.log('ok   ' + msg); };

const FAKE_PAD = () => {
  const pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
};
const BTN = { A: 0, B: 1, X: 2, Y: 3, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(FAKE_PAD);
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => window.APP && window.APP.ready);
  await page.evaluate(() => { localStorage.clear(); window.APP.S.speed = 0.02; window.APP.S.settings.text = 'instant'; });

  const set = (i, on) => page.evaluate(([i, on]) => { const b = window.__pad.buttons[i]; b.pressed = on; b.value = on ? 1 : 0; }, [i, on]);
  const press = async i => { await set(i, true); await page.waitForTimeout(70); await set(i, false); await page.waitForTimeout(70); };
  const settle = () => page.waitForTimeout(320); // past the 250 ms screen-change guard
  const screen = () => page.evaluate(() => window.APP.S.screen + (window.APP.run ? ':' + window.APP.run.screen : '') + (window.APP.S.modal ? ':' + window.APP.S.modal.k : ''));
  const focused = () => page.evaluate(() => { const el = document.activeElement; return el && el !== document.body ? (el.dataset.a || '') + ':' + (el.dataset.s || el.dataset.i || el.dataset.n || el.dataset.k || el.id || el.textContent.trim().slice(0, 12)) : 'none'; });
  const inModal = () => page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.modal')));

  // splash: A dismisses it, and the same press must not also click the title's default button
  await press(BTN.A);
  await page.waitForTimeout(400);
  check(await screen() === 'title', 'A on the splash goes to the title and nothing more (got ' + await screen() + ')');
  check(await page.evaluate(() => document.body.classList.contains('pad')), 'controller input turns on the visible focus ring');

  // title menu: move down and up through the options
  const start = await focused();
  await press(BTN.DOWN); const f1 = await focused();
  await press(BTN.DOWN); const f2 = await focused();
  await press(BTN.UP); const f3 = await focused();
  check(start === 'newrun:' + 'New run' || start.startsWith('newrun'), 'title opens with New run focused (' + start + ')');
  check(f1 === 'go:help' && f2 === 'go:goals' && f3 === 'go:help', `D-pad moves through the title menu (${f1} -> ${f2} -> ${f3})`);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check(outline !== 'none', 'the focused option shows an outline (' + outline + ')');
  // the left stick moves too
  await page.evaluate(() => { window.__pad.axes[1] = 1; }); await page.waitForTimeout(80); await page.evaluate(() => { window.__pad.axes[1] = 0; }); await page.waitForTimeout(80);
  check(await focused() === 'go:goals', 'the left stick moves focus (' + await focused() + ')');
  await press(BTN.UP);

  // A opens How to play, B comes back
  await press(BTN.A); await settle();
  check(await screen() === 'help', 'A opens the focused option (How to play)');
  await press(BTN.B); await settle();
  check(await screen() === 'title', 'B goes back to the title');

  // settings: a volume slider moves with left and right, and focus can leave it
  for (let i = 0; i < 6 && await focused() !== 'go:settings'; i++) await press(BTN.DOWN);
  await press(BTN.A); await settle();
  check(await screen() === 'settings', 'reached Settings with the D-pad');
  const firstSlider = await page.evaluate(() => { const r = document.querySelector('input[type=range]'); r.focus(); return +r.value; });
  await press(BTN.RIGHT);
  const after = await page.evaluate(() => +document.querySelector('input[type=range]').value);
  check(after > firstSlider, `right raises the focused volume (${firstSlider} -> ${after})`);
  await press(BTN.DOWN);
  check(await page.evaluate(() => document.activeElement.type !== 'range' || document.activeElement !== document.querySelector('input[type=range]')), 'down leaves the slider');
  await press(BTN.B); await settle();

  // new run: reach Begin with the D-pad only
  await press(BTN.UP); await press(BTN.UP); await press(BTN.UP); await press(BTN.UP);
  for (let i = 0; i < 6 && !(await focused()).startsWith('newrun'); i++) await press(BTN.UP);
  await press(BTN.A); await settle();
  check(await screen() === 'newrun', 'New run opens');
  await page.evaluate(() => { document.querySelector('#seed').value = 'PADTEST'; window.APP.S.newSeed = 'PADTEST'; });
  let reached = false;
  for (let i = 0; i < 10; i++) { if ((await focused()).startsWith('start')) { reached = true; break; } await press(BTN.DOWN); }
  if (!reached) for (let i = 0; i < 4; i++) { if ((await focused()).startsWith('start')) { reached = true; break; } await press(BTN.RIGHT); }
  check(reached, 'Begin is reachable with the D-pad (' + await focused() + ')');
  await press(BTN.A); await settle();
  check((await screen()).startsWith('cut'), 'Begin starts the intro (' + await screen() + ')');
  const panel0 = await page.evaluate(() => window.APP.S.cut.i);
  await press(BTN.A); await press(BTN.A);
  const panel1 = await page.evaluate(() => window.APP.S.cut && window.APP.S.cut.i);
  check(panel1 > panel0, `A advances the cutscene (panel ${panel0} -> ${panel1})`);
  await press(BTN.START); await settle();
  check(await screen() === 'run:map', 'Start skips the cutscene to the map');

  // map: focus lands on a reachable node, right moves between nodes, A enters
  const node0 = await focused();
  check(node0.startsWith('goNode'), 'map opens with a reachable node focused (' + node0 + ')');
  await press(BTN.RIGHT);
  const node1 = await focused();
  check(node1.startsWith('goNode') && node1 !== node0, `right moves to the next node (${node0} -> ${node1})`);
  await press(BTN.A); await settle();
  check((await screen()).startsWith('run:fight'), 'A on a node starts the fight');

  // fight: X draws, Y banks, A presses the focused button
  const line0 = await page.evaluate(() => window.APP.run.fight.staged.length);
  await press(BTN.X);
  const line1 = await page.evaluate(() => window.APP.run.fight.staged.length);
  check(line1 === line0 + 1, `X draws a token (line ${line0} -> ${line1})`);
  check((await focused()).startsWith('draw'), 'Draw keeps focus after drawing (' + await focused() + ')');
  await press(BTN.A);
  const line2 = await page.evaluate(() => window.APP.run.screen === 'fight' ? window.APP.run.fight.staged.length : -1);
  check(line2 === line1 + 1 || line2 === 0, `A on the focused Draw draws (line ${line1} -> ${line2})`);
  const turn0 = await page.evaluate(() => window.APP.run.fight && window.APP.run.fight.turn);
  await press(BTN.Y);
  await page.waitForFunction(() => !window.APP.S.busy);
  const turn1 = await page.evaluate(() => window.APP.run.fight ? window.APP.run.fight.turn : 99);
  check(turn1 > turn0, `Y banks and the turn passes (${turn0} -> ${turn1})`);

  // pause: Start opens it, a held direction does not walk through it, B closes it
  if ((await screen()).startsWith('run:fight')) {
    await set(BTN.DOWN, true);
    await press(BTN.START);
    await page.waitForTimeout(700); // held through the menu opening: must not auto-repeat into it
    const held = await focused();
    await set(BTN.DOWN, false); await page.waitForTimeout(80);
    check((await screen()).endsWith(':pause') && held.startsWith('closeModal'), 'a direction held while the menu opens does not move focus (' + held + ')');
    await press(BTN.DOWN);
    check(await inModal() && !(await focused()).startsWith('closeModal'), 'after release, down moves within the pause menu only (' + await focused() + ')');
    await press(BTN.B); await settle();
    check(!(await screen()).endsWith(':pause'), 'B closes the pause menu');
    await press(BTN.SELECT); await settle();
    check((await screen()).endsWith(':bag'), 'Select opens the bag');
    await press(BTN.B); await settle();
  }

  // keyboard arrows move focus too
  await page.evaluate(() => { window.APP.S.run = null; window.APP.handle('go', { s: 'title' }); });
  await settle();
  const k0 = await focused();
  await page.keyboard.press('ArrowDown'); const k1 = await focused();
  await page.keyboard.press('ArrowDown'); const k2 = await focused();
  check(k1 !== k0 && k2 !== k1 && k2.startsWith('go:'), `arrow keys move through the title menu (${k0} -> ${k1} -> ${k2})`);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await settle();
  check(await screen() !== 'title', 'Enter opens the focused option (' + await screen() + ')');

  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(failures ? failures + ' input check(s) failed' : 'all input checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
