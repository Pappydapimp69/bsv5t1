'use strict';
// Colossus · src/rpg/economy.js · the town economy: settlers who move into houses, workplaces that employ them, food,
// wood and stone stockpiles, fires and the fire station, roads the settlers wear in, quarries and the ages of a settlement
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.
// Owner (2026-11-28, binding; also in RULES.md): a city builder in the manner of the classic Nile-valley builders. You build
// houses and settlers come to live in them. You do not create or assign people: you build workplaces (farm, woodcutter,
// quarry, granary, well, watchtower, barracks, fire station; also market, smithy, stable) and each employs settlers from
// the town's houses, working only while it has them. The settlers build their own roads by walking the same ways.

const MATS=['food','wood','stone'];
const RES_ICON={food:'\u{1F33E}',wood:'\u{1FAB5}',stone:'\u{1FAA8}',gold:'\u{1FA99}',crystals:'\u{1F48E}',folk:'\u{1F465}',work:'⚒'};
C.RES_COST={house:{wood:40},tower:{stone:40},barracks:{wood:50,stone:20},farm:{wood:40},market:{wood:60,stone:30},smithy:{wood:30,stone:40},stable:{wood:60},well:{stone:25},outpost:{wood:60,food:60},
  woodcutter:{stone:15},quarry:{wood:30},granary:{wood:50,stone:20},firehouse:{wood:40,stone:30}};
Object.assign(C.COST,{house:30,farm:25,tower:45,barracks:45,market:60,smithy:55,stable:45,well:20,woodcutter:25,quarry:25,granary:35,firehouse:35});
C.START_RES={food:200,wood:200,stone:100};C.VILLAGE_RES={food:60,wood:60,stone:0};
// workplaces and how many settlers each employs; the labour goes to them in this order unless the player raises one
C.JOBS={firehouse:3,farm:4,granary:3,woodcutter:4,quarry:5,well:1,tower:2,barracks:4,market:3,smithy:3,stable:2};
C.LABOUR_ORDER=Object.keys(C.JOBS);
C.HOUSE_POP=6;C.HALL_POP=6;C.OUTPOST_POP=3;C.SETTLER_EVERY=4;C.EAT=8;C.FOOD_CAP=250;C.GRANARY_CAP=500;
C.PROD={farm:{food:14},woodcutter:{wood:12},quarry:{stone:10}};C.FOREST_N=4;C.FOREST_R=400;C.OUTCROP_R=240;C.WORK_REACH=2400;
C.FIRE_R=700;C.FIRE_SAFE=300;C.FIRE_P=.005;C.ROAD_STEPS=12;C.WALK=55;
// soldiers eat: food is spent on the army as on the town (official AoE2 guide, Lesson 3: basic units 'only cost Food, or a
// combination of Food and Wood'); without a sink food piled up unused
C.SOLDIER_FOOD=40;const solFoodWhy=b=>{const t=S.towns[b.settlementId],f=Math.floor(stockOf(t,'food'));return f<C.SOLDIER_FOOD?'Need '+(C.SOLDIER_FOOD-f)+' more food':null};
const botFoodSpare=t=>!t||stockOf(t,'food')>=C.SOLDIER_FOOD+60;
// a market turns a surplus into coin, so a material that stops binding late still has a use
C.SELL={food:15,wood:20,stone:25};const sellItems=(h,t,reopen)=>civicOn(t,'market')?MATS.map(k=>({label:'Sell 100 '+k+' – '+C.SELL[k]+' gold',sub:'At the market; '+Math.floor(stockOf(t,k))+' in store',why:stockOf(t,k)<100?'Need 100 '+k:null,act:()=>{spendStock(t,k,100);h.gold+=C.SELL[k];sfx('coin');reopen()}})):[];
const AGES=['Hamlet','Village','Town','City'];
const ageOf=t=>t.outpost?'Outpost':AGES[Math.min(AGES.length,lv(t))-1];
const nextAge=t=>t.outpost?'Town':AGES[Math.min(AGES.length-1,lv(t))];
Object.assign(CIVIC,{woodcutter:{n:'Woodcutter',sub:'Employs 4; cuts wood from the forest around it',col:'#7a5a36'},quarry:{n:'Quarry',sub:'Employs 5; cuts stone from an outcrop beside it',col:'#9c978c'},
  granary:{n:'Granary',sub:'Employs 3; stores 500 more food',max:2,col:'#c8a85a'},firehouse:{n:'Fire station',sub:'Employs 3; puts out fires within 700 paces',col:'#b84a32'}});

// ---- stockpiles: settlements joined by road share them, as they share their crystal store
function stockOf(t,k){return t?linked(t).reduce((n,u)=>n+(u[k]||0),0):0}
function spendStock(t,k,c){for(const u of linked(t)){const d=Math.min(c,u[k]||0);u[k]=(u[k]||0)-d;c-=d;if(c<=0)break}}
function giveStock(t,k,n){if(t)t[k]=(t[k]||0)+n}
const costText=k=>Object.entries(C.RES_COST[k]||{}).map(([r,n])=>n+' '+r).join(', ');
function payerFor(h,k,x=h.x,y=h.y){return k==='outpost'?firstTown(h.town):nearestOwn(h.town,x,y)}
function resWhy(t,k){const c=C.RES_COST[k];if(!c)return null;if(!t)return'No settlement of yours to draw materials from';
  for(const r in c){const have=Math.floor(stockOf(t,r));if(have<c[r])return'Need '+(c[r]-have)+' more '+r}return null}
function payRes(t,k){const c=C.RES_COST[k];if(c&&t)for(const r in c)spendStock(t,r,c[r])}
function refundRes(t,k){const c=C.RES_COST[k];if(c&&t)for(const r in c)giveStock(t,r,c[r])}

// ---- outcrops: two stone outcrops beside each town, from their own seeded stream so the land itself is untouched
function makeQuarries(){const R=mulberry32((S.seed^0x57A9E)>>>0);S.quarries=[];
  for(const t of S.towns)for(let n=0,k=0;n<2&&k<80;k++){const a=R()*6.283,d=480+R()*420,x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;
    if(inSolid(x,y,70)||S.quarries.some(q=>Math.hypot(q.x-x,q.y-y)<300)||(S.lakes||[]).some(l=>Math.hypot(l.x-x,l.y-y)<(l.r||200)+60))continue;
    S.quarries.push({x,y,r:44,town:t.i,seed:Math.floor(R()*1e6)});n++}}
const treesNear=(x,y,r)=>{let n=0;for(const t of S.trees)if(t.fell==null&&Math.abs(t.x-x)<r&&Math.abs(t.y-y)<r&&Math.hypot(t.x-x,t.y-y)<r)n++;return n};
const outcropNear=(x,y)=>(S.quarries||[]).find(q=>Math.hypot(q.x-x,q.y-y)<C.OUTCROP_R);

// ---- settlers and work
const settleOf=b=>{if(b.settlementId==null){const t=nearestOwn(b.town,b.x,b.y);if(t)b.settlementId=t.id}const t=S.towns[b.settlementId];return t&&t.alive?t:null};
// a building nobody has staffed yet (built by older code paths or tests) counts as working until the next allocation
const staffed=b=>!C.JOBS[b.k]||b.staff==null||b.staff>0;
const staffK=b=>!C.JOBS[b.k]||b.staff==null?1:b.staff/C.JOBS[b.k];
const civicOn=(t,k)=>t?S.builds.filter(b=>b.k===k&&b.hp!==0&&b.settlementId===t.id&&staffed(b)).length:0;
function popCap(t){if(!t||!t.alive)return 0;let n=t.outpost?C.OUTPOST_POP:C.HALL_POP;for(const b of S.builds)if(b.k==='house'&&b.hp!==0&&b.settlementId===t.id)n+=C.HOUSE_POP*lv(b);return n}
function foodCap(t){let n=C.FOOD_CAP;for(const b of S.builds)if(b.k==='granary'&&b.hp!==0&&b.settlementId===t.id)n+=C.GRANARY_CAP*staffK(b);return n}
function workplaces(t){return S.builds.filter(b=>C.JOBS[b.k]&&b.hp!==0&&b.town===t.i&&settleOf(b)===t)}
function allocate(t){const ws=workplaces(t),pri=t.pri?[t.pri]:[],order=[...pri,...C.LABOUR_ORDER.filter(k=>!pri.includes(k))];
  ws.sort((a,b)=>order.indexOf(a.k)-order.indexOf(b.k));let pool=Math.floor(t.pop||0),jobs=0;
  for(const b of ws){const need=b.fire?0:C.JOBS[b.k];jobs+=C.JOBS[b.k];b.staff=Math.min(pool,need);pool-=b.staff}t.idle=pool;t.jobs=jobs;t.employed=Math.floor(t.pop||0)-pool}
// a settler on the way: immigrants walk in to a house, workers walk from a house to their workplace and back; every walker
// wears the ground under it, and a way walked often enough becomes a road (faster walking, drawn on the land)
function newWalker(t,k,from,to){(S.walkers=S.walkers||[]).push({id:S.nextId++,town:t.i,tid:t.id,k,x:from.x,y:from.y,tx:to.x,ty:to.y,home:{x:from.x,y:from.y},cell:-1,wait:0,back:false,nobadge:1,mode:'ground'})}
function houseOf(t){const hs=S.builds.filter(b=>b.k==='house'&&b.hp!==0&&b.settlementId===t.id);return hs.length?hs[Math.floor(rnd()*hs.length)]:{x:t.x+rr(-t.r*.4,t.r*.4),y:t.y+rr(-t.r*.4,t.r*.4)}}
function footfall(w){if(!S.land||!S.land.road)return;const c=landCell(w.x,w.y);if(c===w.cell)return;w.cell=c;const F=S.foot||(S.foot=new Uint16Array(LAND.N*LAND.N));
  if(S.land.road[c])return;if(++F[c]<C.ROAD_STEPS)return;if(inSolid(w.x,w.y,12)||S.towns.some(t=>t.alive&&Math.hypot(t.x-w.x,t.y-w.y)<t.r))return;
  S.land.road[c]=1;(S.roadNew=S.roadNew||[]).push(c);S.worn=(S.worn||0)+1}
function stepWalkers(dt){const ws=S.walkers||[];for(let i=ws.length-1;i>=0;i--){const w=ws[i],t=S.towns[w.tid];if(!t||!t.alive){ws.splice(i,1);continue}
    if(w.wait>0){w.wait-=dt;continue}const d=Math.hypot(w.tx-w.x,w.ty-w.y);
    if(d<18){if(w.k==='settler'){t.incoming=Math.max(0,(t.incoming||0)-1);if((t.pop||0)<popCap(t))t.pop=(t.pop||0)+1;ws.splice(i,1);continue}
      if(w.k==='leaver'||w.back){ws.splice(i,1);continue}w.back=true;w.wait=3;w.tx=w.home.x;w.ty=w.home.y;continue}
    const v=steerSolid(w,w.tx,w.ty,10),sp=C.WALK*(onRoad(w.x,w.y)?C.ROAD_PACE:1);w.x+=v.x*sp*dt;w.y+=v.y*sp*dt;w.fa=Math.atan2(v.y,v.x);footfall(w)}}
// fire: a building out of reach of a staffed fire station grows riskier; once it burns it loses health until put out
function covered(b){return S.builds.some(f=>f.k==='firehouse'&&f.town===b.town&&f.hp!==0&&staffed(f)&&!f.fire&&Math.hypot(f.x-b.x,f.y-b.y)<C.FIRE_R)}
const burnable=b=>b.hp!==0&&(b.k==='house'||C.JOBS[b.k]);
function stepFires(){for(const b of S.builds){if(!burnable(b))continue;const cov=covered(b),you=S.you&&S.role==='human'&&!S.you.dead&&S.you.mode==='ground'&&Math.hypot(S.you.x-b.x,S.you.y-b.y)<110&&S.you.town===b.town;
    if(b.fire){damageBuild(b,(b.max||ARMY.HP[b.k]||300)*.03);if(!S.headless&&nearPlayer(b)){S.fx.push({k:'spark',x:b.x+rr(-20,20),y:b.y+rr(-20,20),z:50,t:0,life:.7,col:'#ff8a3a'});S.fx.push({k:'dust',x:b.x,y:b.y,t:0,life:1.2})}
      if(b.hp<=0){b.fire=null;if(S.you&&b.town===S.you.town)toast('The '+(CIVIC[b.k]?CIVIC[b.k].n.toLowerCase():b.k)+' burned down.');continue}
      b.douse=(b.douse||0)+(cov?1:0)+(you?1:0);if(b.douse>=3){b.fire=null;b.douse=0;b.risk=0;if(S.you&&b.town===S.you.town)toast('The fire at the '+(CIVIC[b.k]?CIVIC[b.k].n.toLowerCase():b.k)+' is out.')}continue}
    if(cov){b.risk=0;continue}b.risk=(b.risk||0)+1;
    if(b.risk>C.FIRE_SAFE&&rnd()<C.FIRE_P){b.fire=S.t;b.douse=0;if(S.you&&S.role==='human'&&b.town===S.you.town)announce('Fire at a '+(CIVIC[b.k]?CIVIC[b.k].n.toLowerCase():b.k)+' in '+(settleOf(b)||{name:'your town'}).name+'! Stand beside it to beat it out; a staffed fire station within 700 paces keeps fires away.')}}}
function stepEconomy(dt){const tick=p=>Math.floor(S.t/p)!==Math.floor((S.t-dt)/p);
  for(const t of aliveTowns()){for(const r of MATS)if(t[r]==null)t[r]=0;if(t.pop==null)t.pop=t.outpost?C.OUTPOST_POP:C.HALL_POP}
  if(tick(1))stepQuests();
  if(tick(2))for(const t of aliveTowns())allocate(t);
  if(tick(1))stepFires();
  stepWalkers(dt);
  // settlers come while there is room and food and the walls stand; they leave when there is no food
  if(tick(C.SETTLER_EVERY))for(const t of aliveTowns()){const cap=popCap(t),room=cap-(t.pop||0)-(t.incoming||0),raided=S.t-(t.raidT??-999)<60;
    if(t.pop>cap)t.pop=cap;
    if(room>0&&stockOf(t,'food')>5&&!raided&&!wallsDown(t)){t.incoming=(t.incoming||0)+1;const a=rnd()*6.283;newWalker(t,'settler',{x:t.x+Math.cos(a)*1100,y:t.y+Math.sin(a)*1100},houseOf(t))}
    else if(stockOf(t,'food')<=0&&t.pop>1){t.pop--;const a=rnd()*6.283;newWalker(t,'leaver',houseOf(t),{x:t.x+Math.cos(a)*1100,y:t.y+Math.sin(a)*1100});if(S.you&&t.i===S.you.town&&S.role==='human'&&S.t-(t.hungerSaid??-99)>30){t.hungerSaid=S.t;toast(t.name+' has no food: settlers are leaving. Build farms and staff them.')}}
    // workers walk out to the workplaces that employ them
    const mine=(S.walkers||[]).filter(w=>w.tid===t.id&&w.k==='work').length,ws=workplaces(t).filter(b=>b.staff>0);
    if(ws.length&&mine<Math.min(10,1+Math.floor(t.pop/4))){const b=ws[Math.floor(rnd()*ws.length)];newWalker(t,'work',houseOf(t),{x:b.x+rr(-20,20),y:b.y+rr(-20,20)})}}
  // settlers eat
  if(tick(10))for(const t of aliveTowns()){const eat=(t.pop||0)/C.EAT;spendStock(t,'food',eat);giveStock(t,'wood',2);giveStock(t,'stone',1)}
  // workplaces produce by how well they are staffed; a woodcutter needs standing forest, a quarry its outcrop
  if(tick(RENT_INTERVAL)){for(const b of S.builds){const P=C.PROD[b.k];if(!P||b.hp===0||b.fire)continue;const t=settleOf(b);if(!t)continue;
      if(b.k==='woodcutter'&&(b.treesAt==null||S.t-b.treesAt>60)){b.treesAt=S.t;b.trees=treesNear(b.x,b.y,C.FOREST_R)}
      const ok=b.k==='woodcutter'?b.trees>=C.FOREST_N:b.k==='quarry'?!!outcropNear(b.x,b.y):true;if(!ok)continue;
      for(const r in P)giveStock(t,r,P[r]*staffK(b))}
    for(const t of aliveTowns())t.food=Math.min(t.food,foodCap(t))}}

// ---- placing the new workplaces, and what the bot heroes build
function workWhy(h,k){const t=nearestOwn(h.town,h.x,h.y);if(!t||dist(t,h)>C.WORK_REACH)return'Build it within '+C.WORK_REACH+' paces of a settlement of yours';
  if(k==='woodcutter'&&treesNear(h.x,h.y,C.FOREST_R)<C.FOREST_N)return'Build it at the edge of a forest';if(k==='quarry'&&!outcropNear(h.x,h.y))return'Build it beside a stone outcrop';
  if(S.builds.some(b=>b.k===k&&b.hp!==0&&Math.hypot(b.x-h.x,b.y-h.y)<300))return'Another '+CIVIC[k].n.toLowerCase()+' already works here';return null}
// houses first when the settlers have no room left, then wood and food; no new workplace while jobs outrun settlers
function botWant(t){const has=k=>civicIn(t,k),n=S.builds.filter(b=>b.settlementId===t.id&&b.hp!==0).length,room=popCap(t)-(t.pop||0);
  if(room<3&&(t.houses||0)<houseCap(t))return'house';
  if(!has('woodcutter'))return'woodcutter';
  if((t.houses||0)>2*has('farm')+1||!has('farm')&&stockOf(t,'food')<150)return'farm';
  if((t.jobs||0)-(t.pop||0)>2)return null;if(!has('quarry')&&S.quarries.some(q=>Math.hypot(q.x-t.x,q.y-t.y)<C.WORK_REACH-100))return'quarry';
  if(!has('firehouse')&&n>=4)return'firehouse';if(!has('granary')&&stockOf(t,'food')>180)return'granary';
  return['well','market','smithy','stable'].find(k=>!has(k)&&(!CIVIC[k].lvl||lv(t)>=CIVIC[k].lvl))}
// a spot for a bot's building: forest edge for a woodcutter, beside the outcrop for a quarry, else near the hall
function botSite(t,k,R=rnd){if(k==='woodcutter'){
    // the nearest forest edge: walk out from the hall through the nearest trees until one has a forest around it (kept per town)
    const ok=s=>s&&treesNear(s.x,s.y,C.FOREST_R)>=C.FOREST_N;if(ok(t.wcSite))return t.wcSite;t.wcSite=null;
    const near=S.trees.filter(tr=>tr.fell==null).map(tr=>[Math.hypot(tr.x-t.x,tr.y-t.y),tr]).filter(([d])=>d>t.r+120&&d<C.WORK_REACH-200).sort((a,b)=>a[0]-b[0]).slice(0,80);
    for(const[,tr]of near){const a=Math.atan2(t.y-tr.y,t.x-tr.x),s={x:tr.x+Math.cos(a)*90,y:tr.y+Math.sin(a)*90};if(!inSolid(s.x,s.y,30)&&ok(s))return t.wcSite=s}return null}
  if(k==='quarry'){const q=S.quarries.filter(q=>Math.hypot(q.x-t.x,q.y-t.y)<C.WORK_REACH-100).sort((a,b)=>dist(a,t)-dist(b,t))[0];if(!q)return null;const a=Math.atan2(t.y-q.y,t.x-q.x);return{x:q.x+Math.cos(a)*120,y:q.y+Math.sin(a)*120}}
  const a=R()*6.28,d=k==='house'?t.r+50+R()*160:t.r*.5+R()*120;return{x:t.x+Math.cos(a)*d,y:t.y+Math.sin(a)*d}}

// ---- hooks into the existing sim, set up once every file is loaded (called from wire.js)
function wireEconomy(){
  {const n0=newGame;newGame=function(){const s=n0.apply(this,arguments);for(const t of s.towns){Object.assign(t,C.START_RES);t.pop=C.HALL_POP}s.walkers=[];s.foot=null;s.roadNew=[];makeQuarries();return s}}
  {const f0=foundVillage;foundVillage=function(){const v=f0.apply(this,arguments);Object.assign(v,C.VILLAGE_RES);v.pop=C.OUTPOST_POP;return v}}
  {const c0=civicWhy;civicWhy=function(h,k){return k==='woodcutter'||k==='quarry'?workWhy(h,k):c0(h,k)}}
  // outcrops in the 3D view: a cluster of pale boulders each
  {const b0=g3Build;g3Build=function(){b0();if(!S.quarries||!G3.scene)return;const n=S.quarries.length*6,m=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),n);let i=0;
    for(const q of S.quarries){const R=mulberry32(q.seed);for(let k=0;k<6;k++){const a=R()*6.283,d=R()*q.r,x=q.x+Math.cos(a)*d,y=q.y+Math.sin(a)*d,r=12+R()*16;put(m,i,x,y,groundH(x,y)+r*.35,r*1.2,r*.9,r,R()*6);m.setColorAt(i++,_c.set(['#b9b4a8','#a8a398','#cfcabd'][k%3]))}}
    m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;G3.scene.add(m)}}
  {const s0=stepBuilds;stepBuilds=function(dt){s0(dt);stepEconomy(dt)}}
}

// ---- the resource bar (top left): your nearest settlement's stockpile, your purse and crystals, its settlers and work
function resRow(t){if(!t)return'';return MATS.map(k=>`<span class="rs" title="${k[0].toUpperCase()+k.slice(1)}">${RES_ICON[k]}<b>${Math.floor(stockOf(t,k))}</b></span>`).join('')}
const resEl=document.getElementById('res');let resSig='';
function resTown(h){return h?storeNear(h)||nearestOwn(h.town,h.x,h.y):null}
function paintRes(){const h=S&&S.you;if(!h||S.role!=='human'||FILM){if(resSig){resSig='';resEl.innerHTML='';resEl.hidden=true}return}
  const t=resTown(h);const short=t&&t.jobs>t.employed,sig=t?resRow(t)+`<span class="rs" title="Your gold">${RES_ICON.gold}<b>${h.gold}</b></span><span class="rs" title="Sky crystals: yours + the town store">${RES_ICON.crystals}<b>${h.crystals}${storeNear(h)?'+'+poolOf(storeNear(h)):''}</b></span><span class="rs" title="Settlers / houses' room">${RES_ICON.folk}<b>${Math.floor(t.pop||0)}/${popCap(t)}</b></span><span class="rs${short?' short':''}" title="Settlers at work / jobs">${RES_ICON.work}<b>${t.employed||0}/${t.jobs||0}</b></span><span class="rn">${t.name} · ${ageOf(t)}</span>`:'';
  if(sig!==resSig){resSig=sig;resEl.innerHTML=sig;resEl.hidden=!sig}}
// names on the land near you, in either view (proj: x, y, height -> screen): outcrops, fires, and your workplaces short of hands
function econLabels(proj){const h=S&&S.you;if(!h||S.role!=='human')return;for(const q of S.quarries||[]){if(Math.hypot(q.x-h.x,q.y-h.y)>2600)continue;const p=proj(q.x,q.y,70);if(p)lbl('Stone outcrop',p.x,p.y,11,'#d8d2c2')}
  for(const b of S.builds){if(b.hp===0||Math.hypot(b.x-h.x,b.y-h.y)>1600)continue;if(b.fire){const p=proj(b.x,b.y,140);if(p)lbl('Fire!',p.x,p.y,14,'#ff8a3a');continue}
    if(b.town===h.town&&C.JOBS[b.k]&&b.staff!=null&&b.staff<C.JOBS[b.k]&&Math.hypot(b.x-h.x,b.y-h.y)<900){const p=proj(b.x,b.y,120);if(p)lbl((CIVIC[b.k]?CIVIC[b.k].n:b.k==='tower'?'Watchtower':'Barracks')+' '+b.staff+'/'+C.JOBS[b.k]+' workers',p.x,p.y,11,b.staff?'#ffd27a':'#ff9a8a')}}}
// the Hall: settlers, work and the labour order; clicking a workplace kind puts it first for workers
function hallEconomy(h,t,reopen){const ws=workplaces(t),by={};for(const b of ws){const e=by[b.k]||(by[b.k]={n:0,staff:0,jobs:0});e.n++;e.staff+=b.staff||0;e.jobs+=C.JOBS[b.k]}
  const body=`<p class="stock">${resRow(t)}</p><p class="dim">Settlers ${Math.floor(t.pop||0)}/${popCap(t)} (houses make room; settlers come while there is food) · at work ${t.employed||0} of ${t.jobs||0} jobs${t.idle?' · '+t.idle+' without work':''} · they eat ${((t.pop||0)/C.EAT*6).toFixed(0)} food a minute · food store holds ${Math.round(foodCap(t))}.</p>`;
  const items=Object.entries(by).sort((a,b)=>C.LABOUR_ORDER.indexOf(a[0])-C.LABOUR_ORDER.indexOf(b[0])).map(([k,e])=>({label:(t.pri===k?'★ ':'')+(CIVIC[k]?CIVIC[k].n:k==='tower'?'Watchtower':'Barracks')+(e.n>1?' ×'+e.n:'')+': '+e.staff+'/'+e.jobs+' workers',sub:t.pri===k?'Gets workers first (click to clear)':'Click to give it workers first',act:()=>{t.pri=t.pri===k?null:k;allocate(t);reopen()}}));
  return{body,items}}
// a market stall, a woodpile, a granary dome and a red fire station in the 3D view (render3d.js calls this for these kinds)
function drawEconBuild(b,z,B,RF,col){if(b.k==='woodcutter'){B(b.x,b.y,z+16,50,32,40,'#8a6a44');RF(b.x,b.y,z+42,34,20,'#5a3f2a');for(let k=0;k<3;k++)B(b.x+40,b.y-14+k*14,z+6+k*2,36,10,10,'#7a5a36',1.57)}
  else if(b.k==='quarry'){B(b.x,b.y,z+10,60,20,44,'#9c978c');B(b.x+10,b.y+4,z+26,30,14,26,'#b9b4a8');B(b.x-36,b.y,z+30,4,60,4,'#6b5a44');B(b.x-36,b.y+12,z+56,4,4,30,'#6b5a44')}
  else if(b.k==='granary'){B(b.x,b.y,z+18,56,36,56,'#c8a85a');RF(b.x,b.y,z+48,40,26,'#8a6a3a');B(b.x+34,b.y,z+10,14,20,14,'#9a7a4e')}
  else if(b.k==='firehouse'){B(b.x,b.y,z+18,56,36,44,'#b84a32');RF(b.x,b.y,z+46,38,20,'#5a2a1e');B(b.x+22,b.y,z+50,10,64,10,'#8a3a28');B(b.x-34,b.y+20,z+10,16,20,16,'#4f86a8')}
  else return false;B(b.x,b.y,z+70,6,6,6,col);return true}
// roads the settlers wore in are painted onto the ground as they appear, in either view
function paintRoads(){if(!S||!ground||!S.roadNew||!S.roadNew.length)return;const g=ground.getContext('2d'),r=LAND.CS/RES*.62;g.fillStyle='rgba(176,150,104,.92)';
  for(const c of S.roadNew){g.beginPath();g.arc((c%LAND.N)*LAND.CS/RES,Math.floor(c/LAND.N)*LAND.CS/RES,r,0,7);g.fill()}S.roadNew.length=0;G3.groundDirty=true;groundV++}
