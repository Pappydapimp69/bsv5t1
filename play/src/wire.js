'use strict';
// Colossus · src/wire.js · wrappers that extend functions defined across files. In the single-file build these ran
// as top-level statements after every function was hoisted; here they run once all definitions are loaded,
// in their original order: beasts on a leash (land), hit-stop freeze around the 3D update (input), the map and
// camera blend around the 3D build/update/camera (view2d).

// from land.js
{const step0=stepMonsters;stepMonsters=function(dt){step0(dt);leashBeasts()}}
// from input.js
g3Update=(f=>function(){const now=performance.now(),saved=[];
  for(const[o,H]of HSTOP){if(now>H.until){HSTOP.delete(o);continue}saved.push([o,{x:o.x,y:o.y,swing:o.swing,rec:o.rec,wind:o.wind}]);o.x=H.x;o.y=H.y;o.swing=H.swing;o.rec=H.rec;if(o.wind&&H.wt!=null)o.wind={...o.wind,t:H.wt}}
  try{return f.apply(this,arguments)}finally{for(const[o,v]of saved)Object.assign(o,v)}})(g3Update);
// from view2d.js
{const b0=g3Build,u0=g3Update,c0=g3Camera;g3Build=function(){b0();g3MapBuild()};g3Update=function(){u0();g3MapUpdate()};g3Camera=function(){
  const mode=!!climbing3D(),cm=G3.cam;
  if(!reducedMotion&&G3.cameraMode!=null&&G3.cameraMode!==mode)G3.cameraBlend={position:cm.position.clone(),rotation:cm.quaternion.clone(),at:performance.now()};
  G3.cameraMode=mode;c0();g3MapCamera();
  const blend=G3.cameraBlend;if(blend){const u=clamp((performance.now()-blend.at)/320,0,1),weight=1-u*u*(3-2*u);
    cm.position.lerp(blend.position,weight);cm.quaternion.slerp(blend.rotation,weight);if(u===1)G3.cameraBlend=null}
  cm.updateMatrixWorld()}}
// from rpg/economy.js: stockpiles, villagers at work and the materials on every building
wireEconomy();
