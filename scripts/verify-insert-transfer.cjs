const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
// Pixel visibility and persisted support are the contract. Draw-call counts
// cannot establish occlusion once the paper and card share a depth buffer.
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'book-insert-contact-')),desktop=!!process.env.BOOK_QA_EXE,profile=desktop?await fs.mkdtemp(path.join(os.tmpdir(),'book-insert-contact-profile-')):null;
 const browser=desktop?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
 const page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(desktop)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});
 try{
  if(!desktop)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded,null,{timeout:60000});
  const coverage=await page.evaluate(()=>{
   openSavedBook('starter-keeper');bookShelfMode=false;bookTableMode=false;closedEdge=null;coverMotion=null;
   for(const item of allInserts())Object.assign(itemMounts.get(item.sheet),{pageNumber:99999,outside:false,taped:false});
   const item=keepsakes[0],state=itemMounts.get(item.sheet),results=[];
   const pixels=()=>ctx.getImageData(0,0,canvas.width,canvas.height).data;
   for(const direction of [1,-1])for(const progress of [0,.01,.08,.2,.45,.7,1]){
    spread=5;const number=direction===1?10:9;Object.assign(state,{pageNumber:number,back:false,u:.72,v:.5,rotation:.1,taped:false});
    motion={direction,progress,grab:{tilt:.18,radius:88,release:1}};draw();const withCard=pixels();
    state.pageNumber=99999;draw();const withoutCard=pixels();state.pageNumber=number;
    let count=0;for(let i=0;i<withCard.length;i+=4)if(Math.max(Math.abs(withCard[i]-withoutCard[i]),Math.abs(withCard[i+1]-withoutCard[i+1]),Math.abs(withCard[i+2]-withoutCard[i+2]))>20)count++;
    results.push({direction,progress,pixels:count});
   }motion=null;return results;
  });
  for(const direction of [1,-1]){const baseline=coverage.find(r=>r.direction===direction&&r.progress===0).pixels;assert.ok(baseline>100);assert.ok(coverage.filter(r=>r.direction===direction&&r.progress>0&&r.progress<=.08).every(r=>r.pixels>baseline*.65),'Insert vanished at pickup');assert.equal(coverage.find(r=>r.direction===direction&&r.progress===1).pixels,0,'Buried card leaked through paper');}
  const lifecycle=await page.evaluate(()=>{
   const item=keepsakes[0],state=itemMounts.get(item.sheet),results=[];
   for(const direction of [1,-1]){
    spread=5;motion=null;const source=direction===1?10:9,target=source-direction;
    Object.assign(state,{pageNumber:source,u:.72,v:.5,rotation:.1,back:false,taped:false,anchorPage:null});delete state.edgeMark;
    const initial=JSON.stringify(state);begin(direction,true);motion.progress=.4;draw();finish(false);
    if(JSON.stringify(state)!==initial)throw Error('Cancelled turn mutated the saved insert');
    begin(direction,true);motion.progress=1;draw();finish(true);
    if(state.pageNumber!==target||!state.back||state.rotation!==-.1)throw Error('Incorrect landing support or orientation');
    const landed={...state};begin(-direction,true);motion.progress=1;draw();finish(true);
    if(state.pageNumber!==target||state.back!==landed.back)throw Error('Uncovering changed support');
    if(!itemHits.some(h=>h.item===item))throw Error('Uncovered card cannot be picked up');
    for(let n=0;n<20;n++){begin(direction,true);motion.progress=1;finish(true);begin(-direction,true);motion.progress=1;finish(true);}
    if(state.pageNumber!==target||Math.abs(state.u-landed.u)>.001||Math.abs(state.v-landed.v)>.001||Math.abs(state.rotation-landed.rotation)>.001)throw Error('Resting card drifted during 20 round trips');
    results.push({direction,target,back:state.back,roundTrips:20});
   }
   spread=5;motion=null;Object.assign(state,{pageNumber:10,u:.7,v:.45,rotation:.1,back:false,taped:true,anchorPage:10});
   begin(1,true);motion.progress=.7;draw();finish(true);if(state.anchorPage!==10||state.pageNumber!==10||state.back)throw Error('Tape lost its anchor');
   begin(-1,true);motion.progress=1;finish(true);if(!itemHits.some(h=>h.item===item))throw Error('Taped card did not return');
   return results;
  });
  const dragStart=await page.evaluate(()=>{
   motion=null;spread=5;const item=keepsakes[0];Object.assign(itemMounts.get(item.sheet),{pageNumber:10,u:.75,v:.5,rotation:.1,back:false,taped:false,anchorPage:null});draw();
    const hit=itemHits.find(h=>h.item===item),r=canvas.getBoundingClientRect();window.qaCard=item;
    return{x:r.left+hit.x*r.width/W,y:r.top+hit.y*r.height/H,targetCanvasX:CX-140,targetX:r.left+(CX-140)*r.width/W,targetY:r.top+hit.y*r.height/H,state:{...itemState(item)}};
  });
  await page.mouse.move(dragStart.x,dragStart.y);await page.mouse.down();assert.equal(await page.evaluate(()=>itemDrag?.item===qaCard),true);
  await page.mouse.move(dragStart.targetX,dragStart.targetY,{steps:32});
  const duringDrag=await page.evaluate(()=>({mount:{...itemState(qaCard)},x:itemDrag?.displayX,y:itemDrag?.displayY}));
  assert.deepEqual(duringDrag.mount,dragStart.state,'The saved insert support changed before release');
  assert.ok(Math.abs(duringDrag.x-dragStart.targetCanvasX)<3,'The lifted insert did not remain under the pointer across the gutter');
  await page.mouse.up();assert.equal(await page.evaluate(()=>motion===null),true,'Card drag turned underlying page');
  assert.equal(await page.evaluate(()=>itemState(qaCard).pageNumber),9,'Cross-spread drop did not attach to the release page');
  await page.waitForFunction(()=>itemDrag===null,null,{timeout:3000});
  const saved=await page.evaluate(()=>{persistInsertMounts();return {...itemMounts.get(qaCard.sheet)};});
  await page.reload();await page.waitForFunction(()=>loaded);assert.deepEqual(await page.evaluate(()=>({...itemMounts.get(keepsakes[0].sheet)})),saved,'Saved insert pose lost on reload');
  assert.deepEqual(errors,[]);const result={coverage,lifecycle,cardDrag:true,crossGutterTransfer:true,stableSupportDuringDrag:true,persistence:true,tapedAnchor:true,cancellation:true,errors,output};await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
