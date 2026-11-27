'use strict';
// Colossus · src/audio.js · sound: effects, the orchestra cues, the giant's voice
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= audio =================
let actx=null,sndBudget=0;
let master=null;
// Sound runs on the person's Sound-engine: spatialised sources with distance delay, air absorption and reverb, so the
// giant is heard from far away and late. The plain Web Audio blips below are only a fallback where AudioWorklet is missing.
let se=null,seSrc=null,seFailed=false;const SE_M=.12; // metres per world unit
// a stressed sheet of metal: dense, inharmonic and damped, so each impulse is a click, not a bell
// a wake horn sounded at the giant's head: two long rising calls, heard across the land with their echoes
function hornCall(){if(!S)return;S.hornAt=S.t;if(!se||se==='starting'||!save.sound)return;const g=S.g;seSrc.horn.setPosition(g.x*SE_M,-g.y*SE_M,1900*SE_M);
  const play=(src,v)=>{src.note({patch:'brass',midi:50,duration:4.5,velocity:1});src.note({patch:'brass',midi:38,duration:5,velocity:1});setTimeout(()=>{if(se)src.note({patch:'brass',midi:57,duration:3.4,velocity:.95*v+.05})},1800)};
  play(seSrc.horn,1);reflectors().map(r=>({...r,d:Math.hypot(r.x-g.x,r.y-g.y)})).sort((a,b)=>a.d-b.d).slice(0,2).forEach((r,i)=>{const src=i?seSrc.echo2:seSrc.echo1;setTimeout(()=>{if(!se)return;src.setPosition(r.x*SE_M,-r.y*SE_M,60);play(src,.45*r.k)},r.d*SE_M/343*1000)})}
const SHEET=[[163,1,.35],[251,.9,.28],[377,.8,.22],[529,.7,.18],[718,.6,.14],[967,.5,.11],[1283,.42,.09],[1690,.33,.07],[2214,.25,.05],[2890,.18,.04]].map(([freq,gain,t60])=>({freq,gain,t60}));
// Steel-hull voices for the giant, as FM patches for the engine (sweep: semitones off at the start, gliding home).
// groan: two inharmonic modulators into a carrier, heavy feedback for grit, a slow bend; shriek: a bowed high whine;
// rumble: a long falling growl; pop: a rivet giving way.
const HULL={
  groanDown:{alg:1,fb:.85,sweep:4,sweepTime:2.6,vibrato:.12,ops:[{ratio:1.414,level:2.2,attack:.5,decay:2.2,sustain:.7,release:1.4,vel:1},{ratio:2.76,level:1.3,attack:.7,decay:2,sustain:.6,release:1.2,vel:.8},{ratio:1,level:1.6,attack:.4,decay:2.4,sustain:.8,release:1.5,vel:.9},{ratio:1,level:1,attack:.6,decay:2.6,sustain:.85,release:1.6,vel:.5}]},
  groanUp:{alg:1,fb:.8,sweep:-5,sweepTime:2.2,vibrato:.1,ops:[{ratio:1.33,level:2,attack:.6,decay:2,sustain:.7,release:1.3,vel:1},{ratio:3.17,level:1.1,attack:.8,decay:1.8,sustain:.5,release:1.1,vel:.8},{ratio:1,level:1.5,attack:.5,decay:2.2,sustain:.8,release:1.4,vel:.9},{ratio:.5,level:1,attack:.6,decay:2.5,sustain:.85,release:1.6,vel:.5}]},
  shriek:{alg:3,fb:.65,sweep:3,sweepTime:1.6,vibrato:.25,ops:[{ratio:1,level:1.6,attack:.25,decay:1.4,sustain:.6,release:.8,vel:1},{ratio:3.01,level:.9,attack:.3,decay:1.2,sustain:.5,release:.7,vel:.9},{ratio:1.007,level:1.1,attack:.2,decay:1.5,sustain:.7,release:.9,vel:.8},{ratio:1,level:2.2,attack:.3,decay:1.6,sustain:.75,release:1,vel:.5}]},
  rumble:{alg:0,fb:.95,sweep:7,sweepTime:3.2,ops:[{ratio:.5,level:2.6,attack:.3,decay:3,sustain:.4,release:1.5,vel:1},{ratio:1.41,level:2,attack:.3,decay:2.8,sustain:.4,release:1.4,vel:1},{ratio:.71,level:1.6,attack:.4,decay:3.2,sustain:.4,release:1.6,vel:.8},{ratio:1,level:2.4,attack:.5,decay:3.4,sustain:.5,release:1.8,vel:.4}]},
  pop:{alg:4,fb:.9,sweep:-14,sweepTime:.07,ops:[{ratio:1,level:2,attack:.001,decay:.09,sustain:0,release:.05,vel:1},{ratio:3.7,level:1,attack:.001,decay:.12,sustain:0,release:.05,vel:1},{ratio:2.3,level:1.6,attack:.001,decay:.15,sustain:0,release:.08,vel:1},{ratio:1,level:.9,attack:.001,decay:.25,sustain:0,release:.1,vel:.6}]}};
const METAL=[[61,1,9],[97,.8,7],[149,.6,6],[233,.5,4.5],[377,.38,3.5],[523,.3,2.6],[611,.26,2.2],[947,.18,1.5],[1291,.12,1]].map(([freq,gain,t60])=>({freq,gain,t60}));
// Phones: a Bluetooth route takes a large output buffer; the 'interactive' hint's small one left Chrome on Android
// silent or crackling over Bluetooth (Chromium issue 40479730), so touch devices ask for 'playback'. iOS plays page
// audio as 'ambient' (muted by the silent switch) unless the session says 'playback', and a route change interrupts
// the context, so every later gesture resumes it.
function newAudioContext(){const A=window.AudioContext||window.webkitAudioContext,touch=device==='touch'||navigator.maxTouchPoints>0;
  try{return new A({latencyHint:touch?'playback':'interactive'})}catch(e){return new A()}}
function audioSessionPlayback(){try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch(e){}}
// the engine's master limiter clamps hard (0 dB knee, ratio 20, 2 ms attack): fast enough to bend the waveform of the
// giant's low calls and squash every sound under a loud one. A soft knee, a slower attack and a lower master leave it
// catching only peaks.
function softLimit(c){const t=c.context.currentTime;c.threshold.setValueAtTime(-3,t);c.knee.setValueAtTime(6,t);c.ratio.setValueAtTime(12,t);c.attack.setValueAtTime(.006,t);c.release.setValueAtTime(.25,t)}
function startEngine(){if(se||!window.SE||!window.AudioWorkletNode)return false;se='starting';let ctx;try{ctx=newAudioContext();ctx.resume().catch(()=>{})}catch(e){se=null;return false}
  const url=URL.createObjectURL(new Blob([document.getElementById('se-worklet').textContent],{type:'text/javascript'}));
  SE.SoundEngine.create({context:ctx,workletUrl:url,device:'stereo',zone:'coniferForest',maxVoices:32}).then(e=>{se=e;actx=e.ctx;softLimit(e.limiter);
    seSrc={ui:e.createSource('synth',{level:78,priority:3}),groan:e.createSource('synth',{level:104,refDistance:70,priority:6}),
      metal:e.createSource('modal',{modes:METAL,level:100,refDistance:70,priority:6}),boom:e.createSource('synth',{level:100,refDistance:60,priority:5}),
      near:e.createSource('synth',{level:82,refDistance:8,priority:2}),horn:e.createSource('synth',{level:114,refDistance:150,priority:8}),
      hull:e.createSource('synth',{level:112,refDistance:90,priority:7}),hull2:e.createSource('synth',{level:108,refDistance:90,priority:7}),
      echo1:e.createSource('synth',{level:104,refDistance:90,priority:4}),echo2:e.createSource('synth',{level:100,refDistance:90,priority:4}),sky:e.createSource('synth',{level:114,refDistance:200,priority:8}),
      // the opening orchestra: low brass, horns, high trumpets, strings, drums and a wordless choir, all in the sky
      skyLo:e.createSource('synth',{level:112,refDistance:200,priority:8}),skyHi:e.createSource('synth',{level:110,refDistance:200,priority:8}),
      skyStr:e.createSource('synth',{level:104,refDistance:200,priority:8}),skyDrum:e.createSource('synth',{level:112,refDistance:200,priority:8}),
      skyLo2:e.createSource('synth',{level:110,refDistance:200,priority:8}),sky2:e.createSource('synth',{level:112,refDistance:200,priority:8}),skyHi2:e.createSource('synth',{level:108,refDistance:200,priority:8}),
      skyStr2:e.createSource('synth',{level:102,refDistance:200,priority:8}),
      choir3:e.createSource('voice',{tract:.19,sac:.09,level:96,refDistance:200,priority:8}),choir4:e.createSource('voice',{tract:.14,sac:.07,level:94,refDistance:200,priority:8}),
      choir:e.createSource('voice',{tract:.17,sac:.08,level:100,refDistance:200,priority:8}),choir2:e.createSource('voice',{tract:.15,sac:.07,level:96,refDistance:200,priority:8}),
      creakL:e.createSource('modal',{modes:SHEET,level:108,refDistance:70,priority:6}),creakR:e.createSource('modal',{modes:SHEET.map(m=>({...m,freq:m.freq*1.07})),level:108,refDistance:70,priority:6}),
      // a throat the size of a hall: low, rough, wavering calls that carry for miles
      voice:e.createSource('voice',{tract:3.2,sac:1.6,level:112,refDistance:90,priority:7}),
      // the breath has its own throat, shorter, so its rasp sits where ears and speakers hear it, and it carries far
      breath:e.createSource('voice',{tract:1.5,sac:.7,level:116,refDistance:320,priority:7}),
      gfoot:e.createSource('footsteps',{level:108,refDistance:50,priority:5}),feet:e.createSource('footsteps',{level:70,refDistance:3,priority:2}),
      river:e.createSource('water',{preset:'stream',level:62,refDistance:12,priority:1}),river2:e.createSource('water',{preset:'stream',level:60,refDistance:12,priority:1,seed:91}),lake:e.createSource('water',{preset:'drip',level:60,refDistance:15,priority:1})};
    seSrc.river.setWater('stream');seSrc.river2.setWater({rate:520,gamma:1.6,minRadius:7e-4,maxRadius:.0065,rising:.05});seSrc.lake.setWater('drip');
    // rivers sit far back: a fifth of their level at most, and dulled as if heard over a bank (occlusion low-passes them)
    for(const rv of[seSrc.river,seSrc.river2]){const dir=new GainNode(e.ctx,{gain:.15}),snd=new GainNode(e.ctx,{gain:.15});rv.node.disconnect();rv.node.connect(dir,0).connect(e.master);rv.node.connect(snd,1).connect(e.reverbIn);rv.setOcclusion(8)}if(actx.state==='suspended')actx.resume().catch(()=>{})}).catch(()=>{se=null;seFailed=true;try{ctx.close()}catch(e){}plainAudio()});return true}
let seVol=-1;
function seFrame(){if(!se||se==='starting')return;const v=save.sound?.8:0;if(v!==seVol){seVol=v;se.setMasterVolume(v)}if(!S)return;const g=S.g,z=v=>v*SE_M;
  se.setListener({x:z(S.cam.x),y:-z(S.cam.y),z:2,yaw:cam.yaw});seSrc.ui.setPosition(z(S.cam.x),-z(S.cam.y),2);
  seSrc.groan.setPosition(z(g.x),-z(g.y),z(1300));seSrc.hull.setPosition(z(g.x),-z(g.y),z(1100));seSrc.hull2.setPosition(z(g.x),-z(g.y),z(500));seSrc.metal.setPosition(z(g.x),-z(g.y),z(900));{const f=fwd(g),sx=-f.y,sy=f.x;seSrc.creakL.setPosition(z(g.x-sx*300),-z(g.y-sy*300),z(1150));seSrc.creakR.setPosition(z(g.x+sx*300),-z(g.y+sy*300),z(700))}
  const ft=g.feet.find(f=>f.air<=0)||g.feet[0];seSrc.boom.setPosition(z(ft.x),-z(ft.y),1);
  if(S.skyUntil>S.t)for(const k in SKY_SEAT){const q=SKY_SEAT[k];seSrc[k].setPosition(z(S.cam.x)+q[0],-z(S.cam.y)+q[1],260+q[2])}
  seSrc.voice.setPosition(z(g.x),-z(g.y),z(g.fallen>0?200:1850));seSrc.breath.setPosition(z(g.x),-z(g.y),z(g.fallen>0?200:1850));
  // the nearest river runs where it is; the nearest filled footprint lake drips
  {const near=S.rivers.map(rv=>{let b=0,bd=1e9;rv.forEach((q,i)=>{const d=Math.hypot(q.x-S.cam.x,q.y-S.cam.y);if(d<bd){bd=d;b=i}});return{rv,i:b,d:bd}}).sort((a,b)=>a.d-b.d);
    if(near[0]){const a=near[0].rv[near[0].i];seSrc.river.setPosition(z(a.x),-z(a.y),0);const n=near[1]&&near[1].d<near[0].d+900?near[1].rv[near[1].i]:near[0].rv[Math.min(near[0].rv.length-1,near[0].i+6)]||a;seSrc.river2.setPosition(z(n.x),-z(n.y),0)}}
  let lb=null,ld=1e9;for(const q of S.prints){if(S.t-q.t<4)continue;const d=Math.hypot(q.x-S.cam.x,q.y-S.cam.y);if(d<ld){ld=d;lb=q}}seSrc.lake.setPosition(lb?z(lb.x):9e3,lb?-z(lb.y):9e3,0);
  // your own feet: dirt, splashing through a lake, or fingers finding stone on the giant
  const h=S.you;if(h&&!h.dead){seSrc.feet.setPosition(z(S.cam.x),-z(S.cam.y),0);
    if(h.mode==='ground'){const m=h.stepAt?Math.hypot(h.x-h.stepAt.x,h.y-h.stepAt.y):0;if(!h.stepAt||m>60){const wet=S.prints.some(q=>S.t-q.t>4&&Math.hypot(q.x-h.x,q.y-h.y)<C.FOOT_R*.8);
        if(h.stepAt){h.foot=!h.foot;const r=Math.random,damp=!wet&&S.rivers.some(rv=>rv.some(q=>Math.hypot(q.x-h.x,q.y-h.y)<160));seSrc.feet.setPosition(z(S.cam.x)+(h.foot?.25:-.25),-z(S.cam.y),0);seSrc.feet.step({mass:70+r()*25,speed:(wet?.8:1.4)*(.85+r()*.3),surface:wet?'water':damp?'mud':townAt(h)?'sand':'packedDirt',gain:.75+r()*.25})}h.stepAt={x:h.x,y:h.y};if(wet&&h.stepAt)seSrc.lake.splash(8+Math.floor(Math.random()*10),.3+Math.random()*.2)}}
    else if(h.cl){const mv=!!h.cl.move;if(h.wasMoving&&!mv)seSrc.feet.step({mass:70+Math.random()*25,speed:.85+Math.random()*.3,surface:'sandstone',claws:true,gain:.8+Math.random()*.2});h.wasMoving=mv}}

  if(S.t>=(S.nextCall||8)&&!S.g.dead){const g=S.g;if(!g.awake){S.nextCall=S.t+7+Math.random()*13;if(Math.random()<.5)giantCall('breath');else sleepSound()}
    else{S.nextCall=S.t+(g.target?9:14)+Math.random()*(g.target?18:28);giantCall(g.target&&Math.random()<.5?'rumble':'moan')}}
  se.update()}
// the giant's voice: never on a beat, never the same twice
function giantCall(kind){if(!se||se==='starting'||!save.sound||!S)return;const v=seSrc.voice,r=Math.random;
  if(kind==='moan')v.call({mode:'open',duration:2.4+r()*2.2,f0:38+r()*10,f0End:26+r()*6,amp:.8,intensity:.55,roughness:.75,breath:.35,jitter:.55,vibrato:.25,vibratoRate:2.3+r()*2,mouth:.3+r()*.3,attack:.6});
  else if(kind==='bellow')v.call({mode:'open',duration:1.6,f0:62,f0End:30,amp:1,intensity:1,roughness:.95,breath:.25,jitter:.7,vibrato:.1,mouth:.9,attack:.12});
  else if(kind==='rumble')v.call({mode:'closed',duration:2.8,amp:1,intensity:.9,roughness:.6,jitter:.3,attack:.4});
  else if(kind==='breath'){breathAir();return;const b=seSrc.breath;b.call({mode:'open',duration:2.2+r(),f0:70,f0End:84,amp:.85,intensity:.45,roughness:.35,breath:1,jitter:.25,mouth:.35,attack:1.2});
    setTimeout(()=>{if(se&&se!=='starting')b.call({mode:'open',duration:4+r()*2,f0:82,f0End:52,amp:1,intensity:.6,roughness:.45,breath:1,jitter:.3,mouth:.25,attack:.5})},2400+r()*600)}
  else if(kind==='pain')v.call({mode:'open',duration:2.2,f0:80,f0End:28,amp:1,intensity:1,roughness:1,breath:.5,jitter:.9,vibrato:.6,vibratoRate:7,mouth:.8,attack:.05})}
function seGiantStep(ft){if(!se||se==='starting'||!save.sound)return;const z=v=>v*SE_M,wet=S.prints.some(q=>Math.hypot(q.x-ft.x,q.y-ft.y)<C.FOOT_R*1.3&&S.t-q.t>4);
  seSrc.gfoot.setPosition(z(ft.x),-z(ft.y),0);seSrc.gfoot.step({mass:250000,speed:.4+Math.random()*.5,surface:wet?'water':'packedDirt',gain:.45+Math.random()*.55});
  if(wet){seSrc.lake.setPosition(z(ft.x),-z(ft.y),0);seSrc.lake.splash(120,1)}}
function unlockAudio(){if(!save.sound)return;audioSessionPlayback();if(actx&&actx.state!=='running'&&actx.state!=='closed')actx.resume().catch(()=>{});if(!seFailed&&startEngine())return;plainAudio()}
// fallback where the engine cannot load its AudioWorklet: plain Web Audio blips
function plainAudio(){if(se)return;if(actx){if(actx.state==='suspended')actx.resume().catch(()=>{});return}try{actx=newAudioContext();master=actx.createDynamicsCompressor();softLimit(master);master.connect(actx.destination)}catch(e){}if(actx&&actx.state==='suspended')actx.resume().catch(()=>{})}
document.addEventListener('visibilitychange',()=>{if(!actx||!actx.suspend)return;if(document.hidden)actx.suspend().catch(()=>{});else if(save.sound)actx.resume().catch(()=>{})});
// the giant's groan as it moves: detuned low saws beating against each other, a swept resonance like strained metal, and
// inharmonic ringing partials bending down. Upper partials carry it on phone speakers. Heard from far away, never loud.
// metal bending: stick-slip, a train of uneven impulses through a damped sheet whose rate climbs and sags like
// a joint under load; twisting is two trains at once, out of step, on opposite shoulders
function creak(src,dur,r0,r1,amp){const t0=performance.now();let last=t0;
  const tick=()=>{if(!se||se==='starting')return;const now=performance.now(),k=(now-t0)/1000/dur;if(k>=1)return;
    const env=Math.sin(Math.PI*Math.min(1,k*1.15))**.6,rate=r0+(r1-r0)*Math.sin(Math.PI*k)+Math.sin(k*23)*r1*.15;
    src.strike(amp*env*(.55+Math.random()*.45),.25+Math.random()*.6);last=now;setTimeout(tick,1000/Math.max(6,rate)*(.55+Math.random()*.9))};tick()}
// at the start of a game: long, low brass from somewhere high in the sky, clashing a semitone apart, as in the
// recordings of 'trumpets' heard over cities; played once, far off, with the reverb opened up
// The opening: about 22 s. Everything is timed from one score, which the sky painting also reads.
// Phrygian on D: a pedal, a minor third in the horns, a semitone cluster in the trumpets, then the full chord.
const TRUMPETS=[[0,34,5.5],[1.2,35,5],[4.5,31,6.5],[5.4,32,6],[9.5,29,7],[10.1,30,7.5]];
const OPENING={len:22,hits:[6,9.5,12.5,13.2,14,16.5],captions:[[1.5,6.5,'On the first day the sky opened over the three towns.'],[7.5,12.5,'Trumpets sounded, though no one held them.'],[14,20,'And in its chains the stone giant slept on.']]};
// a section is several players: each note is played on the part's two sources, a few cents apart, a few ms apart and
// never at the same strength, which is what makes an orchestra sound like one and a synth like a synth
const SKY_SEAT={skyLo:[-40,-10,0],skyLo2:[-75,15,-20],sky:[0,-25,10],sky2:[25,20,-10],skyHi:[45,-5,20],skyHi2:[80,15,0],skyStr:[-25,30,-30],skyStr2:[30,35,-30],
  skyDrum:[0,40,-40],choir:[-12,-40,40],choir2:[12,-40,40],choir3:[-30,-30,30],choir4:[30,-30,30]};
const SECTION={skyLo:['skyLo','skyLo2'],sky:['sky','sky2'],skyHi:['skyHi','skyHi2'],skyStr:['skyStr','skyStr2']};
// bowed strings: two detuned saw-like pairs (self-modulated carriers), a slow swell and a slight vibrato
const STRINGS={alg:4,fb:.45,vibrato:.12,ops:[{ratio:1,level:.9,attack:.04,decay:.6,sustain:.85,release:.3,vel:.4},{ratio:1,level:.8,attack:.05,decay:.8,sustain:.9,release:.35,vel:.5},
  {ratio:1,detune:9,level:.7,attack:.06,decay:.6,sustain:.8,release:.3,vel:.4},{ratio:1,detune:-6,level:.7,attack:.05,decay:.8,sustain:.9,release:.35,vel:.5}]};
function section(part,midi,dur,vel,patch){const r=Math.random;SECTION[part].forEach((k,n)=>{const src=seSrc[k],cents=n?(r()<.5?-1:1)*(5+r()*5):(r()-.5)*3,lag=n?8+r()*30:0;
  const go=()=>{if(se&&se!=='starting')src.note({patch,freq:440*2**((midi-69)/12+cents/1200),duration:dur,velocity:Math.min(1,vel*(n?.82+r()*.12:1))})};lag?setTimeout(go,lag):go()})}
function trumpets(){if(!save.sound)return;if(!se||se==='starting'){plainTrumpets();return}const s=seSrc;se.setZone('rockyGully');S.skyUntil=S.t+OPENING.len+2;
  const me=S,at=(t,f)=>setTimeout(()=>{if(se&&se!=='starting'&&S&&S===me&&!S.filmSkipped)f()},t*1000),r=Math.random,part=src=>Object.keys(SECTION).find(k=>seSrc[k]===src),br=(src,m,d,v)=>section(part(src),m,d,v,'brass');
  // drums: a roll that swells, then single strokes on the hits
  for(let i=0;i<34;i++){const t=i*.12;at(t,()=>s.skyDrum.note({patch:'tom',midi:33,duration:.4,velocity:.15+.6*(i/34)}))}
  OPENING.hits.forEach(t=>at(t,()=>{s.skyDrum.note({patch:'kick',midi:28,duration:.9,velocity:1});s.skyDrum.sfx('explosion',{midi:26,duration:1.4,velocity:.6})}));
  // low brass pedal, falling at the end
  at(0,()=>br(s.skyLo,26,9,.7));at(9,()=>br(s.skyLo,26,6,.9));at(15,()=>br(s.skyLo,25,6,.9));at(18.5,()=>br(s.skyLo,22,4,.8));
  // strings: a trembling cluster, repeated notes for the tremolo
  for(let i=0;i<70;i++){const t=2.5+i*.17;at(t,()=>{section('skyStr',50+(i%2),.24,.25+.35*Math.min(1,i/40),STRINGS);if(i>30)section('skyStr',62,.24,.3,STRINGS)})}
  // horns: a minor third, swelling, then the trumpets' semitone cluster
  at(3,()=>{br(s.sky,41,6,.75);br(s.sky,44,6,.7)});at(9.5,()=>{br(s.sky,41,5,.95);br(s.sky,45,5,.9)});
  at(6,()=>{br(s.skyHi,62,3.2,.85);br(s.skyHi,63,3.2,.8)});at(9.5,()=>{br(s.skyHi,65,2.6,.95);br(s.skyHi,66,2.6,.9)});
  // the full chord, struck three times, then a high cry that falls
  [12.5,13.2,14].forEach((t,i)=>at(t,()=>{br(s.skyLo,26,i<2?.6:5,1);br(s.sky,38,i<2?.6:5,1);br(s.sky,41,i<2?.6:5,1);br(s.skyHi,62,i<2?.6:5,1);br(s.skyHi,63,i<2?.6:5,1);br(s.skyHi,68,i<2?.6:5,.9)}));
  at(16.5,()=>{br(s.skyHi,74,3,1);br(s.skyHi,75,3,.9)});
  // the choir: wordless, high and thin, entering under the trumpets
  at(8,()=>{s.choir.call({mode:'open',duration:7,f0:294,f0End:277,amp:.7,intensity:.5,roughness:.1,breath:.35,jitter:.15,vibrato:.35,vibratoRate:5.2,mouth:.8,attack:1.6});s.choir2.call({mode:'open',duration:7,f0:349,f0End:330,amp:.6,intensity:.45,roughness:.1,breath:.35,jitter:.15,vibrato:.3,vibratoRate:4.7,mouth:.8,attack:2});s.choir3.call({mode:'open',duration:6.8,f0:293,f0End:278.5,amp:.55,intensity:.45,roughness:.12,breath:.38,jitter:.18,vibrato:.33,vibratoRate:4.9,mouth:.75,attack:1.9});s.choir4.call({mode:'open',duration:6.9,f0:350.5,f0End:329,amp:.5,intensity:.42,roughness:.1,breath:.36,jitter:.16,vibrato:.28,vibratoRate:5.4,mouth:.8,attack:2.2})});
  at(14,()=>{s.choir.call({mode:'open',duration:6,f0:392,f0End:294,amp:.8,intensity:.7,roughness:.2,breath:.3,jitter:.2,vibrato:.4,vibratoRate:5.5,mouth:.9,attack:.3});s.choir2.call({mode:'open',duration:6,f0:415,f0End:311,amp:.7,intensity:.65,roughness:.2,breath:.3,jitter:.2,vibrato:.4,vibratoRate:5,mouth:.9,attack:.3});s.choir3.call({mode:'open',duration:5.8,f0:391,f0End:295,amp:.6,intensity:.6,roughness:.22,breath:.32,jitter:.22,vibrato:.38,vibratoRate:5.2,mouth:.85,attack:.35});s.choir4.call({mode:'open',duration:5.9,f0:416.5,f0End:310,amp:.55,intensity:.6,roughness:.2,breath:.3,jitter:.2,vibrato:.42,vibratoRate:4.8,mouth:.9,attack:.4})});
  at(OPENING.len,()=>se.setZone('coniferForest'))}
// the same calls without the engine: detuned saws through a slowly opening low-pass, with a long echo
function plainTrumpets(){if(!actx)return;const out=master||actx.destination,dl=actx.createDelay(2),fb=actx.createGain(),wet=actx.createGain();dl.delayTime.value=.42;fb.gain.value=.45;wet.gain.value=.5;dl.connect(fb).connect(dl);dl.connect(wet).connect(out);
  for(const[t0,m,d]of TRUMPETS){const t=actx.currentTime+t0,f=440*2**((m+12-69)/12),g=actx.createGain(),lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(250,t);lp.frequency.linearRampToValueAtTime(1400,t+d*.4);lp.frequency.linearRampToValueAtTime(400,t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.18,t+d*.35);g.gain.exponentialRampToValueAtTime(.0001,t+d);lp.connect(g);g.connect(out);g.connect(dl);
    for(const det of[1,1.006,.994,2.003]){const o=actx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f*det,t);o.frequency.linearRampToValueAtTime(f*det*.985,t+d);o.connect(lp);o.start(t);o.stop(t+d+.05)}}}
function reflectors(){const out=[];if(!S)return out;for(const m of S.marks)out.push({x:m.x,y:m.y,k:1});for(const t of aliveTowns())out.push({x:t.x,y:t.y,k:.6});return out}
function withEchoes(play){if(!se||se==='starting'||!S)return;const g=S.g,L=S.cam,d0=Math.hypot(g.x-L.x,g.y-L.y);play(seSrc.hull,1,0);
  const rs=reflectors().map(r=>({...r,path:Math.hypot(r.x-g.x,r.y-g.y)+Math.hypot(r.x-L.x,r.y-L.y)})).filter(r=>r.path>d0+300).sort((a,b)=>a.path-b.path).slice(0,2);
  rs.forEach((r,i)=>{const src=i?seSrc.echo2:seSrc.echo1;src.setPosition(r.x*SE_M,-r.y*SE_M,r.k>.8?120:20);
    // the reflector re-sends what reaches it: the leg from the giant to the reflector is added as a wait, the leg to us the engine delays
    setTimeout(()=>{if(se&&se!=='starting')play(src,.55*r.k*Math.min(1,1800/(r.path-d0+600)),1)},Math.hypot(r.x-g.x,r.y-g.y)*SE_M/343*1000)})}
function hull(kind){const r=Math.random;
  if(kind==='groan')withEchoes((src,v)=>src.note({patch:r()<.5?HULL.groanDown:HULL.groanUp,midi:27+Math.floor(r()*8),duration:2.8+r()*2.5,velocity:.75*v+.15}));
  else if(kind==='shriek')withEchoes((src,v)=>src.note({patch:HULL.shriek,midi:62+Math.floor(r()*9),duration:1.4+r()*1.4,velocity:Math.min(1,.95*v+.05)}));
  else if(kind==='rumble')withEchoes((src,v)=>src.note({patch:HULL.rumble,midi:28+Math.floor(r()*5),duration:3.5+r()*2,velocity:Math.min(1,v)}));
  else if(kind==='pops'){const n=3+Math.floor(r()*5);let t=0;for(let i=0;i<n;i++){t+=60+r()*420;setTimeout(()=>withEchoes((src,v)=>src.note({patch:HULL.pop,midi:64+Math.floor(r()*18),duration:.3,velocity:.85*v})),t)}}}
// chains: a clank when struck, a long strain now and then while it sleeps, a burst when the horn shatters them
function chainClank(ch,shatter){if(!se||se==='starting'||!save.sound||!S)return;const r=Math.random;
  if(shatter){for(let i=0;i<8;i++)setTimeout(()=>{if(se)seSrc.creakR.strike(1,.8)},i*90+r()*80);hull('pops');setTimeout(()=>hull('rumble'),400);return}
  seSrc.creakR.strike(.8,.6+r()*.3)}
function sleepSound(){const r=Math.random,k=r();if(k<.4)creak(seSrc.creakL,1.2+r()*1.6,5,20+r()*15,.7);else if(k<.6)hull('groan');else if(k<.8){seSrc.metal.strike(.5,.3)}else giantCall('breath')}
// The giant's breath is air, so it is shaped noise rather than a voice (a voice always carries a pulse, which at a
// giant's pitch rattles like purring): an inhale through a rising band, a pause, a long falling exhale, sent into the
// engine's own mix and reverb, and silent beyond 2500 units (300 m) of the giant.
let breathBuf=null;
function breathAir(){const A=se&&se!=='starting'?se.ctx:actx;if(!A||!save.sound||!S)return;const d=Math.hypot(S.g.x-S.cam.x,S.g.y-S.cam.y),near=Math.pow(clamp(1-d/2500,0,1),1.6);if(near<.02)return;
  if(!breathBuf||breathBuf.sampleRate!==A.sampleRate){breathBuf=A.createBuffer(1,A.sampleRate*2,A.sampleRate);const c=breathBuf.getChannelData(0);let b=0;for(let i=0;i<c.length;i++){b=.97*b+.03*(Math.random()*2-1);c[i]=b*6}}
  const out=se&&se!=='starting'?se.master:(master||A.destination),wet=se&&se!=='starting'?se.reverbIn:null,t=A.currentTime,r=Math.random;
  const phase=(t0,dur,f0,f1,peak)=>{const src=A.createBufferSource();src.buffer=breathBuf;src.loop=true;const bp=A.createBiquadFilter();bp.type='bandpass';bp.Q.value=.8;bp.frequency.setValueAtTime(f0,t+t0);bp.frequency.exponentialRampToValueAtTime(f1,t+t0+dur);
    const lp=A.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;const g=A.createGain();g.gain.setValueAtTime(.0001,t+t0);g.gain.exponentialRampToValueAtTime(peak*near,t+t0+dur*.45);g.gain.exponentialRampToValueAtTime(.0001,t+t0+dur);
    src.connect(bp).connect(lp).connect(g);g.connect(out);if(wet){const s2=A.createGain();s2.gain.value=.5;g.connect(s2).connect(wet)}src.start(t+t0,r()*1.5);src.stop(t+t0+dur+.1)};
  const inD=1.8+r()*.6,ex=3.2+r()*1.4;phase(0,inD,260,620,.5);phase(inD+.35,ex,560,170,.8)}
let groanTurn=0;
function groan(vol){if(se&&se!=='starting'){if(!save.sound)return;const r=Math.random,turn=groanTurn++%4;
    const tone=['groan','shriek','groan','rumble','groan','pops'][Math.floor(r()*6)];hull(tone);
    if(tone==='groan'&&r()<.5)setTimeout(()=>{if(se&&se!=='starting')seSrc.hull2.note({patch:HULL.groanUp,midi:22+Math.floor(r()*4),duration:4,velocity:.7})},300+r()*900);
    if(turn===0)creak(seSrc.creakL,1.6+r()*1.4,9,38+r()*30,1);                                   // bending
    else if(turn===1){seSrc.metal.strike(.9,.4+r()*.3);setTimeout(()=>creak(seSrc.creakR,1.2+r(),14,50,.8),400+r()*700)} // a bell, then it gives
    else if(turn===2){creak(seSrc.creakL,2+r()*1.5,7,30+r()*25,1);setTimeout(()=>creak(seSrc.creakR,1.6+r(),11,45+r()*30,.9),250+r()*500)} // twisting
    else{seSrc.metal.strike(1,.5+r()*.35);if(r()<.5)setTimeout(()=>creak(seSrc.creakL,.9,20,60,.7),900+r()*900)}
    return}
  if(!actx||!save.sound||vol<.02)return;const t=actx.currentTime,out=actx.createGain();out.gain.setValueAtTime(.0001,t);out.gain.exponentialRampToValueAtTime(vol,t+.7);out.gain.exponentialRampToValueAtTime(.0001,t+3.4);out.connect(master);
  const bp=actx.createBiquadFilter();bp.type='bandpass';bp.Q.value=9;bp.frequency.setValueAtTime(260,t);bp.frequency.exponentialRampToValueAtTime(820+Math.random()*300,t+1.3);bp.frequency.exponentialRampToValueAtTime(190,t+3.2);bp.connect(out);
  const f0=48+Math.random()*8;for(const [m,type,g] of [[1,'sawtooth',.5],[1.013,'sawtooth',.5],[2.02,'square',.18],[3.03,'sawtooth',.25]]){const o=actx.createOscillator(),gg=actx.createGain();o.type=type;o.frequency.setValueAtTime(f0*m,t);o.frequency.linearRampToValueAtTime(f0*m*.94,t+3.2);gg.gain.value=g;o.connect(gg).connect(bp);o.start(t);o.stop(t+3.5)}
  for(const f of [233,377,611,947]){const o=actx.createOscillator(),gg=actx.createGain();o.type='sine';const d=f*(1+(Math.random()-.5)*.02);o.frequency.setValueAtTime(d,t);o.frequency.exponentialRampToValueAtTime(d*.9,t+3);gg.gain.setValueAtTime(.0001,t);gg.gain.exponentialRampToValueAtTime(.05,t+.9);gg.gain.exponentialRampToValueAtTime(.0001,t+3.3);o.connect(gg).connect(out);o.start(t);o.stop(t+3.5)}}
function tone(f,dur,type,vol,slide){if(!actx||!save.sound)return;const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);g.gain.setValueAtTime(vol||.2,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(master||actx.destination);o.start(t);o.stop(t+dur+.02)}
function sfx(k,near){if(near===false||sndBudget>6)return;sndBudget++;
  if(se&&se!=='starting'){if(!save.sound)return;const u=seSrc.ui,b=seSrc.boom;
    try{({step:()=>b.sfx('explosion',{midi:21,duration:.9,velocity:.7}),stomp:()=>b.sfx('explosion',{midi:24,velocity:.95}),smash:()=>b.sfx('explosion',{midi:28,velocity:1}),
      hit:()=>u.sfx('hit'),hoof:()=>b.sfx('crunch',{velocity:.12}),whoosh:()=>u.sfx('hit',{midi:62}),cry:()=>{b.sfx('explosion',{midi:33,duration:.5,velocity:.5});u.sfx('hit',{midi:38})},hurt:()=>{b.sfx('crunch',{velocity:.7});u.sfx('hit',{midi:43})},heavy:()=>{u.sfx('hit');b.sfx('explosion',{midi:40,duration:.35,velocity:.55})},kill:()=>{u.sfx('hit',{midi:50});b.sfx('crunch',{velocity:.45})},thud:()=>b.sfx('crunch',{velocity:.5}),coin:()=>u.sfx('coin'),fanfare:()=>{u.sfx('coin');setTimeout(()=>u.sfx('coin',{midi:79}),130);setTimeout(()=>u.sfx('coin',{midi:84}),260)},cannon:()=>b.sfx('crunch'),warn:()=>u.sfx('blip'),build:()=>u.sfx('powerup'),fall:()=>u.sfx('jump',{midi:55}),grip:()=>u.sfx('blip',{freq:440})}[k]||(()=>{}))()}catch(e){}return}
  ({step:()=>tone(52,.4,'sine',.35,28),stomp:()=>tone(70,.7,'triangle',.5,25),smash:()=>tone(90,.6,'sawtooth',.25,30),hit:()=>tone(330,.08,'square',.08,160),hoof:()=>tone(130,.05,'triangle',.07,90),whoosh:()=>tone(700,.22,'sawtooth',.05,180),cry:()=>tone(180,.5,'sawtooth',.14,110),hurt:()=>tone(160,.18,'sawtooth',.16,70),heavy:()=>tone(200,.22,'square',.14,60),kill:()=>tone(260,.25,'triangle',.14,90),thud:()=>tone(110,.18,'triangle',.14,55),
    fanfare:()=>{tone(660,.12,'triangle',.12,660);setTimeout(()=>tone(880,.12,'triangle',.12,880),130);setTimeout(()=>tone(1320,.25,'triangle',.12,1320),260)},coin:()=>tone(880,.12,'sine',.12,1320),cannon:()=>tone(140,.25,'square',.12,60),warn:()=>tone(440,.3,'triangle',.16,300),build:()=>tone(600,.15,'triangle',.15,900),
    fall:()=>tone(500,.6,'sine',.12,120),grip:()=>tone(240,.12,'square',.06,200)}[k]||(()=>{}))()}

