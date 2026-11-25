// Public checks mutate isolated guest browser storage only, never hosted account records.
async (page) => {
  const browser=page.context().browser(),origin="https://duckplan-latest.ocs-learning.workers.dev",cases=[],evidence="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-original-duck-preview/docs/public-release-20261125/";
  const assert=(v,m)=>{if(!v)throw Error(m);};
  let capabilities,hashes;
  for(const [name,width,height,touch] of [["small",320,568,true],["phone",390,844,true],["landscape",844,390,true],["ipad",835,1112,true],["desktop",1280,900,false]]){
    const c=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:"no-preference",serviceWorkers:"block"}),p=await c.newPage(),result={name,viewport:[width,height],touchEmulated:touch,mode:"isolated guest storage",errors:[]};
    p.on("pageerror",e=>result.errors.push(e.message));
    try{
      await p.addInitScript(()=>{if(sessionStorage.getItem("release-seeded"))return;sessionStorage.setItem("release-seeded","1");localStorage.setItem("duckplan-demo-tasks-v1",JSON.stringify(Array.from({length:20},(_,i)=>({id:"release-"+i,title:"Release guest task "+i,dueDate:i===19?"2027-12-01":"2026-01-01",dueTime:"12:00",completed:false,classId:null,type:"task",durationMinutes:45,priority:"Medium",schemaVersion:2}))));});
      await p.goto(origin+"/#calendar",{timeout:30000});await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady&&store.listItems().length===20);
      if(!capabilities)capabilities=await p.evaluate(async()=>{const response=await fetch("/api/session");const data=await response.json();return {status:response.status,anonymous:!data.user,providers:data.providers};});
      const phone=await p.evaluate(()=>phonePlannerQuery.matches);if(phone){await p.locator("#phone-task-summary").tap();await p.waitForTimeout(450);}
      const button=p.locator('#overdue-section [data-complete-overdue]');if(touch)await button.tap();else await button.click();
      await p.waitForFunction(()=>overdueCompletion===null&&store.listItems().filter(t=>t.completed).length===19);await p.waitForTimeout(500);
      assert(await p.evaluate(()=>!store.listItems().find(t=>t.id==="release-19").completed&&JSON.parse(localStorage.getItem("duckplan-demo-tasks-v1")).filter(t=>t.completed).length===19),"Bulk scope/persistence failed");
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&!document.querySelector("[data-completion-section-exit]")),"Overflow/animation cleanup failed");
      await p.screenshot({path:evidence+"live-"+name+".png"});
      await p.reload();await p.waitForFunction(()=>typeof store!=="undefined"&&store.listItems().filter(t=>t.completed).length===19);
      if(!hashes)hashes=await p.evaluate(async()=>Object.fromEntries(await Promise.all(["app.js","planner-store.js","duck-interactions.js","completion-list-motion.js","index.html","service-worker.js"].map(async file=>{const text=await(await fetch("/"+file,{cache:"no-store"})).text();const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [file,[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")];}))));
      assert(!result.errors.length,result.errors.join("; "));result.passed=true;
    }catch(error){result.passed=false;result.error=error.message;}
    finally{await c.close();}cases.push(result);
  }
  return {runtime:browser.version(),origin,capabilities,hashes,cases,passed:cases.every(c=>c.passed),hostedAccountWrites:false,physicalDeviceClaims:false};
}
