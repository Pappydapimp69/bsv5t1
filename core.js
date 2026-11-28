/* xrndm core: all game rules, no DOM. Every random draw goes through a
   seeded stream per system (RULES.md 1-3). Loads in the browser (window.XR)
   and in Node (module.exports). */
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- RNG
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }
  function sfc32(s) {
    let a = s[0], b = s[1], c = s[2], d = s[3];
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    s[0] = a >>> 0; s[1] = b >>> 0; s[2] = c >>> 0; s[3] = d >>> 0;
    return (t >>> 0) / 4294967296;
  }
  const STREAMS = ['map', 'enc', 'foe', 'bag', 'loot', 'shop', 'event'];
  function makeStream(seed, name) {
    const s = cyrb128(String(seed) + '/' + name);
    for (let i = 0; i < 12; i++) sfc32(s);
    return s;
  }
  function rnd(run, s) { return sfc32(run.rng[s]); }
  function ri(run, s, n) { return Math.floor(rnd(run, s) * n); }
  function pick(run, s, arr) { return arr[ri(run, s, arr.length)]; }
  function shuffle(run, s, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = ri(run, s, i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function weighted(run, s, items) { // items: [[weight, value]]
    let tot = 0; for (const it of items) tot += it[0];
    let r = rnd(run, s) * tot;
    for (const it of items) { r -= it[0]; if (r < 0) return it[1]; }
    return items[items.length - 1][1];
  }
  function sampleN(run, s, arr, n) {
    const a = arr.slice(); shuffle(run, s, a); return a.slice(0, n);
  }

  // ------------------------------------------------------------- TOKENS
  // rar: 0 common, 1 uncommon, 2 rare. curse tokens never offered.
  const T = {
    strike:    { name: 'Strike',    dmg: 3, up: { dmg: 2 }, desc: 'Deal {dmg}.' },
    guard:     { name: 'Guard',     blk: 3, up: { blk: 2 }, desc: 'Gain {blk} block.' },
    spark:     { name: 'Spark',     bits: 1, up: { bits: 2 }, desc: 'Gain {bits} bits.' },
    static:    { name: 'Static',    noise: 1, curse: true, desc: '+1 noise.' },
    twin:      { name: 'Twin',      dmg: 2, hits: 2, up: { dmg: 1 }, rar: 0, desc: 'Deal {dmg} twice.' },
    ground:    { name: 'Ground',    noise: -1, blk: 2, up: { blk: 2 }, rar: 0, desc: '-1 noise. Gain {blk} block.' },
    cache:     { name: 'Cache',     bits: 4, up: { bits: 3 }, rar: 0, desc: 'Gain {bits} bits.' },
    heavy:     { name: 'Heavy',     dmg: 8, noise: 1, up: { dmg: 3 }, rar: 1, desc: 'Deal {dmg}. +1 noise.' },
    bulwark:   { name: 'Bulwark',   blk: 9, noise: 1, up: { blk: 3 }, rar: 1, desc: 'Gain {blk} block. +1 noise.' },
    pierce:    { name: 'Pierce',    dmg: 5, pierce: true, up: { dmg: 2 }, rar: 1, desc: 'Deal {dmg}, ignoring block.' },
    leech:     { name: 'Leech',     dmg: 3, heal: 2, up: { dmg: 1, heal: 1 }, rar: 1, desc: 'Deal {dmg}. Heal {heal}.' },
    seer:      { name: 'Seer',      special: 'seer', n: 2, up: { n: 1 }, rar: 1, desc: 'Reveal {n} more tokens.' },
    ward:      { name: 'Ward',      blk: 2, special: 'ward', per: 3, up: { per: 2 }, rar: 1, desc: 'Gain 2 block, +{per} per noisy token this turn.' },
    calm:      { name: 'Calm',      noise: -2, blk: 3, up: { blk: 3 }, rar: 1, desc: '-2 noise. Gain {blk} block.' },
    bash:      { name: 'Bash',      special: 'bash', mul: 1, up: { mul: 1 }, rar: 1, desc: 'Deal damage equal to {mul}x the block before it.' },
    prism:     { name: 'Prism',     special: 'prism', rar: 2, desc: 'Double the next token.' },
    fuse:      { name: 'Fuse',      special: 'fuse', per: 4, up: { per: 2 }, rar: 2, desc: 'Deal {per} per noise you hold.' },
    echo:      { name: 'Echo',      special: 'echo', rar: 2, desc: 'Repeat the token before it.' },
    crescendo: { name: 'Crescendo', special: 'cresc', per: 1, up: { per: 1 }, rar: 2, desc: 'Deal {per} per token drawn this turn.' },
    glitch:    { name: 'Glitch',    noise: 1, self: 1, curse: true, desc: '+1 noise. Lose 1 HP.' },
    hiss:      { name: 'Hiss',      noise: 2, curse: true, desc: '+2 noise.' },
    howl:      { name: 'Howl',      noise: 3, curse: true, desc: '+3 noise.' },
    blank:     { name: 'Blank',     curse: true, desc: 'Does nothing.' },
  };
  const REWARD_POOL = Object.keys(T).filter(k => T[k].rar !== undefined);
  const PRICE = [28, 48, 75];

  function tv(inst, key) {
    const d = T[inst.id];
    return (d[key] || 0) + (inst.up && d.up ? (d.up[key] || 0) : 0);
  }
  function tokenText(id, up) {
    const d = T[id];
    return d.desc.replace(/\{(\w+)\}/g, (_, k) => String(tv({ id, up }, k))).replace(/\b1 bits\b/, '1 bit');
  }

  // ------------------------------------------------------------- RELICS
  const R = {
    lens:      { name: 'Cracked Lens',  rar: 0, desc: '+1 sight on the first turn of each fight.' },
    rod:       { name: 'Grounding Rod', rar: 1, desc: 'The first noisy token each turn adds no noise.' },
    capacitor: { name: 'Capacitor',     rar: 0, desc: 'When you overload, half your damage still lands.' },
    battery:   { name: 'Battery',       rar: 0, desc: 'Start each fight with 6 block.' },
    siphon:    { name: 'Siphon',        rar: 0, desc: 'Heal 1 when you bank 4 or more tokens.' },
    metronome: { name: 'Metronome',     rar: 1, desc: 'Every 4th token you bank in a fight deals 5 extra.' },
    abacus:    { name: 'Abacus',        rar: 0, desc: 'Gain 8 extra bits after each fight.' },
    dampener:  { name: 'Dampener',      rar: 1, desc: '+1 noise limit.' },
    thorn:     { name: 'Thorn Coil',    rar: 0, desc: 'When block stops a whole hit, deal 3 back.' },
    coolant:   { name: 'Coolant',       rar: 0, desc: 'After you overload, start your next turn with 8 block.' },
    magnet:    { name: 'Magnet',        rar: 0, desc: 'Sparks and Caches give 2 extra bits.' },
    heart:     { name: 'Spare Heart',   rar: 0, desc: '+12 max HP.' },
    scrubber:  { name: 'Scrubber',      rar: 1, desc: 'The first curse you draw each fight is destroyed.' },
    loupe:     { name: 'Loupe',         rar: 2, desc: '+1 sight.' },
    keel:      { name: 'Keel',          rar: 2, desc: 'Overloading clears your line but does not end your turn.' },
    sink:      { name: 'Heat Sink',     rar: 1, desc: 'Noise cools 1 more at the start of each turn.' },
  };
  // keel: on overload the staged line fizzles but you may keep drawing; noise resets to 0.
  const RELIC_POOL = Object.keys(R).filter(k => R[k].rar < 2);
  const BOSS_RELICS = ['loupe', 'keel', 'dampener', 'rod', 'metronome', 'scrubber'];

  // --------------------------------------------------------------- FOES
  // Each ai returns an intent: a list of parts. It may read foe.turn and the
  // fight, and rolls only on the 'foe' stream.
  const A = (n, hits) => ({ k: 'atk', n: Math.max(1, Math.round(n * CFG.atk)), hits: hits || 1 });
  const D = n => ({ k: 'def', n });
  const F = {
    // ---- act 1: the Static Fields
    fuzzling: { name: 'Fuzzling', act: 1, hp: [15, 19], art: 'fuzz',
      ai: (run, f) => weighted(run, 'foe', [[5, [A(6)]], [3, [A(3), { k: 'curse', tok: 'glitch', n: 1 }]], [2, [D(5), A(2)]]]) },
    crackle: { name: 'Crackle', act: 1, hp: [20, 24], art: 'crackle',
      ai: (run, f) => f.turn % 3 === 0 ? [A(11)] : weighted(run, 'foe', [[3, [A(6)]], [2, [D(7)]]]) },
    moth: { name: 'Hum Moth', act: 1, hp: [13, 16], art: 'moth',
      ai: (run, f) => weighted(run, 'foe', [[4, [A(3, 2)]], [2, [{ k: 'noise', n: 1 }, A(2)]], [1, [{ k: 'hush' }, A(4)]]]) },
    tick: { name: 'Tick-Tock', act: 1, hp: [18, 22], art: 'tick',
      ai: (run, f) => [[A(4)], [A(5)], [A(6)], [A(14)]][(f.turn - 1) % 4] },
    wire: { name: 'Snarl of Wire', act: 1, elite: true, hp: [44, 48], art: 'wire',
      ai: (run, f) => f.turn === 1 ? [{ k: 'buff', n: 2 }, D(6)] : weighted(run, 'foe', [[3, [A(9)]], [3, [A(4, 2)]], [1, [{ k: 'buff', n: 2 }, { k: 'curse', tok: 'glitch', n: 1 }]]]) },
    lamp: { name: 'Lamplighter', act: 1, elite: true, hp: [40, 44], art: 'lamp',
      ai: (run, f) => f.turn % 2 ? [{ k: 'hush' }, A(7)] : [D(8), { k: 'noise', n: 1 }] },
    shuffler: { name: 'The Shuffler', act: 1, boss: true, hp: [92, 92], art: 'shuffler',
      ai: (run, f) => {
        const c = f.turn % 4;
        if (c === 1) return [{ k: 'shuffle' }, A(6)];
        if (c === 2) return [A(3, 3)];
        if (c === 3) return [{ k: 'curse', tok: 'hiss', n: 1 }, D(8)];
        return [A(13)];
      } },
    // ---- act 2: the Echo Halls
    echoling: { name: 'Echoling', act: 2, hp: [30, 34], art: 'echo',
      ai: (run, f) => weighted(run, 'foe', [[3, [{ k: 'mimic' }]], [2, [A(7)]], [1, [D(9)]]]) },
    bell: { name: 'Leech Bell', act: 2, hp: [28, 32], art: 'bell',
      ai: (run, f) => weighted(run, 'foe', [[3, [{ k: 'drain', n: 6 }, A(5)]], [2, [A(9)]], [1, [{ k: 'heal', n: 6 }, D(5)]]]) },
    wisp: { name: 'Twin Wisp', act: 2, hp: [26, 30], art: 'wisp',
      ai: (run, f) => f.turn % 2 ? [A(4, 3)] : [{ k: 'noise', n: 1 }, A(6)] },
    sentinel: { name: 'Sentinel', act: 2, hp: [34, 38], art: 'sentinel',
      ai: (run, f) => [[D(10), A(5)], [A(10)], [A(17)]][(f.turn - 1) % 3] },
    choir: { name: 'Choir of Glass', act: 2, elite: true, hp: [74, 78], art: 'choir',
      ai: (run, f) => f.turn % 3 === 1 ? [{ k: 'curse', tok: 'hiss', n: 1 }, { k: 'curse', tok: 'glitch', n: 1 }] : weighted(run, 'foe', [[3, [A(14)]], [2, [A(5, 3)]], [1, [{ k: 'buff', n: 3 }]]]) },
    warden: { name: 'Hollow Warden', act: 2, elite: true, hp: [80, 84], art: 'warden',
      ai: (run, f) => [[D(14), { k: 'hush' }], [A(16)], [A(8), { k: 'noise', n: 2 }]][(f.turn - 1) % 3] },
    queen: { name: 'The Echo Queen', act: 2, boss: true, hp: [160, 160], art: 'queen',
      ai: (run, f) => {
        const c = f.turn % 4;
        if (c === 1) return [{ k: 'mirror' }, A(8)];
        if (c === 2) return [A(5, 3)];
        if (c === 3) return [{ k: 'mimic' }, { k: 'curse', tok: 'hiss', n: 1 }];
        return [{ k: 'buff', n: 3 }, A(10)];
      } },
    // ---- act 3: the Core
    hound: { name: 'Null Hound', act: 3, hp: [42, 46], art: 'hound',
      ai: (run, f) => weighted(run, 'foe', [[3, [A(18)]], [3, [A(9, 2)]], [1, [{ k: 'buff', n: 3 }, A(7)]]]) },
    coil: { name: 'Entropy Coil', act: 3, hp: [46, 50], art: 'coil',
      ai: (run, f) => f.turn % 2 ? [{ k: 'noise', n: 2 }, A(13)] : [{ k: 'buff', n: 3 }, D(14)] },
    golem: { name: 'Static Golem', act: 3, hp: [56, 60], art: 'golem',
      ai: (run, f) => [[D(18)], [A(26)], [A(11), { k: 'curse', tok: 'static', n: 2 }]][(f.turn - 1) % 3] },
    blot: { name: 'Blot', act: 3, hp: [40, 44], art: 'blot',
      ai: (run, f) => weighted(run, 'foe', [[2, [{ k: 'curse', tok: 'blank', n: 2 }, A(11)]], [3, [A(7, 3)]], [2, [{ k: 'drain', n: 10 }, A(12)]]]) },
    eater: { name: 'Seed Eater', act: 3, elite: true, hp: [112, 118], art: 'eater',
      ai: (run, f) => [[{ k: 'hush' }, A(18)], [A(9, 3)], [{ k: 'heal', n: 16 }, D(16)], [A(32)]][(f.turn - 1) % 4] },
    twins: { name: 'Odd & Even', act: 3, elite: true, hp: [104, 108], art: 'twins',
      ai: (run, f) => f.turn % 2 ? [A(11, 2), { k: 'noise', n: 1 }] : [{ k: 'mirror' }, { k: 'buff', n: 2 }] },
    rndm: { name: 'RNDM', act: 3, boss: true, hp: [300, 300], art: 'rndm',
      ai: (run, f) => {
        const p2 = f.hp <= f.maxHp / 2;
        if (p2 && !f.phase2) return [{ k: 'unseed' }, D(30)];
        const opts = [[3, [A(24)]], [3, [A(9, 3)]], [2, [{ k: 'curse', tok: 'hiss', n: 1 }, A(14)]], [2, [{ k: 'noise', n: 2 }, A(15)]], [1, [{ k: 'buff', n: 3 }, D(16)]]];
        if (p2) opts.push([3, [A(12, 3)]], [2, [{ k: 'shuffle' }, A(20)]]);
        return weighted(run, 'foe', opts);
      } },
  };
  // Tuning knobs, exported so sweeps can try variants without editing code.
  // Chosen by tests/decisions.js: real gambles on about 20% of draws, and
  // bots that weigh odds and stance win about twice as often as a naive one.
  const CFG = { start: ['static', 'static', 'hiss', 'howl'], limit: 4, cool: 1,
    strikeDmg: 1.4, strikeBlk: 0.6, braceDmg: 0.6, braceBlk: 1.4, hp: 0.55, atk: 0.65 };
  const HP_MULT = { normal: 2, elite: 1.5, boss: 1.3 };
  const foesFor = (act, kind) => Object.keys(F).filter(k => {
    const f = F[k];
    if (f.act !== act) return false;
    if (kind === 'boss') return !!f.boss;
    if (kind === 'elite') return !!f.elite;
    return !f.boss && !f.elite;
  });
  function intentText(intent, foe) {
    return intent.map(p => {
      switch (p.k) {
        case 'atk': return 'Attack ' + (p.n + (foe ? foe.str : 0)) + (p.hits > 1 ? ' x' + p.hits : '');
        case 'def': return 'Block ' + p.n;
        case 'buff': return 'Strength +' + p.n;
        case 'curse': return 'Add ' + p.n + ' ' + T[p.tok].name;
        case 'drain': return 'Steal ' + p.n + ' bits';
        case 'hush': return 'Sight -1 next turn';
        case 'noise': return '+' + p.n + ' noise next turn';
        case 'heal': return 'Heal ' + p.n;
        case 'shuffle': return 'Shuffle your bag, sight -1';
        case 'mimic': return 'Echo half your last hit';
        case 'mirror': return 'Copy your last block';
        case 'unseed': return 'Unseed: sight -1 for the fight';
        default: return p.k;
      }
    }).join(' + ');
  }
  function mimicDmg(f) { return Math.max(5, Math.floor(f.lastDmg / 2)); }
  function intentDamage(intent, run) {
    const f = run.fight; let t = 0;
    for (const p of intent) {
      if (p.k === 'atk') t += (p.n + f.foe.str) * p.hits;
      if (p.k === 'mimic') t += mimicDmg(f) + f.foe.str;
    }
    return t;
  }

  // ------------------------------------------------------------- EVENTS
  const EV = [
    { id: 'oracle', acts: [1, 2, 3], title: 'The Coin-Fed Oracle', art: 'oracle',
      text: 'A machine with a cracked glass face hums by the path. A slot reads FEED ME. Behind the glass, gears turn toward something you cannot quite see.',
      opts: [
        { label: 'Feed it 35 bits (gain a relic)', req: r => r.bits >= 35, fx: r => { r.bits -= 35; const id = gainRandomRelic(r, 'event'); return 'The glass clears. Something drops into the tray: ' + R[id].name + '.'; } },
        { label: 'Kick it (gain 12 bits, lose 5 HP)', fx: r => { r.bits += 12; hurt(r, 5, 'a kicked oracle'); return 'Coins spill out, and so does a spark that bites your ankle.'; } },
        { label: 'Leave', fx: r => 'You leave it humming.' }] },
    { id: 'bag', acts: [1, 2], title: 'A Bag Left Open', art: 'bag',
      text: 'Someone dropped a bag of chances here and never came back for it. Most of it has leaked out. What is left still twitches.',
      opts: [
        { label: 'Take two tokens and a Static', fx: r => { const a = sampleN(r, 'event', REWARD_POOL, 2); a.forEach(id => addToken(r, id)); addToken(r, 'static'); return 'You take ' + a.map(i => T[i].name).join(' and ') + '. A Static clings to them.'; } },
        { label: 'Leave it', fx: r => 'Some chances are better left.' }] },
    { id: 'pool', acts: [1, 2, 3], title: 'The Quiet Pool', art: 'pool',
      text: 'Water so still it shows no reflection at all. The static cannot reach it here.',
      opts: [
        { label: 'Rest by it (heal 14)', fx: r => { heal(r, 14); return 'The quiet seeps into you.'; } },
        { label: 'Drink deep (+6 max HP, add a Hiss)', fx: r => { r.maxHp += 6; r.hp += 6; addToken(r, 'hiss'); return 'You feel stronger, and you can hear the water hissing in your bag.'; } }] },
    { id: 'storm', acts: [1, 2, 3], title: 'Static Storm', art: 'storm',
      text: 'The sky crackles white. A storm of loose odds rolls across the fields, and the air tastes of copper.',
      opts: [
        { label: 'Shelter (lose 7 HP)', fx: r => { hurt(r, 7, 'a static storm'); return 'You wait it out under a rock. It still finds you.'; } },
        { label: 'Run through (gain 40 bits, add 2 Static)', fx: r => { r.bits += 40; addToken(r, 'static'); addToken(r, 'static'); return 'You come out the other side rich and buzzing.'; } }] },
    { id: 'tuner', acts: [1, 2, 3], title: 'The Tuner', art: 'tuner',
      text: 'An old woman with a fork of bone taps each of your tokens in turn and listens. "These are out of tune," she says. "I can fix two. It will sting."',
      opts: [
        { label: 'Let her (upgrade 2 tokens, lose 6 HP)', fx: r => { const n = upgradeRandom(r, 2); hurt(r, 6, 'a tuning fork'); return n ? 'Two of your tokens ring true now.' : 'She finds nothing she can improve.'; } },
        { label: 'Decline', fx: r => '"Suit yourself," she says, and goes back to listening to the wind.' }] },
    { id: 'mirror', acts: [1, 2, 3], title: 'Mirror Shard', art: 'mirror',
      text: 'A shard of mirror stands upright in the dirt. When you hold a token up to it, the reflection looks solid.',
      opts: [
        { label: 'Copy a random token', fx: r => { const pool = r.deck.filter(t => !T[t.id].curse); if (!pool.length) return 'Nothing worth copying.'; const t = pick(r, 'event', pool); addToken(r, t.id, t.up); return 'The shard gives you a second ' + T[t.id].name + '.'; } },
        { label: 'Smash it (remove a Static)', req: r => r.deck.some(t => t.id === 'static'), fx: r => { removeFirst(r, 'static'); return 'The shard breaks. One Static goes quiet.'; } }] },
    { id: 'ghost', acts: [1, 2, 3], title: "The Gambler's Ghost", art: 'ghost',
      text: 'A ghost in a crumpled hat shuffles three cups. "One in three," it says, and it means it. "Twenty bits gets you sixty."',
      opts: [
        { label: 'Bet 20 bits (1 in 3 to win 60)', req: r => r.bits >= 20, fx: r => { r.bits -= 20; if (ri(r, 'event', 3) === 0) { r.bits += 60; return 'The cup lifts on a bright coin. The ghost tips its hat.'; } return 'Empty. "That\'s what one in three means," the ghost says kindly.'; } },
        { label: 'Ask how it died', fx: r => '"I always knew the odds," it says. "I just never believed them."' }] },
    { id: 'oma', acts: [1, 2, 3], title: 'Oma, a Lost Reader', art: 'oma',
      text: 'A Reader like you sits on a broken signpost. Her eyes are clouded over. "I used to see three moments ahead," Oma says. "Now I see none. Spare a little?"',
      opts: [
        { label: 'Give 15 bits (gain a Seer token)', req: r => r.bits >= 15, fx: r => { r.bits -= 15; addToken(r, 'seer'); return 'She presses a warm token into your hand. "Look further than I did."'; } },
        { label: 'Sit with her (heal 6)', fx: r => { heal(r, 6); return 'You share the quiet for a while. She tells you the Core hums in a minor key.'; } }] },
    { id: 'workshop', acts: [2, 3], title: 'Abandoned Workshop', art: 'workshop',
      text: 'Benches covered in half-built charms. One of them still works. The others leak static from every seam.',
      opts: [
        { label: 'Take the working one (relic, add 2 Glitch)', fx: r => { const id = gainRandomRelic(r, 'event'); addToken(r, 'glitch'); addToken(r, 'glitch'); return 'You take the ' + R[id].name + '. Two Glitches follow you out.'; } },
        { label: 'Leave', fx: r => 'You close the door softly.' }] },
    { id: 'hum', acts: [3], title: 'The Hum of the Core', art: 'hum',
      text: 'Down here the hum is a chord, and if you hold still you can sing along with it.',
      opts: [
        { label: 'Sing (+1 noise limit, lose 10 max HP)', fx: r => { r.noiseLimit += 1; r.maxHp = Math.max(10, r.maxHp - 10); r.hp = Math.min(r.hp, r.maxHp); return 'The noise stops frightening you. Some of you stays in the chord.'; } },
        { label: 'Cover your ears (heal 8)', fx: r => { heal(r, 8); return 'You walk on, humming despite yourself.'; } }] },
    { id: 'archive', acts: [2, 3], title: "Vell's Cache", art: 'archive',
      text: 'A box with the Archivist\'s mark on it. Inside, a note: "Ix, if you found this, you are further than anyone. Take what you need. Take only one."',
      opts: [
        { label: 'Take the tools (upgrade 3 tokens)', fx: r => { upgradeRandom(r, 3); return 'Three of your tokens hum a little brighter.'; } },
        { label: 'Take the bits (gain 50)', fx: r => { r.bits += 50; return 'Vell always did keep spare change.'; } },
        { label: 'Take the bandages (heal to full)', fx: r => { r.hp = r.maxHp; return 'You feel whole again.'; } }] },
  ];

  // --------------------------------------------------------------- GOALS
  const GOALS = [
    { id: 'first', name: 'First Reading', desc: 'Win your first fight.', test: r => r.stats.fights >= 1 },
    { id: 'act2', name: 'Into the Echo', desc: 'Reach the Echo Halls.', test: r => r.act >= 2 },
    { id: 'act3', name: 'Down to the Core', desc: 'Reach the Core.', test: r => r.act >= 3 },
    { id: 'win', name: 'Re-Seeded', desc: 'Defeat RNDM.', test: r => r.won },
    { id: 'bank8', name: 'Long Line', desc: 'Bank 8 tokens in one turn.', test: r => r.stats.maxBank >= 8 },
    { id: 'clean', name: 'Clean Signal', desc: 'Defeat a boss without overloading in that fight.', test: r => r.stats.cleanBoss },
    { id: 'rich', name: 'Hoarder', desc: 'Hold 200 bits at once.', test: r => r.stats.maxBits >= 200 },
    { id: 'relics', name: 'Collector', desc: 'Carry 6 relics.', test: r => r.relics.length >= 6 },
    { id: 'blind', name: 'Leap of Faith', desc: 'Bank a turn with 5 blind draws.', test: r => r.stats.maxBlind >= 5 },
    { id: 'lean', name: 'Lean Bag', desc: 'Defeat a boss with 12 or fewer tokens.', test: r => r.stats.leanBoss },
  ];

  // ------------------------------------------------------------ HELPERS
  function addToken(run, id, up) {
    const inst = { id, uid: run.nextUid++ };
    if (up) inst.up = true;
    run.deck.push(inst);
    return inst;
  }
  function removeUid(run, uid) { run.deck = run.deck.filter(t => t.uid !== uid); }
  function removeFirst(run, id) { const t = run.deck.find(x => x.id === id); if (t) removeUid(run, t.uid); return !!t; }
  function heal(run, n) { run.hp = Math.min(run.maxHp, run.hp + n); }
  function hurt(run, n, cause) {
    run.hp -= n;
    if (run.hp <= 0) { run.hp = 0; die(run, cause); }
  }
  function die(run, cause) { run.screen = 'dead'; run.cause = cause; run.fight = run.fight || null; }
  function has(run, id) { return run.relics.indexOf(id) >= 0; }
  function addRelic(run, id) {
    if (has(run, id)) return;
    run.relics.push(id);
    if (id === 'heart') { run.maxHp += 12; run.hp += 12; }
    if (id === 'dampener') run.noiseLimit += 1;
    if (id === 'loupe') run.sight += 1;
  }
  function gainRandomRelic(run, stream) {
    let pool = RELIC_POOL.filter(id => !has(run, id));
    if (!pool.length) pool = ['heart'];
    const id = pick(run, stream, pool);
    if (has(run, id)) { run.maxHp += 5; run.hp += 5; } else addRelic(run, id);
    return id;
  }
  function upgradeRandom(run, n) {
    const pool = run.deck.filter(t => !t.up && T[t.id].up);
    shuffle(run, 'event', pool);
    pool.slice(0, n).forEach(t => { t.up = true; });
    return Math.min(n, pool.length);
  }

  // -------------------------------------------------------------- MAP
  const ROWS = 8, COLS = 4;
  function genMap(run) {
    const nodes = [];
    const at = {};
    const node = (r, c) => {
      const k = r + ',' + c;
      if (!at[k]) { at[k] = { id: nodes.length, row: r, col: c, type: null, next: [] }; nodes.push(at[k]); }
      return at[k];
    };
    const edges = new Set();
    const starts = [0, 1, 2, 3, ri(run, 'map', COLS)];
    shuffle(run, 'map', starts);
    for (let p = 0; p < 5; p++) {
      let c = starts[p];
      for (let r = 0; r < ROWS - 1; r++) {
        const a = node(r, c);
        let opts = [c - 1, c, c + 1].filter(x => x >= 0 && x < COLS);
        // no crossing: an edge r,c -> r+1,c+1 crosses r,c+1 -> r+1,c
        opts = opts.filter(nc => !(nc !== c && edges.has(r + ':' + nc + '>' + c)));
        const nc = pick(run, 'map', opts);
        edges.add(r + ':' + c + '>' + nc);
        const b = node(r + 1, nc);
        if (a.next.indexOf(b.id) < 0) a.next.push(b.id);
        c = nc;
      }
    }
    const boss = { id: nodes.length, row: ROWS, col: 1.5, type: 'boss', next: [] };
    nodes.push(boss);
    for (const n of nodes) {
      if (n === boss) continue;
      if (n.row === ROWS - 1) n.next.push(boss.id);
      if (n.row === 0) n.type = 'fight';
      else if (n.row === ROWS - 1) n.type = 'rest';
      else if (n.row === 4) n.type = 'treasure';
      else n.type = weighted(run, 'map', [
        [46, 'fight'], [22, 'event'], [n.row >= 2 ? 13 : 0, 'elite'], [n.row >= 2 ? 11 : 0, 'shop'], [n.row >= 3 ? 8 : 0, 'rest']]);
    }
    // guarantee at least one shop per act
    if (!nodes.some(n => n.type === 'shop')) {
      const cand = nodes.filter(n => n.type === 'fight' && n.row >= 2 && n.row <= 6);
      if (cand.length) pick(run, 'map', cand).type = 'shop';
    }
    for (const n of nodes) n.next.sort((x, y) => nodes[x].col - nodes[y].col);
    return { nodes, boss: boss.id };
  }
  function options(run) {
    const m = run.map;
    if (run.node === null) return m.nodes.filter(n => n.row === 0).map(n => n.id);
    return m.nodes[run.node].next.slice();
  }

  // ------------------------------------------------------------- RUN
  function newRun(seed, opts) {
    opts = opts || {};
    const run = {
      v: 1, seed: String(seed), mode: opts.mode === 'story' ? 'story' : 'standard',
      rng: {}, act: 1, floor: 0, hp: 60, maxHp: 60, bits: 20, sight: 2, noiseLimit: CFG.limit,
      deck: [], relics: [], nextUid: 1, map: null, node: null, visited: [], screen: 'map',
      fight: null, reward: null, shop: null, event: null, rest: null, removeCost: 50,
      stats: { fights: 0, elites: 0, bosses: 0, overloads: 0, turns: 0, maxBank: 0, maxBlind: 0, maxBits: 20,
        bitsEarned: 0, lowest: [], intents: {}, stances: { strike: 0, brace: 0 }, cleanBoss: false, leanBoss: false, draws: 0, blindDraws: 0 },
      won: false, cause: null, lastFoe: null, log: [],
    };
    if (run.mode === 'story') { run.hp = run.maxHp = 85; run.bits = 40; }
    for (const s of STREAMS) run.rng[s] = makeStream(run.seed, s);
    for (let i = 0; i < 5; i++) addToken(run, 'strike');
    for (let i = 0; i < 4; i++) addToken(run, 'guard');
    for (let i = 0; i < 2; i++) addToken(run, 'spark');
    for (const id of CFG.start) addToken(run, id);
    addRelic(run, 'lens');
    run.map = genMap(run);
    return run;
  }

  // ------------------------------------------------------------ FIGHT
  function startFight(run, kind) {
    const ids = foesFor(run.act, kind);
    let id;
    if (kind === 'boss') id = ids[0];
    else { const pool = ids.filter(x => x !== run.lastFoe); id = pick(run, 'enc', pool.length ? pool : ids); }
    run.lastFoe = id;
    const fd = F[id];
    const hp = Math.round((fd.hp[0] + ri(run, 'enc', fd.hp[1] - fd.hp[0] + 1)) * HP_MULT[kind] * CFG.hp * (run.mode === 'story' ? 0.8 : 1));
    const pile = run.deck.map(t => Object.assign({}, t));
    shuffle(run, 'bag', pile);
    run.fight = {
      kind, foe: { id, name: fd.name, hp, maxHp: hp, block: 0, str: kind === 'normal' ? run.act + 1 : kind === 'elite' ? run.act - 1 : 0, turn: 0, intent: null, phase2: false },
      pile, discard: [], staged: [], noise: 0, limit: run.noiseLimit, revealed: 0, block: has(run, 'battery') ? 6 : 0,
      turn: 0, prism: false, rodUsed: false, scrubUsed: false, hushNext: 0, noiseNext: 0, sightMod: 0,
      lastDmg: 0, lastBlk: 0, banked: 0, overloads: 0, minHp: run.hp, overloadedLast: false, blindThisTurn: 0, over: false,
    };
    run.screen = 'fight';
    const ev = [{ e: 'fight', foe: id }];
    startTurn(run, ev, true);
    return ev;
  }
  function ensurePile(run, need) {
    const f = run.fight;
    if (f.pile.length < need && f.discard.length) {
      shuffle(run, 'bag', f.discard);
      f.pile = f.pile.concat(f.discard);
      f.discard = [];
      return true;
    }
    return false;
  }
  function coolOf(run) { return CFG.cool + (has(run, 'sink') ? 1 : 0); }
  function startTurn(run, ev, first) {
    const f = run.fight;
    f.turn++; f.foe.turn++;
    run.stats.turns++;
    f.block = first ? f.block : 0;
    if (has(run, 'coolant') && f.overloadedLast) { f.block += 8; ev.push({ e: 'relic', id: 'coolant' }); }
    f.overloadedLast = false;
    // noise carries over between turns and cools; foes can add more
    f.noise = first ? 0 : Math.min(f.limit, Math.max(0, f.noise - coolOf(run)) + f.noiseNext); f.noiseNext = 0;
    f.staged = []; f.prism = false; f.rodUsed = false; f.blindThisTurn = 0;
    let sight = run.sight + f.sightMod - f.hushNext + (first && has(run, 'lens') ? 1 : 0);
    f.hushNext = 0;
    f.revealed = Math.max(0, sight);
    if (ensurePile(run, f.revealed)) ev.push({ e: 'reshuffle' });
    f.revealed = Math.min(f.revealed, f.pile.length);
    if (f.turn > 18) f.foe.str += 2; // enrage: no fight runs forever (RULES 6)
    f.foe.intent = F[f.foe.id].ai(run, f.foe);
    ev.push({ e: 'turn', turn: f.turn });
  }
  function hiddenPool(f) {
    if (f.pile.length > f.revealed) return f.pile.slice(f.revealed);
    return f.discard.slice();
  }
  function noiseOf(run, inst) {
    const f = run.fight;
    let n = tv(inst, 'noise');
    if (n > 0 && has(run, 'rod') && !f.rodUsed) n = 0;
    if (T[inst.id].curse && has(run, 'scrubber') && !f.scrubUsed) n = 0;
    return n;
  }
  function risk(run) {
    const f = run.fight;
    if (f.revealed > 0) {
      const n = noiseOf(run, f.pile[0]);
      return f.noise + n > f.limit ? 1 : 0;
    }
    const pool = hiddenPool(f);
    if (!pool.length) return 0;
    let bad = 0;
    for (const t of pool) if (f.noise + noiseOf(run, t) > f.limit) bad++;
    return bad / pool.length;
  }
  function canDraw(run) {
    const f = run.fight;
    return run.screen === 'fight' && (f.pile.length > 0 || f.discard.length > 0);
  }
  function draw(run) {
    const f = run.fight;
    const ev = [];
    if (!canDraw(run)) return ev;
    if (!f.pile.length) { ensurePile(run, 1); ev.push({ e: 'reshuffle' }); }
    const blind = f.revealed === 0;
    const inst = f.pile.shift();
    f.revealed = Math.max(0, f.revealed - 1);
    run.stats.draws++;
    if (blind) { run.stats.blindDraws++; f.blindThisTurn++; }
    const d = T[inst.id];
    const entry = { uid: inst.uid, id: inst.id, up: !!inst.up, mult: 1, tmp: !!inst.tmp };
    if (f.prism && d.special !== 'prism' && !d.curse) { entry.mult = 2; f.prism = false; }
    if (d.special === 'echo') {
      for (let i = f.staged.length - 1; i >= 0; i--) {
        const p = f.staged[i];
        if (p.id !== 'echo' && !T[p.id].curse && !p.dead) { entry.echo = { id: p.id, up: p.up }; entry.mult = Math.max(entry.mult, p.mult); break; }
      }
    }
    if (d.special === 'prism') f.prism = true;
    let n = tv(inst, 'noise');
    if (n > 0 && has(run, 'rod') && !f.rodUsed) { f.rodUsed = true; n = 0; ev.push({ e: 'relic', id: 'rod' }); }
    if (d.curse && has(run, 'scrubber') && !f.scrubUsed) {
      f.scrubUsed = true; n = 0; entry.dead = true;
      if (!inst.tmp) removeUid(run, inst.uid);
      ev.push({ e: 'relic', id: 'scrubber' });
    }
    f.noise = Math.max(0, f.noise + n);
    entry.inst = inst;
    f.staged.push(entry);
    ev.push({ e: 'draw', id: inst.id, blind, noise: f.noise });
    if (d.special === 'seer') {
      f.revealed += tv(inst, 'n');
      if (ensurePile(run, f.revealed)) ev.push({ e: 'reshuffle' });
      f.revealed = Math.min(f.revealed, f.pile.length);
      ev.push({ e: 'seer' });
    }
    if (f.noise > f.limit) return ev.concat(overload(run));
    return ev;
  }
  function resolve(run, staged) {
    const f = run.fight;
    const acc = { dmg: 0, pierce: 0, blk: 0, bits: 0, heal: 0, self: 0, hits: [] };
    let banked = f.banked;
    staged.forEach((e, i) => {
      if (e.dead) return;
      const src = e.echo ? e.echo : e;
      const inst = { id: src.id, up: src.up };
      const d = T[src.id];
      const m = e.mult || 1;
      const hits = d.hits || 1;
      let dmg = tv(inst, 'dmg') * hits * m;
      let blk = tv(inst, 'blk') * m;
      let bits = tv(inst, 'bits') * m;
      if (bits && has(run, 'magnet')) bits += 2;
      if (d.special === 'fuse') dmg += tv(inst, 'per') * f.noise * m;
      if (d.special === 'cresc') dmg += tv(inst, 'per') * staged.length * m;
      if (d.special === 'bash') dmg += acc.blk * tv(inst, 'mul') * m;
      if (d.special === 'ward') blk += tv(inst, 'per') * staged.filter(x => tv(x, 'noise') > 0).length * m;
      banked++;
      if (has(run, 'metronome') && banked % 4 === 0) dmg += 5;
      if (d.pierce) acc.pierce += dmg; else acc.dmg += dmg;
      if (dmg) acc.hits.push(dmg);
      acc.blk += blk; acc.bits += bits;
      acc.heal += tv(inst, 'heal') * m;
      acc.self += e.echo ? 0 : tv(e, 'self');
    });
    return acc;
  }
  function preview(run) { return resolve(run, run.fight.staged); }
  function dealToFoe(run, dmg, pierce, ev) {
    const foe = run.fight.foe;
    let left = dmg;
    if (foe.block > 0) { const a = Math.min(foe.block, left); foe.block -= a; left -= a; if (a) ev.push({ e: 'foeBlock', n: a }); }
    const total = left + pierce;
    if (total > 0) { foe.hp -= total; ev.push({ e: 'foeHit', n: total }); }
    return total;
  }
  function endLine(run) {
    const f = run.fight;
    for (const e of f.staged) if (!e.dead) f.discard.push(e.inst);
    f.staged = []; f.prism = false;
  }
  // Strike: full damage, half block. Brace: full block, half damage.
  function applyStance(res, stance) {
    const out = Object.assign({}, res);
    if (stance === 'brace') { out.dmg = Math.floor(res.dmg * CFG.braceDmg); out.pierce = Math.floor(res.pierce * CFG.braceDmg); out.blk = Math.floor(res.blk * CFG.braceBlk); }
    else { out.blk = Math.floor(res.blk * CFG.strikeBlk); out.dmg = Math.floor(res.dmg * CFG.strikeDmg); out.pierce = Math.floor(res.pierce * CFG.strikeDmg); }
    return out;
  }
  function bank(run, stance) {
    const f = run.fight;
    const ev = [];
    stance = stance === 'brace' ? 'brace' : 'strike';
    const res = applyStance(resolve(run, f.staged), stance);
    run.stats.stances[stance]++;
    const count = f.staged.filter(e => !e.dead).length;
    run.stats.maxBank = Math.max(run.stats.maxBank, count);
    run.stats.maxBlind = Math.max(run.stats.maxBlind, f.blindThisTurn);
    f.banked += count;
    ev.push({ e: 'bank', count, res, stance });
    f.block += res.blk;
    if (res.blk) ev.push({ e: 'block', n: res.blk });
    if (res.heal) { heal(run, res.heal); ev.push({ e: 'heal', n: res.heal }); }
    if (res.bits) { run.bits += res.bits; run.stats.bitsEarned += res.bits; ev.push({ e: 'bits', n: res.bits }); }
    if (count >= 4 && has(run, 'siphon')) { heal(run, 1); ev.push({ e: 'relic', id: 'siphon' }); }
    f.lastDmg = dealToFoe(run, res.dmg, res.pierce, ev);
    f.lastBlk = res.blk;
    if (res.self) { hurt(run, res.self, 'your own Glitches'); ev.push({ e: 'selfHit', n: res.self }); }
    endLine(run);
    return ev.concat(afterPlayer(run));
  }
  function overload(run) {
    const f = run.fight;
    const ev = [{ e: 'overload' }];
    run.stats.overloads++; f.overloads++;
    f.overloadedLast = true;
    f.noise = 0; // the overload vents all noise: the line is lost, but you start clean
    const res = resolve(run, f.staged);
    if (res.self) hurt(run, res.self, 'your own Glitches');
    f.lastDmg = 0; f.lastBlk = 0;
    if (has(run, 'capacitor')) {
      const half = Math.floor((res.dmg + res.pierce) / 2);
      if (half) { ev.push({ e: 'relic', id: 'capacitor' }); f.lastDmg = dealToFoe(run, half, 0, ev); }
    }
    endLine(run);
    if (run.screen === 'dead') return ev;
    if (has(run, 'keel')) {
      f.noise = 0; f.overloadedLast = false;
      ev.push({ e: 'relic', id: 'keel' });
      if (f.foe.hp <= 0) return ev.concat(winFight(run));
      return ev;
    }
    return ev.concat(afterPlayer(run));
  }
  function afterPlayer(run) {
    const f = run.fight;
    if (run.screen === 'dead') return [];
    if (f.foe.hp <= 0) return winFight(run);
    const ev = foeAct(run);
    f.minHp = Math.min(f.minHp, run.hp);
    if (run.screen === 'dead') return ev;
    if (f.foe.hp <= 0) return ev.concat(winFight(run));
    startTurn(run, ev, false);
    return ev;
  }
  function hitPlayer(run, n, ev) {
    const f = run.fight;
    let left = n;
    const a = Math.min(f.block, left);
    f.block -= a; left -= a;
    if (a) ev.push({ e: 'playerBlock', n: a });
    if (left > 0) { ev.push({ e: 'playerHit', n: left }); hurt(run, left, f.foe.name); }
    else if (has(run, 'thorn')) { ev.push({ e: 'relic', id: 'thorn' }); dealToFoe(run, 3, 0, ev); }
  }
  function addCurse(run, tok, n) {
    const f = run.fight;
    for (let i = 0; i < n; i++) {
      const inst = { id: tok, uid: run.nextUid++, tmp: true };
      const lo = Math.min(f.pile.length, f.revealed);
      const pos = lo + ri(run, 'bag', f.pile.length - lo + 1);
      f.pile.splice(pos, 0, inst);
    }
  }
  function foeAct(run) {
    const f = run.fight, foe = f.foe;
    const ev = [];
    foe.block = 0;
    for (const p of foe.intent) {
      run.stats.intents[p.k] = (run.stats.intents[p.k] || 0) + 1;
      if (run.screen === 'dead' || foe.hp <= 0) break;
      switch (p.k) {
        case 'atk': for (let h = 0; h < p.hits && run.screen !== 'dead'; h++) { ev.push({ e: 'foeAttack' }); hitPlayer(run, p.n + foe.str, ev); } break;
        case 'mimic': ev.push({ e: 'foeAttack' }); hitPlayer(run, mimicDmg(f) + foe.str, ev); break;
        case 'def': foe.block += p.n; ev.push({ e: 'foeGuard', n: p.n }); break;
        case 'mirror': foe.block += Math.max(4, f.lastBlk); ev.push({ e: 'foeGuard', n: Math.max(4, f.lastBlk) }); break;
        case 'buff': foe.str += p.n; ev.push({ e: 'foeBuff', n: p.n }); break;
        case 'curse': addCurse(run, p.tok, p.n); ev.push({ e: 'curse', tok: p.tok, n: p.n }); break;
        case 'drain': { const s = Math.min(run.bits, p.n); run.bits -= s; ev.push({ e: 'drain', n: s }); break; }
        case 'hush': f.hushNext += 1; ev.push({ e: 'hush' }); break;
        case 'noise': f.noiseNext += p.n; ev.push({ e: 'noiseNext', n: p.n }); break;
        case 'heal': foe.hp = Math.min(foe.maxHp, foe.hp + p.n); ev.push({ e: 'foeHeal', n: p.n }); break;
        case 'shuffle': f.pile = f.pile.concat(f.discard); f.discard = []; shuffle(run, 'bag', f.pile); f.hushNext += 1; ev.push({ e: 'shuffle' }); break;
        case 'unseed': foe.phase2 = true; f.sightMod -= 1; ev.push({ e: 'unseed' }); break;
      }
    }
    return ev;
  }
  function winFight(run) {
    const f = run.fight;
    const ev = [{ e: 'win', foe: f.foe.id }];
    f.over = true;
    run.stats.fights++;
    run.stats.lowest.push({ act: run.act, kind: f.kind, foe: f.foe.id, min: f.minHp, max: run.maxHp, turns: f.turn });
    let bits = f.kind === 'boss' ? 0 : f.kind === 'elite' ? 26 + ri(run, 'loot', 8) : 11 + ri(run, 'loot', 6);
    if (has(run, 'abacus')) bits += 8;
    run.bits += bits; run.stats.bitsEarned += bits;
    run.stats.maxBits = Math.max(run.stats.maxBits, run.bits);
    if (f.kind === 'elite') run.stats.elites++;
    if (f.kind === 'boss') {
      run.stats.bosses++;
      if (!f.overloads) run.stats.cleanBoss = true;
      if (run.deck.length <= 12) run.stats.leanBoss = true;
    }
    const reward = { bits, tokens: [], relic: null, relicChoices: null, taken: false };
    if (f.kind !== 'boss' || run.act < 3) reward.tokens = rollTokens(run, f.kind === 'normal' ? 0 : 1);
    if (f.kind === 'elite') reward.relic = gainRandomRelicId(run);
    if (f.kind === 'boss' && run.act < 3) reward.relicChoices = sampleN(run, 'loot', BOSS_RELICS.filter(id => !has(run, id)), 3);
    run.reward = reward;
    if (reward.relic) addRelic(run, reward.relic);
    run.screen = (f.kind === 'boss' && run.act === 3) ? 'victory' : 'reward';
    if (run.screen === 'victory') run.won = true;
    return ev;
  }
  function gainRandomRelicId(run) {
    const pool = RELIC_POOL.filter(id => !has(run, id));
    return pool.length ? pick(run, 'loot', pool) : null;
  }
  function rollTokens(run, bonus) {
    const out = [];
    let guard = 0;
    while (out.length < 3 && guard++ < 50) {
      const rar = weighted(run, 'loot', [[60 - bonus * 20, 0], [32, 1], [8 + bonus * 20, 2]]);
      const pool = REWARD_POOL.filter(id => T[id].rar === rar && out.indexOf(id) < 0);
      if (pool.length) out.push(pick(run, 'loot', pool));
    }
    return out;
  }

  // ------------------------------------------------------------- SHOP
  function genShop(run) {
    const toks = [];
    const pool = sampleN(run, 'shop', REWARD_POOL, 5);
    for (const id of pool) toks.push({ id, cost: PRICE[T[id].rar] + ri(run, 'shop', 9) - 4, sold: false });
    const rp = RELIC_POOL.filter(id => !has(run, id));
    const relic = rp.length ? { id: pick(run, 'shop', rp), cost: 95 + ri(run, 'shop', 30), sold: false } : null;
    run.shop = { toks, relic, removeUsed: false, sightUsed: false, limitUsed: false, healUsed: false };
    run.screen = 'shop';
  }
  const SHOP_SERVICES = {
    remove: { name: 'Filter a token', cost: r => r.removeCost, desc: 'Remove one token from your bag.' },
    sight:  { name: 'Grind your lens', cost: r => 150 + (r.sight - 2) * 60, desc: '+1 sight for the rest of the run.' },
    limit:  { name: 'Insulate', cost: r => 110 + (r.noiseLimit - 3) * 50, desc: '+1 noise limit for the rest of the run.' },
    heal:   { name: 'Patch up', cost: r => 30, desc: 'Heal 18 HP.' },
  };

  // ------------------------------------------------------------- ACTIONS
  function act(run, a) {
    const ev = [];
    switch (run.screen) {
      case 'map': {
        if (a.t !== 'go') return ev;
        if (options(run).indexOf(a.node) < 0) return ev;
        run.node = a.node; run.visited.push(a.node); run.floor++;
        const n = run.map.nodes[a.node];
        ev.push({ e: 'enter', type: n.type });
        if (n.type === 'fight') return ev.concat(startFight(run, 'normal'));
        if (n.type === 'elite') return ev.concat(startFight(run, 'elite'));
        if (n.type === 'boss') return ev.concat(startFight(run, 'boss'));
        if (n.type === 'shop') { genShop(run); return ev; }
        if (n.type === 'rest') { run.rest = { done: false }; run.screen = 'rest'; return ev; }
        if (n.type === 'treasure') {
          const id = gainRandomRelicId(run);
          const bits = 20 + ri(run, 'loot', 15);
          run.bits += bits;
          if (id) addRelic(run, id);
          run.reward = { bits, tokens: [], relic: id, relicChoices: null, taken: true, treasure: true };
          run.screen = 'reward';
          return ev;
        }
        if (n.type === 'event') {
          const pool = EV.filter(e => e.acts.indexOf(run.act) >= 0 && run.log.indexOf(e.id) < 0);
          const e = pick(run, 'event', pool.length ? pool : EV.filter(x => x.acts.indexOf(run.act) >= 0));
          run.log.push(e.id);
          run.event = { id: e.id, result: null };
          run.screen = 'event';
          return ev;
        }
        return ev;
      }
      case 'fight':
        if (a.t === 'draw') return draw(run);
        if (a.t === 'bank') return bank(run, a.stance);
        return ev;
      case 'reward': {
        const rw = run.reward;
        if (a.t === 'take' && !rw.taken && rw.tokens[a.i]) { addToken(run, rw.tokens[a.i]); rw.taken = true; ev.push({ e: 'gain', id: rw.tokens[a.i] }); return ev; }
        if (a.t === 'relic' && rw.relicChoices && rw.relicChoices[a.i]) { addRelic(run, rw.relicChoices[a.i]); rw.relicPicked = rw.relicChoices[a.i]; rw.relicChoices = null; ev.push({ e: 'relicGain' }); return ev; }
        if (a.t === 'done') {
          if (rw.relicChoices) return ev; // must pick a boss relic first
          run.reward = null;
          if (run.fight && run.fight.kind === 'boss') { run.fight = null; run.screen = 'actEnd'; return ev; }
          run.fight = null; run.screen = 'map';
          return ev;
        }
        return ev;
      }
      case 'actEnd':
        if (a.t === 'continue') {
          run.act++; run.node = null; run.visited = []; run.hp = run.maxHp;
          run.map = genMap(run); run.screen = 'map'; run.lastFoe = null;
        }
        return ev;
      case 'shop': {
        const s = run.shop;
        if (a.t === 'buyTok') { const it = s.toks[a.i]; if (it && !it.sold && run.bits >= it.cost) { run.bits -= it.cost; it.sold = true; addToken(run, it.id); ev.push({ e: 'buy' }); } return ev; }
        if (a.t === 'buyRelic') { const it = s.relic; if (it && !it.sold && run.bits >= it.cost) { run.bits -= it.cost; it.sold = true; addRelic(run, it.id); ev.push({ e: 'buy' }); } return ev; }
        if (a.t === 'service') {
          const sv = SHOP_SERVICES[a.k]; if (!sv) return ev;
          const cost = sv.cost(run);
          if (run.bits < cost || s[a.k + 'Used']) return ev;
          if (a.k === 'remove') { if (!run.deck.some(t => t.uid === a.uid) || run.deck.length <= 5) return ev; removeUid(run, a.uid); run.removeCost += 25; }
          if (a.k === 'sight') run.sight += 1;
          if (a.k === 'limit') run.noiseLimit += 1;
          if (a.k === 'heal') { if (run.hp >= run.maxHp) return ev; heal(run, 18); }
          run.bits -= cost; s[a.k + 'Used'] = true; ev.push({ e: 'buy' });
          return ev;
        }
        if (a.t === 'leave') { run.shop = null; run.screen = 'map'; }
        return ev;
      }
      case 'rest': {
        if (run.rest.done) { if (a.t === 'leave') { run.rest = null; run.screen = 'map'; } return ev; }
        if (a.t === 'heal') { heal(run, Math.ceil(run.maxHp * 0.3)); run.rest.done = 'heal'; ev.push({ e: 'heal' }); }
        if (a.t === 'tune') { const t = run.deck.find(x => x.uid === a.uid); if (!t || t.up || !T[t.id].up) return ev; t.up = true; run.rest.done = 'tune'; ev.push({ e: 'tune' }); }
        if (a.t === 'filter') { const t = run.deck.find(x => x.uid === a.uid); if (!t || !T[t.id].curse) return ev; removeUid(run, t.uid); run.rest.done = 'filter'; ev.push({ e: 'filter' }); }
        return ev;
      }
      case 'event': {
        const e = EV.find(x => x.id === run.event.id);
        if (run.event.result === null && a.t === 'choose') {
          const o = e.opts[a.i];
          if (!o || (o.req && !o.req(run))) return ev;
          run.event.result = o.fx(run);
          run.event.chose = a.i;
          run.stats.maxBits = Math.max(run.stats.maxBits, run.bits);
          ev.push({ e: 'eventDone' });
          return ev;
        }
        if (run.event.result !== null && a.t === 'leave' && run.screen === 'event') { run.event = null; run.screen = 'map'; }
        return ev;
      }
    }
    return ev;
  }

  // -------------------------------------------------------------- VIEW
  // What the player can see. Bots read only this (no hidden bag order).
  function count(list) { const c = {}; for (const t of list) c[t.id] = (c[t.id] || 0) + 1; return c; }
  function view(run) {
    const v = { screen: run.screen, act: run.act, floor: run.floor, hp: run.hp, maxHp: run.maxHp, bits: run.bits,
      sight: run.sight, noiseLimit: run.noiseLimit, relics: run.relics.slice(), deck: run.deck.map(t => ({ id: t.id, uid: t.uid, up: !!t.up })) };
    if (run.screen === 'map') v.options = options(run).map(id => ({ id, type: run.map.nodes[id].type, row: run.map.nodes[id].row }));
    if (run.fight && run.screen === 'fight') {
      const f = run.fight;
      v.fight = {
        foe: { id: f.foe.id, name: f.foe.name, hp: f.foe.hp, maxHp: f.foe.maxHp, block: f.foe.block, str: f.foe.str,
          intent: f.foe.intent, intentText: intentText(f.foe.intent, f.foe), incoming: intentDamage(f.foe.intent, run) },
        revealed: f.pile.slice(0, f.revealed).map(t => ({ id: t.id, up: !!t.up })),
        hidden: count(hiddenPool(f)), hiddenCount: hiddenPool(f).length, pileCount: f.pile.length, discard: count(f.discard),
        staged: f.staged.map(e => ({ id: e.id, up: e.up, mult: e.mult, echo: e.echo ? e.echo.id : null, dead: !!e.dead })),
        noise: f.noise, limit: f.limit, block: f.block, risk: risk(run), preview: preview(run), canDraw: canDraw(run), turn: f.turn,
        stances: { strike: applyStance(preview(run), 'strike'), brace: applyStance(preview(run), 'brace') }, cool: coolOf(run),
        noiseNextTurn: Math.min(f.limit, Math.max(0, f.noise - coolOf(run)) + f.noiseNext),
        nextNoise: f.revealed > 0 ? noiseOf(run, f.pile[0]) : null, blindNow: f.revealed === 0,
      };
    }
    if (run.screen === 'reward' && run.reward) v.reward = JSON.parse(JSON.stringify(run.reward));
    if (run.screen === 'shop') {
      v.shop = JSON.parse(JSON.stringify(run.shop));
      v.services = Object.keys(SHOP_SERVICES).map(k => ({ k, cost: SHOP_SERVICES[k].cost(run), used: run.shop[k + 'Used'] }));
    }
    if (run.screen === 'event') {
      const e = EV.find(x => x.id === run.event.id);
      v.event = { id: e.id, title: e.title, text: e.text, result: run.event.result,
        opts: e.opts.map(o => ({ label: o.label, ok: !o.req || o.req(run) })) };
    }
    if (run.screen === 'rest') v.rest = { done: run.rest.done };
    return v;
  }

  // -------------------------------------------------------------- BOTS
  const TOKEN_RANK = ['prism', 'pierce', 'heavy', 'bulwark', 'seer', 'leech', 'fuse', 'ward', 'calm', 'twin', 'crescendo', 'echo', 'ground', 'bash', 'cache'];
  // Brace when the HP it saves is worth more than the damage it gives up.
  function chooseStance(f) {
    const st = f.stances.strike, br = f.stances.brace;
    if (st.dmg + st.pierce >= f.foe.hp + f.foe.block) return 'strike';
    const lossS = Math.max(0, f.foe.incoming - (f.block + st.blk)), lossB = Math.max(0, f.foe.incoming - (f.block + br.blk));
    const dmgGap = (st.dmg + st.pierce) - (br.dmg + br.pierce);
    return lossS - lossB > dmgGap * 0.9 ? 'brace' : 'strike';
  }
  function bot(v, style) {
    const greedy = style === 'greedy';
    if (v.screen === 'fight') {
      const f = v.fight;
      // naive: the play the first build rewarded. Draw while it is free, always Strike.
      if (style === 'naive') return f.canDraw && f.risk === 0 ? { t: 'draw' } : { t: 'bank', stance: 'strike' };
      const bankNow = () => ({ t: 'bank', stance: chooseStance(f) });
      if (!f.canDraw) return bankNow();
      const s = f.stances.strike;
      if (s.dmg + s.pierce >= f.foe.hp + f.foe.block && f.staged.length) return { t: 'bank', stance: 'strike' };
      if (!f.blindNow) return f.risk >= 1 ? bankNow() : { t: 'draw' };
      const needBlock = f.foe.incoming - (f.block + f.stances.brace.blk);
      let limit = greedy ? 0.42 : 0.2;
      if (!greedy && needBlock > v.hp * 0.4) limit = 0.3;
      if (v.hp < v.maxHp * 0.25) limit -= 0.08;
      if (!greedy && f.noise >= f.limit - 1) limit -= 0.1; // noise held now is carried into next turn
      return f.risk <= limit ? { t: 'draw' } : bankNow();
    }
    if (v.screen === 'map') {
      const score = o => {
        const low = v.hp < v.maxHp * 0.45;
        const s = { fight: 3, event: 2, elite: low ? -2 : (greedy ? 5 : 2), shop: v.bits >= 70 ? 4 : 1, rest: low ? 6 : 1, treasure: 5, boss: 9 };
        return s[o.type] || 0;
      };
      let best = v.options[0];
      for (const o of v.options) if (score(o) > score(best)) best = o;
      return { t: 'go', node: best.id };
    }
    if (v.screen === 'reward') {
      const rw = v.reward;
      if (rw.relicChoices) return { t: 'relic', i: 0 };
      if (!rw.taken && rw.tokens.length) {
        let bi = -1, br = 99;
        rw.tokens.forEach((id, i) => { const r = TOKEN_RANK.indexOf(id); if (r >= 0 && r < br) { br = r; bi = i; } });
        if (bi >= 0 && (br < 9 || v.deck.length < 18)) return { t: 'take', i: bi };
      }
      return { t: 'done' };
    }
    if (v.screen === 'shop') {
      const sv = k => v.services.find(s => s.k === k);
      const statics = v.deck.filter(t => T[t.id].curse);
      if (statics.length && !sv('remove').used && v.bits >= sv('remove').cost) return { t: 'service', k: 'remove', uid: statics[0].uid };
      if (!sv('sight').used && v.bits >= sv('sight').cost) return { t: 'service', k: 'sight' };
      if (v.hp < v.maxHp * 0.5 && !sv('heal').used && v.bits >= 30) return { t: 'service', k: 'heal' };
      if (v.shop.relic && !v.shop.relic.sold && v.bits >= v.shop.relic.cost) return { t: 'buyRelic' };
      for (let i = 0; i < v.shop.toks.length; i++) {
        const it = v.shop.toks[i];
        if (!it.sold && v.bits >= it.cost + 30 && TOKEN_RANK.indexOf(it.id) >= 0 && TOKEN_RANK.indexOf(it.id) < 8) return { t: 'buyTok', i };
      }
      return { t: 'leave' };
    }
    if (v.screen === 'rest') {
      if (v.rest.done) return { t: 'leave' };
      if (v.hp < v.maxHp * 0.6) return { t: 'heal' };
      const c = v.deck.find(t => T[t.id].curse);
      if (c) return { t: 'filter', uid: c.uid };
      const u = v.deck.find(t => !t.up && T[t.id].up && t.id !== 'spark');
      if (u) return { t: 'tune', uid: u.uid };
      return { t: 'heal' };
    }
    if (v.screen === 'event') {
      if (v.event.result !== null) return { t: 'leave' };
      const ok = v.event.opts.map((o, i) => o.ok ? i : -1).filter(i => i >= 0);
      const safe = v.hp < v.maxHp * 0.4 ? ok[ok.length - 1] : ok[0];
      return { t: 'choose', i: safe };
    }
    if (v.screen === 'actEnd') return { t: 'continue' };
    return null;
  }
  function playBot(seed, style, opts) {
    const run = newRun(seed, opts);
    let steps = 0;
    while (run.screen !== 'dead' && run.screen !== 'victory' && steps < 20000) {
      const a = bot(view(run), style);
      if (!a) break;
      const before = steps;
      act(run, a);
      steps++;
      if (steps === before) break;
    }
    return { run, steps };
  }

  // ------------------------------------------------------------- SAVE
  function save(run) { return JSON.stringify(run); }
  function load(str) {
    const run = JSON.parse(str);
    if (!run || run.v !== 1 || !run.rng || !run.deck) throw new Error('bad save');
    return run;
  }
  function hash(run) {
    const s = JSON.stringify(run);
    const h = cyrb128(s);
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  const XR = { CFG, T, R, F, EV, GOALS, STREAMS, SHOP_SERVICES, ROWS, COLS, newRun, act, view, bot, playBot, save, load, hash,
    tokenText, intentText, intentDamage, risk, options, makeStream, sfc32, cyrb128, preview };
  if (typeof module !== 'undefined' && module.exports) module.exports = XR;
  G.XR = XR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
