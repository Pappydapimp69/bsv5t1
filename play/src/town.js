'use strict';
// Colossus · src/town.js · territory, rent, build jobs, upgrades, towers, barracks, soldiers and their orders
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

function ringR(t){return t.r+C.HOME_REACH+120*(lv(t)-1)+30*(Math.min(8,Math.floor((S.t-(t.born||0))/120))+Math.max(0,(S.day||1)-1))}
function withinLimits(t,x,y){return Math.hypot(t.x-x,t.y-y)<=ringR(t)}
const HOUSE_RECOVERY=2,HOUSE_RENT=2,RENT_INTERVAL=15;
function houseRange(b){return C.HOUSE_REACH+120*(lv(b)-1)}
function recoverNearHouse(h,dt){if(h.mode!=='ground'||h.hp>=h.max||S.t-(h.hurtAt??-Infinity)<5||!(isForager(h)||h.sol))return;
  if(S.builds.some(b=>b.k==='house'&&b.town===h.town&&b.hp!==0&&distSq(h,b)<=houseRange(b)**2))h.hp=Math.min(h.max,h.hp+HOUSE_RECOVERY*dt);if(S.builds.some(b=>b.k==='well'&&b.town===h.town&&b.hp!==0&&Math.hypot(b.x-h.x,b.y-h.y)<260))h.hp=Math.min(h.max,h.hp+4*dt)}
function territory(i){const out=[];for(const t of aliveTowns())if(t.i===i)out.push({x:t.x,y:t.y,r:ringR(t)});for(const b of S.builds)if(b.town===i&&b.k==='house')out.push({x:b.x,y:b.y,r:houseRange(b)});return out}
function inTerritory(i,x,y){return territory(i).some(c=>Math.hypot(c.x-x,c.y-y)<=c.r)}
function lakesNear(x,y,r){return S.prints.filter(p=>S.t-p.t>4&&Math.hypot(p.x-x,p.y-y)<r).length}
const BUILD_TIME={farm:6,market:10,smithy:9,stable:8,well:4,house:6,tower:8,outpost:15,cannon:6,brace:6,ladder:5,platform:6};
function startJob(h,job){h.job={...job,t:0,dur:BUILD_TIME[job.k]};h.tx=h.ty=null;if(h.cl)h.cl.path=null;sfx('build',h.you);sayTo(h,'Building a '+job.k+'... ('+h.job.dur+' s)')}
function stepJob(h,dt){const j=h.job;j.t+=dt;if(j.t<j.dur)return;h.job=null;if(j.kind==='site')finishSite(h,j.s,j.k);else finishBuild(h,j)}
function dropJob(h){const j=h.job;if(!j)return;h.job=null;if(j.kind==='site'&&j.s.pending===h.id)j.s.pending=null}
function build(h,k){const placement=k==='barracks'?barracksPlacement(h):null,why=canBuild(h,k,placement);
  if(why){sayTo(h,why);return false}const job={kind:'ground',k,x:h.x,y:h.y};
  if(placement)job.settlementId=placement.town.id;
  h.gold-=C.COST[k];payRes(payerFor(h,k),k);startJob(h,job);return true}
function finishBuild(h,j){sfx('build',h.you);if(j.k==='barracks')return finishBarracks(h,j);
  const hx=h.x,hy=h.y;h.x=j.x;h.y=j.y;const built=finishBuild0(h,j.k);h.x=hx;h.y=hy;return built}
function foundVillage(ti,x,y){S.outposts[ti]++;const n=S.towns.length,names=[['Ashmere','Ashwell','Ashby'],['Brindle Ford','Brindlemoor','Brindlewick'],['Corvel Rest','Corvelmere','Corvel Hollow']];
  const v={i:ti,id:n,name:names[ti][S.outposts[ti]-1],col:TOWNS[ti].col,shape:TOWNS[ti].shape,x,y,r:100,hp:1500,max:1500,alive:true,outpost:true,born:S.t,crystals:0};
  S.towns.push(v);fillForagerHousing(v);return v}
function outpostSiteOpen(x,y){return aliveTowns().every(t=>dist(t,{x,y})>=t.r+C.OUTPOST_GAP)}
// where a caravan of settlers makes camp: open ground a long walk out from the town, clear of stone, other settlements and the giant's feet
function villageSite(from){if(S.outposts[from.i]>=3)return null;
  for(let k=0;k<40;k++){const a=rnd()*6.283,d=rr(1500*WS,C.FORAGE_RANGE),x=from.x+Math.cos(a)*d,y=from.y+Math.sin(a)*d;
    if(x<600||y<600||x>C.MAP-600||y>C.MAP-600||inSolid(x,y,160))continue;
    if(!outpostSiteOpen(x,y))continue;if(S.g.feet.some(f=>Math.hypot(f.x-x,f.y-y)<C.FOOT_R*4))continue;return{x,y}}
  return null}
function finishBuild0(h,k){
  if(k==='outpost'){if(S.outposts[h.town]>=3||!outpostSiteOpen(h.x,h.y)){h.gold+=C.COST.outpost;refundRes(payerFor(h,'outpost'),'outpost');sayTo(h,'Outpost site is no longer available. Your gold was refunded.');return false}
    const from=firstTown(h.town);if(!from){h.gold+=C.COST.outpost;return false}startCaravan(from,{x:h.x,y:h.y},h);gainXp(h,10);return true}
  const b={k,x:h.x,y:h.y,town:h.town,owner:h.id,cd:0};S.builds.push(b);
  questTick(h,'build');
  if(CIVIC[k]){const t=nearestOwn(h.town,h.x,h.y);if(t)b.settlementId=t.id;(h.stat=h.stat||{}).civic=(h.stat.civic||0)+1;gainXp(h,12);if(h.you)toast(CIVIC[k].n+' built in '+(t?t.name:'your town')+'. Prosperity '+prosperity(t)+'.');return true}
  let housed=false;
  if(k==='house'){const t=nearestOwn(h.town,h.x,h.y);if(t){if(h.hero)t.heroHouse=true;b.settlementId=t.id;t.max+=C.HOUSE_HP;t.hp+=C.HOUSE_HP;t.r+=C.HOUSE_GROW;t.houses=(t.houses||0)+1;housed=fillForagerHousing(t,false);
    if(housed&&!h.you&&S.you?.town===t.i)toast('A villager moved back into '+t.name+'.')}}
  gainXp(h,10);sayTo(h,k==='house'?(housed?'House built. A villager moves back in.':'House built: room for one more villager (train them at the Hall).'):'Watchtower built: it shoots beasts that come near.');return true}
function stepBuilds(dt){
  for(const b of S.builds)if(b.k==='tower'){b.cd-=dt;const L=lv(b),sp=b.spec,R2=C.TOWER_R*(1+.25*(L-1))*(sp==='ballista'?1.8:1);
    if(sp==='watchfire')for(const o of S.humans)if(o.town===b.town&&!o.dead&&o.mode==='ground'&&Math.hypot(o.x-b.x,o.y-b.y)<R2)o.hp=Math.min(o.max,o.hp+6*dt);
    if(b.cd>0)continue;
    // beasts in range, and rival people inside this town's build area
    const foes=S.monsters.filter(m=>Math.hypot(m.x-b.x,m.y-b.y)<R2).map(m=>({m})).concat(S.humans.filter(o=>!o.dead&&o.mode==='ground'&&o.town!==b.town&&S.feud[b.town][o.town]>40&&Math.hypot(o.x-b.x,o.y-b.y)<R2&&inTerritory(b.town,o.x,o.y)).map(o=>({o})));
    if(!foes.length){b.cd=.5;continue}b.cd=sp==='ballista'?2.6:1.5;const dmg=(sp==='ballista'?45:sp==='volley'?14:sp==='watchfire'?10:20)*L*(sp?1:1)+(sp===undefined&&L>1?0:0);
    for(const f of foes.slice(0,sp==='volley'?3:1)){if(f.m){f.m.hp-=dmg;f.m.hitT=S.t;S.fx.push({k:'ring',x:f.m.x,y:f.m.y,r:30,t:0,life:.3,col:'#ffcf6a'})}else{hurtHuman(f.o,dmg*.6,'tower');S.fx.push({k:'ring',x:f.o.x,y:f.o.y,r:30,t:0,life:.3,col:'#ff8f80'})}}}
  if(Math.floor(S.t/RENT_INTERVAL)!==Math.floor((S.t-dt)/RENT_INTERVAL)){
    let collected=0;
    // every house of the player's town pays the player, whoever built it (the owner's rule); other towns' houses pay their builders
    for(const b of S.builds){if(b.k!=='house'||b.hp===0)continue;const owner=S.you&&b.town===S.you.town?S.you:S.humans.find(h=>h.id===b.owner);if(!owner)continue;
      const st=S.towns[b.settlementId],gold=Math.round(HOUSE_RENT*(owner===S.you&&b.owner!==S.you.id?.5:1)*lv(b)*prospK(st)*(1+.25*civicIn(st,'market')));owner.gold+=gold;if(owner===S.you)collected+=gold}
    for(const b of S.builds){if(b.k!=='farm'||b.hp===0)continue;const owner=S.you&&b.town===S.you.town?S.you:S.humans.find(h=>h.id===b.owner);if(!owner)continue;owner.gold+=3;if(owner===S.you)collected+=3}
    if(collected&&S.you){S.rentAcc=(S.rentAcc||0)+collected;if(S.t-(S.rentSaid??-99)>=60){toast('House rent: +'+S.rentAcc+' gold.');S.rentAcc=0;S.rentSaid=S.t}}
  }
  // the giant's lakes feed whoever settles beside them
  if(Math.floor(S.t/10)!==Math.floor((S.t-dt)/10)){const towns=aliveTowns();for(const i of [0,1,2]){const own=towns.filter(t=>t.i===i);
    const lakes=S.prints.filter(p=>S.t-p.t>4&&own.some(t=>dist(p,t)<t.r+500)).length;
    if(lakes)for(const h of S.humans)if(h.town===i)h.gold+=Math.floor(Math.min(3,lakes)*C.LAKE_GOLD/3)}}}
// sky crystals buy upgrades: a level is one more step of what the thing already does
const lv=o=>o.lvl||1;
function upCost(kind,o){const c=C.UP[kind];return lv(o)-1<c.length?c[lv(o)-1]:null}
function canUpgrade(h,kind,o,crystals=h.crystals+(h.you&&storeNear(h)?poolOf(storeNear(h)):0)){if(isForager(h)&&(kind!=='house'||foragerHome(h)?.id!==o.settlementId||!heroBuilt(o)||o.hp===0))return'Foragers can only raise hero-built houses in their own settlement';
  if(kind==='town'){if(o.i!==h.town)return'Not your settlement';if(!o.alive)return'In ruins'}else if(o.town!=null&&o.town!==h.town)return'Not yours';
  const c=upCost(kind,o);if(c==null)return'At its highest level';return crystals<c?'Need '+(c-crystals)+' more crystals':null}
function upgrade(h,kind,o,bank=h){const near=bank===h&&h.you?storeNear(h):null,have=bank.crystals+(near?poolOf(near):0);const why=canUpgrade(h,kind,o,have);if(why){sayTo(h,why);return false}const promote=kind==='town'&&o.outpost;
  {const c=upCost(kind,o),own=Math.min(c,bank.crystals);bank.crystals-=own;if(c>own&&near)spendPool(near,c-own)}o.lvl=lv(o)+1;sfx('build',h.you);gainXp(h,10*o.lvl);
  if(kind==='ladder'){const st=S.sites.find(q=>q.build===o);if(st)ladderDown(st,30+25*(o.lvl-1))}
  if(kind==='town'){o.max+=600;o.hp+=600;o.r+=20;if(promote)o.outpost=false;else if(!o.outpost)startCaravan(o)}
  if(kind==='house'){const t=S.towns[o.settlementId];if(t?.alive){t.max+=C.HOUSE_HP;t.hp+=C.HOUSE_HP}}
  sayTo(h,{town:promote?o.name+' is now a town.':o.name+' is raised to level '+o.lvl+': stronger walls, a wider build area, and its shop sells level '+o.lvl+' gear.',house:'House raised to level '+o.lvl+'. It now earns '+HOUSE_RENT*o.lvl+' gold every '+RENT_INTERVAL+' s.',tower:'Watchtower raised to level '+o.lvl+(o.spec?': '+o.spec:': it hits harder')+'.',cannon:'Cannon raised to level '+o.lvl+': faster and heavier shot.',brace:'Brace raised to level '+o.lvl+': the giant walks faster.',ladder:'Ladder lengthened: it reaches further down.'}[kind]);return true}
// the nearest of your own things to upgrade: a house or tower beside you, or the town you stand in
function upgradeTarget(h){const b=buildNear(h),t=townAt(h);
  if(b){const tower=b.k==='tower',why=tower&&lv(b)===1&&!b.spec?(h.crystals<C.UP.tower[0]?'Need '+(C.UP.tower[0]-h.crystals)+' more crystals':null):canUpgrade(h,b.k,b);
    return{label:(tower?'tower':'house')+(upCost(b.k,b)!=null?' ('+upCost(b.k,b)+')':''),why,act:()=>tower&&!b.spec&&h.you&&!S.autoplay?(openTowerMenu(h,b),true):upgrade(h,b.k,b)}}
  if(t&&t.i===h.town)return{label:(t.outpost?'outpost to town':'to '+nextAge(t)+' age')+' ('+(upCost('town',t)??'max')+')',why:canUpgrade(h,'town',t),act:()=>upgrade(h,'town',t)};
  return null}
// a tower's first raise chooses what it becomes
const TOWER_SPECS={sharpen:'More damage on every shot',ballista:'Long range, heavy bolts, slow',volley:'Hits up to three targets at once',watchfire:'Heals your people nearby and lights raiders early'};
function openTowerMenu(h,b){openMenu({title:'Raise this watchtower',body:`<p class="dim">${h.crystals} crystals stored. Its first raise decides what it becomes; later raises add damage.</p>`,
  items:[...Object.keys(TOWER_SPECS).map(k=>({label:k[0].toUpperCase()+k.slice(1)+' \u2013 '+C.UP.tower[0]+' crystals',sub:TOWER_SPECS[k],why:h.crystals<C.UP.tower[0]?'Need '+(C.UP.tower[0]-h.crystals)+' more crystals':null,act:()=>{if(upgrade(h,'tower',b)){if(k!=='sharpen')b.spec=k}closeMenu()}})),{label:'Leave it',act:closeMenu}],grid:true,back:closeMenu})}
// what you could raise right now, seen from twice the reach of the Upgrade action (the person: it should show
// you have the material before you walk up to it): your houses and towers within 180 (the action's reach is 90),
// your town from twice its radius, and on the giant your cannons and braces within two cells
function readyToRaise(h,b){if(b.k==='tower'&&lv(b)===1&&!b.spec)return h.crystals>=C.UP.tower[0];return!canUpgrade(h,b.k,b)}
function barracksFlags(){const h=S&&S.you;if(!h||S.role!=='human')return;for(const b of S.builds){if(b.k!=='barracks'||Math.hypot(b.x-h.x,b.y-h.y)>1800)continue;
  const k=playerBuilt(b)?(b.order&&b.order.k):b.way,ti=b.order&&b.order.ti,t=k==='town'?'Defending':k==='giant'?'Guarding the giant':k==='tend'?'Tending the giant':k==='hunt'?'Hunting the giant':k==='attack'?'Attacking '+TOWNS[ti].name:'At the barracks';
  const q=p3(b.x,b.y,150);if(q)lbl((playerBuilt(b)?'Your barracks: ':TOWNS[b.town].name+': ')+t,q.x,q.y,11,TOWNS[b.town].col)}}
function upgradeReady(){const h=S&&S.you;if(!h||h.dead||S.over||S.role!=='human')return;const pulse=.5+.5*Math.sin(S.t*5),out=[];
  if(h.mode==='ground'){for(const b of S.builds)if(b.town===h.town&&(b.k==='house'||b.k==='tower')&&Math.hypot(b.x-h.x,b.y-h.y)<180&&readyToRaise(h,b))out.push({q:p3(b.x,b.y,b.k==='tower'?190:110)});
    for(const t of aliveTowns())if(t.i===h.town&&dist(t,h)<t.r*2&&!canUpgrade(h,'town',t))out.push({q:p3(t.x,t.y,260)})}
  else if(h.cl)for(const st of S.sites){const b=st.build;if(!b||b.town!==h.town||(b.k!=='cannon'&&b.k!=='brace'))continue;if(Math.hypot(st.c+.5-h.cl.x,st.r+.5-h.cl.y)>2.6||!readyToRaise(h,b))continue;out.push({q:cellScreen(st.c+.5,st.r+.5)})}
  for(const o of out){const q=o.q;if(!q)continue;const y=q.y-14-4*pulse;ctx.save();ctx.globalAlpha=.75+.25*pulse;ctx.fillStyle='#ffd27a';ctx.strokeStyle='rgba(20,14,4,.85)';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(q.x,y-16);ctx.lineTo(q.x+13,y);ctx.lineTo(q.x+5,y);ctx.lineTo(q.x+5,y+10);ctx.lineTo(q.x-5,y+10);ctx.lineTo(q.x-5,y);ctx.lineTo(q.x-13,y);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();
    lbl('Ready to raise',q.x,y+24,12,'#ffd27a')}}
function buildNear(h){let b=null,bd=90;for(const q of S.builds){if(q.town!==h.town||(q.k!=='house'&&q.k!=='tower'))continue;const d=Math.hypot(q.x-h.x,q.y-h.y);if(d<bd){bd=d;b=q}}return b}
// ---- barracks and soldiers: each barracks trains up to three soldiers who garrison at it, and a town
// has as many barracks as its level. Soldiers are people like any other (they climb, carry kits and fight) but wear their town's
// way toward the giant; the player's own soldiers instead take orders beside the barracks: defend the town, defend the giant,
// or attack a rival town. They walk there in real time, hold 20 s, then tire and are back at the barracks at once.
C.COST.barracks=60;BUILD_TIME.barracks=8;
const ARMY={SOLDIER:30,TRAIN:6,CAP:3,HOLD:20,HP:{house:300,tower:420,barracks:480,farm:160,market:320,smithy:280,stable:260,well:140},SOL_HP:120,SOL_ATK:14,SOL_DEF:2,SOL_GOLD:30,WALL_FOLK:4,BUILD_MEND:2,LOOT:.6,LEASH:220,CLOSED:.5,REVENGE:400,REVENGE_CD:300,GUARD_REGARD:1};
const wallsDown=t=>!!t&&t.hp<t.max*ARMY.CLOSED;
const heroBuilt=b=>S.humans.some(h=>h.id===b.owner&&h.hero&&h.town===b.town);
const playerBuilt=b=>!!(S.you&&S.role==='human'&&!S.autoplay&&b.owner===S.you.id);
function barracksOf(i,settlement){return S.builds.filter(b=>b.k==='barracks'&&b.town===i&&b.hp!==0&&(!settlement||b.settlementId===settlement.id))}
function barracksFull(h,t){const pending=S.humans.filter(o=>o!==h&&o.job?.k==='barracks'&&o.job.settlementId===t.id);
  return barracksOf(h.town,t).length+pending.length>=lv(t)}
function barracksPlacement(h){if(!h.hero)return{why:'Only town heroes can build barracks'};
  const houses=new Set();for(const b of S.builds){if(b.k!=='house'||b.town!==h.town||distSq(h,b)>houseRange(b)**2)continue;
    const t=S.towns[b.settlementId];houses.add(t?.alive?t:nearestOwn(h.town,b.x,b.y))}
  const nearby=aliveTowns().filter(t=>t.i===h.town&&(withinLimits(t,h.x,h.y)||houses.has(t)));
  nearby.sort((a,b)=>dist(a,h)-dist(b,h));
  const town=nearby.find(t=>!barracksFull(h,t));if(town)return{town};
  const nearest=nearby[0];return{why:nearest?nearest.name+' allows '+lv(nearest)+' barracks: raise it for more':'Outside your settlement’s build territory'}}
function barracksNear(h){let b=null,bd=90;for(const q of S.builds){if(q.k!=='barracks'||q.town!==h.town||h.you&&!playerBuilt(q))continue;const d=Math.hypot(q.x-h.x,q.y-h.y);if(d<bd){bd=d;b=q}}return b}
function soldiersOf(b){return b.sol.map(id=>S.humans.find(h=>h.id===id)).filter(Boolean)}
function readySoldiers(b){return soldiersOf(b).filter(h=>!h.dead&&!h.ord&&!escortCaravan(h)&&h.mode==='ground'&&Math.hypot(h.x-b.x,h.y-b.y)<380)}
function trainedCount(b){return b.sol.length+b.q+(b.train>0?1:0)}
function barracksWork(h,b){
  const home=foragerHome(h);
  if(!home||b.hp===0||b.settlementId!==home.id||!heroBuilt(b))return null;
  if(!tutHoldsTraining(b)&&h.gold>=ARMY.SOLDIER&&!solFoodWhy(b)&&botFoodSpare(home)&&trainedCount(b)<ARMY.CAP)return{train:true};
  const soldiers=readySoldiers(b);
  for(const k of ['blade','armour'])for(const soldier of soldiers){
    const gear=nextGear(soldier,k);
    if(gear&&lv(home)>=gear.t&&h.gold>=gear.g)return{soldier,k};
  }
  {const kit=townWay(h.town)==='hunt'?'wedge':'brace';const s0=soldiers.find(x=>!x.kits[kit]&&(kit!=='brace'||!siteCapReached(x,'brace')));if(s0&&h.gold>=C.COST[kit]+10)return{soldier:s0,kit}}
  return null;
}
function tendBarracks(h,b){
  const work=barracksWork(h,b);
  if(!work||!S.builds.includes(b)||dist(h,b)>90)return false;
  if(work.train){h.gold-=ARMY.SOLDIER;spendStock(S.towns[b.settlementId],'food',C.SOLDIER_FOOD);b.q++}
  else if(work.kit){h.gold-=C.COST[work.kit];work.soldier.kits[work.kit]++}
  else buyGear(work.soldier,work.k,h);
  return true;
}
function finishBarracks(h,{x,y,settlementId}){if(!S.towns[settlementId]?.alive){h.gold+=C.COST.barracks;sayTo(h,'Barracks construction canceled. Your gold was refunded.');return false}
  S.builds.push({k:'barracks',x,y,settlementId,town:h.town,owner:h.id,cd:0,sol:[],q:0,train:0,hp:ARMY.HP.barracks,max:ARMY.HP.barracks});questTick(h,'build');gainXp(h,15);
  sayTo(h,'Barracks built: train up to three soldiers here, and give them orders when you stand beside it.');return true}
function trainSoldier(b){const ti=b.town,j=b.sol.length,h=mkHuman(ti,false,TOWNS[ti].roles[j%3]);
  h.sol={b};h.name=TOWNS[ti].name+' soldier';h.max=h.hp=ARMY.SOL_HP;h.atk=ARMY.SOL_ATK;h.def=ARMY.SOL_DEF;h.gold=ARMY.SOL_GOLD;h.x=b.x+rr(-30,30);h.y=b.y+rr(25,45);
  S.humans.push(h);b.sol.push(h.id);S.fx.push({k:'ring',x:b.x,y:b.y,r:60,t:0,life:.6,col:TOWNS[ti].col});if(S.you&&ti===S.you.town&&S.role==='human')toast('A soldier has finished training at your barracks.')}
// hit points: every house, tower and barracks has some, kept where it is first hurt; a fallen one takes its gifts with it
function buildMax(b){return Math.round(ARMY.HP[b.k]*(1+.25*(lv(b)-1)))}
function damageBuild(b,d,by){if(b.hp==null){b.max=buildMax(b);b.hp=b.max}if(b.hp<=0)return;if(!S.headless&&S.t-(b.sndT||0)>.6&&nearPlayer(b)){b.sndT=S.t;sfx('thud',true)}b.hp-=d;b.hitT=S.t;if(by)S.feud[b.town][by.town]+=d;
  S.fx.push({k:'ring',x:b.x,y:b.y,r:34,t:0,life:.25,col:'#ff9a80'});
  if(b.hp<=0){b.hp=0;if(S.you&&S.role==='human'&&b.town===S.you.town)announce('Your '+b.k+' has been destroyed!')}}
function destroyBuild(b,kept){if(!kept)S.builds=S.builds.filter(x=>x!==b);S.fx.push({k:'ring',x:b.x,y:b.y,r:80,t:0,life:.6,col:'#c9b48a'});
  if(b.k==='house'){const t=S.towns[b.settlementId];if(t?.alive){t.max=Math.max(600,t.max-C.HOUSE_HP*lv(b));t.hp=Math.min(t.hp,t.max);t.r=Math.max(100,t.r-C.HOUSE_GROW);t.houses=Math.max(0,(t.houses||0)-1);displaceForagers(t)}}
  if(b.k==='barracks'){for(const h of soldiersOf(b))leaveClimb(h);S.humans=S.humans.filter(h=>h.sol?.b!==b)}}
function hurtWalls(t,h,d){hurtTown(t,d);S.feud[t.i][h.town]+=d;S.fx.push({k:'ring',x:h.x,y:h.y,r:26,t:0,life:.2,col:'#ffd27a'});
  // Wall damage takes crystals from this settlement's stockpile.
  t.loot=Math.min(t.crystals,(t.loot||0)+t.crystals*d/t.max*ARMY.LOOT);
  const taken=Math.floor(t.loot);if(!taken)return;
  t.crystals-=taken;t.loot-=taken;const own=S.humans.find(o=>o.id===h.sol.b.owner)||h;own.crystals+=taken;
  S.fx.push({k:'txt',x:h.x,y:h.y,z:110,text:'+'+taken+' crystal'+(taken===1?'':'s'),t:0,life:.9,col:'#9be8ff'})}
function repairWalls(h,t){const need=Math.ceil((t.max-t.hp)/15);return{need,why:t.hp>=t.max?'The walls are whole':h.gold<need?'Need '+(need-h.gold)+' more gold':null,act:()=>{h.gold-=need;t.hp=t.max;sfx('build');openTown(t,'Hall')}}}
function repairItems(h,t){const r=repairWalls(h,t);return[{label:'Repair the walls'+(t.hp<t.max?' – '+r.need+' gold':''),sub:wallsDown(t)?'Under half: the shop and board stay closed until repaired. Town folk also mend them while they are home.':'Town folk mend them too, slowly, while they are home',why:r.why,act:r.act}]}
// ---- orders
function nearestFoot(x,y){let b=null,bd=1e9;for(const f of S.g.feet){const d=Math.hypot(f.x-x,f.y-y);if(d<bd){bd=d;b=f}}return b}
function orderTown(ti,b){return nearestOwn(ti,b.x,b.y)}
function barracksTown(b){const t=S.towns[b.settlementId];return t?.alive?t:null}
// a hunt order comes with a wedge from the town's armoury: without them a hunting soldier only walked out, waited and went home
function giveOrder(b,k,ti){const rs=readySoldiers(b);rs.forEach((h,i)=>{h.ord={k,ti,ph:'walk',t:0,i};h.goal=null;h.tx=h.ty=null;if(k==="hunt"&&h.kits.wedge<1)h.kits.wedge=1});return rs.length}
// where a soldier on this order stands, and what it is after; recomputed every step because the giant and its feet move
function orderPost(h){const o=h.ord,b=h.sol.b,sp=(o.i-1)*55;
  if(o.k==='giant'){const f=nearestFoot(b.x,b.y),a=Math.atan2(b.y-f.y,b.x-f.x);return{x:f.x+Math.cos(a)*(C.FOOT_R+70)-Math.sin(a)*sp,y:f.y+Math.sin(a)*(C.FOOT_R+70)+Math.cos(a)*sp}}
  const t=o.k==='town'?barracksTown(b):orderTown(o.ti,b);if(!t)return null;const a=Math.atan2(o.k==='town'?S.g.y-t.y:b.y-t.y,o.k==='town'?S.g.x-t.x:b.x-t.x),R=t.r+(o.k==='town'?40:42);
  if(o.k==='attack'&&o.i>0&&!o.obj)o.obj=attackObjective(h,t);
  const ob=o.obj&&S.builds.includes(o.obj)?o.obj:null;if(ob)return{x:ob.x-Math.cos(a)*40,y:ob.y-Math.sin(a)*40,ob,t};
  return{x:t.x+Math.cos(a)*R-Math.sin(a)*sp,y:t.y+Math.sin(a)*R+Math.cos(a)*sp,t}}
function attackObjective(h,t){const o=h.ord,L=S.builds.filter(b=>b.town===t.i&&Math.hypot(b.x-t.x,b.y-t.y)<900&&b.hp!==0);const rank={barracks:0,tower:1,house:2,market:3,smithy:3,stable:3,farm:4,well:4};L.sort((a,b)=>rank[a.k]-rank[b.k]||Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y));return L.length?L[(o.i-1)%L.length]:null}
function hostile(h,o){return o.town!==h.town&&!o.dead&&o.mode==='ground'&&!townAt(o)&&(S.feud[h.town][o.town]>20||o.sol&&o.goal&&o.goal.k==='foot')}
function swing(h,fn){if(h.cd>0)return false;h.cd=.5;h.swing=.2;fn();sfx('hit',nearPlayer(h));return true}
function tire(h){const b=h.sol.b;h.ord=null;h.goal=null;h.tx=h.ty=null;h.x=b.x+rr(-30,30);h.y=b.y+rr(25,45);h.hp=Math.min(h.max,h.hp+h.max*.4);S.fx.push({k:'ring',x:h.x,y:h.y,r:30,t:0,life:.4,col:'#cfd3d8'})}
function playerArmy(h){return !!h.sol&&playerBuilt(h.sol.b)}
function soldierMove(h,dt){const b=h.sol.b,o=h.ord,mv={x:0,y:0};if(!S.builds.includes(b))return mv;
  const go=(x,y,r)=>{const d=Math.hypot(x-h.x,y-h.y);if(d>r){const st=steerSolid(h,x,y,14);mv.x=st.x;mv.y=st.y}return d};
  // fight what is near the post: beasts and hostile people within the leash
  const fight=(px,py)=>{const post={x:px,y:py};let tg=nearMonster(post,ARMY.LEASH),bd=tg?dist(tg,post)-tg.r:ARMY.LEASH;
    if(bd>0){let closest=bd*bd;for(const x of S.humans){const d2=distSq(x,post);if(d2<closest&&hostile(h,x)){closest=d2;tg=x}}}
    if(!tg)return false;const at=attackTarget(h);if(at){humanAct(h,'A');return true}go(tg.x,tg.y,40);return true};
  if(!o){const a=(h.id%7)*.9,px=b.x+Math.cos(a)*40,py=b.y+Math.sin(a)*40;if(!fight(b.x,b.y))go(px,py,16);return mv}
  if(S.g.dead&&o.k==='giant'){tire(h);return mv}
  const P=orderPost(h);if(!P){tire(h);return mv}
  if(o.ph==='walk'){if(go(P.x,P.y,30)<=45){o.ph='hold';o.t=0;if(o.k==='giant'&&playerArmy(h)&&!S.judgeTaught){S.judgeTaught=1;S.gsPulse=S.t+7;announce('The giant marks who guards it. Your standing in its regard rises.')}}return mv}
  o.t+=dt;if(o.t>=ARMY.HOLD*(o.k==='giant'?3:1)){tire(h);return mv}
  if(o.k==='attack'){
    const at=attackTarget(h);if(at){humanAct(h,'A');return mv}
    if(P.ob){if(Math.hypot(P.ob.x-h.x,P.ob.y-h.y)<95)swing(h,()=>damageBuild(P.ob,h.atk,h));else go(P.x,P.y,30);return mv}
    const bl=S.builds.find(x=>x.town===o.ti&&x.hp!==0&&Math.hypot(x.x-h.x,x.y-h.y)<80);if(bl){swing(h,()=>damageBuild(bl,h.atk,h));return mv}
    const t=P.t;if(t&&t.alive&&Math.hypot(t.x-h.x,t.y-h.y)<t.r+80){swing(h,()=>hurtWalls(t,h,h.atk));return mv}
    go(P.x,P.y,30);return mv}
  if(o.k==='giant'){const own=S.humans.find(x=>x.id===b.owner);if(own){regard(own,ARMY.GUARD_REGARD*dt);S.grudge[own.town]-=ARMY.GUARD_REGARD*dt}
    // holding the post: a detection ring around the soldier. Rival soldiers inside it are attacked; rival climbers low on the
    // giant inside it are pulled off; rivals walking to the foot inside it are attacked; beasts only once they have bitten
    const R=C.GUARD_R;let tg=null,bd=R;
    for(const x of S.humans){if(x.dead||x.town===h.town)continue;const d=dist(x,h);
      if(x.mode==='climb'){const f=S.g.feet[x.leg||0];if(x.cl&&x.cl.y<C.GUARD_PULL&&Math.hypot(f.x-h.x,f.y-h.y)<R+C.FOOT_R&&S.t-(x.pulledT||-99)>4){x.pulledT=S.t;leaveClimb(x);x.x=f.x+rr(-60,60);x.y=f.y+rr(-60,60);
          S.feud[x.town][h.town]+=20;sayTo(x,'A '+TOWNS[h.town].name+' soldier guarding the giant pulls you off its foot!');if(!S.headless&&nearPlayer(h))sfx('hit',true)}continue}
      if(x.mode!=='ground'||townAt(x))continue;if(d<bd&&(x.sol||x.goal&&x.goal.k==='foot'||x.you&&nearFoot(x)>=0)){bd=d;tg=x}}
    if(!tg&&S.t-(h.beastAt||-99)<6){const m=nearMonster(h,R);if(m)tg=m}
    if(tg){const at=attackTarget(h);if(at&&(at===tg||at.town!=null&&at.town!==h.town||at.town==null&&S.t-(h.beastAt||-99)<6)){humanAct(h,'A');return mv}go(tg.x,tg.y,30);return mv}
    go(P.x,P.y,22);return mv}
  if(!fight(P.x,P.y))go(P.x,P.y,22);return mv}
// bot towns use their barracks too: they train from the folk's gold, answer an attack on their walls, and take revenge on a feud
// the player's own town follows the player's lead: once the giant clearly likes or hates what you do, your town's
// barracks tend or hunt it the same way; until then they keep the town's habit
function townWay(i){if(S.you&&S.role==='human'&&i===S.you.town){const r=S.reg&&S.reg[S.you.id]||0;let L=S.leadState||null;
    // a lead is taken past ±40 and let go only inside ±30, so the soldiers do not flip back and forth
    if(r>C.LEAD_REG)L='tend';else if(r<-C.LEAD_REG)L='hunt';else if(L==='tend'&&r<C.LEAD_REG-10||L==='hunt'&&r>-(C.LEAD_REG-10))L=null;S.leadState=L;if(L)return L}return townHabit(i)}
C.LEAD_REG=40;
function townHabit(i){return i===1?'tend':i===2?'hunt':(mood(i)==='calm'||mood(i)==='friendly')?'tend':'hunt'}
function botOrders(b){const rs=readySoldiers(b);if(!rs.length)return;const home=barracksTown(b);
  if(home&&S.t-(home.hitT||-99)<6){giveOrder(b,'town');return}
  if(rs.some(readyToWake)){giveOrder(b,'tend');return}
  b.way=townWay(b.town);
  // when your lead turns your own town's soldiers, you are told, and the chronicle remembers
  if(S.you&&S.role==='human'&&b.town===S.you.town){const lead=S.leadState&&S.leadState!==townHabit(b.town)?S.leadState:null;if(S.leadWay===undefined)S.leadWay=null;if(lead!==S.leadWay){S.leadWay=lead;S.leadSaid=S.leadSaid||{};if(lead&&S.leadSaid[lead])toast('Your lead: '+TOWNS[b.town].name+'\u2019s soldiers '+(lead==='tend'?'tend':'hunt')+' the giant again.');else
    if(lead){S.leadSaid[lead]=1;toast('Your lead: '+TOWNS[b.town].name+'\u2019s soldiers now '+(lead==='tend'?'tend':'hunt')+' the giant, as you do.');chron('Following your lead, '+TOWNS[b.town].name+'\u2019s soldiers turned to '+(lead==='tend'?'tending':'hunting')+' the giant.')}
    else toast(TOWNS[b.town].name+'\u2019s soldiers go back to their old habit.')}}
  if(S.t<(S.revT[b.town]||0))return;for(let j=0;j<3;j++)if(j!==b.town&&factionAlive(j)&&S.feud[b.town][j]>ARMY.REVENGE&&S.towns[j].hp>S.towns[j].max*.6){S.revT[b.town]=S.t+ARMY.REVENGE_CD;giveOrder(b,'attack',j);
    if(S.you&&S.role==='human'&&j===S.you.town)announce(TOWNS[b.town].name+' soldiers march on '+TOWNS[j].name+'!');return}
  // rivals act before the giant wakes: now and then a bot barracks raids the nearest rival town even without a feud
  if(S.t>C.RIVAL_FROM&&rnd()<C.RIVAL_P){const j=[0,1,2].filter(x=>x!==b.town&&factionAlive(x)).sort((p,q)=>dist(orderTown(p,b)||b,b)-dist(orderTown(q,b)||b,b))[0];
    if(j!=null){S.revT[b.town]=S.t+ARMY.REVENGE_CD;giveOrder(b,'attack',j);if(S.you&&S.role==='human'&&j===S.you.town)announce(TOWNS[b.town].name+' soldiers march on '+TOWNS[j].name+'!');return}}
  giveOrder(b,b.way)}
C.RIVAL_FROM=240;C.RIVAL_P=.08;
function stepArmy(dt){
  for(const b of S.builds){if(b.hp!=null&&b.hp>0&&b.hp<b.max&&S.t-(b.hitT||-99)>10)b.hp=Math.min(b.max,b.hp+ARMY.BUILD_MEND*dt);
    if(b.k!=='barracks')continue;
    const home=barracksTown(b);if(!home){b.train=0;b.q=0;continue}
    if(b.train>0){b.train-=dt;if(b.train<=0){b.train=0;trainSoldier(b)}}else if(b.q>0&&b.sol.length<ARMY.CAP){b.q--;b.train=ARMY.TRAIN}
    const mine=playerBuilt(b);
    if(mine&&b.order){const o=b.order;if(o.k==='attack'&&!factionAlive(o.ti)||o.k==='giant'&&S.g.dead){b.order=null;toast('Your barracks stands down: its order can no longer be followed.')}else if(readySoldiers(b).length)giveOrder(b,o.k,o.ti)}
    if(!mine&&S.t>=(b.next||0)){b.next=S.t+2+rnd()*2;botOrders(b)}}
  // giant work (tend, hunt) is done by the soldier's own climbing and judgement; its 20 s count only while it works on the giant
  for(const h of S.humans){const o=h.ord;if(!h.sol||h.dead||!o||(o.k!=='tend'&&o.k!=='hunt'))continue;
    h.role=o.k==='tend'?'keeper':huntOpen()?'warden':'raider';o.total=(o.total||0)+dt;
    if(h.waking||S.t-(h.workedAt||-9)<1.2)o.t+=dt;
    const limit=o.k==='tend'&&readyToWake(h)?480:240;
    if(!h.waking&&(o.t>=ARMY.HOLD||o.total>=limit||S.g.dead)){if(h.mode==='climb')leaveClimb(h);tire(h)}}
  const doomed=S.builds.filter(b=>b.hp!=null&&b.hp<=0);if(doomed.length){S.builds=S.builds.filter(b=>!doomed.includes(b));for(const b of doomed)destroyBuild(b,true)}
  for(const h of S.humans)if(h.sol){if(h.dead){h.ord=null;h.wd=1}else if(h.wd){h.wd=0;const b=h.sol.b;h.x=b.x+rr(-30,30);h.y=b.y+rr(25,45)}}
  for(const t of S.towns){if(!t.alive||t.hp>=t.max||S.t-(t.hitT||-99)<6)continue;let n=0;for(const h of S.humans)if(h.town===t.i&&!h.sol&&!h.dead&&h.mode==='ground'&&townAt(h)===t)n++;if(n)t.hp=Math.min(t.max,t.hp+ARMY.WALL_FOLK*n*dt)}}
// ---- the barracks menu: train, give orders, or build beside it
function openBarracks(b){const h=S.you;if(!h)return;const sol=soldiersOf(b),ready=readySoldiers(b),out=sol.filter(s=>s.ord).length,tr=b.q+(b.train>0?1:0);
  const home=barracksTown(b),ordName=(k,ti)=>k==='town'?'defend '+(home?.name||'your town'):k==='giant'?'defend the giant':k==='tend'?'tend the giant':k==='hunt'?'hunt the giant':'attack '+TOWNS[ti].name,on=b.order;
  const needsBrace=s=>!s.dead&&!s.kits.brace,supply=ready.find(needsBrace)||sol.find(needsBrace),carried=h.kits.brace>0;
  const braceWhy=S.g.dead?'The giant has fallen':siteCapReached(h,'brace')?'The giant has all its braces built or underway':
    !supply?(sol.length?'No living soldier needs a brace kit':'Train a soldier first'):!carried&&h.gold<C.COST.brace?'Need '+(C.COST.brace-h.gold)+' more gold':null;
  const braceItem={label:'Supply a brace kit'+(carried?' (carried)':' – '+C.COST.brace+' gold'),sub:'Equip a soldier to build with Tend the giant',why:braceWhy,act:()=>{
    if(carried)h.kits.brace--;else h.gold-=C.COST.brace;
    supply.kits.brace++;supply.goal=null;supply.think=0;sfx('coin');toast('A soldier received a brace kit.');openBarracks(b)}};
  const ord=(k,ti,label,sub)=>({label:(on&&on.k===k&&on.ti===ti?'\u2713 ':'')+label,sub,why:!sol.length&&!tr?'No soldiers yet: train some':null,act:()=>{b.order={k,ti};const n=giveOrder(b,k,ti);closeMenu();toast((n?n+(n>1?' soldiers march':' soldier marches')+' to '+ordName(k,ti)+'. ':'')+'They will keep going back to '+ordName(k,ti)+' until you change the order.')}});
  const foes=[0,1,2].filter(j=>j!==b.town&&factionAlive(j)).map(j=>ord('attack',j,'Attack '+TOWNS[j].name,'Walk there, fight its people, buildings and walls for '+ARMY.HOLD+' s'));
  openMenu({title:'Barracks',body:`<p class="dim">${sol.length}/${ARMY.CAP} soldiers${tr?', '+tr+' training':''}${out?', '+out+' out':''}. ${h.gold} gold. Health ${Math.ceil(b.hp)}/${b.max}. ${on?'Standing order: '+ordName(on.k,on.ti)+'. ':''}Orders: they walk there in real time, hold ${ARMY.HOLD} s, tire and are back here at once, then set out again until you change the order.</p>`,
    items:[{label:'Train a soldier – '+ARMY.SOLDIER+' gold, '+C.SOLDIER_FOOD+' food',sub:ARMY.TRAIN+' s to train; this barracks holds '+ARMY.CAP,why:!home?'Its settlement has fallen':trainedCount(b)>=ARMY.CAP?'This barracks holds '+ARMY.CAP+' soldiers':h.gold<ARMY.SOLDIER?'Need '+(ARMY.SOLDIER-h.gold)+' more gold':solFoodWhy(b),act:()=>{h.gold-=ARMY.SOLDIER;spendStock(S.towns[b.settlementId],'food',C.SOLDIER_FOOD);b.q++;h.trained=(h.trained||0)+1;sfx('coin');openBarracks(b)}},braceItem,
      ...(home?[ord('town',null,'Defend town','Hold the walls of '+home.name)]:[]),ord('giant',null,'Defend giant','Stand at the nearest foot and fight what threatens it'),ord('tend',null,'Tend the giant','Break its chains once they open, sound a horn, pull wedges, bolt on braces and cannons'),ord('hunt',null,'Hunt the giant','Break its chains once they open, then wedge and strike its joints'),...foes,
      ...(on?[{label:'Stand down',sub:'Soldiers stay at the barracks when they come back',act:()=>{b.order=null;closeMenu();toast('Your soldiers will stay at the barracks when they return.')}}]:[]),
      {label:'Build here',sub:'House, watchtower or outpost',act:()=>openBuild()},{label:'Leave',act:closeMenu}],grid:true,back:closeMenu})}
