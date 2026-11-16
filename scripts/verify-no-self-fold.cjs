const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1180,height:950}});
    await page.goto('http://127.0.0.1:4174/');
    await page.waitForFunction(()=>loaded,null,{timeout:60000});
    const result=await page.evaluate(()=>{
      openSavedBook('starter-keeper');bookShelfMode=false;bookTableMode=false;spread=5;
      const poses=[];
      for(const direction of [1,-1]){
        for(let step=1;step<40;step++){
          const progress=step/40;
          motion={direction,progress};
          let sheet=turnChain(direction,progress)[0].sheet;
          if(pageCurveSelfIntersects(sheet))poses.push({direction,progress,mode:'automatic'});

          const hand={x:640-direction*(50+progress*200),y:250+Math.sin(progress*Math.PI)*100};
          for(const release of [1,.8,.55,.3,.08,0]){
            motion={direction,progress,grab:{u:.9,v:.5,direction,release,hand:{...hand}}};
            sheet=turnChain(direction,progress)[0].sheet;
            if(pageCurveSelfIntersects(sheet))poses.push({direction,progress,release,mode:'held-or-release'});
          }
        }
      }
      motion=null;return poses;
    });
    assert.deepEqual(result,[],'Nonadjacent parts of a page cross during a turn or release');
    console.log(JSON.stringify({checked:2*39*7,intersections:result.length}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
