'use strict';
// Colossus · src/main.js · the frame loop, the test hook, start-up
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// ================= loop =================
let acc=0,last=performance.now();
// the next frame is asked for first and the work is guarded, so one thrown error never freezes the game
let SLOW=0;function slowMo(ms){SLOW=performance.now()+ms}
function frame(now){requestAnimationFrame(frame);try{frameWork(now)}catch(e){console.error(e)}}
// the opening flight: up into the tearing sky, a slow turn under it, round to the chained giant on its line, then home behind you
function introCamera(){if(!S||!S.introCam||!S.you&&S.role!=='giant')return;const t=S.t,ease=u=>u<0?0:u>1?1:u*u*(3-2*u);if(S.introYaw==null){S.introYaw=cam.yaw;const f=S.you||S.g;S.giantYaw=Math.atan2(S.g.x-f.x,-(S.g.y-f.y))}
  const turn=S.introYaw+.35*ease(t/12),toGiant=S.giantYaw,k=ease((t-11)/4),back=ease((t-17)/4);
  cam.yaw=turn+(((toGiant-turn+Math.PI*3)%(Math.PI*2))-Math.PI)*k;
  cam.pitch=-.55+.25*ease((t-6)/5)+(.12-(-.3))*back;if(t<11)cam.pitch=Math.min(cam.pitch,-.3);
  S.cam.zoom=.75+.25*back+(t>11&&t<17?-.15*Math.sin(Math.PI*(t-11)/6):0);if(t>21.5){S.introCam=false;cam.pitch=.12;S.cam.zoom=1}}
let FILM=false;
function frameWork(now){{const f=!!S&&S.t<OPENING.len;if(f!==FILM){FILM=f;document.body.classList.toggle('film',f)}}introCamera();if(S&&S.trumpetsDue&&S.t>.3&&((se&&se!=='starting')||(actx&&!se)||S.t>2.5)){S.trumpetsDue=false;trumpets()}const dt=Math.min(.1,(now-last)/1000);last=now;pollPad();
  paintFeed(dt);
  if(S&&S.tut&&S.tut.cardDue&&!menu&&!S.fly)openTutorialCard();
  const fl=S&&S.fly?stepFly(dt):null;
  if(S&&!menu&&!S.over&&!S.fly){acc+=dt*(performance.now()<SLOW?.35:1);while(acc>=C.DT){step(C.DT);acc-=C.DT}}else acc=0;
  if(S){let z=0;if(keys.has('Equal')||keys.has('NumpadAdd'))z+=1;if(keys.has('KeyF')||keys.has('Minus')||keys.has('NumpadSubtract'))z-=1;z-=padZoom;let yw=padCam.x,pt=padCam.y;if(keys.has('KeyQ'))yw-=1;if(keys.has('KeyE'))yw+=1;if(keys.has('KeyY'))pt-=1;if(keys.has('KeyG'))pt+=1;if((yw||pt)&&!(S.you&&S.you.mode==='climb'))camTurn(yw*CAM.YAW_RATE*dt,pt*CAM.PITCH_RATE*dt);
    // the walking giant's camera eases round behind its heading: a 12 degree dead zone, 0.8/s gain, at most 30 degrees a second
    // (well under the ~60 deg/s where views start to sicken people); any manual turn holds it off for 3 s
    else if(S.role==='giant'&&!S.introCam&&S.g.awake&&!(S.g.fallen>0)&&S.g.v>3&&S.t-(cam.manualT??-99)>3){const x=S.g.ang+Math.PI/2-cam.yaw,d=Math.atan2(Math.sin(x),Math.cos(x)),a=Math.abs(d);
      if(a>.21)cam.yaw=(cam.yaw+Math.sign(d)*Math.min((a-.21)*.8,.52)*dt)%(Math.PI*2)}if(z)zoomBy(Math.exp(z*dt*1.2));S.cam.czoom+=(S.cam.zoom-S.cam.czoom)*Math.min(1,dt*8);
    const focus=fl?fl:S.role==='giant'?S.g:(S.you.mode==='climb'?S.g.feet[S.you.leg]:S.you);if(fl){S.cam.zoom=1-.3*fl.k}S.cam.x+=(focus.x-S.cam.x)*Math.min(1,dt*5);S.cam.y+=(focus.y-S.cam.y)*Math.min(1,dt*5)}
  shakeA*=Math.pow(.02,dt);if(shakeA<.3)shakeA=0;
  atmosFrame(dt);
  seFrame();render();paintHud();paintButtons()}
// test hook: run whole matches without the screen
window.__col={newGame:(role,seed)=>{const s=newGame(role,seed);s.headless=true;return s},start,step:n=>{for(let i=0;i<n&&S&&!S.over;i++)step(C.DT)},get S(){return S},C,JOINTS,bfs,set autoplay(v){if(S)S.autoplay=v}};
openTitle();requestAnimationFrame(frame);
