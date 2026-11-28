'use strict';
// Colossus · src/rpg/mounts.js · horses: buying, riding, being thrown, levels
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// Mounts (owner's request: mounts to increase speed). A hero buys a horse in town and rides with R: much faster on open ground
// (the walk took 90% of a match in the pacing review), a charging blow while riding, and a hard hit can throw you. The horse
// is hurt by blows taken while riding; worn out it bolts home and comes back in a minute. No riding on the giant or while building.
C.HORSE_COST=80;C.RIDE=1.9;C.RIDE_HIT=1.5;C.HORSE_HP=80;C.THROW=.3;C.HORSE_AWAY=60;
const horseReady=h=>!!h.horse&&!(h.horse.away>S.t);
function rideWhy(h){if(!h.horse)return'Buy a horse in town ('+C.HORSE_COST+' gold)';if(h.horse.away>S.t)return'Your horse bolted; it returns in '+Math.ceil(h.horse.away-S.t)+' s';if(h.mode!=='ground')return'Not on the giant';if(h.job)return'Not while building';return null}
function setRide(h,on){if(on&&rideWhy(h))return false;if(!!h.riding===!!on)return true;h.riding=!!on;if(on)h.rodeOnce=1;if(h.you){sfx(on?'coin':'thud');toast(on?'You mount your horse. R to get down.':'You get down from your horse.')}return true}
function toggleRide(h){if(h.riding)return setRide(h,false);const w=rideWhy(h);if(w){if(h.you)toast(w);return false}return setRide(h,true)}
function horseHurt(h,d){if(!h.riding||!h.horse)return;h.horse.hp-=d*.6;
  if(h.horse.hp<=0&&h.horse.barded){h.horse.hp=1;h.riding=false;if(h.you)toast('Your barded horse stumbles but stays: let it rest.');return}
  if(h.horse.hp<=0){h.riding=false;h.horse.hp=h.horse.max*.5;h.horse.away=S.t+C.HORSE_AWAY;if(h.you)toast('Your horse is hurt and bolts for home! Back in '+C.HORSE_AWAY+' s.');return}
  if(!perk(h,'rider')&&!charm(h,'bell')&&(d>=12||rnd()<C.THROW)){h.riding=false;h.dodgeCd=Math.max(h.dodgeCd||0,.6);if(h.you){toast('Thrown from your horse! R to remount.');shake(8)}}}
function horseGrow(h,d){const H=h.horse;if(!H||(H.lv||1)>=3)return;H.ride=(H.ride||0)+d;if(H.ride>=6000*(H.lv||1)){H.ride=0;H.lv=(H.lv||1)+1;H.max+=20;H.hp=H.max;if(h.you){toast('Your horse grows stronger: level '+H.lv+' (faster, tougher).');sfx('coin')}}}
function stepHorse(h,dt){if(h.hound)stepHound(h,dt);if(!h.horse)return;
  // riding through beasts tramples them: a knock and some damage, once a second per beast
  if(h.riding&&h.mode==='ground'){const sp=Math.hypot(h.x-(h.tx0??h.x),h.y-(h.ty0??h.y))/Math.max(dt,1e-6);h.tx0=h.x;h.ty0=h.y;if(sp>C.H_SPEED*1.2)for(const m of S.monsters){if(m.kind==='troll'||m.warlord||Math.hypot(m.x-h.x,m.y-h.y)>m.r+22||S.t-(m.trampleT??-9)<1)continue;m.trampleT=S.t;hitBeast(h,m,8+h.lvl);if(S.monsters.includes(m))onBlow(h,m,8,.35);if(h.you&&!S.headless){shake(3);sfx('hit',true)}}}if(h.riding&&!S.headless&&(h.you||nearPlayer(h))){const w=Math.hypot(h.x-(h.px??h.x),h.y-(h.py??h.y));h.px=h.x;h.py=h.y;if(w>.5){h.hoofT=(h.hoofT||0)+dt;if(h.hoofT>.22){h.hoofT=0;if(h.you)sfx('hoof',true);S.fx.push({k:'dust',x:h.x-Math.cos(h.face||0)*26,y:h.y-Math.sin(h.face||0)*26,t:0,life:.9})}}}if(S.t%1<dt&&S.builds.some(b=>b.k==='stable'&&b.town===h.town&&Math.hypot(b.x-h.x,b.y-h.y)<350)){h.horse.hp=h.horse.max;h.horse.away=0}if(h.mode!=='ground'||h.job||h.dead)h.riding=false;if(!h.riding)h.horse.hp=Math.min(h.horse.max,h.horse.hp+2*dt)}
// a people's build area: a ring around each of its settlements and around every house it has built, so houses
// push the area outward and towers can stand anywhere inside it
