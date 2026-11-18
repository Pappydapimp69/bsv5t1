// Colossus land check: lays 40 seeds headless and fails if any seed is unfair after its retries.
// Run: node tests/land-fairness.js [seeds]   (needs Playwright's Chromium; runs offline, without Three.js)
const path=require('path'),{chromium}=require('playwright');
(async()=>{const n=+process.argv[2]||40,b=await chromium.launch(),p=await b.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/three.min.js',r=>r.abort());await p.goto('file://'+path.resolve(__dirname,'../index.html'));await p.waitForFunction(()=>window.__col);
  const rows=await p.evaluate(n=>{const out=[];for(let s=1;s<=n;s++){const S=__col.newGame('human',s);S.autoplay=true;__col.step(300);out.push({seed:s,ok:S.landCheck.ok,attempt:S.landCheck.attempt,why:S.landCheck.why,spread:S.landCheck.spread})}return out},n);
  const bad=rows.filter(r=>!r.ok),worst=k=>Math.max(...rows.map(r=>r.spread[k])).toFixed(2);
  console.log(`${rows.length} seeds, ${bad.length} unfair, ${rows.filter(r=>r.attempt>0).length} relaid; worst max/min spread: feet ${worst('foot')}, ruins ${worst('ruin')}, fields ${worst('field')}, dens ${worst('den')}, crystals ${worst('crystals')}`);
  for(const r of bad)console.log('seed',r.seed,r.why.join('; '));if(errs.length)console.log('page errors',errs);await b.close();process.exit(bad.length||errs.length?1:0)})();
