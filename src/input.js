'use strict';
// Colossus · src/input.js · keys, mouse, touch and gamepad
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= input =================
const keys=new Set(),presses=[];let device='keys';
const KEYMAP={KeyJ:'A',Space:'A',KeyK:'B',KeyL:'X',KeyH:'Y',ShiftLeft:'D',ShiftRight:'D'};
addEventListener('keydown',e=>{if(e.code==='F11'||e.ctrlKey||e.metaKey||e.altKey)return;device='keys';unlockAudio();
  if(menu){if(!e.repeat)menuKey(e.code);e.preventDefault();return}
  if(!S||S.over)return;
  if(FILM&&S.t>1.5){if(!e.repeat)skipFilm();e.preventDefault();return}
  if(S.fly){if(!e.repeat)flyPress();e.preventDefault();return}
  if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat){openPause();e.preventDefault();return}
  if(e.code==='KeyC'&&!e.repeat)camReset();
  if(e.code==='KeyB'&&!e.repeat&&S.you){openArmy();e.preventDefault();return}
  if(e.code==='KeyR'&&!e.repeat&&S.you&&!S.you.dead){toggleRide(S.you);e.preventDefault();return}
  if(e.code==='KeyT'&&!e.repeat&&S.you){openTalents();e.preventDefault();return}
  if((e.code==='KeyI'||e.code==='Tab')&&!e.repeat&&S.you){openSheet();e.preventDefault();return}
  if(e.code==='KeyM'&&!e.repeat){BIGMAP=!BIGMAP;if(BIGMAP&&tutActive())S.tut.mapOpened=true;e.preventDefault();return}
  if(e.code==='KeyN'&&!e.repeat&&tutActive()){tutCycle();e.preventDefault();return}
  if(e.code==='KeyN'&&!e.repeat&&S.you){questCycle(S.you);e.preventDefault();return}
  if(e.code==='KeyO'&&!e.repeat&&S.you){questToggle();e.preventDefault();return}
  if(e.code==='KeyV'&&!e.repeat&&S.you){ringsOn=!ringsOn;toast(ringsOn?'Building ranges shown (V to hide).':'Building ranges hidden.');e.preventDefault();return}
  {const sk=SKILLS.find(k=>'Digit'+k.key===e.code);if(sk&&!e.repeat&&S.you){useSkill(S.you,sk.id);e.preventDefault();return}}
  if(!keys.has(e.code)&&KEYMAP[e.code])presses.push(KEYMAP[e.code]);keys.add(e.code);
  if(/Arrow|Space/.test(e.code))e.preventDefault()});
addEventListener('keyup',e=>keys.delete(e.code));
function releaseAll(){keys.clear();padHeld.clear();touchA.clear();chargeCancel()}
addEventListener('blur',()=>{releaseAll();if(S&&!S.over&&!menu)openPause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAll();if(S&&!S.over&&!menu)openPause()}});
function takePresses(){return presses.splice(0)}
function stickInput(ax,ay,dead){const m=Math.hypot(ax,ay);if(m<=dead)return[0,0];const k=Math.min(1,(m-dead)/(1-dead))/m;return[ax*k,ay*k]}
let padVec={x:0,y:0},padZoom=0,padCam={x:0,y:0};const padHeld=new Set();
function readMove(){let x=0,y=0;
  if(keys.has('KeyA')||keys.has('ArrowLeft'))x-=1;if(keys.has('KeyD')||keys.has('ArrowRight'))x+=1;
  if(keys.has('KeyW')||keys.has('ArrowUp'))y-=1;if(keys.has('KeyS')||keys.has('ArrowDown'))y+=1;
  const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
  return Math.hypot(padVec.x,padVec.y)>Math.hypot(x,y)?{x:padVec.x,y:padVec.y}:{x,y}}
addEventListener('gamepadconnected',()=>{});
addEventListener('gamepaddisconnected',()=>{if(S&&!S.over&&!menu)openPause()});
let padLatch=new Set();
function pollPad(){const pads=navigator.getGamepads?navigator.getGamepads():[];let ax=0,ay=0,any=false,zi=0,zo=0;const now=new Set();
  for(const gp of pads){if(!gp)continue;any=true;const a0=gp.axes[0]||0,a1=gp.axes[1]||0;if(Math.hypot(a0,a1)>Math.hypot(ax,ay)){ax=a0;ay=a1}
    gp.buttons.forEach((b,i)=>{if(b.pressed)now.add(i)});zi=Math.max(zi,gp.buttons[7]?.value||0);zo=Math.max(zo,gp.buttons[6]?.value||0)}
  if(!any){padVec={x:0,y:0};padZoom=0;padCam={x:0,y:0};return}
  const[sx,sy]=stickInput(ax,ay,.2);padVec={x:sx,y:sy};padZoom=zo-zi;let rx=0,ry=0;for(const gp of pads){if(!gp)continue;const a2=gp.axes[2]||0,a3=gp.axes[3]||0;if(Math.hypot(a2,a3)>Math.hypot(rx,ry)){rx=a2;ry=a3}}const[crx,cry]=stickInput(rx,ry,.2);padCam={x:crx,y:cry};if(crx||cry)device='pad';if(sx||sy||now.size)device='pad';
  for(const i of now){if(padHeld.has(i)||padLatch.has(i))continue;unlockAudio();
    if(menu){const m={12:'ArrowUp',13:'ArrowDown',14:'ArrowLeft',15:'ArrowRight',0:'Enter',1:'Escape',9:'Escape'}[i];if(m)menuKey(m)}
    else if(S&&S.fly)flyPress();
    else if(S&&!S.over){if(i===9||i===8)openPause();else if(i===11)camReset();else if(S.you&&i===10)toggleRide(S.you);else if(S.you&&i>=12&&i<=15)useSkill(S.you,{12:'cry',15:'whirl',13:'mend',14:'spear'}[i]);else{const s={0:'A',1:'B',2:'X',3:'Y',4:'D',5:'D'}[i];if(s)presses.push(s)}}}
  for(const i of padLatch)if(!now.has(i))padLatch.delete(i);
  padHeld.clear();for(const i of now)padHeld.add(i)}
function latchHeld(){for(const i of padHeld)padLatch.add(i);keys.clear();presses.length=0;chargeCancel()}

// pointer: tap a destination (ground) or a hold (climbing); drag pans nothing, pinch and wheel zoom
const cv=document.getElementById('cv');const ptrs=new Map();let tapDown=null,pinch=null;
addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){device='touch';document.body.classList.add('touch')}unlockAudio();if(FILM&&S&&!S.over&&!menu&&S.t>1.5)skipFilm()},{capture:true});
// the opening film can be skipped: the world runs ahead to the film's end, so nothing differs but the wait
function skipFilm(){if(!S||S.t>=OPENING.len)return;S.trumpetsDue=false;S.filmSkipped=true;while(S.t<OPENING.len&&!S.over)step(C.DT);if(S.introCam){const f=S.you||S.g;cam.yaw=Math.atan2(S.g.x-f.x,-(S.g.y-f.y))}S.introCam=false;cam.pitch=.12;S.cam.zoom=1;if(S.you){S.cam.x=S.you.x;S.cam.y=S.you.y}}
cv.addEventListener('pointerdown',e=>{
  // the sleeping giant's body panel is a picker: tap or click a part of the body to aim the twitch there
  if(S&&S.role==='giant'&&!S.g.awake&&S.panelRect){const R=cv.getBoundingClientRect(),P=S.panelRect,x=e.clientX-R.left,y=e.clientY-R.top;
    if(x>=P.x-8&&x<=P.x+P.w+8&&y>=P.y&&y<=P.y+P.h){const c=clamp((x-P.x)/P.w*COLS,0,COLS-1),r=clamp(ROWS-1-(y-P.y)/P.h*ROWS,0,ROWS-1);S.g.aim=zoneAt(r,c);S.g.aimT=S.t;e.preventDefault();return}}
  cv.setPointerCapture?.(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1)tapDown={x:e.clientX,y:e.clientY,moved:0};else{tapDown=null;const[a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}});
cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(tapDown)tapDown.moved+=Math.hypot(dx,dy);
  // one finger or the mouse dragging turns and tilts the camera on the ground
  if(ptrs.size===1&&tapDown&&tapDown.moved>12&&S&&!menu&&!(S.you&&S.you.mode==='climb'))camTurn(-dx*.006,dy*.004);
  if(ptrs.size===2&&pinch){const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);zoomBy(d/Math.max(20,pinch));pinch=d}});
const ptrEnd=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null};
cv.addEventListener('pointercancel',e=>{ptrEnd(e);tapDown=null});
cv.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-e.deltaY*.0012))},{passive:false});
cv.addEventListener('pointerup',e=>{ptrEnd(e);const td=tapDown;tapDown=null;if(S&&S.fly&&td){flyPress();return}if(!td||td.moved>14||!S||S.over||menu)return;
  const r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;
  if(S.you&&S.you.mode==='climb'&&!S.you.dead){const cl=S.you.cl;if(cl.grab||cl.fall||cl.move)return;const p=screenToCell(sx,sy);
    let path=bfs(Math.floor(cl.y),Math.floor(cl.x),(rr2,cc)=>Math.abs(rr2-p.r)<=1&&Math.abs(cc-p.c)<=1,12000);
    if(path){cl.path=path;S.fx.push({k:'cellmark',r:p.r,c:p.c,t:0,life:.8})}else toast('No route there.');return}
  const w=screenToWorld(sx,sy);
  if(S.role==='giant'){S.g.tx=w.x;S.g.ty=w.y;S.fx.push({k:'mark',x:w.x,y:w.y,t:0,life:1,r:70,col:'#ffcf6a'})}
  else if(S.you&&!S.you.dead&&!S.you.job){S.you.tx=w.x;S.you.ty=w.y;S.fx.push({k:'mark',x:w.x,y:w.y,t:0,life:.6,r:18,col:'#ffffff'})}});
function zoomBy(k){if(!S)return;S.cam.zoom=clamp(S.cam.zoom*k,.5,2.4)}
function camReset(){if(S)S.cam.zoom=1;cam.yaw=0;cam.pitch=.12}

// action buttons
const padEl=document.getElementById('pad'),SLOTS=['A','B','X','Y'];
const KEYNAMES={keys:{A:'J',B:'K',X:'L',Y:'H'},pad:{A:'A',B:'B',X:'X',Y:'Y'},touch:{A:'',B:'',X:'',Y:''}};
padEl.innerHTML=SLOTS.map(s=>`<button class="ab" data-s="${s}"><span class="k"></span><span class="l"></span><small></small></button>`).join('');
padEl.querySelectorAll('.ab').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();if(S&&S.fly){flyPress();return}if(!S||S.over||menu)return;presses.push(b.dataset.s)}));
function slotInfo(){if(!S)return null;
  if(S.role==='giant'&&!S.g.awake&&!S.g.dead){const r=k=>canGiant(k),z=aimZone(),ch=strainTarget();
    return{A:{l:'Twitch '+ZONES[z],why:r('twitch'),sub:S.g.aim?null:device==='touch'?'Tap your body to pick a part':'Arrows or a click on your body pick a part'},B:{l:allWeak()?'Rise':'Strain',sub:ch&&!allWeak()?ch.name.replace(' chain',''):null,why:r('strain')},X:{l:'Nightmare',sub:(t=>t?'on '+t.name:null)(dreamTarget()),why:r('dream')},Y:{l:'Swipe',why:'Asleep'}}}
  if(S.role==='giant'&&S.g.fallen>0&&!S.g.dead){const w={l:'Struggle',sub:'Press fast to rise sooner ('+Math.ceil(S.g.fallen)+' s)',why:null};return{A:w,B:w,X:w,Y:w}}
  if(S.role==='giant'){const r=k=>canGiant(k);return{A:{l:'Stomp',why:r('stomp')},B:{l:'Smash',why:r('smash')},X:{l:'Shake',why:r('shake')},Y:{l:'Swipe',why:r('swipe')}}}
  return humanCtx(S.you)}
let lastSig='';
document.getElementById('stats-menu').addEventListener('click',()=>{if(!menu)openPause()});
function hintText(){const h=S&&S.you,cl=h&&h.mode==='climb';
  const tip=cl&&restful(cellT(h.cl.x,h.cl.y))?' On a ledge: grip refills.':cl?' Moss drains grip; orange stones crumble.':'';
  if(device==='touch')return cl?'Tap a hold to climb to it.'+tip:'Tap or drag to walk. Flick to dodge. Pinch to zoom.';
  if(device==='pad')return cl?'Left stick picks a hold.'+tip:'Left stick walks, right stick turns the camera. <kbd>RB</kbd> dodges. D-pad: skills. Press the left stick to ride.';
  return cl?'Click a hold to climb to it.'+tip:'WASD or click to walk. Q and E turn the camera. <kbd>Shift</kbd> dodges. <kbd>1</kbd>-<kbd>5</kbd> skills, <kbd>T</kbd> talents, <kbd>I</kbd> your hero, <kbd>M</kbd> map, <kbd>R</kbd> ride, <kbd>B</kbd> barracks, <kbd>O</kbd> quests.'}
function paintButtons(){document.body.dataset.dev=device;const info=slotInfo();if(!info)return;const kn=KEYNAMES[device]||KEYNAMES.keys;let sig=device;for(const s of SLOTS)sig+=info[s].l+'|'+info[s].why;if(sig===lastSig)return;lastSig=sig;
  padEl.querySelectorAll('.ab').forEach(b=>{const i=info[b.dataset.s];b.querySelector('.k').textContent=kn[b.dataset.s];b.querySelector('.l').textContent=i.l;b.querySelector('small').textContent=i.why||i.sub||'';b.classList.toggle('off',!!i.why)})}

// combat input. Attack is a press and a held state on every device (J or Space, pad A, a finger on the Attack button,
// captured so a slide off the button still releases). Dodge is Shift, either pad shoulder, or on touch a quick flick
// across the play area: a drag under 280 ms and over 48 px, faster than a slow camera drag, which it then undoes.
const touchA=new Set();
{const ab=padEl.querySelector('.ab[data-s="A"]');ab.addEventListener('pointerdown',e=>{try{ab.setPointerCapture(e.pointerId)}catch(_){}touchA.add(e.pointerId)});
  for(const ev of['pointerup','pointercancel','lostpointercapture'])ab.addEventListener(ev,e=>touchA.delete(e.pointerId))}
function aHeld(){return keys.has('KeyJ')||keys.has('Space')||(padHeld.has(0)&&!padLatch.has(0))||touchA.size>0}
let flick=null;
cv.addEventListener('pointerdown',e=>{flick=e.pointerType==='touch'&&ptrs.size<=1?{id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp,yaw:cam.yaw,pitch:cam.pitch}:null});
cv.addEventListener('pointerup',e=>{const f=flick;flick=null;if(!f||f.id!==e.pointerId)return;const dx=e.clientX-f.x,dy=e.clientY-f.y,dd=Math.hypot(dx,dy),dt=e.timeStamp-f.t;
  if(dt>280||dd<48)return;const h=S&&S.you;if(!h||S.over||menu||S.fly||h.mode!=='ground'||h.dead||S.role!=='human')return;
  cam.yaw=f.yaw;cam.pitch=f.pitch;flickDir={x:dx/dd,y:dy/dd};presses.push('D')});
// hit-stop: the struck and the striker hold their drawn pose for a few frames; the simulation never waits for it
const HSTOP=new Map();
function hitStop(list,ms){const until=performance.now()+ms;for(const o of list)if(o)HSTOP.set(o,{until,x:o.x,y:o.y,swing:o.swing!=null?Math.min(o.swing,.07):o.swing,rec:o.rec,wt:o.wind?o.wind.t:null})}
// a part of a ring on the ground, from angle a0 to a1
function arcOnGround(x,y,r,a0,a1,col,w){const n=Math.max(3,Math.ceil(Math.abs(a1-a0)/(Math.PI/16)));ctx.beginPath();for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n,p=p3(x+Math.cos(a)*r,y+Math.sin(a)*r,2);if(!p)return;i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.strokeStyle=col;ctx.lineWidth=w;ctx.stroke()}
let teachN=0,teachW=null;
// telegraphs: the marked spot as a filled red disc with a hard edge, a ring shrinking onto it, a mark over the beast;
// aimed at you it is brighter and, while you learn, names the dodge. Then your charge and your dodge.
function drawCombat3D(){if(!S||climbing3D())return;const you=S.you;
  for(const m of S.monsters){const W=m.wind;if(!W||Math.hypot(W.x-S.cam.x,W.y-S.cam.y)>2600)continue;const p=Math.min(1,W.t/W.dur),mine=!!you&&W.id===you.id;
    ringOnGround(W.x,W.y,W.R,null,0,null,`rgba(255,30,20,${(mine?.18:.1)+.34*p})`);
    ringOnGround(W.x,W.y,W.R,mine?'rgba(255,50,35,1)':'rgba(255,90,60,.85)',mine?4:2.5);
    ringOnGround(W.x,W.y,W.R*(1+1.7*(1-p)),`rgba(255,${200-140*p|0},${170-140*p|0},${.55+.45*p})`,mine?3.5:2);
    const q=p3(m.x,m.y,m.kind==='troll'?118:58);if(q&&q.d<3000){const r=(mine?2:0)+Math.max(10,Math.min(15,q.s*16))*(1+.15*Math.sin(S.t*18));ctx.fillStyle=mine?'#e8231b':'rgba(200,40,30,.9)';ctx.beginPath();ctx.arc(q.x,q.y-r,r,0,7);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
      ctx.fillStyle='#fff';ctx.font=`800 ${Math.round(r*1.5)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',q.x,q.y-r+1)}
    if(mine){if(teachW!==W){teachW=W;teachN++}if(teachN<=6||(S.tut&&!S.tut.done)){const g=p3(W.x,W.y,0);if(g)lbl('Dodge: '+dodgeName(),g.x,g.y+Math.max(26,W.R*g.s+16),13,'#ffffff')}}}
  // aimed at you: the screen's edges glow red as the wind-up runs out, readable however small the figures are
  {let p=0;for(const m of S.monsters)if(m.wind&&you&&m.wind.id===you.id)p=Math.max(p,Math.min(1,m.wind.t/m.wind.dur));if(p>0&&!you.dead){const e=Math.min(W,H)*.09,a=.18+.4*p;ctx.save();
    for(const[x0,y0,x1,y1,rx,ry,rw,rh]of[[0,0,0,e,0,0,W,e],[0,H,0,H-e,0,H-e,W,e],[0,0,e,0,0,0,e,H],[W,0,W-e,0,W-e,0,e,H]]){const gr=ctx.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,`rgba(230,30,20,${a})`);gr.addColorStop(1,'rgba(230,30,20,0)');ctx.fillStyle=gr;ctx.fillRect(rx,ry,rw,rh)}ctx.restore()}}
  if(!you||you.dead||you.mode!=='ground')return;
  if(you.charge&&you.charge.t>CB.CHARGE_MIN){const k=chargeK(you.charge.t),full=k>=1;
    ringOnGround(you.x,you.y,30,'rgba(0,0,0,.55)',6);
    arcOnGround(you.x,you.y,30,-Math.PI/2,-Math.PI/2+Math.PI*2*k,full?`rgba(255,${235+20*Math.sin(S.t*30)|0},170,1)`:'#ffb347',full?6:5);
    if(full){ringOnGround(you.x,you.y,38+4*Math.sin(S.t*20),'rgba(255,220,140,.8)',2);const q=p3(you.x,you.y,0);if(q)lbl('Heavy: release',q.x,q.y+28,13,'#ffcf6a')}}
  if(you.dodge){const D=you.dodge;for(let i=1;i<=3;i++){const u=i/4,x=D.sx+(you.x-D.sx)*u,y=D.sy+(you.y-D.sy)*u;ringOnGround(x,y,14,`rgba(170,235,255,${.25*i})`,2,null,`rgba(160,230,255,${.14*i})`)}if(untouchable(you))ringOnGround(you.x,you.y,22,'rgba(190,240,255,1)',3.5)}}
window.__combat={CB,humanDodge,heavyStrike,beastFight,tokenFree,get flick(){return flick}};
