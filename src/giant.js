'use strict';
// Colossus · src/giant.js · messages, the giant on the ground: walking, feet, chains, waking, its actions
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= messages =================
let toastT=0;const toastEl=document.getElementById('toast');
const feedEl=document.getElementById('feed');let feed=[];
// messages queue instead of overwriting each other; a repeat folds into the one already showing
function toast(s){const last=feed[feed.length-1];if(last&&last.text===s){last.n++;last.t=Math.max(last.t,3);return}feed.push({text:s,n:1,t:Math.min(6,2.6+s.length/40)});if(feed.length>3)feed.shift()}
function paintFeed(dt){if(!FILM)for(const f of feed)f.t-=dt; // messages wait out the opening film instead of expiring unseen
  feed=feed.filter(f=>f.t>0);const html=feed.map(f=>`<div style="opacity:${Math.min(1,f.t/.5)}">${f.text}${f.n>1?' <b>x'+f.n+'</b>':''}</div>`).join('');if(html!==feedEl._h){feedEl._h=html;feedEl.innerHTML=html}}
function announce(s){toast(s)}
function sayTo(h,s){if(h&&h.you)toast(s)}

// ================= the giant on the ground =================
function fwd(g){return{x:Math.cos(g.ang),y:Math.sin(g.ang)}}
function braces(){return S.sites.filter(s=>s.build&&s.build.k==='brace').length}
// the giant starts all but unable to move; every brace humans bolt onto it lets it walk faster and do more
function chained(id){const ch=S.chains.find(c=>c.id===id);return ch&&ch.hp>0}
// the giant never wakes by the clock (the owner's rule): rival people leave the chains alone until someone has forged a
// wake horn or a person has started on the chains, and never before the player's own chain step on the first day, so the
// waking is a turn of the match people cause and can see coming. Only a horn wakes it, or the giant player's own strain
// once people have broken all four chains.
function chainsOpen(){const st=tutStep();if(st&&FIRST_DAY.findIndex(x=>x.id==='chain')>=S.tut.i&&S.t<1200)return false;return !!S.chainsStarted||S.humans.some(h=>h.horn)}
// The sleeper stirs. From the first minute the chained giant can twitch one part of its body and strain against its chains,
// and hunters may wedge it while it sleeps: half damage, and never below 60% of a joint, so nothing is crippled before it wakes.
// (Overnight expansion: the giant player used to have no action at all until minute 15.)
C.OWN_BRACE=1;C.FIG_MAX=200;C.LIMB_MAX=3200;C.GUARD_R=260;C.GUARD_PULL=14;C.BOT_TEND_BELOW=0;C.TEND_HEAL=12;C.TEND_FAVOR=2;C.BOT_SHOVE=.3;C.STRUGGLE=.3;C.STRUGGLE_CD=.25;C.BOT_STRUGGLE=2;C.JOINT_HANDS=3;C.G_BURST=3;C.G_BURST_WIN=40;C.G_REST=25;C.SOL_JOINT=.7;C.FALLEN_HEART=1.5;C.BOT_READ_SHAKE=.65;C.HUNT_OPEN=45;C.SLEEP_HURT=.5;C.SLEEP_FLOOR=.6;
C.TWITCH_CD=6;C.TWITCH_WIND=1.1;C.TWITCH_GRIP=36;C.TWITCH_BRACED=8;C.TWITCH_WEDGE=.5;C.TWITCH_ANCHOR=.4;
C.DREAM_CD=90;C.DREAM_WIND=1.5;C.DREAM_MIN=50;
// the sleeper's nightmare: it dreams of the town that has hurt it most, and the beasts of the land march on that town
function dreamTarget(){let b=-1;for(let i=0;i<3;i++)if(factionAlive(i)&&S.grudge[i]>=C.DREAM_MIN&&(b<0||S.grudge[i]>S.grudge[b]))b=i;if(b<0)return null;
  if(S.events.some(e=>e.k==='raid'&&e.i===b))return null;return nearestOwn(b,S.g.x,S.g.y)}
C.STRAIN_CD=3.5;C.STRAIN_WIND=.7;C.STRAIN_DMG=55;C.STRAIN_FLOOR=.4;C.STRAIN_OPEN=1.6;
const huntOpen=()=>!!S&&(S.g.awake||S.t>=C.HUNT_OPEN);
const ZONES={legs:'legs',left:'left side',right:'right side',top:'chest and head'};
// four parts of the body, one per direction: legs (down), left side (left), right side (right), chest, shoulders and head (up)
// exactly the four boxes the body panel outlines (and its tap picker reads): legs below 920 ft, chest and head from
// 1300 ft, and the two sides between (review: the old body-region rule disagreed with the drawn boxes on 22% of cells)
function zoneAt(r,c){r=Math.floor(r);c=Math.floor(c);return r<92?'legs':r>=130?'top':c<COLS/2?'left':'right'}
const JOINT_ZONE={kneeL:'legs',kneeR:'legs',elbowL:'left',elbowR:'right',heart:'top',neck:'top'};
const CHAIN_ZONE={ankleL:'legs',ankleR:'legs',wristL:'left',wristR:'right'}; // which chain a strain aimed at a part pulls (the wrists sit low in the legs box)
// how much a part of the body is being worked against the giant: climbers whose town it has a grudge with or who hunt it, and wedges in its joints
const grudgeNow=i=>S.grudge[i]-(S.grudgeBase?S.grudgeBase[i]:0); // what this day's people did, above what the giant remembers
function hunter(h){return h.role==='warden'||h.kits&&h.kits.wedge>0||grudgeNow(h.town)>60}
function zoneScore(z){let s=0;for(const h of climbers())if(zoneAt(h.cl.y,h.cl.x)===z)s+=hunter(h)?1:-.6;
  for(const id in S.joints)if(JOINT_ZONE[id]===z)s+=S.joints[id].wedges.length*1.5;return s}
// what a sleeper feels: wedges in its joints and blows landed in the last few seconds, not who means it harm
function zoneFelt(z){let s=0;for(const id in S.joints)if(JOINT_ZONE[id]===z){const j=S.joints[id];s+=j.wedges.length*1.5;if(S.t-(j.hurtT||-99)<4)s+=1}
  for(const ch of S.chains)if(CHAIN_ZONE[ch.id]===z&&S.t-(ch.hurtT||-99)<4)s+=.5;return s}
function busiestZone(){let b='legs',bs=-1e9;for(const z in ZONES){const v=zoneScore(z);if(v>bs){bs=v;b=z}}return b}
function aimZone(){return S.g.aim||busiestZone()}
function strainTarget(){const z=aimZone(),open=chainsOpen(),can=c=>c.hp>0&&(open||c.hp>c.max*C.STRAIN_FLOOR+.5);
  const inZ=S.chains.filter(c=>CHAIN_ZONE[c.id]===z&&can(c)),all=S.chains.filter(can),pool=inZ.length?inZ:all;
  return pool.sort((a,b)=>a.hp-b.hp)[0]||null}
function riseFree(){const g=S.g;if(g.awake||g.dead)return;g.awake=true;chron('The giant rose on its own, so no town earned its thanks for the waking.');for(const c of S.chains)c.hp=0;S.waker=null;shake(30);
  for(const h of S.humans)if(h.waking)interruptWake(h);
  announce(S.role==='giant'?'You tear free of the last links and rise. No town woke you.':'The giant tears free of its broken chains and rises on its own. No town woke it.');
  if(!S.headless){giantCall('bellow');setTimeout(()=>giantCall('moan'),2600)}}
// the match's chronicle: the turning points, each told with its cause where the game knows it, shown at the end
function chron(text,kind,who){if(!S)return;S.chron=S.chron||[];S.chron.push({t:S.t,text,kind,who})}
const HERO_NAMES=['Edda of Ashville','Wren of Brindle','Kael of Corvel'];
const whoOf=h=>!h?'someone':h.you?'you':h.hero?HERO_NAMES[h.town]:TOWNS[h.town].name+(h.sol?'\u2019s soldiers':'\u2019s people');
function topGrudge(){let b=-1;for(let i=0;i<3;i++)if(b<0||S.grudge[i]>S.grudge[b])b=i;return S.grudge[b]>0?b:-1}
const chainWeak=ch=>ch.hp<=ch.max*C.CHAIN_WEAK;const allWeak=()=>S.chains.every(c=>c.hp<=0||chainWeak(c));
function giantSpeed(){if(!S.g.awake||chained('ankleL')||chained('ankleR'))return 0;const bl=Math.max(C.OWN_BRACE,S.sites.reduce((n,s)=>n+(s.build&&s.build.k==='brace'?lv(s.build):0),0));let s=Math.min(C.G_SPEED,C.G_DORMANT+bl*C.G_PER_BRACE);if(S.joints.kneeL.crip)s*=.5;if(S.joints.kneeR.crip)s*=.5;return s}
// momentum: it gathers speed slowly, needs room to stop, and turns wider the faster it walks
// speeds are in the giant's own measure (the numbers the person chose); on the ground each unit of it covers WS units, so a
// walk across the wider land takes as long as it did across the first map
function giantMotion(m,dt,tx,ty,vmax){let want=0,da=0;
  if(tx!=null){const dx=tx-m.x,dy=ty-m.y,d=Math.hypot(dx,dy)/WS;da=((Math.atan2(dy,dx)-m.ang+Math.PI*3)%(Math.PI*2))-Math.PI;
    const vArrive=Math.sqrt(2*C.G_BRAKE*Math.max(0,d-40));const sa=Math.abs(Math.sin(da));
    const vTurn=Math.abs(da)>Math.PI/2?0:sa<.01?vmax:Math.sqrt(C.G_LAT*d/(2*sa));want=Math.min(vmax,vArrive,vTurn)}
  if(m.v<want)m.v=Math.min(want,m.v+C.G_ACCEL*dt);else m.v=Math.max(want,m.v-C.G_BRAKE*dt);
  const wmax=Math.min(C.G_PIVOT,C.G_LAT/Math.max(m.v,1));m.ang+=clamp(da,-wmax*dt,wmax*dt);
  m.x=clamp(m.x+Math.cos(m.ang)*m.v*WS*dt,300,C.MAP-300);m.y=clamp(m.y+Math.sin(m.ang)*m.v*WS*dt,300,C.MAP-300)}
function canGiant(k){const g=S.g,J=S.joints;
  if(g.dead)return'The giant is dead';
  if(k==='struggle'){if(!(g.fallen>0))return'Only while you are down';if(g.cd.struggle>0)return'';return null}
  if(!g.awake&&k==='dream'){if(nightLock())return'Night: you sleep deep';if(g.wind)return'Busy';if(g.cd.dream>0)return'Ready in '+Math.ceil(g.cd.dream)+'s';
    if(!dreamTarget())return[0,1,2].some(i=>S.grudge[i]>=C.DREAM_MIN)?'Beasts already march on them':'No town has hurt you yet';return null}
  if(!g.awake&&(k==='twitch'||k==='strain')){if(nightLock())return'Night: you sleep deep';if(g.wind)return'Busy';if(g.cd[k]>0)return'Ready in '+Math.ceil(g.cd[k])+'s';
    if(k==='strain'&&!allWeak()&&!strainTarget())return'Strained as far as they go until the chains weaken';return null}
  if(!g.awake)return'Asleep';if(g.fallen>0)return'Fallen';if(g.wind)return'Busy';if(g.cd[k]>0)return'Ready in '+Math.ceil(g.cd[k])+'s';
  if(k==='stomp'&&Math.max(C.OWN_BRACE,braces())<1)return'Needs 1 brace';if((k==='smash'||k==='swipe')&&(chained('wristL')||chained('wristR')))return'Wrists chained';if(k==='stomp'&&(chained('ankleL')||chained('ankleR')))return'Ankles chained';if(k==='smash'&&braces()<2)return'Needs 2 braces';if(k==='swipe'&&braces()<3)return'Needs 3 braces';
  if(k==='smash'&&J.elbowL.crip&&J.elbowR.crip)return'Both elbows crippled';
  if(k==='shake'&&J.neck.crip)return'Neck crippled';
  if(k==='swipe'){const side=swipeSide();if(side==null)return'No one to brush off';if((side==='L'?J.elbowR:J.elbowL).crip)return'That arm is crippled'}
  return null}
function climbers(){return S.humans.filter(h=>h.mode==='climb'&&!h.dead)}
// the swiping hand brushes the half of the body with more climbers; the right hand reaches the left side
function swipeSide(){let l=0,r=0;for(const h of climbers()){if(h.cl.y<30)continue;if(h.cl.x<COLS/2)l++;else r++}
  for(const a of S.anchors)if(a.r>=30){if(a.c<COLS/2)l+=.3;else r+=.3}
  if(!l&&!r)return null;return l>=r?'L':'R'}
function giantDo(k){const why=canGiant(k);if(why!=null){if(why&&S.role==='giant'&&!S.autoplay)toast(why);return false}
  // struggling while down: every heave brings the rise a little closer and jolts whoever is on you
  if(k==='struggle'){const g=S.g;g.fallen=Math.max(.5,g.fallen-C.STRUGGLE);g.cd.struggle=C.STRUGGLE_CD;shake(3);for(const h of climbers())h.grip-=2;(S.acts||(S.acts={})).struggle=(S.acts.struggle||0)+1;if(!S.headless&&Math.random()<.3)giantCall('pain');return true}
  const g=S.g,w={k,t:C[k.toUpperCase()+'_WIND'],dur:C[k.toUpperCase()+'_WIND']};
  if(k==='smash'){let best=null,bd=1e9;for(const t of aliveTowns()){const d=dist(g,t);if(d<C.SMASH_REACH+t.r&&d<bd){bd=d;best=t}}
    let a=g.ang,d=C.SMASH_REACH*.8;if(best){a=Math.atan2(best.y-g.y,best.x-g.x);d=Math.min(C.SMASH_REACH,bd)}w.x=g.x+Math.cos(a)*d;w.y=g.y+Math.sin(a)*d}
  if(k==='swipe')w.side=swipeSide();
  if(k==='twitch'){w.zone=aimZone();for(const h of climbers())if(h.you&&zoneAt(h.cl.y,h.cl.x)===w.zone)toast('A twitch gathers in the giant\u2019s '+ZONES[w.zone]+'! Hold still to brace.');sfx('warn',S.role==='giant'||climbers().some(h=>h.you))}
  if(k==='dream'){const t=dreamTarget();w.town=t&&t.id}
  if(k==='strain'){const ch=allWeak()?null:strainTarget();w.chain=ch&&ch.id;if(!S.headless&&ch)chainClank(ch)}
  if(k==='shake'||k==='swipe'){for(const h of climbers())if(h.you)toast(k==='shake'?'The giant tenses! Hold still to brace.':'A hand is coming! Get to a ledge or the other side.');sfx('warn')}
  if(!S.headless)giantCall(k==='shake'||k==='twitch'?'rumble':k==='strain'?'pain':'bellow');
  g.wind=w;g.cd[k]=C[k.toUpperCase()+'_CD'];(S.acts||(S.acts={}))[k]=(S.acts[k]||0)+1;return true}
function resolveWind(){const g=S.g,w=g.wind;g.wind=null;S.windAt=S.t;
  if(w.k==='twitch'){shake(7);let n=0,fell=0,lost=0;const inZ=[];
    for(const h of climbers())if(zoneAt(h.cl.y,h.cl.x)===w.zone&&h.grip>0){inZ.push(h);const braced=S.t-h.lastMove>w.dur*.8&&!h.cl.move,onL=restful(cellT(h.cl.x,h.cl.y));
      const d=onL?(braced?0:6):braced?C.TWITCH_BRACED:C.TWITCH_GRIP;h.grip-=d;n++;if(h.you)toast(d<=10?'Braced. The twitch passes under you.':'A jerk runs through the giant\u2019s '+ZONES[w.zone]+'! Your grip slips.')}
    S.anchors=S.anchors.filter(a=>{if(zoneAt(a.r,a.c)===w.zone&&rnd()<C.TWITCH_ANCHOR){lost++;return false}return true});
    for(const id in S.joints)if(JOINT_ZONE[id]===w.zone){const j=S.joints[id],b=j.wedges.length;j.wedges=j.wedges.filter(()=>rnd()>C.TWITCH_WEDGE);fell+=b-j.wedges.length}
    S.fx.push({k:'twitch',zone:w.zone,t:0,life:.7});S.twitches=(S.twitches||0)+1;
    if(S.role==='giant'&&!S.autoplay&&(inZ.some(h=>h.grip<=0)||fell||lost||!n))toast(!n?'A twitch runs through your '+ZONES[w.zone]+', but no one is there.':'A twitch runs through your '+ZONES[w.zone]+': '+n+' shaken, '+inZ.filter(h=>h.grip<=0).length+' knocked loose, '+fell+' wedge'+(fell===1?'':'s')+' and '+lost+' rope'+(lost===1?'':'s')+' loose.');
    return}
  if(w.k==='dream'){const t=S.towns.find(x=>x.id===w.town);if(!t||!t.alive)return;
    chron('Because '+TOWNS[t.i].name+'\u2019s people had hurt it, the sleeping giant dreamed of '+t.name+' and beasts marched on it.');
    startRaid(t,'The sleeping giant dreams of '+t.name+'. Beasts gather beyond it and march in 20 s!');S.fx.push({k:'ring',x:S.g.x,y:S.g.y,r:900,t:0,life:1.2,col:'#b48cff'});return}
  if(w.k==='strain'){if(allWeak()){riseFree();return}const ch=S.chains.find(c=>c.id===w.chain);shake(5);S.strains=(S.strains||0)+1;
    for(const h of climbers())h.grip-=S.chains.some(c=>c.id===w.chain&&Math.abs(c.r-h.cl.y)<12&&Math.abs(c.c-h.cl.x)<6)?5:1.5;
    if(ch&&ch.hp>0){const open=chainsOpen(),floor=open?0:ch.max*C.STRAIN_FLOOR;ch.hp=Math.max(floor,ch.hp-C.STRAIN_DMG*(open?C.STRAIN_OPEN:1));(S.chainFlash||(S.chainFlash={}))[ch.id]=S.t;
      if(chainWeak(ch)){if(!S.headless)chainClank(ch,true);chron('The giant tore its own '+ch.name+' loose.','chain','the giant itself');announce('The giant tears its '+ch.name+' loose!'+(allWeak()?' All four chains are gone: '+(S.role==='giant'?'strain once more to rise.':'a wake horn sounded at its head will wake it.'):''))}
      else if(S.role==='giant'&&!S.autoplay&&!open&&ch.hp<=ch.max*C.STRAIN_FLOOR+.5)toast('The '+ch.name+' groans but holds. It will give only once people start breaking your chains or forge a wake horn.')}
    return}
  if(w.k==='stomp'){sfx('stomp');shake(14);for(const f of g.feet){S.fx.push({k:'ring',x:f.x,y:f.y,r:C.STOMP_R,t:0,life:.6,col:'#ffcf6a'});hurtArea(f.x,f.y,C.STOMP_R,C.STOMP_DMG,C.STOMP_TOWN,'stomp')}}
  else if(w.k==='smash'){sfx('smash');shake(18);S.fx.push({k:'ring',x:w.x,y:w.y,r:C.SMASH_R,t:0,life:.7,col:'#ff8f80'});hurtArea(w.x,w.y,C.SMASH_R,C.SMASH_DMG,C.SMASH_TOWN,'smash')}
  else if(w.k==='shake'){shake(10);let lost=0,fell=0;
    for(const h of climbers()){const braced=S.t-h.lastMove>w.dur*.8&&!h.cl.move,onL=restful(cellT(h.cl.x,h.cl.y));
      const d=onL?(braced?0:8):braced?C.SHAKE_BRACED:C.SHAKE_GRIP;h.grip-=d;if(h.you)toast(d<=12?'Braced. You held on.':'Shaken! Your grip slips.')}
    S.anchors=S.anchors.filter(()=>{if(rnd()<C.SHAKE_ANCHOR){lost++;return false}return true});
    for(const id in S.joints){const j=S.joints[id];j.wedges=j.wedges.filter(()=>{if(rnd()<C.SHAKE_WEDGE){fell++;return false}return true})}
    if(S.role==='giant'&&!S.autoplay){const off=climbers().filter(h=>h.grip<=0),hn=off.filter(hunter).length;toast('Shake! '+off.length+' climber'+(off.length===1?'':'s')+' lose their grip ('+hn+' hunting you), '+fell+' wedge'+(fell===1?'':'s')+' and '+lost+' rope'+(lost===1?'':'s')+' loose.')}}
  else if(w.k==='swipe'){shake(8);const left=w.side==='L';let n=0;
    const inZone=(c,r)=>r>=30&&(left?c<COLS/2:c>=COLS/2);
    for(const h of climbers())if(inZone(h.cl.x,h.cl.y)){const onL=restful(cellT(h.cl.x,h.cl.y));h.grip-=onL?15:C.SWIPE_GRIP;n++;if(h.you)toast(onL?'You flatten on the ledge as the hand passes.':'The hand scrapes over you!')}
    S.anchors=S.anchors.filter(a=>!(inZone(a.c,a.r)&&rnd()<C.SWIPE_CLEAR));
    for(const id in S.joints){const J=JOINTS[id],j=S.joints[id];if(inZone((J.c0+J.c1)/2,J.r0))j.wedges=j.wedges.filter(()=>rnd()>C.SWIPE_CLEAR)}
    S.fx.push({k:'swipe',side:w.side,t:0,life:.6});
    if(S.role==='giant'&&!S.autoplay){const off=climbers().filter(h=>h.grip<=0),hn=off.filter(hunter).length;toast('Swipe! '+n+' scraped, '+off.length+' knocked loose ('+hn+' hunting you).')}}}
function hurtArea(x,y,r,dmg,tdmg,why){
  S.builds=S.builds.filter(b=>{if(Math.hypot(b.x-x,b.y-y)<r+30){S.fx.push({k:'ring',x:b.x,y:b.y,r:50,t:0,life:.5,col:'#c9b48a'});destroyBuild(b,true);return false}return true});
  for(const h of S.humans)if(h.mode==='ground'&&!h.dead&&Math.hypot(h.x-x,h.y-y)<r+10)hurtHuman(h,dmg,why);
  for(const m of S.monsters)if(Math.hypot(m.x-x,m.y-y)<r+m.r)m.hp-=dmg;
  for(const t of S.towns)if(t.alive&&Math.hypot(t.x-x,t.y-y)<r+t.r)hurtTown(t,tdmg,why)}
function hurtTown(t,d,why){if(!t.alive)return;if(S.you&&t.i===S.you.town&&!S.headless){const f0=t.hp/t.max,f1=(t.hp-d)/t.max;for(const q of[.6,.3])if(f0>q&&f1<=q){announce(t.name+'\u2019s walls are at '+Math.round(q*100)+'%! Go home and fight, or order your barracks to defend it (B).');sfx('warn')}}if(!S.headless&&S.t-(t.sndT||0)>.6&&nearPlayer(t)){t.sndT=S.t;sfx('thud',true)}t.hp-=d;t.hitT=S.t;if(S.grudge[t.i]>=C.ANGER&&(t.hp<=t.max/2))S.avenged=true;if(t.hp<=0){t.hp=0;t.alive=false;t.fellBy=why||null;displaceForagers(t);chron(t.name+' was destroyed'+(why==='stomp'||why==='smash'||why==='crush'?(S.grudge[t.i]>=C.ANGER?' by the giant, because its people had hurt it past bearing':' under the giant'):'')+'.');announce(t.name+' has been destroyed!');sfx('smash')}}
function displaceForagers(t){for(const h of foragersIn(t).slice(foragerCapacity(t))){
  const vacancies=aliveTowns().filter(o=>o!==t&&o.i===t.i&&foragersIn(o).length<foragerCapacity(o));
  vacancies.sort((a,b)=>dist(a,h)-dist(b,h));assignForagerHome(h,vacancies[0])}}
function hurtHuman(h,d,why,by){if(h.dead)return;if(why==='beast')h.beastAt=S.t;if(!S.headless&&why!=='fall'&&!untouchable(h)){if(h.you)sfx('hurt');else if(S.t-(h.sndT||0)>.4&&nearPlayer(h)){h.sndT=S.t;sfx('hit',true)}}if(why!=='fall'&&untouchable(h)){dodgedFx(h);return}d=Math.max(d*.4,d-(h.def||0)-5*charm(h,'hide'));if(buffOf(h,'ward'))d*=.7;h.hp-=d;h.hurtAt=S.t;if(perk(h,'wind')&&h.hp>0&&h.hp<h.max*.25&&S.t-(h.windT??-99)>60){h.windT=S.t;h.hp+=40;if(h.you){toast('Second wind! +40 health.');S.fx.push({k:'ring',x:h.x,y:h.y,r:60,t:0,life:.6,col:'#9be08a'})}}if(why!=='fall')horseHurt(h,d);h.lastHurtBy=by||null;if(h.you&&h.mode==='ground')S.fx.push({k:'txt',x:h.x,y:h.y,z:90,text:'-'+Math.round(d),t:0,life:.9,col:'#ff8f80'});
  if(h.you){shake(6);if(h.hp>0&&why)toast({crush:'Crushed under a foot!',stomp:'Caught in a stomp!',smash:'Hit by the smash!',cannon:'Cannon fire!',beast:h.lastBeast&&h.lastBeast.kind==='archer'?'An arrow hits you!':h.lastBeast&&h.lastBeast.kind==='boar'?'A boar gores you!':'A beast bites you!',fall:'You hit hard.'}[why]||'Hurt!')}
  if(h.hp<=0)killHuman(h,why)}
function killHuman(h,why){if(h.you&&why==='beast'&&h.lastBeast&&h.lastBeast.elite&&S.monsters.includes(h.lastBeast)&&!/Slayer/.test(h.lastBeast.elite)){const m=h.lastBeast;m.baseName=m.elite;m.elite+=' the Hero-Slayer';m.max=Math.round(m.max*1.5);m.hp=m.max;m.atk+=4;m.gold+=40;m.xp+=40;
    announce(m.elite.replace(' the Hero-Slayer','')+' killed you and grows stronger: now '+m.elite+'. Avenge yourself for a richer bounty.');chron('An alpha killed you and took a name for it: '+m.elite+'.')}
leaveClimb(h);h.hp=0;h.dead=6;h.tx=h.ty=null;h.goal=null;h.gold=Math.floor(h.gold*.75);
  if(h.you)toast(why==='fall'?'You fell to your death. Back to town soon.':'You were killed. Back to town soon.')}
function stepGiant(dt){const g=S.g;if(g.dead)return;
  for(const k in g.cd)g.cd[k]=Math.max(0,g.cd[k]-dt);
  if(g.wind){g.wind.t-=dt;if(g.wind.t<=0)resolveWind()}
  if(S.reg)for(const k in S.reg)S.reg[k]*=Math.exp(-dt/C.GRUDGE_FADE);for(let i=0;i<3;i++){{const b=S.grudgeBase?S.grudgeBase[i]:0;S.grudge[i]=b+(S.grudge[i]-b)*Math.exp(-dt/C.GRUDGE_FADE)};for(let j=0;j<3;j++)S.feud[i][j]*=Math.exp(-dt/300)}
  for(const id in S.joints){const j=S.joints[id];
    for(const w of j.wedges)damageJoint(id,C.WEDGE_DPS*dt,w);
    // a wedge in a joint halves its healing
    if(g.fallen<=0&&j.hp<j.max&&!g.dead)j.hp=Math.min(j.max,j.hp+C.REGEN*dt*(id==='heart'?2:1)*(j.wedges.length?.5:1));
    if(j.crip&&id!=='kneeL'&&id!=='kneeR'&&j.hp>=j.max*.5){j.crip=false;announce(JOINTS[id].name+' has knitted back together.')}}
  if(g.dead)return;
  if(g.fallen>0){g.v=0;g.fallen-=dt;if(g.fallen<=0){g.fallen=0;for(const k of['kneeL','kneeR']){const j=S.joints[k];j.hp=Math.max(j.hp,j.max*.5);j.crip=false}announce('The giant rises again!')}return}
  if(g.tx!=null&&Math.hypot(g.tx-g.x,g.ty-g.y)<60)g.tx=g.ty=null;
  giantMotion(g,dt,g.tx,g.ty,giantSpeed());S.walked+=g.v*dt;
  const moving=g.v>1;g.sway+=dt*(moving?g.v/C.G_SPEED*2.6:0);
  const f=fwd(g),side={x:-f.y,y:f.x};
  const air=g.feet.find(ft=>ft.air>0);
  if(air){air.air-=dt;const k=1-air.air/air.dur;air.x=air.sx+(air.lx-air.sx)*k;air.y=air.sy+(air.ly-air.sy)*k;if(air.air<=0){air.air=0;air.x=air.lx;air.y=air.ly;footLand(air,g.feet.indexOf(air))}}
  else{let worst=-1,wd=0;g.feet.forEach((ft,i)=>{const s=i?1:-1,ix=g.x+side.x*s*C.FOOT_SPREAD,iy=g.y+side.y*s*C.FOOT_SPREAD,d=Math.hypot(ft.x-ix,ft.y-iy);if(d>wd){wd=d;worst=i}});
    if(wd>60||(moving&&wd>20)){const ft=g.feet[worst],s=worst?1:-1,lead=moving?g.v*WS*C.G_STEP*.9:0;
      ft.sx=ft.x;ft.sy=ft.y;ft.lx=g.x+f.x*lead+side.x*s*C.FOOT_SPREAD;ft.ly=g.y+f.y*lead+side.y*s*C.FOOT_SPREAD;ft.dur=C.G_STEP*(Math.max(C.OWN_BRACE,braces())?1:2.2);ft.air=ft.dur;if(!S.headless&&S.t>=(S.nextGroan||0)){S.nextGroan=S.t+7+Math.random()*16;const d=Math.hypot(g.x-S.cam.x,g.y-S.cam.y);groan(.22*clamp(1.15-d/7000,.18,1))}}}
  // cannons on the body fire at every town but their builder's
  for(const s of S.sites){const b=s.build;if(!b||b.k==='brace')continue;if(s.arm==='L'&&S.joints.elbowL.crip||s.arm==='R'&&S.joints.elbowR.crip)continue;if(b.k!=='cannon')continue;
    b.cd-=dt;if(b.cd>0)continue;const tgt=cannonTarget(b.town);
    if(tgt){b.cd=C.CANNON_CD/Math.sqrt(lv(b));S.shots.push({dmg:C.CANNON_TOWN*(1+.6*(lv(b)-1)),sx:g.x,sy:g.y,x:g.x,y:g.y,tx:tgt.x+rr(-40,40),ty:tgt.y+rr(-40,40),t:0,dur:Math.max(.4,Math.hypot(tgt.x-g.x,tgt.y-g.y)/700),town:b.town,owner:b.owner});sfx('cannon',nearPlayer(g))}else b.cd=.6}}
function cannonTarget(town){const g=S.g;let best=null,bd=C.CANNON_RANGE;
  for(const t of aliveTowns())if(t.i!==town){const d=dist(g,t)-t.r;if(d<bd){bd=d;best=t}}
  if(best)return best;
  for(const h of S.humans)if(!h.dead&&h.mode==='ground'&&h.town!==town){const d=dist(g,h);if(d<bd*.7){bd=d;best=h}}
  return best}
function footLand(ft,i){if(Math.random()<.45)sfx('step',nearPlayer(ft));seGiantStep(ft);shake(4);
  S.fx.push({k:'ring',x:ft.x,y:ft.y,r:C.FOOT_R*1.5,t:0,life:.5,col:'#c9b48a'});
  if(!S.towns.some(t=>Math.hypot(t.x-ft.x,t.y-ft.y)<t.r+60)){S.prints.push({x:ft.x,y:ft.y,a:S.g.ang,t:S.t});if(S.prints.length>160)S.prints.shift()}
  hurtArea(ft.x,ft.y,C.FOOT_R,C.CRUSH,C.CRUSH_TOWN,'crush');
  // the jolt runs up that leg
  for(const h of climbers()){const onLeg=h.cl.y<92&&((i===0&&h.cl.x<COLS/2)||(i===1&&h.cl.x>=COLS/2));h.grip-=onLeg?C.JOLT:1.5}}
function damageJoint(id,d,by){const g=S.g,j=S.joints[id];if(g.dead||!g.awake&&!huntOpen()||j.hp<=0&&id==='heart')return;
  // only so many hands fit on one joint: past three strikers in the last second, each blow counts for a share
  if(by&&by.id!=null&&by.hp!=null){const hs=j.hands||(j.hands=new Map());hs.set(by.id,S.t);let n=0;for(const[k,t]of hs){if(S.t-t>1.2)hs.delete(k);else n++}if(n>C.JOINT_HANDS)d*=C.JOINT_HANDS/n;if(by.sol)d*=C.SOL_JOINT}
  if(!g.awake){d*=C.SLEEP_HURT;d=Math.min(d,Math.max(0,j.hp-j.max*C.SLEEP_FLOOR));if(d<=0)return} // asleep it bruises but cannot be crippled
  if(id==='heart'&&g.fallen>0)d*=C.FALLEN_HEART;
  if(by&&by.town!=null){S.grudge[by.town]+=d;regard(by.who!=null?S.humans.find(x=>x.id===by.who):by.id!=null?by:null,-d)} // the giant remembers whose people hurt it
  j.hurtT=S.t;j.hp-=d;if(j.hp>0)return;j.hp=0;
  if(id==='heart'){g.dead=true;S.slayer=by&&by.town!=null?by.town:null;chron((by&&by.town!=null?whoOf(by.hp!=null?by:S.humans.find(x=>x.id===by.who)||{town:by.town,sol:1}):'Its hunters').replace(/^./,c=>c.toUpperCase())+' shattered the Heart-stone. The giant died.');announce('The Heart-stone shatters. The giant is slain!');return}
  if(!j.crip){j.crip=true;j.wedges=[];announce(JOINTS[id].name+' crippled!');if(!S.headless)giantCall('pain');
    if(S.joints.kneeL.crip&&S.joints.kneeR.crip&&g.fallen<=0){S.falls=(S.falls||0)+1;{const b=topGrudge();chron((b>=0?'Because '+TOWNS[b].name+'\u2019s hunters bled its knees, the':'The')+' giant fell to its knees'+(S.falls>1?' (fall '+S.falls+')':'')+'.')}g.fallen=C.FALL_TIME;g.wind=null;g.v=0;shake(30);sfx('stomp');
      announce('The giant falls to its knees! No grip is lost, climbing is twice as fast and the Heart-stone takes half again as much damage.')}}}

