'use strict';
// Colossus · src/rpg/quests.js · board jobs, bounties, the elders' tale and the Rim Warlord, goal targets
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

const QUEST_KINDS=['slay','gather','deliver','build','search','troll','camp','bounty','escort','pray','caravan'];
// quests that send you out to the places in the world: clear a camp, hunt a named alpha (bounty), walk a lost traveller home,
// pray at two shrines; each carries a map target so the goal beacon and the map ring point the way
function liveAlphas(){return S.monsters.filter(m=>m.elite&&!m.champion&&!m.warlord)}
function newQuest(h,kind){const lv=h.lvl,side=S&&S.you===h&&huntOpen()&&tends(h),k=kind||((lv>=3||side)&&rnd()<(side?.4:.3)?(rnd()<(side?.3:.5)?'climb':'tend'):QUEST_KINDS[Math.floor(rnd()*QUEST_KINDS.length)]);
  if(k==='slay')return{k,need:2+lv,n:0,gold:30+lv*12,xp:30+lv*10,text:'Slay '+(2+lv)+' beasts in the wilds'};
  if(k==='gather')return{k,need:2+Math.ceil(lv/2),n:0,gold:25+lv*12,xp:25+lv*10,text:'Fetch '+(2+Math.ceil(lv/2))+' sky crystals'};
  if(k==='deliver'){const home=homeOf(h),far=aliveTowns().filter(t=>t!==home);const to=far.length?far[Math.floor(rnd()*far.length)]:home;
    return{k,to:to.id,need:1,n:0,gold:30+lv*10+Math.round(dist(home||to,to)/150),xp:25+lv*10,text:'Carry a parcel to '+to.name}}
  if(k==='build'){const w=rnd()<.6?'house':'tower';return{k,what:w,need:1,n:0,gold:C.COST[w]+20+lv*8,xp:30+lv*8,text:'Build a '+(w==='house'?'house':'watchtower')+' near home'}}
  if(k==='search')return{k,need:1,n:0,gold:40+lv*12,xp:40+lv*10,text:'Search the ruins of an old giant'};
  if(k==='camp'&&(S.pois||[]).some(p=>p.k==='camp'))return{k,need:1,n:0,gold:50+lv*14,xp:45+lv*10,text:'Clear a beast camp and open its chest'};
  if(k==='bounty'&&liveAlphas().length){const a=liveAlphas()[Math.floor(rnd()*liveAlphas().length)];return{k,elite:a.elite,need:1,n:0,gold:90+lv*20,xp:70+lv*12,text:'Bounty: slay '+a.elite+', the alpha'}}
  if(k==='escort')return{k,need:1,n:0,gold:35+lv*10,xp:30+lv*8,text:'Walk a lost traveller to one of your towns'};
  if(k==='pray'&&(S.pois||[]).some(p=>p.k==='shrine'))return{k,need:2,n:0,gold:30+lv*10,xp:30+lv*8,text:'Pray at two shrines'};
  if(k==='caravan'){const car=S.events.find(e=>e.k==='caravan'&&e.i===h.town&&!e.site);if(car)return{k,car:car.t,need:1,n:0,gold:60+lv*12,xp:45+lv*10,text:'Guard '+TOWNS[h.town].name+'\u2019s caravan to the end of its road'}}
  if(['camp','bounty','escort','pray','caravan'].includes(k))return newQuest(h,'slay');
  if(k==='troll')return{k,need:1,n:0,gold:45+lv*14,xp:45+lv*12,text:'Kill a troll at the old giants'};
  if(k==='tend')return{k,need:6,n:0,gold:50+lv*12,xp:40+lv*10,text:'Tend the giant\u2019s wounds (Tend a hurt joint, or pull a wedge)'};
  const ft=Math.min(1500,300+lv*200);return{k:'climb',need:ft/FT,n:0,gold:35+lv*14,xp:35+lv*12,text:'Climb the giant to '+ft+' ft'}}
// the saga: a short chain from the elders, offered after your third job, ending at a warlord on the rim
const SAGA=[{k:'lore',need:2,text:'The elders\u2019 tale: read two standing stones',gold:40,xp:40},
  {k:'camp',need:1,text:'The elders\u2019 tale: break a beast camp',gold:60,xp:50},
  {k:'bounty',need:1,text:'The elders\u2019 tale: slay any alpha',gold:80,xp:60},
  {k:'warlord',need:1,text:'The elders\u2019 tale: slay the Rim Warlord',gold:300,xp:200,start:h=>spawnWarlord(h)}];
function sagaTick(h,k,v){const g=h.saga;if(!g||g.done)return;const st=SAGA[g.i];if(!st||st.k!==k)return;g.n=(g.n||0)+1;sagaDone(h)}
function sagaDone(h){const g=h.saga;if(!g||g.done)return;const st=SAGA[g.i];if(!st||(g.n||0)<st.need)return;
  h.gold+=st.gold;gainXp(h,st.xp);g.i++;g.n=0;if(h.you){announce('Tale step done: +'+st.gold+' gold.'+(SAGA[g.i]?' Next: '+SAGA[g.i].text.replace(/^The elders\u2019 tale: /,'')+'.':''));sfx('coin')}
  if(!SAGA[g.i]){g.done=true;h.picks=(h.picks||0)+1;h.atk+=5;if(h.you)announce('The tale is told. The towns sing of you: +5 damage and a talent (T).')}else if(SAGA[g.i].start)SAGA[g.i].start(h)}
function spawnWarlord(h){const M=C.MAP,R=mulberry32((S.seed^0xBADA55)>>>0);let x=M/2,y=M/2;for(let k=0;k<80;k++){x=800+R()*(M-1600);y=800+R()*(M-1600);if(!inSolid(x,y,100)&&S.towns.every(t=>Math.hypot(t.x-x,t.y-y)>2200)&&Math.hypot(S.g.x-x,S.g.y-y)>1500)break}
  S.monsters.push({id:S.nextId++,kind:'troll',x,y,hx:x,hy:y,hp:520,max:520,atk:22,gold:120,xp:150,r:30,cd:0,elite:'The Rim Warlord',warlord:1});
  for(let k=0;k<3;k++)S.monsters.push({id:S.nextId++,kind:'wolf',x:x+rr(-120,120),y:y+rr(-120,120),hx:x,hy:y,hp:45,max:45,atk:8,gold:10,xp:14,r:13,cd:0});
  if(h.you)announce('The Rim Warlord has come down from the rim. Find it (marked on your map).')}
function goalTarget(){const st=tutStep();if(st&&S.tut.shown&&S.you)return st.target(S.you);return questTarget(S.you)}
function questTarget(h){if(!h)return null;const near=xs=>xs.sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0]||null;
  const g=h.saga&&!h.saga.done&&SAGA[h.saga.i],q=h.quest&&!h.quest.done?h.quest:null,k=q?q.k:g?g.k:null;
  if(!k){const p=h.aimPoi;return p&&(S.pois.includes(p)||p.golden&&!p.dead)&&Math.hypot(p.x-h.x,p.y-h.y)>140?{x:p.x,y:p.y}:null}
  if(k==='warlord'){const w=S.monsters.find(m=>m.warlord);return w?{x:w.x,y:w.y}:null}
  if(k==='bounty'){const a=S.monsters.find(m=>m.elite&&!m.champion&&(!q||q.k!=='bounty'||(m.baseName||m.elite)===q.elite));return a?{x:a.x,y:a.y}:null}
  if(k==='caravan'){const car=S.events.find(e=>e.k==='caravan'&&e.t===q.car);return car?{x:car.x,y:car.y}:null}
  if(k==='camp')return near((S.pois||[]).filter(p=>p.k==='camp'&&campBeasts(p).length));
  if(k==='pray')return near((S.pois||[]).filter(p=>p.k==='shrine'&&S.t>=p.ready));
  if(k==='lore')return near((S.pois||[]).filter(p=>p.k==='stones'&&!(h.lore||{})[p.lore]));
  if(k==='escort'){const f=(S.pois||[]).find(p=>p.k==='traveller'&&p.follow===h.id);if(f){const t=nearestOwn(h.town,h.x,h.y);return t?{x:t.x,y:t.y}:null}return near((S.pois||[]).filter(p=>p.k==='traveller'))}
  return null}
function freshQuest(h,shown){for(let k=0;k<20;k++){const q=newQuest(h);if(!shown.some(o=>o.k===q.k))return q}return newQuest(h)}
function board(t){const h=S.you||S.humans[0];if(!t.board||S.t-t.boardT>60){t.boardT=S.t;t.board=[];for(let i=0;i<3;i++)t.board.push(freshQuest(h,t.board.concat(h.quest?[h.quest]:[])))}return t.board}
function questTick(h,k,v){sagaTick(h,k,v);(h.stat=h.stat||{})[k]=(h.stat[k]||0)+1;const q=h.quest;if(!q||q.done)return;if(q.k==='bounty'&&k==='bounty'&&v!==q.elite)return;
  if(q.k==='climb'&&k==='height'){if(v>=q.need){q.n=q.need}else return}else if(q.k==='deliver'&&k==='arrive'){if(v!==q.to)return;q.n=1}else if(q.k===k)q.n+=(k==='tend'&&v)?v:1;else return;
  if(q.n>=q.need){q.done=true;sayTo(h,'Quest done! Return to town for '+q.gold+' gold.')}}
