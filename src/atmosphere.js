'use strict';
// Colossus · src/atmosphere.js · atmosphere: haze, storm, rain, birds, wind and weather sound
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= the world breathes with the giant =================
// One measure of the giant's presence (ATM.P, 0 to 1), from how near it is, whether it stirs (walking, winding up,
// shuddering under the horn) or is awake, and how close dusk is, drives the whole atmosphere: haze hiding its upper body
// from afar, a wind bed of shaped noise that grows with presence and with the height you climb, birds bursting from the
// trees ahead of it and branches swaying, a hush before a nearby footfall, light warming and fog closing in toward dusk,
// a storm the moment it wakes, and short orchestral cues only at turning points. Presentation only: Math.random, never
// the sim's rnd(), and no sim state is written, so headless matches run the same.
const ATM={S:null,P:0,stir:0,haze:0,storm:0,wakeAt:-1,dusk:0,hush:0,hushHold:0,windLvl:0,gust:1,gt:0,flash:0,bolt:null,nextBolt:0,birds:[],flocks:[],nextFlock:0,nextSong:0,air:[],
  cueUntil:0,cueLast:{},pending:null,seen:null,wasAwake:false,lastWaker:null,lastFallen:0,audio:null,scene:null,U:null,cv:null,cx:null,birdMesh:null};
window.__atmos=ATM;
function atmosFrame(dt){const A=ATM;
  if(!S||S.headless){if(A.cv)A.cv.style.display='none';atmosMix(true);return}
  const g=S.g,now=performance.now()/1000;dt=Math.min(dt,.1);
  if(A.S!==S){Object.assign(A,{S,P:0,stir:0,storm:0,wakeAt:-1,hush:0,birds:[],flocks:[],flash:0,bolt:null,pending:null,cueUntil:0,seen:new WeakSet(),
    wasAwake:g.awake,lastWaker:S.waker||null,lastFallen:g.fallen,air:g.feet.map(f=>f.air)})}
  const L=S.cam,d=Math.hypot(g.x-L.x,g.y-L.y),cl=S.you&&!S.you.dead&&S.you.mode==='climb'&&S.you.cl,
    prox=cl?1:Math.pow(clamp(1-(d-500)/(6500*WS),0,1),1.4),
    stirT=g.dead?0:Math.min(1,(g.v>1?.4+g.v/C.G_SPEED:0)+(g.wind?1:0)+(S.waker?1:0)+(g.fallen>0?.5:0));
  A.stir+=(stirT-A.stir)*Math.min(1,dt/(stirT>A.stir?.6:3));
  {const u=clamp((phase()/C.DUSK-.45)/.55,0,1);A.dusk=u*u*(3-2*u)}
  const Pt=g.dead?0:clamp(prox*(.4+.25*(g.awake?1:0)+.35*A.stir)+.1*A.dusk,0,1);A.P+=(Pt-A.P)*Math.min(1,dt/1.5);
  // haze over the upper body: thick from afar, thinning as you near it or as it stirs
  A.haze=g.dead||cl?0:.95*clamp((d-1000)/2300,0,1)*(1-.5*A.stir);
  // the storm breaks the moment it wakes, holds about a minute and eases out over two
  if(g.awake&&!A.wasAwake){A.wakeAt=S.t;atmosBolt(true,now);cue('wake');for(let i=0;i<3;i++)atmosFlockNear(g.x,g.y,900+i*500)}
  A.wasAwake=g.awake;
  if(A.wakeAt>=0){const u=S.t-A.wakeAt,k=u<0?0:u<4?u/4:u<75?1:u<195?1-(u-75)/120:0;A.storm=k*k*(3-2*k)}else A.storm=0;A.storm=Math.max(A.storm,duskStorm(),shower());
  if(A.storm>.35&&now>A.nextBolt){if(A.nextBolt)atmosBolt(false,now);A.nextBolt=now+5+Math.random()*9/A.storm}
  A.flash=Math.max(0,A.flash-dt*2.6);
  // turning points: the horn sounded, the fall, a town under siege (the waking is above)
  if(S.waker&&S.waker!==A.lastWaker&&!g.awake){cue('horn');atmosFlockNear(g.x,g.y,700)}A.lastWaker=S.waker||null;
  if(g.fallen>0&&A.lastFallen<=0)cue('fall');A.lastFallen=g.fallen;
  for(const e of S.events)if(e.k==='raid'&&S.t>=e.go&&!A.seen.has(e)){A.seen.add(e);const tw=S.towns.find(t=>t.id===e.town);if(tw&&(S.you&&e.i===S.you.town||Math.hypot(tw.x-L.x,tw.y-L.y)<3500))cue('siege')}
  if(A.pending&&now>=A.cueUntil){const p=A.pending;A.pending=null;if(now-p.at<12)cue(p.kind)}
  // the hush: as a foot comes down near you, wind and birds fall away, and come back after it lands
  let hz=0;g.feet.forEach((f,i)=>{if(f.air>0){const dl=Math.hypot(f.lx-L.x,f.ly-L.y);const w=Math.min(.9,f.dur*.3);if(dl<2600&&f.air<w)hz=Math.max(hz,(1-f.air/w)*clamp(1-(dl-1300)/1300,0,1))}
    if(A.air[i]>0&&f.air<=0){if(A.hush>.3)A.hushHold=now+.35;atmosLanded(f)}A.air[i]=f.air});
  A.hush=hz>=A.hush?hz:now<A.hushHold?A.hush:Math.max(0,A.hush-dt/1.1);
  // wind: presence, height on the body and the storm, in gusts
  A.gt+=dt;const gt=A.gt,st=A.storm;A.gust=clamp(.62+.22*Math.sin(gt*.31)+.16*Math.sin(gt*.73+1)+.1*Math.sin(gt*1.7+2)+st*.35*Math.sin(gt*2.3)*Math.sin(gt*.41),.2,1.4);
  const hk=cl?cl.y/ROWS:0;A.windLvl=(.06+.34*A.P+.4*hk+.3*st)*A.gust*(1-.95*A.hush);
  atmosBirds(dt);
  // birdsong when the giant is far and quiet; none in the hush, the storm or late dusk
  if(now>A.nextSong){A.nextSong=now+1.2+Math.random()*4.5;const calm=clamp(1-A.P/.5,0,1)*(1-st)*(1-.85*A.dusk)*(1-A.hush);
    if(calm>.15){const a=Math.random()*6.28,r=250+Math.random()*1400;chirp(L.x+Math.cos(a)*r,L.y+Math.sin(a)*r,.05*calm,false)}}
  atmosMix(false);atmosRain()}
// where a giant foot lands: birds burst from the trees ahead of it
function atmosLanded(f){const A=ATM,g=S.g,now=performance.now()/1000;if(!g.awake||now<A.nextFlock||Math.random()<.2)return;A.nextFlock=now+3+Math.random()*4;
  const fw=fwd(g);atmosFlockNear(f.x+fw.x*(700+Math.random()*700),f.y+fw.y*(700+Math.random()*700),0)}
function atmosFlockNear(x,y,away){const A=ATM,L=S.cam;if(away){const a=Math.random()*6.28;x+=Math.cos(a)*away;y+=Math.sin(a)*away}
  let best=null,bd=1400;for(const t of S.trees){const d=Math.hypot(t.x-x,t.y-y);if(d<bd){bd=d;best=t}}
  if(!best||Math.hypot(best.x-L.x,best.y-L.y)>7500)return;atmosFlock(best.x,best.y,best.r*3.6,14+Math.floor(Math.random()*10))}
function atmosFlock(x,y,th,n){const A=ATM,g=S.g;if(A.birds.length>=100)return;const tz=groundH(x,y)+th,ax=x-g.x,ay=y-g.y,al=Math.hypot(ax,ay)||1;
  const f={cx:x,cy:y,cz:tz+220+Math.random()*180,r:120+Math.random()*130,w:(Math.random()<.5?-1:1)*(.5+Math.random()*.35),dx:ax/al,dy:ay/al,age:0,life:14+Math.random()*8};A.flocks.push(f);
  for(let i=0;i<n&&A.birds.length<128;i++)A.birds.push({f,sx:x+(Math.random()-.5)*50,sy:y+(Math.random()-.5)*50,sz:tz-Math.random()*th*.5,a:Math.random()*6.28,rr:.55+Math.random()*.7,zz:(Math.random()-.5)*100,
    ph:Math.random()*6.28,fs:15+Math.random()*7,dl:Math.random()*.6,x,y,z:tz,px:x,py:y,s:10+Math.random()*5,flap:0,on:false});
  // the flock's wings as it lifts, and alarm calls
  const d=Math.hypot(x-S.cam.x,y-S.cam.y);if(d<4000&&ATM.hush<.3){flutter(x,y,n);for(let i=0;i<3+Math.floor(Math.random()*3);i++)setTimeout(()=>chirp(x+(Math.random()-.5)*200,y+(Math.random()-.5)*200,.07,true),150+Math.random()*1600)}}
function atmosBirds(dt){const A=ATM;for(const f of A.flocks){f.age+=dt;f.cx+=f.dx*20*dt;f.cy+=f.dy*20*dt;f.cz+=5*dt}
  A.birds=A.birds.filter(b=>{const f=b.f,u=f.age-b.dl;b.on=u>=0;if(u<0)return true;
    const ang=b.a+f.w*u,ox=f.cx+Math.cos(ang)*f.r*b.rr,oy=f.cy+Math.sin(ang)*f.r*b.rr,oz=f.cz+b.zz+Math.sin(u*.7+b.ph)*25;
    const k=clamp(u/3,0,1),e=k*k*(3-2*k);let x=b.sx+(ox-b.sx)*e,y=b.sy+(oy-b.sy)*e,z=b.sz+(oz-b.sz)*e+Math.sin(Math.PI*k)*60;
    const lv=u-(f.life-5);if(lv>0){x+=f.dx*lv*lv*45;y+=f.dy*lv*lv*45;z+=lv*35}
    b.px=b.x;b.py=b.y;b.x=x;b.y=y;b.z=z;const glide=k>=1&&lv<=0&&Math.sin(u*.8+b.a*3)>.25;b.ph+=dt*b.fs;b.flap=glide?.18:Math.sin(b.ph);return u<f.life+3});
  A.flocks=A.flocks.filter(f=>f.age<f.life+4)}
function atmosBolt(big,now){const A=ATM;A.flash=big?1:.55+.4*Math.random();A.bolt={x:.15+Math.random()*.7,seed:Math.floor(Math.random()*1e6),t:now};thunder(big?.2:.8+Math.random()*3,big)}
// ----- the 3D side: called once a frame after g3Update, before the scene is drawn
function atmos3D(){if(!S||S.headless||!G3.scene)return;const A=ATM,g=S.g;if(A.scene!==G3.scene)atmosBuild();
  const st=A.storm,dk=A.dusk,fl=A.flash,U=A.U,fog=G3.scene.fog;
  fog.color.lerp(_c.set('#d48658'),dk*.65).lerp(_c.set('#5a6068'),st*.72).lerp(_c.set('#c8ccd8'),fl*.35);
  fog.near=Math.max(500,3000-1500*dk-1600*st);fog.far=Math.max(fog.near+2600,16000-6700*dk-6400*st);
  G3.hemi.color.lerp(_c.set('#ff9860'),dk*.6).lerp(_c.set('#7a8494'),st*.6);G3.hemi.groundColor.set('#56663a').lerp(_c.set('#6e4a32'),dk*.5).lerp(_c.set('#2e3430'),st*.5);G3.hemi.intensity=.8-.18*dk-.36*st+fl*.9;
  G3.sun.color.set('#fff0d6').lerp(_c.set('#ff8a48'),dk*.85);G3.sun.intensity*=(1-.25*dk)*(1-.75*st);
  U.haze.value=A.haze;if(A.haze>0){const hp=p3(g.x,g.y,1800),hzn=Math.max(1,view.hz);atmosSkyAt(hp?clamp(hp.y/hzn,0,1):.5,U.hzc.value)}U.giant.value.set(g.x,g.y);U.sway.value=g.dead?0:(g.awake?1:.3)*A.stir;U.wind.value=(.3+.5*A.P+1.4*st)*A.gust;U.time.value=performance.now()/1000;
  const m=A.birdMesh;let n=0;for(const b of A.birds){if(!b.on||n>=128)continue;const hx=b.x-b.px,hy=b.y-b.py;put(m,n++,b.x,b.y,b.z,b.s,b.s*b.flap,b.s,Math.atan2(hx,hy))}
  m.count=n;m.visible=n>0;m.instanceMatrix.needsUpdate=true}
function atmosBuild(){const A=ATM,sc=G3.scene;A.scene=sc;
  const U=A.U=A.U||{haze:{value:0},hzr:{value:new THREE.Vector2(600,1700)},hzc:{value:new THREE.Color()},giant:{value:new THREE.Vector2()},sway:{value:0},wind:{value:0},time:{value:0}};
  // the giant fades into the haze with height: past the fog's own depth, its upper body takes on the fog colour
  const gm=G3.giantMat;gm.onBeforeCompile=sh=>{sh.uniforms.uHaze=U.haze;sh.uniforms.uHzR=U.hzr;sh.uniforms.uHzC=U.hzc;
    sh.vertexShader='varying float vHY;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n{vec4 hw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nhw=instanceMatrix*hw;\n#endif\nvHY=(modelMatrix*hw).y;}');
    sh.fragmentShader='uniform float uHaze;uniform vec2 uHzR;uniform vec3 uHzC;varying float vHY;\n'+sh.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\n#ifdef USE_FOG\n{float hk=smoothstep(uHzR.x,uHzR.y,vHY);gl_FragColor.rgb=mix(gl_FragColor.rgb,mix(fogColor,uHzC,hk),uHaze*hk);}\n#endif')};
  gm.customProgramCacheKey=()=>'atmos-giant';gm.needsUpdate=true;
  // trees sway: pushed away from the giant when it stirs near them, and all of them in the wind; done in the vertex shader, no extra draws
  const trees=sc.children.filter(o=>o.isInstancedMesh&&o.geometry&&o.geometry.type==='ConeGeometry'&&S.trees.length>30&&o.count===S.trees.length).slice(0,2);
  trees.forEach((tm,i)=>{const top=i===0,hs=top?1/.75:1/.6,cf=top?.62:.3;tm.material.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{uG:U.giant,uSw:U.sway,uWd:U.wind,uTm:U.time,uHs:{value:hs},uCf:{value:cf}});
    sh.vertexShader='uniform vec2 uG;uniform float uSw;uniform float uWd;uniform float uTm;uniform float uHs;uniform float uCf;\n'+sh.vertexShader.replace('#include <project_vertex>',
`vec4 mvPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
{vec3 ip=instanceMatrix[3].xyz;float th=length(instanceMatrix[1].xyz)*uHs;float k=clamp((mvPosition.y-(ip.y-uCf*th))/th,0.,1.);k*=k;
vec2 dv=ip.xz-uG;float dg=length(dv);vec2 dir=dv/max(dg,1.);float ph=ip.x*.013+ip.z*.021;
float push=uSw*(1.-smoothstep(250.,2400.,dg))*(.09+.07*sin(uTm*2.1+ph)+.04*sin(uTm*4.7+ph*1.9));
float gust=uWd*(.025+.02*sin(uTm*1.3+ph*.7)+.012*sin(uTm*3.1+ph));
mvPosition.xz+=(dir*push+vec2(.8,.6)*gust)*th*k;}
#endif
mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`)};tm.material.customProgramCacheKey=()=>'atmos-tree'+i;tm.material.needsUpdate=true});
  // birds: one instanced draw, a flat V whose wingtips rise and fall with the instance's height scale
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.7,-1,1,-.1,0,0,-.5,0,0,.7,0,0,-.5,1,1,-.1],3));
  A.birdMesh=inst(bg,new THREE.MeshBasicMaterial({color:0x2a2420,side:THREE.DoubleSide}),128);A.birdMesh.visible=false;sc.add(A.birdMesh)}
// the sky: warmer toward dusk, a low dark lid in the storm, a bolt on each strike (painted on the sky canvas, behind the scene)
// the painted sky's colour at a height (0 top, 1 horizon), with the dusk and storm layers over it, so haze matches what is behind
function atmosSkyAt(fy,out){const ok=openingK(),A=ATM,st=(a,b,k)=>_c.set(mix(a,b,ok)),c=fy<.7?st('#6f8396','#1f1624').lerp(new THREE.Color(mix('#b9b3a3','#5c2a26',ok)),fy/.7):st('#b9b3a3','#5c2a26').lerp(new THREE.Color(mix('#dcc9a6','#c0643a',ok)),(fy-.7)/.3);
  out.copy(c);const lay=(r,g,b,a)=>out.lerp(_c.setRGB(r/255,g/255,b/255),a);
  if(A.dusk>.01){const d=fy<.55?[[58,46,84,.5],[200,112,78,.4],fy/.55]:[[200,112,78,.4],[255,168,92,.55],(fy-.55)/.45],k=d[2],q=d[0].map((v,i)=>v+(d[1][i]-v)*k);lay(q[0],q[1],q[2],q[3]*A.dusk)}
  if(A.storm>.01)lay(44,48,56,.72*A.storm);return out}
function atmosSky(){if(!S||S.headless)return;const A=ATM,dk=A.dusk,st=A.storm,now=performance.now()/1000,bo=A.bolt&&now-A.bolt.t<.4;if(dk<.01&&st<.01&&!bo)return;
  const c=skyCtx,hz=clamp(view.hz,0,H);c.save();c.setTransform(DPR,0,0,DPR,0,0);
  if(dk>.01&&hz>0){const gr=c.createLinearGradient(0,0,0,hz+2);gr.addColorStop(0,`rgba(58,46,84,${.5*dk})`);gr.addColorStop(.55,`rgba(200,112,78,${.4*dk})`);gr.addColorStop(1,`rgba(255,168,92,${.55*dk})`);c.fillStyle=gr;c.fillRect(0,0,W,hz+2)}
  if(st>.01){c.fillStyle=`rgba(44,48,56,${.72*st})`;c.fillRect(0,0,W,H);c.fillStyle=`rgba(28,30,36,${.55*st})`;const t=now*14;
    for(let i=0;i<12;i++){const w=W*(.18+.08*(i%3)),x=((i*W*.23+t*(1+i%4)-cam.yaw*W*.8)%(W*1.5)+W*1.5)%(W*1.5)-W*.25,y=hz*(.12+.09*(i%5));c.beginPath();c.ellipse(x,y,w,hz*.07+8,0,0,7);c.fill()}}
  if(bo&&hz>0){const R=mulberry32(A.bolt.seed),k=(now-A.bolt.t)/.4;let x=A.bolt.x*W,y=0;c.strokeStyle=`rgba(236,240,255,${(1-k)*(k>.15&&k<.3?.35:1)})`;c.lineWidth=2.5;c.shadowColor='#c8d4ff';c.shadowBlur=12;c.beginPath();c.moveTo(x,y);
    while(y<hz){x+=(R()-.5)*W*.05;y+=hz*.06+R()*hz*.06;c.lineTo(x,Math.min(y,hz));if(R()<.18){c.moveTo(x,y)}}c.stroke()}
  c.restore()}
// rain and the lightning's flash, over the 3D scene and under the overlays, on a canvas of its own (only while it storms)
function atmosRain(){const A=ATM,on=G3.active&&(A.storm>.02||A.flash>.01);if(!A.cv){if(!on)return;A.cv=document.createElement('canvas');A.cv.style.pointerEvents='none';cv.parentNode.insertBefore(A.cv,cv);A.cx=A.cv.getContext('2d')}
  A.cv.style.display=on?'block':'none';if(!on)return;const w=Math.max(1,Math.round(W)),h=Math.max(1,Math.round(H));if(A.cv.width!==w||A.cv.height!==h){A.cv.width=w;A.cv.height=h}
  const c=A.cx,t=performance.now()/1000,n=Math.round(Math.min(240,w*h/4000)*A.storm),sl=.16+.14*A.gust,fr=v=>v-Math.floor(v);c.clearRect(0,0,w,h);
  if(n){c.strokeStyle=`rgba(208,216,230,${.2+.22*A.storm})`;c.lineWidth=1.2;c.beginPath();
    for(let i=0;i<n;i++){const r1=fr(i*.6180339),r2=fr(i*.7548776+.31),sp=800+r2*600,len=16+r2*18,y=((r2*h*3+t*sp)%(h+60))-30,x=((r1*w*1.2+y*sl-cam.yaw*w*.6)%(w*1.2)+w*1.2)%(w*1.2)-w*.1;c.moveTo(x,y);c.lineTo(x-len*sl,y-len)}c.stroke()}
  if(A.flash>.01){const k=A.bolt?t-A.bolt.t:1;c.fillStyle=`rgba(226,232,255,${.32*A.flash*(k>.07&&k<.16?.35:1)})`;c.fillRect(0,0,w,h)}}
// ----- sound: a wind bed of shaped noise (low body plus a wandering whistle band), rain hiss, bird calls, wings, thunder
function atmosAudio(){const A=ATM,eng=se&&se!=='starting',ctx=eng?se.ctx:(seFailed||!window.SE||!window.AudioWorkletNode?actx:null);if(!ctx||ctx.state==='closed')return null;
  if(A.audio&&A.audio.ctx===ctx)return A.audio;
  const out=eng?se.master:(master||ctx.destination),wet=eng?se.reverbIn:null,len=ctx.sampleRate*4,buf=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const c=buf.getChannelData(ch);let b0=0,b1=0,b2=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;b0=.99765*b0+w*.099;b1=.963*b1+w*.2965;b2=.57*b2+w*1.0526;c[i]=(b0+b1+b2+w*.1848)*.2}}
  const src=()=>{const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;s.start(0,Math.random()*3.5);return s};
  const bus=new GainNode(ctx,{gain:0}),lp=new BiquadFilterNode(ctx,{type:'lowpass',frequency:340,Q:.4}),g1=new GainNode(ctx,{gain:0}),bp=new BiquadFilterNode(ctx,{type:'bandpass',frequency:600,Q:2.4}),g2=new GainNode(ctx,{gain:0}),
    hp=new BiquadFilterNode(ctx,{type:'highpass',frequency:900}),lp3=new BiquadFilterNode(ctx,{type:'lowpass',frequency:3800}),g3=new GainNode(ctx,{gain:0});
  src().connect(lp).connect(g1).connect(bus);src().connect(bp).connect(g2).connect(bus);src().connect(hp).connect(lp3).connect(g3).connect(bus);bus.connect(out);
  if(wet){const s=new GainNode(ctx,{gain:.25});bus.connect(s).connect(wet)}
  return A.audio={ctx,out,wet,buf,bus,g1,g2,g3,bp}}
function atmosMix(off){const A=ATM;if(!A.audio&&(off||!save.sound))return;const a=atmosAudio();if(!a)return;const t=a.ctx.currentTime,on=!off&&save.sound;
  const tc=A.hush>.3?.05:.45,set=(p,v,k)=>p.setTargetAtTime(v,t,k);set(a.bus.gain,on?1:0,.1);if(!on)return;
  set(a.g1.gain,1.1*A.windLvl,tc);set(a.g2.gain,.6*A.windLvl*(.4+.6*A.gust),tc);set(a.bp.frequency,380+650*A.gust+500*(S&&S.you&&S.you.mode==='climb'?1:0),.6);set(a.g3.gain,.4*A.storm,.8)}
function chirp(x,y,lvl,alarm){const a=atmosAudio();if(!a||!save.sound||!S||ATM.hush>.15)return;const ctx=a.ctx,L=S.cam,dx=x-L.x,dy=y-L.y,d=Math.hypot(dx,dy),k=lvl*Math.pow(clamp(1-d/3500,0,1),1.5);if(k<.004)return;
  const pan=clamp((dx*Math.cos(cam.yaw)+dy*Math.sin(cam.yaw))/Math.max(d,1),-1,1)*.8,p=new StereoPannerNode(ctx,{pan}),lp=new BiquadFilterNode(ctx,{type:'lowpass',frequency:2200+6000*clamp(1-d/3000,0,1)});
  lp.connect(p).connect(a.out);if(a.wet){const s=new GainNode(ctx,{gain:.3});p.connect(s).connect(a.wet)}
  let t=ctx.currentTime+.03+d*SE_M/343;const n=alarm?3+Math.floor(Math.random()*4):2+Math.floor(Math.random()*4),f0=alarm?3000+Math.random()*1200:2400+Math.random()*1800;
  for(let i=0;i<n;i++){const o=new OscillatorNode(ctx,{frequency:f0}),g=new GainNode(ctx,{gain:.0001}),dur=alarm?.05+Math.random()*.03:.07+Math.random()*.08,f=f0*(1+(Math.random()-.5)*.25);
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*(alarm?.72:1.2+Math.random()*.3),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(k,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(lp);o.start(t);o.stop(t+dur+.02);t+=dur+(alarm?.03+Math.random()*.05:.06+Math.random()*.14)}}
function flutter(x,y,n){const a=atmosAudio();if(!a||!save.sound||!S)return;const ctx=a.ctx,d=Math.hypot(x-S.cam.x,y-S.cam.y),k=.12*Math.pow(clamp(1-d/4000,0,1),1.5);if(k<.005)return;
  const bp=new BiquadFilterNode(ctx,{type:'bandpass',frequency:1100,Q:1.2});bp.connect(a.out);const t0=ctx.currentTime+.02+d*SE_M/343;
  for(let i=0;i<Math.min(28,n*1.5);i++){const t=t0+Math.random()*.9,s=ctx.createBufferSource(),g=new GainNode(ctx,{gain:.0001});s.buffer=a.buf;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(k*(.5+Math.random()*.5),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    s.connect(g).connect(bp);s.start(t,Math.random()*3);s.stop(t+.07)}}
function thunder(delay,big){const a=atmosAudio();if(!a||!save.sound)return;const ctx=a.ctx,t=ctx.currentTime+delay,pk=big?1.1:.35+Math.random()*.3,s=ctx.createBufferSource(),lp=new BiquadFilterNode(ctx,{type:'lowpass',frequency:big?1500:600,Q:.3}),g=new GainNode(ctx,{gain:.0001});
  s.buffer=a.buf;s.loop=true;lp.frequency.setValueAtTime(big?1500:600,t);lp.frequency.exponentialRampToValueAtTime(160,t+5.5);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(pk,t+(big?.02:.3));g.gain.exponentialRampToValueAtTime(pk*.3,t+1.1);g.gain.exponentialRampToValueAtTime(pk*.65,t+1.7+Math.random()*.6);g.gain.exponentialRampToValueAtTime(.0001,t+6.5);
  s.connect(lp).connect(g).connect(a.out);if(a.wet){const w=new GainNode(ctx,{gain:.7});g.connect(w).connect(a.wet)}s.start(t,Math.random()*3);s.stop(t+7)}
// the orchestra speaks only at turning points: short cues on the opening's sections, rare and never on top of each other
function cue(kind){const A=ATM,now=performance.now()/1000;if(!S||S.headless||!save.sound||!se||se==='starting'||S.t<OPENING.len+2)return;
  const LEN={horn:7,wake:10,fall:8.5,siege:6.5},pri=kind==='wake'||kind==='fall';if(!LEN[kind])return;
  if(now<A.cueUntil){if(pri)A.pending={kind,at:now};return}
  if(!pri&&now-(A.cueLast[kind]==null?-1e9:A.cueLast[kind])<120)return;
  A.cueLast[kind]=now;A.cueUntil=now+LEN[kind]+1.5;S.skyUntil=Math.max(S.skyUntil||0,S.t+LEN[kind]+3);if(kind==='wake'||kind==='fall'){se.setZone('rockyGully');setTimeout(()=>{if(se&&se!=='starting')se.setZone('coniferForest')},LEN[kind]*1000+1500)}
  const s=seSrc,at=(t,f)=>setTimeout(()=>{if(se&&se!=='starting'&&S&&save.sound)f()},t*1000),br=(p,m,d,v)=>section(p,m,d,v,'brass'),str=(m,d,v)=>section('skyStr',m,d,v,STRINGS),
    hit=v=>{s.skyDrum.note({patch:'kick',midi:28,duration:.9,velocity:v});s.skyDrum.sfx('explosion',{midi:26,duration:1.2,velocity:.5*v})},
    sing=(f0,f1,d,v)=>{s.choir.call({mode:'open',duration:d,f0,f0End:f1,amp:.6*v,intensity:.5,roughness:.12,breath:.35,jitter:.15,vibrato:.35,vibratoRate:5.2,mouth:.8,attack:.8});s.choir2.call({mode:'open',duration:d,f0:f0*1.19,f0End:f1*1.19,amp:.5*v,intensity:.45,roughness:.12,breath:.35,jitter:.15,vibrato:.3,vibratoRate:4.8,mouth:.8,attack:1})};
  if(kind==='horn'){// the sky answers the horn: low strings tremble under two horns a minor third apart
    for(let i=0;i<30;i++)at(i*.18,()=>str(50+(i%2),.26,.12+.25*Math.min(1,i/18)));at(.4,()=>br('skyLo',26,6,.5));at(2,()=>{br('sky',41,4.4,.6);br('sky',44,4.4,.55)})}
  else if(kind==='wake'){// it wakes: a drum roll, the full chord struck twice and held, the trumpets' cluster, the high cry
    for(let i=0;i<20;i++)at(i*.11,()=>s.skyDrum.note({patch:'tom',midi:33,duration:.4,velocity:.2+.6*i/20}));
    [2.3,2.9].forEach((t,i)=>at(t,()=>{hit(1);br('skyLo',26,i?5:.5,1);br('sky',38,i?5:.5,1);br('sky',41,i?5:.5,.95);br('skyHi',62,i?5:.5,.95);br('skyHi',63,i?5:.5,.9)}));
    at(5,()=>sing(392,330,4.5,1));at(6.6,()=>{br('skyHi',74,3,.95);br('skyHi',75,3,.85)});at(7.5,()=>br('skyLo',25,2.8,.8))}
  else if(kind==='fall'){// it falls: one blow, then everything sinks
    at(0,()=>hit(1));at(.1,()=>{br('skyLo',26,2.5,.95);br('sky',44,1.5,.9)});at(1.5,()=>br('sky',41,1.5,.85));at(3,()=>{br('sky',38,2.5,.8);br('skyLo',22,4.5,.85)});
    at(1,()=>sing(392,262,6,.9));for(let i=0;i<26;i++)at(.8+i*.2,()=>str(38+(i%2),.28,.32*(1-i/30)))}
  else if(kind==='siege'){// a town under siege: a war drum and stabbing horns
    for(let i=0;i<14;i++)at(i*.3,()=>s.skyDrum.note({patch:'tom',midi:i%4===0?31:36,duration:.35,velocity:i%4===0?.85:.5}));
    at(0,()=>br('skyLo',26,2.2,.75));[0,1.2,2.4].forEach((t,i)=>at(t,()=>{br('sky',41+(i===2?1:0),.5,.85);br('sky',44+(i===2?1:0),.5,.8)}));at(3.6,()=>{br('skyHi',62,2.4,.8);br('skyHi',63,2.4,.75);br('skyLo',25,2.6,.8)})}}
function sizeLayer(c){const w=Math.round(W*DPR),h=Math.round(H*DPR);if(c.width!==w||c.height!==h){c.width=w;c.height=h}}
function render3D(){if(G3.seed!==S.seed||!G3.scene)g3Build();sizeLayer(skyCv);G3.renderer.setPixelRatio(DPR);const sz=G3.renderer.getSize(new THREE.Vector2());if(sz.x!==W||sz.y!==H)G3.renderer.setSize(W,H,false);
  view.ox=view.oy=0;if(shakeA){view.ox=(Math.random()-.5)*shakeA*3;view.oy=(Math.random()-.5)*shakeA*3}
  g3Camera();g3Update();
  atmos3D();
  // sky behind, painted with the 2D sky routine
  const keep=ctx;ctx=skyCtx;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);const hz=view.hz;view.hz=clamp(hz,0,H);drawSky();ctx.fillStyle=G3.scene.fog.color.getStyle();ctx.fillRect(0,view.hz,W,H-view.hz);ctx=keep;view.hz=hz;
  atmosSky();
  G3.renderer.render(G3.scene,G3.cam);
  // overlays on the 2D canvas: telegraphs, rings, the build area, labels, hits, the minimap
  ctx.clearRect(0,0,W,H);const g=S.g;
  const onBody=!!climbing3D();if(S.you&&!S.you.dead&&!onBody)unionOutline(territory(S.you.town),(x,y)=>p3(x,y,2),TOWNS[S.you.town].col,2,[10,8]);
  for(const ft of g.feet)if(ft.air>0){const p=1-ft.air/ft.dur;ringOnGround(ft.lx,ft.ly,C.FOOT_R*(1.5-p*.5),null,0,null,`rgba(0,0,0,${.15+p*.35})`);ringOnGround(ft.lx,ft.ly,C.FOOT_R,'rgba(255,90,70,.95)',2.5)}
  if(g.wind&&(g.wind.k==='stomp'||g.wind.k==='smash')){const p=1-g.wind.t/g.wind.dur,pts=g.wind.k==='stomp'?g.feet:[g.wind],R=g.wind.k==='stomp'?C.STOMP_R:C.SMASH_R;for(const q of pts){ringOnGround(q.x,q.y,R*p,null,0,null,`rgba(255,80,60,${.15+p*.25})`);ringOnGround(q.x,q.y,R,'rgba(255,90,70,.95)',2.5,[8,6])}}
  if(S.bodies)for(const bd of S.bodies){const a=1-(S.t-bd.t)/25;if(a<=0)continue;ringOnGround(bd.x,bd.y,bd.r,null,0,null,`rgba(40,22,18,${.55*a})`)}
  if(S.you)for(const h of S.humans)if(h.sol&&!h.dead&&h.town===S.you.town&&h.ord&&h.ord.k==='giant'&&h.ord.ph==='hold'){ctx.globalAlpha=.55;ringOnGround(h.x,h.y,C.GUARD_R,TOWNS[h.town].col,2,[10,8]);ctx.globalAlpha=1}
  for(const m of S.monsters)if(m.kind==='archer'&&m.wind){const a=p3(m.x,m.y,40),b=p3(m.wind.x,m.wind.y,20);if(a&&b){const k=m.wind.t/m.wind.dur;ctx.globalAlpha=.35+.5*k;ctx.strokeStyle='#ff5a4a';ctx.setLineDash([6,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1}}
  for(const e of S.fx){if(e.k!=='arrow')continue;const a=p3(e.x,e.y,40),b=p3(e.x2,e.y2,20);if(a&&b){const k=e.t/e.life,mx=a.x+(b.x-a.x)*k,my=a.y+(b.y-a.y)*k;ctx.strokeStyle='#f2e6c8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx-(b.x-a.x)*.12,my-(b.y-a.y)*.12);ctx.stroke()}}
  if(S.you&&S.you.treasure&&Math.hypot(S.you.treasure.x-S.you.x,S.you.treasure.y-S.you.y)<160){const q=p3(S.you.treasure.x,S.you.treasure.y,10);if(q){ctx.fillStyle='#fff6c0';ctx.globalAlpha=.6+.4*Math.sin(S.t*8);ctx.beginPath();for(let i=0;i<4;i++){const a=i*1.571+S.t;ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+Math.cos(a)*14*UI,q.y+Math.sin(a)*14*UI)}ctx.strokeStyle='#fff6c0';ctx.lineWidth=2;ctx.stroke();ctx.globalAlpha=1;lbl('Dig here (X)',q.x,q.y-22,11,'#ffd24a')}}
  // the first day's landmark lights: soft pillars over undiscovered shrines, springs and stones near you
  for(const p of tutLandmarks()){const q=p3(p.x,p.y,0),top=p3(p.x,p.y,1600);if(!q||!top)continue;const a=.34+.1*Math.sin(S.t*1.5+p.x),w=Math.max(9,40*UI*Math.min(1.5,1500/Math.max(500,q.d||1500)));const gr=ctx.createLinearGradient(0,q.y,0,top.y);gr.addColorStop(0,`rgba(255,240,200,${a})`);gr.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=gr;ctx.fillRect(q.x-w/2,top.y,w,q.y-top.y)}
  // villagers talk as you pass: a line about what is happening to their town and the giant (presentation only)
  if(S.you&&G3.villagers){const h=S.you,now=performance.now()/1000;let sp=G3.speech;if(!sp||now>sp.until){sp=null;if(!G3.nextTalk||now>G3.nextTalk){let best=null,bd=260;for(const v of G3.villagers.values()){const d=Math.hypot(v.x-h.x,v.y-h.y);if(d<bd){bd=d;best=v}}
      for(const p of S.pois||[])if((p.k==='merchant'||p.k==='traveller')&&Math.hypot(p.x-h.x,p.y-h.y)<bd){bd=Math.hypot(p.x-h.x,p.y-h.y);best=p}
      if(best&&(best.k==='merchant'||best.k==='traveller')){const L=best.k==='merchant'?['Rare goods from beyond the rim!','Charms, tomes, a fine mare... come and look.','Treasure maps! Who wants a treasure map?']:best.follow?['Is it much further?','Thank you, hero. I owe you my life.']:best.ambush?['Help! The wolves!','Please, drive them off!']:['I am lost... will you walk me home?','Which way to the nearest town?'];sp=G3.speech={v:best,text:L[Math.floor(Math.random()*L.length)],until:now+3.2};G3.nextTalk=now+7+Math.random()*6;best=null}
      if(best){const tw=S.towns.find(t=>t.id===Math.floor(best.id/100)),L=[];if(tw){const raid=S.monsters.some(m=>m.raid&&m.raid.town===tw.id);if(raid)L.push('Beasts at the walls! Help us!','To the walls, hero!');if(S.g.awake)L.push('The giant walks... I felt it in my bones.','Will it come for us?');else L.push('They say the giant dreams of those who hurt it.','Mind the chains, hero.');
        if(prosperity(tw)>=60)L.push('Good times in '+tw.name+'!','The market is busy today.');else L.push('We could use a farm or two.','Times are lean in '+tw.name+'.');if(h.lvl>=5)L.push('Is that the hero everyone talks about?');if(h.title)L.push('Hail, Champion!');if(h.horse&&h.riding)L.push('Fine horse you have there.');
        sp=G3.speech={v:best,text:L[Math.floor(Math.random()*L.length)],until:now+3.2};G3.nextTalk=now+7+Math.random()*6}}}}
    if(sp){const q=p3(sp.v.x,sp.v.y,95);if(q){ctx.font=`600 ${12*UI}px system-ui`;const w=ctx.measureText(sp.text).width+14;ctx.fillStyle='rgba(250,246,236,.95)';ctx.beginPath();ctx.roundRect?ctx.roundRect(q.x-w/2,q.y-22*UI,w,20*UI,8):ctx.rect(q.x-w/2,q.y-22*UI,w,20*UI);ctx.fill();ctx.beginPath();ctx.moveTo(q.x-5,q.y-2*UI);ctx.lineTo(q.x+5,q.y-2*UI);ctx.lineTo(q.x,q.y+5*UI);ctx.fill();ctx.fillStyle='#2a2418';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sp.text,q.x,q.y-12*UI)}}}
  // you fell: a clear centre message with what felled you and when you come back
  if(S.you&&S.you.dead>0&&S.role==='human'){const h=S.you,by=h.lastBeast&&h.lastBeast.elite?h.lastBeast.elite:h.lastBeast?'a '+h.lastBeast.kind:'your wounds';ctx.fillStyle='rgba(20,0,0,.35)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font=`800 ${30*UI}px system-ui`;ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.strokeText('You fell',W/2,H*.4);ctx.fillStyle='#ff8f80';ctx.fillText('You fell',W/2,H*.4);
    ctx.font=`600 ${15*UI}px system-ui`;const sub='to '+by+' \u00b7 back in '+Math.ceil(h.dead)+' s at your nearest settlement \u00b7 a quarter of your gold is lost';ctx.strokeText(sub,W/2,H*.4+30*UI);ctx.fillStyle='#f3efe4';ctx.fillText(sub,W/2,H*.4+30*UI)}
  for(const e of S.fx){if(e.k!=='slash')continue;const p=e.t/e.life,R=(e.big?62:48),pts=[];for(let i=0;i<=8;i++){const a=e.a-1+i*.25,q=p3(e.x+Math.cos(a)*R,e.y+Math.sin(a)*R,38+i*2);if(q)pts.push(q)}if(pts.length>2){ctx.globalAlpha=.85*(1-p);ctx.strokeStyle=e.big?'#fff05a':'#ffffff';ctx.lineWidth=(e.big?7:4)*UI*(1-p*.6);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const q of pts)ctx.lineTo(q.x,q.y);ctx.stroke();ctx.lineCap='butt';ctx.globalAlpha=1}}
  for(const e of S.fx){if(e.k!=='dust')continue;const p=e.t/e.life,q=p3(e.x,e.y,8+p*20);if(!q)continue;ctx.globalAlpha=.35*(1-p);ctx.fillStyle='#cdbb94';ctx.beginPath();ctx.arc(q.x,q.y,(8+p*22)*UI,0,7);ctx.fill()}ctx.globalAlpha=1;
  for(const e of S.fx){if(e.k!=='spark'&&e.k!=='lvl')continue;const p=e.t/e.life,q=p3(e.x,e.y,e.z||40);if(!q)continue;ctx.globalAlpha=1-p;
    if(e.k==='spark'){ctx.strokeStyle=e.col||'#ffe6a0';ctx.lineWidth=2.5*UI;ctx.beginPath();for(let i=0;i<9;i++){const a=i*0.698+e.x,r0=(6+p*34)*UI,r1=r0+(10-p*8)*UI;ctx.moveTo(q.x+Math.cos(a)*r0,q.y+Math.sin(a)*r0*.7);ctx.lineTo(q.x+Math.cos(a)*r1,q.y+Math.sin(a)*r1*.7)}ctx.stroke()}
    else{const top=p3(e.x,e.y,(e.z||40)+260);if(top){const g=ctx.createLinearGradient(0,q.y,0,top.y);g.addColorStop(0,'rgba(255,220,120,.75)');g.addColorStop(1,'rgba(255,220,120,0)');ctx.fillStyle=g;ctx.fillRect(q.x-22*UI*(1-p*.5),top.y,44*UI*(1-p*.5),q.y-top.y)}
      ctx.font=`900 ${26*UI}px system-ui`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.strokeText('LEVEL UP',q.x,q.y-120*UI-p*30);ctx.fillStyle='#ffd27a';ctx.fillText('LEVEL UP',q.x,q.y-120*UI-p*30)}}
  ctx.globalAlpha=1;
  for(const e of S.fx){const p=e.t/e.life;ctx.globalAlpha=1-p;if(e.k==='ring'||e.k==='mark')ringOnGround(e.x,e.y,e.k==='mark'?e.r*(1-p*.5):e.r*(.5+p*.5),e.col,3);
    if(e.k==='txt'){const q=p3(e.x,e.y,(e.z||40)+p*40);if(q){ctx.font=`800 ${(e.big?21:15)*UI*(p<.12?1.4-p*3.3:1)}px system-ui`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.strokeText(e.text,q.x,q.y);ctx.fillStyle=e.col||'#fff';ctx.fillText(e.text,q.x,q.y)}}ctx.globalAlpha=1}
  if(!onBody)for(const t of S.towns){const p=p3(t.x,t.y,220);if(!p||p.d>19000)continue;{const y=S.you,mk=y&&t.alive&&!t.outpost&&t.i===y.town?(y.quest&&y.quest.done?'!':!tutActive()&&questsOffered(y).length&&questOpen(y).length<C.QUEST_MAX?'?':''):'';if(mk){ctx.font=`900 ${30*UI}px system-ui`;ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.8)';const by=p.y-44*UI-Math.abs(Math.sin(S.t*3))*6*UI;ctx.strokeText(mk,p.x,by);ctx.fillStyle=mk==='!'?'#ffd24a':'#cfe8c8';ctx.fillText(mk,p.x,by)}}lbl(t.name+(t.alive?' \u00b7 '+ageOf(t):' (ruins)'),p.x,p.y-14,12,t.col);if(t.alive)pbar(p.x,p.y,90,t.hp/t.max,'#9be08a')}
  if(!onBody)labelRivalHeroes(p3);if(!onBody)quarryLabels(p3);
  for(const q of S.pois||[]){const tx=poiLabel(q,S.you);if(!tx)continue;const p=p3(q.x,q.y,q.k==='herb'?30:110);if(p&&p.d<(q.k==='herb'?1600:4200))lbl(tx,p.x,p.y,11,q.k==='camp'&&campBeasts(q).length?'#ff9a8a':q.k==='shrine'?SHRINES[q.sub].col:q.k==='merchant'?'#d8b4ff':'#cfe8c8')}
  for(const m of S.monsters)if(m.elite){const p=p3(m.x,m.y,60);if(p&&p.d<3000)lbl(m.elite+(m.kind==='archer'?' (bandit chief)':m.champion?' (champion)':m.warlord?'':' (alpha)')+(m.affix?' \u00b7 '+AFFIX[m.affix].n:''),p.x,p.y,12,'#ff8f80')}
  for(const c of S.caches)if(t3ok(c)){const p=p3(c.x,c.y,70);if(p&&p.d<4200)lbl(cacheLabel(c),p.x,p.y,11,S.t>=c.ready?'#ffcf6a':'#a9afbb')}
  mapLabels();
  upgradeReady();barracksFlags();
  for(const e of S.events){if(e.k==='star'){const p=p3(e.x,e.y,300);if(p&&p.d<20000)lbl('Fallen star: '+e.left+' crystals',p.x,p.y,12,'#9fe8ff')}if(e.k==='raid'&&S.t<e.go){const p=p3(e.x,e.y,150);if(p)lbl('Raiders gathering: '+Math.ceil(e.go-S.t)+' s',p.x,p.y,12,'#ff8f80')}
    if(e.k==='caravan'){const p=p3(e.x,e.y,90);if(p)pbar(p.x,p.y,40,e.hp/e.max,'#9be08a')}}
  for(const m of S.monsters)if(m.hp<m.max){const p=p3(m.x,m.y,m.kind==='troll'?90:40);if(p&&p.d<3000)pbar(p.x,p.y,26,m.hp/m.max,'#ff8f80')}
  if(S.you&&!S.you.dead&&S.you.mode==='ground'){const p=p3(S.you.x,S.you.y,100);if(p)pbar(p.x,p.y,36,S.you.hp/S.you.max,'#9be08a');if(nearFoot(S.you)>=0){const q=p3(S.you.x,S.you.y,0);if(q)lbl('Climb the '+(nearFoot(S.you)?'right':'left')+' foot',q.x,q.y+16,12,'#ffcf6a')}}
  if(g.fallen>0&&!g.dead){const p=p3(g.x+fwd(g).x*700,g.y+fwd(g).y*700,300);if(p)lbl('The giant is down: '+Math.ceil(g.fallen)+' s to strike the Heart-stone',p.x,Math.max(70,p.y),13,'#ffcf6a')}
  if(S.role==='giant'&&g.tx!=null)ringOnGround(g.tx,g.ty,40,'rgba(255,207,106,.9)',2);
  for(const o of S.humans)if(o.job&&!o.dead){const j=o.job,a=j.kind==='site'?bodyWorld(j.s.c+.5,j.s.r+.5,climbing3D()?.face??o.cl?.face):{x:j.x+30,y:j.y,z:0},q=p3(a.x,a.y,a.z+(j.kind==='site'?40:120));if(q&&q.d<5000){pbar(q.x,q.y,50,j.t/j.dur,'#ffcf6a');if(o.you)lbl('Building a '+j.k,q.x,q.y-14,12,'#ffcf6a')}}
  if(S.you&&S.you.dead)lbl('Back to town in '+Math.ceil(S.you.dead)+' s',W/2,H/2,16,'#ff8f80');
  if(S.you&&!S.you.dead&&S.you.mode==='ground'){const at=attackTarget(S.you);if(at)ringOnGround(at.x,at.y,(at.r||14)+10,'rgba(255,120,90,.95)',3)}
  drawCombat3D();
  if(climbing3D())climbOverlay3D();
  {const tg=goalTarget();if(tg){const q=p3(tg.x,tg.y,tg.z!=null?tg.z:140);if(q){if(tg.z!=null){const r=12+3*Math.sin(S.t*4);ctx.strokeStyle='#ffd27a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,r,0,7);ctx.stroke()}lbl('Goal',q.x,q.y-(tg.z!=null?24:0),13,'#ffd27a')}}}
  drawMinimap();G3.calls=G3.renderer.info.render.calls}
function climbViewPoint(c,r){return bodyWorld(c,r,climbing3D()?.face)}
function cellScreen(c,r){const a=climbViewPoint(c,r);return p3(a.x,a.y,a.z)}
function climbOverlay3D(){const h=S.you,cl=h.cl,g=S.g,me=[Math.floor(cl.y),Math.floor(cl.x)],hb=S.body.h;
  if(!cl.fall)for(const[dr,dc]of OFFS){const r=me[0]+dr,c=me[1]+dc;if(r<0||r>=ROWS||c<0||c>=COLS||!hb[r*COLS+c])continue;const q=cellScreen(c+.5,r+.5);if(!q)continue;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(5,q.s*11),0,7);ctx.stroke()}
  const aimV=climbInput(h,readMove()),aim=!cl.grab&&!cl.move&&!cl.fall&&(aimV.x||aimV.y)?reachHold(cl,aimV.x,aimV.y):null;if(aim){const q=cellScreen(aim[1]+.5,aim[0]+.5);if(q){ctx.strokeStyle='#ffcf6a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(8,q.s*15),0,7);ctx.stroke()}}
  {const rt=cl.fall?null:reachT(h);if(rt&&(rt.ch||rt.s||rt.j)){const q=cellScreen(rt.x,rt.y);if(q){ctx.strokeStyle='#6fe3ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(11,q.s*19),0,7);ctx.stroke()}}}
  if(cl.path){ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();let first=true;for(const[r,c]of[[cl.y-.5,cl.x-.5],...cl.path]){const q=cellScreen(c+.5,r+.5);if(!q)continue;first?ctx.moveTo(q.x,q.y):ctx.lineTo(q.x,q.y);first=false}ctx.stroke();ctx.setLineDash([])}
  for(const q of S.crumble){const r=Math.floor(q.i/COLS),c=q.i%COLS,p=cellScreen(c+.5,r+.5);if(p){ctx.strokeStyle='#ff5a3c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(6,p.s*13),0,7);ctx.stroke()}}
  for(const id in JOINTS){const J=JOINTS[id],j=S.joints[id];if(Math.abs(J.r0-cl.y)>30)continue;const q=cellScreen(J.c1+1.5,J.r1+1);if(q)lbl(JOINTS[id].name+' '+Math.ceil(j.hp/j.max*100)+'%',q.x+30,q.y,11,id==='heart'?'#ff8f9a':'#ffcf6a')}
  for(const st of S.sites){if(Math.abs(st.r-cl.y)>20)continue;const q=cellScreen(st.c+.5,st.r+1.5);if(q)lbl(st.build?st.build.k+(lv(st.build)>1?' '+lv(st.build):''):'build spot',q.x,q.y-10,10,st.build?TOWNS[st.build.town].col:'#ffcf6a')}
  const me3=cellScreen(cl.x,cl.y);if(me3){const f=clamp(h.grip/maxGrip(h),0,1),R2=Math.max(16,me3.s*30);ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.arc(me3.x,me3.y-R2*.6,R2,0,7);ctx.stroke();ctx.strokeStyle=f<.25?'#ff8f80':f<.5?'#ffcf6a':'#9be08a';ctx.beginPath();ctx.arc(me3.x,me3.y-R2*.6,R2,-Math.PI/2,-Math.PI/2+f*Math.PI*2);ctx.stroke()}
  const gx=W-18*UI,gt=UIX.top,gb=UIX.rb;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(gx-6,gt-4,14,gb-gt+8);for(const id in JOINTS){const J=JOINTS[id];ctx.fillStyle=id==='heart'?'#ff4d5e':'#ff9a4a';ctx.fillRect(gx-4,gb-(J.r1/ROWS)*(gb-gt),10,3)}
  for(const st of S.sites){ctx.fillStyle=st.build?TOWNS[st.build.town].col:'#ffcf6a';ctx.fillRect(gx-2,gb-(st.r/ROWS)*(gb-gt),6,2)}
  ctx.fillStyle='#fff';ctx.fillRect(gx-7,gb-(cl.y/ROWS)*(gb-gt)-2,16,4);ctx.font=`600 ${13*UI}px system-ui`;ctx.textAlign='right';ctx.textBaseline='alphabetic';ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=3;const ht=Math.round(cl.y*FT)+' ft';ctx.strokeText(ht,gx-12,gb-(cl.y/ROWS)*(gb-gt)+4);ctx.fillStyle='#fff';ctx.fillText(ht,gx-12,gb-(cl.y/ROWS)*(gb-gt)+4);
  if(g.wind&&(g.wind.k==='shake'||g.wind.k==='swipe')){ctx.strokeStyle=`rgba(255,90,70,${.5+.5*Math.sin(S.t*20)})`;ctx.lineWidth=8;ctx.strokeRect(4,4,W-8,H-8);lbl(g.wind.k==='shake'?'BRACE: hold still':'HAND INCOMING: '+(g.wind.side==='L'?'left':'right')+' side',W/2,48,18,'#fff')}
  if(g.fallen>0)lbl('The giant is down: '+Math.ceil(g.fallen)+' s to strike the Heart-stone',W/2,H-24,15,'#ffcf6a')}
const t3ok=c=>S.t>=c.ready;

let titleStones=null;
function drawTitleScene(){const t=performance.now()/1000,g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1c1622');g.addColorStop(.55,'#5a2c2a');g.addColorStop(.8,'#b0603a');g.addColorStop(1,'#2a2a22');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const hz=H*.78;ctx.fillStyle='#3a2a2c';ctx.beginPath();ctx.moveTo(0,hz);for(let x=0;x<=W;x+=8)ctx.lineTo(x,hz-10-12*(Math.sin(x*.011)+.6*Math.sin(x*.027)+1.5));ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
  ctx.fillStyle='rgba(30,20,26,.55)';for(let i=0;i<7;i++){const x=((i*W*.31+t*6)%(W*1.4))-W*.2,y=H*(.08+.05*(i%3));ctx.beginPath();ctx.ellipse(x,y,W*.18,H*.035,0,0,7);ctx.fill()}
  if(!titleStones){const R2=mulberry32(5);titleStones=[];const put=(x,y,r)=>titleStones.push({x,y,r:r*(.85+R2()*.3),n:titleStones.length});
    for(const s of[-1,1])for(let j=0;j<8;j++)put(s*.06+s*.01*j*.2,.98-j*.06,.045);for(let j=0;j<5;j++)for(let k=0;k<4;k++)put(-.1+k*.066,.5-j*.045,.05);
    for(const s of[-1,1])for(let j=0;j<6;j++)put(s*(.16+j*.006),.32+j*.055,.035);put(0,.25,.055);put(.02,.2,.035)}
  const cx=W*.68,sc=H*.9;for(const b of titleStones)stone(cx+b.x*sc,H*.06+b.y*sc*.86,b.r*sc,['#5e5852','#7d756b','#2f2b27'],b.n);
  ctx.strokeStyle='#17141a';ctx.lineWidth=Math.max(2,H*.006);for(const[s,y]of[[-1,.95],[1,.95],[-1,.62],[1,.62]]){ctx.beginPath();ctx.moveTo(cx+s*sc*(y>.9?.07:.19),H*.06+y*sc*.86);ctx.quadraticCurveTo(cx+s*sc*.32,H*.86,cx+s*sc*.45,H*.92);ctx.stroke()}
  for(let i=0;i<14;i++){const x=W*(.06+i*.025),y=H*.88+(i%3)*4;ctx.fillStyle=`rgba(255,${190+(i%4)*12},120,${.5+.4*Math.sin(t*2+i)})`;ctx.fillRect(x,y,3,3)}}
function shapePath(c,x,y,r,shape){c.beginPath();if(shape==='circle')c.arc(x,y,r,0,7);else if(shape==='square')c.rect(x-r*.85,y-r*.85,r*1.7,r*1.7);else{c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath()}}
