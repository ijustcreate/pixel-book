const {chromium,_electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const output=await fs.mkdtemp(path.join(os.tmpdir(),'book-surface-quality-'));
 const desktop=!!process.env.BOOK_QA_EXE,profile=desktop?await fs.mkdtemp(path.join(os.tmpdir(),'book-surface-profile-')):null;
 const browser=desktop?await _electron.launch({executablePath:process.env.BOOK_QA_EXE,args:['--user-data-dir='+profile]}):await chromium.launch({channel:'msedge',headless:true});
 const page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1180,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(desktop)await browser.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.hide();w.webContents.setBackgroundThrottling(false);}});
 try{
  if(!desktop)await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>loaded,null,{timeout:60000});
  const raster=await page.evaluate(()=>{
   const renderer=new PaperSurfaceRenderer();if(!renderer.ready)throw Error('Primary depth renderer unavailable');
   const texture=(color,hole=false)=>{const c=spriteSurface(32,32),p=c.getContext('2d');p.fillStyle=color;p.fillRect(0,0,32,32);if(hole)p.clearRect(10,10,12,12);return c;};
   const red=texture('#ff0000'),blue=texture('#0000ff'),green=texture('#00ff00');
   const read=(x,y)=>{const gl=renderer.gl,out=new Uint8Array(4);gl.readPixels(Math.floor(x),679-Math.floor(y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return [...out];};
   const flat=(depth,reverse=false)=>(u,v)=>({x:100+(reverse?1-u:u)*700,y:100+v*400,depth});
   renderer.begin(1000,680);renderer.surface(red,blue,1,16,16,flat(100));const front=read(450,300);
   renderer.begin(1000,680);renderer.surface(red,blue,1,16,16,flat(100,true));const back=read(450,300);
   renderer.begin(1000,680);renderer.surface(red,red,1,16,16,flat(100));renderer.surface(green,green,1,16,16,flat(20));const depth=read(450,300);
   renderer.begin(1000,680);renderer.surface(green,green,1,16,16,flat(20));renderer.surface(texture('#ff0000',true),blue,1,16,16,flat(100));const cutout=read(450,300),opaque=read(180,150);
   renderer.begin(1000,680);renderer.surface(red,blue,1,96,48,(u,v)=>({x:100+700*u+30*Math.sin(v*3),y:100+400*v+15*Math.sin(u*4),depth:100+u*40+v*30}));
   const gl=renderer.gl,pixels=new Uint8Array(1000*680*4);gl.readPixels(0,0,1000,680,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let holes=0;
   for(let y=140;y<470;y++)for(let x=150;x<760;x++)if(pixels[((679-y)*1000+x)*4+3]<250)holes++;
   const result={front,back,depth,cutout,opaque,holes,backend:renderer.stats.backend};
   gl.getExtension('WEBGL_lose_context')?.loseContext();return result;
  });
  assert.deepEqual(raster.front,[255,0,0,255],'Front face');assert.deepEqual(raster.back,[0,0,255,255],'Back face');assert.deepEqual(raster.depth,[255,0,0,255],'Depth independent of order');assert.deepEqual(raster.cutout,[0,255,0,255],'Alpha cutout depth');assert.deepEqual(raster.opaque,[255,0,0,255]);assert.equal(raster.holes,0,'Cracks between triangles');
  const geometry=await page.evaluate(()=>{
   openSavedBook('starter-keeper');bookShelfMode=false;bookTableMode=false;closedEdge=null;for(const item of allInserts())Object.assign(itemMounts.get(item.sheet),{pageNumber:99999,outside:false,taped:false});
   const samples=[];let maxH=0,maxV=0,minY=Infinity,maxY=-Infinity;
   for(const spreadIndex of [1,5,12])for(const direction of [-1,1])for(const progress of [.15,.35,.5,.7,.9])for(const tilt of [-.3,0,.3]){
    spread=spreadIndex;motion={direction,progress,grab:{tilt,radius:88,release:1,u:.9,v:.5}};const chain=turnChain(direction,progress),sheet=chain[0].sheet;
    if(chain.some(p=>!Number.isFinite(p.x+p.z)))throw Error('Non-finite vertex');
    for(let row=0;row<=12;row++)for(let i=0;i<=30;i++){
     const p=sheetSample(sheet,i/30,row/12),q=projectSheetPoint(p);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);
     if(i<30){const a=sheetSample(sheet,(i+1)/30,row/12),strain=Math.abs(Math.hypot(a.x-p.x,a.y-p.y,a.z-p.z)/sheet.lengths[i]-1);if(i>2)maxH=Math.max(maxH,strain);}
     if(row<12){const a=sheetSample(sheet,i/30,(row+1)/12);maxV=Math.max(maxV,Math.abs(Math.hypot(a.x-p.x,a.y-p.y,a.z-p.z)/(TURN_HEIGHT/12)-1));}
    }
    const hinge=Array.from({length:13},(_,i)=>sheetSample(sheet,0,i/12));if(hinge.some((p,i)=>Math.abs(p.x)>.001||Math.abs(p.y-i/12*TURN_HEIGHT)>.001))throw Error('Binding moved');
    samples.push({spread:spreadIndex,direction,progress,tilt});
   }
   motion=null;return{count:samples.length,maxH,maxV,minY,maxY};
  });
  assert.ok(geometry.maxH<.02,JSON.stringify(geometry));assert.ok(geometry.maxV<.06,JSON.stringify(geometry));assert.ok(geometry.maxY<=582,JSON.stringify(geometry));
  const cards=await page.evaluate(()=>{
   const item=keepsakes[2],results=[];spread=5;const width=128*208/180,height=96*164/136;
   for(const direction of [-1,1])for(const progress of [0,.2,.4,.6,.8,1])for(const [u,v] of [[.7,.5],[1.04,.12],[.9,-.02]]){
    motion={direction,progress,grab:{tilt:-.24,radius:88,release:1}};
    const chain=turnChain(direction,progress),pose={u,v,rotation:.2,back:false},frame=insertFrame(chain,pose,direction,width,height,item);
    const a=rigidSheetInsertWorld(chain,pose,direction,-width/2,0,width,height,item),b=rigidSheetInsertWorld(chain,pose,direction,width/2,0,width,height,item),c=rigidSheetInsertWorld(chain,pose,direction,0,-height/2,width,height,item),d=rigidSheetInsertWorld(chain,pose,direction,0,height/2,width,height,item);
    results.push({direction,progress,u,v,width:Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),height:Math.hypot(d.x-c.x,d.y-c.y,d.z-c.z),clearance:frame.clearance,orthogonality:vectorDot(frame.x,frame.y)});
   }motion=null;return results;
  });
  assert.ok(cards.every(c=>Math.abs(c.width-128*208/180)<.001&&Math.abs(c.height-96*164/136*(392/350))<.001&&Math.abs(c.orthogonality)<.001&&c.clearance>=.8),'Card distortion');
  const poses=[];
  for(const direction of [1,-1])for(const [label,progress,tilt] of [['peel',.12,-.2],['diagonal',.38,-.3],['crossing',.55,.2],['landing',.88,-.12]]){
   const stats=await page.evaluate(({direction,progress,tilt})=>{
    motion=null;spread=5;const source=direction===1?10:9,item=keepsakes[2];Object.assign(itemMounts.get(item.sheet),{pageNumber:source,u:.96,v:.23,rotation:.25,back:false,taped:false});
    motion={direction,progress,grab:{u:.9,v:.92,tilt,radius:88,release:1}};draw();return paperRenderer().stats;
   },{direction,progress,tilt});assert.equal(stats.backend,'webgl2');assert.ok(stats.objects>=3);poses.push({direction,label,stats});const png=await page.evaluate(()=>canvas.toDataURL('image/png').split(',')[1]);await fs.writeFile(path.join(output,`${direction}-${label}.png`),Buffer.from(png,'base64'));
  }
  const fallback=await page.evaluate(()=>{motion={direction:1,progress:.4,grab:{tilt:.2,radius:88,release:1}};const gpu=paperSurfaceRenderer;paperSurfaceRenderer=new CanvasPaperSurfaceRenderer();try{draw();return paperSurfaceRenderer.stats;}finally{paperSurfaceRenderer=gpu;motion=null;draw();}});assert.equal(fallback.backend,'canvas');assert.ok(fallback.triangles>1000);
  assert.deepEqual(errors,[]);const result={raster,geometry,cardSamples:cards.length,poses,fallback,errors,output};await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

