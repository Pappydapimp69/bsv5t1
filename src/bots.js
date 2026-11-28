'use strict';
// Colossus · src/bots.js · bots: the giant, heroes, foragers, soldiers
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= bots =================
function wedgedJoints(){return Object.keys(S.joints).filter(id=>S.joints[id].wedges.length)}
function wakeLedge(r,c){return r>=C.WAKE_ROW&&restful(S.body.g[r*COLS+c])}
function botGoalCells(h){const g=S.g,J=S.joints;
  if(h.hero&&(h.hp<h.max*.35||h.quest?.done))return{kind:'down',test:r=>r===0};
  if(h.hero&&h.quest?.k==='climb'&&g.awake)return{kind:'height',test:r=>r>=h.quest.need};
  if(h.quest&&h.quest.k==='tend'&&!h.quest.done&&wedgedJoints().length)return{kind:'pull',id:wedgedJoints()[0]};
  if((h.hero||h.role==='keeper')&&readyToWake(h))return{kind:'wake',test:wakeLedge};
  if((h.role==='keeper'||h.role==='raider')&&!g.awake&&chainsOpen()){const ch=S.chains.filter(q=>q.hp>0&&!chainWeak(q)).sort((a,b)=>a.r-b.r)[0];if(ch)return{kind:'chain',id:ch.id,test:(r,c)=>r===ch.r&&c===ch.c};if(!h.hero)return{kind:'down',test:r=>r===0}}
  const building=h.hero&&heroSiteGoal(h);if(building)return building;
  if(h.hero&&g.awake&&h.crystals){
    const site=S.sites.find(s=>s.build?.town===h.town&&!canUpgrade(h,s.build.k,s.build));
    if(site)return{kind:'raise',id:site.id,test:(r,c)=>r===site.r&&c===site.c};
  }
  if(h.role==='keeper'){const w=wedgedJoints();if(w.length)return{kind:'pull',id:w[0]};
    for(const k of['brace','ladder','platform'])if(h.kits[k]>0&&!siteCapReached(h,k)){const free=S.sites.filter(s=>!s.build&&!s.pending);if(free.length)return{kind:'kit',kit:k,test:(r,c)=>free.some(s=>s.r===r&&s.c===c)}}
    if(h.kits.cannon>0&&!siteCapReached(h,'cannon')){const free=S.sites.filter(s=>!s.build&&!s.pending);if(free.length)return{kind:'site',test:(r,c)=>free.some(s=>s.r===r&&s.c===c)}}
    // with nothing to build or pull, a keeper could tend the worst-hurt joint; off (C.BOT_TEND_BELOW=0): in sweeps it erased the giant's falls
    {const hurt=Object.keys(S.joints).filter(id=>id!=='heart'&&!S.joints[id].crip&&S.joints[id].hp<S.joints[id].max*C.BOT_TEND_BELOW).sort((a,b)=>S.joints[a].hp/S.joints[a].max-S.joints[b].hp/S.joints[b].max)[0];if(hurt&&tends(h))return{kind:'tend',id:hurt}}
    return{kind:'down',test:r=>r===0}}
  if(h.role==='raider'){if(h.kits.cannon>0&&!siteCapReached(h,'cannon')){const free=S.sites.filter(s=>!s.build&&!s.pending);if(free.length)return{kind:'site',test:(r,c)=>free.some(s=>s.r===r&&s.c===c)}}
    const enemy=S.sites.filter(s=>s.build&&s.build.k==='cannon'&&s.build.town!==h.town);if(enemy.length&&h.lvl>=2)return{kind:'wreck',test:(r,c)=>enemy.some(s=>s.r===r&&s.c===c)};
    return{kind:'down',test:r=>r===0}}
  if(!huntOpen())return{kind:'down',test:r=>r===0};
  if(!g.awake&&h.hero&&!h.kits.wedge)return{kind:'down',test:r=>r===0}; // a hero does not hang on a sleeper with nothing to drive in
  if(!g.awake){const k=['kneeL','kneeR','elbowL','elbowR','neck'].filter(id=>J[id].hp>J[id].max*C.SLEEP_FLOOR+5&&J[id].wedges.length<C.WEDGE_MAX).sort((a,b)=>J[b].hp-J[a].hp)[0];return k?{kind:'joint',id:k}:{kind:'down',test:r=>r===0}}
  if(g.fallen>0)return{kind:'joint',id:'heart'};
  const enemy=S.sites.filter(s=>s.build&&s.build.town!==h.town);
  if(enemy.length&&h.lvl>=3&&rnd()<.4)return{kind:'wreck',test:(r,c)=>enemy.some(s=>s.r===r&&s.c===c)};
  const k=J.kneeL.crip?'kneeR':J.kneeR.crip?'kneeL':(J.kneeL.hp<=J.kneeR.hp?'kneeL':'kneeR');
  if(J.kneeL.hp+J.kneeR.hp>2500&&h.lvl>=4&&!J.neck.crip&&rnd()<.3)return{kind:'joint',id:'neck'};
  return{kind:'joint',id:k}}
function botClimb(h){const cl=h.cl,g=S.g,mv={x:0,y:0};if(cl.fall||cl.move)return mv;
  if(h.waking){cl.path=null;return mv}
  if(h.hero&&h.hp<h.max*.45&&(h.potions||h.bigPotions)&&!reachT(h).j)humanAct(h,'Y');
  const r=Math.floor(cl.y),c=Math.floor(cl.x),t=cellT(cl.x,cl.y),mg=maxGrip(h);
  // bots used to brace for every shake, so the giant's main defence did nothing to them: now about two in three read it in time
  if(g.wind&&g.wind.k==='shake'){if(h.bw!==g.wind){h.bw=g.wind;h.bOk=rnd()<C.BOT_READ_SHAKE}if(h.bOk){cl.path=null;return mv}}
  // a twitch is a smaller warning: about half the climbers in that part read it in time
  if(g.wind&&g.wind.k==='twitch'&&zoneAt(r,c)===g.wind.zone){if(h.bw!==g.wind){h.bw=g.wind;h.bOk=rnd()<.5}if(h.bOk){cl.path=null;return mv}}
  if(g.wind&&g.wind.k==='swipe'&&!restful(t)){const left=g.wind.side==='L';if(r>=30&&(left?c<COLS/2:c>=COLS/2)){if(!cl.path||!h.dodging){h.dodging=true;cl.path=bfs(r,c,(rr2,cc)=>restful(S.body.g[rr2*COLS+cc])||rr2<30||(left?cc>=COLS/2:cc<COLS/2),3000)}return mv}}
  h.dodging=false;
  {const o=shoveTarget(h);if(o&&h.cd<=0&&h.grip>mg*.5&&rnd()<C.DT*C.BOT_SHOVE){const oj=jointAt(o.cl.x,o.cl.y),mine=hunter(h);
    if(oj&&(mine?!hunter(o)&&S.joints[oj].wedges.length:hunter(o)))shove(h,o)}}
  const canRest=restful(t)||restRope(h,r,c);
  if(h.rest){if(h.grip>=mg*.92||g.fallen>0||!canRest){h.rest=false;h.seekRest=false}else return mv}
  if(h.grip<mg*.35&&g.fallen<=0){if(canRest){h.rest=true;cl.path=null;return mv}
    if(!h.seekRest){h.seekRest=true;cl.path=bfs(r,c,(rr2,cc)=>restful(S.body.g[rr2*COLS+cc])||S.anchors.some(a=>a.town===h.town&&a.r===rr2&&a.c===cc),4000)}
    if(cl.path)return mv}
  else h.seekRest=false;
  if(h.grip<mg*.35&&!cl.path&&h.kits.anchor>0&&!S.anchors.some(a=>a.r===r&&a.c===c)&&placeAnchor(h)){h.rest=true;return mv}
  const goal=botGoalCells(h);
  const j=jointAt(cl.x,cl.y);
  if(goal.kind==='pull'&&j===goal.id){cl.path=null;if(S.joints[j].wedges.length)humanAct(h,'X');return mv}
  if(goal.kind==='tend'&&j===goal.id){cl.path=null;if(S.joints[j].hp<S.joints[j].max*.98)humanAct(h,'X');return mv}
  if(goal.kind==='joint'&&j===goal.id){cl.path=null;if(h.kits.wedge>0&&S.joints[j].wedges.length<C.WEDGE_MAX&&!S.joints[j].crip)humanAct(h,'Y');else humanAct(h,'A');return mv}
  const s=siteAt(cl.x,cl.y);
  if(s&&goal.kind==='site'&&!s.build){placeOnSite(h,s,'cannon');return mv}
  if(s&&goal.kind==='kit'&&!s.build){placeOnSite(h,s,goal.kit);return mv}
  if(s&&goal.kind==='raise'&&s.id===goal.id){cl.path=null;upgrade(h,s.build.k,s.build);return mv}
  if(goal.kind==='wake'&&wakeLedge(r,c)){cl.path=null;humanAct(h,'A');return mv}
  if(goal.kind==='chain'){const ch=S.chains.find(q=>q.id===goal.id);if(ch&&ch.r===r&&ch.c===c){cl.path=null;humanAct(h,'A');return mv}}
  if(s&&goal.kind==='wreck'&&s.build&&s.build.town!==h.town){humanAct(h,'A');return mv}
  if(goal.kind==='down'&&r<=1){dismount(h,0);return mv}
  if(goal.kind==='down'&&!cl.path&&h.kits.anchor>0&&r>40&&!S.anchors.some(a=>a.town===h.town&&a.r===r)&&rnd()<.01)placeAnchor(h);
  if(!cl.path||h.botGoal!==goal.kind+(goal.id||'')){h.botGoal=goal.kind+(goal.id||'');
    const test=goal.kind==='joint'||goal.kind==='pull'||goal.kind==='tend'?(rr2,cc)=>{const J=JOINTS[goal.id];return rr2>=J.r0&&rr2<=J.r1&&cc>=J.c0&&cc<=J.c1}:goal.test;
    cl.path=bfs(r,c,test,8000);
    if(!cl.path&&h.hero&&h.grip>=C.LUNGE_GRIP)cl.path=bfs(r,c,test,8000,LUNGE_OFFS);
    if(!cl.path){h.botGoal=null;if(r<=1)dismount(h,0);else{const p=bfs(r,c,rr2=>rr2===0,8000);cl.path=p}}}
  // drop an anchor every so often on the way up
  if(h.kits.anchor>0&&r>20&&r%35===0&&!S.anchors.some(a=>a.town===h.town&&Math.abs(a.r-r)<20))placeAnchor(h);
  return mv}
function botHuman(h,dt){const mv={x:0,y:0};if(h.dead||h.job)return mv;const g=S.g;if(h.hero&&h.mode==='ground'&&(!h.you||S.autoplay)&&S.t%1<dt){const n=S.monsters.filter(m=>Math.hypot(m.x-h.x,m.y-h.y)<120).length;if(h.hp<h.max*.4&&!skillWhy(h,SKILLS[2]))useSkill(h,'mend');else if(n>=3&&!skillWhy(h,SKILLS[4]))useSkill(h,'quake');else if(n>=3&&!skillWhy(h,SKILLS[0]))useSkill(h,'cry');else if(n>=2&&!skillWhy(h,SKILLS[1]))useSkill(h,'whirl');else if(!n&&!skillWhy(h,SKILLS[3])&&S.monsters.some(m=>Math.hypot(m.x-h.x,m.y-h.y)<400&&m.eng===h.id))useSkill(h,'spear')}
  if(h.horse&&h.mode==='ground'&&(!h.you||S.autoplay)){const foe=S.monsters.some(m=>Math.hypot(m.x-h.x,m.y-h.y)<320);if(foe&&h.riding)setRide(h,false);else if(!foe&&!h.riding&&horseReady(h))setRide(h,true)}if(h.you&&h.role==='you')h.role='keeper'; // a played person tends the giant: the bot standing in for one wins its regard
h.think-=dt;
  if(h.mode==='climb')return botClimb(h);
  const folk=isForager(h),home=folk?foragerHome(h):null;
  if(folk&&!home){const shelter=nearestOwn(h.town,h.x,h.y);return shelter&&dist(h,shelter)>shelter.r?steerSolid(h,shelter.x,shelter.y,14):mv}
  if(home&&(h.returnHome||!inForageRange(home,h))){if(townAt(h)!==home){h.returnHome=true;return steerSolid(h,home.x,home.y,14)}h.returnHome=false}
  const local=p=>!home||inForageRange(home,p);
  botDodge(h);
  if(h.hp<h.max*.45&&(h.potions||h.bigPotions)&&!townAt(h))humanAct(h,'Y');
  for(const f of g.feet)if(f.air>0){const d=Math.hypot(f.lx-h.x,f.ly-h.y);if(d<C.FOOT_R+50){const dx=h.x-f.lx,dy=h.y-f.ly,l=Math.hypot(dx,dy)||1;return{x:dx/l,y:dy/l}}}
  // a beast close by is fought, not walked past
  if(h.hp>h.max*.35&&!(h.ord?.k==='tend'&&readyToWake(h))&&!townAt(h)){const m=nearMonster(h,170,local);if(m&&(!h.goal||h.goal.k!=='monster')){h.goal={k:'monster',id:m.id};h.think=1.5}
    else if(!m&&(!h.goal||h.goal.k!=='foe')){const o=rivalNear(h,h.role==='raider'?260:160);if(o&&local(o)&&h.hp>h.max*.5&&(h.role==='raider'&&rnd()<.4||S.feud[h.town][o.town]>40||h.lastHurtBy===o)){h.goal={k:'foe',id:o.id};h.think=2}}}
  if(g.wind&&(g.wind.k==='stomp'||g.wind.k==='smash')){const pts=g.wind.k==='stomp'?g.feet:[g.wind],rad=g.wind.k==='stomp'?C.STOMP_R:C.SMASH_R;
    for(const p of pts){const d=Math.hypot(p.x-h.x,p.y-h.y);if(d<rad+30){const dx=h.x-p.x,dy=h.y-p.y,l=Math.hypot(dx,dy)||1;return{x:dx/l,y:dy/l}}}}
  const caravan=h.sol&&escortCaravan(h);
  if(caravan){const m=caravanThreat(caravan),target=m||caravan;
    if(m&&dist(h,m)<m.r+40){humanAct(h,'A');return mv}
    return dist(h,target)>45?steerSolid(h,target.x,target.y,14):mv}
  if(h.sol&&!(h.ord&&(h.ord.k==='tend'||h.ord.k==='hunt')))return soldierMove(h,dt);
  if(!h.goal||h.think<=0&&(h.goal.k!=='build'||S.t>=h.goal.until)){h.think=rr(.8,1.6);h.goal=pickGoal(h);if(h.goal&&h.goal.k==='build')h.goal.until=S.t+30}
  const G=h.goal;if(!G)return mv;let tx=G.x,ty=G.y;
  if(G.k==='foe'){const o=S.humans.find(x=>x.id===G.id);if(!o||!local(o)||o.dead||o.mode!=='ground'||townAt(o)||townAt(h)||h.hp<h.max*.3){h.goal=null;h.botCharge=null;return mv}tx=o.x;ty=o.y;if(Math.hypot(o.x-h.x,o.y-h.y)<55){botGroundStrike(h,o,dt);return mv}}
  if(G.k==='monster'){const m=S.monsters.find(m=>m.id===G.id);if(!m||!local(m)){h.goal=null;h.botCharge=null;return mv}tx=m.x;ty=m.y;if(Math.hypot(m.x-h.x,m.y-h.y)<m.r+40){botGroundStrike(h,m,dt);return mv}}
  h.botCharge=null;
  if(G.k==='foot'){const f=g.feet[G.i];if(f.air>0||nightLock()){h.goal=null;return mv}tx=f.x;ty=f.y;
    if(nearFoot(h)===G.i){if(!G.strike)mount(h,G.i);else if(footChain(h))humanAct(h,'A');else h.goal=null;return mv}}
  if(G.k==='shop'){const t=G.town;if(!t.alive){h.goal=null;return mv}if(townAt(h)===t){botShop(h);h.goal=null;return mv}}
  if(home&&!inForageRange(home,{x:tx,y:ty})){h.goal=null;return mv}
  if(G.k==='harvest'&&Math.hypot(tx-h.x,ty-h.y)<30){if(harvestTick(h,G,dt))h.goal=null;return mv}
  const dx=tx-h.x,dy=ty-h.y,d=Math.hypot(dx,dy);if(d>8){const st=steerSolid(h,tx,ty,14);mv.x=st.x;mv.y=st.y}
  if(G.k==='crystal'&&d<C.PICKUP_R*.7)h.goal=null;
  if(G.k==='build'&&d<20){build(h,G.what);h.goal=null}
  if(G.k==='cache'&&(d<120||!h.hero||!G.cache||G.cache.ready>S.t)){if(d<120)searchCache(h,G.cache);h.goal=null}
  if(G.k==='poi'&&(d<100||!S.pois.includes(G.poi))){if(d<100&&poiAct(h)&&!poiAct(h).why)usePoi(h,G.poi);h.goal=null}
  if(G.k==='raise'&&d<85){if(S.builds.includes(G.property))upgrade(h,G.property.k,G.property);h.goal=null}
  if(G.k==='maintain'&&(d<85||!S.builds.includes(G.property))){
    if(d<85&&S.builds.includes(G.property)){
      if(G.property.k==='house'&&home)upgrade(h,'house',G.property,home);
      else if(G.property.k==='barracks')tendBarracks(h,G.property)
    }
    h.goal=null;
  }
  return mv}
function botGroundStrike(h,target,dt){
  if(!h.hero||target.kind==='wolf'){humanAct(h,'A');return}
  if(h.cd>0||h.dodge)return;
  if(h.botCharge?.target!==target)h.botCharge={target,t:0};
  h.botCharge.t+=dt;
  if(h.botCharge.t>=CB.CHARGE_FULL){h.botCharge=null;heavyStrike(h,1)}
}
function botHeroShop(h,t){
  if(t.i!==h.town)return;
  if(!h.horse&&h.gold>=C.HORSE_COST+20&&!wallsDown(t)){h.gold-=C.HORSE_COST;h.horse={hp:C.HORSE_HP,max:C.HORSE_HP}}
  // grow the town: farms when houses go hungry, then a well, market, smithy and stable, built on a free spot near the hall
  if(S.t>=120&&!t.outpost&&!h.job&&!h.horn&&h.crystals<C.HORN_CRYSTALS&&!wallsDown(t)){const want=(t.houses||0)>2*civicIn(t,'farm')+1?'farm':['well','market','smithy','stable','farm'].find(k=>!civicIn(t,k)&&(!CIVIC[k].lvl||lv(t)>=CIVIC[k].lvl));
    if(want&&h.gold>=C.COST[want]+40)for(let k=0;k<12;k++){const a=rnd()*6.28,d=t.r*.5+rnd()*120,x=t.x+Math.cos(a)*d,y=t.y+Math.sin(a)*d,hx=h.x,hy=h.y;h.x=x;h.y=y;const why=canBuild(h,want);h.x=hx;h.y=hy;
      if(!why&&!inSolid(x,y,30)){h.gold-=C.COST[want];payRes(payerFor(h,want,x,y),want);startJob(h,{kind:'ground',k:want,x,y});break}}}
  if(wallsDown(t)){const repair=repairWalls(h,t);if(!repair.why){h.gold-=repair.need;t.hp=t.max}}
  if(wallsDown(t))return;
  const g=S.g;
  if(!g.awake&&!h.horn&&h.crystals>=C.HORN_CRYSTALS){h.crystals-=C.HORN_CRYSTALS;h.horn=1;eventSay(TOWNS[h.town].name+' has forged a wake horn.')}
  const bank=heroTownBank(h,t);if(bank)upgrade(h,'town',t,bank);
  if(h.gold<40&&(g.awake||h.role!=='keeper')&&h.crystals>0){
    const n=Math.min(h.crystals,Math.ceil((40-h.gold)/4));h.crystals-=n;h.gold+=n*4;
  }
  for(const k of ['blade','armour','pack','gloves']){
    const it=nextGear(h,k);if(it&&lv(t)>=it.t&&h.gold>=it.g+25)buyGear(h,k);
  }
  if(lv(t)>=2&&!h.bigPotions&&h.gold>=95){h.gold-=35;h.bigPotions++}
  const kit=heroKit(h);
  if(huntOpen()&&!h.kits[kit]&&h.gold>=C.COST[kit]+25){h.gold-=C.COST[kit];h.kits[kit]++}
  if(!h.kits.anchor&&h.gold>=C.COST.anchor+25){h.gold-=C.COST.anchor;h.kits.anchor+=3}
  if(!h.potions&&h.gold>=C.COST.potion){h.gold-=C.COST.potion;h.potions++}
}
function botShop0(){

}
function botShop(h){const town=townAt(h);if(h.hero){if(town)botHeroShop(h,town);return}
  if(town&&wallsDown(town))return;
  if(!h.sol){botFolkShop(h);return}if(h.role==='keeper'&&braces()>=BRACES_MAX&&h.kits.brace>0){h.kits.brace=0;h.gold+=C.COST.brace}
  if(h.role==='keeper'&&h.kits.ladder<1&&h.gold>=C.COST.ladder+40&&rnd()<.5){h.gold-=C.COST.ladder;h.kits.ladder++}if(h.role==='keeper'&&h.kits.platform<1&&h.gold>=C.COST.platform+60&&rnd()<.3){h.gold-=C.COST.platform;h.kits.platform++}
  if(h.role==='keeper'&&!S.g.awake&&!h.horn&&h.crystals>=C.HORN_CRYSTALS){h.crystals-=C.HORN_CRYSTALS;h.horn=1;if(!S.headless)announce(TOWNS[h.town].name+' has forged a wake horn.')}
  {const t=townAt(h);if(t&&t.i===h.town&&h.role!=='keeper'&&!canUpgrade(h,'town',t))upgrade(h,'town',t)}
  {const keep=h.role==='keeper'&&!S.g.awake&&!h.horn?C.HORN_CRYSTALS:h.role!=='keeper'?(upCost('town',homeOf(h)||{})||0):0,n=h.crystals-keep;if(n>0&&h.role==='keeper'){h.gold+=n*4;h.crystals-=n}}const want=h.role==='warden'?'wedge':h.role==='keeper'?(braces()>=BRACES_MAX?'ladder':'brace'):'cannon';
  while(h.kits[want]<2&&h.gold>=C.COST[want]){h.gold-=C.COST[want];h.kits[want]++}
  {const t=townAt(h);if(t)for(const k of['blade','armour','pack','gloves']){const it=nextGear(h,k);if(it&&lv(t)>=it.t&&h.gold>=it.g+30)buyGear(h,k)}}
  if(h.kits.anchor<2&&h.gold>=C.COST.anchor){h.gold-=C.COST.anchor;h.kits.anchor+=3}
  if(!h.potions&&h.gold>=C.COST.potion){h.gold-=C.COST.potion;h.potions++}
}
function botSleeper(dt){const g=S.g;if(g.wind||nightLock())return;
  if(allWeak())return; // it waits for a horn: the bot giant never rises on a timer
  // it twitches where it is being worked against, not at every touch, and strains now and then in its sleep
  // it holds still where those tending it outnumber those hurting it (a keeper pulling a wedge is not shaken off)
  const side=z=>{let f=0,e=0;for(const h of climbers())if(zoneAt(h.cl.y,h.cl.x)===z){if(hunter(h))e++;else if(h.role==='keeper'||(S.reg&&S.reg[h.id]||0)>0)f++}return f>e};
  let bz=null,bs=0;for(const z in ZONES){if(side(z))continue;const v=zoneFelt(z);if(v>bs){bs=v;bz=z}}
  if(bz&&bs>=1&&g.cd.twitch<=0&&rnd()<dt*(bs>=2.5?.4:.15)){g.aim=bz;giantDo('twitch');g.aim=null;return}
  if(g.cd.dream<=0&&dreamTarget()&&S.grudge[dreamTarget().i]>=C.DREAM_MIN*4&&rnd()<dt*.05){giantDo('dream');return}
  if(huntOpen()&&g.cd.strain<=0&&rnd()<dt*.05)giantDo('strain')}
function botGiant(dt){const g=S.g;if(!g.dead&&!g.awake&&S.t>=C.HUNT_OPEN){botSleeper(dt);return}
  if(!g.dead&&g.fallen>0){if(rnd()<dt*C.BOT_STRUGGLE)giantDo('struggle');return}if(g.dead||g.fallen>0||!g.awake)return;g.botT-=dt;
  const alive=aliveTowns();
  // not aggressive by default: it goes after a town only once that town's people have hurt it past bearing
  let angry=null;for(const t of alive)if(S.grudge[t.i]>=C.ANGER&&(!angry||S.grudge[t.i]>S.grudge[angry.i]||S.grudge[t.i]===S.grudge[angry.i]&&dist(t,g)<dist(angry,g)))angry=t;
  if(angry&&S.angryAt!==angry.i){S.angryAt=angry.i;chron('Because '+TOWNS[angry.i].name+'\u2019s people hurt it past bearing, the giant turned on '+angry.name+'.')}
  g.target=angry;
  if(!angry&&(!S.wander||g.botT<=0||Math.hypot(S.wander.x-g.x,S.wander.y-g.y)<200)){g.botT=40;
    for(let k=0;k<30;k++){const x=rr(900,C.MAP-900),y=rr(900,C.MAP-900);if(alive.every(t=>Math.hypot(t.x-x,t.y-y)>1700*WS)){S.wander={x,y};break}}}
  // when it can walk, and nothing has angered it, it heads for the gap in the far hills
  if(!angry&&S.wander){g.tx=S.wander.x;g.ty=S.wander.y} // it never heads for the gap of its own accord
  const cl=climbers().filter(h=>h.cl.y>8);
  const t=g.target;if(t){const d=dist(g,t);if(d>t.r+200){g.tx=t.x;g.ty=t.y}else{g.tx=t.x+Math.cos(S.t*.15)*250;g.ty=t.y+Math.sin(S.t*.15)*250}if(d<C.SMASH_REACH+t.r)giantDo('smash')}
  const threat=cl.filter(h=>h.role==='warden'||h.role==='you').length;
  // it fights in bursts, then rests: after a few shakes and swipes close together it takes a breather (Left 4 Dead's
  // build-up / peak / relax), so climbers get windows to move instead of an endless wall of shakes
  g.def=(g.def||[]).filter(t=>S.t-t<C.G_BURST_WIN);const resting=S.t<(g.restUntil||0);
  const defend=k=>{if(giantDo(k)){g.def.push(S.t);if(g.def.length>=C.G_BURST){g.restUntil=S.t+C.G_REST;g.def=[]}}};
  if(!resting){
    if(threat>=2||(threat>=1&&rnd()<dt*.12))defend('shake');
    const side=swipeSide();if(side){let n=0;for(const h of cl)if(h.cl.y>=30&&(side==='L'?h.cl.x<COLS/2:h.cl.x>=COLS/2))n++;if(n>=2||(n>=1&&rnd()<dt*.08))defend('swipe')}}
  let near=0;for(const h of S.humans)if(!h.dead&&h.mode==='ground'&&S.grudge[h.town]>100)for(const f of g.feet)if(Math.hypot(f.x-h.x,f.y-h.y)<C.STOMP_R*.9)near++;
  if(near>=2)giantDo('stomp')}
function trackGiantTarget(){const g=S.g;if(g.tx==null)return;let b=null,bd=1e9;for(const t of aliveTowns()){const d=Math.hypot(t.x-g.tx,t.y-g.ty);if(d<bd){bd=d;b=t}}g.target=b&&bd<900?b:null}

