'use strict';
// Colossus · src/rpg/hero.js · levels, talents, charms, crafting, the hero sheet, skills, hits on beasts, kills
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

function gainXp(h,x){h.xp+=Math.round(x*(1+.2*charm(h,'knot')));while(h.xp>=h.lvl*50){h.xp-=h.lvl*50;h.lvl++;h.max+=15;h.hp=h.max;h.atk+=3;
    if(h.lvl===5)h.rerolls=(h.rerolls??1)+1;if(h.hero){h.picks=(h.picks||0)+1;if(!h.you||S.autoplay)autoTalent(h)}
    while(h.bag&&h.bag.length&&(h.charms||[]).length<charmSlots(h)){const id=h.bag[0];equipCharm(h,id);if(h.you)toast('A new charm slot: you wear the '+CHARMS[id].n+'.')}
    if(h.you){const sk=SKILLS.find(k=>k.lvl===h.lvl);toast('Level '+h.lvl+'! Press T to choose a talent.'+(sk?' New skill: '+sk.name+' ('+sk.key+').':''));sfx('fanfare');S.lvlFx=S.t;S.fx.push({k:'lvl',x:h.x,y:h.y,z:0,t:0,life:1.6});S.fx.push({k:'ring',x:h.x,y:h.y,r:160,t:0,life:.9,col:'#ffd27a'})}}}
// Talents and skills (owner's request: skills and RPG elements). Each level a hero picks one talent of three, Hades and
// Vampire Survivors style (pick 1 of 3, effects you feel at once), and levels 2, 3 and 5 unlock an active skill on keys 1-3.
const TALENTS=[
  {id:'vigor',name:'Vigor',text:'+30 most health',max:3,on:h=>{h.max+=30;h.hp+=30}},
  {id:'brawler',name:'Brawler',text:'+4 damage on every blow',max:3,on:h=>{h.atk+=4}},
  {id:'hide',name:'Thick hide',text:'Take 3 less from every blow',max:2,on:h=>{h.def=(h.def||0)+3}},
  {id:'swift',name:'Swift',text:'Move 12% faster on foot and horseback',max:2},
  {id:'blood',name:'Bloodthirst',text:'Heal 8 for every beast you kill',max:2},
  {id:'plunder',name:'Plunder',text:'Beasts drop 50% more gold for you',max:2},
  {id:'cleave',name:'Cleave',text:'Your strikes also hit every other beast in reach',max:1},
  {id:'feet',name:'Quick feet',text:'Dodge comes back 40% sooner',max:1},
  {id:'wind',name:'Second wind',text:'Once a minute, falling under a quarter of health heals you 40',max:1},
  {id:'grip',name:'Iron grip',text:'+40 grip on the giant',max:2},
  {id:'focus',name:'Battle focus',text:'Skills come back 25% sooner',max:2},
  {id:'rider',name:'Horse lord',text:'Your horse runs 20% faster and never throws you',max:1},
  {id:'thunder',name:'Thunder cry',text:'War cry reaches half again as far and hurts twice as much',max:1,lvl:2},{id:'storm',name:'Blade storm',text:'Whirlwind reaches 40% further',max:1,lvl:3},{id:'deep',name:'Deep mend',text:'Mend heals 70% instead of 40%',max:1,lvl:5}];
const perk=(h,id)=>(h.perks&&h.perks[id])||0;
function talentChoices(h){const pool=TALENTS.filter(t=>perk(h,t.id)<t.max&&(t.id!=='rider'||h.horse)&&(!t.lvl||h.lvl>=t.lvl));const out=[];while(out.length<3&&pool.length)out.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);return out}
function takeTalent(h,t){if(!(h.picks>0))return false;h.picks--;h.perks=h.perks||{};h.perks[t.id]=(h.perks[t.id]||0)+1;if(t.on)t.on(h);h.offer=null;if(h.you){toast('Talent: '+t.name+'. '+t.text+'.');sfx('coin')}return true}
function autoTalent(h){const c=talentChoices(h);if(c.length)takeTalent(h,c[0])}
// charms (Ghost of Tsushima's charm slots): loot that changes how you play, worn in 2 slots, 3 at level 4, 4 at level 7.
// Alphas always drop one, camp chests often, the Rim Warlord drops its crown, the merchant sells them.
const CHARMS={tooth:{n:'Wolf-tooth charm',t:'+10% chance to crit'},hide:{n:'Boar-hide charm',t:'Take 5 less from every blow'},heart:{n:'Troll-heart charm',t:'+40 most health',on:[0,40]},
  feather:{n:'Hawk feather',t:'Move 10% faster'},ember:{n:'Ember stone',t:'Whirlwind hits 50% harder'},knot:{n:'Elder\u2019s knot',t:'+20% XP'},bell:{n:'Rider\u2019s bell',t:'Your horse never throws you'},
  coin:{n:'Miser\u2019s coin',t:'+25% gold from beasts and chests'},moon:{n:'Moon shard',t:'Skills come back 15% sooner'},blood:{n:'Bloodstone',t:'Heal 3 on every strike that lands'},
  crown:{n:'Warlord\u2019s crown',t:'+8 damage and +60 most health',on:[8,60],rare:1}};
// crafting at the Forge from the hides you bring home (pelts from beasts and deer): a reason to hunt
const CRAFTS=[{id:'cloak',n:'Fur cloak',t:'+25 most health',hides:4,once:1,on:h=>{h.max+=25;h.hp+=25}},{id:'satchel',n:'Trapper\u2019s satchel',t:'Carry 2 more in your pack',hides:3,once:1,on:h=>{h.packBonus=(h.packBonus||0)+2}},
  {id:'boots',n:'Hide boots',t:'Move 8% faster',hides:5,once:1,on:h=>{h.boots=1}},{id:'fetish',n:'Bone fetish',t:'A random charm',hides:6,cr:4,on:h=>giveCharm(h)}];
const charmSlots=h=>2+(h.lvl>=4?1:0)+(h.lvl>=7?1:0)+(h.extraSlot||0);
const charm=(h,id)=>h.charms&&h.charms.includes(id)?1:0;
function giveCharm(h,id){if(!id){const pool=Object.keys(CHARMS).filter(k=>!CHARMS[k].rare&&!(h.charms||[]).includes(k)&&!(h.bag||[]).includes(k));if(!pool.length){h.gold+=40;return null}id=pool[Math.floor(rnd()*pool.length)]}
  (h.stat=h.stat||{}).charm=(h.stat.charm||0)+1;h.bag=h.bag||[];h.charms=h.charms||[];if(h.charms.length<charmSlots(h))equipCharm(h,id);else h.bag.push(id);
  if(h.you){announce('Charm found: '+CHARMS[id].n+' ('+CHARMS[id].t.toLowerCase()+').'+(h.charms.includes(id)?' Worn.':' In your bag: wear it from your hero sheet (I).'));sfx('coin')}return id}
function equipCharm(h,id){h.charms=h.charms||[];h.bag=(h.bag||[]).filter(k=>k!==id);if(h.charms.length>=charmSlots(h)||h.charms.includes(id))return false;h.charms.push(id);const o=CHARMS[id].on;if(o){h.atk+=o[0];h.max+=o[1]}return true}
function removeCharm(h,id){if(!charm(h,id))return false;h.charms=h.charms.filter(k=>k!==id);(h.bag=h.bag||[]).push(id);const o=CHARMS[id].on;if(o){h.atk-=o[0];h.max-=o[1];h.hp=Math.min(h.hp,h.max)}return true}
// the character sheet (I): everything the hero has become, in one place
function openSheet(){const h=S&&S.you;if(!h)return;const gear=Object.keys(GEAR).map(k=>h.gear[k]?GEAR[k][h.gear[k]-1].n:'No '+k).join(', ');
  const tal=TALENTS.filter(t=>perk(h,t.id)).map(t=>'<b>'+t.name+(perk(h,t.id)>1?' x'+perk(h,t.id):'')+'</b> '+t.text.toLowerCase()).join('<br>')||'None yet: level up and press T';
  const sk=SKILLS.map(k=>'<b>'+k.key+' '+k.name+'</b> '+(h.lvl<k.lvl?'(level '+k.lvl+')':k.text.toLowerCase())).join('<br>');
  const bf=h.buff&&h.buff.until>S.t?SHRINES[h.buff.k].n.replace('Shrine of ','Blessing of ')+' ('+Math.ceil(h.buff.until-S.t)+' s)':'none';
  const g=h.saga&&!h.saga.done&&SAGA[h.saga.i];
  openMenu({title:'Your hero \u00b7 level '+h.lvl,body:`<p><b>Health</b> ${Math.ceil(h.hp)}/${h.max} \u00b7 <b>Damage</b> ${h.atk} \u00b7 <b>Armour</b> ${h.def||0} \u00b7 <b>XP</b> ${h.xp}/${h.lvl*50}</p>
    <p class="dim"><b>Gear</b> ${gear}. <b>Horse</b> ${h.horse?'level '+(h.horse.lv||1)+', '+Math.ceil(h.horse.hp)+'/'+h.horse.max+(h.riding?' (riding)':''):'none'}. <b>Blessing</b> ${bf}. <b>Hound</b> ${h.hound?(h.hound.rest>0?'resting':'at your heel'):'none (a stable or the merchant)'}.</p>
    <p><b>Today\u2019s goals</b> (5 renown each)<br>${matchGoals().map(g=>(g.done?'\u2713 ':'\u25cb ')+g.t+(g.done?'':' '+goalProg(h,g)+'/'+g.n)).join('<br>')}</p>
    <p class="dim"><b>Charms</b> (${(h.charms||[]).length}/${charmSlots(h)} worn)<br>${(h.charms||[]).map(k=>'<b>'+CHARMS[k].n+'</b> '+CHARMS[k].t.toLowerCase()).join('<br>')||'None: alphas, camp chests and the merchant have them'}</p>
    <p class="dim"><b>Talents</b><br>${tal}</p><p class="dim"><b>Skills</b><br>${sk}</p>
    <p class="dim"><b>Job</b> ${h.quest?h.quest.text+' '+Math.min(h.quest.n,h.quest.need)+'/'+h.quest.need:'none (the board in town)'}. <b>Tale</b> ${h.saga?h.saga.done?'told':g.text.replace(/^The elders\u2019 tale: /,''):'offered after two jobs'}. <b>Stones read</b> ${Object.keys(h.lore||{}).length}/${LORE.length}.</p><p class="dim"><b>Deeds</b> ${(h.stat&&h.stat.slay)||0} beasts slain, ${h.campsBroken||0} camps broken, ${(h.stat&&h.stat.hunt)||0} deer, ${(h.stat&&h.stat.treasure)||0} treasures, ${(h.stat&&h.stat.duel)||0} duels won, ${h.perfects||0} perfect dodges${h.title?'. Title: '+h.title:''}.</p>`,
    items:[...(h.picks>0?[{label:'Choose a talent ('+h.picks+')',act:openTalents}]:[]),...(h.charms||[]).map(k=>({label:'Take off '+CHARMS[k].n,sub:CHARMS[k].t,act:()=>{removeCharm(h,k);openSheet()}})),...(h.bag||[]).map(k=>({label:'Wear '+CHARMS[k].n,sub:CHARMS[k].t,why:(h.charms||[]).length>=charmSlots(h)?'All '+charmSlots(h)+' slots full: take one off':null,act:()=>{equipCharm(h,k);openSheet()}})),{label:'Close',act:closeMenu}],back:closeMenu})}
function openTalents(){const h=S&&S.you;if(!h)return;if(!(h.picks>0)){toast('No talent to choose yet: level up first.');return}
  h.offer=h.offer&&h.offer.length?h.offer:talentChoices(h);const owned=TALENTS.filter(t=>perk(h,t.id)).map(t=>t.name+(perk(h,t.id)>1?' x'+perk(h,t.id):'')).join(', ');
  openMenu({title:'Choose a talent'+(h.picks>1?' ('+h.picks+' to choose)':''),body:'<p class="dim">Level '+h.lvl+'. '+(owned?'Yours: '+owned+'.':'Pick one; you get another every level.')+'</p>',
    items:[...h.offer.map(t=>({label:t.name+(perk(h,t.id)?' ('+(perk(h,t.id)+1)+')':''),sub:t.text,act:()=>{takeTalent(h,t);if(h.picks>0)openTalents();else closeMenu()}})),{label:'Reroll the three'+(h.rerolls==null?' (1 left)':' ('+h.rerolls+' left)'),sub:'One reroll a match, another at level 5',why:(h.rerolls??1)<=0?'No rerolls left':null,act:()=>{h.rerolls=(h.rerolls??1)-1;h.offer=talentChoices(h);openTalents()}}],back:()=>closeMenu()})}
const SKILLS=[
  {id:'cry',key:'1',name:'War cry',lvl:2,cd:20,text:'Staggers and hurts beasts around you; you and nearby friends hit 30% harder for 8 s'},
  {id:'whirl',key:'2',name:'Whirlwind',lvl:3,cd:9,text:'A spinning blow at every beast in reach'},
  {id:'mend',key:'3',name:'Mend',lvl:5,cd:45,text:'Heal 40% of your health'},
  {id:'spear',key:'4',name:'Spear',lvl:4,cd:6,text:'Throw a spear at the nearest beast within 450: double damage, staggers it'},
  {id:'quake',key:'5',name:'Earthshaker',lvl:7,cd:60,text:'Slam the ground: 2.5x damage to every beast within 240 and stuns them for 2 s'}];
function skillWhy(h,k){if(h.lvl<k.lvl)return'Unlocks at level '+k.lvl;if(h.dead)return'Dead';if(h.mode!=='ground')return'Not on the giant';const c=(h.skCd&&h.skCd[k.id]||0)-S.t;return c>0?'Ready in '+Math.ceil(c)+' s':null}
function useSkill(h,id){const k=SKILLS.find(q=>q.id===id),w=skillWhy(h,k);if(w){if(h.you)toast(k.name+': '+w);return false}
  (h.skCd=h.skCd||{})[id]=S.t+k.cd*(1-.25*perk(h,'focus'))*(1-.15*charm(h,'moon'));h.swing=.2;
  const near=r=>S.monsters.filter(m=>Math.hypot(m.x-h.x,m.y-h.y)<r+m.r);
  if(id==='cry'){const cr=perk(h,'thunder')?330:220;for(const m of near(cr)){hitBeast(h,m,Math.round(h.atk*.8*(perk(h,'thunder')?2:1)));m.wind=null;m.rec=Math.max(m.rec||0,1.2);m.cd=Math.max(m.cd||0,1.2)}
    for(const o of S.humans)if(o.town===h.town&&!o.dead&&Math.hypot(o.x-h.x,o.y-h.y)<400)o.cryT=S.t+8;S.fx.push({k:'ring',x:h.x,y:h.y,r:perk(h,'thunder')?330:220,t:0,life:.6,col:'#ffcf6a'});shake(8);if(!S.headless)sfx('cry',h.you||nearPlayer(h))}
  if(id==='whirl'){const wr=perk(h,'storm')?133:95;for(const m of near(wr))hitBeast(h,m,Math.round(h.atk*1.5*(1+.5*charm(h,'ember'))));S.fx.push({k:'ring',x:h.x,y:h.y,r:wr,t:0,life:.35,col:'#d6d9de'});if(!S.headless)sfx('whoosh',h.you||nearPlayer(h))}
  if(id==='spear'){const tg=S.monsters.filter(m=>Math.hypot(m.x-h.x,m.y-h.y)<450).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];if(!tg){h.skCd.spear=S.t+.5;if(h.you)toast('Spear: no beast within 450');return false}
    if(!S.headless)S.fx.push({k:'arrow',x:h.x,y:h.y,x2:tg.x,y2:tg.y,t:0,life:.2});h.face=Math.atan2(tg.y-h.y,tg.x-h.x);tg.wind=null;tg.rec=Math.max(tg.rec||0,.9);hitBeast(h,tg,Math.round(h.atk*2));if(!S.headless)sfx('whoosh',h.you)}
  if(id==='quake'){for(const m of near(240)){m.wind=null;m.rec=Math.max(m.rec||0,2);m.cd=Math.max(m.cd||0,2);hitBeast(h,m,Math.round(h.atk*2.5))}if(!S.headless){for(let r=0;r<3;r++)S.fx.push({k:'ring',x:h.x,y:h.y,r:120+r*60,t:-r*.08,life:.7,col:'#e8c070'});for(let k=0;k<8;k++)S.fx.push({k:'dust',x:h.x+Math.cos(k*.785)*80,y:h.y+Math.sin(k*.785)*80,t:0,life:1.1});shake(16);sfx('stomp',h.you||nearPlayer(h))}}
  if(id==='mend'){const a=Math.round(h.max*(perk(h,'deep')?.7:.4));h.hp=Math.min(h.max,h.hp+a);if(h.you)S.fx.push({k:'txt',x:h.x,y:h.y,z:90,text:'+'+a,t:0,life:1,col:'#9be08a'});S.fx.push({k:'ring',x:h.x,y:h.y,r:60,t:0,life:.6,col:'#9be08a'})}
  return true}
// one blow at a beast from a person: damage number, kill, and the cry's bonus
// the Rim Warlord fights in phases: at half health it howls for its pack, at a quarter it rages (faster, harder)
function warlordPhase(m){if(!m.warlord)return;const f=m.hp/m.max;if(!m.ph1&&f<=.5){m.ph1=1;for(let k=0;k<4;k++){const a=k*1.57;S.monsters.push({id:S.nextId++,kind:'wolf',x:m.x+Math.cos(a)*120,y:m.y+Math.sin(a)*120,hx:m.x,hy:m.y,hp:45,max:45,atk:8,gold:10,xp:14,r:13,cd:.5})}if(!S.headless){announce('The Rim Warlord howls: its pack answers!');shake(10)}}
  if(!m.ph2&&f<=.25){m.ph2=1;m.atk=Math.round(m.atk*1.4);m.swift=1;if(!S.headless){announce('The Rim Warlord rages!');shake(12)}}}
function hitBeast(h,m,d){if(m.affix==='armoured'&&m.hp>m.max/2)d=Math.ceil(d/2);if(!S.headless&&(h.you||nearPlayer(m)))S.fx.push({k:'spark',x:m.x,y:m.y,z:m.kind==='troll'?60:30,t:0,life:.25,col:'#ffe6a0'});if(h.cryT>S.t)d=Math.round(d*1.3);if(buffOf(h,'might'))d=Math.round(d*1.25);m.hp-=d;m.hitT=S.t;if(m.hp>0)warlordPhase(m);if(h.you||nearPlayer(m))S.fx.push({k:'txt',x:m.x,y:m.y,z:m.kind==='troll'?80:40,text:'-'+d,t:0,life:.8,col:'#ffe6a0'});if(m.hp<=0)killMonster(m,h);return d}
function removeMonster(i){const [m]=S.monsters.splice(i,1);
  if(m.wild&&m.kind==='wolf'&&S.monsters.length>=C.MONSTERS&&S.monsters.length<WOLF_REFILL_LIMIT)spawnMonster(true)}
function killMonster(m,h){if(!S.headless&&(h&&h.you||nearPlayer(m))){(S.bodies=S.bodies||[]).push({x:m.x,y:m.y,r:m.r*1.6,t:S.t});if(S.bodies.length>40)S.bodies.shift()}if(h&&m.raid){(m.raid.killers=m.raid.killers||{})[h.id]=1}if(!S.headless&&(h&&h.you||nearPlayer(m)))sfx('kill',true);const i=S.monsters.indexOf(m);if(i>=0)removeMonster(i);if(!h)return;{const gg=Math.round(m.gold*.5*(1+.5*perk(h,'plunder'))*(1+.25*charm(h,'coin')));h.gold+=gg;if(h.you&&!S.headless)S.fx.push({k:'txt',x:m.x+20,y:m.y,z:70,text:'+'+gg+' gold',t:0,life:1.2,col:'#ffd27a'})}if(perk(h,'blood'))h.hp=Math.min(h.max,h.hp+8*perk(h,'blood'));
  {const cr=m.kind==='troll'?2:rnd()<.4?1:0,pe=m.kind==='troll'?1:rnd()<.7?1:0;const a=packAdd(h,'crystals',cr),b=packAdd(h,'pelts',pe);if(h.you&&(a||b))toast('The '+m.kind+' drops '+[a?a+' sky crystal'+(a>1?'s':''):'',b?'a pelt':''].filter(Boolean).join(' and ')+' ('+packCount(h)+'/'+packCap(h)+' in pack).')}gainXp(h,m.xp);if(h.you)sfx('coin');questTick(h,'slay');if(m.kind==='troll')questTick(h,'troll');if(m.elite&&!h.you&&h.hero&&S.you&&!S.headless)eventSay(whoOf(h).replace(/^./,c=>c.toUpperCase())+' slew '+m.elite+'.');if(m.champion){(h.stat=h.stat||{}).duel=(h.stat.duel||0)+1;h.title='Champion';if(h.you)announce('You beat '+m.elite+' in a duel! Folk now call you Champion.')}if(m.warlord){questTick(h,'warlord');giveCharm(h,'crown')}else if(m.elite)giveCharm(h);else if(m.kind==='troll'&&rnd()<.08)giveCharm(h);if(m.elite){questTick(h,'bounty',m.baseName||m.elite);if(h.you){announce('You slew '+m.elite+'!');shake(10)}}}
// quests come from the town board, which cycles. Early on only fetch, kill and build work is posted; the giant is never
// a quest you must take: later boards add climbing it and tending its wounds, never striking it.
