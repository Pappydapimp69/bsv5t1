// Browser test: plays whole runs through the real UI at desktop and phone size.
// Checks RULES.md 5 at every draw prompt, that every screen renders without
// errors or sideways scrolling, that audio plays without clipping, and that the
// UI reaches the same result as the headless engine for the same seed.
// Run: node tests/browser.test.js [screenshot-dir]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const XR = require('../core.js');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2] || null;
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv)); // port 0: no fixed port to collide on
  });
}

let failures = 0;
const fail = m => { failures++; console.log('FAIL ' + m); };

async function playThrough(page, label, seed, mode, style) {
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(page.baseURL);
  await page.waitForFunction(() => window.APP && window.APP.ready);
  await page.evaluate(() => { localStorage.clear(); window.APP.S.speed = 0.02; window.APP.S.settings.text = 'instant'; });
  await page.mouse.click(200, 200); // splash: the first gesture starts audio
  await page.waitForFunction(() => window.APP.S.screen === 'title');
  await page.click('[data-a=newrun]');
  await page.fill('#seed', seed);
  if (mode === 'story') await page.click('[data-a=mode][data-m=story]');
  await page.click('[data-a=start]');
  await page.waitForFunction(() => window.APP.S.screen === 'cut');
  // wait on the state the check reads: text is typed in on animation frames
  const typed = await page.waitForFunction(() => /Generator/.test((document.querySelector('.textbox') || {}).textContent || ''), null, { timeout: 5000 }).then(() => true, () => false);
  if (!typed) fail(label + ': intro text never appeared');
  await page.click('[data-a=cutSkip]');
  await page.waitForFunction(() => window.APP.S.screen === 'run');

  const seen = new Set();
  let draws = 0, steps = 0, maxRms = 0, maxPeak = 0;
  const shot = async name => {
    if (seen.has(name)) return; seen.add(name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 1) fail(`${label}: ${name} scrolls sideways by ${overflow}px`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${label}-${name}.png`) });
  };
  while (steps++ < 4000) {
    await page.waitForFunction(() => !window.APP.S.busy);
    const st = await page.evaluate(() => {
      const A = window.APP, r = A.run;
      if (A.S.screen === 'cut') return { cut: A.S.cut.id };
      return { scr: r.screen, kind: r.fight && r.fight.kind, act: r.act, view: A.XR.view(r) };
    });
    if (st.cut) { await shot('cut-' + st.cut); await page.click('[data-a=cutSkip]'); continue; }
    if (st.scr === 'dead' || st.scr === 'victory') { await page.waitForTimeout(200); await shot(st.scr); break; }
    await shot(st.scr === 'fight' ? `fight-${st.kind}-act${st.act}` : `${st.scr}-act${st.act}`);
    if (st.scr === 'fight') {
      // RULES 5: bag makeup and face-up tokens are on screen at every draw prompt
      const ui = await page.evaluate(() => ({
        face: document.querySelectorAll('.next .tok.face').length,
        chips: Array.from(document.querySelectorAll('.odds .chip')).reduce((s, c) => s + parseInt(c.textContent, 10), 0),
        risk: (document.querySelector('.odds .risk') || {}).textContent,
        nextVisible: !!document.querySelector('.next') && document.querySelector('.next').getBoundingClientRect().height > 0,
        oddsVisible: !!document.querySelector('.odds') && document.querySelector('.odds').getBoundingClientRect().height > 0,
      }));
      const v = st.view.fight;
      if (!ui.nextVisible || !ui.oddsVisible) fail(`${label}: sight or odds panel hidden`);
      if (ui.face !== v.revealed.length) fail(`${label}: ${ui.face} face-up tokens shown, ${v.revealed.length} revealed`);
      if (ui.chips !== v.hiddenCount) fail(`${label}: bag makeup shows ${ui.chips}, blind part holds ${v.hiddenCount}`);
      if (ui.risk !== Math.round(v.risk * 100) + '%') fail(`${label}: odds show ${ui.risk}, engine says ${v.risk}`);
      draws++;
      if (draws % 40 === 0) {
        const lv = await page.evaluate(() => window.AU.level());
        maxRms = Math.max(maxRms, lv.rms); maxPeak = Math.max(maxPeak, lv.peak);
      }
    }
    // choose with the same bot the sweeps use, then press it through the UI
    await page.evaluate(([style]) => {
      const A = window.APP, a = A.XR.bot(A.XR.view(A.run), style);
      const H = A.handle;
      switch (a.t) {
        case 'go': return H('goNode', { n: a.node });
        case 'draw': case 'bank': return H(a.t, {});
        case 'take': return H('take', { i: a.i });
        case 'relic': return H('relicPick', { i: a.i });
        case 'done': return H('rewardDone', {});
        case 'buyTok': return H('buyTok', { i: a.i });
        case 'buyRelic': return H('buyRelic', {});
        case 'service': if (a.k === 'remove') { H('service', { k: 'remove' }); return H('picked', { uid: a.uid }); } return H('service', { k: a.k });
        case 'leave': return H(A.run.screen === 'shop' ? 'leaveShop' : A.run.screen === 'rest' ? 'leaveRest' : 'leaveEvent', {});
        case 'heal': return H('restHeal', {});
        case 'tune': H('restTune', {}); return H('picked', { uid: a.uid });
        case 'filter': H('restFilter', {}); return H('picked', { uid: a.uid });
        case 'choose': return H('choose', { i: a.i });
        case 'continue': return H('actCut', {});
      }
    }, [style]);
  }
  const end = await page.evaluate(() => { const r = window.APP.run; return { won: r.won, act: r.act, floor: r.floor, fights: r.stats.fights, hp: r.hp }; });
  const head = XR.playBot(seed, style, { mode }).run;
  const want = { won: head.won, act: head.act, floor: head.floor, fights: head.stats.fights, hp: head.hp };
  if (JSON.stringify(end) !== JSON.stringify(want)) fail(`${label}: UI run ended ${JSON.stringify(end)}, engine ${JSON.stringify(want)}`);
  if (maxRms <= 0.001) fail(`${label}: no audio measured (rms ${maxRms})`);
  if (maxPeak >= 1) fail(`${label}: audio clipped (peak ${maxPeak})`);
  if (errs.length) fail(`${label}: page errors: ${errs.slice(0, 3).join(' | ')}`);
  console.log(`${failures ? '...' : 'ok  '} ${label}: ${end.won ? 'won' : 'lost'} at act ${end.act} floor ${end.floor}, ${steps} steps, ${draws} draw prompts checked, screens: ${[...seen].sort().join(' ')}, audio rms ${maxRms.toFixed(3)} peak ${maxPeak.toFixed(2)}`);
  return seen;
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const cases = [
    { label: 'desktop-win', vp: { width: 1280, height: 800 }, seed: 'UI4', mode: 'story', style: 'cautious' },
    { label: 'phone-loss', vp: { width: 390, height: 844 }, seed: 'UI3', mode: 'standard', style: 'greedy' },
  ];
  try {
    for (const c of cases) {
      const page = await browser.newPage({ viewport: c.vp });
      page.baseURL = base;
      await playThrough(page, c.label, c.seed, c.mode, c.style);
      await page.close();
    }
  } catch (e) { fail('crashed: ' + (e && e.stack || e)); }
  await browser.close(); srv.close();
  console.log(failures ? failures + ' browser check(s) failed' : 'all browser checks passed');
  process.exit(failures ? 1 : 0);
})();
