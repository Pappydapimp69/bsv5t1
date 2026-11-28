'use strict';
// Colossus · src/rpg/questlog.js · story quests taken from a town's Board, and the quest tracker on screen
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.
// Owner (2026-11-28): the quest list should collapse; the Board in town should show quests, not just tasks, and the
// player picks quests there so the quest UI on screen stays small. So: the Board lists Quests (several steps, picked
// by you, at most three at once) beside Tasks (the short jobs it always had). On screen one line follows the tracked
// quest; the full list opens with O or a click and closes again. Quest steps read the state of your town and are paid
// as they are done, wherever you are.

C.QUEST_MAX=3;
const myTown=h=>firstTown(h.town)||nearestOwn(h.town,h.x,h.y);
const mySoldiers=h=>S.humans.filter(o=>o.sol&&o.town===h.town&&!o.dead).length;
const builtOf=(h,k)=>S.builds.filter(b=>b.k===k&&b.town===h.town&&b.hp!==0).length;
// each step: text, and p(h) -> [have, need]; a step already true when reached passes at once
const QUESTS={
  charter:{n:'A town of our own',sub:'Houses, then the food and water they need, then a house that grows',reward:80,
    steps:[{t:'Build a house (settlers move in)',p:h=>[builtOf(h,'house'),1]},
      {t:'Build a well (water for the houses)',p:h=>[builtOf(h,'well'),1]},
      {t:'Build a farm beside a river or lake',p:h=>[builtOf(h,'farm'),1]},
      {t:'Build a granary (it takes in the harvest)',p:h=>[builtOf(h,'granary'),1]},
      {t:'Build a bazaar (it feeds the houses)',p:h=>[builtOf(h,'market'),1]},
      {t:'Raise a house to level 2 (it needs food and water)',p:h=>[S.builds.some(b=>b.k==='house'&&b.town===h.town&&b.hp!==0&&lv(b)>=2)?1:0,1]},
      {t:'Advance to the Village age (Hall)',p:h=>[lv(myTown(h)||{}),2]}]},
  walls:{n:'Hold the walls',sub:'Barracks, soldiers and towers before the raids grow',reward:90,
    steps:[{t:'Build a barracks',p:h=>[barracksOf(h.town).length,1]},
      {t:'Have soldiers under arms',p:h=>[mySoldiers(h),3]},
      {t:'Build watchtowers',p:h=>[builtOf(h,'tower'),2]}]},
  trade:{n:'Stone and coin',sub:'A woodcutter, a quarry, a fire station and the Town age',reward:150,unlock:h=>lv(myTown(h)||{})>=2||(h.qDone||{}).charter,
    steps:[{t:'Build a woodcutter',p:h=>[builtOf(h,'woodcutter'),1]},
      {t:'Build a quarry beside a stone outcrop',p:h=>[builtOf(h,'quarry'),1]},
      {t:'Build a fire station',p:h=>[builtOf(h,'firehouse'),1]},
      {t:'Have settlers in your town',p:h=>[Math.floor((myTown(h)||{}).pop||0),40]},
      {t:'Advance to the Town age (Hall)',p:h=>[lv(myTown(h)||{}),3]}]},
  frontier:{n:'The frontier',sub:'Found an outpost and join it to home by road',reward:120,unlock:h=>lv(myTown(h)||{})>=2,
    steps:[{t:'Found an outpost (Build, away from towns)',p:h=>[S.towns.filter(t=>t.i===h.town&&t.alive&&t.outpost||t.i===h.town&&t.alive&&t.id>2).length,1]},
      {t:'Its foragers lay a road home',p:h=>[(t=>t?linked(t).length-1:0)(myTown(h)),1]}]},
  tale:{n:'The elders’ tale',sub:'Standing stones, a camp, an alpha, and the Rim Warlord',saga:true,unlock:h=>(h.claimed||0)>=2||h.lvl>=3}};
function questOpen(h){return(h.quests||[]).filter(q=>!q.done)}
function questsOffered(h){const have=new Set((h.quests||[]).map(q=>q.id));return Object.keys(QUESTS).filter(id=>!have.has(id)&&!(h.qDone||{})[id]&&(!QUESTS[id].unlock||QUESTS[id].unlock(h))&&!(id==='tale'&&h.saga))}
function takeQuest(h,id){if(questOpen(h).length>=C.QUEST_MAX)return false;const D=QUESTS[id];(h.quests=h.quests||[]).push({id,i:0,t:S.t});h.track='q:'+id;
  if(D.saga){h.saga={i:0,n:Math.min(SAGA[0].need,Object.keys(h.lore||{}).length)};sagaDone(h)}
  if(h.you)toast('Quest taken: '+D.n+'. '+questStepText(h,h.quests[h.quests.length-1]));return true}
function dropQuest(h,id){h.quests=(h.quests||[]).filter(q=>q.id!==id);if(id==='tale')h.saga=null;if(h.track==='q:'+id)h.track=null}
function questStep(h,q){const D=QUESTS[q.id];if(D.saga){const g=h.saga,st=g&&!g.done&&SAGA[g.i];return st?{t:st.text.replace(/^The elders’ tale: /,''),n:g.n||0,need:st.need,of:[g.i+1,SAGA.length]}:null}
  const st=D.steps[q.i];if(!st)return null;const[n,need]=st.p(h);return{t:st.t,n:Math.min(n,need),need,of:[q.i+1,D.steps.length]}}
function questStepText(h,q){const s=questStep(h,q);return s?s.t+(s.need>1?' '+s.n+'/'+s.need:''):'Done'}
// once a second: steps that are now true are paid and the quest moves on
function stepQuests(){const h=S.you;if(!h||S.role!=='human')return;for(const q of questOpen(h)){const D=QUESTS[q.id];
  if(D.saga){if(h.saga&&h.saga.done){q.done=true;(h.qDone=h.qDone||{})[q.id]=1}continue}
  let guard=0;while(D.steps[q.i]&&guard++<9){const[n,need]=D.steps[q.i].p(h);if(n<need)break;q.i++;const last=!D.steps[q.i],g=last?D.reward:20+10*q.i;h.gold+=g;gainXp(h,last?60:15);
    if(last){q.done=true;(h.qDone=h.qDone||{})[q.id]=1;announce('Quest complete: '+D.n+'. +'+g+' gold.');sfx('fanfare');if(h.track==='q:'+q.id)h.track=null}
    else{toast(D.n+': step done (+'+g+' gold). Next: '+questStepText(h,q)+'.');sfx('coin')}}}}

// ---- the tracker: one line for the tracked entry; O or a click opens the list of everything you follow
function trackEntries(h){const out=[];if(h.quest)out.push({key:'task',k:'Task',t:h.quest.done?'Done: return to town to be paid':h.quest.text+(h.quest.need>1?' '+Math.min(h.quest.n,h.quest.need)+'/'+Math.round(h.quest.need):'')});
  for(const q of questOpen(h)){const s=questStep(h,q);out.push({key:'q:'+q.id,k:QUESTS[q.id].n,t:s?s.t+(s.need>1?' '+s.n+'/'+s.need:''):'Done',of:s&&s.of})}
  return out}
function questTracker(h){const es=trackEntries(h),open=!!save.qOpen,now=nextAim(h);
  if(h.track&&!es.some(e=>e.key===h.track))h.track=null;const tr=es.find(e=>e.key===h.track)||es.find(e=>e.key!=='task')||es[0];
  const head=tr?'<span class="k">'+tr.k+'</span> '+tr.t:now?'<span class="k">Now</span> '+now:'';
  const tog=`<span class="qt" data-q="toggle" title="Quests (O)">${open?'▴':'▾'} ${es.length?es.length:''}</span>`;
  // urgent pointers outrank a tracked quest (GPTBS fe311386: threats to your town come first), so they show even collapsed
  const urgent=tr&&now&&/^(your pack is full|beasts are at|horn race|sound your wake horn|the giant is angry)/.test(now);
  if(!open)return'<div class="qh"><span>'+head+'</span>'+tog+'</div>'+(urgent?'<div class="jg hint urgent"><b>Now</b> '+now+'</div>':'');
  const rows=es.map(e=>`<div class="jg${e===tr?' tr':''}" data-q="${e.key}">${e===tr?'▸':'○'} <span class="qn">${e.k}</span>${e.of?' <i>'+e.of[0]+'/'+e.of[1]+'</i>':''}<br>${e.t}</div>`).join('');
  const room=C.QUEST_MAX-questOpen(h).length,offer=questsOffered(h).length;
  return'<div class="qh"><span class="k">Quests</span>'+tog+'</div>'+(rows||'<div class="jg hint">No quests taken.</div>')+(now&&tr&&tr.key!=='now'?'<div class="jg hint"><b>Now</b> '+now+'</div>':'')+
    (offer&&room>0?'<div class="jg hint">'+offer+' more on the Board in town</div>':'')}
function questToggle(){save.qOpen=save.qOpen?0:1;persist()}
function questCycle(h){const es=trackEntries(h);if(!es.length)return;const i=es.findIndex(e=>e.key===h.track);h.track=es[(i+1)%es.length].key;toast('Tracking: '+es[(i+1)%es.length].k+'.')}
// where the tracked quest points on the land, when it has a place
function trackedTarget(h){if(!h.track||h.track==='task')return null;const id=h.track.slice(2),q=questOpen(h).find(q=>q.id===id);if(!q)return null;
  if(QUESTS[id].saga)return questTarget({...h,quest:null});const t=myTown(h);const st=QUESTS[id].steps[q.i];if(!st||!t)return null;
  if(/quarry/.test(st.t)){const qq=(S.quarries||[]).filter(x=>x.town===h.town).sort((a,b)=>dist(a,t)-dist(b,t))[0];return qq?{x:qq.x,y:qq.y}:null}
  if(/river or lake/.test(st.t))return botSite(t,'farm',()=>.5)
  return Math.hypot(t.x-h.x,t.y-h.y)>t.r+200?{x:t.x,y:t.y}:null}
// the quests as rows under the first-day journal: collapsed, only the tracked one; open, every quest and task
function questRows(h,open){const es=trackEntries(h);if(!es.length)return'';const tr=es.find(e=>e.key===h.track)||es.find(e=>e.key!=='task')||es[0];
  return(open?es:[tr]).map(e=>`<div class="jg qrow${e===tr?' tr':''}" data-q="${e.key}">${e===tr?'\u25b8':'\u25cb'} <span class="qn">${e.k}</span>${e.of?' <i>'+e.of[0]+'/'+e.of[1]+'</i>':''} ${e.t}</div>`).join('')}
