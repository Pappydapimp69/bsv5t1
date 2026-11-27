'use strict';
// Colossus · src/climb.js · a person's step on the ground and on the giant
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

function stepHuman(h,dt,mv){
  const folk=isForager(h),assigned=folk?foragerHome(h):null;
  if(h.dead){h.dead-=dt;if(h.dead<=0){h.dead=0;const home=homeOf(h)||(folk||h.hero?nearestOwn(h.town,h.x,h.y)||h:S.towns[0]);h.x=home.x+rr(-50,50);h.y=home.y+rr(-50,50);h.hp=h.max;h.mode='ground';h.cl=null}return}
  recoverNearHouse(h,dt);
  h.cd=Math.max(0,h.cd-dt);h.swing=Math.max(0,h.swing-dt);stepHorse(h,dt);
  if(h.job?.kind==='site'&&(!h.cl||h.cl.fall))dropJob(h);
  if(h.job){stepJob(h,dt);if(h.mode==='climb'){stepClimb(h,dt,{x:0,y:0});if(!h.cl||h.cl.fall)dropJob(h)}if(h.job||h.mode==='climb')return}
  if(h.mode==='climb'){stepClimb(h,dt,mv);return}
  let vx=mv.x,vy=mv.y;
  if(h.tx!=null&&!vx&&!vy){const dx=h.tx-h.x,dy=h.ty-h.y,d=Math.hypot(dx,dy);if(d<10)h.tx=h.ty=null;else{const st=steerSolid(h,h.tx,h.ty,14);vx=st.x;vy=st.y}}else if(vx||vy)h.tx=h.ty=null;
  ({x:vx,y:vy}=combatMove(h,dt,vx,vy));
  const x=h.x,y=h.y;
  if(vx||vy){const wade=S.prints.some(p=>S.t-p.t>4&&Math.hypot(p.x-h.x,p.y-h.y)<C.FOOT_R*.8)?.5:landPace(h,vx,vy);const ride=(h.riding?C.RIDE*(1+.2*perk(h,'rider'))*(1+.06*((h.horse&&h.horse.lv||1)-1)):1)*(1+.12*perk(h,'swift'))*(buffOf(h,'swift')?1.2:1)*(1+.1*charm(h,'feather'))*(h.boots?1.08:1);h.x+=vx*C.H_SPEED*wade*ride*dt;h.y+=vy*C.H_SPEED*wade*ride*dt;if(h.riding)horseGrow(h,Math.hypot(vx,vy)*C.H_SPEED*wade*ride*dt);h.face=Math.atan2(vy,vx)}solidPush(h,12);
  h.x=clamp(h.x,20,C.MAP-20);h.y=clamp(h.y,20,C.MAP-20);
  if(assigned&&dist(h,assigned)>Math.max(C.FORAGE_RANGE,dist(assigned,{x,y}))){h.x=x;h.y=y;h.goal=null;h.returnHome=true}
  for(let i=S.crystals.length-1;i>=0;i--){const c=S.crystals[i];if(Math.hypot(c.x-h.x,c.y-h.y)<C.PICKUP_R&&(!c.tut||h.you)&&(!folk||inForageRange(assigned,c))){if(packCount(h)>=packCap(h)){if(h.you&&!h.fullSaid){h.fullSaid=1;toast('Your pack is full. Go home to empty it.')}continue}h.fullSaid=0;S.crystals.splice(i,1);if(!c.star&&!c.tut)spawnCrystal();packAdd(h,'crystals',1);S.gathered++;if(S.gathered>=(S.nextStar||C.STAR_EVERY)){S.nextStar=S.gathered+C.STAR_EVERY+4*S.evc.star;if(S.events.filter(e=>e.k==='star').length<2)startStar()};
    if(h.you){sfx('coin');toast('Sky crystal ('+packCount(h)+'/'+packCap(h)+' in pack)'+(h.quest&&h.quest.k==='gather'?' ('+Math.min(h.quest.n,h.quest.need)+'/'+h.quest.need+')':''))}}}
  const t=townAt(h);if(t){h.hp=Math.min(h.max,h.hp+10*dt);questTick(h,'arrive',t.id);if(t.i===h.town)unloadPack(h,t);
    if(folk&&t!==assigned)return;
    if(h.quest&&h.quest.done){h.gold+=h.quest.gold;gainXp(h,h.quest.xp);h.claimed=(h.claimed||0)+1;if(h.you){toast('Quest reward: '+h.quest.gold+' gold.');sfx('coin')}h.quest=null}
    if(!h.quest&&!h.you)h.quest=folk?foragerQuest(h,t):newQuest(h)}}
function foragerQuest(h,t){const kinds=['gather','slay'];
  if(h.lvl>=2&&S.monsters.some(m=>m.kind==='troll'&&inForageRange(t,m)))kinds.push('troll');
  return newQuest(h,kinds[Math.floor(rnd()*kinds.length)])}
function startMove(h,t,lunge){const cl=h.cl,tx=t[1]+.5,ty=t[0]+.5,d=Math.hypot(tx-cl.x,ty-cl.y);
  cl.move={sx:cl.x,sy:cl.y,tx,ty,t:0,lunge,dur:(lunge?.45:.28+.08*d)*(S.g.fallen>0?.5:1)};h.lastMove=S.t;if(!lunge&&S.g.fallen<=0)h.grip-=C.MOVE_GRIP+C.MOVE_GRIP_CELL*d}
function startLunge(h,target){startMove(h,target,true);h.grip-=C.LUNGE_GRIP}
// loose stones give way a moment after they are grabbed
function stepCrumble(dt){for(let k=S.crumble.length-1;k>=0;k--){const q=S.crumble[k];q.t-=dt;if(q.t>0)continue;S.crumble.splice(k,1);S.body.h[q.i]=0;
  for(const h of climbers())if(!h.cl.move&&!h.cl.fall&&Math.floor(h.cl.y)*COLS+Math.floor(h.cl.x)===q.i){sayTo(h,'The stone crumbles away!');startFall(h)}}}
function stepClimb(h,dt,mv){const cl=h.cl,g=S.g,mg=maxGrip(h);
  if(g.dead){dismount(h,0);return}
  if(cl.grab){if(S.t-cl.grab.t<GRAB_TIME&&!cl.fall)return;cl.grab=null}
  if(cl.fall){cl.vy+=C.FALL_G*dt;const ny=cl.y-cl.vy*dt,c=Math.floor(cl.x);
    for(let r=Math.floor(cl.y)-1;r>=Math.floor(ny);r--){if(r<0)break;
      const t=S.body.g[r*COLS+c];const caught=S.anchors.find(a=>a.town===h.town&&Math.abs(a.c-c)<=1&&a.r===r&&a.r<cl.from-1);
      if(restful(t)||caught){cl.fall=false;cl.y=r+.5;if(caught)cl.x=caught.c+.5;const d=caught?4:fallDamage(cl.from-r);h.grip=Math.min(mg,25);
        sayTo(h,caught?'Your rope catches you!':'You slam onto a ledge.');if(d>0)hurtHuman(h,d,'fall');return}}
    cl.y=ny;if(cl.y<=0){const d=fallDamage(cl.from);dismount(h,d);return}return}
  // hold to hold: a move takes a moment and grip in proportion to the reach
  if(cl.move){const M=cl.move;M.t+=dt/M.dur;h.lastMove=S.t;const k=Math.min(1,M.t);cl.x=M.sx+(M.tx-M.sx)*k;cl.y=M.sy+(M.ty-M.sy)*k+(M.lunge?Math.sin(k*Math.PI)*.6:0);
    if(k>=1){cl.x=M.tx;cl.y=M.ty;cl.move=null;const i=Math.floor(cl.y)*COLS+Math.floor(cl.x);if(S.body.h[i]===3&&!S.crumble.some(q=>q.i===i)){S.crumble.push({i,t:C.CRUMBLE});sayTo(h,'Loose stone! Move on before it gives.')}}}
  else{let target=null;const dx=mv.x,dy=mv.y;
    if(dx||dy){cl.path=null;if(dy<0&&cl.y<2.5&&Math.abs(dy)>Math.abs(dx)){dismount(h,0);sayTo(h,'You step down onto the ground.');return}target=reachHold(cl,dx,dy);if(!target&&h.you&&S.t-(h.noHoldT||-9)>4){h.noHoldT=S.t;toast('No hold within reach that way: lunge (K) across the bare stone, or go round.')}}
    else if(cl.path){target=cl.path.shift();if(!cl.path.length)cl.path=null}
    if(target){
      const gap=Math.hypot(target[0]-Math.floor(cl.y),target[1]-Math.floor(cl.x))>C.REACH;
      if(!gap)startMove(h,target,false);
      else if(h.hero&&h.grip>=C.LUNGE_GRIP)startLunge(h,target);
      else cl.path=null
    }}
  const rope=restRope(h,Math.floor(cl.y),Math.floor(cl.x));
  if(h.waking){if(cl.move||cl.fall||g.awake||cl.y<C.WAKE_ROW){interruptWake(h)}
    else{S.wakeT+=dt;h.grip-=1.5*dt;if(S.wakeT>=C.WAKE_TIME){g.awake=true;h.waking=false;h.horn=0;S.grudge[h.town]-=C.WAKE_FAVOR;regard(h,C.WAKE_FAVOR);gainXp(h,40);shake(30);for(const c of S.chains)c.hp=0;
      S.waker=null;chron(whoOf(h).replace(/^./,c=>c.toUpperCase())+' sounded the wake horn; the giant woke owing '+TOWNS[h.town].name+' its thanks.');announce('The horn shatters the chains! '+(h.you?'You have':TOWNS[h.town].name+' has')+' woken and freed the giant. It remembers who did it.');if(!S.headless)chainClank(null,true);if(!S.headless){giantCall('bellow');setTimeout(()=>giantCall('moan'),2600)}}}}
  const moving=!!cl.move;
  if(g.fallen>0)h.grip=Math.min(mg,h.grip+C.GRIP_LEDGE*dt);
  else if(restful(cellT(cl.x,cl.y))&&!moving){const st=siteAt(cl.x,cl.y);h.grip=Math.min(mg,h.grip+C.GRIP_LEDGE*dt*(st&&st.build&&st.build.k==='platform'?2:1))}
  else if(rope&&!moving)h.grip=Math.min(mg,h.grip+C.GRIP_ROPE*dt);
  else h.grip-=(holdAt(cl.x,cl.y)===2?C.MOSS_DRAIN:C.GRIP_STILL)*dt;
  if(h.you&&h.grip<25&&h.grip>0&&Math.floor(S.t*2)!==Math.floor((S.t-dt)*2))sfx('grip');
  if((!cl.move&&!climbable(cl.x,cl.y))||h.grip<=0){if(h.grip<=0&&S.t-(S.windAt||-9)<.5)S.loosed=(S.loosed||0)+1;startFall(h);return}
  questTick(h,'height',Math.floor(cl.y))}

