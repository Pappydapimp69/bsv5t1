'use strict';
// Colossus · src/view2d.js · the canvas 2D fallback ground view and the giant's body panel
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ----- ground view: a turning perspective camera on canvas 2D (from the giant project's proven renderer) -----
// The eye sits behind and above the focus; the ground is drawn in strips, each mapped world-to-screen affinely,
// and upright things are depth-sorted, so the giant towers out of the ground and far things fade into haze.
const cam={yaw:0,pitch:.12};const CAM={YAW_RATE:1.8,PITCH_RATE:.9};
const view={k:1,f:1,D:1000,Hc:500,hz:0,F:null,R:null,ox:0,oy:0};
function camTurn(dyaw,dpitch){cam.manualT=S?S.t:0;cam.yaw=(cam.yaw+dyaw)%(Math.PI*2);cam.pitch=clamp(cam.pitch+dpitch,-.6,1);if(S)S.introCam=false}
function setCam(){const z=S.cam.czoom,span=(S.role==='giant'?2600:800)/z,k=Math.min(W,H)/span;view.k=k;view.D=(S.role==='giant'?1900:1100)/z;view.f=k*view.D;
  view.F={x:Math.sin(cam.yaw),y:-Math.cos(cam.yaw)};view.R={x:Math.cos(cam.yaw),y:Math.sin(cam.yaw)};
  view.hz=H*((S.role==='giant'?.16:.22)-cam.pitch*.55);view.Hc=(H*.7-view.hz)/k}
function proj(x,y,z){const dx=x-S.cam.x,dy=y-S.cam.y;const d=view.D+dx*view.F.x+dy*view.F.y;if(d<60)return null;const s=view.f/d;
  return{x:W/2+(dx*view.R.x+dy*view.R.y)*s+view.ox,y:view.hz+(view.Hc-z)*s+view.oy,s,d}}
function screenToWorld(sx,sy){if(G3.active)return g3ScreenToWorld(sx,sy);if(!view.F)setCam();const y=Math.max(sy,view.hz+4);const d=Math.min(9000,view.Hc*view.f/(y-view.hz));const along=d-view.D,lat=(sx-W/2)*d/view.f;
  return{x:S.cam.x+view.F.x*along+view.R.x*lat,y:S.cam.y+view.F.y*along+view.R.y*lat}}
// stick (right, down) to a world direction, so up on the stick always walks into the screen
function camRelative(m){if(!view.F)return m;return{x:view.R.x*m.x-view.F.x*m.y,y:view.R.y*m.x-view.F.y*m.y}}
const nearFade=p=>p.d<view.D*.92?.32:1;
const fogOf=d=>clamp((d-2600)/7000,0,.82);
let ground=null,groundSeed=-1,groundV=0;const RES=8;
function buildGround(){const M=C.MAP,n=M/RES,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d'),r=mulberry32(S.seed+7);
  g.fillStyle='#6f7f52';g.fillRect(0,0,n,n);
  for(let i=0;i<3000*WS*WS;i++){const x=r()*n,y=r()*n,s=6+r()*34;g.fillStyle=['#77885a','#66754b','#827f5a','#5f7148'][i%4];g.beginPath();g.arc(x,y,s,0,7);g.fill()}
  landTint(g,n);
  g.fillStyle='#3f5634';for(const t of S.trees){g.beginPath();g.arc(t.x/RES,t.y/RES,t.r/RES*1.6,0,7);g.fill()}
  landPlaces(g);landWater(g);
  for(let i=0;i<40*WS*WS;i++){const x=r()*n,y=r()*n,s=40+r()*90,gr=g.createRadialGradient(x,y,0,x,y,s);gr.addColorStop(0,'rgba(140,130,95,.35)');gr.addColorStop(1,'rgba(140,130,95,0)');g.fillStyle=gr;g.fillRect(x-s,y-s,s*2,s*2)}
  landRoads(g);
  g.globalAlpha=1;ground=c;groundSeed=S.seed;groundV++}
// ---- the land in the view: high ground, places, smoke over the old giants, the forest the giant flattens, worn trails ----
// high ground drier and stonier, steep faces rocky, low ground by the water greener: painted once from the height grid
function landTint(g,n){const L=S.land;if(!L)return;const N=LAND.N,H=L.h,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),im=x.createImageData(N,N),d=im.data;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,h=H[k],sx=(H[j*N+Math.min(N-1,i+1)]-H[j*N+Math.max(0,i-1)])/(2*LAND.CS),sy=(H[Math.min(N-1,j+1)*N+i]-H[Math.max(0,j-1)*N+i])/(2*LAND.CS),sl=Math.hypot(sx,sy);
    let r=0,gg=0,b=0,a=0;const hi=clamp((h-120)/280,0,1)*.5,st=clamp((sl-.28)/.4,0,1)*.45,lo=clamp((-h-30)/60,0,1)*.3;
    if(hi+st+lo>0){const w=hi+st+lo;r=(154*hi+128*st+86*lo)/w;gg=(146*hi+120*st+124*lo)/w;b=(104*hi+104*st+66*lo)/w;a=Math.min(.7,w)}
    d[k*4]=r;d[k*4+1]=gg;d[k*4+2]=b;d[k*4+3]=a*255}
  x.putImageData(im,0,0);g.imageSmoothingEnabled=true;g.drawImage(c,0,0,n,n)}
function landPlaces(g){for(const p of S.places||[]){const x=p.x/RES,y=p.y/RES;
  if(p.k==='field'){const R=p.r/RES*1.15,gr=g.createRadialGradient(x,y,0,x,y,R);gr.addColorStop(0,'rgba(200,236,240,.42)');gr.addColorStop(.7,'rgba(170,220,230,.18)');gr.addColorStop(1,'rgba(170,220,230,0)');g.fillStyle=gr;g.fillRect(x-R,y-R,R*2,R*2)}
  if(p.k==='den'){const R=p.r/RES*1.4,gr=g.createRadialGradient(x,y,0,x,y,R);gr.addColorStop(0,'rgba(64,46,32,.75)');gr.addColorStop(1,'rgba(64,46,32,0)');g.fillStyle=gr;g.fillRect(x-R,y-R,R*2,R*2)}
  if(p.k==='stone'){g.fillStyle='rgba(150,140,118,.6)';g.beginPath();g.arc(x,y,14,0,7);g.fill()}}}
function landWater(g){g.lineCap='round';g.lineJoin='round';
  for(const rv of S.rivers){const w=rv.w||1;for(const pass of[0,1])for(let i=1;i<rv.length;i++){const u=i/rv.length,lw=(3+5*u)*w;g.strokeStyle=pass?'#4f7f99':'#56663f';g.lineWidth=pass?lw:lw+5;g.beginPath();g.moveTo(rv[i-1].x/RES,rv[i-1].y/RES);g.lineTo(rv[i].x/RES,rv[i].y/RES);g.stroke()}}
  for(const l of S.lakes||[]){g.fillStyle='#56663f';g.beginPath();g.arc(l.x/RES,l.y/RES,l.r/RES+3,0,7);g.fill();g.fillStyle='#4f7f99';g.beginPath();g.arc(l.x/RES,l.y/RES,l.r/RES,0,7);g.fill();g.fillStyle='rgba(190,220,235,.25)';g.beginPath();g.arc(l.x/RES-3,l.y/RES-3,l.r/RES*.55,0,7);g.fill()}}
function landRoads(g){g.lineCap='round';g.lineJoin='round';for(const pass of[0,1])for(const rd of S.roads||[]){const w=rd.w||1;g.globalAlpha=pass?.85:.45;g.strokeStyle=pass?'#bba982':'#7d6e50';g.lineWidth=(pass?4.2:6.4)*w;g.beginPath();rd.forEach((p,i)=>i?g.lineTo(p.x/RES,p.y/RES):g.moveTo(p.x/RES,p.y/RES));g.stroke()}g.globalAlpha=1}
// the minimap: the ground with the hills shaded (light from the north-west) and the places marked
let miniShade=null,miniShadeFor=null,miniG=null,miniGAt=-1;
function miniGround(){if(!miniG||miniGAt!==groundV){miniGAt=groundV;miniG=miniG||document.createElement('canvas');miniG.width=miniG.height=360;const g=miniG.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(ground,0,0,360,360)}return miniG}
function miniRelief(x0,y0,s){const L=S.land;if(!L)return;if(miniShadeFor!==L){miniShadeFor=L;const N=LAND.N,H=L.h,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),im=x.createImageData(N,N),d=im.data;
    for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){const k=j*N+i,v=((H[k-1]-H[k+1])+(H[k-N]-H[k+N]))/(2*LAND.CS);const a=clamp(Math.abs(v)*.9,0,.38);d[k*4]=v>0?255:28;d[k*4+1]=v>0?248:36;d[k*4+2]=v>0?224:20;d[k*4+3]=a*255}
    x.putImageData(im,0,0);miniShade=c}ctx.imageSmoothingEnabled=true;ctx.drawImage(miniShade,x0,y0,s,s)}
function miniPlaces(x0,y0,k){for(const p of S.places||[]){const x=x0+p.x*k,y=y0+p.y*k;
  if(p.k==='field'){ctx.fillStyle='#bff4ff';ctx.beginPath();ctx.moveTo(x,y-3.5);ctx.lineTo(x+2.5,y);ctx.lineTo(x,y+3.5);ctx.lineTo(x-2.5,y);ctx.fill()}
  else if(p.k==='den'){ctx.fillStyle='#3a2a20';ctx.strokeStyle='#c98a6a';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,2.6,0,7);ctx.fill();ctx.stroke()}
  else{ctx.fillStyle='#d8d0bc';ctx.fillRect(x-1,y-3,2,6)}}}
// labels for the places, near enough to matter
function mapLabels(){for(const p of S.places||[]){const far=p.k==='field'?3200:2400,q=p3(p.x,p.y,p.k==='stone'?250:p.k==='den'?110:60);if(q&&q.d<far)lbl(p.k==='field'?'Crystal field':p.k==='den'?'Wolf den':'Standing stone',q.x,q.y,11,p.k==='field'?'#9fe8ff':p.k==='den'?'#ffb39a':'#e8dcc4')}}
const SMOKE_N=16,BIRD_N=7,TREE_COLS=Math.ceil(C.MAP/250)+2;
function g3MapBuild(){const sc=G3.scene;if(!S.land)return;const R=mulberry32(S.seed+31);
  // the land faceted like the stone, so each hill's faces catch the light as triangles
  for(const o of sc.children)if(o.material&&o.material.map&&o.material.map===G3.groundTex){o.material.flatShading=true;o.material.needsUpdate=true}
  G3.treeHash=new Map();S.trees.forEach((t,i)=>{const k=Math.floor(t.x/250)+Math.floor(t.y/250)*TREE_COLS;let a=G3.treeHash.get(k);if(!a)G3.treeHash.set(k,a=[]);a.push(i)});G3.falling=[];
  G3.trail=new Uint8Array(Math.ceil(C.MAP/40)**2);G3.trailAt=new WeakMap();G3.trailT=0;G3.texAt=0;
  // wolf dens (a horseshoe of dark rock round a hollow) and standing stones (a tall stone in a ring of short ones)
  const dens=S.places.filter(p=>p.k==='den'),stones=S.places.filter(p=>p.k==='stone');
  const rk=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),dens.length*10);let n=0;
  for(const p of dens){const a0=R()*6.28;for(let i=0;i<10;i++){const a=a0+.5+i/9*5.3,d=i===9?0:95+R()*40,s=i===9?70:28+R()*34,x=p.x+Math.cos(a)*d,y=p.y+Math.sin(a)*d;if(i===9){put(rk,n,p.x+Math.cos(a0+3.1)*60,p.y+Math.sin(a0+3.1)*60,groundH(x,y)+20,s*1.4,s*.9,s,R()*3,R())}else put(rk,n,x,y,groundH(x,y)+s*.4,s,s*.8,s,R()*3,R());rk.setColorAt(n++,_c.set(['#4a4036','#3e362e','#55493c'][i%3]))}}
  rk.count=n;sc.add(rk);
  const sb=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),stones.length*7);n=0;
  for(const p of stones){const z=groundH(p.x,p.y);put(sb,n,p.x,p.y,z+62,30,140,20,R()*3,(R()-.5)*.1);sb.setColorAt(n++,_c.set('#8d8676'));for(let i=0;i<6;i++){const a=i/6*6.28+R()*.3,x=p.x+Math.cos(a)*75,y=p.y+Math.sin(a)*75,h=26+R()*30;put(sb,n,x,y,groundH(x,y)+h/2-6,18,h,13,a,(R()-.5)*.25);sb.setColorAt(n++,_c.set('#6f6a5e'))}}
  sb.count=n;sc.add(sb);
  // smoke rising from each ruin and birds circling over it: a thin column and dark specks that read on the skyline from anywhere
  const pts=(cnt,col,frag)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(cnt*3),3));geo.setAttribute('size',new THREE.BufferAttribute(new Float32Array(cnt),1));geo.setAttribute('alpha',new THREE.BufferAttribute(new Float32Array(cnt),1));
    const mat=new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color(col)},haze:{value:new THREE.Color('#cdbfa2')},scale:{value:600}},transparent:true,depthWrite:false,
      vertexShader:'attribute float size;attribute float alpha;varying float va;varying float vf;uniform float scale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);va=alpha;vf=clamp((-mv.z-3000.)/18000.,0.,.35);gl_PointSize=clamp(size*scale/-mv.z,1.5,180.);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform vec3 col;uniform vec3 haze;varying float va;varying float vf;void main(){vec2 d=gl_PointCoord-.5;'+frag+'if(a<.01)discard;gl_FragColor=vec4(mix(col,haze,vf),a);}'});
    const m=new THREE.Points(geo,mat);m.frustumCulled=false;sc.add(m);return m};
  G3.smoke=pts(S.marks.length*SMOKE_N,'#57524c','float a=va*smoothstep(.5,.15,length(d));');
  G3.birds=pts(S.marks.length*BIRD_N,'#1e1b18','float y=-d.y,x=abs(d.x);float a=va*step(x,.46)*smoothstep(.13,.04,abs(y-(.25-x*1.1*va)));');
  G3.smokeSeed=S.marks.map(()=>({w:R()*6.28,ph:R()}));G3.wind={x:Math.cos(R()*6.28),y:0};G3.wind.y=Math.sqrt(1-G3.wind.x*G3.wind.x)}
function g3MapUpdate(){if(!S.land||!G3.smoke)return;const t=S.t,now=performance.now();
  const sc=H*DPR/(2*Math.tan(G3.cam.fov*Math.PI/360));G3.smoke.material.uniforms.scale.value=sc;G3.birds.material.uniforms.scale.value=sc;
  G3.smoke.material.uniforms.haze.value.copy(G3.scene.fog.color);G3.birds.material.uniforms.haze.value.copy(G3.scene.fog.color);
  {const P=G3.smoke.geometry.attributes,pos=P.position.array,sz=P.size.array,al=P.alpha.array;let n=0;
    S.marks.forEach((m,mi)=>{const c=S.caches[mi]||m,z0=groundH(c.x,c.y)+30,sd=G3.smokeSeed[mi];for(let k=0;k<SMOKE_N;k++){const u=(t/46+k/SMOKE_N+sd.ph)%1,lean=u*u*520;
      pos[n*3]=c.x+G3.wind.x*lean+Math.sin(t*.3+k+sd.w)*20*u;pos[n*3+1]=z0+u*2100;pos[n*3+2]=c.y+G3.wind.y*lean;sz[n]=60+u*320;al[n]=.62*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.15)),.6)*(1-u*.4);n++}});
    P.position.needsUpdate=P.size.needsUpdate=P.alpha.needsUpdate=true}
  {const P=G3.birds.geometry.attributes,pos=P.position.array,sz=P.size.array,al=P.alpha.array;let n=0;
    S.marks.forEach((m,mi)=>{const sd=G3.smokeSeed[mi],z0=groundH(m.x,m.y);for(let k=0;k<BIRD_N;k++){const w=(k%2?1:-1)*(.18+k*.013),a=t*w+k*.9+sd.w,r=260+((k*97)%7)*45;
      pos[n*3]=m.x+Math.cos(a)*r;pos[n*3+1]=z0+650+((k*53)%5)*60+Math.sin(t*.7+k)*40;pos[n*3+2]=m.y+Math.sin(a)*r;sz[n]=34;al[n]=.55+.45*Math.abs(Math.sin(t*(5+k%3)+k));n++}});
    P.position.needsUpdate=P.size.needsUpdate=P.alpha.needsUpdate=true}
  // the giant's feet knock down the forest they land in or sweep through; each fallen tree leaves a scar in the ground
  const g=S.g,gc=ground&&ground.getContext('2d');
  for(const ft of g.feet){const lift=ft.air>0?Math.sin((1-ft.air/ft.dur)*Math.PI)*170:0;if(lift>120)continue;const hx=Math.floor(ft.x/250),hy=Math.floor(ft.y/250);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=G3.treeHash.get(hx+dx+(hy+dy)*TREE_COLS);if(!a)continue;for(const i of a){const tr=S.trees[i];if(tr.fell!=null)continue;const d=Math.hypot(tr.x-ft.x,tr.y-ft.y);if(d>C.FOOT_R+60)continue;
      tr.fell=t;tr.fd=Math.atan2(tr.y-ft.y,tr.x-ft.x)+(((i*37)%9)-4)*.08;G3.falling.push(i);
      if(gc){const x=tr.x/RES,y=tr.y/RES,s=tr.r/RES;gc.fillStyle='rgba(111,127,82,.85)';gc.beginPath();gc.arc(x,y,s*1.7,0,7);gc.fill();gc.strokeStyle='rgba(92,72,48,.8)';gc.lineWidth=Math.max(1,s*.5);gc.beginPath();gc.moveTo(x,y);gc.lineTo(x+Math.cos(tr.fd)*s*3.4,y+Math.sin(tr.fd)*s*3.4);gc.stroke();G3.groundDirty=true}}}}
  if(G3.falling.length){const ax=new THREE.Vector3(),up=new THREE.Vector3();G3.falling=G3.falling.filter(i=>{const tr=S.trees[i],u=Math.min(1,(t-tr.fell)/.9),th=1.5*u*u,dx=Math.cos(tr.fd),dz=Math.sin(tr.fd),gz=groundH(tr.x,tr.y),h=tr.r*3.6;
      ax.set(dz,0,-dx);_q.setFromAxisAngle(ax,th);
      for(const[mesh,c,sx,sy]of[[G3.t1,h*.62,tr.r*.9,h*.75],[G3.t2,h*.3,tr.r*1.15,h*.6]]){up.set(0,c,0).applyQuaternion(_q);_p.set(tr.x+up.x,gz+up.y+tr.r*.3*u,tr.y+up.z);_s.set(sx,sy,sx);_m.compose(_p,_q,_s);mesh.setMatrixAt(i,_m)}
      return u<1});G3.t1.instanceMatrix.needsUpdate=G3.t2.instanceMatrix.needsUpdate=true}
  // trails wear in where people walk often: each stretch walked darkens the ground a little, up to five times
  if(gc&&t-G3.trailT>.4){G3.trailT=t;const Wc=Math.ceil(C.MAP/40);for(const h of S.humans){if(h.dead||h.mode!=='ground'){G3.trailAt.delete(h);continue}const p=G3.trailAt.get(h);G3.trailAt.set(h,{x:h.x,y:h.y});if(!p)continue;
      const d=Math.hypot(h.x-p.x,h.y-p.y);if(d<8||d>400||townAt(h))continue;const st=Math.ceil(d/30);
      for(let s=1;s<=st;s++){const x=p.x+(h.x-p.x)*s/st,y=p.y+(h.y-p.y)*s/st,k=Math.floor(y/40)*Wc+Math.floor(x/40),v=G3.trail[k]=Math.min(255,G3.trail[k]+1);
        if(v===2||v===5||v===10||v===18||v===30){gc.fillStyle='rgba(132,108,72,.26)';gc.beginPath();gc.arc(x/RES,y/RES,3.2,0,7);gc.fill();G3.groundDirty=true}}}}
  if(G3.groundDirty&&G3.groundTex&&now-G3.texAt>15000){G3.groundDirty=false;G3.texAt=now;G3.groundTex.needsUpdate=true;groundV++}}
// the camera never sinks into a hill, and rises over a ridge between it and you rather than lose you behind it
function g3MapCamera(){if(!S.land||climbing3D())return;const cm=G3.cam,p=cm.position,fx=S.cam.x,fy=S.cam.y,fz=groundH(fx,fy)+60;let need=groundH(p.x,p.z)+45;
  for(let k=1;k<=8;k++){const u=k/8,x=fx+(p.x-fx)*u,y=fy+(p.z-fy)*u,h=groundH(x,y)+25;need=Math.max(need,fz+(h-fz)/u)}
  G3.lift=G3.lift||0;const want=Math.max(0,need-p.y);G3.lift+=(want-G3.lift)*(want>G3.lift?.35:.08);if(G3.lift<.5)return;
  p.y+=G3.lift;const D=(S.role==='giant'?2600:760)/S.cam.czoom;cm.lookAt(fx,fz+(cam.pitch<0?-cam.pitch*D*1.6:0),fy);const F=view.F,far=new THREE.Vector3(fx+F.x*14000,0,fy+F.y*14000).project(cm);view.hz=clamp((1-far.y)/2*H,-H,H*1.2)}
function lbl(text,x,y,size,col){if(FILM)return;size*=UI;ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(text).width;ctx.fillStyle='rgba(10,12,10,.72)';ctx.fillRect(x-w/2-4,y-size*.65,w+8,size*1.3);ctx.fillStyle=col||'#eee9dd';ctx.fillText(text,x,y);ctx.textBaseline='alphabetic'}
function pbar(x,y,w,v,col){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(x-w/2-1,y-1,w+2,6);ctx.fillStyle=col;ctx.fillRect(x-w/2,y,w*clamp(v,0,1),4)}
function groundEllipse(x,y,r){const p=proj(x,y,0);if(!p)return null;ctx.beginPath();ctx.ellipse(p.x,p.y,r*p.s,Math.max(1,r*p.s*view.Hc/p.d),0,0,7);return p}
function rock(x,y,r,seed){ctx.beginPath();for(let i=0;i<9;i++){const a=i/9*6.283+seed,q=r*(.8+(((seed*131+i*71)%17)/17)*.25);i?ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q):ctx.moveTo(x+Math.cos(a)*q,y+Math.sin(a)*q)}ctx.closePath()}
function stone(x,y,r,col,seed){if(r<.6)return;ctx.fillStyle=col[2];rock(x+r*.08,y+r*.1,r,seed);ctx.fill();ctx.fillStyle=col[0];rock(x,y,r*.94,seed);ctx.fill();ctx.fillStyle=col[1];rock(x-r*.28,y-r*.3,r*.5,seed+3);ctx.fill();
  if(r>6){ctx.fillStyle=col[2];ctx.globalAlpha*=.5;ctx.beginPath();ctx.arc(x+r*((seed%7)/14-.2),y+r*.35,r*.18,0,7);ctx.fill();ctx.globalAlpha/=.5}}
const STONE={ok:['#9a8f80','#c2b6a2','#5c544a'],hurt:['#8f7766','#b39a86','#563f35'],crip:['#7a4a3a','#9c6450','#3e231b'],dead:['#5e5852','#7a736b','#2f2b27']};
const PART_JOINT={lleg:'kneeL',rleg:'kneeR',torso:'heart',larm:'elbowL',rarm:'elbowR',head:'neck'};
function partStone(k){if(S.g.dead)return STONE.dead;const j=S.joints[PART_JOINT[k]];if(j.crip)return STONE.crip;return j.hp/j.max<.5?STONE.hurt:STONE.ok}
// the giant as a cloud of boulders in world space, each tagged with its part
// the living giant's poses, from its own state (render only: climbers ride the back and legs, which bodyWorld lifts the same way)
function windU(g,k){const w=g.wind;return w&&w.k===k?1-w.t/w.dur:-1}
function stompLift(g,i){const u=windU(g,'stomp');if(u<0||i)return 0;return u<.8?Math.sin(u/.8*Math.PI/2)*300:300*(1-(u-.8)/.2)}
function armPose(g){const f=fwd(g),sd={x:-f.y,y:f.x},sw=Math.sin(g.sway*Math.PI)*Math.min(1,g.v/C.G_SPEED),P=[{fw:sw*260,up:0,out:0},{fw:-sw*260,up:0,out:0}];
  let u=windU(g,'smash');if(u>=0&&g.wind.x!=null){const i=(g.wind.x-g.x)*sd.x+(g.wind.y-g.y)*sd.y<0?0:1,r=u<.75?Math.sin(u/.75*Math.PI/2):1-(u-.75)/.25*1.15;P[i]={fw:200*r+(u>.75?500*(u-.75)/.25:0),up:1300*r,out:0}}
  u=windU(g,'swipe');if(u>=0){const i=g.wind.side==='L'?0:1;P[i]=u<.7?{fw:-300*Math.sin(u/.7*Math.PI/2),up:-80,out:200}:{fw:-300+1000*(u-.7)/.3,up:-120,out:200-700*(u-.7)/.3}}
  return P}
function giantBoulders(g){const f=fwd(g),side={x:-f.y,y:f.x},out=[];let n=0;const lie=g.fallen>0||g.dead,ap=lie||!g.feet.length?null:armPose(g),shk=windU(g,'shake'),breath=!lie&&!g.awake?Math.sin(S.t*.55)*10:0;
  // a twitch trembles one part while it winds up, then jerks it
  const tww=g.wind&&g.wind.k==='twitch'?g.wind:null,twf=S.fx&&S.fx.find(x=>x.k==='twitch'),twz=tww?tww.zone:twf?twf.zone:null,twa=tww?7:twf?34*(1-twf.t/twf.life):0;
  const partZone=(part,lat,z)=>part==='lleg'||part==='rleg'?'legs':part==='larm'?'left':part==='rarm'?'right':part==='head'||z>=1250?'top':lat<0?'left':'right';
  const put=(lat,fw,z,r,part)=>{n++;const jit=1+((n*37)%11-5)/40;if(!lie){if(shk>=0)lat+=Math.sin(S.t*47+n)*16;if(twz&&partZone(part,lat,z)===twz){lat+=Math.sin(S.t*53+n*1.7)*twa;z+=Math.abs(Math.sin(S.t*41+n))*twa*.6}if(part!=='lleg'&&part!=='rleg')z+=breath}
    if(lie){out.push({x:g.x+f.x*(z*.45+fw*.3)+side.x*lat,y:g.y+f.y*(z*.45+fw*.3)+side.y*lat,z:r*.75+20,r:r*jit,part,n});return}
    out.push({x:g.x+f.x*fw+side.x*lat,y:g.y+f.y*fw+side.y*lat,z,r:r*jit,part,n})};
  g.feet.forEach((ft,i)=>{const s=i?1:-1,lift=lie?0:(ft.air>0?Math.sin((1-ft.air/ft.dur)*Math.PI)*170:0)+stompLift(g,i);const fl={x:ft.x-g.x,y:ft.y-g.y},flat=fl.x*side.x+fl.y*side.y,ffw=fl.x*f.x+fl.y*f.y;
    for(let j=0;j<8;j++){const t=j/7;put(flat+(s*80-flat)*t,ffw*(1-t)+10*t,40+lift*(1-t)+(950-40-lift)*t,j===0?105:88+t*20,i?'rleg':'lleg')}});
  [[980,150,3,120],[1120,210,4,125],[1260,260,4,130],[1400,300,5,130],[1520,330,5,125]].forEach(([z,w,m,r])=>{for(let j=0;j<m;j++)put(-w+2*w*j/(m-1),-40+((j*13)%3)*25,z,r,'torso')});
  put(0,-110,1250,150,'torso');put(0,60,1200,140,'torso');
  for(const s of[-1,1]){const A=ap&&ap[s<0?0:1];for(let j=0;j<7;j++){const t=j/6;put(s*(380+t*60+(A?A.out*t:0)),20+t*50+(A?A.fw*t:0),1500-t*820+(A?A.up*t:0),j===6?105:118-t*30,s<0?'larm':'rarm')}}
  put(0,70,1690,118,'head');put(0,110,1640,80,'head');
  return out}
function markBoulders(m){if(m.b)return m.b;const fake={x:m.x,y:m.y,ang:m.ang,fallen:1,dead:false,feet:[{x:m.x,y:m.y,air:0},{x:m.x,y:m.y,air:0}]};m.b=giantBoulders(fake).map(b=>({...b,z:b.z*1.4,r:b.r*1.35}));return m.b}
// a point on the body grid (column, row) placed in the world, so climbers and cannons ride the giant
function bodyWorld(col,row,face=-1){const g=S.g,f=fwd(g),side={x:-f.y,y:f.x},lie=g.fallen>0||g.dead,z=row*FT,lat=(col-COLS/2)*26;
  if(lie)return{x:g.x+f.x*z*.45+side.x*lat,y:g.y+f.y*z*.45+side.y*lat,z:160};
  if(z<950&&(col<COLS/2-2||col>COLS/2+1)){const ft=g.feet[col<COLS/2?0:1],t=z/950,lift=((ft.air>0?Math.sin((1-ft.air/ft.dur)*Math.PI)*170:0)+stompLift(g,col<COLS/2?0:1))*(1-t),bx=ft.x+(g.x+side.x*Math.sign(lat)*80-ft.x)*t,by=ft.y+(g.y+side.y*Math.sign(lat)*80-ft.y)*t;
    const hip=clamp((z-850)/100,0,1),depth=face*(112+38*t+hip*80),width=(lat-Math.sign(lat)*80)*(.4+.6*hip);
    return{x:bx+f.x*depth+side.x*width,y:by+f.y*depth+side.y*width,z:z+lift}}
  return{x:g.x+f.x*face*230+side.x*lat,y:g.y+f.y*face*230+side.y*lat,z}}
function climberWorld(h){const cl=h.cl,p=bodyWorld(cl.x,cl.y,cl.face),grab=cl.grab;if(!grab||reducedMotion)return p;
  const progress=clamp((S.t-grab.t)/GRAB_TIME,0,1),u=progress*progress*(3-2*progress);
  return{x:grab.x+(p.x-grab.x)*u,y:grab.y+(p.y-grab.y)*u,z:p.z*u}}
function figure(p,hpx,cloak,shape,badge,you){const w=hpx*.42;ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(p.x,p.y,w*.9,w*.3,0,0,7);ctx.fill();
  ctx.fillStyle=cloak;ctx.strokeStyle=you?'#ffffff':'#1a1612';ctx.lineWidth=you?2:1.2;ctx.beginPath();ctx.moveTo(p.x,p.y-hpx*.82);ctx.lineTo(p.x+w,p.y);ctx.lineTo(p.x-w,p.y);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#e7d3b8';ctx.beginPath();ctx.arc(p.x,p.y-hpx*.85,hpx*.15,0,7);ctx.fill();ctx.stroke();
  shapePath(ctx,p.x,p.y-hpx*1.25,Math.max(3,hpx*.14),shape);ctx.fillStyle=badge;ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1;ctx.stroke()}
function openingK(){if(!S||S.t>OPENING.len+3)return 0;const t=S.t;return clamp(Math.min(t/4,1,(OPENING.len+3-t)/5),0,1)}
function hitFlash(){if(!S)return 0;let f=0;for(const h of OPENING.hits){const d=S.t-h;if(d>=0&&d<1.2)f=Math.max(f,1-d/1.2)}return f}
const mix=(a,b,k)=>{const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)),A=p(a),B=p(b);return'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*k)).join(',')+')'};
function drawSky(){const hz=view.hz;if(hz<=0)return;const ok=openingK(),fl=hitFlash();const gr=ctx.createLinearGradient(0,0,0,hz+2);gr.addColorStop(0,mix('#6f8396','#1f1624',ok));gr.addColorStop(.7,mix('#b9b3a3','#5c2a26',ok));gr.addColorStop(1,mix('#dcc9a6','#c0643a',ok));ctx.fillStyle=gr;ctx.fillRect(0,0,W,hz+2);
  if(ok>0)paintRift(hz,ok,fl);
  // a far ridge all round the horizon, turning with the camera
  ctx.fillStyle=mix('#8e9aa0','#3a2a2c',ok);ctx.beginPath();ctx.moveTo(0,hz+2);for(let x=0;x<=W;x+=8){const a=cam.yaw*3+x/W*2.2;ctx.lineTo(x,hz-8-14*(Math.sin(a*3.1)+.6*Math.sin(a*7.3)+.3*Math.sin(a*13.7)+1.9))}ctx.lineTo(W,hz+2);ctx.closePath();ctx.fill();
  const r=mulberry32(99);ctx.fillStyle=ok>0?`rgba(${Math.round(240-170*ok)},${Math.round(236-190*ok)},${Math.round(226-180*ok)},${.55+.3*ok})`:'rgba(240,236,226,.55)';for(let i=0;i<9;i++){const x=((r()*W*2-(S.t*4+cam.yaw*W*.8))%(W*1.6)+W*1.6)%(W*1.6)-W*.3,y=r()*hz*.85,w=40+r()*120;ctx.beginPath();ctx.ellipse(x,y,w,w*.22,0,0,7);ctx.fill();ctx.beginPath();ctx.ellipse(x+w*.3,y-w*.08,w*.5,w*.18,0,0,7);ctx.fill()}}
// the rift: a seam of light tearing open overhead, beams falling through it on the hits, the clouds pulled round it
function paintRift(hz,k,fl){if(fl>.7&&S&&!S.shookAt||(S&&S.shookAt&&S.t-S.shookAt>1&&fl>.7)){S.shookAt=S.t;shake(10)}const t=S.t,cx=W/2+Math.sin(cam.yaw)*W*.15,cy=hz*.38,open=k*Math.min(1,Math.max(0,(t-2)/8)),rx=W*.32*open,ry=hz*.12*open+2;
  if(open<=0)return;ctx.save();
  // beams
  ctx.globalCompositeOperation='lighter';for(let i=0;i<9;i++){const a=-.9+i*.22+Math.sin(t*.4+i)*.04,len=H*1.2,wd=(.035+.02*Math.sin(i*1.7+t))*(1+fl*.8);ctx.fillStyle=`rgba(255,${190+i*5},${120+i*8},${(.05+.12*fl)*open})`;
    ctx.beginPath();ctx.moveTo(cx+Math.sin(a)*rx*.6,cy);ctx.lineTo(cx+Math.sin(a+wd)*len,cy+Math.cos(a+wd)*len);ctx.lineTo(cx+Math.sin(a-wd)*len,cy+Math.cos(a-wd)*len);ctx.closePath();ctx.fill()}
  ctx.globalCompositeOperation='source-over';
  // the opening itself, a glow behind a ragged dark rim
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,rx);g.addColorStop(0,`rgba(255,246,214,${.95*open})`);g.addColorStop(.5,`rgba(255,196,120,${.75*open})`);g.addColorStop(1,'rgba(150,50,30,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry*1.6,0,0,7);ctx.fill();
  ctx.fillStyle=`rgba(30,18,26,${.85*open})`;for(let i=0;i<28;i++){const a=i/28*Math.PI*2,j=1+.25*Math.sin(i*2.7+t*.6),x=cx+Math.cos(a)*rx*1.05*j,y=cy+Math.sin(a)*ry*1.7*j;ctx.beginPath();ctx.ellipse(x,y,rx*.16,ry*.9+6,a,0,7);ctx.fill()}
  // rings pulse out of the rift with each stroke, and lightning forks to the horizon
  for(const h0 of OPENING.hits){const d=t-h0;if(d<0||d>2)continue;ctx.strokeStyle=`rgba(255,220,170,${.6*(1-d/2)*open})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(cx,cy,rx*(1+d*1.4),ry*1.6*(1+d*1.4),0,0,7);ctx.stroke()
    if(d<.35){const R2=mulberry32(Math.floor(h0*100));for(let b=0;b<2;b++){let x=cx+(R2()-.5)*rx,y=cy+ry;ctx.strokeStyle=`rgba(235,240,255,${(1-d/.35)*.95})`;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,y);while(y<hz){x+=(R2()-.5)*W*.06;y+=hz*.08+R2()*hz*.06;ctx.lineTo(x,Math.min(y,hz))}ctx.stroke()}}}
  // the flash of each stroke over everything
  if(fl>0){ctx.fillStyle=`rgba(255,220,170,${.18*fl*open})`;ctx.fillRect(0,0,W,H)}
  ctx.restore()}
// a star falling: a streak across the sky for its first few seconds
function drawStarfall(){if(!S)return;for(const e of S.events){if(e.k!=='star'||S.t-e.t>4)continue;const k=(S.t-e.t)/4,p=G3.active?p3(e.x,e.y,0):proj(e.x,e.y,0);if(!p)continue;const x0=p.x-W*.4,y0=-20,x=x0+(p.x-x0)*k,y=y0+(p.y-y0)*k;
  const g=ctx.createLinearGradient(x0,y0,x,y);g.addColorStop(0,'rgba(160,240,255,0)');g.addColorStop(1,'rgba(220,250,255,.95)');ctx.strokeStyle=g;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x0+(x-x0)*.4,y0+(y-y0)*.4);ctx.lineTo(x,y);ctx.stroke()}}
function drawCaption(){if(!S||S.t>OPENING.len)return;if(S.t>2){ctx.save();ctx.font=`500 ${12*UI}px system-ui`;ctx.textAlign='right';ctx.fillStyle='rgba(238,233,221,.55)';ctx.fillText('Any key or tap skips',W-16*UI,H-16*UI);ctx.restore()}for(const[a,b,text]of OPENING.captions){if(S.t<a||S.t>b)continue;const f=Math.min(1,(S.t-a)/1.2,(b-S.t)/1.2);
  ctx.save();ctx.globalAlpha=f;ctx.font=`italic 500 ${Math.round(Math.min(26*UI,W/22))}px Georgia,'Times New Roman',serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=12;ctx.fillStyle='#f4e4c6';
    const y=H*.86;{const g=ctx.createLinearGradient(0,H*.74,0,H);g.addColorStop(0,'rgba(10,6,8,0)');g.addColorStop(.35,'rgba(10,6,8,.62)');g.addColorStop(1,'rgba(10,6,8,.72)');ctx.save();ctx.globalAlpha=f;ctx.shadowBlur=0;ctx.fillStyle=g;ctx.fillRect(0,H*.74,W,H*.26);ctx.restore()}const words=text.split(' ');let line='',lines=[];for(const w of words){const tr=line?line+' '+w:w;if(ctx.measureText(tr).width>W*.86){lines.push(line);line=w}else line=tr}lines.push(line);lines.forEach((l,i)=>ctx.fillText(l,W/2,y+(i-(lines.length-1)/2)*Math.min(32,W/18)));ctx.restore()}}
function drawGround(){if(!ground||groundSeed!==S.seed)buildGround();const hz=view.hz;ctx.fillStyle='#6a7650';ctx.fillRect(0,hz,W,H-hz);ctx.imageSmoothingEnabled=true;
  const F=view.F,Rv=view.R,cx=S.cam.x,cy=S.cam.y;let y=Math.max(hz+1,0);
  while(y<H){const st=y<hz+30?2:y<hz+120?3:y<hz+260?4:6,d0=view.Hc*view.f/(y-hz),d1=view.Hc*view.f/(y+st-hz);
    if(d0<11000){const a0=d0-view.D,a1=d1-view.D,s=view.f/((d0+d1)/2),kA=st/(a1-a0);
      const A=s*Rv.x,Cc=s*Rv.y,E=W/2+view.ox-s*(cx*Rv.x+cy*Rv.y),B=kA*F.x,Dd=kA*F.y,Ff=y+view.oy-kA*(cx*F.x+cy*F.y+a0);
      ctx.save();ctx.beginPath();ctx.rect(0,y,W,st+.8);ctx.clip();ctx.setTransform(DPR*A,DPR*B,DPR*Cc,DPR*Dd,DPR*E,DPR*Ff);ctx.drawImage(ground,0,0,C.MAP,C.MAP);ctx.restore()}
    y+=st}
  const fog=ctx.createLinearGradient(0,hz,0,hz+(H-hz)*.45);fog.addColorStop(0,'rgba(214,200,170,1)');fog.addColorStop(1,'rgba(214,200,170,0)');ctx.fillStyle=fog;ctx.fillRect(0,hz,W,(H-hz)*.45)}
function renderGround(){setCam();view.ox=view.oy=0;drawSky();drawGround();const g=S.g;
  for(const pd of S.prints){const f=Math.min(1,(S.t-pd.t)/4);let p=groundEllipse(pd.x,pd.y,C.FOOT_R*1.2);if(!p||p.d>9000)continue;ctx.fillStyle='#6b5a44';ctx.fill();
    if(f>0&&groundEllipse(pd.x,pd.y,C.FOOT_R*1.1*f)){ctx.fillStyle='#4f7f99';ctx.fill()}if(f>=1&&groundEllipse(pd.x,pd.y,C.FOOT_R*.75)){ctx.fillStyle='#6fa2bb';ctx.fill()}}
  if(S.you&&!S.you.dead){ctx.setLineDash([10,8]);ctx.lineWidth=2;ctx.strokeStyle=TOWNS[S.you.town].col;ctx.globalAlpha=.55;
    unionOutline(territory(S.you.town),(x,y)=>proj(x,y,0),TOWNS[S.you.town].col,2,[10,8]);ctx.setLineDash([]);ctx.globalAlpha=1}
  for(const t of S.towns)if(groundEllipse(t.x,t.y,t.r)){ctx.fillStyle=t.alive?'#a58f69':'#4a423b';ctx.fill();ctx.strokeStyle=t.alive?t.col:'#555';ctx.lineWidth=3;ctx.stroke()}
  const lie=g.fallen>0||g.dead;if(groundEllipse(lie?g.x+fwd(g).x*420:g.x,lie?g.y+fwd(g).y*420:g.y,lie?520:420)){ctx.fillStyle='rgba(20,16,10,.22)';ctx.fill()}
  for(const ft of g.feet)if(ft.air>0){const p=1-ft.air/ft.dur;if(groundEllipse(ft.lx,ft.ly,C.FOOT_R*(1.5-p*.5))){ctx.fillStyle=`rgba(0,0,0,${.15+p*.4})`;ctx.fill()}if(groundEllipse(ft.lx,ft.ly,C.FOOT_R)){ctx.strokeStyle='rgba(255,90,70,.9)';ctx.lineWidth=2.5;ctx.stroke()}}
  if(g.wind&&(g.wind.k==='stomp'||g.wind.k==='smash')){const p=1-g.wind.t/g.wind.dur,pts=g.wind.k==='stomp'?g.feet:[g.wind],R=g.wind.k==='stomp'?C.STOMP_R:C.SMASH_R;
    for(const q of pts){if(groundEllipse(q.x,q.y,R*p)){ctx.fillStyle=`rgba(255,80,60,${.15+p*.25})`;ctx.fill()}if(groundEllipse(q.x,q.y,R)){ctx.strokeStyle='rgba(255,90,70,.95)';ctx.lineWidth=2.5;ctx.setLineDash([8,6]);ctx.stroke();ctx.setLineDash([])}}}
  for(const e of S.fx){if(e.k!=='ring'&&e.k!=='mark')continue;const p=e.t/e.life;ctx.globalAlpha=1-p;if(groundEllipse(e.x,e.y,e.k==='mark'?e.r*(1-p*.5):e.r*(.5+p*.5))){ctx.strokeStyle=e.col;ctx.lineWidth=3;ctx.stroke()}ctx.globalAlpha=1}
  const items=[],add=(d,fn)=>items.push({d,fn});
  for(const t of S.towns){const r2=mulberry32(t.id*97+11);const n=t.alive?(t.outpost?7:14)+(t.houses||0)*2:4;
    for(let i=0;i<n;i++){const a=r2()*6.28,dd=r2()*t.r*.8,hx=t.x+Math.cos(a)*dd,hy=t.y+Math.sin(a)*dd,w=22+r2()*14,ht=t.alive?18+r2()*16:5,roof=i%3?'#7d4a36':'#5a5f6b';
      const p=proj(hx,hy,0);if(!p)continue;add(p.d,()=>{const q=proj(hx,hy,ht),s=p.s;ctx.fillStyle=t.alive?'#d8ccb2':'#4e4740';ctx.fillRect(p.x-w*s/2,q.y,w*s,p.y-q.y);
        if(t.alive){ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(p.x-w*s*.6,q.y);ctx.lineTo(p.x,q.y-w*s*.45);ctx.lineTo(p.x+w*s*.6,q.y);ctx.fill()}})}
    const p=proj(t.x,t.y,0);if(p&&t.alive)add(p.d-1,()=>{const top=proj(t.x,t.y,110);ctx.strokeStyle='#3c3127';ctx.lineWidth=Math.max(2,6*p.s);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,top.y);ctx.stroke();
      ctx.fillStyle='#cfc3aa';ctx.beginPath();ctx.moveTo(p.x-14*p.s,p.y);ctx.lineTo(p.x-8*p.s,top.y+10*p.s);ctx.lineTo(p.x,top.y-30*p.s);ctx.lineTo(p.x+8*p.s,top.y+10*p.s);ctx.lineTo(p.x+14*p.s,p.y);ctx.fill();
      shapePath(ctx,p.x,top.y-30*p.s-Math.max(7,16*p.s),Math.max(6,14*p.s),t.shape);ctx.fillStyle=t.col;ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.stroke()})}
  for(const b of S.builds){const p=proj(b.x,b.y,0);if(!p||p.d>8000)continue;const T=TOWNS[b.town];add(p.d,()=>{const s=p.s;ctx.globalAlpha=1-fogOf(p.d);
    if(b.k==='house'){const L=lv(b),q=proj(b.x,b.y,22+10*L),w=14+5*L;ctx.fillStyle='#e0d4ba';ctx.fillRect(p.x-w*s,q.y,2*w*s,p.y-q.y);ctx.fillStyle='#8a4e38';ctx.beginPath();ctx.moveTo(p.x-(w+4)*s,q.y);ctx.lineTo(p.x,q.y-(10+6*L)*s);ctx.lineTo(p.x+(w+4)*s,q.y);ctx.fill()}
    else if(b.k==='barracks'){const q=proj(b.x,b.y,34),r=proj(b.x,b.y,52),w=38*s;ctx.fillStyle='#9a8a72';ctx.fillRect(p.x-w,q.y,2*w,p.y-q.y);ctx.fillStyle='#5b4a3a';ctx.fillRect(p.x-w-3*s,q.y-5*s,2*w+6*s,8*s);ctx.fillStyle='#d6d9de';ctx.fillRect(p.x+w*.9,p.y-80*s,3*s,80*s);ctx.fillStyle=T.col;ctx.fillRect(p.x+w*.9+3*s,p.y-80*s,16*s,11*s)}
    else{const q=proj(b.x,b.y,60+35*lv(b));ctx.fillStyle='#b9ab8e';ctx.fillRect(p.x-9*s,q.y,18*s,p.y-q.y);ctx.fillStyle='#5a4a3a';ctx.fillRect(p.x-13*s,q.y-6*s,26*s,8*s)}
    shapePath(ctx,p.x,p.y-(b.k==='house'?60:b.k==='barracks'?90:110)*s,Math.max(3,7*s),T.shape);ctx.fillStyle=T.col;ctx.fill();ctx.globalAlpha=1})}
  // forests and lone trees stand up out of the ground
  for(const tr of S.trees){const p=proj(tr.x,tr.y,0);if(!p||p.d>5200||p.x<-60||p.x>W+60)continue;add(p.d,()=>{const s=p.s,h=tr.r*3.2*s;ctx.globalAlpha=1-fogOf(p.d);ctx.fillStyle='#2f4528';ctx.beginPath();ctx.moveTo(p.x,p.y-h);ctx.lineTo(p.x+tr.r*s,p.y-h*.15);ctx.lineTo(p.x-tr.r*s,p.y-h*.15);ctx.closePath();ctx.fill();ctx.fillStyle='#3d5a32';ctx.beginPath();ctx.moveTo(p.x,p.y-h*.75);ctx.lineTo(p.x+tr.r*.8*s,p.y);ctx.lineTo(p.x-tr.r*.8*s,p.y);ctx.closePath();ctx.fill();ctx.globalAlpha=1})}
  // the mountains that were giants
  for(const m of S.marks){const p0=proj(m.x,m.y,0);if(!p0||p0.x<-W||p0.x>W*2)continue;for(const b of markBoulders(m)){const p=proj(b.x,b.y,b.z);if(!p)continue;add(p.d,()=>{ctx.globalAlpha=(1-fogOf(p.d)*.8)*nearFade(p);stone(p.x,p.y,b.r*p.s,['#8a8d72','#b2b394','#4e5442'],b.n);ctx.globalAlpha=1})}}
  for(const q of S.quarries||[]){const R=mulberry32(q.seed);for(let k=0;k<6;k++){const a=R()*6.283,d=R()*q.r,x=q.x+Math.cos(a)*d,y=q.y+Math.sin(a)*d,r=12+R()*16;R();const p=proj(x,y,r*.35);if(!p||p.d>6000)continue;add(p.d,()=>{ctx.globalAlpha=1-fogOf(p.d)*.8;stone(p.x,p.y,r*p.s,['#b9b4a8','#cfcabd','#8f8a80'],q.seed+k);ctx.globalAlpha=1})}}
  for(const e of S.events){if(e.k==='star'){if(groundEllipse(e.x,e.y,220)){ctx.fillStyle='rgba(120,230,255,.18)';ctx.fill()}const p=proj(e.x,e.y,600);if(p&&p.d<12000)add(0,()=>lbl('Fallen star: '+e.left+' crystals',p.x,p.y,12,'#9fe8ff'))}
    if(e.k==='caravan'){const p=proj(e.x,e.y,0);if(p)add(p.d,()=>{const k=p.s,q=proj(e.x,e.y,40);ctx.fillStyle='#8a6a44';ctx.fillRect(p.x-30*k,q.y,60*k,p.y-q.y-6*k);ctx.fillStyle='#e6dcc4';ctx.beginPath();ctx.ellipse(p.x,q.y,30*k,16*k,0,Math.PI,0);ctx.fill();ctx.fillStyle='#2b2018';for(const sx of[-18,18]){ctx.beginPath();ctx.arc(p.x+sx*k,p.y-6*k,8*k,0,7);ctx.fill()}
      shapePath(ctx,p.x,q.y-24*k,Math.max(4,8*k),TOWNS[e.i].shape);ctx.fillStyle=TOWNS[e.i].col;ctx.fill();pbar(p.x,q.y-40*k,40,e.hp/e.max,'#9be08a')})}
    if(e.k==='raid'&&S.t<e.go){const p=proj(e.x,e.y,200);if(p)add(0,()=>lbl('Raiders gathering: '+Math.ceil(e.go-S.t)+' s',p.x,p.y,12,'#ff8f80'))}}
  for(const c of S.caches){const p=proj(c.x,c.y,0);if(!p||p.d>7000)continue;add(p.d,()=>{const k=p.s,ok=S.t>=c.ready;ctx.globalAlpha=1-fogOf(p.d);ctx.fillStyle=ok?'#d9b45a':'#6b6250';ctx.fillRect(p.x-22*k,p.y-26*k,44*k,26*k);ctx.fillStyle='#3a2d1c';ctx.fillRect(p.x-22*k,p.y-30*k,44*k,8*k);ctx.globalAlpha=1;
    if(ok&&p.d<2600)lbl(cacheLabel(c),p.x,p.y-44*k-10,11,S.t>=c.ready?'#ffcf6a':'#a9afbb')})}

  for(const cr of S.crystals){const p=proj(cr.x,cr.y,14+Math.sin(S.t*3+cr.id)*4);if(!p||p.d>7000)continue;add(p.d,()=>{const q=Math.max(5,12*p.s);ctx.fillStyle='#bff4ff';ctx.strokeStyle='#1a3a44';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p.x,p.y-q);ctx.lineTo(p.x+q*.6,p.y);ctx.lineTo(p.x,p.y+q);ctx.lineTo(p.x-q*.6,p.y);ctx.closePath();ctx.fill();ctx.stroke()})}
  for(const m of S.monsters){const p=proj(m.x,m.y,0);if(!p||p.d>7000||p.x<-40||p.x>W+40)continue;add(p.d,()=>{const hp=Math.max(m.kind==='troll'?16:10,(m.kind==='troll'?42:20)*p.s);ctx.globalAlpha=1-fogOf(p.d);
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(p.x,p.y,hp*.6,hp*.2,0,0,7);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1.3;
    if(m.kind==='troll'){ctx.fillStyle='#7a5236';ctx.fillRect(p.x-hp*.4,p.y-hp,hp*.8,hp);ctx.strokeRect(p.x-hp*.4,p.y-hp,hp*.8,hp)}
    else{ctx.strokeStyle='#2b2723';ctx.lineWidth=Math.max(1.5,hp*.12);ctx.beginPath();for(const lx of[-.4,-.15,.2,.4]){ctx.moveTo(p.x+hp*lx,p.y-hp*.35);ctx.lineTo(p.x+hp*lx,p.y)}ctx.stroke();ctx.fillStyle='#8c847a';ctx.beginPath();ctx.ellipse(p.x,p.y-hp*.45,hp*.6,hp*.25,0,0,7);ctx.fill();ctx.lineWidth=1.2;ctx.stroke();ctx.beginPath();ctx.arc(p.x+hp*.6,p.y-hp*.65,hp*.2,0,7);ctx.fill();ctx.stroke()}ctx.globalAlpha=1;
    if(m.hp<m.max)pbar(p.x,p.y-hp-8,26,m.hp/m.max,'#ff8f80')})}
  for(const h of S.humans){if(h.dead||h.mode!=='ground')continue;const p=proj(h.x,h.y,0);if(!p||p.d>7500)continue;const T=TOWNS[h.town];
    add(p.d-.5,()=>{const hp=Math.max(h.you?22:15,(h.you?30:24)*p.s);ctx.globalAlpha=1-fogOf(p.d);
      if(h.swing>0){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-hp*.5,hp*.75,-2.4,-.7);ctx.stroke()}
      figure(p,hp*(h.sol?1.15:1),h.you?'#c0392b':T.col,T.shape,h.sol?'#fff':T.col,h.you||!!h.sol);ctx.globalAlpha=1;if(h.you)pbar(p.x,p.y-hp*1.6,36,h.hp/h.max,'#9be08a')})}
  for(const b of giantBoulders(g)){const p=proj(b.x,b.y,b.z);if(!p)continue;const col=partStone(b.part);add(p.d,()=>{ctx.globalAlpha=(1-clamp((p.d-1200)/5000,0,.62))*(S.role==='giant'?.85:nearFade(p));stone(p.x,p.y,b.r*p.s,col,b.n);ctx.globalAlpha=1})}
  for(const ch of S.chains){if(ch.hp<=0)continue;const a=bodyWorld(ch.c,ch.r),f=fwd(g),sx=-f.y,sy=f.x,dir=ch.c<COLS/2?-1:1,bx=a.x+sx*dir*520,by=a.y+sy*dir*520;const p1=proj(a.x,a.y,a.z),p2=proj(bx,by,0);if(!p1||!p2)continue;
    add(Math.max(p1.d,p2.d),()=>{ctx.strokeStyle='#26262a';ctx.lineWidth=Math.max(2,14*Math.min(p1.s,p2.s));ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.quadraticCurveTo((p1.x+p2.x)/2,Math.max(p1.y,p2.y)+20*p2.s,p2.x,p2.y);ctx.stroke();
      ctx.fillStyle='#4a4a50';ctx.fillRect(p2.x-12*p2.s,p2.y-30*p2.s,24*p2.s,30*p2.s)})}
  for(const s of S.sites)if(s.build){const a=bodyWorld(s.c,s.r,s.build.face),p=proj(a.x,a.y,a.z+30);if(!p)continue;add(p.d-80,()=>{const k=p.s;if(s.build.k==='brace'){ctx.strokeStyle='#3a3a3a';ctx.lineWidth=Math.max(2,10*k);ctx.beginPath();ctx.moveTo(p.x-60*k,p.y-40*k);ctx.lineTo(p.x+60*k,p.y+20*k);ctx.moveTo(p.x-60*k,p.y+20*k);ctx.lineTo(p.x+60*k,p.y-40*k);ctx.stroke();return}ctx.fillStyle='#1b1b1b';ctx.fillRect(p.x-28*k,p.y-22*k,56*k,30*k);ctx.fillRect(p.x-6*k,p.y-60*k,12*k,40*k);shapePath(ctx,p.x,p.y-8*k,Math.max(4,10*k),TOWNS[s.build.town].shape);ctx.fillStyle=TOWNS[s.build.town].col;ctx.fill()})}
  for(const h of climbers()){const a=climberWorld(h),p=proj(a.x,a.y,a.z);if(!p)continue;const T=TOWNS[h.town];add(p.d-90,()=>figure(p,Math.max(10,22*p.s),h.you?'#c0392b':T.col,T.shape,T.col,h.you))}
  for(const s of S.shots){const z=1300*(1-s.t)+Math.sin(s.t*Math.PI)*350,p=proj(s.x,s.y,z);if(!p)continue;add(p.d,()=>{ctx.fillStyle='#1d1d1d';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(3,12*p.s),0,7);ctx.fill()})}
  items.sort((a,b)=>b.d-a.d);for(const it of items)it.fn();
  quarryLabels(proj);
  for(const t of S.towns){const p=proj(t.x,t.y,200);if(!p||p.d>9500)continue;lbl(t.name+(t.alive?' \u00b7 '+ageOf(t):' (ruins)'),p.x,p.y-14,12,t.col);if(t.alive)pbar(p.x,p.y,90,t.hp/t.max,'#9be08a')}
  labelRivalHeroes(proj);
  if(g.fallen>0&&!g.dead){const p=proj(g.x+fwd(g).x*700,g.y+fwd(g).y*700,300);if(p)lbl('The giant is down: '+Math.ceil(g.fallen)+' s to strike the Heart-stone',p.x,Math.max(70,p.y),13,'#ffcf6a')}
  if(S.you&&!S.you.dead&&S.you.mode==='ground'&&nearFoot(S.you)>=0){const p=proj(S.you.x,S.you.y,0);if(p)lbl('Climb the '+(nearFoot(S.you)?'right':'left')+' foot',p.x,p.y+16,12,'#ffcf6a')}
  if(S.role==='giant'&&g.tx!=null){const p=proj(g.tx,g.ty,0);if(p){ctx.strokeStyle='rgba(255,207,106,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-8,p.y-8);ctx.lineTo(p.x+8,p.y+8);ctx.moveTo(p.x+8,p.y-8);ctx.lineTo(p.x-8,p.y+8);ctx.stroke()}}
  if(S.you&&S.you.dead)lbl('Back to town in '+Math.ceil(S.you.dead)+' s',W/2,H/2,16,'#ff8f80');
  drawMinimap()}
function labelRivalHeroes(project){for(const h of S.humans){if(!h.hero||h.you||h.dead||h.mode!=='ground')continue;
  const p=project(h.x,h.y,130);if(p&&p.d<2500)lbl(h.name,p.x,p.y,11,TOWNS[h.town].col)}}
let BIGMAP=false;
function drawMinimap(){if(FILM)return;drawMinimap0();if(BIGMAP&&S.role==='human')drawMinimap0(true);
  // the first day: a small mark for every open goal with a known place (the tracked one gets the big ring below)
  if(tutActive()&&S.you){const s2=Math.min(110*UI,Math.min(W,H)*.26),k=s2/C.MAP;ctx.strokeStyle='rgba(255,210,122,.7)';ctx.lineWidth=1.5;for(const g of tutGoals()){const p=g.target&&g.target(S.you);if(!p)continue;ctx.beginPath();ctx.arc(8*UI+p.x*k,UIX.top+p.y*k,3,0,7);ctx.stroke()}}const tg=goalTarget();if(tg){const s2=Math.min(110*UI,Math.min(W,H)*.26),k=s2/C.MAP;ctx.strokeStyle='#ffd27a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(8*UI+tg.x*k,UIX.top+tg.y*k,5+2*Math.sin(S.t*4),0,7);ctx.stroke()}}
function drawMinimap0(big){const s=big?Math.min(W,H)*.84:Math.min(110*UI,Math.min(W,H)*.26),x0=big?(W-s)/2:8*UI,y0=big?(H-s)/2:UIX.top,k=s/C.MAP;if(big){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,W,H)}ctx.fillStyle='rgba(10,14,10,.8)';ctx.fillRect(x0-2,y0-2,s+4,s+4);ctx.drawImage(miniGround(),x0,y0,s,s);miniRelief(x0,y0,s);
  for(const t of S.towns){ctx.fillStyle=t.alive?t.col:'#555';shapePath(ctx,x0+t.x*k,y0+t.y*k,t.outpost?3.5:5,t.shape);ctx.fill()}

  ctx.fillStyle='#9a9d80';for(const m of S.marks){ctx.beginPath();ctx.arc(x0+m.x*k,y0+m.y*k,3,0,7);ctx.fill()}
  for(const c of S.caches){ctx.fillStyle=S.t>=c.ready?'#d9b45a':'#6b6250';ctx.fillRect(x0+c.x*k-2,y0+c.y*k-2,4,4)}
  for(const m of S.monsters)if(m.champion){ctx.fillStyle='#ffd24a';ctx.fillRect(x0+m.x*k-3,y0+m.y*k-3,6,6)}
  if(S.you&&S.you.treasure){const T=S.you.treasure;ctx.setLineDash([3,3]);ctx.strokeStyle='#ffd24a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x0+T.cx*k,y0+T.cy*k,Math.max(4,520*k),0,7);ctx.stroke();ctx.setLineDash([])}
  for(const c of S.critters||[])if(c.golden&&!c.dead){ctx.fillStyle='#ffd24a';ctx.beginPath();ctx.arc(x0+c.x*k,y0+c.y*k,3.5+Math.sin(S.t*6),0,7);ctx.fill()}
  for(const p of S.pois||[]){if(p.k==='herb'||S.role==='human'&&!p.found&&p.k!=='merchant'&&!p.ambush)continue;const X=x0+p.x*k,Y=y0+p.y*k;ctx.fillStyle=p.k==='shrine'?SHRINES[p.sub].col:p.k==='spring'?'#7fd0e8':p.k==='stones'?'#c0c4cc':p.k==='camp'?(campBeasts(p).length?'#ff5a4a':'#8a6a44'):p.k==='merchant'?'#c48aff':p.ambush?'#ff9a4a':'#ffffff';
    ctx.beginPath();if(p.k==='camp'){ctx.moveTo(X,Y-3.5);ctx.lineTo(X+3.5,Y+3);ctx.lineTo(X-3.5,Y+3);ctx.closePath()}else if(p.k==='shrine'||p.k==='stones'){ctx.moveTo(X,Y-3.5);ctx.lineTo(X+3,Y);ctx.lineTo(X,Y+3.5);ctx.lineTo(X-3,Y);ctx.closePath()}else ctx.arc(X,Y,2.5,0,7);ctx.fill()}
  miniPlaces(x0,y0,k);
  for(const e of S.events){if(e.k==='caravan'&&e.site){ctx.strokeStyle=TOWNS[e.i].col;ctx.lineWidth=1.5;ctx.strokeRect(x0+e.site.x*k-3,y0+e.site.y*k-3,6,6)}ctx.fillStyle=e.k==='star'?'#9fe8ff':e.k==='raid'?'#ff5a4a':TOWNS[e.i].col;ctx.beginPath();ctx.arc(x0+e.x*k,y0+e.y*k,e.k==='raid'?4:3.5,0,7);ctx.fill();if(e.k!=='caravan'){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke()}}
  ctx.fillStyle='#e8dcc4';ctx.beginPath();ctx.arc(x0+S.g.x*k,y0+S.g.y*k,5,0,7);ctx.fill();ctx.strokeStyle='#222';ctx.stroke();
  if(S.you&&!S.you.dead){ctx.fillStyle='#c0392b';ctx.beginPath();ctx.arc(x0+S.you.x*k,y0+S.you.y*k,3,0,7);ctx.fill()}
  // the camera's facing
  const cx=x0+S.cam.x*k,cy=y0+S.cam.y*k;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+view.F.x*14,cy+view.F.y*14);ctx.stroke();
  if(big){const L=(tx,x,y,col)=>{ctx.font=`600 ${11*UI}px system-ui`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(tx,x0+x*k,y0+y*k-9*UI);ctx.fillStyle=col||'#eee';ctx.fillText(tx,x0+x*k,y0+y*k-9*UI)};
    for(const t of S.towns)if(t.alive)L(t.name+' \u00b7 Lv '+lv(t),t.x,t.y,t.col);L('The giant',S.g.x,S.g.y,'#e8dcc4');
    {const fixed=(S.pois||[]).filter(p=>['shrine','spring','stones','camp'].includes(p.k));ctx.font=`600 ${12*UI}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#cfe8c8';S.mapFound=fixed.filter(p=>p.found).length+' of '+fixed.length}
    for(const p of S.pois||[]){if(p.k==='herb'||!p.found&&p.k!=='merchant'&&!p.ambush)continue;L(p.k==='shrine'?'Shrine ('+{might:'might',swift:'wind',ward:'stone'}[p.sub]+')':p.k==='spring'?'Hot spring':p.k==='stones'?'Stones'+(S.you&&(S.you.lore||{})[p.lore]?' \u2713':''):p.k==='camp'?p.name+(campBeasts(p).length?'':' (cleared)'):p.k==='merchant'?'Merchant':p.ambush?'Ambush!':'Traveller',p.x,p.y,p.k==='camp'&&campBeasts(p).length?'#ff9a8a':'#d8d8d8')}
    for(const m of S.monsters){if(m.warlord)L('The Rim Warlord',m.x,m.y,'#ff5a4a');if(m.champion)L(m.elite,m.x,m.y,'#ffd24a')}if(S.you)L('You',S.you.x,S.you.y,'#ff8f80');
    ctx.font=`700 ${14*UI}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ffd27a';ctx.fillText('Map \u00b7 places discovered '+(S.mapFound||'')+' \u00b7 M to close',W/2,y0-8*UI);
    const tg=goalTarget();if(tg){ctx.strokeStyle='#ffd27a';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x0+tg.x*k,y0+tg.y*k,9+3*Math.sin(S.t*4),0,7);ctx.stroke()}}}
// the giant player's view of its own body: who is climbing where
function renderBodyPanel(){const y0=UIX.top,ph=Math.min(UIX.rb-y0,440*UI),px=ph/ROWS,pw=COLS*px,x0=W-pw-12*UI;S.panelRect={x:x0,y:y0,w:pw,h:ph};
  ctx.fillStyle='rgba(8,10,14,.72)';ctx.fillRect(x0-6,y0-4,pw+12,ph+8);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(bodyTexture(),x0,y0,pw,ph);
  for(const id in JOINTS){const J=JOINTS[id],j=S.joints[id];ctx.fillStyle=j.crip?'#555':id==='heart'?'#ff4d5e':'#ff9a4a';ctx.globalAlpha=.4+.6*(j.hp/j.max);ctx.fillRect(x0+J.c0*px,y0+(ROWS-1-J.r1)*px,(J.c1-J.c0+1)*px,(J.r1-J.r0+1)*px);ctx.globalAlpha=1}
  if(!S.g.awake&&!S.g.dead){const z=aimZone(),tw=S.g.wind&&S.g.wind.k==='twitch'?S.g.wind:null,fx=S.fx.find(f=>f.k==='twitch');
    // the aimed part of the body, outlined; it flashes while a twitch winds up and as it lands
    const B={legs:[0,91,0,COLS-1],left:[92,129,0,COLS/2-1],right:[92,129,COLS/2,COLS-1],top:[130,ROWS-1,0,COLS-1]}[z];
    ctx.strokeStyle=tw||fx?'#ffcf6a':'rgba(255,207,106,.55)';ctx.lineWidth=tw?3:1.5;ctx.setLineDash(tw?[]:[4,3]);
    ctx.strokeRect(x0+B[2]*px,y0+(ROWS-1-B[1])*px,(B[3]-B[2]+1)*px,(B[1]-B[0]+1)*px);ctx.setLineDash([]);
    if(fx){ctx.fillStyle=`rgba(255,207,106,${.35*(1-fx.t/fx.life)})`;const F={legs:[0,91,0,COLS-1],left:[92,129,0,COLS/2-1],right:[92,129,COLS/2,COLS-1],top:[130,ROWS-1,0,COLS-1]}[fx.zone];ctx.fillRect(x0+F[2]*px,y0+(ROWS-1-F[1])*px,(F[3]-F[2]+1)*px,(F[1]-F[0]+1)*px)}
    for(const ch of S.chains){const cx=x0+(ch.c+.5)*px,cy=y0+(ROWS-1-ch.r)*px,f=ch.hp/ch.max;ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(cx-9,cy-3,18,5);ctx.fillStyle=f<=0?'#555':f<=C.STRAIN_FLOOR+.01?'#ff8f80':'#c9c2b2';ctx.fillRect(cx-9,cy-3,18*f,5)}}
  for(const h of climbers()){ctx.fillStyle=TOWNS[h.town].col;shapePath(ctx,x0+h.cl.x*px,y0+(ROWS-h.cl.y)*px,Math.max(3,px*1.6),TOWNS[h.town].shape);ctx.fill();ctx.strokeStyle=S.role==='giant'&&hunter(h)?'#ff4d3a':'#000';ctx.lineWidth=S.role==='giant'&&hunter(h)?2:1;ctx.stroke()}
  ctx.font=`600 ${11*UI}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#eee9dd';ctx.fillText(climbers().length+' climbing',x0+pw/2,y0+ph-4)}
function renderClimb(){const h=S.you,cl=h.cl,g=S.g;
  const px=Math.max(14,Math.min(W/13,H/15))*S.cam.czoom;climbCam.px=px;
  const fitsW=COLS*px<=W-20;climbCam.x+=((fitsW?COLS/2:clamp(cl.x,W/2/px-1,COLS-W/2/px+1))-climbCam.x)*.15;
  climbCam.y+=((cl.y+3)-climbCam.y)*.12;if(Math.abs(climbCam.y-cl.y)>40)climbCam.y=cl.y;
  const toX=c=>W/2+(c-climbCam.x)*px,toY=r=>H*.55-(r-climbCam.y)*px;
  // a lifted foot draws its leg up from the thigh: the knee bends and climbers on it ride up
  const lift=g.feet.map(f=>f.air>0&&g.fallen<=0?Math.sin((1-f.air/f.dur)*Math.PI)*6:0),THIGH=82;
  const ly=(c,r)=>{const L=r<THIGH?lift[c<COLS/2?0:1]:0;return L?L+r*(THIGH-L)/THIGH:r},Y=(c,r)=>toY(ly(c,r));
  // sky darkens with height, ground below
  const alt=clamp(climbCam.y/ROWS,0,1);const sk=ctx.createLinearGradient(0,0,0,H);sk.addColorStop(0,`rgb(${60-alt*30},${96-alt*40},${150-alt*40})`);sk.addColorStop(1,`rgb(${150-alt*50},${170-alt*50},${190-alt*40})`);ctx.fillStyle=sk;ctx.fillRect(0,0,W,H);
  landscape(climbCam.y);const gy=toY(0);if(gy<H){ctx.fillStyle='#4f6a3c';ctx.fillRect(0,gy,W,H-gy);for(const ft of g.feet){}}
  // walking sway: the body leans with each stride, more toward the top
  const sway=g.fallen>0?0:Math.sin(g.sway*Math.PI)*.035*(g.v/C.G_SPEED);
  ctx.save();ctx.translate(0,gy);ctx.transform(1,0,-sway,1,0,0);ctx.translate(0,-gy);
  // clouds drift past at half the camera's rate, so height reads as distance
  for(let i=0;i<14;i++){const cr=50+i*11,cx=((i*53+S.t*(1+i%3)*.4)%(COLS+40))-20,yy=H*.55-(cr-climbCam.y)*px*.5;if(yy<-40||yy>H+40)continue;ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.ellipse(W/2+(cx-COLS/2)*px*.6,yy,px*(4+i%4),px*1.3,0,0,7);ctx.fill()}
  ctx.imageSmoothingEnabled=false;const tex=bodyTexture(),P=tex.width/COLS;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(tex,0,0,COLS*P,(ROWS-THIGH)*P,toX(0),toY(ROWS),COLS*px,(ROWS-THIGH)*px);
  for(const i of[0,1]){const c0=i?COLS/2:0;ctx.drawImage(tex,c0*P,(ROWS-THIGH)*P,COLS/2*P,THIGH*P,toX(c0),toY(THIGH),COLS/2*px,(THIGH-lift[i])*px)}
  if(g.wind&&g.wind.k==='swipe'){const left=g.wind.side==='L',p=1-g.wind.t/g.wind.dur;ctx.fillStyle=`rgba(255,60,40,${.12+.25*p})`;ctx.fillRect(left?toX(0):toX(COLS/2),toY(ROWS),COLS/2*px,(ROWS-30)*px);
    const hx=left?toX(-6+6*p):toX(COLS+6-6*p);ctx.fillStyle='rgba(130,136,150,.9)';ctx.beginPath();ctx.ellipse(hx,Y(cl.x,cl.y),px*4,px*7,0,0,7);ctx.fill()}
  for(const id in JOINTS){const J=JOINTS[id],j=S.joints[id];const x=toX(J.c0),y=Y(J.c0,J.r1+1),w=(J.c1-J.c0+1)*px,hh=Y(J.c0,J.r0)-y;
    ctx.fillStyle=j.crip?'rgba(60,60,60,.7)':id==='heart'?`rgba(255,77,94,${.55+.25*Math.sin(S.t*4)})`:'rgba(255,150,70,.55)';ctx.fillRect(x,y,w,hh);
    ctx.strokeStyle=j.crip?'#777':id==='heart'?'#ffb0b8':'#ffcf6a';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,hh-2);
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x,y-8,w,5);ctx.fillStyle=id==='heart'?'#ff4d5e':'#ffcf6a';ctx.fillRect(x,y-8,w*j.hp/j.max,5);
    j.wedges.forEach((wd,i)=>{ctx.fillStyle='#222';ctx.beginPath();const wx=x+(i+1)*w/4;ctx.moveTo(wx-4,y+hh*.3);ctx.lineTo(wx+4,y+hh*.3);ctx.lineTo(wx,y+hh*.8);ctx.closePath();ctx.fill();ctx.strokeStyle=TOWNS[wd.town].col;ctx.stroke()});
    if(Math.abs(J.r0-climbCam.y)<40){ctx.font=`600 ${12*UI}px system-ui`;ctx.textAlign='left';ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=3;const tx=x+w+4,ty=y+hh/2+4;ctx.strokeText(JOINTS[id].name,tx,ty);ctx.fillText(JOINTS[id].name,tx,ty)}}
  // the holds: firm cracks, green moss that drains grip, orange loose stones; your reach and the hold you are aiming at
  {const r0=Math.max(0,Math.floor(climbCam.y-H/px*.6)),r1=Math.min(ROWS-1,Math.ceil(climbCam.y+H/px*.6)),hb=S.body.h,me=[Math.floor(cl.y),Math.floor(cl.x)];
    const aimV=readMove(),aim=!cl.move&&!cl.fall&&(aimV.x||aimV.y)?reachHold(cl,aimV.x,-aimV.y):null;
    for(let r=r0;r<=r1;r++)for(let c=0;c<COLS;c++){const k=hb[r*COLS+c];if(!k)continue;const t=S.body.g[r*COLS+c];if(t===LEDGE||t===SITE||t===JOINT||t===HEART)continue;const x=toX(c+.5),y=Y(c,r+.5);
      ctx.fillStyle=k===2?'#5f8a3a':k===3?'#d08a4a':'#2e2a24';ctx.beginPath();ctx.ellipse(x,y,px*.32,px*.2,0,0,7);ctx.fill();
      ctx.fillStyle=k===2?'#9cc76a':k===3?'#f4c08a':'#d9cdb2';ctx.beginPath();ctx.ellipse(x,y-px*.12,px*.3,px*.08,0,0,7);ctx.fill();
      if(S.crumble.some(q=>q.i===r*COLS+c)){ctx.strokeStyle='#ff5a3c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,px*.45,0,7);ctx.stroke()}
      const d=Math.hypot(r-me[0],c-me[1]);if(!cl.fall&&d>0&&d<=C.REACH){ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,px*.42,0,7);ctx.stroke()}}
    if(aim){const x=toX(aim[1]+.5),y=Y(aim[1],aim[0]+.5);ctx.strokeStyle='#ffcf6a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,px*.55,0,7);ctx.stroke()}}
  for(const ch of S.chains){if(ch.hp<=0)continue;const x=toX(ch.c+.5),y=Y(ch.c,ch.r+.5),dir=ch.c<COLS/2?-1:1;ctx.strokeStyle='#2b2b2e';ctx.lineWidth=Math.max(3,px*.22);
    for(let i=0;i<9;i++){const lx=x+dir*i*px*.55,ly=y+i*i*px*.06;ctx.beginPath();ctx.ellipse(lx,ly,px*.3,px*.18,i%2?0:Math.PI/2,0,7);ctx.stroke()}
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x-px,y-px*1.1,px*2,4);ctx.fillStyle='#c9c9d0';ctx.fillRect(x-px,y-px*1.1,px*2*ch.hp/ch.max,4)}
  for(const s of S.sites){const x=toX(s.c)+px/2,y=toY(s.r)+px/2;ctx.strokeStyle='#ffcf6a';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.lineTo(x+Math.cos(a)*px*.8,y+Math.sin(a)*px*.8)}ctx.closePath();ctx.stroke();
    if(s.build){ctx.fillStyle=TOWNS[s.build.town].col;ctx.fillRect(x-px*.7,y-px*1.2,px*1.4,px*.9);ctx.fillStyle='#222';ctx.fillRect(x,y-px*1.05,px*1.3,px*.45)}}
  for(const a of S.anchors){const x=toX(a.c)+px/2,y=Y(a.c,a.r+.5);ctx.strokeStyle=TOWNS[a.town].col;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,px*.35,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+px*.35);ctx.lineTo(x,y+px*1.4);ctx.stroke()}
  if(cl.path){ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(toX(cl.x),Y(cl.x,cl.y));for(const[r,c]of cl.path)ctx.lineTo(toX(c+.5),Y(c,r+.5));ctx.stroke();ctx.setLineDash([])}
  for(const f of S.fx)if(f.k==='cellmark'){ctx.strokeStyle='#fff';ctx.globalAlpha=1-f.t/f.life;ctx.strokeRect(toX(f.c),Y(f.c,f.r+1),px,px);ctx.globalAlpha=1}
  for(const o of climbers()){const x=toX(o.cl.x),y=Y(o.cl.x,o.cl.y),T=TOWNS[o.town];if(y<-20||y>H+20)continue;
    ctx.fillStyle=T.col;shapePath(ctx,x,y-px*.2,px*.55,T.shape);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#111';ctx.beginPath();ctx.moveTo(x-px*.5,y-px*.6);ctx.lineTo(x-px*.8,y-px*1.1);ctx.moveTo(x+px*.5,y-px*.6);ctx.lineTo(x+px*.8,y-px*1.1);ctx.stroke();
    if(o.you){const f=clamp(o.grip/maxGrip(o),0,1);ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.arc(x,y-px*.2,px*1.2,0,7);ctx.stroke();
      ctx.strokeStyle=f<.25?'#ff8f80':f<.5?'#ffcf6a':'#9be08a';ctx.beginPath();ctx.arc(x,y-px*.2,px*1.2,-Math.PI/2,-Math.PI/2+f*Math.PI*2);ctx.stroke()}}
  ctx.restore();
  // height gauge with ledges and joints marked
  const gx=W-18*UI,gt=UIX.top,gb=UIX.rb;ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(gx-6,gt-4,14,gb-gt+8);
  for(const id in JOINTS){const J=JOINTS[id];ctx.fillStyle=id==='heart'?'#ff4d5e':'#ff9a4a';ctx.fillRect(gx-4,gb-(J.r1/ROWS)*(gb-gt),10,3)}
  ctx.fillStyle='#fff';ctx.fillRect(gx-7,gb-(cl.y/ROWS)*(gb-gt)-2,16,4);
  ctx.font=`600 ${13*UI}px system-ui`;ctx.textAlign='right';ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=3;const ht=Math.round(cl.y*FT)+' ft';ctx.strokeText(ht,gx-12,gb-(cl.y/ROWS)*(gb-gt)+4);ctx.fillText(ht,gx-12,gb-(cl.y/ROWS)*(gb-gt)+4);
  if(g.wind&&(g.wind.k==='shake'||g.wind.k==='swipe')){ctx.strokeStyle=`rgba(255,90,70,${.5+.5*Math.sin(S.t*20)})`;ctx.lineWidth=8;ctx.strokeRect(4,4,W-8,H-8);
    ctx.font=`700 ${20*UI}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=4;const s=g.wind.k==='shake'?'BRACE: hold still':'HAND INCOMING: '+(g.wind.side==='L'?'left':'right')+' side';ctx.strokeText(s,W/2,48);ctx.fillText(s,W/2,48)}
  if(g.fallen>0){ctx.font=`700 ${16*UI}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ffcf6a';ctx.strokeStyle='#000';ctx.lineWidth=4;const s='The giant is down: '+Math.ceil(g.fallen)+' s to strike the Heart-stone';ctx.strokeText(s,W/2,H-20);ctx.fillText(s,W/2,H-20)}}

