// Headless rule tests for xrndm (RULES.md 1-4, 6). Run: node tests/core.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const XR = require('../core.js');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.message)); }
}

// Play a run with a bot for at most `limit` actions.
function playSteps(run, style, limit) {
  let n = 0;
  while (n < limit && run.screen !== 'dead' && run.screen !== 'victory') {
    const a = XR.bot(XR.view(run), style);
    if (!a) break;
    XR.act(run, a); n++;
  }
  return n;
}

test('rule 1: no Math.random or wall-clock time in game logic', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const bad of ['Math.random', 'Date.now', 'new Date', 'performance.now']) {
    assert.ok(src.indexOf(bad) < 0, 'core.js uses ' + bad);
  }
});

test('rule 2: an extra roll in one system leaves the other systems unchanged', () => {
  // For each system: advancing its own stream must change that system (so it
  // really reads its stream) and must leave every other system unchanged.
  const facets = {
    bag: r => r.fight.pile.map(t => t.uid).join(','),
    enc: r => r.fight.foe.id + ':' + r.fight.foe.maxHp,
    foe: r => JSON.stringify(r.fight.foe.intent),
  };
  for (const sys of Object.keys(facets)) {
    let moved = 0;
    for (let i = 0; i < 12; i++) {
      const a = XR.newRun('split' + i), b = XR.newRun('split' + i);
      for (let k = 0; k < 3; k++) XR.sfc32(b.rng[sys]);
      const first = XR.options(a)[0];
      XR.act(a, { t: 'go', node: first }); XR.act(b, { t: 'go', node: first });
      assert.deepStrictEqual(b.map, a.map, sys + ' roll changed the map');
      for (const other of Object.keys(facets)) {
        if (other === sys) { if (facets[sys](a) !== facets[sys](b)) moved++; }
        else if (!(sys === 'enc' && other === 'foe')) // a different foe makes different moves
          assert.strictEqual(facets[other](b), facets[other](a), sys + ' roll changed ' + other);
      }
    }
    assert.ok(moved > 0, 'advancing the ' + sys + ' stream never changed its system: it does not read its own stream');
  }
  const starts = XR.STREAMS.map(n => XR.newRun('split-check').rng[n].join(','));
  assert.strictEqual(new Set(starts).size, XR.STREAMS.length, 'two systems start from the same stream state');
});

test('rule 3: save and load mid-run gives the same run as never stopping', () => {
  // seeds whose run lasts long enough for a mid-run save to mean something
  const seeds = [];
  for (let i = 0; seeds.length < 3 && i < 40; i++) if (XR.playBot('save-' + i, 'cautious').run.floor > 8) seeds.push('save-' + i);
  assert.strictEqual(seeds.length, 3, 'could not find long enough runs');
  for (const seed of seeds) {
    const whole = XR.newRun(seed);
    const split = XR.newRun(seed);
    playSteps(whole, 'cautious', 120);
    playSteps(split, 'cautious', 120);
    const loaded = XR.load(XR.save(split));
    playSteps(whole, 'cautious', 20000);
    playSteps(loaded, 'cautious', 20000);
    assert.strictEqual(XR.hash(loaded), XR.hash(whole), seed + ' diverged after load');
    assert.ok(whole.floor > 3, seed + ' ended too early to test anything');
  }
});

test('rule 4: the same seed and inputs give the same run', () => {
  for (const style of ['greedy', 'cautious']) {
    for (let i = 0; i < 10; i++) {
      const a = XR.playBot('det' + i, style).run;
      const b = XR.playBot('det' + i, style).run;
      assert.strictEqual(XR.hash(a), XR.hash(b), style + ' seed det' + i);
    }
  }
  const x = XR.playBot('det-a', 'cautious').run, y = XR.playBot('det-b', 'cautious').run;
  assert.notStrictEqual(XR.hash(x), XR.hash(y), 'different seeds gave the same run');
});

test('rule 6: both bots finish 50 seeds without stalling', () => {
  for (const style of ['greedy', 'cautious']) {
    for (let i = 0; i < 50; i++) {
      const { run, steps } = XR.playBot('fin' + i, style);
      assert.ok(run.screen === 'dead' || run.screen === 'victory', style + ' fin' + i + ' stalled on ' + run.screen + ' after ' + steps + ' steps');
    }
  }
});

test('every foe, intent, event, relic and map node type occurs over a sweep', () => {
  const foes = new Set(), intents = new Set(), events = new Set(), relics = new Set(), nodes = new Set();
  for (let i = 0; i < 150; i++) {
    const { run } = XR.playBot('cov' + i, i % 2 ? 'greedy' : 'cautious');
    run.stats.lowest.forEach(l => foes.add(l.foe));
    if (run.fight) foes.add(run.fight.foe.id);
    Object.keys(run.stats.intents).forEach(k => intents.add(k));
    run.log.forEach(e => events.add(e));
    run.relics.forEach(r => relics.add(r));
    run.map.nodes.forEach(n => nodes.add(n.type));
  }
  const miss = (all, seen) => all.filter(x => !seen.has(x));
  assert.deepStrictEqual(miss(Object.keys(XR.F), foes), [], 'foes never met');
  const kinds = ['atk', 'def', 'buff', 'curse', 'drain', 'hush', 'noise', 'heal', 'shuffle', 'mimic', 'mirror', 'unseed'];
  assert.deepStrictEqual(miss(kinds, intents), [], 'intents never fired');
  assert.deepStrictEqual(miss(XR.EV.map(e => e.id), events), [], 'events never met');
  assert.deepStrictEqual(miss(['fight', 'elite', 'event', 'shop', 'rest', 'treasure', 'boss'], nodes), [], 'node types never generated');
  assert.ok(relics.size >= 10, 'only ' + relics.size + ' relics ever carried');
});

test('every map is connected: each node is reachable and reaches the boss', () => {
  for (let i = 0; i < 60; i++) {
    const run = XR.newRun('map' + i);
    const m = run.map;
    const seen = new Set(m.nodes.filter(n => n.row === 0).map(n => n.id));
    const stack = [...seen];
    while (stack.length) { const n = m.nodes[stack.pop()]; for (const x of n.next) if (!seen.has(x)) { seen.add(x); stack.push(x); } }
    assert.strictEqual(seen.size, m.nodes.length, 'map' + i + ' has unreachable nodes');
    for (const n of m.nodes) if (n.type !== 'boss') assert.ok(n.next.length > 0, 'map' + i + ' dead end at node ' + n.id);
  }
});

test('overload fizzles the line and the foe still acts', () => {
  const run = XR.newRun('ov');
  XR.act(run, { t: 'go', node: XR.options(run)[0] });
  const f = run.fight;
  // put limit+1 Statics on top so the last one overloads
  const L = f.limit;
  const statics = Array.from({ length: L + 1 }, (_, i) => ({ id: 'static', uid: 9000 + i }));
  f.pile = statics.concat(f.pile); f.revealed = 0;
  const foeHp = f.foe.hp, turn = f.turn;
  for (let i = 0; i < L; i++) XR.act(run, { t: 'draw' });
  assert.strictEqual(run.fight.noise, L);
  const ev = XR.act(run, { t: 'draw' });
  assert.ok(ev.some(e => e.e === 'overload'), 'no overload event');
  assert.strictEqual(run.fight.foe.hp, foeHp, 'overloaded line still dealt damage');
  assert.strictEqual(run.fight.turn, turn + 1, 'turn did not pass to the foe');
  assert.strictEqual(run.stats.overloads, 1);
  assert.strictEqual(run.fight.noise, 0, 'overload should vent noise to 0');
});

test('a save from before the redesign loads and can bank', () => {
  const run = XR.newRun('old-save');
  XR.act(run, { t: 'go', node: XR.options(run)[0] });
  delete run.stats.stances;
  const loaded = XR.load(JSON.stringify(run));
  XR.act(loaded, { t: 'draw' });
  XR.act(loaded, { t: 'bank', stance: 'brace' });
  assert.strictEqual(loaded.stats.stances.brace, 1);
});

test('noise carries into the next turn and cools by 1', () => {
  const run = XR.newRun('carry');
  XR.act(run, { t: 'go', node: XR.options(run)[0] });
  const f = run.fight;
  f.pile = [{ id: 'static', uid: 9100 }, { id: 'static', uid: 9101 }, { id: 'static', uid: 9102 }].concat(f.pile); f.revealed = 0;
  for (let i = 0; i < 3; i++) XR.act(run, { t: 'draw' });
  assert.strictEqual(run.fight.noise, 3);
  const r2 = XR.newRun('carry2');
  XR.act(r2, { t: 'go', node: XR.options(r2)[0] });
  r2.fight.pile = [{ id: 'static', uid: 9200 }, { id: 'static', uid: 9201 }, { id: 'strike', uid: 9202 }].concat(r2.fight.pile); r2.fight.revealed = 0;
  r2.fight.foe.intent = [{ k: 'def', n: 1 }]; // a foe move that adds no noise
  for (let i = 0; i < 3; i++) XR.act(r2, { t: 'draw' });
  XR.act(r2, { t: 'bank', stance: 'strike' });
  assert.strictEqual(r2.fight.noise, 2 - XR.CFG.cool, 'next turn should start at held noise minus cooling');
});

test('Strike and Brace trade damage for block as configured', () => {
  const run = XR.newRun('stance');
  XR.act(run, { t: 'go', node: XR.options(run)[0] });
  run.fight.pile = [{ id: 'strike', uid: 9300 }, { id: 'strike', uid: 9301 }, { id: 'guard', uid: 9302 }, { id: 'guard', uid: 9303 }].concat(run.fight.pile); run.fight.revealed = 0;
  for (let i = 0; i < 4; i++) XR.act(run, { t: 'draw' });
  const v = XR.view(run).fight;
  assert.strictEqual(v.stances.strike.dmg, Math.floor(6 * XR.CFG.strikeDmg));
  assert.strictEqual(v.stances.strike.blk, Math.floor(6 * XR.CFG.strikeBlk));
  assert.strictEqual(v.stances.brace.dmg, Math.floor(6 * XR.CFG.braceDmg));
  assert.strictEqual(v.stances.brace.blk, Math.floor(6 * XR.CFG.braceBlk));
  const hp = run.fight.foe.hp + run.fight.foe.block;
  XR.act(run, { t: 'bank', stance: 'brace' });
  assert.ok(run.screen !== 'fight' || run.fight.foe.hp >= hp - Math.floor(6 * XR.CFG.braceDmg), 'Brace dealt more than its share');
});

test('rule 11: choices matter (real gambles, and thinking bots beat a naive one)', () => {
  const { measure } = require('./decisions.js');
  const r = measure(60, 'standard');
  assert.ok(r.greedy.gamble >= 0.15, 'only ' + Math.round(100 * r.greedy.gamble) + '% of draws are a real gamble');
  const best = Math.max(r.greedy.win, r.cautious.win);
  assert.ok(best - r.naive.win >= 0.12, `skill gap too small: best ${best}, naive ${r.naive.win}`);
  assert.ok(r.cautious.brace > 0.05, 'Brace is almost never the right call');
});

test('bots see only the player view, not the hidden bag order', () => {
  const run = XR.newRun('peek');
  XR.act(run, { t: 'go', node: XR.options(run)[0] });
  const v = XR.view(run);
  assert.strictEqual(v.fight.revealed.length, run.fight.revealed);
  assert.ok(!('pile' in v.fight), 'view leaks the pile order');
  const total = Object.values(v.fight.hidden).reduce((s, n) => s + n, 0);
  assert.strictEqual(total, v.fight.hiddenCount);
});

console.log(failed ? failed + ' test(s) failed' : 'all core tests passed');
process.exit(failed ? 1 : 0);
