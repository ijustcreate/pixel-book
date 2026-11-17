const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{const desktop=process.env.BOOK_QA_EXE;const b=desktop?await _electron.launch({executablePath:desktop,args:['--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'book-audio-qa-'))]}):await chromium.launch({channel:'msedge',headless:true});try{
 const p=desktop?await b.firstWindow():await b.newPage({viewport:{width:1300,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(desktop)await b.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});else await p.goto(process.argv[2]||'http://127.0.0.1:4174/');await p.waitForFunction(()=>loaded,null,{timeout:120000});
 assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').some(r=>/transformers|onnx|headtts/.test(r.name))),false,'Voice model must not load at startup');
 await p.evaluate(()=>{openSavedBook('starter-keeper');readerPage=1;renderReadingPage();document.querySelector('#reading-view').showModal();document.querySelector('#reading-text').innerHTML='<p>The little book opens. Read every word with me.</p>';document.querySelector('#audio-continue').checked=false;});
 assert.equal(await p.locator('#audio-voice option').count(),8);
 await p.locator('#audio-play').click();
 let previous='',seenHighlight=false,seenRunning=false;
 const deadline=Date.now()+240000;
 while(Date.now()<deadline){
  const s=await p.evaluate(()=>({status:document.querySelector('#audio-status').textContent,...bookNarration.state,words:document.querySelectorAll('.narration-word').length}));
  if(s.status!==previous){console.log(JSON.stringify(s));previous=s.status;}
  seenRunning||=s.running;seenHighlight||=!!s.highlighted;
  if(s.status.startsWith('Could not'))throw Error(s.status);
  if(seenRunning&&!s.running){assert.equal(s.status,'Finished reading.');break;}
  await p.waitForTimeout(200);
 }
 assert.ok(seenHighlight,'Real neural audio must highlight a word');
 assert.equal(await p.evaluate(()=>bookNarration.state.running),false,'Narration must finish');
 // A second play reuses the model and supports pause/stop without stale highlights.
 await p.locator('#audio-play').click();await p.waitForFunction(()=>document.querySelector('.spoken-word'),null,{timeout:90000});
 await p.locator('#audio-pause').click();assert.equal(await p.evaluate(()=>bookNarration.state.paused),true);
 await p.locator('#audio-stop').click();assert.deepEqual(await p.evaluate(()=>({running:bookNarration.state.running,highlighted:bookNarration.state.highlighted})),{running:false,highlighted:null});
 await p.locator('#reading-next').click();assert.equal(await p.locator('.spoken-word').count(),0);
 await p.evaluate(()=>{readerPage=readingPageCount()-2;renderReadingPage();document.querySelector('#reading-text').innerHTML='<p>The first page.</p>';document.querySelector('#audio-continue').checked=true;document.addEventListener('book-reading-page-ready',()=>{document.querySelector('#reading-text').innerHTML='<p>The final page.</p>';},{once:true});});
 await p.locator('#audio-play').click();await p.waitForFunction(()=>document.querySelector('#audio-status').textContent==='Finished reading.',null,{timeout:90000});
 assert.equal(await p.evaluate(()=>readerPage),await p.evaluate(()=>readingPageCount()-1));assert.ok((await p.locator('#reading-text').textContent()).includes('The final page.'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({realNeuralAudio:true,highlighting:true,pauseStop:true,continuousPages:true,lazyModel:true,errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
