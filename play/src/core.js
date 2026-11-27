'use strict';
// Colossus · src/core.js · rng and helpers, the constants C, the giant's climbable body grid, the save
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= rng and helpers =================
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let rnd=mulberry32(1);
const rr=(a,b)=>a+(b-a)*rnd();
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const distSq=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// ================= constants =================
const C={
  MAP:18000,DT:1/30,TOWN_RING:6000,MONSTERS:160,CRYSTALS:150,TREES:2600,FORAGE_RANGE:4000,
  G_SPEED:55,G_ACCEL:8,G_BRAKE:12,G_PIVOT:.25,G_LAT:4,G_STEP:2.4,FOOT_R:85,FOOT_SPREAD:110,CRUSH:100,CRUSH_TOWN:45,
  STOMP_CD:9,STOMP_WIND:1.1,STOMP_R:240,STOMP_DMG:55,STOMP_TOWN:60,
  SMASH_CD:10,SMASH_WIND:1.4,SMASH_REACH:540,SMASH_R:190,SMASH_DMG:90,SMASH_TOWN:150,
  SHAKE_CD:12,SHAKE_WIND:1.3,SHAKE_GRIP:42,SHAKE_BRACED:12,SHAKE_ANCHOR:.25,SHAKE_WEDGE:.35,
  SWIPE_CD:14,SWIPE_WIND:1.6,SWIPE_GRIP:60,SWIPE_CLEAR:.75,
  FALL_TIME:18,REGEN:1,
  H_SPEED:165,
  CLIMB_SPEED:3.6,LEDGE_SPEED:6,REACH:2.3,LUNGE_REACH:3.6,MOVE_GRIP:.4,MOVE_GRIP_CELL:.5,MOSS_DRAIN:2.5,CRUMBLE:1.4,GRIP:100,GRIP_MOVE:3,GRIP_STILL:1,GRIP_LEDGE:20,GRIP_ROPE:8,JOLT:5,LUNGE:3,LUNGE_GRIP:15,FALL_G:14,
  WEDGE_DPS:4,WEDGE_MAX:3,CANNON_CD:3.5,CANNON_RANGE:1000,CANNON_TOWN:32,CANNON_HUM:20,CANNON_HP:60,
  PICKUP_R:84,UP:{town:[8,16,28],house:[3,6],tower:[5,10],cannon:[5,10],brace:[5,10],ladder:[4,8],platform:[]},RAID_AT:[4,9,15,22],STAR_EVERY:16,CARAVAN_HP:300,PACK:6,PELT_GOLD:6,GIANT_TASKS:3,WANDER:6000,ANGER:600,DUSK:1500,NIGHT:60,HORN_CRYSTALS:20,CACHE_REFILL:240,WAKE_ROW:186,WAKE_FAVOR:100,WAKE_TIME:10,CHAIN_HP:900,CHAIN_WEAK:0,G_DORMANT:4,G_PER_BRACE:12,BRACE_FAVOR:60,EXIT_R:350,HOUSE_HP:200,HOME_REACH:320,HOUSE_REACH:300,HOUSE_GROW:12,LAKE_GOLD:4,TOWER_R:380,OUTPOST_GAP:800,
  GRUDGE_FADE:240,PULL_FAVOR:40,CANNON_FAVOR:60,
  COST:{farm:35,market:90,smithy:80,stable:60,well:30,ladder:25,platform:30,brace:50,house:40,tower:60,outpost:120,anchor:20,wedge:30,cannon:70,potion:15,blade:60,gloves:50},
};
// the world's scale against the first 9000-unit map: distances between places scale by it, body-sized things do not
const WS=C.MAP/9000;
const TOWNS=[
  // each town's people treat the giant their own way, and the giant answers each town in kind
  {name:'Ashville',col:'#6fb7ff',shape:'circle',roles:['warden','keeper','raider'],way:'of two minds about the giant'},
  {name:'Brindle',col:'#ffaa45',shape:'square',roles:['keeper','keeper','raider'],way:'tends the giant and arms it'},
  {name:'Corvel',col:'#d68cff',shape:'diamond',roles:['warden','warden','warden'],way:'hunts the giant'},
];

// ================= the giant's body: a climbable side-view grid, 10 ft a cell =================
const COLS=32,ROWS=200,FT=10;
const AIR=0,SMOOTH=1,HOLD=2,LEDGE=3,JOINT=4,HEART=5,SITE=6;
const JOINTS={
  kneeL:{name:'Left knee',r0:42,r1:45,c0:8,c1:12,max:1400},
  kneeR:{name:'Right knee',r0:42,r1:45,c0:19,c1:23,max:1400},
  elbowL:{name:'Left elbow',r0:118,r1:121,c0:2,c1:6,max:600},
  elbowR:{name:'Right elbow',r0:118,r1:121,c0:25,c1:29,max:600},
  neck:{name:'Neck',r0:167,r1:170,c0:13,c1:18,max:1000},
  heart:{name:'Heart-stone',r0:134,r1:139,c0:14,c1:17,max:5000},
};
// the giant is chained: both ankles and both wrists. The ankle chains must break before it can take a step,
// the wrist chains before it can smash or swipe
const CHAINS=[{id:'ankleL',name:'left ankle chain',r:4,c:9},{id:'ankleR',name:'right ankle chain',r:4,c:22},{id:'wristL',name:'left wrist chain',r:84,c:4},{id:'wristR',name:'right wrist chain',r:84,c:27}];
// build spots across the body: shoulders, crown, chest, hips, forearms, wrists and thighs (21 in all)
const SITES=[];{const add=(id,name,r,c,arm)=>SITES.push({id,name,r,c,arm:arm||null});
  [3,6,9].forEach((c,i)=>add('shL'+i,'left shoulder',166,c));[22,25,28].forEach((c,i)=>add('shR'+i,'right shoulder',166,c));
  [12,15,18].forEach((c,i)=>add('crown'+i,'crown',199,c));[11,14,17,20].forEach((c,i)=>add('chest'+i,'chest',130,c));
  add('hipL','left hip',106,7);add('hipR','right hip',106,24);add('armL','left forearm',100,2,'L');add('armR','right forearm',100,29,'R');
  add('wristL','left wrist',90,3,'L');add('wristR','right wrist',90,28,'R');add('thighL','left thigh',70,10);add('thighR','right thigh',70,21)}
function region(r,c){
  if(r<0||r>=ROWS||c<0||c>=COLS)return null;
  if(r<=6&&c>=6&&c<=13)return'legL';
  if(r<=6&&c>=18&&c<=25)return'legR';
  if(r<=92&&c>=8&&c<=12)return'legL';
  if(r<=92&&c>=19&&c<=23)return'legR';
  if(r>=88&&r<=106&&c>=7&&c<=24)return'hips';
  if(r>=82&&r<=166&&c>=2&&c<=6)return'armL';
  if(r>=82&&r<=166&&c>=25&&c<=29)return'armR';
  if(r>=106&&r<=158&&c>=9&&c<=22)return'torso';
  if(r>=152&&r<=166&&c>=2&&c<=29)return'shoulders';
  if(r>=166&&r<=172&&c>=13&&c<=18)return'neck';
  if(r>=172&&r<=199&&c>=10&&c<=21)return'head';
  return null}
function buildBody(seed){
  const R=mulberry32(seed^0x9e3779b9),g=new Uint8Array(COLS*ROWS),reg=new Array(COLS*ROWS);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const k=region(r,c);reg[r*COLS+c]=k;if(k)g[r*COLS+c]=HOLD}
  // bare stone patches: no handholds, the climber must go around or lunge across
  for(let i=0;i<70;i++){const r0=Math.floor(R()*ROWS),c0=Math.floor(R()*COLS),rad=1+R()*2.4;
    for(let r=Math.floor(r0-rad);r<=r0+rad;r++)for(let c=Math.floor(c0-rad);c<=c0+rad;c++){if(r<0||r>=ROWS||c<0||c>=COLS)continue;
      if(g[r*COLS+c]===HOLD&&Math.hypot(r-r0,(c-c0)*1.3)<=rad)g[r*COLS+c]=SMOOTH}}
  // guaranteed routes through each limb
  const forced=new Uint8Array(COLS*ROWS);const set=(r,c)=>{if(r>=0&&r<ROWS&&c>=0&&c<COLS){forced[r*COLS+c]=1;if(g[r*COLS+c]===SMOOTH)g[r*COLS+c]=HOLD}};
  const spine=(r0,r1,c0,c1)=>{let c=c0+Math.floor(R()*(c1-c0+1));for(let r=r0;r<=r1;r++){set(r,c);if(R()<.3){const n=clamp(c+(R()<.5?-1:1),c0,c1);set(r,n);c=n}}};
  const belt=(c0,c1,r0,r1)=>{let r=r0+Math.floor(R()*(r1-r0+1));for(let c=c0;c<=c1;c++){set(r,c);if(R()<.3){const n=clamp(r+(R()<.5?-1:1),r0,r1);set(n,c);r=n}}};
  spine(0,106,8,12);spine(0,106,19,23);spine(106,166,9,22);spine(106,166,11,20);spine(82,166,2,6);spine(82,166,25,29);spine(158,199,14,17);
  belt(7,24,94,104);belt(2,29,154,164);
  // ledges: any top surface with air above, plus carved belts on the shins, wrists and ribs
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const i=r*COLS+c;if(!g[i])continue;const k=reg[i];
    const airAbove=r===ROWS-1||!g[(r+1)*COLS+c];
    if(airAbove||(r===46&&(k==='legL'||k==='legR'))||(r===90&&(k==='armL'||k==='armR'))||(r===130&&k==='torso'))g[i]=LEDGE}
  for(const id in JOINTS){const j=JOINTS[id];for(let r=j.r0;r<=j.r1;r++)for(let c=j.c0;c<=j.c1;c++)if(g[r*COLS+c])g[r*COLS+c]=id==='heart'?HEART:JOINT}
  for(const s of SITES)g[s.r*COLS+s.c]=SITE;
  for(const ch of CHAINS)if(g[ch.r*COLS+ch.c]<HOLD)g[ch.r*COLS+ch.c]=HOLD;
  // repair: everything worth reaching must connect to the feet
  for(let pass=0;pass<4;pass++){const seen=floodFrom(g,[[1,9],[1,20]]);let fixed=0;
    for(let i=0;i<g.length;i++)if(g[i]>=LEDGE&&!seen[i]){let r=Math.floor(i/COLS),c=i%COLS;while(r>0&&!seen[r*COLS+c]){r--;if(g[r*COLS+c]===SMOOTH){g[r*COLS+c]=HOLD;fixed++}else if(!g[r*COLS+c])break}}
    if(!fixed)break}
  const vari=new Uint8Array(COLS*ROWS);for(let i=0;i<vari.length;i++)vari[i]=Math.floor(R()*256);
  // handholds: the climber moves from hold to hold, so the route is a choice. Firm cracks, mossy holds that drain grip,
  // loose stones that crumble a moment after they take your weight. Ledges, joints and sites are always firm.
  const h=new Uint8Array(COLS*ROWS);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const i=r*COLS+c,t=g[i];if(t<HOLD)continue;
    if(t>=LEDGE||r<=2||(forced[i]&&r%2===0)||CHAINS.some(ch=>ch.r===r&&ch.c===c))h[i]=1;else if(R()<.33){const k=R();h[i]=k<.15?3:k<.4?2:1}}
  for(let pass=0;pass<6;pass++){const seen=reachFrom(h,[[1,9],[1,20]]);let fixed=0;
    for(let i=0;i<h.length;i++)if(g[i]>=LEDGE&&!seen[i]){let r=Math.floor(i/COLS);const c=i%COLS;while(r>0&&!seen[r*COLS+c]){r-=2;if(r>=0&&g[r*COLS+c]>=HOLD&&!h[r*COLS+c]){h[r*COLS+c]=1;fixed++}}}
    if(!fixed)break}
  return{g,reg,vari,h}}
const OFFS=[];for(let dr=-3;dr<=3;dr++)for(let dc=-3;dc<=3;dc++)if((dr||dc)&&dr*dr+dc*dc<=C.REACH*C.REACH)OFFS.push([dr,dc]);
const LUNGE_OFFS=OFFS.slice();
for(let dr=-3;dr<=3;dr++)for(let dc=-3;dc<=3;dc++){
  const d=Math.hypot(dr,dc);if(d>C.REACH&&d<=C.LUNGE_REACH)LUNGE_OFFS.push([dr,dc])
}
function reachFrom(h,starts){const seen=new Uint8Array(h.length),q=[];for(const[r,c]of starts){const i=r*COLS+c;if(h[i]){seen[i]=1;q.push(i)}}
  while(q.length){const i=q.pop(),r=Math.floor(i/COLS),c=i%COLS;for(const[dr,dc]of OFFS){const nr=r+dr,nc=c+dc;if(nr<0||nr>=ROWS||nc<0||nc>=COLS)continue;const j=nr*COLS+nc;if(!seen[j]&&h[j]){seen[j]=1;q.push(j)}}}
  return seen}
function floodFrom(g,starts){const seen=new Uint8Array(g.length),q=[];
  for(const[r,c]of starts){const i=r*COLS+c;if(g[i]>=HOLD){seen[i]=1;q.push(i)}}
  while(q.length){const i=q.pop(),r=Math.floor(i/COLS),c=i%COLS;
    for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const nr=r+dr,nc=c+dc;if(nr<0||nr>=ROWS||nc<0||nc>=COLS)continue;const j=nr*COLS+nc;if(!seen[j]&&g[j]>=HOLD){seen[j]=1;q.push(j)}}}
  return seen}
function cellT(x,y){const c=Math.floor(x),r=Math.floor(y);if(r<0||r>=ROWS||c<0||c>=COLS)return AIR;return S.body.g[r*COLS+c]}
const holdAt=(x,y)=>{const c=Math.floor(x),r=Math.floor(y);return r<0||r>=ROWS||c<0||c>=COLS?0:S.body.h[r*COLS+c]};
const climbable=(x,y)=>holdAt(x,y)>0;
// the best hold in a direction within reach: closest to the line, then nearest
function pickHold(cl,dx,dy,reach,min,cmin=.55){const r0=Math.floor(cl.y),c0=Math.floor(cl.x),l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;let best=null,bs=-1e9;
  for(let dr=-4;dr<=4;dr++)for(let dc=-4;dc<=4;dc++){const d=Math.hypot(dr,dc);if(!d||d>reach||d<(min||0))continue;const r=r0+dr,c=c0+dc;if(!holdAt(c,r))continue;
    const cos=(dc*dx+dr*dy)/d;if(cos<cmin)continue;const sc=cos*1.4-d*.12-(S.body.h[r*COLS+c]===3?.15:0);if(sc>bs){bs=sc;best=[r,c]}}
  return best}
// an ordinary reach that finds nothing straight that way takes the nearest hold within eighty degrees of it, so pushing up
// on bare stone moves you up and sideways instead of doing nothing
function reachHold(cl,dx,dy){return pickHold(cl,dx,dy,C.REACH)||pickHold(cl,dx,dy,C.REACH,0,.17)}
const restful=t=>t===LEDGE||t===SITE;
function restRope(h,r,c){return S.anchors.some(a=>a.town===h.town&&Math.abs(a.r-r)<=1&&Math.abs(a.c-c)<=1)}
function jointAt(x,y){const r=Math.floor(y),c=Math.floor(x);for(const id in JOINTS){const j=JOINTS[id];if(r>=j.r0&&r<=j.r1&&c>=j.c0&&c<=j.c1)return id}return null}
function siteAt(x,y){const r=Math.floor(y),c=Math.floor(x);return S.sites.find(s=>s.r===r&&s.c===c)||null}
// breadth-first path over climbable cells; returns [[r,c],...] from start (exclusive) to a goal cell
function bfs(r0,c0,isGoal,maxN,offsets=OFFS){const hh=S.body.h,prev=new Int32Array(hh.length).fill(-1),q=[r0*COLS+c0];prev[q[0]]=q[0];let head=0,found=-1;
  while(head<q.length&&head<(maxN||1e9)){const i=q[head++],r=Math.floor(i/COLS),c=i%COLS;if(head>1&&isGoal(r,c)){found=i;break}
    for(const[dr,dc]of offsets){const nr=r+dr,nc=c+dc;if(nr<0||nr>=ROWS||nc<0||nc>=COLS)continue;const j=nr*COLS+nc;if(prev[j]<0&&hh[j]){prev[j]=i;q.push(j)}}}
  if(found<0)return null;const path=[];let i=found;while(i!==q[0]){path.push([Math.floor(i/COLS),i%COLS]);i=prev[i]}return path.reverse()}

// ================= save =================
const SAVE_KEY='colossus.v1';
let save={v:1,giantWins:0,giantLosses:0,humanWins:0,humanLosses:0,sound:true,firstDay:0};
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s&&s.v===1)save=Object.assign(save,s)}catch(e){}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch(e){}}
const reducedMotion=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})();

