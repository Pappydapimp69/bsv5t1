/* xrndm UI: screens, input, cutscenes and animation. Game rules live in core.js;
   this file only shows the run and sends the player's choices to XR.act. */
(function () {
  'use strict';
  const XR = window.XR, ART = window.ART, AU = window.AU;
  const $ = s => document.querySelector(s);
  const app = $('#app'), fx = $('#fx'), bg = $('#bg');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ STORAGE
  const store = {
    get(k, d) { try { const v = localStorage.getItem('xrndm.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('xrndm.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem('xrndm.' + k); } catch (e) { /* ignore */ } },
  };
  const S = {
    screen: 'splash', run: null, busy: false, modal: null, cut: null, menu: null, t: 0, help: 0,
    settings: Object.assign({ music: 0.55, sfx: 0.8, text: 'normal', shake: true, flash: true, tips: true }, store.get('settings', {})),
    tips: store.get('tips', {}), lastBlind: false,
    goals: store.get('goals', {}), best: store.get('best', { runs: 0, wins: 0, bestAct: 0 }),
    speed: 1, newSeed: '', newMode: 'standard', skipIntro: false, lastDrawn: -1, foeHurt: 0, ixHurt: 0, foeDying: 0, picker: null,
  };
  AU.settings.music = S.settings.music; AU.settings.sfx = S.settings.sfx;
  const sfx = n => AU.sfx(n);

  function randomSeed() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a = new Uint32Array(6);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = (Date.now() / (i + 1)) | 0; });
    return Array.from(a, x => abc[x % abc.length]).join('');
  }
  function saveRun() { if (S.run && S.run.screen !== 'dead' && S.run.screen !== 'victory') store.set('save', XR.save(S.run)); else store.del('save'); }
  function hasSave() { return !!store.get('save', null); }

  // ------------------------------------------------------------- STORY
  const CUTS = {
    intro: [
      { scene: 'generator', who: '', text: 'Once, there was the Generator. It dealt every chance in the world: the fall of rain, the turn of a card, the moment two strangers met. Nobody saw it work. Everybody trusted it.' },
      { scene: 'breaking', who: '', text: 'Then it began to hum. The odds came loose. Rain fell upward. Cards came up blank. Static poured out across the fields, and the hum took a name: RNDM.' },
      { scene: 'vell', who: 'Vell, the Archivist', text: 'Ix. You were born seeing two moments ahead. That is two more than anyone else alive.' },
      { scene: 'bagScene', who: 'Vell, the Archivist', text: 'Take this bag. Every chance you carry is in it: strikes, guards, sparks, and yes, some static. You cannot choose what you draw. But you choose what you carry, and you can see what is coming.' },
      { scene: 'fields', who: 'Vell, the Archivist', text: 'Cross the Static Fields. Go down through the Echo Halls. Find the Core, and give the world its seed back.' },
      { scene: 'fields', who: 'Ix', text: 'Two moments ahead. All right. Let\'s see how far that gets me.' },
    ],
    act1: [
      { scene: 'shufflerFall', who: '', text: 'The Shuffler comes apart into a hundred cards, and not one of them lands face up.' },
      { scene: 'halls', who: 'Vell (far away)', text: 'Below the Fields lie the Echo Halls. Everything you do there comes back to you. Hit softly, Ix, or be ready to be hit hard.' },
    ],
    act2: [
      { scene: 'queenFall', who: 'The Echo Queen', text: 'You see ahead, little Reader. I only ever saw behind. Go on, then. See what is waiting.' },
      { scene: 'core', who: '', text: 'The floor of the Halls gives way. Below is the Core, where the hum becomes a roar and the numbers never stop turning.' },
    ],
    ending: [
      { scene: 'rndmScene', who: 'RNDM', text: 'I GAVE EVERYONE EVERYTHING. AT RANDOM. WHAT WILL YOU GIVE THEM, READER?' },
      { scene: 'seed', who: 'Ix', text: 'Not certainty. Just fairness. Odds that someone can read.' },
      { scene: 'seed', who: '', text: 'Ix plants the seed in the heart of the Generator. The hum drops to a whisper, then to a steady tick.' },
      { scene: 'dawn', who: 'Vell, the Archivist', text: 'The rain falls down again. Cards come up as cards should. And the world remembers what it was seeded with.' },
      { scene: 'dawn', who: '', text: 'Your world was seeded with: {seed}' },
    ],
  };
  const ACT_MUSIC = { 1: 'act1', 2: 'act2', 3: 'act3' };
  const NODE_INFO = {
    fight: { name: 'Fight', col: '#ff6a5c', desc: 'A foe. Win tokens and bits.' },
    elite: { name: 'Elite', col: '#ff3dd0', desc: 'A strong foe. Carries a relic.' },
    event: { name: 'Event', col: '#7cf7ff', desc: 'Something strange. Choose what to do.' },
    shop: { name: 'Shop', col: '#ffcf6e', desc: 'Pell the Tinker trades for bits.' },
    rest: { name: 'Quiet', col: '#8cff8c', desc: 'Rest, tune a token, or filter out a curse.' },
    treasure: { name: 'Cache', col: '#ffe9a8', desc: 'A relic and some bits, free.' },
    boss: { name: 'Boss', col: '#ff4d4d', desc: 'The guardian of this layer.' },
  };

  // ------------------------------------------------------------- RENDER
  function go(screen) { S.screen = screen; S.modal = null; render(); }
  let lastRunScreen = null;
  function render() {
    let h = '';
    const r = S.run;
    const key = S.screen + ':' + (r ? r.screen : '');
    if (key !== lastRunScreen) fx.innerHTML = '';
    const fullKey = key + ':' + (S.modal ? S.modal.k : '') + ':' + (S.cut ? S.cut.id : '') + ':' + (r && r.screen === 'fight' && r.fight ? r.fight.turn + (S.busy ? 'b' : '') + (S.tipLock ? 'l' : '') : '');
    const sameScreen = fullKey === navKey;
    if (sameScreen) navRemember(); else navMem = null;
    lastRunScreen = key; navKey = fullKey;
    switch (S.screen) {
      case 'splash': h = splashHTML(); break;
      case 'title': h = titleHTML(); break;
      case 'newrun': h = newRunHTML(); break;
      case 'cut': h = cutHTML(); break;
      case 'goals': h = goalsHTML(); break;
      case 'help': h = helpHTML(); break;
      case 'settings': h = settingsHTML(); break;
      case 'credits': h = creditsHTML(); break;
      case 'run': h = runHTML(); break;
    }
    if (S.modal) h += modalHTML();
    app.innerHTML = h;
    bindCanvases();
    app.querySelectorAll('.card, [data-a]:not(button):not(input):not(.modal):not(.screen):not(.textbox)').forEach(el => { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0'); });
    if (S.screen === 'run' && r && r.screen === 'map') scrollMap();
    const focus = app.querySelector('[autofocus]'); if (focus) focus.focus({ preventScroll: true });
    navAfterRender(sameScreen);
  }
  function hud() {
    const r = S.run;
    const pct = Math.max(0, r.hp / r.maxHp * 100);
    return `<div class="hud">
      <div class="stat hp" title="Health">HP <div class="bar pbar"><i style="width:${pct}%"></i><b>${r.hp}/${r.maxHp}</b></div></div>
      <div class="stat bits" title="Bits: spend them at the shop">◆ ${r.bits}</div>
      <div class="stat sight" title="Sight: how many tokens you see face up at the start of each turn">◉ ${r.sight}</div>
      <div class="stat lim" title="Noise limit: hold more noise than this in one turn and you overload">≋ ${r.noiseLimit}</div>
      <div class="relics">${r.relics.map(id => `<img src="${ART.relicURL(id)}" alt="${esc(XR.R[id].name)}" title="${esc(XR.R[id].name + ': ' + XR.R[id].desc)}" data-a="relicInfo" data-id="${id}">`).join('')}</div>
      <button data-a="bag" title="See every token you carry" ${S.tipLock && r.screen === 'fight' ? 'disabled' : ''}>Bag ${r.deck.length}</button>
      <button data-a="pause" title="Menu (Esc)" ${S.tipLock && r.screen === 'fight' ? 'disabled' : ''}>☰</button>
      <div class="where">${esc(ART.PAL[r.act].name)} · floor ${r.floor} · <span class="dim">seed ${esc(r.seed)}</span></div>
    </div>`;
  }
  function tokHTML(id, up, extra) {
    const d = XR.T[id];
    extra = extra || {};
    return `<div class="tok ${up ? 'up' : ''} ${extra.cls || ''}" title="${esc(d.name + (up ? '+' : '') + ': ' + XR.tokenText(id, up))}">
      <img src="${ART.tokenURL(id, up)}" alt=""><span>${esc(d.name)}</span>${extra.mult > 1 ? `<i class="mult">x${extra.mult}</i>` : ''}</div>`;
  }
  function chipsHTML(counts) {
    const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    if (!ids.length) return '<span class="dim">empty</span>';
    return ids.map(id => `<span class="chip" title="${esc(XR.T[id].name + ': ' + XR.tokenText(id, false))}"><img src="${ART.tokenURL(id, false)}" alt="">${counts[id]} ${esc(XR.T[id].name)}</span>`).join('');
  }

  // ------------------------------------------------------------- SCREENS
  function splashHTML() {
    return `<div class="screen center" data-a="splashGo" style="cursor:pointer">
      <canvas class="logo" data-draw="logo"></canvas>
      <div class="tag">a game about reading the odds</div>
      <p class="blink" style="margin-top:40px">click, tap or press any key</p>
      <p class="dim" style="font-size:12px;position:absolute;bottom:12px">every picture and sound in this game is made in code · headphones recommended</p>
    </div>`;
  }
  function titleHTML() {
    const save = hasSave();
    return `<div class="screen center">
      <canvas class="logo" data-draw="logo"></canvas>
      <div class="tag" style="margin-bottom:26px">luck you can read</div>
      <div class="menu">
        ${save ? '<button class="primary big" data-a="continue" autofocus>Continue run</button>' : ''}
        <button class="${save ? '' : 'primary'} big" data-a="newrun" ${save ? '' : 'autofocus'}>New run</button>
        <button data-a="go" data-s="help">How to play</button>
        <button data-a="go" data-s="goals">Goals</button>
        <button data-a="go" data-s="settings">Settings</button>
        <button data-a="go" data-s="credits">Credits</button>
      </div>
      <p class="dim" style="margin-top:20px;font-size:13px">Runs: ${S.best.runs} · Wins: ${S.best.wins} · Goals: ${Object.keys(S.goals).length}/${XR.GOALS.length}</p>
    </div>`;
  }
  function newRunHTML() {
    if (!S.newSeed) S.newSeed = randomSeed();
    return `<div class="screen center"><div class="panel col" style="max-width:520px;width:100%;align-items:stretch">
      <h2>New run</h2>
      <div class="label">Seed: the same seed always deals the same world</div>
      <div class="row"><input type="text" id="seed" maxlength="24" value="${esc(S.newSeed)}" aria-label="Seed"><button data-a="reseed">Random</button></div>
      <div class="label" style="margin-top:8px">Difficulty</div>
      <div class="opt">
        <button class="${S.newMode === 'standard' ? 'on' : ''}" data-a="mode" data-m="standard">Standard</button>
        <button class="${S.newMode === 'story' ? 'on' : ''}" data-a="mode" data-m="story">Story</button>
      </div>
      <p class="dim" style="margin:0;font-size:13px">${S.newMode === 'story' ? 'Story: 85 HP, more bits, weaker foes. For seeing the whole tale.' : 'Standard: 60 HP. The odds are fair, and they are not kind.'}</p>
      <label class="row" style="font-size:14px"><input type="checkbox" id="skipIntro" ${S.skipIntro ? 'checked' : ''}> Skip the intro</label>
      <div class="row" style="justify-content:space-between;margin-top:8px"><button data-a="go" data-s="title">Back</button><button class="primary big" data-a="start" autofocus>Begin</button></div>
    </div></div>`;
  }
  function cutHTML() {
    const c = S.cut, p = c.panels[c.i];
    const text = p.text.replace('{seed}', S.run ? '«' + S.run.seed + '»' : '');
    const shown = text.slice(0, Math.floor(c.chars));
    return `<div class="cut">
      <canvas class="scene" data-draw="scene" data-id="${p.scene}"></canvas>
      <div class="textbox" data-a="cutNext">${p.who ? `<div class="speaker">${esc(p.who)}</div>` : ''}<span id="cuttext">${esc(shown)}</span></div>
      <div class="row"><span class="dim" style="font-size:12px">${c.i + 1} / ${c.panels.length} · click, Space or A to continue · Start to skip</span><button data-a="cutSkip">Skip</button></div>
    </div>`;
  }
  function goalsHTML() {
    return `<div class="screen center"><div class="panel col scroll" style="max-width:620px;width:100%;max-height:86vh">
      <h2>Goals</h2>
      ${XR.GOALS.map(g => `<div class="goal ${S.goals[g.id] ? 'got' : ''}"><div class="st">${S.goals[g.id] ? '✓' : '·'}</div><div><b>${esc(g.name)}</b><br><span style="font-size:13px">${esc(g.desc)}</span></div></div>`).join('')}
      <p class="dim" style="font-size:13px">Best act reached: ${S.best.bestAct || 0} · Runs: ${S.best.runs} · Wins: ${S.best.wins}</p>
      <button data-a="go" data-s="title" autofocus>Back</button>
    </div></div>`;
  }
  const HELP = [
    ['Your bag', 'You carry a bag of tokens. Strikes deal damage, Guards give block, Sparks give bits. Static, Hiss and Howl do nothing but add noise. In a fight you draw tokens one at a time onto your line.', ['strike', 'guard', 'spark', 'static']],
    ['Keep drawing', 'At the start of each turn the next couple of tokens are face up. After that you can keep drawing blind: you do not see the token until it lands. Your exact chance to overload is always on the Draw button. How far you push is the whole game.', ['seer']],
    ['Noise', 'Static adds 1 noise, Hiss 2, Howl 3. Hold more noise than your limit (4 at first) and you overload: the whole line fizzles and the foe acts. Noise carries into the next turn and cools by 1, so a big push now leaves you closer to the edge next turn. Overloading vents it all back to 0. Ground and Calm take noise away.', ['static', 'hiss', 'howl', 'ground']],
    ['Strike or Brace', 'When you bank, choose how your line lands. Strike: more damage, less block. Brace: more block, less damage. You always see what the foe will do next, and how much you would take with each choice.', ['heavy', 'bulwark']],
    ['The way down', 'Each layer is a map of paths. Pick your route: fights, elites with relics, shops, quiet spots to rest, and strange events. A boss waits at the bottom of each of the three layers.', ['prism', 'echo']],
    ['Build your luck', 'After fights you take new tokens. At the shop you can filter out noisy tokens, grind your lens to see further, or insulate for a higher noise limit. A small, clean bag is a bag you can read.', ['pierce', 'fuse']],
    ['Controls', 'Keyboard: arrow keys move, Enter chooses, Space or D draws, S strikes, B braces, 1 to 4 pick, Esc opens the menu. Controller: D-pad or stick moves, A chooses, B goes back (Brace in a fight), X draws, Y strikes, Start opens the menu, Select shows your bag. Mouse and touch work everywhere too.', []],
  ];
  function helpHTML() {
    const [t, body, toks] = HELP[S.help];
    return `<div class="screen center"><div class="panel col" style="max-width:640px;width:100%">
      <h2>How to play · ${S.help + 1}/${HELP.length}</h2>
      <h3>${esc(t)}</h3>
      <div class="row" style="justify-content:center">${toks.map(id => tokHTML(id, false)).join('')}</div>
      <p>${esc(body)}</p>
      <div class="row" style="justify-content:space-between">
        <button data-a="helpPrev" ${S.help ? '' : 'disabled'}>Prev</button>
        <button data-a="go" data-s="${S.run && S.menu ? 'run' : 'title'}">Done</button>
        <button class="primary" data-a="helpNext" ${S.help < HELP.length - 1 ? '' : 'disabled'} autofocus>Next</button>
      </div>
    </div></div>`;
  }
  function settingsHTML() {
    const st = S.settings;
    const opt = (k, vals) => vals.map(v => `<button class="${st[k] === v ? 'on' : ''}" data-a="set" data-k="${k}" data-v="${v}">${v}</button>`).join('');
    return `<div class="screen center"><div class="panel col" style="max-width:520px;width:100%">
      <h2>Settings</h2>
      <div class="label">Music volume</div><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-a="vol" data-k="music" aria-label="Music volume">
      <div class="label">Sound volume</div><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-a="vol" data-k="sfx" aria-label="Sound volume">
      <div class="label">Text speed</div><div class="opt">${opt('text', ['slow', 'normal', 'fast', 'instant'])}</div>
      <div class="label">Screen shake</div><div class="opt"><button class="${st.shake ? 'on' : ''}" data-a="tog" data-k="shake">${st.shake ? 'on' : 'off'}</button></div>
      <div class="label">Flashes</div><div class="opt"><button class="${st.flash ? 'on' : ''}" data-a="tog" data-k="flash">${st.flash ? 'on' : 'off'}</button></div>
      <div class="label">Fight tips</div><div class="opt"><button class="${st.tips ? 'on' : ''}" data-a="tog" data-k="tips">${st.tips ? 'on' : 'off'}</button><button data-a="resetTips">Show all tips again</button></div>
      <div class="row" style="justify-content:space-between;margin-top:10px">
        <button class="warn" data-a="resetAll">Reset progress</button>
        <button class="primary" data-a="go" data-s="${S.run && S.menu ? 'run' : 'title'}" autofocus>Done</button>
      </div>
    </div></div>`;
  }
  function creditsHTML() {
    return `<div class="screen center"><div class="panel col" style="max-width:640px;width:100%;text-align:center">
      <h2>Credits</h2>
      <p><b>XRNDM</b><br>Concept, story, art, music, sound and code made with Claude Code.</p>
      <p class="dim">Every picture is drawn on canvas and every sound is synthesized live with Web Audio. The game has no image or sound files at all.</p>
      <p class="dim">The design follows Keith Burgun's split between input randomness (luck you see before you choose) and output randomness (luck that lands after). XRNDM lets you buy your way from one to the other.</p>
      <p>Cast: Ix, a Reader · Vell, the Archivist · Oma, a lost Reader · Pell the Tinker · the Shuffler · the Echo Queen · RNDM</p>
      <button class="primary" data-a="go" data-s="title" autofocus>Back</button>
    </div></div>`;
  }
  function modalHTML() {
    const m = S.modal, r = S.run;
    if (m.k === 'pause') return `<div class="modal"><div class="panel center col" style="max-width:340px">
      <h2>Paused</h2>
      <div class="menu"><button class="primary" data-a="closeModal" autofocus>Resume</button>
      <button data-a="menuGo" data-s="help">How to play</button><button data-a="menuGo" data-s="settings">Settings</button>
      <button data-a="saveQuit">Save and quit</button><button class="warn" data-a="abandon">Abandon run</button></div></div></div>`;
    if (m.k === 'confirm') return `<div class="modal"><div class="panel center col" style="max-width:380px"><p>${esc(m.text)}</p>
      <div class="row"><button data-a="closeModal" autofocus>No</button><button class="warn" data-a="${m.yes}">Yes</button></div></div></div>`;
    if (m.k === 'relic') { const d = XR.R[m.id]; return `<div class="modal" data-a="closeModal"><div class="panel center col" style="max-width:360px"><img src="${ART.relicURL(m.id)}" width="72" height="72" alt=""><h3>${esc(d.name)}</h3><p>${esc(d.desc)}</p><button data-a="closeModal" autofocus>OK</button></div></div>`; }
    if (m.k === 'bag') {
      const groups = {};
      for (const t of r.deck) { const k = t.id + (t.up ? '+' : ''); (groups[k] = groups[k] || { id: t.id, up: !!t.up, n: 0 }).n++; }
      const list = Object.values(groups).sort((a, b) => (XR.T[a.id].curse ? 1 : 0) - (XR.T[b.id].curse ? 1 : 0) || b.n - a.n);
      let extra = '';
      if (r.screen === 'fight' && r.fight) {
        const v = XR.view(r).fight;
        extra = `<div class="label">Face up</div><div class="row">${v.revealed.map(t => tokHTML(t.id, t.up, { cls: 'face' })).join('') || '<span class="dim">none</span>'}</div>
          <div class="label">Blind part of the bag (${v.hiddenCount})</div><div class="chips">${chipsHTML(v.hidden)}</div>
          <div class="label">Used this fight, shuffled back when the bag runs out (${Object.values(v.discard).reduce((s, n) => s + n, 0)})</div><div class="chips">${chipsHTML(v.discard)}</div>`;
      }
      return `<div class="modal"><div class="panel scroll"><h2>Your bag · ${r.deck.length} tokens</h2>${extra}
        <div class="label">Everything you carry</div>
        <div class="col">${list.map(g => `<div class="row">${tokHTML(g.id, g.up)}<b>x${g.n}</b><span class="dim">${esc(XR.tokenText(g.id, g.up))}</span></div>`).join('')}</div>
        <button class="primary" data-a="closeModal" autofocus>Close</button></div></div>`;
    }
    if (m.k === 'pick') {
      const toks = r.deck.filter(m.filter);
      return `<div class="modal"><div class="panel scroll"><h2>${esc(m.title)}</h2><p class="dim">${esc(m.sub)}</p>
        <div class="grid">${toks.map(t => `<div class="card" data-a="picked" data-uid="${t.uid}">${tokHTML(t.id, m.preview ? true : !!t.up)}<div class="ds">${esc(XR.tokenText(t.id, m.preview ? true : !!t.up))}</div></div>`).join('') || '<p class="dim">Nothing to choose.</p>'}</div>
        <button data-a="closeModal">Cancel</button></div></div>`;
    }
    return '';
  }

  // ------------------------------------------------------------- RUN VIEWS
  function runHTML() {
    const r = S.run;
    switch (r.screen) {
      case 'map': return hud() + mapHTML();
      case 'fight': return hud() + fightHTML();
      case 'reward': return hud() + rewardHTML();
      case 'shop': return hud() + shopHTML();
      case 'rest': return hud() + restHTML();
      case 'event': return hud() + eventHTML();
      case 'dead': return deadHTML();
      case 'victory': return victoryHTML();
      case 'actEnd': return hud() + `<div class="screen center"><h2>Layer cleared</h2><button class="primary big" data-a="actCut" autofocus>Go deeper</button></div>`;
    }
    return '';
  }
  function nodeXY(n) {
    const jitter = (n.id * 37 % 11) - 5;
    return { x: n.type === 'boss' ? 200 : 50 + n.col * 100 + jitter, y: 70 + (XR.ROWS - n.row) * 78 + (n.id * 53 % 9) - 4 };
  }
  function nodeIcon(type, x, y, s) {
    const c = NODE_INFO[type].col;
    const k = s / 16;
    const T = `transform="translate(${x},${y}) scale(${k})"`;
    switch (type) {
      case 'fight': return `<g ${T} stroke="${c}" stroke-width="2.6" stroke-linecap="round"><path d="M-9 9 L9 -9 M3 -10 L9 -9 L10 -3 M9 9 L-9 -9 M-3 -10 L-9 -9 L-10 -3"/></g>`;
      case 'elite': return `<g ${T} stroke="${c}" stroke-width="2.6" fill="none"><path d="M-10 6 L-10 -10 L-4 -2 L0 -10 L4 -2 L10 -10 L10 6 Z"/><circle cx="0" cy="2" r="2.5" fill="${c}"/></g>`;
      case 'event': return `<g ${T}><text x="0" y="7" text-anchor="middle" font-size="22" font-weight="900" fill="${c}" font-family="monospace">?</text></g>`;
      case 'shop': return `<g ${T} stroke="${c}" stroke-width="2.4" fill="none"><circle r="9"/><path d="M0 -5 L0 5 M-3 -3 L3 -3 M-3 3 L3 3"/></g>`;
      case 'rest': return `<g ${T} stroke="${c}" stroke-width="2.4" fill="none"><path d="M0 10 L0 -2"/><circle cy="-6" r="5" fill="${c}"/></g>`;
      case 'treasure': return `<g ${T} stroke="${c}" stroke-width="2.4" fill="none"><rect x="-10" y="-6" width="20" height="14" rx="2"/><path d="M-10 0 L10 0"/><rect x="-2" y="-2" width="4" height="5" fill="${c}"/></g>`;
      case 'boss': return `<g ${T} stroke="${c}" stroke-width="2.4" fill="none"><ellipse rx="13" ry="8"/><circle r="4.5" fill="${c}"/></g>`;
    }
    return '';
  }
  function mapHTML() {
    const r = S.run, m = r.map, can = new Set(XR.options(r));
    const H = 70 + (XR.ROWS + 1) * 78;
    let lines = '', nodes = '';
    for (const n of m.nodes) {
      const a = nodeXY(n);
      for (const id of n.next) {
        const b = nodeXY(m.nodes[id]);
        const walked = r.visited.indexOf(n.id) >= 0 && (r.visited.indexOf(id) >= 0 || (r.node === n.id && can.has(id)));
        lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${walked ? '#7cf7ff' : '#2a3a58'}" stroke-width="${walked ? 3 : 2}" stroke-dasharray="${walked ? '' : '5 5'}"/>`;
      }
    }
    const firstCan = XR.options(r)[0];
    for (const n of m.nodes) {
      const p = nodeXY(n), info = NODE_INFO[n.type], here = r.node === n.id, seen = r.visited.indexOf(n.id) >= 0, ok = can.has(n.id);
      const R = n.type === 'boss' ? 30 : 19;
      nodes += `<g class="node ${ok ? 'can' : ''}" ${ok ? `data-a="goNode" data-n="${n.id}" role="button" tabindex="0" aria-label="${info.name}"${n.id === firstCan ? ' autofocus' : ''}` : ''}>
        <title>${info.name}: ${info.desc}</title>
        <circle class="ring" cx="${p.x}" cy="${p.y}" r="${R}" fill="${seen ? '#14233a' : '#0b111c'}" stroke="${ok ? info.col : here ? '#ffffff' : seen ? '#3a5a80' : '#26344f'}" stroke-width="${ok ? 3 : 2}" opacity="${seen || ok || here ? 1 : 0.75}"/>
        ${nodeIcon(n.type, p.x, p.y, n.type === 'boss' ? 26 : 16)}
        ${here ? `<circle cx="${p.x}" cy="${p.y}" r="${R + 7}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 4"/>` : ''}
      </g>`;
    }
    const bossName = XR.F[Object.keys(XR.F).find(k => XR.F[k].boss && XR.F[k].act === r.act)].name;
    return `<div class="mapwrap">
      <div class="mapscroll" id="mapscroll"><svg viewBox="0 0 400 ${H}" role="img" aria-label="Map of ${esc(ART.PAL[r.act].name)}">
        <text x="200" y="26" text-anchor="middle" fill="#ff4d4d" font-family="monospace" font-size="14" letter-spacing="2">${esc(bossName.toUpperCase())}</text>
        ${lines}${nodes}</svg></div>
      <div class="mapside">
        <div class="panel"><h2 style="font-size:16px">${esc(ART.PAL[r.act].name)}</h2><p class="dim" style="font-size:13px;margin:0">Choose a lit node to move. You climb from the bottom toward the boss at the top.</p></div>
        <div class="panel legend">${Object.keys(NODE_INFO).map(k => `<div><svg width="26" height="26" viewBox="-13 -13 26 26">${nodeIcon(k, 0, 0, 14)}</svg>${NODE_INFO[k].name}</div>`).join('')}</div>
      </div>
    </div>`;
  }
  function scrollMap() {
    const el = $('#mapscroll'); if (!el) return;
    const r = S.run, ids = XR.options(r);
    const row = ids.length ? r.map.nodes[ids[0]].row : 0;
    const svg = el.querySelector('svg'); const H = 70 + (XR.ROWS + 1) * 78;
    const y = (70 + (XR.ROWS - row) * 78) / H * svg.getBoundingClientRect().height;
    el.scrollTop = Math.max(0, y - el.clientHeight * 0.6);
  }
  // First-fight teaching: one tip at a time, shown where the player is acting.
  function tipFor(v) {
    if (!S.settings.tips) return null;
    const seen = S.tips;
    if (v.blindNow && v.canDraw && v.staged.length && !seen.blind) return { id: 'blind', text: 'Your face-up tokens are used up, but you can keep drawing. The next token is blind: you won\'t see it until it lands. The Draw button shows your exact chance to overload. Push your luck, or bank what you have.' };
    if (v.turn >= 2 && v.noise > 0 && !v.staged.length && !seen.carry) return { id: 'carry', text: 'Noise carries over. You start this turn at ' + v.noise + ' noise. It cools by ' + v.cool + ' each turn. Overloading wipes your line, but it vents your noise to 0.' };
    if (v.turn === 1 && !v.staged.length && !seen.draw) return { id: 'draw', text: 'Draw tokens onto your line. Nothing happens until you bank. The first few tokens are face up, so you know what you are getting.' };
    if (v.staged.length >= 2 && !seen.stance && (seen.blind || !v.canDraw)) return { id: 'stance', text: 'Bank with Strike for more damage and less block, or Brace for more block and less damage. Check what the foe will do next.' };
    return null;
  }
  function tipSeen(id) { if (!S.tips[id]) { S.tips[id] = true; store.set('tips', S.tips); } }
  function fightHTML() {
    const r = S.run, v = XR.view(r).fight;
    const p = v.preview, st = v.stances.strike, br = v.stances.brace;
    const noiseCells = [];
    for (let i = 1; i <= Math.max(v.limit + 1, v.noise); i++) noiseCells.push(`<i class="${i <= v.noise ? (i > v.limit ? 'over' : 'on') : (i === v.limit + 1 ? 'limit' : '')}" title="${i === v.limit + 1 ? 'Overload' : 'Noise ' + i}"></i>`);
    const riskPct = Math.round(v.risk * 100);
    const riskCls = riskPct === 0 ? 'safe' : riskPct < 25 ? 'warn' : 'hot';
    const foeHpPct = Math.max(0, v.foe.hp / v.foe.maxHp * 100);
    const lethal = st.dmg + st.pierce >= v.foe.hp + v.foe.block;
    const takeS = Math.max(0, v.foe.incoming - v.block - st.blk), takeB = Math.max(0, v.foe.incoming - v.block - br.blk);
    const next = v.revealed[0];
    let drawLabel;
    if (!v.canDraw) drawLabel = 'Bag empty';
    else if (!v.blindNow) drawLabel = `Draw <small>${esc(XR.T[next.id].name)}${riskPct ? ' · overloads!' : ''}</small>`;
    else drawLabel = `Draw blind <small class="${riskCls}">${riskPct}% overload</small>`;
    const tip = tipFor(v);
    S.tipLock = !!(tip && tip.id === 'blind');
    const lock = S.tipLock ? 'disabled' : '';
    // what a special token does: when it is the next face-up token, or when it was just drawn blind (never both)
    const PLAIN = { strike: 1, guard: 1, spark: 1 };
    let info = null;
    if (!v.blindNow && next && !PLAIN[next.id]) info = { lead: 'Next up', id: next.id, up: next.up };
    else if (S.lastBlind && S.lastDrawn === v.staged.length && v.staged.length) {
      const e = v.staged[v.staged.length - 1];
      if (!PLAIN[e.id]) info = { lead: 'Drawn blind', id: e.id, up: e.up };
    }
    const newCls = i => (i === v.staged.length - 1 && S.lastDrawn === v.staged.length ? (S.lastBlind ? 'flip' : 'new') : '');
    return `<div class="fight" id="fight">
      <div class="ixbox" id="ixbox"><canvas data-draw="ix"></canvas>
        <div class="col" style="gap:4px"><div class="foename">Ix</div>
        <div class="bar pbar"><i style="width:${r.hp / r.maxHp * 100}%"></i><b>${r.hp}/${r.maxHp}</b></div>
        <div>${v.block ? `<span class="shield">⛨ ${v.block} block</span>` : '<span class="dim">no block</span>'}</div></div></div>
      <div class="foebox" id="foebox">
        <div class="intent" title="What the foe will do when you bank"><div class="label">Next it will</div>${esc(v.foe.intentText)}${v.foe.incoming ? `<div class="dmg">${v.foe.incoming} incoming</div>` : ''}</div>
        <canvas data-draw="foe" data-art="${XR.F[v.foe.id].art}"></canvas>
        <div class="foename">${esc(v.foe.name)}</div>
        <div class="bar" style="width:220px"><i style="width:${foeHpPct}%"></i><b>${Math.max(0, v.foe.hp)}/${v.foe.maxHp}</b></div>
        <div class="row" style="justify-content:center">${v.foe.block ? `<span class="shield">⛨ ${v.foe.block}</span>` : ''}${v.foe.str ? `<span class="strength">▲ ${v.foe.str} strength</span>` : ''}</div>
      </div>
      <div class="table">
        <div><div class="label">Your line · turn ${v.turn}</div>
          <div class="line" id="line">${v.staged.map((e, i) => tokHTML(e.echo || e.id, e.up, { mult: e.mult, cls: (e.dead ? 'dead ' : '') + newCls(i) })).join('')}</div></div>
        <div class="totals"><span class="label">Line total</span><span class="d">⚔ ${p.dmg + p.pierce}</span><span class="k">⛨ ${p.blk}</span><span class="c">◆ ${p.bits}</span>${p.heal ? `<span class="h">✚ ${p.heal}</span>` : ''}${p.self ? `<span class="d">self -${p.self}</span>` : ''}${lethal ? '<b style="color:var(--good)">LETHAL on Strike</b>' : ''}</div>
        <div class="row"><span class="label">Noise ${v.noise}/${v.limit}</span><div class="noise">${noiseCells.join('')}</div><span class="dim" style="font-size:12px">bank now and next turn starts at ${v.noiseNextTurn}</span></div>
        <div class="sightrow">
          <div><div class="label">${v.blindNow ? 'Next draw is blind' : 'Face up next'}</div><div class="next">${v.revealed.map((t, i) => tokHTML(t.id, t.up, { cls: 'face' + (i === 0 && riskPct ? ' danger' : '') })).join('') || '<div class="tok back"><img src="' + ART.tokenURL('blank', false) + '" alt=""><span>?</span></div>'}</div></div>
          <div class="odds"><div class="label">${v.blindNow ? 'Blind draw' : 'Next token'}</div>
            <div><span class="risk ${riskCls}">${riskPct}%</span> ${v.blindNow ? 'chance to overload' : (riskPct ? 'it overloads you' : 'it is safe')}</div>
            <div class="label" style="margin-top:6px">Still in the bag, order unknown · ${v.hiddenCount}</div>
            <div class="chips">${chipsHTML(v.hidden)}</div></div>
        </div>
      </div>
      <div class="controls">
        ${tip ? `<div class="coach${S.tipLock ? ' lock' : ''}" role="status"><span>${esc(tip.text)}</span><button data-a="tipOk" data-id="${tip.id}" ${S.tipLock ? 'autofocus' : ''}>Got it</button></div>`
          : info ? `<div class="coach info" role="status"><img src="${ART.tokenURL(info.id, info.up)}" alt=""><span><b>${info.lead}: ${esc(XR.T[info.id].name)}${info.up ? '+' : ''}.</b> ${esc(XR.tokenText(info.id, info.up))}</span></div>` : ''}
        <button class="primary big drawbtn" data-a="draw" ${v.canDraw && !S.busy && !S.tipLock ? 'autofocus' : 'disabled'} title="Draw the next token (Space, or X on a controller)">${drawLabel}</button>
        <div class="stancecol"><div class="take">${v.foe.incoming ? `you take ${takeS}` : 'no attack coming'}</div>
        <button class="big stance" data-a="strike" ${S.busy || S.tipLock ? 'disabled' : (v.canDraw ? '' : 'autofocus')} title="Bank: damage x${XR.CFG.strikeDmg}, block x${XR.CFG.strikeBlk} (S, or Y on a controller)">Strike <small>⚔ ${st.dmg + st.pierce} ⛨ ${st.blk}</small></button></div>
        <div class="stancecol"><div class="take">${v.foe.incoming ? `you take ${takeB}` : 'no attack coming'}</div>
        <button class="big stance" data-a="brace" ${S.busy || S.tipLock ? 'disabled' : ''} title="Bank: block x${XR.CFG.braceBlk}, damage x${XR.CFG.braceDmg} (B on keyboard or controller)">Brace <small>⚔ ${br.dmg + br.pierce} ⛨ ${br.blk}</small></button></div>
        <span class="hint">${PAD.connected ? '<kbd>X</kbd> draw · <kbd>Y</kbd> strike · <kbd>B</kbd> brace' : '<kbd>Space</kbd> draw · <kbd>S</kbd> strike · <kbd>B</kbd> brace'} · bag ${v.pileCount} · used ${Object.values(v.discard).reduce((s, n) => s + n, 0)}</span>
      </div>
    </div>`;
  }
  function rewardHTML() {
    const r = S.run, rw = r.reward;
    const boss = !!rw.relicChoices || !!rw.relicPicked;
    const title = rw.treasure ? 'A cache' : boss ? 'Boss defeated' : 'Victory';
    return `<div class="screen center scroll"><div class="wrap col" style="align-items:center">
      <h2>${title}</h2>
      ${rw.bits ? `<p class="bits" style="color:var(--b);font-size:20px;margin:0">+${rw.bits} bits</p>` : ''}
      ${rw.relic ? `<div class="row panel"><img src="${ART.relicURL(rw.relic)}" width="48" height="48" alt=""><div><b>${esc(XR.R[rw.relic].name)}</b><br><span class="dim">${esc(XR.R[rw.relic].desc)}</span></div></div>` : ''}
      ${rw.relicChoices ? `<div class="label">Choose a boss relic</div><div class="grid">${rw.relicChoices.map((id, i) => `<div class="card" data-a="relicPick" data-i="${i}"><img src="${ART.relicURL(id)}" alt=""><div class="nm">${esc(XR.R[id].name)}</div><div class="ds">${esc(XR.R[id].desc)}</div><div class="dim">${i + 1}</div></div>`).join('')}</div>` : ''}
      ${rw.relicPicked ? `<p>You took the <b>${esc(XR.R[rw.relicPicked].name)}</b>.</p>` : ''}
      ${rw.tokens.length && !rw.taken ? `<div class="label">Add one token to your bag, or skip</div><div class="grid">${rw.tokens.map((id, i) => `<div class="card" data-a="take" data-i="${i}">${tokHTML(id, false)}<div class="nm rar${XR.T[id].rar}">${esc(XR.T[id].name)}</div><div class="ds">${esc(XR.tokenText(id, false))}</div><div class="dim">${i + 1}</div></div>`).join('')}</div>` : ''}
      ${rw.taken && rw.tokens.length ? '<p class="dim">Token added to your bag.</p>' : ''}
      <button class="primary big" data-a="rewardDone" ${rw.relicChoices ? 'disabled' : 'autofocus'}>${rw.tokens.length && !rw.taken ? 'Skip' : 'Continue'}</button>
    </div></div>`;
  }
  function shopHTML() {
    const r = S.run, v = XR.view(r), s = v.shop;
    const lines = ['"Bits for chances. Chances for bits. Fair trade, fair odds."', '"Everything here is face up. That is the only way I deal."', '"Lighter bag, clearer head. Want me to take a Static off you?"'];
    return `<div class="screen scroll"><div class="wrap col">
      <div class="row"><canvas data-draw="person" data-who="pell" style="width:120px;height:120px"></canvas><div><h2>Pell the Tinker</h2><p class="dim" style="margin:0">${lines[r.floor % 3]}</p></div></div>
      <div class="label">Tokens</div>
      <div class="grid" style="justify-content:flex-start">${s.toks.map((it, i) => `<div class="card ${it.sold ? 'sold' : ''} ${r.bits < it.cost ? 'off' : ''}" data-a="buyTok" data-i="${i}">${tokHTML(it.id, false)}<div class="nm rar${XR.T[it.id].rar}">${esc(XR.T[it.id].name)}</div><div class="ds">${esc(XR.tokenText(it.id, false))}</div><div class="pr">${it.sold ? 'sold' : '◆ ' + it.cost}</div></div>`).join('')}</div>
      ${s.relic ? `<div class="label">Relic</div><div class="grid" style="justify-content:flex-start"><div class="card ${s.relic.sold ? 'sold' : ''} ${r.bits < s.relic.cost ? 'off' : ''}" data-a="buyRelic"><img src="${ART.relicURL(s.relic.id)}" alt=""><div class="nm">${esc(XR.R[s.relic.id].name)}</div><div class="ds">${esc(XR.R[s.relic.id].desc)}</div><div class="pr">${s.relic.sold ? 'sold' : '◆ ' + s.relic.cost}</div></div></div>` : ''}
      <div class="label">Services</div>
      <div class="grid" style="justify-content:flex-start">${v.services.map(sv => { const d = XR.SHOP_SERVICES[sv.k]; const off = sv.used || r.bits < sv.cost || (sv.k === 'heal' && r.hp >= r.maxHp); return `<div class="card ${off ? 'off' : ''}" data-a="service" data-k="${sv.k}"><div class="nm">${esc(d.name)}</div><div class="ds">${esc(d.desc)}</div><div class="pr">${sv.used ? 'done' : '◆ ' + sv.cost}</div></div>`; }).join('')}</div>
      <div class="row" style="justify-content:flex-end"><button class="primary big" data-a="leaveShop" autofocus>Leave</button></div>
    </div></div>`;
  }
  function restHTML() {
    const r = S.run;
    const done = r.rest.done;
    const heal = Math.ceil(r.maxHp * 0.3);
    return `<div class="screen center scroll"><div class="wrap col" style="align-items:center">
      <canvas class="scene" data-draw="scene" data-id="rest" style="max-height:40vh"></canvas>
      <h2>A quiet spot</h2>
      <p class="dim">The static cannot reach here. You have time for one thing.</p>
      ${done ? `<p>${done === 'heal' ? 'You rest and feel better.' : done === 'tune' ? 'One token rings true now.' : 'One curse goes quiet for good.'}</p><button class="primary big" data-a="leaveRest" autofocus>Move on</button>` : `
      <div class="grid">
        <div class="card ${r.hp >= r.maxHp ? 'off' : ''}" data-a="restHeal"><div class="nm">Rest</div><div class="ds">Heal ${heal} HP.</div><div class="dim">1</div></div>
        <div class="card" data-a="restTune"><div class="nm">Tune</div><div class="ds">Upgrade one token.</div><div class="dim">2</div></div>
        <div class="card ${r.deck.some(t => XR.T[t.id].curse) ? '' : 'off'}" data-a="restFilter"><div class="nm">Filter</div><div class="ds">Remove one Static or curse.</div><div class="dim">3</div></div>
      </div>`}
    </div></div>`;
  }
  function eventHTML() {
    const v = XR.view(S.run).event;
    const ev = XR.EV.find(e => e.id === v.id);
    return `<div class="screen center scroll"><div class="wrap col" style="align-items:center">
      <canvas class="scene" data-draw="scene" data-id="${ev.art}" style="max-height:40vh"></canvas>
      <h2>${esc(v.title)}</h2>
      <p style="max-width:720px">${esc(v.text)}</p>
      ${v.result === null ? `<div class="menu" style="min-width:min(420px,90vw)">${v.opts.map((o, i) => `<button data-a="choose" data-i="${i}" ${o.ok ? '' : 'disabled'} ${i === 0 ? 'autofocus' : ''}>${i + 1}. ${esc(o.label)}</button>`).join('')}</div>`
        : `<p class="panel" style="max-width:720px">${esc(v.result)}</p><button class="primary big" data-a="leaveEvent" autofocus>Continue</button>`}
    </div></div>`;
  }
  function runStats(r) {
    const st = r.stats;
    return `<div class="stats panel"><span class="dim">Seed</span><b>${esc(r.seed)}</b><span class="dim">Mode</span><b>${r.mode}</b>
      <span class="dim">Reached</span><b>${esc(ART.PAL[r.act].name)}, floor ${r.floor}</b><span class="dim">Fights won</span><b>${st.fights} (${st.elites} elite, ${st.bosses} boss)</b>
      <span class="dim">Overloads</span><b>${st.overloads}</b><span class="dim">Longest line banked</span><b>${st.maxBank}</b>
      <span class="dim">Blind draws</span><b>${st.blindDraws} of ${st.draws}</b><span class="dim">Bits earned</span><b>${st.bitsEarned}</b>
      <span class="dim">Bag</span><b>${r.deck.length} tokens, ${r.relics.length} relics</b></div>`;
  }
  function deadHTML() {
    const r = S.run;
    return `<div class="screen center scroll"><div class="wrap col" style="align-items:center">
      <canvas class="scene" data-draw="scene" data-id="fade" style="max-height:34vh"></canvas>
      <h2 style="color:var(--bad)">Signal lost</h2>
      <p>Ix fades into the static${r.cause ? ', undone by ' + esc(r.cause) : ''}.</p>
      ${runStats(r)}
      <div class="row"><button data-a="toTitle">Title</button><button class="primary big" data-a="again" autofocus>Try again</button><button data-a="sameSeed">Same seed</button></div>
    </div></div>`;
  }
  function victoryHTML() {
    const r = S.run;
    return `<div class="screen center scroll"><div class="wrap col" style="align-items:center">
      <canvas class="scene" data-draw="scene" data-id="dawn" style="max-height:34vh"></canvas>
      <h2 style="color:var(--good)">The world is re-seeded</h2>
      <p>Seed «${esc(r.seed)}», ${r.mode} mode. The odds are fair again.</p>
      ${runStats(r)}
      <div class="row"><button data-a="go" data-s="credits">Credits</button><button class="primary big" data-a="again" autofocus>New run</button></div>
    </div></div>`;
  }

  // ------------------------------------------------------------- CANVAS
  let canvases = [];
  function bindCanvases() {
    canvases = Array.from(app.querySelectorAll('canvas[data-draw]')).map(el => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = el.getBoundingClientRect();
      el.width = Math.max(10, Math.round(rect.width * dpr)); el.height = Math.max(10, Math.round(rect.height * dpr));
      return { el, ctx: el.getContext('2d'), kind: el.dataset.draw, born: S.t };
    });
  }
  function resizeBg() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    bg.width = Math.round(innerWidth * dpr); bg.height = Math.round(innerHeight * dpr);
  }
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts; S.t += dt;
    const bctx = bg.getContext('2d');
    const act = S.run && S.screen === 'run' ? S.run.act : 0;
    ART.background(bctx, bg.width, bg.height, act, S.t, S.screen === 'run' && S.run.screen !== 'fight');
    S.foeHurt = Math.max(0, S.foeHurt - dt * 3); S.ixHurt = Math.max(0, S.ixHurt - dt * 3);
    if (S.foeDying) S.foeDying = Math.min(1, S.foeDying + dt * 1.5);
    for (const c of canvases) {
      if (!c.el.isConnected) continue;
      const w = c.el.width, h = c.el.height, lt = S.t - c.born;
      if (c.kind === 'logo') ART.logo(c.ctx, w, h, S.t, lt * 1.4);
      else if (c.kind === 'foe') ART.foe(c.ctx, w, h, c.el.dataset.art, S.run.act, S.t, S.foeHurt, S.foeDying);
      else if (c.kind === 'ix') ART.person(c.ctx, w, h, 'ix', S.t, { hurt: S.ixHurt });
      else if (c.kind === 'person') ART.person(c.ctx, w, h, c.el.dataset.who, S.t, {});
      else if (c.kind === 'scene') ART.scene(c.ctx, w, h, c.el.dataset.id, lt);
    }
    if (S.screen === 'cut') tickCut(dt);
    pollPad(ts);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------- CUTSCENES
  function playCut(id, then) {
    S.cut = { id, panels: CUTS[id], i: 0, chars: 0, then };
    AU.music(id === 'ending' ? 'victory' : 'intro');
    S.screen = 'cut'; S.modal = null; render();
  }
  function cutSpeed() { return { slow: 22, normal: 45, fast: 90, instant: 1e6 }[S.settings.text]; }
  function tickCut(dt) {
    const c = S.cut; if (!c) return;
    const p = c.panels[c.i];
    const full = p.text.replace('{seed}', S.run ? '«' + S.run.seed + '»' : '').length;
    if (c.chars < full) {
      const before = Math.floor(c.chars);
      c.chars = Math.min(full, c.chars + dt * cutSpeed());
      if (Math.floor(c.chars) !== before) {
        sfx('type');
        const el = $('#cuttext'); if (el) el.textContent = p.text.replace('{seed}', S.run ? '«' + S.run.seed + '»' : '').slice(0, Math.floor(c.chars));
      }
    }
  }
  function cutNext() {
    const c = S.cut; const p = c.panels[c.i];
    const full = p.text.replace('{seed}', S.run ? '«' + S.run.seed + '»' : '').length;
    if (c.chars < full) { c.chars = full; render(); return; }
    sfx('click');
    if (c.i < c.panels.length - 1) { c.i++; c.chars = 0; render(); }
    else endCut();
  }
  function endCut() { const then = S.cut.then; S.cut = null; then(); }

  // ------------------------------------------------------------- EFFECTS
  function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function floatAt(sel, text, color) {
    const el = $(sel); if (!el) return;
    const c = center(el);
    const d = document.createElement('div'); d.className = 'float'; d.textContent = text; d.style.color = color;
    d.style.left = (c.x + (Math.random() - 0.5) * 40) + 'px'; d.style.top = (c.y + (Math.random() - 0.5) * 20) + 'px';
    fx.appendChild(d); setTimeout(() => d.remove(), 1000);
  }
  function flash(color) {
    if (!S.settings.flash) return;
    const d = document.createElement('div'); d.className = 'flash'; d.style.background = color; document.body.appendChild(d); setTimeout(() => d.remove(), 520);
  }
  function shake() {
    if (!S.settings.shake) return;
    app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
  }
  function toast(html) {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html;
    d.style.marginTop = (document.querySelectorAll('.toast').length * 64) + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 3300);
  }
  // Play a list of core events as a short timeline of sounds and effects.
  function playEvents(ev, done) {
    let t = 0;
    const at = (ms, fn) => setTimeout(fn, ms * S.speed);
    for (const e of ev) {
      switch (e.e) {
        case 'draw': at(t, () => sfx(e.id === 'static' || XR.T[e.id].curse ? 'static' : e.blind ? 'blind' : 'draw')); break;
        case 'seer': at(t, () => sfx('reveal')); break;
        case 'reshuffle': at(t, () => sfx('shuffle')); t += 150; break;
        case 'overload': at(t, () => { sfx('overload'); flash('rgba(255,255,255,.8)'); shake(); floatAt('#line', 'OVERLOAD', '#ff5c5c'); }); t += 700; break;
        case 'bank': at(t, () => { sfx('bank'); floatAt('#line', e.stance === 'brace' ? 'BRACE' : 'STRIKE', e.stance === 'brace' ? '#5cb8ff' : '#ff6a5c'); }); t += 220; break;
        case 'block': at(t, () => { sfx('block'); floatAt('#ixbox', '+' + e.n + ' block', '#5cb8ff'); }); t += 120; break;
        case 'heal': at(t, () => { sfx('heal'); floatAt('#ixbox', '+' + (e.n || '') + ' HP', '#8cff8c'); }); t += 100; break;
        case 'bits': at(t, () => { sfx('coin'); floatAt('#ixbox', '+' + e.n + ' ◆', '#ffcf6e'); }); t += 100; break;
        case 'foeBlock': at(t, () => { sfx('block'); floatAt('#foebox', 'blocked ' + e.n, '#5cb8ff'); }); t += 120; break;
        case 'foeHit': at(t, () => { sfx(e.n >= 15 ? 'bigHit' : 'hit'); S.foeHurt = 1; floatAt('#foebox', '-' + e.n, '#ff5c5c'); if (e.n >= 15) shake(); }); t += 300; break;
        case 'selfHit': at(t, () => { sfx('hurt'); S.ixHurt = 1; floatAt('#ixbox', '-' + e.n, '#b6ff4d'); }); t += 200; break;
        case 'foeAttack': t += 260; at(t, () => sfx('swing')); t += 120; break;
        case 'playerBlock': at(t, () => { sfx('block'); floatAt('#ixbox', 'blocked ' + e.n, '#5cb8ff'); }); t += 120; break;
        case 'playerHit': at(t, () => { sfx('hurt'); S.ixHurt = 1; shake(); flash('rgba(255,40,40,.35)'); floatAt('#ixbox', '-' + e.n, '#ff5c5c'); }); t += 250; break;
        case 'foeGuard': at(t, () => { sfx('block'); floatAt('#foebox', '+' + e.n + ' block', '#5cb8ff'); }); t += 250; break;
        case 'foeBuff': at(t, () => { sfx('buff'); floatAt('#foebox', '+' + e.n + ' strength', '#ff5fa2'); }); t += 300; break;
        case 'foeHeal': at(t, () => { sfx('heal'); floatAt('#foebox', '+' + e.n, '#8cff8c'); }); t += 250; break;
        case 'curse': at(t, () => { sfx('curse'); floatAt('#line', '+' + e.n + ' ' + XR.T[e.tok].name + ' in your bag', '#b6ff4d'); }); t += 350; break;
        case 'drain': at(t, () => { sfx('coin'); floatAt('#ixbox', '-' + e.n + ' ◆', '#ffcf6e'); }); t += 250; break;
        case 'hush': at(t, () => { sfx('curse'); floatAt('#line', 'sight -1 next turn', '#c77dff'); }); t += 300; break;
        case 'noiseNext': at(t, () => { sfx('static'); floatAt('#line', '+' + e.n + ' noise next turn', '#c9d1db'); }); t += 300; break;
        case 'shuffle': at(t, () => { sfx('shuffle'); floatAt('#line', 'your bag is shuffled', '#ffcf6e'); }); t += 400; break;
        case 'unseed': at(t, () => { sfx('unseed'); flash('rgba(255,77,77,.5)'); shake(); floatAt('#foebox', 'UNSEED', '#ff4d4d'); }); t += 1000; break;
        case 'relic': at(t, () => { sfx('relic'); floatAt('#ixbox', XR.R[e.id].name, '#ffe9a8'); }); t += 160; break;
        case 'win': at(t, () => { S.foeDying = 0.01; sfx('win'); }); t += 1100; break;
        case 'turn': at(t, () => sfx('reveal')); break;
      }
    }
    if (S.run.screen === 'dead') { at(t + 100, () => { sfx('lose'); flash('rgba(0,0,0,.9)'); }); t += 900; }
    setTimeout(done, (t + 60) * S.speed);
  }

  // ------------------------------------------------------------- ACTIONS
  function checkGoals() {
    const r = S.run; if (!r) return;
    for (const g of XR.GOALS) if (!S.goals[g.id] && g.test(r)) { S.goals[g.id] = true; toast('<div class="label">Goal reached</div><b>' + esc(g.name) + '</b>'); sfx('relic'); }
    store.set('goals', S.goals);
    S.best.bestAct = Math.max(S.best.bestAct || 0, r.act);
    store.set('best', S.best);
  }
  function runMusic() {
    const r = S.run;
    if (r.screen === 'fight') return AU.music(r.fight.kind === 'boss' ? 'boss' : ACT_MUSIC[r.act]);
    if (r.screen === 'shop') return AU.music('shop');
    if (r.screen === 'rest') return AU.music('rest');
    if (r.screen === 'dead') return AU.music('death');
    if (r.screen === 'victory') return AU.music('victory');
    AU.music(ACT_MUSIC[r.act]);
  }
  function doAct(a, after) {
    const r = S.run;
    const before = r.screen;
    const ev = XR.act(r, a);
    S.foeDying = r.screen === 'fight' ? 0 : S.foeDying;
    saveRun(); checkGoals();
    if (r.screen === 'dead' || r.screen === 'victory') endRunBook();
    const fightish = before === 'fight';
    if (fightish && ev.length) {
      const quick = ev.length <= 2 && ev[0].e === 'draw';
      if (a.t === 'draw') { S.lastDrawn = r.fight && r.screen === 'fight' ? r.fight.staged.length : -1; S.lastBlind = ev.some(e => e.e === 'draw' && e.blind); }
      if (quick) { playEvents(ev, () => { }); render(); return; }
      S.busy = true; render();
      playEvents(ev, () => {
        S.busy = false; S.foeDying = 0;
        if (r.screen === 'victory') return playCut('ending', () => { runMusic(); go('run'); });
        runMusic(); render(); if (after) after();
      });
      return;
    }
    if (ev.some(e => e.e === 'fight')) { sfx('whoosh'); flash('rgba(255,255,255,.25)'); }
    else if (ev.some(e => e.e === 'buy' || e.e === 'gain')) sfx('buy');
    else if (ev.some(e => e.e === 'relicGain')) sfx('relic');
    else if (ev.some(e => e.e === 'heal' || e.e === 'tune' || e.e === 'filter')) sfx('heal');
    else if (ev.length === 0 && a.t !== 'leave' && a.t !== 'done' && a.t !== 'continue') sfx('deny');
    else sfx('click');
    if (ev.some(e => e.e === 'fight')) S.lastDrawn = -1;
    runMusic(); render();
  }
  function endRunBook() {
    if (S.run._booked) return; S.run._booked = true;
    S.best.runs++; if (S.run.won) S.best.wins++;
    store.set('best', S.best); store.del('save');
  }
  function startRun(seed, mode, skip) {
    S.run = XR.newRun(seed, { mode });
    saveRun();
    const begin = () => { S.screen = 'run'; runMusic(); render(); };
    if (skip) begin(); else playCut('intro', begin);
  }
  function openPicker(kind) {
    const r = S.run;
    if (kind === 'tune') S.modal = { k: 'pick', kind, title: 'Tune a token', sub: 'Shown as it will be once tuned.', preview: true, filter: t => !t.up && !!XR.T[t.id].up };
    if (kind === 'filter') S.modal = { k: 'pick', kind, title: 'Filter out a curse', sub: 'It leaves your bag for good.', filter: t => !!XR.T[t.id].curse };
    if (kind === 'remove') S.modal = { k: 'pick', kind, title: 'Filter a token', sub: 'Pell takes it off your hands for good. (Your bag must keep 5.)', filter: t => r.deck.length > 5 };
    render();
  }
  function handle(a, d) {
    const r = S.run;
    if (S.tipLock && r && r.screen === 'fight' && S.screen === 'run' && a !== 'tipOk') return sfx('deny');
    switch (a) {
      case 'splashGo': AU.init(); AU.music('title'); sfx('click'); return go('title');
      case 'go': sfx('click'); if (d.s === 'run') { S.menu = null; return go('run'); } return go(d.s);
      case 'newrun': sfx('click'); S.newSeed = randomSeed(); return go('newrun');
      case 'reseed': sfx('click'); S.newSeed = randomSeed(); return render();
      case 'mode': sfx('click'); S.newSeed = ($('#seed') || {}).value || S.newSeed; S.newMode = d.m; S.skipIntro = !!($('#skipIntro') || {}).checked; return render();
      case 'start': {
        sfx('click');
        const seed = (($('#seed') || {}).value || '').trim() || randomSeed();
        S.skipIntro = !!($('#skipIntro') || {}).checked;
        return startRun(seed.slice(0, 24), S.newMode, S.skipIntro);
      }
      case 'continue': {
        sfx('click');
        try { S.run = XR.load(store.get('save', '')); } catch (e) { store.del('save'); toast('That save could not be read.'); return go('title'); }
        S.screen = 'run'; runMusic(); return render();
      }
      case 'cutNext': return cutNext();
      case 'cutSkip': sfx('click'); return endCut();
      case 'helpPrev': sfx('click'); S.help = Math.max(0, S.help - 1); return render();
      case 'helpNext': sfx('click'); S.help = Math.min(HELP.length - 1, S.help + 1); return render();
      case 'set': sfx('click'); S.settings[d.k] = d.v; store.set('settings', S.settings); return render();
      case 'tog': sfx('click'); S.settings[d.k] = !S.settings[d.k]; store.set('settings', S.settings); return render();
      case 'resetTips': sfx('click'); S.tips = {}; store.set('tips', {}); S.settings.tips = true; store.set('settings', S.settings); toast('Tips will show again in your next fight.'); return render();
      case 'resetAll': S.modal = { k: 'confirm', text: 'Forget all goals, stats and your saved run?', yes: 'resetYes' }; return render();
      case 'resetYes': S.goals = {}; S.best = { runs: 0, wins: 0, bestAct: 0 }; store.del('save'); store.set('goals', {}); store.set('best', S.best); toast('Progress reset.'); return go('settings');
      case 'closeModal': sfx('click'); S.modal = null; return render();
      case 'pause': sfx('click'); S.modal = { k: 'pause' }; return render();
      case 'menuGo': sfx('click'); S.menu = true; return go(d.s);
      case 'saveQuit': saveRun(); S.run = null; S.menu = null; AU.music('title'); return go('title');
      case 'abandon': S.modal = { k: 'confirm', text: 'Abandon this run? It counts as a loss.', yes: 'abandonYes' }; return render();
      case 'abandonYes': if (r) { r.screen = 'dead'; r.cause = 'giving up'; endRunBook(); } AU.music('death'); S.modal = null; return go('run');
      case 'bag': sfx('click'); S.modal = { k: 'bag' }; return render();
      case 'relicInfo': sfx('click'); S.modal = { k: 'relic', id: d.id }; return render();
      case 'goNode': sfx('step'); return doAct({ t: 'go', node: +d.n });
      case 'draw': if (S.busy) return; tipSeen('draw'); if (r && r.fight && r.fight.revealed === 0) tipSeen('blind'); if (r && r.fight && r.fight.turn >= 2) tipSeen('carry'); return doAct({ t: 'draw' });
      case 'bank': case 'strike': if (S.busy) return; tipSeen('stance'); return doAct({ t: 'bank', stance: 'strike' });
      case 'brace': if (S.busy) return; tipSeen('stance'); return doAct({ t: 'bank', stance: 'brace' });
      case 'tipOk': sfx('click'); tipSeen(d.id); S.tipLock = false; return render();
      case 'take': return doAct({ t: 'take', i: +d.i });
      case 'relicPick': return doAct({ t: 'relic', i: +d.i });
      case 'rewardDone': return doAct({ t: 'done' });
      case 'actCut': {
        const id = r.act === 1 ? 'act1' : 'act2';
        return playCut(id, () => { XR.act(r, { t: 'continue' }); saveRun(); checkGoals(); S.screen = 'run'; runMusic(); render(); });
      }
      case 'buyTok': return doAct({ t: 'buyTok', i: +d.i });
      case 'buyRelic': return doAct({ t: 'buyRelic' });
      case 'service': if (d.k === 'remove') { sfx('click'); return openPicker('remove'); } return doAct({ t: 'service', k: d.k });
      case 'leaveShop': return doAct({ t: 'leave' });
      case 'restHeal': return doAct({ t: 'heal' });
      case 'restTune': sfx('click'); return openPicker('tune');
      case 'restFilter': sfx('click'); return openPicker('filter');
      case 'picked': {
        const m = S.modal; S.modal = null;
        if (m.kind === 'tune') return doAct({ t: 'tune', uid: +d.uid });
        if (m.kind === 'filter') return doAct({ t: 'filter', uid: +d.uid });
        if (m.kind === 'remove') return doAct({ t: 'service', k: 'remove', uid: +d.uid });
        return render();
      }
      case 'leaveRest': return doAct({ t: 'leave' });
      case 'choose': return doAct({ t: 'choose', i: +d.i });
      case 'leaveEvent': return doAct({ t: 'leave' });
      case 'toTitle': S.run = null; AU.music('title'); return go('title');
      case 'again': S.run = null; sfx('click'); S.newSeed = randomSeed(); AU.music('title'); return go('newrun');
      case 'sameSeed': { const seed = r.seed, mode = r.mode; return startRun(seed, mode, true); }
    }
  }
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    if (b.classList.contains('modal') && e.target !== b) return; // clicks inside a dismissable modal
    e.preventDefault();
    handle(b.dataset.a, b.dataset);
  });
  app.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.a === 'vol') { S.settings[el.dataset.k] = +el.value; AU.settings[el.dataset.k] = +el.value; AU.applySettings(); store.set('settings', S.settings); }
    if (el.id === 'seed') S.newSeed = el.value;
  });
  let hoverEl = null;
  app.addEventListener('mouseover', e => { const b = e.target.closest('button,.card'); if (b && b !== hoverEl && !b.disabled) { hoverEl = b; sfx('hover'); } });

  // ------------------------------------------------------- FOCUS NAVIGATION
  // Arrow keys and the gamepad move a visible focus by on-screen geometry
  // (not a flat list), A/Enter activates it, B/Esc goes back.
  const NAV_SEL = 'button:not(:disabled), .card:not(.off):not(.sold), g.node.can, input, [data-a][tabindex]';
  const NAV = { guardUntil: 0, latch: false, pad: false };
  function setPadMode(on) { if (document.body.classList.contains('pad') !== on) document.body.classList.toggle('pad', on); }
  document.addEventListener('pointerdown', () => setPadMode(false));
  document.addEventListener('mousemove', e => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) setPadMode(false); });
  function navRoot() { return app.querySelector('.modal') || app.querySelector('.coach.lock') || app; }
  function navItems() {
    return Array.from(navRoot().querySelectorAll(NAV_SEL)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.classList.contains('modal');
    });
  }
  function defaultFocus(items) {
    return items.find(el => el.hasAttribute('autofocus')) || items.find(el => el.classList.contains('primary')) || items[0];
  }
  function focusEl(el, quiet) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!quiet) sfx('hover');
  }
  function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function navMove(dir) {
    setPadMode(true);
    const items = navItems(); if (!items.length) return;
    const cur = document.activeElement;
    if (items.indexOf(cur) < 0) return focusEl(defaultFocus(items)); // first press only lands focus
    if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
      cur.value = +cur.value + (dir === 'right' ? 1 : -1) * (+cur.step || 1);
      cur.dispatchEvent(new Event('input', { bubbles: true })); sfx('hover'); return;
    }
    const c = centerOf(cur);
    let best = null;
    for (const wide of [false, true]) {
      let bs = Infinity;
      for (const el of items) {
        if (el === cur) continue;
        const e = centerOf(el), dx = e.x - c.x, dy = e.y - c.y;
        const prim = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
        const sec = Math.abs(dir === 'up' || dir === 'down' ? dx : dy);
        if (prim <= 4) continue;
        if (!wide && sec > prim * 1.5 + 24) continue; // stay roughly in the pressed direction first
        const score = prim + sec * (wide ? 1 : 2);
        if (score < bs) { bs = score; best = el; }
      }
      if (best) break;
    }
    if (best) focusEl(best); else sfx('deny');
  }
  function activate(el) {
    if (!el) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') return el.click();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  function navConfirm() {
    setPadMode(true);
    if (S.screen === 'splash') return handle('splashGo', {});
    if (performance.now() < NAV.guardUntil) return;
    if (S.screen === 'cut') return cutNext();
    const items = navItems(), cur = document.activeElement;
    if (items.indexOf(cur) < 0) return focusEl(defaultFocus(items));
    if (cur.type === 'range' || cur.type === 'text') return navMove('down');
    activate(cur);
  }
  function navBack() {
    setPadMode(true);
    if (S.screen === 'splash') return handle('splashGo', {});
    if (S.screen === 'cut') return;
    if (S.modal) return handle('closeModal', {});
    if (S.screen === 'run') return;
    if (S.screen !== 'title') { sfx('click'); if (S.run && S.menu) { S.menu = null; return go('run'); } return go('title'); }
  }
  function navStart() {
    setPadMode(true);
    if (S.screen === 'splash') return handle('splashGo', {});
    if (S.screen === 'cut') { sfx('click'); return endCut(); }
    if (S.modal && S.modal.k === 'pause') return handle('closeModal', {});
    if (S.screen === 'run' && S.run && !S.modal && !S.busy) return handle('pause', {});
  }
  // Called after every render: keep focus where it was if the screen is the
  // same, otherwise land on the default; held directions must be released.
  let navKey = null, navMem = null;
  function navAfterRender(sameScreen) {
    if (!sameScreen) { NAV.guardUntil = performance.now() + 250; NAV.latch = true; }
    if (!document.body.classList.contains('pad')) return;
    const items = navItems(); if (!items.length) return;
    let el = null;
    if (sameScreen && navMem) {
      el = items.find(x => x.dataset.a === navMem.a && (x.dataset.i || x.dataset.n || x.dataset.k || x.dataset.s || x.dataset.uid || '') === navMem.id) || items[Math.min(navMem.idx, items.length - 1)];
    }
    focusEl(el || defaultFocus(items), true);
  }
  function navRemember() {
    const items = navItems(), cur = document.activeElement, idx = items.indexOf(cur);
    navMem = idx < 0 ? null : { a: cur.dataset.a, id: cur.dataset.i || cur.dataset.n || cur.dataset.k || cur.dataset.s || cur.dataset.uid || '', idx };
  }

  // ---------------------------------------------------------------- GAMEPAD
  const PAD = { prev: [], held: {}, next: {}, connected: false };
  window.addEventListener('gamepadconnected', () => {
    PAD.connected = true;
    toast('<div class="label">Controller connected</div>D-pad or stick: move · A: choose · B: back<br>In a fight: X draw · Y strike · B brace · Start: menu · Select: bag');
    if (S.screen === 'run') render();
  });
  window.addEventListener('gamepaddisconnected', () => { PAD.connected = false; });
  function pollPad(now) {
    let list;
    try { list = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { return; }
    const gp = list && Array.from(list).find(p => p && p.connected);
    if (!gp) return;
    if (!PAD.connected) PAD.connected = true;
    const btn = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const ax = gp.axes || [];
    const dirs = { up: btn(12) || ax[1] < -0.55, down: btn(13) || ax[1] > 0.55, left: btn(14) || ax[0] < -0.55, right: btn(15) || ax[0] > 0.55 };
    const press = i => btn(i) && !PAD.prev[i];
    const anyNew = [0, 1, 2, 3, 8, 9].some(press);
    if (anyNew) AU.init();
    if (NAV.latch) { if (!dirs.up && !dirs.down && !dirs.left && !dirs.right) NAV.latch = false; }
    else for (const d of Object.keys(dirs)) {
      if (dirs[d] && !PAD.held[d]) { navMove(d); PAD.next[d] = now + 380; }
      else if (dirs[d] && now >= PAD.next[d]) { navMove(d); PAD.next[d] = now + 130; }
    }
    PAD.held = NAV.latch ? {} : dirs;
    if (press(0)) navConfirm();
    else if (press(1)) { if (S.screen === 'run' && S.run && S.run.screen === 'fight' && !S.modal) { setPadMode(true); handle('brace', {}); } else navBack(); }
    else if (press(9)) navStart();
    else if (press(8) && S.screen === 'run' && S.run && !S.modal) { setPadMode(true); handle('bag', {}); }
    else if (press(2) && S.screen === 'run' && S.run && S.run.screen === 'fight' && !S.modal) { setPadMode(true); handle('draw', {}); }
    else if (press(3) && S.screen === 'run' && S.run && S.run.screen === 'fight' && !S.modal) { setPadMode(true); handle('strike', {}); }
    PAD.prev = gp.buttons.map((b, i) => btn(i));
  }

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const inText = e.target && e.target.tagName === 'INPUT' && e.target.type === 'text';
    const ARROWS = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
    if (ARROWS[k] && !(inText && (k === 'arrowleft' || k === 'arrowright')) && S.screen !== 'splash' && S.screen !== 'cut') {
      e.preventDefault(); return navMove(ARROWS[k]);
    }
    if ((k === 'enter' || k === ' ') && (e.repeat || performance.now() < NAV.guardUntil) && S.screen !== 'splash') { e.preventDefault(); return; }
    if (e.target && e.target.tagName === 'INPUT' && k !== 'enter' && k !== 'escape') return;
    if (S.screen === 'splash') { e.preventDefault(); return handle('splashGo', {}); }
    if (S.screen === 'cut') { if (k === ' ' || k === 'enter') { e.preventDefault(); cutNext(); } if (k === 'escape') endCut(); return; }
    // Enter on a focused non-button (card, map node) activates it
    const focused = document.activeElement;
    const onItem = focused && focused !== document.body && app.contains(focused) && navItems().indexOf(focused) >= 0;
    if (k === 'enter' && onItem && focused.tagName !== 'BUTTON' && focused.tagName !== 'INPUT') { e.preventDefault(); return activate(focused); }
    if (S.modal) { if (k === 'escape') handle('closeModal', {}); return; }
    if (S.screen !== 'run' || !S.run) { if (k === 'escape' && S.screen !== 'title') navBack(); return; }
    const r = S.run;
    if (k === 'escape') return handle('pause', {});
    if (r.screen === 'fight') {
      if (k === ' ' || k === 'd') { e.preventDefault(); return handle('draw', {}); }
      if (k === 's') { e.preventDefault(); return handle('strike', {}); }
      if (k === 'b') { e.preventDefault(); return handle('brace', {}); }
      if (k === 'enter' && !(onItem && focused.tagName === 'BUTTON')) { e.preventDefault(); return handle('strike', {}); }
    }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 4) {
      if (r.screen === 'reward' && r.reward.relicChoices) return handle('relicPick', { i: n - 1 });
      if (r.screen === 'reward' && !r.reward.taken && r.reward.tokens[n - 1]) return handle('take', { i: n - 1 });
      if (r.screen === 'event' && r.event.result === null) return handle('choose', { i: n - 1 });
      if (r.screen === 'rest' && !r.rest.done) return handle(['restHeal', 'restTune', 'restFilter'][n - 1] || '', {});
    }
  });
  window.addEventListener('resize', () => { resizeBg(); bindCanvases(); });

  // test hooks: state lives on window.APP once the app has started
  window.APP = { S, XR, handle, render, startRun, doAct, endCut, navMove, get run() { return S.run; }, ready: false };
  resizeBg(); render(); requestAnimationFrame(frame);
  window.APP.ready = true;
})();
