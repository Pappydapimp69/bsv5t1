'use strict';
// Colossus · src/land.js · the land: heights, rivers, lakes, roads, trees, ruins, fairness
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= the land, shaped by giants =================
// Laid in the order a world forms (genLand): the six old giants fall on the high rim, two behind each town; triangle hills rise
// between them (a peak hides what is behind it and offers a choice: over, slower, or round); rivers run downhill from beside
// the bodies to a lake at each town's edge; roads are the cheapest walking lines, each branching off the roads already laid;
// then forests, a crystal field on each flank between neighbours, a wolf den on the rim beyond it, a standing stone on each
// town's way to the giant. Every place is set in its town's sector and copied round with jitter so no town starts worse;
// checkLand measures that on a walking grid, and a seed that fails is laid again from its next attempt (still deterministic).
const LAND={CS:75,N:Math.round(C.MAP/75)+1};
const sstep=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
// raw height of the land (no town flattening), bilinear on the 50-unit grid
function landRaw(x,y){const L=S&&S.land;if(!L)return 0;const N=LAND.N,u=clamp(x/LAND.CS,0,N-1.001),v=clamp(y/LAND.CS,0,N-1.001),i=u|0,j=v|0,fu=u-i,fv=v-j,k=j*N+i,H=L.h;
  return(H[k]*(1-fu)+H[k+1]*fu)*(1-fv)+(H[k+N]*(1-fu)+H[k+N+1]*fu)*fv}
// walking uphill is slower (down to 0.6 of full pace on a steep face); downhill and flat are full pace
// roads are the fast way across the wide land: on a road people walk a quarter faster (uphill still slows them)
C.ROAD_PACE=1.25;
const onRoad=(x,y)=>!!(S.land&&S.land.road&&S.land.road[landCell(x,y)]);
function landPace(h,vx,vy){if(!S.land)return 1;const l=Math.hypot(vx,vy)||1,s=(groundH(h.x+vx/l*30,h.y+vy/l*30)-groundH(h.x,h.y))/30;return (s>0?Math.max(.6,1-1.4*s):1)*(onRoad(h.x,h.y)?C.ROAD_PACE:1)}
// cheapest path on an N by N grid of 8 neighbours. cost(a,b,len) gives a step's cost (Infinity blocks); with goal it returns
// the cells from a start to the first goal cell reached, without one the whole cost field
function landSearch(N,cost,starts,goal){const D=new Float64Array(N*N).fill(Infinity),P=new Int32Array(N*N).fill(-1),hk=[],hv=[];
  const push=(k,v)=>{hk.push(k);hv.push(v);let i=hk.length-1;while(i>0){const p=(i-1)>>1;if(hv[p]<=v)break;hk[i]=hk[p];hv[i]=hv[p];i=p}hk[i]=k;hv[i]=v};
  const pop=()=>{const k=hk[0],lk=hk.pop(),lv=hv.pop(),n=hk.length;if(n){let i=0;for(;;){const l=2*i+1,r=l+1;let m=-1,mv=lv;if(l<n&&hv[l]<mv){m=l;mv=hv[l]}if(r<n&&hv[r]<mv){m=r;mv=hv[r]}if(m<0)break;hk[i]=hk[m];hv[i]=hv[m];i=m}hk[i]=lk;hv[i]=lv}return k};
  for(const s of starts){D[s]=0;push(s,0)}
  while(hk.length){const v=hv[0],k=pop();if(v>D[k])continue;
    if(goal&&goal(k)){const out=[];for(let c=k;c>=0;c=P[c])out.push(c);return out.reverse()}
    const i=k%N,j=(k-i)/N;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const a=i+di,b=j+dj;if(a<0||b<0||a>=N||b>=N)continue;const kk=b*N+a,c=cost(k,kk,di&&dj?1.4142:1);if(!(c<Infinity))continue;const nv=v+c;if(nv<D[kk]){D[kk]=nv;P[kk]=k;push(kk,nv)}}}
  return goal?null:D}
const landCell=(x,y)=>clamp(Math.round(y/LAND.CS),0,LAND.N-1)*LAND.N+clamp(Math.round(x/LAND.CS),0,LAND.N-1);
// a grid path as a smooth line: corners cut twice (Chaikin), then points about every 90 units
function landLine(cells){let p=cells.map(k=>({x:(k%LAND.N)*LAND.CS,y:Math.floor(k/LAND.N)*LAND.CS}));
  for(let it=0;it<2;it++){if(p.length<3)break;const q=[p[0]];for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];q.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75})}q.push(p[p.length-1]);p=q}
  const out=[p[0]];let acc=0;for(let i=1;i<p.length;i++){acc+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);if(acc>=90||i===p.length-1){out.push(p[i]);acc=0}}return out}
function genLand(attempt){const M=C.MAP,cx=M/2,cy=M/2,N=LAND.N,CS=LAND.CS,T=S.towns;
  rnd=mulberry32((S.seed^Math.imul(attempt+1,0x9E3779B1))>>>0);
  S.marks=[];S.caches=[];S.rivers=[];S.lakes=[];S.roads=[];S.trees=[];S.places=[];S.markCols=null;S.land=null;S.landTry=attempt;if(!attempt)S.landFails=[];
  G3.seed=-1;ground=null; // a fresh land is drawn afresh, even on a replayed seed
  const ta=T.map(t=>Math.atan2(t.y-cy,t.x-cx)),pol=(i,a,r)=>({x:cx+Math.cos(ta[i]+a)*r,y:cy+Math.sin(ta[i]+a)*r}),far=(o,p,d)=>Math.hypot(o.x-p.x,o.y-p.y)>d;
  // 1. the old giants: two on the high ground behind each town, lying along the rim
  for(let i=0;i<3;i++)for(const s of[-1,1]){let m=null;
    for(let k=0;k<40;k++){const p=pol(i,s*rr(.56,.66),rr(3250,3550)*WS),c={x:p.x,y:p.y,ang:Math.atan2(p.y-cy,p.x-cx)+Math.PI/2*(rnd()<.5?1:-1)+rr(-.45,.45)},bs=markBoulders(c);
      m=c;if(bs.every(b=>b.x>250&&b.y>250&&b.x<M-250&&b.y<M-250&&far(b,{x:cx,y:cy},1300*WS)&&T.every(t=>far(b,t,t.r+C.HOME_REACH+260))&&S.marks.every(o=>markBoulders(o).every(q=>far(q,b,b.r+q.r+260)))))break}
    m.town=i;m.side=s;S.marks.push(m)}
  S.markCols=null;
  // each ruin's cache lies on the body's inner side, toward the towns
  for(const m of S.marks){let best=null;for(const sg of[1,-1]){const a=m.ang+sg*Math.PI/2;let d=200;while(d<1400&&inSolid(m.x+Math.cos(a)*d,m.y+Math.sin(a)*d,80))d+=30;
      const c={x:clamp(m.x+Math.cos(a)*(d+40),200,M-200),y:clamp(m.y+Math.sin(a)*(d+40),200,M-200),ready:0};if(!best||Math.hypot(c.x-cx,c.y-cy)<Math.hypot(best.x-cx,best.y-cy))best=c}
    S.caches.push(best)}
  // 2. places in clusters, one set to a town's sector: the crystal field on the flank toward the next town, a wolf den on the rim
  // beyond it, a standing stone on the way from the town to the giant. A field sits exactly between its two towns
  for(let i=0;i<3;i++){const f=pol(i,Math.PI/3,rr(2350,2650)*WS),d=pol(i,Math.PI/3+rr(-.08,.08),rr(3600,3760)*WS),st=pol(i,rr(-.14,.14),rr(1500,1700)*WS);
    S.places.push({k:'field',x:f.x,y:f.y,r:600,i},{k:'den',x:d.x,y:d.y,r:220,i},{k:'stone',x:st.x,y:st.y,r:60,i})}
  // 3. the height of the land: rolling ground, a rim that rises toward the bodies, a basin at each town, triangle hills between
  // hills are laid as templates in one sector's frame and copied to all three with jitter; a copy that would crowd a town, the
  // giant, a place or a ruin, or stand on a town's view of the giant, is left out
  // a wider land keeps its hills about as steep, a little taller and broader, and many more of them
  const tmpl=[];for(let k=0;k<52;k++){const big=k<24;tmpl.push({a:rr(-1.04,1.04),r:rr(1250,4250)*WS,H:(big?rr(280,520):rr(150,260))*1.2,A:(big?rr(480,850):rr(320,500))*1.4,B:(big?rr(280,440):rr(200,300))*1.4,o:rr(0,Math.PI)})}
  const hills=[];for(let i=0;i<3;i++)for(const q of tmpl){const a=q.a+rr(-.07,.07),r=q.r+rr(-140,140),p=pol(i,a,r),hh={x:p.x,y:p.y,H:q.H*rr(.85,1.15),A:q.A,B:q.B,o:q.o+ta[i]+rr(-.3,.3)};
    const t=T[i],axis=Math.abs(Math.sin(a))*r;if(r<Math.hypot(t.x-cx,t.y-cy)+200&&axis<hh.B+220)continue; // each town's view of the giant stays open
    if(!T.every(o=>far(hh,o,o.r+C.HOME_REACH+hh.A*.6+80))||!far(hh,{x:cx,y:cy},900*WS+hh.A*.6))continue;
    if(!S.places.every(pl=>far(hh,pl,pl.r+hh.A*(pl.k==='den'?.35:.6)+60))||!S.caches.every(c=>far(hh,c,hh.A*.5+150))||!S.marks.every(m=>far(hh,m,hh.A*.5+650)))continue;
    if(!hills.every(o=>far(hh,o,.55*Math.max(o.A,hh.A))))continue;hills.push(hh)}
  // a coarse noise field, so rivers and roads wind instead of running ruler-straight
  const NZ=new Float32Array(20*20);for(let k=0;k<400;k++)NZ[k]=rnd();const noise=(x,y)=>{const u=clamp(x/M*19,0,18.999),v=clamp(y/M*19,0,18.999),i=u|0,j=v|0,fu=u-i,fv=v-j,k=j*20+i;return(NZ[k]*(1-fu)+NZ[k+1]*fu)*(1-fv)+(NZ[k+20]*(1-fu)+NZ[k+21]*fu)*fv};
  const H=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=i*CS,y=j*CS,rc=Math.hypot(x-cx,y-cy);
    let h=(14*(Math.sin(x*.0011)+Math.sin(y*.0013+1.3))+8*Math.sin((x+y)*.0023))*clamp((rc-450)/900,0,1)+150*sstep((rc-2700*WS)/(1700*WS));
    for(const t of T){const d=Math.hypot(x-t.x,y-t.y);h-=80*Math.exp(-d*d/(1.44e6*WS*WS))}
    for(const m of S.marks){const d=Math.hypot(x-m.x,y-m.y);h+=110*Math.exp(-d*d/(1.96e6*WS*WS))}
    for(const q of hills){const dx=x-q.x,dy=y-q.y;if(Math.abs(dx)>q.A||Math.abs(dy)>q.A)continue;const c=Math.cos(q.o),s=Math.sin(q.o),u=(dx*c+dy*s)/q.A,v=(-dx*s+dy*c)/q.B,e=1-Math.sqrt(u*u+v*v);if(e>0)h+=q.H*e}
    H[j*N+i]=h}
  const blk=new Uint8Array(N*N);for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(inSolid(i*CS,j*CS,20))blk[j*N+i]=1;
  const X=k=>(k%N)*CS,Y=k=>Math.floor(k/N)*CS,wet=new Uint8Array(N*N),road=new Uint8Array(N*N);
  const carve=(cells,bed,slope)=>{let lvl=Infinity;for(const k of cells){lvl=Math.min(lvl,H[k]);const i0=k%N,j0=(k-i0)/N;
      for(let dj=-3;dj<=3;dj++)for(let di=-3;di<=3;di++){const a=i0+di,b=j0+dj;if(a<0||b<0||a>=N||b>=N)continue;const d=Math.hypot(di,dj)*CS;H[b*N+a]=Math.min(H[b*N+a],lvl-bed+Math.max(0,d-40)*slope)}lvl-=.4}};
  // 4. rivers: from a spring beside each body, downhill. The first of each town's pair runs to a lake at its town's edge (away
  // from the first day's house spot); the second joins whatever water it reaches first
  const riverCost=(a,b,L)=>{if(blk[b])return Infinity;const x=X(b),y=Y(b);let c=L*CS*(1+Math.max(0,H[b]+100)/200)*(.55+1.1*noise(x,y))+Math.max(0,H[b]-H[a])*3;
    if(Math.hypot(x-cx,y-cy)<1000*WS)c*=4;for(const t of T){if(Math.hypot(x-t.x,y-t.y)<t.r+150)c+=L*CS*40;if(Math.hypot(x-t.x-t.r-170,y-t.y-40)<240)return Infinity}return c}; // the first day's house spot stays dry
  const spring=m=>{const a=Math.atan2(cy-m.y,cx-m.x);let d=150;while(d<1600&&inSolid(m.x+Math.cos(a)*d,m.y+Math.sin(a)*d,70))d+=30;return landCell(m.x+Math.cos(a)*(d+60),m.y+Math.sin(a)*(d+60))};
  for(const pass of[-1,1])for(const m of S.marks){if(m.side!==pass)continue;const t=T[m.town],hs={x:t.x+t.r+170,y:t.y+40},src=spring(m);let goal;
    if(pass<0)goal=k=>{const x=X(k),y=Y(k),d=Math.hypot(x-t.x,y-t.y);return d>t.r+170&&d<t.r+270&&Math.hypot(x-hs.x,y-hs.y)>380};
    else goal=k=>wet[k]&&Math.abs(k%N-src%N)+Math.abs(Math.floor(k/N)-Math.floor(src/N))>4;
    const path=landSearch(N,riverCost,[src],goal);if(!path)continue;carve(path,10,.45);
    const line=landLine(path);line.w=pass<0?1:.7;
    if(pass<0){const e=line[line.length-1],a=Math.atan2(e.y-t.y,e.x-t.x),lk={x:t.x+Math.cos(a)*(t.r+250),y:t.y+Math.sin(a)*(t.r+250),r:150,town:t.i};S.lakes.push(lk);line.push({x:lk.x,y:lk.y});
      const lvl=Math.min(...path.slice(-3).map(k=>H[k]))-4;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const d=Math.hypot(i*CS-lk.x,j*CS-lk.y);if(d<lk.r+160)H[j*N+i]=Math.min(H[j*N+i],lvl+Math.max(0,d-lk.r)*.4);if(d<lk.r+30)wet[j*N+i]=2}}
    for(const p of line)for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const k=landCell(p.x+di*CS,p.y+dj*CS);if(!wet[k])wet[k]=1}
    S.rivers.push(line)}
  for(const t of T)t.z=null;
  // 5. roads: the cheapest walking line from Ashville to Brindle, then each new road from its place to the nearest road already
  // laid (a road reused costs a third), so the network branches: Corvel, the giant's feet, then tracks to each ruin and field
  const roadCost=(a,b,L)=>{if(blk[b]||wet[b]===2)return Infinity;const x=X(b),y=Y(b);let c=L*CS*(.75+.5*noise(y,x))+Math.abs(H[b]-H[a])*7+(wet[b]?260:0);if(road[b])c*=.33;
    for(const p of S.places)if(p.k==='den'&&Math.hypot(x-p.x,y-p.y)<900)c+=L*CS*3;if(Math.hypot(x-cx,y-cy)<380)c+=L*CS*20;return c};
  const lay=(starts,goal,w)=>{const path=landSearch(N,roadCost,starts,goal);if(!path)return;for(const k of path)road[k]=1;const line=landLine(path);line.w=w;S.roads.push(line)};
  lay([landCell(T[0].x,T[0].y)],k=>k===landCell(T[1].x,T[1].y),1);
  lay([landCell(T[2].x,T[2].y)],k=>road[k],1);
  {const ring=[];for(let a=0;a<36;a++)ring.push(landCell(cx+Math.cos(a/36*6.283)*420,cy+Math.sin(a/36*6.283)*420));lay(ring,k=>road[k],.9)}
  for(const c of S.caches)lay([landCell(c.x,c.y)],k=>road[k],.55);
  for(const p of S.places)if(p.k==='field')lay([landCell(p.x,p.y)],k=>road[k],.55);
  // 6. forests: stands, many on the flanks of the hills, then lone trees; never in towns, on water or roads, in stone or round the giant
  const nearMask=(mask,x,y)=>{const i=Math.round(x/CS),j=Math.round(y/CS);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<N&&b<N&&mask[b*N+a])return true}return false};
  const open=(x,y)=>x>40&&y>40&&x<M-40&&y<M-40&&T.every(t=>far({x,y},t,t.r+260))&&far({x,y},{x:cx,y:cy},650)&&S.places.every(p=>far({x,y},p,p.k==='field'?p.r*.55:p.r+140))&&S.caches.every(c=>far({x,y},c,200))&&!nearMask(wet,x,y)&&!nearMask(road,x,y)&&!inSolid(x,y,30);
  for(let b=0;b<30*WS*WS&&S.trees.length<C.TREES-150*WS*WS;b++){let ox,oy;if(hills.length&&rnd()<.45){const q=hills[Math.floor(rnd()*hills.length)],a=rr(0,6.28);ox=q.x+Math.cos(a)*q.B*.7;oy=q.y+Math.sin(a)*q.B*.7}else{ox=rr(300,M-300);oy=rr(300,M-300)}
    const R=rr(260,620)*1.25,n=Math.round(R/9);for(let k=0;k<n;k++){const a=rr(0,6.28),d=R*Math.sqrt(rnd()),x=ox+Math.cos(a)*d,y=oy+Math.sin(a)*d;if(open(x,y))S.trees.push({x,y,r:rr(14,34)})}}
  for(let k=0;k<4000*WS*WS&&S.trees.length<C.TREES;k++){const x=rr(0,M),y=rr(0,M);if(open(x,y))S.trees.push({x,y,r:rr(14,30)})}
  S.land={h:H,wet,road,hills}}
// beasts that wander keep near their den or ruin, so they come back to it
function leashBeasts(){for(const m of S.monsters){const o=m.home;if(!o||m.raid)continue;if(Math.hypot(m.hx-o.x,m.hy-o.y)>o.r){m.hx=o.x+rr(-o.r,o.r)*.5;m.hy=o.y+rr(-o.r,o.r)*.5}}}
// beasts, crystals and the fairness check; a land that fails is laid again from its next attempt
function populateLand(){for(let a=0;;a++){S.monsters=[];S.crystals=[];S.crysN=0;S.crysRel=null;for(let i=0;i<C.MONSTERS;i++)spawnMonster();for(let i=0;i<C.CRYSTALS;i++)spawnCrystal();
  const ck=checkLand();S.landCheck=ck;if(ck.ok||a>=11)break;(S.landFails=S.landFails||[]).push(ck.why.join('; '));genLand(a+1)}}
// is this land fair? Walking time on a 50-unit grid that respects the stone bodies and slows uphill, from each town to the other
// towns, the giant's feet, its nearest ruin, field and den; each town's share of the crystals (each counted to the town that
// reaches it first); and the first day's places: the house spot, the crystal ring at 520, the wolves' ring, the feet
function checkLand(){const N=LAND.N,CS=LAND.CS,T=S.towns,g=S.g,why=[],blk=new Uint8Array(N*N),G=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;G[k]=groundH(i*CS,j*CS);if(inSolid(i*CS,j*CS,14))blk[k]=1}
  const R=S.land&&S.land.road,cost=(a,b,L)=>{if(blk[b])return Infinity;const s=(G[b]-G[a])/(L*CS);return L*CS/C.H_SPEED/(s>0?Math.max(.6,1-1.4*s):1)/(R&&R[a]&&R[b]?C.ROAD_PACE:1)};
  const D=T.map(t=>landSearch(N,cost,[landCell(t.x,t.y)],null)),at=(d,x,y)=>{const i=Math.round(x/CS),j=Math.round(y/CS);let b=Infinity;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,c=j+dj;if(a>=0&&c>=0&&a<N&&c<N)b=Math.min(b,d[c*N+a])}return b};
  const P=k=>(S.places||[]).filter(p=>p.k===k),near=(d,L)=>Math.min(...L.map(o=>at(d,o.x,o.y)));
  const rows=T.map((t,i)=>({town:t.name,next:Math.max(...T.filter(o=>o!==t).map(o=>at(D[i],o.x,o.y))),foot:near(D[i],g.feet),ruin:near(D[i],S.caches),field:near(D[i],P('field')),den:near(D[i],P('den')),stone:near(D[i],P('stone')),crystals:0}));
  for(const c of S.crystals){const ts=D.map(d=>at(d,c.x,c.y)),m=Math.min(...ts);if(!(m<Infinity)){why.push('crystal out of reach');continue}const w=ts.filter(v=>v-m<1).length;ts.forEach((v,i)=>{if(v-m<1)rows[i].crystals+=1/w})}
  for(const r of rows)for(const k of['next','foot','ruin','field','den','stone'])if(!(r[k]<Infinity))why.push(r.town+' cannot reach its '+k);
  const spread=k=>{const v=rows.map(r=>r[k]);return Math.max(...v)/Math.max(1e-6,Math.min(...v))};
  const sp={foot:spread('foot'),ruin:spread('ruin'),field:spread('field'),den:spread('den'),crystals:spread('crystals')};
  if(sp.foot>1.15)why.push('feet uneven '+sp.foot.toFixed(2));if(sp.ruin>1.35)why.push('ruins uneven '+sp.ruin.toFixed(2));if(sp.field>1.3)why.push('fields uneven '+sp.field.toFixed(2));if(sp.crystals>1.45)why.push('crystals uneven '+sp.crystals.toFixed(2));
  // the first day: the house spot open and dry, the crystal and wolf rings open, a foot reachable from Ashville
  for(const t of T){const hs={x:t.x+t.r+170,y:t.y+40};if(inSolid(hs.x,hs.y,40)||!inTerritory(t.i,hs.x,hs.y))why.push(t.name+' house spot blocked');
    if(S.lakes.some(l=>Math.hypot(l.x-hs.x,l.y-hs.y)<l.r+120)||S.rivers.some(rv=>rv.some(q=>Math.hypot(q.x-hs.x,q.y-hs.y)<110)))why.push(t.name+' house spot in water');
    let open=0;for(let a=0;a<24;a++)if(!inSolid(t.x+Math.cos(a/24*6.283)*520,t.y+Math.sin(a/24*6.283)*520,60))open++;if(open<20)why.push(t.name+' crystal ring blocked');
    let wo=0;for(let a=0;a<24;a++)if(!inSolid(t.x+Math.cos(a/24*6.283)*(t.r+490),t.y+Math.sin(a/24*6.283)*(t.r+490),40))wo++;if(wo<20)why.push(t.name+' wolf ring blocked')}
  for(const c of S.caches)if(inSolid(c.x,c.y,30))why.push('cache in stone');for(const p of S.places||[])if(inSolid(p.x,p.y,40))why.push(p.k+' in stone');
  return{ok:!why.length,why,attempt:S.landTry,spread:sp,towns:rows.map(r=>{const o={};for(const k in r)o[k]=typeof r[k]==='number'?Math.round(r[k]*10)/10:r[k];return o})}}
function aliveTowns(){return S.towns.filter(t=>t.alive)}
function standingTown(i){return S.towns.find(t=>t.alive&&!t.outpost&&t.i===i)}
function factionAlive(i){return !!standingTown(i)}
function isForager(h){return h.role==='folk'&&!h.you&&!h.sol}
function foragerHome(h){const t=S.towns[h.homeId];return t?.alive?t:null}
const FORAGER_CAP=4;
function foragerCapacity(t){return t.alive?Math.min(FORAGER_CAP,1+(t.houses||0)):0}
function foragersIn(t){return S.humans.filter(h=>isForager(h)&&h.homeId===t.id)}
function assignForagerHome(h,t){h.homeId=t?.id??null;h.name=(t?.name||TOWNS[h.town].name)+' forager';h.goal=null;h.quest=null;h.returnHome=!!t}
// a villager left homeless (the giant trampled their house) moves into the first room; a new one comes only when free
// (a new village's first settler) or is trained at the Hall for food (rpg/economy.js)
function fillForagerHousing(t,free=true){if(foragersIn(t).length>=foragerCapacity(t))return false;
  const displaced=S.humans.find(h=>isForager(h)&&h.town===t.i&&h.homeId==null);
  if(displaced)assignForagerHome(displaced,t);else if(free)S.humans.push(mkHuman(t.i,false,'folk',t));else return false;
  return true}
function inForageRange(home,p){return !!home&&dist(home,p)<=C.FORAGE_RANGE}
function homeOf(h){if(isForager(h))return foragerHome(h);let b=null,bd=1e9;const own=aliveTowns().filter(o=>o.i===h.town),pool=own.length||h.hero?own:aliveTowns();for(const o of pool){const d=dist(o,h);if(d<bd){bd=d;b=o}}return b}

