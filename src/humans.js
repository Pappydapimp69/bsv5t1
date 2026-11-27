'use strict';
// Colossus · src/humans.js · humans: day and night, climbing on, the action buttons (humanCtx, humanAct), what can be built
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= humans =================
function townAt(h){return S.towns.find(t=>t.alive&&distSq(t,h)<(t.r+20)**2)||null}
function nearFoot(h){const g=S.g;if(g.dead)return -1;let best=-1,bd=1e9;g.feet.forEach((f,i)=>{if(f.air>0)return;const d=Math.hypot(f.x-h.x,f.y-h.y);if(d<C.FOOT_R+45&&d<bd){bd=d;best=i}});return best}
function nearMonster(h,r,allowed){let best=null,bd=r;for(const m of S.monsters){const limit=bd+m.r,d2=distSq(m,h);
  if(limit>0&&d2<limit*limit&&(!allowed||allowed(m))){bd=Math.sqrt(d2)-m.r;best=m}}return best}
const dayLen=()=>C.DUSK+C.NIGHT,phase=()=>S.t%dayLen(),isNight=()=>phase()>=C.DUSK,nightLock=()=>isNight()&&!S.g.awake;
function stepDays(dt){const n=isNight();if(n&&!S.night){S.night=true;S.duskAt=S.t;if(S.g.awake)S.verdictDue=true;else{for(const h of S.humans)if(h.mode==='climb'){const f=S.g.feet[h.leg?1:0];leaveClimb(h);h.x=f.x+60;h.y=f.y+60}announce('Dusk. Until morning no one can touch the chained giant.')}}
  if(!n&&S.night){S.night=false;S.day=(S.day||1)+1;announce('Day '+S.day+' begins.')}}
// passing showers: in some 5-minute stretches, a minute of light rain rolls over (presentation only, from the clock)
function shower(){if(!S||S.role!=='human')return 0;const c=Math.floor(S.t/300),u=S.t%300;if(((c*7+(S.seed||0))%3)!==0||u<150||u>230)return 0;const k=(u-150)/80;return .32*Math.sin(Math.PI*k)}
function duskStorm(){if(!S.night)return 0;const tot=S.chains.reduce((a,c)=>a+c.max,0),left=S.chains.reduce((a,c)=>a+Math.max(0,c.hp),0),w=.15+.85*(1-left/tot),u=S.t-S.duskAt;return w*Math.min(1,u/12)*Math.min(1,(C.NIGHT-u)/10)}
const GRAB_TIME=.24;
function footHold(h,leg,face){const middle=leg?21.5:10.5;
  if(!h.you)return middle;
  let nearest=middle,best=Infinity;
  for(let c=leg?18:6;c<=(leg?25:13);c++){if(!holdAt(c+.5,1.5))continue;
    const d=distSq(h,bodyWorld(c+.5,1.5,face));
    if(d<best&&bfs(1,c,(r,col)=>r>=46&&(col>=COLS/2)===!!leg,3000)){best=d;nearest=c+.5}}
  return nearest}
function mount(h,leg){if(nightLock()||S.g.dead)return false;
  const f=fwd(S.g),foot=S.g.feet[leg],front=(h.x-foot.x)*f.x+(h.y-foot.y)*f.y;
  const face=h.you&&front>=-1?1:-1,x=footHold(h,leg,face);
  const grab=h.you&&!reducedMotion?{x:h.x,y:h.y,t:S.t}:null;
  h.mode='climb';h.leg=leg;h.cl={x,y:1.5,face,grab,vy:0,fall:false,from:0,move:null,path:null};h.grip=maxGrip(h);h.tx=h.ty=null;h.rest=false;
  if(h.you){S.introCam=false;climbCam.x=x;climbCam.y=1.5}
  sayTo(h,'You grab the '+(leg?'right':'left')+' foot. Climb with care: grip drains, ledges refill it.');return true}
function interruptWake(h){h.waking=false;if(S.waker===h){S.waker=null;if(!S.g.awake)S.wakeT=Math.max(0,S.wakeT-3)}}
function leaveClimb(h){interruptWake(h);dropJob(h);h.mode='ground';h.cl=null;h.botClimb=null}
function dismount(h,hurt){const cl=h.cl,g=S.g,leg=h.you&&cl?(cl.x<COLS/2?0:1):h.leg,foot=g.feet[leg]||g.feet[0];
  const a=h.you&&cl?g.ang+(cl.face===1?0:Math.PI):rr(0,6.28),r=C.FOOT_R+40;
  leaveClimb(h);h.x=clamp(foot.x+Math.cos(a)*r,20,C.MAP-20);h.y=clamp(foot.y+Math.sin(a)*r,20,C.MAP-20);h.goal=null;
  if(hurt>0)hurtHuman(h,hurt,'fall')}
function fallDamage(cells){return Math.max(0,cells*FT-60)*.12}
function startFall(h){const cl=h.cl;if(cl.fall)return;interruptWake(h);cl.fall=true;cl.vy=0;cl.from=cl.y;cl.move=null;cl.path=null;h.grip=0;sfx('fall',h.you);sayTo(h,'Your grip fails!')}
// reach: every action on the giant targets the nearest chain, build spot or joint within C.REACH of the climber
function reachT(h){const cl=h.cl,R=C.REACH;let b={d:R+1e-6,j:null,s:null,ch:null,x:0,y:0};
  for(const ch of S.chains)if(ch.hp>0){const d=Math.hypot(ch.c+.5-cl.x,ch.r+.5-cl.y);if(d<b.d)b={d,j:null,s:null,ch,x:ch.c+.5,y:ch.r+.5}}
  for(const s of S.sites){const d=Math.hypot(s.c+.5-cl.x,s.r+.5-cl.y);if(d<b.d)b={d,j:null,s,ch:null,x:s.c+.5,y:s.r+.5}}
  for(const id in JOINTS){const q=JOINTS[id],x=clamp(cl.x,q.c0,q.c1+1),y=clamp(cl.y,q.r0,q.r1+1),d=Math.hypot(x-cl.x,y-cl.y);if(d<=b.d)b={d,j:id,s:null,ch:null,x,y}}
  return b}
// beside a planted foot the ankle chain on that leg can be struck from the ground
function footChain(h){const f=nearFoot(h);if(nightLock())return null;if(f<0)return null;return S.chains.find(c=>c.id===(f?'ankleR':'ankleL')&&c.hp>0)||null}
function strikeChain(h,ch){if(h.cd>0||nightLock()||!h.you&&!chainsOpen()||chainWeak(ch))return false;S.chainsStarted=1;h.cd=.5;h.swing=.2;ch.hurtT=S.t;ch.hp=Math.max(0,ch.hp-h.atk);h.chainHits=(h.chainHits||0)+1;if(!S.headless&&Math.random()<.3)chainClank(ch);sfx('hit',h.you);
  if(chainWeak(ch)){S.grudge[h.town]-=30;regard(h,30);gainXp(h,25);(S.chainFlash||(S.chainFlash={}))[ch.id]=S.t;if(!S.headless)chainClank(ch,true);chron(whoOf(h).replace(/^./,c=>c.toUpperCase())+' broke the '+ch.name+'.','chain',whoOf(h));announce('The '+ch.name+' breaks.'+(allWeak()?' All four chains are broken: a wake horn sounded at its head will wake it.':''))}return true}
// the giant's regard for each person: fed like the grudges but credited to whoever acted; fades the same way
function regard(h,a){if(!h||!S)return;S.reg=S.reg||{};S.reg[h.id]=(S.reg[h.id]||0)+a}
function favoredPerson(){const sc=x=>(S.reg&&S.reg[x.id]||0)-S.grudge[x.town]*1e-4;let f=null;for(const x of S.humans)if(factionAlive(x.town)&&(!f||sc(x)>sc(f)))f=x;return f}
function humanCtx(h){
  if(h.job&&!h.dead){const w={l:'Building '+Math.round(h.job.t/h.job.dur*100)+'%',why:'Building: hold on'};return{A:w,B:w,X:w,Y:w}}
  if(h.dead)return{A:{l:'Wait',why:'Respawning'},B:{l:'Wait',why:'Respawning'},X:{l:'Wait',why:'Respawning'},Y:{l:'Wait',why:'Respawning'}};
  if(h.mode==='climb'){const cl=h.cl,busy=cl.fall?'Falling':cl.grab?'Grabbing the foot':cl.move?'Moving':null;const rt=reachT(h),j=rt.j,s=rt.s;
    let A={l:'Strike',why:'No joint or site here'};
    const chH=rt.ch;
    if(chH)A={l:chainWeak(chH)?chH.name+': broken':'Strike '+chH.name,why:busy||(chainWeak(chH)?'Already broken':null)};
    if(j)A={l:'Strike '+JOINTS[j].name.toLowerCase(),why:busy||(!huntOpen()?'It sleeps as stone':null)};
    else if(s){if(s.build&&s.build.k==='cannon'&&s.build.town!==h.town)A={l:'Wreck cannon',why:busy};else if(s.build)A={l:'Upgrade '+s.build.k+(upCost(s.build.k,s.build)!=null?' ('+upCost(s.build.k,s.build)+' crystals)':''),why:busy||canUpgrade(h,s.build.k,s.build)};else{const kn=Object.keys(SITE_KITS).filter(k=>h.kits[k]).length;A={l:s.pending?'Being built':'Build at '+s.r*FT+' ft',why:busy||(s.pending?'Someone is building here':!kn?'No kits for the giant: buy them in town':null)}}}
    // a rival within arm's reach can be shoved: it costs them grip, and their town will remember the blow
    {const o=!j&&!s&&!chH?shoveTarget(h):null;if(o)A={l:'Shove '+(o.you?'the rival':TOWNS[o.town].name+'\u2019s '+(o.hero?'hero':'climber')),why:busy||(h.cd>0?'Steady yourself':h.grip<C.SHOVE_COST+5?'Grip too low':null)}}
    // at the head a carried wake horn takes the button over any joint or build spot there, or no one could sound it standing on the crown's ladder
    if(!S.g.awake&&cl.y>=C.WAKE_ROW&&(h.horn||!j&&!s))A={l:h.waking?'Waking '+Math.round(S.wakeT/C.WAKE_TIME*100)+'%':'Sound the wake horn',why:busy||(h.waking?'Hold still':S.waker&&S.waker!==h&&S.waker.waking?'Another horn is sounding':!h.horn?'Needs a wake horn: forge one in town from '+C.HORN_CRYSTALS+' sky crystals':!allWeak()?'The chains still hold: break all four first ('+S.chains.filter(c=>c.hp>0&&!chainWeak(c)).length+' left)':null)};
    const siteFree=s&&!s.build;
    const hasA=S.anchors.some(a=>a.r===Math.floor(cl.y)&&a.c===Math.floor(cl.x));
    const X=j&&S.joints[j].wedges.length?{l:'Pull wedge',why:busy}:j&&tends(h)&&S.joints[j].hp<S.joints[j].max-1&&!S.joints[j].crip?{l:'Tend the '+JOINTS[j].name.toLowerCase(),why:busy||(h.cd>0?'':null)}:{l:'Anchor ('+h.kits.anchor+')',why:busy||(!h.kits.anchor?'No anchor kits':hasA?'Anchor already here':null)};
    let Y;if(j){const jj=S.joints[j];Y={l:'Wedge ('+h.kits.wedge+')',why:busy||(!huntOpen()?'It sleeps as stone':null)||(!h.kits.wedge?'No wedges':jj.crip?'Already crippled':jj.wedges.length>=C.WEDGE_MAX?'No room for more':null)}}
    else Y={l:'Potion ('+(h.potions+h.bigPotions)+')',why:!(h.potions||h.bigPotions)?'No potions':h.hp>=h.max?'Full health':null};
    return{A,B:{l:'Lunge',why:busy||(h.grip<C.LUNGE_GRIP?'Grip too low':null)},X,Y}}
  const t=townAt(h),foot=nearFoot(h),at=attackTarget(h),m=at&&at.town==null?at:null,foe=at&&at.town!=null?at:null,up=upgradeTarget(h);
  return{A:(fc=>fc?{l:'Attack the '+fc.name,why:chainWeak(fc)?'Already broken':null}:(!m&&!foe&&critterNear(h)?{l:'Hunt the deer',why:null,sub:'Pelt and meat'}:{l:foe?'Attack '+TOWNS[foe.town].name:'Attack',why:m||foe?null:'Nothing in reach',sub:attackHint()}))(m||foe?null:footChain(h)),B:foot>=0||!up?{l:'Climb',why:foot>=0?(nightLock()?'Night: the chained giant cannot be touched':null):S.g.dead?'The giant is dead':'Stand by a planted foot'}:{l:'Upgrade '+up.label,why:up.why},
    X:t?{l:t.outpost?'Outpost':'Town',why:null}:h.treasure&&Math.hypot(h.treasure.x-h.x,h.treasure.y-h.y)<90?{l:'Dig up the treasure',why:null}:h.hero&&poiAct(h)?(a=>({l:a.l,sub:a.sub,why:a.why||null}))(poiAct(h)):h.hero&&cacheNear(h)?{l:'Search ruins',why:null}:barracksNear(h)?{l:'Barracks',why:null}:{l:'Build',why:null},Y:{l:'Potion ('+(h.potions+h.bigPotions)+')',why:!(h.potions+h.bigPotions)?'No potions':h.hp>=h.max?'Full health':null}}}
// climber against climber: rivals on the body within 1.8 cells; a shove costs you a little grip and them a lot
C.SHOVE_R=1.8;C.SHOVE_GRIP=35;C.SHOVE_COST=6;C.SHOVE_CD=1.5;C.SHOVE_FEUD=40;
function shoveTarget(h){if(h.mode!=='climb'||!h.cl||h.waking)return null;let b=null,bd=C.SHOVE_R;for(const o of climbers()){if(o===h||o.town===h.town||o.cl.fall)continue;const d=Math.hypot(o.cl.x-h.cl.x,o.cl.y-h.cl.y);if(d<bd){bd=d;b=o}}return b}
function shove(h,o){if(h.cd>0||h.grip<C.SHOVE_COST+5)return false;h.cd=C.SHOVE_CD;h.swing=.2;h.grip-=C.SHOVE_COST;o.grip-=C.SHOVE_GRIP;if(o.waking)interruptWake(o);
  S.feud[o.town][h.town]+=C.SHOVE_FEUD;S.shoves=(S.shoves||0)+1;sfx('hit',h.you||o.you);
  sayTo(h,'You shove '+(o.hero?TOWNS[o.town].name+'\u2019s hero':'a '+TOWNS[o.town].name+' climber')+'.');sayTo(o,whoOf(h).replace(/^./,c=>c.toUpperCase())+' shoves you! Your grip slips.');return true}
function placeAnchor(h){if(h.mode!=='climb'||!h.kits.anchor)return false;const r=Math.floor(h.cl.y),c=Math.floor(h.cl.x);if(S.anchors.some(a=>a.r===r&&a.c===c))return false;
  h.kits.anchor--;S.anchors.push({r,c,town:h.town});sfx('build',h.you);sayTo(h,'Anchor set at '+r*FT+' ft. It catches your people if they fall.');questTick(h,'anchor',r);return true}
// tending is offered to those who are on the giant's side (their town's way, or their own standing with it), so a hunter's
// anchor button stays an anchor beside the joints it is attacking
function tends(h){return townWay(h.town)==='tend'||(S.reg&&S.reg[h.id]||0)>0}
function drinkPotion(h){if(h.bigPotions){h.bigPotions--;h.hp=Math.min(h.max,h.hp+140);sayTo(h,'You drink a greater potion.')}
  else{h.potions--;h.hp=Math.min(h.max,h.hp+60);sayTo(h,'You drink a potion.')}return true}
function humanAct(h,slot,dir){const r=humanAct0(h,slot,dir);if(r&&h.sol&&h.ord&&(h.mode==='climb'||slot==='A'&&footChain(h)))h.workedAt=S.t;return r}
function humanAct0(h,slot,dir){const c=humanCtx(h)[slot];if(c.why){sayTo(h,c.why);return false}
  if(h.mode==='climb'){const cl=h.cl;
    // waking is not a press: you must hold still at its head while it stirs, through its shudders
    if(slot==='A'&&!S.g.awake&&cl.y>=C.WAKE_ROW&&(h.horn||(rt=>!rt.j&&!rt.s)(reachT(h)))){if(!h.horn||!allWeak()||S.waker&&S.waker!==h&&S.waker.waking)return false;h.waking=true;S.waker=h;if(!S.headless){announce(h.you?'You sound the wake horn. Hold still while it stirs.':TOWNS[h.town].name+' is sounding a wake horn at the giant\u2019s head!');hornCall()}if(!S.headless)giantCall('breath');return true}
    {const rt0=reachT(h),o=slot==='A'&&h.you&&!rt0.j&&!rt0.s&&!rt0.ch?shoveTarget(h):null;if(o)return shove(h,o)}
    {const ch=slot==='A'?reachT(h).ch:null;if(ch)return strikeChain(h,ch)}
    if(slot==='A'){if(h.cd>0)return false;h.cd=.5;h.swing=.2;const rt=reachT(h),j=rt.j,s=rt.s;
      if(j){damageJoint(j,h.atk,h);gainXp(h,1);sfx('hit',h.you);questTick(h,'strike');return true}
      if(s&&s.build&&s.build.town===h.town)return upgrade(h,s.build.k,s.build);
      if(s&&s.build&&s.build.town!==h.town){s.build.hp-=h.atk;sfx('hit',h.you);if(s.build.hp<=0){s.build=null;sayTo(h,'Cannon wrecked!');gainXp(h,20)}return true}
      if(s&&s.pending)return false;if(s&&!s.build){const ks=Object.keys(SITE_KITS).filter(k=>h.kits[k]);if(h.you&&!S.autoplay&&ks.length>1){openSiteMenu(h,s);return true}return placeOnSite(h,s,ks[0])}
      return false}
    if(slot==='B'){let dx=dir?dir.x:0,dy=dir?dir.y:1;if(Math.hypot(dx,dy)<.2){dx=0;dy=1}
      const t=pickHold(cl,dx,dy,C.LUNGE_REACH,C.REACH*.8);if(!t){sayTo(h,'No hold within a lunge that way.');return false}
      startLunge(h,t);cl.path=null;return true}
    if(slot==='X'&&reachT(h).j&&S.joints[reachT(h).j].wedges.length){const ws=S.joints[reachT(h).j].wedges;let i=ws.findIndex(w=>w.town!==h.town);if(i<0)i=0;ws.splice(i,1);
      h.kits.wedge++;S.grudge[h.town]-=C.PULL_FAVOR;regard(h,C.PULL_FAVOR);questTick(h,'tend',3);gainXp(h,8);sfx('build',h.you);sayTo(h,'You pull out a wedge. The giant remembers '+TOWNS[h.town].name+' kindly.');return true}
    // tending, the mirror of striking: soothe a hurt joint a little, and the giant remembers the kindness
    if(slot==='X'&&reachT(h).j){const id=reachT(h).j,jj=S.joints[id];if(tends(h)&&!jj.wedges.length&&jj.hp<jj.max-1&&!jj.crip){if(h.cd>0)return false;h.cd=.6;h.swing=.2;
      const hs=jj.hands||(jj.hands=new Map());hs.set(h.id,S.t);let n=0;for(const[k,t]of hs){if(S.t-t>1.2)hs.delete(k);else n++}
      const heal=Math.min(jj.max-jj.hp,C.TEND_HEAL*(n>C.JOINT_HANDS?C.JOINT_HANDS/n:1)*(id==='heart'&&S.g.fallen>0?.25:1)),fav=heal/C.TEND_HEAL*C.TEND_FAVOR;
      jj.hp+=heal;S.tendHp=(S.tendHp||0)+heal;S.grudge[h.town]-=fav;regard(h,fav);if(heal>=C.TEND_HEAL/2)questTick(h,'tend');gainXp(h,1);sfx('build',h.you);
      if(h.you&&S.t-(h.tendSaid||-99)>8){h.tendSaid=S.t;sayTo(h,'You tend the '+JOINTS[id].name.toLowerCase()+'. The giant feels it, and remembers '+TOWNS[h.town].name+' kindly.')}return true}}
    if(slot==='X'){h.kits.anchor--;S.anchors.push({r:Math.floor(cl.y),c:Math.floor(cl.x),town:h.town});sfx('build',h.you);sayTo(h,'Anchor set at '+Math.floor(cl.y)*FT+' ft. It catches your people if they fall.');questTick(h,'anchor',Math.floor(cl.y));return true}
    if(slot==='Y'){const j=reachT(h).j;if(j){h.kits.wedge--;if(h.you)h.wedged=(h.wedged||0)+1;S.firstWedge=S.firstWedge||{};if(!S.firstWedge[h.town]){S.firstWedge[h.town]=1;chron(whoOf(h).replace(/^./,c=>c.toUpperCase())+' drove '+(Object.keys(S.firstWedge).length===1?'the first':TOWNS[h.town].name+'\u2019s first')+' wedge into the '+(S.g.awake?'':'sleeping ')+'giant\u2019s '+JOINTS[j].name.toLowerCase()+'.')}S.joints[j].wedges.push({town:h.town,who:h.id});if(!S.headless&&Math.random()<.5)giantCall('pain');sfx('build',h.you);gainXp(h,8);sayTo(h,'Wedge driven into the '+JOINTS[j].name.toLowerCase()+'. It bleeds.');return true}
      return drinkPotion(h)}
    return false}
  if(slot==='A'){if(h.cd>0)return false;h.cd=.5;h.swing=.2;const at=attackTarget(h),m=at&&at.town==null?at:null;if(at&&!m){strikeHuman(h,at);return true}if(!at&&h.hero&&critterNear(h)){huntCritter(h,critterNear(h));return true}if(m){const cb=S.t-(h.comboT??-9)<.9?(h.combo||0)+1:1;h.combo=cb>=3?0:cb;h.comboT=S.t;const fin=cb>=3,crit=!!h.critNext||rnd()<.1+.1*charm(h,'tooth');h.critNext=0;
    const dm=Math.round((m.affix==='armoured'&&m.hp>m.max/2?.5:1)*h.atk*(h.riding?C.RIDE_HIT:1)*(h.cryT>S.t?1.3:1)*(buffOf(h,'might')?1.25:1)*(fin?1.6:1)*(crit?1.8:1));if(perk(h,'cleave'))for(const o of S.monsters.slice())if(o!==m&&Math.hypot(o.x-h.x,o.y-h.y)<70+o.r)hitBeast(h,o,Math.round(dm*.6));m.hp-=dm;m.hitT=S.t;if(m.hp>0)warlordPhase(m);if(!S.headless&&(h.you||nearPlayer(m))){S.fx.push({k:'spark',x:m.x,y:m.y,z:m.kind==='troll'?60:30,t:0,life:.25,col:crit?'#fff05a':'#ffe6a0'});if(h.you)S.fx.push({k:'slash',x:h.x,y:h.y,a:Math.atan2(m.y-h.y,m.x-h.x),t:0,life:.16,big:fin||crit})}if(charm(h,'blood'))h.hp=Math.min(h.max,h.hp+3);if(fin&&m.wind){m.wind=null;m.rec=.5}onBlow(h,m,dm,fin?.45:crit?.25:0);if(h.you){S.fx.push({k:'txt',x:m.x,y:m.y,z:m.kind==='troll'?80:40,text:'-'+dm+(crit?' CRIT':'')+(fin?' x3':h.riding?' charge':''),t:0,life:crit||fin?1.1:.8,col:crit?'#fff05a':fin?'#ffb347':'#ffe6a0',big:crit||fin});if(crit)shake(5)}sfx('hit',h.you||nearPlayer(m));if(m.hp<=0)killMonster(m,h);return true}{const ch=footChain(h);if(ch){h.cd=0;return strikeChain(h,ch)}}return false}
  if(slot==='B'){if(nearFoot(h)<0){const up=upgradeTarget(h);if(up)return up.act();return false}return mount(h,nearFoot(h))}
  if(slot==='X'){const t=townAt(h),c=h.hero&&cacheNear(h);if(!t&&digTreasure(h))return true;if(!t&&h.hero&&poiAct(h))return usePoi(h,poiNear(h));if(!t&&c)return searchCache(h,c);if(h.you){if(t)openTown(t);else if(barracksNear(h))openBarracks(barracksNear(h));else openBuild();return true}return false}
  if(slot==='Y')return drinkPotion(h);
  return false}
// what people build out in the world: houses thicken a settlement's walls, towers shoot beasts, an outpost founds a new settlement
function canBuild(h,k,placement=k==='barracks'?barracksPlacement(h):null){if(!h.hero)return'Only town heroes can build';
  if(placement?.why)return placement.why;
  if(h.job)return'Finish your current build first';
  const onLake=S.prints.some(p=>Math.hypot(p.x-h.x,p.y-h.y)<C.FOOT_R*1.2);
  if(h.gold<C.COST[k])return'Need '+(C.COST[k]-h.gold)+' more gold';if(onLake)return'Not in the lake';
  if(S.builds.some(b=>Math.hypot(b.x-h.x,b.y-h.y)<45)||S.humans.some(o=>o.job&&o.job.kind==='ground'&&Math.hypot(o.job.x-h.x,o.job.y-h.y)<45))return'Too close to another building';
  if(k==='outpost')return !outpostSiteOpen(h.x,h.y)?'Too near a settlement':S.outposts[h.town]+pendingSettlers(h.town)>=3?'Your people have already founded three outposts':S.events.some(e=>e.k==='caravan'&&e.site&&Math.hypot(e.site.x-h.x,e.site.y-h.y)<C.OUTPOST_GAP)?'Settlers are already on their way near here':!firstTown(h.town)?'No town to send settlers from':null;
  if(k==='barracks')return null;
  if(CIVIC[k])return civicWhy(h,k);
  if(k==='house'){const t=nearestOwn(h.town,h.x,h.y);if(t&&(t.houses||0)>=houseCap(t))return t.name+' (level '+lv(t)+') has room for '+houseCap(t)+' houses: raise it for more'}
  return inTerritory(h.town,h.x,h.y)?null:'Outside your build area: build nearer your homes'}
