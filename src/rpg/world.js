'use strict';
// Colossus · src/rpg/world.js · places (shrines, springs, stones, herbs, camps), merchant, travellers, deer, hound, treasure, world events, ruins
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= places to visit (owner: "more action points in the world so it doesn't feel empty") =================
// Shrines (a timed blessing), hot springs (+10 most health on the first soak, Ghost of Tsushima style), standing stones
// (lore; read all four for a free talent), herb patches (three make a potion), beast camps (an alpha and its pack guard a
// chest, back in five minutes), lost travellers (walk them to a town) and a wandering merchant. Laid out from their own
// generator so the land, beasts and every seeded test keep their numbers. Spread by the BotW "gravity" idea: something
// in view from every rise between the towns.
const LORE=['The first giant fell where the rim is highest. Its chains were forged from the sky crystals that still fall today.',
  'They say the giant dreams of the towns that wound it, and the beasts walk in its dreams.',
  'Three towns, three ways: Ashville barters, Brindle tends, Corvel hunts. The giant remembers each.',
  'A horn of twenty sky crystals woke it once before. The one who blew it was honoured above kings.'];
const SHRINES={might:{n:'Shrine of Might',t:'Hit 25% harder for 2 minutes',col:'#ff9a4a'},swift:{n:'Shrine of the Wind',t:'Move 20% faster for 2 minutes',col:'#9fe8ff'},ward:{n:'Shrine of Stone',t:'Take 30% less damage for 2 minutes',col:'#c9b8ff'}};
const ALPHAS=['Grey-Maw','Ashfang','Old Brindlecoat','Red Ear','Nightjaw','Stonepaw'];
function layPois(){if(S.pois)return;const R=mulberry32((S.seed^0x51ED27)>>>0),M=C.MAP,pois=[];let id=1;
  const ok=(x,y,gap)=>x>700&&y>700&&x<M-700&&y<M-700&&!inSolid(x,y,110)&&S.towns.every(t=>Math.hypot(t.x-x,t.y-y)>t.r+900)&&Math.hypot(S.g.x-x,S.g.y-y)>1300
    &&pois.every(p=>Math.hypot(p.x-x,p.y-y)>(p.k==='herb'?260:gap))&&S.caches.every(c=>Math.hypot(c.x-x,c.y-y)>500)&&!(S.lakes||[]).some(l=>Math.hypot(l.x-x,l.y-y)<(l.r||200)+80);
  const add=(k,n,gap,extra)=>{for(let i=0,tries=0;i<n&&tries<400;tries++){const x=R()*M,y=R()*M;if(!ok(x,y,gap))continue;pois.push({id:id++,k,x,y,ready:0,...(extra?extra(i):{})});i++}};
  add('shrine',6,1400,i=>({sub:['might','swift','ward'][i%3]}));add('spring',3,1600);add('stones',4,1600,i=>({lore:i}));add('camp',4,2000,i=>({name:ALPHAS[i%ALPHAS.length]}));add('herb',16,500);
  S.pois=pois;S.poiT=0}
function poiNear(h,r=120){let best=null,d=r;for(const p of S.pois||[]){if(p.gone)continue;const e=Math.hypot(p.x-h.x,p.y-h.y)-(p.k==='camp'?60:0);if(e<d){best=p;d=e}}return best}
function campBeasts(p){return S.monsters.filter(m=>m.camp===p.id)}
const CHIEFS=['Black Hal','Mother Crow','Two-Bows Ned','Red Wenna'];
// alphas and chiefs roll a trait (Diablo's elite affixes, one at a time so each reads clearly)
const AFFIX={swift:{n:'Swift',t:'moves and strikes faster'},armoured:{n:'Armoured',t:'takes half damage until below half health'},vampiric:{n:'Vampiric',t:'heals when it hits'},frenzied:{n:'Frenzied',t:'hits harder as it bleeds'}};
function rollAffix(m){const ks=Object.keys(AFFIX);m.affix=ks[(m.id*7)%ks.length];if(m.affix==='swift')m.swift=1}
function spawnCamp(p){p.alive=true;if(p.id%2===0){p.bandits=1;p.name=p.name&&!ALPHAS.includes(p.name)?p.name:CHIEFS[p.id%CHIEFS.length];
    for(let k=0;k<3;k++){const a=k*2.1,x=p.x+Math.cos(a)*110,y=p.y+Math.sin(a)*110;S.monsters.push({id:S.nextId++,kind:'archer',x,y,hx:x,hy:y,hp:40,max:40,atk:8,gold:16,xp:20,r:14,cd:1+k*.7,camp:p.id})}
    S.monsters.push({id:S.nextId++,kind:'archer',x:p.x,y:p.y+40,hx:p.x,hy:p.y,hp:130,max:130,atk:12,gold:45,xp:70,r:16,cd:0,camp:p.id,elite:p.name});rollAffix(S.monsters[S.monsters.length-1]);return}for(let k=0;k<3;k++){const a=k*2.1,x=p.x+Math.cos(a)*90,y=p.y+Math.sin(a)*90;S.monsters.push({id:S.nextId++,kind:'wolf',x,y,hx:p.x,hy:p.y,hp:40,max:40,atk:7,gold:10,xp:14,r:13,cd:0,camp:p.id})}
  S.monsters.push({id:S.nextId++,kind:'wolf',x:p.x,y:p.y+40,hx:p.x,hy:p.y,hp:150,max:150,atk:12,gold:40,xp:70,r:19,cd:0,camp:p.id,elite:p.name});rollAffix(S.monsters[S.monsters.length-1])}
function poiLabel(p,h){const left=s=>{s=Math.ceil(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
  if(p.k==='shrine'){const D=SHRINES[p.sub];return D.n+(S.t<p.ready?' (resting '+left(p.ready-S.t)+')':': '+D.t)}
  if(p.k==='spring')return'Hot spring'+(h&&!(p.used||{})[h.id]?': +10 most health':S.t<p.ready?' (warming '+left(p.ready-S.t)+')':': heals');
  if(p.k==='stones')return'Standing stones'+(h&&(h.lore||{})[p.lore]?' (read)':': lore');
  if(p.k==='herb')return S.t<p.ready?'':'Healing herbs';
  if(p.k==='camp'){const n=campBeasts(p).length;return n?p.name+'\u2019s camp: '+n+(p.bandits?' bandits':' beasts')+' guard a chest':!p.alive?'Empty camp'+(S.t<p.ready?' (back in '+left(p.ready-S.t)+')':''):'Camp chest: open it!'}
  if(p.k==='traveller')return p.follow?'Traveller (following you)':'Lost traveller: walk them home';
  if(p.k==='merchant')return'Wandering merchant';return''}
function poiAct(h){const p=poiNear(h);if(!p)return null;
  if(p.k==='shrine')return S.t<p.ready?{l:'Shrine resting',why:'Back in '+Math.ceil(p.ready-S.t)+' s'}:{l:'Pray',sub:SHRINES[p.sub].t};
  if(p.k==='spring')return S.t<p.ready&&(p.used||{})[h.id]?{l:'Spring warming',why:'Back in '+Math.ceil(p.ready-S.t)+' s'}:{l:'Soak',sub:(p.used||{})[h.id]?'Heals half':'+10 most health'};
  if(p.k==='stones')return{l:'Read the stones',sub:(h.lore||{})[p.lore]?'Read again':'Lore and XP'};
  if(p.k==='herb')return S.t<p.ready?null:{l:'Pick herbs',sub:(h.herbs||0)+'/3 for a potion'};
  if(p.k==='camp'){const n=campBeasts(p).length;return n?{l:'Camp chest',why:'Beat the '+n+' guards first'}:!p.alive?{l:'Camp empty',why:S.t<p.ready?'Back in '+Math.ceil(p.ready-S.t)+' s':'The pack returns when you are away'}:{l:'Open chest',sub:'Gold and crystals'}}
  if(p.k==='traveller'){if(p.ambush&&S.monsters.some(m=>m.guard===p.id))return{l:'Help traveller',why:'Drive off the wolves first'};return p.follow===h.id?null:{l:'Help traveller',sub:'Walk them to a town'+(p.ambush?' (100 gold)':'')}}
  if(p.k==='merchant')return{l:'Trade',sub:'Rare goods'};return null}
function usePoi(h,p){const D=SHRINES[p.sub];
  if(p.k==='shrine'){if(S.t<p.ready)return false;p.ready=S.t+150;h.buff={k:p.sub,until:S.t+120};gainXp(h,15);questTick(h,'pray');if(h.you){toast(D.n+': '+D.t+'.');sfx('coin')}S.fx.push({k:'ring',x:p.x,y:p.y,r:140,t:0,life:.8,col:D.col});return true}
  if(p.k==='spring'){p.used=p.used||{};if(!p.used[h.id]){p.used[h.id]=1;h.max+=10;h.hp=h.max;if(h.you)toast('The hot spring soothes you: +10 most health, fully healed.')}else{if(S.t<p.ready)return false;h.hp=Math.min(h.max,h.hp+h.max*.5);if(h.you)toast('The spring heals you.')}p.ready=S.t+90;sfx('coin',h.you);S.fx.push({k:'ring',x:p.x,y:p.y,r:90,t:0,life:.8,col:'#9fe8ff'});return true}
  if(p.k==='stones'){h.lore=h.lore||{};const first=!h.lore[p.lore];h.lore[p.lore]=1;if(h.you)openMenu({title:'Standing stones',body:'<p>'+LORE[p.lore]+'</p><p class="dim">'+Object.keys(h.lore).length+' of '+LORE.length+' stones read.</p>',items:[{label:'Go on',act:closeMenu}],back:closeMenu});
    if(first){gainXp(h,25);questTick(h,'lore');if(Object.keys(h.lore).length===LORE.length){h.picks=(h.picks||0)+1;if(h.you)toast('Every stone read: a free talent (T)!');else autoTalent(h)}}return true}
  if(p.k==='herb'){if(S.t<p.ready)return false;p.ready=S.t+150;h.herbs=(h.herbs||0)+1;h.hp=Math.min(h.max,h.hp+10);if(h.herbs>=3){h.herbs-=3;h.potions++;if(h.you)toast('Three herbs: you brew a potion.')}else if(h.you)toast('Healing herbs ('+h.herbs+'/3 for a potion).');sfx('coin',h.you);return true}
  if(p.k==='camp'){if(campBeasts(p).length||!p.alive)return false;p.ready=S.t+300;p.alive=false;h.campsBroken=(h.campsBroken||0)+1;if(!h.treasure&&rnd()<.34)giveTreasure(h);const g=Math.round((80+Math.floor(rnd()*60))*(1+.25*charm(h,'coin'))),c=packAdd(h,'crystals',3);h.gold+=g;if(rnd()<.45)giveCharm(h);gainXp(h,40);questTick(h,'camp');
    if(!h.you&&h.hero&&S.you&&!S.headless)eventSay(whoOf(h).replace(/^./,c=>c.toUpperCase())+' looted '+p.name+'\u2019s camp.');
    if(h.you){toast(p.name+'\u2019s camp: +'+g+' gold'+(c?', '+c+' crystals':'')+'. The pack will return.');sfx('coin');shake(4)}return true}
  if(p.k==='traveller'){p.follow=h.id;if(h.you)toast('"Thank you! Take me to any of '+TOWNS[h.town].name+'\u2019s towns."');return true}
  if(p.k==='merchant'){if(h.you)openMerchant(h,p);return true}return false}
function openMerchant(h,p){const it=(label,cost,sub,fn,why)=>({label:label+' \u2013 '+cost+' gold',sub,why:why||(h.gold<cost?'Need '+(cost-h.gold)+' more gold':null),act:()=>{h.gold-=cost;fn();sfx('coin');openMerchant(h,p)}});
  openMenu({title:'Wandering merchant',body:'<p class="dim">"Rare goods from beyond the rim." You have '+h.gold+' gold.</p>',items:[
    it('Tome of insight',150,'One more talent pick',()=>{h.picks=(h.picks||0)+1;toast('A talent to choose (T).')}),
    it('Elixir of strength',120,'+3 damage for good',()=>{h.atk+=3}),
    it('Swift mare',55,'A horse at a discount',()=>{h.horse={hp:C.HORSE_HP,max:C.HORSE_HP};toast('A horse is yours. R to ride.')},h.horse?'You have a horse':null),
    it('Greater potion',30,'Restores 140 health',()=>{h.bigPotions++}),it('A treasure map',80,'A ringed area with a buried chest',()=>{giveTreasure(h)},h.treasure?'You already hold one':null),it('A hunting hound',160,'Follows you and fights beside you',()=>{h.hound={};toast('A hound is yours.')},h.hound?'You have a hound':null),it('A charm, sight unseen',100,'One of the charms you do not have',()=>{giveCharm(h)}),{label:'Leave',act:closeMenu}],back:closeMenu})}
// where the merchant parks at a town: dry, open ground clear of the first day's house spot
function merchantSpot(t){if(t.mspot)return t.mspot;for(const a of[Math.PI,Math.PI*.75,Math.PI*1.25,Math.PI*.5,Math.PI*1.5,Math.PI*.25,Math.PI*1.75,0]){const x=t.x+Math.cos(a)*(t.r+170),y=t.y+Math.sin(a)*(t.r+170);if(lakeAt(x,y)||(S.lakes||[]).some(l=>Math.hypot(l.x-x,l.y-y)<(l.r||200)+60)||inSolid(x,y,50)||Math.hypot(x-(t.x+t.r+170),y-(t.y+40))<220)continue;return t.mspot={x,y}}return t.mspot={x:t.x-t.r-170,y:t.y}}
function stepPois(dt){layPois();if(S.you&&S.t%.5<dt)for(const p of S.pois)if(!p.found&&Math.hypot(p.x-S.you.x,p.y-S.you.y)<1700){p.found=1;if(S.t>5&&['shrine','spring','stones','camp'].includes(p.k)&&!S.headless){S.found=(S.found||0)+1;toast('Discovered: '+(p.k==='shrine'?SHRINES[p.sub].n:p.k==='spring'?'a hot spring':p.k==='stones'?'standing stones':p.name+'\u2019s camp')+'.')}}
  for(const p of S.pois){if(p.k==='camp'&&!p.alive&&S.t>=p.ready&&!campBeasts(p).length&&Math.hypot((S.you||S.g).x-p.x,(S.you||S.g).y-p.y)>1500)spawnCamp(p)}
  // travellers: one or two lost at a time; a helped one follows its hero and is paid for at any town of theirs
  S.poiT-=dt;if(S.poiT<=0&&S.pois.filter(p=>p.k==='traveller').length<2){S.poiT=90;const R=rnd;for(let k=0;k<30;k++){const x=900+R()*(C.MAP-1800),y=900+R()*(C.MAP-1800);if(inSolid(x,y,60)||S.towns.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+1200))continue;S.pois.push({id:S.nextId++,k:'traveller',x,y,ready:0});break}}
  for(let i=S.pois.length-1;i>=0;i--){const p=S.pois[i];if(p.k!=='traveller'||!p.follow)continue;const h=S.humans.find(o=>o.id===p.follow);if(!h||h.dead||h.mode!=='ground'){p.follow=null;continue}
    const d=Math.hypot(h.x-p.x,h.y-p.y);if(d>60){const sp=Math.min(d-50,(h.riding?C.H_SPEED*C.RIDE:C.H_SPEED)*1.05*dt);p.x+=(h.x-p.x)/d*sp;p.y+=(h.y-p.y)/d*sp}
    const t=aliveTowns().find(t=>t.i===h.town&&Math.hypot(t.x-p.x,t.y-p.y)<t.r+40);if(t){S.pois.splice(i,1);h.gold+=p.ambush?100:50;gainXp(h,30);questTick(h,'escort');if(h.you){toast('The traveller is safe in '+t.name+': +'+(p.ambush?100:50)+' gold.');sfx('coin')}}}
  // world events, every 2.5-3.5 minutes: a traveller ambushed by wolves (drive them off, then walk them home for double
  // pay), or a golden stag (hunt it for 60 gold and maybe a charm). Told to everyone; the map and the Now line show where.
  S.wevT=(S.wevT??150)-dt;if(S.wevT<=0){S.wevT=150+rnd()*60;worldEvent()}
  if(S.critters)S.critters=S.critters.filter(c=>!c.golden||!c.dead&&S.t<c.until);
  if(S.t%5<dt)for(const h of S.humans)if(h.saga&&!h.saga.done&&SAGA[h.saga.i]&&SAGA[h.saga.i].k==='warlord'&&!S.monsters.some(m=>m.warlord))spawnWarlord(h);
  for(let i=S.monsters.length-1;i>=0;i--){const m=S.monsters[i];if(m.champion&&S.t>m.until&&!(m.eng&&S.t-(m.engT||-9)<5))S.monsters.splice(i,1)}
  let mc=S.pois.find(p=>p.k==='merchant');if(!mc&&aliveTowns().length){const t=aliveTowns()[0];const ms=merchantSpot(t);mc={id:S.nextId++,k:'merchant',x:ms.x,y:ms.y,ready:0,leg:0,rest:0};S.pois.push(mc)}
  if(mc){if(mc.rest>0)mc.rest-=dt;else{const ts=aliveTowns().filter(t=>!t.outpost);if(ts.length){const t=ts[mc.leg%ts.length],ms=merchantSpot(t),tx=ms.x,ty=ms.y,d=Math.hypot(tx-mc.x,ty-mc.y);if(d<20){mc.leg++;mc.rest=60}else{const st=steerSolid(mc,tx,ty,20),sp=70*WS*dt;mc.x+=st.x*sp;mc.y+=st.y*sp}}}}}
// wildlife: deer herds graze the open land and bolt from anyone who comes near; a hero can hunt one for a pelt and meat
function critterNear(h){let b=null,d=70;for(const c of S.critters||[]){if(c.dead)continue;const e=Math.hypot(c.x-h.x,c.y-h.y);if(e<d){d=e;b=c}}return b}
function huntCritter(h,c){c.dead=S.t;const pe=packAdd(h,'pelts',1);if(c.golden){h.gold+=60;gainXp(h,50);if(rnd()<.5)giveCharm(h);if(h.you)announce('You brought down the golden stag: +60 gold.');return true}h.gold+=6;gainXp(h,6);if(h.you&&!S.headless){S.fx.push({k:'spark',x:c.x,y:c.y,z:25,t:0,life:.25});S.fx.push({k:'txt',x:c.x,y:c.y,z:60,text:'+6 gold'+(pe?', a pelt':''),t:0,life:1.1,col:'#ffd27a'});sfx('kill',true)}questTick(h,'hunt');return true}
function stepCritters(dt){if(!S.critters){const R=mulberry32((S.seed^0xDEE7)>>>0),M=C.MAP;S.critters=[];
    for(let k=0,n=0;k<200&&n<10;k++){const x=900+R()*(M-1800),y=900+R()*(M-1800);if(inSolid(x,y,80)||S.towns.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+600))continue;n++;for(let j=0;j<3;j++)S.critters.push({x:x+(R()-.5)*120,y:y+(R()-.5)*120,hx:x,hy:y,fa:R()*6.28,id:'deer'+n+'_'+j})}}
  for(const c of S.critters){if(c.dead){if(S.t-c.dead>150){c.dead=0;c.x=c.hx;c.y=c.hy}continue}let fx=0,fy=0,near=null,nd=330;
    for(const h of S.humans){if(h.dead||h.mode!=='ground')continue;const d=Math.hypot(h.x-c.x,h.y-c.y);if(d<nd){nd=d;near=h}}
    if(near){const d=nd||1,sp=(near.riding?250:200)*(c.golden?1.25:1)*WS*dt;fx=(c.x-near.x)/d*sp;fy=(c.y-near.y)/d*sp;c.scared=1}
    else{c.scared=0;const dx=c.hx-c.x,dy=c.hy-c.y,d=Math.hypot(dx,dy);if(d>160){fx=dx/d*30*dt;fy=dy/d*30*dt}else if(Math.sin(S.t*.3+c.x)>.6){fx=Math.cos(c.fa)*18*dt;fy=Math.sin(c.fa)*18*dt}else if(rnd()<.004)c.fa=rnd()*6.28}
    if(fx||fy){const nx=clamp(c.x+fx,200,C.MAP-200),ny=clamp(c.y+fy,200,C.MAP-200);if(!inSolid(nx,ny,20)){c.x=nx;c.y=ny;c.fa=Math.atan2(fy,fx)}else c.fa+=1.5}}}
// a hound: a companion bought at a stable or from the merchant. It trots at your heel, runs down the beast you fight
// (or the nearest one that comes at you), bites for 6 + 1 per level of yours, and lies down to lick its wounds if hurt
// badly (it cannot die). Rival heroes don't keep hounds.
function stepHound(h,dt){const d=h.hound;if(!d)return;if(d.x==null){d.x=h.x+30;d.y=h.y;d.cd=0;d.hp=d.max=80}if(h.dead||h.mode!=='ground'){d.tgt=null;return}
  if(d.rest>0){d.rest-=dt;d.hp=Math.min(d.max,d.hp+12*dt);return}
  let tg=d.tgt&&S.monsters.includes(d.tgt)&&Math.hypot(d.tgt.x-h.x,d.tgt.y-h.y)<420?d.tgt:null;
  if(!tg)tg=S.monsters.filter(m=>(m.eng===h.id&&S.t-(m.engT||-9)<1)||Math.hypot(m.x-h.x,m.y-h.y)<180).sort((a,b)=>Math.hypot(a.x-d.x,a.y-d.y)-Math.hypot(b.x-d.x,b.y-d.y))[0]||null;d.tgt=tg;
  const gx=tg?tg.x:h.x-Math.cos(h.face||0)*50,gy=tg?tg.y:h.y-Math.sin(h.face||0)*50,dd=Math.hypot(gx-d.x,gy-d.y),sp=(h.riding?C.H_SPEED*C.RIDE:C.H_SPEED)*1.25;
  if(dd>(tg?tg.r+16:30)){const st=steerSolid(d,gx,gy,12);d.x+=st.x*Math.min(sp*dt,dd);d.y+=st.y*Math.min(sp*dt,dd);d.fa=Math.atan2(st.y,st.x)}
  else if(tg){d.cd-=dt;if(d.cd<=0){d.cd=.8;hitBeast(h,tg,6+h.lvl);if(tg.cd!=null&&!tg.wind&&rnd()<.25){d.hp-=tg.atk;if(d.hp<=20){d.rest=12;d.tgt=null;if(h.you)toast('Your hound is hurt and lies down to rest.')}}}}
  if(dd>1500){d.x=h.x+30;d.y=h.y}}
// treasure maps: from camp chests (1 in 3) and the merchant. The map rings an area on your map; within 160 of the spot
// a glint shows it and X digs it up for 150-250 gold, crystals and maybe a charm.
function giveTreasure(h){const R=rnd;for(let k=0;k<40;k++){const x=900+R()*(C.MAP-1800),y=900+R()*(C.MAP-1800);if(inSolid(x,y,40)||S.towns.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+800))continue;
    h.treasure={x,y,cx:x+(R()-.5)*500,cy:y+(R()-.5)*500};if(h.you){announce('A treasure map! The ringed area on your map (M) hides a chest: dig where it glints.');sfx('coin')}return true}return false}
function digTreasure(h){const T=h.treasure;if(!T||Math.hypot(T.x-h.x,T.y-h.y)>90)return false;h.treasure=null;const g=150+Math.floor(rnd()*100);h.gold+=g;const c=packAdd(h,'crystals',3);gainXp(h,40);(h.stat=h.stat||{}).treasure=(h.stat.treasure||0)+1;
  if(rnd()<.5)giveCharm(h);if(h.you){announce('You dig up the treasure: +'+g+' gold'+(c?', '+c+' crystals':'')+'.');sfx('fanfare');shake(5)}return true}
// world events (on the seeded rnd, so a seed replays the same day): an ambushed traveller, a golden stag, a champion
function worldEvent(kind){const R=rnd;for(let k=0;k<30;k++){const x=900+R()*(C.MAP-1800),y=900+R()*(C.MAP-1800);if(inSolid(x,y,80)||S.towns.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+1000)||Math.hypot(S.g.x-x,S.g.y-y)<1200)continue;
    const roll=kind==='champion'?.9:kind==='ambush'?.1:kind==='stag'?.5:R();if(roll>=.66){const names=['Ser Aldric the Grey','Hilde of the Rim','The Masked Champion','Bram Ironhand'];S.monsters.push({id:S.nextId++,kind:'knight',x,y,hx:x,hy:y,hp:260,max:260,atk:14,gold:120,xp:120,r:16,cd:0,elite:names[S.nextId%4],champion:1,until:S.t+200});eventSay('A wandering champion waits in the wilds and challenges any hero to a duel! (marked on your map)')}
    else if(roll<.33){const tv={id:S.nextId++,k:'traveller',x,y,ready:0,ambush:1};S.pois.push(tv);for(let j=0;j<3;j++){const a=j*2.1;S.monsters.push({id:S.nextId++,kind:'wolf',x:x+Math.cos(a)*90,y:y+Math.sin(a)*90,hx:x,hy:y,hp:36,max:36,atk:7,gold:10,xp:14,r:13,cd:0,guard:tv.id})}eventSay('A traveller cries for help: wolves have them cornered! (marked on your map)')}
    else{(S.critters=S.critters||[]).push({x,y,hx:x,hy:y,fa:0,id:'stag'+S.nextId++,golden:1,until:S.t+150});eventSay('A golden stag has been seen in the wilds. Hunt it before it is gone!')}return true}return false}
function buffOf(h,k){return h.buff&&h.buff.k===k&&h.buff.until>S.t}
function cacheNear(h){let best=null,d=160;for(const c of S.caches){const next=dist(h,c);if(next<d){best=c;d=next}}return best}
// ruins in the old giants hold old things: gold, crystals and sometimes a kit; they fill again after a while
// what a ruin holds, said where you can see it: a ready chest is worth the detour, a searched one says when it refills
function cacheLabel(c){if(S.t<c.ready){const s=Math.ceil(c.ready-S.t);return'Ruins: chest refills in '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}return'Ruins: chest ready (gold, crystals, a kit)'}
function searchCache(h,c){if(!h.hero||h.dead||h.job||h.mode!=='ground'||!c||dist(h,c)>=160)return false;
  if(S.t<c.ready){sayTo(h,'Someone has searched here lately. Come back in '+Math.ceil(c.ready-S.t)+' s.');return false}
  c.ready=S.t+C.CACHE_REFILL;if(rnd()<.5){const t=nearestOwn(h.town,c.x,c.y);if(t)startRaid(t,'Beasts stir in the robbed ruin and march on '+t.name+'!',c)}const gold=50+Math.floor(rnd()*70),cr=2+Math.floor(rnd()*4),kits=['anchor','wedge','brace','cannon'],k=kits[Math.floor(rnd()*4)];
  h.gold+=gold;packAdd(h,'crystals',cr);h.kits[k]+=k==='anchor'?3:1;gainXp(h,25);questTick(h,'search');sfx('coin',h.you);
  sayTo(h,'In the old giant\u2019s ribs: '+gold+' gold, '+cr+' sky crystals and a '+k+' kit.');if(h.you&&!h.ruinCharm&&rnd()<.25){h.ruinCharm=1;giveCharm(h)}return true}
