// Moving target acceptance: trusted mouse input at visible live DOM coordinates.
async (page) => {
 const browser=page.context().browser(),contexts=new Set(),cases=[],errors=[],blocked=[];let stage="start";
 try {for(const [width,height]of[[835,747],[1280,900]]) {
  const c=await browser.newContext({viewport:{width,height},serviceWorkers:"block"});contexts.add(c);
  await c.route("**/*",r=>{const u=new URL(r.request().url());if(u.origin!=="http://127.0.0.1:8034"||u.pathname.startsWith("/api/")){blocked.push(u.origin+u.pathname);return r.abort();}return r.continue();});
  const p=await c.newPage();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);p.on("pageerror",e=>errors.push(e.message));
  try {await p.goto("http://127.0.0.1:8034/?qa=live-painted-input#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
   await p.evaluate(()=>{window.__inputEvents=[];for(const name of["pointerdown","pointerup","click"])document.addEventListener(name,e=>{const el=e.target;window.__inputEvents.push({name,trusted:e.isTrusted,target:el.tagName,clientY:e.clientY,checkboxRect:document.querySelector('#view-tasks input.task-check')?.getBoundingClientRect().toJSON(),id:el.dataset?.taskId||null,date:el.dataset?.slotDate||null,time:performance.now(),phase:document.documentElement.dataset.pageTransitionPhase||null});},true);});
   for(const target of["checkbox","slot"]) for(const hold of[0,100]) {
    stage=`${width} ${target} ${hold} navigation`;
    await p.evaluate(target=>{setView(target==="checkbox"?"calendar":"tasks");document.querySelector("#planner-calendar").scrollTop=0;},target);
    await p.locator(`.sidebar .nav-item[data-view="${target==="checkbox"?"tasks":"calendar"}"]`).click();
    stage=`${width} ${target} ${hold} wait animate`;await p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");
    const sampleDelay=target==="checkbox"&&hold?220:110;await p.evaluate(ms=>new Promise(r=>setTimeout(r,ms)),sampleDelay);
    const point=await p.evaluate(target=>{const e=document.querySelector(target==="checkbox"?'#view-tasks input.task-check':'.calendar-slot');const b=e.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{sampledAt:performance.now(),x:b.x+b.width/2,y:b.y+b.height/2,id:e.dataset.taskId||null,date:e.dataset.slotDate||null,time:e.dataset.slotTime||null,hit:hit?.outerHTML.slice(0,300),sameHit:hit===e||e.contains(hit),phase:document.documentElement.dataset.pageTransitionPhase,before:store.listItems().map(t=>({id:t.id,completed:t.completed})),liveAnimations:document.getAnimations().filter(a=>!a.effect?.pseudoElement&&a.effect?.target?.contains?.(e)).map(a=>({playState:a.playState,time:a.currentTime}))};},target);
    stage=`${width} ${target} ${hold} click`;await p.mouse.click(point.x,point.y,{delay:hold});
    if(target==="slot")try{await p.locator("#task-modal").waitFor({state:"visible",timeout:1000});}catch{}
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const after=await p.evaluate(()=>({phase:document.documentElement.dataset.pageTransitionPhase||null,items:store.listItems().map(t=>({id:t.id,completed:t.completed})),modal:document.querySelector("#task-modal").open,date:document.querySelector('[name="scheduledDate"]').value,time:document.querySelector('[name="scheduledTime"]').value,events:window.__inputEvents.splice(0)}));
    const changes=after.items.filter(t=>point.before.find(b=>b.id===t.id)?.completed!==t.completed);
    const passed=point.sameHit&&(target==="checkbox"?changes.length===1&&changes[0].id===point.id:after.modal&&after.date===point.date&&after.time===point.time&&changes.length===0);
    cases.push({width,height,target,hold,sampleDelay,point,after,changes,passed});
    if(after.modal){await p.locator("#close-task-modal").click();await p.waitForFunction(()=>!document.querySelector("#task-modal").open);}
    stage=`${width} ${target} ${hold} cleanup`;await p.waitForFunction(()=>!document.documentElement.dataset.pageTransition);
   }
  }finally{await c.close();contexts.delete(c);}
 }
 return{runtime:browser.version(),mode:"Fresh signed-out fixture; native-old/live-incoming expected; no API/external traffic",cases,errors,blocked,allSyntheticContextsClosed:contexts.size===0};
 }catch(error){return{runtime:browser.version(),cases,errors,blocked,harnessError:error.message,stage};}finally{for(const c of contexts)await c.close();}
}
