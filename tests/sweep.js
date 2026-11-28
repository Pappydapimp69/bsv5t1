// Balance sweep (RULES.md 7): both bots play whole runs over many seeds.
// Run: node tests/sweep.js [seeds=150] [mode=standard|story]
// Reports win rate, where runs die, the lowest HP reached per fight type, and
// how often each foe behaviour fired (a zero means a dead behaviour).
'use strict';
const XR = require('../core.js');
const N = +process.argv[2] || 150;
const mode = process.argv[3] || 'standard';

for (const style of ['greedy', 'cautious']) {
  let wins = 0, stalls = 0, overloads = 0, floors = 0;
  const deaths = {}, lows = {}, intents = {};
  for (let i = 0; i < N; i++) {
    const { run } = XR.playBot('sweep' + i, style, { mode });
    if (run.won) wins++;
    else if (run.screen !== 'dead') stalls++;
    else { const k = 'act ' + run.act + ' ' + run.cause; deaths[k] = (deaths[k] || 0) + 1; }
    overloads += run.stats.overloads; floors += run.floor;
    for (const l of run.stats.lowest) (lows['act ' + l.act + ' ' + l.kind] = lows['act ' + l.act + ' ' + l.kind] || []).push(l);
    for (const [k, v] of Object.entries(run.stats.intents)) intents[k] = (intents[k] || 0) + v;
  }
  console.log(`\n${style} bot, ${mode}, ${N} seeds: win ${(100 * wins / N).toFixed(0)}%, stalls ${stalls}, overloads/run ${(overloads / N).toFixed(1)}, floors/run ${(floors / N).toFixed(1)}`);
  console.log('  deaths: ' + Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
  for (const [k, a] of Object.entries(lows).sort()) {
    const m = a.map(l => l.min / l.max).sort((x, y) => x - y);
    const t = a.reduce((s, l) => s + l.turns, 0) / a.length;
    console.log(`  ${k.padEnd(13)} fights ${String(a.length).padStart(4)}  lowest HP p10 ${(100 * m[Math.floor(m.length * 0.1)]).toFixed(0)}%  median ${(100 * m[Math.floor(m.length / 2)]).toFixed(0)}%  turns ${t.toFixed(1)}`);
  }
  console.log('  foe behaviours fired: ' + Object.entries(intents).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
}
