async(page)=>{
 const browser=page.context().browser(),cases=[],contexts=new Set(),errors=[],failed=[],blocked=[];
 try{
  for(const width of[835,1280,390]){
   const c=await browser.newContext({viewport:{width,height:width===1280?900:746},serviceWorkers:"block",hasTouch:width===390,isMobile:width===390});contexts.add(c);
   await c.route("**/*",r=>{const u=new URL(r.request().url());if(u.origin!=="http://127.0.0.1:8034"||u.pathname.startsWith("/api/")){blocked.push(u.pathname);return r.abort();}return r.continue();});
   const p=await c.newPage();p.setDefaultTimeout(5000);p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push(r.url()));
   await p.goto("http://127.0.0.1:8034/?qa=outline-baseline#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
   for(const theme of["light","dark"]){await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);cases.push(await p.evaluate(({width,theme})=>{
    const m=selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return{rect:e.getBoundingClientRect().toJSON(),border:s.border,borderRight:s.borderRight,borderRadius:s.borderRadius,shadow:s.boxShadow,background:s.backgroundColor,position:s.position,inset:s.inset,pointerEvents:s.pointerEvents,display:s.display};};
    return{width,theme,frame:m(".planner-workspace"),pane:m("#daily-task-panel"),main:m(".calendar-main-panel"),grid:m("#planner-calendar"),toolbar:m(".calendar-toolbar"),title:m(".calendar-title-copy"),today:m("#calendar-today"),actions:m(".calendar-toolbar-actions")};
   },{width,theme}));}
   await c.close();contexts.delete(c);
  }
  return{runtime:browser.version(),cases,errors,failed,blocked,allSyntheticContextsClosed:contexts.size===0};
 }finally{for(const c of contexts)await c.close();}
}
