async(page)=>{
 const browser=page.context().browser(),out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-outline/",errors=[],failed=[],cases=[];
 const c=await browser.newContext({viewport:{width:835,height:746},serviceWorkers:"block",recordVideo:{dir:out+"raw-video",size:{width:835,height:746}}});let video;
 try{
  await c.route("**/*",r=>{const u=new URL(r.request().url());return u.origin==="http://127.0.0.1:8034"&&!u.pathname.startsWith("/api/")?r.continue():r.abort();});
  const p=await c.newPage();video=p.video();p.setDefaultTimeout(5000);p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push(r.url()));
  await p.goto("http://127.0.0.1:8034/?qa=outline-playback#home");await p.bringToFront();await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
  for(const route of["calendar","home","calendar"]){await p.locator('.sidebar [data-view="'+route+'"]').click();await p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");cases.push(await p.evaluate(route=>({route,direction:document.documentElement.dataset.pageTransition,roots:document.getAnimations().filter(a=>a.id.startsWith("duck-route-live")&&a.id.endsWith("move")).map(a=>({id:a.id,target:a.effect.target.className}))}),route));await p.waitForFunction(()=>!document.documentElement.dataset.pageTransition);}
  await p.screenshot({path:out+"settled-calendar-835.png"});
 }finally{await c.close();}
 if(video)await video.saveAs(out+"calendar-outline-835.webm");
 return{runtime:browser.version(),cases,errors,failed,allSyntheticContextsClosed:true,file:"calendar-outline-835.webm",scope:"Normal unpaused isolated fixture playback after ready; not a performance measurement"};
}
