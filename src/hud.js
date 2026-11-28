'use strict';
// Colossus · src/hud.js · HUD, skill bar, buttons
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= HUD =================
const hud1=document.getElementById('hud1'),hud2=document.getElementById('hud2');let hudSig='';
function clock(){if(S.night)return'Night';const s=Math.max(0,C.DUSK-phase());return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function mood(i){const v=S.grudge[i];return v>=C.ANGER?'ANGRY':v>=C.ANGER*.5?'wary':v<-60?'friendly':'calm'}
const pEl={t:document.getElementById('gt'),d:document.getElementById('gd'),bar:document.getElementById('gbar'),s:document.getElementById('gs')};let pSig='';
// where you stand among everyone the giant judges: your place in its regard, as the verdict at dusk will count it
function standing(h){const sc=x=>(S.reg&&S.reg[x.id]||0)-S.grudge[x.town]*1e-4,all=S.humans.filter(x=>factionAlive(x.town)),me=sc(h),n=1+all.filter(x=>x!==h&&sc(x)>me+.5).length;if(all.every(x=>Math.abs(S.reg&&S.reg[x.id]||0)<.5))return'it has judged no one yet';return n===1?'it regards you most':'you stand '+n+' of '+all.length+' in its regard'}
function paintPanel(){const g=S.g,h=S.you,cs=S.chains,st=c=>c.hp<=0?0:chainWeak(c)?1:2,ring={0:['#666',.3],1:['#f0a050',1],2:['#e8e2d2',1]};
  const word=pre=>{const a=cs.filter(c=>c.id.startsWith(pre)).map(st);return a.every(x=>x===0)?'broken':a.some(x=>x===0)?'one broken':'hold'};
  const t=S.role==='giant'?(g.awake?'You, the giant':'You sleep, chained'):g.fallen>0?'The giant is down':g.awake?'The giant is awake':(g.wind||S.t-(S.windAt||-9)<3)?'The giant stirs in its sleep':'The giant sleeps';
  const ch=cs.some(c=>c.hp>0)?'ankles '+word('ankle')+', wrists '+word('wrist'):'';
  const sub=S.role==='giant'?TOWNS.map((T,i)=>T.name+' '+(factionAlive(i)?mood(i):'ruined')).join(' \u00b7 ')+(ch?' \u00b7 '+ch:''):(mood(h.town)[0].toUpperCase()+mood(h.town).slice(1)+' toward '+TOWNS[h.town].name+' \u00b7 '+standing(h)+(ch?' \u00b7 '+ch:''));
  {const key=(S.role==='giant'?'':mood(h.town)+(standing(h)==='it regards you most'))+ch;if(key!==S.gsKey){S.gsKey=key;S.gsAt=S.t}const pulse=S.t<(S.gsPulse||0),quiet=!pulse&&S.t-(S.gsAt||0)>6;pEl.s.classList.toggle('quiet',quiet);pEl.s.classList.toggle('pulse',pulse)}
  cs.forEach(c=>{const e=document.getElementById('c_'+c.id);if(e)e.classList.toggle('flash',S.t-((S.chainFlash||{})[c.id]??-99)<3)});
  const pos=TOWNS.map((T,i)=>Math.round(clamp((S.grudge[i]+100)/(C.ANGER+100),0,1)*100)),sig=t+clock()+sub+pos.join()+cs.map(st).join('');if(sig===pSig)return;pSig=sig;
  pEl.t.textContent=t;pEl.d.textContent='Dusk '+clock();pEl.s.textContent=sub;
  if(pEl.bar.children.length!==TOWNS.length)pEl.bar.innerHTML=TOWNS.map(T=>`<i style="background:${T.col}" title="${T.name}"></i>`).join('');
  TOWNS.forEach((T,i)=>{const m=pEl.bar.children[i];m.style.left=pos[i]+'%';m.style.setProperty('--o',(i-1)*.3+'rem');m.style.opacity=factionAlive(i)?1:.3;m.style.height=(h&&h.town===i?1.4:1.1)+'rem';m.style.top=(h&&h.town===i?-.45:-.3)+'rem'});
  cs.forEach(c=>{const e=document.getElementById('c_'+c.id);if(e){e.setAttribute('stroke',ring[st(c)][0]);e.setAttribute('opacity',ring[st(c)][1])}})}
// with no job and the first day done, one line of what matters now, read from the state of the giant and your kit
// (a pointer, not an autopilot: the player still chooses and walks)
function nextAim(h){const g=S.g,J=S.joints;h.aimPoi=null;if(h.dead||h.job)return'';const kin=k=>h.kits[k]>0,climb=h.mode==='climb';
  if(packCount(h)>=packCap(h))return'your pack is full: bank it at home';
  if(g.dead)return'the giant is dead: hold your town until dusk';
  {const home=S.towns.find(t=>t.i===h.town&&t.alive&&S.monsters.some(m=>m.raid&&m.raid.town===t.id&&Math.hypot(m.x-t.x,m.y-t.y)<t.r+80));if(home&&home.hp<home.max*.85&&!climb)return'beasts are at '+home.name+'\u2019s walls ('+Math.round(home.hp/home.max*100)+'%): go home and fight them'+(Math.hypot(home.x-h.x,home.y-h.y)>1500?' ('+Math.round(Math.hypot(home.x-h.x,home.y-h.y)/10)+' paces)':'')}
  // the horn race: whoever sounds a horn at the head first wakes the giant and earns its thanks for their town
  if(!g.awake&&allWeak()){const rivals=S.humans.filter(o=>o!==h&&o.horn&&!o.dead&&o.town!==h.town&&factionAlive(o.town)).sort((a,b)=>(b.cl?b.cl.y:0)-(a.cl?a.cl.y:0)),lead=rivals[0],
      lh=lead?(lead.mode==='climb'?Math.round(lead.cl.y*FT)+' ft':'on the ground'):null,race=lead?' \u00b7 '+whoOf(lead)+' carries a horn ('+lh+')':'';
    if(h.horn)return'sound your wake horn at the giant\u2019s head (1860 ft): it will owe '+TOWNS[h.town].name+race;
    if(lead&&lead.mode==='climb')return'horn race: '+whoOf(lead)+' is climbing to wake it ('+lh+'); shove them on the way, or let '+TOWNS[lead.town].name+' have the thanks'}
  if(!g.awake&&chainsOpen()&&!allWeak())return'the chains weaken: break them at the ankles and wrists';
  const w=wedgedJoints().filter(id=>J[id].wedges.some(x=>x.town!==h.town));
  if(S.grudge[h.town]>=C.ANGER*.6)return'the giant is angry with '+TOWNS[h.town].name+': pull wedges or brace it to calm it, or bring it down';
  if(kin('wedge'))return'drive your wedge into a knee ('+JOINTS.kneeL.r0*FT+' ft up) or another joint'+(g.awake?'':': asleep it bruises, it cannot be crippled');
  if(h.picks>0&&!climb)return'you levelled up: press T to choose a talent';
  if(!climb&&h.hero&&!h.horse&&h.gold>=C.HORSE_COST)return'buy a horse in town ('+C.HORSE_COST+' gold) and ride with R: almost twice as fast';
  if(kin('brace')||kin('cannon')||(kin('ladder')||kin('platform'))&&S.t>420)return'bolt your kit onto a free build spot on the giant';
  if(!climb&&h.hero){const p=poiAim(h);if(p)return p}
  if(w.length&&!climb)return'rivals\u2019 wedges bleed the giant\u2019s '+JOINTS[w[0]].name.toLowerCase()+': pull them out and it will remember you';
  if(g.fallen>0)return'the giant is down: its Heart-stone takes more damage now';
  // a forward base: an outpost near the giant shortens every walk (you shop and come back to life at your nearest settlement)
  if(!climb&&h.gold>=C.COST.outpost+C.COST.brace){const o=outpostAim(h);if(o)return o}
  {const way=townWay(h.town),tend=way==='tend'||(S.reg&&S.reg[h.id]||0)>C.LEAD_REG,hunt=way==='hunt'&&!tend;
    if(!climb&&huntOpen()&&tend&&h.gold>=C.COST.brace)return'buy a brace kit in town and bolt it on: the giant remembers who braces it';
    if(!climb&&huntOpen()&&tend)return(Object.values(S.joints).some(j=>j.hp<j.max-1&&!j.crip)?'climb and Tend a hurt joint (anchor button): the giant remembers kindness; or ':'')+'earn '+(C.COST.brace-h.gold)+' more gold for a brace kit';
    if(!climb&&huntOpen()&&hunt&&h.gold>=C.COST.wedge)return'buy a wedge in town and drive it into a knee';
    if(!climb&&h.gold>=C.COST.wedge&&huntOpen()&&h.gold<C.COST.outpost)return'buy a wedge or a brace kit in town, then climb the giant'}
  {const o=outpostAim(h);if(o)return o}
  if(!climb&&h.hero){const c=(S.caches||[]).filter(c=>S.t>=c.ready&&dist(c,h)<3500).sort((a,b)=>dist(a,h)-dist(b,h))[0];if(c)return'a chest is ready in the ruins nearby (marked on the land): gold, crystals and a kit; beasts may follow you home'}
  return!climb?'earn gold: take a job on the Board, hunt beasts or gather sky crystals':''}
// the nearest worthwhile place within reach: a ready shrine, an unread stone, an unsoaked spring, a camp to break, a traveller
function poiAim(h){if(h.treasure){h.aimPoi={x:h.treasure.cx,y:h.treasure.cy,golden:1,dead:0};return'search the ringed area on your map for the treasure (M)'}const stag=(S.critters||[]).find(c=>c.golden&&!c.dead&&Math.hypot(c.x-h.x,c.y-h.y)<5000);if(stag){h.aimPoi=stag;return'a golden stag is near: hunt it (60 gold, maybe a charm)'}
  const ch=S.monsters.find(m=>m.champion&&Math.hypot(m.x-h.x,m.y-h.y)<6000);if(ch&&h.lvl>=3){h.aimPoi={x:ch.x,y:ch.y,golden:1,dead:0};return ch.elite+' challenges you to a duel (120 gold)'}
  const near=(S.pois||[]).filter(p=>Math.hypot(p.x-h.x,p.y-h.y)<(h.riding?4200:2800)&&(p.k==='shrine'&&S.t>=p.ready&&!buffOf(h,p.sub)||p.k==='stones'&&!(h.lore||{})[p.lore]||p.k==='spring'&&!(p.used||{})[h.id]||p.k==='camp'&&(campBeasts(p).length?h.lvl>=2:!!p.alive)||p.k==='traveller'&&!p.follow))
    .sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];h.aimPoi=near||null;if(!near)return'';const d=Math.round(Math.hypot(near.x-h.x,near.y-h.y)/100)*10,dir='(the light marks it)';
  const what={shrine:SHRINES[near.sub]&&SHRINES[near.sub].n+' ('+SHRINES[near.sub].t.toLowerCase()+')',stones:'standing stones to read (lore and XP)',spring:'a hot spring (+10 most health)',camp:near.name+'\u2019s camp'+(campBeasts(near).length?' (an alpha guards a chest)':' (its chest is ready)'),traveller:near.ambush?'a traveller cornered by wolves (100 gold)':'a lost traveller to walk home (50 gold)'}[near.k];
  return what+', '+d+' paces away '+dir}
function outpostAim(h){const g=S.g,climb=h.mode==='climb';
  {const near=nearestOwn(h.town,g.x,g.y),site=()=>{for(let k=0;k<12;k++){const a=k/12*6.283,x=g.x+Math.cos(a)*1400,y=g.y+Math.sin(a)*1400;if(outpostSiteOpen(x,y)&&!inSolid(x,y,60)&&!S.prints.some(p=>Math.hypot(p.x-x,p.y-y)<C.FOOT_R*1.2))return true}return false};
    if(!climb&&!g.awake&&h.hero&&h.gold>=C.COST.outpost&&S.outposts[h.town]<3&&(!near||dist(near,g)>3000)&&site())return'found an outpost near the giant (Build, '+C.COST.outpost+' gold): you shop and come back to life there, though the giant may trample it once it walks'}
  return''}
// the giant's first lessons, each told once (ever) at the moment it applies, in the flow of play rather than on cards
function giantHints(){if(S.t<OPENING.len+2)return;const g=S.g,seen=save.ghint=save.ghint||{},k=device==='pad'?{A:'A',B:'B',X:'X',Y:'Y'}:device==='touch'?{A:'the big button',B:'the left button',X:'the top-left button',Y:'the top button'}:{A:'J',B:'K',X:'L',Y:'H'};
  const say=(id,text)=>{if(seen[id]||S.hintAt>S.t-6)return;seen[id]=1;S.hintAt=S.t;persist();toast(text)};
  if(!g.awake){say('strain','You are chained. Strain ('+k.B+') pulls at your chains; until people start breaking them or forge a wake horn it only weakens them.');
    if(climbers().some(hunter))say('twitch','Someone is climbing you to hurt you (red edge on your body panel). '+(device==='touch'?'Tap that part of your body panel':'Pick that part with the arrows or a click on the panel')+', then Twitch ('+k.A+').');
    if(dreamTarget())say('dream','You hold a grudge against '+TOWNS[dreamTarget().i].name+'. Nightmare ('+k.X+') sends the beasts of the land against it.');
    if(chainsOpen())say('open','People are after your chains now: Strain can tear them loose too, and once all four are gone you can rise.')}
  else if(g.fallen>0)say('struggle','You are down! Press any action fast to Struggle up sooner.');
  else say('awake','You are awake. Walk with the stick or WASD; Stomp ('+k.A+') crushes around your feet, Shake ('+k.X+') throws off climbers, Smash ('+k.B+') and Swipe ('+k.Y+') need towns to brace you.')}
// the dusk honour goes to whoever stands first in the giant's regard: say so when that changes to or from you
function watchFavour(){if(!S.reg||S.g.dead)return;const f=favoredPerson();if(!f||!(S.reg[f.id]>20))return;const me=f===S.you;
  if(S.eyeOn===undefined)S.eyeOn=false;
  if(me!==S.eyeOn&&S.t-(S.eyeSaid||-99)>20){S.eyeSaid=S.t;S.eyeOn=me;toast(me?'The giant\u2019s eye settles on you: you stand first in its regard. Keep it there until dusk.':'The giant\u2019s eye turns from you to '+whoOf(f)+'.')}
  else if(me!==S.eyeOn&&S.t-(S.eyeSaid||-99)<=20){}else S.eyeOn=me}
const skillEl=document.getElementById('skillbar');let skSig='';
skillEl.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-sk]');if(!el||!S||!S.you||menu)return;e.preventDefault();e.stopPropagation();const k=el.dataset.sk;if(k==='talent')openTalents();else if(k==='ride')toggleRide(S.you);else useSkill(S.you,k)});
function paintSkills(){const h=S&&S.you;if(!h||FILM||S.role!=='human'){if(skSig){skSig='';skillEl.innerHTML=''}return}
  const ic={cry:'\u{1F4E3}',whirl:'\u{1F300}',mend:'\u271A',spear:'\u{1F531}',quake:'\u{1F4A5}'},parts=SKILLS.filter(k=>h.lvl>=k.lvl).map(k=>{const lock=h.lvl<k.lvl,c=Math.max(0,((h.skCd&&h.skCd[k.id])||0)-S.t),tot=k.cd*(1-.25*perk(h,'focus'));
    return `<div class="sk${lock?' off':c<=0&&h.mode==='ground'?' ready':''}" data-sk="${k.id}" title="${k.text}"><span class="ky">${k.key}</span><span class="ic">${ic[k.id]}</span>${lock?'Lv '+k.lvl:k.name}${!lock&&c>0?`<div class="cdv" style="height:${Math.round(c/tot*100)}%"></div><div class="cdn">${Math.ceil(c)}</div>`:''}</div>`});
  if(h.picks>0)parts.push(`<div class="sk tal" data-sk="talent"><span class="ky">T</span><span class="ic">\u2605</span>Talent</div>`);
  if(h.horse)parts.push(`<div class="sk${h.riding?' ready':h.horse.away>S.t?' off':''}" data-sk="ride"><span class="ky">R</span><span class="ic">\u{1F40E}</span>${h.riding?'Riding':h.horse.away>S.t?Math.ceil(h.horse.away-S.t)+' s':'Ride'}</div>`);
  const f=Math.round(h.xp/(h.lvl*50)*100),sig=`<div class="xpt">Level ${h.lvl} \u00b7 ${h.xp}/${h.lvl*50} XP${h.buff&&h.buff.until>S.t?' \u00b7 '+SHRINES[h.buff.k].n.replace('Shrine of ','Blessed: ')+' '+Math.ceil(h.buff.until-S.t)+'s':''}${h.combo&&S.t-h.comboT<.9?' \u00b7 combo '+h.combo+'/3':''}${S.goals&&!tutActive()?' \u00b7 goals '+S.goals.filter(g=>g.done).length+'/3':''}</div><div class="xpb"><i style="width:${f}%"></i></div><div class="skrow">${parts.join('')}</div>`;if(sig!==skSig){skSig=sig;skillEl.innerHTML=sig}}
function paintHud(){paintSkills();paintRes();if(!S){if(hudSig!=='t'){hudSig='t';hud1.innerHTML='<b>Colossus</b>';hud2.textContent='A giant, three towns, and the people who climb it.'}return}
  let a,b,n;const chip=(label,val,f,extra)=>`<span class="chip${extra||''}">${label} <b>${val}</b>${f!=null?`<i class="bar${f<.3?' low':f<.6?' mid':''}" style="width:${Math.round(clamp(f,0,1)*100)}%"></i>`:''}</span>`;
  paintPanel();
  if(S.role==='giant'){const J=S.joints,g=S.g,pc=id=>Math.ceil(J[id].hp/J[id].max*100)+'%'+(J[id].crip?' crippled':'');
    const jf=id=>J[id].hp/J[id].max,worst=Math.min(jf('kneeL'),jf('kneeR'),jf('elbowL'),jf('elbowR'),jf('neck'));
    a=chip('Heart',pc('heart'),jf('heart'))+chip('Joints',Math.round(worst*100)+'% worst',worst)+chip('Braces',braces()+'/5');
    {const ts=giantTasks(),n=ts.filter(x=>x.done).length;a+=chip('Tasks',n+'/'+C.GIANT_TASKS,n/C.GIANT_TASKS,' goal')+chip('Climbers',climbers().length);S.taskLine=ts.map(x=>x.name+(x.done?' \u2713':' '+({Freed:S.chains.filter(c=>c.hp<=0).length+'/4',Braced:braces()+'/3',Wanderer:Math.floor(S.walked/100)/10+'k/'+C.WANDER/1000+'k'}[x.name]||'\u2717'))).join(' \u00b7 ')}
    b=!g.awake?(S.waker?'<span class="k">A horn sounds</span> at your head '+Math.round(S.wakeT/C.WAKE_TIME*100)+'%':allWeak()?'<span class="k">Free</span> strain once more to rise':'<span class="k">Chained</span> twitch off hunters, strain at your chains · aiming: '+ZONES[aimZone()]):g.fallen>0?'<span class="k">Down</span> '+Math.ceil(g.fallen)+' s':'';b=(b?b+'<br>':'')+'<span style="font-weight:500;font-size:.78rem">'+S.taskLine+'</span>'}
  else{const h=S.you;
    a=chip('HP',Math.ceil(h.hp)+'/'+h.max,h.hp/h.max)+(h.job?chip('Building',h.job.k,h.job.t/h.job.dur,' goal'):'')+(h.mode==='climb'?chip('Grip',Math.ceil(Math.max(0,h.grip)),h.grip/maxGrip(h))+chip('Height',Math.round(h.cl.y*FT)+' ft'):chip('Lv',h.lvl,h.xp/(h.lvl*50)))+(h.horse&&h.mode==='ground'?chip('Horse',h.riding?'riding':h.horse.away>S.t?'back in '+Math.ceil(h.horse.away-S.t)+' s':'R to ride',h.horse.hp/h.horse.max):'')+
      chip('Pack',packCount(h)+'/'+packCap(h),1-packCount(h)/packCap(h))+(h.horn?chip('Horn','ready'):'');
    b=tutActive()?tutJournal(h):questTracker(h)}
  const sig=a+b;if(sig!==hudSig){hudSig=sig;hud1.innerHTML=a;goalEl.innerHTML=b||''}}
const goalEl=document.getElementById('goal');
// the first day's journal: the chapter, its progress, each open goal (the tracked one marked), and goals just done
function tutJournal(h){const T=S.tut,C2=CHAPTERS[T.ch],tr=tutTracked(),chGoals=FIRST_DAY.filter(g=>g.ch===T.ch&&!g.lesson),n=chGoals.filter(g=>T.done_[g.id]).length;
  const head='<span class="k">'+(T.ch?'Chapter '+T.ch+' \u00b7 ':'')+C2.name+'</span>'+(T.ch===1?' \u00b7 '+n+' of 4':T.ch===2?' \u00b7 '+n+' of 4 to build or buy':'');
  const lines=tutGoals().sort((a,b)=>(b.ch===T.ch)-(a.ch===T.ch)).map(g=>'<div class="jg'+(g===tr?' tr':'')+(g.ch<T.ch?' old':'')+'" data-goal="'+g.id+'">'+(g===tr?'\u25b8 ':'\u25cb ')+g.name+(g.count&&g.count(h)?' '+g.count(h):'')+(g.req?' <b>needed</b>':g.lesson?' <i>lesson</i>':'')+'</div>');
  const just=FIRST_DAY.filter(g=>T.done_[g.id]&&S.t-T.done_[g.id]<6).map(g=>'<div class="jg dn">\u2713 '+g.name+'</div>');
  // collapsed (the default), the journal is the chapter and the goal the light follows; O or the arrow opens every goal
  const open=!!save.qOpen,tog=`<span class="qt" data-q="toggle" title="Journal (O)">${open?'\u25b4':'\u25be'} ${tutGoals().length}</span>`;
  if(!open)return'<div class="qh"><span>'+head+'</span>'+tog+'</div>'+(tr?'<div class="jg tr" data-goal="'+tr.id+'">\u25b8 '+tr.name+(tr.count&&tr.count(h)?' '+tr.count(h):'')+'</div>':'')+just.join('');
  return'<div class="qh">'+head+tog+'</div>'+lines.join('')+just.join('')+(T.ch===1&&tutLandmarks().length?'<div class="jg hint">Soft lights mark places you have not found</div>':'')}
goalEl.addEventListener('pointerdown',e=>{const qe=e.target.closest('[data-q]');if(qe&&S&&S.you&&!menu){e.preventDefault();e.stopPropagation();if(qe.dataset.q==='toggle')questToggle();else{S.you.track=qe.dataset.q;hudSig=''}hudSig='';return}
  const el=e.target.closest('[data-goal]');if(!el||!tutActive()||menu)return;e.preventDefault();e.stopPropagation();S.tut.track=el.dataset.goal;const g=tutGoal(el.dataset.goal);if(g&&!(g.target&&g.target(S.you)))toast(g.name+': '+g.hint)});

