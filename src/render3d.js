'use strict';
// Colossus · src/render3d.js · camera and render; the Three.js ground view (figures, beasts, places, decor are drawn here)
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= camera and render =================
let ctx=cv.getContext('2d');let W=0,H=0,DPR=1,shakeA=0;
function shake(a){if(!reducedMotion)shakeA=Math.max(shakeA,a)}
let UI=1,UIX={top:8,rb:0};const uiEls={};
// one scale for everything: rem is set in CSS from the shorter screen side; canvas text and gauges follow it, and the HUD zones are measured so canvas drawing keeps clear of them
function uiMeasure(){const g=n=>uiEls[n]||(uiEls[n]=document.getElementById(n));UI=(parseFloat(getComputedStyle(document.documentElement).fontSize)||16)/16;
  const t=g('hud');UIX.top=t.getBoundingClientRect().bottom+8*UI;{const re=g('res');if(re&&!re.hidden){const hr=t.getBoundingClientRect();re.style.top='';const rr0=re.getBoundingClientRect();if(rr0.right>hr.left-8*UI){re.style.top=UIX.top+'px';UIX.top+=rr0.height+6*UI}}}g('side').style.top=UIX.top+'px';let rb=H-16*UI;
  if(!document.body.classList.contains('titling'))for(const n of['stats','pad']){const r=g(n).getBoundingClientRect();if(r.width&&r.left<W-18*UI&&r.right>W-34*UI)rb=Math.min(rb,r.top-8*UI)}UIX.rb=Math.max(UIX.top+60*UI,rb);
  // the skill bar sits bottom-centre; where it would cover the action buttons or the stats (a narrow phone), it moves to
  // the left above the stats and wraps into the space left of the buttons (GPTBS 0101#E4: check at 360x740 portrait)
  {const sk=g('skillbar'),st=g('stats'),pd=g('pad'),ov=(a,b)=>a.width&&b.width&&!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
    sk.classList.remove('side');sk.style.left=sk.style.bottom=sk.style.maxWidth='';const a=sk.getBoundingClientRect(),s=st.getBoundingClientRect(),p=pd.getBoundingClientRect();
    if(ov(a,s)||ov(a,p)){const l=s.left;sk.classList.add('side');sk.style.left=l+'px';sk.style.bottom=(H-s.top+6*UI)+'px';sk.style.maxWidth=Math.max(120*UI,p.left-l-8*UI)+'px'}}
  // the giant's body panel stands at the right edge; the goal line and feed keep to its left
  {const gs=S&&S.role==='giant'&&!document.body.classList.contains('titling');g('side').style.right=gs?(COLS*Math.min(UIX.rb-UIX.top,440*UI)/ROWS+30*UI)+'px':''}}
function fit(){const r=cv.getBoundingClientRect(),d=Math.min(2.5,window.devicePixelRatio||1);if(r.width!==W||r.height!==H||d!==DPR){W=r.width;H=r.height;DPR=d;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR)}uiMeasure()}
let climbCam={y:10,x:16,px:12};
function screenToCell(sx,sy){if(G3.active&&climbing3D()){const cl=S.you.cl;let best=null,bd=48;for(let r=Math.max(0,Math.floor(cl.y)-24);r<=Math.min(ROWS-1,Math.floor(cl.y)+24);r++)for(let c=0;c<COLS;c++){if(!S.body.h[r*COLS+c])continue;const q=cellScreen(c+.5,r+.5);if(!q)continue;const d=Math.hypot(q.x-sx,q.y-sy);if(d<bd){bd=d;best={r,c}}}return best||{r:-99,c:-99}}const c=climbCam;return{c:Math.floor(c.x+(sx-W/2)/c.px),r:Math.floor(c.y-(sy-H*.55)/c.px)}}
// body texture, drawn once per game at 8 px a cell
let bodyCanvas=null,bodySeed=-1;
function bodyTexture(){if(bodySeed===S.seed&&bodyCanvas)return bodyCanvas;bodySeed=S.seed;const P=10,cvs=document.createElement('canvas');cvs.width=COLS*P;cvs.height=ROWS*P;const b=cvs.getContext('2d'),B=S.body;
  // the body is a heap of boulders: each cell a lumpy stone lit from the upper left, crevices between them are the holds
  const at=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS?B.g[r*COLS+c]:0;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=at(r,c);if(!t)continue;const x=c*P,y=(ROWS-1-r)*P;b.fillStyle=t===SMOOTH?'#9a9488':'#5d5a50';b.fillRect(x,y,P,P)}
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const i=r*COLS+c,t=B.g[i];if(!t)continue;const v=B.vari[i],x=c*P+P/2+((v%5)-2),y=(ROWS-1-r)*P+P/2+(((v>>3)%5)-2);
    const edge=!at(r+1,c)||!at(r-1,c)||!at(r,c+1)||!at(r,c-1);const rad=P*(t===SMOOTH?.95:.62+(v%7)*.04)*(edge?.85:1);
    const g=b.createRadialGradient(x-rad*.4,y-rad*.45,rad*.1,x,y,rad);
    if(t===SMOOTH){g.addColorStop(0,'#d2ccbd');g.addColorStop(1,'#a39d8f')}else{const k=(v%30)-15;g.addColorStop(0,`rgb(${178+k},${170+k},${152+k})`);g.addColorStop(1,`rgb(${104+k},${98+k},${86+k})`)}
    b.fillStyle=g;b.beginPath();b.ellipse(x,y,rad*1.08,rad,(v%10)/10,0,7);b.fill();
    if(t===HOLD&&v%3===0){b.fillStyle='rgba(84,110,52,.75)';b.beginPath();b.arc(x+rad*.5,y+rad*.6,1.6,0,7);b.fill()}
    if(t===LEDGE||t===SITE){b.fillStyle='#e8dcb4';b.fillRect(c*P,(ROWS-1-r)*P,P,2.5)}}
  bodyCanvas=cvs;return cvs}
// far landscape seen from the body: features squeeze to the horizon low down and spread out high up
let farLand=null;
function landscape(alt){if(!farLand){const R=mulberry32(S.seed^77);farLand=[];for(let i=0;i<70;i++){const k=R();farLand.push({d:4+R()*36,x:(R()-.5)*3,w:.4+R()*1.6,kind:k<.35?'lake':k<.8?'wood':'town'})}farLand.sort((a,b)=>b.d-a.d)}
  const hz=H*.42,hft=alt*FT+60;const gr=ctx.createLinearGradient(0,hz,0,H);gr.addColorStop(0,'#9fb2b8');gr.addColorStop(.25,'#7d8f6a');gr.addColorStop(1,'#4f6a3c');ctx.fillStyle=gr;ctx.fillRect(0,hz,W,H-hz);
  for(const f of farLand){const y=hz+hft*.18/f.d,sc=W/(f.d*2.2);if(y>H+20)continue;const x=W/2+f.x*sc*6,w=f.w*sc*.7,h=Math.max(1,w*Math.min(1,hft/1800)*.35);
    const haze=Math.min(.75,f.d/40);ctx.globalAlpha=1-haze;ctx.fillStyle=f.kind==='lake'?'#6f9fc0':f.kind==='wood'?'#3d5530':'#c9bfa6';ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,7);ctx.fill();ctx.globalAlpha=1}
  ctx.fillStyle='rgba(200,214,224,.35)';ctx.fillRect(0,hz-6,W,14)}
function render(){fit();ctx.setTransform(DPR,0,0,DPR,0,0);
  if(!S){skyCv.style.visibility=glCv.style.visibility='hidden';drawTitleScene();return}
  const sx=shakeA?(Math.random()-.5)*shakeA:0,sy=shakeA?(Math.random()-.5)*shakeA:0;
  ctx.save();ctx.translate(sx,sy);
  const climbing=S.you&&S.you.mode==='climb'&&!S.you.dead,three=g3Init();G3.active=three;skyCv.style.visibility=glCv.style.visibility=three?'visible':'hidden';
  if(three){ctx.restore();ctx.save();render3D();if(S.role==='giant')renderBodyPanel()}else if(climbing)renderClimb();else{renderGround();if(S.role==='giant')renderBodyPanel()}
  if(!(S.you&&S.you.mode==='climb'))drawStarfall();drawCaption();
  ctx.restore()}
// ================= the 3D ground view (Three.js) =================
// Built from the memory's Three.js lessons (Flood and others): one renderer for the whole session (a new one per game
// hits the browser's WebGL context cap), a horizontal field of view widened for portrait phones, no shadow maps (a
// blob of shade under each body instead), repeated scenery as instanced meshes. The 2D canvas on top carries labels,
// rings and the HUD; the sky is painted on a canvas behind.
const G3={ok:false,seed:-1};const skyCv=document.getElementById('sky'),glCv=document.getElementById('gl'),skyCtx=skyCv.getContext('2d');
function g3Init(){if(G3.renderer)return true;if(!window.THREE)return false;
  try{const r=new THREE.WebGLRenderer({canvas:glCv,antialias:true,alpha:true});r.setClearColor(0x000000,0);r.outputEncoding=THREE.sRGBEncoding;
    G3.renderer=r;G3.cam=new THREE.PerspectiveCamera(60,1,6,30000);_m=new THREE.Matrix4();_q=new THREE.Quaternion();_e=new THREE.Euler();_p=new THREE.Vector3();_s=new THREE.Vector3();_c=new THREE.Color();G3.ok=true}catch(e){G3.ok=false}return G3.ok}
const V3=()=>new THREE.Vector3();
// the ground's height: the land's height grid (rolling, a rim, basins, triangle hills, carved rivers), flattened to each town's level round it
function groundH(x,y){let h=S&&S.land?landRaw(x,y):16*(Math.sin(x*.0011)+Math.sin(y*.0013+1.3))+9*Math.sin((x+y)*.0023);
  if(S)for(const t of S.towns){const d=Math.hypot(t.x-x,t.y-y),r=t.r+420;if(d<r){const z=S.land?(t.z!=null?t.z:(t.z=landRaw(t.x,t.y))):0;h=z+(h-z)*clamp((d-t.r-60)/360,0,1)}}return h}
function g3Dispose(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})}})}
function inst(geo,mat,n){const m=new THREE.InstancedMesh(geo,mat,Math.max(1,n));m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.count=0;return m}
// made only once Three.js has loaded, so a page without it still runs on the 2D view
let _m,_q,_e,_p,_s,_c;
function put(mesh,i,x,y,z,sx,sy,sz,ry,rx,rz){_p.set(x,z,y);_e.set(rx||0,ry||0,rz||0);_q.setFromEuler(_e);_s.set(sx,sy,sz);_m.compose(_p,_q,_s);mesh.setMatrixAt(i,_m)}
function g3Build(){const sc=new THREE.Scene();if(G3.scene)g3Dispose(G3.scene);G3.scene=sc;G3.seed=S.seed;G3.townSig='';G3.buildSig='';G3.cameraMode=null;G3.cameraBlend=null;G3.climbT=null;
  sc.fog=new THREE.Fog(0xcdbfa2,3000,16000);
  sc.add(G3.hemi=new THREE.HemisphereLight(0xe4e8ff,0x56663a,.8));const sun=G3.sun=new THREE.DirectionalLight(0xfff0d6,.9);sun.position.set(-.6,1,.45);sc.add(sun);
  // terrain: the ground texture on a gently rolling plane
  if(!ground||groundSeed!==S.seed)buildGround();const M=C.MAP,N=Math.round(150*WS*.8),geo=new THREE.PlaneGeometry(M,M,N,N);geo.rotateX(-Math.PI/2);geo.translate(M/2,0,M/2);
  const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,groundH(pos.getX(i),pos.getZ(i)));geo.computeVertexNormals();
  const tex=new THREE.CanvasTexture(ground);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=4;
  G3.groundTex=tex;sc.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:tex})));
  // forests: two stacked cones a tree, all trees in two draws
  const tGeo=new THREE.ConeGeometry(1,1,7),t1=new THREE.InstancedMesh(tGeo,new THREE.MeshLambertMaterial({color:0x2f4a2a}),S.trees.length),t2=new THREE.InstancedMesh(tGeo,new THREE.MeshLambertMaterial({color:0x3d5e34}),S.trees.length);
  S.trees.forEach((t,i)=>{const g=groundH(t.x,t.y),h=t.r*3.6;put(t1,i,t.x,t.y,g+h*.62,t.r*.9,h*.75,t.r*.9,i);put(t2,i,t.x,t.y,g+h*.3,t.r*1.15,h*.6,t.r*1.15,i*2)});G3.t1=t1;G3.t2=t2;sc.add(t1,t2);
  // ground cover (owner: the world should not feel empty): bushes, boulders and wildflowers from their own generator, three draws
  {const R=mulberry32((S.seed^0xF10)>>>0),M=C.MAP,ok=(x,y)=>!inSolid(x,y,25)&&S.towns.every(t=>Math.hypot(t.x-x,t.y-y)>t.r+60)&&!(S.lakes||[]).some(l=>Math.hypot(l.x-x,l.y-y)<(l.r||200));
    const bush=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),900),rock=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x8d8f94,flatShading:true}),420),flow=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),1400);
    let nb=0,nr=0,nf=0;for(let k=0;k<9000&&(nb<900||nr<420||nf<1400);k++){const x=300+R()*(M-600),y=300+R()*(M-600),c=R();if(!ok(x,y))continue;const g=groundH(x,y);
      if(c<.3&&nb<900){const r=10+R()*16;put(bush,nb,x,y,g+r*.55,r*1.2,r*.8,r,R()*6);bush.setColorAt(nb++,_c.set(['#4a6b3a','#56783f','#3f5f34','#6b7f3c'][Math.floor(R()*4)]))}
      else if(c<.45&&nr<420){const r=8+R()*22;put(rock,nr++,x,y,g+r*.3,r*1.3,r*.8,r,R()*6)}
      else if(nf<1400){const col=['#f2e14a','#e86a8a','#f4f0e8','#9a7ae0','#f29a4a'][Math.floor(R()*5)];for(let j=0;j<3&&nf<1400;j++){const fx=x+(R()-.5)*40,fy=y+(R()-.5)*40;put(flow,nf,fx,fy,groundH(fx,fy)+3,5,6,5,0);flow.setColorAt(nf++,_c.set(col))}}}
    bush.count=nb;rock.count=nr;flow.count=nf;for(const m of[bush,rock,flow]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}sc.add(bush,rock,flow)}
  // the old giants lying as mountains
  const rock=new THREE.IcosahedronGeometry(1,1);G3.marks=[];
  // one mesh a mountain, so a mountain the camera is inside can turn see-through on its own
  for(const m of S.marks){const bs=markBoulders(m),mm=new THREE.InstancedMesh(rock,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true,transparent:true,opacity:1}),bs.length);
    bs.forEach((b,i)=>{put(mm,i,b.x,b.y,groundH(b.x,b.y)+b.z,b.r,b.r*.9,b.r,b.n,b.n*.7);mm.setColorAt(i,_c.set(['#6f7258','#646a52','#7c7f64'][b.n%3]))});mm.userData.m=m;G3.marks.push(mm);sc.add(mm)}
  // the giant: one instanced boulder cloud, posed every frame
  G3.giant=inst(rock,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,flatShading:true}),120);G3.giantMat=G3.giant.material;sc.add(G3.giant);
  const shade=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false});G3.shadeGeo=new THREE.CircleGeometry(1,24);G3.shadeGeo.rotateX(-Math.PI/2);
  G3.gShadow=new THREE.Mesh(G3.shadeGeo,shade);sc.add(G3.gShadow);G3.blobs=inst(G3.shadeGeo,shade,200);sc.add(G3.blobs);
  G3.chain=inst(new THREE.CylinderGeometry(1,1,1,6),new THREE.MeshLambertMaterial({color:0x26262a}),80);sc.add(G3.chain);
  // people and beasts: a few simple parts each, readable from a distance, coloured by town
  G3.cloak=inst(new THREE.ConeGeometry(1,1,8),new THREE.MeshLambertMaterial({color:0xffffff}),C.FIG_MAX);G3.head=inst(new THREE.SphereGeometry(1,10,8),new THREE.MeshLambertMaterial({color:0xe7d3b8}),C.FIG_MAX);
  G3.badge=inst(new THREE.OctahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),C.FIG_MAX);
  G3.wolfB=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),160);G3.wolfH=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),160);
  G3.trollB=inst(new THREE.CylinderGeometry(.8,1,1,7),new THREE.MeshLambertMaterial({color:0xffffff}),80);G3.trollH=inst(new THREE.SphereGeometry(1,8,6),new THREE.MeshLambertMaterial({color:0xffffff}),80);
  const limbG=new THREE.BoxGeometry(1,1,1);limbG.translate(0,-.5,0);G3.limb=inst(limbG,new THREE.MeshLambertMaterial({color:0xffffff}),C.LIMB_MAX);G3.tool=inst(limbG,new THREE.MeshLambertMaterial({color:0xffffff}),C.FIG_MAX);
  G3.walk=new WeakMap();G3.e2=new THREE.Euler(0,0,0,'YXZ');
  sc.add(G3.cloak,G3.head,G3.badge,G3.wolfB,G3.wolfH,G3.trollB,G3.trollH,G3.limb,G3.tool);
  G3.crystal=inst(new THREE.OctahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xbff4ff,emissive:0x2aa8c8}),300);sc.add(G3.crystal);
  G3.water=inst(new THREE.CircleGeometry(1,28).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x4f86a8,transparent:true,opacity:.92}),200);sc.add(G3.water);
  G3.box=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),900);G3.roof=inst(new THREE.ConeGeometry(1,1,4),new THREE.MeshLambertMaterial({color:0xffffff}),300);
  G3.disc=inst(new THREE.CylinderGeometry(1,1,1,32),new THREE.MeshLambertMaterial({color:0xffffff}),40);G3.ball=inst(new THREE.SphereGeometry(1,10,8),new THREE.MeshLambertMaterial({color:0x1d1d1d}),60);
  G3.beacon=new THREE.Mesh(new THREE.CylinderGeometry(34,34,1,20,1,true),new THREE.MeshBasicMaterial({color:0xffb030,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide,fog:false}));G3.beacon.visible=false;sc.add(G3.beacon);
  G3.hornBeam=new THREE.Mesh(new THREE.CylinderGeometry(60,60,1,20,1,true),new THREE.MeshBasicMaterial({color:0xffe6a8,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide,fog:false}));G3.hornBeam.visible=false;sc.add(G3.hornBeam);
  G3.hold=inst(new THREE.SphereGeometry(1,7,5),new THREE.MeshLambertMaterial({color:0xffffff}),900);sc.add(G3.hold);
  sc.add(G3.box,G3.roof,G3.disc,G3.ball)}
const STONE3={ok:'#7a7064',hurt:'#80604f',crip:'#6a3a2c',dead:'#4e4842'};
function climbing3D(){return S.you&&S.you.mode==='climb'&&!S.you.dead&&S.you.cl}
function g3ClimbCamera(){const cm=G3.cam,g=S.g,cl=S.you.cl,heading=fwd(g),side=cl.face===1?-1:1;
  const f={x:heading.x*side,y:heading.y*side},a=bodyWorld(cl.x,cl.y,cl.face),az=groundH(a.x,a.y)+a.z,D=520/S.cam.czoom;
  cam.yaw=Math.atan2(f.x,-f.y);view.F={x:f.x,y:f.y};view.R={x:-f.y,y:f.x};
  const tx=a.x,ty=a.y,tz=az;G3.climbT=G3.climbT||{x:tx,y:ty,z:tz};const T=G3.climbT;T.x+=(tx-T.x)*.15;T.y+=(ty-T.y)*.15;T.z+=(tz-T.z)*.15;
  cm.position.set(T.x-f.x*D,T.z+D*.12,T.y-f.y*D);cm.lookAt(T.x,T.z+20,T.y);
  const asp=W/Math.max(1,H),hf=70*Math.PI/180;cm.aspect=asp;cm.fov=clamp(2*Math.atan(Math.tan(hf/2)/asp)*180/Math.PI,40,100);cm.updateProjectionMatrix();
  const far=new THREE.Vector3(T.x+f.x*14000,0,T.y+f.y*14000).project(cm);view.hz=clamp((1-far.y)/2*H,-H,H*1.2)}
function g3Camera(){if(climbing3D()){g3ClimbCamera();return}G3.climbT=null;const cm=G3.cam,g=S.g,D=(S.role==='giant'?2600:760)/S.cam.czoom,p=cam.pitch,e=clamp(.2+p*.85,.06,1.2),F={x:Math.sin(cam.yaw),y:-Math.cos(cam.yaw)};
  const fx=S.cam.x,fy=S.cam.y,fz=groundH(fx,fy);view.F=F;view.R={x:Math.cos(cam.yaw),y:Math.sin(cam.yaw)};
  cm.position.set(fx-F.x*D*Math.cos(e),fz+60+D*Math.sin(e),fy-F.y*D*Math.cos(e));
  const look=new THREE.Vector3(fx,fz+60+(p<0?-p*D*1.6:0),fy);cm.lookAt(look);
  const asp=W/Math.max(1,H),hf=70*Math.PI/180;cm.aspect=asp;cm.fov=clamp(2*Math.atan(Math.tan(hf/2)/asp)*180/Math.PI,40,100);cm.updateProjectionMatrix();
  // the horizon on screen, for the sky painting
  const far=new THREE.Vector3(fx+F.x*14000,0,fy+F.y*14000).project(cm);view.hz=clamp((1-far.y)/2*H,-H,H*1.2);
  if(view.ox||view.oy){cm.position.x+=view.ox;cm.position.y+=view.oy}}
// world (x,y,z above ground) to screen, with the size in pixels of one unit at that distance
function p3(x,y,z){const v=new THREE.Vector3(x,(z||0)+groundH(x,y),y),d=v.distanceTo(G3.cam.position);v.project(G3.cam);if(v.z>1||v.z<-1)return null;
  return{x:(v.x+1)/2*W,y:(1-v.y)/2*H,d,s:H/(2*Math.tan(G3.cam.fov*Math.PI/360)*d)}}
function g3ScreenToWorld(sx,sy){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(sx/W*2-1,-(sy/H)*2+1),G3.cam);const o=ray.ray.origin,d=ray.ray.direction;if(d.y>=-1e-4)return{x:S.cam.x,y:S.cam.y};
  let t=(0-o.y)/d.y;for(let k=0;k<3;k++){const x=o.x+d.x*t,z=o.z+d.z*t;t=(groundH(x,z)-o.y)/d.y}return{x:clamp(o.x+d.x*t,0,C.MAP),y:clamp(o.z+d.z*t,0,C.MAP)}}
// a union of circles drawn as one outline: only the arcs no other circle covers
function unionOutline(circles,projf,col,w,dash){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.setLineDash(dash||[]);
  for(const c of circles){let open=false;ctx.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,x=c.x+Math.cos(a)*c.r,y=c.y+Math.sin(a)*c.r,inside=circles.some(o=>o!==c&&Math.hypot(o.x-x,o.y-y)<o.r-1),p=inside?null:projf(x,y);
    if(p){if(open)ctx.lineTo(p.x,p.y);else{ctx.moveTo(p.x,p.y);open=true}}else open=false}ctx.stroke()}ctx.setLineDash([])}
function ringOnGround(x,y,r,col,w,dash,fill){const pts=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2,p=p3(x+Math.cos(a)*r,y+Math.sin(a)*r,2);if(!p)return;pts.push(p)}
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(fill){ctx.fillStyle=fill;ctx.fill()}if(col){ctx.strokeStyle=col;ctx.lineWidth=w||2;if(dash)ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}}
function g3Update(){const g=S.g,t=S.t;
  // giant
  const bs=giantBoulders(g);G3.giant.count=Math.min(bs.length,120);bs.slice(0,120).forEach((b,i)=>{const k=PART_JOINT[b.part],j=S.joints[k];put(G3.giant,i,b.x,b.y,groundH(b.x,b.y)+b.z,b.r,b.r*.92,b.r,b.n*1.7,b.n*.9);
    const st=g.dead?STONE3.dead:j.crip?STONE3.crip:j.hp/j.max<.5?STONE3.hurt:STONE3.ok;_c.set(st);if(!g.awake)_c.lerp(_c.clone().set('#8a8f7a'),.35);G3.giant.setColorAt(i,_c)});
  G3.giant.instanceMatrix.needsUpdate=true;if(G3.giant.instanceColor)G3.giant.instanceColor.needsUpdate=true;
  const lie=g.fallen>0||g.dead,sx=lie?g.x+fwd(g).x*420:g.x,sy=lie?g.y+fwd(g).y*420:g.y;G3.gShadow.position.set(sx,groundH(sx,sy)+1.5,sy);G3.gShadow.scale.set(lie?560:440,1,lie?560:440);
  // chains, as hanging links of cylinder
  let ci=0;for(const ch of S.chains){if(ch.hp<=0)continue;const a=climbViewPoint(ch.c,ch.r),f=fwd(g),dir=ch.c<COLS/2?-1:1,bx=a.x-f.y*dir*520,by=a.y+f.x*dir*520,az=groundH(a.x,a.y)+a.z,bz=groundH(bx,by);
    let px=a.x,py=a.y,pz=az;for(let s=1;s<=8&&ci<80;s++){const u=s/8,x=a.x+(bx-a.x)*u,y=a.y+(by-a.y)*u,z=az+(bz-az)*u-Math.sin(u*Math.PI)*120;
      const mx=(px+x)/2,my=(py+y)/2,mz=(pz+z)/2,len=Math.hypot(x-px,y-py,z-pz);_p.set(mx,mz,my);const dv=new THREE.Vector3(x-px,z-pz,y-py).normalize();_q.setFromUnitVectors(new THREE.Vector3(0,1,0),dv);_s.set(9,len,9);_m.compose(_p,_q,_s);G3.chain.setMatrixAt(ci++,_m);px=x;py=y;pz=z}}
  G3.chain.count=ci;G3.chain.instanceMatrix.needsUpdate=true;
  // people: on the ground, or clinging to the giant
  // every figure is posed from what it is doing (walk stride from the distance it really moved, a sword swing, hammering at a job, reaching hold to hold,
  // flailing in a fall); render only, the sim never reads a pose
  let hi=0,bi=0,li=0,oi=0;
  const limb=(mesh,i,x,y,z,len,w,face,a,roll,col)=>{_p.set(x,z,y);G3.e2.set(-a,Math.PI/2-face,roll||0);_q.setFromEuler(G3.e2);_s.set(w,len,w);_m.compose(_p,_q,_s);mesh.setMatrixAt(i,_m);mesh.setColorAt(i,_c.set(col))};
  const L=(x,y,z,len,w,face,a,roll,col)=>{if(li<C.LIMB_MAX)limb(G3.limb,li++,x,y,z,len,w,face,a,roll,col)};
  // the tip of a limb hung from (x,y,z) and swung forward by a: where a hand holds its tool
  const tip=(x,y,z,len,face,a)=>({x:x+Math.cos(face)*Math.sin(a)*len,y:y+Math.sin(face)*Math.sin(a)*len,z:z-Math.cos(a)*len});
  const stride=(o,x,y,r)=>{let w=G3.walk.get(o);if(!w){w={x,y,ph:0,sp:0};G3.walk.set(o,w)}const d=Math.hypot(x-w.x,y-w.y);w.x=x;w.y=y;if(d<80)w.ph+=d/r;w.sp+=((d>.2&&d<80?1:0)-w.sp)*.25;return w};
  const fig=(h,x,y,z,col,badge,you,face)=>{if(hi>=C.FIG_MAX)return;const s=you?1.25:1,w=stride(h,x,y,9*s),sw=Math.sin(w.ph)*.7*w.sp,cl=h.mode==='climb'&&h.cl,fall=cl&&cl.fall;
    let legA=sw,legB=-sw,armL=-sw*.8,armR=sw*.8,bob=Math.abs(Math.sin(w.ph))*3*w.sp,tool=true;
    if(w.sp<.05){armL=.08+Math.sin(t*1.7+h.id)*.05;armR=.08+Math.sin(t*1.7+h.id+1)*.05;bob=Math.sin(t*1.7+h.id)*.6}
    if(fall){armL=2.6+Math.sin(t*21)*.5;armR=2.6-Math.sin(t*21)*.5;legA=Math.sin(t*17)*.7;legB=-legA;tool=false}
    else if(cl){const M=cl.move,k=M?Math.sin(Math.min(1,M.t)*Math.PI):0,alt=h.id%2?1:-1;armL=2.5+.45*k*alt;armR=2.5-.45*k*alt;legA=.5-.4*k*alt;legB=.5+.4*k*alt;tool=false;bob=0}
    else if(h.job){armR=1.7+Math.sin(t*11)*.9;armL=.5;legA=legB=0}
    if(h.charge&&h.charge.t>CB.CHARGE_MIN){armR=2.5+.6*chargeK(h.charge.t)}else if(h.swing>0){const k=1-h.swing/.2;armR=3-2.5*k}
    const sx=-Math.sin(face),sy=Math.cos(face),zb=z+bob;
    put(G3.cloak,hi,x,y,zb+30*s,13*s,32*s,13*s,0);put(G3.head,hi,x,y,zb+51*s,7*s,7*s,7*s,0);{const bs=h.nobadge?.001:1;put(G3.badge,hi,x,y,zb+72*s,6*s*bs,8*s*bs,6*s*bs,t*2)}
    G3.cloak.setColorAt(hi,_c.set(col));G3.badge.setColorAt(hi,_c.set(badge));hi++;
    L(x+sx*4*s,y+sy*4*s,zb+17*s,17*s,4.5*s,face,legA,0,'#3b3329');L(x-sx*4*s,y-sy*4*s,zb+17*s,17*s,4.5*s,face,legB,0,'#3b3329');
    L(x+sx*9*s,y+sy*9*s,zb+42*s,17*s,4*s,face,armL,0,col);L(x-sx*9*s,y-sy*9*s,zb+42*s,17*s,4*s,face,armR,0,col);
    if(tool&&oi<C.FIG_MAX){const hd=tip(x-sx*9*s,y-sy*9*s,zb+42*s,17*s,face,armR);const bl=h.gear?h.gear.blade:0;limb(G3.tool,oi++,hd.x,hd.y,hd.z,(22+5*bl)*s,(2.5+.5*bl)*s,face,armR+(h.job?0:-.5),0,h.job?'#8a6a45':['#d6d9de','#c9a46a','#e8ecf2','#9fe8ff','#f2ead8','#ffd24a'][bl]||'#d6d9de')}
    // armour shows as pauldrons, a worn crown as a gold band
    if(h.gear&&h.gear.armour){const ac=['','#8a8f98','#b9bec6','#9fb8d8','#e8dcc4','#ffd24a'][h.gear.armour]||'#8a8f98';L(x+sx*9*s,y+sy*9*s,zb+45*s,4*s,6*s,face,0,0,ac);L(x-sx*9*s,y-sy*9*s,zb+45*s,4*s,6*s,face,0,0,ac)}
    if(h.charms&&h.charms.includes('crown'))L(x,y,zb+60*s,4*s,9*s,face,0,0,'#ffd24a');
    // heroes wear a hood in their town's colour (yours is red) with a short cape behind
    else if(h.hero&&!cl)L(x,y,zb+60*s,4*s,8*s,face,0,0,you?'#8e2a1f':col)};
  // people nearest the camera first, so the figure pool never drops those you can see (it used to hold 30, in list order)
  const folkView=S.humans.filter(h=>!h.dead&&(h.mode!=='ground'||Math.hypot(h.x-S.cam.x,h.y-S.cam.y)<9000)).sort((a,b)=>(b.you-a.you)||Math.hypot(a.x-S.cam.x,a.y-S.cam.y)-Math.hypot(b.x-S.cam.x,b.y-S.cam.y));
  for(const h of folkView){const T=TOWNS[h.town],fl=S.t-(h.hurtAt??-9)<.12;if(h.mode==='ground'){const z=groundH(h.x,h.y)+(h.riding?24:0);fig(h,h.x,h.y,z,fl?'#ffffff':h.you?'#c0392b':T.col,h.sol?'#ffffff':T.col,h.you||!!h.sol,h.face||0);
      if(bi<200){put(G3.blobs,bi++,h.x,h.y,z+1,16,1,16,0)}}
    else if(h.cl){const a=climberWorld(h);fig(h,a.x,a.y,groundH(a.x,a.y)+a.z,h.you?'#c0392b':T.col,T.col,h.you,g.ang+(h.cl.face===1?Math.PI:0))}}
  {const vs=G3.villagers||(G3.villagers=new Map());for(const tw of S.towns){if(!tw.alive||Math.hypot(tw.x-S.cam.x,tw.y-S.cam.y)>4500)continue;const n=Math.min(10,(tw.outpost?2:4)+Math.floor((tw.houses||0)/2)+(civicIn(tw,'market')?2:0));
    for(let i=0;i<n;i++){const key=tw.id*100+i;let v=vs.get(key);if(!v){v={id:key,x:tw.x,y:tw.y,fa:0,nobadge:1};vs.set(key,v)}const a=i*2.399+t*.05*(i%2?1:-1),r=tw.r*(.25+.5*((i*.618)%1)),px=tw.x+Math.cos(a)*r,py=tw.y+Math.sin(a)*r;v.fa=Math.atan2(py-v.y,px-v.x)||v.fa;v.x=px;v.y=py;
      fig(v,v.x,v.y,groundH(v.x,v.y),['#c9b896','#a8b4a0','#b8a0a0','#a0a8b8'][i%4],tw.col,false,v.fa)}}}
  for(const m of S.monsters)if(m.kind==='knight'&&Math.hypot(m.x-S.cam.x,m.y-S.cam.y)<7000){const fl=m.hitT&&t-m.hitT<.15;if(m.wind)m.swing=.15*(1-m.wind.t/m.wind.dur);m.gear={blade:4,armour:4};fig(m,m.x,m.y,groundH(m.x,m.y),fl?'#ffffff':'#4a5468','#ffd24a',true,m.fa||0)}
  for(const m of S.monsters)if(m.kind==='archer'&&Math.hypot(m.x-S.cam.x,m.y-S.cam.y)<7000){const fl=m.hitT&&t-m.hitT<.15;if(m.wind)m.swing=.15;fig(m,m.x,m.y,groundH(m.x,m.y),fl?'#ffffff':m.elite?'#3a1414':'#5a2a2a',m.elite?'#ff5a4a':'#222222',!!m.elite,m.fa||0)}
  for(const p of S.pois||[])if((p.k==='traveller'||p.k==='merchant')&&Math.hypot(p.x-S.cam.x,p.y-S.cam.y)<7000)fig(p,p.x,p.y,groundH(p.x,p.y),p.k==='merchant'?'#7d4fa8':'#9a9384','#ffffff',false,p.fa||0);
  for(const m of[G3.cloak,G3.head,G3.badge]){m.count=hi;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
  // beasts: wolves low and long, trolls tall; a struck beast flashes white
  // beasts keep the heading they last moved on (a resting wolf no longer snaps to face east); wolves trot on four legs and lunge as they bite,
  // trolls stride and swing a club, raising it as their next blow comes due; a struck beast flashes white
  let wi=0,ti=0;
  // horses under their riders: a long brown body, raised head, four legs at a trot
  for(const h of folkView){if(!h.riding||h.mode!=='ground'||wi>=150)continue;const z=groundH(h.x,h.y),a=h.face||0,ca=Math.cos(a),sa=Math.sin(a),px=-sa,py=ca,w=G3.walk.get(h)||{ph:0,sp:0},sw=Math.sin(w.ph*.8)*.8*w.sp,hc=h.horse&&h.horse.hp<h.horse.max*.4?'#5a3f2a':'#7a5434';
    put(G3.wolfB,wi,h.x,h.y,z+30,50,20,17,-a);put(G3.wolfH,wi,h.x+ca*30,h.y+sa*30,z+46,18,13,10,-a);G3.wolfB.setColorAt(wi,_c.set(hc));G3.wolfH.setColorAt(wi,_c.set('#4a3322'));wi++;
    for(const[f,sd,ph]of[[17,1,1],[17,-1,-1],[-17,1,-1],[-17,-1,1]])L(h.x+ca*f+px*sd*6,h.y+sa*f+py*sd*6,z+24,24,4.5,a,sw*ph,0,'#4a3322');
    L(h.x+ca*22,h.y+sa*22,z+36,14,7,a,-2.4,0,hc);L(h.x-ca*25,h.y-sa*25,z+36,18,3,a,-2.5,Math.sin(t*6+h.id)*.4,'#2e2018')}
  for(const o of S.humans){const d=o.hound;if(!d||d.x==null||wi>=158||o.dead||o.mode!=='ground')continue;const z=groundH(d.x,d.y),a=d.fa||0,ca=Math.cos(a),sa=Math.sin(a),px=-sa,py=ca,w=stride(d,d.x,d.y,7),sw=Math.sin(w.ph)*.75*w.sp,bz=z+12+(d.rest>0?-6:0);
    put(G3.wolfB,wi,d.x,d.y,bz,28,12,11,-a);put(G3.wolfH,wi,d.x+ca*16,d.y+sa*16,bz+6,11,9,9,-a);G3.wolfB.setColorAt(wi,_c.set('#a0703c'));G3.wolfH.setColorAt(wi,_c.set('#8a5a2c'));wi++;
    for(const[f,sd,ph]of[[9,1,1],[9,-1,-1],[-9,1,-1],[-9,-1,1]])L(d.x+ca*f+px*sd*4,d.y+sa*f+py*sd*4,bz-4,10,3,a,d.rest>0?1.4:sw*ph,0,'#7a4e28');L(d.x+ca*12,d.y+sa*12,bz+4,3,7,a,0,0,TOWNS[o.town].col)}
  for(const c of S.critters||[]){if(c.dead||wi>=158||Math.hypot(c.x-S.cam.x,c.y-S.cam.y)>6000)continue;const z=groundH(c.x,c.y),a=c.fa||0,ca=Math.cos(a),sa=Math.sin(a),px=-sa,py=ca,w=stride(c,c.x,c.y,8),sw=Math.sin(w.ph)*.8*w.sp;
    put(G3.wolfB,wi,c.x,c.y,z+26,30,13,11,-a);put(G3.wolfH,wi,c.x+ca*19,c.y+sa*19,z+36,10,10,8,-a);G3.wolfB.setColorAt(wi,_c.set(c.golden?'#ffd24a':'#b0804e'));G3.wolfH.setColorAt(wi,_c.set(c.golden?'#f0b830':'#9a6c40'));wi++;
    for(const[f,sd,ph]of[[10,1,1],[10,-1,-1],[-10,1,-1],[-10,-1,1]])L(c.x+ca*f+px*sd*4,c.y+sa*f+py*sd*4,z+22,22,2.5,a,sw*ph,0,'#7a5634');
    L(c.x+ca*20+px*3,c.y+sa*20+py*3,z+40,12,1.5,a,2.8,.4,'#d8c8a8');L(c.x+ca*20-px*3,c.y+sa*20-py*3,z+40,12,1.5,a,2.8,-.4,'#d8c8a8')}
  for(const m of S.monsters){if(Math.hypot(m.x-S.cam.x,m.y-S.cam.y)>7000)continue;const z=groundH(m.x,m.y),fl=m.hitT&&t-m.hitT<.15,w=G3.walk.get(m);
    if(w&&Math.hypot(m.x-w.x,m.y-w.y)>.2)m.fa=Math.atan2(m.y-w.y,m.x-w.x);if(m.wind&&Math.hypot(m.wind.x-m.x,m.wind.y-m.y)>2)m.fa=Math.atan2(m.wind.y-m.y,m.wind.x-m.x);const cw=m.wind?Math.min(1,m.wind.t/m.wind.dur):0;const a=m.fa||0,ry=-a,ca=Math.cos(a),sa=Math.sin(a),px=-sa,py=ca;
    if((m.kind==='wolf'||m.kind==='boar')&&wi<160){const W=stride(m,m.x,m.y,7),sw=Math.sin(W.ph)*.75*W.sp,lk=m.rec>.25?1:0,bx=m.x+ca*(lk*10-cw*7),by=m.y+sa*(lk*10-cw*7),bz=z+14-cw*7+Math.abs(Math.sin(W.ph))*2*W.sp,lc=fl?'#ffffff':'#6f6860';
      const es=m.elite?1.45:m.kind==='boar'?1.2:1;put(G3.wolfB,wi,bx,by,bz*1+(es-1)*8,32*es,14*es,13*es,ry);put(G3.wolfH,wi,bx+ca*18*es,by+sa*18*es,bz+6-lk*6-cw*5+(es-1)*10,12*es,10*es,10*es,ry);G3.wolfB.setColorAt(wi,_c.set(fl?'#ffffff':m.elite?'#4a4440':m.kind==='boar'?'#6b4a32':'#8c847a'));G3.wolfH.setColorAt(wi,_c.set(fl?'#ffffff':'#6f6860'));wi++;
      for(const[f,sd,ph]of[[11,1,1],[11,-1,-1],[-11,1,-1],[-11,-1,1]])L(bx+ca*f+px*sd*4,by+sa*f+py*sd*4,bz-4,11,3.5,a,sw*ph,0,lc);
      L(bx-ca*15,by-sa*15,bz+3,13,3,a,-2.3,Math.sin(t*7+m.id)*.5,lc)}
    else if(m.kind==='troll'&&ti<80){const W=stride(m,m.x,m.y,13),sw=Math.sin(W.ph)*.6*W.sp,club=m.wind?.4+2.7*cw:m.rec>0?1.25:.25+sw*.6,bz=z+Math.abs(Math.sin(W.ph))*2.5*W.sp,lc=fl?'#ffffff':'#6b4630';
      const es=m.warlord?1.7:1;put(G3.trollB,ti,m.x,m.y,bz+40*es,18*es,42*es,15*es,ry);put(G3.trollH,ti,m.x,m.y,bz+68*es,11*es,10*es,11*es,0);G3.trollB.setColorAt(ti,_c.set(fl?'#ffffff':m.warlord?'#5a2a2a':'#7a5236'));G3.trollH.setColorAt(ti,_c.set(fl?'#ffffff':'#8f6a48'));ti++;
      L(m.x+px*7,m.y+py*7,bz+22,22,8,a,sw,0,lc);L(m.x-px*7,m.y-py*7,bz+22,22,8,a,-sw,0,lc);L(m.x+px*18,m.y+py*18,bz+58,30,7,a,-sw*.8,0,lc);L(m.x-px*18,m.y-py*18,bz+58,30,7,a,club,0,lc);
      if(oi<120){const hd=tip(m.x-px*18,m.y-py*18,bz+58,30,a,club);limb(G3.tool,oi++,hd.x,hd.y,hd.z,28,7,a,club-.3,0,'#5a3b22')}}
    if(bi<200)put(G3.blobs,bi++,m.x,m.y,z+1,m.kind==='troll'?24:18,1,m.kind==='troll'?24:18,0)}
  for(const[m,n]of[[G3.wolfB,wi],[G3.wolfH,wi],[G3.trollB,ti],[G3.trollH,ti],[G3.limb,li],[G3.tool,oi]]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
  G3.blobs.count=bi;G3.blobs.instanceMatrix.needsUpdate=true;
  // crystals turn and bob
  let ki=0;for(const c of S.crystals){if(ki>=200)break;if(Math.hypot(c.x-S.cam.x,c.y-S.cam.y)>6000)continue;put(G3.crystal,ki++,c.x,c.y,groundH(c.x,c.y)+20+Math.sin(t*3+c.id)*5,9,15,9,t*1.5+c.id)}G3.crystal.count=ki;G3.crystal.instanceMatrix.needsUpdate=true;
  // footprint lakes fill with water
  let wa=0;for(const pd of S.prints){if(wa>=200)break;const f=Math.min(1,(t-pd.t)/4);if(f<=0)continue;put(G3.water,wa++,pd.x,pd.y,groundH(pd.x,pd.y)+3,C.FOOT_R*1.15*f,1,C.FOOT_R*.75*f,-pd.a)}G3.water.count=wa;G3.water.instanceMatrix.needsUpdate=true;
  // towns, what people built, ruins, caravans, cannons and braces on the giant, shots
  let bx=0,rf=0,dc=0,ba=0;const B=(x,y,z,sx,sy,sz,col,ry)=>{if(bx<900){put(G3.box,bx,x,y,z,sx,sy,sz,ry||0);G3.box.setColorAt(bx++,_c.set(col))}};
  const RF=(x,y,z,r,h,col)=>{if(rf<300){put(G3.roof,rf,x,y,z,r,h,r,Math.PI/4);G3.roof.setColorAt(rf++,_c.set(col))}};
  for(const tw of S.towns){const z=groundH(tw.x,tw.y);if(dc<40){put(G3.disc,dc,tw.x,tw.y,z-2,tw.r,8,tw.r,0);G3.disc.setColorAt(dc++,_c.set(tw.alive?'#a58f69':'#4a423b'))}
    const r2=mulberry32(tw.id*97+11),n=tw.alive?(tw.outpost?7:14)+(tw.houses||0)*2:5;for(let i=0;i<n;i++){const a=r2()*6.28,dd=r2()*tw.r*.82,hx=tw.x+Math.cos(a)*dd,hy=tw.y+Math.sin(a)*dd,w=20+r2()*12,hh=tw.alive?16+r2()*14:5,roof=i%3?'#8a4a36':'#5a5f6b';
      B(hx,hy,z+hh/2,w,hh,w*.8,tw.alive?'#ddd1b6':'#4e4740',a);if(tw.alive)RF(hx,hy,z+hh+8,w*.78,16,roof)}
    if(tw.alive){B(tw.x,tw.y,z+55,10,110,10,'#cfc3aa');RF(tw.x,tw.y,z+125,10,30,'#cfc3aa');B(tw.x,tw.y,z+150,14,14,14,tw.col,t)}}
  for(const o of S.humans)if(o.job&&!o.dead){const j=o.job,f=j.t/j.dur;if(j.kind==='ground'){const z=groundH(j.x,j.y),hh=(j.k==='tower'?95:j.k==='outpost'?60:34)*Math.max(.08,f);B(j.x+30,j.y,z+hh/2,j.k==='outpost'?90:40,hh,j.k==='outpost'?90:32,'#9a7a4e');B(j.x+30,j.y,z+hh+4,j.k==='outpost'?100:48,4,j.k==='outpost'?100:40,'#6b5236')}else{const a=bodyWorld(j.s.c+.5,j.s.r+.5,climbing3D()?.face??o.cl?.face),z=groundH(a.x,a.y)+a.z;B(a.x,a.y,z,50*f+8,10,30,'#9a7a4e',g.ang)}}
  for(const b of S.builds){const z=groundH(b.x,b.y),L=lv(b),col=TOWNS[b.town].col;if(b.k==='house'&&Math.hypot(b.x-S.cam.x,b.y-S.cam.y)<3500){const hh=18+8*L;for(let k=0;k<2;k++){const ph=(t*.35+k*.5+b.x*.001)%1;B(b.x+8+ph*10,b.y-6,z+hh+34+ph*50,6+ph*10,6+ph*10,6+ph*10,ph<.5?'#d8d8d8':'#eeeeee')}}
    if(b.k==='house'){const w=16+5*L,hh=18+8*L;B(b.x,b.y,z+hh/2,w*2,hh,w*1.6,'#e0d4ba');RF(b.x,b.y,z+hh+10,w*1.5,20,'#8a4e38');B(b.x,b.y,z+hh+30,6,6,6,col)}
    else if(b.k==='barracks'){B(b.x,b.y,z+17,74,34,48,'#9a8a72');B(b.x,b.y,z+36,78,6,52,'#4a3f33');RF(b.x,b.y,z+50,46,28,'#5b4a3a');B(b.x-30,b.y+30,z+11,6,22,6,'#6b5a44');B(b.x+30,b.y+30,z+11,6,22,6,'#6b5a44');B(b.x,b.y+30,z+16,60,6,4,'#6b5a44');B(b.x+40,b.y-20,z+70,4,80,4,'#d6d9de');B(b.x+52,b.y-20,z+98,22,16,3,col)}
    else if(b.k==='farm'){for(let r=0;r<4;r++)B(b.x-36+r*24,b.y,z+5,16,10,90,r%2?'#c9b458':'#a8963e');B(b.x+60,b.y-30,z+14,26,28,22,'#9a7a4e');RF(b.x+60,b.y-30,z+34,20,16,'#7a4e38')}
    else if(b.k==='market'){for(const[dx,c]of[[-40,'#d07a4a'],[0,'#4a8ad0'],[40,'#d0c04a']]){B(b.x+dx,b.y,z+14,28,28,24,'#9a8a72');B(b.x+dx,b.y,z+32,34,6,30,c)}B(b.x,b.y+30,z+30,6,60,6,'#6b5a44');B(b.x+10,b.y+30,z+56,22,14,3,col)}
    else if(b.k==='smithy'){B(b.x,b.y,z+20,56,40,44,'#6b6f78');RF(b.x,b.y,z+50,40,22,'#3e3a36');B(b.x+20,b.y-10,z+62,10,30,10,'#4a4440');B(b.x-34,b.y+20,z+10,18,14,12,'#2e2a28');B(b.x-34,b.y+20,z+18,10,4,6,'#ff8a3a')}
    else if(b.k==='stable'){B(b.x,b.y,z+18,70,36,40,'#8a6a44');RF(b.x,b.y,z+46,44,22,'#5a3f2a');for(let k=0;k<4;k++)B(b.x-45+k*30,b.y+36,z+10,4,20,4,'#6b5a44');B(b.x,b.y+36,z+16,96,4,4,'#6b5a44')}
    else if(b.k==='well'){B(b.x,b.y,z+10,34,20,34,'#8d8f94');B(b.x,b.y,z+21,24,2,24,'#4f86a8');B(b.x-15,b.y,z+34,4,30,4,'#6b5a44');B(b.x+15,b.y,z+34,4,30,4,'#6b5a44');RF(b.x,b.y,z+54,26,14,'#7a4e38')}
    else{const hh=60+35*L;B(b.x,b.y,z+hh/2,18,hh,18,'#b9ab8e');B(b.x,b.y,z+hh+4,28,8,28,'#5a4a3a');B(b.x,b.y,z+hh+16,8,8,8,col)}}
  const dk=clamp((phase()/C.DUSK-.7)/.3,0,1)+(isNight()?1:0);
  for(const tw of S.towns){if(!tw.alive||lv(tw)<2||Math.hypot(tw.x-S.cam.x,tw.y-S.cam.y)>5000)continue;const n=Math.min(40,Math.round(tw.r/14)),hh=lv(tw)>=3?44:30;for(let k=0;k<n;k++){if(k%10===0)continue;const a=k/n*6.283,px=tw.x+Math.cos(a)*(tw.r+20),py=tw.y+Math.sin(a)*(tw.r+20),pz=groundH(px,py);B(px,py,pz+hh/2,10,hh,10,lv(tw)>=3?'#8d8f94':'#7a5a3c')}}
  for(const tw of S.towns){if(!tw.alive||Math.hypot(tw.x-S.cam.x,tw.y-S.cam.y)>9000)continue;const z=groundH(tw.x,tw.y),hh=tw.outpost?90:130;if(dk>0)for(let k=0;k<8;k++){const a=k*.785,lx=tw.x+Math.cos(a)*tw.r*.95,ly=tw.y+Math.sin(a)*tw.r*.95,lz=groundH(lx,ly);B(lx,ly,lz+22,4,44,4,'#4a3a2a');B(lx,ly,lz+50,12+Math.sin(t*7+k)*1.5,14,12,dk>=.5?'#ffd27a':'#c8a860')}B(tw.x+tw.r*.35,tw.y,z+hh/2,7,hh,7,'#5a4a36');for(let k=0;k<3;k++)B(tw.x+tw.r*.35+8+k*10,tw.y,z+hh-14+Math.sin(t*3+k*.9)*3,10,22-k*3,2,tw.col,Math.sin(t*2+k)*.25)}
  for(const p of S.pois||[]){if(Math.hypot(p.x-S.cam.x,p.y-S.cam.y)>9000)continue;const z=groundH(p.x,p.y),rd=S.t>=p.ready;
    if(p.k==='shrine'){const c=SHRINES[p.sub].col;B(p.x,p.y,z+6,70,12,70,'#8f8a80');B(p.x-24,p.y,z+40,12,70,12,'#a39d92');B(p.x+24,p.y,z+40,12,70,12,'#a39d92');B(p.x,p.y,z+80,70,10,16,'#6b665e');B(p.x,p.y,z+48+(rd?Math.sin(t*2)*6:0),16,16,16,rd?c:'#555',t*1.5)}
    else if(p.k==='spring'){B(p.x,p.y,z+2,150,4,110,'#7fb8c9');B(p.x,p.y,z+3,110,4,150,'#8fc8d8');for(let k=0;k<6;k++){const a=k*1.05;B(p.x+Math.cos(a)*85,p.y+Math.sin(a)*85,z+10,26,20,22,'#8a8478')}if(rd)for(let k=0;k<3;k++)B(p.x+Math.sin(t+k*2)*20,p.y+Math.cos(t*.7+k)*20,z+30+((t*30+k*25)%60),8,8,8,'#e8eef0')}
    else if(p.k==='stones'){for(let k=0;k<5;k++){const a=k*1.2566;B(p.x+Math.cos(a)*70,p.y+Math.sin(a)*70,z+45,22,90+(k%2)*30,16,'#8d8f94',a)}B(p.x,p.y,z+8,40,16,40,'#6e7075')}
    else if(p.k==='herb'){if(rd)for(let k=0;k<4;k++)B(p.x+Math.cos(k*1.6)*14,p.y+Math.sin(k*1.6)*14,z+7,10,14,10,k%2?'#5fae5a':'#c46ad8')}
    else if(p.k==='camp'){const live=campBeasts(p).length;RF(p.x-60,p.y-40,z+30,40,60,'#7a5a3c');RF(p.x+60,p.y-30,z+30,36,55,'#6e5236');B(p.x,p.y,z+6,30,10,30,'#3a2a1c');if(live)B(p.x,p.y,z+18+Math.sin(t*9)*3,16,22,16,'#ff8a3a');B(p.x,p.y+60,z+14,40,26,28,rd&&!live?'#d9b45a':'#6b6250');for(let k=0;k<3;k++)B(p.x-90+k*10,p.y+70,z+30,4,60,4,'#5a4a36')}
    else if(p.k==='traveller'||p.k==='merchant'){if(p.k==='merchant'){B(p.x-40,p.y,z+22,60,30,40,'#8a6a44');B(p.x-40,p.y,z+44,64,14,44,'#c9a46a');B(p.x-40,p.y+24,z+10,20,20,4,'#3a2a1c');B(p.x-40,p.y-24,z+10,20,20,4,'#3a2a1c')}}}
  for(const c of S.caches){const z=groundH(c.x,c.y),ok=t>=c.ready;B(c.x,c.y,z+14,44,26,30,ok?'#d9b45a':'#6b6250');B(c.x,c.y,z+30,46,8,32,'#3a2d1c')}
  for(const e of S.events){if(e.k==='caravan'&&e.site){const z=groundH(e.site.x,e.site.y);B(e.site.x,e.site.y,z+60,5,120,5,'#6b5a44');B(e.site.x+14,e.site.y,z+108,26,18,3,TOWNS[e.i].col)}if(e.k==='caravan'){const z=groundH(e.x,e.y);B(e.x,e.y,z+24,60,26,30,'#8a6a44');B(e.x,e.y,z+44,56,16,28,'#e6dcc4');B(e.x,e.y,z+60,8,8,8,TOWNS[e.i].col)}}
  for(const s of S.sites)if(s.build){const face=climbing3D()?.face??s.build.face,a=bodyWorld(s.c,s.r,face),z=groundH(a.x,a.y)+a.z;if(s.build.k==='ladder'){const b2=bodyWorld(s.c,Math.max(0,s.r-30-25*(lv(s.build)-1)),face);B(a.x,a.y,(z+groundH(b2.x,b2.y)+b2.z)/2,6,Math.max(20,z-groundH(b2.x,b2.y)-b2.z),6,'#7a5a36');continue}if(s.build.k==='platform'){B(a.x,a.y,z,90,10,60,'#8a6a44',g.ang);continue}if(s.build.k==='brace'){B(a.x,a.y,z,110,14,14,'#3a3a3a',g.ang);B(a.x,a.y,z,14,110,14,'#3a3a3a',g.ang)}else{B(a.x,a.y,z,56,28,40,'#1b1b1b',g.ang);B(a.x,a.y,z+18,12,40,12,'#1b1b1b');B(a.x,a.y,z+40,10,10,10,TOWNS[s.build.town].col)}}
  for(const sh of S.shots){if(ba>=60)break;const z=1300*(1-sh.t)+Math.sin(sh.t*Math.PI)*350;put(G3.ball,ba++,sh.x,sh.y,groundH(sh.x,sh.y)+z,12,12,12,0)}
  for(const[m,n]of[[G3.box,bx],[G3.roof,rf],[G3.disc,dc],[G3.ball,ba]]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
  // a mountain the camera is in, and the giant when it stands between the camera and you, turn see-through
  const cp=G3.cam.position;for(const mm of G3.marks){const m=mm.userData.m,d=Math.hypot(cp.x-m.x,cp.z-m.y),near=d<1100;mm.material.opacity+=((near?.25:1)-mm.material.opacity)*.15;mm.material.depthWrite=mm.material.opacity>.9}
  {let under=false;if(S.you&&!S.you.dead&&S.you.mode==='ground'){const ax=S.you.x-cp.x,ay=S.you.y-cp.z,bx=g.x-cp.x,by=g.y-cp.z,L=Math.hypot(ax,ay),t2=(ax*bx+ay*by)/(L*L||1);under=t2>0&&t2<1&&Math.abs(ax*by-ay*bx)/(L||1)<500}
    G3.giantMat.transparent=true;G3.giantMat.opacity+=((under?.35:1)-G3.giantMat.opacity)*.15;G3.giantMat.depthWrite=G3.giantMat.opacity>.9}
  // the climber's stone: holds near them (firm pale, mossy green, loose orange), joints, spots, anchors, ladders
  {let n=0;const cl=climbing3D();if(cl){const hb=S.body.h,r0=Math.max(0,Math.floor(cl.y)-24),r1=Math.min(ROWS-1,Math.floor(cl.y)+24);
    for(let r=r0;r<=r1;r++)for(let c=0;c<COLS;c++){const k=hb[r*COLS+c];if(!k||n>=900)continue;const tt=S.body.g[r*COLS+c];if(tt===SITE||tt===JOINT||tt===HEART)continue;const a=climbViewPoint(c+.5,r+.5),z=groundH(a.x,a.y)+a.z;
      const led=tt===LEDGE;put(G3.hold,n,a.x,a.y,z,led?13:6,led?3:4,led?13:6,0);G3.hold.setColorAt(n++,_c.set(k===2?'#7fb055':k===3?'#e08a4a':led?'#e8dcb4':'#d9cdb2'))}}
    G3.hold.count=n;G3.hold.instanceMatrix.needsUpdate=true;if(G3.hold.instanceColor)G3.hold.instanceColor.needsUpdate=true;
    if(cl){let bx2=G3.box.count;const B2=(x,y,z,sx,sy,sz,col)=>{if(bx2<400){put(G3.box,bx2,x,y,z,sx,sy,sz,g.ang);G3.box.setColorAt(bx2++,_c.set(col))}};
      for(const id in JOINTS){const J=JOINTS[id],j=S.joints[id];if(Math.abs(J.r0-cl.y)>40)continue;const a=climbViewPoint((J.c0+J.c1+1)/2,(J.r0+J.r1+1)/2),z=groundH(a.x,a.y)+a.z;
        B2(a.x,a.y,z,(J.c1-J.c0+1)*26,(J.r1-J.r0+1)*FT,10,j.crip?'#4a4a4a':id==='heart'?(Math.sin(t*4)>0?'#ff4d5e':'#c8303e'):'#ff9a4a');for(let w=0;w<j.wedges.length;w++)B2(a.x+(w-1)*20,a.y,z+18,6,18,6,'#222')}
      for(const st of S.sites){if(Math.abs(st.r-cl.y)>40||st.build)continue;const a=climbViewPoint(st.c+.5,st.r+.5),z=groundH(a.x,a.y)+a.z;B2(a.x,a.y,z,22,4,22,'#ffcf6a')}
      for(const an of S.anchors){if(Math.abs(an.r-cl.y)>30)continue;const a=climbViewPoint(an.c+.5,an.r+.5),z=groundH(a.x,a.y)+a.z;B2(a.x,a.y,z,an.platform?26:8,an.platform?5:8,8,TOWNS[an.town].col)}
      for(const st of S.sites)if(st.build&&st.build.k==='ladder')for(const r of st.build.cells||[]){if(Math.abs(r-cl.y)>30)continue;const a=climbViewPoint(st.c+.5,r+.5),z=groundH(a.x,a.y)+a.z;B2(a.x,a.y,z,22,3,4,'#7a5a36')}
      for(const ch of S.chains)if(ch.hp>0&&Math.abs(ch.r-cl.y)<30){const a=climbViewPoint(ch.c+.5,ch.r+.5),z=groundH(a.x,a.y)+a.z;B2(a.x,a.y,z,24,24,24,'#2b2b2e')}
      G3.box.count=bx2;G3.box.instanceMatrix.needsUpdate=true;if(G3.box.instanceColor)G3.box.instanceColor.needsUpdate=true}}
  // while a wake horn sounds, a beam of light stands over the giant's head, seen from anywhere on the land
  {const on=!!S.waker&&!S.g.awake;G3.hornBeam.visible=on;if(on){const a=bodyWorld(16,198);G3.hornBeam.position.set(a.x,a.z+2500,a.y);G3.hornBeam.scale.set(1,5000,1);G3.hornBeam.material.opacity=.35+.25*Math.sin(t*5)}}
  {const tg=goalTarget();G3.beacon.visible=!!tg&&tg.z==null;if(G3.beacon.visible){const z=groundH(tg.x,tg.y);G3.beacon.position.set(tg.x,z+900,tg.y);G3.beacon.scale.set(1,1800,1);G3.beacon.material.opacity=.5+.2*Math.sin(t*3)}}
  // light and haze follow the opening's sky
  const ok=openingK();G3.hemi.color.set('#e4e8ff').lerp(_c.set('#c87048'),ok*.7);G3.sun.intensity=.9-.45*ok;S.fogC=S.fogC||new THREE.Color();G3.scene.fog.color.set('#cdbfa2').lerp(_c.set('#6a3a30'),ok*.8)}
