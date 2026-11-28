'use strict';
// Colossus · src/folk.js · forager, soldier and hero goals; the foragers' economy; raids, stars, caravans, waves, stepEvents; packs; giant sites
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ---- town work and gathering
function pickGoalFolk(h){
  const home=homeOf(h);if(!home)return null;
  const folk=isForager(h),local=p=>!folk||inForageRange(home,p);
  const shop={k:'shop',town:home,x:home.x,y:home.y};
  if(folk&&h.quest?.k==='build'&&!h.quest.done)h.quest=null;
  const q=h.quest;
  if(q?.done||h.hp<h.max*.35||packCount(h)>=packCap(h))return shop;

  const raid=S.events.find(e=>e.k==='raid'&&e.town===home.id&&S.t>=e.go-15);
  if(raid){const m=S.monsters.find(m=>m.raid===raid&&local(m));if(m)return{k:'monster',id:m.id}}
  const car=escortCaravan(h);
  if(car&&local(car)){
    const m=caravanThreat(car,local);
    return m?{k:'monster',id:m.id}:{k:'go',x:car.x,y:car.y};
  }

  if(folk){
    const raise=upCost('town',home);
    if(h.pack.crystals&&raise!=null&&home.crystals<raise&&home.crystals+h.pack.crystals>=raise&&barracksFull(h,home))return shop;
    const property=S.builds.find(b=>b.settlementId===home.id&&b.town===h.town&&local(b)&&(
      b.k==='house'&&!canUpgrade(h,'house',b,home.crystals)||b.k==='barracks'&&barracksWork(h,b)));
    if(property)return{k:'maintain',x:property.x,y:property.y,property};
  }
  if(h.hero&&h.town===1&&h.gold>=C.COST.outpost+20&&S.outposts[1]<3){
    for(const p of S.prints){if(S.t-p.t<4)continue;const x=p.x+C.FOOT_R*1.6,y=p.y;
      if(local({x,y})&&outpostSiteOpen(x,y))return{k:'build',what:'outpost',x,y}}
  }
  if(h.hero&&h.gold>=C.COST.house+20&&foragerCapacity(home)<FORAGER_CAP&&barracksOf(h.town,home).length){
    const a=rr(0,6.28),d=home.r+rr(60,C.HOME_REACH-20);
    const x=home.x+Math.cos(a)*d,y=home.y+Math.sin(a)*d;
    if(withinLimits(home,x,y)&&!inSolid(x,y,30))return{k:'build',what:'house',x,y};
  }
  // a hero bot grows its town too: farms when houses go hungry, then a well, market, smithy and stable as gold allows
  if(h.hero&&home&&!home.outpost){const want=botWant(home),p=want&&botSite(home,want,()=>rr(0,1));
    if(want&&p&&h.gold>=C.COST[want]+30){const x=p.x,y=p.y;if((want==='woodcutter'||want==='quarry'||withinLimits(home,x,y))&&!inSolid(x,y,30)&&!S.builds.some(b=>Math.hypot(b.x-x,b.y-y)<60))return{k:'build',what:want,x,y}}}
  if(q?.k==='troll'){
    const troll=S.monsters.find(m=>m.kind==='troll'&&local(m));if(troll)return{k:'monster',id:troll.id};
  }
  if(q?.k==='deliver'){
    const to=S.towns[q.to];if(to?.alive&&local(to))return{k:'go',x:to.x,y:to.y};h.quest=null;
  }
  if(h.hero&&q?.k==='build'&&h.gold>=C.COST[q.what]){
    const a=rr(0,6.28),d=home.r+rr(60,300);return{k:'build',what:q.what,x:home.x+Math.cos(a)*d,y:home.y+Math.sin(a)*d};
  }

  let crystal=null,crystalDistance=2600*WS;
  for(const c of S.crystals){
    if(c.tut||!local(c))continue;const d=dist(c,h);
    if(d<crystalDistance){crystalDistance=d;crystal=c}
  }
  if(crystal&&(crystal.star||q?.k==='gather'||rnd()<.75))return{k:'crystal',x:crystal.x,y:crystal.y};
  if(packCount(h)>0)return shop;
  let beast=null,beastDistance=Infinity;
  for(const m of S.monsters){
    if(!local(m))continue;const d=dist(m,h)+(m.kind==='troll'&&h.lvl<3?600:0);
    if(d<beastDistance){beastDistance=d;beast=m}
  }
  return beast?{k:'monster',id:beast.id}:crystal?{k:'crystal',x:crystal.x,y:crystal.y}:shop;
}
// ---- the foragers' economy: they bank crystals in the town store, raise the town with them, build houses with their
// gold, and lay roads to their town's outposts; settlements joined by road share one crystal store
C.ROAD_COST=40;C.FOLK_HOUSES=6;
function linked(t){const out=[t],seen=new Set([t.id]);S.links=S.links||[];
  for(let k=0;k<out.length;k++)for(const [a,b] of S.links){const o=a===out[k].id?b:b===out[k].id?a:null;if(o==null||seen.has(o))continue;const u=S.towns.find(x=>x.id===o);if(u&&u.alive&&u.i===t.i){seen.add(o);out.push(u)}}
  return out}
const poolOf=t=>linked(t).reduce((n,u)=>n+(u.crystals||0),0);
function spendPool(t,c){for(const u of linked(t)){const d=Math.min(c,u.crystals||0);u.crystals-=d;c-=d;if(c<=0)break}}
// the settlement whose store the player can draw on: one of their own whose build area they stand in
function storeNear(h){if(!h||h.mode==='climb')return null;let best=null;for(const t of aliveTowns())if(t.i===h.town&&withinLimits(t,h.x,h.y)&&(!best||dist(t,h)<dist(best,h)))best=t;return best}
function folkRaiseTown(h,t){const c=upCost('town',t);if(c==null||poolOf(t)<c)return false;spendPool(t,c);const promote=t.outpost;t.lvl=lv(t)+1;t.max+=600;t.hp+=600;t.r+=20;if(promote)t.outpost=false;else startCaravan(t);
  if(S.you&&S.role==='human'&&S.you.town===t.i)toast(t.name+'\u2019s foragers raised it to level '+t.lvl+' with the town\u2019s crystals'+(promote?': it is now a town.':'.'));return true}
function folkBuildHouse(h,t){if(!t.heroHouse||(t.houses||0)>=houseCap(t)||h.gold<C.COST.house+15||resWhy(t,'house'))return false;
  for(let k=0;k<12;k++){const a=rr(0,6.28),d=t.r+rr(50,170),x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d;
    if(!withinLimits(t,x,y)||inSolid(x,y,30)||S.builds.some(b=>Math.hypot(b.x-x,b.y-y)<50)||S.prints.some(p=>Math.hypot(p.x-x,p.y-y)<C.FOOT_R*1.2))continue;
    h.gold-=C.COST.house;payRes(t,'house');const hx=h.x,hy=h.y;h.x=x;h.y=y;finishBuild0(h,'house');h.x=hx;h.y=hy;
    if(S.you&&S.role==='human'&&S.you.town===t.i&&nearPlayer(t))toast('A forager of '+t.name+' built a house.');return true}
  return false}
function folkLayRoad(h,t){if(h.gold<C.ROAD_COST)return false;S.links=S.links||[];
  const mine=new Set(linked(t).map(u=>u.id)),to=aliveTowns().filter(u=>u.i===t.i&&!mine.has(u.id)).sort((a,b)=>dist(a,t)-dist(b,t))[0];if(!to)return false;
  h.gold-=C.ROAD_COST;S.links.push([t.id,to.id]);
  // a road on the land: walkable faster (like the old roads) and drawn on the ground
  const line=[];const n=Math.ceil(dist(t,to)/150);for(let k=0;k<=n;k++){const x=t.x+(to.x-t.x)*k/n,y=t.y+(to.y-t.y)*k/n;line.push({x,y});if(S.land&&S.land.road)S.land.road[landCell(x,y)]=1}
  line.w=.5;(S.roads=S.roads||[]).push(line);groundSeed=-1;chron('Foragers of '+t.name+' laid a road to '+to.name+'; the two now share one crystal store.');
  if(S.you&&S.role==='human'&&S.you.town===t.i)toast('Foragers laid a road from '+t.name+' to '+to.name+': they now share one crystal store.');return true}
function botFolkShop(h){const t=townAt(h);if(!t||wallsDown(t))return;
  if(isForager(h)&&foragerHome(h)===t){unloadPack(h,t);
    // what the folk do with the town's crystals and their own gold, one thing per visit
    if(!folkRaiseTown(h,t)&&!(rnd()<.35&&folkLayRoad(h,t)))if(rnd()<.4)folkBuildHouse(h,t)}
  if(!h.potions&&h.gold>=C.COST.potion){h.gold-=C.COST.potion;h.potions++}}
// the soldiers carry the town's way toward the giant: the old roles, minus gathering
function readyToWake(h){return !!h.horn&&!S.g.awake&&!S.g.dead&&allWeak()&&!nightLock()}
function footGoal(h,strike=false){let leg=-1,best=Infinity;
  S.g.feet.forEach((f,i)=>{if(f.air>0||strike&&!chained(i?'ankleR':'ankleL'))return;const d=dist(f,h);
    if(d<best){best=d;leg=i}});
  return leg<0?null:{k:'foot',i:leg,strike}}
function soldierClimbReady(h){const g=S.g;
  if(h.role==='warden')return huntOpen()&&(h.kits.wedge>0||h.lvl>=3||g.fallen>0);
  if(h.role==='keeper'&&(readyToWake(h)||wedgedJoints().length))return true;
  if(!S.sites.some(s=>!s.build&&!s.pending))return false;
  const cannon=h.kits.cannon>0&&!siteCapReached(h,'cannon');
  if(h.role==='raider')return cannon&&(!g.target?.alive||g.target.i!==h.town);
  return !!(cannon||h.kits.ladder||h.kits.platform||h.kits.brace>0&&!siteCapReached(h,'brace'))}
function pickGoalSol(h){const g=S.g,home=homeOf(h),b=h.sol.b;if(!home)return null;h.quest=null;
  if(h.hp<h.max*.35)return{k:'shop',town:home,x:home.x,y:home.y};
  if(h.role==='keeper'&&readyToWake(h)){const foot=footGoal(h);if(foot)return foot}
  {const raid=S.events.find(e=>e.k==='raid'&&e.i===h.town&&S.t>=e.go-15);if(raid){let bb=null,bd=1e9;for(const m of S.monsters)if(m.raid===raid){const d=dist(m,h);if(d<bd){bd=d;bb=m}}if(bb&&bd<4000*WS)return{k:'monster',id:bb.id}}}
  if(h.role==='keeper'&&!g.awake&&!h.horn&&h.crystals>=C.HORN_CRYSTALS)return{k:'shop',town:home,x:home.x,y:home.y};
  const breakingChains=(h.role==='keeper'||h.role==='raider')&&!g.awake&&chainsOpen()&&!allWeak();
  const canMount=!g.dead&&!nightLock();
  if(canMount&&(breakingChains||soldierClimbReady(h))){const foot=breakingChains&&footGoal(h,true)||footGoal(h);if(foot)return foot}
  const want=h.role==='warden'?'wedge':h.role==='keeper'?(braces()>=BRACES_MAX?'ladder':'brace'):'cannon';
  if(h.gold>=C.COST[want]+(h.potions?0:C.COST.potion)&&h.kits[want]<2)return{k:'shop',town:home,x:home.x,y:home.y};
  {let bb=null,bd=700;for(const m of S.monsters){const d=Math.hypot(m.x-b.x,m.y-b.y);if(d<bd){bd=d;bb=m}}if(bb)return{k:'monster',id:bb.id}}
  return{k:'go',x:b.x+rr(-45,45),y:b.y+rr(-45,45)}}
function heroKit(h){return h.role==='warden'?'wedge':!huntOpen()?'ladder':braces()<BRACES_MAX?'brace':'cannon'}
function heroTownBank(h,t){
  if(barracksFull(h,t)&&!canUpgrade(h,'town',t,t.crystals))return t;
  if((t.outpost||h.role!=='keeper'||S.g.awake)&&!canUpgrade(h,'town',t))return h;
  return null;
}
function heroBarracksGoal(h,home){
  if(h.gold<C.COST.barracks||barracksFull(h,home))return null;
  for(let attempt=0;attempt<8;attempt++){
    const a=rr(0,6.28),d=home.r+rr(60,200),x=home.x+Math.cos(a)*d,y=home.y+Math.sin(a)*d;
    if(!withinLimits(home,x,y)||inSolid(x,y,30))continue;
    const site={...h,x,y};
    if(!canBuild(site,'barracks'))return{k:'build',what:'barracks',x,y};
  }
  return null;
}
function heroSiteGoal(h){
  const kit=['ladder','platform','brace','cannon'].find(k=>h.kits[k]>0&&!siteCapReached(h,k));
  if(kit){const free=S.sites.filter(s=>!s.build&&!s.pending);if(free.length)return{kind:'kit',kit,test:(r,c)=>free.some(s=>s.r===r&&s.c===c)}}
  return null;
}
function pickGoalHero(h){
  const home=homeOf(h),g=S.g;if(!home)return null;
  const shop={k:'shop',town:home,x:home.x,y:home.y};
  if(h.hp<h.max*.5||h.quest?.done||packCount(h)>=packCap(h))return shop;
  if(wallsDown(home)&&!repairWalls(h,home).why)return shop;
  if(!g.awake&&!h.horn&&h.crystals>=C.HORN_CRYSTALS)return shop;
  const hasBarracks=barracksOf(h.town,home).length>0;
  if(!hasBarracks&&!readyToWake(h)){
    const firstBarracks=heroBarracksGoal(h,home);if(firstBarracks)return firstBarracks;
  }
  const raid=S.monsters.find(m=>m.raid?.i===h.town&&dist(m,home)<1500);
  if(raid)return{k:'monster',id:raid.id};
  if(!g.dead&&!nightLock()){
    const breaking=h.role==='keeper'&&!g.awake&&chainsOpen()&&!allWeak();
    const building=(g.awake||allWeak())&&heroSiteGoal(h);
    if(readyToWake(h)||breaking||building||(g.awake||h.role==='warden'&&huntOpen()&&h.kits.wedge>0)&&(soldierClimbReady(h)||h.quest?.k==='climb'||h.quest?.k==='tend'&&wedgedJoints().length)){
      const foot=breaking&&footGoal(h,true)||footGoal(h);if(foot)return foot;
    }
  }
  const q=h.quest;
  // rivals use the land's places too: a ready shrine, an unsoaked spring, herbs, or a camp chest left unguarded, within reach
  {const P=(S.pois||[]).filter(p=>Math.hypot(p.x-h.x,p.y-h.y)<(h.riding?2600:1600)&&inForageRange(home,p)&&(p.k==='shrine'&&S.t>=p.ready&&!(h.buff&&h.buff.until>S.t)||p.k==='spring'&&!(p.used||{})[h.id]||p.k==='herb'&&S.t>=p.ready&&h.hp<h.max*.9||p.k==='camp'&&!campBeasts(p).length&&p.alive))
    .sort((a,b)=>dist(h,a)-dist(h,b))[0];if(P)return{k:'poi',x:P.x,y:P.y,poi:P}
    // a seasoned rival goes after a guarded camp's leader (so rivals race you for the chests)
    if(h.lvl>=4&&h.hp>h.max*.75){const cp=(S.pois||[]).filter(p=>p.k==='camp'&&inForageRange(home,p)&&Math.hypot(p.x-h.x,p.y-h.y)<2200&&campBeasts(p).length).sort((a,b)=>dist(h,a)-dist(h,b))[0];if(cp){const m=campBeasts(cp).sort((a,b)=>dist(h,a)-dist(h,b))[0];if(m)return{k:'monster',id:m.id}}}}
  if(q?.k==='search'||h.hp>=h.max*.8&&h.gold<60){
    const cache=S.caches.filter(c=>c.ready<=S.t).sort((a,b)=>dist(h,a)-dist(h,b))[0];
    if(cache)return{k:'cache',x:cache.x,y:cache.y,cache};
  }
  const gear=Object.keys(GEAR).map(k=>nextGear(h,k)).some(it=>it&&lv(home)>=it.t&&h.gold>=it.g+25);
  const kit=heroKit(h);
  const raise=heroTownBank(h,home);
  if(!wallsDown(home)&&(gear||raise||!h.potions&&h.gold>=C.COST.potion||g.awake&&!h.kits[kit]&&h.gold>=C.COST[kit]+25))return shop;
  const barracks=hasBarracks&&heroBarracksGoal(h,home);if(barracks)return barracks;
  const property=S.builds.find(b=>b.town===h.town&&(b.k==='house'||b.k==='tower')&&dist(b,h)<900&&!canUpgrade(h,b.k,b));
  if(property&&(g.awake||h.role!=='keeper'))return{k:'raise',x:property.x,y:property.y,property};
  if(q?.k==='tend'&&!wedgedJoints().length)h.quest=null;
  return pickGoalFolk(h);
}
function pickGoal(h){return h.sol?pickGoalSol(h):h.hero?pickGoalHero(h):pickGoalFolk(h)}
// ---- world events: each is set off by something people did, and each gives bots and the player a reason to be elsewhere
function wealth(i){let w=0;for(const t of aliveTowns())if(t.i===i)w+=3*(lv(t)-1)+(t.houses||0);for(const b of S.builds)if(b.town===i)w+=b.k==='tower'?1:0;return w}
function nearestOwn(i,x,y){let b=null,bd=1e9;for(const t of aliveTowns())if(t.i===i){const d=Math.hypot(t.x-x,t.y-y);if(d<bd){bd=d;b=t}}return b}
function eventSay(s){if(!S.headless)announce(s)}
// a raid: beasts gather out of sight, then march on a settlement; set off by a town growing rich, or a ruin being robbed
function startRaid(town,why,from,size,trolls){town.raidT=S.t;const a=rnd()*6.28,x=from?from.x:town.x+Math.cos(a)*1900,y=from?from.y:town.y+Math.sin(a)*1900,ev={k:'raid',town:town.id,i:town.i,x,y,t:S.t,go:S.t+20};
  const n=size||(from?3:5+Math.floor(rnd()*3));for(let k=0;k<n;k++){const px=x+rr(-80,80),py=y+rr(-80,80),troll=(trolls!=null?k<trolls:(from||k===0))&&canSpawnTroll(px,py);
    S.monsters.push({id:S.nextId++,kind:troll?'troll':'wolf',x:px,y:py,hx:x,hy:y,hp:troll?110:36,max:troll?110:36,atk:troll?14:7,gold:troll?26:10,xp:troll?34:14,r:troll?22:13,cd:0,raid:ev})}
  S.events.push(ev);S.evc.raid++;ev.say=raidConcerns(town);if(ev.say)eventSay(why)}
// a raid is news to you when it falls on your own people or near you; the giant hears of every raid it set off itself
function raidConcerns(t){if(!S.you)return true;return t.i===S.you.town||Math.hypot(t.x-S.you.x,t.y-S.you.y)<2500}
// a falling star: set off by how many sky crystals people have gathered between them
function startStar(){let x,y;for(let k=0;k<30;k++){x=rr(800,C.MAP-800);y=rr(800,C.MAP-800);if(aliveTowns().every(t=>Math.hypot(t.x-x,t.y-y)>1200)&&!inSolid(x,y,260))break}
  const ev={k:'star',x,y,t:S.t,left:10};S.events.push(ev);S.evc.star++;for(let k=0;k<10;k++){const a=rnd()*6.28,d=rr(30,180);const c={id:S.nextId++,x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,star:ev};solidPush(c,40);S.crystals.push(c)}
  for(let k=0;k<2;k++)S.monsters.push({id:S.nextId++,kind:'wolf',x:x+rr(-250,250),y:y+rr(-250,250),hx:x,hy:y,hp:40,max:40,atk:7,gold:12,xp:16,r:13,cd:0});
  eventSay('A star falls from the open sky! Ten sky crystals lie in its crater.')}
// a caravan: set off when a town is raised; it carries trade to a neighbour and pays the town's people if it arrives
// owner's rule: only heroes found outposts. A hero stakes a site and a caravan of settlers walks there from the faction's
// first town; the outpost is founded when it arrives. Raising a town sends a trade caravan to a neighbour instead.
function firstTown(ti){const own=aliveTowns().filter(t=>t.i===ti);return own.find(t=>!t.outpost)||own[0]||null}
const pendingSettlers=ti=>S.events.filter(e=>e.k==='caravan'&&e.site&&e.i===ti).length;
function startCaravan(from,site=null,by=null){const to=site?{x:site.x,y:site.y,site:true}:aliveTowns().filter(t=>t.i!==from.i).sort((a,b)=>dist(a,from)-dist(b,from))[0];if(!to)return;
  const ev={k:'caravan',i:from.i,from:from.id,to:to.site?null:to.id,site,by:by&&by.id,x:from.x,y:from.y,hp:C.CARAVAN_HP,max:C.CARAVAN_HP,t:S.t};S.events.push(ev);S.evc.caravan++;
  for(let k=0;k<3;k++){const f=.35+.15*k,x=from.x+(to.x-from.x)*f+rr(-300,300),y=from.y+(to.y-from.y)*f+rr(-300,300),troll=k===0&&canSpawnTroll(x,y);
    S.monsters.push({id:S.nextId++,kind:troll?'troll':'wolf',x,y,hx:x,hy:y,hp:troll?100:36,max:troll?100:36,atk:troll?13:7,gold:troll?24:10,xp:troll?30:14,r:troll?22:13,cd:0,ambush:ev})}
  eventSay(site?(by&&by.you?'Settlers set out from '+from.name+' for your staked site. Guard them on the road!':TOWNS[from.i].name+' sends settlers out to found an outpost. Beasts lie in wait on the road.'):TOWNS[from.i].name+' sends a caravan to '+to.name+'. Beasts lie in wait on the road.')}
function escortCaravan(h){return S.events.find(e=>e.k==='caravan'&&e.escort===h)}
function caravanThreat(e,allowed){let threat=null,best=Infinity;for(const m of S.monsters){if(allowed&&!allowed(m))continue;
  const d=dist(m,e);if(d<best&&(d<m.r+40||m.ambush===e&&d<500)){threat=m;best=d}}return threat}
function canEscort(h,e){if(h.dead||h.job||h.mode!=='ground')return false;
  if(isForager(h))return h.homeId===e.from&&!h.returnHome&&inForageRange(foragerHome(h),e);
  return !!h.sol&&!playerArmy(h)&&!h.ord&&!readyToWake(h)&&S.builds.includes(h.sol.b)&&barracksTown(h.sol.b)?.id===e.from}
function caravanEscort(e){let soldier=null;for(const h of S.humans){if(!canEscort(h,e)||escortCaravan(h))continue;
  if(isForager(h))return h;if(!soldier||dist(h,e)<dist(soldier,e))soldier=h}return soldier}
// beast waves: from the first minute each town is attacked in waves that grow, with a rest of 30-60 s after each is beaten
// (build-up, fight, relax: the Left 4 Dead director's rhythm). Beating one pays those who fought it.
C.WAVE_FIRST=55;C.WAVE_REST=[30,60];C.WAVE_BOUNTY=15;
function stepWaves(){S.waves=S.waves||[0,1,2].map(i=>({n:0,next:C.WAVE_FIRST+i*12,ev:null}));
  for(let i=0;i<3;i++){const W=S.waves[i],t=S.towns.find(x=>x.i===i&&x.alive&&!x.outpost);if(!t)continue;
    if(W.ev){if(S.events.includes(W.ev))continue;W.ev=null;W.next=S.t+rr(C.WAVE_REST[0],C.WAVE_REST[1])*(S.g.awake?1.5:1);continue}
    if(tutChapter()<2&&S.t<480){W.next=Math.max(W.next,S.t+20);continue}
    if(S.t<W.next||nightLock())continue;W.n++;const size=Math.min(9,2+W.n),trolls=W.n>=3?Math.min(3,Math.floor((W.n-1)/2)):0;
    startRaid(t,'Wave '+W.n+': beasts gather beyond '+t.name+' and march in 20 s!',null,size,trolls);W.ev=S.events[S.events.length-1];W.ev.wave=W.n}}
function stepEvents(dt){stepWaves();stepPois(dt);stepCritters(dt);stepGoals();stepFestival();humanHints();
  for(let i=0;i<3;i++){const n=S.raided[i];if(n<C.RAID_AT.length&&wealth(i)>=C.RAID_AT[n]&&factionAlive(i)){S.raided[i]++;const t=nearestOwn(i,C.MAP/2,C.MAP/2);if(t)startRaid(t,'Beasts are gathering beyond '+t.name+', drawn by its wealth. They march in 20 s!')}}
  for(let k=S.events.length-1;k>=0;k--){const e=S.events[k];
    if(e.k==='raid'){const left=S.monsters.filter(m=>m.raid===e);const town=S.towns.find(t=>t.id===e.town);if(!left.length||!town||!town.alive){S.events.splice(k,1);if(town&&town.alive&&!left.length){if(e.say)eventSay('The raid on '+town.name+' is beaten off.');
        // the bounty: everyone who killed a beast of this raid is paid, and the town banks a crystal
        if(e.wave){town.crystals=(town.crystals||0)+1;for(const h of S.humans)if(e.killers&&e.killers[h.id]){h.gold+=C.WAVE_BOUNTY;if(h.you)toast('Wave '+e.wave+' beaten: '+TOWNS[town.i].name+' pays you '+C.WAVE_BOUNTY+' gold.')}}}continue}
      e.x=left[0].x;e.y=left[0].y}
    if(e.k==='star'){e.left=S.crystals.filter(c=>c.star===e).length;if(!e.left){S.events.splice(k,1);continue}}
    if(e.k==='caravan'){const to=e.site?{x:e.site.x,y:e.site.y,r:60}:S.towns.find(t=>t.id===e.to);if(!to||e.site==null&&!to.alive){S.events.splice(k,1);continue}const d=Math.hypot(to.x-e.x,to.y-e.y);
      if(!e.escort||!canEscort(e.escort,e))e.escort=caravanEscort(e);
      if(e.site&&d<to.r){S.events.splice(k,1);if(S.outposts[e.i]>=3||!factionAlive(e.i)||!outpostSiteOpen(to.x,to.y)){eventSay('The settlers from '+TOWNS[e.i].name+' find no room and turn home.');continue}
        const v=foundVillage(e.i,e.site.x,e.site.y),by=S.humans.find(o=>o.id===e.by);if(by){gainXp(by,30);if(by.you)sfx('coin')}
        (by&&by.you?announce:eventSay)('Settlers from '+TOWNS[e.i].name+' found '+v.name+'. A new villager lives there.');continue}
      if(d<to.r){S.events.splice(k,1);for(const h of S.humans)if(h.town===e.i)h.gold+=40;for(const h of S.humans)if(h.quest&&h.quest.k==='caravan'&&h.quest.car===e.t&&!h.dead&&Math.hypot(h.x-e.x,h.y-e.y)<700)questTick(h,'caravan');eventSay('The caravan from '+TOWNS[e.i].name+' reaches '+to.name+'. Every one of its people earns 40 gold.');continue}
      const near=S.monsters.find(m=>Math.hypot(m.x-e.x,m.y-e.y)<m.r+40);if(near){if(near.cd<=0){near.cd=1;e.hp-=near.atk}}else{const st=steerSolid(e,to.x,to.y,30);e.x+=st.x*55*WS*dt;e.y+=st.y*55*WS*dt;solidPush(e,30)}
      if(e.hp<=0){S.events.splice(k,1);eventSay('The caravan from '+TOWNS[e.i].name+' is lost on the road.');for(const h of S.humans)if(h.quest&&h.quest.k==='caravan'&&h.quest.car===e.t){h.quest=null;if(h.you)toast('Your caravan job is lost with the caravan.')}}}}}
// a human's pack: six things at most; one crystal from the ground per trip, everything else from beasts they defeat;
// it empties into the town's store (crystals) and market (pelts) whenever they come home
function packCount(h){return h.pack.crystals+h.pack.pelts}
function packAdd(h,what,n){let got=0;while(got<n&&packCount(h)<packCap(h)){h.pack[what]++;got++}if(got<n)sayTo(h,'Your pack is full. Go home to empty it.');if(what==='crystals'&&got)for(let i=0;i<got;i++)questTick(h,'gather');return got}
function unloadPack(h,t=townAt(h)){if(isForager(h)&&(!t||t!==foragerHome(h)))return;
  const k=h.pack;if(!k.crystals&&!k.pelts&&!k.found)return;const c=k.crystals,keep=h.you&&!S.autoplay,n=keep?0:k.pelts,pg=n*C.PELT_GOLD,bank=isForager(h)?t:h;bank.crystals+=c;h.gold+=pg;if(keep)h.hides=(h.hides||0)+k.pelts;const kept=keep?k.pelts:0;k.crystals=0;k.pelts=0;k.found=0;
  const parts=[];if(c)parts.push(c+' sky crystal'+(c>1?'s':'')+' stored');if(n)parts.push(n+' pelt'+(n>1?'s':'')+' sold for '+pg+' gold');if(kept)parts.push(kept+' pelt'+(kept>1?'s':'')+' to your hide store ('+h.hides+'; craft or sell them at the Forge)');if(parts.length)sayTo(h,'You empty your pack: '+parts.join(', ')+'.')}
// the giant's tasks: it wins by surviving until dusk and completing three of these five
function giantTasks(){const g=S.g;return[
  {name:'Freed',done:S.chains.every(c=>c.hp<=0),note:S.chains.filter(c=>c.hp<=0).length+'/4 chains'},
  {name:'Braced',done:braces()>=3,note:braces()+'/3 braces'},
  {name:'Avenged',done:S.avenged,note:'a town that angered you, below half its walls'},
  {name:'Befriended',done:[0,1,2].some(i=>factionAlive(i)&&S.grudge[i]<-60),note:'a town friendly to you'},
  {name:'Wanderer',done:S.walked>=C.WANDER,note:Math.min(C.WANDER,Math.round(S.walked/100)*100)+'/'+C.WANDER+' paces'}]}
// what can be built on a spot of the giant, and what each does
const SITE_KITS={cannon:'Cannon: fires on every town but yours',brace:'Brace: lets the giant walk',ladder:'Ladder: a line of firm holds below this spot, for everyone',platform:'Platform: a resting place that catches your people when they fall'};
function ladderDown(s,rows){const B=S.body;let n=0;for(let r=s.r-1;r>=Math.max(0,s.r-rows)&&n<rows;r--){const i=r*COLS+s.c;if(!B.reg[i])continue;if(B.g[i]===SMOOTH)B.g[i]=HOLD;if(B.h[i]!==1)B.h[i]=1;(s.build.cells=s.build.cells||[]).push(r);n++}}
const CANNONS_PER_TOWN=2,BRACES_MAX=5;
function cannonsOf(i){return S.sites.filter(q=>q.build&&q.build.k==='cannon'&&q.build.town===i).length}
function siteCapReached(h,k){if(k!=='brace'&&k!=='cannon')return false;
  const pending=S.humans.filter(o=>o.job?.kind==='site'&&o.job.k===k&&(k==='brace'||o.town===h.town)).length;
  return k==='brace'?braces()+pending>=BRACES_MAX:cannonsOf(h.town)+pending>=CANNONS_PER_TOWN}
function siteBuildWhy(h,s,k){if(nightLock())return'Night: the chained giant cannot be touched';
  if(h.job)return'Finish your current build first';if(!s||s.build||s.pending)return'That site is occupied';
  if(!h.kits[k])return'No '+k+' kits: buy them in town';
  if(siteCapReached(h,k))return k==='brace'?'The giant has '+BRACES_MAX+' braces built or underway':TOWNS[h.town].name+' has '+CANNONS_PER_TOWN+' cannons built or underway';
  return null}
function placeOnSite(h,s,k){const why=siteBuildWhy(h,s,k);if(why){sayTo(h,why);return false}
  h.kits[k]--;s.pending=h.id;startJob(h,{kind:'site',k,s});return true}
function finishSite(h,s,k){if(s.pending!==h.id||s.build)return false;
  if(h.you)(h.built=h.built||{})[k]=(h.built[k]||0)+1;s.pending=null;s.build={k,town:h.town,owner:h.id,face:h.cl?.face,hp:C.CANNON_HP,cd:k==='cannon'?1:0};sfx('build',h.you);gainXp(h,20);
  if(k==='cannon'){S.grudge[h.town]-=C.CANNON_FAVOR;regard(h,C.CANNON_FAVOR)}if(k==='brace'){S.grudge[h.town]-=C.BRACE_FAVOR;regard(h,C.BRACE_FAVOR)}
  if(k==='ladder')ladderDown(s,30);if(k==='platform')for(const dc of[-1,0,1])S.anchors.push({r:s.r,c:s.c+dc,town:h.town,platform:true});
  sayTo(h,{cannon:'Cannon mounted on the '+s.name+'. It fires on every town but yours.',brace:'Brace bolted to the '+s.name+'. The giant can move a little more.',ladder:'Ladder hung from the '+s.name+': firm holds for 300 ft below.',platform:'Platform built on the '+s.name+'. Rest here; your people are caught here when they fall.'}[k]);return true}
function openSiteMenu(h,s){const items=Object.keys(SITE_KITS).map(k=>({label:'Build a '+k+' ('+h.kits[k]+')',sub:SITE_KITS[k],why:siteBuildWhy(h,s,k),act:()=>{placeOnSite(h,s,k);closeMenu()}}));
  openMenu({title:'The '+s.name,body:'<p class="dim">An empty spot on the giant. What will you build?</p>',items:[...items,{label:'Leave it',act:closeMenu}],grid:true,back:closeMenu})}
// people of other towns can be fought anywhere outside a settlement's walls; a feud between towns grows with every blow
// what Attack hits: of every beast and rival in reach, the weakest, and of equals the nearest; a finger is coarser
// than a key, so on touch the reach is half again as long (the rules stay, the reach widens)
function attackReach(h){return h.you&&device==='touch'?90:60}
function attackTarget(h){const R=attackReach(h);let best=null,bh=1e9,bd=1e9;
  const take=(o,d)=>{if(d>=R)return;if(o.hp<bh||(o.hp===bh&&d<bd)){best=o;bh=o.hp;bd=d}};
  for(const m of S.monsters)take(m,Math.hypot(m.x-h.x,m.y-h.y)-m.r);
  if(!townAt(h))for(const o of S.humans){if(o===h||o.dead||o.town===h.town||o.mode!=='ground'||o.hp>bh)continue;
    const d2=distSq(o,h);if(d2<R*R&&!townAt(o))take(o,Math.sqrt(d2))}
  return best}
function rivalNear(h,r){if(townAt(h))return null;let best=null,bd=r*r;for(const o of S.humans){if(o===h||o.dead||o.town===h.town||o.mode!=='ground')continue;
  const d2=distSq(o,h);if(d2<bd&&!townAt(o)){bd=d2;best=o}}return best}
function strikeHuman(h,o,dm,hk){if(untouchable(o)){dodgedFx(o);return}const d=dm||h.atk;onBlow(h,o,d,hk||0);S.feud[o.town][h.town]+=d;o.hitT=S.t;hurtHuman(o,d,'person',h);S.fx.push({k:'txt',x:o.x,y:o.y,z:90,text:'-'+Math.round(Math.max(d*.4,d-(o.def||0))),t:0,life:.8,col:'#ffd0a0'});sfx('hit',h.you||o.you||nearPlayer(o));
  if(o.dead){const k=o.pack;let got=0;for(const w of['crystals','pelts'])while(k[w]>0&&packCount(h)<packCap(h)){k[w]--;h.pack[w]++;got++}const gold=Math.floor(o.gold*.25);o.gold-=gold;h.gold+=gold;gainXp(h,30);
    if(h.you||o.you||!S.headless)announce((h.you?'You':h.name)+' killed '+(o.you?'you':o.name)+(got||gold?', taking '+[got?got+' from the pack':'',gold?gold+' gold':''].filter(Boolean).join(' and '):'')+'.')}}
// The first day: goals in the world, one at a time, each passed by the real game event it asks for. A goal opens on a
// card that pauses with the view held on you; pressing on flies the camera to the goal, the next press flies it back,
// then play resumes. Each step tops up what it spends and moves on by itself after 150 s.
