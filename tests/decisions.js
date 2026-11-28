// Decision report (RULES.md 11): do the choices in a fight matter?
// Counts draw prompts that are a real gamble (0 < risk < 100%) and banks where
// the two stances differ, and compares a naive bot (draws only when risk is 0,
// always Strikes) with the two thinking bots. Run: node tests/decisions.js [seeds]
'use strict';
const XR = require('../core.js');
function measure(N, mode) {
  const out = {};
  for (const style of ['naive', 'greedy', 'cautious']) {
    let wins = 0, prompts = 0, gamble = 0, banks = 0, stanceMatters = 0, braces = 0, overloads = 0, floors = 0;
    for (let i = 0; i < N; i++) {
      const run = XR.newRun('dec' + i, { mode });
      let steps = 0;
      while (run.screen !== 'dead' && run.screen !== 'victory' && steps++ < 20000) {
        const v = XR.view(run), a = XR.bot(v, style);
        if (!a) break;
        if (v.screen === 'fight') {
          const f = v.fight;
          if (f.canDraw) { prompts++; if (f.risk > 0 && f.risk < 1) gamble++; }
          if (a.t === 'bank') {
            banks++;
            const s = f.stances.strike, b = f.stances.brace;
            const dmgGap = (s.dmg + s.pierce) - (b.dmg + b.pierce), blkGap = b.blk - s.blk;
            if (dmgGap > 0 && blkGap > 0 && f.foe.incoming > f.block + s.blk && s.dmg + s.pierce < f.foe.hp + f.foe.block) stanceMatters++;
            if (a.stance === 'brace') braces++;
          }
        }
        XR.act(run, a);
      }
      if (run.won) wins++;
      overloads += run.stats.overloads; floors += run.floor;
    }
    out[style] = { win: wins / N, gamble: gamble / prompts, stanceMatters: stanceMatters / banks, brace: braces / banks, overloads: overloads / N, floors: floors / N };
  }
  return out;
}
if (require.main === module) {
  const N = +process.argv[2] || 120;
  for (const mode of ['standard', 'story']) {
    const r = measure(N, mode);
    console.log(`\n${mode}, ${N} seeds`);
    for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(8)} win ${(100 * v.win).toFixed(0).padStart(3)}%  gamble prompts ${(100 * v.gamble).toFixed(0).padStart(3)}%  stance matters ${(100 * v.stanceMatters).toFixed(0).padStart(3)}% of banks  braced ${(100 * v.brace).toFixed(0).padStart(3)}%  overloads/run ${v.overloads.toFixed(1)}  floors ${v.floors.toFixed(1)}`);
  }
}
module.exports = { measure };
