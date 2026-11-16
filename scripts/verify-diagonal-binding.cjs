const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{const desktop=process.env.BOOK_QA_EXE,start=Date.now();const browser=desktop?await _electron.launch({executablePath:desktop,args:['--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'book-diagonal-profile-'))]}):await chromium.launch({channel:'msedge',headless:true});try{
 const page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];if(desktop)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});page.on('pageerror',e=>errors.push(e.message));if(!desktop)await page.goto('http://127.0.0.1:4174');await page.waitForFunction(()=>loaded,null,{timeout:120000});
 const readyMs=Date.now()-start;
 await page.evaluate(async()=>{openSavedBook('starter-dracula');for(const figure of bookPage(0).sourceFigures||[]){getSourceIllustration(figure.src);await sourceIllustrations.get(figure.src).decode();}});
 const result=await page.evaluate(()=>{
  openSavedBook('starter-dracula');closedEdge=null;bookShelfMode=false;bookTableMode=false;spread=0;motion=null;draw();window.bindingCapture=canvas.toDataURL();
  let bindingError=0,seamError=0,minAdvance=Infinity,maxRowError=0,maxVerticalStrain=0,maxHorizontalStrain=0,poses=0;
  for(const fraction of [0,.25,.5,.75,1]){spread=Math.round(fraction*(spreadCount()-1));motion=null;for(const side of [-1,1]){const chain=resting(side,side<0?spread/(spreadCount()-1):1-spread/(spreadCount()-1));for(let j=0;j<=24;j++){const a=project(chain[0],j/24),b=pageBindingAnchor(j/24);bindingError=Math.max(bindingError,Math.hypot(a.x-b.x,a.y-b.y));}}}
  for(const end of [0,1]){spread=end*(spreadCount()-1);motion=null;for(let j=0;j<=24;j++){const actual=project(resting(end?-1:1,1)[0],j/24),expected=coverPoint(end?SPINE_END:BOARD_SEAM,40+445*pagePerspective(j/24).vertical);seamError=Math.max(seamError,Math.hypot(actual.x-expected.x,actual.y-expected.y));}}
  window.bindingSpreads=[];for(const fraction of [0,.5,1]){spread=Math.round(fraction*(spreadCount()-1));motion=null;draw();window.bindingSpreads.push(canvas.toDataURL());}
  spread=5;
  for(const direction of [-1,1])for(const diagonal of [-.12,0,.12])for(let n=1;n<40;n++){
   const progress=n/40;motion={direction,progress,grab:{diagonal,pitch:diagonal*1.5,release:1}};const sheet=turnChain(direction,progress)[0].sheet;
   for(let j=0;j<=24;j++){const v=j/24;let last=sheet.evaluate(0,v);for(let i=1;i<=144;i++){
    const p=sheet.evaluate(i/144,v),sep=p.x*direction*Math.cos(sheet.axis)+(p.z-sheet.hinge)*Math.sin(sheet.axis),prior=last.x*direction*Math.cos(sheet.axis)+(last.z-sheet.hinge)*Math.sin(sheet.axis);
    minAdvance=Math.min(minAdvance,sep-prior);maxRowError=Math.max(maxRowError,Math.abs((p.y-sheet.pitch*sep)/TURN_HEIGHT-v));last=p;
    if(j<24){const q=sheet.evaluate(i/144,(j+1)/24);maxVerticalStrain=Math.max(maxVerticalStrain,Math.abs(Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)/(TURN_HEIGHT/24)-1));}
   }
   const pin=projectSheetPoint(sheet.evaluate(0,v)),anchor=pageBindingAnchor(v);bindingError=Math.max(bindingError,Math.hypot(pin.x-anchor.x,pin.y-anchor.y));
   }
   poses++;
  }
  const drags=[];
  for(const vertical of [-55,55]){motion=null;spread=5;const origin=project(sampleChain(resting(1,1-spread/(spreadCount()-1)),.9),.15);begin(1,true);motion.grab={direction:1,u:.9,v:.15,release:1};drag={x:origin.x,y:origin.y,direction:1,moved:true};updateManualPageTurn({x:origin.x-180,y:origin.y+vertical});const sheet=turnChain(1,motion.progress)[0].sheet;draw();drags.push({vertical,progress:motion.progress,tilt:sheet.tilt,pitch:sheet.pitch,tip:projectSheetPoint(sheet.evaluate(.9,.15)),capture:canvas.toDataURL()});}
  motion=null;drag=null;return{poses,bindingError,seamError,minAdvance,maxRowError,maxVerticalStrain,drags,shelfCache:bakedShelfMaterials.size,bodySizeCache:bundledBodySizes.size};
 });
 fs.writeFileSync(path.join(os.tmpdir(),'book-binding-new.png'),Buffer.from((await page.evaluate(()=>window.bindingCapture)).split(',')[1],'base64'));
 for(const [i,capture] of (await page.evaluate(()=>window.bindingSpreads)).entries())fs.writeFileSync(path.join(os.tmpdir(),'book-binding-spread-'+i+'.png'),Buffer.from(capture.split(',')[1],'base64'));
 for(const d of result.drags){fs.writeFileSync(path.join(os.tmpdir(),'book-diagonal-'+d.vertical+'.png'),Buffer.from(d.capture.split(',')[1],'base64'));delete d.capture;}
 console.log(JSON.stringify({...result,readyMs,errors}));assert.equal(errors.length,0);assert.ok(result.bindingError<.01);assert.ok(result.seamError<.01);assert.ok(result.minAdvance>0);assert.ok(result.maxRowError<1e-8);assert.ok(result.maxVerticalStrain<.06);assert.ok(result.drags[0].tilt<0&&result.drags[1].tilt>0);assert.ok(result.drags[1].tip.y-result.drags[0].tip.y>8);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
