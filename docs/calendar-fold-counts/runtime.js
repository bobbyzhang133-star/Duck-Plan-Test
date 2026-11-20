async page => {
  const browser=page.context().browser(),results=[],out="/Users/bobbyzhang/Documents/ChatGPT/Duck Plan/DuckPlan-motion-preview/docs/calendar-fold-counts/";
  const check=(v,m)=>{if(!v)throw Error(m);};
  for(const viewport of [{width:1280,height:1000},{width:835,height:1000},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    const c=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<700||viewport.height<500,timezoneId:"America/Los_Angeles",locale:"en-US",serviceWorkers:"block",reducedMotion:viewport.width===320?"reduce":"no-preference"});
    try {
      await c.addInitScript(()=>{if(localStorage.getItem("duckplan-demo-tasks-v1"))return;localStorage.setItem("duckplan-demo-classes-v1","[]");localStorage.setItem("duckplan-demo-tasks-v1",JSON.stringify([
        {id:"both",title:"Study calculus",dueDate:"2026-11-18",dueTime:"17:00",scheduledStart:"2026-11-18T15:00",durationMinutes:60,priority:"Medium",completed:false,schemaVersion:2},
        {id:"date",title:"Reading response",dueDate:"2026-11-18",dueTime:"",scheduledStart:null,durationMinutes:45,priority:"Medium",completed:false,schemaVersion:2},
        {id:"other",title:"Physics review",dueDate:"2026-11-20",dueTime:"12:00",scheduledStart:"2026-11-18T23:30",durationMinutes:90,priority:"Medium",completed:false,schemaVersion:2},
        {id:"done",title:"Completed",dueDate:"2026-11-18",scheduledStart:"2026-11-18T10:00",durationMinutes:45,completed:true,schemaVersion:2}
      ]));});
      const p=await c.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));p.setDefaultTimeout(10000);
      await p.clock.install({time:new Date("2026-11-18T10:05:00-08:00")});await p.goto("http://127.0.0.1:8034/?qa=fold-counts#calendar");
      await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);
      await p.evaluate(()=>{selectedDate="2026-11-18";calendarView="week";calendarUserScrolled=true;renderAll({autoScrollCalendar:false});});await p.waitForTimeout(100);
      const before=await p.evaluate(()=>JSON.stringify(store.listItems()));
      const counts=()=>{
        const root=document.querySelector("#phone-week-strip:not([hidden])")||document.querySelector(".timeline-days");
        return [...root.querySelectorAll("button[data-date]")].map(e=>({date:e.dataset.date,label:e.getAttribute("aria-label"),work:e.querySelector("[data-day-work-count]")?.textContent.trim()||"0",due:e.querySelector("[data-day-due-count]")?.textContent.trim()||"0"}));
      };
      let summary=await p.evaluate(counts),wed=summary.find(e=>e.date==="2026-11-18");
      check(wed?.work==="2"&&wed.due==="2", "Independent count mismatch "+JSON.stringify(summary));
      check(summary.find(e=>e.date==="2026-11-19").work==="0","Overnight counted twice");
      check(summary.find(e=>e.date==="2026-11-20").due==="1","Different-day due missing");
      for(const theme of ["light","dark"]){
        await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.querySelector("#planner-calendar").scrollTop=0;},theme);await p.waitForTimeout(70);
        const first=await p.evaluate(()=>{const r=document.querySelector("#planner-calendar"),h=r.querySelector(".timeline-days");return {shadow:r.classList.contains("is-timeline-scrolled"),header:h.getBoundingClientRect().toJSON(),fold:getComputedStyle(r.querySelector(".timeline-deadlines")||h).boxShadow};});
        check(!first.shadow,"Fold shadow at top");
        await p.evaluate(()=>document.querySelector("#planner-calendar").scrollTop=480);await p.waitForTimeout(100);
        const state=await p.evaluate(()=>{const r=document.querySelector("#planner-calendar"),h=r.querySelector(".timeline-days"),due=r.querySelector(".timeline-deadlines"),line=r.querySelector(".current-time-line"),strip=document.querySelector("#phone-week-strip");const buttons=[...document.querySelectorAll(".calendar-date-button,.phone-week-day")].filter(e=>e.getBoundingClientRect().height>0&&!e.closest("[hidden]"));return {shadow:r.classList.contains("is-timeline-scrolled"),fold:getComputedStyle(due||h).boxShadow,header:h.getBoundingClientRect().toJSON(),height:h.getBoundingClientRect().height,stripHeight:strip.hidden?null:strip.querySelector("button").getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:buttons.some(b=>{const box=b.getBoundingClientRect();return [...b.querySelectorAll(".calendar-day-counts span")].some(e=>{const x=e.getBoundingClientRect();return x.left<box.left-.5||x.right>box.right+.5||x.top<box.top-.5||x.bottom>box.bottom+.5;});}),lineVisible:!line||getComputedStyle(line).opacity==="1"};});
        check(state.shadow&&state.fold!==first.fold,"Fold did not respond to timeline scroll");check(Math.abs(first.header.top-state.header.top)<1,"Header moved with timetable");check(!state.overflow&&!state.clipped,"Count clipping "+JSON.stringify({viewport,state}));
        check(state.height<=66.5 && (!state.stripHeight||state.stripHeight<=56.5),"Counts enlarged header");
        await p.screenshot({path:out+`after-${viewport.width}-${theme}.png`});
        results.push({viewport,theme,status:"PASS",summary,state});
      }
      check(before===await p.evaluate(()=>JSON.stringify(store.listItems())),"Scrolling changed tasks");
      // Same-week refresh must update count children without replacing focused phone day buttons.
      await p.evaluate(()=>{const b=document.querySelector('.phone-week-day[data-date="2026-11-18"]');if(b){window.qaFocusedDay=b;b.focus();}});
      await p.evaluate(async()=>{await store.upsertItem({...store.listItems().find(t=>t.id==="date"),scheduledStart:"2026-11-19T09:00"});});
      await p.waitForFunction(()=>calendarDates.daySummary(tasks,"2026-11-19").workCount===1);
      summary=await p.evaluate(counts);check(summary.find(e=>e.date==="2026-11-19").work==="1","Reschedule count stale");
      check(await p.evaluate(()=>!window.qaFocusedDay||window.qaFocusedDay===document.activeElement),"Phone focus lost on count refresh");
      await p.evaluate(async()=>{await store.toggleComplete("both",true);});await p.waitForFunction(()=>calendarDates.daySummary(tasks,"2026-11-18").dueCount===1);
      summary=await p.evaluate(counts);check(summary.find(e=>e.date==="2026-11-18").work==="1"&&summary.find(e=>e.date==="2026-11-18").due==="1","Completion counts stale");
      await p.evaluate(async()=>{await store.upsertItem({...store.listItems().find(t=>t.id==="date"),dueDate:"2026-11-20"});});await p.waitForFunction(()=>calendarDates.daySummary(tasks,"2026-11-20").dueCount===2);
      check((await p.evaluate(counts)).find(e=>e.date==="2026-11-20").due==="2","Due edit stale");
      await p.evaluate(async()=>{await store.deleteItem("date");});await p.waitForFunction(()=>calendarDates.daySummary(tasks,"2026-11-20").dueCount===1);
      check((await p.evaluate(counts)).find(e=>e.date==="2026-11-19").work==="0","Deletion work count stale");
      // Add many tasks to stress two-digit phone counts and an empty-day slot.
      await p.evaluate(async()=>{for(let n=0;n<12;n++)await store.upsertItem({id:`many-${n}`,title:`Synthetic ${n}`,classId:null,dueDate:"2026-11-18",scheduledStart:"2026-11-18T09:00",durationMinutes:45,completed:false});});
      await p.waitForFunction(()=>calendarDates.daySummary(tasks,"2026-11-18").dueCount===12);
      check((await p.evaluate(counts)).find(e=>e.date==="2026-11-18").due==="12","Large count stale");
      const clipped=await p.evaluate(()=>[...document.querySelectorAll(".phone-week-day,.calendar-date-button")].filter(b=>!b.closest("[hidden]")).some(b=>{const r=b.getBoundingClientRect();return [...b.querySelectorAll(".calendar-day-counts span")].some(e=>{const x=e.getBoundingClientRect();return x.left<r.left-.5||x.right>r.right+.5||x.bottom>r.bottom+.5;});}));check(!clipped,"Two-digit counts overflow");
      await p.screenshot({path:out+`large-${viewport.width}.png`});
      const snapshot=()=>JSON.stringify(Model.migrateTasks(store.listItems()).map(t=>Object.fromEntries(Object.entries(t).sort(([a],[b])=>a.localeCompare(b)))));
      const saved=await p.evaluate(snapshot);await p.reload();await p.waitForFunction(()=>typeof store!=="undefined"&&workAlertContextReady);const afterSaved=await p.evaluate(snapshot);check(saved===afterSaved,"CRUD counts tasks did not persist "+JSON.stringify(JSON.parse(saved).map((a,i)=>{const b=JSON.parse(afterSaved)[i];return {id:a.id,diff:[...new Set([...Object.keys(a),...Object.keys(b||{})])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b?.[k])).map(k=>[k,a[k],b?.[k]])};}).filter(x=>x.diff.length)));
      await p.evaluate(()=>{selectedDate="2026-11-18";calendarView="day";renderAll({autoScrollCalendar:false});});await p.waitForTimeout(70);
      check(await p.locator('.calendar-date-button[aria-label*="12 deadlines"]').count()===1,"Day mode counts not refreshed");
      await p.evaluate(()=>{calendarView="month";renderCalendar();});await p.waitForTimeout(60);check(await p.locator('.is-timeline-scrolled').count()===0,"Fold leaked into Month");
      check(errors.length===0,errors.join(";"));
    }finally{await c.close();}
  }
  return {runtime:browser.version(),mode:"isolated local storage and actual browser actions; not native",results};
}
