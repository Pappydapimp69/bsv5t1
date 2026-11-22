// Gotcha! browser checks. Run: node tests/run.js  (prints PASS/FAIL lines, exits 1 on any FAIL)
// Everything goes through the page's own UI plus the window.__prank test hook (see the spec's "Test hook" section).
const {chromium}=require('playwright');const path=require('path');
const URL='file://'+path.resolve(__dirname,'../index.html');
let fails=0;const ok=(name,cond,why='')=>{console.log((cond?'PASS ':'FAIL ')+name+(cond?'':'  '+why));if(!cond)fails++};
const wait=(p,ms)=>p.waitForTimeout(ms);
const J=x=>JSON.stringify(x);

async function page(b,opt){const ctx=await b.newContext(opt);const p=await ctx.newPage();const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  // tutorial off and sound off for every run; state may be a getter or a function, __st() reads either
  await p.addInitScript(()=>{try{localStorage.setItem('prank.settings',JSON.stringify({sound:false,volume:2,motion:'system',tutorialDone:true}))}catch(e){}
    window.__st=()=>{const s=window.__prank.state;return typeof s==='function'?s():s}});
  if(opt.pad)await p.addInitScript(()=>{const btn=()=>({pressed:false,touched:false,value:0});
    window.__pad={connected:true,index:0,id:'fake pad',mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},btn),vibrationActuator:null};
    navigator.getGamepads=()=>[window.__pad.connected?window.__pad:null,null,null,null]});
  await p.goto(URL);await wait(p,300);return {p,ctx,errs}}

const ph=p=>p.evaluate(()=>__prank.phase);
// move to a phase through the hook alone; falls back to clicking a continue-style button if the hook call does not move on
const CONT=/^(continue|next|done|ready|to the dare|to dares|rig|start rigging|confirm|go)\b/i;
async function toPhase(p,target,max=14){
  for(let i=0;i<max;i++){const cur=await ph(p);if(cur===target)return true;
    await p.evaluate(()=>{const P=__prank;switch(P.phase){case'shop':P.pickSet(0);P.dare(-1);break;case'dare':P.dare(-1);break;case'rig':P.open();break;case'live':P.fastForward();break;case'wrap':P.next();break}});
    if((await ph(p))===cur)await p.evaluate(re=>{const b=[...document.querySelectorAll('button')].find(b=>b.offsetParent!==null&&b.getAttribute('aria-disabled')!=='true'&&new RegExp(re,'i').test(b.textContent.trim()));if(b)b.click()},CONT.source);
    await wait(p,30)}
  return (await ph(p))===target}

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
    return{bad,scroll,over,vw:v.width/vw,nbtn:[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null).length}});
  ok(`${label}: controls on screen and >=44px`,!r.bad.length&&r.nbtn>0,r.bad.join(', ')||'no visible controls');
  ok(`${label}: no page scroll`,!r.scroll);ok(`${label}: no panel over the game view`,!r.over.length,r.over.join(','));return r}

async function screens(p,label){
  const out={};
  await p.reload();await wait(p,300);out.title=await layout(p,label+' title');
  await p.evaluate(()=>__prank.start(2));await wait(p,60);await layout(p,label+' shop');
  await p.evaluate(()=>__prank.buy('cushion'));await wait(p,30);
  await p.evaluate(()=>{__prank.pickSet(0)});await wait(p,60);
  if(await toPhase(p,'dare')){await layout(p,label+' dare')}else ok(label+' dare screen reached',false,await ph(p));
  if(await toPhase(p,'rig')){await wait(p,60);out.rig=await layout(p,label+' rig')}else ok(label+' rig screen reached',false,await ph(p));
  await p.evaluate(()=>__prank.open());await p.evaluate(()=>__prank.stepBy(20));await wait(p,60);
  if((await ph(p))==='live')out.live=await layout(p,label+' live');else ok(label+' live screen reached',false,await ph(p));
  await p.evaluate(()=>document.getElementById('pauseB').click());await wait(p,60);
  ok(label+': pause button pauses',(await ph(p))==='pause');await layout(p,label+' pause');
  await p.evaluate(()=>document.getElementById('bSet').click());await wait(p,60);ok(label+': settings reached',(await ph(p))==='settings');await layout(p,label+' settings');
  await p.evaluate(()=>document.getElementById('bBack').click());await wait(p,60);
  await p.evaluate(()=>{const b=document.getElementById('bResume');if(b)b.click()});await wait(p,60);
  await p.evaluate(()=>__prank.fastForward());await wait(p,80);
  if((await ph(p))==='wrap')await layout(p,label+' wrap');else ok(label+' wrap screen reached',false,await ph(p));
  return out}

// ---- input helpers shared by the touch, pad and keyboard runs ----
// find a visible enabled button whose text matches, tag it, return its centre
const find=(p,re)=>p.evaluate(src=>{document.querySelectorAll('[data-tt]').forEach(e=>e.removeAttribute('data-tt'));
  const b=[...document.querySelectorAll('button')].find(b=>b.offsetParent!==null&&b.getAttribute('aria-disabled')!=='true'&&new RegExp(src,'i').test(b.textContent.trim()));
  if(!b)return null;b.setAttribute('data-tt','1');const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}},re.source);
const focusText=p=>p.evaluate(()=>document.activeElement?document.activeElement.textContent.trim():'');
const touchTap=async(p,re)=>{const c=await find(p,re);if(!c)return false;await p.touchscreen.tap(c.x,c.y);await wait(p,150);return true};
const padTapper=p=>async(i,ms=90)=>{await p.evaluate(i=>{__pad.buttons[i].pressed=true;__pad.buttons[i].value=1},i);await wait(p,ms);await p.evaluate(i=>{__pad.buttons[i].pressed=false;__pad.buttons[i].value=0},i);await wait(p,90)};
const PAD={A:0,B:1,START:9,UP:12,DOWN:13};
// move focus with the D-pad or arrow keys until it sits on a button whose text matches, then confirm
async function navTo(p,re,next,prev,confirm){if(!(await find(p,re)))return false;
  for(const step of[next,prev])for(let i=0;i<16;i++){if(re.test(await focusText(p))){await confirm();await wait(p,150);return true}await step()}
  return re.test(await focusText(p))?(await confirm(),await wait(p,150),true):false}

// drive the whole episode loop with one device: title -> shop (buy) -> set -> dare -> rig -> Doors open -> live (hook) -> wrap -> next shop
async function drive(p,act,label,visited){
  const SET=/caf[eé]|corner|office|launderette|hotel|gym/i,DARE=/dare|get 3|reveal|steer|never|land|air a|^no dare|skip/i;
  const rec=async()=>{const c=await ph(p);visited.add(c);return c};
  ok(`${label}: Play starts a career`,await act(/^play$|^new|^start/i)&&['shop','dare','rig'].includes(await rec()),await ph(p));
  if((await ph(p))==='shop'){ok(`${label}: buy a gag from the shop`,await(async()=>{const before=await p.evaluate(()=>__prank.career().budget);const hit=await act(/cushion|bucket|spider|peel|popper/i);
      const after=await p.evaluate(()=>__prank.career().budget);return hit&&after<before})(),'budget did not drop');
    await act(SET);await act(CONT);await rec()}
  for(let i=0;i<4&&(await ph(p))==='dare';i++){await act(DARE);await rec();if((await ph(p))==='dare')await act(CONT)}
  await rec();
  ok(`${label}: Doors open starts the live episode`,(await ph(p))==='rig'&&await act(/doors open/i)&&await(async()=>{await wait(p,100);return(await rec())==='live'})(),await ph(p));
  await p.evaluate(()=>__prank.stepBy(40));await p.evaluate(()=>__prank.fastForward());await wait(p,100);
  ok(`${label}: live runs out to the wrap screen`,(await rec())==='wrap',await ph(p));
  ok(`${label}: wrap goes on to the next episode's shop`,await act(/next|continue/i)&&await p.evaluate(()=>__prank.phase==='shop'&&__prank.career().episode>=1),await ph(p))}

(async()=>{const b=await chromium.launch();
  // 1. layouts: eight screens at three sizes
  for(const [w,h,touch] of [[390,844,true],[844,390,true],[1280,720,false]]){
    const {p,ctx,errs}=await page(b,{viewport:{width:w,height:h},hasTouch:touch,isMobile:touch});
    const sc=await screens(p,`${w}x${h}`);
    if(w>h&&h<500&&sc.live)ok(`${w}x${h}: game view at least 40% of the width`,sc.live.vw>=0.4,String(sc.live.vw));
    ok(`${w}x${h}: no console errors`,!errs.length,errs.slice(0,3).join(' | '));await ctx.close()}

  // 2. touch only: Play, buy, set and dare by tap, place by tapping the set, Doors open, live by the hook, wrap by tap to the next shop
  {const {p,ctx,errs}=await page(b,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const act=re=>touchTap(p,re);const seen=new Set();
    ok('touch: Play starts a career',await act(/^play$|^new|^start/i)&&(await ph(p))==='shop',await ph(p));seen.add('shop');
    const b0=await p.evaluate(()=>__prank.career().budget);
    ok('touch: a gag bought by tap',await act(/cushion/i)&&(await p.evaluate(()=>__prank.career().budget))<b0,'budget did not drop');
    await act(/caf[eé]|corner|office|launderette|hotel|gym/i);await act(CONT);
    for(let i=0;i<4&&(await ph(p))==='shop';i++){await act(CONT);await wait(p,50)}
    let c=await ph(p);ok('touch: set chosen, on to the dare pick',c==='dare'||c==='rig',c);
    if(c==='dare'){ok('touch: a dare taken by tap',await act(/dare|get 3|reveal|steer|never|land|air a/i)||await act(/skip|no dare|none/i),'no dare button');
      for(let i=0;i<3&&(await ph(p))==='dare';i++)await act(CONT)}
    ok('touch: rigging reached',(await ph(p))==='rig',await ph(p));seen.add('rig');
    // find a seat spot in the raw state, tap it on screen, then tap a picker button
    const spot=await p.evaluate(()=>{const seen=new Set(),found=[];(function walk(o,d){if(!o||typeof o!=='object'||seen.has(o)||d>7)return;seen.add(o);
        if(typeof o.id==='string'&&o.kind==='seat')found.push(o.id);for(const k in o)walk(o[k],d+1)})(__st(),0);return found[0]||null});
    ok('touch: the set has a seat spot to rig',!!spot,'no spot with kind seat found in state');
    const gb=await p.evaluate(()=>__prank.career().gags.cushion);
    if(spot){const at=await p.evaluate(s=>__prank.spotScreen(s),spot);await p.touchscreen.tap(at.x,at.y);
      for(let i=0;i<30&&!(await p.evaluate(()=>{const e=document.getElementById('pkBtns');return e&&e.offsetParent!==null&&e.querySelector('button')}));i++){await p.evaluate(()=>__prank.stepBy(1));await wait(p,30)}
      const opened=await p.evaluate(()=>{const e=document.getElementById('pkBtns');return !!(e&&e.offsetParent!==null&&e.querySelector('button'))});
      ok('touch: tapping the spot opens the picker',opened);
      if(opened){await layout(p,'touch picker');const pb=await find(p,/cushion/i)||await p.evaluate(()=>{const b=document.querySelector('#pkBtns button:not([aria-disabled="true"])');if(!b)return null;const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
        if(pb)await p.touchscreen.tap(pb.x,pb.y);await wait(p,150);
        ok('touch: a gag placed from the picker',(await p.evaluate(()=>__prank.career().gags.cushion))<gb&&!(await p.evaluate(()=>{const e=document.getElementById('pkBtns');return e&&e.offsetParent!==null})),'gag count did not drop or picker stayed')}}
    ok('touch: Doors open by tap',await act(/doors open/i)&&(await ph(p))==='live',await ph(p));seen.add('live');
    for(let i=0;i<6;i++){await p.evaluate(()=>__prank.stepBy(8));await wait(p,20)}
    ok('touch: live is running',(await ph(p))==='live'&&(await p.evaluate(()=>__prank.marks().length))>0);
    await p.evaluate(()=>__prank.fastForward());await wait(p,100);
    ok('touch: live ends on the wrap screen',(await ph(p))==='wrap',await ph(p));
    ok('touch: wrap names the result',/viewers|aired|budget/i.test(await p.textContent('#ov')));
    ok('touch: wrap to the next shop by tap',await act(/next|continue/i)&&await p.evaluate(()=>__prank.phase==='shop'&&__prank.career().episode===1),await ph(p));
    ok('touch: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 3. pad only
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720},pad:true});
    const tap=padTapper(p);const visited=new Set();
    await p.evaluate(()=>dispatchEvent(Object.assign(new Event('gamepadconnected'),{gamepad:__pad})));
    const act=re=>navTo(p,re,()=>tap(PAD.DOWN),()=>tap(PAD.UP),()=>tap(PAD.A));
    await tap(PAD.DOWN);ok('pad: D-pad moves menu focus on the title',/\S/.test(await focusText(p)),await focusText(p));
    await tap(PAD.UP);
    ok('pad: hints name pad buttons',/left stick|\bA\b|Start/.test(await p.textContent('#ov')+await p.textContent('#ctlHint')));
    await drive(p,act,'pad',visited);
    ok('pad: every phase was reached with the pad',['shop','dare','rig','live','wrap'].every(x=>visited.has(x)),[...visited].join(','));
    // pause with Start during live, resume, then unplug
    await p.evaluate(()=>{const P=__prank;P.pickSet(0);P.dare(-1);P.open()});await wait(p,100);
    if((await ph(p))==='live'){await tap(PAD.START);ok('pad: Start pauses',(await ph(p))==='pause',await ph(p));
      ok('pad: A on Resume resumes',await act(/resume/i)&&(await ph(p))==='live',await ph(p))}
    else ok('pad: live reached for pause',false,await ph(p));
    await p.evaluate(()=>{__pad.connected=false;dispatchEvent(Object.assign(new Event('gamepaddisconnected'),{gamepad:__pad}))});await wait(p,150);
    ok('pad: unplugging pauses',(await ph(p))==='pause',await ph(p));
    ok('pad: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 4. keyboard only
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});const visited=new Set();
    const key=k=>p.keyboard.press(k);
    ok('keys: hints name keys',/Enter|Space|\bD\b|\bE\b|arrow|→/i.test(await p.textContent('#ov')+await p.textContent('#ctlHint')));
    const act=re=>navTo(p,re,()=>key('ArrowDown'),()=>key('ArrowUp'),()=>key('Enter'));
    await drive(p,act,'keys',visited);
    ok('keys: every phase was reached with keys',['shop','dare','rig','live','wrap'].every(x=>visited.has(x)),[...visited].join(','));
    await p.evaluate(()=>{const P=__prank;P.pickSet(0);P.dare(-1);P.open()});await wait(p,100);
    if((await ph(p))==='live'){await key('Escape');ok('keys: Escape pauses',(await ph(p))==='pause',await ph(p));await key('Escape');ok('keys: Escape resumes',(await ph(p))==='live',await ph(p))}
    else ok('keys: live reached for pause',false,await ph(p));
    ok('keys: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 5. contrast of every visible text over its real (composited) background, on every screen
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
    await audit('title');
    await p.evaluate(()=>document.getElementById('bHow').click());await wait(p,100);await audit('how to play');
    await p.evaluate(()=>document.getElementById('bBack').click());await p.evaluate(()=>document.getElementById('bSet').click());await wait(p,100);await audit('settings');
    await p.evaluate(()=>__prank.start(4));await wait(p,80);await audit('shop');
    await p.evaluate(()=>{__prank.buy('cushion');__prank.pickSet(0)});await wait(p,80);
    if(await toPhase(p,'dare')){await wait(p,80);await audit('dare')}else ok('contrast dare: reached',false,await ph(p));
    if(await toPhase(p,'rig')){await wait(p,80);await audit('rig')}else ok('contrast rig: reached',false,await ph(p));
    await p.evaluate(()=>{__prank.open();__prank.stepBy(40)});await wait(p,80);await audit('live');
    await p.evaluate(()=>document.getElementById('pauseB').click());await wait(p,80);await audit('pause');
    await p.evaluate(()=>{const b=document.getElementById('bResume');if(b)b.click();__prank.fastForward()});await wait(p,100);await audit('wrap');
    await ctx.close()}

  // 6. tells are shown as text and shape on each mark's card, never colour alone
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    await p.evaluate(()=>{__prank.start(6);__prank.bot(true)});
    const TELL=[[0.6,/laughs it off/i],[0.9,/rattled/i],[1.0001,/on the edge/i],[1e9,/losing it/i]];
    const labelOf=r=>TELL.find(t=>r<t[0])[1];
    const seen=new Set(),bad=[];let sampled=0,states=new Set(),shape=false;
    for(let i=0;i<90;i++){await p.evaluate(()=>__prank.stepBy(1.5));await wait(p,40);
      const snap=await p.evaluate(()=>({marks:__prank.marks(),ph:__prank.phase}));
      if(snap.ph==='wrap'||snap.ph==='career')break;
      for(const m of snap.marks){states.add(m.state);if(m.state!=='onset'||m.line<=0)continue;
        const r=m.fluster/m.line;if(r>1.25)continue;const want=labelOf(r);sampled++;
        const info=await p.evaluate(([name,src])=>{const re=new RegExp(src,'i');
          const els=[...document.querySelectorAll('#app *')].filter(e=>e.offsetParent!==null&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.includes(name)));
          for(const e of els){let a=e;for(let k=0;k<5&&a;k++,a=a.parentElement)if(re.test(a.innerText||''))return{hit:true,shape:!!a.querySelector('svg,[class*=tell],[class*=shape],[data-tell]')||/[●◆▲■✕!?~]/.test(a.innerText||'')};}
          return{hit:false,card:els.length>0}},[m.name,want.source]);
        if(info.hit){seen.add(want.source);if(info.shape)shape=true}else if(info.card)bad.push(`${m.name} ${r.toFixed(2)} wants ${want.source}`)}}
    ok('tells: each visible mark card names its tell in text',sampled>0&&!bad.length,`sampled ${sampled}; ${bad.slice(0,3).join(' | ')}`);
    ok('tells: more than one tell state was shown during an episode',seen.size>=2,[...seen].join(','));
    ok('tells: a tell is also drawn as a shape or glyph, not colour alone',shape,'no svg/glyph/tell element found beside the tell text');
    ok('tells: mark states change as the episode runs',states.size>=2,[...states].join(','));
    ok('tells: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 7. effects through the hook
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    // shared setup in page: a set, one gag at a spot of a given kind, cameras mounted or not
    await p.evaluate(()=>{window.__spots=()=>{const seen=new Set(),found=[];(function walk(o,d){if(!o||typeof o!=='object'||seen.has(o)||d>7)return;seen.add(o);
        if(typeof o.id==='string'&&typeof o.kind==='string'&&['seat','door','floor','cupboard','counter'].includes(o.kind))found.push({id:o.id,kind:o.kind,room:o.room});
        for(const k in o)walk(o[k],d+1)})(__st(),0);return found};
      window.__mark=id=>{const seen=new Set();let hit=null;(function walk(o,d){if(hit||!o||typeof o!=='object'||seen.has(o)||d>7)return;seen.add(o);
        if(o.id===id&&typeof o.fluster==='number'&&typeof o.line==='number'){hit=o;return}for(const k in o)walk(o[k],d+1)})(__st(),0);return hit};
      window.__rig=(seed,withCam)=>{__prank.bot(false);__prank.start(seed);__prank.buy('cushion');__prank.buy('cushion');
        __prank.pickSet(0);__prank.dare(-1);const sp=__spots().find(s=>s.kind==='seat');
        const placed=sp?__prank.place(sp.id,'cushion'):false;let mounted=false;
        if(withCam&&sp){mounted=sp.room!=null?__prank.mount(sp.room):false;if(!mounted)for(let r=0;r<6&&!mounted;r++)mounted=__prank.mount(r)}
        return{spot:sp,placed,mounted,phase:__prank.phase}};
      // run live until some mark is on set; steer it to the spot; run until its fluster moves or the time runs out
      window.__land=(spot,limit)=>{__prank.open();let m=null;for(let t=0;t<limit;t+=0.5){__prank.stepBy(0.5);m=__prank.marks().find(x=>!x.star&&x.state==='onset');if(m)break}
        if(!m)return null;__prank.steer(m.id,spot.id);for(let t=0;t<60;t+=0.5){__prank.stepBy(0.5);const c=__prank.marks().find(x=>x.id===m.id);if(c.fluster>0||c.state!=='onset')return c.id}return m.id}});
    const prep=async(seed,cam)=>p.evaluate(([s,c])=>__rig(s,c),[seed,cam]);

    // a reveal at or under the line airs footage
    let r=await prep(3,true);ok('effects: a gag placed and a camera mounted in its room',r.placed&&r.mounted,J(r)+' '+await p.evaluate(()=>__prank.lastRefusal));
    let id=await p.evaluate(sp=>__land(sp,40),r.spot);ok('effects: a mark walked into the rigged gag',!!id);
    let e=await p.evaluate(id=>{const m=__prank.marks().find(x=>x.id===id);return m&&{footage:m.footage,fluster:m.fluster,line:m.line,state:m.state}},id);
    ok('effects: the gag on camera made footage',e&&e.footage>0,J(e));
    if(e&&e.footage>0&&e.fluster<=e.line&&e.state==='onset'){const rv=await p.evaluate(id=>{const ok=__prank.reveal(id);__prank.stepBy(3);const m=__prank.marks().find(x=>x.id===id);return{ok,aired:m.aired,state:m.state}},id);
      ok('effects: a reveal at or under the line airs footage (aired > 0)',rv.ok&&rv.aired>0,J(rv))}
    else ok('effects: a reveal at or under the line airs footage (aired > 0)',false,'mark not revealable after the gag: '+J(e));

    // pushed past 1.25 x line, a reveal is refused
    r=await prep(3,true);id=await p.evaluate(sp=>__land(sp,40),r.spot);
    const ref=await p.evaluate(id=>{const raw=__mark(id);if(!raw)return null;raw.fluster=raw.line*1.3;const res=__prank.reveal(id);const lr=__prank.lastRefusal;__prank.stepBy(3);const m=__prank.marks().find(x=>x.id===id);return{res,lr,aired:m.aired}},id);
    ok('effects: a reveal past 1.25 x line is refused and airs nothing',ref&&ref.res===false&&ref.aired===0,J(ref));
    ok('effects: the refusal names its cause on screen',ref&&/\S/.test(ref.lr||''),J(ref));

    // no camera in the room, no footage
    r=await prep(3,false);id=await p.evaluate(sp=>__land(sp,40),r.spot);
    const nc=await p.evaluate(id=>{const m=__prank.marks().find(x=>x.id===id);return m&&{footage:m.footage,fluster:m.fluster}},id);
    ok('effects: a gag with no camera in the room gives no footage',nc&&nc.fluster>0&&nc.footage===0,J(nc)+' '+J(r));

    // steer changes next
    const st=await p.evaluate(()=>{__rig(3,true);const sp=__spots();__prank.open();let m=null;for(let t=0;t<40&&!m;t+=0.5){__prank.stepBy(0.5);m=__prank.marks().find(x=>!x.star&&x.state==='onset')}
      if(!m)return null;const target=sp.find(s=>s.id!==m.next&&s.kind!=='door'||s.id!==m.next);const before=m.next;const res=__prank.steer(m.id,target.id);
      return{before,target:target.id,res,after:__prank.marks().find(x=>x.id===m.id).next,lr:__prank.lastRefusal}});
    ok('effects: steer(mark, spot) changes that mark\'s next stop',st&&st.res&&st.after===st.target&&st.after!==st.before,J(st));

    // the star persists across episodes with buy-in kept
    const sr=await p.evaluate(()=>{const r=__rig(5,true);const c0=__prank.career();const star0=__prank.marks().find(m=>m.star);
      const out={hasStar:!!star0,name:star0&&star0.name,careerStar:c0.star&&c0.star.name,placed:r.placed&&r.mounted};
      __prank.open();let s=null;for(let t=0;t<60&&!s;t+=0.5){__prank.stepBy(0.5);s=__prank.marks().find(m=>m.star&&m.state==='onset')}
      if(s){__prank.steer(s.id,r.spot.id);for(let t=0;t<60;t+=0.5){__prank.stepBy(0.5);if(__prank.career().star.buyIn>0)break}}
      out.buyIn1=__prank.career().star.buyIn;__prank.fastForward();let g=0;while(__prank.phase!=='wrap'&&g++<8)__prank.fastForward();
      __prank.next();__prank.pickSet(0);__prank.dare(-1);const c1=__prank.career();const star1=__prank.marks().find(m=>m.star);
      out.name1=star1&&star1.name;out.buyIn2=c1.star.buyIn;out.episode=c1.episode;out.blown=c1.star.blown;return out});
    ok('effects: the star appears with a name and in career()',sr.hasStar&&sr.name&&sr.careerStar===sr.name,J(sr));
    ok('effects: a gag on camera builds the star\'s buy-in',sr.buyIn1>0,J(sr));
    ok('effects: the same star returns next episode with buy-in kept',sr.name1===sr.name&&sr.episode===1&&sr.buyIn2>=sr.buyIn1&&sr.buyIn2>0,J(sr));

    // save, reload the page, load: career() round-trips
    const before=await p.evaluate(()=>{__prank.start(8);__prank.buy('bucket');__prank.pickSet(0);__prank.dare(-1);__prank.open();__prank.fastForward();__prank.next();__prank.save();return JSON.stringify(__prank.career())});
    await p.reload();await wait(p,300);
    const resume=await p.evaluate(()=>[...document.querySelectorAll('#ov button')].some(b=>/resume|continue/i.test(b.textContent)));
    ok('save: an unfinished career is offered as Resume after reload',resume);
    const after=await p.evaluate(()=>{__prank.load();return JSON.stringify(__prank.career())});
    ok('save: save() then reload then load() round-trips career()',before===after,before.slice(0,140)+' != '+after.slice(0,140));
    // a finished career is never offered as Resume
    const fin=await p.evaluate(()=>{__prank.bot(false);__prank.start(11);let g=0;
      while(!__prank.career().over&&g++<40){const ph=__prank.phase;if(ph==='shop'){__prank.pickSet(0);__prank.dare(-1)}else if(ph==='dare')__prank.dare(-1);else if(ph==='rig')__prank.open();else if(ph==='live')__prank.fastForward();else if(ph==='wrap')__prank.next();else break}
      __prank.save();return{over:__prank.career().over,phase:__prank.phase}});
    ok('save: an idle run reaches the end of the career',fin.over===true,J(fin));
    await p.reload();await wait(p,300);
    const resume2=await p.evaluate(()=>[...document.querySelectorAll('#ov button')].some(b=>/resume|continue/i.test(b.textContent)));
    ok('save: a saved finished career is not offered as Resume',!resume2);
    ok('effects: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  // 8. the player's choices decide the outcome (12 seeds), and determinism
  {const {p,ctx,errs}=await page(b,{viewport:{width:1280,height:720}});
    const r=await p.evaluate(()=>{const EPS=4;const sum=a=>a.reduce((x,y)=>x+y,0);let wins=0;const rows=[];
      for(let seed=1;seed<=12;seed++){
        __prank.bot(false);__prank.start(seed);__prank.bot(true);let g=0;
        while(__prank.career().viewers.length<EPS&&!__prank.career().over&&g++<900){__prank.stepBy(5);if(__prank.phase==='wrap')__prank.next()}
        const played=sum(__prank.career().viewers);
        __prank.bot(false);__prank.start(seed);let idle=0;
        for(let e=0;e<EPS;e++){let h=0;while(__prank.phase!=='wrap'&&h++<12){const ph=__prank.phase;if(ph==='shop'){__prank.pickSet(0);__prank.dare(-1)}else if(ph==='dare')__prank.dare(-1);else if(ph==='rig')__prank.open();else if(ph==='live')__prank.fastForward();else break}
          if(__prank.phase==='wrap'&&e<EPS-1)__prank.next();else if(__prank.career().over)break}
        idle=sum(__prank.career().viewers);
        const win=played>idle*1.5&&played-idle>=0.3;if(win)wins++;rows.push(`${seed}:${played.toFixed(1)}/${idle.toFixed(1)}`)}
      // a bot making random choices with the same budget must do clearly worse than the one that plays well
      let rwins=0;const rrows=[];
      for(let seed=1;seed<=12;seed++){const tot=mode=>{__prank.bot(false);__prank.start(seed);__prank.bot(mode);let g=0;
          while(__prank.career().viewers.length<EPS&&!__prank.career().over&&g++<900){__prank.stepBy(5);if(__prank.phase==='wrap')__prank.next()}
          return sum(__prank.career().viewers)};
        const good=tot(true),rnd=tot('random');if(good>rnd*1.3)rwins++;rrows.push(`${seed}:${good.toFixed(1)}/${rnd.toFixed(1)}`)}
      __prank.bot(false);
      // one gag never snaps a mark who was under their line, even with two people watching
      const cap=[];for(const kind of ['bucket','spider','cushion']){__prank.start(3);__prank.pickSet(0);__prank.dare(-1);__prank.open();
        const s=G.s,ms=s.marks.slice(0,3),sp=s.spots.find(q=>q.f===0&&PRANKABLE.includes(q.kind));
        for(const m of ms){m.state='onset';m.gone=false;m.climb=0;m.f=0;m.x=sp.x;m.mode='dwell'}
        const m=ms[0];m.fluster=0.9*m.line;m.hate=GAGS[kind].tag;sp.gag=kind;const on=onlookers(m);fireGag(m,sp);
        cap.push({kind,on,state:m.state,r:+(m.fluster/m.line).toFixed(2)})}
      const fp=s=>{__prank.bot(false);__prank.start(s);__prank.bot(true);__prank.stepBy(60);return __prank.fingerprint()};
      return{wins,rows,rwins,rrows,cap,f1:fp(9),f2:fp(9),f3:fp(10)}});
    console.log('     seeds bot/idle total viewers (M): '+r.rows.join(' '));
    ok(`choices decide: bot total viewers clearly above idle on ${r.wins}/12 seeds`,r.wins>=11);
    console.log('     seeds good/random-bot total viewers (M): '+r.rrows.join(' '));
    ok(`choices decide: good bot clearly above a random-choice bot on ${r.rwins}/12 seeds`,r.rwins>=10);
    for(const c of r.cap)ok(`cap: a ${c.kind} on a mark at 0.9 of their line with ${c.on} watching leaves them on set`,c.on>=2&&c.state==='onset'&&c.r<=1.25,JSON.stringify(c));
    ok('determinism: same seed same fingerprint',r.f1===r.f2,`${r.f1} ${r.f2}`);
    ok('determinism: another seed differs',r.f1!==r.f3);
    ok('sim: no console errors',!errs.length,errs.join(' | '));await ctx.close()}

  await b.close();console.log(fails?`${fails} FAILED`:'ALL PASSED');process.exit(fails?1:0)})();
