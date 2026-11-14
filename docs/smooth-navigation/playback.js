// Normal-speed final motion proof, without frame-by-frame style instrumentation.
async(page)=>{
 const browser=page.context().browser(),out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/smooth-navigation/",errors=[],failed=[];
 const c=await browser.newContext({viewport:{width:835,height:747},serviceWorkers:"block",recordVideo:{dir:out+"raw-video",size:{width:835,height:747}}});
 let video;const cases=[];
 try{
  await c.route("**/*",r=>{const u=new URL(r.request().url());return u.origin==="http://127.0.0.1:8034"&&!u.pathname.startsWith("/api/")?r.continue():r.abort();});
  const p=await c.newPage();video=p.video();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push(new URL(r.url()).pathname));
  await p.goto("http://127.0.0.1:8034/?qa=smooth-playback#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
  for(const route of["tasks","calendar"]){const start=Date.now();await p.locator(`.sidebar [data-view="${route}"]`).click();await p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");await p.evaluate(()=>new Promise(r=>setTimeout(r,100)));await p.mouse.move(350,300);const phase=await p.evaluate(()=>document.documentElement.dataset.pageTransitionPhase);if(phase!=="animate")throw new Error("Hover truncated transition");await p.waitForFunction(()=>!document.documentElement.dataset.pageTransition);cases.push({route,elapsed:Date.now()-start,phaseAtHover:phase});}
  await p.screenshot({path:out+"final-settled.png"});
 }finally{await c.close();}
 if(video)await video.saveAs(out+"final-playback-835.webm");
 return{runtime:browser.version(),cases,errors,failed,video:"final-playback-835.webm",allSyntheticContextsClosed:true};
}
