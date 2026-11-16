const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const desktop=!!process.env.BOOK_QA_EXE,fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),profile=desktop?await fs.mkdtemp(path.join(os.tmpdir(),'book-reversal-profile-')):null;
 const browser=desktop?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true}),page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}});
 if(desktop)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});
 try{if(!desktop)await page.goto('http://127.0.0.1:4174');await page.waitForFunction(()=>loaded);
 const result=await page.evaluate(()=>{
  openSavedBook('starter-keeper');bookShelfMode=false;bookTableMode=false;closedEdge=null;const results=[];
  for(const side of [1,-1])for(const v of [.1,.22,.5,.9]){
   spread=5;motion=null;drag=null;const chain=resting(side,side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1)),pointer=project(sampleChain(chain,.9),v);
   begin(side,true);motion.grab={u:.9,v,direction:side,release:1};drag={x:pointer.x,y:pointer.y,direction:side,moved:true};
   let last=null,maxStep=0,maxError=0,maxV=0,maxHysteresis=0,maxOffPage=0;const seen=new Map();
   const path=[...Array.from({length:57},(_,i)=>i*10),...Array.from({length:49},(_,i)=>560-i*10),...Array.from({length:33},(_,i)=>80+i*10)];
   for(const distance of path){const target={x:pointer.x-side*distance,y:pointer.y+(v>.6?-1:v<.4?1:0)*Math.sin(distance/120)*12};updateManualPageTurn(target);const c=turnChain(side,motion.progress),points=[.25,.5,.75,1].map(u=>project(sampleChain(c,u),.5));
    if(last)maxStep=Math.max(maxStep,...points.map((q,i)=>Math.hypot(q.x-last[i].x,q.y-last[i].y)));if(motion.progress>.001&&motion.progress<.999)maxError=Math.max(maxError,Math.abs(project(sampleChain(c,.9),v).x-target.x));if(seen.has(distance))maxHysteresis=Math.max(maxHysteresis,...points.map((q,i)=>Math.hypot(q.x-seen.get(distance)[i].x,q.y-seen.get(distance)[i].y)));seen.set(distance,points);last=points;
    for(const u of [.25,.5,.75,1])for(let j=0;j<12;j++){const a=sheetSample(c[0].sheet,u,j/12),b=sheetSample(c[0].sheet,u,(j+1)/12);maxV=Math.max(maxV,Math.abs(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/(TURN_HEIGHT/12)-1));}
    for(let u=0;u<=1;u+=.1)for(let v=0;v<=1;v+=.1){const q=project(sheetSample(c[0].sheet,u,v),v);maxOffPage=Math.max(maxOffPage,TOP-q.y,q.y-BOTTOM,0);}
   }
   results.push({side,v,maxStep,maxError,maxV,maxHysteresis,maxOffPage,pointerStep:10,poses:path.length});motion=null;drag=null;
  }return results;
 });console.log(JSON.stringify(result));assert.ok(result.every(r=>r.maxStep<65&&r.maxError<1&&r.maxV<.03&&r.maxHysteresis<1&&r.maxOffPage<110),'Reversal continuity, grip, bounds or material error');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
