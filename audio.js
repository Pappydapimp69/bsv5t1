/* xrndm audio: every sound and every bar of music is synthesized with Web Audio.
   Nothing is loaded from files. The context starts on the first user gesture. */
(function (G) {
  'use strict';
  const AU = { ctx: null, ready: false, settings: { music: 0.55, sfx: 0.8 }, track: null, trackName: null };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const C = G.AudioContext || G.webkitAudioContext;
    if (!C) return;
    const ctx = AU.ctx = new C();
    AU.comp = ctx.createDynamicsCompressor();
    AU.comp.threshold.value = -14; AU.comp.ratio.value = 4;
    AU.master = ctx.createGain(); AU.master.gain.value = 0.7;
    AU.analyser = ctx.createAnalyser(); AU.analyser.fftSize = 2048;
    AU.sfxBus = ctx.createGain();
    AU.musicBus = ctx.createGain();
    // a tempo-free echo on the music bus for space
    AU.delay = ctx.createDelay(1.5); AU.delay.delayTime.value = 0.33;
    AU.fb = ctx.createGain(); AU.fb.gain.value = 0.28;
    AU.wet = ctx.createGain(); AU.wet.gain.value = 0.22;
    AU.delay.connect(AU.fb); AU.fb.connect(AU.delay); AU.delay.connect(AU.wet); AU.wet.connect(AU.master);
    AU.musicBus.connect(AU.master); AU.musicBus.connect(AU.delay);
    AU.sfxBus.connect(AU.master);
    AU.master.connect(AU.comp); AU.comp.connect(ctx.destination); AU.comp.connect(AU.analyser);
    // shared noise buffer
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let s = 12345; for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    AU.noise = buf;
    applySettings();
    AU.ready = true;
    setInterval(schedule, 25);
  }
  function applySettings() {
    if (!AU.ctx) return;
    AU.sfxBus.gain.value = AU.settings.sfx;
    AU.musicBus.gain.value = AU.settings.music * 0.7;
  }
  function level() { // RMS of the output, for tests
    if (!AU.analyser) return 0;
    const a = new Float32Array(AU.analyser.fftSize); AU.analyser.getFloatTimeDomainData(a);
    let s = 0, pk = 0; for (const x of a) { s += x * x; pk = Math.max(pk, Math.abs(x)); }
    return { rms: Math.sqrt(s / a.length), peak: pk };
  }

  // --------------------------------------------------------------- VOICES
  function env(g, t, a, peak, d, sus, r, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0002, peak * sus), t + Math.max(a + d, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
  }
  function osc(type, freq, t, dur, peak, dest, o) {
    o = o || {};
    const ctx = AU.ctx;
    const x = ctx.createOscillator(); x.type = type; x.frequency.setValueAtTime(freq, t);
    if (o.to) x.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || dur));
    if (o.detune) x.detune.value = o.detune;
    const g = ctx.createGain();
    env(g, t, o.a || 0.005, peak, o.d || 0.08, o.s === undefined ? 0.5 : o.s, o.r || 0.1, dur);
    let node = x;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); f.Q.value = o.q || 1; node.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    x.start(t); x.stop(t + dur + (o.r || 0.1) + 0.05);
  }
  function noise(t, dur, peak, dest, o) {
    o = o || {};
    const ctx = AU.ctx;
    const src = ctx.createBufferSource(); src.buffer = AU.noise;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    env(g, t, o.a || 0.002, peak, o.d || 0.05, o.s === undefined ? 0.3 : o.s, o.r || 0.05, dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, (o.off || 0) % 1.5); src.stop(t + dur + (o.r || 0.05) + 0.05);
  }

  // ----------------------------------------------------------------- SFX
  const SFX = {
    click(t, b) { osc('square', 880, t, 0.03, 0.12, b, { to: 660, r: 0.04, lp: 3000 }); },
    hover(t, b) { osc('sine', 1320, t, 0.02, 0.04, b, { r: 0.03 }); },
    draw(t, b) { noise(t, 0.09, 0.35, b, { f: 3000, fTo: 900, q: 0.8 }); osc('triangle', 520, t, 0.06, 0.12, b, { to: 780 }); },
    blind(t, b) { noise(t, 0.12, 0.35, b, { f: 1800, fTo: 500, q: 0.8 }); osc('triangle', 300, t, 0.1, 0.14, b, { to: 420 }); },
    static(t, b) { for (let i = 0; i < 5; i++) noise(t + i * 0.025, 0.02, 0.4, b, { f: 4000 + i * 800, q: 3, off: i * 0.13 }); osc('sawtooth', 110, t, 0.12, 0.08, b, { lp: 900 }); },
    reveal(t, b) { osc('sine', 1046, t, 0.08, 0.1, b, { r: 0.2 }); osc('sine', 1568, t + 0.05, 0.08, 0.08, b, { r: 0.25 }); },
    overload(t, b) {
      osc('sawtooth', 440, t, 0.5, 0.3, b, { to: 55, glide: 0.5, lp: 3000, lpTo: 200 });
      osc('square', 466, t, 0.4, 0.15, b, { to: 60, glide: 0.4, lp: 2000 });
      noise(t, 0.6, 0.5, b, { type: 'lowpass', f: 6000, fTo: 200, s: 0.6, r: 0.3 });
    },
    bank(t, b) { [0, 4, 7, 12].forEach((s, i) => osc('triangle', mtof(72 + s), t + i * 0.045, 0.1, 0.16, b, { r: 0.18 })); },
    hit(t, b) { osc('sine', 160, t, 0.18, 0.55, b, { to: 40, glide: 0.18, s: 0.2 }); noise(t, 0.08, 0.4, b, { type: 'lowpass', f: 2500, fTo: 300 }); },
    bigHit(t, b) { SFX.hit(t, b); osc('sawtooth', 90, t, 0.3, 0.25, b, { to: 30, lp: 800 }); noise(t, 0.25, 0.4, b, { type: 'lowpass', f: 1200, fTo: 100 }); },
    hurt(t, b) { osc('square', 220, t, 0.2, 0.25, b, { to: 90, lp: 1400 }); noise(t, 0.15, 0.35, b, { f: 900, q: 0.7 }); },
    block(t, b) { osc('square', 1200, t, 0.05, 0.12, b, { lp: 5000, r: 0.12 }); noise(t, 0.06, 0.3, b, { f: 6000, q: 6 }); osc('triangle', 1800, t, 0.04, 0.08, b, { r: 0.2 }); },
    swing(t, b) { noise(t, 0.18, 0.3, b, { f: 600, fTo: 3000, q: 1.5 }); },
    heal(t, b) { [0, 5, 9].forEach((s, i) => osc('sine', mtof(76 + s), t + i * 0.07, 0.15, 0.14, b, { r: 0.3, a: 0.02 })); },
    coin(t, b) { osc('square', 1568, t, 0.05, 0.1, b, { lp: 6000 }); osc('square', 2093, t + 0.06, 0.12, 0.1, b, { lp: 6000, r: 0.2 }); },
    curse(t, b) { osc('sawtooth', 233, t, 0.35, 0.16, b, { lp: 900, a: 0.03 }); osc('sawtooth', 247, t, 0.35, 0.16, b, { lp: 900, a: 0.03 }); },
    buff(t, b) { osc('sawtooth', 110, t, 0.4, 0.2, b, { to: 220, lp: 600, lpTo: 2400 }); },
    shuffle(t, b) { for (let i = 0; i < 8; i++) noise(t + i * 0.04, 0.03, 0.3, b, { f: 2500 + (i % 2) * 1200, q: 2, off: i * 0.2 }); },
    relic(t, b) { [0, 7, 12, 16, 19].forEach((s, i) => osc('sine', mtof(79 + s), t + i * 0.06, 0.2, 0.08, b, { r: 0.5 })); },
    win(t, b) { [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, i) => ch.forEach(m => osc('triangle', mtof(m), t + i * 0.14, i === 3 ? 0.6 : 0.12, 0.09, b, { r: 0.4 }))); },
    lose(t, b) { [67, 63, 60, 55].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.25, 0.3, 0.14, b, { r: 0.5, lp: 1600 })); },
    type(t, b) { osc('square', 1900 + Math.floor(t * 1000) % 7 * 40, t, 0.012, 0.025, b, { lp: 4000, r: 0.01 }); },
    step(t, b) { osc('sine', 330, t, 0.06, 0.12, b, { to: 495, r: 0.1 }); },
    buy(t, b) { SFX.coin(t, b); osc('triangle', 880, t + 0.12, 0.1, 0.1, b, { r: 0.2 }); },
    deny(t, b) { osc('square', 180, t, 0.08, 0.12, b, { lp: 900 }); osc('square', 140, t + 0.09, 0.1, 0.12, b, { lp: 900 }); },
    unseed(t, b) { osc('sawtooth', 880, t, 1.2, 0.18, b, { to: 40, glide: 1.2, lp: 4000, lpTo: 100 }); noise(t, 1.2, 0.3, b, { f: 400, fTo: 6000, q: 2 }); },
    whoosh(t, b) { noise(t, 0.5, 0.35, b, { type: 'bandpass', f: 300, fTo: 4000, q: 0.8, a: 0.1 }); },
  };
  let lastType = 0;
  function sfx(name) {
    if (!AU.ready || !SFX[name]) return;
    const t = AU.ctx.currentTime + 0.005;
    if (name === 'type') { if (t - lastType < 0.035) return; lastType = t; }
    SFX[name](t, AU.sfxBus);
  }

  // ---------------------------------------------------------------- MUSIC
  // Each track: bpm, root (MIDI), 4-bar chord loop (semitones from root, as
  // [root of chord, quality]), and which parts play.
  const MIN = [0, 3, 7], MAJ = [0, 4, 7], SUS = [0, 5, 7];
  const TRACKS = {
    title:   { bpm: 76,  root: 45, chords: [[0, MIN], [-4, MAJ], [3, MAJ], [-2, MAJ]], pad: 0.13, arp: [0, 2, 1, 2], arpVol: 0.05, arpOct: 2, hat: 0.02 },
    intro:   { bpm: 60,  root: 45, chords: [[0, MIN], [5, MIN], [-4, MAJ], [-5, MAJ]], pad: 0.14, bell: [0, -1, 2, -1, 1, -1, -1, -1], bellVol: 0.06 },
    act1:    { bpm: 98,  root: 45, chords: [[0, MIN], [-4, MAJ], [-7, MAJ], [-2, MAJ]], pad: 0.07, bass: '8', bassVol: 0.14, arp: [0, 1, 2, 1, 3, 1, 2, 1], arpVol: 0.045, arpOct: 2, kick: [0, 8], snare: [4, 12], hat: 0.03 },
    act2:    { bpm: 84,  root: 49, chords: [[0, MIN], [1, MAJ], [0, MIN], [-2, MIN]], pad: 0.09, bass: '4', bassVol: 0.13, bell: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, -1, 1, -1, -1, 0, -1], bellVol: 0.055, kick: [0, 10], hat: 0.015 },
    act3:    { bpm: 118, root: 40, chords: [[0, MIN], [0, MIN], [-4, MAJ], [-2, MAJ]], pad: 0.05, bass: '16', bassVol: 0.11, saw: true, arp: [0, 2, 1, 3], arpVol: 0.04, arpOct: 2, kick: [0, 4, 8, 12], snare: [4, 12], hat: 0.035 },
    boss:    { bpm: 136, root: 38, chords: [[0, MIN], [1, MAJ], [-2, MAJ], [-5, [0, 4, 7]]], pad: 0.05, bass: '16', bassVol: 0.12, saw: true, arp: [0, 1, 2, 3, 2, 1], arpVol: 0.045, arpOct: 2, kick: [0, 3, 8, 11], snare: [4, 12], hat: 0.04 },
    shop:    { bpm: 104, root: 53, chords: [[0, MAJ], [5, MAJ], [-3, MIN], [7, MAJ]], pad: 0.06, bass: '4', bassVol: 0.12, bell: [0, 2, 1, -1, 2, -1, 1, 3], bellVol: 0.05, kick: [0, 8], snare: [12], hat: 0.02 },
    rest:    { bpm: 64,  root: 50, chords: [[0, MAJ], [7, MAJ], [-3, MIN], [5, SUS]], pad: 0.13, bell: [0, -1, -1, 2, -1, -1, 1, -1], bellVol: 0.045 },
    victory: { bpm: 92,  root: 48, chords: [[0, MAJ], [7, MAJ], [9, MIN], [5, MAJ]], pad: 0.1, bass: '4', bassVol: 0.12, arp: [0, 1, 2, 3, 2, 1], arpVol: 0.05, arpOct: 2, kick: [0, 8], snare: [4, 12], hat: 0.02, lead: [12, -1, 14, 16, -1, 14, 12, -1, 11, -1, 12, -1, 7, -1, -1, -1] },
    death:   { bpm: 50,  root: 33, chords: [[0, MIN], [-1, MIN], [0, MIN], [-5, MIN]], pad: 0.12 },
  };
  function schedule() {
    if (!AU.ready || !AU.track) return;
    const tr = AU.track;
    const ctx = AU.ctx;
    const spb = 60 / tr.def.bpm / 4; // 16th note
    while (tr.next < ctx.currentTime + 0.12) {
      playStep(tr, tr.step, tr.next, spb);
      tr.next += spb; tr.step++;
    }
  }
  function playStep(tr, step, t, spb) {
    const d = tr.def, out = tr.bus;
    const bar = Math.floor(step / 16) % d.chords.length, s16 = step % 16;
    const ch = d.chords[bar], root = d.root + ch[0];
    const tones = ch[1].concat([12]);
    if (s16 === 0 && d.pad) for (const tn of ch[1]) {
      osc('sawtooth', mtof(root + 12 + tn), t, spb * 15, d.pad / 3, out, { a: spb * 4, d: 0.3, s: 0.8, r: spb * 4, lp: 900, detune: -7 });
      osc('sawtooth', mtof(root + 12 + tn), t, spb * 15, d.pad / 3, out, { a: spb * 4, d: 0.3, s: 0.8, r: spb * 4, lp: 900, detune: 7 });
    }
    if (d.bass) {
      const every = { '4': 4, '8': 2, '16': 1 }[d.bass];
      if (s16 % every === 0) {
        const oct = (d.bass === '16' && s16 % 4 === 2) ? 12 : 0;
        osc(d.saw ? 'sawtooth' : 'square', mtof(root - 12 + oct), t, spb * every * 0.8, d.bassVol, out, { lp: d.saw ? 700 : 500, lpTo: 200, s: 0.4, r: 0.05 });
      }
    }
    if (d.arp && s16 % 2 === 0) {
      const i = d.arp[(s16 / 2) % d.arp.length];
      osc('triangle', mtof(root + 12 * d.arpOct + tones[i % tones.length]), t, spb * 1.2, d.arpVol, out, { r: 0.12, s: 0.3 });
    }
    if (d.bell && s16 % 2 === 0) {
      const i = d.bell[(s16 / 2) % d.bell.length];
      if (i >= 0) { osc('sine', mtof(root + 24 + tones[i % tones.length]), t, spb * 2, d.bellVol, out, { r: 0.6, s: 0.2 }); osc('sine', mtof(root + 36 + tones[i % tones.length]), t, spb, d.bellVol * 0.3, out, { r: 0.3, s: 0.1 }); }
    }
    if (d.lead) {
      const n = d.lead[s16];
      if (n >= 0) osc('square', mtof(d.root + 12 + n), t, spb * 1.6, 0.05, out, { lp: 2400, r: 0.15 });
    }
    if (d.kick && d.kick.indexOf(s16) >= 0) osc('sine', 150, t, 0.12, 0.45, out, { to: 42, glide: 0.12, s: 0.1, r: 0.06 });
    if (d.snare && d.snare.indexOf(s16) >= 0) { noise(t, 0.08, 0.2, out, { f: 1800, q: 0.6 }); osc('triangle', 220, t, 0.05, 0.08, out, { to: 160 }); }
    if (d.hat && s16 % 2 === 0) noise(t, 0.02, d.hat * (s16 % 4 ? 0.6 : 1) * 3, out, { type: 'highpass', f: 8000, q: 0.5, off: step * 0.07 });
  }
  function music(name) {
    if (!AU.ready) { AU.pending = name; return; }
    if (AU.trackName === name) return;
    const ctx = AU.ctx;
    if (AU.track) {
      const old = AU.track.bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => old.disconnect(), 3000);
    }
    AU.trackName = name;
    if (!TRACKS[name]) { AU.track = null; return; }
    const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(AU.musicBus);
    bus.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
    AU.track = { def: TRACKS[name], bus, step: 0, next: ctx.currentTime + 0.05 };
  }
  function start() { init(); if (AU.pending) { const p = AU.pending; AU.pending = null; music(p); } }

  Object.assign(AU, { init: start, sfx, music, applySettings, level, TRACKS: Object.keys(TRACKS), SFX: Object.keys(SFX) });
  G.AU = AU;
})(typeof globalThis !== 'undefined' ? globalThis : this);
