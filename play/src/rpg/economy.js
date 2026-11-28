'use strict';
// Colossus · src/rpg/economy.js · the town economy: houses that settlers fill and that need food and water; workplaces that
// employ settlers (who work at them, not wander); farms that grow and harvest; carriers that take harvest to the granary,
// grain to the bazaar, and food and water to the houses; stockpiles, fires, worn roads, outcrops, ages
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.
// Owner (2026-11-28, binding; see RULES.md): a city builder in the manner of the classic Nile-valley builders, with the
// owner's numbers: a level 1 house holds 5; each house keeps food and water (30 a level, starting at 30) that drop by its
// occupants every 10 s; well and bazaar carriers carry up to 100 and refill houses they pass within range; granary
// carriers carry 80; farms grow for 60 s, harvest for 10 s, and the harvest is carried to the granary. Houses need both
// food and water to level up and, as in the original (Sierra Help Pharaoh guide: 'If housing is deprived of any resource
// ... that housing will devolve'), fall back a level when one runs out for long.

const MATS=['food','wood','stone'];
const RES_ICON={food:'\u{1F33E}',wood:'\u{1FAB5}',stone:'\u{1FAA8}',gold:'\u{1FA99}',crystals:'\u{1F48E}',folk:'\u{1F465}',work:'⚒'};
C.RES_COST={house:{wood:40},tower:{stone:40},barracks:{wood:50,stone:20},farm:{wood:40},market:{wood:60,stone:20},smithy:{wood:30,stone:40},stable:{wood:60},well:{stone:25},outpost:{wood:60,food:60},
  woodcutter:{stone:15},quarry:{wood:30},granary:{wood:50,stone:20},firehouse:{wood:40,stone:30}};
Object.assign(C.COST,{house:30,farm:25,tower:45,barracks:45,market:40,smithy:55,stable:45,well:20,woodcutter:25,quarry:25,granary:35,firehouse:35});
C.START_RES={food:200,wood:200,stone:100};C.VILLAGE_RES={food:60,wood:60,stone:0};
// workplaces, how many settlers each employs (owner: different for each), and the order the labour goes in
C.JOBS={firehouse:4,well:2,farm:6,granary:5,market:4,woodcutter:3,quarry:8,tower:2,barracks:6,smithy:5,stable:3};
C.LABOUR_ORDER=Object.keys(C.JOBS);
C.HOUSE_CAP=[5,7,9];C.HALL_POP=6;C.OUTPOST_POP=3;C.SETTLER_EVERY=4;C.FOOD_CAP=250;C.GRANARY_CAP=500;
C.HOUSE_STORE=30;C.CARRY_WATER=100;C.CARRY_FOOD=100;C.CARRY_GRAIN=80;C.SERVE_R=120;C.WELL_R=650;C.BAZAAR_R=700;C.BAZAAR_MAX=300;C.GRAIN_R=2400;
C.FARM_GROW=60;C.FARM_HARVEST=10;C.FARM_YIELD=100;C.LACK_GRACE=30;C.HUNGER_LEAVE=45;C.MOUNTAIN_H=120;C.WATER_R=260;
C.PROD={woodcutter:{wood:12},quarry:{stone:10}};C.OUTCROP_R=240;C.WORK_REACH=2400;
C.FIRE_R=700;C.FIRE_SAFE=420;C.FIRE_P=.003;C.ROAD_STEPS=6;C.WALK=55;
// soldiers eat: food is spent on the army as on the town (official AoE2 guide, Lesson 3: basic units 'only cost Food, or a
// combination of Food and Wood')
C.SOLDIER_FOOD=40;const solFoodWhy=b=>{const t=S.towns[b.settlementId],f=Math.floor(stockOf(t,'food'));return f<C.SOLDIER_FOOD?'Need '+(C.SOLDIER_FOOD-f)+' more food':null};
const botFoodSpare=t=>!t||stockOf(t,'food')>=C.SOLDIER_FOOD+60;
// the bazaar (the market building) also sells a surplus for coin
C.SELL={food:15,wood:20,stone:25};const sellItems=(h,t,reopen)=>civicOn(t,'market')?MATS.map(k=>({label:'Sell 100 '+k+' – '+C.SELL[k]+' gold',sub:'At the bazaar; '+Math.floor(stockOf(t,k))+' in store',why:stockOf(t,k)<100?'Need 100 '+k:null,act:()=>{spendStock(t,k,100);h.gold+=C.SELL[k];sfx('coin');reopen()}})):[];
const AGES=['Hamlet','Village','Town','City'];
const ageOf=t=>t.outpost?'Outpost':AGES[Math.min(AGES.length,lv(t))-1];
const nextAge=t=>t.outpost?'Town':AGES[Math.min(AGES.length-1,lv(t))];
Object.assign(CIVIC,{woodcutter:{n:'Woodcutter',sub:'Employs 3; anywhere in town',col:'#7a5a36'},quarry:{n:'Quarry',sub:'Employs 8; beside a stone outcrop',col:'#9c978c'},
  granary:{n:'Granary',sub:'Employs 5; takes in the harvest, carts 80 food at a time to bazaars',max:2,col:'#c8a85a'},firehouse:{n:'Fire station',sub:'Employs 4; puts out fires within 700 paces',col:'#b84a32'}});
Object.assign(CIVIC.market,{n:'Bazaar',sub:'Employs 4; its traders carry food from the granary to houses; rent +25%; sells surplus',lvl:0});
Object.assign(CIVIC.farm,{sub:'Employs 6; beside a river or lake; grows 60 s, harvests 10 s'});
Object.assign(CIVIC.well,{sub:'Employs 2; its carriers bring water to houses; not on high ground',max:4});
const occCap=b=>C.HOUSE_CAP[Math.min(C.HOUSE_CAP.length,lv(b))-1];
const houseMax=b=>C.HOUSE_STORE*lv(b);

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

// ---- settlers, houses and work
const settleOf=b=>{if(b.settlementId==null){const t=nearestOwn(b.town,b.x,b.y);if(t)b.settlementId=t.id}const t=S.towns[b.settlementId];return t&&t.alive?t:null};
// a building nobody has staffed yet (built by older code paths or tests) counts as working until the next allocation
const staffed=b=>!C.JOBS[b.k]||b.staff==null||b.staff>0;
const staffK=b=>!C.JOBS[b.k]||b.staff==null?1:b.staff/C.JOBS[b.k];
const civicOn=(t,k)=>t?S.builds.filter(b=>b.k===k&&b.hp!==0&&b.settlementId===t.id&&staffed(b)).length:0;
const housesOf=t=>S.builds.filter(b=>b.k==='house'&&b.hp!==0&&b.settlementId===t.id);
function houseInit(b){if(b.occ==null){b.occ=0;b.food=C.HOUSE_STORE;b.water=C.HOUSE_STORE;b.inc=0;b.lack=0;b.hungry=0}}
function popOf(t){let n=t.hall??(t.outpost?C.OUTPOST_POP:C.HALL_POP);for(const b of housesOf(t)){houseInit(b);n+=b.occ}return n}
function popCap(t){if(!t||!t.alive)return 0;let n=t.hall??(t.outpost?C.OUTPOST_POP:C.HALL_POP);for(const b of housesOf(t))n+=occCap(b);return n}
function foodCap(t){let n=C.FOOD_CAP;for(const b of S.builds)if(b.k==='granary'&&b.hp!==0&&b.settlementId===t.id)n+=C.GRANARY_CAP*staffK(b);return n}
function workplaces(t){return S.builds.filter(b=>C.JOBS[b.k]&&b.hp!==0&&b.town===t.i&&settleOf(b)===t)}
function allocate(t){t.pop=popOf(t);const ws=workplaces(t),pri=t.pri?[t.pri]:[],order=[...pri,...C.LABOUR_ORDER.filter(k=>!pri.includes(k))];
  ws.sort((a,b)=>order.indexOf(a.k)-order.indexOf(b.k));let pool=Math.floor(t.pop),jobs=0;
  for(const b of ws){const need=b.fire?0:C.JOBS[b.k];jobs+=C.JOBS[b.k];b.staff=Math.min(pool,need);pool-=b.staff}t.idle=pool;t.jobs=jobs;t.employed=Math.floor(t.pop)-pool}
// placement: farms by water (rivers, lakes, the giant's footprint lakes), wells off high ground
function nearWater(x,y,R=C.WATER_R){return(S.rivers||[]).some(l=>l.some(p=>Math.hypot(p.x-x,p.y-y)<R))||(S.lakes||[]).some(l=>Math.hypot(l.x-x,l.y-y)<(l.r||150)+R)||S.prints.some(p=>S.t-p.t>4&&Math.hypot(p.x-x,p.y-y)<C.FOOT_R*1.2+R)}
const onMountain=(x,y)=>groundH(x,y)>C.MOUNTAIN_H||!!inSolid(x,y,40);

// ---- walkers: immigrants and leavers, and carriers with a load. Workers do not walk about: they stay at their workplace.
// Every walker wears the ground under it; a way walked often enough becomes a road (faster walking, drawn on the land)
function newWalker(t,k,from,to,extra){const w={id:S.nextId++,town:t.i,tid:t.id,k,x:from.x,y:from.y,tx:to.x,ty:to.y,home:{x:from.x,y:from.y},cell:-1,wait:0,back:false,nobadge:1,mode:'ground',load:0,...extra};(S.walkers=S.walkers||[]).push(w);return w}
function footfall(w){if(!S.land||!S.land.road)return;const c=landCell(w.x,w.y);if(c===w.cell)return;w.cell=c;const F=S.foot||(S.foot=new Uint16Array(LAND.N*LAND.N));
  if(S.land.road[c])return;if(++F[c]<C.ROAD_STEPS)return;if(inSolid(w.x,w.y,12)||S.towns.some(t=>t.alive&&Math.hypot(t.x-w.x,t.y-w.y)<t.r))return;
  S.land.road[c]=1;(S.roadNew=S.roadNew||[]).push(c);S.worn=(S.worn||0)+1}
// a carrier of water or food tops up every house of its town it passes within range, then makes for the next in need
function serve(w,res){for(const b of S.builds){if(w.load<=0)break;if(b.k!=='house'||b.hp===0||b.town!==w.town)continue;houseInit(b);const room=houseMax(b)-b[res];if(room<=.5)continue;
    if(Math.hypot(b.x-w.x,b.y-w.y)>C.SERVE_R)continue;const g=Math.min(room,w.load);b[res]+=g;w.load-=g;w.served=(w.served||0)+g}}
function nextNeedy(w,res,R){const src=w.src;let best=null,bd=1e9;for(const b of S.builds){if(b.k!=='house'||b.hp===0||b.town!==w.town||(w.seen||[]).includes(b))continue;houseInit(b);
    if(b[res]>houseMax(b)*.7||Math.hypot(b.x-src.x,b.y-src.y)>R)continue;const d=Math.hypot(b.x-w.x,b.y-w.y);if(d<bd){bd=d;best=b}}return best}
function walkerArrive(w,t){const res=w.k==='water'?'water':'food';
  if(w.k==='settler'){const b=w.house;if(b&&b.hp!==0&&S.builds.includes(b)){b.inc=Math.max(0,b.inc-1);if(b.occ<occCap(b))b.occ++}return true}
  if(w.k==='leaver')return true;
  if(w.back){if(w.src)w.src.out=null;return true}
  if(w.k==='harvest'){giveStock(t,'food',w.load);t.food=Math.min(t.food,foodCap(t));w.load=0;return goBack(w,true)}
  if(w.k==='grain'){const z=w.to;if(z&&S.builds.includes(z)){z.store=(z.store||0)+w.load;w.load=0}return goBack(w)}
  // water and food: on to the next house that needs it, or home when the load is spent
  if(w.load>0){const nb=nextNeedy(w,res,w.k==='water'?C.WELL_R:C.BAZAAR_R);if(nb){(w.seen=w.seen||[]).push(nb);w.tx=nb.x;w.ty=nb.y;return false}}
  if(w.k==='food'&&w.src&&w.load>0){w.src.store=(w.src.store||0)+w.load;w.load=0}return goBack(w)}
function goBack(w,gone){if(gone){if(w.src)w.src.out=null;return true}w.back=true;w.tx=w.home.x;w.ty=w.home.y;return false}
function stepWalkers(dt){const ws=S.walkers||[];for(let i=ws.length-1;i>=0;i--){const w=ws[i],t=S.towns[w.tid];if(!t||!t.alive||w.src&&!S.builds.includes(w.src)&&w.k!=='harvest'){ws.splice(i,1);continue}
    if(w.wait>0){w.wait-=dt;continue}if(w.k==='water'||w.k==='food')serve(w,w.k==='water'?'water':'food');
    if(Math.hypot(w.tx-w.x,w.ty-w.y)<24){if(walkerArrive(w,t))ws.splice(i,1);continue}
    const v=steerSolid(w,w.tx,w.ty,10),sp=C.WALK*(onRoad(w.x,w.y)?C.ROAD_PACE:1);w.x+=v.x*sp*dt;w.y+=v.y*sp*dt;w.fa=Math.atan2(v.y,v.x);footfall(w)}}
// each staffed well, bazaar and granary keeps one carrier out at a time, more often the better it is staffed
function dispatch(){for(const b of S.builds){if(b.hp===0||b.fire||b.out||!(b.staff>0)||S.t<(b.next||0))continue;const t=settleOf(b);if(!t)continue;
    const gap=8/Math.max(.25,staffK(b));
    if(b.k==='well'||b.k==='market'){const res=b.k==='well'?'water':'food',load=b.k==='well'?C.CARRY_WATER:Math.min(C.CARRY_FOOD,b.store||0);if(load<5)continue;
      const probe={x:b.x,y:b.y,town:b.town,src:b},first=nextNeedy(probe,res,b.k==='well'?C.WELL_R:C.BAZAAR_R);if(!first){b.next=S.t+3;continue}
      if(b.k==='market')b.store-=load;b.out=newWalker(t,res==='water'?'water':'food',b,first,{src:b,load,seen:[first]});b.next=S.t+gap}
    else if(b.k==='granary'){const z=S.builds.filter(m=>m.k==='market'&&m.hp!==0&&m.town===b.town&&(m.store||0)<C.BAZAAR_MAX-40&&Math.hypot(m.x-b.x,m.y-b.y)<C.GRAIN_R).sort((a,c)=>(a.store||0)-(c.store||0))[0];
      const load=Math.min(C.CARRY_GRAIN,Math.floor(stockOf(t,'food')));if(!z||load<10){b.next=S.t+3;continue}spendStock(t,'food',load);b.out=newWalker(t,'grain',b,z,{src:b,load,to:z});b.next=S.t+gap}}}
// farms: 60 s of growing, 10 s of harvest, only while someone works them; the yield follows the crew; a carrier takes it to the granary
function stepFarms(dt){for(const b of S.builds){if(b.k!=='farm'||b.hp===0||b.fire||!staffed(b))continue;
    if(b.harvT!=null){b.harvT+=dt;if(b.harvT>=C.FARM_HARVEST){const t=settleOf(b);b.harvT=null;b.grow=0;if(t){const gr=S.builds.filter(g=>g.k==='granary'&&g.hp!==0&&g.town===b.town).sort((a,c)=>dist(a,b)-dist(c,b))[0]||t;
          newWalker(t,'harvest',b,gr,{load:Math.round(C.FARM_YIELD*staffK(b))});b.harvests=(b.harvests||0)+1}}}
    else{b.grow=(b.grow||0)+dt;if(b.grow>=C.FARM_GROW){b.grow=C.FARM_GROW;b.harvT=0}}}}
// houses: every 10 s their food and water fall by their occupants; without food settlers leave; without either for long, a house falls a level
function stepHouses(){for(const b of S.builds){if(b.k!=='house'||b.hp===0)continue;houseInit(b);const t=settleOf(b);
    b.food=Math.max(0,b.food-b.occ);b.water=Math.max(0,b.water-b.occ);
    if(b.occ&&(b.food<=0||b.water<=0))b.lack+=10;else b.lack=0;
    if(b.lack>=C.LACK_GRACE&&lv(b)>1){b.lvl=lv(b)-1;b.lack=0;if(S.you&&S.role==='human'&&b.town===S.you.town)toast('A house in '+(t?t.name:'your town')+' fell back to level '+lv(b)+': it ran out of '+(b.water<=0?'water':'food')+'.')}
    if(b.occ&&b.food<=0){b.hungry+=10;if(b.hungry>=C.HUNGER_LEAVE){b.hungry=0;b.occ--;if(t){const a=rnd()*6.283;newWalker(t,'leaver',b,{x:t.x+Math.cos(a)*1100,y:t.y+Math.sin(a)*1100})}}}else b.hungry=0;
    while(b.occ>occCap(b)){b.occ--;if(t){const a=rnd()*6.283;newWalker(t,'leaver',b,{x:t.x+Math.cos(a)*1100,y:t.y+Math.sin(a)*1100})}}}}
function stepEconomy(dt){const tick=p=>Math.floor(S.t/p)!==Math.floor((S.t-dt)/p);
  for(const t of aliveTowns()){for(const r of MATS)if(t[r]==null)t[r]=0;if(t.hall==null)t.hall=t.outpost?C.OUTPOST_POP:C.HALL_POP}
  if(tick(1))stepQuests();
  if(tick(2))for(const t of aliveTowns())allocate(t);
  if(tick(1)){stepFires();dispatch()}
  if(tick(10))stepHouses();
  stepFarms(dt);stepWalkers(dt);
  // settlers walk in to a house with room while the walls stand and no raid is on
  if(tick(C.SETTLER_EVERY))for(const t of aliveTowns()){const raided=S.t-(t.raidT??-999)<60;if(raided||wallsDown(t))continue;
    const hs=housesOf(t).filter(b=>{houseInit(b);return b.occ+b.inc<occCap(b)});if(!hs.length)continue;const b=hs[Math.floor(rnd()*hs.length)],a=rnd()*6.283;
    b.inc++;newWalker(t,'settler',{x:t.x+Math.cos(a)*1100,y:t.y+Math.sin(a)*1100},b,{house:b})}
  if(tick(10))for(const t of aliveTowns()){giveStock(t,'wood',2);giveStock(t,'stone',1)}
  // woodcutters and quarries work by how well they are staffed (nothing at all without workers)
  if(tick(RENT_INTERVAL)){for(const b of S.builds){const P=C.PROD[b.k];if(!P||b.hp===0||b.fire)continue;const t=settleOf(b);if(!t)continue;if(b.k==='quarry'&&!outcropNear(b.x,b.y))continue;
      for(const r in P)giveStock(t,r,P[r]*staffK(b))}
    for(const t of aliveTowns())t.food=Math.min(t.food,foodCap(t))}}

// ---- placing buildings, and what the bot heroes build
function placeWhy(h,k){if(k==='quarry'){const t=nearestOwn(h.town,h.x,h.y);if(!t||dist(t,h)>C.WORK_REACH)return'Build it within '+C.WORK_REACH+' paces of a settlement of yours';
    if(!outcropNear(h.x,h.y))return'Build it beside a stone outcrop';if(S.builds.some(b=>b.k===k&&b.hp!==0&&Math.hypot(b.x-h.x,b.y-h.y)<300))return'Another quarry already works here';return null}
  if(k==='farm'&&!nearWater(h.x,h.y))return'Build it beside a river or lake';
  if(k==='well'&&onMountain(h.x,h.y))return'Not on high ground: wells go on the flat';return undefined}
// houses first when the settlers have no room left; then the food and water chain; then wood, stone and fire
function botWant(t){const has=k=>civicIn(t,k),n=S.builds.filter(b=>b.settlementId===t.id&&b.hp!==0).length,room=popCap(t)-popOf(t),hs=housesOf(t);
  if(!hs.length)return'house';if(!has('woodcutter'))return'woodcutter';if(!has('farm')&&botSite(t,'farm',()=>.5))return'farm';
  if(!has('granary'))return'granary';if(!has('market'))return'market';if(!has('well'))return'well';
  if(room<3&&(t.houses||0)<houseCap(t))return'house';if(!has('firehouse')&&n>=5)return'firehouse';
  if(hs.filter(b=>b.water<=0).length>2&&has('well')<4)return'well';
  if((t.jobs||0)-(t.pop||0)>4)return null;
  if(!has('quarry')&&S.quarries.some(q=>Math.hypot(q.x-t.x,q.y-t.y)<C.WORK_REACH-100))return'quarry';if(hs.filter(b=>b.food<=0).length>1&&has('farm')<Math.floor(hs.length/3)+1&&botSite(t,'farm',()=>.5))return'farm';
  return['smithy','stable'].find(k=>!has(k)&&(!CIVIC[k].lvl||lv(t)>=CIVIC[k].lvl))}
// a spot the placement rule accepts (GPTBS fc6a998c): by water for a farm, flat for a well, beside the outcrop for a quarry
function botSite(t,k,R=rnd){if(k==='quarry'){const q=S.quarries.filter(q=>Math.hypot(q.x-t.x,q.y-t.y)<C.WORK_REACH-100).sort((a,b)=>dist(a,t)-dist(b,t))[0];if(!q)return null;const a=Math.atan2(t.y-q.y,t.x-q.x);return{x:q.x+Math.cos(a)*120,y:q.y+Math.sin(a)*120}}
  if(k==='farm'){if(t.farmSite&&!S.builds.some(b=>Math.hypot(b.x-t.farmSite.x,b.y-t.farmSite.y)<80))return t.farmSite;const r0=t.r+60,r1=Math.max(r0+40,ringR(t)-50),ph=R()*6.283;
    for(let i=0;i<48;i++){const a=ph+i*.7,d=r0+(r1-r0)*((i*.37)%1),x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;if(nearWater(x,y)&&!inSolid(x,y,40)&&withinLimits(t,x,y)&&!S.builds.some(b=>Math.hypot(b.x-x,b.y-y)<80))return t.farmSite={x,y}}return null}
  const a=R()*6.28,d=k==='house'?t.r+50+R()*160:t.r*.5+R()*120,x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;return k==='well'&&onMountain(x,y)?{x:t.x+Math.cos(a)*t.r*.4,y:t.y+Math.sin(a)*t.r*.4}:{x,y}}

// fire: a building out of reach of a staffed fire station grows riskier; once it burns it loses health until put out
function covered(b){return S.builds.some(f=>f.k==='firehouse'&&f.town===b.town&&f.hp!==0&&staffed(f)&&!f.fire&&Math.hypot(f.x-b.x,f.y-b.y)<C.FIRE_R)}
const burnable=b=>b.hp!==0&&(b.k==='house'||C.JOBS[b.k]);
function stepFires(){for(const b of S.builds){if(!burnable(b))continue;const cov=covered(b),you=S.you&&S.role==='human'&&!S.you.dead&&S.you.mode==='ground'&&Math.hypot(S.you.x-b.x,S.you.y-b.y)<110&&S.you.town===b.town;
    if(b.fire){damageBuild(b,(b.max||ARMY.HP[b.k]||300)*.03);if(!S.headless&&nearPlayer(b)){S.fx.push({k:'spark',x:b.x+rr(-20,20),y:b.y+rr(-20,20),z:50,t:0,life:.7,col:'#ff8a3a'});S.fx.push({k:'dust',x:b.x,y:b.y,t:0,life:1.2})}
      if(b.hp<=0){b.fire=null;if(S.you&&b.town===S.you.town)toast('The '+(CIVIC[b.k]?CIVIC[b.k].n.toLowerCase():b.k)+' burned down.');continue}
      b.douse=(b.douse||0)+(cov?1:0)+(you?1:0);if(b.douse>=3){b.fire=null;b.douse=0;b.risk=0;if(S.you&&b.town===S.you.town)toast('The fire at the '+(CIVIC[b.k]?CIVIC[b.k].n.toLowerCase():b.k)+' is out.')}continue}
    if(cov){b.risk=0;continue}b.risk=(b.risk||0)+1;
    if(b.risk>C.FIRE_SAFE&&rnd()<C.FIRE_P){b.fire=S.t;b.douse=0;if(S.you&&S.role==='human'&&b.town===S.you.town)announce('Fire at a '+(CIVIC[b.k]?CIVIC[b.k].n.toLowerCase():b.k)+' in '+(settleOf(b)||{name:'your town'}).name+'! Stand beside it to beat it out; a staffed fire station within 700 paces keeps fires away.')}}}

// ---- hooks into the existing sim, set up once every file is loaded (called from wire.js)
function wireEconomy(){
  {const n0=newGame;newGame=function(){const s=n0.apply(this,arguments);for(const t of s.towns){Object.assign(t,C.START_RES);t.hall=C.HALL_POP;t.pop=C.HALL_POP}s.walkers=[];s.foot=null;s.roadNew=[];makeQuarries();return s}}
  {const f0=foundVillage;foundVillage=function(){const v=f0.apply(this,arguments);Object.assign(v,C.VILLAGE_RES);v.hall=C.OUTPOST_POP;v.pop=C.OUTPOST_POP;return v}}
  {const c0=civicWhy;civicWhy=function(h,k){const p=placeWhy(h,k);if(k==='quarry')return p;return c0(h,k)||p||null}}
  // a house levels up only with food and water in it (owner); the crystals are still paid as before
  {const u0=canUpgrade;canUpgrade=function(h,kind,o){const w=u0.apply(this,arguments);if(w||kind!=='house')return w;houseInit(o);return o.food>0&&o.water>0?null:'Needs '+(o.water>0?'':'water from a well')+(o.water>0||o.food>0?'':' and ')+(o.food>0?'':'food from a bazaar')}}
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
  const t=resTown(h);const short=t&&t.jobs>t.employed,sig=t?resRow(t)+`<span class="rs" title="Your gold">${RES_ICON.gold}<b>${h.gold}</b></span><span class="rs" title="Sky crystals: yours + the town store">${RES_ICON.crystals}<b>${h.crystals}${storeNear(h)?'+'+poolOf(storeNear(h)):''}</b></span><span class="rs" title="Settlers / room in houses">${RES_ICON.folk}<b>${Math.floor(t.pop||0)}/${popCap(t)}</b></span><span class="rs${short?' short':''}" title="Settlers at work / jobs">${RES_ICON.work}<b>${t.employed||0}/${t.jobs||0}</b></span><span class="rn">${t.name} · ${ageOf(t)}</span>`:'';
  if(sig!==resSig){resSig=sig;resEl.innerHTML=sig;resEl.hidden=!sig}}
// carriers dress for their load: water blue, food and grain ochre, the harvest gold; newcomers pale, leavers grey
const WALKER_COL={water:'#5f9fd8',food:'#d9a441',grain:'#c8a85a',harvest:'#e8c84a',settler:'#e0d2a8',leaver:'#7a6e62'};
const bName=b=>CIVIC[b.k]?CIVIC[b.k].n:b.k==='tower'?'Watchtower':b.k==='barracks'?'Barracks':b.k;
// names on the land near you, in either view (proj: x, y, height -> screen): outcrops, fires, houses in need, workplaces short of hands
function econLabels(proj){const h=S&&S.you;if(!h||S.role!=='human')return;for(const q of S.quarries||[]){if(Math.hypot(q.x-h.x,q.y-h.y)>2600)continue;const p=proj(q.x,q.y,70);if(p)lbl('Stone outcrop',p.x,p.y,11,'#d8d2c2')}
  for(const b of S.builds){if(b.hp===0||Math.hypot(b.x-h.x,b.y-h.y)>1600)continue;if(b.fire){const p=proj(b.x,b.y,140);if(p)lbl('Fire!',p.x,p.y,14,'#ff8a3a');continue}
    if(b.town!==h.town||Math.hypot(b.x-h.x,b.y-h.y)>500)continue;
    if(b.k==='house'&&b.occ!=null&&(b.food<=0||b.water<=0)){const p=proj(b.x,b.y,90);if(p)lbl('Needs '+(b.water<=0?'water':'')+(b.water<=0&&b.food<=0?' and ':'')+(b.food<=0?'food':''),p.x,p.y,11,'#9fd0ff')}
    else if(C.JOBS[b.k]&&b.staff===0){const p=proj(b.x,b.y,120);if(p)lbl(bName(b)+': no workers',p.x,p.y,11,'#ff9a8a')}}}
// the Hall: settlers, houses' food and water, work and the labour order; clicking a workplace kind puts it first for workers
function hallEconomy(h,t,reopen){const ws=workplaces(t),by={};for(const b of ws){const e=by[b.k]||(by[b.k]={n:0,staff:0,jobs:0});e.n++;e.staff+=b.staff||0;e.jobs+=C.JOBS[b.k]}
  const hs=housesOf(t);hs.forEach(houseInit);const wet=hs.filter(b=>b.water>0).length,fed=hs.filter(b=>b.food>0).length,baz=S.builds.filter(b=>b.k==='market'&&b.hp!==0&&b.settlementId===t.id).reduce((n,b)=>n+(b.store||0),0);
  const body=`<p class="stock">${resRow(t)}</p><p class="dim">Settlers ${Math.floor(t.pop||0)}/${popCap(t)} · at work ${t.employed||0} of ${t.jobs||0} jobs${t.idle?' · '+t.idle+' without work':''}</p><p class="dim">Houses ${hs.length}: ${wet} with water, ${fed} with food. Food goes farm → granary (${Math.floor(stockOf(t,'food'))} of ${Math.round(foodCap(t))}) → bazaar (${Math.floor(baz)}) → houses; water comes from wells. A house needs both to level up.</p>`;
  const items=Object.entries(by).sort((a,b)=>C.LABOUR_ORDER.indexOf(a[0])-C.LABOUR_ORDER.indexOf(b[0])).map(([k,e])=>({label:(t.pri===k?'★ ':'')+bName({k})+(e.n>1?' ×'+e.n:'')+': '+e.staff+'/'+e.jobs+' workers',sub:t.pri===k?'Gets workers first (click to clear)':'Click to give it workers first',act:()=>{t.pri=t.pri===k?null:k;allocate(t);reopen()}}));
  return{body,items}}
// ---- drawing: workers stand at their workplace and work (no wandering); farm rows grow from bare soil to golden wheat, then are cut
const lerpCol=(a,b,k)=>{const p=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)),A=p(a),B=p(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*clamp(k,0,1)).toString(16).padStart(2,'0')).join('')};
function farmStage(b){if(b.harvT!=null)return{g:1,cut:b.harvT/C.FARM_HARVEST};return{g:(b.grow||0)/C.FARM_GROW,cut:0}}
function drawFarm(b,z,B,RF,near){const{g,cut}=farmStage(b);for(let r=0;r<4;r++){const x=b.x-36+r*24,gone=cut>(r+1)/4;B(x,b.y,z+2,18,4,92,'#6b5034');
    if(gone){B(x,b.y,z+5,14,3,86,'#c8b070');continue}const h=3+30*g,col=g<.55?lerpCol('#5a8a3a','#8db04a',g/.55):lerpCol('#8db04a','#e0bc48',(g-.55)/.45);B(x,b.y,z+4+h/2,14,h,86,col);
    if(near&&g>.6)for(let k=0;k<3;k++)B(x,b.y-30+k*30,z+6+h,10,6,10,'#f0d060')}
  B(b.x+60,b.y-30,z+14,26,28,22,'#9a7a4e');RF(b.x+60,b.y-30,z+34,20,16,'#7a4e38')}
// where a workplace's workers stand, moving a little as they work; on a farm they walk the rows, faster at harvest
function workerSpots(b,t){const n=Math.min(b.staff||0,b.k==='farm'?4:3),out=[];
  for(let i=0;i<n;i++){if(b.k==='farm'){const{cut}=farmStage(b),hv=b.harvT!=null,u=hv?Math.min(.99,cut*4+i*.03)%1:(.5+.45*Math.sin(t*.25+i*1.7)),row=hv?Math.min(3,Math.floor(cut*4)):i%4;
      out.push({x:b.x-36+row*24+(i%2?8:-8),y:b.y-40+u*80,face:hv?Math.PI/2:Math.sin(t+i)})}
    else{const a=i*2.1+.6,r=52;out.push({x:b.x+Math.cos(a)*r+Math.sin(t*.7+i)*3,y:b.y+Math.sin(a)*r,face:Math.atan2(-Math.sin(a),-Math.cos(a))})}}return out}
// a market stall, a woodpile, a granary dome and a red fire station in the 3D view (render3d.js calls this for these kinds)
function drawEconBuild(b,z,B,RF,col){if(b.k==='woodcutter'){B(b.x,b.y,z+16,50,32,40,'#8a6a44');RF(b.x,b.y,z+42,34,20,'#5a3f2a');for(let k=0;k<3;k++)B(b.x+40,b.y-14+k*14,z+6+k*2,36,10,10,'#7a5a36',1.57)}
  else if(b.k==='quarry'){B(b.x,b.y,z+10,60,20,44,'#9c978c');B(b.x+10,b.y+4,z+26,30,14,26,'#b9b4a8');B(b.x-36,b.y,z+30,4,60,4,'#6b5a44');B(b.x-36,b.y+12,z+56,4,4,30,'#6b5a44')}
  else if(b.k==='granary'){B(b.x,b.y,z+18,56,36,56,'#c8a85a');RF(b.x,b.y,z+48,40,26,'#8a6a3a');B(b.x+34,b.y,z+10,14,20,14,'#9a7a4e')}
  else if(b.k==='firehouse'){B(b.x,b.y,z+18,56,36,44,'#b84a32');RF(b.x,b.y,z+46,38,20,'#5a2a1e');B(b.x+22,b.y,z+50,10,64,10,'#8a3a28');B(b.x-34,b.y+20,z+10,16,20,16,'#4f86a8')}
  else return false;B(b.x,b.y,z+70,6,6,6,col);return true}
// roads the settlers wore in are painted onto the ground as they appear, in either view
function paintRoads(){if(!S||!ground||!S.roadNew||!S.roadNew.length)return;const g=ground.getContext('2d'),r=LAND.CS/RES*.62;g.fillStyle='rgba(176,150,104,.92)';
  for(const c of S.roadNew){g.beginPath();g.arc((c%LAND.N)*LAND.CS/RES,Math.floor(c/LAND.N)*LAND.CS/RES,r,0,7);g.fill()}S.roadNew.length=0;G3.groundDirty=true;groundV++}
