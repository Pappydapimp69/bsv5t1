'use strict';
// Colossus · src/rpg/economy.js · the town economy: food, wood and stone stockpiles, villagers trained at the Hall and
// set to work, materials on every building, quarries, and the ages of a settlement
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.
// Owner (2026-11-28): "focus on the city builder aspects, make it more like Age of Empires". The AoE loop is kept plain:
// villagers gather food, wood and stone into the settlement's stockpile; buildings cost those materials; houses make room
// for more villagers, who are trained at the Hall for food; a settlement advances through ages (Hamlet, Village, Town,
// City) with sky crystals. Rival towns run the same rules, training and assigning their villagers on their own.

const MATS=['food','wood','stone'];
const RES_ICON={food:'\u{1F33E}',wood:'\u{1FAB5}',stone:'\u{1FAA8}',gold:'\u{1FA99}',crystals:'\u{1F48E}',folk:'\u{1F465}'};
C.RES_COST={house:{wood:40},tower:{stone:40},barracks:{wood:50,stone:20},farm:{wood:40},market:{wood:60,stone:30},smithy:{wood:30,stone:40},stable:{wood:60},well:{stone:25},outpost:{wood:60,food:60}};
// materials now carry most of a building's price, so the gold part is lighter than before (house 40, farm 35, tower 60,
// barracks 60, market 90, smithy 80, stable 60, well 30 gold)
Object.assign(C.COST,{house:30,farm:25,tower:45,barracks:45,market:60,smithy:55,stable:45,well:20});
C.START_RES={food:200,wood:200,stone:100};C.VILLAGE_RES={food:60,wood:60,stone:0};
// a soldier eats as well as costs gold: food is spent on the army as on villagers (official AoE2 guide, Lesson 3:
// basic units 'only cost Food, or a combination of Food and Wood'); without it food piled up unused in bot towns
C.SOLDIER_FOOD=40;const solFoodWhy=b=>{const t=S.towns[b.settlementId],f=Math.floor(stockOf(t,'food'));return f<C.SOLDIER_FOOD?'Need '+(C.SOLDIER_FOOD-f)+' more food':null};
// a market turns a surplus into coin, so a material that stops binding late (towns at their caps) still has a use
C.SELL={food:15,wood:20,stone:25};const sellItems=(h,t,reopen)=>civicIn(t,'market')?MATS.map(k=>({label:'Sell 100 '+k+' \u2013 '+C.SELL[k]+' gold',sub:'At the market; '+Math.floor(stockOf(t,k))+' in store',why:stockOf(t,k)<100?'Need 100 '+k:null,act:()=>{spendStock(t,k,100);h.gold+=C.SELL[k];sfx('coin');reopen()}})):[];
C.VILLAGER_FOOD=50;
// bot villagers training soldiers keep a villager's worth of food back while the settlement has room for one: economy first
const botFoodSpare=t=>!t||stockOf(t,'food')>=C.SOLDIER_FOOD+(villagerRoom(t)?C.VILLAGER_FOOD:0);C.VILLAGER_TIME=10;C.HARVEST_T=5;C.CARRY={food:10,wood:10,stone:8,forage:5};C.FARM_FOOD=6;
const AGES=['Hamlet','Village','Town','City'];
const ageOf=t=>t.outpost?'Outpost':AGES[Math.min(AGES.length,lv(t))-1];
const nextAge=t=>t.outpost?'Town':AGES[Math.min(AGES.length-1,lv(t))];
const WORKS=['auto','crystals','food','wood','stone'];
const WORK_NAME={auto:'Auto',crystals:'Sky crystals',food:'Food',wood:'Wood',stone:'Stone'};

// ---- stockpiles: settlements joined by road share them, as they share their crystal store
function stockOf(t,k){return t?linked(t).reduce((n,u)=>n+(u[k]||0),0):0}
function spendStock(t,k,c){for(const u of linked(t)){const d=Math.min(c,u[k]||0);u[k]=(u[k]||0)-d;c-=d;if(c<=0)break}}
function giveStock(t,k,n){if(t)t[k]=(t[k]||0)+n}
const costText=k=>Object.entries(C.RES_COST[k]||{}).map(([r,n])=>n+' '+r).join(', ');
// the settlement whose stockpile pays for a building: the nearest of your own to the spot (settlers leave from the first town)
function payerFor(h,k,x=h.x,y=h.y){return k==='outpost'?firstTown(h.town):nearestOwn(h.town,x,y)}
function resWhy(t,k){const c=C.RES_COST[k];if(!c)return null;if(!t)return'No settlement of yours to draw materials from';
  for(const r in c){const have=Math.floor(stockOf(t,r));if(have<c[r])return'Need '+(c[r]-have)+' more '+r}return null}
function payRes(t,k){const c=C.RES_COST[k];if(c&&t)for(const r in c)spendStock(t,r,c[r])}
function refundRes(t,k){const c=C.RES_COST[k];if(c&&t)for(const r in c)giveStock(t,r,c[r])}

// ---- quarries: two stone outcrops beside each town, from their own seeded stream so the land itself is untouched
function makeQuarries(){const R=mulberry32((S.seed^0x57A9E)>>>0);S.quarries=[];
  for(const t of S.towns)for(let n=0,k=0;n<2&&k<80;k++){const a=R()*6.283,d=480+R()*420,x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;
    if(inSolid(x,y,70)||S.quarries.some(q=>Math.hypot(q.x-x,q.y-y)<300)||(S.lakes||[]).some(l=>Math.hypot(l.x-x,l.y-y)<(l.r||200)+60))continue;
    S.quarries.push({x,y,r:44,town:t.i,seed:Math.floor(R()*1e6)});n++}}

// ---- villagers: what each one works at
function workOf(h){if(h.work&&h.work!=='auto')return h.work;const home=foragerHome(h);if(!home)return'crystals';
  const folk=foragersIn(home).sort((a,b)=>a.id-b.id),i=folk.indexOf(h);
  // the first villager keeps the crystal round (sky crystals raise the settlement); the others take the scarcest material
  if(i<=0)return'crystals';const want={food:150,wood:200,stone:120};
  const order=MATS.slice().sort((a,b)=>stockOf(home,a)/want[a]-stockOf(home,b)/want[b]);return order[(i-1)%order.length]}
function harvestNode(h,home,w){const near=(xs,o)=>{let b=null,bd=1e9;for(const p of xs){const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<bd){bd=d;b=p}}return b};
  if(w==='stone'){const q=near(S.quarries||[],home);return q&&dist(q,home)<C.FORAGE_RANGE?{x:q.x+q.r+10,y:q.y,q}:null}
  if(w==='food'){const f=near(S.builds.filter(b=>b.k==='farm'&&b.hp!==0&&b.settlementId===home.id),h);if(f)return{x:f.x+26,y:f.y+10,farm:f}}
  // wood (and food from the woods when no farm stands): the nearest standing tree to the settlement, kept until it falls
  let tr=home.woodTree!=null?S.trees[home.woodTree]:null;
  if(!tr||tr.fell!=null){let bi=-1,bd=1e9;S.trees.forEach((t,i)=>{if(t.fell!=null)return;const d=Math.hypot(t.x-home.x,t.y-home.y);if(d>home.r+60&&d<bd){bd=d;bi=i}});home.woodTree=bi>=0?bi:null;tr=bi>=0?S.trees[bi]:null}
  if(!tr||dist(tr,home)>C.FORAGE_RANGE)return null;const a=Math.atan2(home.y-tr.y,home.x-tr.x);
  return{x:tr.x+Math.cos(a)*(tr.r+14),y:tr.y+Math.sin(a)*(tr.r+14),forage:w==='food'}}
// a bot villager at its node: work for a few seconds, then carry the load home
function harvestTick(h,G,dt){if(h.harvAt!==G.x+','+G.y){h.harvAt=G.x+','+G.y;h.harvT=0}h.harvT+=dt;h.face=Math.atan2(G.y-h.y,G.x-h.x);
  if(!S.headless&&Math.floor(h.harvT*1.5)!==Math.floor((h.harvT-dt)*1.5)&&nearPlayer(h))S.fx.push({k:'dust',x:G.x+rr(-10,10),y:G.y+rr(-10,10),t:0,life:.6});
  if(h.harvT<C.HARVEST_T)return false;h.harvT=0;h.harvAt=null;const res=G.res,n=G.forage?C.CARRY.forage:C.CARRY[res];h.carry={res,n};return true}
// what the villager carries is added to its settlement's stockpile when it comes home
function depositCarry(h,t){const c=h.carry;if(!c||!t)return;giveStock(t,c.res,c.n);h.carry=null;S.gathered2=(S.gathered2||0)+c.n}

// ---- training villagers at the Hall: houses make room, food pays
function villagerRoom(t){return foragersIn(t).length+(t.trainQ||0)<foragerCapacity(t)}
function trainWhy(t){if(!t||!t.alive)return'In ruins';if(!villagerRoom(t))return foragerCapacity(t)>=FORAGER_CAP?t.name+' houses as many villagers as it can':'Build a house to make room';
  const f=Math.floor(stockOf(t,'food'));return f<C.VILLAGER_FOOD?'Need '+(C.VILLAGER_FOOD-f)+' more food':null}
function queueVillager(t){if(trainWhy(t))return false;spendStock(t,'food',C.VILLAGER_FOOD);t.trainQ=(t.trainQ||0)+1;if(t.trainAt==null)t.trainAt=S.t+C.VILLAGER_TIME;return true}
const autoVillagers=i=>!(S.role==='human'&&S.you&&S.you.town===i&&!S.autoplay);
function stepEconomy(dt){const tick=p=>Math.floor(S.t/p)!==Math.floor((S.t-dt)/p);
  for(const t of aliveTowns()){for(const r of MATS)if(t[r]==null)t[r]=0;
    if(t.trainQ>0){if(t.trainAt==null)t.trainAt=S.t+C.VILLAGER_TIME;if(S.t>=t.trainAt){t.trainQ--;t.trainAt=t.trainQ>0?S.t+C.VILLAGER_TIME:null;
      if(foragersIn(t).length<foragerCapacity(t)){const v=mkHuman(t.i,false,'folk',t);v.work=t.nextWork||'auto';S.humans.push(v);if(S.you&&S.you.town===t.i&&S.role==='human')toast('A villager is ready in '+t.name+' ('+WORK_NAME[workOf(v)].toLowerCase()+').')}
      else giveStock(t,'food',C.VILLAGER_FOOD)}}
    // rival towns (and the town of a bot standing in for you) train villagers whenever there is room and food to spare
    else if(autoVillagers(t.i)&&tick(5)&&villagerRoom(t)&&stockOf(t,'food')>=C.VILLAGER_FOOD+40)queueVillager(t)}
  // the townsfolk keep a little coming in; farms grow food on their own
  if(tick(1))stepQuests();
  if(tick(10))for(const t of aliveTowns()){giveStock(t,'food',2);giveStock(t,'wood',2);giveStock(t,'stone',1)}
  if(tick(RENT_INTERVAL))for(const b of S.builds)if(b.k==='farm'&&b.hp!==0){const t=S.towns[b.settlementId];if(t&&t.alive)giveStock(t,'food',C.FARM_FOOD)}}

// ---- hooks into the existing sim, set up once every file is loaded (called from wire.js)
function wireEconomy(){
  {const n0=newGame;newGame=function(){const s=n0.apply(this,arguments);for(const t of s.towns)Object.assign(t,C.START_RES);makeQuarries();return s}}
  {const f0=foundVillage;foundVillage=function(){const v=f0.apply(this,arguments);Object.assign(v,C.VILLAGE_RES);return v}}
  // quarries in the 3D view: a cluster of pale cut boulders each
  {const b0=g3Build;g3Build=function(){b0();if(!S.quarries||!G3.scene)return;const n=S.quarries.length*6,m=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),n);let i=0;
    for(const q of S.quarries){const R=mulberry32(q.seed);for(let k=0;k<6;k++){const a=R()*6.283,d=R()*q.r,x=q.x+Math.cos(a)*d,y=q.y+Math.sin(a)*d,r=12+R()*16;put(m,i,x,y,groundH(x,y)+r*.35,r*1.2,r*.9,r,R()*6);m.setColorAt(i++,_c.set(['#b9b4a8','#a8a398','#cfcabd'][k%3]))}}
    m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;G3.scene.add(m)}}
  {const s0=stepBuilds;stepBuilds=function(dt){s0(dt);stepEconomy(dt)}}
  {const u0=unloadPack;unloadPack=function(h,t=townAt(h)){if(h.carry&&isForager(h)&&t&&t===foragerHome(h))depositCarry(h,t);return u0(h,t)}}
  // a villager set to food, wood or stone works its node unless home is raided, it is hurt, or its barracks or house needs it
  {const p0=pickGoalFolk;pickGoalFolk=function(h){const g=p0(h);if(!isForager(h))return g;const home=foragerHome(h);if(!home)return g;
    const w=workOf(h);if(w==='crystals')return g;
    if(h.carry)return{k:'shop',town:home,x:home.x,y:home.y};
    if(g&&(g.k==='maintain'||g.k==='go'||g.k==='shop'&&(h.hp<h.max*.35||packCount(h)>=packCap(h)||h.quest&&h.quest.done)))return g;
    if(g&&g.k==='monster'&&(S.events.some(e=>e.k==='raid'&&e.town===home.id&&S.t>=e.go-15)||S.monsters.some(m=>m.id===g.id&&dist(m,h)<260)))return g;
    const node=harvestNode(h,home,w);return node?{k:'harvest',res:w,...node}:g}}
}

// ---- the resource bar (top left, as in the classic real-time city builders): your nearest settlement's stockpile,
// your purse and crystals, and its villagers; hidden for the giant and on the title
function resRow(t){if(!t)return'';return MATS.map(k=>`<span class="rs" title="${k[0].toUpperCase()+k.slice(1)}">${RES_ICON[k]}<b>${Math.floor(stockOf(t,k))}</b></span>`).join('')}
const resEl=document.getElementById('res');let resSig='';
function resTown(h){return h?storeNear(h)||nearestOwn(h.town,h.x,h.y):null}
function paintRes(){const h=S&&S.you;if(!h||S.role!=='human'||FILM){if(resSig){resSig='';resEl.innerHTML='';resEl.hidden=true}return}
  const t=resTown(h);const sig=t?resRow(t)+`<span class="rs" title="Your gold">${RES_ICON.gold}<b>${h.gold}</b></span><span class="rs" title="Sky crystals: yours + the town store">${RES_ICON.crystals}<b>${h.crystals}${storeNear(h)?'+'+poolOf(storeNear(h)):''}</b></span><span class="rs" title="Villagers / room">${RES_ICON.folk}<b>${foragersIn(t).length}/${foragerCapacity(t)}</b>${t.trainQ?'<i>+'+t.trainQ+'</i>':''}</span><span class="rn">${t.name} · ${ageOf(t)}</span>`:'';
  if(sig!==resSig){resSig=sig;resEl.innerHTML=sig;resEl.hidden=!sig}}
// quarry names on the land near you, in either view (proj is the view's projector: x, y, height -> screen)
function quarryLabels(proj){const h=S&&S.you;if(!h||S.role!=='human')return;for(const q of S.quarries||[]){if(Math.hypot(q.x-h.x,q.y-h.y)>2600)continue;const p=proj(q.x,q.y,70);if(p)lbl('Stone quarry',p.x,p.y,11,'#d8d2c2')}}
