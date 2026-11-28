'use strict';
// Colossus · src/combat.js · monsters, shots, telegraphed combat, knockback
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= monsters and shots =================
function stepMonsters(dt){
  const protectedPlayer=tutProtect()?S.you:null;
  for(const m of S.monsters){m.cd=Math.max(0,m.cd-dt);if(beastBusy(m,dt))continue;
    if(m.raid){const town=S.towns[m.raid.town];if(town?.alive&&S.t>=m.raid.go){let foe=null,fd=200**2;for(const h of S.humans)if(!h.dead&&h.mode==='ground'&&h.town===m.raid.i){const d2=distSq(h,m);if(d2<fd){fd=d2;foe=h}}
      const tx=foe?foe.x:town.x,ty=foe?foe.y:town.y,d=Math.hypot(tx-m.x,ty-m.y),sp=m.kind==='troll'?75:105;
      if(foe){beastFight(m,foe,dt);continue}if(d>town.r){m.x+=(tx-m.x)/d*sp*dt;m.y+=(ty-m.y)/d*sp*dt}else if(m.cd<=0){m.cd=1;hurtTown(town,m.atk*(m.raid.wave?.5:1.5))}continue}}
    let tgt=null,bd=(m.kind==='archer'?440:260)**2;
    for(const h of S.humans)if(!h.dead&&h.mode==='ground'&&h!==protectedPlayer){const d2=distSq(h,m);
      if(d2<bd&&!townAt(h)){bd=d2;tgt=h}}
    if(tgt)beastFight(m,tgt,dt);
    else{const dx=m.hx-m.x,dy=m.hy-m.y,d=Math.hypot(dx,dy);if(d>30){m.x+=dx/d*40*dt;m.y+=dy/d*40*dt}else if(rnd()<.01){m.hx=clamp(m.x+rr(-200,200),100,C.MAP-100);m.hy=clamp(m.y+rr(-200,200),100,C.MAP-100)}}}
  for(const m of S.monsters)solidPush(m,m.r);
  for(let i=S.monsters.length-1;i>=0;i--)if(S.monsters[i].hp<=0)removeMonster(i);
  while(S.monsters.length<C.MONSTERS)spawnMonster()}
// ================= combat: read and answer =================
// Every beast telegraphs. When it may strike, it marks the spot its target stands on (a red ring), crouches (a wolf)
// or raises its club (a troll) for the wind-up, and only at its end does the blow land, on whoever is still in the ring:
// stepping out, or the untouchable first part of a dodge, answers it. Beasts on one person take turns (attack tokens:
// one at a time, two for a pack of four or more) while the rest circle at a slot round them. Blows you land knock back by
// their strength, harder from a held (charged) Attack; a beast knocked into stone or a footprint lake takes more.
// All of it is sim state on the fixed tick and uses rnd() only; hit-stop, shake and rings are presentation.
const CB={WIND:{wolf:.7,troll:.85,boar:.75,archer:1.1,knight:.6},RING:{wolf:34,troll:46,boar:44,archer:40,knight:48},RECOVER:{wolf:.45,troll:.6,boar:1.1,archer:.4,knight:.7},CD:{wolf:.9,troll:1.2,boar:1.6,archer:2.2,knight:1.1},HIT:1.4,
  CIRCLE:{wolf:80,troll:92,boar:150,archer:260},DODGE_T:.3,DODGE_IFR:.22,DODGE_DIST:105,DODGE_CD:.5,CHARGE_MIN:.16,CHARGE_FULL:.6,TOK_GAP:.3};
const untouchable=h=>!!(h&&h.dodge&&h.dodge.t<CB.DODGE_IFR);
function cstat(k){const c=S.cstat||(S.cstat={winds:0,hits:0,dodged:0,missed:0,heavy:0,slams:0,lakes:0,dodges:0,two:0});c[k]++}
function dodgedFx(h){if(S.headless||!(h.you||nearPlayer(h))||S.t-(h.dfxT||-9)<.5)return;h.dfxT=S.t;S.fx.push({k:'txt',x:h.x,y:h.y,z:95,text:'Dodged!',t:0,life:.9,col:'#9fe8ff'})}
const lakeAt=(x,y)=>S.prints.some(p=>S.t-p.t>4&&Math.hypot(p.x-x,p.y-y)<C.FOOT_R*.8);
// a free attack token on this person: the shared gap after a strike has passed, and fewer than one (two for a big pack) wind-ups on them
function tokenFree(m,tg){if(S.t<(tg.nextTok||0))return false;let n=0,pack=0;for(const o of S.monsters){if(o.wind&&o.wind.id===tg.id)n++;if(o.eng===tg.id&&S.t-o.engT<.3)pack++}return n<(pack>=4?2:1)}
function beastFight(m,tg,dt){const dx=tg.x-m.x,dy=tg.y-m.y,d=Math.hypot(dx,dy)||1,sp=m.kind==='troll'?85:120,reach=m.r+(m.kind==='troll'?34:30);
  // bandit archers keep their distance (200-340), draw a line to the spot they aim at, and loose after 1.1 s: step off the mark
  if(m.kind==='archer'){m.eng=tg.id;m.engT=S.t;m.fa=Math.atan2(dy,dx);if(m.cd<=0&&d<=340){m.wind={t:0,dur:CB.WIND.archer,x:tg.x,y:tg.y,R:CB.RING.archer,id:tg.id};cstat('winds');if(tg.you&&!S.headless)sfx('warn',true);return}
    const want=d<200?-1:d>320?1:0,sx=-dy/d*(m.id%2?1:-1);m.x+=(dx/d*want*.9+sx*.5)*90*dt;m.y+=(dy/d*want*.9+(dx/d)*(m.id%2?1:-1)*.5)*90*dt;return}
  m.eng=tg.id;m.engT=S.t;const free=m.cd<=0&&tokenFree(m,tg);
  // the turn is ours and the target is in reach: lock the spot where it stands and wind up
  if(free&&d<=reach){const two=S.monsters.some(o=>o!==m&&o.wind&&o.wind.id===tg.id);m.wind={t:0,dur:(CB.WIND[m.kind]||.7)*(m.swift?.7:1),x:tg.x,y:tg.y,R:CB.RING[m.kind]||34,id:tg.id};tg.lunges=(tg.lunges||0)+1;cstat('winds');if(two)cstat('two');
    if(tg.you&&!S.headless)sfx('warn',true);return}
  if(free){const sp2=sp*(m.swift?1.4:1);m.x+=dx/d*sp2*dt;m.y+=dy/d*sp2*dt;return}
  // waiting for a turn: circle at a slot round the target, kept apart from the rest of the pack; a person who walks in is not fled
  if(m.slotFor!==tg.id){m.slot=Math.atan2(-dy,-dx);m.slotFor=tg.id}m.slot+=(m.id%2?1:-1)*.55*dt;
  const RR=CB.CIRCLE[m.kind]||80;let gx=tg.x+Math.cos(m.slot)*RR-m.x,gy=tg.y+Math.sin(m.slot)*RR-m.y;
  for(const o of S.monsters)if(o!==m&&o.eng===tg.id&&S.t-o.engT<.3){const ox=m.x-o.x,oy=m.y-o.y,od=Math.hypot(ox,oy);if(od>0&&od<m.r+o.r+22){gx+=ox/od*40;gy+=oy/od*40}}
  const gl=Math.hypot(gx,gy);if(gl>4){const v=Math.min(d<RR-30?sp*.3:sp*.8,gl*4);m.x+=gx/gl*v*dt;m.y+=gy/gl*v*dt}}
// a wind-up, a knockback or the moment after a strike holds a beast where it is
function beastBusy(m,dt){if(m.kb)return true;
  if(m.wind){const W=m.wind;W.t+=dt;const tg=S.humans.find(h=>h.id===W.id);if(!tg||tg.dead||tg.mode!=='ground'){m.wind=null;m.cd=.4;return true}if(W.t>=W.dur)beastStrike(m,W,tg);return true}
  if(m.rec>0){m.rec-=dt;return true}return false}
function beastStrike(m,W,tg){m.wind=null;m.rec=CB.RECOVER[m.kind]||.45;m.cd=CB.CD[m.kind]||1;tg.nextTok=S.t+CB.TOK_GAP;
  if(m.kind==='archer'){if(!S.headless&&nearPlayer(m))S.fx.push({k:'arrow',x:m.x,y:m.y,x2:W.x,y2:W.y,t:0,life:.18})}
  else if(m.kind==='boar'){const dx=W.x-m.x,dy=W.y-m.y,d=Math.hypot(dx,dy)||1;m.kb={x:dx/d,y:dy/d,left:d+70,by:null,dmg:0,k:0,charge:1};if(!S.headless&&nearPlayer(m))S.fx.push({k:'ring',x:W.x,y:W.y,r:W.R,t:0,life:.3,col:'#ffb070'})}
  else if(m.kind!=='troll'){const dx=W.x-m.x,dy=W.y-m.y,d=Math.hypot(dx,dy);if(d>m.r+6){m.x+=dx/d*(d-m.r-6);m.y+=dy/d*(d-m.r-6);solidPush(m,m.r)}}
  const hit=m.kind==='troll'?S.humans.filter(h=>!h.dead&&h.mode==='ground'&&Math.hypot(h.x-W.x,h.y-W.y)<W.R+10):Math.hypot(tg.x-W.x,tg.y-W.y)<W.R+10?[tg]:[];
  if(m.kind==='troll'&&!S.headless&&nearPlayer(m))S.fx.push({k:'ring',x:W.x,y:W.y,r:W.R,t:0,life:.35,col:'#ffb070'});
  if(!hit.includes(tg)){cstat('missed');if(tg.you&&!S.headless)S.fx.push({k:'txt',x:tg.x,y:tg.y,z:95,text:'Missed',t:0,life:.8,col:'#d8f0ff'})}
  for(const h of hit){if(untouchable(h)){cstat('dodged');h.dodgedN=(h.dodgedN||0)+1;if(h.dodge.t<.14){m.rec=Math.max(m.rec,1.4);m.cd+=1;h.critNext=1;h.perfects=(h.perfects||0)+1;if(h.you&&!S.headless){S.fx.push({k:'txt',x:h.x,y:h.y,z:100,text:'Perfect! Next hit crits',t:0,life:1.1,col:'#9fe8ff',big:1});slowMo(450)}}else dodgedFx(h);continue}cstat('hits');h.lastBeast=m;hurtHuman(h,Math.round(m.atk*CB.HIT*(m.affix==='frenzied'?1+(1-m.hp/m.max):1)),'beast');if(m.affix==='vampiric')m.hp=Math.min(m.max,m.hp+m.atk*2)}}
// a dodge: a quick sidestep, untouchable for its first part, then a short cooldown; no stamina
function threatOf(h){let b=null,bd=1e9;for(const m of S.monsters){const d=Math.hypot(m.x-h.x,m.y-h.y)-(m.wind&&m.wind.id===h.id?1e4:0);if(d<bd&&d<300){bd=d;b=m}}if(!b)b=rivalNear(h,200);return b}
function humanDodge(h,dir){if(h.dead||h.mode!=='ground'||h.job)return false;if(h.dodge||(h.dodgeCd||0)>0)return false;
  let x=dir?dir.x:0,y=dir?dir.y:0;if(Math.hypot(x,y)<.2){const th=threatOf(h);if(th){x=h.x-th.x;y=h.y-th.y}else{x=-Math.cos(h.face||0);y=-Math.sin(h.face||0)}}
  const l=Math.hypot(x,y)||1;h.dodge={t:0,x:x/l,y:y/l,sx:h.x,sy:h.y};h.tx=h.ty=null;h.charge=null;h.face=Math.atan2(y,x);cstat('dodges');
  if(h.you&&!S.headless)sfx('grip',true);return true}
function combatMove(h,dt,vx,vy){h.dodgeCd=Math.max(0,(h.dodgeCd||0)-dt);const D=h.dodge;
  if(D){D.t+=dt;if(D.t>=CB.DODGE_T){h.dodge=null;h.dodgeCd=CB.DODGE_CD*(1-.4*perk(h,'feet'))}else{const s=CB.DODGE_DIST*2*(1-(D.t-dt/2)/CB.DODGE_T)/CB.DODGE_T/C.H_SPEED;return{x:D.x*s,y:D.y*s}}}
  return h.charge?{x:vx*.55,y:vy*.55}:{x:vx,y:vy}}
// bots see a wind-up aimed at them and, about half the time, answer it after a reaction delay, so they can be beaten
function botDodge(h){if(h.dodge||(h.dodgeCd||0)>0||h.job)return;
  for(const m of S.monsters){const W=m.wind;if(!W||W.id!==h.id)continue;if(W.roll==null)W.roll=rnd()<.45?1:0;
    if(W.roll&&W.t>=.3+(h.id%3)*.07&&Math.hypot(h.x-W.x,h.y-W.y)<W.R+12){const ax=h.x-m.x,ay=h.y-m.y,s=h.id%2?1:-1;humanDodge(h,{x:-ay*s+ax*.4,y:ax*s+ay*.4});return}}}
// held Attack: released before the ring fills (0.6 s) it is the plain strike, as a tap always was; held until full and
// released, a heavy blow. Only a full charge is heavy, so a slow tap never turns into a weak half-blow.
const chargeK=t=>clamp((t-CB.CHARGE_MIN)/(CB.CHARGE_FULL-CB.CHARGE_MIN),0,1);
function chargeCancel(){if(S&&S.you)S.you.charge=null}
function heavyStrike(h,k){if(h.cd>0)return false;const at=attackTarget(h);h.swing=.2;if(!at){sayTo(h,'Nothing in reach');return false}h.cd=.5;cstat('heavy');
  const d=Math.round(h.atk*2.5);if(at.town!=null){strikeHuman(h,at,d,k);return true}
  const m=at;m.hp-=d;m.hitT=S.t;if(m.hp>0)warlordPhase(m);if(k>=1&&m.wind){m.wind=null;m.rec=.6;m.cd=Math.max(m.cd,.6)}onBlow(h,m,d,k);
  if(!S.headless&&(h.you||nearPlayer(m))){S.fx.push({k:'txt',x:m.x,y:m.y,z:m.kind==='troll'?95:55,text:'-'+d+(k>=1?'!':''),t:0,life:1,col:k>=1?'#ffb347':'#ffd890'});if(k>=1)S.fx.push({k:'ring',x:m.x,y:m.y,r:m.r+26,t:0,life:.35,col:'#ffcf6a'})}
  sfx(k>=1?'heavy':'hit',h.you||nearPlayer(m));if(m.hp<=0){if(k>=1)h.heavyKills=(h.heavyKills||0)+1;killMonster(m,h)}return true}
// a blow that lands: knockback by its strength (a troll is heavier), a short hit-stop and a small shake for the player
function onBlow(h,o,d,k){const dx=o.x-h.x,dy=o.y-h.y,l=Math.hypot(dx,dy)||1,pw=(18+150*k)*(o.kind==='troll'?.55:o.town!=null?.6:1);
  o.kb={x:dx/l,y:dy/l,left:pw,by:h.id,dmg:d,k,wet:o.town==null&&lakeAt(o.x,o.y)};
  if(!S.headless&&(h.you||o.you)){hitStop([h,o],55+75*k);shake(h.you?2+5*k:3)}}
function knockStep(o,dt){const K=o.kb,s=Math.min(K.left,Math.max(3,K.left*(1-Math.exp(-dt/.08))));o.x=clamp(o.x+K.x*s,20,C.MAP-20);o.y=clamp(o.y+K.y*s,20,C.MAP-20);K.left-=s;if(K.left<=.5)o.kb=null;
  if(o.town!=null)return;const by=S.humans.find(h=>h.id===K.by)||null;
  if(inSolid(o.x,o.y,o.r*.9))knockImpact(o,K,'stone',by);else if(!K.wet&&lakeAt(o.x,o.y))knockImpact(o,K,'lake',by)}
function knockImpact(m,K,what,by){const extra=Math.round(K.dmg*(what==='stone'?.6:.5)+4+10*K.k);m.hp-=extra;m.hitT=S.t;m.kb=null;m.wind=null;m.rec=Math.max(m.rec||0,.7);cstat(what==='stone'?'slams':'lakes');
  if(what==='stone')solidPush(m,m.r);
  if(!S.headless&&nearPlayer(m)){S.fx.push({k:'txt',x:m.x,y:m.y,z:80,text:(what==='stone'?'Into stone ':'Into the lake ')+'-'+extra,t:0,life:1.2,col:what==='stone'?'#ffcf6a':'#9fe8ff'});S.fx.push({k:'ring',x:m.x,y:m.y,r:m.r+30,t:0,life:.4,col:what==='stone'?'#ffcf6a':'#9fe8ff'});sfx('cannon',true);if(by&&by.you)shake(5)}
  if(m.hp<=0&&S.monsters.includes(m))killMonster(m,by)}
function stepCombat(dt){for(const m of S.monsters.slice())if(m.kb)knockStep(m,dt);for(const h of S.humans)if(h.kb){if(h.dead||h.mode!=='ground')h.kb=null;else{knockStep(h,dt);solidPush(h,12)}}
  const h=S.you;if(!h||!h.charge)return;const c=h.charge;if(h.dead||h.mode!=='ground'||h.job||S.autoplay||S.role!=='human'){h.charge=null;return}
  c.t+=dt;if(!aHeld()){h.charge=null;if(chargeK(c.t)<1)humanAct(h,'A');else heavyStrike(h,1)}}
// the player's dodge and attack presses: a dodge goes the way you move (or flick), else away from the nearest threat;
// Attack on the ground starts a charge that resolves on release
let flickDir=null;
function combatPresses(list,wm){const h=S.you,out=[];for(const a of list){
    if(a==='D'){const fd=flickDir;flickDir=null;if(h&&S.role==='human'&&!S.autoplay&&h.mode==='ground'&&!h.dead){let d=fd?camRelative(fd):wm;if(!(d.x||d.y)&&h.tx!=null)d={x:h.tx-h.x,y:h.ty-h.y};humanDodge(h,d)}continue}
    if(a==='A'&&h&&S.role==='human'&&!S.autoplay&&h.mode==='ground'&&!h.dead&&!h.job){if(!h.charge)h.charge={t:0};continue}
    out.push(a)}return out}
function dodgeName(){return device==='touch'?'flick the screen':device==='pad'?'RB':'Shift'}
function attackHint(){return device==='touch'?'hold: heavy':device==='pad'?'hold: heavy · RB: dodge':'hold: heavy · Shift: dodge'}
function stepShots(dt){for(let i=S.shots.length-1;i>=0;i--){const s=S.shots[i];s.t+=dt/s.dur;s.x=s.sx+(s.tx-s.sx)*s.t;s.y=s.sy+(s.ty-s.sy)*s.t;
  if(s.t<1)continue;S.shots.splice(i,1);S.fx.push({k:'ring',x:s.tx,y:s.ty,r:60,t:0,life:.35,col:'#ffaa45'});
  for(const t of S.towns)if(t.alive&&t.i!==s.town&&Math.hypot(t.x-s.tx,t.y-s.ty)<t.r+40){hurtTown(t,s.dmg||C.CANNON_TOWN);const o=S.humans.find(h=>h.id===s.owner);if(o)o.gold+=2}
  for(const h of S.humans)if(!h.dead&&h.mode==='ground'&&h.town!==s.town&&Math.hypot(h.x-s.tx,h.y-s.ty)<60)hurtHuman(h,C.CANNON_HUM,'cannon')}}

