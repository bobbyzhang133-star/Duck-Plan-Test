// Click the moving painted checkbox, rather than its stationary DOM rectangle.
async (page) => {
 const browser=page.context().browser(),cases=[],contexts=new Set();
 try{for(const width of [835,1280]){
 const c=await browser.newContext({viewport:{width,height:width===835?747:900},serviceWorkers:"block"});contexts.add(c);
 await c.route("**/*",r=>{const u=new URL(r.request().url());return u.origin==="http://127.0.0.1:8034"&&!u.pathname.startsWith("/api/")?r.continue():r.abort();});
 const p=await c.newPage();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);
 try{await p.goto("http://127.0.0.1:8034/?qa=painted-input#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
 await p.locator('.sidebar .nav-item[data-view="tasks"]').click();await p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");
 await p.evaluate(()=>new Promise(r=>setTimeout(r,65)));
 const target=await p.evaluate(()=>{const e=document.querySelector('#view-tasks input.task-check'),b=e.getBoundingClientRect(),named=e.closest('[style*="view-transition-name"]');const name=named?.style.viewTransitionName||"duck-workspace",nativeStyle=getComputedStyle(document.documentElement,`::view-transition-new(${name})`),nativeMatrix=new DOMMatrixReadOnly(nativeStyle.transform);const live=document.getAnimations().some(a=>a.effect?.target?.contains?.(e)&&!a.effect?.pseudoElement),offset=live?0:nativeMatrix.m42;return{id:e.dataset.taskId,x:b.x+b.width/2,y:b.y+b.height/2+offset,offset,live,opacity:live?getComputedStyle(e.closest('.view')).opacity:nativeStyle.opacity,name,before:store.listItems().map(t=>({id:t.id,completed:t.completed})),liveTargetAtPaintPoint:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2+offset)?.outerHTML.slice(0,500)};});
 await p.mouse.move(target.x,target.y);const afterHover=await p.evaluate(()=>document.documentElement.dataset.pageTransitionPhase||null);await p.mouse.down();await p.mouse.up();
 const after=await p.evaluate(()=>({phase:document.documentElement.dataset.pageTransitionPhase||null,items:store.listItems().map(t=>({id:t.id,completed:t.completed})),modal:document.querySelector("#task-modal").open}));
 const changes=after.items.filter(t=>target.before.find(b=>b.id===t.id)?.completed!==t.completed);
 cases.push({width,target,afterHover,after,changes,intendedOnly:changes.length===1&&changes[0].id===target.id});
 }finally{await c.close();contexts.delete(c);}}
 return{runtime:browser.version(),cases,allSyntheticContextsClosed:contexts.size===0};
 }finally{for(const c of contexts)await c.close();}
}
