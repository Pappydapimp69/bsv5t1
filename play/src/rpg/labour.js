'use strict';
// Colossus · src/rpg/labour.js · the people of a town as workers with a home: who works where, the commute, trips home,
// the overseer; demolishing buildings and rehousing the homeless; buying materials; the range rings shown while building
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.
// Owner (2026-11-28, binding; see RULES.md): workers come from houses within 3000 paces; within 1000 there is no penalty,
// beyond it the worker walks in before starting and walks home and back every few minutes, absent all the while. Every
// workplace gets a first worker before any gets a second, in priority order; a worker moves to a closer job of equal or
// higher priority. A building shows only the workers present. Demolishing returns nothing; a house's people become
// homeless and take free places in other houses, else leave.

C.HIRE_R=3000;C.NEAR_R=1000;C.HOME_EVERY=180;C.SWITCH_EVERY=10;C.OVERSEE_R=130;C.DEMO_R=130;
C.BUY={wood:25,stone:30};C.BUY_N=50;C.BUY_RISE=1.2;

// ---- people: one per resident of a house, and the hall's own; each has a home and perhaps a job
const homePos=(p,t)=>p.home&&S.builds.includes(p.home)?p.home:t;
const commute=(p,b,t)=>Math.hypot(homePos(p,t).x-b.x,homePos(p,t).y-b.y);
const prioOf=(t,k)=>{const o=t.pri?[t.pri,...C.LABOUR_ORDER.filter(x=>x!==t.pri)]:C.LABOUR_ORDER;return o.indexOf(k)};
function peopleOf(t){return(S.people||[]).filter(p=>p.tid===t.id)}
function syncPeople(t){const P=S.people=S.people||[],mine=peopleOf(t),want=new Map([[null,t.hall||0]]);for(const b of housesOf(t)){houseInit(b);want.set(b,b.occ)}
  const have=new Map();for(const p of mine){const k=p.home&&want.has(p.home)?p.home:p.home?'gone':null;if(!have.has(k))have.set(k,[]);have.get(k).push(p)}
  for(const p of have.get('gone')||[])dropPerson(p);
  for(const[k,n]of want){const list=have.get(k)||[];
    // fewer residents than people: those without work go first, then the longest commutes
    if(list.length>n)list.sort((a,b)=>(!!a.job-!!b.job)||(b.job?commute(b,b.job,t):0)-(a.job?commute(a,a.job,t):0)).slice(0,list.length-n).forEach(dropPerson);
    for(let i=list.length;i<n;i++)P.push({id:S.nextId++,tid:t.id,town:t.i,home:k,job:null,st:'idle'})}}
function dropPerson(p){quit(p);const P=S.people;const i=P.indexOf(p);if(i>=0)P.splice(i,1)}
function quit(p){if(p.w){const ws=S.walkers||[],i=ws.indexOf(p.w);if(i>=0)ws.splice(i,1);p.w=null}p.job=null;p.st='idle'}
function hire(p,b,t){quit(p);p.job=b;const d=commute(p,b,t);p.next=S.t+C.HOME_EVERY*(.6+.8*rnd());
  if(d<=C.NEAR_R){p.st='work';return}p.st='to';p.w=newWalker(t,'commute',homePos(p,t),b,{person:p,src:b,leg:'in'})}
// a commuter reaches work or home
function commuteArrive(w){const p=w.person;p.w=null;if(!p.job||!S.builds.includes(p.job)){p.st='idle';return true}const t=S.towns[p.tid];
  if(w.leg==='home'){p.st='back';p.w=newWalker(t,'commute',homePos(p,t),p.job,{person:p,src:p.job,leg:'in',wait:2});return true}
  p.st='work';p.next=S.t+C.HOME_EVERY*(.8+.4*rnd());return true}
// every 2 s: hire in rounds (each workplace one worker before any gets two, in priority order), keep who is placed
function allocate(t){syncPeople(t);t.pop=popOf(t);const P=peopleOf(t),nh=b=>P.reduce((m,p)=>Math.min(m,commute(p,b,t)),1e9);
  // priority first; among equals the one nearest the homes first, so a new building closer to the houses draws workers to it
  const ws=workplaces(t).filter(b=>!b.fire).map(b=>[b,nh(b)]).sort((a,c)=>prioOf(t,a[0].k)-prioOf(t,c[0].k)||a[1]-c[1]).map(e=>e[0]);
  for(const p of P)if(p.job&&(!ws.includes(p.job)||commute(p,p.job,t)>C.HIRE_R))quit(p);
  const reach=new Map(ws.map(b=>[b,P.some(p=>commute(p,b,t)<=C.HIRE_R)])),T=new Map(ws.map(b=>[b,0]));let left=P.length;
  for(let r=0;r<12&&left>0;r++)for(const b of ws){if(left<=0)break;if(reach.get(b)&&T.get(b)<C.JOBS[b.k]){T.set(b,T.get(b)+1);left--}}
  const crew=b=>P.filter(p=>p.job===b);
  for(const b of ws){const c=crew(b),n=T.get(b);if(c.length>n)c.sort((x,y)=>commute(y,b,t)-commute(x,b,t)).slice(0,c.length-n).forEach(quit)}
  for(const b of ws){let c=crew(b).length;while(c<T.get(b)){const free=P.filter(p=>!p.job&&commute(p,b,t)<=C.HIRE_R).sort((x,y)=>commute(x,b,t)-commute(y,b,t))[0];if(!free)break;hire(free,b,t);c++}}
  // a worker moves to a closer job of equal or higher priority: within 1000 where it was beyond, or a third shorter
  if(Math.floor(S.t/C.SWITCH_EVERY)!==Math.floor((S.t-2)/C.SWITCH_EVERY)){const better=(dNew,dOld)=>dNew<=C.NEAR_R&&dOld>C.NEAR_R||dNew<=dOld*2/3;
    for(const b of ws){const c=crew(b);if(!c.length)continue;const far=c.sort((x,y)=>commute(y,b,t)-commute(x,b,t))[0],dFar=commute(far,b,t);
      // candidates: someone without work, or working at a job of equal or lower priority (b is equal or higher for them)
      const cand=P.filter(p=>p!==far&&(!p.job||p.job!==b&&prioOf(t,b.k)<=prioOf(t,p.job.k))&&commute(p,b,t)<=C.HIRE_R&&better(commute(p,b,t),dFar)).sort((x,y)=>commute(x,b,t)-commute(y,b,t))[0];
      if(!cand)continue;const old=cand.job;
      // the one displaced takes the candidate's old place, if it can reach it; a same-kind swap must not just move the long walk
      if(old&&(commute(far,old,t)>C.HIRE_R||old.k===b.k&&commute(far,old,t)>commute(cand,old,t)*1.5))continue;quit(far);quit(cand);if(old)hire(far,old,t);hire(cand,b,t)}}
  let jobs=0,emp=0;for(const b of ws){jobs+=C.JOBS[b.k];b.staff=crew(b).length;emp+=b.staff;b.far=(b.staff?crew(b).every(p=>commute(p,b,t)>C.NEAR_R):P.length&&P.every(p=>commute(p,b,t)>C.NEAR_R))}
  t.jobs=jobs;t.employed=emp;t.idle=P.filter(p=>!p.job).length;countPresent()}
function countPresent(){for(const b of S.builds)if(C.JOBS[b.k]&&b.staff!=null)b.present=0;for(const p of S.people||[])if(p.job&&p.st==='work')p.job.present=(p.job.present||0)+1}
// every second: the far commuters take their trip home now and then
function stepPeople(){for(const p of S.people||[]){if(p.st!=='work'||!p.job||S.t<(p.next||0))continue;const t=S.towns[p.tid];if(!t||!t.alive)continue;
    if(commute(p,p.job,t)<=C.NEAR_R){p.next=S.t+C.HOME_EVERY;continue}p.st='away';p.w=newWalker(t,'commute',p.job,homePos(p,t),{person:p,src:p.job,leg:'home'})}countPresent()}
// the overseer: you, standing at one of your staffed workplaces, make it work half again as well
function overseen(b){const h=S.you;return!!(h&&S.role==='human'&&!h.dead&&h.mode==='ground'&&h.town===b.town&&C.JOBS[b.k]&&(crewOf(b)??1)>0&&Math.hypot(h.x-b.x,h.y-b.y)<C.OVERSEE_R)}

// ---- the homeless: a house's people look for free places in their own town's houses (same settlement first), else leave
function rehouse(b,n){const t=settleOf(b)||nearestOwn(b.town,b.x,b.y);let moved=0,left=0;
  for(let k=0;k<n;k++){const hs=S.builds.filter(o=>o!==b&&o.k==='house'&&o.hp!==0&&o.town===b.town&&(houseInit(o),o.occ+o.inc<occCap(o)))
      .sort((x,y)=>((x.settlementId!==b.settlementId)-(y.settlementId!==b.settlementId))||dist(x,b)-dist(y,b));const to=hs[0],tt=to&&(settleOf(to)||t);
    if(to&&tt){to.inc++;newWalker(tt,'settler',b,to,{house:to,homeless:1});moved++}else if(t){const a=rnd()*6.283;newWalker(t,'leaver',b,{x:t.x+Math.cos(a)*1100,y:t.y+Math.sin(a)*1100});left++}}
  return{moved,left}}
function freePlacesFor(b){return S.builds.filter(o=>o!==b&&o.k==='house'&&o.hp!==0&&o.town===b.town).reduce((n,o)=>(houseInit(o),n+Math.max(0,occCap(o)-o.occ-o.inc)),0)}

// ---- demolish: one of your buildings on the ground; nothing comes back; what it held is lost; a house's people are homeless
function demolishTarget(h){let best=null,bd=C.DEMO_R;for(const b of S.builds){if(b.town!==h.town||b.hp===0||!(b.k==='house'||CIVIC[b.k]||b.k==='tower'||b.k==='barracks'))continue;const d=Math.hypot(b.x-h.x,b.y-h.y);if(d<bd){bd=d;best=b}}return best}
function demolish(b){if(!S.builds.includes(b))return null;let r=null;if(b.k==='house'){houseInit(b);r=rehouse(b,b.occ);b.occ=0}
  b.store=0;b.grow=0;b.harvT=null;destroyBuild(b);const t=settleOf(b)||nearestOwn(b.town,b.x,b.y);if(t)t.food=Math.min(t.food,foodCap(t));
  S.demolished=(S.demolished||0)+1;return r||{moved:0,left:0}}
let demoArm=null;
function demolishItem(h){const b=demolishTarget(h);if(!b)return[];const name=bName(b).toLowerCase(),now=performance.now(),armed=demoArm&&demoArm.b===b&&now-demoArm.at<4000;
  let sub='Nothing comes back'+(b.k==='market'&&b.store?'; its '+Math.floor(b.store)+' food is lost':'')+(b.k==='granary'?'; food beyond the store that is left is lost':'');
  if(b.k==='house'){houseInit(b);const free=freePlacesFor(b),n=b.occ;sub=n?n+' people lose their home; '+Math.min(free,n)+' find a place elsewhere'+(n>free?', '+(n-free)+' leave':''):'Nobody lives here'}
  return[{label:armed?'Press again to demolish the '+name:'Demolish this '+name,sub,cls:'danger',act:()=>{const now2=performance.now();
    if(armed&&now2-demoArm.at>=400){demoArm=null;const r=demolish(b);closeMenu();toast('The '+name+' is demolished'+(r&&(r.moved||r.left)?': '+r.moved+' moved to other houses, '+r.left+' left town':'')+'.');sfx('thud')}
    else{demoArm={b,at:now2};openBuild()}}}]}

// ---- buying materials: at your staffed bazaar the price rises with each purchase and eases back; the merchant charges more
function buyItems(h,t,reopen){if(!civicOn(t,'market'))return[];const K=t.buyK=t.buyK||{wood:1,stone:1};
  return['wood','stone'].map(k=>{const g=Math.round(C.BUY[k]*K[k]);return{label:'Buy '+C.BUY_N+' '+k+' – '+g+' gold',sub:'The price rises with each purchase and eases back',why:h.gold<g?'Need '+(g-h.gold)+' more gold':null,act:()=>{h.gold-=g;giveStock(t,k,C.BUY_N);K[k]*=C.BUY_RISE;sfx('coin');reopen()}}})}
function easePrices(){for(const t of aliveTowns())if(t.buyK)for(const k in t.buyK)t.buyK[k]=1+(t.buyK[k]-1)*.9}
// what the town is short of: tasks and camp stockpiles lean to it
const scarcer=t=>t&&stockOf(t,'stone')*1.3<stockOf(t,'wood')?'stone':'wood';

// ---- range rings while building (the Build menu open, ten seconds after, or toggled with V or from the pause menu)
let ringsUntil=0,ringsOn=false;
function ringsShown(){return ringsOn||performance.now()<ringsUntil||menu&&menu.title==='Build here'}
// a ring on the ground that draws the stretches in view (the stock ring helper draws nothing if any point is behind you)
function rangeRing(x,y,r,col,w){if(typeof p3!=='function'||!ctx)return;ctx.strokeStyle=col;ctx.lineWidth=(w||2)*UI;ctx.beginPath();let on=false;
  for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,q=p3(x+Math.cos(a)*r,y+Math.sin(a)*r,4);if(!q){on=false;continue}if(on)ctx.lineTo(q.x,q.y);else{ctx.moveTo(q.x,q.y);on=true}}ctx.stroke()}
function econRings(){const h=S&&S.you;if(!h||S.role!=='human'||h.mode!=='ground'||!ringsShown())return;if(menu&&menu.title==='Build here')ringsUntil=performance.now()+1e4;
  const near=S.builds.filter(b=>b.town===h.town&&b.hp!==0&&Math.hypot(b.x-h.x,b.y-h.y)<3200);
  near.filter(b=>b.k==='house').sort((a,b)=>dist(a,h)-dist(b,h)).slice(0,20).forEach(b=>rangeRing(b.x,b.y,C.NEAR_R,'rgba(235,235,225,.22)',1));
  for(const b of near)if(b.k==='well')rangeRing(b.x,b.y,C.WELL_R,'rgba(110,170,235,.8)',2.5);else if(b.k==='market')rangeRing(b.x,b.y,C.BAZAAR_R,'rgba(235,180,70,.8)',2.5)}
// what the Build menu says about the spot you stand on
function spotNotes(h){const own=S.builds.filter(b=>b.town===h.town&&b.hp!==0),d=k=>own.filter(b=>b.k===k).reduce((m,b)=>Math.min(m,Math.hypot(b.x-h.x,b.y-h.y)),1e9);
  const water=d('well')<=C.WELL_R,food=d('market')<=C.BAZAAR_R,home=Math.min(d('house'),(t=>t?dist(t,h):1e9)(nearestOwn(h.town,h.x,h.y)));
  return{house:(water?'water ✓':'no well reaches here')+', '+(food?'food ✓':'no bazaar reaches here'),work:home>C.HIRE_R?'no homes within '+C.HIRE_R+' paces: nobody would work here':'nearest home '+Math.round(home)+' paces'+(home>C.NEAR_R?': far from homes, workers commute':' (no commute penalty)')}}
function payMat(h,q){if(!q||!q.mat)return;const t=firstTown(h.town)||nearestOwn(h.town,h.x,h.y);if(t){giveStock(t,q.mat.k,q.mat.n);if(h.you)toast('+'+q.mat.n+' '+q.mat.k+' to '+t.name+'\u2019s stockpile.')}}
