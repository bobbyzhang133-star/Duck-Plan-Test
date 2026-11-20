async page => {
  const browser=page.context().browser(),c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:"reduce"});
  try {
    await c.addInitScript(()=>{if(!localStorage.getItem("duckplan-demo-tasks-v1")){localStorage.setItem("duckplan-demo-tasks-v1","[]");localStorage.setItem("duckplan-demo-classes-v1","[]");}});
    const p=await c.newPage();await p.goto("http://127.0.0.1:8034/?qa=fold-cache#calendar");
    await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);
    await p.waitForFunction(()=>navigator.serviceWorker.controller!==null,undefined,{timeout:30000});
    const cache=await p.evaluate(async()=>{
      const name="duckplan-app-motion-preview-v73",cache=await caches.open(name),keys=await cache.keys(),files={};
      for(const file of ["index.html","app.js","planner-model.js","calendar-date-presentation.js","calendar-viewport.js","calendar-date-clarity.css"]){
        const key=keys.find(r=>new URL(r.url).pathname==="/"+file);if(!key)throw Error("Missing cached "+file);
        const body=await(await cache.match(key)).arrayBuffer();files[file]=[...new Uint8Array(await crypto.subtle.digest("SHA-256",body))].map(v=>v.toString(16).padStart(2,"0")).join("");
      }return {name,files};
    });
    await c.setOffline(true);await p.reload();await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);
    await p.evaluate(async()=>{await store.upsertItem({id:"offline-count",title:"Offline count",classId:null,dueDate:"2026-11-18",scheduledStart:"2026-11-18T09:00",durationMinutes:45,completed:false});selectedDate="2026-11-18";calendarView="week";renderAll({autoScrollCalendar:false});});
    await p.waitForFunction(()=>document.querySelector('.phone-week-day[data-date="2026-11-18"]').getAttribute("aria-label").includes("1 scheduled assignment"));
    await p.reload();await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady&&store.listItems().some(t=>t.id==="offline-count"));
    await p.evaluate(()=>{selectedDate="2026-11-18";calendarView="week";renderAll({autoScrollCalendar:false});document.querySelector("#planner-calendar").scrollTop=240;});await p.waitForTimeout(80);
    const state=await p.evaluate(()=>({label:document.querySelector('.phone-week-day[data-date="2026-11-18"]').getAttribute("aria-label"),fold:document.querySelector("#planner-calendar").classList.contains("is-timeline-scrolled")}));
    if(!state.fold||!state.label.includes("1 deadline"))throw Error("Offline count/fold lost");
    return {status:"PASS",runtime:browser.version(),cache,offlineReloadAndPersistence:true,state,installedPWA:false};
  }finally{await c.close();}
}
