'use strict';
// Colossus · src/state.js · the sim state S, omens, memory, newGame and the people in it
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= state =================
let S=null;
// omens: each match started from the menu draws one rule twist, told at the start and in the chronicle, so days differ
// in shape. Drawn from their own generator (the land is untouched) and undone at every new game.
const OMENS=[{id:'clear',name:'A clear sky',text:'no omen: the day runs as it always does',w:2,c:{}},
  {id:'restless',name:'A restless giant',text:'its chains are worn thin: two thirds as strong',w:1,c:{CHAIN_HP:600}},
  {id:'blood',name:'A blood moon',text:'wedges bleed joints half again as fast',w:1,c:{WEDGE_DPS:6}},
  {id:'long',name:'A long day',text:'dusk comes at minute 30, not 25',w:1,c:{DUSK:1800}},
  {id:'dark',name:'Dark dreams',text:'the sleeper dreams of those who hurt it sooner and more often',w:1,c:{DREAM_MIN:25,DREAM_CD:60}}];
let OMEN_BASE=null;
function resetOmen(){if(OMEN_BASE)Object.assign(C,OMEN_BASE)}
// what the giant remembers of the last day becomes a lasting baseline its feelings settle back to
C.MEM_FRIEND=-40;C.MEM_WARY=150;C.MEM_MIN=100;
function applyMemory(){const m=save.memory;if(!m||m.v!==1)return;const ok=i=>Number.isInteger(i)&&i>=0&&i<3;S.grudgeBase=[0,0,0];const parts=[];
  if(ok(m.honoured)){S.grudgeBase[m.honoured]=C.MEM_FRIEND;parts.push('it lay down beside '+TOWNS[m.honoured].name+' at the last dusk')}
  if(ok(m.hurt)&&m.hurt!==m.honoured){S.grudgeBase[m.hurt]=C.MEM_WARY;parts.push((m.slain?TOWNS[m.hurt].name+'\u2019s people slew it':TOWNS[m.hurt].name+'\u2019s people hurt it most')+', and it is wary of them')}
  for(let i=0;i<3;i++)S.grudge[i]=S.grudgeBase[i];S.memoryText=parts.length?'The giant remembers: '+parts.join('; ')+'.':null;if(S.memoryText)chron(S.memoryText)}
function applyOmen(o){resetOmen();OMEN_BASE={};for(const o2 of OMENS)for(const k in o2.c)OMEN_BASE[k]=C[k];Object.assign(C,o.c);S.omen=o;
  if(o.c.CHAIN_HP)for(const ch of S.chains){ch.hp=ch.max=C.CHAIN_HP}
  chron('The omen of the day: '+o.name.toLowerCase()+' ('+o.text+').')}
function drawOmen(seed){const R=mulberry32((seed^0x5eed0)>>>0),tot=OMENS.reduce((a,o)=>a+o.w,0);let x=R()*tot;for(const o of OMENS){x-=o.w;if(x<0)return o}return OMENS[0]}
function newGame(role,seed,town=0){resetOmen();
  seed=seed>>>0;rnd=mulberry32(seed);
  const M=C.MAP,cx=M/2,cy=M/2;
  const towns=TOWNS.map((t,i)=>{const a=-Math.PI/2+i*Math.PI*2/3;return{i,id:i,name:t.name,col:t.col,shape:t.shape,x:cx+Math.cos(a)*C.TOWN_RING,y:cy+Math.sin(a)*C.TOWN_RING,r:150,hp:3600,max:3600,alive:true,crystals:0}});
  const joints={};for(const id in JOINTS)joints[id]={hp:JOINTS[id].max,max:JOINTS[id].max,crip:false,wedges:[]};
  const g={x:cx,y:cy,ang:-Math.PI/2,v:0,tx:null,ty:null,fallen:0,dead:false,wind:null,cd:{stomp:2,smash:3,shake:5,swipe:6,twitch:0,strain:0,dream:20,struggle:0},aim:null,
    awake:false,feet:[{x:cx-C.FOOT_SPREAD,y:cy,air:0},{x:cx+C.FOOT_SPREAD,y:cy,air:0}],phase:0,target:null,botT:0,sway:0};
  S={role,seed,t:0,towns,g,joints,body:buildBody(seed),sites:SITES.map(s=>({...s,build:null})),anchors:[],
    humans:[],monsters:[],crystals:[],trees:[],prints:[],shots:[],fx:[],over:null,nextId:1,
    cam:{x:cx,y:cy,zoom:1,czoom:1},autoplay:false};
  S.chains=CHAINS.map(ch=>({...ch,hp:C.CHAIN_HP,max:C.CHAIN_HP}));S.wakeT=0;S.walked=0;S.avenged=false;S.feud=[[0,0,0],[0,0,0],[0,0,0]];S.events=[];S.evc={raid:0,star:0,caravan:0};S.raided=[0,0,0];S.gathered=0;S.grudge=[0,0,0];S.wander=null;{const a=-Math.PI/2+Math.PI/3+2*Math.PI/3*Math.floor(rnd()*3);S.exit={x:cx+Math.cos(a)*4200*WS,y:cy+Math.sin(a)*4200*WS}}S.crumble=[];S.builds=[];S.marks=[];S.rivers=[];S.outposts=[0,0,0];S.revT=[0,0,0];
  // the land forms in order: the fallen giants, hills, rivers to the towns, roads, forests, places (genLand), then beasts and crystals
  genLand(0);
  // Each town starts with one forager. Each new outpost gets one as well.
  // the player can be of any of the three towns; each town has one hero, and the player is their town's
  for(let ti=0;ti<3;ti++){if(role==='human'&&ti===town)S.humans.push(mkHuman(ti,true,'you'));S.humans.push(mkHuman(ti,false,'folk'))}
  S.you=role==='human'?S.humans.find(h=>h.you):null;
  populateLand();
  for(const t of towns)for(let k=0;k<2;k++){const a=Math.atan2(cy-t.y,cx-t.x)+rr(-.9,.9),d=rr(900,2200)*WS*.5+600,x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;
    // move three wandering wolves here (the land keeps its beast count; they just start where people walk)
    for(let j=0;j<3;j++){const px=x+rr(-90,90),py=y+rr(-90,90),w=S.monsters.find(m=>m.wild&&m.kind==='wolf'&&!m.moved&&!m.home);if(!w||inSolid(px,py,30))continue;w.moved=1;w.x=w.hx=px;w.y=w.hy=py;w.home={x,y,r:420}}}
  for(const t of towns)if(!S.you||t.i!==S.you.town)S.humans.push(mkHuman(t.i,false,t.i===2?'warden':'keeper',t,true));
  if(S.you){S.cam.x=S.you.x;S.cam.y=S.you.y}
  return S}
function mkHuman(ti,you,role,t=S.towns[ti],hero=you){
  return{id:S.nextId++,town:ti,you,hero,role,homeId:role==='folk'?t.id:null,x:t.x+rr(-60,60),y:t.y+rr(-60,60),hp:100,max:100,atk:10,lvl:1,xp:0,gold:hero?40:30,
    kits:{anchor:hero?3:0,wedge:hero&&role==='warden'?1:0,cannon:0,brace:0,ladder:hero?1:0,platform:0},potions:1,gloves:0,def:0,gear:{blade:0,armour:0,pack:0,gloves:0},bigPotions:0,crystals:0,horn:0,pack:{crystals:0,pelts:0,found:0},quest:null,mode:'ground',leg:0,cl:null,grip:C.GRIP,cd:0,dead:0,lastMove:-9,
    tx:null,ty:null,goal:null,think:0,face:0,swing:0,botClimb:null,rest:false,
    name:you?'You':role==='folk'?t.name+' forager':hero?HERO_NAMES[ti]:TOWNS[ti].name+' '+role}}
function maxGrip(h){return C.GRIP+h.gloves*25+(h.lvl-1)*5+40*perk(h,'grip')}
// gear comes in tiers; a town sells a tier only once it has been raised to that level
const GEAR={blade:[{n:'Bronze blade',v:4,g:40,t:1},{n:'Steel blade',v:7,g:90,t:2},{n:'Starmetal blade',v:11,g:160,t:3},{n:'Giantbone blade',v:16,g:340,t:3},{n:'Skyforged blade',v:22,g:650,t:3}],
  armour:[{n:'Hide armour',v:3,g:40,t:1},{n:'Mail',v:6,g:90,t:2},{n:'Plate',v:10,g:160,t:3},{n:'Giantbone plate',v:14,g:340,t:3},{n:'Skyforged plate',v:18,g:650,t:3}],
  pack:[{n:'Larger pack',v:2,g:60,t:2},{n:'Great pack',v:2,g:120,t:3}],
  gloves:[{n:'Climbing gloves',v:1,g:50,t:1},{n:'Clawed gloves',v:1,g:110,t:2}]};
const packCap=h=>C.PACK+2*(h.gear?h.gear.pack:0)+(h.packBonus||0);
function nextGear(h,k){const i=h.gear[k],it=GEAR[k][i]||null;if(!it||!S.builds)return it;const t=townAt(h);return t&&t.i===h.town&&civicIn(t,'smithy')?{...it,g:Math.round(it.g*.8)}:it}
function buyGear(h,k,payer=h){const it=nextGear(h,k);payer.gold-=it.g;h.gear[k]++;if(k==='blade')h.atk+=it.v;if(k==='armour')h.def=(h.def||0)+it.v;if(k==='gloves')h.gloves++}
// beasts live somewhere: trolls by the ruins, wolves at their dens (both wander back there), the rest roam the open land
const WOLF_REFILL_LIMIT=Math.ceil(C.MONSTERS*1.15);
// A ruin could bring three raid trolls out alongside a guardian. Allow three in that area instead of four.
const TROLL_LOCAL_LIMIT=3,TROLL_LOCAL_RADIUS=1200;
function canSpawnTroll(x,y){const radiusSq=TROLL_LOCAL_RADIUS**2,point={x,y};
  const trolls=S.monsters.filter(m=>m.kind==='troll'&&m.hp>0),nearby=trolls.filter(m=>distSq(m,point)<=radiusSq);
  return nearby.length<TROLL_LOCAL_LIMIT&&nearby.every(m=>trolls.filter(other=>distSq(other,m)<=radiusSq).length<TROLL_LOCAL_LIMIT)}
function spawnMonster(forceWolf=false){const M=C.MAP,dens=(S.places||[]).filter(p=>p.k==='den'),r=rnd(),lair=S.marks&&S.marks.length&&r<.3,den=!lair&&dens.length&&r<.62;let x,y,ok=false,home=null;
  for(let k=0;k<30&&!ok;k++){if(lair){const m=S.marks[Math.floor(rnd()*S.marks.length)],a=rr(0,6.28),d=rr(250,600);home={x:m.x,y:m.y,r:700};x=clamp(m.x+Math.cos(a)*d,150,M-150);y=clamp(m.y+Math.sin(a)*d,150,M-150)}
    else if(den){const p=dens[Math.floor(rnd()*dens.length)],a=rr(0,6.28),d=rr(60,360);home={x:p.x,y:p.y,r:420};x=clamp(p.x+Math.cos(a)*d,150,M-150);y=clamp(p.y+Math.sin(a)*d,150,M-150)}
    else{x=rr(150,M-150);y=rr(150,M-150)}ok=S.towns.every(t=>Math.hypot(t.x-x,t.y-y)>520)&&!inSolid(x,y,40)}
  const troll=!forceWolf&&(lair?rnd()<.8:den?false:rnd()<.2)&&canSpawnTroll(x,y);
  // boars: chargers on open ground. They paw the earth, then rush through the marked spot and stand winded after (punish them)
  if(!troll&&!forceWolf&&!lair&&!den&&S.nextId%3===0){S.monsters.push({id:S.nextId++,kind:'boar',wild:true,x,y,hx:x,hy:y,home,hp:60,max:60,atk:10,gold:14,xp:18,r:16,cd:0});return}
  S.monsters.push({id:S.nextId++,kind:troll?'troll':'wolf',wild:true,x,y,hx:x,hy:y,home,hp:troll?90:30,max:troll?90:30,atk:troll?13:6,gold:troll?22:8,xp:troll?30:12,r:troll?22:13,cd:0})}
// crystals: half in the three fields on the flanks between towns, half spread over the three sectors. In strict turn: a field crystal, then a sector crystal, round the three fields and sectors. Every second crystal in a field is the
// last one mirrored across the field's line from the giant, so each field leans to neither of its two towns; sector crystals come
// in threes, one spot copied round to each town's sector
function spawnCrystal(){const M=C.MAP,cx=M/2,cy=M/2,F=(S.places||[]).filter(p=>p.k==='field');let x,y;const n=S.crysN=(S.crysN||0)+1,q=n>>1;
  for(let k=0;k<30;k++){if(F.length&&n%2){const f=F[q%F.length],fa=Math.atan2(f.y-cy,f.x-cx);let a,d;if(f.last&&!k){a=2*fa-f.last.a;d=f.last.d;f.last=null}else{a=rr(0,6.28);d=f.r*Math.sqrt(rnd());f.last={a,d}}x=f.x+Math.cos(a)*d;y=f.y+Math.sin(a)*d}
    else{const t=S.towns[q%3];if(q%3===1||!S.crysRel||k)S.crysRel={a:rr(-.95,.95),d:Math.sqrt(rr(.03,1))*3950*WS};const a=Math.atan2(t.y-cy,t.x-cx)+S.crysRel.a,d=S.crysRel.d;x=cx+Math.cos(a)*d;y=cy+Math.sin(a)*d}
    x=clamp(x,200,M-200);y=clamp(y,200,M-200);if(!inSolid(x,y,60)&&S.towns.every(t=>Math.hypot(t.x-x,t.y-y)>t.r+40))break}
  S.crystals.push({id:S.nextId++,x,y})}
// the old giants are stone: everyone who walks is kept outside their boulders (the living giant steps over them)
function solids(){if(S.markCols&&S.markCols.n===S.marks.length)return S.markCols;const L=S.marks.map(m=>{const cs=markBoulders(m).map(b=>({x:b.x,y:b.y,r:b.r*.85}));let R=0;for(const c of cs)R=Math.max(R,Math.hypot(c.x-m.x,c.y-m.y)+c.r);return{x:m.x,y:m.y,R,cs}});L.n=S.marks.length;S.markCols=L;return L}
function inSolid(x,y,rad){for(const m of solids()){if(Math.hypot(x-m.x,y-m.y)>m.R+rad)continue;for(const c of m.cs)if(Math.hypot(x-c.x,y-c.y)<c.r+rad)return m}return null}
function solidPush(o,rad){for(let it=0;it<3;it++){let moved=false;for(const m of solids()){if(Math.hypot(o.x-m.x,o.y-m.y)>m.R+rad)continue;for(const c of m.cs){const dx=o.x-c.x,dy=o.y-c.y,d=Math.hypot(dx,dy),need=c.r+rad;if(d<need){o.x=c.x+(d?dx/d:1)*need;o.y=c.y+(d?dy/d:0)*need;moved=true}}}if(!moved)return}}
// walkers going somewhere never press into a mountain. Both outside a body's outer circle: walk the tangent round it (convex, nothing can trap).
// Either end inside it: follow a walking grid of the body (40-unit cells, breadth-first from the goal, or from open ground past the circle),
// so a walker in the pocket between a stone arm and the torso finds the way out instead of pressing into the rock
const SG=40;
function markField(m,gx,gy){if(!m.g){const n=Math.ceil((m.R+120)*2/SG),ox=m.x-n*SG/2,oy=m.y-n*SG/2,wall=new Uint8Array(n*n),out=new Uint8Array(n*n);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=ox+(i+.5)*SG,y=oy+(j+.5)*SG;for(const c of m.cs)if(Math.hypot(x-c.x,y-c.y)<c.r+14){wall[j*n+i]=1;break}if(Math.hypot(x-m.x,y-m.y)>m.R+20)out[j*n+i]=1}
    m.g={n,ox,oy,wall,out,f:new Map()}}
  const G=m.g,key=gx==null?'out':Math.floor((gx-G.ox)/SG)+','+Math.floor((gy-G.oy)/SG);let F=G.f.get(key);if(F)return F;
  const n=G.n;F=new Int32Array(n*n).fill(-1);const q=[];
  if(gx==null){for(let k=0;k<n*n;k++)if(G.out[k]&&!G.wall[k]){F[k]=0;q.push(k)}}
  else{const i=clamp(Math.floor((gx-G.ox)/SG),0,n-1),j=clamp(Math.floor((gy-G.oy)/SG),0,n-1);F[j*n+i]=0;q.push(j*n+i)}
  for(let h=0;h<q.length;h++){const k=q[h],i=k%n,j=(k-i)/n;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=n||b>=n)continue;const kk=b*n+a;if(F[kk]>=0||G.wall[kk])continue;
    if(di&&dj&&(G.wall[j*n+a]||G.wall[b*n+i]))continue;F[kk]=F[k]+1;q.push(kk)}}
  if(G.f.size>24)G.f.delete(G.f.keys().next().value);G.f.set(key,F);return F}
function steerSolid(o,tx,ty,rad){const dx=tx-o.x,dy=ty-o.y,d=Math.hypot(dx,dy);if(d<1)return{x:0,y:0};const ux=dx/d,uy=dy/d;let m=null;
  for(let k=40;k<Math.min(d,1600)&&!m;k+=40)m=inSolid(o.x+ux*k,o.y+uy*k,rad);if(!m){o.ss=0;return{x:ux,y:uy}}
  const rx=o.x-m.x,ry=o.y-m.y,r=Math.hypot(rx,ry)||1,nx=rx/r,ny=ry/r,Rm=m.R+rad,goalIn=Math.hypot(tx-m.x,ty-m.y)<Rm;
  if(r<=Rm+10||goalIn){const F=markField(m,goalIn?tx:null,goalIn?ty:null),G=m.g,n=G.n,i=Math.floor((o.x-G.ox)/SG),j=Math.floor((o.y-G.oy)/SG);
    if(i>=0&&j>=0&&i<n&&j<n){let best=-1,bv=1e9;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=n||b>=n)continue;const v=F[b*n+a];if(v>=0&&v<bv){bv=v;best=b*n+a}}
      if(best>=0&&bv>0){const cx=G.ox+(best%n+.5)*SG-o.x,cy=G.oy+(Math.floor(best/n)+.5)*SG-o.y,l=Math.hypot(cx,cy)||1;return{x:cx/l,y:cy/l}}
      if(bv===0&&goalIn)return{x:ux,y:uy}}
    if(r<=Rm+10)return{x:nx,y:ny}}
  if(!o.ss)o.ss=(-ny*ux+nx*uy)<0?-1:1;const a=Math.atan2(-ny,-nx)-o.ss*Math.asin(Math.min(1,Rm/r));return{x:Math.cos(a),y:Math.sin(a)}}
