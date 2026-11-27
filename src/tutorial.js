'use strict';
// Colossus · src/tutorial.js · the guided first day and the camera flight
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

const FIRST_DAY=[
  // each step: a side name of a few words (the goal line), and a card of one idea in at most two sentences
  {id:'crystal',name:'Pick up a crystal',text:'Sky crystals glow blue across the land. Walk into one to pick it up.',
   setup(h){const t=S.towns[h.town];if(!S.crystals.some(c=>c.tut)){let a=rnd()*6.28;for(let k=0;k<12&&inSolid(t.x+Math.cos(a)*520,t.y+Math.sin(a)*520,60);k++)a+=.5;S.crystals.push({id:S.nextId++,x:t.x+Math.cos(a)*520,y:t.y+Math.sin(a)*520,tut:1})}S.tut.base=h.pack.crystals+h.crystals}, // the player's own crystal: bots leave it
   target(h){const t=S.towns[h.town];const own=S.crystals.find(c=>c.tut);if(own)return own;let b=null,bd=1e9;for(const c of S.crystals){const d=Math.hypot(c.x-h.x,c.y-h.y)+.5*Math.hypot(c.x-t.x,c.y-t.y);if(d<bd){bd=d;b=c}}return b},
   check(h){return h.pack.crystals+h.crystals>S.tut.base}},
  {id:'home',name:'Bank it in Ashville',text:'Walk home into Ashville. Your pack’s crystals go into your own store.',target(h){return S.towns[h.town]},check(h){return h.crystals>=1&&!h.pack.crystals}},
  {id:'board',name:'Take the job',text:'In Ashville, press Town and take the job on the Board.',setup(h){if(h.quest&&!h.quest.tut)h.quest=null},target(h){return S.towns[h.town]},check(h){return!!(h.quest&&h.quest.tut)}},
  {id:'strike',name:'Strike down a wolf',text:'Walk up to a wolf and press Attack. It hits the weakest beast in reach.',
   setup(h){tutWolves(h)},target:tutWolfNear,note:tutCount,check(h){const q=h.quest;return!q||!q.tut||q.n>=1},hold:true},
  {id:'dodge',name:'Dodge a lunge',get text(){return'A red ring shrinking under you means a wolf will lunge. Dodge ('+dodgeName()+') or step out of it.'},
   setup(h){tutWolves(h);S.tut.base=h.dodgedN||0;S.tut.base2=h.lunges||0},target:tutWolfNear,check(h){return(h.dodgedN||0)>S.tut.base||(h.lunges||0)-S.tut.base2>=3}},
  {id:'heavy',name:'A heavy blow',text:'Hold Attack until its ring fills, then let go. A heavy blow hits two and a half times as hard.',
   setup(h){tutWolves(h);S.tut.base=h.heavyKills||0},target:tutWolfNear,check(h){return(h.heavyKills||0)>S.tut.base}},
  {id:'reward',get name(){const q=S.you&&S.you.quest;return q&&q.tut&&!q.done?'Slay wolves':'Collect your pay'},text:'Finish the job, then walk into Ashville. Jobs pay when you come home.',
   setup(h){S.tut.base=h.claimed||0;tutWolves(h)},target(h){const q=h.quest;return q&&q.tut&&!q.done?tutWolfNear(h):S.towns[h.town]},note:tutCount,check(h){return(h.claimed||0)>S.tut.base},hold:true},
  {id:'house',name:'Build a house',text:'Stand inside the dashed ring, press Build and choose House.',
   setup(h){if(h.gold<C.COST.house+10)h.gold=C.COST.house+10},target(h){const t=S.towns[h.town];return{x:t.x+t.r+170,y:t.y+40}},
   check(h){return S.builds.some(b=>b.owner===h.id&&b.k==='house')}},
  {id:'upgrade',name:'Raise your house',text:'A gold arrow means you hold the crystals to raise it. Stand by your house and press Upgrade.',
   setup(h){if(h.crystals<C.UP.house[0])h.crystals=C.UP.house[0]},target(h){return S.builds.find(b=>b.owner===h.id&&b.k==='house')},check(h){return S.builds.some(b=>b.owner===h.id&&lv(b)>1)}},
  {id:'barracks',name:'Build a barracks',text:'You build the barracks, and soldiers fight for you. Press Build and choose Barracks.',
   setup(h){if(h.gold<C.COST.barracks+ARMY.SOLDIER+10)h.gold=C.COST.barracks+ARMY.SOLDIER+10},target(h){const t=S.towns[h.town];return{x:t.x-t.r-150,y:t.y+40}},check(h){return!!tutBarracks(h)}},
  {id:'soldier',name:'Train a soldier',text:'Beside your barracks, press Barracks, then Train a soldier.',
   setup(h){S.tut.base=h.trained||0;if(h.gold<ARMY.SOLDIER+10)h.gold=ARMY.SOLDIER+10},target(h){return tutBarracks(h)},check(h){const b=tutBarracks(h);return(h.trained||0)>S.tut.base&&!!b&&b.sol.length>0}},
  {id:'rivals',name:'Meet the rival cities',text:'Brindle and Corvel are rival cities. Brindle tends the giant and Corvel hunts it. Look for the orange square and purple diamond on the map.',target:tutRival,check(){return true}},
  {id:'attack',name:'Order an attack',text:'Beside your barracks, press Barracks and choose Attack Brindle or Attack Corvel. Your soldiers march there to fight defenders and damage buildings and walls. Choose Stand down to stop repeat attacks.',optional:true,
   target:tutBarracks,check(h){const b=tutBarracks(h);return !b||!tutRival(h)||!trainedCount(b)||b.order?.k==='attack'}},
  {id:'order',name:'Send it to the giant',text:'At the barracks, choose Defend giant. Your soldier walks to the giant’s foot and guards it.',
   target:tutBarracks,check(h){return tutBarracks(h)?.order?.k==='giant'}},
  {id:'chain',name:'Strike the ankle chain',text:'Now the giant. Follow the road to its feet and press Attack beside an ankle chain: every blow wears it toward breaking.',
   setup(h){S.tut.base=h.chainHits||0},target(h){const ch=tutChain(h);if(!ch)return null;const a=bodyWorld(ch.c+.5,ch.r+.5);return{x:a.x,y:a.y,z:a.z}},check(h){return(h.chainHits||0)>S.tut.base||!tutChain(h)}},
  {id:'climb',name:'Climb the giant',text:'Now climb it: beside the planted foot, press Climb.',target(h){const f=S.g.feet[0];return{x:f.x,y:f.y}},check(h){return h.mode==='climb'}},
  {id:'knee',name:'Reach the knee',text:'Climb to the knee ledge, 460 feet up. Rest on ledges to refill your grip; if nothing is in reach, lunge.',target(h){return bodyWorld(h.leg?21.5:9.5,46.5,h.cl?.face)},check(h){return h.cl&&h.cl.y>=46}}];
function tutWolfNear(h){const t=S.towns[h.town];let b=null,bd=1e9;for(const m of S.monsters)if(m.tut){const d=Math.hypot(m.x-h.x,m.y-h.y);if(d<bd){bd=d;b=m}}return b||t}
function tutCount(h){const q=h.quest;return q&&q.tut&&!q.done?Math.min(q.n,q.need)+'/'+q.need:''}
function tutBarracks(h){return S.builds.find(b=>b.k==='barracks'&&b.owner===h.id&&b.town===h.town)||null}
function tutRival(h){return aliveTowns().find(t=>t.i!==h.town&&!t.outpost)}
// Leave the first recruit for the player's training lesson.
function tutHoldsTraining(b){return playerBuilt(b)&&tutStep()&&FIRST_DAY.findIndex(x=>x.id==='soldier')>=S.tut.i}
// the ankle chain to teach on: the one on your leg; a press on it counts even when bots have broken some of it, since
// the button then says why it no longer gives, which is the lesson
function tutChain(h){const me=h.cl?h.cl.x:h.leg?22:9,a=S.chains.slice(0,2).filter(c=>c.hp>0).sort((p,q)=>Math.abs(p.c-me)-Math.abs(q.c-me));return a[0]||null}
function tutJob(){const t=tutStep();return t&&t.id==='board'}
function tutWolves(h){const t=S.towns[h.town],q=h.quest,st=tutStep(),want=Math.max(q&&q.tut&&!q.done?q.need-q.n:0,st&&(st.id==='dodge'||st.id==='heavy')?1:0);let have=S.monsters.filter(m=>m.tut).length;
  for(;have<want;have++){const a=rnd()*6.28,d=t.r+380+rnd()*220,x=clamp(t.x+Math.cos(a)*d,100,C.MAP-100),y=clamp(t.y+Math.sin(a)*d,100,C.MAP-100);
    S.monsters.push({id:S.nextId++,kind:'wolf',x,y,hx:x,hy:y,hp:30,max:30,atk:5,gold:8,xp:12,r:13,cd:0,tut:1})}}
function tutStep(){return S&&S.tut&&!S.tut.done?FIRST_DAY[S.tut.i]:null}
function stepTutorial(dt){const st=tutStep(),h=S.you;if(!st||!h||h.dead||S.t<OPENING.len+1)return;
  // a step already done on the way (the crystal banked while walking out to the giant) passes without its card
  if(!S.tut.shown&&st.id==='home'&&st.check(h)){S.tut.i++;S.tut.t=0;return}
  // after "Got it" (remembered) the cards stop opening: each new goal is told in the feed and on the goal line instead (the owner's note)
  if(!S.tut.shown&&save.noFly){if(st.setup)st.setup(h);S.tut.shown=true;S.tut.t=0;S.tut.cardDue=false;
    if(st.id==='end'){S.tut.done=true;save.firstDay=1;persist();announce('The first day is done. The rest is yours.')}else{sfx('coin');toast('New goal: '+st.name)}return}
  if(!S.tut.shown){if(!S.tut.cardDue&&!menu){S.tut.cardDue=true}return}
  S.tut.t+=dt;if(TUT_HUNT.includes(st.id)&&S.t%2<dt)tutWolves(h);const done=st.check(h);
  if(done||S.tut.skipped||(S.tut.t>150&&!st.hold)){if(!done)toast('Moving on.');else{sfx('coin');toast('Done.')}S.tut.i++;S.tut.t=0;S.tut.shown=false;S.tut.skipped=false;
    if(S.tut.i>=FIRST_DAY.length){S.tut.done=true;save.firstDay=1;persist();announce('The first day is done. The rest is yours.')}}}
const TUT_HUNT=['strike','dodge','heavy','reward'];
function openTutorialCard(){const st=tutStep();if(!st)return;S.tut.cardDue=false;if(st.setup)st.setup(S.you);const last=st.id==='end';
  openMenu({holdUntil:performance.now()+700,title:last?'The rest is yours':'The first day \u00b7 '+(S.tut.i+1)+' of '+FIRST_DAY.length,body:`<p>${st.text}</p>`,items:[...(()=>{const show={label:last?'Begin':st.info?'Go on':'Show me',sub:last||st.info?'':'The camera flies to it; press again to come back',act:()=>{closeMenu();S.tut.shown=true;S.tut.t=0;if(last){S.tut.done=true;save.firstDay=1;persist();return}const tg=st.target(S.you);if(tg&&Math.hypot(tg.x-S.you.x,tg.y-S.you.y)>300)startFly(tg)}},
      // once "Got it" is chosen it stays the default (remembered), so pressing on through the cards never flies the camera
      got={label:'Got it',sub:'No more cards or camera flights: new goals show on the goal line and map',act:()=>{closeMenu();S.tut.shown=true;S.tut.t=0;if(!save.noFly){save.noFly=1;persist()}}};
      return last||st.info?[show]:save.noFly?[got,show]:[show,got]})(),
    ...(st.optional?[{label:'Skip this order',act:()=>{closeMenu();S.tut.shown=true;S.tut.skipped=true}}]:[]),
    ...(last||S.tut.i>0?[]:[{label:'Skip the first day',act:()=>{closeMenu();S.tut.done=true;save.firstDay=1;persist()}}]),
    // once the giant has been climbed, the rest of the first day (jobs, building, soldiers) can be left for later
    ...(!last&&S.tut.i>FIRST_DAY.findIndex(x=>x.id==='knee')?[{label:'Finish the first day here',sub:'The Now line keeps pointing at what matters',act:()=>{closeMenu();S.tut.done=true;save.firstDay=1;persist();if(S.you.quest&&S.you.quest.tut)S.you.quest=null;for(const m of S.monsters)if(m.tut)m.tut=0;announce('The first day is done. The rest is yours.')}}]:[])],back:()=>{}})}
// the camera's flight to a goal and back: sized from the distance, a floor and a cap, the return quicker
function startFly(tg){const d=Math.hypot(tg.x-S.you.x,tg.y-S.you.y),dur=Math.min(2.4,1.2+d/2000);S.fly={phase:'out',t:0,dur,to:{x:tg.x,y:tg.y}};latchHeld()}
function flyPress(){const f=S.fly;if(!f)return;if(f.phase==='out'){f.phase='back';f.t=f.dur*.7*(1-Math.min(1,f.t/f.dur));f.dur*=.7}else if(f.phase==='hold'){f.phase='back';f.t=0;f.dur*=.7}}
function stepFly(dt){const f=S.fly;if(!f)return null;f.t+=dt;const e=u=>u<0?0:u>1?1:u*u*(3-2*u);let k;
  if(f.phase==='out'){k=e(f.t/f.dur);if(f.t>=f.dur){f.phase='hold';f.t=0}}else if(f.phase==='hold')k=1;else{k=1-e(f.t/f.dur);if(f.t>=f.dur){S.fly=null;latchHeld();return null}}
  const fr=S.you;return{x:fr.x+(f.to.x-fr.x)*k,y:fr.y+(f.to.y-fr.y)*k,k}}
