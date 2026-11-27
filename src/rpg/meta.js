'use strict';
// Colossus · src/rpg/meta.js · today's goals, first-time hints, renown, What's new
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// this match's three goals for you (drawn from the seed), each worth 5 renown: a short reason to try something new each day
const GOALS=[{id:'camp',t:'Break a camp',n:1,k:'camp'},{id:'alpha',t:'Slay a named alpha or chief',n:1,k:'bounty'},{id:'hunt',t:'Hunt 3 deer',n:3,k:'hunt'},{id:'pray',t:'Pray at 2 shrines',n:2,k:'pray'},
  {id:'lore',t:'Read 2 standing stones',n:2,k:'lore'},{id:'escort',t:'Walk a traveller home',n:1,k:'escort'},{id:'lvl',t:'Reach level 5',n:5,f:h=>h.lvl},{id:'perfect',t:'Make 3 perfect dodges',n:3,f:h=>h.perfects||0},
  {id:'civic',t:'Build 2 town buildings',n:2,k:'civic'},{id:'charm',t:'Find a charm',n:1,k:'charm'}];
function matchGoals(){if(!S.goals){const R=mulberry32((S.seed^0x60A1)>>>0),pool=GOALS.slice(),g=[];while(g.length<3)g.push(pool.splice(Math.floor(R()*pool.length),1)[0]);S.goals=g.map(x=>({...x,done:false}))}return S.goals}
const goalProg=(h,g)=>Math.min(g.n,g.f?g.f(h):(h.stat&&h.stat[g.k])||0);
function stepGoals(){const h=S.you;if(!h||S.role!=='human'||S.t%1>C.DT*1.5)return;for(const g of matchGoals())if(!g.done&&goalProg(h,g)>=g.n){g.done=true;if(!S.headless){announce('Goal done: '+g.t+' (+5 renown).');sfx('coin')}}}
// first-time hints for the human side, each told once ever, when the thing is right there (like the giant's lessons)
function humanHints(){const h=S.you;if(!h||S.headless||S.role!=='human'||S.tut||h.dead||S.t%1>C.DT*1.5||S.t<OPENING.len+8)return;const seen=save.hhint=save.hhint||{},X=device==='pad'?'X':device==='touch'?'the top-left button':'L';
  const say=(id,text)=>{if(seen[id]||S.hintAt>S.t-8)return;seen[id]=1;S.hintAt=S.t;persist();toast(text)};const near=(k,r)=>(S.pois||[]).some(p=>p.k===k&&Math.hypot(p.x-h.x,p.y-h.y)<r);
  say('map','Press M for the full map with every town, shrine, camp and spring.');
  if(near('shrine',350))say('shrine','A shrine: press '+X+' beside it to pray for a two-minute blessing.');
  if(near('camp',700))say('camp','A camp: its named leader and pack guard a chest. Beat them, then press '+X+' at the chest. Charms drop from leaders.');
  if(near('spring',350))say('spring','A hot spring: soak ('+X+') for 10 more most health, once per spring.');
  if(near('stones',350))say('stones','Standing stones: read them ('+X+') for lore; read all four for a free talent.');
  if((S.critters||[]).some(c=>!c.dead&&Math.hypot(c.x-h.x,c.y-h.y)<450))say('deer','Deer: get close and attack for a pelt. Pelts become hides at home for crafting at the Forge.');
  if(h.picks>0)say('talent','You can choose a talent: press T.');if(h.lvl>=2)say('skills','Skills on 1-4 unlock as you level: watch the bar at the bottom.');
  if(h.gold>=C.HORSE_COST&&!h.horse)say('horse','You can afford a horse in town ('+C.HORSE_COST+' gold): R to ride.');if(h.horse)say('ride','R mounts and dismounts. Riding blows hit harder; hard hits throw you.')}
// renown: what a human match earns toward lasting starting perks, bought on the title screen (a light roguelite layer)
const RENOWN=[{id:'purse',n:'A full purse',t:'Start with 60 more gold',c:15},{id:'seasoned',n:'Seasoned',t:'Start at level 2 with a talent to choose',c:20},
  {id:'mare',n:'An old mare',t:'Start with a horse',c:25},{id:'heirloom',n:'An heirloom',t:'Start wearing a random charm',c:30},{id:'pockets',n:'Wide pockets',t:'One more charm slot',c:40}];
function applyRenown(h){const u=save.unlocks||{};if(u.purse)h.gold+=60;if(u.seasoned)gainXp(h,50);if(u.mare)h.horse={hp:C.HORSE_HP,max:C.HORSE_HP};if(u.pockets)h.extraSlot=1;if(u.heirloom){const quiet=h.you;h.you=false;giveCharm(h);h.you=quiet}}
function renownEarned(h,o){if(!h)return null;const camps=h.campsBroken||0,tale=h.saga?h.saga.i+(h.saga.done?1:0):0,ch=(h.charms||[]).length+(h.bag||[]).length,win=o&&!o.giantWon&&S.favoredH===h.id?10:0;
  const gd=(S.goals||[]).filter(g=>g.done).length;return{n:2*h.lvl+3*camps+4*tale+ch+win+5*gd,parts:(gd?'goals '+gd+'/3 (+'+5*gd+'), ':'')+'level '+h.lvl+' (+'+2*h.lvl+'), camps '+camps+' (+'+3*camps+'), tale steps '+tale+' (+'+4*tale+'), charms '+ch+' (+'+ch+')'+(win?', honoured by the giant (+10)':'')}}
function openNews(){openMenu({title:'What\u2019s new',body:`<p><b>Your hero.</b> Pick a talent each level (T), with a reroll. Skills on 1\u20135: War cry, Whirlwind, Mend, Spear, and Earthshaker at level 7 (click the bar too). Charms from leaders, chests and the merchant. I shows your hero. Three-hit combos, crits, and perfect dodges (dodge just before a blow lands).</p>
<p><b>Horses and hounds.</b> Buy a horse in town and ride with R; ride through beasts to trample them. A stable sells hounds that fight beside you.</p>
<p><b>The land.</b> Shrines, hot springs, standing stones, herbs, deer, beast and bandit camps with named leaders, lost travellers, a wandering merchant, treasure maps. World events every few minutes: an ambush, a golden stag, a champion's duel. M opens the full map; places appear on it once you discover them.</p>
<p><b>Jobs.</b> Bounties, camps, escorts and prayers on the Board; the elders\u2019 tale ends at the Rim Warlord. Three goals each match.</p>
<p><b>Towns.</b> Farms, a market, smithy, stable and well; prosperity raises rent and brings festivals. Only heroes found outposts: settlers walk there from your first town. The Forge crafts from hides.</p>
<p><b>Renown.</b> Every match earns renown for lasting perks (title screen).</p>`,items:[{label:'Back',act:openTitle}],back:openTitle})}
function openRenown(){const pts=save.renown||0,u=save.unlocks||{};openMenu({title:'Renown \u00b7 '+pts,body:'<p class="dim">Every match as a human earns renown: levels, camps broken, steps of the elders\u2019 tale, charms found, and the giant\u2019s honour. Spend it on perks you keep for every match.</p>',
  items:[...RENOWN.map(r=>({label:(u[r.id]?'\u2713 ':'')+r.n+(u[r.id]?'':' \u2013 '+r.c+' renown'),sub:r.t,why:u[r.id]?'Yours':pts<r.c?'Need '+(r.c-pts)+' more':null,act:()=>{save.renown=pts-r.c;save.unlocks={...u,[r.id]:1};persist();sfx('coin');openRenown()}})),{label:'Back',act:openTitle}],back:openTitle})}
