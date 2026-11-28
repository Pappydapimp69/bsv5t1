'use strict';
// Colossus · src/rpg/town.js · house cap, civic buildings, prosperity and festivals
// Classic script: shares one global scope with the other src files, loaded in the order index.html lists them.

// owner's rule: a settlement holds three houses at level 1 and two more per level, and its foragers build only after a hero built the first
const houseCap=t=>3+2*(lv(t)-1);
// ================= the town as a place to grow (owner: more city-builder elements) =================
// Production buildings beside houses and towers, and a prosperity score per settlement in the Fallout 4 needs-checklist
// style (food for the houses, walls standing, a market, crafts) with Kingdom Two Crowns' plain coin payoff: prosperity
// scales the rent you are paid, a market adds a quarter, a smithy cuts gear prices, a stable sells and heals horses,
// a well heals people at home, farms feed two houses each and pay a little themselves.
const CIVIC={farm:{n:'Farm',sub:'+6 food every 15 s, more with a villager on it; feeds two houses',one:false,col:'#c9b458'},market:{n:'Market',sub:'Rent here +25%; needs a level 2 settlement',one:true,lvl:2,col:'#d07a4a'},
  smithy:{n:'Smithy',sub:'Gear 20% cheaper in this town',one:true,col:'#6b6f78'},stable:{n:'Stable',sub:'Horses for 45 gold here; heals your horse',one:true,col:'#8a6a44'},well:{n:'Well',sub:'Heals your people near it',one:false,max:2,col:'#7fb8c9'}};
const civicIn=(t,k)=>t?S.builds.filter(b=>b.k===k&&b.hp!==0&&b.settlementId===t.id).length:0;
// a festival: a settlement of yours at 70+ prosperity holds one once a day; for a minute your strikes and earnings are blessed
function stepFestival(){const h=S.you;if(!h||S.t%1>C.DT*1.5)return;for(const t of aliveTowns()){if(t.i!==h.town||t.festDay===Math.floor(S.t/dayLen())||prosperity(t)<70)continue;t.festDay=Math.floor(S.t/dayLen());t.festUntil=S.t+60;h.buff={k:'might',until:S.t+60};if(!S.headless){announce(t.name+' holds a festival for its prosperity! Blessed with might for a minute; '+30+' gold from the townsfolk.');sfx('fanfare')}h.gold+=30}}
function prosperity(t){if(!t)return 0;const houses=t.houses||0,farms=civicIn(t,'farm'),hungry=Math.max(0,houses-2*farms-1);
  const parts=[['Base',20],['Houses',6*houses],['Farms',8*farms],['Market',15*civicOn(t,'market')],['Smithy',10*civicOn(t,'smithy')],['Stable',8*civicOn(t,'stable')],['Wells',5*civicOn(t,'well')],['Hungry houses',-10*hungry],['Walls down',t.hp<t.max*.5?-20:0],['Recent raid',S.t-(t.raidT??-999)<120?-10:0]];
  const v=clamp(parts.reduce((a,p)=>a+p[1],0),0,100);t.prosp=v;t.prospParts=parts.filter(p=>p[1]);return v}
const prospK=t=>1+Math.max(0,prosperity(t)-40)/100; // above 40, each point of prosperity adds 1% to rent
function civicWhy(h,k){const D=CIVIC[k];if(!D)return null;const t=nearestOwn(h.town,h.x,h.y);if(!t||!inTerritory(h.town,h.x,h.y))return'Build it inside a settlement\u2019s area';
  if(D.lvl&&lv(t)<D.lvl)return t.name+' must be level '+D.lvl;if(k==='farm'&&civicIn(t,'farm')>=Math.floor((t.houses||0)/2)+1)return'Each farm feeds two houses: build more houses in '+t.name+' first';if(D.one&&civicIn(t,k))return t.name+' already has a '+D.n.toLowerCase();if(D.max&&civicIn(t,k)>=D.max)return t.name+' has '+D.max+' already';return null}
