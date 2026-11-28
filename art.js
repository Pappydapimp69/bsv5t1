/* xrndm art: every picture in the game is drawn here, procedurally, on canvas.
   Visual noise uses a hash of time and index, never the game's RNG streams. */
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;
  const vn = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

  const PAL = {
    0: { bg: '#05070d', a: '#7cf7ff', b: '#ffcf6e', c: '#16233a', d: '#ff5fa2', name: '' },
    1: { bg: '#061219', a: '#3ff2d6', b: '#ffb347', c: '#123842', d: '#ff6a5c', name: 'The Static Fields' },
    2: { bg: '#110a1e', a: '#c77dff', b: '#ff6fae', c: '#2e1c4a', d: '#7cf7ff', name: 'The Echo Halls' },
    3: { bg: '#170607', a: '#ff4d4d', b: '#ffe9a8', c: '#431414', d: '#ffa53d', name: 'The Core' },
  };

  function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow(ctx) { ctx.shadowBlur = 0; }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function eye(ctx, x, y, r, t, col, look) {
    ctx.fillStyle = '#0b0b10'; circle(ctx, x, y, r); ctx.fill();
    const blink = (Math.sin(t * 0.9 + x) > 0.985) ? 0.15 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, blink);
    glow(ctx, col, 12); ctx.fillStyle = col; circle(ctx, (look || 0) * r * 0.3, 0, r * 0.45); ctx.fill(); noGlow(ctx);
    ctx.restore();
  }
  function staticSpeckle(ctx, w, h, t, n, col, alpha) {
    ctx.fillStyle = col; ctx.globalAlpha = alpha;
    const f = Math.floor(t * 20);
    for (let i = 0; i < n; i++) {
      const x = vn(i * 3.1 + f) * w, y = vn(i * 7.7 + f * 1.3) * h;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------- BACKGROUNDS
  function background(ctx, w, h, act, t, calm) {
    const p = PAL[act] || PAL[0];
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    g.addColorStop(0, p.c); g.addColorStop(1, p.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (act === 1 || act === 0) {
      // rolling fields of static: horizon lines that drift
      ctx.strokeStyle = p.a; ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const y = h * 0.55 + Math.pow(i / 18, 1.8) * h * 0.5;
        ctx.globalAlpha = 0.05 + i / 18 * 0.18;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * 0.01 + t * 0.6 + i) * (3 + i * 0.6);
          x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // far generator glow
      glow(ctx, p.b, 40); ctx.fillStyle = p.b; ctx.globalAlpha = 0.25 + Math.sin(t) * 0.05;
      circle(ctx, w * 0.78, h * 0.52, 18); ctx.fill(); ctx.globalAlpha = 1; noGlow(ctx);
      staticSpeckle(ctx, w, h, calm ? t * 0.2 : t, Math.floor(w * h / 9000), p.a, 0.25);
    } else if (act === 2) {
      // echoing arches receding
      ctx.strokeStyle = p.a; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const k = ((i + t * 0.12) % 9) / 9;
        const s = 0.15 + k * 1.1;
        ctx.globalAlpha = (1 - k) * 0.35;
        ctx.beginPath();
        const aw = w * 0.42 * s, ah = h * 0.7 * s;
        ctx.moveTo(w / 2 - aw, h * 0.95);
        ctx.lineTo(w / 2 - aw, h * 0.95 - ah * 0.6);
        ctx.quadraticCurveTo(w / 2 - aw, h * 0.95 - ah, w / 2, h * 0.95 - ah * 1.05);
        ctx.quadraticCurveTo(w / 2 + aw, h * 0.95 - ah, w / 2 + aw, h * 0.95 - ah * 0.6);
        ctx.lineTo(w / 2 + aw, h * 0.95);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      staticSpeckle(ctx, w, h, t * 0.5, Math.floor(w * h / 16000), p.b, 0.2);
    } else {
      // the core: concentric rotating rings of digits
      ctx.save(); ctx.translate(w / 2, h * 0.45);
      ctx.font = '12px monospace'; ctx.textAlign = 'center';
      for (let r = 1; r <= 7; r++) {
        const rad = r * Math.max(w, h) * 0.08;
        const n = 10 + r * 8;
        ctx.globalAlpha = 0.07 + (7 - r) * 0.025;
        ctx.fillStyle = r % 2 ? p.a : p.b;
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + t * (r % 2 ? 0.05 : -0.04) * (8 - r) * 0.3;
          ctx.fillText(String(Math.floor(vn(i * r + Math.floor(t * 2)) * 10)), Math.cos(a) * rad, Math.sin(a) * rad);
        }
      }
      ctx.restore(); ctx.globalAlpha = 1;
      staticSpeckle(ctx, w, h, t, Math.floor(w * h / 12000), p.a, 0.2);
    }
  }

  // --------------------------------------------------------------- PEOPLE
  // Ix: a small hooded Reader. Two glowing points on the visor: two moments ahead.
  function ix(ctx, t, opt) {
    opt = opt || {};
    const bob = Math.sin(t * 2) * 3;
    const col = opt.col || '#7cf7ff';
    ctx.save(); ctx.translate(0, bob);
    // cloak
    ctx.fillStyle = '#1b2a44';
    ctx.beginPath(); ctx.moveTo(-34, 70); ctx.quadraticCurveTo(-40, 0, -22, -30); ctx.lineTo(22, -30); ctx.quadraticCurveTo(40, 0, 34, 70); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2f4a73'; ctx.lineWidth = 3; ctx.stroke();
    // scarf
    ctx.fillStyle = opt.scarf || '#ff5fa2';
    ctx.beginPath(); ctx.moveTo(-24, -22); ctx.lineTo(24, -22); ctx.lineTo(20, -10); ctx.lineTo(-20, -10); ctx.fill();
    const sw = Math.sin(t * 3) * 6;
    ctx.beginPath(); ctx.moveTo(14, -14); ctx.lineTo(30 + sw, 10); ctx.lineTo(22 + sw, 14); ctx.lineTo(8, -10); ctx.fill();
    // hood
    ctx.fillStyle = '#22385c';
    ctx.beginPath(); ctx.arc(0, -46, 28, Math.PI * 0.95, Math.PI * 2.05); ctx.quadraticCurveTo(30, -18, 0, -18); ctx.quadraticCurveTo(-30, -18, -28, -42); ctx.fill();
    // face shadow + visor
    ctx.fillStyle = '#070b14'; ctx.beginPath(); ctx.ellipse(0, -40, 18, 14, 0, 0, TAU); ctx.fill();
    glow(ctx, col, 16); ctx.fillStyle = col;
    const lk = opt.look || 0;
    circle(ctx, -6 + lk, -41, 3.4); ctx.fill(); circle(ctx, 6 + lk, -41, 3.4); ctx.fill();
    noGlow(ctx);
    // bag on hip with a glimmer
    ctx.fillStyle = '#5a3d2b'; ctx.beginPath(); ctx.ellipse(-26, 34, 13, 15, -0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a6346'; ctx.lineWidth = 2; ctx.stroke();
    glow(ctx, '#ffcf6e', 10); ctx.fillStyle = '#ffcf6e'; ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.4; circle(ctx, -24, 24, 2.5); ctx.fill(); ctx.globalAlpha = 1; noGlow(ctx);
    ctx.restore();
  }
  function vell(ctx, t) {
    const sway = Math.sin(t * 1.2) * 2;
    ctx.save(); ctx.translate(sway, 0);
    ctx.fillStyle = '#3b2f4f'; ctx.beginPath(); ctx.moveTo(-40, 80); ctx.lineTo(-30, -10); ctx.lineTo(30, -10); ctx.lineTo(40, 80); ctx.fill();
    ctx.fillStyle = '#d9c9a8'; ctx.beginPath(); ctx.ellipse(0, -32, 20, 24, 0, 0, TAU); ctx.fill();
    // tall hat
    ctx.fillStyle = '#2a2140'; ctx.fillRect(-18, -100, 36, 50); ctx.fillRect(-30, -54, 60, 8);
    ctx.fillStyle = '#ffcf6e'; ctx.fillRect(-18, -64, 36, 5);
    // spectacles
    ctx.strokeStyle = '#ffcf6e'; ctx.lineWidth = 2;
    circle(ctx, -8, -34, 6); ctx.stroke(); circle(ctx, 8, -34, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -34); ctx.lineTo(2, -34); ctx.stroke();
    // beard
    ctx.fillStyle = '#efe7d8'; ctx.beginPath(); ctx.moveTo(-16, -22); ctx.quadraticCurveTo(0, 30 + Math.sin(t * 2) * 3, 16, -22); ctx.fill();
    // ledger
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(18, 10, 26, 34); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(21, 13, 20, 28);
    ctx.restore();
  }
  function oma(ctx, t) {
    ctx.fillStyle = '#4b3b2b'; ctx.beginPath(); ctx.moveTo(-36, 70); ctx.quadraticCurveTo(-30, -10, 0, -16); ctx.quadraticCurveTo(30, -10, 36, 70); ctx.fill();
    ctx.fillStyle = '#c49a7a'; ctx.beginPath(); ctx.ellipse(0, -36, 17, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e9e9ef'; ctx.globalAlpha = 0.85; circle(ctx, -6, -38, 4); ctx.fill(); circle(ctx, 6, -38, 4); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#9b8bb5'; ctx.beginPath(); ctx.arc(0, -44, 21, Math.PI, TAU); ctx.fill();
    ctx.strokeStyle = '#c9b8e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 30); ctx.quadraticCurveTo(0, 20 + Math.sin(t) * 2, 14, 30); ctx.stroke();
  }
  function pell(ctx, t) { // the shopkeeper, a tinker with many arms of wire
    ctx.fillStyle = '#2d3a2a'; ctx.beginPath(); ctx.ellipse(0, 30, 44, 50, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffcf6e'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4 + Math.sin(t * 2 + i) * 0.15;
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(Math.cos(a) * 50, Math.sin(a) * 50 - 20, Math.cos(a) * 75, Math.sin(a) * 40 - 10); ctx.stroke();
      ctx.fillStyle = ['#7cf7ff', '#ff5fa2', '#ffcf6e', '#8cff8c'][i]; circle(ctx, Math.cos(a) * 75, Math.sin(a) * 40 - 10, 5); ctx.fill();
    }
    ctx.fillStyle = '#4d6346'; circle(ctx, 0, -30, 26); ctx.fill();
    eye(ctx, -9, -32, 7, t, '#ffcf6e', Math.sin(t)); eye(ctx, 9, -32, 7, t + 1, '#ffcf6e', Math.sin(t));
    ctx.fillStyle = '#1a2418'; ctx.fillRect(-10, -16, 20, 4);
  }

  // ----------------------------------------------------------------- FOES
  const FOE = {
    fuzz(ctx, t, p) {
      const n = 40;
      ctx.strokeStyle = p.a; ctx.lineWidth = 3; glow(ctx, p.a, 10);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = i / n * TAU, r = 52 + (i % 2 ? 14 : 0) * (0.6 + 0.4 * vn(i + Math.floor(t * 12)));
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); noGlow(ctx);
      ctx.fillStyle = '#0f2e33'; circle(ctx, 0, 0, 50); ctx.fill();
      eye(ctx, -16, -6, 12, t, p.b, Math.sin(t)); eye(ctx, 16, -6, 12, t + 2, p.b, Math.sin(t));
      ctx.strokeStyle = p.b; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 20); for (let i = 0; i < 6; i++) ctx.lineTo(-12 + i * 5, 20 + (i % 2 ? 5 : 0)); ctx.stroke();
    },
    crackle(ctx, t, p) {
      glow(ctx, p.b, 20); ctx.strokeStyle = p.b; ctx.lineWidth = 4;
      for (let b = 0; b < 5; b++) {
        ctx.beginPath(); let x = 0, y = -70;
        ctx.moveTo(x, y);
        for (let i = 0; i < 7; i++) { x += (vn(b * 9 + i + Math.floor(t * 8)) - 0.5) * 40; y += 22; ctx.lineTo(x + (b - 2) * i * 4, y); }
        ctx.stroke();
      }
      noGlow(ctx);
      ctx.fillStyle = '#2a1d07'; circle(ctx, 0, -10, 30); ctx.fill();
      ctx.strokeStyle = p.b; ctx.lineWidth = 2; ctx.stroke();
      eye(ctx, 0, -12, 14, t, '#fff6c8');
    },
    moth(ctx, t, p) {
      const f = Math.sin(t * 10) * 0.35;
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(f * s * 0.5);
        ctx.fillStyle = p.c; ctx.strokeStyle = p.a; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.bezierCurveTo(40, -80, 100, -40, 80, 10); ctx.bezierCurveTo(70, 40, 30, 30, 4, 10); ctx.fill(); ctx.stroke();
        staticSpeckleClip(ctx, t);
        ctx.fillStyle = p.b; circle(ctx, 52, -18, 9); ctx.fill(); ctx.fillStyle = '#000'; circle(ctx, 52, -18, 4); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#d8d0b0'; ctx.beginPath(); ctx.ellipse(0, 5, 8, 34, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8d0b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -28); ctx.quadraticCurveTo(-14, -50, -22, -48); ctx.moveTo(3, -28); ctx.quadraticCurveTo(14, -50, 22, -48); ctx.stroke();
    },
    tick(ctx, t, p) {
      ctx.strokeStyle = p.b; ctx.lineWidth = 4;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const k = Math.sin(t * 6 + i * 2 + s) * 6;
        ctx.beginPath(); ctx.moveTo(s * 30, 20 + i * 10); ctx.lineTo(s * 60, 40 + i * 8 + k); ctx.lineTo(s * 70, 70 + i * 4); ctx.stroke();
      }
      ctx.fillStyle = '#efe6cf'; circle(ctx, 0, 0, 50); ctx.fill(); ctx.strokeStyle = '#6b5b3b'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#6b5b3b';
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillRect(Math.cos(a) * 40 - 2, Math.sin(a) * 40 - 2, 4, 4); }
      const a1 = t * 2, a2 = t * 0.4;
      ctx.lineWidth = 4; ctx.strokeStyle = p.d;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * 34, Math.sin(a1) * 34); ctx.stroke();
      ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a2) * 22, Math.sin(a2) * 22); ctx.stroke();
      eye(ctx, -14, -16, 6, t, p.d); eye(ctx, 14, -16, 6, t + 1, p.d);
    },
    wire(ctx, t, p) {
      ctx.lineWidth = 3;
      for (let k = 0; k < 7; k++) {
        ctx.strokeStyle = k % 2 ? p.a : '#9aa7b0'; ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = i / 40 * TAU * 2 + k;
          const r = 30 + 35 * Math.sin(a * 1.5 + t * (0.5 + k * 0.1));
          const x = Math.cos(a + k) * r, y = Math.sin(a * 1.1 + k) * r * 0.9;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      eye(ctx, -12, -4, 10, t, p.d, Math.sin(t)); eye(ctx, 14, -8, 8, t + 3, p.d, Math.sin(t));
    },
    lamp(ctx, t, p) {
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(0, -60); ctx.stroke();
      ctx.fillStyle = '#3a3226'; ctx.fillRect(-36, -60, 72, 10); ctx.fillRect(-36, 50, 72, 12);
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 3; ctx.strokeRect(-30, -50, 60, 100);
      const fl = 1 + Math.sin(t * 9) * 0.1 + vn(Math.floor(t * 15)) * 0.1;
      glow(ctx, p.b, 40); ctx.fillStyle = p.b;
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(-22 * fl, 0, 0, -38 * fl); ctx.quadraticCurveTo(22 * fl, 0, 0, 30); ctx.fill(); noGlow(ctx);
      ctx.fillStyle = '#fff'; circle(ctx, 0, 8, 7); ctx.fill();
      eye(ctx, 0, 8, 6, t, p.d);
    },
    shuffler(ctx, t, p) {
      // a tall figure made of cards, fanning a hand
      for (let i = 0; i < 9; i++) {
        const a = -0.9 + i * 0.22 + Math.sin(t * 1.5) * 0.08;
        ctx.save(); ctx.translate(0, 10); ctx.rotate(a);
        ctx.fillStyle = i % 2 ? '#f2e8d0' : '#e6d6b0'; ctx.strokeStyle = p.d; ctx.lineWidth = 2;
        ctx.fillRect(-14, -110, 28, 44); ctx.strokeRect(-14, -110, 28, 44);
        ctx.fillStyle = i % 3 ? p.d : '#222'; circle(ctx, 0, -88, 5); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#2b1b2f'; ctx.beginPath(); ctx.moveTo(-40, 90); ctx.lineTo(-24, -20); ctx.lineTo(24, -20); ctx.lineTo(40, 90); ctx.fill();
      ctx.fillStyle = '#f2e8d0'; ctx.fillRect(-20, -52, 40, 34); ctx.strokeStyle = p.d; ctx.strokeRect(-20, -52, 40, 34);
      eye(ctx, -8, -36, 6, t, p.d); eye(ctx, 8, -36, 6, t + 1, p.d);
      // flying cards
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.7 + i / 4) % 1;
        ctx.save(); ctx.translate(Math.cos(i * 2 + k * 6) * 80, -40 + Math.sin(k * TAU) * 50); ctx.rotate(k * 8);
        ctx.fillStyle = '#f2e8d0'; ctx.globalAlpha = 0.8; ctx.fillRect(-8, -12, 16, 24); ctx.globalAlpha = 1; ctx.restore();
      }
    },
    echo(ctx, t, p) {
      for (let i = 4; i >= 0; i--) {
        const k = (t * 0.6 + i * 0.25) % 1.25;
        ctx.strokeStyle = p.a; ctx.globalAlpha = Math.max(0, 1 - k) * 0.7; ctx.lineWidth = 3;
        circle(ctx, 0, 0, 30 + k * 60); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8e0ff'; ctx.beginPath(); ctx.ellipse(0, 0, 32, 40, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1030'; ctx.beginPath(); ctx.ellipse(-11, -6, 6, 9, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(11, -6, 6, 9, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 18, 7, 4 + Math.abs(Math.sin(t * 3)) * 6, 0, 0, TAU); ctx.fill();
    },
    bell(ctx, t, p) {
      const sw = Math.sin(t * 2) * 0.15;
      ctx.save(); ctx.rotate(sw);
      ctx.fillStyle = '#b08a3a'; ctx.strokeStyle = p.b; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, -70); ctx.quadraticCurveTo(-50, -60, -54, 30); ctx.lineTo(-66, 46); ctx.lineTo(66, 46); ctx.lineTo(54, 30); ctx.quadraticCurveTo(50, -60, 14, -70); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a0e06'; ctx.beginPath(); ctx.ellipse(0, 46, 60, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 4, 42); ctx.lineTo(i * 10, 54); ctx.lineTo(i * 10 + 4, 42); ctx.fill(); }
      eye(ctx, -18, -10, 9, t, p.d); eye(ctx, 18, -10, 9, t + 1, p.d);
      ctx.restore();
    },
    wisp(ctx, t, p) {
      for (let i = 0; i < 2; i++) {
        const a = t * 1.6 + i * Math.PI;
        const x = Math.cos(a) * 44, y = Math.sin(a) * 18;
        const col = i ? p.a : p.b;
        glow(ctx, col, 30); ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.quadraticCurveTo(x - 24, y, x, y - 40 - Math.sin(t * 7 + i) * 8); ctx.quadraticCurveTo(x + 24, y, x, y + 26); ctx.fill(); noGlow(ctx);
        ctx.fillStyle = '#fff'; circle(ctx, x - 5, y, 3); ctx.fill(); circle(ctx, x + 5, y, 3); ctx.fill();
      }
    },
    sentinel(ctx, t, p) {
      ctx.fillStyle = '#2b2440'; ctx.beginPath(); ctx.moveTo(-34, 90); ctx.lineTo(-26, -90); ctx.lineTo(26, -90); ctx.lineTo(34, 90); ctx.fill();
      ctx.strokeStyle = p.a; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = p.a; ctx.globalAlpha = 0.4;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-26, -60 + i * 26); ctx.lineTo(26, -60 + i * 26); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const look = Math.sin(t * 0.7) * 10;
      glow(ctx, p.b, 24); ctx.fillStyle = p.b; ctx.beginPath(); ctx.ellipse(look * 0.5, -40, 18, 9, 0, 0, TAU); ctx.fill(); noGlow(ctx);
      ctx.fillStyle = '#000'; circle(ctx, look, -40, 5); ctx.fill();
    },
    choir(ctx, t, p) {
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 34, h = 70 + (i % 2) * 24;
        const y = Math.sin(t * 2 + i) * 6;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = 'rgba(200,230,255,0.25)'; ctx.strokeStyle = p.d; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(14, -h * 0.3); ctx.lineTo(10, h * 0.6); ctx.lineTo(-10, h * 0.6); ctx.lineTo(-14, -h * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#100820'; ctx.beginPath(); ctx.ellipse(0, -h * 0.2, 5, 3 + Math.abs(Math.sin(t * 4 + i)) * 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = p.b; circle(ctx, -4, -h * 0.45, 2.5); ctx.fill(); circle(ctx, 4, -h * 0.45, 2.5); ctx.fill();
        ctx.restore();
      }
    },
    warden(ctx, t, p) {
      ctx.fillStyle = '#3a3550'; ctx.strokeStyle = p.a; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-60, 90); ctx.lineTo(-50, -10); ctx.lineTo(-30, -30); ctx.lineTo(30, -30); ctx.lineTo(50, -10); ctx.lineTo(60, 90); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-28, -30); ctx.lineTo(-24, -86); ctx.quadraticCurveTo(0, -100, 24, -86); ctx.lineTo(28, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.fillRect(-18, -66, 36, 8);
      glow(ctx, p.b, 16); ctx.fillStyle = p.b; ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.4; ctx.fillRect(-14, -64, 28, 4); ctx.globalAlpha = 1; noGlow(ctx);
      // hollow chest: you can see the static through it
      ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(0, 26, 22, 30, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 26, 22, 30, 0, 0, TAU); ctx.clip(); staticSpeckle(ctx, 200, 200, t, 60, p.a, 0.8); ctx.restore();
    },
    queen(ctx, t, p) {
      // two mirrored halves of a face, a crown of shards
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1);
        ctx.fillStyle = s < 0 ? '#e9dcff' : '#cdb8f5';
        ctx.beginPath(); ctx.moveTo(0, -60); ctx.quadraticCurveTo(52, -50, 46, 10); ctx.quadraticCurveTo(36, 60, 0, 70); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#180c2b'; ctx.beginPath(); ctx.ellipse(18, -10, 9, 6, 0.2, 0, TAU); ctx.fill();
        glow(ctx, p.b, 14); ctx.fillStyle = p.b; circle(ctx, 18 + Math.sin(t) * 2 * s, -10, 3); ctx.fill(); noGlow(ctx);
        ctx.restore();
      }
      ctx.strokeStyle = p.a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 70); ctx.stroke();
      ctx.fillStyle = '#180c2b'; ctx.fillRect(-12, 34, 24, 3);
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 14, h = 28 + (3 - Math.abs(i - 3)) * 10 + Math.sin(t * 2 + i) * 3;
        glow(ctx, p.a, 10); ctx.fillStyle = i % 2 ? p.a : p.b;
        ctx.beginPath(); ctx.moveTo(x - 6, -58); ctx.lineTo(x, -58 - h); ctx.lineTo(x + 6, -58); ctx.fill(); noGlow(ctx);
      }
    },
    hound(ctx, t, p) {
      const run = Math.sin(t * 8) * 6;
      ctx.fillStyle = '#0c0606'; ctx.strokeStyle = p.a; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-40, -30); ctx.lineTo(30, -26); ctx.lineTo(60, -56); ctx.lineTo(86, -40); ctx.lineTo(70, -20); ctx.lineTo(40, 4); ctx.lineTo(-60, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-50, 10); ctx.lineTo(-60 + run, 60); ctx.moveTo(-20, 12); ctx.lineTo(-14 - run, 60); ctx.moveTo(20, 6); ctx.lineTo(28 + run, 60); ctx.moveTo(40, 4); ctx.lineTo(52 - run, 60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-104, -20 + run); ctx.stroke();
      glow(ctx, p.b, 14); ctx.fillStyle = p.b; circle(ctx, 66, -42, 4); ctx.fill(); noGlow(ctx);
      ctx.fillStyle = p.a; for (let i = 0; i < 5; i++) ctx.fillRect(74 + i * 3, -26, 2, 6);
    },
    coil(ctx, t, p) {
      ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 6;
      const sq = 1 + Math.sin(t * 3) * 0.12;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = i / 120 * TAU * 6, y = (i / 120 - 0.5) * 140 * sq;
        const x = Math.cos(a) * 40;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      glow(ctx, p.b, 20); ctx.strokeStyle = p.b; ctx.lineWidth = 2;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath(); let x = (vn(s + Math.floor(t * 10)) - 0.5) * 80, y = -70;
        ctx.moveTo(x, y); for (let i = 0; i < 5; i++) { x += (vn(s * 5 + i + Math.floor(t * 10)) - 0.5) * 30; y += 28; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      noGlow(ctx);
      eye(ctx, 0, -80 * sq, 12, t, p.d);
    },
    golem(ctx, t, p) {
      const blocks = [[-40, -70, 80, 50], [-60, -18, 120, 70], [-56, 54, 40, 40], [16, 54, 40, 40], [-92, -14, 30, 60], [62, -14, 30, 60]];
      for (const [x, y, w, h] of blocks) {
        ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x, y, w, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y); staticSpeckle(ctx, w, h, t, w * h / 30, p.a, 0.5); ctx.restore();
        ctx.strokeStyle = p.a; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      }
      glow(ctx, p.b, 18); ctx.fillStyle = p.b; ctx.fillRect(-26, -50, 16, 8); ctx.fillRect(10, -50, 16, 8); noGlow(ctx);
    },
    blot(ctx, t, p) {
      ctx.fillStyle = '#060304';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = i / 24 * TAU;
        const r = 56 + Math.sin(a * 3 + t * 2) * 10 + Math.sin(a * 5 - t * 3) * 6;
        const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.85;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.fill(); ctx.strokeStyle = p.a; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 5; i++) { const k = (t * 0.5 + i / 5) % 1; ctx.fillStyle = '#060304'; circle(ctx, (i - 2) * 22, 50 + k * 50, 6 * (1 - k)); ctx.fill(); }
      eye(ctx, -18, -10, 10, t, p.b); eye(ctx, 18, -14, 7, t + 4, p.b);
    },
    eater(ctx, t, p) {
      const open = 0.35 + Math.abs(Math.sin(t * 1.5)) * 0.4;
      ctx.fillStyle = '#5a1e1e'; ctx.strokeStyle = p.a; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 80, -Math.PI + open, -open); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 80, open, Math.PI - open); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f5ecd8';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI + open + i / 8 * (Math.PI - 2 * open);
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 76, Math.sin(a) * 76); ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58 + 6); ctx.lineTo(Math.cos(a + 0.1) * 76, Math.sin(a + 0.1) * 76); ctx.fill();
      }
      for (let i = 0; i < 6; i++) { const k = (t * 0.8 + i / 6) % 1; glow(ctx, p.b, 8); ctx.fillStyle = p.b; circle(ctx, -100 + k * 100, Math.sin(i * 3) * 20 * (1 - k), 4); ctx.fill(); noGlow(ctx); }
      eye(ctx, 0, -62, 10, t, p.b);
    },
    twins(ctx, t, p) {
      const off = Math.sin(t * 1.4) * 8;
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(s * (46 + off), Math.sin(t * 2 + s) * 6); ctx.rotate(s * 0.12 + Math.sin(t + s) * 0.05);
        ctx.fillStyle = s < 0 ? '#efe6e0' : '#1c1414'; ctx.strokeStyle = p.a; ctx.lineWidth = 3;
        roundRect(ctx, -38, -38, 76, 76, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = s < 0 ? '#1c1414' : '#efe6e0';
        const pips = s < 0 ? [[-18, -18], [18, 18], [0, 0]] : [[-18, -18], [18, -18], [-18, 18], [18, 18]];
        for (const [x, y] of pips) { circle(ctx, x, y, 7); ctx.fill(); }
        ctx.restore();
      }
    },
    rndm(ctx, t, p) {
      // the Generator gone wild: a giant eye inside rings of digits
      ctx.save();
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let r = 0; r < 3; r++) {
        const rad = 70 + r * 22, n = 18 + r * 6;
        ctx.fillStyle = [p.a, p.b, p.d][r];
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + t * (r % 2 ? -0.4 : 0.3);
          ctx.fillText(String(Math.floor(vn(i * 7 + r * 31 + Math.floor(t * 6)) * 10)), Math.cos(a) * rad, Math.sin(a) * rad);
        }
      }
      ctx.restore();
      ctx.fillStyle = '#f7f0e6'; ctx.beginPath(); ctx.ellipse(0, 0, 58, 36, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = p.a; ctx.lineWidth = 3; ctx.stroke();
      const lx = Math.sin(t * 0.8) * 16 + (vn(Math.floor(t * 3)) - 0.5) * 10;
      glow(ctx, p.a, 30); ctx.fillStyle = p.a; circle(ctx, lx, 0, 22); ctx.fill(); noGlow(ctx);
      ctx.fillStyle = '#000'; circle(ctx, lx, 0, 10); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, lx - 6, -6, 4); ctx.fill();
      // glitch slices
      if (vn(Math.floor(t * 5)) > 0.7) { ctx.fillStyle = p.b; ctx.globalAlpha = 0.6; ctx.fillRect(-90, (vn(Math.floor(t * 9)) - 0.5) * 80, 180, 4); ctx.globalAlpha = 1; }
    },
  };
  function staticSpeckleClip(ctx, t) {
    ctx.save(); ctx.clip(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35;
    const f = Math.floor(t * 18);
    for (let i = 0; i < 70; i++) ctx.fillRect(vn(i + f) * 100, vn(i * 3 + f) * 100 - 60, 2, 2);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Draw a foe centred in a canvas. hurt: 0..1 flash amount.
  function foe(ctx, w, h, art, act, t, hurt, dying) {
    const p = PAL[act] || PAL[1];
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const s = Math.min(w, h) / 240;
    const shake = hurt ? (vn(Math.floor(t * 60)) - 0.5) * 14 * hurt : 0;
    ctx.translate(w / 2 + shake, h / 2 + 6);
    ctx.scale(s, s);
    if (dying) { ctx.globalAlpha = Math.max(0, 1 - dying); ctx.scale(1 + dying * 0.4, 1 - dying * 0.6); }
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 100, 70, 12, 0, 0, TAU); ctx.fill();
    (FOE[art] || FOE.fuzz)(ctx, t, p);
    if (hurt) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,' + (hurt * 0.7) + ')'; ctx.fillRect(-150, -150, 300, 300); }
    ctx.restore();
  }
  function person(ctx, w, h, who, t, opt) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const s = Math.min(w, h) / 200;
    ctx.translate(w / 2, h / 2 + 10); ctx.scale(s, s);
    if (opt && opt.hurt) ctx.translate((vn(Math.floor(t * 60)) - 0.5) * 12 * opt.hurt, 0);
    ({ ix, vell, oma, pell })[who](ctx, t, opt);
    if (opt && opt.hurt) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,80,80,' + opt.hurt * 0.6 + ')'; ctx.fillRect(-120, -120, 240, 240); }
    ctx.restore();
  }

  // --------------------------------------------------------------- TOKENS
  const TOKCOL = {
    strike: '#ff6a5c', twin: '#ff6a5c', heavy: '#ff3d3d', pierce: '#ff8f5c', bash: '#ff7b9c', fuse: '#ffa53d', crescendo: '#ff5fa2', leech: '#e05cff',
    guard: '#5cb8ff', bulwark: '#3d8bff', ward: '#7cc8ff', calm: '#8cffd9', ground: '#9ad17c',
    spark: '#ffd84d', cache: '#ffcf6e', seer: '#7cf7ff', prism: '#ffffff', echo: '#c77dff',
    static: '#9aa3ad', glitch: '#b6ff4d', hiss: '#d0d0d0', blank: '#55585e',
  };
  function tokenIcon(ctx, id, s, up) {
    const c = TOKCOL[id] || '#fff';
    ctx.save(); ctx.translate(s / 2, s / 2); const k = s / 64; ctx.scale(k, k);
    // disc
    const g = ctx.createRadialGradient(-8, -10, 4, 0, 0, 30);
    g.addColorStop(0, '#2a3448'); g.addColorStop(1, '#0d121c');
    ctx.fillStyle = g; circle(ctx, 0, 0, 29); ctx.fill();
    ctx.lineWidth = up ? 4 : 2.5; ctx.strokeStyle = up ? '#ffe9a8' : c; glow(ctx, c, up ? 10 : 4); ctx.stroke(); noGlow(ctx);
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const L = (pts) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
    switch (id) {
      case 'strike': L([[-12, 12], [12, -12]]); L([[4, -14], [12, -12], [14, -4]]); break;
      case 'twin': L([[-14, 8], [6, -12]]); L([[-6, 14], [14, -6]]); break;
      case 'heavy': ctx.lineWidth = 7; L([[-12, 12], [12, -12]]); ctx.lineWidth = 3.5; L([[2, -14], [12, -12], [14, -2]]); break;
      case 'pierce': L([[-16, 0], [14, 0]]); L([[6, -7], [14, 0], [6, 7]]); L([[-4, -10], [-4, 10]]); break;
      case 'bash': roundRect(ctx, -12, -12, 18, 22, 4); ctx.stroke(); L([[8, -4], [16, -10]]); L([[8, 2], [17, 2]]); L([[8, 8], [16, 14]]); break;
      case 'fuse': L([[-10, 12], [0, -2], [10, 12]]); ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(-4, -10, 4, -16); ctx.stroke(); circle(ctx, 5, -17, 3); ctx.fill(); break;
      case 'crescendo': for (let i = 0; i < 4; i++) ctx.fillRect(-14 + i * 8, 10 - i * 7, 5, 4 + i * 7); break;
      case 'leech': ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-18, 0, -8, -16, 0, -6); ctx.bezierCurveTo(8, -16, 18, 0, 0, 14); ctx.stroke(); L([[-4, 0], [4, 0]]); L([[0, -4], [0, 4]]); break;
      case 'guard': ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(13, -9); ctx.lineTo(11, 6); ctx.lineTo(0, 15); ctx.lineTo(-11, 6); ctx.lineTo(-13, -9); ctx.closePath(); ctx.stroke(); break;
      case 'bulwark': ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(13, -9); ctx.lineTo(11, 6); ctx.lineTo(0, 15); ctx.lineTo(-11, 6); ctx.lineTo(-13, -9); ctx.closePath(); ctx.stroke(); break;
      case 'ward': ctx.beginPath(); ctx.arc(0, 4, 14, Math.PI, TAU); ctx.stroke(); L([[-6, 4], [-2, -2], [2, 4], [6, -2]]); break;
      case 'calm': ctx.beginPath(); for (let x = -14; x <= 14; x += 2) { const y = Math.sin(x * 0.4) * 3; x === -14 ? ctx.moveTo(x, y - 5) : ctx.lineTo(x, y - 5); } ctx.stroke(); L([[-14, 6], [14, 6]]); break;
      case 'ground': L([[0, -14], [0, 4]]); L([[-12, 4], [12, 4]]); L([[-8, 9], [8, 9]]); L([[-4, 14], [4, 14]]); break;
      case 'spark': ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 6 : 15; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); } ctx.closePath(); ctx.fill(); break;
      case 'cache': roundRect(ctx, -13, -8, 26, 20, 3); ctx.stroke(); L([[-13, -2], [13, -2]]); ctx.fillRect(-3, -5, 6, 7); break;
      case 'seer': ctx.beginPath(); ctx.ellipse(0, 0, 15, 9, 0, 0, TAU); ctx.stroke(); circle(ctx, 0, 0, 4.5); ctx.fill(); break;
      case 'prism': ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(13, 10); ctx.lineTo(-13, 10); ctx.closePath(); ctx.stroke(); ctx.strokeStyle = '#ff5fa2'; L([[6, 0], [18, 6]]); ctx.strokeStyle = '#7cf7ff'; L([[7, 3], [17, 12]]); break;
      case 'echo': for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 1 - i * 0.25; ctx.beginPath(); ctx.arc(-6, 0, i * 5, -1, 1); ctx.stroke(); } ctx.globalAlpha = 1; break;
      case 'static': for (let i = 0; i < 14; i++) ctx.fillRect((vn(i) - 0.5) * 30, (vn(i * 9) - 0.5) * 30, 3, 3); L([[-12, -2], [-6, 4], [0, -4], [6, 4], [12, -2]]); break;
      case 'glitch': ctx.fillRect(-14, -10, 16, 6); ctx.fillRect(-6, -2, 20, 6); ctx.fillRect(-12, 6, 12, 6); break;
      case 'hiss': L([[-14, -6], [-7, 2], [0, -6], [7, 2], [14, -6]]); L([[-14, 6], [-7, 14], [0, 6], [7, 14], [14, 6]]); break;
      case 'blank': circle(ctx, 0, 0, 10); ctx.stroke(); break;
    }
    ctx.restore();
  }
  const iconCache = {};
  function tokenURL(id, up) {
    const k = id + (up ? '+' : '');
    if (iconCache[k]) return iconCache[k];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    tokenIcon(c.getContext('2d'), id, 96, up);
    return (iconCache[k] = c.toDataURL());
  }

  // relic icons: small glyphs on a gem
  function relicIcon(ctx, id, s) {
    const cols = { lens: '#7cf7ff', rod: '#ffd84d', capacitor: '#5cb8ff', battery: '#8cff8c', siphon: '#e05cff', metronome: '#ffa53d', abacus: '#ffcf6e', dampener: '#9aa3ad', thorn: '#ff6a5c', coolant: '#7cc8ff', magnet: '#ff3d3d', heart: '#ff5fa2', scrubber: '#b6ff4d', loupe: '#ffffff', keel: '#c77dff' };
    const c = cols[id] || '#fff';
    ctx.save(); ctx.translate(s / 2, s / 2); const k = s / 64; ctx.scale(k, k);
    ctx.fillStyle = '#121826'; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(26, -10); ctx.lineTo(18, 24); ctx.lineTo(-18, 24); ctx.lineTo(-26, -10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 3; glow(ctx, c, 8); ctx.stroke(); noGlow(ctx);
    ctx.fillStyle = c; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const glyph = { lens: '◎', rod: 'ϟ', capacitor: '⊣⊢', battery: '▮', siphon: '♥', metronome: '♩', abacus: '∷', dampener: '≈', thorn: '✶', coolant: '❄', magnet: 'U', heart: '❤', scrubber: '✕', loupe: '⊙', keel: '⚓' }[id] || '?';
    ctx.fillText(glyph, 0, 2);
    ctx.restore();
  }
  const relicCache = {};
  function relicURL(id) {
    if (relicCache[id]) return relicCache[id];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    relicIcon(c.getContext('2d'), id, 96);
    return (relicCache[id] = c.toDataURL());
  }

  // --------------------------------------------------------------- SCENES
  // Cutscene and event pictures. Each draws into a w x h canvas at time t.
  const SCENE = {
    generator(ctx, w, h, t) {
      background(ctx, w, h, 0, t, true);
      ctx.save(); ctx.translate(w / 2, h * 0.5);
      const s = h / 360; ctx.scale(s, s);
      for (let g = 0; g < 3; g++) {
        ctx.save(); ctx.translate((g - 1) * 110, (g % 2) * 30 - 20); ctx.rotate(t * (g % 2 ? -0.4 : 0.5));
        ctx.strokeStyle = '#ffcf6e'; ctx.lineWidth = 6; circle(ctx, 0, 0, 50 - g * 6); ctx.stroke();
        for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i / 10 * TAU); ctx.fillStyle = '#ffcf6e'; ctx.fillRect(-5, -62 + g * 6, 10, 14); ctx.restore(); }
        ctx.restore();
      }
      for (let i = 0; i < 12; i++) {
        const k = (t * 0.3 + i / 12) % 1;
        ctx.save(); ctx.translate(-180 + k * 360, 120 - Math.sin(k * Math.PI) * 220); ctx.rotate(k * 6 + i);
        ctx.fillStyle = '#f2e8d0'; ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillRect(-9, -13, 18, 26);
        ctx.fillStyle = ['#ff6a5c', '#5cb8ff', '#ffd84d'][i % 3]; circle(ctx, 0, 0, 4); ctx.fill(); ctx.restore();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    },
    breaking(ctx, w, h, t) {
      SCENE.generator(ctx, w, h, t);
      staticSpeckle(ctx, w, h, t, 900, '#ffffff', 0.5);
      ctx.fillStyle = '#ff5fa2'; ctx.globalAlpha = 0.5;
      for (let i = 0; i < 6; i++) ctx.fillRect(0, vn(i + Math.floor(t * 8)) * h, w, 3 + vn(i * 3) * 8);
      ctx.globalAlpha = 1;
    },
    fields(ctx, w, h, t) {
      background(ctx, w, h, 1, t);
      ctx.save(); ctx.translate(w * 0.3, h * 0.72); const s = h / 420; ctx.scale(s, s); ix(ctx, t, { look: 3 }); ctx.restore();
    },
    vell(ctx, w, h, t) {
      background(ctx, w, h, 0, t * 0.3, true);
      ctx.fillStyle = 'rgba(255,207,110,0.08)'; for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.05 + i * w * 0.16, h * 0.1, w * 0.12, h * 0.8);
      ctx.save(); ctx.translate(w * 0.32, h * 0.62); ctx.scale(h / 330, h / 330); vell(ctx, t); ctx.restore();
      ctx.save(); ctx.translate(w * 0.7, h * 0.66); ctx.scale(h / 380, h / 380); ix(ctx, t, { look: -3 }); ctx.restore();
    },
    bagScene(ctx, w, h, t) {
      background(ctx, w, h, 0, t, true);
      ctx.save(); ctx.translate(w / 2, h * 0.55); const s = h / 300; ctx.scale(s, s);
      ctx.fillStyle = '#5a3d2b'; ctx.beginPath(); ctx.ellipse(0, 20, 60, 66, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a6346'; ctx.lineWidth = 4; ctx.stroke();
      const ids = ['strike', 'guard', 'spark', 'static', 'strike', 'guard'];
      ids.forEach((id, i) => {
        const a = -Math.PI / 2 + (i - 2.5) * 0.4, r = 90 + Math.sin(t * 2 + i) * 8;
        ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r * 0.7 - 10); tokenIcon(ctx, id, 44); ctx.restore();
      });
      ctx.restore();
    },
    halls(ctx, w, h, t) { background(ctx, w, h, 2, t); ctx.save(); ctx.translate(w * 0.5, h * 0.74); ctx.scale(h / 460, h / 460); ix(ctx, t, { col: '#c77dff' }); ctx.restore(); },
    core(ctx, w, h, t) { background(ctx, w, h, 3, t); ctx.save(); ctx.translate(w * 0.5, h * 0.78); ctx.scale(h / 520, h / 520); ix(ctx, t, { col: '#ffe9a8' }); ctx.restore(); },
    shufflerFall(ctx, w, h, t) {
      background(ctx, w, h, 1, t);
      for (let i = 0; i < 40; i++) {
        const k = (t * 0.25 + vn(i)) % 1;
        ctx.save(); ctx.translate(vn(i * 3) * w, k * h * 1.1 - 20); ctx.rotate(k * 10 + i);
        ctx.fillStyle = '#f2e8d0'; ctx.globalAlpha = 0.85; ctx.fillRect(-8, -12, 16, 24); ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
    queenFall(ctx, w, h, t) {
      background(ctx, w, h, 2, t);
      ctx.save(); ctx.translate(w / 2, h / 2); const s = h / 300; ctx.scale(s, s);
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * (20 + t * 10), 0); ctx.rotate(sd * t * 0.1); ctx.globalAlpha = Math.max(0, 1 - t * 0.12); FOE.queen(ctx, t, PAL[2]); ctx.restore(); }
      ctx.restore(); ctx.globalAlpha = 1;
    },
    rndmScene(ctx, w, h, t) {
      background(ctx, w, h, 3, t);
      ctx.save(); ctx.translate(w / 2, h * 0.45); const s = h / 300; ctx.scale(s, s); FOE.rndm(ctx, t, PAL[3]); ctx.restore();
    },
    seed(ctx, w, h, t) {
      const k = Math.min(1, t / 6);
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h * 0.6, 4, w / 2, h * 0.6, h * (0.2 + k));
      g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.4, '#ff9f6e'); g.addColorStop(1, '#05070d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.translate(w / 2, h * 0.7); const s = h / 300; ctx.scale(s, s);
      ctx.strokeStyle = '#8cff8c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -40 * k, 0, -80 * k); ctx.stroke();
      if (k > 0.4) { ctx.fillStyle = '#8cff8c'; ctx.beginPath(); ctx.ellipse(-14, -50 * k, 14 * k, 6 * k, -0.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(14, -64 * k, 14 * k, 6 * k, 0.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#5a3d2b'; ctx.beginPath(); ctx.ellipse(0, 4, 30, 8, 0, 0, TAU); ctx.fill();
      ctx.restore();
    },
    dawn(ctx, w, h, t) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a3f6b'); g.addColorStop(0.6, '#ff9f6e'); g.addColorStop(1, '#3a2a2a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe9a8'; glow(ctx, '#ffe9a8', 40); circle(ctx, w * 0.5, h * 0.64, h * 0.12); ctx.fill(); noGlow(ctx);
      ctx.fillStyle = '#1d1a24'; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.7 + Math.sin(x * 0.02) * 14 + Math.sin(x * 0.05) * 6); ctx.lineTo(w, h); ctx.fill();
      // rain falling straight and fair
      ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) { const x = (i * 37) % w, y = ((t * 200 + i * 53) % (h * 0.8)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke(); }
      ctx.save(); ctx.translate(w * 0.35, h * 0.78); ctx.scale(h / 520, h / 520); ix(ctx, t, { look: 3 }); ctx.restore();
      ctx.save(); ctx.translate(w * 0.62, h * 0.78); ctx.scale(h / 460, h / 460); vell(ctx, t); ctx.restore();
    },
    fade(ctx, w, h, t) { background(ctx, w, h, 0, t * 0.2, true); staticSpeckle(ctx, w, h, t, 1600, '#9aa3ad', 0.5); },
    // event scenes
    oracle(ctx, w, h, t) { background(ctx, w, h, 0, t, true); sceneThing(ctx, w, h, t, 'oracle'); },
    bag(ctx, w, h, t) { SCENE.bagScene(ctx, w, h, t); },
    pool(ctx, w, h, t) { background(ctx, w, h, 0, t * 0.1, true); ctx.fillStyle = '#0d2236'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.7, w * 0.35, h * 0.12, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(124,247,255,0.3)'; for (let i = 0; i < 3; i++) { const k = (t * 0.2 + i / 3) % 1; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.7, w * 0.35 * k, h * 0.12 * k, 0, 0, TAU); ctx.stroke(); } },
    storm(ctx, w, h, t) { background(ctx, w, h, 1, t * 2); staticSpeckle(ctx, w, h, t, 1400, '#ffffff', 0.45); if (vn(Math.floor(t * 3)) > 0.75) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, w, h); } },
    tuner(ctx, w, h, t) { background(ctx, w, h, 0, t, true); ctx.save(); ctx.translate(w * 0.5, h * 0.66); ctx.scale(h / 330, h / 330); oma(ctx, t); ctx.strokeStyle = '#efe7d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(50, -60); ctx.moveTo(44, -60); ctx.lineTo(44, -80); ctx.moveTo(56, -60); ctx.lineTo(56, -80); ctx.stroke(); ctx.restore(); },
    mirror(ctx, w, h, t) { background(ctx, w, h, 2, t); ctx.save(); ctx.translate(w / 2, h * 0.55); const s = h / 300; ctx.scale(s, s); ctx.fillStyle = 'rgba(200,230,255,0.2)'; ctx.strokeStyle = '#e9dcff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -90); ctx.lineTo(30, -70); ctx.lineTo(24, 80); ctx.lineTo(-30, 70); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.translate(0, 10); ix(ctx, t, {}); ctx.restore(); ctx.globalAlpha = 1; },
    ghost(ctx, w, h, t) { background(ctx, w, h, 0, t, true); ctx.save(); ctx.translate(w / 2, h * 0.6); const s = h / 300; ctx.scale(s, s); ctx.globalAlpha = 0.7; ctx.fillStyle = '#d9e4ff'; ctx.beginPath(); ctx.moveTo(-40, 60); for (let i = 0; i <= 8; i++) ctx.lineTo(-40 + i * 10, 60 + (i % 2 ? 10 : 0) + Math.sin(t * 3 + i) * 3); ctx.lineTo(40, 60); ctx.quadraticCurveTo(46, -60, 0, -60); ctx.quadraticCurveTo(-46, -60, -40, 60); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(-30, -78, 60, 8); ctx.fillRect(-18, -100, 36, 24); ctx.globalAlpha = 1; ctx.fillStyle = '#111'; circle(ctx, -12, -24, 5); ctx.fill(); circle(ctx, 12, -24, 5); ctx.fill(); for (let i = 0; i < 3; i++) { ctx.fillStyle = '#b08a3a'; ctx.beginPath(); ctx.moveTo(-90 + i * 70, 110); ctx.lineTo(-74 + i * 70, 70); ctx.lineTo(-58 + i * 70, 70); ctx.lineTo(-42 + i * 70, 110); ctx.fill(); } ctx.restore(); },
    oma(ctx, w, h, t) { background(ctx, w, h, 0, t, true); ctx.save(); ctx.translate(w * 0.5, h * 0.66); ctx.scale(h / 330, h / 330); oma(ctx, t); ctx.restore(); ctx.fillStyle = '#5a3d2b'; ctx.fillRect(w * 0.2, h * 0.4, 8, h * 0.5); ctx.fillRect(w * 0.15, h * 0.42, w * 0.12, 14); },
    workshop(ctx, w, h, t) { background(ctx, w, h, 0, t, true); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(w * 0.1, h * 0.6, w * 0.8, 16); for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(w * (0.2 + i * 0.15), h * 0.54); relicIcon(ctx, ['battery', 'rod', 'thorn', 'magnet', 'coolant'][i], h * 0.12); ctx.restore(); } staticSpeckle(ctx, w, h, t, 200, '#b6ff4d', 0.4); },
    hum(ctx, w, h, t) { SCENE.core(ctx, w, h, t); ctx.strokeStyle = 'rgba(255,233,168,0.3)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); for (let x = 0; x <= w; x += 8) { const y = h * (0.2 + i * 0.08) + Math.sin(x * 0.03 + t * 2 + i) * 8; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); } },
    archive(ctx, w, h, t) { background(ctx, w, h, 0, t * 0.3, true); ctx.fillStyle = '#6b4a2a'; ctx.fillRect(w * 0.38, h * 0.5, w * 0.24, h * 0.24); ctx.strokeStyle = '#ffcf6e'; ctx.lineWidth = 3; ctx.strokeRect(w * 0.38, h * 0.5, w * 0.24, h * 0.24); ctx.fillStyle = '#ffcf6e'; ctx.font = 'bold ' + Math.floor(h * 0.08) + 'px serif'; ctx.textAlign = 'center'; ctx.fillText('V', w / 2, h * 0.66); },
    rest(ctx, w, h, t) {
      background(ctx, w, h, 0, t * 0.2, true);
      ctx.save(); ctx.translate(w / 2, h * 0.7); const s = h / 300; ctx.scale(s, s);
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(0, -40); ctx.stroke();
      glow(ctx, '#7cf7ff', 40); ctx.fillStyle = '#7cf7ff'; ctx.globalAlpha = 0.75 + Math.sin(t * 2) * 0.2; circle(ctx, 0, -50, 14); ctx.fill(); ctx.globalAlpha = 1; noGlow(ctx);
      ctx.translate(-80, 10); ix(ctx, t * 0.5, { look: 3 });
      ctx.restore();
    },
  };
  function sceneThing(ctx, w, h, t, what) {
    ctx.save(); ctx.translate(w / 2, h * 0.58); const s = h / 300; ctx.scale(s, s);
    ctx.fillStyle = '#3a3226'; roundRect(ctx, -50, -80, 100, 160, 12); ctx.fill(); ctx.strokeStyle = '#ffcf6e'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#0c1a24'; circle(ctx, 0, -30, 34); ctx.fill(); ctx.strokeStyle = '#7cf7ff'; ctx.stroke();
    ctx.save(); ctx.translate(0, -30); ctx.rotate(t); ctx.strokeStyle = '#ffcf6e'; for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 24); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = '#7cf7ff'; ctx.beginPath(); ctx.moveTo(-34, -40); ctx.lineTo(-10, -16); ctx.lineTo(4, -44); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.fillRect(-16, 30, 32, 6);
    ctx.fillStyle = '#ffcf6e'; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.fillText('FEED ME', 0, 60);
    ctx.restore();
  }
  function scene(ctx, w, h, id, t) { (SCENE[id] || SCENE.fade)(ctx, w, h, t); }

  // ----------------------------------------------------------------- LOGO
  function logo(ctx, w, h, t, intro) {
    const k = intro === undefined ? 1 : Math.min(1, intro);
    ctx.clearRect(0, 0, w, h);
    const fs = Math.min(w / 4.2, h * 0.7);
    ctx.font = '900 ' + fs + 'px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const txt = 'XRNDM';
    const glitch = k < 1 || vn(Math.floor(t * 4)) > 0.86;
    if (glitch) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#ff5fa2'; ctx.fillText(txt, w / 2 - 4 - (1 - k) * 30, h / 2);
      ctx.fillStyle = '#7cf7ff'; ctx.fillText(txt, w / 2 + 4 + (1 - k) * 30, h / 2);
      ctx.globalAlpha = 1;
    }
    glow(ctx, '#7cf7ff', 24); ctx.fillStyle = '#eaffff'; ctx.globalAlpha = k; ctx.fillText(txt, w / 2, h / 2); noGlow(ctx); ctx.globalAlpha = 1;
    // horizontal slices
    for (let i = 0; i < (glitch ? 4 : 0); i++) {
      const y = vn(i + Math.floor(t * 12)) * h, hh = 2 + vn(i * 5) * 10, dx = (vn(i * 7 + Math.floor(t * 12)) - 0.5) * 40;
      const img = ctx.getImageData(0, Math.max(0, Math.floor(y)), w, Math.max(1, Math.floor(Math.min(hh, h - y))));
      ctx.putImageData(img, dx, Math.floor(y));
    }
  }

  G.ART = { PAL, background, foe, person, tokenURL, relicURL, tokenIcon, scene, logo, TOKCOL, SCENES: Object.keys(SCENE), FOES: Object.keys(FOE) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
