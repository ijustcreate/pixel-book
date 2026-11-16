const {chromium,_electron}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const desktop=process.env.BOOK_QA_EXE;
 const browser=desktop?await _electron.launch({executablePath:desktop,args:['--user-data-dir='+require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'book-safe-sheet-'))]}):await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}});
  if(desktop)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});
  else await page.goto('http://127.0.0.1:4174/');
  await page.waitForFunction(()=>loaded);
  const result=await page.evaluate(()=>{
   openSavedBook('starter-keeper');bookShelfMode=false;bookTableMode=false;spread=5;
   let poses=0,minAdvance=Infinity,maxRowError=0,maxGripXError=0,maxReleaseJump=0;
   // Independently verify the separating coordinate over the full rendered
   // domain, including between renderer vertices. Distinct rows have distinct
   // y; within a row the axis coordinate must strictly increase.
   for(const direction of [1,-1])for(let n=1;n<100;n++){
    const progress=n/100;motion={direction,progress};const sheet=turnChain(direction,progress)[0].sheet;
    const ax=Math.cos(Math.PI*progress)*direction,az=Math.sin(Math.PI*progress);
    for(let row=0;row<=48;row++){
     const v=row/48;let last=sheet.evaluate(0,v);
     for(let col=1;col<=288;col++){
      const p=sheet.evaluate(col/288,v);
      minAdvance=Math.min(minAdvance,(p.x-last.x)*ax+(p.z-last.z)*az);
      maxRowError=Math.max(maxRowError,Math.abs(p.y-v*TURN_HEIGHT));last=p;
     }
    }poses++;
   }
   for(const direction of [1,-1])for(const u of [.25,.55,.9,.998])for(const v of [.02,.5,.98]){
    motion={direction,progress:0,grab:{direction,u,v,release:1}};
    const origin=project(sampleChain(turnChain(direction,0),u),v);
    for(const pull of [40,100,180,100,40,220]){
     const pointer={x:origin.x-direction*pull,y:origin.y+(v-.5)*160};updateManualPageTurn(pointer);
     const held=turnChain(direction,motion.progress)[0].sheet;
     const q=project(sampleChain(turnChain(direction,motion.progress),u),v);
     if(motion.progress>.001&&motion.progress<.999)maxGripXError=Math.max(maxGripXError,Math.abs(q.x-pointer.x));
     // Releasing must preserve the exact geometry at identical progress.
     motion.grab.release=.5;const released=turnChain(direction,motion.progress)[0].sheet;
     for(let i=0;i<=32;i++){
      const a=held.evaluate(i/32,v),b=released.evaluate(i/32,v);
      maxReleaseJump=Math.max(maxReleaseJump,Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z));
     }motion.grab.release=1;
    }
   }
   motion={direction:1,progress:.5};draw();
   return{poses,minAdvance,maxRowError,maxGripXError,maxReleaseJump};
  });
  assert.ok(result.minAdvance>0,'Material doubles back along its separating axis');
  assert.equal(result.maxRowError,0,'Material rows can collide');
  assert.ok(result.maxGripXError<.1,'Horizontal grip tracking failed');
  assert.equal(result.maxReleaseJump,0,'Release changes geometry');
  require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'book-safe-turn.png'),Buffer.from(await page.evaluate(()=>canvas.toDataURL('image/png').split(',')[1]),'base64'));
  const settling=await page.evaluate(()=>{
   const native=requestAnimationFrame,queue=[];requestAnimationFrame=cb=>{queue.push(cb);return queue.length;};
   const out=[];
   try{for(const direction of [1,-1])for(const commit of [false,true]){
    spread=5;motion={direction,progress:.45,grab:{u:.9,v:.1,direction,release:1,hand:{x:600,y:180}}};
    settle(commit,520);let time=0,frames=0,minAdvance=Infinity;
    while(motion){const cb=queue.shift();if(!cb||++frames>100)throw Error('Landing stalled');cb(time+=16.667);
     if(motion){const sheet=turnChain(direction,motion.progress)[0].sheet,p=motion.progress;
      for(let v of [0,.5,1])for(let i=0;i<96;i++){
       const a=sheet.evaluate(i/96,v),b=sheet.evaluate((i+1)/96,v);
       minAdvance=Math.min(minAdvance,(b.x-a.x)*direction*Math.cos(Math.PI*p)+(b.z-a.z)*Math.sin(Math.PI*p));
      }
     }
    }out.push({direction,commit,frames,minAdvance,spread});
   }}finally{requestAnimationFrame=native;motion=null;}return out;
  });
  for(const r of settling){assert.ok(r.minAdvance>0);assert.equal(r.spread,5+(r.commit?r.direction:0));}
  console.log(JSON.stringify({ ...result,settling }));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
