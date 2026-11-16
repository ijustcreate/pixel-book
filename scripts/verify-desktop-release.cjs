const {_electron}=require('playwright');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const executablePath=process.argv[2];if(!executablePath)throw Error('Pass installed executable');
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'book-installed-qa-'));
 const app=await _electron.launch({executablePath,args:['--user-data-dir='+profile]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});
  await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded,{},{timeout:60000});
  const version=await app.evaluate(({app})=>app.getVersion());assert.equal(version,require('../package.json').version);
  const files=require('../package.json').build.files.filter(file=>!file.includes('*'));
  const verified=[];
  for(const file of files){const installed=await page.evaluate(async file=>await(await fetch('book://app/'+file)).text(),file);const local=await fs.readFile(path.resolve(file),'utf8');assert.equal(crypto.createHash('sha256').update(installed).digest('hex'),crypto.createHash('sha256').update(local).digest('hex'),file+' differs from working version');verified.push(file);}
  const turn=await page.evaluate(()=>{openSavedBook('starter-dracula');bookShelfMode=false;bookTableMode=false;closedEdge=null;spread=5;begin(1,true);motion.progress=.4;draw();const chain=turnChain(1,.4);return {rows:chain[0].sheet.grid.length,columns:chain.length,backend:paperRenderer().stats.backend};});
  assert.equal(turn.rows,25);assert.equal(turn.backend,'webgl2');assert.deepEqual(errors,[]);console.log(JSON.stringify({version,verified,turn,errors,profile}));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
