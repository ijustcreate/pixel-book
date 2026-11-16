const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const output=path.join(require('node:os').tmpdir(),'book-natural-turn-qa');await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1180,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded);
 await page.evaluate(()=>{openSavedBook('starter-inferno-dore');bookShelfMode=false;bookTableMode=false;closedEdge=null;spread=7;motion=null;drag=null;updateControls();draw();});
 const results=[];
 for(const side of [1,-1])for(const v of [.08,.5,.92]){
  const r=await page.evaluate(({side,v})=>{
   motion=null;drag=null;spread=7;begin(side,true);
   const q=project(sampleChain(turnChain(side,0),.90),v);
   const g={...pageGrabCoordinates(q,side),direction:side,release:1};motion.grab=g;drag={x:q.x,y:q.y,direction:side,moved:true};
   const pointer={x:q.x-side*160,y:q.y+(v<.5?25:-25)};updateManualPageTurn(pointer);
   const start=performance.now(),chain=turnChain(side,motion.progress),cost=performance.now()-start,held=project(sampleChain(chain,g.u),g.v),grid=chain[0].sheet.grid;
   let maxStrain=0,sum=0,count=0;
   for(let r=0;r<grid.length;r++)for(let i=0;i<SEGMENTS;i++){
    // Measure material arc length, not the chord across a curved fold.
    const sheet=chain[0].sheet,v=r/(grid.length-1);let length=0,last=sheetSample(sheet,i/SEGMENTS,v);
    for(let n=1;n<=32;n++){const next=sheetSample(sheet,(i+n/32)/SEGMENTS,v);length+=Math.hypot(next.x-last.x,next.y-last.y,next.z-last.z);last=next;}
    const strain=Math.abs(length/sheet.lengths[i]-1);maxStrain=Math.max(maxStrain,strain);sum+=strain;count++;
   }
   draw();return{side,v,p:motion.progress,error:Math.abs(held.x-pointer.x),verticalResistance:Math.abs(held.y-pointer.y),maxStrain,meanStrain:sum/count,cost,hinge:grid.every(row=>row[0].x===0)};
  },{side,v});results.push(r);
  await page.locator('#book').screenshot({path:path.join(output,`drag-${side}-${v}.png`)});
 }
 const endpoints=await page.evaluate(()=>{
  motion=null;drag=null;const out=[];
  for(const direction of [1,-1])for(const progress of [0,1]){
   motion={direction,progress};const chain=turnChain(direction,progress),amount=direction<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1),to=spread+direction,targetAmount=direction>0?to/(spreadCount()-1):1-to/(spreadCount()-1),expected=resting(progress===0?direction:-direction,progress===0?amount:targetAmount);
   out.push(Math.max(...chain.map((p,i)=>Math.hypot(p.x-expected[i].x,p.z-expected[i].z))));
  }motion=null;return out;
 });
 for(const p of [.12,.3,.5,.72,.9]){await page.evaluate(p=>{motion={direction:1,progress:p};draw();},p);await page.locator('#book').screenshot({path:path.join(output,`auto-${p}.png`)});}
 const release=await page.evaluate(()=>{
  motion=null;drag=null;queuedTurns=[];const native=requestAnimationFrame,queue=[];
  requestAnimationFrame=cb=>{queue.push(cb);return queue.length;};
    const out=[];
  try{
   for(const commit of [false,true]){
     spread=7;motion={direction:1,progress:.52,grab:{u:.9,v:.1,direction:1,tilt:-.12,radius:40,release:1,hand:{x:650,y:260}}};
     settle(commit,520);let time=1000,frames=0,last=null,maxStep=0;const releaseWeights=[];
    while(motion){
     const cb=queue.shift();if(!cb||++frames>80)throw Error('Release did not complete');cb(time+=16.667);
      if(motion){const chain=turnChain(1,motion.progress),q=project(sampleChain(chain,.9),.1);if(last)maxStep=Math.max(maxStep,Math.hypot(q.x-last.x,q.y-last.y));last=q;releaseWeights.push(chain[0].sheet.releaseWeight??1);}
    }
     out.push({commit,frames,spread,maxStep,releaseWeights});
   }
  }finally{requestAnimationFrame=native;}
  return out;
 });
 const performanceResult=await page.evaluate(()=>{
  const times=[];motion=null;drag=null;
  for(let i=0;i<28;i++){motion={direction:1,progress:.02+i*.035};const t=performance.now();draw();times.push(performance.now()-t);}
  motion=null;draw();const sorted=times.slice(4).sort((a,b)=>a-b);
  return{medianDrawMs:sorted[Math.floor(sorted.length/2)],p95DrawMs:sorted[Math.floor(sorted.length*.95)]};
 });
 assert.equal(release[0].spread,7);assert.equal(release[1].spread,8);
 const result={results,endpoints,release,performanceResult,errors,output};await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 assert.deepEqual(errors,[]);assert.ok(endpoints.every(e=>e<.001),'Endpoint mismatch');assert.ok(results.every(r=>r.error<2&&r.hinge),'Grip or hinge drift');assert.ok(results.every(r=>r.meanStrain<.01&&r.maxStrain<.02),'Paper stretches');
 assert.ok(release.every(r=>r.releaseWeights.length>4&&r.releaseWeights.at(-1)<.05&&r.releaseWeights.every((w,i,a)=>!i||w<=a[i-1]+1e-6)),'Held page did not hand off smoothly to the free landing curve');
 assert.ok(release.every(r=>r.maxStep<50),'Manual release advanced too far in a single frame');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
