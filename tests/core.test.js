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
  for (const seed of ['save-1', 'save-2', 'save-3']) {
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
  // put four Statics on top so the fourth draw overloads (limit 3)
  const statics = [0, 1, 2, 3].map(i => ({ id: 'static', uid: 9000 + i }));
  f.pile = statics.concat(f.pile); f.revealed = 0;
  const foeHp = f.foe.hp, turn = f.turn;
  for (let i = 0; i < 3; i++) XR.act(run, { t: 'draw' });
  assert.strictEqual(run.fight.noise, 3);
  const ev = XR.act(run, { t: 'draw' });
  assert.ok(ev.some(e => e.e === 'overload'), 'no overload event');
  assert.strictEqual(run.fight.foe.hp, foeHp, 'overloaded line still dealt damage');
  assert.strictEqual(run.fight.turn, turn + 1, 'turn did not pass to the foe');
  assert.strictEqual(run.stats.overloads, 1);
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
