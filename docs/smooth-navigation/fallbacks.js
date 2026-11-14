// Proportionate final fallbacks, interruption checks and unpaused visual playback.
async(page)=>{
 const browser=page.context().browser(),contexts=new Set(),cases=[],errors=[],blocked=[],failed=[],responses=[];
 const out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/smooth-navigation/";
 let stage="start";
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 async function setup(spec={}){
  const width=spec.width||1280,height=spec.height||900;
  const c=await browser.newContext({viewport:{width,height},serviceWorkers:"block",hasTouch:!!spec.touch,isMobile:!!spec.touch,reducedMotion:spec.reduced?"reduce":"no-preference",...(spec.video?{recordVideo:{dir:out+"raw-video",size:{width,height}}}:{})});contexts.add(c);
  await c.route("**/*",r=>{const u=new URL(r.request().url());if(u.origin!=="http://127.0.0.1:8034"||u.pathname.startsWith("/api/")){blocked.push(u.origin+u.pathname);return r.abort();}return r.continue();});
  await c.addInitScript(spec=>{window.__edgeOwner="owner-a";if(spec.unsupported)document.startViewTransition=undefined;if(spec.fail)document.startViewTransition=()=>{throw new Error("Isolated capture failure");};if(spec.owner){let api;Object.defineProperty(window,"DuckViewTransitions",{configurable:true,get:()=>api,set(v){api={...v,create:args=>v.create({...args,getOwner:()=>window.__edgeOwner})};}});}},spec);
  const p=await c.newPage();p.setDefaultTimeout(5000);p.setDefaultNavigationTimeout(10000);p.on("pageerror",e=>errors.push(e.message));p.on("requestfailed",r=>failed.push({url:r.url(),failure:r.failure()?.errorText}));p.on("response",r=>{if(r.url().includes("browser-notifications.js"))responses.push({url:r.url(),status:r.status()});});await p.goto("http://127.0.0.1:8034/?qa=smooth-edges#calendar");await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().length>0);
  return{c,p,width,height};
 }
 async function close(c){await c.close();contexts.delete(c);}
 async function clean(p){const result=await p.evaluate(()=>({attrs:[...document.documentElement.attributes].filter(a=>a.name.startsWith("data-page-transition")).map(a=>a.name),names:document.querySelectorAll('[style*="view-transition-name"]').length,animations:document.getAnimations().filter(a=>a.id.startsWith("duck-route-live")||/duck-(workspace|route-)/.test(a.effect?.pseudoElement||"")).length,active:document.querySelectorAll(".view.active").length}));check(!result.attrs.length&&!result.names&&!result.animations&&result.active===1,"Transition cleanup failed "+JSON.stringify(result));return result;}
 const visit=(f,route)=>f.p.locator(`${f.width<=700?".phone-bottom-nav":".sidebar"} [data-view="${route}"]`).click();
 const end=p=>p.waitForFunction(()=>!document.documentElement.dataset.pageTransition);
 const active=p=>p.waitForFunction(()=>document.documentElement.dataset.pageTransitionPhase==="animate");
 try{
  for(const spec of[{reduced:true},{unsupported:true},{fail:true}]){
   stage="fallback "+JSON.stringify(spec);const f=await setup(spec);try{for(const route of["tasks","calendar"]){if(spec.touch)await f.p.locator(`.phone-bottom-nav [data-view="${route}"]`).tap();else await visit(f,route);check(await f.p.evaluate(route=>document.body.dataset.view===route&&!document.documentElement.dataset.pageTransition,route),"Fallback not immediate");}
    if(spec.touch){await f.p.locator("#phone-add-task").tap();await f.p.locator("#task-modal").waitFor({state:"visible"});await f.p.locator("#close-task-modal").tap();await f.p.waitForFunction(()=>!document.querySelector("#task-modal").open);await f.p.locator("#phone-task-summary").tap();check(await f.p.evaluate(()=>document.body.classList.contains("task-panel-open")),"Phone sheet did not open");await f.p.keyboard.press("Escape");}
    cases.push({test:"immediate-fallback",spec,passed:true,cleanup:await clean(f.p)});
   }finally{await close(f.c);}
  }
  return {runtime:browser.version(),cases,errors,blocked,failed,responses,allSyntheticContextsClosed:contexts.size===0};
 }catch(error){return{runtime:browser.version(),cases,errors,blocked,failed,responses,stage,harnessError:error.message};}finally{for(const c of contexts)await c.close();}
}
