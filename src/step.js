'use strict';
// Colossus · src/step.js · the fixed sim step
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= game step =================
let climbLatch=false;
function climbInput(h,mv){return{x:G3.active&&h.cl.face===1?-mv.x:mv.x,y:-mv.y}}
function step(dt){if(S.over)return;S.t+=dt;sndBudget=Math.max(0,sndBudget-dt*20);
  const mv=readMove(),wm=camRelative(mv);
  if(S.role==='giant'){if(S.autoplay)botGiant(dt);else if(!S.g.awake){const z=Math.abs(mv.x)>.5&&Math.abs(mv.x)>=Math.abs(mv.y)?(mv.x<0?'left':'right'):Math.abs(mv.y)>.5?(mv.y<0?'top':'legs'):null;if(z&&z!==S.g.aim){S.g.aim=z;S.g.aimT=S.t}}
    else{if(mv.x||mv.y){const g=S.g;g.tx=g.x+wm.x*500;g.ty=g.y+wm.y*500}trackGiantTarget()}}else botGiant(dt);
  for(const h of S.humans){let m={x:0,y:0};
    if(h.you&&!S.autoplay){if(h.mode==='climb')m=climbInput(h,mv);else m=wm}else m=botHuman(h,dt);
    stepHuman(h,dt,m)}
  for(const a of combatPresses(takePresses(),wm)){if(S.role==='giant'){if(!S.autoplay)giantDo((S.g.fallen>0?{A:'struggle',B:'struggle',X:'struggle',Y:'struggle'}:S.g.awake?{A:'stomp',B:'smash',X:'shake',Y:'swipe'}:{A:'twitch',B:'strain',X:'dream',Y:'swipe'})[a])}
    else if(S.you&&!S.autoplay)humanAct(S.you,a,S.you.mode==='climb'?climbInput(S.you,mv):null)}
  if(S.you&&S.you.mode==='climb'&&S.you.cl)S.you.best=Math.max(S.you.best||0,S.you.cl.y);
  if(S.role==='giant'&&!S.autoplay&&!S.headless)giantHints();
  if(S.you&&!S.headless&&S.t-(S.eyeT||0)>2){S.eyeT=S.t;watchFavour()}
  stepCombat(dt);stepDays(dt);stepTutorial(dt);stepGiant(dt);stepMonsters(dt);stepShots(dt);stepBuilds(dt);stepArmy(dt);stepCrumble(dt);stepEvents(dt);
  for(let i=S.fx.length-1;i>=0;i--){S.fx[i].t+=dt;if(S.fx[i].t>S.fx[i].life)S.fx.splice(i,1)}
  checkEnd()}
function checkEnd(){const alive=TOWNS.map((_,i)=>standingTown(i)).filter(Boolean);let over=null;
  if(S.g.dead)over={giantWon:false,text:'The Heart-stone is shattered and the giant lies still.'};
  // at dusk the giant lies down beside the town that treated it best and becomes a mountain
  else if(S.verdictDue&&alive.length){let fav=alive[0];for(const t of alive)if(S.grudge[t.i]<S.grudge[fav.i])fav=t;const fp=favoredPerson();if(fp){fav=standingTown(fp.town);S.favoredH=fp.id}S.favored=fav.i;
    over={giantWon:false,dusk:true,text:'At dusk the giant honours '+(fp&&fp===S.you?'you':'its favourite of '+TOWNS[fav.i].name)+' and lies down beside '+fav.name+', a mountain at last. It becomes a mountain.'}}
  else if(alive.length<=1&&S.role!=='giant')over={giantWon:true,text:alive.length?'Only '+TOWNS[alive[0].i].name+' still stands.':'Every town lies in ruins.'};
  else if(S.role==='human'&&!factionAlive(S.you.town))over={giantWon:true,text:TOWNS[S.you.town].name+' has fallen.'};
  if(!over)return;S.over=over;chron(over.dusk?'Dusk. '+over.text.split(' It becomes')[0]:over.text);
  // the giant wins by being alive at dusk
  if(S.role==='giant'){const n=giantTasks().filter(x=>x.done).length;over.win=!!over.dusk&&n>=C.GIANT_TASKS;if(over.dusk)over.text+=' You completed '+n+' of the tasks; '+C.GIANT_TASKS+' were needed.'}else over.win=factionAlive(S.you.town)&&(!(over.dusk||over.left)||S.favoredH===S.you.id);
  if(S.role==='giant'){if(over.win)save.giantWins++;else save.giantLosses++}else{if(over.win)save.humanWins++;else save.humanLosses++}
  // the giant remembers the day: whom it honoured at dusk and which town hurt it most (a discrete, named memory, not a score)
  {let worst=-1;for(let i=0;i<3;i++)if(grudgeNow(i)>0&&(worst<0||grudgeNow(i)>grudgeNow(worst)))worst=i;
    const slayer=S.g.dead&&S.slayer!=null?S.slayer:null,hurt=slayer!=null?slayer:worst>=0&&grudgeNow(worst)>=C.MEM_MIN?worst:null;
    save.memory={v:1,honoured:over.dusk&&S.favored!=null?S.favored:null,hurt,slain:slayer!=null}}
  // records worth coming back for: wins for each town, the highest climb, the most giant tasks in one match
  {const R=save.rec=save.rec||{town:[0,0,0],climb:0,tasks:0};if(S.role==='giant')R.tasks=Math.max(R.tasks,giantTasks().filter(x=>x.done).length);
    else if(S.you){if(over.win)R.town[S.you.town]++;R.climb=Math.max(R.climb,Math.round((S.you.best||0)*FT))}}persist();
  if(!S.headless)setTimeout(openEnd,900)}
function nearPlayer(p){if(!S)return false;const c=S.cam;return Math.hypot(p.x-c.x,p.y-c.y)<1600}

