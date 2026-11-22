// Prank Day browser checks. Run: node tests/run.js  (prints PASS/FAIL lines, exits 1 on any FAIL)
const {chromium}=require('playwright');const path=require('path');
const URL='file://'+path.resolve(__dirname,'../index.html');
let fails=0;const ok=(name,cond,why='')=>{console.log((cond?'PASS ':'FAIL ')+name+(cond?'':'  '+why));if(!cond)fails++};
const wait=(p,ms)=>p.waitForTimeout(ms);

async function page(b,opt){const ctx=await b.newContext(opt);const p=await ctx.newPage();const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  if(opt.pad)await p.addInitScript(()=>{const btn=()=>({pressed:false,touched:false,value:0});
    window.__pad={connected:true,index:0,id:'fake pad',mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},btn),vibrationActuator:null};
    navigator.getGamepads=()=>[window.__pad.connected?window.__pad:null,null,null,null]});
  await p.goto(URL);await wait(p,300);return {p,ctx,errs}}

// every visible control inside the viewport, at least 44px, no page scroll, panels never over the game view
async function layout(p,label){
  const r=await p.evaluate(()=>{const vw=innerWidth,vh=innerHeight,bad=[];
    for(const b of document.querySelectorAll('button')){if(b.offsetParent===null)continue;const r=b.getBoundingClientRect();
      if(r.width<44-0.5||r.height<44-0.5)bad.push(`${b.id||b.dataset.o||b.textContent.slice(0,12)} ${r.width|0}x${r.height|0}`);
      if(r.left<-1||r.top<-1||r.right>vw+1||r.bottom>vh+1)bad.push(`${b.id||b.textContent.slice(0,12)} off screen`)}
    const se=document.scrollingElement,scroll=se.scrollHeight>vh+1||se.scrollWidth>vw+1;
    const v=document.getElementById('view').getBoundingClientRect(),over=[];
    if(document.getElementById('ov').hidden)for(const id of['hud','msg','ctl','side']){const e=document.getElementById(id);if(!e||e.offsetParent===null)continue;const q=e.getBoundingClientRect();
      const ix=Math.min(q.right,v.right)-Math.max(q.left,v.left),iy=Math.min(q.bottom,v.bottom)-Math.max(q.top,v.top);if(ix>1&&iy>1)over.push(id)}
    return{bad,scroll,over,vw:v.width/vw}});
  ok(`${label}: controls on screen and >=44px`,!r.bad.length,r.bad.join(', '));
  ok(`${label}: no page scroll`,!r.scroll);ok(`${label}: no panel over the game view`,!r.over.length,r.over.join(','));return r}

async function screens(p,label){
  // walk the phases through the page's own buttons and hooks
  const phases={};
  await p.evaluate(()=>{__prank.start({seed:2});});phases.play=await layout(p,label+' play');
  await p.evaluate(()=>document.getElementById('pauseB').click());await wait(p,50);await layout(p,label+' pause');
  await p.evaluate(()=>document.getElementById('bSet').click());await wait(p,50);await layout(p,label+' settings');
  await p.evaluate(()=>document.getElementById('bBack').click());await p.evaluate(()=>document.getElementById('bQuit').click());await wait(p,50);await layout(p,label+' title');
  await p.evaluate(()=>document.getElementById('bHow').click());await wait(p,50);await layout(p,label+' howto');
  await p.evaluate(()=>{__prank.start({seed:2});__prank.stepBy(181*60)});await wait(p,50);await layout(p,label+' day end');
  await p.evaluate(()=>{__prank.bot(true);__prank.stepBy(3*181*60)});await wait(p,50);await layout(p,label+' match end');
  return phases}

(async()=>{const b=await chromium.launch();
  // 1. layouts
  for(const [w,h,touch] of [[390,844,true],[844,390,true],[1280,720,false]]){
    const {p,ctx,errs}=await page(b,{viewport:{width:w,height:h},hasTouch:touch,isMobile:touch});
    const ph=await screens(p,`${w}x${h}`);
    if(w>h&&h<500)ok(`${w}x${h}: game view at least 40% of the width`,ph.play.vw>=0.4,String(ph.play.vw));
    ok(`${w}x${h}: no console errors`,!errs.length,errs.slice(0,3).join(' | '));await ctx.close()}

  // 2. touch only: title to a set prank to the next day, all by taps
  {const {p,ctx,errs}=await page(b,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const tapEl=async sel=>{const bx=await p.locator(sel).first().boundingBox();await p.touchscreen.tap(bx.x+bx.width/2,bx.y+bx.height/2);await wait(p,120)};
    await tapEl('#bPlay');ok('touch: Play starts a game',await p.evaluate(()=>__prank.phase)==='play');
    ok('touch: hints name taps',/Tap/.test(await p.textContent('#ctlHint')));
    let set=false;for(const spot of['sofa','kfloor','front','hfloor','cup','arm']){
      const at=await p.evaluate(s=>__prank.spotScreen(s),spot);await p.touchscreen.tap(at.x,at.y);
      for(let i=0;i<40&&!(await p.evaluate(()=>__prank.state().picker));i++){await p.evaluate(()=>__prank.stepBy(6));await wait(p,10)}
      if(!(await p.evaluate(()=>__prank.state().picker)))continue;
      const opt=p.locator('#pkBtns button:not([aria-disabled="true"])').first();
      if(!(await opt.count()))continue;const before=await p.evaluate(()=>__prank.state().pranks);
      const f0=await p.evaluate(()=>__prank.state().stats.fizzled);
      const bx=await opt.boundingBox();await p.touchscreen.tap(bx.x+bx.width/2,bx.y+bx.height/2);
      // the tap's own effect: the setup starts (busy), or it already finished, or a resident caught it; what happens after is the game, not the input
      const started=await p.evaluate(()=>__prank.state().busy);await p.evaluate(()=>__prank.stepBy(150));
      const st=await p.evaluate(()=>__prank.state());if(started||st.pranks>before||st.stats.fizzled>f0){set=true;break}}
    ok('touch: a prank set by taps alone',set);
    await p.evaluate(()=>__prank.stepBy(181*60));ok('touch: day ends',await p.evaluate(()=>__prank.phase)==='dayend');
    await tapEl('#bNext');ok('touch: Next day by tap',await p.evaluate(()=>__prank.phase==='play'&&__prank.state().day===1));
    await p.evaluate(()=>__prank.stepBy(181*60));await tapEl('#bNext');await p.evaluate(()=>__prank.stepBy(181*60));
    ok('touch: the match plays to its end screen',await p.evaluate(()=>__prank.phase)==='matchend');
    ok('touch: the end screen names what you did',/You landed \d+ pranks/.test(await p.textContent('#ovp')));
    await tapEl('#bAgain');ok('touch: Play again by tap',await p.evaluate(()=>__prank.phase==='play'&&__prank.state().day===0));
    ok('touch: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 3. pad only: every menu, a prank, pause, next day, then unplug pauses
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720},pad:true});
    const tap=async(i,ms=90)=>{await p.evaluate(i=>{__pad.buttons[i].pressed=true;__pad.buttons[i].value=1},i);await wait(p,ms);await p.evaluate(i=>{__pad.buttons[i].pressed=false;__pad.buttons[i].value=0},i);await wait(p,90)};
    const A=0,B=1,START=9,UP=12,DOWN=13;const ph=()=>p.evaluate(()=>__prank.phase);const foc=()=>p.evaluate(()=>document.activeElement&&document.activeElement.id);
    await p.evaluate(()=>dispatchEvent(Object.assign(new Event('gamepadconnected'),{gamepad:__pad})));
    await tap(DOWN);ok('pad: D-pad moves menu focus',await foc()==='bHow',await foc());
    await tap(A);ok('pad: A opens How to play',await ph()==='howto');
    ok('pad: hints name pad buttons',/left stick/.test(await p.textContent('#ovp')));
    await tap(B);ok('pad: B backs out',await ph()==='title');
    for(let i=0;i<3&&(await foc())!=='bSet';i++)await tap(DOWN);await tap(A);ok('pad: Settings opens',await ph()==='settings');
    await tap(A);ok('pad: a setting toggles in place, focus kept',await foc()==='bSnd',await foc());
    await tap(B);for(let i=0;i<3&&(await foc())!=='bPlay';i++)await tap(UP);
    // hold A through the start: the press must not leak into the first frames of play
    await p.evaluate(()=>{__pad.buttons[0].pressed=true});await wait(p,400);
    ok('pad: Play starts with A',await ph()==='play');ok('pad: held start press does not act in play',!(await p.evaluate(()=>__prank.state().picker||__prank.state().busy)));
    await p.evaluate(()=>{__pad.buttons[0].pressed=false});await wait(p,120);
    let opened=false;for(let i=0;i<40&&!opened;i++){await p.evaluate(()=>{__pad.axes[0]=1});await wait(p,110);await p.evaluate(()=>{__pad.axes[0]=0});await wait(p,40);
      await tap(A);opened=await p.evaluate(()=>__prank.state().picker);if((await p.evaluate(()=>__prank.state().player.x))>23)break}
    ok('pad: A at a spot opens its choices',opened);
    if(opened){const before=await p.evaluate(()=>__prank.state().pranks+__prank.state().traps);
      for(let i=0;i<6;i++){if(await p.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('aria-disabled')!=='true'&&!!document.activeElement.dataset.o&&document.activeElement.dataset.o!=='leave'))break;await tap(DOWN)}
      await tap(A);await p.evaluate(()=>__prank.stepBy(150));ok('pad: choosing with A does something',!(await p.evaluate(()=>__prank.state().picker)),'picker still open');}
    await tap(START);ok('pad: Start pauses',await ph()==='pause');await tap(A);ok('pad: A on Resume resumes',await ph()==='play');
    await p.evaluate(()=>__prank.stepBy(181*60));await tap(A);ok('pad: A on day end goes to the next day',await p.evaluate(()=>__prank.phase==='play'&&__prank.state().day===1));
    await p.evaluate(()=>__prank.stepBy(181*60));await tap(A);await p.evaluate(()=>__prank.stepBy(181*60));
    ok('pad: the match plays to its end screen',await ph()==='matchend');
    await tap(A);ok('pad: A on the end screen plays again',await p.evaluate(()=>__prank.phase==='play'&&__prank.state().day===0));
    await p.evaluate(()=>{__pad.connected=false;dispatchEvent(Object.assign(new Event('gamepaddisconnected'),{gamepad:__pad}))});await wait(p,100);
    ok('pad: unplugging pauses',await ph()==='pause');ok('pad: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 4. keyboard only
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');ok('keys: Enter opens How to play',await p.evaluate(()=>__prank.phase)==='howto');
    await p.keyboard.press('Escape');ok('keys: Escape backs out',await p.evaluate(()=>__prank.phase)==='title');
    for(let i=0;i<3;i++)await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');await wait(p,100);ok('keys: Enter on Play starts',await p.evaluate(()=>__prank.phase)==='play');
    ok('keys: hints name keys',/\bD\b|→/.test(await p.textContent('#ctlHint')),await p.textContent('#ctlHint'));
    const x0=await p.evaluate(()=>__prank.state().player.x);await p.keyboard.down('KeyD');await wait(p,500);await p.keyboard.up('KeyD');
    ok('keys: D walks right',(await p.evaluate(()=>__prank.state().player.x))>x0+0.5);
    await p.keyboard.press('Escape');ok('keys: Escape pauses',await p.evaluate(()=>__prank.phase)==='pause');
    await p.keyboard.press('Escape');ok('keys: Escape resumes',await p.evaluate(()=>__prank.phase)==='play');
    ok('keys: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 5. contrast of every visible text over its real (composited) background, normal and under colour-blind stand-ins
  {const {p,ctx}=await page(b,{viewport:{width:844,height:390},hasTouch:true});
    const audit=async label=>{const r=await p.evaluate(()=>{
      const rgba=s=>{const m=s.match(/[\d.]+/g)||[0,0,0,0];return[+m[0],+m[1],+m[2],m[3]==null?1:+m[3]]};
      const over=(t,b)=>[0,1,2].map(i=>t[i]*t[3]+b[i]*(1-t[3])).concat(1);
      const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
      const bgOf=el=>{const chain=[];for(let e=el;e;e=e.parentElement)chain.push(rgba(getComputedStyle(e).backgroundColor));let c=rgba(getComputedStyle(document.body).backgroundColor);
        for(let i=chain.length-1;i>=0;i--)if(chain[i][3]>0)c=over(chain[i],c);return c};
      const low=[];for(const el of document.querySelectorAll('#app *,#ov *')){if(el.offsetParent===null)continue;
        if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
        const cs=getComputedStyle(el);const bg=bgOf(el),fg=over(rgba(cs.color),bg);const L1=lum(fg),L2=lum(bg);const cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
        if(cr<4.5)low.push(`${el.id||el.className||el.tagName}:"${el.textContent.trim().slice(0,18)}" ${cr.toFixed(2)}`)}return low});
      ok(`contrast ${label}: all text >= 4.5:1`,!r.length,r.slice(0,6).join('; '))};
    await p.evaluate(()=>__prank.start({seed:4}));await p.evaluate(()=>__prank.stepBy(600));await audit('play');
    await p.evaluate(()=>document.getElementById('pauseB').click());await audit('pause');
    await p.evaluate(()=>{__prank.start({seed:4});__prank.stepBy(181*60)});await audit('day end');
    await p.evaluate(()=>{__prank.start({seed:4,bot:true});for(let i=0;i<10&&__prank.stepBy(3600)!=='matchend';i++);});await audit('match end');
    await p.reload();await wait(p,300);await audit('title');
    await p.evaluate(()=>document.getElementById('bHow').click());await wait(p,100);await audit('how to play');
    await p.evaluate(()=>document.getElementById('bBack').click());await p.evaluate(()=>document.getElementById('bSet').click());await wait(p,100);await audit('settings');
    // the two sides differ by shape, not hue: your coin is round, Moss's badge is a diamond, in the HUD and on the card badges
    const shapes=await p.evaluate(()=>{const y=document.querySelector('.bY'),m=document.querySelector('.bM');const cy=getComputedStyle(y),cm=getComputedStyle(m);return{y:cy.borderRadius,m:cm.transform}});
    ok('colour-blind: your mark round, Moss mark a diamond',/50%|\d{2,}px/.test(shapes.y)&&shapes.m!=='none',JSON.stringify(shapes));
    // the canvas under protanopia and deuteranopia stand-ins: score marks still read by shape, so check the two side colours differ in luminance too
    const lum=await p.evaluate(()=>{const c=s=>getComputedStyle(document.documentElement).getPropertyValue(s).trim();return[c('--you'),c('--moss')]});
    const L=h=>{const n=parseInt(h.slice(1),16),v=[n>>16,n>>8&255,n&255].map(x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
    const sim=(h,M)=>{const n=parseInt(h.slice(1),16),v=[n>>16,n>>8&255,n&255];return'#'+M.map(r=>Math.max(0,Math.min(255,Math.round(r[0]*v[0]+r[1]*v[1]+r[2]*v[2])))).map(x=>x.toString(16).padStart(2,'0')).join('')};
    const PROT=[[.567,.433,0],[.558,.442,0],[0,.242,.758]],DEUT=[[.625,.375,0],[.7,.3,0],[0,.3,.7]];
    for(const [n,M] of [['normal',null],['protanopia',PROT],['deuteranopia',DEUT]]){const a=M?sim(lum[0],M):lum[0],c=M?sim(lum[1],M):lum[1];const r=(Math.max(L(a),L(c))+.05)/(Math.min(L(a),L(c))+.05);
      ok(`colour-blind ${n}: you and Moss differ in brightness (>=1.3:1)`,r>=1.3,`${a} ${c} ${r.toFixed(2)}`)}
    await ctx.close()}

  // 6. the player's choices decide the outcome; 7. determinism
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    const r=await p.evaluate(()=>{let played=0,idle=0;const rows=[];for(let seed=1;seed<=12;seed++){
        __prank.start({seed,bot:true});for(let i=0;i<10&&__prank.stepBy(60*60)!=='matchend';i++);const a=__prank.state().score;if(a.you>a.moss)played++;
        __prank.start({seed,bot:false});for(let d=0;d<3;d++){__prank.stepBy(181*60);__prank.next()}const c=__prank.state().score;if(c.you>c.moss)idle++;
        rows.push(`${seed}:${a.you}-${a.moss}/${c.you}-${c.moss}`)}
      const f1=(__prank.start({seed:9,bot:true}),__prank.stepBy(4000),__prank.fingerprint()),f2=(__prank.start({seed:9,bot:true}),__prank.stepBy(4000),__prank.fingerprint());
      const f3=(__prank.start({seed:10,bot:true}),__prank.stepBy(4000),__prank.fingerprint());
      return{played,idle,rows,f1,f2,f3}});
    console.log('     seeds played/idle: '+r.rows.join(' '));
    ok(`choices decide: played seat wins ${r.played}/12, idle ${r.idle}/12`,r.played>=10&&r.idle<=1);
    ok('determinism: same seed same state',r.f1===r.f2,`${r.f1} ${r.f2}`);
    // Moss reads you: a player who keeps to one room should find Moss's sealed guess there on days 2 and 3, and the read is kept for the next match
    const L=await p.evaluate(()=>{let hits=0,days=0,set=0;const rows=[];for(let seed=1;seed<=6;seed++)for(const room of[0,2]){
        __prank.start({seed,bot:true,botRoom:room});for(let i=0;i<10&&__prank.stepBy(3600)!=='matchend';i++);const h=__prank.state().history,sc=__prank.state().score;
        if(h[0].actual===room){set++;for(const d of h.slice(1)){days++;if(d.guess===room)hits++}}rows.push(`${seed}/${room}:${h.map(d=>d.guess+'>'+d.actual).join(',')} ${sc.you}-${sc.moss}`)}
      localStorage.removeItem('prank.moss');__prank.start({seed:3,bot:true,botRoom:2,blank:false});for(let i=0;i<10&&__prank.stepBy(3600)!=='matchend';i++);
      let kept=null;try{kept=JSON.parse(localStorage.getItem('prank.moss'))}catch(e){}
      __prank.start({seed:5,bot:false,blank:false});const g=__prank.state().guess;return{hits,days,set,rows,kept:kept&&kept.last,g}});
    console.log('     one-room player, guess>actual by day, score: '+L.rows.join(' '));
    ok(`Moss reads a one-room player: guess right on ${L.hits} of ${L.days} later days`,L.set>=8&&L.hits>=L.days*0.8,`${L.set} of 12 matches pranked the room on day 1`);
    ok('Moss keeps its read for the next match',L.kept===2&&L.g===2,JSON.stringify({last:L.kept,nextGuess:L.g}));ok('determinism: another seed differs',r.f1!==r.f3);
    ok('sim: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 8. moods last across days, and a resident pushed far enough storms out to the park where you can follow and keep pranking
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    const m=await p.evaluate(()=>{__prank.start({seed:2,bot:false});__prank.setWind('mum',5);__prank.setWind('gramps',3);__prank.setWind('kid',0);
      __prank.stepBy(180*60-2);const before=__prank.state().folk.map(f=>({id:f.id,wind:f.wind,hits:f.hits}));__prank.stepBy(60);const ph=__prank.phase;
      const after=__prank.state().folk.map(f=>f.wind);__prank.next();const day2=__prank.state().folk.map(f=>({wind:f.wind,out:f.out,x:f.x}));
      return{before,after,ph,day2,moods:__prank.state().moods[0]}});
    const want=m.before.map(f=>Math.max(0,f.wind-1-(f.hits?0:1)));
    ok('moods: overnight each resident cools by 1, or 2 if left alone',m.ph==='dayend'&&want.every((w,i)=>Math.abs(w-m.after[i])<1e-9),JSON.stringify({before:m.before,after:m.after}));
    ok('moods: the mood carries into the next day',m.day2.every((d,i)=>Math.abs(d.wind-m.after[i])<1e-9)&&m.after.some(w=>w>0),JSON.stringify(m.day2));
    ok('moods: the day-end record names each mood change',m.moods&&m.moods.length===3&&m.moods.every(x=>x.name&&x.from!=null&&x.to!=null),JSON.stringify(m.moods));
    ok('moods: nobody is still out in the park at the start of a day',m.day2.every(d=>!d.out&&d.x<24),JSON.stringify(m.day2));
    const so=await p.evaluate(()=>{__prank.start({seed:5,bot:true});for(const id of['gramps','mum','kid'])__prank.setWind(id,3.5);
      let t=0;for(;t<6000;t+=10){__prank.stepBy(10);if(__prank.state().folk.some(f=>f.out&&f.x>24))break}
      const st=__prank.state();return{t,stormed:st.stats.stormed,out:st.folk.filter(f=>f.out).map(f=>f.id+'@'+f.x.toFixed(1))}});
    ok('moods: a Grumpy resident storms out past the house wall',so.out.length>0&&so.stormed>0,JSON.stringify(so));
    ok('moods: no console errors',!errs.length,errs.join(' | '));await ctx.close()}
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    const e=await p.evaluate(()=>{const id='kid',go=w=>{__prank.start({seed:3,bot:false});__prank.setWind(id,w)};go(0);
      let near=null,soft=null;const n=__prank.dial(id,0,1).n;
      for(let pi=0;pi<n;pi++)for(const lv of[1,2,3]){const d=__prank.dial(id,pi,lv),q=d.V/d.L;if(!near&&q>.82&&q<=.97)near={pi,lv};if(!soft&&q>.2&&q<.7)soft={pi,lv}}
      const out={near,soft};
      if(near){go(0);out.calm=__prank.land(id,near.pi,near.lv);go(7);out.fuming=__prank.land(id,near.pi,near.lv)}
      if(soft){go(0);out.cheeryPts=__prank.land(id,soft.pi,soft.lv);go(4.5);out.grumpyPts=__prank.land(id,soft.pi,soft.lv)}
      return out});
    ok('moods: a prank that is a laugh on a cheery resident goes past the line of a fuming one',e.near&&e.calm.kind==='laugh'&&e.fuming.kind!=='laugh',JSON.stringify(e));
    ok('moods: the same safe prank pays more on a grumpy resident',e.soft&&e.cheeryPts.kind==='laugh'&&e.grumpyPts.kind==='laugh'&&e.grumpyPts.pts>=1.3*e.cheeryPts.pts,JSON.stringify(e));
    ok('moods: no console errors (dial)',!errs.length,errs.join(' | '));await ctx.close()}
  for(const [label,opt] of [['desktop mouse',{viewport:{width:1280,height:720}}],['portrait touch',{viewport:{width:390,height:844},hasTouch:true,isMobile:true}],['landscape touch',{viewport:{width:844,height:390},hasTouch:true,isMobile:true}]]){
    const {p,ctx,errs}=await page(b,opt);const rows=[];let landed=false,onScreen=true,cued=false;
    for(const seed of[5,6,7,8]){
      const set=await p.evaluate(seed=>{__prank.start({seed,bot:true});for(const id of['gramps','mum','kid'])__prank.setWind(id,3.5);
        for(let t=0;t<6000;t+=10){__prank.stepBy(10);if(__prank.state().folk.some(f=>f.out&&f.x>24&&f.state==='walk'))break}
        __prank.bot(false);const st=__prank.state(),r=st.folk.find(f=>f.out);if(!r)return null;
        const plan=__prank.folkPlan(r.id),spot=plan.slice(1).find(id=>['bench','bin','swing'].includes(id));return{id:r.id,spot,park:st.stats.park}},seed);
      if(!set||!set.spot){rows.push(seed+':nobody out');continue}
      await p.evaluate(()=>__prank.stepBy(40));await wait(p,80);
      const tapAt=async(x,y)=>{if(opt.hasTouch)await p.touchscreen.tap(x,y);else await p.mouse.click(x,y)};
      const where=()=>p.evaluate(id=>{const c=document.querySelector('#cv').getBoundingClientRect(),q=__prank.spotScreen(id);return{...q,in:q.x>=c.left+20&&q.x<=c.right-20&&q.y>=c.top&&q.y<=c.bottom}},set.spot);
      let sc=await where();
      // a person heads that way: the edge marker if the resident is out of view, else a tap at the edge of the garden
      for(let tries=0;tries<6&&!sc.in;tries++){const cue=(await p.evaluate(()=>__prank.cues())).find(c=>c.id===set.id);
        if(cue){cued=true;await tapAt(cue.x,cue.y)}else{const c=await p.evaluate(()=>{const r=document.querySelector('#cv').getBoundingClientRect();return{l:r.left,r:r.right}});await tapAt(sc.x>c.r?c.r-30:c.l+30,sc.y-8)}
        for(let i=0;i<12&&!(sc=await where()).in;i++){await p.evaluate(()=>__prank.stepBy(15));await wait(p,30)}}
      if(!sc.in){onScreen=false;rows.push(seed+':'+set.spot+' still off screen');continue}
      if(opt.hasTouch)await p.touchscreen.tap(sc.x,sc.y-8);else await p.mouse.click(sc.x,sc.y-8);
      for(let i=0;i<60&&!(await p.evaluate(()=>__prank.state().picker));i++){await p.evaluate(()=>__prank.stepBy(10))}
      const pk=await p.evaluate(()=>{const b=[...document.querySelectorAll('#pkBtns button')].find(b=>/^p\d/.test(b.dataset.o)&&b.getAttribute('aria-disabled')!=='true');return b?b.dataset.o:null});
      if(!pk){rows.push(seed+':'+set.spot+' no prank to set');continue}
      if(opt.hasTouch){const bx=await p.evaluate(o=>{const r=document.querySelector(`#pkBtns button[data-o="${o}"]`).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}},pk);await p.touchscreen.tap(bx.x,bx.y)}
      else await p.click(`#pkBtns button[data-o="${pk}"]`);
      const res=await p.evaluate(([park0,id])=>{for(let i=0;i<60*45;i+=30){__prank.stepBy(30);const st=__prank.state();
          if(st.stats.park>park0)return{landed:true,px:st.player.x};if(__prank.phase!=='play')break}
        const st=__prank.state();return{landed:false,px:st.player.x,stats:st.stats,folk:st.folk.find(f=>f.id===id)}},[set.park,set.id]);
      rows.push(`${seed}:${set.id}@${set.spot} ${res.landed?'landed':'no '+JSON.stringify(res)}`);
      if(res.landed){landed=true;break}}
    console.log(`     park (${label}): `+rows.join(' | '));
    ok(`park (${label}): heading toward the park brings the spot a resident goes to on screen`,onScreen,rows.join(' | '));
    if(label==='portrait touch')ok('park (portrait touch): the edge marker was used to follow',cued,rows.join(' | '));
    ok(`park (${label}): follow by tapping, set a prank, and it lands in the park`,landed,rows.join(' | '));
    ok(`park (${label}): no console errors`,!errs.length,errs.join(' | '));await ctx.close()}

  await b.close();console.log(fails?`${fails} FAILED`:'ALL PASSED');process.exit(fails?1:0)})();
