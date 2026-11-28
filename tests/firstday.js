// Colossus: the first day as open chapters. Rule checks, then a player that follows only what is drawn (the tracked
// goal's mark, landmark lights, beasts and crystals it can see, the buttons the journal names) plays the whole day
// on three seeds; the time to finish and the longest stretch without progress are logged (GPTBS demo-disc#E51).
// Run: node tests/firstday.js   (add --quick to skip the playthroughs)
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
      const day = seed => { save.firstDay = 0; save.noFly = 1; start('human', seed, true); closeMenu(); const S = __col.S; S.headless = true; S.t = OPENING.len + 2; return S; };
      const tick = n => { for (let i = 0; i < (n || 1); i++) __col.step(1); };
      // morning: one marked goal; banking the crystal opens The land with the job (needed) and nothing granted
      let S = day(3), h = S.you; tick();
      out.morning = S.tut.ch === 0 && tutGoals().map(g => g.id).join() === 'crystal' && !!tutTracked();
      const g0 = h.gold, c0 = h.crystals; h.crystals += 1; tick(2);
      out.landOpens = S.tut.ch === 1 && tutOpen('job') && !tutOpen('house') && h.gold === g0 && h.crystals === c0 + 1;
      // any order, and the job is needed: three other goals alone do not open Your town
      for (const id of ['talent', 'dodge', 'rest', 'shrine', 'discover']) { S.tut.open[id] = S.t; S.tut.done_[id] = S.t; }
      tick(2); out.jobNeeded = S.tut.ch === 1;
      S.tut.done_.job = S.t; tick(2); out.townOpens = S.tut.ch === 2 && tutOpen('house') && tutOpen('barracks') && tutOpen('horse') && h.gold === g0;
      // goals appear in context: the soldier goal only once a barracks stands
      out.soldierWaits = !tutOpen('soldier');
      // the stuck loan: none before 180 s without progress, then once, for the cheapest building goal's gap
      h.gold = 0; S.tut.lastProgress = S.t; S.t += 170; tick(); const early = h.gold === 0;
      S.t += 20; tick(); const lent = h.gold === Math.min(C.COST.house, C.COST.barracks, C.HORSE_COST);
      h.gold = 0; S.t += 400; tick(); out.stuckLoan = early && lent && h.gold === 0;
      // the giant is last: chains closed to rival towns and waves held before Your town, then open in The giant
      const S2 = day(4); S2.t = 300; tick(120); out.wavesHeld = S2.tut.ch < 2 && (S2.waves || []).every(w => w.n === 0);
      S2.humans[3].horn = 1; out.chainsShut = !chainsOpen();
      S2.tut.ch = 3; out.chainsOpenLate = chainsOpen();
      // the knee ends the day; Skip ends it too
      for (const id of ['chain', 'climb', 'knee']) { S2.tut.open[id] = S2.t; } S2.tut.done_.knee = S2.t; tick(2); out.kneeEnds = !tutActive() && save.firstDay === 1;
      const S3 = day(5); tick(); tutFinish(); out.skip = !tutActive() && save.firstDay === 1;
      // safe from wolves until you take the job or strike
      const S4 = day(6); tick(); out.safeAtFirst = tutProtect(); humanAct(S4.you, 'A'); out.airSwingStaysSafe = tutProtect();
      S4.monsters.push({id: 990, kind: 'wolf', x: S4.you.x + 20, y: S4.you.y, hx: 0, hy: 0, hp: 30, max: 30, atk: 1, gold: 0, xp: 0, r: 13, cd: 9}); S4.you.cd = 0; humanAct(S4.you, 'A'); out.fightEndsSafety = !tutProtect();
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v, k);
    console.log(Object.keys(r).length + ' first-day rule checks passed');
    if (process.argv.includes('--quick')) { assert.deepEqual(errors, []); return; }

    // the drawn-cues player
    const runPlay = (seeds, usePointer) => page.evaluate(([seeds, usePointer]) => {
      const res = [], dbg = [], process_debug = seeds.length === 1;
      for (const seed of seeds) {
        save.firstDay = 0; save.noFly = 1; start('human', seed, true); closeMenu(); const S = __col.S; S.headless = true; const h = S.you;
        const town = S.towns[h.town]; let wander = null, lastP = 0, gap = 0, prog = S.t, share = {walk: 0, fight: 0, place: 0, town: 0, idle: 0}, px = h.x, py = h.y, loans = 0;
        const menuPick = re => { const it = menu && menu.items.find(i => re.test(i.label) && !i.why); if (it) it.act(); closeMenu(); return !!it; };
        const goTo = p => { h.tx = p.x; h.ty = p.y; };
        const of = tutFinish; let who = ''; tutFinish = function () { who = new Error().stack.split('\n').slice(1, 5).join(' / '); return of(); };
        while (tutActive() && S.t < 2400 && !S.over) {
          if (h.dead) { __col.step(30); continue; }
          if (h.picks > 0) takeTalent(h, talentChoices(h)[0]);
          if (tutOpen('map')) S.tut.mapOpened = true;
          const inTown = townAt(h) === town;
          if (inTown) {
            if (tutJob()) { openTown(town, 'Board'); menuPick(/^Slay 3/); }
            if (h.quest && h.quest.done) { openTown(town, 'Board'); menuPick(/^Claim/); }
            if (tutOpen('horse') && !h.horse && h.gold >= C.HORSE_COST) { openTown(town, 'Shop'); menuPick(/^Horse/); }
          }
          if (h.horse && !h.riding && !h.rodeOnce) toggleRide(h);
          const foe = S.monsters.filter(m => Math.hypot(m.x - h.x, m.y - h.y) < m.r + 45 && (m.tut || !m.camp)).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
          let did = false;
          if (h.mode === 'ground' && foe) { if (foe.wind && foe.wind.id === h.id && foe.wind.t > foe.wind.dur * .55) humanDodge(h); else if (h.cd <= 0) { if (tutOpen('heavy') && foe.hp <= h.atk * 2.5) heavyStrike(h, 1); else humanAct(h, 'A'); } did = true; }
          const bar = tutBarracks(h);
          if (!did && h.mode === 'ground') {
            const pn = poiNear(h), act = pn && poiAct(h), want = pn && (pn.k === 'shrine' && tutOpen('shrine') || (pn.k === 'spring' || pn.k === 'stones') && tutOpen('rest') || pn.k === 'herb' && h.hp < h.max * .6);
            if (act && !act.why && want) { usePoi(h, pn); closeMenu(); did = true; }
          }
          if (!did && tutOpen('house') && h.gold >= C.COST.house) { const p = tutGoal('house').target(h); if (Math.hypot(p.x - h.x, p.y - h.y) < 30) { build(h, 'house'); did = true; } }
          if (!did && tutOpen('barracks') && h.gold >= C.COST.barracks) { const p = tutGoal('barracks').target(h); if (Math.hypot(p.x - h.x, p.y - h.y) < 30) { build(h, 'barracks'); did = true; } }
          if (!did && tutOpen('raise') && h.crystals >= C.UP.house[0]) { const b = tutGoal('raise').target(h); if (b && Math.hypot(b.x - h.x, b.y - h.y) < 80) { upgrade(h, 'house', b); did = true; } }
          if (!did && bar && Math.hypot(bar.x - h.x, bar.y - h.y) < 120) { if (tutOpen('soldier') && h.gold >= ARMY.SOLDIER) { openBarracks(bar); menuPick(/^Train a soldier/); } if (tutOpen('order') && trainedCount(bar)) { openBarracks(bar); menuPick(/^Defend giant/); } }
          if (!did && tutOpen('chain') && h.mode === 'ground' && footChain(h)) { humanAct(h, 'A'); did = true; }
          if (!did && tutOpen('climb') && h.mode === 'ground' && nearFoot(h) >= 0) { humanAct(h, 'B'); did = true; }
          S.autoplay = h.mode === 'climb';
          if (!did && h.mode === 'ground' && !h.job) {
            // where to go: the tracked mark (if the pointer is used), else a landmark light, else a visible crystal or beast to earn from, else wander
            const tr = usePointer ? tutTracked() : null, tg = tr && tr.target(h);
            const lm = tutLandmarks().sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
            const cr = S.crystals.filter(c => Math.hypot(c.x - h.x, c.y - h.y) < 900).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
            const need = tutGoals().some(g => g.cost && h.gold < g.cost());
            const prey = need && S.monsters.filter(m => !m.camp && !m.elite && m.kind !== 'troll' && Math.hypot(m.x - h.x, m.y - h.y) < 1500).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
            if (packCount(h) >= packCap(h) - 1 || h.hp < h.max * .35) goTo(town);
            else if (tg && !(tr.cost && h.gold < tr.cost())) goTo(tg);
            else if (tutOpen('shrine') && placeSeen(h, ['shrine'])) goTo(placeSeen(h, ['shrine'])); else if (tutOpen('rest') && placeSeen(h, ['spring', 'stones'])) goTo(placeSeen(h, ['spring', 'stones']));
            else if (lm) goTo(lm); else if (cr) goTo(cr); else if (prey) goTo(prey);
            else if (!usePointer && (tutOpen('job') || h.quest)) goTo(h.quest && !h.quest.done ? tutWolfNear(h) : town);
            else { if (!wander || Math.hypot(wander.x - h.x, wander.y - h.y) < 60) wander = {x: town.x + Math.cos(S.t) * 1800, y: town.y + Math.sin(S.t) * 1800}; goTo(wander); }
          }
          __col.step(15);
          if (S.tut && S.tut.lastProgress !== prog) { gap = Math.max(gap, S.tut.lastProgress - prog); prog = S.tut.lastProgress; }
          loans = Object.keys((S.tut && S.tut.lent) || {}).length;
          if (S.t >= 180 && S.t < 480) { const mv = Math.hypot(h.x - px, h.y - py) > 1, f = S.monsters.some(m => Math.hypot(m.x - h.x, m.y - h.y) < 250), pl = (S.pois || []).some(p => Math.hypot(p.x - h.x, p.y - h.y) < 160); share[townAt(h) ? 'town' : f ? 'fight' : pl ? 'place' : mv ? 'walk' : 'idle']++; }
          px = h.x; py = h.y;
          if (process_debug && Math.floor(S.t) % 30 === 0 && S.t % 1 < .26) dbg.push(Math.round(S.t) + ' @' + Math.round(h.x) + ',' + Math.round(h.y) + ' tx ' + Math.round(h.tx || 0) + ',' + Math.round(h.ty || 0) + ' lm ' + tutLandmarks().length + ' tr ' + (tutTracked() || {}).id + ' mode ' + h.mode + ' job ' + (h.job && h.job.k) + ' hp ' + Math.round(h.hp) + ' over ' + !!S.over + ' goals ' + tutGoals().map(g => g.id).join('/'));
        }
        S.autoplay = false; tutFinish = of;
        const tot = Object.values(share).reduce((a, b) => a + b, 0) || 1;
        res.push({seed, who: who.slice(0, 300), done: Object.entries(S.tut.done_).map(([k, v]) => k + '@' + Math.round(v)).join(' '), finished: !tutActive(), minutes: Math.round(S.t / 6) / 10, longestGapMin: Math.round(Math.max(gap, S.t - prog) / 6) / 10, loans, lvl: h.lvl, min3to8: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, Math.round(v / tot * 100)]))});
      }
      return process_debug ? res.concat(dbg) : res;
    }, [seeds, usePointer]);
    const seeds = process.argv.includes('--one') ? [11] : [11, 12, 13];
    const play = await runPlay(seeds, true);
    console.log('pointer on:', JSON.stringify(play.filter(x => typeof x === 'object').map(({who, ...x}) => x)));
    const off = await runPlay(seeds, false);
    console.log('pointer off:', JSON.stringify(off.filter(x => typeof x === 'object').map(({who, ...x}) => x)));
    for (const p of play.filter(x => typeof x === 'object')) assert.ok(p.finished, 'seed ' + p.seed + ' finishes the first day');
    assert.deepEqual(errors, []);
    console.log('first-day playthroughs finished on ' + play.length + ' seeds');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
