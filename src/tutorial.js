'use strict';
// Colossus · src/tutorial.js · the guided first day and the camera flight
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// The first day, as open chapters (owner: "too linear and fast; it should be more exploratory"). A short guided morning
// (one crystal, brought home), then three chapters whose goals are done in any order: The land, Your town, The giant
// (giant actions last, the owner's rule). Some goals are open from the chapter's start; others appear when you meet
// what they are about (your first fight, your first shrine, level 2). Exploration goals are found by landmark lights,
// not map pins. No handouts: you earn the gold and crystals; if you are stuck for 3 minutes the elders lend the gap.
// One table drives the journal, the marks, the hints and the checks (GPTBS demo-disc#E51).
const CHAPTERS=[
  {name:'Morning',story:'On the first day the sky opened over the three towns. A sky crystal glows just outside Ashville: bring it home.',need:1},
  {name:'The land',story:'The land around Ashville is yours to learn. The Board has a job for you; beyond the walls lie shrines, springs and old stones. Wander. The chained giant sleeps at the heart of the land: its day comes last.',need:4,req:['job'],rule:'The job, a shrine, a spring or the stones, and 3 places found open the next chapter, in any order.'},
  {name:'Your town',story:'Ashville can grow with you. Earn the gold for a house, a barracks, a horse: choose what you build first.',need:4,rule:'Any 4 of the 5 building and buying goals open the next chapter.'},
  {name:'The giant',story:'Now the giant. Its chains hold it at the heart of the land. Go to its feet.',need:99}];
const tutBase=(h,k,v)=>{const b=S.tut.base;if(!(k in b))b[k]=v;return b[k]};
const placeSeen=(h,ks)=>(S.pois||[]).filter(p=>ks.includes(p.k)&&p.found).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0]||null;
const FIRST_DAY=[
  {id:'crystal',ch:0,start:true,get name(){const h=S.you;return h&&h.pack.crystals>tutBase(h,'pack0',0)?'Bank the crystal in Ashville':'Pick up the glowing crystal'},
   hint:'Sky crystals glow blue across the land. Walk into one to pick it up, then walk home to bank it.',
   setup(h){const t=S.towns[h.town];if(!S.crystals.some(c=>c.tut)){let a=rnd()*6.28;for(let k=0;k<12&&inSolid(t.x+Math.cos(a)*520,t.y+Math.sin(a)*520,60);k++)a+=.5;S.crystals.push({id:S.nextId++,x:t.x+Math.cos(a)*520,y:t.y+Math.sin(a)*520,tut:1})}tutBase(h,'cr',h.crystals);tutBase(h,'pack0',h.pack.crystals)},
   target(h){const own=S.crystals.find(c=>c.tut);return own&&h.pack.crystals<=tutBase(h,'pack0',0)?own:S.towns[h.town]},check(h){return h.crystals>tutBase(h,'cr',0)}},
  // 1 · the land
  {id:'job',ch:1,start:true,req:true,get name(){const q=S.you&&S.you.quest;return q&&q.tut?(q.done?'Collect your pay in Ashville':'Slay the wolves'):'Take the job on the Board'},
   hint:'In Ashville press Town and take the job on the Board. Jobs pay when you come home.',
   setup(h){tutBase(h,'claimed',h.claimed||0)},target(h){const q=h.quest;return q&&q.tut&&!q.done?tutWolfNear(h):S.towns[h.town]},count:tutCount,check(h){return(h.claimed||0)>tutBase(h,'claimed',0)}},
  {id:'dodge',ch:1,lesson:true,appear:h=>tutFight(h),name:'Dodge a lunge',get hint(){return'A red ring shrinking under you means a beast will lunge. Dodge ('+dodgeName()+') or step out of it.'},
   setup(h){tutBase(h,'dodged',h.dodgedN||0);tutBase(h,'lunges',h.lunges||0)},check(h){return(h.dodgedN||0)>tutBase(h,'dodged',0)||(h.lunges||0)-tutBase(h,'lunges',0)>=3}},
  {id:'heavy',ch:1,lesson:true,appear:h=>tutFight(h),name:'Win with a heavy blow',hint:'Hold Attack until its ring fills, then let go: a heavy blow hits two and a half times as hard.',
   setup(h){tutBase(h,'heavy',h.heavyKills||0)},check(h){return(h.heavyKills||0)>tutBase(h,'heavy',0)}},
  {id:'shrine',ch:1,start:true,get name(){return S.you&&placeSeen(S.you,['shrine'])?'Pray at the shrine':'Find a shrine and pray'},hint:'Shrines stand in the wilds under soft lights. Beside one, press the action button to pray for a two-minute blessing.',
   setup(h){tutBase(h,'pray',(h.stat&&h.stat.pray)||0)},target:h=>placeSeen(h,['shrine']),check(h){return((h.stat&&h.stat.pray)||0)>tutBase(h,'pray',0)}},
  {id:'rest',ch:1,start:true,get name(){return S.you&&placeSeen(S.you,['spring','stones'])?'Soak in the spring or read the stones':'Find a hot spring or standing stones'},hint:'Hot springs give 10 more health the first time; standing stones tell the old tales.',
   setup(h){tutBase(h,'lore',(h.stat&&h.stat.lore)||0)},target:h=>placeSeen(h,['spring','stones']),check(h){return((h.stat&&h.stat.lore)||0)>tutBase(h,'lore',0)||(S.pois||[]).some(p=>p.k==='spring'&&(p.used||{})[h.id])}},
  {id:'discover',ch:1,start:true,name:'Discover 3 places',hint:'Places appear on your map once you come near them. Soft lights over the land mark ones you have not found.',
   count:h=>Math.min(3,tutFound()-tutBase(h,'found0',0))+'/3',check(h){return tutFound()-tutBase(h,'found0',0)>=3}},
  {id:'talent',ch:1,lesson:true,appear:h=>h.lvl>=2,name:'Choose a talent',hint:'You reached level 2: press T and choose one of three talents.',check(h){return Object.keys(h.perks||{}).length>0}},
  // 2 · your town
  {id:'house',ch:2,start:true,name:'Build a house',hint:'Inside the dashed ring, press Build and choose House (40 gold).',cost:()=>C.COST.house,
   target(h){const t=S.towns[h.town];return{x:t.x+t.r+170,y:t.y+40}},check(h){return S.builds.some(b=>b.owner===h.id&&b.k==='house')}},
  {id:'barracks',ch:2,start:true,name:'Build a barracks',hint:'Press Build and choose Barracks (60 gold): soldiers fight for you.',cost:()=>C.COST.barracks,
   target(h){const t=S.towns[h.town];return{x:t.x-t.r-150,y:t.y+40}},check(h){return!!tutBarracks(h)}},
  {id:'horse',ch:2,start:true,name:'Buy a horse and ride',hint:'The shop in town sells horses (80 gold). Press R to ride.',cost:()=>C.HORSE_COST,target:h=>h.horse?null:S.towns[h.town],check(h){return!!h.rodeOnce}},
  {id:'raise',ch:2,appear:h=>S.builds.some(b=>b.owner===h.id&&b.k==='house'),name:'Raise your house',hint:'With 3 sky crystals, stand by your house and press Upgrade.',
   target(h){return S.builds.find(b=>b.owner===h.id&&b.k==='house')},check(h){return S.builds.some(b=>b.owner===h.id&&b.k==='house'&&lv(b)>1)}},
  {id:'soldier',ch:2,appear:h=>!!tutBarracks(h),name:'Train a soldier',hint:'Beside your barracks, press Barracks, then Train a soldier (30 gold).',cost:()=>ARMY.SOLDIER,
   setup(h){tutBase(h,'trained',h.trained||0)},target:h=>tutBarracks(h),check(h){const b=tutBarracks(h);return(h.trained||0)>tutBase(h,'trained',0)&&!!b&&b.sol.length>0}},
  {id:'map',ch:2,lesson:true,start:true,name:'Find Brindle and Corvel on the map',hint:'Press M for the full map. Brindle (orange square) tends the giant; Corvel (purple diamond) hunts it.',check(){return!!S.tut.mapOpened}},
  // 3 · the giant
  {id:'order',ch:3,start:true,only:h=>!!tutBarracks(h),name:'Send your soldiers to the giant',hint:'At your barracks (or B from anywhere) choose Defend giant: your soldiers guard its foot.',target:h=>tutBarracks(h),check(h){return tutBarracks(h)?.order?.k==='giant'}},
  {id:'chain',ch:3,start:true,name:'Strike an ankle chain',hint:'Follow the road to the giant’s feet and press Attack beside an ankle chain: every blow wears it.',
   setup(h){tutBase(h,'chain',h.chainHits||0)},target(h){const ch=tutChain(h);if(!ch)return null;const a=bodyWorld(ch.c+.5,ch.r+.5);return{x:a.x,y:a.y,z:a.z}},check(h){return(h.chainHits||0)>tutBase(h,'chain',0)||!tutChain(h)}},
  {id:'climb',ch:3,appear:h=>tutDone('chain'),name:'Climb the giant',hint:'Beside the planted foot, press Climb.',target(h){const f=S.g.feet[0];return{x:f.x,y:f.y}},check(h){return h.mode==='climb'}},
  {id:'knee',ch:3,appear:h=>tutDone('climb'),name:'Reach the knee ledge',hint:'Climb to the knee ledge, 460 feet up. Rest on ledges to refill your grip; if nothing is in reach, lunge.',
   target(h){return bodyWorld(h.leg?21.5:9.5,46.5,h.cl?.face)},check(h){return h.cl&&h.cl.y>=46}}];
const tutGoal=id=>FIRST_DAY.find(g=>g.id===id);
function tutActive(){return!!(S&&S.tut&&!S.tut.done)}
function tutChapter(){return tutActive()?S.tut.ch:99}
function tutOpen(id){return tutActive()&&!!S.tut.open[id]&&!S.tut.done_[id]}
function tutDone(id){return!!(S&&S.tut&&S.tut.done_&&S.tut.done_[id])}
function tutFound(){return(S.pois||[]).filter(p=>p.found&&['shrine','spring','stones','camp'].includes(p.k)).length}
function tutFight(h){return S.monsters.some(m=>Math.hypot(m.x-h.x,m.y-h.y)<260&&(m.tut||m.eng===h.id))}
function tutProtect(){return tutActive()&&!S.tut.fought&&!(S.you&&S.you.quest&&S.you.quest.tut)}
function tutNewDay(){return{ch:0,open:{},done_:{},base:{},track:null,chT:0,lastProgress:0,lent:{},cardDue:false,fought:false,mapOpened:false,done:false}}
// open goals in the current chapter (and earlier chapters' unfinished ones, now optional)
function tutGoals(){if(!tutActive())return[];return FIRST_DAY.filter(g=>S.tut.open[g.id]&&!S.tut.done_[g.id])}
function tutTracked(){if(!tutActive()||!S.you)return null;const h=S.you,gs=tutGoals().filter(g=>g.target&&g.target(h));const t=gs.find(g=>g.id===S.tut.track);if(t)return t;
  const req=gs.find(g=>g.req||g.ch===S.tut.ch&&g.ch!==1);if(req)return req;let b=null,bd=1e9;for(const g of gs){const p=g.target(h);const d=Math.hypot(p.x-h.x,p.y-h.y);if(d<bd){bd=d;b=g}}return b}
function tutStep(){return tutTracked()}
function tutCycle(){const h=S.you,gs=tutGoals().filter(g=>g.target&&g.target(h));if(!gs.length)return;const i=gs.findIndex(g=>g===tutTracked()),n=gs[(i+1)%gs.length];S.tut.track=n.id;toast('The light follows: '+n.name+'.')}
function tutOpenGoal(g,h,quiet){if(S.tut.open[g.id]||g.only&&!g.only(h))return;S.tut.open[g.id]=S.t;if(g.setup)g.setup(h);if(!quiet&&!S.headless){toast('New goal: '+g.name+'. '+g.hint)}}
function tutOpenChapter(ch,h){S.tut.ch=ch;S.tut.chT=S.t;S.tut.lastProgress=S.t;if(ch===1)tutBase(h,'found0',tutFound());for(const g of FIRST_DAY)if(g.ch===ch&&g.start)tutOpenGoal(g,h,true);S.tut.cardDue=true}
function tutChapterDone(ch){const C2=CHAPTERS[ch],gs=FIRST_DAY.filter(g=>g.ch===ch&&!g.lesson),n=gs.filter(g=>S.tut.done_[g.id]).length;return(C2.req||[]).every(id=>S.tut.done_[id])&&n>=C2.need}
function tutFinish(){S.tut.done=true;save.firstDay=1;persist();const h=S.you;if(h&&h.quest&&h.quest.tut&&!h.quest.done)h.quest=null;for(const m of S.monsters)if(m.tut)m.tut=0;if(!S.headless)announce('The first day is done. The rest is yours.')}
function stepTutorial(dt){if(!tutActive())return;const h=S.you;if(!h||h.dead||S.t<OPENING.len+1)return;const T=S.tut;
  if(!T.chT&&!T.open.crystal)tutOpenChapter(0,h);
  if(h.quest&&h.quest.tut)T.fought=true;
  if(tutOpen('job')&&S.t%2<dt)tutWolves(h);
  // goals that appear when you meet what they are about (this chapter and earlier ones)
  for(const g of FIRST_DAY)if(g.ch<=T.ch&&g.ch>0&&!T.open[g.id]&&g.appear&&g.appear(h))tutOpenGoal(g,h);
  for(const g of tutGoals())if(g.check(h)){T.done_[g.id]=S.t;T.lastProgress=S.t;if(!S.headless){sfx('coin');toast('Goal done: '+g.name.replace(/^./,c=>c.toUpperCase())+'.')}if(T.track===g.id)T.track=null}
  if(T.done_.knee){tutFinish();return}
  if(tutChapterDone(T.ch)&&T.ch<3)tutOpenChapter(T.ch+1,h);
  // stuck: 3 minutes without progress and the cheapest open building goal out of reach: the elders lend the gap, once a chapter
  if(S.t-T.lastProgress>180&&!T.lent[T.ch]){const costs=tutGoals().filter(g=>g.cost).map(g=>g.cost()).sort((a,b)=>a-b);if(costs.length&&h.gold<costs[0]){const gap=costs[0]-h.gold;h.gold+=gap;T.lent[T.ch]=gap;T.lastProgress=S.t;if(!S.headless)announce(TOWNS[h.town].name+'’s elders lend you '+gap+' gold to build with.')}}}
function tutCount(h){const q=h.quest;return q&&q.tut&&!q.done?Math.min(q.n,q.need)+'/'+q.need:''}
function tutWolfNear(h){const t=S.towns[h.town];let b=null,bd=1e9;for(const m of S.monsters)if(m.tut){const d=Math.hypot(m.x-h.x,m.y-h.y);if(d<bd){bd=d;b=m}}return b||t}
function tutBarracks(h){return S.builds.find(b=>b.k==='barracks'&&b.owner===h.id&&b.town===h.town)||null}
function tutRival(h){return aliveTowns().find(t=>t.i!==h.town&&!t.outpost)}
// leave the first recruit for the player's training lesson
function tutHoldsTraining(b){return playerBuilt(b)&&tutActive()&&!tutDone('soldier')}
// the ankle chain to teach on: the one on your leg
function tutChain(h){const me=h.cl?h.cl.x:h.leg?22:9,a=S.chains.slice(0,2).filter(c=>c.hp>0).sort((p,q)=>Math.abs(p.c-me)-Math.abs(q.c-me));return a[0]||null}
function tutJob(){return tutOpen('job')&&!(S.you&&S.you.quest&&S.you.quest.tut)}
function tutWolves(h){const t=S.towns[h.town],q=h.quest,want=q&&q.tut&&!q.done?q.need-q.n:0;let have=S.monsters.filter(m=>m.tut).length;
  for(;have<want;have++){const a=rnd()*6.28,d=t.r+380+rnd()*220,x=clamp(t.x+Math.cos(a)*d,100,C.MAP-100),y=clamp(t.y+Math.sin(a)*d,100,C.MAP-100);
    S.monsters.push({id:S.nextId++,kind:'wolf',x,y,hx:x,hy:y,hp:30,max:30,atk:5,gold:8,xp:12,r:13,cd:0,tut:1})}}
// landmark lights in the land chapter: soft pillars over undiscovered shrines, springs and stones near you
function tutLandmarks(){if(!tutActive()||S.tut.ch!==1||!S.you)return[];const h=S.you,d=p=>Math.hypot(p.x-h.x,p.y-h.y),L=(S.pois||[]).filter(p=>!p.found&&['shrine','spring','stones'].includes(p.k)).sort((a,b)=>d(a)-d(b));return L.filter((p,i)=>i<3||d(p)<3500)}
// one card per chapter: its story and the goals open at its start; with "Got it" remembered (save.noFly) a toast instead
function openTutorialCard(){if(!tutActive())return;const T=S.tut,C2=CHAPTERS[T.ch],h=S.you;T.cardDue=false;const gs=FIRST_DAY.filter(g=>g.ch===T.ch&&T.open[g.id]);
  const list=gs.map(g=>'○ '+g.name+(g.req?' (needed)':'')).join('<br>'),more=T.ch>0&&T.ch<3?'<p class="dim">More goals appear as you explore. '+C2.rule+'</p>':'';
  if(save.noFly){if(!S.headless)announce((T.ch?'Chapter '+T.ch+': ':'')+C2.name+'. '+C2.story);return}
  openMenu({holdUntil:performance.now()+700,title:'The first day · '+(T.ch?'Chapter '+T.ch+': ':'')+C2.name,body:`<p>${C2.story}</p><p>${list}</p>${more}`,
    items:[{label:'Got it',sub:'Goals stay in the journal on the right; N switches which one the light follows',act:()=>{closeMenu()}},{label:'Got it, and no more cards',sub:'Later chapters open with a message instead',act:()=>{closeMenu();save.noFly=1;persist()}},
      ...(T.ch===0?[{label:'Skip the first day',act:()=>{closeMenu();tutFinish()}}]:[])],back:()=>closeMenu()})}
// the camera's flight to a goal and back: sized from the distance, a floor and a cap, the return quicker
function startFly(tg){const d=Math.hypot(tg.x-S.you.x,tg.y-S.you.y),dur=Math.min(2.4,1.2+d/2000);S.fly={phase:'out',t:0,dur,to:{x:tg.x,y:tg.y}};latchHeld()}
function flyPress(){const f=S.fly;if(!f)return;if(f.phase==='out'){f.phase='back';f.t=f.dur*.7*(1-Math.min(1,f.t/f.dur));f.dur*=.7}else if(f.phase==='hold'){f.phase='back';f.t=0;f.dur*=.7}}
function stepFly(dt){const f=S.fly;if(!f)return null;f.t+=dt;const e=u=>u<0?0:u>1?1:u*u*(3-2*u);let k;
  if(f.phase==='out'){k=e(f.t/f.dur);if(f.t>=f.dur){f.phase='hold';f.t=0}}else if(f.phase==='hold')k=1;else{k=1-e(f.t/f.dur);if(f.t>=f.dur){S.fly=null;latchHeld();return null}}
  const fr=S.you;return{x:fr.x+(f.to.x-fr.x)*k,y:fr.y+(f.to.y-fr.y)*k,k}}
